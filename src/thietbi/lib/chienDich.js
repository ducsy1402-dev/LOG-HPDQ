// Chiến dịch vận chuyển: tính năng suất, số xe, số điểm xếp / dỡ, giãn cách chạy xe và mô phỏng từng chuyến.
// Công thức gốc theo file "File tính toán tham khảo.xlsx" của anh Sỹ (4 trường hợp ưu tiên), đơn vị thời gian là GIỜ:
//   vòng xe T = chạy đi + chạy về + thời gian phụ + xếp + dỡ
//   số chuyến / giờ của tuyến R:  ưu tiên dỡ  R = điểm dỡ ÷ TG dỡ   · ưu tiên xếp R = điểm xếp ÷ TG xếp
//                                 ưu tiên xe  R = số xe ÷ T        · ưu tiên thời gian R = khối lượng ÷ tải ÷ số giờ
//   số xe = R × T · điểm xếp = R × TG xếp · điểm dỡ = R × TG dỡ · năng suất = R × tải 1 chuyến (t/giờ)
// Phát triển thêm: TG xếp = tải ÷ năng suất 1 điểm xếp (t/giờ); TG chạy = quãng đường ÷ tốc độ (có hàng / không tải);
// làm tròn số xe / số điểm rồi tính lại năng suất thật theo NÚT THẮT; giãn cách tuyến = 60 ÷ R phút;
// số xe vun ở điểm dỡ = năng suất ÷ năng suất 1 xe vun; mô phỏng từng chuyến theo ca và giờ nghỉ (cùng lúc / luân phiên).

const H = 3600e3, NGAY = 864e5;

export const UU_TIEN = [
  ["do", "Năng suất dỡ", "Giữ số điểm dỡ, tính số xe và số điểm xếp vừa đủ để điểm dỡ không lúc nào trống"],
  ["xep", "Năng suất xếp", "Giữ số điểm xếp, tính số xe và số điểm dỡ vừa đủ để điểm xếp không lúc nào trống"],
  ["xe", "Số xe vận chuyển", "Giữ số xe, tính số điểm xếp / dỡ vừa đủ cho số xe đó"],
  ["tg", "Thời gian hoàn thành", "Giữ thời hạn, tính năng suất cần đạt rồi ra số xe, số điểm"],
];
export const TEN_UU_TIEN = Object.fromEntries(UU_TIEN.map(([k, l]) => [k, l]));
export const LOAI_XEP = ["Xe xúc", "Băng tải", "Cẩu bốc", "Khác"];
export const LOAI_VUN = ["Xe xúc lật", "Xe ủi", "Xe xúc đào", "Khác"];
export const TRANG_THAI_CD = [["ke_hoach", "Kế hoạch"], ["dang_chay", "Đang chạy"], ["xong", "Hoàn thành"], ["huy", "Hủy"]];
export const DON_VI_HAN = [["gio", "giờ làm"], ["ca", "ca"], ["ngay", "ngày"]];
export const TEN_NUT_THAT = { xe: "số xe vận chuyển", xep: "điểm xếp", do: "điểm dỡ" };

let dem = 0;
export const maMoi = () => Date.now().toString(36) + (dem++).toString(36) + Math.random().toString(36).slice(2, 5);

export const nghiMoi = (them = {}) => ({ id: maMoi(), ten: "Nghỉ ăn ca", sau: 4, phut: 60, kieu: "cung", nhom: 2, ...them });
// Ca theo quy ước công ty: CA 1 08h–20h, CA 2 20h–08h; nghỉ 1 giờ sau 4 giờ đầu ca → 11 giờ làm định mức như file Excel
export const caMacDinh = () => ({ gio_bd: "08:00", so_ca: 2, do_dai: 12, nghi: [nghiMoi()] });

