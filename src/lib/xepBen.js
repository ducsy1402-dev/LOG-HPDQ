// Tự xếp cầu bến và mốc giờ dự kiến của chuyến tàu (anh Sỹ chốt 04/11/2026):
//   1. ETB sau ETA và sau giờ rời (ATD / ETD) của tàu trước ở bến đó 2 giờ.
//   2. Hoàn tất thủ tục, giám định dự kiến = kết thúc làm hàng + 2 giờ.
//   3. ATD dự kiến (ETD) = hoàn tất thủ tục + 30 phút.
//   Bắt đầu làm hàng dự kiến = cập bến + 1 giờ (buộc dây, mở hầm).
// Thời gian làm hàng = khối lượng ÷ cam kết xếp dỡ (t/ngày); chưa có cam kết thì theo định mức cẩu cảng của bến với loại hàng
// (tổng t/h các cẩu của bến × 20 giờ làm / ngày); không có gì thì 1 ngày. Tàu thiếu DWT / LOA / mớn thì ước theo khối lượng hoặc ngược lại.
import { ms, plain, HOUR, DAY } from "./format";

export const CACH_TAU_TRUOC = 2 * HOUR;
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
// Vị trí ưu tiên của hàng tàu trong "Loại hàng thường làm" của bến (0 = đầu danh sách); -1 = bến không làm hàng này. Tàu chưa có hàng: 0
export function viTriHang(v, b) {
  const hs = hangCua(v);
  if (!hs.length || !b?.loai_hang) return 0;
  const ds = String(b.loai_hang).split(/[,;/]+/).map((s) => s.trim()).filter(Boolean);
  const i = ds.findIndex((m) => hs.some((h) => khopHang(h, m)));
  return i;
}

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
// Thời gian tàu ở bến dự kiến (ms): chờ bắt đầu + làm hàng + thủ tục + rời
export const thoiGianOBen = (v, benMa, ctx) => BD_SAU_CAP + thoiGianLam(v, benMa, ctx) + THU_TUC_SAU_HANG + ROI_SAU_THU_TUC;

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

// ---------- Bến phù hợp ----------
// Tàu (đã ước thông số) so với giới hạn bến: DWT, mớn, chiều dài bến. Trả lý do không hợp, rỗng = hợp
export function khongHop(t, b) {
  const ly = [];
  if (duong(t.dwt) && duong(b.dwt_max) && t.dwt > +b.dwt_max) ly.push("DWT");
  if (duong(t.draft) && duong(b.mon_max) && t.draft > +b.mon_max) ly.push("mớn");
  if (duong(t.loa) && duong(b.loa_max) && t.loa > +b.loa_max) ly.push("chiều dài");
  return ly;
}

// ETB sớm nhất ở bến benMa từ thời điểm tu: bến trống suốt "dai" (ms), cách tàu trước / sau CACH_TAU_TRUOC
export function etbSomNhat(benMa, tu, dai, { voyages = [], stopsOf = () => [], now = Date.now(), boQua = null, doanBen } = {}) {
  const khac = [];
  for (const o of voyages) {
    if (o.id === boQua || o.huy || o.atd) continue;
    for (const d of doanBen(o, stopsOf(o.id) || [], now)) if (d.ben === benMa || d.phu === benMa) khac.push([d.a, d.b]);
  }
  khac.sort((x, y) => x[0] - y[0]);
  let t = tu;
  for (const [a, b] of khac) if (t < b + CACH_TAU_TRUOC && t + dai + CACH_TAU_TRUOC > a) t = b + CACH_TAU_TRUOC;
  return t;
}

// Tự xếp bến cho chuyến chưa có bến: { ben_ma, etb, etd (ISO), ly (giải thích), uoc (ô ước tính), hangKhop } hoặc null.
// Chọn bến hợp DWT / mớn / chiều dài và có loại hàng của tàu (không bến nào có loại hàng thì xét mọi bến hợp kích thước).
// Bến cho ETB sớm nhất; các bến cập trong vòng 6 giờ sau giờ sớm nhất thì ưu tiên bến có loại hàng đứng trước trong danh sách.
export function xepBenTuDong(v, ctx) {
  const { berths = [], now = Date.now() } = ctx;
  const ts = uocThongSo(v), t = { ...v, ...ts };
  const eta = ms(v.eta) ?? now;
  const tu = Math.max(eta, Math.ceil(now / HOUR) * HOUR);
  // Chuyến ĐÃ khai báo bến: giữ đúng bến đó (không chọn lại bến), chỉ tính ETB / ETD; chưa khai báo thì chọn bến phù hợp
  const daKhai = v.ben_ma ? berths.find((b) => b.ma === v.ben_ma) : null;
  const hop = daKhai ? [daKhai] : berths.filter((b) => !khongHop(t, b).length);
  if (!hop.length) return null;
  let ds = hop.map((b) => ({ b, iHang: viTriHang(v, b) }));
  const coHang = ds.some((x) => x.iHang >= 0);
  if (coHang && !daKhai) ds = ds.filter((x) => x.iHang >= 0);
  for (const x of ds) {
    x.dai = thoiGianOBen(t, x.b.ma, ctx);
    x.etb = ctx.etbSom ? ctx.etbSom(t, x.b.ma, tu, x.dai, ctx) : etbSomNhat(x.b.ma, tu, x.dai, { ...ctx, boQua: v.id ?? null });
  }
  const som = Math.min(...ds.map((x) => x.etb));
  ds.sort((p, q) => (p.etb - som <= 6 * HOUR && q.etb - som <= 6 * HOUR ? (p.iHang - q.iHang) || (p.etb - q.etb) : p.etb - q.etb) || (+p.b.thu_tu || 0) - (+q.b.thu_tu || 0));
  const x = ds[0];
  const iso = (ms0) => new Date(ms0).toISOString();
  return {
    ben_ma: x.b.ma, etb: iso(x.etb), etd: iso(x.etb + x.dai), uoc: [...ts.uoc], hangKhop: coHang,
    ly: daKhai ? `Giữ bến ${x.b.ma} đã khai báo` : `Bến ${x.b.ma}: hợp ${["DWT", "mớn", "chiều dài"].join(", ")}${coHang ? `, loại hàng thứ ${x.iHang + 1} trong danh sách của bến` : " (chưa bến nào có loại hàng này)"}; cập sớm nhất ${ds.length > 1 ? `trong ${ds.length} bến phù hợp` : ""}`.trim(),
  };
}
