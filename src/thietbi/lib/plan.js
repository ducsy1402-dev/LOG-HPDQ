// Logic Giai đoạn 2 – Kế hoạch & phân bổ xe (chuyển từ demo_tien_do.html đã duyệt)
import { pad, plain } from "./utils";

export const MIN = 60000;
export const HOUR = 3600e3;

// ===================== ÁNH XẠ LOẠI PHƯƠNG TIỆN =====================
const DEFAULT_RULES = [
  { tu_khoa: "xúc lật", doi: "Xúc lật" },
  { tu_khoa: "nâng người", doi: "PT chuyên dụng khác", model: "nâng người" },
  { tu_khoa: "nâng", doi: "Xe nâng", tai_trong: "tu_dong" },
  { tu_khoa: "đầu kéo", doi: "Xe đầu kéo" },
  { tu_khoa: "đào", doi: "Xúc đào" },
  { tu_khoa: "đục", doi: "Xúc đào" },
  { tu_khoa: "ben", doi: "Xe ben" },
  { tu_khoa: "hooklift", doi: "PT chuyên dụng khác", model: "rác" },
  { tu_khoa: "rác", doi: "PT chuyên dụng khác", model: "rác" },
  { tu_khoa: "cẩu", doi: "Xe cẩu thùng" },
  { tu_khoa: "bồn", doi: "Xe bồn" },
  { tu_khoa: "gang lỏng", doi: "Xe gang lỏng" },
  { tu_khoa: "ủi", doi: "PT chuyên dụng khác", model: "ủi" },
  { tu_khoa: "xe lu", doi: "PT chuyên dụng khác", model: "lu" },
  { tu_khoa: "xúc", doi: "Xúc đào" },
];
export const rulesOf = (mapPt) => (mapPt?.rules?.length ? mapPt.rules : DEFAULT_RULES);
const normPt = (s) => String(s || "").toLowerCase().normalize("NFC").replace(/\s*-\s*/g, "-").replace(/\s+/g, " ").trim();

// "Nâng 3-5T" -> {doi: "Xe nâng", taiTrong: ["3T","5T"]}; quy tắc đầu tiên khớp được dùng
export function mapLoaiPt(lpt, rules, taiTrongList) {
  const t = normPt(lpt);
  if (!t) return null;
  const r = rules.find((x) => x.tu_khoa && t.includes(normPt(x.tu_khoa)));
  if (!r) return null;
  let taiTrong = null;
  if (r.tai_trong === "tu_dong") {
    const nums = [...t.matchAll(/(\d+)/g)].map((m) => m[1] + "T").filter((x) => taiTrongList.includes(x));
    taiTrong = nums.length ? nums : null;
  } else if (Array.isArray(r.tai_trong) && r.tai_trong.length) taiTrong = r.tai_trong;
  return { doi: r.doi, taiTrong, model: r.model ? normPt(r.model) : null };
}
// Xe có đúng loại yêu cầu không (bỏ qua tải trọng – tải trọng là cảnh báo mềm)
export const dungLoai = (v, mp) => !mp || (v.doi === mp.doi && (!mp.model || normPt(v.model).includes(mp.model)));
export const dungTaiTrong = (v, mp) => !mp?.taiTrong || (v.tai_trong && mp.taiTrong.includes(v.tai_trong));

// ===================== ĐỌC FILE NHU CẦU =====================
export const REQ_HDR = ["Loại Phương Tiện", "BP Yêu Cầu", "Nội Dung", "TG Bắt Đầu Yêu Cầu", "TG Kết Thúc Yêu Cầu", "Số PT Yêu Cầu"];

export function parseDT(v) {
  if (v instanceof Date) return v.getTime();
  if (typeof v === "number" && v > 30000 && v < 80000) { // số ngày kiểu Excel
    const ms = Math.round((v - 25569) * 864e5), d = new Date(ms);
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes()).getTime();
  }
  const s = String(v || "").trim(); let m;
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})/))) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime();
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{2})/))) return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]).getTime();
  return NaN;
}
// "50 tấn" -> {kl: 50, dvt: "Tấn"}
export function parseKL(v) {
  const s = String(v ?? "").trim(); const m = s.match(/^([\d.,]+)\s*(.*)$/);
  if (!m) return { kl: null, dvt: s || "" };
  const n = Number(m[1].replace(/\./g, "").replace(",", "."));
  const u = m[2].trim();
  return { kl: Number.isFinite(n) ? n : null, dvt: u ? u[0].toUpperCase() + u.slice(1).toLowerCase() : "" };
}

export async function readDemandFile(file) {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const name = wb.SheetNames.find((n) => /nhu\s*c/i.test(n)) || wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: "", raw: true });
  // Bỏ khoảng trắng thừa ở tiêu đề cột
  return rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [String(k).trim(), typeof v === "string" ? v.trim() : v])))
    .filter((r) => Object.values(r).some((x) => x !== ""));
}

const toIso = (ms) => new Date(ms).toISOString();
const str = (v) => (v == null ? "" : String(v).trim());
// Mã nhu cầu ổn định khi file không có cột "Mã Nhu Cầu"
function hashKey(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return "R" + (h >>> 0).toString(36).toUpperCase(); }

// Chuẩn hóa các dòng đọc từ file thành bản ghi bảng demands. Thiếu cột bắt buộc thì báo lỗi, không nhập.
export function buildDemands(rows) {
  const miss = REQ_HDR.filter((h) => !rows.length || !(h in rows[0]));
  if (miss.length) return { error: "File thiếu cột bắt buộc: " + miss.join(", ") };
  const out = [], seen = new Map(); let skip = 0;
  rows.forEach((r, i) => {
    const s = parseDT(r["TG Bắt Đầu Yêu Cầu"]), e = parseDT(r["TG Kết Thúc Yêu Cầu"]);
    if (isNaN(s) || isNaN(e) || e <= s || !str(r["Nội Dung"])) { skip++; return; }
    const kl = parseKL(r["Khối Lượng Dự Kiến"]);
    let ma = str(r["Mã Nhu Cầu"]) || hashKey([r["BP Yêu Cầu"], r["Loại Phương Tiện"], r["Nội Dung"], s, e, r["Vị Trí Bắt Đầu"]].join("|"));
    const n = seen.get(ma) || 0; seen.set(ma, n + 1); if (n) ma += "-" + (n + 1);
    out.push({
      ma_nhu_cau: ma, stt: str(r["STT"]) || String(i + 1), hinh_thuc: str(r["Hình Thức Vận Chuyển"]), hang_muc: str(r["Hạng Mục"]),
      loai_pt: str(r["Loại Phương Tiện"]), bp_yeu_cau: str(r["BP Yêu Cầu"]), loai_hang: str(r["Loại Hàng"]), noi_dung: str(r["Nội Dung"]),
      khoi_luong: kl.kl, dvt: kl.dvt, tg_bat_dau: toIso(s), tg_ket_thuc: toIso(e), ca_kip: str(r["Ca Kíp"]),
      vi_tri_bd: str(r["Vị Trí Bắt Đầu"]), vi_tri_kt: str(r["Vị Trí Kết Thúc"]), muc_do: str(r["Mức Độ"]),
      so_pt: Math.max(1, parseInt(r["Số PT Yêu Cầu"], 10) || 1), so_chuyen: str(r["Số Chuyến Dự Kiến"]),
      dau_moi: str(r["Họ Tên Đầu Mối"]), sdt_dau_moi: str(r["SĐT Đầu Mối"]),
    });
  });
  if (!out.length) return { error: "Không đọc được dòng nhu cầu nào (kiểm tra cột thời gian và nội dung)." };
  return { rows: out, skip };
}

