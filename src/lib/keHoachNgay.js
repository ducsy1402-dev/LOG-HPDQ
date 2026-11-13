// Kế hoạch sản lượng theo NGÀY, theo line tàu (SQL 13, bảng ke_hoach_san_luong_ngay) và các số liệu của trang Mục tiêu sản lượng › Khai thác cảng:
//   • chia khối lượng một chuyến cho các ngày làm hàng;
//   • gộp kế hoạch ngày theo (ngày, hướng, nhóm hàng); so với thực tế (bảng san_luong_cang) và mục tiêu tháng;
//   • đếm tàu đang làm hàng / chờ trong 24 giờ tới cho ba thẻ (HRC, thép thành phẩm, hàng nhập).
import { trangThai, klCanLam } from "./linetime";
import { mocDuKien } from "./xepBen";
import { dongHang } from "./sanLuong";
import { laHRC, loaiKhoTuHang } from "./kho";
import { plain } from "./format";

const HOUR = 36e5, DAY = 864e5;
const p2 = (n) => String(n).padStart(2, "0");
export const ngayDia = (t) => { const d = new Date(t); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };
const dauNgay = (t) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
const ms = (x) => (x ? new Date(x).getTime() : null);

// Khoảng thời gian làm hàng (ms) của chuyến để chia kế hoạch: bắt đầu → kết thúc làm hàng (thực tế nếu có, không thì dự kiến); null nếu chưa có mốc
export function khoangLamHang(v) {
  const m = mocDuKien(v), a = m.bd ?? m.cap ?? m.eta, b = m.kt ?? m.roi ?? (a != null ? a + DAY : null);
  return a != null && b != null ? { a, b: Math.max(b, a + HOUR) } : null;
}
// Các ngày (yyyy-mm-dd) chuyến chiếm bến, từ ngày cập đến ngày rời
export function ngayCuaChuyen(v) {
  const m = mocDuKien(v), a = m.cap ?? m.bd ?? m.eta, b = m.roi ?? m.kt ?? (a != null ? a + DAY : null);
  if (a == null || b == null) return [];
  const out = []; for (let t = dauNgay(a); t <= Math.max(b, a); t += DAY) out.push(ngayDia(t));
  return [...new Set(out)];
}
// Chia khối lượng cần làm của chuyến theo giờ làm hàng vào từng ngày: Map ngày -> tấn (làm tròn tấn, phần dư dồn vào ngày nhiều nhất)
export function chiaDeuTheoGio(v, tong = klCanLam(v)) {
  const k = khoangLamHang(v), out = new Map();
  if (!k || !(tong > 0)) return out;
  const dai = k.b - k.a; let da = 0, lon = null;
  for (let t = dauNgay(k.a); t < k.b; t += DAY) {
    const phan = Math.max(0, Math.min(k.b, t + DAY) - Math.max(k.a, t)) / dai;
    if (phan <= 0) continue;
    const x = Math.round(tong * phan); out.set(ngayDia(t), x); da += x;
    if (lon == null || phan > lon.phan) lon = { ngay: ngayDia(t), phan };
  }
  if (lon && da !== Math.round(tong)) out.set(lon.ngay, Math.max(0, out.get(lon.ngay) + Math.round(tong) - da));
  return out;
}

