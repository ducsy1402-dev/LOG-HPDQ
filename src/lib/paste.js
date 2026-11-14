// Dán nhanh: tách văn bản thành bảng, đọc số và ngày giờ kiểu Việt Nam. Form dán bảng tàu mới ở danTau.js (14/11/2026).
import { docSo } from "./format";

// Tách văn bản thành bảng: ưu tiên tab (Excel), không có tab thì tách bằng 2+ khoảng trắng hoặc dấu |
export function tachBang(text) {
  const dong = String(text || "").replace(/\r/g, "").split("\n").filter((l) => l.trim());
  const coTab = dong.some((l) => l.includes("\t"));
  const coDoc = !coTab && dong.some((l) => l.includes("|"));
  return dong.map((l) => (coTab ? l.split("\t") : coDoc ? l.split("|") : l.trim().split(/\s{2,}/)).map((c) => c.trim()));
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
