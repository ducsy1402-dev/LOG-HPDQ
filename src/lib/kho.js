// Kho bãi: sức chứa, tồn (luôn tính từ sổ nhập – xuất), lấp đầy, số ngày cấp còn lại, lô thành phẩm, cảnh báo.
//   Sức chứa (tấn) = diện tích (m²) × chiều cao chất đống (m) × tỉ trọng hàng (t/m³); có ô sức chứa nhập tay thì dùng ô đó.
//   Lấp đầy = tồn ÷ sức chứa. Vàng từ 85%, đỏ từ 95%.
//   Nguyên liệu: số ngày cấp còn lại = tồn ÷ tiêu thụ bình quân mỗi ngày (30 ngày gần nhất, hoặc nhập tay).
import { ngayCuaKeHoach } from "./keHoachKy";
import { plain, DAY, so } from "./format";
import { thangTrongKy } from "./ky";
import DM_BANG from "../data/dmBang.json";

export const NGUONG_KHO = { vang: 0.85, do: 0.95, ngayCapVang: 7, ngayCapDo: 3, tonLauNgay: 60, kiemKeVang: 0.02, kiemKeDo: 0.05, ngayDayVang: 7, heSoBai: 0.8 };
export const LOAI_GD = [
  ["nhap", "Nhập"], ["xuat", "Xuất"], ["dieu_chuyen", "Điều chuyển"], ["kiem_ke", "Điều chỉnh kiểm kê"], ["dau_ky", "Tồn đầu kỳ"],
];
const TC = ["trung_chuyen", "Trung chuyển"], NM = ["tu_nha_may", "Từ nhà máy"];
export const NGUON_GD = {
  thanh_pham: { nhap: [["san_xuat", "Từ sản xuất"], NM, TC, ["khac", "Khác"]], xuat: [["tau", "Xuất theo chuyến tàu"], ["don_hang", "Theo đơn hàng"], TC, NM, ["khac", "Khác"]], dieu_chuyen: [TC, NM, ["khac", "Khác"]] },
  nguyen_lieu: { nhap: [["tau", "Từ chuyến tàu"], NM, TC, ["khac", "Khác (xe, nội bộ…)"]], xuat: [["cap_sx", "Cấp cho sản xuất"], TC, NM, ["khac", "Khác"]], dieu_chuyen: [TC, NM, ["khac", "Khác"]] },
};
export const TRANG_THAI_LO = { san_sang: { ten: "Sẵn sàng xuất", tone: "ok" }, cho_kiem: { ten: "Chờ kiểm", tone: "warn" }, giu_lai: { ten: "Giữ lại", tone: "bad" } };

// Hàng thành phẩm (thép, HRC, phôi, slab, cuộn…) hay nguyên liệu (quặng, than, đá, xỉ, phế…)
const NHOM_NL = /(?:phe|quang|than|da|xi|bui|coc|vay|dat|huynh|vat lieu|rac|gang|thach cao|trau|vai|bun|hbi|dolomit)/; // từ nguyên vẹn: "than" không khớp "thanh" (Thép thanh là thành phẩm)
const TEN_TP = /thep|hrc|phoi|slab|cuon|thanh van|day thep|\bton\b/;
const DAU_NL = /^(quang|than|da|xi|bui|coc|coke|vay|via|bun|hbi|dolomit|dat|huynh|thach cao|trau|gang|rac|vat lieu|lieu hoi)\b/;
export function loaiKhoTuHang(hang, hangHoa = []) {
  const h = hangHoa.find((x) => plain(x.loai_hang) === plain(hang));
  const nhom = plain(h?.nhom || "");
  if (nhom && NHOM_NL.test(nhom)) return "nguyen_lieu";
  const p = plain(hang);
  // Tên mở đầu bằng loại nguyên liệu ("Xỉ thép…", "Bùn vảy cán HRC", "Quặng…") hoặc có chữ phế: nguyên liệu
  if (DAU_NL.test(p) || /phe/.test(p)) return "nguyen_lieu";
  return TEN_TP.test(p) || TEN_TP.test(nhom) ? "thanh_pham" : "nguyen_lieu";
}
export const loaiKhoCua = (row, hangHoa) => row.loai_kho || loaiKhoTuHang(row.hang, hangHoa);

// Tỉ trọng của hàng: đúng tên trong danh mục hàng hóa, không có thì bình quân nhóm cùng tên (VD "Phế" -> nhóm Phế)
// So tên bỏ dấu, bỏ khoảng trắng / ký tự lạ ("Đá vôi <20mm" = "Đá vôi < 20 mm"). Cuối cùng: tên bắt đầu bằng tên nhóm ("Quặng cỡ Kumba" -> nhóm Quặng).
const gon = (s) => plain(s).replace(/[^a-z0-9<>]/g, "");
const binhQuan = (ds) => (ds.length ? ds.reduce((s, x) => s + +x.ti_trong, 0) / ds.length : null);
export function tiTrong(hang, hangHoa = []) {
  const p = plain(hang), g = gon(hang);
  if (!p) return null;
  const co = hangHoa.filter((x) => x.ti_trong > 0);
  const h = co.find((x) => plain(x.loai_hang) === p) || co.find((x) => gon(x.loai_hang) === g);
  if (h) return +h.ti_trong;
  const nhom = co.filter((x) => plain(x.nhom) === p);
  if (nhom.length) return binhQuan(nhom);
  const gan = co.find((x) => g.length > 3 && (g.includes(gon(x.loai_hang)) || gon(x.loai_hang).includes(g)));
  if (gan) return +gan.ti_trong;
  const dauNhom = co.filter((x) => x.nhom && p.startsWith(plain(x.nhom)));
  return binhQuan(dauNhom);
}
// Hệ số lưu chứa: nhập 0,85 hoặc 85 (%) đều được; trống / không hợp lệ = chưa có
export const heSoLuuChua = (v) => { const h = +v; return h > 0 ? (h > 1 ? Math.min(1, h / 100) : h) : null; };
const lam2 = (x) => Math.round(x * 100) / 100;
export function sucChua(row, hangHoa) {
  if (+row.suc_chua_tay > 0) return { tan: +row.suc_chua_tay, cach: "nhập tay" };
  // Khả dụng trống: sức chứa danh nghĩa × hệ số lưu chứa (chưa có hệ số thì khả dụng = danh nghĩa)
  if (+row.suc_chua_dn > 0) { const hs = heSoLuuChua(row.he_so_luu_chua); return { tan: lam2(+row.suc_chua_dn * (hs ?? 1)), cach: hs ? `danh nghĩa ${row.suc_chua_dn} t × hệ số ${hs}` : "= sức chứa danh nghĩa (chưa có hệ số lưu chứa)" }; }
  const tt = tiTrong(row.hang, hangHoa);
  if (+row.dien_tich > 0 && +row.chieu_cao > 0 && tt > 0) return { tan: +row.dien_tich * +row.chieu_cao * tt, cach: `${row.dien_tich} m² × ${row.chieu_cao} m × ${tt} t/m³` };
  return { tan: null, cach: !(+row.chieu_cao > 0) ? "chưa có chiều cao chất đống" : !(tt > 0) ? "hàng chưa có tỉ trọng" : "chưa có diện tích" };
}

