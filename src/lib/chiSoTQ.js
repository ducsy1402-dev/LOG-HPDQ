// Bộ chỉ số quản trị của trang Tổng quan (thiết kế lại 10/11/2026): hàm thuần, không đụng giao diện, có kiểm thử ở chi_so_tq.test.js.
//   Sản lượng : % đạt mục tiêu, tiến độ so với kế hoạch, cần đạt mỗi ngày, dự báo cuối kỳ, năng suất t/ngày
//   Cầu bến   : BOR (tỉ lệ chiếm bến), thời gian chờ bến, thời gian tàu ở bến, số tàu chờ / đang ở bến / sắp đến, tàu cập – rời trong kỳ
//   Thiết bị  : tỉ lệ sẵn sàng (availability) bình quân kỳ, số lần hỏng, MTTR (ngày sửa trung bình), xe-ngày dừng
// Mốc khuyến nghị ở NGUONG; tone() đổi giá trị thành màu ok / warn / bad để người xem thấy vấn đề ngay.
import { ms, HOUR, DAY } from "./format";
import { trangThai, doanBen } from "./linetime";

export const NGUONG = {
  datOk: 1, datVang: 0.9,                  // % đạt / tiến độ sản lượng
  borVang: 0.85, borDo: 0.95, borThap: 0.3, // chiếm bến cao: nghẽn; quá thấp: bến nhàn rỗi
  choVang: 12, choDo: 24,                  // giờ chờ bến trung bình
  choTauDo: 48,                            // một tàu đang chờ lâu hơn (giờ)
  khoVang: 0.85, khoDo: 0.95,
  ngayCapVang: 7, ngayCapDo: 3,
  tonLauNgay: 60,
  ssVang: 0.85, ssDo: 0.7,                 // thiết bị sẵn sàng (khớp DEFAULT_T của Thiết bị cơ giới)
};

// ---------- Màu theo ngưỡng ----------
// cao = true: số càng cao càng tốt (% đạt, sẵn sàng); cao = false: số càng thấp càng tốt (giờ chờ, lấp đầy)
export function tone(v, vang, muDo, cao = true) {
  if (v == null || !Number.isFinite(v)) return null;
  if (cao) return v >= vang ? "ok" : v >= muDo ? "warn" : "bad";
  return v <= vang ? "ok" : v <= muDo ? "warn" : "bad";
}
export const toneDat = (v) => tone(v, NGUONG.datOk, NGUONG.datVang);
export const toneNang = (a, b) => (a === "bad" || b === "bad" ? "bad" : a === "warn" || b === "warn" ? "warn" : a || b);

// ---------- Sản lượng ----------
// c: kết quả chuoiKy (bieuDoSanLuong): { diem, tongMt, tongTt }; kyInfo: khoangKy.
// qua = số ngày đã khép sổ (trước hôm nay: hôm nay mới nhập dở nên không tính vào nhịp); ttHoanTat = sản lượng của các ngày đó (không có thì lấy cả kỳ).
export function tienDoSanLuong(c, kyInfo, ttHoanTat) {
  const { ngays, homNay } = kyInfo, tong = ngays.length, qua = ngays.filter((d) => d < homNay).length, con = tong - qua;
  const mt = c?.tongMt || 0, tt = c?.tongTt || 0, ttq = ttHoanTat ?? tt, mtDen = tong ? (mt * qua) / tong : 0;
  const duBao = qua === 0 ? null : con === 0 ? tt : (ttq / qua) * tong;
  const dat = mt > 0 ? tt / mt : null, duBaoDat = mt > 0 && duBao != null ? duBao / mt : null;
  // Màu: kỳ đã xong xét % đạt thật; kỳ đang chạy xét dự báo cuối kỳ; chưa bắt đầu thì không tô
  const ref = con === 0 ? dat : duBaoDat;
  return {
    mt, tt, ttq, dat, mtDen, lech: ttq - mtDen, tienDo: mtDen > 0 ? ttq / mtDen : null, duBao, duBaoDat,
    canMoiNgay: con > 0 ? Math.max(0, (mt - tt) / con) : null, nangSuat: qua > 0 ? ttq / qua : null,
    qua, tong, con, xong: con === 0, chuaBatDau: qua === 0, tone: mt > 0 && qua > 0 ? toneDat(ref) : null,
  };
}
// % thay đổi so với kỳ trước (null nếu kỳ trước bằng 0); so sánh cùng số ngày đã qua để công bằng
export const doiSoVoi = (a, b) => (a == null || b == null || !(b > 0) ? null : a / b - 1);

