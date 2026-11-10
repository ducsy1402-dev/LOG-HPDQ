// Quy tắc cập cầu bến (bảng 1 "Khoảng cách dự phòng đầu bến"), tính theo TUYẾN BẾN (đoạn cầu cảng thẳng, đo bằng mét):
//   d = khoảng cách giữa hai tàu liền nhau, theo chiều dài tàu LỚN HƠN trong hai tàu.
//   e = khoảng cách giữa tàu và điểm cuối đoạn thẳng của tuyến bến, theo chiều dài tàu ở đầu đó. e chỉ tính ở HAI ĐẦU TUYẾN;
//       ranh giới giữa hai bến trên cùng tuyến chỉ là mốc chia bến (giữa hai tàu kề nhau chỉ cần d).
//       Đầu tuyến là góc vuông (hình 2.b: đầu mét 0 của bến 4, đầu tây của bến 7) dùng hàng (b); đầu thẳng dùng hàng (e).
//   Tàu cập một bến phải nằm trọn trong bến đó; tàu cập hai bến liền nhau (bến phụ, VD 3/5, 7/8, HH2/3) nằm vắt qua ranh giới hai bến,
//   mỗi ranh giới chỉ một tàu vắt được. Tàu có vị trí mét (vi_tri = mét đầu tàu phía mét nhỏ) thì nằm đúng chỗ đó; chưa có thì web tự xếp.
// Tuyến bến, mốc mét từng bến lấy ở Danh mục › Cầu bến (cột Tuyến, Từ mét, Đến mét, Đầu góc vuông); chưa có thì theo bố trí mặc định dưới đây.
// Chiều dài tàu là LOA của chuyến.
import { doanBen } from "./linetime";
import { plain, ms, met } from "./format";
import { noiHaiBen } from "./tenBen";
import { VI_TRI_MAC_DINH } from "../data/danhMucGoc";
import { uocThongSo, CACH_TAU_TRUOC } from "./xepBen";

// Cột theo chiều dài tàu: >300 | 201–300 | 151–200 | 100–150 | <100
const cot = (L) => (L > 300 ? 0 : L > 200 ? 1 : L > 150 ? 2 : L >= 100 ? 3 : 4);
const D_TAU = [30, 25, 20, 15, 10];
// Tàu > 300 m ở đầu góc vuông: bảng ghi 45/40, lấy 45 (an toàn)
const E_BEN = { thang: [20, 15, 15, 10, 10], vuong_goc: [45, 30, 25, 20, 15] };
export const TEN_HINH = { thang: "đầu thẳng", vuong_goc: "đầu góc vuông" };
export const khoangCachD = (l1, l2) => D_TAU[cot(Math.max(l1, l2))];
export const khoangCachE = (l, hinh = "thang") => (E_BEN[hinh] || E_BEN.thang)[cot(l)];

// Số mét tối thiểu cho các tàu xếp liền trên một đoạn (e đầu + Σ tàu + Σ d + e cuối), thử mọi thứ tự
function tongMet(thuTu, hinh, hinh2 = hinh) {
  let t = khoangCachE(thuTu[0], hinh) + khoangCachE(thuTu[thuTu.length - 1], hinh2);
  thuTu.forEach((l, i) => { t += l; if (i) t += khoangCachD(thuTu[i - 1], l); });
  return t;
}
function* hoanVi(a, n = a.length) {
  if (n <= 1) { yield [...a]; return; }
  for (let i = 0; i < n; i++) { yield* hoanVi(a, n - 1); const j = n % 2 ? 0 : i; [a[n - 1], a[j]] = [a[j], a[n - 1]]; }
}
function nhoRaHaiDau(ds, L = (x) => x) {
  const asc = [...ds].sort((x, y) => L(x) - L(y)), trai = [], phai = [];
  asc.forEach((l, i) => (i % 2 ? phai : trai).push(l));
  return [...trai, ...phai.reverse()];
}
export function soMetCan(dsL, hinh = "thang", hinh2 = hinh) {
  const ds = dsL.map(Number).filter((x) => x > 0);
  if (!ds.length) return { can: 0, thuTu: [] };
  if (ds.length > 7) { const thuTu = nhoRaHaiDau(ds); return { can: tongMet(thuTu, hinh, hinh2), thuTu }; }
  let tot = null;
  for (const p of hoanVi([...ds])) { const t = tongMet(p, hinh, hinh2); if (!tot || t < tot.can) tot = { can: t, thuTu: [...p] }; }
  return tot;
}