// Hộp thêm / sửa / import kho bãi: ô sức chứa để trống thì web tự tính rồi lưu.
//   • Sức chứa danh nghĩa (chỉ kho nguyên liệu, có cột): trống → diện tích × chiều cao đống × tỷ khối hàng.
//   • Sức chứa khả dụng (cả hai kho): trống → sức chứa danh nghĩa × hệ số lưu chứa; chưa có hệ số thì khả dụng = danh nghĩa (kèm thông báo).
// Trả về { rows, thieuHeSo: số dòng chưa có hệ số, tuTinh: số dòng được tự điền }
export function tuTinhSucChua(rows, loai, hangHoa = [], coCotMoi = true) {
  let thieuHeSo = 0, tuTinh = 0;
  const out = rows.map((r) => {
    const o = { ...r };
    if (coCotMoi && loai !== "thanh_pham" && !(+o.suc_chua_dn > 0) && +o.dien_tich > 0 && +o.chieu_cao > 0) {
      const tt = tiTrong(o.hang, hangHoa);
      if (tt > 0) { o.suc_chua_dn = lam2(+o.dien_tich * +o.chieu_cao * tt); tuTinh++; }
    }
    if (!(+o.suc_chua_tay > 0) && +o.suc_chua_dn > 0) {
      const hs = heSoLuuChua(o.he_so_luu_chua);
      o.suc_chua_tay = lam2(+o.suc_chua_dn * (hs ?? 1)); tuTinh++;
      if (hs == null) thieuHeSo++;
    }
    return o;
  });
  return { rows: out, thieuHeSo, tuTinh };
}

// Ngày địa phương dạng yyyy-mm-dd
export const ngayStr = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const khoa = (bai, hang) => `${plain(bai)}|${plain(hang)}`;

// Kiểu bãi nhỏ (mỗi dòng danh mục kho bãi là một bãi nhỏ / khu trong bãi lớn):
//   cố định 1 hàng (mặc định) · cố định nhóm (mọi hàng cùng nhóm) · tự do (mọi hàng)
export const KIEU_BAI = [["co_dinh_hang", "Cố định 1 hàng"], ["co_dinh_nhom", "Cố định nhóm"], ["tu_do", "Tự do"]];
export const TEN_KIEU_BAI = Object.fromEntries(KIEU_BAI);
export const kieuKhu = (r) => (TEN_KIEU_BAI[r?.kieu_bai] ? r.kieu_bai : "co_dinh_hang");
export const tenKhu = (r) => String(r?.ten_khu || "").trim() || r?.hang || "Khu tự do";

// Khai báo kho / bãi lớn (Danh mục › Kho bãi › Khai báo kho / bãi, bảng danh_muc_bang "bai_lon", SQL 08):
// Map(khóa tên bãi -> { khuVuc, kieu, dienTich (diện tích bãi lớn, m²) }); kiểu: "Tự do" -> tu_do, "Cố định" -> co_dinh_hang. Tên so không dấu, bỏ ký tự đặc biệt ("Kho G - CTH" = "Kho G CTH").
export const khoaTenBai = (t) => plain(t).replace(/[^a-z0-9]/g, "");
export function khaiBaoBai(dmBang) {
  const cot = DM_BANG.bai_lon?.cot || [], k = (re) => cot.find(([, t]) => re.test(plain(t)))?.[0];
  const kTen = cot[0]?.[0], kKhu = k(/khu vuc/), kLoai = k(/^loai/), kDT = k(/dien tich/);
  const m = new Map();
  for (const r of dmBang || []) {
    if (r.bang !== "bai_lon" || !r.data?.[kTen]) continue;
    const loai = plain(r.data[kLoai]);
    m.set(khoaTenBai(r.data[kTen]), { ten: String(r.data[kTen]).trim(), khuVuc: String(r.data[kKhu] ?? "").trim(), kieu: /tu do/.test(loai) ? "tu_do" : /co dinh/.test(loai) ? "co_dinh_hang" : null, dienTich: Number.isFinite(+r.data[kDT]) && r.data[kDT] !== null && r.data[kDT] !== "" ? +r.data[kDT] : null });
  }
  return m;
}

