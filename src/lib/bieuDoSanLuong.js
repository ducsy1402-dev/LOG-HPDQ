// Gộp mục tiêu tháng + sản lượng thực tế theo ca / ngày (SQL 06) thành số liệu theo kỳ (tuần / tháng / quý / năm) cho biểu đồ Tổng quan.
// Mục tiêu tháng được chia đều theo ngày của tháng đó, nên cộng lại cho bất kỳ kỳ nào (kể cả tuần nằm giữa hai tháng).
import { pad } from "./format";
import { ngayCuaThang, tuDb, khoaCua } from "./sanLuongTT";

export const KY = [["tuan", "Tuần"], ["thang", "Tháng"], ["quy", "Quý"], ["nam", "Năm"]];

const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const ddmm = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;

// Kỳ chứa ngày homNay (YYYY-MM-DD): danh sách ngày, các tháng liên quan, bước gộp điểm trên biểu đồ, nhãn kỳ
export function khoangKy(ky, homNay) {
  const [y, m, d] = homNay.split("-").map(Number);
  let tu, den, nhan;
  if (ky === "tuan") { const lui = (new Date(y, m - 1, d).getDay() + 6) % 7; tu = new Date(y, m - 1, d - lui); den = new Date(y, m - 1, d - lui + 6); nhan = `Tuần ${ddmm(ymd(tu))} – ${ddmm(ymd(den))}`; }
  else if (ky === "thang") { tu = new Date(y, m - 1, 1); den = new Date(y, m, 0); nhan = `Tháng ${m}/${y}`; }
  else if (ky === "quy") { const q = Math.floor((m - 1) / 3); tu = new Date(y, q * 3, 1); den = new Date(y, q * 3 + 3, 0); nhan = `Quý ${q + 1}/${y}`; }
  else { tu = new Date(y, 0, 1); den = new Date(y, 12, 0); nhan = `Năm ${y}`; }
  const ngays = [];
  for (const t = new Date(tu); t <= den; t.setDate(t.getDate() + 1)) ngays.push(ymd(t));
  return { ky, ngays, thangs: [...new Set(ngays.map((s) => s.slice(0, 7)))], buoc: ky === "quy" ? "tuan" : ky === "nam" ? "thang" : "ngay", nhan, homNay };
}

// Khóa nhóm điểm: theo ngày, theo tuần (thứ Hai đầu tuần) hoặc theo tháng
export function khoaDiem(buoc, s) {
  if (buoc === "ngay") return s;
  if (buoc === "thang") return s.slice(0, 7);
  const [y, m, d] = s.split("-").map(Number), lui = (new Date(y, m - 1, d).getDay() + 6) % 7;
  return ymd(new Date(y, m - 1, d - lui));
}
export const nhanDiem = (buoc, ngayDau) => (buoc === "thang" ? `T${+ngayDau.slice(5, 7)}` : ddmm(ngayDau));

// Dòng (hướng | loại | đơn vị | hàng) đã có mục tiêu RIÊNG của kỳ (quý / năm, SQL 10): dòng đó dùng mục tiêu của kỳ, không cộng các tháng
const khoaRieng = (nhom, ghiDe) => new Set((ghiDe || []).map((r) => khoaCua(tuDb(nhom, r))));
// Mục tiêu theo ngày (Map ngày -> tấn) của các dòng thỏa loc. Mục tiêu tháng chia đều theo ngày của tháng; mục tiêu riêng của kỳ (ghiDe) chia đều theo ngày của kỳ
function mucTieuNgay(nhom, mucTieu, loc, ghiDe, ngays) {
  const mm = new Map(), rieng = khoaRieng(nhom, ghiDe);
  for (const r of mucTieu || []) {
    const x = tuDb(nhom, r);
    if (!loc(x) || rieng.has(khoaCua(x))) continue;
    const nd = ngayCuaThang(r.thang), moi = (+r.tan || 0) / nd.length;
    for (const d of nd) mm.set(d, (mm.get(d) || 0) + moi);
  }
  for (const r of ghiDe || []) {
    if (!loc(tuDb(nhom, r)) || !ngays.length) continue;
    const moi = (+r.tan || 0) / ngays.length;
    for (const d of ngays) mm.set(d, (mm.get(d) || 0) + moi);
  }
  return mm;
}

// Chuỗi theo điểm của kỳ: mục tiêu, thực tế (tách theo `chia(dòng)` nếu có), lũy kế mục tiêu và lũy kế thực tế (null với điểm chưa tới)
export function chuoiKy(kyInfo, du, nhom, { loc = () => true, chia = () => "" } = {}) {
  const { ngays, buoc, homNay } = kyInfo;
  const mt = mucTieuNgay(nhom, du?.mucTieu, loc, du?.mucTieuKy, ngays);
  const diem = new Map(), tt = [], tap = new Set(ngays);
  for (const d of ngays) {
    const k = khoaDiem(buoc, d);
    if (!diem.has(k)) { const o = { nhan: nhanDiem(buoc, d), dau: d, mt: 0, tt: 0, theo: new Map() }; diem.set(k, o); tt.push(o); }
    diem.get(k).mt += mt.get(d) || 0;
  }
  const dongTT = new Map();
  for (const r of du?.thucTe || []) {
    const x = tuDb(nhom, r), d = String(r.ngay).slice(0, 10);
    if (!loc(x) || !diem.has(khoaDiem(buoc, d)) || !tap.has(d)) continue;
    const o = diem.get(khoaDiem(buoc, d)), c = chia(x);
    o.tt += +r.tan || 0; o.theo.set(c, (o.theo.get(c) || 0) + (+r.tan || 0));
    dongTT.set(c, true);
  }
  let lm = 0, lt = 0;
  for (const o of tt) { lm += o.mt; lt += o.tt; o.lkMt = lm; o.lkTt = o.dau <= homNay ? lt : null; }
  const tongMt = tt.reduce((s, o) => s + o.mt, 0), tongTt = tt.reduce((s, o) => s + o.tt, 0);
  return { diem: tt, tongMt, tongTt, nhomChia: [...dongTT.keys()] };
}

// Mục tiêu cả kỳ và thực hiện lũy kế theo nhóm `khoa(dòng)` (vd. hướng · loại hàng, hoặc đơn vị thực hiện): Map khóa -> { mt, tt }
export function tongTheoNhom(kyInfo, du, nhom, khoa, loc = () => true) {
  const { ngays } = kyInfo, tap = new Set(ngays), kq = new Map();
  const lay = (k) => { if (!kq.has(k)) kq.set(k, { mt: 0, tt: 0 }); return kq.get(k); };
  const rieng = khoaRieng(nhom, du?.mucTieuKy);
  for (const r of du?.mucTieu || []) {
    const x = tuDb(nhom, r);
    if (!loc(x) || rieng.has(khoaCua(x))) continue;
    const nd = ngayCuaThang(r.thang), moi = (+r.tan || 0) / nd.length, n = nd.filter((d) => tap.has(d)).length;
    if (n) lay(khoa(x)).mt += moi * n;
  }
  for (const r of du?.mucTieuKy || []) { const x = tuDb(nhom, r); if (loc(x)) lay(khoa(x)).mt += +r.tan || 0; }
  for (const r of du?.thucTe || []) {
    const x = tuDb(nhom, r), d = String(r.ngay).slice(0, 10);
    if (loc(x) && tap.has(d)) lay(khoa(x)).tt += +r.tan || 0;
  }
  return kq;
}