// ---------- Tuyến bến ----------
// Bố trí mặc định (tuyến, mét từng bến, góc vuông): VI_TRI_MAC_DINH trong src/data/danhMucGoc.js
export { VI_TRI_MAC_DINH };
const gocCua = (x) => { const p = plain(x || ""); return p.startsWith("dau") ? "dau" : p.startsWith("cuoi") ? "cuoi" : null; };
// Vị trí một bến: { tuyen, tu, den, goc } — theo Danh mục (cột tuyen, met_tu, met_den, goc_vuong), không có thì mặc định, không có nữa thì bến là một tuyến riêng 0 → chiều dài bến
export function viTriBen(b) {
  if (!b) return null;
  const ma = String(b.ma);
  if (b.tuyen && Number.isFinite(+b.met_tu) && Number.isFinite(+b.met_den) && b.met_tu !== null && b.met_den !== null && +b.met_den > +b.met_tu)
    return { tuyen: String(b.tuyen), tu: +b.met_tu, den: +b.met_den, goc: gocCua(b.goc_vuong) };
  const m = VI_TRI_MAC_DINH[ma];
  if (m) return { tuyen: m[0], tu: m[1], den: m[2], goc: m[3] || null };
  return +b.loa_max > 0 ? { tuyen: ma, tu: 0, den: +b.loa_max, goc: null } : { tuyen: ma, tu: 0, den: null, goc: null };
}
// Các tuyến bến: Map tên tuyến -> { ma, bens: [{ ...bến, tu, den, goc }] xếp theo mét, tu, den, dau, cuoi (hình hai đầu tuyến) }
export function cacTuyen(berths = []) {
  const m = new Map();
  for (const b of berths) {
    const p = viTriBen(b);
    if (!p) continue;
    (m.get(p.tuyen) || m.set(p.tuyen, []).get(p.tuyen)).push({ ...b, ...p, ma: String(b.ma) });
  }
  const out = new Map();
  for (const [ma, ds] of m) {
    const bens = ds.sort((x, y) => (x.tu ?? 0) - (y.tu ?? 0));
    const dauB = bens[0], cuoiB = bens[bens.length - 1];
    out.set(ma, { ma, bens, tu: dauB.tu, den: cuoiB.den, dau: dauB.goc === "dau" ? "vuong_goc" : "thang", cuoi: cuoiB.goc === "cuoi" ? "vuong_goc" : "thang" });
  }
  return out;
}
export function tuyenCuaBen(berths, ma) { for (const t of cacTuyen(berths).values()) if (t.bens.some((b) => b.ma === String(ma))) return t; return null; }
// Tên tuyến để hiển thị: các bến nối bằng " – " (VD B03 – B05 – B10)
export const tenTuyen = (t, ten = (x) => x) => t.bens.map((b) => ten(b.ma)).join(" – ");
// Hai bến liền kề bến ma trên cùng tuyến (bến trước, bến sau): hai bến nối tiếp nhau (mét cuối bến này = mét đầu bến kia)
export function benLienKe(berths, ma) {
  const t = tuyenCuaBen(berths, ma);
  if (!t) return [];
  const i = t.bens.findIndex((b) => b.ma === String(ma)), b = t.bens[i];
  return [t.bens[i - 1], t.bens[i + 1]].filter((x) => x && (x.den === b.tu || x.tu === b.den));
}
export const laBenLienKe = (berths, a, b) => !!a && !!b && benLienKe(berths, a).some((x) => x.ma === String(b));
// Tàu dài L đặt ở mét x của tuyến chứa bến ma: chiếm những bến nào. Trả { ben_ma (bến chiếm nhiều nhất), ben_phu } hoặc null khi ra ngoài tuyến / chiếm hơn hai bến
export function benTheoViTri(berths, ma, x, L) {
  const t = tuyenCuaBen(berths, ma);
  if (!t || !(L > 0) || !Number.isFinite(x)) return null;
  const chiem = t.bens.map((b) => ({ ma: b.ma, m: Math.min(x + L, b.den) - Math.max(x, b.tu) })).filter((c) => c.m > 1e-6);
  if (x < t.tu - 1e-6 || x + L > t.den + 1e-6 || !chiem.length || chiem.length > 2) return null;
  if (chiem.length === 1) return { ben_ma: chiem[0].ma, ben_phu: null };
  const [a, b] = chiem.sort((p, q) => q.m - p.m);
  return { ben_ma: a.ma, ben_phu: b.ma };
}

