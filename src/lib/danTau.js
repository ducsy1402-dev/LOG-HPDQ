// Dán nhanh bảng tàu theo FORM MẪU (anh Sỹ chốt 14/11/2026), thay form cũ. Cột của bảng mẫu:
//   BẾN · TÊN TÀU · DRAFT · LOA · DWT · GEAR · HÀNG NHẬP · HÀNG XUẤT · KHỐI LƯỢNG · CAM KẾT · DEM/day · PT. Vận chuyển · Kho-Bãi · PT. Kho Bãi · LAYTIME · LSD · Ghi chú · ETA · ETB · ETD
// Quy tắc:
//   • Hàng nhập / Hàng xuất, Kho-Bãi, PT. Vận chuyển, PT. Kho Bãi: nhiều mục ngăn cách bằng dấu phẩy, dấu cộng hoặc dấu chấm phẩy; số sau dấu gạch ngang "-" là khối lượng
//     (hoặc giá trị) của mục đó: "Cán 1-1221, Cán 2-1000" → bãi Cán 1: 1221, bãi Cán 2: 1000. Chữ sau dấu gạch: bãi / PT thì là ghi chú, hàng thì là một phần của tên ("Xỉ hạt lò cao nghiền mịn - S95").
//   • ETA dạng "18-19/11/2026" hiểu là ngày SAU dấu gạch ngang (19/11/2026); ETA, ETB, ETD không đọc được thành ngày thì báo lỗi.
//   • Dòng không có tên tàu thì bỏ qua. Cột bắt buộc: Bến, Tên tàu, Hàng nhập hoặc Hàng xuất (có đúng một trong hai), Khối lượng (phải là số), ETA, ETB, ETD.
//   • SỐ NGÀY LÀM HÀNG (không bắt buộc, phải là số; "3-4" = lấy số sau dấu gạch ngang = 4): ô ETD trống thì ETD = ETB + số ngày; có ETD thì giữ ETD. Không lưu số ngày vào CSDL.
//   • Ô Hàng nhập / Hàng xuất chỉ có dấu gạch ("-", "--", "/") coi như trống.
//   • Các cột còn lại giữ nguyên nội dung; ô trống hiện là "trống" (không ghi chữ "trống" vào CSDL, để NULL).
//   • Số trong cột Khối lượng / DWT / Cam kết: dấu phẩy + đúng 3 chữ số là ngăn nghìn kiểu Excel ("3,500" = 3.500 t); Draft / LOA dùng cách đọc số thường (4.78, 14,6).
import { plain, docSo, DAY, ms } from "./format";
import { chuyenDaRoi } from "./linetime";
import { docNgayGio, doanThuTuNgay } from "./paste";

