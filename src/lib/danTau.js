// Dán nhanh bảng tàu theo FORM MẪU (anh Sỹ chốt 14/11/2026), thay form cũ. Cột của bảng mẫu:
//   BẾN · TÊN TÀU · DRAFT · LOA · DWT · GEAR · HÀNG NHẬP · HÀNG XUẤT · KHỐI LƯỢNG · CAM KẾT · DEM/day · PT. Vận chuyển · Kho-Bãi · PT. Kho Bãi · LAYTIME · LSD · Ghi chú · ETA · ETB · ETD
// Quy tắc:
//   • Hàng nhập / Hàng xuất, Kho-Bãi, PT. Vận chuyển, PT. Kho Bãi: nhiều mục ngăn cách bằng dấu phẩy, dấu cộng hoặc dấu chấm phẩy; số hoặc chữ sau dấu gạch ngang "-" là khối lượng
//     (hoặc giá trị) của mục đó: "Cán 1-1221, Cán 2-1000" → bãi Cán 1: 1221, bãi Cán 2: 1000. Hàng thì khối lượng phải là số.
//   • ETA dạng "18-19/11/2026" hiểu là ngày SAU dấu gạch ngang (19/11/2026); ETA, ETB, ETD không đọc được thành ngày thì báo lỗi.
//   • Dòng không có tên tàu thì bỏ qua. Cột bắt buộc: Bến, Tên tàu, Hàng nhập hoặc Hàng xuất (không được cả hai), Khối lượng (phải là số), ETA, ETB, ETD.
//   • Các cột còn lại giữ nguyên nội dung; ô trống hiện là "trống" (không ghi chữ "trống" vào CSDL, để NULL).
//   • Số trong cột Khối lượng / DWT / Cam kết: dấu phẩy + đúng 3 chữ số là ngăn nghìn kiểu Excel ("3,500" = 3.500 t); Draft / LOA dùng cách đọc số thường (4.78, 14,6).
import { plain, docSo } from "./format";
import { docNgayGio } from "./paste";

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
  { k: "etd", ten: "ETD", bb: true, bi: ["etd"] },
];
export const TEN_COT = Object.fromEntries(COT_TAU.map((c) => [c.k, c.ten]));
export const MAU_BANG = COT_TAU.map((c) => c.ten).join("\t") + "\nTL\tPHƯƠNG BÁCH 12\t4.78\t79.96\t3,558\t\t\tPhôi vuông, thép cuộn\t3,500\tCQD\tCQD\tĐầu kéo\tBãi xe LOG, bãi HRCE, AB cán 3\tCẦU TRỤC, cầu bãi\t\t\t\t12/11/2026 16:00\t14/11/2026\t15/11/2026";

const chuan = (s) => plain(s).replace(/[^a-z0-9/ ]+/g, " ").replace(/\s+/g, " ").trim();
const rong = (x) => x == null || String(x).trim() === "";
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

// Tách "A - 100, B - 200; C + D" thành các mục. Mục có dấu gạch ngang: phần sau dấu gạch CUỐI CÙNG là giá trị (số thì ghi số, chữ thì ghi chữ).
// Trả [{ ten, so, chu }]: so = số sau dấu gạch (null nếu không phải số), chu = chữ sau dấu gạch (rỗng nếu không có)
export function tachDanhSach(x) {
  return chu(x).split(/[,;+]/).map((m) => m.trim()).filter(Boolean).map((m) => {
    const i = m.lastIndexOf("-");
    if (i <= 0 || i === m.length - 1) return { ten: m, so: null, chu: "" };
    const ten = m.slice(0, i).trim(), sau = m.slice(i + 1).trim();
    if (!ten || !sau) return { ten: m, so: null, chu: "" };
    const so = docSoTan(sau.replace(/\s*(t|tan|tấn)$/i, ""));
    return { ten, so, chu: so == null ? sau : "" };
  });
}

// Ngày: ETA có thể ghi "18-19/11/2026" (lấy ngày sau dấu gạch ngang). Trả { trong } | { loi } | { iso }
export function docNgayTau(x, { now = Date.now(), khoangNgay = false } = {}) {
  if (rong(x)) return { trong: true };
  let t = x;
  if (khoangNgay && typeof x === "string") {
    const m = /^\s*\d{1,2}\s*[-–]\s*(\d{1,2}\s*[/.]\s*\d{1,2}(?:\s*[/.]\s*\d{2,4})?)(.*)$/.exec(x);
    if (m) t = m[1].replace(/\s+/g, "") + m[2];
  }
  const iso = docNgayGio(t, now);
  return iso ? { iso } : { loi: true };
}

// Một dòng đã dán -> { v (bản ghi chuyến), loi: [chữ], trong: [khóa các ô chữ để trống] }; null nếu dòng không có tên tàu.
// ctx: { berthOf(x) -> bến | null, now, nhomCua(tenHang) -> nhóm hàng }
export function docDongTau(o, cot, { berthOf, now = Date.now(), nhomCua = () => null } = {}) {
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
  const coNhap = !rong(r.hang_nhap), coXuat = !rong(r.hang_xuat);
  if (coNhap && coXuat) loi.push("Vừa có Hàng nhập vừa có Hàng xuất");
  else if (!coNhap && !coXuat) loi.push("Thiếu Hàng nhập hoặc Hàng xuất");
  else {
    v.huong = coXuat ? "xuat" : "nhap";
    const ds = tachDanhSach(coXuat ? r.hang_xuat : r.hang_nhap), hangDs = [];
    for (const h of ds) {
      if (h.chu) loi.push(`Khối lượng của hàng "${h.ten}" là "${h.chu}", không phải số`);
      hangDs.push({ ten_hang: h.ten, loai_hang: nhomCua(h.ten) || h.ten, khoi_luong: h.so });
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

  // ETA / ETB / ETD: bắt buộc, phải là ngày
  for (const k of ["eta", "etb", "etd"]) {
    if (!(k in r)) { thieu(k); continue; }
    const d = docNgayTau(r[k], { now, khoangNgay: k === "eta" });
    if (d.trong) thieu(k); else if (d.loi) loi.push(`${TEN_COT[k]} "${chu(r[k])}" không phải ngày`); else v[k] = d.iso;
  }

  return { v, loi, trong };
}

// Cột bắt buộc không có trong bảng (cả bảng thiếu cột, khác với một ô trống)
export const cotThieu = (cot) => COT_TAU.filter((c) => c.bb && c.k !== "hang_nhap" && !cot.includes(c.k)).map((c) => c.ten)
  .concat(!cot.includes("hang_nhap") && !cot.includes("hang_xuat") ? ["HÀNG NHẬP hoặc HÀNG XUẤT"] : []);