// ---------- Xếp tàu trên một tuyến ----------
// tuyen: kết quả cacTuyen. tau: [{ L, k, vat, x }]: tàu ở bến thứ k của tuyến (vat: vắt qua ranh giới bến k | k+1), x = mét đầu tàu cố định (null: tự xếp).
// Thứ tự dọc tuyến: tàu bến 0, tàu vắt 0|1, tàu bến 1, … (thử mọi thứ tự tàu trong cùng bến); mỗi tàu tự xếp đặt sát nhất về đầu mét nhỏ.
// Trả { thieu, vua, can, dai, du, thieuM, viPham: { loai, i (tàu), L, ben }, x: [mét đầu từng tàu theo thứ tự đầu vào] }.
//   viPham.loai: dau_tuyen / cuoi_tuyen (thiếu e) · gan_tau (vị trí cố định gần tàu trước hơn d) · ngoai_ben (ra ngoài bến của tàu)
//                khong_vat (tàu hai bến không nằm qua ranh giới) · hai_vat (hai tàu cùng vắt một ranh giới)
export function xepTuyen(tuyen, tau) {
  const bens = tuyen.bens, m = bens.length;
  const dai = bens.every((b) => b.den != null) ? tuyen.den - tuyen.tu : null;
  if (dai == null || tau.some((t) => !(+t.L > 0))) return { thieu: true, dai };
  const ds = tau.map((t, i) => ({ ...t, L: +t.L, i, x: Number.isFinite(t.x) && t.x !== null ? +t.x : null }));
  const don = bens.map((_, k) => ds.filter((t) => !t.vat && t.k === k));
  const vat = bens.slice(1).map((_, k) => ds.filter((t) => t.vat && t.k === k));
  const hai = vat.findIndex((g) => g.length > 1);
  if (hai >= 0) return { thieu: false, vua: false, can: null, dai, du: null, thieuM: null, viPham: { loai: "hai_vat", ben: `${bens[hai].ma}/${bens[hai + 1].ma}`, i: vat[hai][1].i }, x: ds.map((t) => t.x) };
  let soToHop = 1;
  for (const g of don) for (let i = 2; i <= g.length; i++) soToHop *= i;
  const theoViTri = (g) => [...g].sort((p, q) => (p.x ?? Infinity) - (q.x ?? Infinity));
  const thuTuBen = don.map((g) => (soToHop > 5040 || g.length > 6 ? [g.some((t) => t.x != null) ? theoViTri(g) : nhoRaHaiDau(g, (t) => t.L)] : [...hoanVi([...g])]));
  let tot = null;
  const danhGia = (chon) => {
    const seq = [];
    chon.forEach((p, k) => { seq.push(...p); if (k < m - 1 && vat[k][0]) seq.push(vat[k][0]); });
    if (!seq.length) return;
    let truoc = null, xau = -Infinity, viPham = null;
    const xs = new Array(ds.length).fill(null);
    const bao = (vuot, loai, s, ben) => { if (vuot > xau) { xau = vuot; viPham = { loai, i: s.i, L: s.L, ben }; } };
    seq.forEach((s, j) => {
      const dauBen = bens[s.k].tu, cuoiBen = s.vat ? bens[s.k + 1].den : bens[s.k].den, ranh = s.vat ? bens[s.k].den : null;
      const tenBen = s.vat ? `${bens[s.k].ma}/${bens[s.k + 1].ma}` : bens[s.k].ma;
      const canTruoc = truoc ? truoc.cuoi + khoangCachD(truoc.L, s.L) : tuyen.tu + khoangCachE(s.L, tuyen.dau);
      let x;
      if (s.x != null) {
        x = s.x;
        bao(canTruoc - x, truoc ? "gan_tau" : "dau_tuyen", s, tenBen);
        bao(dauBen - x, "ngoai_ben", s, tenBen);
      } else x = Math.max(canTruoc, dauBen, ranh != null ? ranh - s.L : -Infinity);
      if (ranh != null) { bao(ranh - (x + s.L), "khong_vat", s, tenBen); bao(x - ranh, "khong_vat", s, tenBen); }
      bao(x + s.L - cuoiBen, "ngoai_ben", s, tenBen);
      if (j === seq.length - 1) bao(x + s.L - (tuyen.den - khoangCachE(s.L, tuyen.cuoi)), "cuoi_tuyen", s, bens[m - 1].ma);
      xs[s.i] = x;
      truoc = { cuoi: x + s.L, L: s.L };
    });
    const can = tongMet(seq.map((s) => s.L), tuyen.dau, tuyen.cuoi);
    if (!tot || xau < tot.xau - 1e-9 || (Math.abs(xau - tot.xau) <= 1e-9 && can < tot.can)) tot = { xau, viPham, can, x: xs };
  };
  const thu = (k, chon) => { if (k === m) { danhGia(chon); return; } for (const p of thuTuBen[k]) thu(k + 1, [...chon, p]); };
  thu(0, []);
  if (!tot) return { thieu: false, vua: true, can: 0, dai, du: dai, thieuM: 0, viPham: null, x: [] };
  const vua = tot.xau <= 1e-9;
  return { thieu: false, vua, can: tot.can, dai, du: dai - tot.can, thieuM: vua ? 0 : tot.xau, viPham: vua ? null : tot.viPham, x: tot.x };
}

