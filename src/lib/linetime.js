// Linetime chuyến tàu: 7 mốc thực tế, trạng thái, các chỉ số tự tính.
import { ms, HOUR, DAY } from "./format";

// Các mốc thực tế theo thứ tự. Mốc 1 là ETA báo về.
export const MOC = [
  { k: "eta", ten: "ETA báo về", ngan: "ETA" },
  { k: "nor", ten: "Nộp NOR (sẵn sàng)", ngan: "NOR" },
  { k: "atb", ten: "Cập bến (ATB)", ngan: "ATB" },
  { k: "bd_lam_hang", ten: "Bắt đầu làm hàng", ngan: "BĐ làm hàng" },
  { k: "kt_lam_hang", ten: "Kết thúc làm hàng", ngan: "KT làm hàng" },
  { k: "hoan_tat_tt", ten: "Hoàn tất thủ tục, giám định", ngan: "Thủ tục" },
  { k: "atd", ten: "Rời bến (ATD)", ngan: "ATD" },
];
// Giờ dự kiến (kế hoạch), kéo thả trên lịch cầu bến sửa hai giờ này
export const DU_KIEN = [
  { k: "etb", ten: "Dự kiến cập (ETB)" },
  { k: "etd", ten: "Dự kiến rời (ETD)" },
];

// Quy định màu của thanh tàu:
//   cam = chưa đến neo (chỉ có ETA) · xanh dương = đã đến neo (có NOR) nhưng chưa cập cầu · vàng = đang làm hàng
//   xanh lá = đã cập, chờ đủ hàng / chờ có bãi nhập (chưa làm hàng)
// Hai màu của khoảng thời gian chờ (vẽ trên lịch cầu bến, xem MAU_CHO): đỏ = chờ có bến cập; xanh lá = chờ đủ hàng hoặc chờ có bãi.
export const TRANG_THAI = {
  du_kien: { ten: "Chưa đến neo", tone: "warn", mau: "#f97316" },
  cho_neo: { ten: "Đã đến neo, chưa cập", tone: "info", mau: "#3b82f6" },
  cap_ben: { ten: "Đã cập, chờ làm hàng", tone: "ok", mau: "#22c55e" },
  lam_hang: { ten: "Đang làm hàng", tone: "warn", mau: "#eab308" },
  xong_hang: { ten: "Xong hàng", tone: "primary", mau: "#8b5cf6" },
  da_roi: { ten: "Đã rời", tone: "default", mau: "#64748b" },
  huy: { ten: "Hủy", tone: "default", mau: "#94a3b8" },
};
export const MAU_CHO = { ben: "#ef4444", hang: "#22c55e" };
// Khoảng dừng có lý do này là thời gian tàu chờ CẬP BẾN do chưa đủ hàng / chưa có bãi nhập (vẽ màu xanh lá trong đoạn chờ bến).
// Không phải thời gian dừng làm hàng: không tính vào giờ dừng, laytime, trống máng.
export const LY_DO_CHO_HANG = new Set(["Chờ cập bến: chưa đủ hàng", "Chờ cập bến: chưa có bãi nhập"]);
export const laChoHang = (s) => LY_DO_CHO_HANG.has(s?.ly_do);

export function trangThai(v) {
  if (v.huy) return "huy";
  if (v.atd) return "da_roi";
  if (v.kt_lam_hang) return "xong_hang";
  if (v.bd_lam_hang) return "lam_hang";
  if (v.atb) return "cap_ben";
  if (v.nor) return "cho_neo"; // đã đến neo: nộp NOR
  return "du_kien";
}

const gioGiua = (a, b) => (a != null && b != null ? (ms(b) - ms(a)) / HOUR : null);

