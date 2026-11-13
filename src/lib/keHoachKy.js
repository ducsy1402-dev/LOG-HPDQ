// Kỳ của kế hoạch xuất / nhập kho (SQL 12): ngày · tuần · tháng · năm.
// Mỗi dòng kế hoạch (bảng kho_ke_hoach) có loai_ky + ky: ngày "yyyy-mm-dd" · tuần "yyyy-mm-dd" của thứ Hai đầu tuần · tháng "yyyy-mm" · năm "yyyy".
// Dòng cũ (chưa có loai_ky / ky) là kế hoạch THÁNG theo cột thang.
// Khối lượng của một dòng chia đều cho các ngày trong kỳ của nó; các nơi tính biểu đồ / so thực tế dùng ngayCuaKeHoach.
export const LOAI_KY = [["ngay", "Ngày"], ["tuan", "Tuần"], ["thang", "Tháng"], ["nam", "Năm"]];

const p2 = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
const tuStr = (s) => { const [y, m, d] = String(s).slice(0, 10).split("-").map(Number); return new Date(Date.UTC(y, (m || 1) - 1, d || 1)); };
const cong = (s, n) => { const d = tuStr(s); d.setUTCDate(d.getUTCDate() + n); return ymd(d); };

// Thứ Hai đầu tuần chứa ngày này
export function thuHai(ngay) { const d = tuStr(ngay), lui = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - lui); return ymd(d); }
// Khóa kỳ chứa một ngày
export const kyCuaNgay = (loai, ngay) => (loai === "ngay" ? String(ngay).slice(0, 10) : loai === "tuan" ? thuHai(ngay) : loai === "thang" ? String(ngay).slice(0, 7) : String(ngay).slice(0, 4));
// Ngày đầu của kỳ (yyyy-mm-dd)
export const ngayDauKy = (loai, ky) => (loai === "ngay" || loai === "tuan" ? ky : loai === "thang" ? `${ky}-01` : `${ky}-01-01`);

const nho = new Map();
// Các ngày (yyyy-mm-dd) của một kỳ
export function ngayCuaKy(loai, ky) {
  const key = `${loai}|${ky}`;
  if (nho.has(key)) return nho.get(key);
  let out;
  if (loai === "ngay") out = [String(ky).slice(0, 10)];
  else if (loai === "tuan") out = Array.from({ length: 7 }, (_, i) => cong(ky, i));
  else if (loai === "thang") { const [y, m] = String(ky).split("-").map(Number), n = new Date(Date.UTC(y, m, 0)).getUTCDate(); out = Array.from({ length: n }, (_, i) => `${y}-${p2(m)}-${p2(i + 1)}`); }
  else { const y = +ky; out = []; for (const d = new Date(Date.UTC(y, 0, 1)); d.getUTCFullYear() === y; d.setUTCDate(d.getUTCDate() + 1)) out.push(ymd(d)); }
  nho.set(key, out);
  return out;
}
// Tháng (yyyy-mm) ghi vào cột thang: tháng của ngày đầu kỳ
export const thangCuaKy = (loai, ky) => ngayDauKy(loai, ky).slice(0, 7);
// Kỳ liền trước (n = -1) / liền sau (n = 1)
export function dichKy(loai, ky, n = 1) {
  if (loai === "ngay") return cong(ky, n);
  if (loai === "tuan") return cong(ky, 7 * n);
  if (loai === "thang") { const [y, m] = ky.split("-").map(Number), d = new Date(Date.UTC(y, m - 1 + n, 1)); return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}`; }
  return String(+ky + n);
}
export function nhanKy(loai, ky) {
  const dm = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}`, dmy = (s) => `${dm(s)}/${s.slice(0, 4)}`;
  if (loai === "ngay") return dmy(ky);
  if (loai === "tuan") return `Tuần ${dm(ky)} – ${dmy(cong(ky, 6))}`;
  if (loai === "thang") return `Tháng ${+ky.slice(5, 7)}/${ky.slice(0, 4)}`;
  return `Năm ${ky}`;
}
export const kyHienTai = (loai, homNay) => kyCuaNgay(loai, homNay);

// Kỳ của một dòng kế hoạch (dòng cũ: tháng)
export const kyCua = (r) => ({ loai: r.loai_ky || "thang", ky: r.ky || r.thang });
export const ngayCuaKeHoach = (r) => { const { loai, ky } = kyCua(r); return ngayCuaKy(loai, ky); };
export const cungKy = (r, loai, ky) => { const k = kyCua(r); return k.loai === loai && k.ky === ky; };
// Hai kỳ có chung ngày nào không
export function trungNgay(a, b) { const s = new Set(a); return b.some((n) => s.has(n)); }