// Chuẩn hóa một đoạn tàu chiếm bến về tàu trên tuyến: { L, k, vat, x } (phu chỉ tính khi liền kề bến chính)
function tauTrenTuyen(t, s) {
  const k0 = t.bens.findIndex((b) => b.ma === String(s.ben)), k1 = s.phu ? t.bens.findIndex((b) => b.ma === String(s.phu)) : k0;
  const vat = k1 >= 0 && k1 !== k0;
  return { L: +s.v.loa, k: vat ? Math.min(k0, k1) : k0, vat, x: Number.isFinite(+s.viTri) && s.viTri !== null && s.viTri !== "" ? +s.viTri : null };
}
const chuanHoa = (segs, berths) => segs.filter((s) => s.ben).map((s) => ({ ...s, ben: String(s.ben), phu: s.phu && laBenLienKe(berths, s.ben, s.phu) ? String(s.phu) : "" }));

// Mọi khoảng thời gian không đủ chỗ. segs: [{ v, a, b, ben, phu, viTri }]. Mỗi tuyến xét riêng, chia theo các mốc thời gian.
// Một tàu một mình: chỉ báo khi sai vị trí / thiếu e đầu tuyến (tàu dài hơn bến đã có cảnh báo LOA riêng).
export function phanTichCho(segs, berths = []) {
  const tuyens = cacTuyen(berths), tuyenCua = new Map();
  for (const t of tuyens.values()) for (const b of t.bens) tuyenCua.set(b.ma, t);
  const theoTuyen = new Map();
  for (const s of chuanHoa(segs, berths)) {
    const t = tuyenCua.get(s.ben) || { ma: `?${s.ben}`, bens: [{ ma: s.ben, tu: 0, den: null }], tu: 0, den: null, dau: "thang", cuoi: "thang" };
    (theoTuyen.get(t.ma) || theoTuyen.set(t.ma, { t, ds: [] }).get(t.ma)).ds.push(s);
  }
  const out = [];
  for (const { t, ds } of theoTuyen.values()) {
    const moc = [...new Set(ds.flatMap((s) => [s.a, s.b]))].sort((x, y) => x - y);
    const cuoi = new Map();
    for (let i = 0; i + 1 < moc.length; i++) {
      const a = moc[i], z = moc[i + 1];
      const co = ds.filter((s) => s.a < z && s.b > a);
      if (!co.length) continue;
      const tau = co.map((s) => tauTrenTuyen(t, s));
      const r = xepTuyen(t, tau);
      if (r.thieu ? co.length === 1 : r.vua) continue;
      if (co.length === 1 && !r.thieu) { // một tàu: bỏ qua khi chỉ là tàu dài hơn bến (đã có cảnh báo LOA)
        const x = tau[0], daiCho = x.vat ? t.bens[x.k + 1].den - t.bens[x.k].tu : t.bens[x.k].den - t.bens[x.k].tu;
        if (x.x == null && x.L > daiCho) continue;
      }
      const key = co.map((s) => s.v.id).sort().join(",");
      const cu = cuoi.get(key);
      if (cu && cu.b === a) { cu.b = z; continue; }
      const viTriTau = new Map(co.map((s) => [s.v.id, noiHaiBen(s.ben, s.phu, (x) => x)]));
      const item = { key, a, b: z, ds: co.map((s) => s.v), tuyen: t, ben: [...new Set(co.flatMap((s) => [s.ben, s.phu].filter(Boolean)))].join(", "), viTriTau,
        tauVP: r.viPham ? co[r.viPham.i]?.v : null, ...r };
      out.push(item); cuoi.set(key, item);
    }
  }
  return out;
}

