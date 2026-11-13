// Số liệu theo kỳ cho khối biểu đồ kho ở Tổng quan: kế hoạch – lũy kế nhập / xuất / tồn của từng loại kho, và tồn phân loại (cần giải phóng / đầu cơ / lưu động).
// Dùng chung chuẩn kỳ với bieuDoSanLuong.js (kyInfo = khoangKy(...)). Giao dịch kho truyền vào phải phủ từ ngày đầu kỳ đến hôm nay.
import { tonTheoNgay, khuCuaKeHoach, nhomCua } from "./kho";
import { plain } from "./format";
import { ngayCuaKeHoach } from "./keHoachKy";
import { khoaDiem, nhanDiem } from "./bieuDoSanLuong";

const DAY_MS = 864e5;
const tuNgay = (s) => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); };
const soNgayGiua = (a, b) => Math.round((tuNgay(b) - tuNgay(a)) / DAY_MS);
const lui = (s, n) => new Date(tuNgay(s) - n * DAY_MS).toISOString().slice(0, 10);

// (bãi, hàng) -> loại kho của bãi nhỏ nhận hàng đó
const loaiCua = (kho) => { const m = new Map(kho.dong.map((d) => [d.key, d.loai])); return (b, h) => m.get(kho.gan(b, h)) || null; };

// Tồn cuối mỗi ngày từ ngày đầu kỳ − 1 đến hôm nay (Map ngày -> tấn), đi lùi từ tồn hiện tại theo sổ
function tonCacNgay(kyInfo, tonHT, giaoDich, loc, now) {
  const { ngays, homNay } = kyInfo, dau = lui(ngays[0], 1);
  const n = Math.max(1, soNgayGiua(dau, homNay) + 1);
  return new Map(tonTheoNgay(tonHT, giaoDich, loc, n, now).map(([t, v]) => [fmt(t), v]));
}
const fmt = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

// Nhóm hàng (loại hàng) để lọc biểu đồ kho: theo cột Nhóm của Danh mục › Hàng hóa
export const nhomHangKho = (hang, kho) => nhomCua(hang, kho.hangHoa || []) || "";
// Các nhóm hàng đang có tồn hoặc có kế hoạch trong một loại kho
export function dsNhomKho(kho, loai, keHoach = []) {
  const dongOk = kho.dong.filter((d) => !d.saiBai), s = new Set();
  for (const c of kho.cap) if (c.loai === loai && Math.abs(c.ton) > 1e-6) s.add(nhomHangKho(c.hang, kho));
  for (const r of keHoach) { const d = khuCuaKeHoach(r, dongOk); if (d?.loai === loai) s.add(r.nhom || nhomHangKho(r.hang || d.hang, kho)); }
  return [...s].filter(Boolean).sort((a, b) => a.localeCompare(b, "vi"));
}

