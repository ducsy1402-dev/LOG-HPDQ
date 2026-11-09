// Dán nhanh bảng tàu từ phần mềm khác hoặc Excel: tách cột, đoán cột theo tiêu đề, đọc số và ngày giờ kiểu Việt Nam.
import { plain, pad, docSo } from "./format";

// Các trường nhận được khi dán. ten: nhãn hiển thị, bi_danh: tiêu đề cột thường gặp (đã bỏ dấu)
export const TRUONG_DAN = [
  { k: "ben", ten: "Bến", bi_danh: ["ben", "cau ben", "berth", "cau"] },
  { k: "ten_tau", ten: "Tên tàu", bi_danh: ["ten tau", "tau", "vessel", "ship", "ten phuong tien"] },
  { k: "ma_chuyen", ten: "Mã chuyến", bi_danh: ["ma chuyen", "chuyen", "voyage"] },
  { k: "draft", ten: "Mớn (m)", bi_danh: ["draft", "mon", "mon nuoc"] },
  { k: "loa", ten: "LOA (m)", bi_danh: ["loa", "chieu dai", "dai"] },
  { k: "dwt", ten: "DWT", bi_danh: ["dwt", "trong tai"] },
  { k: "hang_nhap", ten: "Hàng nhập", bi_danh: ["hang nhap", "nhap"] },
  { k: "hang_xuat", ten: "Hàng xuất", bi_danh: ["hang xuat", "xuat"] },
  { k: "loai_hang", ten: "Loại hàng", bi_danh: ["loai hang"] },
  { k: "ten_hang", ten: "Tên hàng", bi_danh: ["ten hang", "hang hoa", "hang"] },
  { k: "khoi_luong", ten: "Khối lượng (t)", bi_danh: ["khoi luong", "kl", "kl (tan)", "san luong", "tong khoi luong", "tan"] },
  { k: "da_lam", ten: "KL đã làm (t)", bi_danh: ["da lam", "hoan tat", "hoan thanh", "da xep do"] },
  { k: "cam_ket", ten: "Cam kết (t/ngày)", bi_danh: ["cam ket", "cam ket xep do", "dinh muc"] },
  { k: "dem", ten: "DEM/des", bi_danh: ["dem/des", "dem", "des", "thuong phat", "don gia"] },
  { k: "eta", ten: "ETA", bi_danh: ["eta", "du kien den"] },
  { k: "etb", ten: "ETB", bi_danh: ["etb", "du kien cap", "ngay cap du kien"] },
  { k: "etd", ten: "ETD", bi_danh: ["etd", "du kien roi", "ngay roi du kien"] },
  { k: "nor", ten: "NOR", bi_danh: ["nor", "nop nor", "thong bao san sang"] },
  { k: "tg_tinh_tp", ten: "TG tính thưởng phạt", bi_danh: ["tg tinh thuong phat", "thoi gian tinh thuong phat", "laytime bat dau", "bat dau tinh laytime"] },
  { k: "atb", ten: "ATB", bi_danh: ["atb", "cap thuc te", "ngay cap thuc te", "ngay cap"] },
  { k: "atd", ten: "ATD", bi_danh: ["atd", "roi thuc te", "ngay roi thuc te"] },
  { k: "bai_hang", ten: "Bãi nhận / lấy hàng", bi_danh: ["bai", "bai nhan", "bai lay hang", "bai hang", "bai chua"] },
  { k: "cau", ten: "Cẩu thực hiện", bi_danh: ["cau thuc hien", "thiet bi", "cau truc"] },
  { k: "ghi_chu", ten: "Ghi chú", bi_danh: ["ghi chu", "note"] },
];
export const LOAI_SO = new Set(["draft", "loa", "dwt", "khoi_luong", "da_lam", "cam_ket", "dem"]);
export const LOAI_NGAY = new Set(["eta", "etb", "etd", "nor", "atb", "atd", "tg_tinh_tp"]);

// Tách văn bản thành bảng: ưu tiên tab (Excel), không có tab thì tách bằng 2+ khoảng trắng hoặc dấu |
export function tachBang(text) {
  const dong = String(text || "").replace(/\r/g, "").split("\n").filter((l) => l.trim());
  const coTab = dong.some((l) => l.includes("\t"));
  const coDoc = !coTab && dong.some((l) => l.includes("|"));
  return dong.map((l) => (coTab ? l.split("\t") : coDoc ? l.split("|") : l.trim().split(/\s{2,}/)).map((c) => c.trim()));
}