const gio = (t) => { const d = new Date(t), p = (n) => String(n).padStart(2, "0"); return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`; };
// Câu nói chỗ vi phạm
export function noiViPham(t) {
  const vp = t.viPham;
  if (!vp) return "";
  const tau = t.tauVP ? `tàu ${t.tauVP.ten_tau}` : `tàu ${met(vp.L)} m`;
  return {
    hai_vat: `hai tàu cùng vắt qua ranh giới bến ${vp.ben}`,
    khong_vat: `${tau} (bến ${vp.ben}) không nằm qua ranh giới hai bến`,
    dau_tuyen: `${tau} thiếu khoảng cách đầu tuyến (e)`,
    cuoi_tuyen: `${tau} thiếu khoảng cách cuối tuyến (e), phía bến ${vp.ben}`,
    gan_tau: `${tau} quá gần tàu bên cạnh (thiếu khoảng cách d)`,
    ngoai_ben: `${tau} ra ngoài bến ${vp.ben}`,
  }[vp.loai] || "";
}
// Câu cảnh báo cho tàu v từ một khoảng không đủ chỗ
export function nhanCho(t, v) {
  const khac = t.ds.filter((x) => x.id !== v?.id && x.ten_tau !== v?.ten_tau).map((x) => x.ten_tau);
  const khung = `${gio(t.a)} → ${gio(t.b)}`;
  const ten = (x) => `${x.ten_tau} ${x.loa ? `${met(x.loa)} m` : "(chưa có LOA)"} (bến ${t.viTriTau?.get(x.id) || "?"})`;
  if (t.thieu) return `Trùng bến ${t.ben} với ${khac.join(", ")} (${khung}); chưa đủ LOA tàu / mét bến để tính số mét`;
  if (t.ds.length === 1) return `Bến ${t.ben}: ${noiViPham(t)}${t.thieuM ? `, thiếu ${met(t.thieuM)} m` : ""}`;
  return `Bến ${t.ben} cùng lúc ${t.ds.map(ten).join(" + ")} (${khung}): ${noiViPham(t)}${t.thieuM ? `, thiếu ${met(t.thieuM)} m` : ""}`;
}

const segsCuaChuyen = (v, stopsOf, now) => doanBen(v, stopsOf(v.id), now).filter((d) => d.ben).map((d) => ({ v, a: d.a, b: d.b, ben: d.ben, phu: d.phu, viTri: d.viTri, nguon: d.nguon, cuoi: d.cuoi, dau: d.dau }));

// ETB sớm nhất (ms) của chuyến v ở bến benMa từ thời điểm tu, ở lại dai (ms): chia sẻ bến theo số mét (hai tàu cùng bến cùng lúc nếu đủ chỗ theo quy tắc
// cập cầu bến, xem phanTichCho); không đủ chỗ thì chờ tàu trước rời + 2 giờ. Tàu chưa có LOA / bến chưa có mét coi như chiếm cả bến.
// Mỗi tàu được tính thêm 2 giờ sau khi rời (cách tàu cập sau). v.loa nên là LOA đã có hoặc ước.
export function etbSomNhatMet(v, benMa, tu, dai, { voyages = [], berths = [], stopsOf = () => [], now = Date.now(), cach = CACH_TAU_TRUOC } = {}) {
  const khac = voyages.filter((o) => !o.huy && !o.atd && o.id !== v.id).flatMap((o) => segsCuaChuyen(o, stopsOf, now)).map((s) => ({ ...s, b: s.b + cach }));
  const moc = [...new Set([tu, ...khac.map((s) => s.b).filter((t) => t > tu)])].sort((x, y) => x - y);
  for (const t of moc) {
    const ung = { v, a: t, b: t + dai + cach, ben: benMa, phu: v.ben_phu || "", viTri: v.vi_tri };
    if (!phanTichCho([...khac, ung], berths).some((x) => x.ds.includes(v))) return t;
  }
  return moc[moc.length - 1] ?? tu;
}

// Mọi chuyến không đủ chỗ ở bến: Map id chuyến -> [{ ...khoảng không đủ chỗ, cung: [tên tàu khác], ten_tau }]
export function choBenTheoChuyen(voyages, berths = [], stopsOf = () => [], now = Date.now()) {
  const segs = voyages.filter((v) => !v.huy).flatMap((v) => segsCuaChuyen(v, stopsOf, now));
  const m = new Map();
  for (const t of phanTichCho(segs, berths)) {
    for (const v of t.ds) {
      const khac = t.ds.filter((x) => x.id !== v.id), cung = khac.map((x) => x.ten_tau);
      (m.get(v.id) || m.set(v.id, []).get(v.id)).push({ ...t, cung, id: khac[0]?.id, ten_tau: cung.join(", ") });
    }
  }
  return m;
}

// Thử xếp chuyến v vào bến benMa (bến phụ v.ben_phu, vị trí v.vi_tri) trong [a, b] (ms) với các chuyến khác: các khoảng không đủ chỗ có liên quan tới v
export function kiemTraXepBen(v, benMa, a, b, { voyages = [], berths = [], stopsOf = () => [], now = Date.now() } = {}) {
  if (!benMa || !(a < b)) return [];
  const segs = [{ v, a, b, ben: benMa, phu: v.ben_phu || "", viTri: v.vi_tri }];
  for (const o of voyages) if (!o.huy && o.id !== v.id) segs.push(...segsCuaChuyen(o, stopsOf, now));
  return phanTichCho(segs, berths).filter((t) => t.ds.some((x) => x === v));
}

// Sơ đồ cầu bến tại thời điểm t (ms): mỗi tuyến một dòng, tàu đang cập kèm mét đầu (cố định hoặc web tự xếp), số mét cần, còn trống,
// tàu thêm vào dài tối đa ở từng bến. Dòng: { tuyen, tau: [{ v, seg, L, x, coDinh, ben, phu }], ...kết quả xepTuyen, themTheoBen }
export function soDoCauBen(voyages, berths = [], stopsOf = () => [], t = Date.now(), now = Date.now()) {
  const dang = chuanHoa(voyages.filter((v) => !v.huy).flatMap((v) => segsCuaChuyen(v, stopsOf, now)).filter((s) => s.a <= t && t < s.b), berths);
  const out = [];
  for (const tuyen of cacTuyen(berths).values()) {
    const mas = new Set(tuyen.bens.map((b) => b.ma));
    const ds = dang.filter((s) => mas.has(s.ben));
    const xep = ds.map((s) => tauTrenTuyen(tuyen, s));
    const r = xepTuyen(tuyen, xep);
    const themTheoBen = r.thieu ? null : tuyen.bens.map((b, k) => ({ ma: b.ma, them: timDaiNhat(b.den - b.tu, (l) => xepTuyen(tuyen, [...xep, { L: l, k, vat: false, x: null }]).vua) }));
    out.push({ tuyen, ...r, themTheoBen, tau: ds.map((s, i) => ({ v: s.v, seg: s, L: +s.v.loa || 0, x: r.x?.[i] ?? null, coDinh: xep[i].x != null, ben: s.ben, phu: s.phu })) });
  }
  return out;
}
function timDaiNhat(dai, vua) {
  if (!(dai > 0)) return null;
  if (!vua(1)) return 0;
  let lo = 1, hi = Math.floor(dai);
  while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (vua(mid)) lo = mid; else hi = mid - 1; }
  return lo;
}

// Lịch cầu bến theo mét: mỗi đoạn tàu chiếm bến trong [tu, den) (ms) kèm tuyến và mét đầu tàu.
// Đoạn đã ghi vị trí thì giữ; chưa ghi thì lấy chỗ web tự xếp lúc tàu vào bến (đầu đoạn), cùng các tàu đang ở tuyến lúc đó.
// Trả [{ v, seg, tuyen, L, x, coDinh }] (đoạn không thuộc tuyến nào có mét thì bỏ). Tàu chưa có LOA (VD tàu TBA): LOA ước theo DWT / khối lượng / mớn
// (không có gì thì 150 m), v._loaUoc = true để vẽ khác.
export function viTriTrenLich(voyages0, berths = [], stopsOf = () => [], tu = -Infinity, den = Infinity, now = Date.now()) {
  const voyages = voyages0.map((v) => (+v.loa > 0 ? v : { ...v, loa: uocThongSo(v).loa || 150, _loaUoc: true }));
  const tuyens = cacTuyen(berths), tuyenCua = new Map();
  for (const t of tuyens.values()) if (t.den != null) for (const b of t.bens) tuyenCua.set(b.ma, t);
  const segs = chuanHoa(voyages.filter((v) => !v.huy).flatMap((v) => segsCuaChuyen(v, stopsOf, now)), berths).filter((s) => tuyenCua.has(s.ben) && +s.v.loa > 0);
  const out = [];
  for (const s of segs) {
    if (s.b < tu || s.a > den) continue;
    const t = tuyenCua.get(s.ben), me = tauTrenTuyen(t, s);
    let x = me.x;
    if (x == null) {
      const luc = s.a, co = segs.filter((o) => o !== s && tuyenCua.get(o.ben) === t && o.a <= luc && luc < o.b);
      x = xepTuyen(t, [me, ...co.map((o) => tauTrenTuyen(t, o))]).x?.[0] ?? null;
    }
    if (x != null) out.push({ v: s.v, seg: s, tuyen: t, L: +s.v.loa, x, coDinh: me.x != null });
  }
  return out;
}