// ===================== CA CỦA KẾ HOẠCH NGẮN HẠN =====================
// Mỗi giờ bắt đầu khác nhau trong file là một "khung" (phân công lưu giờ lệch so với đầu khung).
// Các khung được gộp về đúng ca của công ty: CA 1 = 08h–20h, CA 2 = 20h–08h hôm sau (giờ trước 08h thuộc CA 2 của ngày hôm trước).
// Nhãn "CA 1B": kíp chọn tay ở Tab 3 > kíp ghi nhiều nhất trong file > kíp theo lịch luân phiên.
// Nhu cầu giờ hành chính: cột "Ca Kíp" ghi HC / Hành chính, hoặc bắt đầu 06:00–trước 08:00 và kết thúc trong ngày không quá 18:00 (VD 07:30 → 17:00).
// Nhu cầu hành chính xếp vào CA 1 của chính ngày đó (không tách CA HC riêng).
export function laNhuCauHC(d) {
  if (/(^|[^a-z])hc([^a-z]|$)|hanh chinh/.test(plain(d.ca_kip))) return true;
  const s = new Date(d.tg_bat_dau), e = new Date(d.tg_ket_thuc), h = s.getHours() + s.getMinutes() / 60, he = e.getHours() + e.getMinutes() / 60;
  return h >= 6 && h < 8 && s.toDateString() === e.toDateString() && he <= 18;
}
export function caCuaGio(ms, D, hc = false) {
  const g1 = D.caDef?.find((c) => c.so === 1)?.gio ?? 8, g2 = D.caDef?.find((c) => c.so === 2)?.gio ?? 20;
  const d = new Date(ms), h = d.getHours() + d.getMinutes() / 60;
  if (hc) { // ca hành chính 07:30–17:00 của chính ngày đó
    const c = D.caDef?.find((x) => x.hc) || { gio: 7.5, ketThuc: 17, ten: "CA HC (07h30–17h)" };
    const st = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(c.gio), Math.round((c.gio % 1) * 60)).getTime();
    const kt = c.ketThuc ?? 17;
    return { so: "HC", ngay: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, start: st, end: new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(kt), Math.round((kt % 1) * 60)).getTime(), ten: c.ten, hc: true };
  }
  let base = new Date(d.getFullYear(), d.getMonth(), d.getDate()), so = 1;
  if (h < g1 || h >= g2) { so = 2; if (h < g1) base = new Date(base.getFullYear(), base.getMonth(), base.getDate() - 1); }
  const gio = so === 1 ? g1 : g2;
  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), Math.floor(gio), Math.round((gio % 1) * 60)).getTime();
  const ngay = `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}`;
  return { so, ngay, start, end: start + 12 * HOUR, ten: D.caDef?.find((c) => c.so === so)?.ten };
}
export function buildShifts(demands, D) {
  const slots = new Map(), groups = new Map();
  for (const d of demands) {
    const s = new Date(d.tg_bat_dau).getTime(), e = new Date(d.tg_ket_thuc).getTime(), key = new Date(s).toISOString();
    if (!slots.has(key)) slots.set(key, { key, start: s, end: e });
    const sl = slots.get(key); sl.end = Math.max(sl.end, e);
    const ca = laNhuCauHC(d) ? caCuaGio(new Date(s).setHours(12, 0, 0, 0), D) : caCuaGio(s, D), gk = new Date(ca.start).toISOString();
    if (!groups.has(gk)) groups.set(gk, { ...ca, g: gk, kips: {} });
    sl.g = gk;
    const kp = (String(d.ca_kip || "").match(/kíp\s*(\w+)/i) || [])[1];
    if (kp) { const k = kp.toUpperCase(), gr = groups.get(gk); gr.kips[k] = (gr.kips[k] || 0) + 1; }
  }
  for (const gr of groups.values()) {
    if (gr.hc) { gr.kip = "HC"; gr.label = "CA HC"; continue; }
    const tay = (D.cakip || []).find((x) => x.ngay === gr.ngay && x.ca === gr.ten)?.kip;
    const kipFile = Object.entries(gr.kips).sort((a, b) => b[1] - a[1])[0]?.[0];
    gr.kip = tay || kipFile || D.kipTheoLich(gr.ngay, gr.so);
    gr.label = `CA ${gr.so}${gr.kip}`;
  }
  return [...slots.values()].sort((a, b) => a.start - b.start).map((sl) => {
    const gr = groups.get(sl.g);
    return { ...sl, so: gr.so, ngay: gr.ngay, kip: gr.kip, label: gr.label, gStart: gr.start, gEnd: gr.end };
  });
}
// Ca kế tiếp theo lịch công ty: CA 1 -> CA 2 cùng ngày, CA 2 -> CA 1 hôm sau, CA HC -> CA HC ngày làm việc kế tiếp (bỏ Chủ nhật)
export function caKeTiep(sh, D) {
  if (sh.so === "HC") {
    let d = new Date(sh.gStart); do d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, d.getHours(), d.getMinutes()); while (d.getDay() === 0);
    const c = caCuaGio(d.getTime(), D, true);
    return { key: new Date(c.start).toISOString(), start: c.start, end: c.end, so: "HC", ngay: c.ngay, label: "CA HC" };
  }
  const c = caCuaGio(sh.gStart + 12 * HOUR, D);
  const tay = (D.cakip || []).find((x) => x.ngay === c.ngay && x.ca === c.ten)?.kip;
  return { key: new Date(c.start).toISOString(), start: c.start, end: c.end, so: c.so, ngay: c.ngay, label: `CA ${c.so}${tay || D.kipTheoLich(c.ngay, c.so)}` };
}
// Danh sách ca (không lặp) từ các khung
export const caList = (shifts) => [...new Map(shifts.map((s) => [s.g, { key: s.g, label: s.label, start: s.gStart, end: s.gEnd, ngay: s.ngay, so: s.so }])).values()].sort((a, b) => a.start - b.start);
export const shiftWork = (sh, win) => [sh.start + win.winA * MIN, sh.end - win.winB * MIN];
// Các mốc giờ chọn được trong ca (mỗi 30 phút), tính bằng phút lệch so với đầu ca
export function offsets(sh, win) {
  const [a, b] = shiftWork(sh, win), o = [];
  for (let t = a; t <= b; t += 30 * MIN) o.push((t - sh.start) / MIN);
  return o;
}
export const hm = (ms) => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const dm = (ms) => { const d = new Date(ms); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`; };
export const dmy = (ms) => { const d = new Date(ms); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; };
export const offTxt = (sh, o) => hm(sh.start + o * MIN);
// Giờ chọn được khi gán xe: không giới hạn trong giờ nhu cầu, mỗi 30 phút trong 24h kể từ đầu ca của công ty
// (giá trị là số phút lệch so với đầu nhu cầu, có thể âm nếu sớm hơn giờ nhu cầu).
export function gioChon(sh, ...giuLai) {
  const base = Math.round((sh.gStart - sh.start) / MIN), o = [];
  for (let i = 0; i < 48; i++) o.push(base + i * 30);
  for (const x of giuLai) if (x != null && !o.includes(x)) o.push(x);
  return o.sort((a, b) => a - b);
}
// Thời lượng nhu cầu tính bằng phút (từ đầu đến cuối nhu cầu)
export const dodaiNC = (sh) => Math.round((sh.end - sh.start) / MIN);

// Thông tin cần có để in kế hoạch trình ký; thiếu thì cảnh báo và cho bổ sung
export const TT_CAN = [["bp_yeu_cau", "Bộ phận"], ["loai_pt", "Loại PT"], ["noi_dung", "Nội dung"], ["vi_tri_bd", "Điểm đi"], ["vi_tri_kt", "Điểm đến"], ["khoi_luong", "Khối lượng"], ["dvt", "ĐVT"]];
export const thieuTT = (d) => TT_CAN.filter(([k]) => d[k] == null || String(d[k]).trim() === "").map(([, l]) => l);

// Khóa nhận diện nhu cầu lặp lại giữa các ca / các file: bộ phận | loại PT | nội dung | điểm đi | điểm đến
export const khoaNC = (d) => [d.bp_yeu_cau, d.loai_pt, d.noi_dung, d.vi_tri_bd, d.vi_tri_kt].map((x) => plain(x).replace(/\s+/g, " ")).join("|");
// Dòng phân công -> mục mẫu (giờ tính từ đầu nhu cầu) và ngược lại
export const mauTuPC = (a) => ({ ma_xe: a.ma_xe || null, nha_thau: a.nha_thau || null, so_luong: a.nha_thau ? soPT(a) : 1, bat_dau_phut: a.bat_dau_phut, ket_thuc_phut: a.ket_thuc_phut, ghi_chu: a.ghi_chu || null });
export const pcTuMau = (x, d) => ({ ma_nhu_cau: d.ma_nhu_cau, ca_bat_dau: new Date(d.tg_bat_dau).toISOString(), ma_xe: x.ma_xe || null, nha_thau: x.nha_thau || null, so_luong: x.so_luong || 1, bat_dau_phut: x.bat_dau_phut, ket_thuc_phut: x.ket_thuc_phut, ghi_chu: x.ghi_chu || null });

export const MUON_HC = "Mượn xe HC";
// Giờ làm xe HC: 07:30–17:00, thứ 2 – thứ 7
export function hcWindow(sh) {
  const d = new Date(sh.start);
  if (sh.so === 2 || d.getDay() === 0) return null;
  return [new Date(d.getFullYear(), d.getMonth(), d.getDate(), 7, 30).getTime(), new Date(d.getFullYear(), d.getMonth(), d.getDate(), 17, 0).getTime()];
}

// Số phương tiện của một dòng phân công: xe nội bộ = 1, xe nhà thầu = số lượng đã nhập
export const soPT = (a) => (a.nha_thau ? Math.max(1, +a.so_luong || 1) : 1);
export const demPT = (as) => as.reduce((x, a) => x + soPT(a), 0);
// Tên hiển thị của dòng phân công: mã xe hoặc "NT Bảo Hưng × 2"
export const tenPT = (a) => (a.nha_thau ? `${a.nha_thau} × ${soPT(a)}` : a.ma_xe);
export const sortPT = (a, b) => (a.nha_thau ? 1 : 0) - (b.nha_thau ? 1 : 0) || String(a.ma_xe || a.nha_thau).localeCompare(String(b.ma_xe || b.nha_thau), "vi", { numeric: true });
export const DEFAULT_NHA_THAU = ["NT Bảo Hưng", "NT An Khang", "NT Bình Sơn", "NT Cường Sơn"].map((ten) => ({ ten, lien_he: "", ghi_chu: "", dang_dung: true }));

// Cảnh báo từng dòng phân công
export function planWarnings(asgs, ctx) {
  const { D, demOf, shOf, rules } = ctx;
  const info = new Map(), by = {};
  for (const a of asgs) {
    const w = [], v = D.vmap[a.ma_xe], d = demOf(a.ma_nhu_cau), sh = shOf(a.ca_bat_dau);
    if (a.nha_thau) {
      if (a.ket_thuc_phut <= a.bat_dau_phut) w.push("Giờ sai");
      if (sh && (a.bat_dau_phut < 0 || a.ket_thuc_phut > dodaiNC(sh))) w.push("Ngoài giờ nhu cầu");
      info.set(a.id, w); continue;
    }
    if (!v) w.push("Xe ngoài danh mục");
    else {
      const st = D.stateOf(v.ma);
      if (st === "hong") w.push("Xe đang hỏng");
      else if (st === "bdcl") w.push("Xe đang BD chiến lược");
      else if (st === "bddk") w.push("Xe đang BD định kỳ");
      const mp = d && mapLoaiPt(d.loai_pt, rules, D.taiTrongList);
      if (mp && !dungLoai(v, mp)) w.push("Khác loại yêu cầu");
      else if (mp?.taiTrong && v.doi === "Xe nâng") w.push(...(!v.tai_trong ? ["Chưa rõ tải trọng"] : dungTaiTrong(v, mp) ? [] : ["Khác tải trọng yêu cầu"]));
      if (v.che_do === "HC" && sh) {
        const hw = hcWindow(sh);
        // Xe HC làm ca đêm, Chủ nhật hoặc ngoài 07:30–17:00 = đang mượn xe HC cho đi ca (cảnh báo mềm)
        if (!hw || sh.start + a.bat_dau_phut * MIN < hw[0] || sh.start + a.ket_thuc_phut * MIN > hw[1]) w.push(MUON_HC);
      }
    }
    if (a.ket_thuc_phut <= a.bat_dau_phut) w.push("Giờ sai");
    else if (sh) (by[a.ma_xe] ||= []).push([a, sh.start + a.bat_dau_phut * MIN, sh.start + a.ket_thuc_phut * MIN]);
    if (sh && (a.bat_dau_phut < 0 || a.ket_thuc_phut > dodaiNC(sh))) w.push("Ngoài giờ nhu cầu");
    info.set(a.id, w);
  }
  for (const arr of Object.values(by)) for (const [a, s, e] of arr) if (arr.some(([o, s2, e2]) => o !== a && s < e2 && s2 < e)) info.get(a.id).push("Trùng giờ");
  return info;
}
export const SOFT_WARN = new Set(["Xe đang BD định kỳ", "Chưa rõ tải trọng", "Khác tải trọng yêu cầu", "Ngoài giờ nhu cầu", "Mượn xe HC"]);

// ===================== DÀI HẠN (Book12, hàm calc12 của demo) =====================
const localDate = (s) => { if (!s) return null; const [y, m, d] = String(s).slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d); };
const localDT = (s) => (s ? new Date(s) : null); // "YYYY-MM-DDTHH:mm" không có múi giờ -> giờ máy
const r6 = (x) => Math.round(x * 1e6) / 1e6;

// Đội xe gốc của kế hoạch dài hạn: tham số ở gốc (p.capCang, p.capBai, prod) thuộc đội này để dữ liệu cũ vẫn đúng
export const DOI_GOC = "Xúc đào";
// Cấu hình riêng của một đội: số xe dành cho cảng / bãi, hệ số ca đầu / ca thứ hai / ca cuối, bảng năng suất theo hàng.
// Đội chưa đặt hệ số riêng thì lấy hệ số của đội gốc.
export function cfgOf(params, doi) {
  const p = params.p, ramp = { ramp1: p.ramp1 ?? 0.6, ramp2: p.ramp2 ?? 0.85, ramp3: p.ramp3 ?? 0.6 };
  if (!doi || doi === DOI_GOC) return { capCang: p.capCang, capBai: p.capBai, prod: params.prod || [], ...ramp };
  return { capCang: 0, capBai: 0, prod: [], ...ramp, ...(params.doi?.[doi] || {}) };
}
// Số xe nhập tay của tàu (trống = lấy gợi ý). so_xe_doi là dữ liệu cũ khi tàu còn dùng chung nhiều đội.
export const soXeTay = (j, doi) => num(j.so_xe_tay) ?? num(j.so_xe_doi?.[doi]);
// Tàu và việc bãi thuộc đội nào (dữ liệu cũ chưa có đội = đội gốc)
export const doiCuaViec = (j) => j.doi || DOI_GOC;

// Công thức xe dành cho cảng / bãi của một đội (pp.capTinh[đội]):
//   cang: danh sách tổ -> xe cảng = số xe sẵn sàng của đội thuộc các tổ đó (rỗng = nhập tay)
//   bai: loại xe ("Bánh xích"… hoặc "Tất cả") -> xe bãi = xe sẵn sàng của loại đó − phân bổ cố định của loại đó (null = nhập tay)
// Mặc định Xúc đào: cảng = xe sẵn sàng Tổ PVC, bãi = còn lại của bánh xích.
export const capTinhOf = (params, doi) => params.capTinh?.[doi] ?? (doi === DOI_GOC ? { cang: ["Tổ PVC"], bai: "Bánh xích" } : { cang: [], bai: null });
// Gắn số xe cảng / bãi đã tính vào tham số trước khi chạy calc12
export function withCap(params, doi, capCang, capBai) {
  if (doi === DOI_GOC) return { ...params, p: { ...params.p, capCang, capBai } };
  return { ...params, doi: { ...(params.doi || {}), [doi]: { ...cfgOf(params, doi), capCang, capBai } } };
}
// Thứ tự dòng do người dùng kéo thả; chưa sắp thì theo thứ tự nhập
export const byThuTu = (a, b) => (a.thu_tu ?? 1e9) - (b.thu_tu ?? 1e9) || a.id - b.id;

// Lưới ca: ca N (ngày) bắt đầu lúc gioN, ca Đ (đêm) bắt đầu gioN + caLen.
// Ca đầu tiên là ca bắt đầu đúng hoặc ngay sau "Ngày bắt đầu lưới" (VD 14/10 00:00 hoặc 08:00 -> N 14/10 08h; 14/10 20:00 -> Đ 14/10 20h).
export function buildGrid(p) {
  const caMs = p.caLen * HOUR, bd = localDT(p.bd);
  let t = new Date(bd.getFullYear(), bd.getMonth(), bd.getDate(), Math.floor(p.gioN), Math.round((p.gioN % 1) * 60)).getTime();
  while (t - caMs >= bd.getTime()) t -= caMs;
  while (t < bd.getTime()) t += caMs;
  const moc = localDT(p.moc), shifts = [];
  for (let i = 0; i < p.nShifts; i++) {
    const st = new Date(t + i * caMs);
    const lab = st.getHours() === Math.floor(p.gioN) && st.getMinutes() === Math.round((p.gioN % 1) * 60) ? "N" : "Đ";
    shifts.push({ st, en: new Date(st.getTime() + caMs), lab, day: new Date(st.getFullYear(), st.getMonth(), st.getDate()) });
  }
  shifts.forEach((s) => { s.now = s.st <= moc && moc < s.en; });
  return { shifts, moc, caMs };
}

export function calc12(params, jobs, doi = DOI_GOC) {
  const p = params.p, cfg = cfgOf(params, doi), prod = cfg.prod || [];
  const { shifts, moc, caMs } = buildGrid(p);
  const { ramp1, ramp2, ramp3 } = cfg; // hệ số ca của đội đang lập kế hoạch

  const ves = jobs.filter((j) => j.loai === "tau" && doiCuaViec(j) === doi).sort(byThuTu).map((j) => {
    const v = { id: j.id, ten: j.ten, hang: j.hang, ben: j.vi_tri, kl: num(j.khoi_luong), conlai: num(j.con_lai), th: num(j.nang_suat), gioDung: num(j.gio_dung) || 0, nhapTay: soXeTay(j, doi) };
    const pr = prod.find((x) => x.hang === v.hang);
    const bd = j.bat_dau ? new Date(j.bat_dau) : null;
    const goi = pr && v.th > 0 ? Math.min(pr.max, Math.max(pr.min, Math.ceil(r6(v.th / pr.ns)))) : null;
    const dung = v.nhapTay != null ? v.nhapTay : goi;
    const useCL = p.flag === 1 && v.conlai != null && v.th > 0;
    let kt = null;
    if (bd && v.th > 0 && v.kl > 0) kt = useCL ? new Date(moc.getTime() + (v.conlai / v.th + v.gioDung) * HOUR) : new Date(bd.getTime() + (v.kl / v.th + v.gioDung) * HOUR);
    const tienDo = v.conlai != null && v.kl > 0 ? Math.max(0, 1 - v.conlai / v.kl) : null;
    return { ...v, job: j, bd, kt, goi, dung, tienDo, coNs: !!pr };
  });
  ves.forEach((r, i) => {
    if (!r.bd || !r.kt) r.canh = "Thiếu dữ liệu";
    else if (r.dung == null || isNaN(r.dung)) r.canh = "Chưa có năng suất hàng";
    else if (!r.ben) r.canh = "Thiếu bến";
    else if (ves.some((o, j) => j !== i && String(o.ben) === String(r.ben) && o.bd && o.kt && r.bd < o.kt && r.kt > o.bd)) r.canh = "Trùng bến";
    else if (r.kt < moc) r.canh = "Đã xong";
    else r.canh = "OK";
    // Hệ số: ca đầu ramp1, ca thứ hai ramp2, ca cuối (ca chứa giờ kết thúc) ramp3, còn lại 100%. Ca đầu được ưu tiên.
    r.cnt = shifts.map((s) => {
      if (!r.dung || isNaN(r.dung) || !r.bd || !r.kt) return 0;
      if (!(s.st < r.kt && s.en > r.bd)) return 0;
      const idx = Math.min(Math.max(0, Math.ceil(r6((s.st - r.bd) / caMs))), 2);
      const cuoi = s.en >= r.kt;
      const ramp = idx === 0 ? ramp1 : cuoi ? ramp3 : idx === 1 ? ramp2 : 1;
      return Math.max(1, Math.round(r.dung * ramp));
    });
  });
  shifts.forEach((s, i) => { s.cang = ves.reduce((a, r) => a + r.cnt[i], 0); });

  const fixed = jobs.filter((j) => j.loai === "bai" && doiCuaViec(j) === doi).sort(byThuTu).map((j) => {
    const f = { id: j.id, job: j, cv: j.ten, hang: j.hang, ben: j.vi_tri, from: j.tu_ngay, to: j.den_ngay, n: num(j.xe_ngay) || 0, d: num(j.xe_dem) || 0, kl: num(j.khoi_luong), conlai: num(j.con_lai) };
    f.tienDo = f.conlai != null && f.kl > 0 ? Math.max(0, 1 - f.conlai / f.kl) : null;
    const off = !f.cv || (f.cv === "Đào tạo" && p.daoTao === 0);
    const from = localDate(f.from), to = localDate(f.to);
    // Việc bãi lấy từ chuyến tàu (có tu / den: giờ chính xác): chỉ các ca giao với khoảng thời gian đó; việc nhập tay tính theo ngày
    const tu = j.tu ? new Date(j.tu) : null, den = j.den ? new Date(j.den) : null;
    f.cnt = shifts.map((s) => {
      if (off) return 0;
      if (tu || den) return (tu && s.en <= tu) || (den && s.st >= den) ? 0 : s.lab === "N" ? f.n : f.d;
      return (from && s.day < from) || (to && s.day > to) ? 0 : s.lab === "N" ? f.n : f.d;
    });
    return f;
  });
  shifts.forEach((s, i) => { s.bai = fixed.reduce((a, f) => a + f.cnt[i], 0); });

  const capCang = num(cfg.capCang) || 0, capBai = num(cfg.capBai) || 0;
  shifts.forEach((s) => {
    s.balCang = capCang - s.cang; s.balBai = capBai - s.bai; s.balChung = s.balCang + s.balBai;
    if (s.balCang < 0) s.tt = s.balBai >= -s.balCang ? "MƯỢN BÃI" : "THIẾU";
    else if (s.balBai < 0) s.tt = s.balCang >= -s.balBai ? "MƯỢN CẢNG" : "THIẾU";
    else s.tt = "OK";
  });
  const kpi = {
    caThieuCang: shifts.filter((s) => s.balCang < 0).length,
    caThieuBai: shifts.filter((s) => s.balBai < 0).length,
    caTHIEU: shifts.filter((s) => s.tt === "THIẾU").length,
    cauCangMax: shifts.length ? Math.max(...shifts.map((s) => s.cang)) : 0,
    tauCanhBao: ves.filter((r) => ["Trùng bến", "Thiếu bến", "Thiếu dữ liệu", "Chưa có năng suất hàng"].includes(r.canh)).length,
    tauMoc: ves.filter((r) => r.bd && r.kt && r.bd <= moc && r.kt >= moc).length,
  };
  return { shifts, ves, fixed, kpi, moc, capCang, capBai };
}
function num(v) { if (v === null || v === undefined || v === "") return null; const n = Number(v); return Number.isFinite(n) ? n : null; }

export const HANG_COLOR = { "quặng": "#b5651d", "than": "#5b6475", "đá": "#6b7f94", "phế": "#5b8c3a", "cuộn": "#2f7fa0" };
// Hàng mới (người dùng tự thêm) lấy màu cố định theo tên
const HANG_MORE = ["#8a5fbf", "#b0457a", "#3f8f7a", "#9a7b2f", "#4f6fbf", "#a0522d", "#5a8f3c"];
export const hangColor = (h) => {
  if (HANG_COLOR[h]) return HANG_COLOR[h];
  let x = 0; for (const c of String(h || "")) x = (x * 31 + c.charCodeAt(0)) >>> 0;
  return h ? HANG_MORE[x % HANG_MORE.length] : "#556";
};
export const BAI_COLOR = "#5b7a99";
export const fmtDT = (d) => (d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}` : "");
export const fmtD = (d) => (d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}` : "");

// ===================== IN PDF (A4 ngang qua hộp thoại in của trình duyệt) =====================
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const ymd = (ms) => { const d = new Date(ms); return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`; };
// Lề trang = 0 để trình duyệt không in thêm ngày giờ, tiêu đề, đường dẫn, số trang ở mép giấy.
// Lề thật tạo bằng padding trái/phải và bảng bọc .pw có dòng đệm đầu/cuối lặp lại trên mỗi trang.
const PRINT_CSS = `@page{size:A4 landscape;margin:0}*{box-sizing:border-box}
body{margin:0;padding:0 10mm;font:10pt/1.25 "Times New Roman","Liberation Serif",serif;color:#000}
table.pw{width:100%;border-collapse:collapse}table.pw>thead>tr>td,table.pw>tfoot>tr>td,table.pw>tbody>tr>td{border:0;padding:0;text-align:left;vertical-align:top}
.pw-sp{height:9mm}table.pw+table.pw{page-break-before:always}
table{border-collapse:collapse;width:100%;table-layout:auto}
th,td{border:.6pt solid #000;padding:2pt 4pt;vertical-align:middle;text-align:center}
th{font-weight:bold;background:#fff}thead{display:table-header-group}tr{page-break-inside:avoid}
td.l{text-align:left}.nw{white-space:nowrap}.blk td{background:#f2f2f2;font-weight:bold}.tot td{font-weight:bold}
.head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:2mm}.head img{height:21mm}
.code{text-align:right;font-size:9pt;line-height:1.3}.title{text-align:center;font-size:14pt;font-weight:bold;margin:2mm 0 3mm}
.sub{text-align:center;font-style:italic;margin:-1mm 0 3mm}.date{text-align:right;font-style:italic;margin:3mm 0 2mm}
td.sdt{width:23mm;white-space:normal;word-break:keep-all}.endblk{page-break-inside:avoid;break-inside:avoid}.sign{display:flex;page-break-inside:avoid;margin-top:2mm}.sign div{flex:1;text-align:center;font-weight:bold}.sign span{display:block;font-weight:normal;height:22mm}
.band td{background:#dde7f3;font-weight:bold;text-align:left}`;
const wrapPage = (inner) => `<table class="pw"><thead><tr><td><div class="pw-sp"></div></td></tr></thead><tfoot><tr><td><div class="pw-sp"></div></td></tr></tfoot><tbody><tr><td>${inner}</td></tr></tbody></table>`;
const sttSort = (a, b) => String(a.stt).localeCompare(String(b.stt), "vi", { numeric: true });