// Các khoảng dừng (đã cắt trong [tu, den], gộp phần chồng nhau để không tính trùng), sắp theo thời gian.
// loc: hàm chọn khoảng dừng; khoảng chưa kết thúc tính đến "den" (hoặc hiện tại).
export function khoangGop(stops, tu, den, loc = () => true) {
  const ds = [];
  for (const s of stops || []) {
    if (!loc(s)) continue;
    // khoảng đang dừng (chưa có giờ kết thúc) tính đến hiện tại
    const a = Math.max(ms(s.tu), tu ?? -Infinity), b = Math.min(ms(s.den) ?? Math.min(den ?? Date.now(), Date.now()), den ?? Infinity);
    if (b > a) ds.push([a, b]);
  }
  ds.sort((x, y) => x[0] - y[0]);
  const gop = [];
  for (const k of ds) { const cuoi = gop[gop.length - 1]; if (cuoi && k[0] <= cuoi[1]) cuoi[1] = Math.max(cuoi[1], k[1]); else gop.push([...k]); }
  return gop;
}

// Tổng giờ của các khoảng dừng nằm trong [tu, den]; chiTru: chỉ các khoảng được trừ khỏi thời gian thưởng phạt
export function gioDung(stops, tu, den, chiTru = false) {
  return khoangGop(stops, tu, den, (s) => !chiTru || s.tru_tp).reduce((h, [a, b]) => h + (b - a) / HOUR, 0);
}

// Khối lượng cần làm = khối lượng chuyến trừ hàng đã trả lại (v.kl_tra do store cộng từ bảng trả hàng).
// Chỉ dùng cho tiến độ, khối lượng xếp dỡ, kế hoạch xe; thưởng phạt vẫn tính theo khối lượng hợp đồng.
export const klCanLam = (v) => Math.max(0, (+v.khoi_luong || 0) - (+v.kl_tra || 0));
// KL đã làm: theo ô KL đã làm; xong hàng mà chưa ghi thì coi như đủ
export const daLam = (v) => (v.da_lam != null && v.da_lam !== "" ? +v.da_lam : v.kt_lam_hang ? klCanLam(v) : 0);

// Các chỉ số của chuyến (giờ / tấn / tấn mỗi ngày). now: thời điểm tính (ms)
export function chiSo(v, stopsTat = [], now = Date.now()) {
  const stops = (stopsTat || []).filter((s) => !laChoHang(s)); // chờ cập bến không phải khoảng dừng làm hàng
  const st = trangThai(v);
  const bd = ms(v.bd_lam_hang), kt = ms(v.kt_lam_hang);
  const denLam = kt ?? (bd != null && st === "lam_hang" ? now : null);
  const dungLam = bd != null ? gioDung(stops, bd, denLam) : 0;
  const gioLamGop = bd != null && denLam != null ? (denLam - bd) / HOUR : null;
  const gioLamThuc = gioLamGop != null ? Math.max(0, gioLamGop - dungLam) : null;
  const kl = klCanLam(v), lam = daLam(v);
  const nangSuat = gioLamThuc > 0 ? (lam / gioLamThuc) * 24 : null; // tấn / ngày
  const choNeo = v.nor ? gioGiua(v.nor, v.atb ?? (st === "cho_neo" ? now : null)) : null; // chờ bến: từ NOR đến cập bến
  return {
    trangThai: st,
    choNeo, // giờ (đang chờ thì tính đến hiện tại)
    oBen: gioGiua(v.atb, v.atd ?? (v.atb && !v.atd ? now : null)),
    lamHang: gioLamGop,
    lamHangThuc: gioLamThuc,
    dung: gioDung(stops, ms(v.atb) ?? bd, ms(v.atd) ?? now),
    nangSuat,
    soCamKet: nangSuat != null && +v.cam_ket > 0 ? nangSuat / +v.cam_ket : null,
    daLam: lam,
    conLai: Math.max(0, kl - lam),
    hoanTat: kl > 0 ? lam / kl : null, // có thể > 1 (vượt kế hoạch)
  };
}