// Khu vực của kho / bãi: theo Khai báo kho / bãi (cột Phạm vi / Khu vực); chưa có thì theo cột tự thêm "Khu vực" ở Danh mục › Kho bãi (cũ). Không có thì null.
export function khuVucKho(dmCot, dmBang) {
  const kb = khaiBaoBai(dmBang), c = (dmCot || []).find((x) => x.bang === "kho" && plain(x.ten) === "khu vuc");
  const coKb = [...kb.values()].some((x) => x.khuVuc);
  if (!coKb && !c) return null;
  const cua = coKb ? (r) => kb.get(khoaTenBai(r?.ten_bai))?.khuVuc || "" : (r) => String(r?.them?.[c.ma] ?? "").trim();
  // Khu vực của bãi lớn: giá trị gặp nhiều nhất trong các bãi nhỏ
  const cuaBai = (b) => { if (coKb) return kb.get(khoaTenBai(b?.ten_bai))?.khuVuc || ""; const dem = new Map(); for (const d of b.dong || []) { const k = cua(d); if (k) dem.set(k, (dem.get(k) || 0) + 1); } return [...dem].sort((x, y) => y[1] - x[1])[0]?.[0] || ""; };
  // So sánh: theo khu vực (chữ số so như số, trống xếp cuối), cùng khu thì theo thứ tự trong danh mục
  const ss = (ka, kb2, ia, ib) => (!ka !== !kb2 ? (ka ? -1 : 1) : ka.localeCompare(kb2, "vi", { numeric: true }) || ia - ib);
  const thuTu = (r) => (r?.id != null ? +r.id : Infinity);
  return {
    ten: "Khu vực", cua, cuaBai,
    sapBai: (ds) => [...ds].sort((a, b) => ss(cuaBai(a), cuaBai(b), Math.min(...a.dong.map(thuTu)), Math.min(...b.dong.map(thuTu)))),
    sapDong: (ds) => [...ds].sort((a, b) => ss(cua(a), cua(b), thuTu(a), thuTu(b))),
  };
}

