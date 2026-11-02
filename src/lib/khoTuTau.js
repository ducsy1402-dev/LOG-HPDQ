// Ghi kho từ chuyến tàu một chạm: đề xuất các dòng giao dịch kho (nhập cho tàu nhập, xuất cho tàu xuất)
// từ KL đã làm của chuyến trừ phần đã ghi kho (kho_giao_dich có voyage_id = chuyến), chia theo bãi và hàng của phương án / phiếu chuyến.
// Người dùng xem, sửa, rồi bấm ghi; không tự ghi gì khi chưa xác nhận.
import { daLam as klDaLam } from "./linetime";
import { plain } from "./format";
import { thietBiChuyen, hangCuaChuyen } from "./phuongAn";
import { khuNhan, ngayStr } from "./kho";

const lamTron = (x) => Math.round(x * 10) / 10;

// Số lô gợi ý LO-yymmdd-xx, không trùng các lô đã có (ds)
export function soLoMoi(ds = [], now = Date.now()) {
  const d = new Date(now), p = `LO-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-`;
  let i = 1;
  while (ds.includes(p + String(i).padStart(2, "0"))) i++;
  return p + String(i).padStart(2, "0");
}

// Tên hàng trong danh sách (không phân biệt dấu, hoa thường) khớp với tên hàng của chuyến; không có thì null
export function khopHang(ten, ds) {
  const p = plain(ten);
  if (!p) return null;
  const sach = ds.filter((h) => plain(h));
  return sach.find((h) => plain(h) === p) || sach.find((h) => plain(h).includes(p) || p.includes(plain(h))) || null;
}

const tenBaiKho = (kho, b) => [...new Set(kho.dong.filter((d) => !d.saiBai).map((d) => d.ten_bai))].find((x) => plain(x) === plain(b)) || null;
const capCua = (kho, bai, hang) => kho.cap.find((c) => c.ten_bai === bai && plain(c.hang) === plain(hang));

// Tàu xuất, hàng thành phẩm: lấy theo lô cũ trước (ngày nhập sớm nhất), chỉ lô sẵn sàng xuất. Trả [{ so_lo, tan }] và phần còn thiếu
export function phanLoXuat(kho, bai, hang, tan) {
  const lots = kho.lo.filter((l) => l.ten_bai === bai && plain(l.hang) === plain(hang) && l.trang_thai === "san_sang" && l.ton > 1e-6)
    .sort((a, b) => String(a.ngay_nhap || "").localeCompare(String(b.ngay_nhap || "")) || a.so_lo.localeCompare(b.so_lo));
  const ra = [];
  let con = tan;
  for (const l of lots) { if (con <= 1e-6) break; const lay = Math.min(l.ton, con); ra.push({ so_lo: l.so_lo, tan: lamTron(lay) }); con -= lay; }
  return { ra, thieu: con > 0.05 ? lamTron(con) : 0 };
}

// Kiểm tra một dòng giống biểu mẫu Nhập / Xuất kho; trả chuỗi lỗi hoặc null. row: { bai, hang, tan, so_lo }
export function kiemTraDongKho(row, kho, huong) {
  const bai = tenBaiKho(kho, row.bai);
  const hang = String(row.hang || "").trim();
  if (!String(row.bai || "").trim()) return "Chọn bãi";
  if (!bai) return `Bãi "${row.bai}" chưa có trong danh mục kho bãi`;
  if (!hang) return "Chọn hàng";
  if (!(+row.tan > 0)) return "Số lượng phải lớn hơn 0";
  if (huong === "nhap") {
    const khu = khuNhan(kho, bai, hang);
    if (!khu) return `${bai} chưa có bãi chứa ${hang}. Khai báo ở Danh mục › Kho bãi`;
    if (khu.loai === "thanh_pham" && !String(row.so_lo || "").trim()) return "Thành phẩm cần số lô";
    return null;
  }
  const c = capCua(kho, bai, hang);
  if (!c) return `${bai} không có ${hang} (tồn 0 t)`;
  if (c.loai === "thanh_pham") {
    if (!String(row.so_lo || "").trim()) return "Chọn lô xuất";
    const ton = kho.lo.find((l) => l.ten_bai === bai && plain(l.hang) === plain(hang) && l.so_lo === row.so_lo)?.ton || 0;
    return +row.tan > ton + 1e-6 ? `Vượt tồn lô ${row.so_lo}: còn ${lamTron(ton)} t` : null;
  }
  return +row.tan > c.ton + 1e-6 ? `Vượt tồn: ${bai} chỉ còn ${lamTron(c.ton)} t` : null;
}

