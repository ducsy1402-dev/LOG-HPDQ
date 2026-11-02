// Sản lượng xếp dỡ theo tháng: thực hiện, KL tàu, mục tiêu (bảng muc_tieu_san_luong, SQL 21) theo hướng – loại hàng.
// Dùng ở Tổng quan › Khối lượng xếp dỡ và trang Khai thác Cảng › Mục tiêu sản lượng.
import { khoangBen, daLam, klCanLam } from "./linetime";
import { thangCua, plain } from "./format";
import { khoangKy, thangTrongKy } from "./ky";

export const thangCuaChuyen = (v, now) => { const k = khoangBen(v, now); return k ? thangCua(k.a) : null; };
// Nhóm hàng của một dòng hàng = cột "Nhóm" của hàng đó trong Danh mục › Hàng hóa (Quặng, Than, Đá, Phế…). Thứ tự tra:
//   1. đúng tên hàng trong danh mục (có nhiều tên cách nhau ";" thì lấy tên đầu có trong danh mục), rồi đúng loại hàng ghi ở chuyến;
//   2. loại hàng / tên hàng chính là một nhóm ("Quặng", "Than"…);
//   3. tên hàng bắt đầu bằng tên một nhóm ("Quặng cỡ Khumani" → Quặng, "Than PCI MV" → Than, "Đá 45-100mm" → Đá);
//   4. không nhận ra: giữ loại hàng (hoặc tên hàng) như ghi ở chuyến, đánh dấu chưa có nhóm (nhomHang.co() = false) để nhắc thêm vào danh mục.
// Chưa có danh mục (hangHoa rỗng): như cũ.
export const taoNhomHang = (hangHoa = []) => {
  const theoTen = new Map(), nhoms = new Map();
  for (const h of hangHoa || []) {
    const n = String(h?.nhom ?? "").trim();
    if (!h?.loai_hang || !n) continue;
    theoTen.set(plain(h.loai_hang), n); nhoms.set(plain(n), n);
  }
  const dsNhom = [...nhoms.entries()].map(([k, n]) => ({ k, n })).sort((a, b) => b.k.length - a.k.length); // nhóm nhiều chữ so trước
  const dauNhom = (t) => { const k = plain(t); return k ? dsNhom.find((x) => k === x.k || k.startsWith(x.k + " "))?.n : null; };
  const tra = (ten, loai) => {
    const tens = String(ten ?? "").split(/[;]+/).map((x) => x.trim()).filter(Boolean), l = String(loai ?? "").trim();
    for (const t of [...tens, l]) { const n = theoTen.get(plain(t)); if (n) return { nhom: n, co: true }; }
    for (const t of [l, ...tens]) { const n = nhoms.get(plain(t)); if (n) return { nhom: n, co: true }; }
    for (const t of [...tens, l]) { const n = dauNhom(t); if (n) return { nhom: n, co: true }; }
    return { nhom: l || tens[0] || "(chưa ghi)", co: false };
  };
  const f = (ten, loai) => tra(ten, loai).nhom;
  f.co = (ten, loai) => tra(ten, loai).co;
  return f;
};
const nhomMacDinh = taoNhomHang();
// Các dòng hàng của chuyến theo nhóm hàng; khối lượng đã làm chia theo tỉ lệ khối lượng từng dòng
export const dongHang = (v, nhomHang = nhomMacDinh) => {
  const ds = (v.hang_ds || []).filter((h) => h && (h.ten_hang || h.loai_hang));
  const lam = daLam(v), kl = klCanLam(v);
  if (ds.length < 2) return [{ loai: nhomHang(v.ten_hang, v.loai_hang), kl, lam }];
  const tong = ds.reduce((s, h) => s + (+h.khoi_luong || 0), 0) || 1;
  const he = +v.khoi_luong > 0 ? kl / +v.khoi_luong : 1; // hàng đã trả lại tàu không tính vào khối lượng xếp dỡ
  return ds.map((h) => ({ loai: nhomHang(h.ten_hang, h.loai_hang), kl: (+h.khoi_luong || 0) * he, lam: (lam * (+h.khoi_luong || 0)) / tong }));
};

