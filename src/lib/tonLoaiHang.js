// Tồn hiện tại và dự báo đầy theo LOẠI HÀNG của một loại kho (Khai thác kho bãi › Kho hàng kiện, anh Sỹ 21/11/2026).
// Loại hàng = nhóm hàng của Danh mục › Hàng hóa (nomOf), hoặc từng hàng nếu truyền hàm trả chính tên hàng.
//   • tonTheoLoaiHang: tồn hiện tại, sức chứa và % lấp đầy theo loại hàng. Sức chứa của gian / lô cố định hàng tính trọn cho hàng đó; gian / lô chứa nhiều hàng chia theo tỉ lệ tồn;
//     gian / lô đang trống mà đã khai hàng thì tính cho hàng khai báo. Gian / lô chưa có hàng nào thì không thuộc loại hàng nào.
//   • duBaoDay: "nếu không xuất bán thì bao lâu đầy" = (sức chứa − tồn) ÷ nhập mỗi ngày. Nhập mỗi ngày lấy kế hoạch nhập đang có hiệu lực hôm nay (Kế hoạch xuất/nhập kho), không có thì bình quân 30 ngày gần nhất theo sổ.
//     Thêm cột "theo xu hướng" = (sức chứa − tồn) ÷ (nhập − xuất bình quân 30 ngày) để đối chiếu khi vẫn xuất bán như hiện nay.
import { khuCuaKeHoach, ngayStr } from "./kho";
import { khoaDiem } from "./bieuDoSanLuong";
import { plain } from "./format";
import { ngayCuaKeHoach } from "./keHoachKy";

const DAY = 864e5, r2 = (x) => Math.round((+x || 0) * 100) / 100;
const KHONG_NHOM = "(chưa có nhóm)";
const nhanCua = (nhomOf, hang) => { const ten = String(nhomOf(hang) || "").trim() || KHONG_NHOM; return { k: plain(ten), ten }; };

export function tonTheoLoaiHang({ kho, loai, nhomOf }) {
  const m = new Map();
  const lay = (h) => { const { k, ten } = nhanCua(nhomOf, h); if (!m.has(k)) m.set(k, { k, ten, ton: 0, sucChua: 0 }); return m.get(k); };
  for (const c of kho.cap) if (c.loai === loai && Math.abs(c.ton) > 1e-6) lay(c.hang).ton += c.ton;
  for (const d of kho.dong) {
    if (d.loai !== loai || d.saiBai || !(d.sucChua > 0)) continue;
    const chua = (d.chua || []).filter((c) => c.ton > 1e-6);
    if (d.kieu === "co_dinh_hang" && d.hang) { lay(d.hang).sucChua += d.sucChua; continue; }
    if (chua.length) { const w = chua.reduce((s, c) => s + c.ton, 0); for (const c of chua) lay(c.hang).sucChua += (d.sucChua * c.ton) / w; }
    else if (d.hang) lay(d.hang).sucChua += d.sucChua;
  }
  return [...m.values()].filter((x) => x.ton > 1e-6 || x.sucChua > 0).map((x) => ({ ...x, ton: r2(x.ton), sucChua: r2(x.sucChua), lapDay: x.sucChua > 0 ? x.ton / x.sucChua : null })).sort((a, b) => b.ton - a.ton);
}