// Đoán trường của một tiêu đề cột
export function doanTruong(tieuDe) {
  const p = plain(tieuDe).replace(/[()]/g, " ").replace(/\s+/g, " ").trim();
  if (!p) return "";
  let tot = "", diem = 0;
  for (const t of TRUONG_DAN)
    for (const b of t.bi_danh) {
      const d = p === b ? 100 + b.length : p.startsWith(b) || p.endsWith(b) ? 50 + b.length : p.includes(b) && b.length > 2 ? 20 + b.length : 0;
      if (d > diem) { diem = d; tot = t.k; }
    }
  return tot;
}

// Dòng đầu là tiêu đề nếu đoán được ít nhất 2 cột
export function nhanDienTieuDe(bang) {
  if (!bang.length) return { coTieuDe: false, cot: [] };
  const cot = bang[0].map(doanTruong);
  const daDung = new Set();
  const sach = cot.map((k) => (k && !daDung.has(k) ? (daDung.add(k), k) : ""));
  return sach.filter(Boolean).length >= 2 ? { coTieuDe: true, cot: sach } : { coTieuDe: false, cot: bang[0].map(() => "") };
}

// Đơn giá phạt viết tắt trong cột DEM/des: "10tr dôi nhật" = chậm 1 ngày phạt 10.000.000 VNĐ.
// Nhận: 10tr, 10 triệu, 1,5 tỷ, 600.000.000đ, 25.000 USD, $25,000, 25k USD; "dôi nhật", "/ngày" = mỗi ngày.
// Số trơn: từ 1.000.000 trở lên hiểu là VNĐ, nhỏ hơn hiểu là USD. Không có số -> null.
export function docDonGia(s) {
  if (s == null || s === "") return null;
  if (typeof s === "number") return s > 0 ? { don_gia: s, don_vi_tien: s >= 1e6 ? "VND" : "USD" } : null;
  const t = String(s).toLowerCase().normalize("NFC").replace(/(\d)\s*(đ|₫)/g, "$1 vnd "); // "600.000.000đ" -> "600.000.000 vnd"
  const m = /(\$\s*)?(\d[\d.,]*)\s*(tỷ|ty|tỉ|ti|triệu|trieu|tr|m|nghìn|nghin|ngàn|ngan|k)?(?![a-zà-ỹ])/i.exec(t.replace(/\$\s+/, "$"));
  if (!m) return null;
  let n = docSo(/^\d{1,3}(,\d{3})+$/.test(m[2]) ? m[2].replace(/,/g, "") : m[2]); // tiền: "25,000" là hai mươi lăm nghìn
  if (n == null || !(n > 0)) return null;
  const dv = m[3] || "";
  const coUsd = /usd|\$|đô/.test(t), coVnd = /vnd|vnđ|đồng|dong|₫|\dđ|\d đ\b/.test(t);
  if (/^(tỷ|ty|tỉ|ti)$/.test(dv)) return { don_gia: n * 1e9, don_vi_tien: "VND" };
  if (/^(triệu|trieu|tr|m)$/.test(dv)) return { don_gia: n * 1e6, don_vi_tien: coUsd ? "USD" : "VND" };
  if (/^(nghìn|nghin|ngàn|ngan|k)$/.test(dv)) n *= 1e3;
  return { don_gia: n, don_vi_tien: coUsd ? "USD" : coVnd ? "VND" : n >= 1e6 ? "VND" : "USD" };
}

// Đọc số: docSo ở format.js (dấu phẩy là thập phân, dấu chấm ngăn nghìn)
export { docSo };