export function tuyenMoi(i = 1, them = {}) {
  return {
    id: maMoi(), ten: `Tuyến ${i}`, hang: "", diem_xep: "", diem_do: "",
    khoi_luong: 5000, tai_chuyen: 27,
    quang_duong: 4, toc_do_co_hang: 20, toc_do_khong_tai: 20, tg_phu: 0,
    loai_xep: "Xe xúc", ns_xep: 202.5, tg_do: 10,
    loai_vun: "Xe xúc lật", ns_vun: 400,
    uu_tien: "do", so_diem_do: 2, so_diem_xep: 2, so_xe: 10, thoi_han: 11, don_vi_han: "gio",
    chon: { so_xe: null, so_diem_xep: null, so_diem_do: null },
    bat_dau: null, ghi_chu: "",
    ...them,
  };
}

export function chienDichMoi(now = new Date()) {
  const bd = new Date(now); bd.setDate(bd.getDate() + 1); bd.setHours(8, 0, 0, 0);
  return { id: null, ten: "Chiến dịch mới", bat_dau: bd.toISOString(), trang_thai: "ke_hoach", ghi_chu: "", cau_hinh: caMacDinh(), tuyen: [tuyenMoi(1)] };
}

const so = (v) => (v === "" || v == null ? NaN : +v);
const duong = (v) => Number.isFinite(so(v)) && so(v) > 0;

// Giờ làm định mức của 1 ca = độ dài ca − tổng giờ nghỉ (mỗi xe đều nghỉ đủ, kể cả nghỉ luân phiên)
export const gioLamCa = (ca) => Math.max(0, (+ca?.do_dai || 0) - (ca?.nghi || []).reduce((a, b) => a + (+b.phut || 0), 0) / 60);
export const soCaNgay = (ca) => Math.max(1, Math.min(Math.floor(24 / Math.max(0.5, +ca?.do_dai || 12)) || 1, Math.round(+ca?.so_ca || 1)));

// Kiểm tra cấu hình ca: trả danh sách lỗi
export function loiCa(ca) {
  const e = [];
  if (!/^\d{1,2}:\d{2}$/.test(String(ca?.gio_bd || ""))) e.push("Giờ bắt đầu ca phải dạng 08:00");
  if (!duong(ca?.do_dai) || +ca.do_dai > 24) e.push("Độ dài ca phải từ 0,5 đến 24 giờ");
  if ((+ca?.so_ca || 0) * (+ca?.do_dai || 0) > 24) e.push("Số ca × độ dài ca vượt 24 giờ một ngày");
  for (const b of ca?.nghi || []) {
    const cuoi = (+b.sau || 0) + ((+b.phut || 0) / 60) * (b.kieu === "luan" ? Math.max(1, +b.nhom || 1) : 1);
    if ((+b.sau || 0) < 0 || cuoi > (+ca.do_dai || 0) + 1e-9) e.push(`"${b.ten || "Giờ nghỉ"}" nằm ngoài ca`);
  }
  if (gioLamCa(ca) <= 0) e.push("Giờ nghỉ chiếm hết ca");
  return e;
}

export function thoiHanGio(t, ca) {
  const v = so(t.thoi_han), N = gioLamCa(ca);
  return t.don_vi_han === "ca" ? v * N : t.don_vi_han === "ngay" ? v * N * soCaNgay(ca) : v;
}

