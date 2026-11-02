// Kỳ thống kê: ngày, tuần (thứ Hai – Chủ nhật), tháng, quý, năm. Mỗi kỳ có khóa dạng chuỗi (xếp theo thời gian được):
//   ngày "2026-10-28" · tuần = ngày thứ Hai "2026-10-26" · tháng "2026-10" · quý "2026-Q4" · năm "2026"
// Dùng cho biểu đồ khối lượng, thưởng phạt, kho: chọn xem theo loại kỳ rồi chọn kỳ.
import { DAY } from "./format";

export const TEN_LOAI_KY = { ngay: "Ngày", tuan: "Tuần", thang: "Tháng", quy: "Quý", nam: "Năm" };
const p2 = (n) => String(n).padStart(2, "0");
const ngayKhoa = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const dauNgay = (t) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
const doiNgayKhoa = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const thuHai = (t) => { const d = dauNgay(t); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; };
// Số tuần theo ISO (tuần chứa thứ Năm đầu tiên của năm là tuần 1)
const tuanISO = (thuHaiD) => { const th5 = new Date(thuHaiD); th5.setDate(th5.getDate() + 3); const dau = new Date(th5.getFullYear(), 0, 1); return { nam: th5.getFullYear(), tuan: Math.floor((th5 - dau) / DAY / 7) + 1 }; };

// Khóa kỳ chứa thời điểm t (ms)
export function khoaKy(loai, t) {
  const d = new Date(t);
  if (loai === "ngay") return ngayKhoa(dauNgay(t));
  if (loai === "tuan") return ngayKhoa(thuHai(t));
  if (loai === "thang") return `${d.getFullYear()}-${p2(d.getMonth() + 1)}`;
  if (loai === "quy") return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
  return String(d.getFullYear());
}
// Khoảng [tu, den) (ms, giờ máy) của một kỳ
export function khoangKy(loai, khoa) {
  let a, b;
  if (loai === "ngay") { a = doiNgayKhoa(khoa); b = new Date(a.getFullYear(), a.getMonth(), a.getDate() + 1); }
  else if (loai === "tuan") { a = doiNgayKhoa(khoa); b = new Date(a.getFullYear(), a.getMonth(), a.getDate() + 7); }
  else if (loai === "thang") { const [y, m] = khoa.split("-").map(Number); a = new Date(y, m - 1, 1); b = new Date(y, m, 1); }
  else if (loai === "quy") { const [y, q] = khoa.split("-Q").map(Number); a = new Date(y, (q - 1) * 3, 1); b = new Date(y, q * 3, 1); }
  else { const y = +khoa; a = new Date(y, 0, 1); b = new Date(y + 1, 0, 1); }
  return { tu: a.getTime(), den: b.getTime() };
}
const dm = (t) => `${p2(new Date(t).getDate())}/${p2(new Date(t).getMonth() + 1)}`;
// Tên đầy đủ của kỳ (hộp chọn, tiêu đề)
export function tenKy(loai, khoa) {
  const { tu, den } = khoangKy(loai, khoa);
  if (loai === "ngay") return `${dm(tu)}/${new Date(tu).getFullYear()}`;
  if (loai === "tuan") { const w = tuanISO(new Date(tu)); return `Tuần ${w.tuan}/${w.nam} (${dm(tu)} – ${dm(den - DAY)})`; }
  if (loai === "thang") { const [y, m] = khoa.split("-"); return `Tháng ${+m}/${y}`; }
  if (loai === "quy") { const [y, q] = khoa.split("-Q"); return `Quý ${q}/${y}`; }
  return `Năm ${khoa}`;
}
// Tên ngắn cho trục biểu đồ
export function tenNganKy(loai, khoa) {
  const { tu } = khoangKy(loai, khoa);
  if (loai === "ngay") return dm(tu);
  if (loai === "tuan") return `T${tuanISO(new Date(tu)).tuan}`;
  if (loai === "thang") return `T${+khoa.split("-")[1]}`;
  if (loai === "quy") { const [y, q] = khoa.split("-Q"); return `Q${q}/${y.slice(2)}`; }
  return khoa;
}
// Kỳ lùi (n < 0) hoặc tiến (n > 0) so với một kỳ
export function congKy(loai, khoa, n) {
  const { tu } = khoangKy(loai, khoa), d = new Date(tu);
  if (loai === "ngay") return khoaKy(loai, new Date(d.getFullYear(), d.getMonth(), d.getDate() + n).getTime());
  if (loai === "tuan") return khoaKy(loai, new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7 * n).getTime());
  if (loai === "thang") return khoaKy(loai, new Date(d.getFullYear(), d.getMonth() + n, 1).getTime());
  if (loai === "quy") return khoaKy(loai, new Date(d.getFullYear(), d.getMonth() + 3 * n, 1).getTime());
  return String(+khoa + n);
}
// Các kỳ từ `truoc` kỳ trước kỳ hiện tại đến `sau` kỳ sau, xếp cũ → mới
export function dsKy(loai, now, truoc, sau = 0) {
  const hn = khoaKy(loai, now);
  return Array.from({ length: truoc + sau + 1 }, (_, i) => congKy(loai, hn, i - truoc));
}
// Các tháng giao với khoảng [tu, den): [{ thang: "2026-10", tyLe }] với tyLe = phần của tháng nằm trong khoảng (theo số ngày); dùng chia mục tiêu tháng cho tuần / quý / năm
export function thangTrongKy(tu, den) {
  const out = [];
  for (let d = new Date(new Date(tu).getFullYear(), new Date(tu).getMonth(), 1); d.getTime() < den; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    const a = d.getTime(), b = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
    const giao = Math.min(b, den) - Math.max(a, tu);
    if (giao > 0) out.push({ thang: `${d.getFullYear()}-${p2(d.getMonth() + 1)}`, tyLe: giao / (b - a) });
  }
  return out;
}
// Tháng (khóa "yyyy-mm") chứa đầu kỳ: để tải thêm dữ liệu khi chọn kỳ cũ
export const thangDauKy = (loai, khoa) => khoaKy("thang", khoangKy(loai, khoa).tu);