// k: khóa; ten: tên cột hiển thị; bb: bắt buộc; bi: tiêu đề cột thường gặp (đã chuẩn hóa: bỏ dấu, chữ thường, bỏ dấu câu trừ "/")
export const COT_TAU = [
  { k: "ben", ten: "BẾN", bb: true, bi: ["ben", "cau ben"] },
  { k: "ten_tau", ten: "TÊN TÀU", bb: true, bi: ["ten tau", "tau", "ten phuong tien"] },
  { k: "draft", ten: "DRAFT", bi: ["draft", "mon", "mon nuoc"] },
  { k: "loa", ten: "LOA", bi: ["loa"] },
  { k: "dwt", ten: "DWT", bi: ["dwt"] },
  { k: "gear", ten: "GEAR", bi: ["gear"] },
  { k: "hang_nhap", ten: "HÀNG NHẬP", bi: ["hang nhap"] },
  { k: "hang_xuat", ten: "HÀNG XUẤT", bi: ["hang xuat"] },
  { k: "khoi_luong", ten: "KHỐI LƯỢNG", bb: true, bi: ["khoi luong", "kl", "khoi luong t"] },
  { k: "cam_ket", ten: "CAM KẾT", bi: ["cam ket"] },
  { k: "dem_day", ten: "DEM/day", bi: ["dem/day", "dem day", "dem", "dem/des", "dem des"] },
  { k: "pt_van_chuyen", ten: "PT. Vận chuyển", bi: ["pt van chuyen", "phuong tien van chuyen"] },
  { k: "kho_bai", ten: "Kho-Bãi", bi: ["kho bai", "kho/bai"] },
  { k: "pt_kho_bai", ten: "PT. Kho Bãi", bi: ["pt kho bai", "phuong tien kho bai"] },
  { k: "laytime", ten: "LAYTIME", bi: ["laytime"] },
  { k: "lsd", ten: "LSD", bi: ["lsd"] },
  { k: "ghi_chu", ten: "Ghi chú", bi: ["ghi chu", "note"] },
  { k: "eta", ten: "ETA", bb: true, bi: ["eta"] },
  { k: "etb", ten: "ETB", bb: true, bi: ["etb"] },
  { k: "etd", ten: "ETD", bi: ["etd"] },  // bắt buộc, trừ khi có SỐ NGÀY LÀM HÀNG (khi đó ETD = ETB + số ngày)
  { k: "so_ngay", ten: "SỐ NGÀY LÀM HÀNG", bi: ["so ngay lam hang", "ngay lam hang", "so ngay lam", "so ngay"] },
];
export const TEN_COT = Object.fromEntries(COT_TAU.map((c) => [c.k, c.ten]));
export const MAU_BANG = COT_TAU.map((c) => c.ten).join("\t") + "\nTL\tPHƯƠNG BÁCH 12\t4.78\t79.96\t3,558\t\t\tPhôi vuông, thép cuộn\t3,500\tCQD\tCQD\tĐầu kéo\tBãi xe LOG, bãi HRCE, AB cán 3\tCẦU TRỤC, cầu bãi\t\t\t\t12/11/2026 16:00\t14/11/2026\t15/11/2026\t2";

const chuan = (s) => plain(s).replace(/[^a-z0-9/ ]+/g, " ").replace(/\s+/g, " ").trim();
const rong = (x) => x == null || String(x).trim() === "";
const rongHang = (x) => rong(x) || /^[\s\-–—./,;+]*$/.test(String(x)); // ô hàng chỉ có dấu gạch / chấm… cũng là trống
const chu = (x) => String(x ?? "").trim();

// Cột của một tiêu đề: so cả cụm đã chuẩn hóa
export function doanCotTau(tieuDe) {
  const p = chuan(tieuDe);
  return p ? COT_TAU.find((c) => c.bi.includes(p))?.k || "" : "";
}
// Dòng đầu là tiêu đề nếu nhận ra ít nhất 3 cột; trả { coTieuDe, cot } (mỗi khóa chỉ dùng một lần)
export function nhanDienBang(bang) {
  if (!bang?.length) return { coTieuDe: false, cot: [] };
  const dung = new Set(), cot = bang[0].map((c) => { const k = doanCotTau(c); if (!k || dung.has(k)) return ""; dung.add(k); return k; });
  return cot.filter(Boolean).length >= 3 ? { coTieuDe: true, cot } : { coTieuDe: false, cot: COT_TAU.map((c) => c.k).slice(0, bang[0].length) }; // không có tiêu đề: theo đúng thứ tự cột của bảng mẫu
}

// Số: dấu phẩy + đúng 3 chữ số (từng nhóm) là ngăn nghìn kiểu Excel ("3,500" = 3500); còn lại như docSo (null nếu không phải số)
export function docSoTan(x) {
  if (typeof x === "number") return Number.isFinite(x) ? x : null;
  const s = chu(x);
  if (!s) return null;
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) return +s.replace(/,/g, "");
  const n = docSo(s);
  return n == null || Number.isNaN(n) ? null : n;
}
// Số thường (Draft, LOA)
const docSoThuong = (x) => { if (typeof x === "number") return Number.isFinite(x) ? x : null; const n = docSo(chu(x)); return n == null || Number.isNaN(n) ? null : n; };