// Trạng thái: da_day | gap (đầy trong ≤ 7 ngày) | chu_y (≤ 30 ngày) | on | khong_nhap (không có nhập, không đầy) | thieu_suc_chua
export function duBaoDay({ kho, loai, nhomOf, giaoDich = [], keHoach = [], now = Date.now(), soNgayBQ = 30 }) {
  const homNay = ngayStr(now), tu = ngayStr(now - soNgayBQ * DAY);
  const loaiKey = new Map(kho.dong.map((d) => [d.key, d.loai])), loaiOf = (b, h, khu) => loaiKey.get(kho.gan(b, h, khu));
  const nhap = new Map(), xuat = new Map();
  for (const g of giaoDich) {
    const n = String(g.ngay).slice(0, 10);
    if (n <= tu || n > homNay || (g.loai !== "nhap" && g.loai !== "xuat") || loaiOf(g.ten_bai, g.hang, g.ten_khu) !== loai) continue;
    const m = g.loai === "nhap" ? nhap : xuat, k = nhanCua(nhomOf, g.hang).k;
    m.set(k, (m.get(k) || 0) + (+g.so_luong || 0) / soNgayBQ);
  }
  const dongOk = kho.dong.filter((d) => !d.saiBai), khNhap = new Map();
  for (const r of keHoach) {
    if (r.huong === "xuat") continue;
    const d = khuCuaKeHoach(r, dongOk); if (!d || d.loai !== loai) continue;
    const hang = r.hang || d.hang; if (!hang) continue;
    const nd = ngayCuaKeHoach(r); if (!nd.includes(homNay)) continue; // chỉ kế hoạch đang có hiệu lực hôm nay
    const k = nhanCua(nhomOf, hang).k;
    khNhap.set(k, (khNhap.get(k) || 0) + (+r.khoi_luong || 0) / (nd.length || 1));
  }
  return tonTheoLoaiHang({ kho, loai, nhomOf }).map((x) => {
    const bq = nhap.get(x.k) || 0, kh = khNhap.get(x.k) || 0, nhapNgay = kh > 0 ? kh : bq, xuatNgay = xuat.get(x.k) || 0;
    const conTrong = x.sucChua > 0 ? Math.max(0, x.sucChua - x.ton) : null;
    const soNgay = (rong) => (conTrong == null ? null : conTrong <= 1e-6 ? 0 : rong > 1e-9 ? conTrong / rong : null);
    const ngayDay = soNgay(nhapNgay), ngayXH = soNgay(nhapNgay - xuatNgay);
    const ngayDuKien = (s) => (s == null ? null : ngayStr(now + Math.ceil(s) * DAY));
    const trangThai = conTrong == null ? "thieu_suc_chua" : conTrong <= 1e-6 ? "da_day" : ngayDay == null ? "khong_nhap" : ngayDay <= 7 ? "gap" : ngayDay <= 30 ? "chu_y" : "on";
    return { ...x, conTrong, nhapNgay: r2(nhapNgay), nguonNhap: kh > 0 ? "ke_hoach" : "binh_quan", xuatNgay: r2(xuatNgay), ngayDay, ngayDuKien: ngayDuKien(ngayDay), ngayDayXuHuong: ngayXH, ngayDuKienXuHuong: ngayDuKien(ngayXH), trangThai };
  });
}