// Gộp kế hoạch ngày theo (ngày, hướng, nhóm hàng): Map "ngày|hướng|nhóm" -> tấn. Chuyến nhiều dòng hàng chia theo tỉ lệ khối lượng từng dòng.
export function keHoachTheoNgay(rows, vmap, nhomHang) {
  const m = new Map();
  for (const r of rows || []) {
    const v = vmap.get(r.voyage_id); if (!v || !(+r.khoi_luong > 0)) continue;
    const huong = v.huong === "xuat" ? "xuat" : "nhap", ds = dongHang(v, nhomHang), tong = ds.reduce((s, h) => s + h.kl, 0);
    for (const h of ds) { const k = `${String(r.ngay).slice(0, 10)}|${huong}|${h.loai}`; m.set(k, (m.get(k) || 0) + (+r.khoi_luong) * (tong > 0 ? h.kl / tong : 1 / ds.length)); }
  }
  return m;
}
// Tổng một hướng (và nhóm hàng nếu có) theo từng ngày của danh sách ngày: mảng cùng độ dài
export function tongNgay(map, ngays, huong, nhom = "") {
  return ngays.map((n) => { let s = 0; for (const [k, v] of map) { const [d, h, l] = k.split("|"); if (d === n && h === huong && (!nhom || plain(l) === plain(nhom))) s += v; } return s; });
}
// Thực tế (san_luong_cang) theo ngày của một hướng (và nhóm hàng nếu có)
export function thucTeNgay(thucTe, ngays, huong, nhom = "") {
  const m = new Map();
  for (const r of thucTe || []) if (r.huong === huong && (!nhom || plain(r.loai_hang) === plain(nhom))) { const d = String(r.ngay).slice(0, 10); m.set(d, (m.get(d) || 0) + (+r.tan || 0)); }
  return ngays.map((n) => m.get(n) || 0);
}
// Chuỗi kế hoạch ngày của một hướng: có kế hoạch ngày thì dùng (ngày chưa đặt = 0); chưa có kế hoạch ngày nào trong tháng thì mục tiêu tháng chia đều theo số ngày.
// Trả { kh: mảng tấn, nguon: "ngay" | "muc_tieu" | "khong" }
export function chuoiKeHoach(map, ngays, huong, mucTieuThang) {
  const ngay = tongNgay(map, ngays, huong);
  if (ngay.some((x) => x > 0)) return { kh: ngay, nguon: "ngay" };
  if (mucTieuThang > 0) return { kh: ngays.map(() => mucTieuThang / ngays.length), nguon: "muc_tieu" };
  return { kh: ngays.map(() => 0), nguon: "khong" };
}
export const luyKe = (a, gioiHan = a.length) => { let s = 0; return a.map((x, i) => (i < gioiHan ? (s += x) : null)); };

// Nhóm hàng chính (nhiều tấn nhất) và tên hàng của một chuyến
export const hangChinh = (v) => { const ds = (v.hang_ds || []).filter((h) => h && (h.ten_hang || h.loai_hang)).sort((a, b) => (+b.khoi_luong || 0) - (+a.khoi_luong || 0)); return ds[0]?.ten_hang || ds[0]?.loai_hang || v.ten_hang || v.loai_hang || ""; };
// Hàng thành phẩm: theo cột loại hàng của Danh mục › Hàng hóa (thanh_pham) nếu có, không thì đoán theo tên / nhóm (loaiKhoTuHang)
const laThanhPham = (ten, hangHoa) => { const x = hangHoa.find((y) => plain(y.loai_hang) === plain(ten)); return x?.loai_hh ? x.loai_hh === "thanh_pham" : loaiKhoTuHang(ten, hangHoa) === "thanh_pham"; };
// Loại thẻ của chuyến: "hrc" (xuất HRC) · "tp" (xuất thép thành phẩm khác: cuộn, thanh…) · "nhap" (hàng nhập) · null (xuất hàng khác)
export function loaiThe(v, hangHoa = []) {
  if (v.huong !== "xuat") return "nhap";
  const h = hangChinh(v);
  if (laHRC(h, hangHoa) || laHRC(v.loai_hang, hangHoa)) return "hrc";
  return laThanhPham(h, hangHoa) ? "tp" : null;
}
// Ba thẻ tàu: mỗi loại { lam: [chuyến đang làm hàng], cho: [chuyến chưa làm hàng, dự kiến bắt đầu trong 24 giờ tới (hoặc đã quá giờ)] }
export function demTau(voyages, now, hangHoa = []) {
  const out = { hrc: { lam: [], cho: [] }, tp: { lam: [], cho: [] }, nhap: { lam: [], cho: [] } };
  for (const v of voyages || []) {
    if (v.huy) continue;
    const st = trangThai(v, now); if (st === "xong_hang" || st === "da_roi" || st === "huy") continue;
    const loai = loaiThe(v, hangHoa); if (!loai) continue;
    if (st === "lam_hang") { out[loai].lam.push(v); continue; }
    const bd = mocDuKien(v).bd ?? ms(v.etb) ?? ms(v.eta);
    if (bd != null && bd <= now + 24 * HOUR) out[loai].cho.push(v);
  }
  const theoGio = (a, b) => (ms(a.etb || a.eta) ?? 0) - (ms(b.etb || b.eta) ?? 0);
  for (const k of Object.keys(out)) { out[k].lam.sort(theoGio); out[k].cho.sort(theoGio); }
  return out;
}