// Tách "A - 100, B - 200; C + D" thành các mục. Chỉ khi phần sau dấu gạch ngang CUỐI CÙNG là SỐ (1221, 1.221, 1,221, 1221 t, 1k = 1000) thì nó là khối lượng của mục đó.
// Sau dấu gạch là chữ ("Xỉ hạt lò cao nghiền mịn - S95", "Đá 45-100mm") thì với hàng đó là một phần của TÊN (dùng tenDayDu), với bãi / PT đó là ghi chú (chu).
// Trả [{ ten, tenDayDu, so, chu }]: so = số sau dấu gạch (null nếu không có / không phải số), chu = chữ sau dấu gạch (rỗng nếu không có)
const SO_SAU_GACH = /^\d[\d.,]*\s*(?:t|tan|tấn|k)?$/i;
function docSoSauGach(t) {
  if (!SO_SAU_GACH.test(t)) return null;
  const k = /k$/i.test(t), n = docSoTan(t.replace(/\s*(?:t|tan|tấn|k)$/i, ""));
  return n == null ? null : k ? n * 1000 : n;
}
export function tachDanhSach(x) {
  return chu(x).split(/[,;+]/).map((m) => m.trim()).filter(Boolean).map((m) => {
    const i = m.lastIndexOf("-");
    if (i <= 0 || i === m.length - 1) return { ten: m, tenDayDu: m, so: null, chu: "" };
    const ten = m.slice(0, i).trim(), sau = m.slice(i + 1).trim();
    if (!ten || !sau) return { ten: m, tenDayDu: m, so: null, chu: "" };
    const so = docSoSauGach(sau);
    return { ten, tenDayDu: m, so, chu: so == null ? sau : "" };
  });
}

// Ngày: ETA có thể ghi "18-19/11/2026" (lấy ngày sau dấu gạch ngang). Trả { trong } | { loi } | { iso }
export function docNgayTau(x, { now = Date.now(), khoangNgay = false, thuTu } = {}) {
  if (rong(x)) return { trong: true };
  let t = x;
  if (khoangNgay && typeof x === "string") {
    const m = /^\s*\d{1,2}\s*[-–]\s*(\d{1,2}\s*[/.]\s*\d{1,2}(?:\s*[/.]\s*\d{2,4})?)(.*)$/.exec(x);
    if (m) t = m[1].replace(/\s+/g, "") + m[2];
  }
  const iso = docNgayGio(t, now, { thuTu });
  return iso ? { iso } : { loi: true };
}