// Gộp tồn (view kho_ton: bãi, hàng, lô, tồn) với danh mục kho bãi.
// Mỗi cặp bãi – hàng trong sổ được xếp vào một bãi nhỏ: đúng hàng -> khu cố định nhóm cùng nhóm -> khu tự do -> không có thì "sai bãi".
// Trả { dong: [mỗi bãi nhỏ], bai: [mỗi bãi lớn], cap: [mỗi cặp bãi – hàng có tồn], lo: [lô còn tồn], gan(bai, hang) -> khóa bãi nhỏ }
export function tongHopKho({ khoBai = [], khoTon = [], khoLo = [], giaoDich = [], hangHoa = [], now = Date.now() }) {
  const tonBH = new Map(), tenBH = new Map();
  // Tồn theo (bãi, bãi nhỏ, hàng): bãi nhỏ ghi ở sổ (SQL 12, cột ten_khu); sổ cũ không ghi bãi nhỏ thì để trống và xếp theo hàng như trước
  for (const t of khoTon) { const k = khoa(t.ten_bai, t.hang) + "|" + plain(t.ten_khu || ""); tonBH.set(k, (tonBH.get(k) || 0) + +t.ton); if (!tenBH.has(k)) tenBH.set(k, { ten_bai: t.ten_bai, hang: t.hang, ten_khu: t.ten_khu || "" }); }
  // Tiêu thụ bình quân 30 ngày theo hàng (xuất cấp sản xuất / xuất khác) – nguyên liệu
  const tu30 = ngayStr(now - 30 * DAY), xuat30 = new Map(); // 30 ngày gần nhất, so theo ngày (yyyy-mm-dd)
  for (const g of giaoDich) if (g.loai === "xuat" && String(g.ngay).slice(0, 10) > tu30) xuat30.set(plain(g.hang), (xuat30.get(plain(g.hang)) || 0) + +g.so_luong);
  const tonHang = new Map();
  for (const t of khoTon) tonHang.set(plain(t.hang), (tonHang.get(plain(t.hang)) || 0) + +t.ton);

  // Xếp cặp bãi – hàng vào bãi nhỏ
  const khoaKhu = (r) => (r.id != null ? `k${r.id}` : khoa(r.ten_bai, r.hang));
  const theoTenBai = new Map();
  for (const r of khoBai) { const k = plain(r.ten_bai); if (!theoTenBai.has(k)) theoTenBai.set(k, []); theoTenBai.get(k).push(r); }
  const nhomRow = (r) => plain(r.nhom_bai || nhomCua(r.hang, hangHoa));
  const daGan = new Map();
  const ganTheoHang = (bai, hang) => {
    const k = khoa(bai, hang);
    if (daGan.has(k)) return daGan.get(k);
    const ds = theoTenBai.get(plain(bai)) || [], p = plain(hang), nh = plain(nhomCua(hang, hangHoa));
    const r = ds.find((x) => plain(x.hang) === p && p) || ds.find((x) => kieuKhu(x) === "co_dinh_nhom" && nhomRow(x) === nh) || ds.find((x) => kieuKhu(x) === "tu_do");
    const out = r ? khoaKhu(r) : `sai|${k}`;
    daGan.set(k, out);
    return out;
  };
  // gan(bãi, hàng, bãi nhỏ?) -> khóa bãi nhỏ: có ghi bãi nhỏ (đúng tên bãi nhỏ trong bãi) thì theo đó, không thì xếp theo hàng
  const gan = (bai, hang, khu) => {
    const kp = plain(khu || "");
    if (kp) { const r = (theoTenBai.get(plain(bai)) || []).find((x) => plain(tenKhu(x)) === kp); if (r) return khoaKhu(r); }
    return ganTheoHang(bai, hang);
  };

  const chuaCua = new Map();
  for (const [k, ton] of tonBH) {
    const { ten_bai, hang, ten_khu } = tenBH.get(k), kk = gan(ten_bai, hang, ten_khu);
    if (!chuaCua.has(kk)) chuaCua.set(kk, []);
    const ds = chuaCua.get(kk), c = ds.find((x) => plain(x.hang) === plain(hang));
    if (c) c.ton += ton; else ds.push({ ten_bai, hang, ton });
  }
  const dong = khoBai.map((r) => {
    const key = khoaKhu(r), kieu = kieuKhu(r), chua = (chuaCua.get(key) || []).filter((c) => Math.abs(c.ton) > 1e-6 || plain(c.hang) === plain(r.hang));
    const ton = chua.reduce((s, c) => s + c.ton, 0);
    // Khu nhận nhiều hàng: tỉ trọng bình quân theo tồn các hàng đang chứa
    let sc = sucChua(r, hangHoa);
    if (!(sc.tan > 0) && kieu !== "co_dinh_hang" && +r.dien_tich > 0 && +r.chieu_cao > 0) {
      const co = chua.map((c) => ({ ton: Math.max(0, c.ton), tt: tiTrong(c.hang, hangHoa) })).filter((c) => c.ton > 0 && c.tt > 0);
      const w = co.reduce((s, c) => s + c.ton, 0);
      if (w > 0) { const tt = co.reduce((s, c) => s + c.ton * c.tt, 0) / w; sc = { tan: +r.dien_tich * +r.chieu_cao * tt, cach: `${r.dien_tich} m² × ${r.chieu_cao} m × ${so(tt)} t/m³ (bình quân hàng đang chứa)` }; }
    }
    const loai = r.loai_kho || (r.hang ? loaiKhoTuHang(r.hang, hangHoa) : chua[0] ? loaiKhoTuHang(chua[0].hang, hangHoa) : "nguyen_lieu");
    const tieuThu = r.hang ? (+r.tieu_thu_ngay > 0 ? +r.tieu_thu_ngay : (xuat30.get(plain(r.hang)) || 0) / 30) : 0;
    const tonCaHang = tonHang.get(plain(r.hang)) || 0;
    return { ...r, key, ten: tenKhu(r), kieu, nhomBai: kieu === "co_dinh_nhom" ? r.nhom_bai || nhomCua(r.hang, hangHoa) : null, loai, chua, sucChua: sc.tan, cachTinh: sc.cach, ton,
      lapDay: sc.tan > 0 ? ton / sc.tan : null, tieuThu: tieuThu > 0 ? tieuThu : null, ngayCap: tieuThu > 0 ? tonCaHang / tieuThu : null };
  });
  // Tồn ở bãi – hàng không xếp được vào bãi nhỏ nào (hàng sai bãi)
  for (const [key, chua] of chuaCua) if (key.startsWith("sai|")) for (const c of chua) if (Math.abs(c.ton) > 1e-6)
    dong.push({ id: null, key, ten_bai: c.ten_bai, hang: c.hang, ten: c.hang, kieu: null, loai: loaiKhoTuHang(c.hang, hangHoa), chua: [c], sucChua: null, cachTinh: "không có bãi nhỏ nào nhận hàng này", ton: c.ton, lapDay: null, saiBai: true });
  const capMap = new Map();
  for (const k of tonBH.keys()) {
    const { ten_bai, hang, ten_khu } = tenBH.get(k), key = gan(ten_bai, hang, ten_khu), kc = `${key}|${plain(hang)}`;
    if (capMap.has(kc)) capMap.get(kc).ton += tonBH.get(k); else capMap.set(kc, { ten_bai, hang, ton: tonBH.get(k), key });
  }
  const cap = [...capMap.values()];
  for (const d of dong) if (!d.saiBai && d.hang && !capMap.has(`${d.key}|${plain(d.hang)}`)) cap.push({ ten_bai: d.ten_bai, hang: d.hang, ton: 0, key: d.key });
  const loaiKhu = new Map(dong.map((d) => [d.key, d.loai]));
  for (const c of cap) c.loai = loaiKhu.get(c.key) || loaiKhoTuHang(c.hang, hangHoa);

  const theoBai = new Map();
  for (const d of dong) {
    const b = theoBai.get(d.ten_bai) || { ten_bai: d.ten_bai, dong: [], ton: 0, sucChua: 0, thieuSucChua: false, dienTich: 0 };
    b.dong.push(d); b.ton += d.ton; b.dienTich += +d.dien_tich || 0;
    if (d.sucChua > 0) b.sucChua += d.sucChua; else if (!d.saiBai) b.thieuSucChua = true;
    theoBai.set(d.ten_bai, b);
  }
  const bai = [...theoBai.values()].map((b) => ({ ...b, lapDay: b.sucChua > 0 ? b.ton / b.sucChua : null, loai: b.dong.some((d) => d.loai === "thanh_pham") ? (b.dong.every((d) => d.loai === "thanh_pham") ? "thanh_pham" : "hon_hop") : "nguyen_lieu" }));
  // Lô thành phẩm còn tồn
  const loMap = new Map(khoLo.map((l) => [l.so_lo, l]));
  const lo = khoTon.filter((t) => t.so_lo && +t.ton > 1e-6).map((t) => {
    const l = loMap.get(t.so_lo) || {}, ngayNhap = l.ngay_nhap || t.ngay_dau;
    return { so_lo: t.so_lo, hang: t.hang, ten_bai: t.ten_bai, ten_khu: t.ten_khu || "", ton: +t.ton, ngay_nhap: ngayNhap, tuoi: ngayNhap ? Math.floor((now - new Date(ngayNhap).getTime()) / DAY) : null, trang_thai: l.trang_thai || "san_sang", ghi_chu: l.ghi_chu || null };
  });
  return { dong, bai, cap, lo, gan };
}

// Bãi nhỏ sẽ nhận một hàng khi nhập vào bãi lớn (null = không bãi nhỏ nào nhận: thành hàng sai bãi)
export function khuNhan(th, bai, hang) {
  const k = th.gan(bai, hang);
  return k.startsWith("sai|") ? null : th.dong.find((d) => d.key === k) || null;
}
// Gợi ý bãi cho một hàng: bãi nhỏ cố định đúng hàng trước, rồi cố định cùng nhóm, rồi tự do; trong mỗi mức bãi trống nhiều xếp trước
export function goiYBai(th, hang, loaiKho) {
  if (!String(hang || "").trim()) return [];
  const out = [];
  for (const b of th.bai) {
    const d = khuNhan(th, b.ten_bai, hang);
    if (!d || (loaiKho && d.loai !== loaiKho)) continue;
    out.push({ ten_bai: b.ten_bai, khu: d, muc: plain(d.hang) === plain(hang) ? 0 : d.kieu === "co_dinh_nhom" ? 1 : 2, trong: d.sucChua > 0 ? Math.max(0, d.sucChua - d.ton) : null });
  }
  return out.sort((a, b) => a.muc - b.muc || (b.trong ?? -1) - (a.trong ?? -1));
}