// Tính theo lý thuyết (số lẻ, đúng như file Excel)
export function tinhLyThuyet(t, ca) {
  const loi = [];
  if (!duong(t.khoi_luong)) loi.push("Chưa nhập khối lượng cần vận chuyển");
  if (!duong(t.tai_chuyen)) loi.push("Chưa nhập tải 1 chuyến");
  if (!duong(t.ns_xep)) loi.push("Chưa nhập năng suất 1 điểm xếp (t/giờ)");
  if (!duong(t.tg_do)) loi.push("Chưa nhập thời gian dỡ 1 xe");
  const d = so(t.quang_duong) || 0;
  if (d < 0) loi.push("Quãng đường không hợp lệ");
  if (d > 0 && (!duong(t.toc_do_co_hang) || !duong(t.toc_do_khong_tai))) loi.push("Chưa nhập tốc độ chạy có hàng / không tải");
  const u = t.uu_tien;
  if (u === "do" && !duong(t.so_diem_do)) loi.push("Ưu tiên năng suất dỡ: cần số điểm dỡ");
  if (u === "xep" && !duong(t.so_diem_xep)) loi.push("Ưu tiên năng suất xếp: cần số điểm xếp");
  if (u === "xe" && !duong(t.so_xe)) loi.push("Ưu tiên số xe: cần số xe");
  if (u === "tg" && !(thoiHanGio(t, ca) > 0)) loi.push("Ưu tiên thời gian: cần thời hạn hoàn thành");
  if (loi.length) return { loi };
  const tDi = d > 0 ? d / so(t.toc_do_co_hang) : 0, tVe = d > 0 ? d / so(t.toc_do_khong_tai) : 0;
  const tPhu = (so(t.tg_phu) || 0) / 60, tXep = so(t.tai_chuyen) / so(t.ns_xep), tDo = so(t.tg_do) / 60;
  const tChay = tDi + tVe, T = tChay + tPhu + tXep + tDo;
  const R = u === "do" ? so(t.so_diem_do) / tDo
    : u === "xep" ? so(t.so_diem_xep) / tXep
      : u === "xe" ? so(t.so_xe) / T
        : so(t.khoi_luong) / so(t.tai_chuyen) / thoiHanGio(t, ca);
  return {
    loi: null, tDi, tVe, tChay, tPhu, tXep, tDo, T, R,
    A: R * T, Cx: R * tXep, Cd: R * tDo, ns: R * so(t.tai_chuyen),
    tanSuat: 1 / T, // vòng / giờ của 1 xe
  };
}

// Đánh giá một bộ số nguyên (số xe A, điểm xếp Cx, điểm dỡ Cd): năng suất thật theo nút thắt, giãn cách, mức sử dụng, thời gian
export function danhGia(ly, A, Cx, Cd, t, ca) {
  const { T, tXep, tDo } = ly;
  const rXe = A / T, rXep = Cx / tXep, rDo = Cd / tDo;
  const R = Math.min(rXe, rXep, rDo);
  const nutThat = R === rXe ? "xe" : R === rDo ? "do" : "xep";
  const tai = so(t.tai_chuyen), KL = so(t.khoi_luong), N = gioLamCa(ca), nCa = soCaNgay(ca);
  const ns = R * tai, gio = KL / ns;
  return {
    A, Cx, Cd, R, ns, nutThat, rXe, rXep, rDo,
    vong: A / R,                 // vòng xe thực tế (kể cả chờ)
    cho: Math.max(0, A / R - T), // giờ chờ mỗi vòng của 1 xe
    gianCach: 60 / R,            // phút giữa 2 xe liên tiếp trên tuyến
    gcXep: (Cx / R) * 60,        // phút giữa 2 xe tại cùng một điểm xếp
    gcDo: (Cd / R) * 60,         // phút giữa 2 xe tại cùng một điểm dỡ
    suDung: { xe: (R * T) / A, xep: (R * tXep) / Cx, do: (R * tDo) / Cd },
    soXeVun: duong(t.ns_vun) ? Math.max(1, Math.ceil(ns / so(t.ns_vun) - 1e-6)) : null,
    nsCa: ns * N, nsNgay: ns * N * nCa,
    gio, soCa: gio / N, soNgay: gio / (N * nCa),
    soChuyen: Math.ceil(KL / tai - 1e-9),
    chuyenXeCa: (N / (A / R)),   // số chuyến 1 xe / ca
  };
}

const lam = (x) => Math.max(1, Math.ceil(x - 1e-6));
const nguyen = (v) => (duong(v) ? Math.round(so(v)) : null);