// Đề xuất ghi kho cho một chuyến. Trả { huong, daLam, daGhi, conLai, rows: [{ bai, hang, tan, so_lo }], canh: [chữ] }
export function deXuatKhoTuTau(v, { kho, giaoDich = [], plans = [], now = Date.now() }) {
  const huong = v.huong === "xuat" ? "xuat" : "nhap";
  const lam = klDaLam(v);
  const daGhi = giaoDich.filter((g) => +g.voyage_id === +v.id && g.loai === huong).reduce((s, g) => s + (+g.so_luong || 0), 0);
  const conLai = Math.max(0, lam - daGhi);
  const out = { huong, daLam: lam, daGhi, conLai, rows: [], canh: [] };
  if (!(lam > 0)) { out.canh.push("Chuyến chưa có KL đã làm: ghi KL đã làm (tab Làm hàng) trước"); return out; }
  if (!(conLai >= 0.5)) { out.canh.push("Đã ghi kho đủ KL đã làm của chuyến"); return out; }

  // Bãi và tỉ lệ: theo khối lượng khai báo cho từng bãi; không khai báo khối lượng thì chia đều; không có bãi thì để trống cho người chọn
  const baiCh = thietBiChuyen(v, plans).bai;
  const tongW = baiCh.reduce((s, b) => s + (+b.khoi_luong > 0 ? +b.khoi_luong : 0), 0);
  const bais = baiCh.length ? baiCh.map((b) => ({ bai: tenBaiKho(kho, b.bai) || b.bai, w: tongW > 0 ? (+b.khoi_luong > 0 ? +b.khoi_luong : 0) : 1 })).filter((b) => b.w > 0) : [{ bai: "", w: 1 }];
  if (!baiCh.length) out.canh.push("Chuyến chưa khai báo bãi (tab Bãi & Thiết bị): chọn bãi cho từng dòng");
  const sumB = bais.reduce((s, b) => s + b.w, 0);
  // Hàng và tỉ lệ theo các dòng hàng của chuyến
  const hangs = hangCuaChuyen(v);
  const tongH = hangs.reduce((s, h) => s + h.kl, 0);

  let rows = [];
  for (const b of bais) for (const h of hangs) {
    const tan = conLai * (b.w / sumB) * (tongH > 0 ? h.kl / tongH : 1 / hangs.length);
    if (tan < 0.05) continue;
    const dsHang = huong === "nhap"
      ? [...new Set([...(kho.hangHoa || []).map((x) => x.loai_hang), ...kho.cap.filter((c) => c.ten_bai === b.bai).map((c) => c.hang)])]
      : kho.cap.filter((c) => c.ten_bai === b.bai && c.ton > 1e-6).map((c) => c.hang);
    rows.push({ bai: b.bai, hang: khopHang(h.ten, dsHang) || h.ten, tan: lamTron(tan), so_lo: "" });
  }
  // Làm tròn 0,1 t: dòng cuối nhận phần chênh để tổng đúng bằng phần chưa ghi
  if (rows.length) { const sai = lamTron(conLai - rows.reduce((s, r) => s + r.tan, 0)); rows[rows.length - 1].tan = lamTron(rows[rows.length - 1].tan + sai); }

  const dsLo = (kho.lo || []).map((l) => l.so_lo);
  const taoRows = [];
  for (const r of rows) {
    const bai = tenBaiKho(kho, r.bai);
    if (huong === "xuat" && bai && capCua(kho, bai, r.hang)?.loai === "thanh_pham") {
      // Xuất thành phẩm: tách theo lô cũ trước
      const { ra, thieu } = phanLoXuat(kho, bai, r.hang, r.tan);
      for (const x of ra) taoRows.push({ ...r, so_lo: x.so_lo, tan: x.tan });
      if (thieu > 0) taoRows.push({ ...r, so_lo: "", tan: thieu });
    } else if (huong === "nhap" && bai && khuNhan(kho, bai, r.hang)?.loai === "thanh_pham") {
      const lo = soLoMoi([...dsLo, ...taoRows.map((x) => x.so_lo)], now);
      taoRows.push({ ...r, so_lo: lo });
    } else taoRows.push(r);
  }
  out.rows = taoRows;
  return out;
}

// Dòng giao dịch kho từ một dòng đề xuất đã xác nhận
export function giaoDichTuDong(v, r, { ngay = ngayStr(Date.now()), ca = null, huong }) {
  return { ngay, ca, loai: huong, ten_bai: r.bai, den_bai: null, hang: r.hang, so_luong: +r.tan, so_lo: String(r.so_lo || "").trim() || null, nguon: "tau", voyage_id: v.id, chung_tu: `Tàu ${v.ten_tau}`, ghi_chu: null };
}