// Bãi nhỏ d có nhận được hàng này không: cố định hàng → đúng hàng; cố định nhóm → cùng nhóm; tự do → mọi hàng
export function khuChoPhepHang(d, hang, hangHoa = []) {
  if (!d || !String(hang || "").trim()) return false;
  const k = d.kieu || kieuKhu(d);
  if (k === "tu_do") return true;
  if (k === "co_dinh_nhom") return plain(nhomCua(hang, hangHoa)) === plain(d.nhomBai || nhomCua(d.hang, hangHoa));
  return !d.hang || plain(d.hang) === plain(hang);
}

// Chỗ trống của một bãi (tấn), null nếu chưa tính được sức chứa
export function choTrongBai(th, tenBai) {
  const b = th.bai.find((x) => plain(x.ten_bai) === plain(tenBai));
  return b && b.sucChua > 0 && !b.thieuSucChua ? Math.max(0, b.sucChua - b.ton) : null;
}

// Nhóm của một hàng: theo danh mục hàng hóa; không có thì nhóm có tên là phần đầu tên hàng ("Quặng cỡ Kumba" -> Quặng)
export function nhomCua(hang, hangHoa = []) {
  const p = plain(hang);
  const h = hangHoa.find((x) => plain(x.loai_hang) === p);
  if (h?.nhom) return h.nhom;
  const nhoms = [...new Set(hangHoa.map((x) => x.nhom).filter(Boolean))].sort((a, b) => b.length - a.length);
  return nhoms.find((n) => p.startsWith(plain(n))) || String(hang || "").trim().split(/\s+/)[0] || null;
}

// Kiểu bãi lớn: tổng hợp kiểu các bãi nhỏ trong đó
export function kieuBai(b) {
  const ds = b.dong.filter((d) => !d.saiBai), dem = new Map();
  for (const d of ds) dem.set(d.kieu, (dem.get(d.kieu) || 0) + 1);
  const chiTiet = KIEU_BAI.filter(([k]) => dem.get(k)).map(([k, ten]) => `${dem.get(k)} ${ten.toLowerCase()}`).join(", ");
  if (dem.size === 1) { const [k] = [...dem.keys()]; return { ma: k, ten: k === "co_dinh_hang" ? "Cố định" : TEN_KIEU_BAI[k], chiTiet }; }
  return { ma: "hon_hop", ten: dem.get("tu_do") ? "Có khu tự do" : "Cố định hàng / nhóm", chiTiet };
}

// Chỉ số lưu lượng của một bãi (lớn hoặc nhỏ) từ tồn, sức chứa, nhập / xuất trong kỳ và chuỗi tồn theo ngày
function chiSoLuong({ ton, sucChua, nhap, xuat, ngay, seri, nguong }) {
  const n = nhap / ngay, x = xuat / ngay, rong = n - x, sc = sucChua > 0 ? sucChua : null;
  const tonTB = seri.reduce((s, [, t]) => s + t, 0) / (seri.length || 1);
  const luuBai = x > 0 ? Math.max(0, tonTB) / x : null;
  const nangLuc = sc && luuBai > 0 ? (sc * nguong.heSoBai) / luuBai : null;
  let ngayDay = null, trangThaiDay = null;
  if (sc) {
    if (ton >= sc) trangThaiDay = "da_day";
    else if (rong > 0.5) { ngayDay = (sc - ton) / rong; trangThaiDay = "tang"; }
    else trangThaiDay = rong < -0.5 ? "giam" : "dung";
  }
  return { soNgay: ngay, nhap: n, xuat: x, rong, ngayDay, trangThaiDay, tonTB, luuBai, nangLuc, thucTe: x, suDung: nangLuc ? x / nangLuc : null };
}

// Lưu lượng và năng lực thông qua từng bãi lớn và từng bãi nhỏ (30 ngày gần nhất, hoặc từ ngày bãi có số liệu đầu tiên nếu ngắn hơn):
//   nhập / xuất bình quân (t/ngày, gồm điều chuyển đến / đi; không tính tồn đầu kỳ, kiểm kê);
//   dự kiến đầy = (sức chứa − tồn) ÷ (nhập − xuất) nếu bãi đang tăng;
//   lưu bãi bình quân (ngày) = tồn bình quân ÷ xuất bình quân / ngày;
//   năng lực thông qua (t/ngày) = sức chứa × hệ số sử dụng bãi (0,8) ÷ lưu bãi bình quân;
//   tàu nhập sắp về (7 ngày) có bãi nhận là bãi lớn này.
// Trả { bai: Map(tên bãi lớn -> chỉ số), khu: Map(khóa bãi nhỏ -> chỉ số) }
export function luuLuongKho(th, { giaoDich = [], voyages = [], nguong = NGUONG_KHO, now = Date.now(), soNgay = 30 } = {}) {
  const tu = ngayStr(now - soNgay * DAY), homNay = ngayStr(now);
  const dauTien = new Map(), nhap = new Map(), xuat = new Map();
  const cong = (m, k, x) => m.set(k, (m.get(k) || 0) + x);
  const ghi = (bai, hang, khu, m, x) => { cong(m, `b|${plain(bai)}`, x); cong(m, th.gan(bai, hang, khu), x); };
  for (const g of giaoDich) {
    const ng = String(g.ngay).slice(0, 10);
    for (const b of [g.ten_bai, g.den_bai]) { const k = plain(b); if (k && (!dauTien.has(k) || ng < dauTien.get(k))) dauTien.set(k, ng); }
    if (ng <= tu || ng > homNay) continue;
    if (g.loai === "nhap") ghi(g.ten_bai, g.hang, g.ten_khu, nhap, +g.so_luong);
    else if (g.loai === "xuat") ghi(g.ten_bai, g.hang, g.ten_khu, xuat, +g.so_luong);
    else if (g.loai === "dieu_chuyen") { ghi(g.ten_bai, g.hang, g.ten_khu, xuat, +g.so_luong); if (g.den_bai) ghi(g.den_bai, g.hang, g.den_khu, nhap, +g.so_luong); }
  }
  const tau = new Map();
  for (const v of voyages) {
    if (v.huy || v.huong === "xuat" || !v.bai_hang || v.kt_lam_hang) continue;
    const t = new Date(v.atb || v.etb || v.eta).getTime();
    if (!(t < now + 7 * DAY)) continue;
    const ds = String(v.bai_hang).split(";").map((x) => x.trim()).filter(Boolean), con = Math.max(0, (+v.khoi_luong || 0) - (+v.da_lam || 0));
    for (const bai of ds) { const k = plain(bai); if (!tau.has(k)) tau.set(k, []); tau.get(k).push({ id: v.id, ten: v.ten_tau, con: con / ds.length, chia: ds.length > 1 }); }
  }
  const bai = new Map(), khu = new Map();
  for (const b of th.bai) {
    const kb = plain(b.ten_bai), d0 = dauTien.get(kb);
    const ngay = Math.max(1, Math.min(soNgay, d0 && d0 > tu ? Math.round((new Date(homNay) - new Date(d0)) / DAY) + 1 : soNgay));
    const seriB = tonTheoNgay(b.ton, giaoDich, (x) => plain(x) === kb, ngay, now);
    bai.set(b.ten_bai, { ...chiSoLuong({ ton: b.ton, sucChua: b.sucChua, nhap: nhap.get(`b|${kb}`) || 0, xuat: xuat.get(`b|${kb}`) || 0, ngay, seri: seriB, nguong }), tau: tau.get(kb) || [], kieu: kieuBai(b) });
    for (const d of b.dong) {
      const seri = tonTheoNgay(d.ton, giaoDich, (x, h, k) => th.gan(x, h, k) === d.key, ngay, now);
      khu.set(d.key, chiSoLuong({ ton: d.ton, sucChua: d.sucChua, nhap: nhap.get(d.key) || 0, xuat: xuat.get(d.key) || 0, ngay, seri, nguong }));
    }
  }
  for (const m of [bai, khu]) for (const l of m.values()) l.luc = l.ngayDay != null ? now + l.ngayDay * DAY : null;
  return { bai, khu };
}