// Khoảng thời gian chiếm bến để vẽ lịch: thực tế nếu có, không thì dự kiến; chưa có giờ rời thì ước theo KL / cam kết
export function khoangBen(v, now = Date.now()) {
  const a = ms(v.atb) ?? ms(v.etb) ?? ms(v.eta);
  if (a == null) return null;
  let b = ms(v.atd) ?? ms(v.etd);
  if (b == null) {
    const ngayLam = +v.cam_ket > 0 && +v.khoi_luong > 0 ? +v.khoi_luong / +v.cam_ket : 1;
    b = a + Math.max(ngayLam * DAY, 6 * HOUR);
    if (v.atb && !v.atd) b = Math.max(b, now);
  }
  return { a, b: Math.max(b, a + HOUR), uoc: ms(v.atd) == null && ms(v.etd) == null };
}

// Các đoạn tàu chiếm từng bến. Chuyển bến (shifting) hoặc ra neo (khoảng dừng loại shifting / ra_neo) cắt chuyến thành nhiều đoạn;
// lúc ở neo hoặc đang chuyển bến tàu không chiếm bến nào. Ra neo mà không ghi bến mới thì quay lại bến cũ.
// Trả [{ ben, phu (bến phụ khi tàu cập hai bến liền nhau), viTri (mét đầu tàu trên tuyến, null = tự xếp), a, b, uoc, dau (đoạn đầu),
//         cuoi (đoạn cuối = bến hiện tại của chuyến), nguon ({ s: khoảng dừng, phia: "cu" | "moi" } khi bến / vị trí ghi ở khoảng dừng chuyển bến) }].
// Chưa có chuyển bến thì một đoạn theo ben_ma / ben_phu / vi_tri của chuyến.
const soHoacNull = (x) => (x == null || x === "" || !Number.isFinite(+x) ? null : +x);
export function doanBen(v, stops = [], now = Date.now()) {
  const k = khoangBen(v, now);
  if (!k) return [];
  const ds = (stops || []).filter((s) => (s.loai === "shifting" || s.loai === "ra_neo") && ms(s.tu) != null && ms(s.tu) > k.a && ms(s.tu) < k.b).sort((x, y) => ms(x.tu) - ms(y.tu));
  if (!ds.length) return [{ ben: v.ben_ma || "", phu: v.ben_phu || "", viTri: soHoacNull(v.vi_tri), a: k.a, b: k.b, uoc: k.uoc, dau: true, cuoi: true, nguon: null }];
  const out = [];
  const s0 = ds[0];
  let ben = s0.ben_cu || v.ben_ma || "", phu = s0.ben_cu ? s0.ben_phu_cu || "" : v.ben_phu || "", viTri = s0.ben_cu ? soHoacNull(s0.vi_tri_cu) : soHoacNull(v.vi_tri);
  let nguon = s0.ben_cu ? { s: s0, phia: "cu" } : null, a = k.a;
  for (const s of ds) {
    if (ms(s.tu) > a) out.push({ ben, phu, viTri, a, b: ms(s.tu), uoc: false, dau: !out.length, cuoi: false, nguon });
    if (ms(s.den) == null) { a = null; break; } // đang ở neo / đang chuyển: chưa có đoạn kế tiếp
    if (s.ben_moi) { ben = s.ben_moi; phu = s.ben_phu_moi || ""; viTri = soHoacNull(s.vi_tri_moi); nguon = { s, phia: "moi" }; }
    else if (s.ben_cu) { ben = s.ben_cu; phu = s.ben_phu_cu || ""; viTri = soHoacNull(s.vi_tri_cu); nguon = { s, phia: "cu" }; }
    a = ms(s.den);
  }
  if (a != null && k.b > a) out.push({ ben, phu, viTri, a, b: k.b, uoc: k.uoc, dau: !out.length, cuoi: true, nguon });
  return out;
}