// Ngày giờ: "22/10 09:15", "22/10/2026 9h15", "09:15 22/10", "2026-10-22 09:15", "22-10-26 09:15". Thiếu năm thì lấy năm gần "now" nhất.
export function docNgayGio(s, now = Date.now()) {
  if (s == null || s === "") return null;
  if (typeof s === "number") { // số ngày kiểu Excel
    if (s > 20000 && s < 80000) return new Date(Math.round((s - 25569) * 864e5) + new Date().getTimezoneOffset() * 6e4).toISOString();
    return null;
  }
  const t = String(s).trim().replace(/\s+/g, " ");
  let y, mo, d, h = 0, mi = 0;
  const g = /(\d{1,2})\s*[:hH]\s*(\d{2})?/.exec(t.replace(/(\d{1,2})[/.-](\d{1,2})([/.-]\d{2,4})?/, " "));
  if (g) { h = +g[1]; mi = +(g[2] || 0); }
  let m = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else {
    m = /(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?/.exec(t);
    if (!m) return null;
    d = +m[1]; mo = +m[2];
    if (m[3]) y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
  }
  if (!(mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && h <= 24 && mi < 60)) return null;
  if (!y) {
    const nam = new Date(now).getFullYear();
    const thu = [nam - 1, nam, nam + 1].map((yy) => new Date(yy, mo - 1, d, h, mi).getTime());
    return new Date(thu.reduce((a, b) => (Math.abs(b - now) < Math.abs(a - now) ? b : a))).toISOString();
  }
  return new Date(y, mo - 1, d, h, mi).toISOString();
}

// Một dòng đã dán -> bản ghi chuyến tàu (chưa có id). berthOf: tìm mã bến từ chữ (B01, BTL…)
export function dongThanhChuyen(o, cot, { berthOf, now = Date.now() } = {}) {
  const r = { _goc: o, _loi: [] };
  cot.forEach((k, i) => { if (k) r[k] = o[i] ?? ""; });
  const v = { ten_tau: String(r.ten_tau || "").trim().toUpperCase() || "TBA" };
  if (r.ma_chuyen) v.ma_chuyen = String(r.ma_chuyen).trim().toUpperCase();
  if (r.ben) {
    // Tàu cập hai bến ghi "7/8", "3/5", "B07/08", "HH2/3": bến đầu là bến chính, bến sau là bến phụ (bến sau có thể chỉ ghi số)
    const [x, y] = String(r.ben).split("/").map((s) => s.trim());
    const b = berthOf?.(x);
    if (b) v.ben_ma = b.ma; else r._loi.push(`Không rõ bến "${r.ben}"`);
    if (b && y) {
      const tien = /^[A-Za-z]+/.exec(x)?.[0] || ""; // "HH2/3" → HH3, "B07/08" → B08
      const p = (tien && /^\d/.test(y) ? berthOf?.(tien + y) : null) || berthOf?.(y);
      if (p && p.ma !== b.ma) v.ben_phu = p.ma; else r._loi.push(`Không rõ bến phụ "${y}"`);
    } else if (b) v.ben_phu = null; // dán một bến: bỏ bến phụ cũ (nếu có)
  }
  for (const k of ["draft", "loa", "dwt", "khoi_luong", "da_lam"]) if (r[k] !== undefined && r[k] !== "") { const n = docSo(r[k]); if (n == null) r._loi.push(`${k} "${r[k]}" không phải số`); else v[k] = n; }
  if (r.cam_ket !== undefined && r.cam_ket !== "") {
    const n = docSo(r.cam_ket);
    if (n != null) v.cam_ket = n;
    else { v.cam_ket_ghi_chu = String(r.cam_ket).trim(); if (/cqd/i.test(v.cam_ket_ghi_chu)) v.kieu_tp = "cqd"; } // CAM KẾT ghi CQD: tàu tính theo CQD
  }
  if (r.dem !== undefined && r.dem !== "") {
    // DEM/des: đơn giá phạt mỗi ngày; ô chữ (10tr dôi nhật…) vẫn giữ làm ghi chú
    const g = docDonGia(r.dem), chu = typeof r.dem === "string" && docSo(r.dem) == null ? String(r.dem).trim() : null;
    v._tien = g ? { ...g, ghi_chu: chu } : { ghi_chu: String(r.dem).trim() };
  }
  for (const k of LOAI_NGAY) if (r[k]) { const t = docNgayGio(r[k], now); if (t) v[k] = t; else r._loi.push(`${k.toUpperCase()} "${r[k]}" không đọc được`); }
  if (v.tg_tinh_tp) v.moc_tinh_tp = "tay"; // có "TG tính thưởng phạt" từ phiếu tàu: dùng đúng giờ đó
  if (r.hang_nhap || r.hang_xuat) {
    v.huong = r.hang_xuat && !r.hang_nhap ? "xuat" : "nhap";
    v.ten_hang = String(r.hang_nhap || r.hang_xuat).trim();
  }
  if (r.ten_hang) v.ten_hang = String(r.ten_hang).trim();
  if (r.loai_hang) v.loai_hang = String(r.loai_hang).trim();
  if (!v.loai_hang && v.ten_hang) v.loai_hang = v.ten_hang;
  if (r.cau) v.cau = String(r.cau).split(/[;,]+/).map((s) => s.trim().replace(/_/g, "")).filter(Boolean);
  if (r.bai_hang) v.bai_hang = String(r.bai_hang).trim();
  if (r.ghi_chu) v.ghi_chu = String(r.ghi_chu).trim();
  return { v, loi: r._loi };
}

export const fmtNgayNhap = (iso) => { if (!iso) return ""; const d = new Date(iso); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