// Một dòng đã dán -> { v (bản ghi chuyến), loi: [chữ], trong: [khóa các ô chữ để trống] }; null nếu dòng không có tên tàu.
// ctx: { berthOf(x) -> bến | null, now, nhomCua(tenHang) -> nhóm hàng }
export function docDongTau(o, cot, { berthOf, now = Date.now(), nhomCua = () => null, thuTu } = {}) {
  const r = {}; cot.forEach((k, i) => { if (k) r[k] = o[i] ?? ""; });
  if (rong(r.ten_tau)) return null;
  const loi = [], trong = [], v = { ten_tau: chu(r.ten_tau).toUpperCase() };
  const thieu = (k) => loi.push(`Thiếu ${TEN_COT[k]}`);

  // Bến (tàu cập hai bến ghi "7/8", "HH2/3": bến đầu là bến chính, bến sau là bến phụ)
  if (!("ben" in r)) thieu("ben");
  else if (rong(r.ben)) thieu("ben");
  else {
    const [x, y] = chu(r.ben).split("/").map((s) => s.trim()), b = berthOf?.(x);
    if (!b) loi.push(`Không rõ bến "${chu(r.ben)}"`);
    else {
      v.ben_ma = b.ma;
      if (y) {
        const tien = /^[A-Za-z]+/.exec(x)?.[0] || "", p = (tien && /^\d/.test(y) ? berthOf?.(tien + y) : null) || berthOf?.(y);
        if (p && p.ma !== b.ma) v.ben_phu = p.ma; else loi.push(`Không rõ bến phụ "${y}"`);
      }
    }
  }

  // Số liệu tàu: Draft, LOA đọc số thường; DWT đọc kiểu Excel. Chữ (TBA…) thì bỏ trống, không báo lỗi
  if (!rong(r.draft)) { const n = docSoThuong(r.draft); if (n != null) v.draft = n; }
  if (!rong(r.loa)) { const n = docSoThuong(r.loa); if (n != null) v.loa = n; }
  if (!rong(r.dwt)) { const n = docSoTan(r.dwt); if (n != null) v.dwt = n; }

  // Hàng: một trong hai cột
  const coNhap = !rongHang(r.hang_nhap), coXuat = !rongHang(r.hang_xuat);
  if (coNhap && coXuat) loi.push("Vừa có Hàng nhập vừa có Hàng xuất");
  else if (!coNhap && !coXuat) loi.push("Thiếu Hàng nhập hoặc Hàng xuất");
  else {
    v.huong = coXuat ? "xuat" : "nhap";
    const ds = tachDanhSach(coXuat ? r.hang_xuat : r.hang_nhap), hangDs = [];
    for (const h of ds) {
      const ten = h.so != null ? h.ten : h.tenDayDu; // sau dấu gạch không phải số: là phần của tên hàng ("Xỉ hạt lò cao nghiền mịn - S95")
      hangDs.push({ ten_hang: ten, loai_hang: nhomCua(ten) || ten, khoi_luong: h.so });
    }
    if (hangDs.length) {
      v.hang_ds = hangDs;
      v.ten_hang = hangDs.map((h) => h.ten_hang).join("; ");
      v.loai_hang = [...new Set(hangDs.map((h) => h.loai_hang))].join("; ");
    }
  }

  // Khối lượng
  if (rong(r.khoi_luong)) thieu("khoi_luong");
  else { const n = docSoTan(r.khoi_luong); if (n == null) loi.push(`Khối lượng "${chu(r.khoi_luong)}" không phải số`); else v.khoi_luong = n; }

  // Cam kết: số thì ghi số; chữ (CQD…) ghi làm cam kết dạng chữ, CQD thì tàu tính theo CQD
  if (rong(r.cam_ket)) trong.push("cam_ket");
  else {
    const n = docSoTan(r.cam_ket);
    if (n != null) v.cam_ket = n;
    else { v.cam_ket_ghi_chu = chu(r.cam_ket); if (/cqd/i.test(v.cam_ket_ghi_chu)) v.kieu_tp = "cqd"; }
  }

  // Các cột chữ: giữ nguyên nội dung
  const chuGiuNguyen = (k, cot_) => { if (rong(r[k])) trong.push(k); else v[cot_] = chu(r[k]); };
  chuGiuNguyen("gear", "gear"); chuGiuNguyen("dem_day", "dem_day"); chuGiuNguyen("laytime", "laytime_txt"); chuGiuNguyen("lsd", "lsd"); chuGiuNguyen("ghi_chu", "ghi_chu");
  const danhSachGiaTri = (k, cot_) => { if (rong(r[k])) { trong.push(k); return; } v[cot_] = tachDanhSach(r[k]).map((m) => ({ ten: m.ten, gia_tri: m.so ?? (m.chu || null) })); };
  danhSachGiaTri("pt_van_chuyen", "pt_van_chuyen"); danhSachGiaTri("pt_kho_bai", "pt_kho_bai");
  // Kho-Bãi: mỗi bãi một mục (khối lượng là số sau dấu gạch ngang; chữ thì ghi chú); bãi_hang giữ tên các bãi cho chỗ đọc kiểu cũ
  if (rong(r.kho_bai)) trong.push("kho_bai");
  else {
    const ds = tachDanhSach(r.kho_bai);
    v.bai_kl = ds.map((m) => ({ bai: m.ten, khu: null, khoi_luong: m.so, ...(m.chu ? { ghi_chu: m.chu } : {}) }));
    v.bai_hang = ds.map((m) => m.ten).join("; ");
  }

  // Số ngày làm hàng (không bắt buộc): "3-4" lấy số sau dấu gạch ngang
  let soNgay = null;
  if (!rong(r.so_ngay)) {
    const m = /^\s*\d+(?:[.,]\d+)?\s*[-–]\s*(\d+(?:[.,]\d+)?)\s*$/.exec(chu(r.so_ngay));
    soNgay = docSoThuong(m ? m[1] : r.so_ngay);
    if (soNgay == null || soNgay < 0) { loi.push(`${TEN_COT.so_ngay} "${chu(r.so_ngay)}" không phải số`); soNgay = null; }
  }
  // ETA / ETB / ETD: bắt buộc, phải là ngày; ETD trống thì lấy ETB + số ngày làm hàng
  const ghiChu = [];
  for (const k of ["eta", "etb", "etd"]) {
    const co = k in r && !rong(r[k]);
    if (k === "etd" && !co) {
      if (soNgay != null && v.etb) { v.etd = new Date(new Date(v.etb).getTime() + soNgay * DAY).toISOString(); ghiChu.push(`ETD = ETB + ${soNgay} ngày`); }
      else if (soNgay == null && !loi.some((x) => x.startsWith(TEN_COT.so_ngay))) loi.push(`Thiếu ${TEN_COT.etd} (hoặc ${TEN_COT.so_ngay})`);
      continue;
    }
    if (!(k in r)) { thieu(k); continue; }
    const d = docNgayTau(r[k], { now, khoangNgay: k === "eta", thuTu });
    if (d.trong) thieu(k); else if (d.loi) loi.push(`${TEN_COT[k]} "${chu(r[k])}" không phải ngày`); else v[k] = d.iso;
  }

  return { v, loi, trong, ghiChu };
}