// Mã chuyến "TÊN TÀU / năm / 0001": số thứ tự theo tàu trong năm
export function maChuyenMoi(tenTau, nam, voyages) {
  const ten = String(tenTau || "TBA").trim().toUpperCase();
  const re = new RegExp(`^${ten.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} / ${nam} / (\\d+)$`);
  const max = voyages.reduce((m, x) => { const r = re.exec(x.ma_chuyen || ""); return r ? Math.max(m, +r[1]) : m; }, 0);
  return `${ten} / ${nam} / ${String(max + 1).padStart(4, "0")}`;
}

// Mốc nào sai thứ tự (mốc sau sớm hơn mốc trước). ETA không xét vì là giờ báo trước.
export function mocSaiThuTu(v) {
  const ds = MOC.slice(1).filter((m) => v[m.k]);
  const sai = [];
  for (let i = 1; i < ds.length; i++) if (ms(v[ds[i].k]) < ms(v[ds[i - 1].k])) sai.push(`${ds[i].ngan} trước ${ds[i - 1].ngan}`);
  return sai;
}

// ---------- ETB luôn sau ETA ----------
const isoGio = (t) => new Date(t).toISOString();
// Thời gian tàu ở bến dự kiến (ms): ETD − ETB nếu có; không thì khối lượng ÷ cam kết (tối thiểu 6 giờ); không có gì thì 1 ngày
export function thoiGianO(v) {
  const etb = ms(v.etb), etd = ms(v.etd);
  if (etb != null && etd != null && etd > etb) return etd - etb;
  const ngay = +v.cam_ket > 0 && +v.khoi_luong > 0 ? +v.khoi_luong / +v.cam_ket : 1;
  return Math.max(ngay * DAY, 6 * HOUR);
}

// ETB gợi ý: giờ sớm nhất từ ETA trở đi mà bến đã chọn (và bến phụ) không có tàu khác trong suốt thời gian tàu ở bến, cách tàu trước 1 giờ.
// Chưa chọn bến thì là chính ETA. Chỉ xét theo bến; tàu hai bến cùng tuyến đủ số mét vẫn được cập chung thì đã có cảnh báo riêng ở bước lưu.
export function etbGoiY(v, { voyages = [], stopsOf = () => [], now = Date.now(), cach = HOUR } = {}) {
  const eta = ms(v.eta);
  if (eta == null) return null;
  const ben = new Set([v.ben_ma, v.ben_phu].filter(Boolean));
  if (!ben.size) return eta;
  const dai = thoiGianO(v), khac = [];
  for (const o of voyages) {
    if (o.id === v.id || o.huy || o.atd) continue;
    for (const d of doanBen(o, stopsOf(o.id) || [], now)) if ((d.ben && ben.has(d.ben)) || (d.phu && ben.has(d.phu))) khac.push([d.a, d.b]);
  }
  khac.sort((x, y) => x[0] - y[0]);
  let t = eta;
  for (const [a, b] of khac) if (t < b + cach && t + dai + cach > a) t = b + cach;
  return t;
}

// Ràng buộc: ETB không được trước ETA (tàu chưa cập thật). Trước ETA hoặc chưa có ETB thì tự đặt ETB = giờ gợi ý, ETD dời theo
// (giữ thời gian ở bến). Trả về patch đã chỉnh; patch.etb khác đầu vào nghĩa là đã tự sắp xếp lại.
export function rangBuocEtb(v, patch = {}, ctx = {}) {
  const m = { ...v, ...patch };
  if (m.atb || m.huy) return patch;
  const eta = ms(m.eta);
  if (eta == null) return patch;
  const etb = ms(m.etb);
  if (etb != null && etb >= eta) return patch;
  const moi = etbGoiY(m, ctx), etd = ms(m.etd), out = { ...patch, etb: isoGio(moi) };
  if (etd != null) {
    if (etb != null) out.etd = isoGio(moi + Math.max(etd - etb, HOUR));
    else if (etd <= moi) out.etd = isoGio(moi + thoiGianO({ ...m, etb: null, etd: null }));
  }
  return out;
}