// Một loại kho (thanh_pham | nguyen_lieu): từng điểm của kỳ có nhập / xuất thực tế và kế hoạch, lũy kế, tồn thực tế và tồn kế hoạch.
// nhom: chỉ lấy hàng thuộc nhóm hàng này ("" = mọi hàng)
export function chuoiKho(kyInfo, { kho, loai, nhom = "", keHoach = [], giaoDich = [], now }) {
  const { ngays, buoc, homNay } = kyInfo, tap = new Set(ngays), loaiOf = loaiCua(kho);
  const khop = (hang) => !nhom || plain(nhomHangKho(hang, kho)) === plain(nhom);
  const dongOk = kho.dong.filter((d) => !d.saiBai);
  const nhapTT = new Map(), xuatTT = new Map(), nhapKH = new Map(), xuatKH = new Map();
  const cong = (m, k, v) => m.set(k, (m.get(k) || 0) + v);
  for (const g of giaoDich) {
    const n = String(g.ngay).slice(0, 10);
    if (!tap.has(n) || (g.loai !== "nhap" && g.loai !== "xuat") || loaiOf(g.ten_bai, g.hang) !== loai || !khop(g.hang)) continue;
    cong(g.loai === "nhap" ? nhapTT : xuatTT, n, +g.so_luong || 0);
  }
  for (const r of keHoach) {
    const d = khuCuaKeHoach(r, dongOk);
    if (!d || d.loai !== loai) continue;
    if (nhom && plain(r.nhom || nhomHangKho(r.hang || d.hang, kho)) !== plain(nhom)) continue;
    const nd = ngayCuaKeHoach(r), moi = (+r.khoi_luong || 0) / nd.length; // kế hoạch ngày / tuần / tháng / năm chia đều theo ngày của kỳ
    for (const n of nd) if (tap.has(n)) cong(r.huong === "xuat" ? xuatKH : nhapKH, n, moi);
  }
  const tonHT = nhom ? kho.cap.filter((c) => c.loai === loai && khop(c.hang)).reduce((s, c) => s + c.ton, 0) : kho.dong.filter((d) => d.loai === loai).reduce((s, d) => s + d.ton, 0);
  const ton = tonCacNgay(kyInfo, tonHT, giaoDich, (b, h) => loaiOf(b, h) === loai && khop(h), now);
  const tonDau = ton.get(lui(ngays[0], 1)) ?? tonHT;
  const diem = new Map(), ds = [];
  for (const n of ngays) {
    const k = khoaDiem(buoc, n);
    if (!diem.has(k)) { const o = { nhan: nhanDiem(buoc, n), dau: n, nhapTT: 0, xuatTT: 0, nhapKH: 0, xuatKH: 0, tonCuoi: null }; diem.set(k, o); ds.push(o); }
    const o = diem.get(k);
    o.nhapTT += nhapTT.get(n) || 0; o.xuatTT += xuatTT.get(n) || 0; o.nhapKH += nhapKH.get(n) || 0; o.xuatKH += xuatKH.get(n) || 0;
    if (n <= homNay && ton.has(n)) o.tonCuoi = ton.get(n);
  }
  let a = 0, b = 0, c = 0, d2 = 0;
  for (const o of ds) {
    a += o.nhapTT; b += o.xuatTT; c += o.nhapKH; d2 += o.xuatKH;
    o.lkNhapTT = o.dau <= homNay ? a : null; o.lkXuatTT = o.dau <= homNay ? b : null; o.lkNhapKH = c; o.lkXuatKH = d2; o.tonKH = tonDau + c - d2;
  }
  return { diem: ds, tonDau, tonHT, tongNhapTT: a, tongXuatTT: b, tongNhapKH: c, tongXuatKH: d2, coKeHoach: c + d2 > 0 };
}

// Tồn phân loại theo điểm của kỳ. declarations: dòng kho_ton_phan_loai { ngay, ten_bai, hang, loai, tan, id }.
// Lần khai báo mới nhất (ngày ≤ ngày xem) của cùng bãi + hàng + loại là số có hiệu lực. Lưu động = tồn kho − cần giải phóng − đầu cơ.
export function chuoiPhanLoai(kyInfo, { kho, declarations = [], giaoDich = [], now }) {
  const { ngays, buoc, homNay } = kyInfo;
  const tonHT = kho.dong.reduce((s, d) => s + d.ton, 0);
  const tong = tonCacNgay(kyInfo, tonHT, giaoDich, () => true, now);
  const ds = [...declarations].sort((x, y) => String(x.ngay).localeCompare(String(y.ngay)) || x.id - y.id);
  const hieuLuc = { can_giai_phong: new Map(), dau_co: new Map() }, tongLoai = { can_giai_phong: 0, dau_co: 0 };
  let i = 0;
  const ap = (den) => {
    for (; i < ds.length && String(ds[i].ngay).slice(0, 10) <= den; i++) {
      const r = ds[i], m = hieuLuc[r.loai]; if (!m) continue;
      const k = `${r.ten_bai}|${r.hang}`; tongLoai[r.loai] += (+r.tan || 0) - (m.get(k) || 0); m.set(k, +r.tan || 0);
    }
  };
  ap(lui(ngays[0], 1)); // khai báo trước kỳ
  const diem = new Map(), out = [];
  for (const n of ngays) {
    const k = khoaDiem(buoc, n);
    if (!diem.has(k)) { const o = { nhan: nhanDiem(buoc, n), dau: n, tong: null, cgp: null, dc: null, ld: null }; diem.set(k, o); out.push(o); }
    if (n > homNay) continue;
    ap(n);
    const t = Math.max(0, tong.get(n) ?? tonHT), cgp = Math.min(t, tongLoai.can_giai_phong), dc = Math.min(t - cgp, tongLoai.dau_co), o = diem.get(k);
    o.tong = t; o.cgp = cgp; o.dc = dc; o.ld = t - cgp - dc;
  }
  const cuoi = [...out].reverse().find((o) => o.tong != null) || null;
  const suc = kho.bai.reduce((s, b) => s + (b.sucChua || 0), 0);
  return { diem: out, hien: cuoi, sucChua: suc, coKhaiBao: ds.length > 0 };
}

