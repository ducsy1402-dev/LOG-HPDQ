// Dán nhanh: tách văn bản thành bảng, đọc số và ngày giờ kiểu Việt Nam. Form dán bảng tàu mới ở danTau.js (14/11/2026).
import { docSo } from "./format";

// Tách văn bản thành bảng: ưu tiên tab (Excel), không có tab thì tách bằng 2+ khoảng trắng hoặc dấu |
// Dạng tab đọc theo quy tắc của Excel: ô có xuống dòng (Alt+Enter) hoặc có dấu " được Excel bao trong ngoặc kép ("...", "" là một dấu "),
// nên xuống dòng TRONG ô không bị tách thành dòng mới (lỗi trước đây: ô Kho-Bãi nhiều dòng làm lệch cả bảng). Các dòng trong cùng một ô nối bằng "; ".
export function tachBang(text) {
  const t = String(text || "").replace(/\r\n?/g, "\n");
  if (t.includes("\t")) return tachTab(t);
  const dong = t.split("\n").filter((l) => l.trim());
  const coDoc = dong.some((l) => l.includes("|"));
  return dong.map((l) => (coDoc ? l.split("|") : l.trim().split(/\s{2,}/)).map((c) => c.trim()));
}
function tachTab(t) {
  const rows = []; let row = [], i = 0;
  const n = t.length, het = (k) => { while (k < n && t[k] !== "\t" && t[k] !== "\n") k++; return k; };
  const xongDong = () => { if (row.some((c) => c.trim())) rows.push(row.map((c) => c.trim())); row = []; };
  while (i < n) {
    let cell;
    if (t[i] === '"') {
      let j = i + 1, s = "", dong = false;
      while (j < n) { if (t[j] === '"') { if (t[j + 1] === '"') { s += '"'; j += 2; continue; } dong = true; j++; break; } s += t[j++]; }
      if (dong && (j >= n || t[j] === "\t" || t[j] === "\n")) { cell = s.split("\n").map((x) => x.trim()).filter(Boolean).join("; "); i = j; }
      else { const k = het(i); cell = t.slice(i, k); i = k; } // ngoặc kép không khép kín đúng kiểu Excel: đọc nguyên văn
    } else { const k = het(i); cell = t.slice(i, k); i = k; }
    row.push(cell);
    if (i >= n) break;
    if (t[i] === "\t") i++; else { i++; xongDong(); }
  }
  xongDong();
  return rows;
}

// Đọc số: docSo ở format.js (dấu phẩy là thập phân, dấu chấm ngăn nghìn)
export { docSo };

