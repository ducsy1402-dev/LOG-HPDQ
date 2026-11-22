// Kế hoạch sản lượng theo NGÀY, theo line tàu (SQL 13, bảng ke_hoach_san_luong_ngay) và các số liệu của trang Mục tiêu sản lượng › Khai thác cảng:
//   • chia khối lượng một chuyến cho các ngày làm hàng;
//   • gộp kế hoạch ngày theo (ngày, hướng, nhóm hàng); so với thực tế (bảng san_luong_cang) và mục tiêu tháng;
//   • đếm tàu đang làm hàng / chờ trong 24 giờ tới cho ba thẻ (HRC, thép thành phẩm, hàng nhập).
import { trangThai, klCanLam, chuyenDaRoi } from "./linetime";
import { mocDuKien, THU_TUC_SAU_HANG, ROI_SAU_THU_TUC } from "./xepBen";
import { dongHang } from "./sanLuong";
import { laHRC, loaiKhoTuHang } from "./kho";
import { plain } from "./format";
import { khoaDiem } from "./bieuDoSanLuong";

const HOUR = 36e5, DAY = 864e5;
const p2 = (n) => String(n).padStart(2, "0");
export const ngayDia = (t) => { const d = new Date(t); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };
const dauNgay = (t) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
const ms = (x) => (x ? new Date(x).getTime() : null);