// ---------- Cầu bến ----------
const hopDoan = (ds) => { // tổng độ dài hợp các đoạn [a, b)
  const s = ds.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  let tong = 0, cur = null;
  for (const [a, b] of s) { if (!cur || a > cur[1]) { if (cur) tong += cur[1] - cur[0]; cur = [a, b]; } else cur[1] = Math.max(cur[1], b); }
  return cur ? tong + cur[1] - cur[0] : 0;
};
const t0Cho = (v) => ms(v.nor) ?? ms(v.eta); // tàu bắt đầu chờ bến: nộp NOR, chưa có thì ETA
const O_BEN = new Set(["cap_ben", "lam_hang", "xong_hang"]);
const tb = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);

// voyages: chuyến (đã bỏ hủy), berths: danh sách bến, tu / den: [đầu kỳ, hết kỳ) (ms), now
export function chiSoCauBen({ voyages, berths, stopsOf = () => [], tu, den, now }) {
  const ds = voyages.filter((v) => !v.huy), nBen = berths.length || 1;
  const doanTau = new Map(); // bến -> các đoạn [a, b)
  for (const v of ds) for (const d of doanBen(v, stopsOf(v.id) || [], now)) for (const b of [d.ben, d.phu]) if (b) (doanTau.get(b) || doanTau.set(b, []).get(b)).push([d.a, d.b, v]);
  const chiem = (b, a0, b0) => hopDoan((doanTau.get(b) || []).map(([a, z]) => [Math.max(a, a0), Math.min(z, b0)]));
  const daQua = Math.max(0, Math.min(den, now) - tu);
  const theoBen = berths.map((b) => {
    const dai = daQua > 0 ? chiem(b.ma, tu, Math.min(den, now)) / daQua : null;
    const caKy = den > tu ? chiem(b.ma, tu, den) / (den - tu) : 0;
    return { ma: b.ma, bor: dai, borCaKy: caKy, soTau: new Set((doanTau.get(b.ma) || []).filter(([a, z]) => a < den && z > tu).map(([, , v]) => v.id)).size };
  });
  const bor = daQua > 0 ? theoBen.reduce((s, b) => s + (b.bor || 0), 0) / nBen : null;
  const borCaKy = theoBen.reduce((s, b) => s + b.borCaKy, 0) / nBen;
  const trong = (t) => t != null && t >= tu && t < den;
  const trongDen = (t) => t != null && t >= tu && t < Math.min(den, now); // đến hiện tại: dùng để so với kỳ trước cùng thời gian
  // Thời gian chờ bến: từ NOR (hoặc ETA) tới lúc cập thật (ATB), tàu cập thật trong kỳ
  const cho = ds.filter((v) => v.atb && trong(ms(v.atb))).map((v) => (ms(v.atb) - t0Cho(v)) / HOUR).filter((h) => Number.isFinite(h) && h >= 0);
  const oBen = ds.filter((v) => v.atb && v.atd && trong(ms(v.atd))).map((v) => (ms(v.atd) - ms(v.atb)) / HOUR).filter((h) => Number.isFinite(h) && h >= 0);
  // Tình hình tại thời điểm now
  const tt = ds.map((v) => ({ v, s: trangThai(v, now) }));
  const dangCho = tt.filter((x) => x.s === "cho_neo"), dangO = tt.filter((x) => O_BEN.has(x.s));
  const choLau = dangCho.map(({ v }) => ({ v, gio: (now - (t0Cho(v) ?? now)) / HOUR })).sort((a, b) => b.gio - a.gio);
  const sapDen = tt.filter((x) => x.s === "du_kien" && ms(x.v.eta) != null && ms(x.v.eta) - now <= 7 * DAY).length;
  return {
    bor, borCaKy, theoBen, soBen: berths.length,
    choTB: tb(cho), choMax: cho.length ? Math.max(...cho) : null, soTauCho: cho.length,
    oBenTB: tb(oBen), soTauRoi: oBen.length,
    dangCho: dangCho.length, dangO: dangO.length, dangLam: tt.filter((x) => x.s === "lam_hang").length, sapDen, choLau,
    capTrongKy: ds.filter((v) => trong(ms(v.atb) ?? ms(v.etb))).length, roiTrongKy: ds.filter((v) => trong(ms(v.atd) ?? ms(v.etd))).length, // cả kỳ (gồm kế hoạch)
    capDen: ds.filter((v) => trongDen(ms(v.atb) ?? ms(v.etb))).length, roiDen: ds.filter((v) => trongDen(ms(v.atd) ?? ms(v.etd))).length, // đến hiện tại
  };
}
// Số tàu đang ở bến / đang chờ bến theo từng ngày (giữa ngày 12h) để vẽ xu hướng
export function tauTheoNgay({ voyages, stopsOf = () => [], ngays, now }) {
  const ds = voyages.filter((v) => !v.huy), doan = ds.map((v) => doanBen(v, stopsOf(v.id) || [], now).filter((d) => d.ben));
  return ngays.map((n) => {
    const [y, m, d] = n.split("-").map(Number), t = new Date(y, m - 1, d, 12).getTime();
    const o = doan.reduce((s, dd) => s + (dd.some((x) => x.a <= t && t < x.b) ? 1 : 0), 0);
    const c = ds.reduce((s, v) => { const a = t0Cho(v), b = ms(v.atb) ?? ms(v.etb); return s + (a != null && b != null && a <= t && t < b ? 1 : 0); }, 0);
    return { ngay: n, oBen: o, cho: c };
  });
}