// ===== Đọc ngày giờ: nhận MỌI định dạng thường gặp (anh Sỹ 15/11/2026) =====
//   Ngày–tháng–năm (VN): 22/10/2026, 22-10-26, 22.10.2026, 22/10 (thiếu năm: lấy năm gần "now" nhất)
//   Tháng–ngày–năm (Mỹ): 11/15/2026, 11-15-26 (tự nhận khi phần thứ hai > 12; còn nhập nhằng như 03/04/2026 thì theo opts.thuTu, mặc định "dmy")
//   Năm–tháng–ngày: 2026-10-22, 2026/10/22, 2026.10.22, 20261022; gộp liền: 22102026
//   Chữ: 22 Oct 2026, Oct 22, 2026, 22-Oct-26, 22 tháng 10 năm 2026, ngày 22 tháng 10
//   Giờ (tùy chọn, đứng trước hoặc sau ngày): 09:15, 09:15:30, 9h15, 9h, 9:15 PM, 2026-10-22T09:15
//   Số ngày kiểu Excel (46341 hoặc "46341"), đối tượng Date.
// docNgayGio(s, now, { thuTu: "dmy" | "mdy" }) -> chuỗi ISO (giờ máy) | null. Cột nhập nhằng: dùng doanThuTuNgay(các ô của cột) để chọn thuTu cho cả cột.
const THANG_EN = { jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12 };
const NGAY_SO = /(\d{1,4})\s*[/.-]\s*(\d{1,2})(?:\s*[/.-]\s*(\d{1,4}))?/;
const boDau = (x) => String(x).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
// Nhập nhằng ngày / tháng: a > 12 thì a là ngày (dmy); b > 12 thì a là tháng (mdy); còn lại theo thuTu (mặc định dmy). null nếu cả hai > 12
function xepNgayThang(a, b, thuTu) {
  if (a > 12 && b > 12) return null;
  if (a > 12) return { d: a, mo: b };
  if (b > 12) return { d: b, mo: a };
  return thuTu === "mdy" ? { d: b, mo: a } : { d: a, mo: b };
}
export function doanThuTuNgay(giaTri) {
  let dmy = 0, mdy = 0;
  for (const x of giaTri || []) {
    if (typeof x !== "string") continue;
    const m = NGAY_SO.exec(x);
    if (!m || m[1].length > 2) continue; // năm đứng đầu (2026-10-22) không nhập nhằng
    const a = +m[1], b = +m[2];
    if (a > 12 && b <= 12) dmy++; else if (b > 12 && a <= 12) mdy++;
  }
  return mdy > dmy ? "mdy" : "dmy";
}
export function docNgayGio(s, nowOrOpts = Date.now(), optsMoi = {}) {
  const dungOpts = nowOrOpts && typeof nowOrOpts === "object";
  const now = dungOpts ? Date.now() : nowOrOpts, opts = dungOpts ? nowOrOpts : optsMoi;
  if (s == null || s === "") return null;
  if (s instanceof Date) return Number.isNaN(+s) ? null : s.toISOString();
  const serial = (n) => (n > 20000 && n < 80000 ? new Date(Math.round((n - 25569) * 864e5) + new Date().getTimezoneOffset() * 6e4).toISOString() : null); // số ngày kiểu Excel
  if (typeof s === "number") return serial(s);
  let t = String(s).trim().replace(/\s+/g, " ");
  if (/^\d{5}(\.\d+)?$/.test(t)) return serial(+t);
  // Giờ: 09:15[:30] [AM/PM] hoặc 9h15 / 9h; lấy ra rồi bỏ khỏi chuỗi
  let h = 0, mi = 0, pm = null;
  let g = /(\d{1,2})\s*:\s*(\d{2})(?:\s*:\s*\d{2}(?:\.\d+)?)?\s*([ap])\.?m\.?\b/i.exec(t) || /(\d{1,2})\s*:\s*(\d{2})(?:\s*:\s*\d{2}(?:\.\d+)?)?/.exec(t);
  if (g) { h = +g[1]; mi = +g[2]; pm = g[3] ? g[3].toLowerCase() === "p" : null; t = (t.slice(0, g.index) + " " + t.slice(g.index + g[0].length)).trim(); }
  else {
    g = /(\d{1,2})\s*[hH](?!\p{L})\s*(\d{2})?/u.exec(t);
    if (g) { h = +g[1]; mi = +(g[2] || 0); t = (t.slice(0, g.index) + " " + t.slice(g.index + g[0].length)).trim(); }
  }
  t = t.replace(/[T,]/g, " ").replace(/\s+/g, " ").trim();
  if (pm === true && h < 12) h += 12; else if (pm === false && h === 12) h = 0;
  let y, mo, d, m;
  if (/^\d{8}$/.test(t)) { // 20261022 hoặc 22102026
    if (/^(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/.test(t)) { y = +t.slice(0, 4); mo = +t.slice(4, 6); d = +t.slice(6); }
    else { d = +t.slice(0, 2); mo = +t.slice(2, 4); y = +t.slice(4); }
  } else if ((m = /(\d{1,2})(?:st|nd|rd|th)?\s*[\s/.-]\s*([A-Za-z]{3,9})\.?(?:\s*[\s/.-]\s*(\d{2,4}))?/.exec(t)) && THANG_EN[m[2].toLowerCase()]) { // 22 Oct 2026, 22-Oct-26
    d = +m[1]; mo = THANG_EN[m[2].toLowerCase()]; if (m[3]) y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
  } else if ((m = /([A-Za-z]{3,9})\.?\s*(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(\d{2,4}))?/.exec(t)) && THANG_EN[m[1].toLowerCase()]) { // Oct 22, 2026
    mo = THANG_EN[m[1].toLowerCase()]; d = +m[2]; if (m[3]) y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
  } else if ((m = /(\d{1,2})\s*(?:thang|th|t)\s*(\d{1,2})(?:\s*(?:nam)?\s*(\d{2,4}))?/i.exec(boDau(t)))) { // 22 tháng 10 năm 2026
    d = +m[1]; mo = +m[2]; if (m[3]) y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
  } else if ((m = NGAY_SO.exec(t))) {
    if (m[1].length === 4) { // năm đứng đầu: yyyy-mm-dd
      if (m[3] === undefined) return null;
      y = +m[1]; mo = +m[2]; d = +m[3];
    } else {
      const x = xepNgayThang(+m[1], +m[2], opts.thuTu);
      if (!x) return null;
      d = x.d; mo = x.mo;
      if (m[3] !== undefined) { if (m[3].length === 3) return null; y = m[3].length === 2 ? 2000 + +m[3] : +m[3]; }
    }
  } else return null;
  if (!(mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && h <= 24 && mi < 60)) return null;
  const co = (yy) => { const x = new Date(yy, mo - 1, d, h, mi); return x.getMonth() === mo - 1 ? x.getTime() : NaN; }; // loại ngày không có thật (31/02)
  if (!y) {
    const nam = new Date(now).getFullYear();
    const thu = [nam - 1, nam, nam + 1].map(co).filter((x) => !Number.isNaN(x));
    return thu.length ? new Date(thu.reduce((a, b) => (Math.abs(b - now) < Math.abs(a - now) ? b : a))).toISOString() : null;
  }
  const kq = co(y);
  return Number.isNaN(kq) ? null : new Date(kq).toISOString();
}