// Cột bắt buộc không có trong bảng (cả bảng thiếu cột, khác với một ô trống)
export const cotThieu = (cot) => COT_TAU.filter((c) => c.bb && !cot.includes(c.k)).map((c) => c.ten)
  .concat(!cot.includes("hang_nhap") && !cot.includes("hang_xuat") ? ["HÀNG NHẬP hoặc HÀNG XUẤT"] : [])
  .concat(!cot.includes("etd") && !cot.includes("so_ngay") ? ["ETD (hoặc SỐ NGÀY LÀM HÀNG)"] : []);

// Thứ tự ngày / tháng của cả bảng dán (dd/mm hay mm/dd): xét các cột ETA, ETB, ETD của mọi dòng
export function thuTuNgayBangTau(dong, cot) {
  const idx = cot.map((k, i) => (["eta", "etb", "etd"].includes(k) ? i : -1)).filter((i) => i >= 0);
  return doanThuTuNgay(dong.flatMap((o) => idx.map((i) => o[i])));
}

// ---------- Dán đè không thêm trùng (anh Sỹ 17–19/11/2026) ----------
// Ngày (giờ máy) của một mốc giờ, dạng yyyy-mm-dd; so ngày bằng giờ máy vì CSDL trả giờ UTC ("2026-11-20T17:00:00+00:00" là 21/11 giờ Việt Nam)
const p2 = (n) => String(n).padStart(2, "0");
export const ngayMoc = (x) => { const t = ms(x); if (t == null) return ""; const d = new Date(t); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };

// Dòng dán (v) và chuyến đã có (c) là CÙNG MỘT LẦN CẬP BẾN, kể cả chuyến đã rời bến (có ATD hoặc đã qua ETD):
//   • cùng ngày ETA hoặc cùng ngày ETB; hoặc ETA lệch nhau không quá 3 ngày;
//   • hoặc ETA của dòng dán nằm trước giờ rời của chuyến cũ (ATD, không có thì ETD) và không sớm hơn ETA chuyến cũ quá 7 ngày.
// Lần cập sau của cùng một tàu có ETA SAU giờ rời của lần trước (và xa hơn 3 ngày) nên vẫn là chuyến mới. Dùng để dán đè bảng tàu mà không sinh chuyến trùng.
export function cungLanCap(c, v) {
  if (ngayMoc(c.eta) && ngayMoc(c.eta) === ngayMoc(v.eta)) return true;
  if (ngayMoc(c.etb) && ngayMoc(c.etb) === ngayMoc(v.etb)) return true;
  const e1 = ms(v.eta), e0 = ms(c.eta), r0 = ms(c.atd) ?? ms(c.etd);
  if (e1 != null && e0 != null && Math.abs(e1 - e0) <= 3 * DAY) return true;
  if (e1 != null && r0 != null && e1 <= r0 && (e0 == null || e1 >= e0 - 7 * DAY)) return true;
  return false;
}

// Tàu có tên: chuyến cũ cùng tên khớp với dòng dán. Ưu tiên chuyến CÙNG LẦN CẬP (cả chuyến đã rời; nhiều chuyến thì ETA gần nhất); không có thì chuyến chưa rời mới nhất
// (người dùng dời ETA xa). Không có gì khớp thì là chuyến mới. Trả chuyến cũ hoặc null.
export function timChuyenCoTen(v, chuyens, now = Date.now()) {
  const ds = chuyens.filter((c) => c.ten_tau === v.ten_tau && !c.huy);
  const e1 = ms(v.eta);
  const xa = (c) => (e1 != null && ms(c.eta) != null ? Math.abs(ms(c.eta) - e1) : 0);
  const gan = ds.filter((c) => cungLanCap(c, v)).sort((a, b) => xa(a) - xa(b) || b.id - a.id)[0];
  return gan || ds.filter((c) => !chuyenDaRoi(c, now)).sort((a, b) => b.id - a.id)[0] || null;
}

// ---------- Tàu TBA khi dán lại ----------
// Tàu chưa biết tên (TBA) không có tên để khớp, nên khớp chuyến TBA đã có (chưa hủy) theo BẾN + HƯỚNG + KHỐI LƯỢNG cùng với dòng dán;
// nhiều chuyến cùng khớp thì ưu tiên cùng ngày ETA, rồi cùng hàng, rồi cùng ETB. Chuyến TBA đã rời bến chỉ khớp khi cùng ngày ETA hoặc ETB với dòng dán (sau giờ rời dòng còn trong bảng
// vẫn là chuyến đó, không thêm trùng). Mỗi chuyến đã có chỉ khớp một dòng trong một lần dán (dung = Set id đã dùng). Không khớp thì mới thêm chuyến mới. Trả chuyến cũ hoặc null.
export function timChuyenTBA(v, chuyens, dung = new Set(), now = Date.now()) {
  if (!v.ben_ma || v.khoi_luong == null || !v.huong) return null;
  const cungNgay = (c) => (ngayMoc(c.eta) && ngayMoc(c.eta) === ngayMoc(v.eta)) || (ngayMoc(c.etb) && ngayMoc(c.etb) === ngayMoc(v.etb));
  const diem = (c) => (ngayMoc(c.eta) && ngayMoc(c.eta) === ngayMoc(v.eta) ? 4 : 0) + (plain(c.ten_hang) && plain(c.ten_hang) === plain(v.ten_hang) ? 2 : 0) + (ngayMoc(c.etb) && ngayMoc(c.etb) === ngayMoc(v.etb) ? 1 : 0);
  const ds = chuyens.filter((c) => String(c.ten_tau || "").trim().toUpperCase() === "TBA" && !c.huy && !dung.has(c.id) && c.ben_ma === v.ben_ma && (c.huong || "nhap") === v.huong && +c.khoi_luong === +v.khoi_luong
    && (!chuyenDaRoi(c, now) || cungNgay(c)));
  return ds.sort((a, b) => diem(b) - diem(a) || a.id - b.id)[0] || null;
}
