// Mốc giờ dự kiến của chuyến tàu (chỉ để tàu đổi màu theo giờ, xem trangThai ở linetime.js). Đã bỏ toàn bộ phần TỰ XẾP BẾN (anh Sỹ chốt 14/11/2026:
// line tàu chỉ hiển thị thông tin chuyến và kéo thả).
//   Bắt đầu làm hàng dự kiến = cập bến + 1 giờ; kết thúc = bắt đầu + thời gian làm hàng; thủ tục = kết thúc + 2 giờ; rời = thủ tục + 30 phút.
// Thời gian làm hàng = khối lượng ÷ cam kết xếp dỡ (t/ngày); chưa có cam kết thì theo định mức cẩu cảng của bến với loại hàng
// (tổng t/h các cẩu của bến × 20 giờ làm / ngày); không có gì thì 1 ngày. Tàu thiếu khối lượng thì ước theo DWT / LOA / mớn.
import { ms, plain, HOUR, DAY } from "./format";

export const THU_TUC_SAU_HANG = 2 * HOUR;
export const ROI_SAU_THU_TUC = 0.5 * HOUR;
export const BD_SAU_CAP = HOUR;
export const GIO_LAM_NGAY = 20; // giờ làm hàng mỗi ngày khi tính theo định mức cẩu
const TOI_THIEU_LAM = 6 * HOUR;

// ---------- Ước tính thông số tàu (tàu hàng rời điển hình) ----------
const BANG_TAU = [ // [DWT, LOA (m), mớn (m)]
  [1000, 60, 4], [3000, 80, 5.5], [5000, 100, 6.5], [10000, 125, 8], [20000, 160, 9.5], [30000, 180, 10.5],
  [50000, 190, 12], [75000, 225, 14], [100000, 250, 14.8], [180000, 292, 18], [250000, 330, 18.5],
];
function noiSuy(x, cx, cy) {
  const ds = BANG_TAU;
  if (x <= ds[0][cx]) return ds[0][cy];
  for (let i = 1; i < ds.length; i++) if (x <= ds[i][cx]) { const [a, b] = [ds[i - 1], ds[i]]; return a[cy] + ((x - a[cx]) / (b[cx] - a[cx])) * (b[cy] - a[cy]); }
  return ds[ds.length - 1][cy];
}
const tron = (x, d = 0) => Math.round(x * 10 ** d) / 10 ** d;
const duong = (x) => +x > 0;
// Thông số dùng để xếp bến: số có sẵn giữ nguyên, thiếu thì ước. uoc: các ô ước tính (dwt / loa / draft / khoi_luong)
export function uocThongSo(v) {
  const uoc = new Set();
  let dwt = duong(v.dwt) ? +v.dwt : null;
  if (dwt == null) {
    if (duong(v.khoi_luong)) dwt = +v.khoi_luong / 0.9;
    else if (duong(v.loa)) dwt = noiSuy(+v.loa, 1, 0);
    else if (duong(v.draft)) dwt = noiSuy(+v.draft, 2, 0);
    if (dwt != null) { dwt = Math.round(dwt / 100) * 100; uoc.add("dwt"); }
  }
  const loa = duong(v.loa) ? +v.loa : dwt != null ? (uoc.add("loa"), tron(noiSuy(dwt, 0, 1))) : null;
  const draft = duong(v.draft) ? +v.draft : dwt != null ? (uoc.add("draft"), tron(noiSuy(dwt, 0, 2), 1)) : null;
  const khoi_luong = duong(v.khoi_luong) ? +v.khoi_luong : dwt != null ? (uoc.add("khoi_luong"), Math.round((dwt * 0.9) / 100) * 100) : null;
  return { dwt, loa, draft, khoi_luong, uoc };
}

// ---------- Hàng của tàu so với danh sách hàng của bến / định mức ----------
// Hàng của tàu có thuộc một mục trong danh sách "loại hàng thường làm" của bến (hoặc tên hàng trong định mức) không: so cả cụm từ, KHÔNG so từng từ lẻ
// (VD "Xỉ thép" khớp "Xỉ thép", "Xỉ" khớp "Xỉ thép", "Xỉ thép cấp phối SS10" khớp "Xỉ thép"; nhưng "Xỉ thép" KHÔNG khớp "Thép thành phẩm" vì chỉ chung chữ "thép").
const chuanHang = (s) => ` ${plain(s).replace(/[^a-z0-9]+/g, " ").trim()} `;
export function khopLoaiHang(hang, mau) {
  const h = chuanHang(hang), m = chuanHang(mau);
  return h.trim() !== "" && m.trim() !== "" && (h === m || h.includes(m) || m.includes(h));
}
const khopHang = khopLoaiHang;
const hangCua = (v) => [v.loai_hang, v.ten_hang].flatMap((x) => String(x || "").split(";")).map((x) => x.trim()).filter(Boolean);
// Năng suất theo định mức cẩu của bến (t/h): tổng t/h các cẩu phục vụ bến với loại hàng của tàu. cranes: xe đội Cẩu; dinhMuc: [{ loai, hang_hoa, tan_gio }]
export function nangSuatDinhMuc(v, benMa, { cranes = [], dinhMuc = [] } = {}) {
  const hs = hangCua(v);
  if (!hs.length || !benMa) return 0;
  let tong = 0;
  for (const c of cranes) {
    if (!(c.ben_phuc_vu || []).includes(benMa)) continue;
    const dm = dinhMuc.filter((d) => plain(d.loai) === plain(c.model) && hs.some((h) => khopHang(h, d.hang_hoa)));
    if (dm.length) tong += Math.max(...dm.map((d) => +d.tan_gio || 0));
  }
  return tong;
}
// Thời gian làm hàng dự kiến (ms)
export function thoiGianLam(v, benMa = v.ben_ma, ctx = {}) {
  const kl = duong(v.khoi_luong) ? +v.khoi_luong : uocThongSo(v).khoi_luong;
  if (!duong(kl)) return DAY;
  if (duong(v.cam_ket)) return Math.max((kl / +v.cam_ket) * DAY, TOI_THIEU_LAM);
  const th = nangSuatDinhMuc(v, benMa, ctx);
  if (th > 0) return Math.max((kl / (th * GIO_LAM_NGAY)) * DAY, TOI_THIEU_LAM);
  return DAY;
}
// Các mốc dự kiến của chuyến (ms), mốc thực tế có thì dùng mốc thực tế, nối tiếp nhau:
//   cập = ATB | ETB · bắt đầu làm hàng = BĐ thực | cập + 1 giờ · kết thúc = KT thực | bắt đầu + thời gian làm hàng
//   thủ tục = thực | kết thúc + 2 giờ · rời = ATD | ETD | thủ tục + 30 phút
export function mocDuKien(v, ctx = {}) {
  const eta = ms(v.eta), cap = ms(v.atb) ?? ms(v.etb);
  const bd = ms(v.bd_lam_hang) ?? (cap != null ? cap + BD_SAU_CAP : null);
  const kt = ms(v.kt_lam_hang) ?? (bd != null ? bd + thoiGianLam(v, v.ben_ma, ctx) : null);
  const thuTuc = ms(v.hoan_tat_tt) ?? (kt != null ? kt + THU_TUC_SAU_HANG : null);
  const roi = ms(v.atd) ?? ms(v.etd) ?? (thuTuc != null ? thuTuc + ROI_SAU_THU_TUC : null);
  return { eta, cap, bd, kt, thuTuc, roi };
}