// Khoảng thời gian làm hàng (ms) của chuyến để chia kế hoạch: bắt đầu → kết thúc làm hàng (thực tế nếu có, không thì dự kiến); null nếu chưa có mốc
// Kết thúc làm hàng: mốc thực tế nếu có; chưa có mà đã có ETD / ATD thì làm hàng suốt thời gian tàu ở bến (ETD trừ thủ tục và rời bến), không dùng mốc ước tính theo cam kết
// (tàu không có cam kết bị ước 1 ngày nên cả khối lượng dồn vào ngày đầu, 20/11/2026); không có ETD thì dùng mốc dự kiến.
export function khoangLamHang(v) {
  const m = mocDuKien(v), a = m.bd ?? m.cap ?? m.eta;
  const roi = ms(v.atd) ?? ms(v.etd), coKT = !!v.kt_lam_hang;
  const b = coKT ? m.kt : roi != null && a != null ? roi - THU_TUC_SAU_HANG - ROI_SAU_THU_TUC : m.kt ?? m.roi ?? (a != null ? a + DAY : null);
  return a != null && b != null ? { a, b: Math.max(b, a + HOUR) } : null;
}
// Các ngày (yyyy-mm-dd) chuyến chiếm bến, từ ngày cập đến ngày rời
export function ngayCuaChuyen(v) {
  const m = mocDuKien(v), a = m.cap ?? m.bd ?? m.eta, b = m.roi ?? m.kt ?? (a != null ? a + DAY : null);
  if (a == null || b == null) return [];
  const out = []; for (let t = dauNgay(a); t < Math.max(b, a + 1); t += DAY) out.push(ngayDia(t)); // tàu rời đúng 0:00 thì ngày đó không tính
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
// Kế hoạch ngày của một hướng (và nhóm hàng nếu có): Map ngày -> tấn (chỉ các ngày có kế hoạch)
export function keHoachNgayMap(map, huong, nhom = "") {
  const m = new Map();
  for (const [k, v] of map) { const [d, h, l] = k.split("|"); if (h === huong && (!nhom || plain(l) === plain(nhom))) m.set(d, (m.get(d) || 0) + v); }
  return m;
}
// Kế hoạch theo từng điểm của kỳ (cùng thứ tự điểm với chuoiKy ở bieuDoSanLuong.js; kyInfo = khoangKy(...)). Điểm thuộc THÁNG đã có kế hoạch ngày
// (của hướng / nhóm hàng đang xem) lấy tổng kế hoạch ngày của điểm; tháng chưa đặt kế hoạch ngày thì null để nơi gọi dùng mục tiêu chia đều.
// Trả { kh: [tấn | null], coKh: có kế hoạch ngày ở ít nhất một điểm, du: mọi điểm đều theo kế hoạch ngày }
export function keHoachTheoDiem(kyInfo, map, huong, nhom = "") {
  const m = keHoachNgayMap(map, huong, nhom), thangCo = new Set([...m].filter(([, v]) => v > 0).map(([d]) => d.slice(0, 7)));
  const idx = new Map(), dau = [], tong = [];
  for (const d of kyInfo.ngays) { const k = khoaDiem(kyInfo.buoc, d); if (!idx.has(k)) { idx.set(k, tong.length); tong.push(0); dau.push(d); } tong[idx.get(k)] += m.get(d) || 0; }
  const kh = tong.map((t, i) => (thangCo.has(dau[i].slice(0, 7)) ? t : null));
  return { kh, coKh: kh.some((x) => x != null), du: kh.every((x) => x != null) };
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

// ---- Kế hoạch ngày DỜI THEO LỊCH TÀU (anh Sỹ 22/11/2026) ----
// Mỗi dòng kế hoạch ngày ghi kèm "dấu mốc" ở cột ghi_chu: khoảng làm hàng của chuyến lúc lập kế hoạch ("ben:<từ ms>|<đến ms>"). Khi lịch tàu đổi (khoảng làm hàng hiện tại
// khác dấu mốc), khối lượng các ngày được CHIA LẠI theo tỉ lệ thời gian: ngày trước giờ bắt đầu (xuất kho trước khi cập) dời theo giờ bắt đầu, ngày sau giờ kết thúc dời theo giờ kết thúc,
// các ngày trong khoảng làm hàng co giãn theo độ dài mới; mỗi ngày cũ chia cho các ngày mới theo phần thời gian trùng nhau, tổng khối lượng giữ nguyên.
// Tàu đã rời bến thì không dời nữa (kế hoạch đã qua giữ nguyên để so với thực tế).
export const DAU_MOC_KH = "ben:";
export const dauMocKH = (v) => { const k = khoangLamHang(v); return k ? `${DAU_MOC_KH}${Math.round(k.a)}|${Math.round(k.b)}` : null; };
export const docMocKH = (s) => { const m = /^ben:(\d+)\|(\d+)$/.exec(String(s || "")); return m ? { a: +m[1], b: +m[2] } : null; };
const anhThoiGian = (t, cu, moi) => (t < cu.a ? moi.a + (t - cu.a) : t > cu.b ? moi.b + (t - cu.b) : moi.a + ((t - cu.a) * (moi.b - moi.a)) / (cu.b - cu.a));
// ngayTan: Map ngày -> tấn (khoảng cũ cu -> khoảng mới moi, ms) → Map ngày mới -> tấn
export function dichNgay(ngayTan, cu, moi) {
  const out = new Map();
  for (const [ngay, tan] of ngayTan) {
    if (!(tan > 0)) continue;
    const d0 = new Date(ngay + "T00:00:00").getTime(), n0 = anhThoiGian(d0, cu, moi), n1 = anhThoiGian(d0 + DAY, cu, moi), dai = n1 - n0;
    const phan = [];
    for (let t = dauNgay(n0); t < n1; t += DAY) { const p = (Math.min(n1, t + DAY) - Math.max(n0, t)) / dai; if (p > 1e-9) phan.push([ngayDia(t), p]); }
    const le = Number.isInteger(tan) ? 1 : 100; // tấn nguyên thì chia ra tấn nguyên, tấn lẻ thì 2 số lẻ; phần dư dồn vào ngày nhiều nhất
    let da = 0, lon = 0;
    const kq = phan.map(([n, p], i) => { const x = Math.round(tan * p * le) / le; da += x; if (p > phan[lon][1]) lon = i; return [n, x]; });
    if (kq.length) kq[lon][1] = Math.round((kq[lon][1] + tan - da) * 100) / 100;
    for (const [n, x] of kq) if (x > 0) out.set(n, Math.round(((out.get(n) || 0) + x) * 100) / 100);
  }
  return out;
}
// rows: dòng kế hoạch ngày { voyage_id, ngay, khoi_luong, ghi_chu }. Trả { rows: đã dời, doi: Set mã chuyến có dời }; dòng không có dấu mốc / chuyến đã rời / khoảng không đổi thì giữ nguyên
export function dichKeHoach(rows, vmap, now = Date.now()) {
  const nhom = new Map(), giu = [];
  for (const r of rows || []) {
    const v = vmap.get(r.voyage_id);
    if (!v || !docMocKH(r.ghi_chu) || chuyenDaRoi(v, now)) { giu.push(r); continue; }
    const k = `${r.voyage_id}|${r.ghi_chu}`; if (!nhom.has(k)) nhom.set(k, []); nhom.get(k).push(r);
  }
  const doi = new Set(), moiRows = [];
  for (const ds of nhom.values()) {
    const vid = ds[0].voyage_id, v = vmap.get(vid), cu = docMocKH(ds[0].ghi_chu), moi = khoangLamHang(v);
    if (!moi || (Math.abs(moi.a - cu.a) < 6e4 && Math.abs(moi.b - cu.b) < 6e4)) { moiRows.push(...ds); continue; }
    doi.add(vid);
    const m = dichNgay(new Map(ds.map((r) => [String(r.ngay).slice(0, 10), +r.khoi_luong || 0])), cu, moi), dau = dauMocKH(v);
    for (const [ngay, tan] of m) moiRows.push({ voyage_id: vid, ngay, khoi_luong: tan, ghi_chu: dau, doi: true });
  }
  // Gộp các dòng trùng (chuyến, ngày): dòng đã dời có thể rơi cùng ngày với dòng giữ nguyên
  const gop = new Map();
  for (const r of [...giu, ...moiRows]) {
    const k = `${r.voyage_id}|${String(r.ngay).slice(0, 10)}`, x = gop.get(k);
    if (x) gop.set(k, { ...x, khoi_luong: Math.round(((+x.khoi_luong || 0) + (+r.khoi_luong || 0)) * 100) / 100, doi: x.doi || r.doi });
    else gop.set(k, { ...r, ngay: String(r.ngay).slice(0, 10) });
  }
  return { rows: [...gop.values()], doi };
}
// Việc cần ghi lại CSDL để kế hoạch ngày khớp lịch tàu: dòng chưa có dấu mốc (chuyến chưa rời) được gắn dấu mốc hiện tại; chuyến lịch đã đổi thì ghi lại toàn bộ dòng đã dời.
// Trả { ops: [{ voyage_id, ngay, khoi_luong | null, ghi_chu }] (cho saveKeHoachNgay), doi: Set mã chuyến đã dời }
export function canGhiLaiKeHoach(raw, vmap, now = Date.now()) {
  const { rows, doi } = dichKeHoach(raw, vmap, now), ops = [];
  for (const vid of doi) {
    const moiNgay = new Set(rows.filter((r) => r.voyage_id === vid).map((r) => r.ngay));
    for (const r of raw.filter((x) => x.voyage_id === vid)) { const n = String(r.ngay).slice(0, 10); if (!moiNgay.has(n)) ops.push({ voyage_id: vid, ngay: n, khoi_luong: null, ghi_chu: null }); }
    for (const r of rows.filter((x) => x.voyage_id === vid)) ops.push({ voyage_id: vid, ngay: r.ngay, khoi_luong: r.khoi_luong, ghi_chu: dauMocKH(vmap.get(vid)) });
  }
  for (const r of raw) { // dòng cũ chưa có dấu mốc: gắn dấu (không đổi số)
    const v = vmap.get(r.voyage_id);
    if (!v || docMocKH(r.ghi_chu) || chuyenDaRoi(v, now) || doi.has(r.voyage_id) || !(+r.khoi_luong >= 0)) continue;
    const dau = dauMocKH(v); if (dau) ops.push({ voyage_id: r.voyage_id, ngay: String(r.ngay).slice(0, 10), khoi_luong: +r.khoi_luong, ghi_chu: dau });
  }
  return { ops, doi };
}
// Đọc kế hoạch ngày đã dời theo lịch tàu hiện tại cho khoảng ngày [tu, den]; null = chưa có bảng (chưa chạy SQL 13)
export async function docKeHoachDich(api, voyages, now, tu, den) {
  const raw = await api.docKeHoachNgay(ngayDia(new Date(tu + "T00:00:00").getTime() - 60 * DAY), ngayDia(new Date(den + "T00:00:00").getTime() + 60 * DAY));
  if (!raw) return null;
  return dichKeHoach(raw, new Map((voyages || []).map((v) => [v.id, v])), now).rows.filter((r) => r.ngay >= tu && r.ngay <= den);
}