// Nhóm các dòng phân công (đã lọc) theo ca của công ty, mỗi ca một lần, theo thứ tự thời gian
function nhomTheoCa(asgs, demOf, shOf) {
  const m = new Map();
  for (const a of asgs) {
    const d = demOf(a.ma_nhu_cau), sh = shOf(a.ca_bat_dau);
    if (!d || !sh) continue;
    if (!m.has(sh.g)) m.set(sh.g, { label: sh.label, start: sh.gStart, end: sh.gEnd, rows: [] });
    m.get(sh.g).rows.push({ a, d, sh });
  }
  return [...m.values()].sort((x, y) => x.start - y.start);
}

// ---------- Dữ liệu dùng chung cho PDF và Excel (cùng thứ tự, cùng nội dung) ----------
// Khối lượng của một dòng xe: KL riêng của dòng (assignments.khoi_luong, SQL 12) nếu đã sửa, không thì KL của nhu cầu
export const klCua = (a, d) => (a?.khoi_luong != null && a.khoi_luong !== "" ? Number(a.khoi_luong) : d?.khoi_luong == null || d.khoi_luong === "" ? null : Number(d.khoi_luong));
const KL_SO = (a, d) => klCua(a, d) ?? "";
// SĐT tổ trưởng (danh_muc 'to_truong'): tổ đi ca có tổ trưởng riêng từng kíp A/B/C, tổ HC chỉ một tổ trưởng.
// Xe chế độ HC hoặc ca HC lấy tổ trưởng HC; tổ chưa nhập kíp đó thì dùng tổ trưởng HC (nếu có).
export const KIP_TT = ["A", "B", "C", "HC"];
export function toTruongCua(D, to, kip, cheDo) {
  const r = (D.toTruong?.list || []).find((x) => x.to === to);
  if (!r) return null;
  const k = kip === "HC" || cheDo === "HC" ? "HC" : kip;
  return [r[k], r.HC].find((x) => x?.sdt || x?.ten) || null;
}
export const COT_KY = ["STT", "BP.SD", "Nội dung công việc", "Điểm đi", "Đểm đến", "Khối lượng", "ĐVT", "T.gian bắt đầu", "T.gian kết thúc", "Loại phương tiện", "Số lượng", "Đơn vị thực hiện", "Ghi chú"];
export const COT_TO = ["STT", "Mã xe", "Loại xe", "Nội dung công việc", "Điểm đi", "Điểm đến", "Khối lượng", "ĐVT", "Từ giờ", "Đến giờ", "SĐT", "Ghi chú"];
// Loại phương tiện của một dòng: xe nội bộ = đội của xe, xe nhà thầu = đội theo loại PT yêu cầu
const loaiPT = (a, d, D) => (D.vmap[a.ma_xe]?.doi || mapLoaiPt(d.loai_pt, rulesOf(D.mapPt), D.taiTrongList)?.doi || d.loai_pt || "");
// Thứ tự trong ca: Tổ -> Loại phương tiện -> Mã xe -> giờ (xe nhà thầu xếp cuối)
const sapDong = (D) => {
  const toCua = (a) => (a.nha_thau ? "\uffff" + a.nha_thau : D.vmap[a.ma_xe]?.to_xe || "\ufffe");
  return (x, y) => toCua(x.a).localeCompare(toCua(y.a), "vi") || loaiPT(x.a, x.d, D).localeCompare(loaiPT(y.a, y.d, D), "vi") || sortPT(x.a, y.a)
    || x.sh.start + x.a.bat_dau_phut * MIN - (y.sh.start + y.a.bat_dau_phut * MIN);
};
// Trình ký: mỗi ca một nhóm, trong ca sắp Tổ -> Loại PT -> Mã xe (nhà thầu cuối). Mỗi dòng là mảng 13 ô theo COT_KY.
// Cột Ghi chú: xe nội bộ ghi mã xe (kèm ghi chú nếu có), xe nhà thầu ghi ghi chú.
export function duLieuTrinhKy({ asgs, demOf, shOf, D }) {
  const cas = nhomTheoCa(asgs, demOf, shOf); let total = 0;
  for (const ca of cas) {
    let stt = 0;
    ca.dong = ca.rows.sort(sapDong(D)).map(({ a, d, sh }) => {
      const v = D.vmap[a.ma_xe], n = soPT(a); total += n;
      return [++stt, d.bp_yeu_cau || "", d.noi_dung || "", d.vi_tri_bd || "", d.vi_tri_kt || "", KL_SO(a, d), d.dvt || "", hm(sh.start + a.bat_dau_phut * MIN), hm(sh.start + a.ket_thuc_phut * MIN), loaiPT(a, d, D), n,
        a.nha_thau || v?.to_xe || "", a.nha_thau ? a.ghi_chu || "" : a.ma_xe + (a.ghi_chu ? " – " + a.ghi_chu : "")];
    });
  }
  return { cas, total };
}
// Số xe của một nhóm dòng: xe nội bộ đếm mã khác nhau, xe nhà thầu cộng số lượng
const soXeNhom = (arr) => new Set(arr.filter((x) => !x.a.nha_thau).map((x) => x.a.ma_xe)).size + demPT(arr.filter((x) => x.a.nha_thau).map((x) => x.a));
// Mỗi ca một trang, trong ca chia nhóm theo khoaNhom (nhóm cuoi(key) = 1 in sau), trong nhóm sắp Tổ -> Loại xe -> Mã xe.
// Mỗi dòng là mảng 12 ô theo COT_TO; cột SĐT lấy theo sdt(a, d, sh).
function duLieuNhom({ asgs, demOf, shOf, D, khoaNhom, cuoi, sdt }) {
  const cas = nhomTheoCa(asgs, demOf, shOf);
  for (const ca of cas) {
    const groups = {};
    ca.rows.forEach((x) => (groups[khoaNhom(x)] ||= []).push(x));
    ca.to = Object.keys(groups).sort((a, b) => cuoi(a) - cuoi(b) || a.localeCompare(b, "vi")).map((key) => {
      const arr = groups[key].sort(sapDong(D));
      return {
        ten: `${key.toUpperCase()} — ${arr.length} việc, ${soXeNhom(arr)} xe`,
        dong: arr.map(({ a, d, sh }, i) => [i + 1, tenPT(a), loaiPT(a, d, D), d.noi_dung || "", d.vi_tri_bd || "", d.vi_tri_kt || "", KL_SO(a, d), d.dvt || "",
          hm(sh.start + a.bat_dau_phut * MIN), hm(sh.start + a.ket_thuc_phut * MIN), sdt(a, d, sh), a.ghi_chu || ""]),
      };
    });
    ca.tieuDe = `${ca.label} · ngày ${dmy(ca.start)} · ${hm(ca.start)} → ${hm(ca.end)}${dm(ca.end) !== dm(ca.start) ? " (" + dm(ca.end) + ")" : ""}`;
  }
  return cas;
}
// Theo tổ: nhóm theo tổ (nhà thầu cuối), SĐT = SĐT đầu mối của nhu cầu
export function duLieuTheoTo({ asgs, demOf, shOf, D }) {
  return duLieuNhom({ asgs, demOf, shOf, D,
    khoaNhom: ({ a }) => (a.nha_thau ? "Nhà thầu: " + a.nha_thau : D.vmap[a.ma_xe]?.to_xe || "Tổ chưa xác định"),
    cuoi: (k) => (k.startsWith("Nhà thầu: ") ? 1 : 0),
    sdt: (a, d) => d.sdt_dau_moi || "" });
}
// Theo BPSD (bộ phận sử dụng): nhóm theo bộ phận yêu cầu, SĐT = tổ trưởng của tổ xe theo kíp của ca (xe nhà thầu để trống)
const BP_TRONG = "Chưa ghi bộ phận";
export function duLieuTheoBP({ asgs, demOf, shOf, D }) {
  return duLieuNhom({ asgs, demOf, shOf, D,
    khoaNhom: ({ d }) => String(d.bp_yeu_cau || "").trim() || BP_TRONG,
    cuoi: (k) => (k === BP_TRONG ? 1 : 0),
    sdt: (a, d, sh) => { if (a.nha_thau) return ""; const v = D.vmap[a.ma_xe]; return toTruongCua(D, v?.to_xe, sh.kip, v?.che_do)?.sdt || ""; } });
}
// Căn trái / không xuống dòng / cột khối lượng theo từng mẫu
// sdt: cột SĐT hẹp vừa một số điện thoại, ô nhiều số tự xuống hàng
const KIEU_O = new Map([[COT_KY, { trai: [2, 3, 4], nw: [1, 6, 7, 8], kl: 5 }], [COT_TO, { trai: [3, 4, 5, 11], nw: [1, 7, 8, 9], sdt: 10, kl: 6 }]]);
const oHtml = (v, i, cot) => {
  const k = KIEU_O.get(cot);
  const cls = k.trai.includes(i) ? ' class="l"' : k.nw.includes(i) ? ' class="nw"' : i === k.sdt ? ' class="sdt"' : "";
  if (i === k.sdt) v = String(v ?? "").replace(/\s*[,;/]\s*|\s+/g, " ").trim(); // tách các số bằng khoảng trắng để xuống hàng giữa các số
  return `<td${cls}>${esc(typeof v === "number" && i === k.kl ? v.toLocaleString("vi-VN") : v)}</td>`;
};
const thHtml = (cot) => cot.map((c) => `<th>${esc(c).replace(/^(T\.gian|Loại|Đơn vị|Số) /, "$1<br>")}</th>`).join("");