// Khối lượng xếp dỡ một tháng (tháng của chuyến = tháng cập bến):
//   thực hiện = KL đã làm; KL tàu = tổng khối lượng các chuyến trong tháng;
//   mục tiêu = bảng muc_tieu_san_luong (SQL 21), mỗi dòng một hướng – loại hàng; theoLoai: thực hiện / mục tiêu theo "hướng|loại hàng"
const ngayChuoi = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
export const khoaLoai = (huong, loai) => `${huong}|${plain(loai)}`;
export const tinhThang = (D, thang, nhomHang = nhomMacDinh) => tinhKy(D, "thang", thang, nhomHang);
// Như trên nhưng theo kỳ bất kỳ (tuần, tháng, quý, năm): chuyến thuộc kỳ theo ngày cập bến. Mục tiêu là mục tiêu tháng:
// quý / năm cộng các tháng, tuần chia theo số ngày (phần của tháng nằm trong tuần).
export function tinhKy(D, loai, khoa, nhomHang = nhomMacDinh) {
  const { tu, den } = khoangKy(loai, khoa);
  const ds = D.voyages.filter((v) => { if (v.huy) return false; const k = khoangBen(v, D.now); return k != null && k.a >= tu && k.a < den; });
  const cong = (arr, f) => arr.reduce((s, v) => s + f(v), 0);
  const nhap = ds.filter((v) => v.huong !== "xuat"), xuat = ds.filter((v) => v.huong === "xuat");
  const kl = klCanLam;
  const theoLoai = new Map();
  const o = (huong, loai) => { const k = khoaLoai(huong, loai); if (!theoLoai.has(k)) theoLoai.set(k, { huong, loai, th: 0, tau: 0, mt: null }); return theoLoai.get(k); };
  for (const v of ds) for (const h of dongHang(v, nhomHang)) { const r = o(v.huong === "xuat" ? "xuat" : "nhap", h.loai); r.th += h.lam; r.tau += h.kl; }
  const phan = new Map(thangTrongKy(tu, den).map((x) => [x.thang, x.tyLe]));
  const dongMT = (D.mucTieu || []).filter((x) => phan.has(x.thang)).map((x) => ({ ...x, tan: (+x.tan || 0) * phan.get(x.thang) }));
  for (const m of dongMT) { const r = o(m.huong, m.loai_hang); r.mt = (r.mt || 0) + (+m.tan || 0); }
  const tongMT = (huong) => dongMT.filter((m) => m.huong === huong).reduce((s, m) => s + (+m.tan || 0), 0);
  const mucTieu = dongMT.length ? { nhap: tongMT("nhap"), xuat: tongMT("xuat"), tong: tongMT("nhap") + tongMT("xuat") } : null;
  // Kho: nhập / xuất trong tháng theo sổ giao dịch
  const ngayTu = ngayChuoi(tu), ngayDen = ngayChuoi(den - 1);
  const gd = (D.giaoDich || []).filter((g) => { const n = String(g.ngay).slice(0, 10); return n >= ngayTu && n <= ngayDen; });
  const kho = D.giaoDich ? { nhap: gd.filter((g) => g.loai === "nhap").reduce((s, g) => s + +g.so_luong, 0), xuat: gd.filter((g) => g.loai === "xuat").reduce((s, g) => s + +g.so_luong, 0) } : null;
  return { ds, mucTieu, theoLoai, klTau: cong(ds, kl), thucHien: cong(ds, daLam), nhap: { tau: cong(nhap, kl), th: cong(nhap, daLam) }, xuat: { tau: cong(xuat, kl), th: cong(xuat, daLam) }, kho };
}

// Hàng của các chuyến chưa xếp được vào nhóm nào (không có trong Danh mục › Hàng hóa, tên cũng không bắt đầu bằng tên nhóm): [{ ten, kl }] giảm dần theo khối lượng
export function hangChuaCoNhom(voyages, nhomHang) {
  const m = new Map();
  for (const v of voyages) {
    const ds = (v.hang_ds || []).filter((h) => h && (h.ten_hang || h.loai_hang));
    const dong = ds.length < 2 ? [{ ten_hang: v.ten_hang, loai_hang: v.loai_hang, khoi_luong: klCanLam(v) }] : ds;
    for (const h of dong) {
      if (nhomHang.co(h.ten_hang, h.loai_hang)) continue;
      const ten = String(h.ten_hang || h.loai_hang || "").trim() || "(chưa ghi)";
      m.set(ten, (m.get(ten) || 0) + (+h.khoi_luong || 0));
    }
  }
  return [...m.entries()].map(([ten, kl]) => ({ ten, kl })).sort((a, b) => b.kl - a.kl);
}