// Tồn theo ngày (cuối mỗi ngày) của các bãi – hàng thỏa loc(bãi, hàng), đi lùi từ tồn hiện tại theo sổ
export function tonTheoNgay(tonHienTai, giaoDich, loc, soNgay = 30, now = Date.now()) {
  const d0 = new Date(now); const homNay = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate()).getTime();
  const doiNgay = new Map();
  for (const g of giaoDich) {
    let sl = 0;
    if (loc(g.ten_bai, g.hang, g.ten_khu)) sl += g.loai === "xuat" || g.loai === "dieu_chuyen" ? -g.so_luong : +g.so_luong;
    if (g.loai === "dieu_chuyen" && g.den_bai && loc(g.den_bai, g.hang, g.den_khu)) sl += +g.so_luong;
    if (sl) { const k = String(g.ngay).slice(0, 10); doiNgay.set(k, (doiNgay.get(k) || 0) + sl); }
  }
  const out = []; let ton = tonHienTai;
  for (let i = 0; i < soNgay; i++) {
    const t = homNay - i * DAY;
    out.unshift([t, ton]);
    ton -= doiNgay.get(ngayStr(t)) || 0;
  }
  return out;
}

export function canhBaoKho(th, { voyages = [], giaoDich = [], nguong = NGUONG_KHO, now = Date.now() } = {}) {
  const out = [];
  for (const b of th.bai) {
    if (b.lapDay == null) continue;
    if (b.lapDay > 1.0001) out.push({ muc: "bad", ma: "vuot", bai: b.ten_bai, nd: `${b.ten_bai} vượt sức chứa (${Math.round(b.lapDay * 100)}%)` });
    else if (b.lapDay >= nguong.do) out.push({ muc: "bad", ma: "day", bai: b.ten_bai, nd: `${b.ten_bai} sắp đầy (${Math.round(b.lapDay * 100)}%)` });
    else if (b.lapDay >= nguong.vang) out.push({ muc: "warn", ma: "day", bai: b.ten_bai, nd: `${b.ten_bai} đã lấp đầy ${Math.round(b.lapDay * 100)}%` });
  }
  // Bãi chưa tới ngưỡng vàng nhưng theo lưu lượng 30 ngày sẽ đầy trong vài ngày tới
  const ll = luuLuongKho(th, { giaoDich, voyages, nguong, now });
  for (const b of th.bai) {
    const l = ll.bai.get(b.ten_bai);
    if (b.lapDay != null && b.lapDay < nguong.vang && l?.ngayDay != null && l.ngayDay < nguong.ngayDayVang)
      out.push({ muc: "warn", ma: "sap_day", bai: b.ten_bai, nd: `${b.ten_bai} dự kiến đầy sau ${so(l.ngayDay)} ngày (nhập nhiều hơn xuất ${so(l.rong)} t/ngày)` });
  }
  const b1 = (ten) => th.bai.find((b) => b.ten_bai === ten);
  const daBao = new Set();
  for (const d of th.dong) {
    if (d.saiBai) out.push({ muc: "bad", ma: "sai_bai", bai: d.ten_bai, nd: `Hàng sai bãi: ${d.hang} ở ${d.ten_bai} (không có bãi nhỏ cố định hoặc tự do nào nhận hàng này)` });
    else if (d.lapDay != null && b1(d.ten_bai)?.dong.length > 1) {
      // Bãi nhỏ đầy dù bãi lớn còn chỗ
      if (d.lapDay > 1.0001) out.push({ muc: "bad", ma: "vuot", bai: d.ten_bai, nd: `${d.ten_bai} › ${d.ten} vượt sức chứa (${Math.round(d.lapDay * 100)}%)` });
      else if (d.lapDay >= nguong.do) out.push({ muc: "warn", ma: "day", bai: d.ten_bai, nd: `${d.ten_bai} › ${d.ten} sắp đầy (${Math.round(d.lapDay * 100)}%)` });
      else { const l = ll.khu.get(d.key); if (l?.ngayDay != null && l.ngayDay < nguong.ngayDayVang && d.lapDay < nguong.vang) out.push({ muc: "warn", ma: "sap_day", bai: d.ten_bai, nd: `${d.ten_bai} › ${d.ten} dự kiến đầy sau ${so(l.ngayDay)} ngày` }); }
    }
    if (d.loai === "nguyen_lieu" && d.ngayCap != null && !daBao.has(plain(d.hang))) {
      daBao.add(plain(d.hang));
      if (d.ngayCap < nguong.ngayCapDo) out.push({ muc: "bad", ma: "ton_thap", bai: d.ten_bai, nd: `${d.hang}: tồn chỉ đủ cấp ${so(d.ngayCap)} ngày` });
      else if (d.ngayCap < nguong.ngayCapVang) out.push({ muc: "warn", ma: "ton_thap", bai: d.ten_bai, nd: `${d.hang}: tồn đủ cấp ${so(d.ngayCap)} ngày (dưới ${nguong.ngayCapVang} ngày)` });
    }
  }
  for (const c of th.cap) if (c.ton < -1e-6) out.push({ muc: "bad", ma: "am", bai: c.ten_bai, nd: `${c.hang} ở ${c.ten_bai} tồn âm (${Math.round(c.ton)} t): kiểm tra sổ` });
  for (const l of th.lo) if (l.tuoi != null && l.tuoi > nguong.tonLauNgay) out.push({ muc: "warn", ma: "ton_lau", bai: l.ten_bai, nd: `Lô ${l.so_lo} (${l.hang}) tồn ${l.tuoi} ngày` });
  // Chênh lệch kiểm kê lần gần nhất
  const kk = new Map();
  for (const g of giaoDich) if (g.loai === "kiem_ke" && +g.so_sach > 0) { const k = khoa(g.ten_bai, g.hang); if (!kk.has(k) || g.ngay > kk.get(k).ngay) kk.set(k, g); }
  for (const g of kk.values()) {
    const tl = Math.abs(+g.so_luong) / +g.so_sach;
    if (tl >= nguong.kiemKeDo) out.push({ muc: "bad", ma: "kiem_ke", bai: g.ten_bai, nd: `Kiểm kê ${g.hang} ở ${g.ten_bai} lệch ${so(tl * 100)}% so với sổ` });
    else if (tl >= nguong.kiemKeVang) out.push({ muc: "warn", ma: "kiem_ke", bai: g.ten_bai, nd: `Kiểm kê ${g.hang} ở ${g.ten_bai} lệch ${so(tl * 100)}% so với sổ` });
  }
  // Tàu nhập sắp cập (7 ngày) mà bãi nhận thiếu chỗ
  for (const v of voyages) {
    if (v.huy || v.huong === "xuat" || !v.bai_hang || v.kt_lam_hang) continue;
    const t = new Date(v.atb || v.etb || v.eta).getTime();
    if (!(t < now + 7 * DAY)) continue;
    const ds = String(v.bai_hang).split(";").map((x) => x.trim()).filter(Boolean), tr = ds.map((b) => choTrongBai(th, b));
    const trong = tr.some((x) => x == null) ? null : tr.reduce((s, x) => s + x, 0), con = Math.max(0, (+v.khoi_luong || 0) - (+v.da_lam || 0));
    if (trong != null && con > trong) out.push({ muc: "bad", ma: "tau_thieu_cho", bai: v.bai_hang, voyageId: v.id, nd: `Tàu ${v.ten_tau} còn ${so(con)} t về ${v.bai_hang}, bãi chỉ còn trống ${so(trong)} t` });
  }
  return out;
}