// Phương án áp dụng: số nguyên (tự làm tròn lên, hoặc người lập sửa tay ở t.chon), đánh giá lại
export function phuongAn(t, ca) {
  const ly = tinhLyThuyet(t, ca);
  if (ly.loi) return { loi: ly.loi };
  const u = t.uu_tien, c = t.chon || {};
  const tu = {
    A: u === "xe" ? nguyen(t.so_xe) : lam(ly.A),
    Cx: u === "xep" ? nguyen(t.so_diem_xep) : lam(ly.Cx),
    Cd: u === "do" ? nguyen(t.so_diem_do) : lam(ly.Cd),
  };
  const A = nguyen(c.so_xe) ?? tu.A, Cx = nguyen(c.so_diem_xep) ?? tu.Cx, Cd = nguyen(c.so_diem_do) ?? tu.Cd;
  const kq = { ...danhGia(ly, A, Cx, Cd, t, ca), ly, tuDong: tu, loi: null };
  if (u === "tg") { kq.hanGio = thoiHanGio(t, ca); kq.datHan = kq.gio <= kq.hanGio + 1e-6; }
  return kq;
}

// Thử số xe quanh phương án (giữ số điểm): thấy thêm / bớt xe được gì
export function thuSoXe(t, ca, pa, tam = 3) {
  if (!pa || pa.loi) return [];
  const out = [];
  for (let A = Math.max(1, pa.A - tam); A <= pa.A + tam; A++) out.push(danhGia(pa.ly, A, pa.Cx, pa.Cd, t, ca));
  return out;
}

// So sánh 4 trường hợp ưu tiên trên cùng bộ số liệu (mỗi trường hợp tự làm tròn)
export const soSanh = (t, ca) => UU_TIEN.map(([u]) => ({ u, pa: phuongAn({ ...t, uu_tien: u, chon: null }, ca) }));