// Mẫu BM.07D/HD.05.02 – Kế hoạch khai thác logistics sản xuất ngày. Chỉ in các dòng đã gán xe đang hiển thị (theo bộ lọc).
export function buildSignHtml({ asgs, demOf, shOf, D, logo }) {
  const { cas, total } = duLieuTrinhKy({ asgs, demOf, shOf, D });
  const d0 = new Date(cas[0].start); let body = "";
  for (const ca of cas) {
    body += `<tr class="blk"><td></td><td class="nw">${esc(ca.label)}</td><td colspan="11"></td></tr>`;
    for (const r of ca.dong) body += `<tr>${r.map((v, i) => oHtml(v, i, COT_KY)).join("")}</tr>`;
  }
  const inner = `<div class="head"><img src="${logo}" alt=""><div class="code">BM.07D/HD.05.02<br>Ngày hiệu lực: 25/09/2025<br>Lần sửa đổi: 00</div></div>
  <div class="title">KẾ HOẠCH KHAI THÁC LOGISTICS SẢN XUẤT NGÀY</div>
  <table><thead><tr>${thHtml(COT_KY)}</tr></thead>
  <tbody>${body}<tr class="tot"><td></td><td>Tổng</td><td colspan="8"></td><td>${total}</td><td colspan="2"></td></tr></tbody></table>
  <div class="endblk"><div class="date">Quảng Ngãi, ngày ${d0.getDate()} tháng ${d0.getMonth() + 1} năm ${d0.getFullYear()}</div>
  <div class="sign"><div>TP/BP<span>[03]</span></div><div>Phụ trách<span>[02]</span></div><div>Người lập<span>[01]</span></div></div></div>`;
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Ke_hoach_trinh_ky_${ymd(cas[0].start)}</title><style>${PRINT_CSS}</style></head><body>${wrapPage(inner)}</body></html>`;
}

// Mẫu theo nhóm (tổ / BPSD): mỗi ca một trang, mỗi nhóm một dải tiêu đề (theo bộ lọc đang chọn)
function buildNhomHtml(cas, tieuDe, tenFile) {
  let out = "";
  for (const ca of cas) {
    let body = "";
    for (const t of ca.to) {
      body += `<tr class="band"><td colspan="${COT_TO.length}">${esc(t.ten)}</td></tr>`;
      for (const r of t.dong) body += `<tr>${r.map((v, i) => oHtml(v, i, COT_TO)).join("")}</tr>`;
    }
    out += wrapPage(`<div class="title">${tieuDe}</div>
      <div class="sub">${esc(ca.tieuDe)}</div>
      <table><thead><tr>${thHtml(COT_TO)}</tr></thead><tbody>${body}</tbody></table>`);
  }
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${tenFile}_${ymd(cas[0].start)}</title><style>${PRINT_CSS}</style></head><body>${out}</body></html>`;
}
export const buildToHtml = (x) => buildNhomHtml(duLieuTheoTo(x), "KẾ HOẠCH PHƯƠNG TIỆN THEO TỔ", "Ke_hoach_theo_to");
export const buildBPHtml = (x) => buildNhomHtml(duLieuTheoBP(x), "KẾ HOẠCH PHƯƠNG TIỆN THEO BỘ PHẬN SỬ DỤNG", "Ke_hoach_theo_BPSD");