// ---------- Kế hoạch so với thực tế theo bãi nhỏ (Tổng quan › Quản lý kho bãi) ----------
// Kế hoạch lấy từ bảng kho_ke_hoach (tab Kế hoạch Xuất/Nhập tồn của trang Kho): mỗi dòng là khối lượng nhập hoặc xuất của một bãi nhỏ trong một tháng.
// Kỳ ngắn hơn tháng (ngày) lấy kế hoạch tháng chia theo số ngày của tháng; kỳ dài hơn (quý) cộng các tháng.
// Bãi nhỏ của dòng kế hoạch: theo khóa khu_key, không còn thì theo tên bãi + tên bãi nhỏ.
export function khuCuaKeHoach(r, dong) {
  return dong.find((d) => d.key === r.khu_key) || dong.find((d) => !d.saiBai && plain(d.ten_bai) === plain(r.ten_bai) && plain(d.ten) === plain(r.ten_khu)) || null;
}
// Kế hoạch nhập / xuất của từng bãi nhỏ trong khoảng [tu, den) (ms). Trả { khu: Map(khóa bãi nhỏ -> { nhap, xuat }), mat: số dòng kế hoạch không còn bãi nhỏ tương ứng }
export function keHoachKhuTheoKy(keHoach, dong, tu, den) {
  const a = ngayStr(tu), z = ngayStr(den - 1), khu = new Map();
  let mat = 0;
  for (const r of keHoach || []) {
    const nd = ngayCuaKeHoach(r), ty = nd.filter((n) => n >= a && n <= z).length / nd.length; // kế hoạch ngày / tuần / tháng / năm: phần của kỳ nằm trong [tu, den)
    if (!ty) continue;
    const d = khuCuaKeHoach(r, dong);
    if (!d) { mat++; continue; }
    const o = khu.get(d.key) || { nhap: 0, xuat: 0 };
    o[r.huong === "xuat" ? "xuat" : "nhap"] += (+r.khoi_luong || 0) * ty; khu.set(d.key, o);
  }
  return { khu, mat };
}
// Nhập / xuất thực tế của từng bãi nhỏ trong khoảng [tu, den) theo sổ kho (không tính điều chuyển giữa các bãi). gan(bãi, hàng) -> khóa bãi nhỏ
export function thucTeKhuTheoKy(giaoDich, gan, tu, den) {
  const a = ngayStr(tu), z = ngayStr(den - 1), khu = new Map();
  for (const g of giaoDich) {
    const n = String(g.ngay).slice(0, 10);
    if (n < a || n > z || (g.loai !== "nhap" && g.loai !== "xuat")) continue;
    const k = gan(g.ten_bai, g.hang, g.ten_khu), o = khu.get(k) || { nhap: 0, xuat: 0 };
    o[g.loai] += +g.so_luong; khu.set(k, o);
  }
  return khu;
}
// Tồn cuối ngày (ms: đầu ngày cần xem) của một bãi nhỏ, đi lùi từ tồn hiện tại theo sổ; ngày từ hôm nay trở đi thì là tồn hiện tại
export function tonCuoiNgayKhu(d, giaoDich, gan, ngay, now = Date.now()) {
  const d0 = new Date(now), homNay = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate()).getTime();
  if (ngay >= homNay) return d.ton;
  const n = Math.round((homNay - ngay) / DAY) + 1;
  return tonTheoNgay(d.ton, giaoDich, (b, h, k) => gan(b, h, k) === d.key, n, now)[0][1];
}
// So sánh kế hoạch với thực tế của các bãi nhỏ trong kỳ [tu, den): nhập, xuất, tồn cuối kỳ.
// Tồn kế hoạch cuối kỳ = tồn đầu kỳ (thực tế; kỳ ở tương lai thì tồn hiện tại cộng kế hoạch từ giờ đến đầu kỳ) + nhập kế hoạch − xuất kế hoạch.
// Kỳ chưa kết thúc: nhập / xuất / tồn thực tế mới tính đến hôm nay (dangDienRa = true).
// Chỉ lấy bãi nhỏ có kế hoạch trong kỳ hoặc có nhập / xuất / tồn; bãi nhỏ "sai bãi" (hàng không bãi nhỏ nào nhận) bỏ qua.
export function soSanhKhoTheoKhu({ dong = [], keHoach = [], giaoDich = [], gan, tu, den, now = Date.now() }) {
  const d0 = new Date(now), homNay = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate()).getTime();
  const ds = dong.filter((d) => !d.saiBai);
  const kh = keHoachKhuTheoKy(keHoach, ds, tu, den), tt = thucTeKhuTheoKy(giaoDich, gan, tu, den);
  const khTruoc = tu > homNay ? keHoachKhuTheoKy(keHoach, ds, now, tu).khu : new Map(); // kỳ ở tương lai: kế hoạch từ giờ đến đầu kỳ
  const dangDienRa = den - DAY > homNay - 1; // ngày cuối của kỳ chưa qua
  const rows = ds.map((d) => {
    const a = kh.khu.get(d.key) || { nhap: 0, xuat: 0 }, t = tt.get(d.key) || { nhap: 0, xuat: 0 }, tr = khTruoc.get(d.key) || { nhap: 0, xuat: 0 };
    const tonDau = tu > homNay ? d.ton + tr.nhap - tr.xuat : tonCuoiNgayKhu(d, giaoDich, gan, tu - DAY, now);
    return {
      key: d.key, ten_bai: d.ten_bai, ten: d.ten, loai: d.loai, nhapKH: a.nhap, nhapTT: t.nhap, xuatKH: a.xuat, xuatTT: t.xuat,
      tonDau, tonKH: tonDau + a.nhap - a.xuat, tonTT: dangDienRa ? d.ton : tonCuoiNgayKhu(d, giaoDich, gan, den - DAY, now), coKH: !!kh.khu.get(d.key),
    };
  });
  return { rows, matKH: kh.mat, dangDienRa };
}