// Dự báo tồn từng loại hàng cho các điểm CÒN LẠI của kỳ đang xem (biểu đồ Diễn biến tồn, 22/11/2026): tồn dự báo = tồn hôm nay + nhập − xuất mỗi ngày (không xuống dưới 0).
//   Nguồn nhập / xuất mỗi ngày của TỪNG hàng (che = "auto", mặc định): có KẾ HOẠCH nhập / xuất còn hiệu lực từ ngày mai (Kho › Kế hoạch Xuất/Nhập tồn, chia đều theo ngày của kỳ kế hoạch) thì theo kế hoạch,
//   không có thì theo TRUNG BÌNH thực tế 30 ngày gần nhất theo sổ (giaoDich phải phủ 30 ngày này). che = "kh" / "bq" ép dùng một nguồn cho mọi hàng.
// c = kết quả chuoiTonLoaiHang (diem, ds: [{ k, ton: [tồn thực tế từng điểm] }]). Trả { theo: Map(k -> [tồn dự báo từng điểm | null]), nguon: Map(k -> "kh" | "bq"), tongNhap, tongXuat, coSo }:
// điểm cuối cùng đã có số thực tế ngay trước đoạn dự báo được nhắc lại để đường nét đứt nối liền với đường thực tế; coSo = có nhập / xuất nào để dự báo không.
export function duBaoTonDiem(kyInfo, { c, kho, loai, nhomOf, keHoach = [], giaoDich = [], che = "auto", now = Date.now(), soNgayBQ = 30 }) {
  const { ngays, buoc } = kyInfo, homNay = kyInfo.homNay || ngayStr(now), cuoiKy = ngays[ngays.length - 1];
  const out = { theo: new Map(), nguon: new Map(), tongNhap: 0, tongXuat: 0, coSo: false };
  if (!c || !ngays.length || cuoiKy <= homNay) return out;
  const them = (s, n) => ngayStr(new Date(s + "T00:00:00").getTime() + n * DAY);
  const ngayToi = them(homNay, 1);
  const cong = (m, k, n, v) => { if (!m.has(k)) m.set(k, new Map()); m.get(k).set(n, (m.get(k).get(n) || 0) + v); };
  // Kế hoạch: k -> Map(ngày -> tấn)
  const khNhap = new Map(), khXuat = new Map(), dongOk = kho.dong.filter((d) => !d.saiBai);
  for (const r of keHoach) {
    const d = khuCuaKeHoach(r, dongOk); if (!d || d.loai !== loai) continue;
    const hang = r.hang || d.hang; if (!hang) continue;
    const nd = ngayCuaKeHoach(r), k = nhanCua(nhomOf, hang).k, moi = (+r.khoi_luong || 0) / (nd.length || 1);
    for (const n of nd) cong(r.huong === "xuat" ? khXuat : khNhap, k, n, moi);
  }
  const coKH = (k) => [khNhap.get(k), khXuat.get(k)].some((m) => m && [...m].some(([n, v]) => n >= ngayToi && v > 0)); // còn kế hoạch từ ngày mai
  // Trung bình thực tế: k -> tấn / ngày
  const loaiKey = new Map(kho.dong.map((d) => [d.key, d.loai])), tu = them(homNay, -soNgayBQ), bqNhap = new Map(), bqXuat = new Map();
  for (const g of giaoDich) {
    const n = String(g.ngay).slice(0, 10);
    if (n <= tu || n > homNay || (g.loai !== "nhap" && g.loai !== "xuat") || loaiKey.get(kho.gan(g.ten_bai, g.hang, g.ten_khu)) !== loai) continue;
    const k = nhanCua(nhomOf, g.hang).k, m = g.loai === "nhap" ? bqNhap : bqXuat; m.set(k, (m.get(k) || 0) + (+g.so_luong || 0) / soNgayBQ);
  }
  const cuoiDiem = new Map(); // khóa điểm -> ngày cuối của điểm trong kỳ
  for (const n of ngays) cuoiDiem.set(khoaDiem(buoc, n), n);
  for (const g of c.ds) {
    const dung = che === "kh" || (che === "auto" && coKH(g.k)) ? "kh" : "bq";
    let t = g.hienTai; const tonNgay = new Map();
    for (let n = ngayToi; n <= cuoiKy; n = them(n, 1)) {
      const a = dung === "kh" ? khNhap.get(g.k)?.get(n) || 0 : bqNhap.get(g.k) || 0, b = dung === "kh" ? khXuat.get(g.k)?.get(n) || 0 : bqXuat.get(g.k) || 0;
      t = Math.max(0, t + a - b); tonNgay.set(n, t);
      out.tongNhap += a; out.tongXuat += b; if (a || b) out.coSo = true;
    }
    const f = c.diem.map((o) => { const z = cuoiDiem.get(khoaDiem(buoc, o.dau)); return z > homNay ? r2(tonNgay.get(z) ?? g.hienTai) : null; });
    const j0 = f.findIndex((x) => x != null); // nối với điểm thực tế ngay trước đoạn dự báo
    if (j0 > 0 && g.ton[j0 - 1] != null) f[j0 - 1] = g.ton[j0 - 1];
    out.theo.set(g.k, f); out.nguon.set(g.k, dung);
  }
  return out;
}