// ===================== XUẤT EXCEL (cùng dữ liệu với PDF) =====================
// ky: sheet "Trình ký" (mẫu BM.07D/HD.05.02), to: sheet "Theo tổ", bp: sheet "Theo BPSD" (mỗi ca một khối)
export async function exportPlanExcel({ asgs, demOf, shOf, D, ky = true, to = true, bp = false }) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const rong = [5, 11, 42, 22, 22, 10, 7, 9, 9, 14, 8, 22, 14];
  const ngay0 = ymd(nhomTheoCa(asgs, demOf, shOf)[0].start);
  if (ky) {
    const { cas, total } = duLieuTrinhKy({ asgs, demOf, shOf, D });
    const d0 = new Date(cas[0].start);
    const aoa = [["", "", "", "", "", "", "", "", "", "", "", "", "BM.07D/HD.05.02"], ["KẾ HOẠCH KHAI THÁC LOGISTICS SẢN XUẤT NGÀY"], [], COT_KY];
    for (const ca of cas) { aoa.push(["", ca.label]); aoa.push(...ca.dong); }
    aoa.push(["", "Tổng", "", "", "", "", "", "", "", "", total]);
    aoa.push([], ["", "", "", "", "", "", "", "", "", "", `Quảng Ngãi, ngày ${d0.getDate()} tháng ${d0.getMonth() + 1} năm ${d0.getFullYear()}`]);
    aoa.push(["", "TP/BP", "", "", "", "Phụ trách", "", "", "", "", "Người lập"]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = rong.map((w) => ({ wch: w }));
    ws["!merges"] = [{ s: { r: 1, c: 0 }, e: { r: 1, c: 12 } }];
    XLSX.utils.book_append_sheet(wb, ws, "Trình ký");
  }
  const sheetNhom = (cas, tieuDe, ten) => {
    const aoa = [], merges = [];
    for (const ca of cas) {
      merges.push({ s: { r: aoa.length, c: 0 }, e: { r: aoa.length, c: COT_TO.length - 1 } });
      aoa.push([tieuDe + " · " + ca.tieuDe], COT_TO);
      for (const t of ca.to) { merges.push({ s: { r: aoa.length, c: 0 }, e: { r: aoa.length, c: COT_TO.length - 1 } }); aoa.push([t.ten]); aoa.push(...t.dong); }
      aoa.push([]);
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [5, 18, 12, 42, 22, 22, 10, 7, 8, 8, 12, 22].map((w) => ({ wch: w }));
    ws["!merges"] = merges;
    XLSX.utils.book_append_sheet(wb, ws, ten);
  };
  if (to) sheetNhom(duLieuTheoTo({ asgs, demOf, shOf, D }), "KẾ HOẠCH PHƯƠNG TIỆN THEO TỔ", "Theo tổ");
  if (bp) sheetNhom(duLieuTheoBP({ asgs, demOf, shOf, D }), "KẾ HOẠCH PHƯƠNG TIỆN THEO BỘ PHẬN SỬ DỤNG", "Theo BPSD");
  const chon = [ky && "trinh_ky", to && "theo_to", bp && "theo_BPSD"].filter(Boolean);
  XLSX.writeFile(wb, `Ke_hoach_${chon.length === 1 ? chon[0] + "_" : ""}${ngay0}.xlsx`);
}

export function printHtml(html) {
  return new Promise((resolve, reject) => {
    const title = (html.match(/<title>(.*?)<\/title>/) || [])[1] || "Ke_hoach", old = document.title;
    const fr = document.createElement("iframe");
    fr.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(fr);
    const done = () => { document.title = old; setTimeout(() => fr.remove(), 500); };
    fr.onload = () => setTimeout(() => {
      try { document.title = title; fr.contentWindow.onafterprint = done; fr.contentWindow.focus(); fr.contentWindow.print(); resolve(); }
      catch (e) { done(); reject(e); }
    }, 400);
    fr.srcdoc = html;
  });
}

export const matchPlan = (q, ...f) => !q || plain(f.join(" ")).includes(plain(q));