// ---------- Thiết bị ----------
const ngayCong = (s, n) => { const [y, m, d] = s.split("-").map(Number), t = new Date(y, m - 1, d + n); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`; };
const soNgayGiua = (a, b) => { const p = (s) => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); }; return Math.round((p(b) - p(a)) / DAY); };
// vehicles: danh sách xe (hoặc cẩu) cần xét; events: mọi sự kiện; ngays: các ngày YYYY-MM-DD của kỳ; homNay: hôm nay (ngày sau hôm nay chưa tính)
export function chiSoThietBi({ vehicles, events, ngays, homNay, loaiDung = ["Hỏng", "BD chiến lược"] }) {
  const set = new Set(vehicles.map((v) => v.ma)), n = set.size;
  const evs = events.filter((e) => set.has(e.ma_xe));
  const dung = evs.filter((e) => loaiDung.includes(e.loai));
  const qua = ngays.filter((d) => d <= homNay);
  const theoNgay = qua.map((d) => {
    const down = new Set(dung.filter((e) => e.ngay_vao <= d && (!e.ngay_xong || e.ngay_xong > d)).map((e) => e.ma_xe)).size;
    return { d, dung: down, rate: n ? (n - down) / n : null };
  });
  const trongKy = (d) => d && d >= ngays[0] && d <= ngays[ngays.length - 1];
  const hong = evs.filter((e) => e.loai === "Hỏng"), xong = hong.filter((e) => e.ngay_xong && trongKy(e.ngay_xong));
  return {
    n, theoNgay,
    rateTB: theoNgay.length && n ? tb(theoNgay.map((x) => x.rate)) : null,
    rateHT: theoNgay.length ? theoNgay[theoNgay.length - 1].rate : null,
    soLanHong: hong.filter((e) => trongKy(e.ngay_vao)).length,
    mttr: xong.length ? tb(xong.map((e) => Math.max(0, soNgayGiua(e.ngay_vao, e.ngay_xong)))) : null, soDaSua: xong.length,
    dungXeNgay: theoNgay.reduce((s, x) => s + x.dung, 0),
  };
}

// ---------- Vấn đề cần xử lý ----------
// Gom chỉ số vượt ngưỡng thành danh sách xếp theo mức nghiêm trọng (bad trước). mang: sanluong | cauben | kho | thietbi.
export function taoVanDe({ sl = [], cb = null, kho = null, tbi = [] }) {
  const out = [], them = (muc, mang, nd, dich) => out.push({ muc, mang, nd, dich });
  const so0 = (x) => Math.round(x).toLocaleString("vi-VN");
  const pc = (x) => `${(x * 100).toFixed(1).replace(".", ",")}%`;
  for (const { ten, td } of sl) {
    if (!td || !td.tone || td.tone === "ok") continue;
    const ref = td.xong ? td.dat : td.duBaoDat;
    them(td.tone, "sanluong", td.xong ? `${ten}: chỉ đạt ${pc(td.dat)} mục tiêu kỳ` : `${ten}: dự báo cuối kỳ chỉ đạt ${pc(ref)} mục tiêu${td.canMoiNgay != null ? `, cần ${so0(td.canMoiNgay)} t/ngày (đang ${so0(td.nangSuat || 0)})` : ""}`, "cang/muc-tieu");
  }
  if (cb) {
    if (cb.bor != null && cb.bor >= NGUONG.borVang) them(cb.bor >= NGUONG.borDo ? "bad" : "warn", "cauben", `Tỉ lệ chiếm bến ${pc(cb.bor)}: cầu bến sắp nghẽn`, "cang/linetime");
    if (cb.choTB != null && cb.choTB > NGUONG.choVang) them(cb.choTB > NGUONG.choDo ? "bad" : "warn", "cauben", `Tàu chờ bến trung bình ${so0(cb.choTB)} giờ (lâu nhất ${so0(cb.choMax)} giờ)`, "cang/linetime");
    for (const { v, gio } of (cb.choLau || []).filter((x) => x.gio > NGUONG.choVang).slice(0, 3)) them(gio > NGUONG.choTauDo ? "bad" : "warn", "cauben", `${v.ten_tau} đang chờ bến ${so0(gio)} giờ`, { voyage: v.id });
  }
  if (kho) {
    if (kho.lap != null && kho.lap >= NGUONG.khoVang) them(kho.lap >= NGUONG.khoDo ? "bad" : "warn", "kho", `Kho lấp đầy ${pc(kho.lap)} sức chứa`, "kho");
    if (kho.baiVuot > 0) them("bad", "kho", `${kho.baiVuot} bãi vượt sức chứa`, "kho");
    if (kho.ngayCapThap > 0) them(kho.ngayCapDo > 0 ? "bad" : "warn", "kho", `${kho.ngayCapThap} nhóm hàng nguyên liệu tồn đủ cấp dưới ${NGUONG.ngayCapVang} ngày`, "kho/nguyen-lieu");
    if (kho.tonLau > 0 && kho.tong > 0 && kho.tonLau / kho.tong >= 0.1) them("warn", "kho", `Tồn trên ${NGUONG.tonLauNgay} ngày: ${so0(kho.tonLau)} t (${pc(kho.tonLau / kho.tong)} tổng tồn)`, "kho");
  }
  for (const x of tbi) {
    if (!x.m || x.m.rateHT == null) continue;
    const t = tone(x.m.rateHT, x.ngVang ?? NGUONG.ssVang, x.ngDo ?? NGUONG.ssDo);
    if (t && t !== "ok") them(t, "thietbi", `${x.ten} sẵn sàng ${pc(x.m.rateHT)} (${x.m.n - Math.round(x.m.rateHT * x.m.n)}/${x.m.n} đang dừng)`, "thiet-bi/su-kien");
  }
  const thuTu = { bad: 0, warn: 1 };
  return out.sort((a, b) => thuTu[a.muc] - thuTu[b.muc]);
}