// ---------- Lịch ca và giờ nghỉ ----------
const nuaDem = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return +d; };
const isoNgay = (ms) => { const d = new Date(ms), p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

export function taoLich(ca) {
  const L = Math.max(0.5, +ca?.do_dai || 12) * H, n = soCaNgay(ca);
  const [hh, mm] = String(ca?.gio_bd || "08:00").split(":").map((x) => +x || 0);
  const nghi = (ca?.nghi || []).filter((b) => +b.phut > 0);
  const cacheNgay = new Map();
  const caNgay = (d) => {
    if (!cacheNgay.has(d)) {
      const goc = new Date(d); goc.setHours(hh, mm, 0, 0);
      cacheNgay.set(d, Array.from({ length: n }, (_, k) => ({ s: +goc + k * L, e: +goc + (k + 1) * L, so: k + 1, ngay: isoNgay(d), key: `${isoNgay(d)}|${k + 1}` })));
    }
    return cacheNgay.get(d);
  };
  const ngayKe = (d, k) => { const x = new Date(d); x.setDate(x.getDate() + k); return +x; };
  // Ca chứa t, hoặc ca kế tiếp sau t (khi t rơi vào giờ không làm)
  const cuaSo = (t) => {
    const d0 = nuaDem(t);
    for (let i = -1; i < 3; i++) for (const w of caNgay(ngayKe(d0, i))) if (w.e > t) return w;
    return null;
  };
  const caCua = (t) => {
    const d0 = nuaDem(t);
    for (let i = -1; i <= 0; i++) for (const w of caNgay(ngayKe(d0, i))) if (w.s <= t && t < w.e) return w;
    return null;
  };
  // Các khoảng nghỉ của xe thứ i trong ca w (nghỉ luân phiên: xe chia nhóm, nhóm g nghỉ sau nhóm g−1)
  // i < 0: chỉ giờ nghỉ cùng lúc (điểm xếp / dỡ và xe đang chạy); nghỉ luân phiên do mô phỏng xử lý giữa hai chuyến
  const khoangNghi = (w, i) => nghi.filter((b) => i >= 0 || b.kieu !== "luan").map((b) => {
    const dur = (+b.phut || 0) * 60000, g = b.kieu === "luan" ? (i % Math.max(1, +b.nhom || 1)) : 0;
    const s = w.s + (+b.sau || 0) * H + g * dur;
    return [s, s + dur];
  }).sort((a, b) => a[0] - b[0]);
  const cacheManh = new Map();
  const manh = (w, i) => {
    const k = w.s + ":" + (i < 0 ? -1 : i);
    if (!cacheManh.has(k)) {
      const out = []; let cur = w.s;
      for (const [a, b] of khoangNghi(w, i)) { if (a > cur) out.push([cur, Math.min(a, w.e)]); cur = Math.max(cur, b); }
      if (cur < w.e) out.push([cur, w.e]);
      if (cacheManh.size > 20000) cacheManh.clear();
      cacheManh.set(k, out);
    }
    return cacheManh.get(k);
  };
  // Khoảng làm việc đầu tiên (của xe i) còn sau t
  const lamViec = (t, i) => {
    let w = cuaSo(t);
    for (let k = 0; k < 400 && w; k++) {
      for (const p of manh(w, i)) if (p[1] > t) return [Math.max(p[0], t), p[1]];
      w = cuaSo(w.e);
    }
    return [t, t + 1e12];
  };
  // Làm một việc dài dur (ms) từ t, gặp giờ nghỉ / hết ca thì dừng, sang khoảng làm việc sau làm tiếp
  const chay = (t, dur, i) => {
    let [a, b] = lamViec(t, i);
    const bd = a, manhs = [];
    let con = dur, cur = a;
    while (con > 1) {
      const x = Math.min(b, cur + con);
      manhs.push([cur, x]); con -= x - cur; cur = x;
      if (con > 1) [cur, b] = lamViec(b, i);
    }
    return { bd, kt: cur, manh: manhs };
  };
  // Các ca giao với [tu, den)
  const cacCa = (tu, den, max = 2000) => {
    const out = []; let w = cuaSo(tu);
    while (w && w.s < den && out.length < max) { out.push(w); w = cuaSo(w.e); }
    return out;
  };
  return { cuaSo, caCua, lamViec, chay, cacCa, khoangNghi, L, n };
}

// ---------- Mô phỏng từng chuyến ----------
// Xe xuất phát cách nhau đúng giãn cách tối ưu (60 ÷ R phút), đến điểm xếp nào trống sớm nhất thì vào, dỡ ở điểm dỡ trống sớm nhất.
// Giờ nghỉ cùng lúc / ngoài ca: mọi việc dừng rồi làm tiếp. Nghỉ luân phiên: xe về tới bãi xếp mà đã tới giờ nghỉ của nhóm mình
// (chưa nghỉ trong ca đó) thì nghỉ đủ số phút rồi mới vào xếp; điểm xếp / dỡ không dừng. Chuyến cuối có thể chở ít hơn tải.
export function moPhong(t, pa, ca, batDau, { maxChuyen = 40000 } = {}) {
  if (!pa || pa.loi) return null;
  const L = taoLich(ca), ly = pa.ly;
  const tXep = ly.tXep * H, tPhu = ly.tPhu * H, tDi = ly.tDi * H, tDo = ly.tDo * H, tVe = ly.tVe * H;
  const KL = so(t.khoi_luong), tai = so(t.tai_chuyen), gc = H / pa.R;
  const t0 = L.lamViec(+new Date(batDau), -1)[0];
  const ready = Array.from({ length: pa.A }, (_, i) => t0 + i * gc);
  const rXep = Array(pa.Cx).fill(t0), rDo = Array(pa.Cd).fill(t0);
  const soCX = Array(pa.A).fill(0), chuyen = [];
  const luan = (ca?.nghi || []).filter((b) => b.kieu === "luan" && +b.phut > 0);
  const daNghi = Array.from({ length: pa.A }, () => new Set()), choNghi = Array.from({ length: pa.A }, () => []);
  // Nghỉ luân phiên của xe i khi về tới bãi xếp lúc den: trả [giờ sẵn sàng mới, các đoạn nghỉ]
  const nghiLuan = (i, den) => {
    const doan = [];
    const w = luan.length ? L.caCua(den) : null;
    if (!w) return [den, doan];
    for (const b of luan) {
      const dur = b.phut * 60000, g = i % Math.max(1, +b.nhom || 1), s = w.s + (+b.sau || 0) * H + g * dur, k = w.key + "|" + b.id;
      if (den >= s && !daNghi[i].has(k)) { daNghi[i].add(k); const kt = Math.min(den + dur, w.e); doan.push(["nghi", den, kt]); den = kt; }
    }
    return [den, doan];
  };
  let giao = 0, choXep = 0, choDo = 0;
  const argmin = (a) => a.reduce((m, x, i) => (x < a[m] ? i : m), 0);
  while (giao < KL - 1e-9 && chuyen.length < maxChuyen) {
    const i = argmin(ready);
    // Tới giờ nghỉ luân phiên: nghỉ xong mới xếp hàng vào điểm xếp (không giữ chỗ khi đang nghỉ)
    const [sanSang, dn] = nghiLuan(i, ready[i]);
    if (dn.length) { choNghi[i].push(...dn); ready[i] = sanSang; continue; }
    const p = argmin(rXep);
    const kl = Math.min(tai, KL - giao); giao += kl;
    const den = ready[i], rp = rXep[p], doanNghi = choNghi[i]; choNghi[i] = [];
    const xep = L.chay(Math.max(den, rp), tXep * (kl / tai), -1); rXep[p] = xep.kt;
    const phu = L.chay(xep.kt, tPhu, -1);
    const di = L.chay(phu.kt, tDi, -1);
    const q = argmin(rDo), rDoTruoc = rDo[q];
    const doH = L.chay(Math.max(di.kt, rDo[q]), tDo, -1); rDo[q] = doH.kt;
    const ve = L.chay(doH.kt, tVe, -1);
    ready[i] = ve.kt;
    const cx = Math.max(0, Math.min(rp, xep.bd) - den), cd = Math.max(0, Math.min(rDoTruoc, doH.bd) - di.kt);
    choXep += cx; choDo += cd;
    const doan = [...doanNghi];
    if (rp > den) doan.push(["cho", den, Math.min(rp, xep.bd)]);
    xep.manh.forEach(([a, b]) => doan.push(["xep", a, b]));
    phu.manh.forEach(([a, b]) => doan.push(["phu", a, b]));
    di.manh.forEach(([a, b]) => doan.push(["di", a, b]));
    if (rDoTruoc > di.kt) doan.push(["cho", di.kt, Math.min(rDoTruoc, doH.bd)]);
    doH.manh.forEach(([a, b]) => doan.push(["do", a, b]));
    ve.manh.forEach(([a, b]) => doan.push(["ve", a, b]));
    chuyen.push({ xe: i, so: ++soCX[i], kl, diemXep: p, diemDo: q, bd: xep.bd, kxep: xep.kt, ddi: di.kt, bdo: doH.bd, giao: doH.kt, ve: ve.kt, doan });
  }
  const giaoSx = chuyen.map((c) => [c.giao, c.kl]).sort((a, b) => a[0] - b[0]);
  let cong = 0;
  const tich = giaoSx.map(([g, kl]) => [g, (cong += kl)]);
  const ketThuc = tich.length ? tich[tich.length - 1][0] : t0;
  // Kế hoạch theo ca: khối lượng giao (dỡ xong) trong ca
  const theoCa = new Map();
  for (const c of chuyen) {
    const w = L.caCua(c.giao - 1) || L.cuaSo(c.giao);
    const x = theoCa.get(w.key) || { key: w.key, ngay: w.ngay, so: w.so, s: w.s, e: w.e, kl: 0, chuyen: 0, xe: new Set() };
    x.kl += c.kl; x.chuyen++; x.xe.add(c.xe); theoCa.set(w.key, x);
  }
  const caKH = [...theoCa.values()].sort((a, b) => a.s - b.s).map((x) => ({ ...x, xe: x.xe.size }));
  return { t0, ketThuc, chuyen, tich, caKH, choXep: choXep / H, choDo: choDo / H, cat: chuyen.length >= maxChuyen && giao < KL - 1e-9, lich: L };
}

// Mô phỏng cả chiến dịch (nhiều tuyến chạy cùng lúc, mỗi tuyến điểm xếp / dỡ và xe riêng)
export function moPhongCD(cd) {
  const ca = cd?.cau_hinh || caMacDinh();
  const tuyen = (cd?.tuyen || []).map((t) => {
    const pa = phuongAn(t, ca);
    const mp = pa.loi || loiCa(ca).length ? null : moPhong(t, pa, ca, t.bat_dau || cd.bat_dau);
    return { t, pa, mp };
  });
  const ok = tuyen.filter((x) => x.mp);
  const ketThuc = ok.length ? Math.max(...ok.map((x) => x.mp.ketThuc)) : null;
  // Lũy kế chung: gộp các điểm giao của mọi tuyến
  const tatCa = ok.flatMap((x) => x.mp.chuyen.map((c) => [c.giao, c.kl])).sort((a, b) => a[0] - b[0]);
  let cong = 0;
  const tich = tatCa.map(([g, kl]) => [g, (cong += kl)]);
  const caKH = new Map();
  for (const x of ok) for (const c of x.mp.caKH) {
    const y = caKH.get(c.key) || { key: c.key, ngay: c.ngay, so: c.so, s: c.s, e: c.e, kl: 0, chuyen: 0, xe: 0, tuyen: {} };
    y.kl += c.kl; y.chuyen += c.chuyen; y.xe += c.xe; y.tuyen[x.t.id] = c; caKH.set(c.key, y);
  }
  const tongKL = (cd?.tuyen || []).reduce((a, t) => a + (so(t.khoi_luong) || 0), 0);
  const tong = ok.reduce((a, x) => ({ xe: a.xe + x.pa.A, xep: a.xep + x.pa.Cx, do: a.do + x.pa.Cd, vun: a.vun + (x.pa.soXeVun || 0), ns: a.ns + x.pa.ns, chuyen: a.chuyen + x.mp.chuyen.length }), { xe: 0, xep: 0, do: 0, vun: 0, ns: 0, chuyen: 0 });
  const t0 = ok.length ? Math.min(...ok.map((x) => x.mp.t0)) : (cd?.bat_dau ? +new Date(cd.bat_dau) : null);
  return { tuyen, t0, ketThuc, tich, caKH: [...caKH.values()].sort((a, b) => a.s - b.s), tongKL, tong, lich: taoLich(ca), loiCa: loiCa(ca) };
}

// Khối lượng kế hoạch đã giao tới thời điểm m (theo đường lũy kế)
export const keHoachDen = (tich, m) => { let v = 0; for (const [g, c] of tich) { if (g > m) break; v = c; } return v; };

// ---------- Thực tế & báo cáo ----------
// Gộp kế hoạch theo ca với số thực tế (lọc theo tuyến; tuyenId null = cả chiến dịch)
export function bangCa(kq, thucTe, tuyenId, now = Date.now()) {
  const L = kq.lich;
  const tt = (thucTe || []).filter((r) => !tuyenId || r.tuyen_id === tuyenId);
  const map = new Map();
  for (const c of kq.caKH) {
    const kh = tuyenId ? c.tuyen[tuyenId] : c;
    map.set(c.key, { key: c.key, ngay: c.ngay, so: c.so, s: c.s, e: c.e, kh: kh?.kl || 0, khChuyen: kh?.chuyen || 0, khXe: kh?.xe || 0, tt: null, ttChuyen: null, ttXe: null, dong: [] });
  }
  // Mọi ca từ lúc bắt đầu tới khi xong theo kế hoạch, hoặc tới hiện tại nếu chiến dịch kéo dài hơn kế hoạch (tối đa 60 ngày sau kế hoạch)
  if (kq.t0 != null) {
    const den = Math.max(kq.ketThuc ?? kq.t0, Math.min(now, (kq.ketThuc ?? kq.t0) + 60 * NGAY));
    for (const w of L.cacCa(kq.t0, den)) if (!map.has(w.key)) map.set(w.key, { key: w.key, ngay: w.ngay, so: w.so, s: w.s, e: w.e, kh: 0, khChuyen: 0, khXe: 0, tt: null, ttChuyen: null, ttXe: null, dong: [] });
  }
  // Ca có thực tế mà ngoài kế hoạch (chạy trễ / sớm): thêm dòng
  for (const r of tt) {
    const key = `${r.ngay}|${r.ca}`;
    if (!map.has(key)) {
      const d = +new Date(r.ngay + "T00:00:00");
      const ws = L.cacCa(d, d + 1.5 * NGAY).find((x) => x.ngay === r.ngay && x.so === +r.ca);
      map.set(key, { key, ngay: r.ngay, so: +r.ca, s: ws?.s ?? d, e: ws?.e ?? d, kh: 0, khChuyen: 0, khXe: 0, tt: null, ttChuyen: null, ttXe: null, dong: [] });
    }
    const x = map.get(key);
    x.dong.push(r);
    if (r.khoi_luong != null) x.tt = (x.tt || 0) + +r.khoi_luong;
    if (r.so_chuyen != null) x.ttChuyen = (x.ttChuyen || 0) + +r.so_chuyen;
    if (r.so_xe != null) x.ttXe = (x.ttXe || 0) + +r.so_xe;
  }
  const rows = [...map.values()].sort((a, b) => a.s - b.s);
  let lkKH = 0, lkTT = 0;
  for (const r of rows) { lkKH += r.kh; lkTT += r.tt || 0; r.lkKH = lkKH; r.lkTT = lkTT; r.qua = r.e <= now; r.dangChay = r.s <= now && now < r.e; }
  return rows;
}

// Tóm tắt tiến độ: kế hoạch tới nay, thực tế, chênh lệch, nhịp thực tế bình quân / ca và dự báo ngày xong
export function tomTat(kq, rows, tongKL, now = Date.now()) {
  const khDenNay = rows.filter((r) => r.e <= now).reduce((a, r) => a + r.kh, 0) + rows.filter((r) => r.s <= now && now < r.e).reduce((a, r) => a + r.kh * ((now - r.s) / (r.e - r.s)), 0);
  const coTT = rows.filter((r) => r.tt != null);
  const tt = coTT.reduce((a, r) => a + r.tt, 0);
  const daQua = rows.filter((r) => r.s <= now && (r.tt != null || r.e <= now));
  // nhịp: bình quân các ca đã nhập thực tế
  const nhip = coTT.length ? tt / coTT.length : null;
  const con = Math.max(0, tongKL - tt);
  let duBao = null;
  if (con <= 1e-9 && coTT.length) duBao = Math.max(...coTT.map((r) => r.e));
  else if (nhip > 0) {
    const tu = coTT.length ? Math.max(now, Math.max(...coTT.map((r) => r.e))) : now;
    const can = Math.ceil(con / nhip - 1e-9);
    const cas = kq.lich.cacCa(tu, tu + 400 * NGAY, can);
    duBao = cas.length ? cas[cas.length - 1].e : null;
  }
  // Chênh lệch so kế hoạch tính tới hết ca cuối đã nhập thực tế (ca đang chạy / chưa nhập không bị coi là chậm)
  const cuoi = [...rows].reverse().find((r) => r.tt != null) || null;
  const khDenCaTT = cuoi ? cuoi.lkKH : 0;
  return { khDenNay, khDenCaTT, caCuoiTT: cuoi, tt, chenh: tt - khDenCaTT, pct: tongKL ? tt / tongKL : 0, pctKH: tongKL ? khDenNay / tongKL : 0, nhip, soCaTT: coTT.length, daQua: daQua.length, con, duBao, treKH: duBao && kq.ketThuc ? duBao - kq.ketThuc : null };
}