// ---------- Tuổi tồn và hàng cần xử lý (Tổng quan › khối kho) ----------
export const NHOM_TUOI = [[0, 30, "0–30 ngày"], [31, 60, "31–60 ngày"], [61, 90, "61–90 ngày"], [91, Infinity, "Trên 90 ngày"]];
export const nhomTuoi = (t) => NHOM_TUOI.findIndex(([a, b]) => t >= a && t <= b);

// Tuổi tồn của từng dòng tồn (bãi + hàng + lô): lô thành phẩm tính từ ngày nhập lô; còn lại tính số ngày từ lần xuất gần nhất của bãi + hàng
// (chưa xuất lần nào thì từ ngày có tồn đầu tiên). giaoDich nên phủ ít nhất 120 ngày gần nhất.
export function tuoiTon({ kho, khoTon = [], giaoDich = [], now }) {
  const loaiOf = loaiCua(kho), homNay = fmt(now), k = (b, h) => `${b}|${h}`;
  const xuatCuoi = new Map();
  for (const g of giaoDich) if (g.loai === "xuat") { const n = String(g.ngay).slice(0, 10), kk = k(g.ten_bai, g.hang); if (!xuatCuoi.has(kk) || xuatCuoi.get(kk) < n) xuatCuoi.set(kk, n); }
  const lo = new Map(kho.lo.map((l) => [`${l.so_lo}|${l.ten_bai}`, l]));
  const out = [];
  for (const t of khoTon) {
    const ton = +t.ton; if (!(ton > 1e-6)) continue;
    const loai = loaiOf(t.ten_bai, t.hang); if (!loai) continue; // hàng sai bãi: bỏ qua
    const l = t.so_lo ? lo.get(`${t.so_lo}|${t.ten_bai}`) : null;
    const moc = l?.ngay_nhap ? String(l.ngay_nhap).slice(0, 10) : xuatCuoi.get(k(t.ten_bai, t.hang)) || String(t.ngay_dau || homNay).slice(0, 10);
    out.push({ ten_bai: t.ten_bai, hang: t.hang, so_lo: t.so_lo || "", loai, ton, tuoi: Math.max(0, soNgayGiua(moc, homNay)) });
  }
  return out;
}

// Tồn theo nhóm tuổi của từng loại kho: { thanh_pham: [tấn × 4 nhóm], nguyen_lieu: [...] }
export function tonTheoTuoi(ds) {
  const kq = { thanh_pham: NHOM_TUOI.map(() => 0), nguyen_lieu: NHOM_TUOI.map(() => 0) };
  for (const r of ds) if (kq[r.loai]) kq[r.loai][nhomTuoi(r.tuoi)] += r.ton;
  return kq;
}

// Top hàng cần xử lý: phần tồn đã khai báo cần giải phóng / đầu cơ (đang hiệu lực) và hàng gợi ý (tồn lâu hơn nguongNgay mà chưa phân loại).
export function hangCanXuLy({ tuoi, declarations = [], homNay, nguongNgay = 60, top = 10 }) {
  const k = (b, h) => `${b}|${h}`, cap = new Map();
  for (const r of tuoi) { const o = cap.get(k(r.ten_bai, r.hang)) || { ten_bai: r.ten_bai, hang: r.hang, loai: r.loai, ton: 0, tuoi: 0 }; o.ton += r.ton; o.tuoi = Math.max(o.tuoi, r.tuoi); cap.set(k(r.ten_bai, r.hang), o); }
  const hieuLuc = new Map();
  for (const r of [...declarations].sort((a, b) => String(a.ngay).localeCompare(String(b.ngay)) || a.id - b.id)) if (String(r.ngay).slice(0, 10) <= homNay) hieuLuc.set(`${k(r.ten_bai, r.hang)}|${r.loai}`, r);
  const out = [], daPL = new Set();
  for (const r of hieuLuc.values()) {
    const c = cap.get(k(r.ten_bai, r.hang)); daPL.add(k(r.ten_bai, r.hang));
    const tan = Math.min(+r.tan || 0, c?.ton ?? 0); if (!(tan > 0)) continue;
    out.push({ ten_bai: r.ten_bai, hang: r.hang, kieu: r.loai, tan, tuoi: c.tuoi, tu: String(r.ngay).slice(0, 10) });
  }
  for (const [kk, c] of cap) if (!daPL.has(kk) && c.tuoi > nguongNgay && c.ton > 0) out.push({ ten_bai: c.ten_bai, hang: c.hang, kieu: "goi_y", tan: c.ton, tuoi: c.tuoi });
  return out.sort((a, b) => b.tan - a.tan).slice(0, top);
}