// ---------- Trang Khai thác kho bãi: 4 tab (12–13/11/2026, anh Sỹ chốt) ----------
// Overview = sơ đồ mọi kho / bãi theo khu vực; ba tab kho chia theo loại hàng:
//   Kho HRC          = thành phẩm thuộc nhóm HRC (hàng có chữ HRC: "Thép cuộn HRC");
//   Kho Thanh/Cuộn   = các thành phẩm còn lại (thép thanh, thép cuộn, cuộn CLC, phôi, slab, hàng bao…);
//   Kho Nguyên liệu  = mọi kho / bãi nguyên liệu.
// Muốn đổi cách chia thì sửa laHRC / TAB_KHO tại đây.
export const TAB_KHO = [
  { id: "overview", ten: "Overview" },
  { id: "hrc", ten: "Kho HRC", loai: "thanh_pham", kieu: "hrc" },
  { id: "thanh-cuon", ten: "Kho Thanh/Cuộn", loai: "thanh_pham", kieu: "khac" },
  { id: "nguyen-lieu", ten: "Kho Nguyên liệu", loai: "nguyen_lieu" },
];
export const laHRC = (hang, hangHoa = []) => /\bhrc\b/.test(plain(nhomCua(hang, hangHoa) || "")) || /\bhrc\b/.test(plain(hang));
// Bản sao của kho tổng hợp chỉ gồm gian / lô, tồn, lô của một tab (các thành phần biểu đồ / hộp thao tác dùng nguyên không cần sửa).
// Gian / lô chưa có hàng nào (bãi tự do còn trống) hiện ở mọi tab cùng loại kho.
export function locKhoTheoTab(kho, tab) {
  if (!kho || !tab?.loai) return kho;
  const hh = kho.hangHoa || [];
  const khop = (hang) => !tab.kieu || laHRC(hang, hh) === (tab.kieu === "hrc");
  const dongOk = (d) => { const hs = [d.hang, ...(d.chua || []).map((c) => c.hang)].filter(Boolean); return !hs.length || hs.some(khop); };
  const dong = kho.dong.filter((d) => d.loai === tab.loai && dongOk(d)), key = new Set(dong.map((d) => d.key));
  return {
    ...kho, dong, dongAll: kho.dong, // dongAll: mọi gian / lô (để biết dòng kế hoạch thuộc tab khác, không báo nhầm "bãi đã xóa")
    cap: kho.cap.filter((c) => c.loai === tab.loai && (key.has(c.key) || khop(c.hang)) && khop(c.hang)),
    lo: kho.lo.filter((l) => khop(l.hang)),
  };
}
