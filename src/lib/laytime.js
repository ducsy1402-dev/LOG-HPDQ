// Dự toán thưởng phạt tàu theo quy định của công ty (số DỰ TOÁN, mọi thông số đặt theo từng chuyến / hợp đồng).
//
// A. Tính theo LAYTIME (kieu_tp = "laytime")
//   - Thời gian cho phép (laytime) = KL ÷ CAM KẾT (tấn/ngày), tính cả giờ lẻ.
//   - Bắt đầu tính (moc_tinh_tp) theo hợp đồng: NOR + 12h | NOR + 24h | 8h ngày kế tiếp sau ngày trao NOR | giờ nhập tay | …
//     Nếu tàu bắt đầu làm hàng SỚM hơn mốc đó thì laytime tính từ lúc bắt đầu làm hàng. Chủ nhật, ngày lễ vẫn tính bình thường.
//   - Thời gian đình trệ cho phép (không tính vào laytime): các khoảng dừng đánh dấu "trừ laytime"
//     và các khoảng dừng được đánh dấu "trừ" (thời tiết xấu…). CHỈ trừ khi còn trong laytime: hết laytime thì không trừ nữa.
//   - Hết laytime mà chưa xong: phạt = thời gian quá × đơn giá phạt (DEM, tiền / ngày).
//     Xong trước khi hết laytime: thưởng = thời gian tiết kiệm × đơn giá phạt × 50% (ty_le_thuong).
//     VD phạt 25.000 USD/ngày, xong sớm 1 ngày -> thưởng 12.500 USD.
// B. Tính theo CQD (kieu_tp = "cqd"): không có laytime.
//   - Cộng các khoảng trống máng (khoảng dừng đánh dấu "trống máng") trong lúc làm hàng; phần vượt ngưỡng cho phép (cqd_nguong_gio)
//     × đơn giá phạt (tiền / ngày, tính giờ lẻ). Không có thưởng.
import { ms, HOUR, DAY } from "./format";
import { chiSo, khoangGop } from "./linetime";

export const KIEU_TP = [["laytime", "Laytime (thời gian cho phép)"], ["cqd", "CQD (trống máng lâu là phạt)"]];
export const MOC_TP = [
  ["nor_12h", "NOR + 12 giờ"],
  ["nor_24h", "NOR + 24 giờ"],
  ["nor_8h", "8h ngày kế tiếp sau ngày trao NOR"],
  ["nor", "Ngay khi trao NOR"],
  ["atb", "Cập bến (ATB)"],
  ["bd_lam_hang", "Bắt đầu làm hàng"],
  ["tay", "Nhập giờ tay (theo phiếu tàu)"],
];
export const MOC_MAC_DINH = "nor_12h";
export const TY_LE_THUONG = 0.5;
export const DON_VI_TIEN = [["USD", "USD"], ["VND", "VNĐ"]];
export const KICH_BAN = [
  { k: "nhanh", ten: "Nhanh", heSo: 1.2 },
  { k: "co_so", ten: "Cơ sở", heSo: 1 },
  { k: "cham", ten: "Chậm", heSo: 0.8 },
];
export const laCQD = (v) => v?.kieu_tp === "cqd";
export const tenMoc = (k) => MOC_TP.find((x) => x[0] === (k || MOC_MAC_DINH))?.[1] || k;

// Mốc bắt đầu tính laytime. Trả { t, ten, tam } hoặc null. tam = đang tạm tính vì thiếu mốc.
export function mocBatDau(v) {
  const k = v.moc_tinh_tp || MOC_MAC_DINH;
  const bd = ms(v.bd_lam_hang), nor = ms(v.nor);
  let t = null, ten = tenMoc(k), tam = false;
  if (k === "tay") {
    if (v.tg_tinh_tp) return { t: ms(v.tg_tinh_tp), ten: "Giờ nhập tay" };
  } else if (k.startsWith("nor")) {
    if (nor != null) {
      if (k === "nor") t = nor;
      else if (k === "nor_12h") t = nor + 12 * HOUR;
      else if (k === "nor_24h") t = nor + 24 * HOUR;
      else { const d = new Date(nor); t = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 8, 0).getTime(); }
    }
  } else if (v[k]) t = ms(v[k]);
  if (t == null) {
    // Thiếu mốc đã chọn: tạm tính từ lúc cập bến (hoặc bắt đầu làm hàng)
    const tt = ms(v.atb) ?? bd;
    if (tt == null) return null;
    return { t: tt, ten: `${ms(v.atb) != null ? "ATB" : "Bắt đầu làm hàng"} (chưa có ${k === "tay" ? "giờ nhập tay" : k.startsWith("nor") ? "NOR" : "mốc đã chọn"})`, tam: true };
  }
  // Làm hàng sớm hơn mốc hợp đồng: laytime tính từ lúc bắt đầu làm hàng (không sớm hơn lúc trao NOR)
  if (bd != null && bd < t && k.startsWith("nor_")) { t = Math.max(bd, nor ?? bd); ten = `Bắt đầu làm hàng (sớm hơn ${tenMoc(k)})`; }
  return { t, ten, tam };
}

// Các khoảng được trừ khỏi laytime: khoảng dừng đánh dấu trừ
export function khoangTru(v, stops, tu, den) {
  const ds = [...(stops || []).filter((s) => s.tru_tp)];
  return khoangGop(ds, tu, den);
}

// Thời điểm hết laytime: đi từ mốc bắt đầu, bỏ qua các khoảng được trừ, cho đến khi dùng hết thời gian cho phép
export function hetLaytime(batDau, choPhepMs, tru) {
  let t = batDau, con = choPhepMs;
  for (const [a, b] of tru) {
    if (b <= t) continue;
    if (a > t) { if (a - t >= con) return t + con; con -= a - t; }
    t = Math.max(t, b);
  }
  return t + con;
}

// Giờ kết thúc làm hàng: thực tế, hoặc dự báo với năng suất rate (tấn/ngày) cho phần còn lại
function ketThucDuBao(v, cs, rate, now) {
  if (v.kt_lam_hang) return ms(v.kt_lam_hang);
  if (!(rate > 0)) return null;
  const moc = ms(v.bd_lam_hang) ?? ms(v.atb) ?? ms(v.etb) ?? ms(v.eta);
  if (moc == null) return null;
  return Math.max(now, moc) + (cs.conLai / rate) * DAY;
}

// Quy tiền theo số ngày chênh: âm = phạt, dương = thưởng (tỷ lệ thưởng × đơn giá phạt)
function quyTien(chenhNgay, tien) {
  if (chenhNgay == null || !tien || !(+tien.don_gia > 0)) return null;
  const tl = tien.ty_le_thuong != null && tien.ty_le_thuong !== "" ? +tien.ty_le_thuong : TY_LE_THUONG;
  const dv = tien.don_vi_tien || "USD";
  return chenhNgay < 0 ? { phat: -chenhNgay * +tien.don_gia, thuong: 0, dv } : { phat: 0, thuong: chenhNgay * +tien.don_gia * tl, dv };
}

// tien: { don_gia (tiền / ngày), ty_le_thuong, don_vi_tien } hoặc null nếu người xem không có quyền xem tiền
export function duToan(v, stops = [], tien = null, now = Date.now()) {
  const cs = chiSo(v, stops, now);
  if (laCQD(v)) return duToanCQD(v, stops, tien, now, cs);
  const kl = +v.khoi_luong || 0, camKet = +v.cam_ket || 0;
  const bd = mocBatDau(v);
  const out = { kieu: "laytime", cs, batDau: bd, choPhepNgay: null, han: null, loaiTruGio: 0, ketThuc: null, duBao: !v.kt_lam_hang, daDungNgay: null, chenhNgay: null, nangSuatToiThieu: null, kichBan: [], tien: null, thieu: [] };
  if (!(kl > 0)) out.thieu.push("khối lượng");
  if (!(camKet > 0)) out.thieu.push("cam kết");
  if (!bd) out.thieu.push("mốc bắt đầu (NOR hoặc ATB)");
  if (out.thieu.length) return out;

  out.choPhepNgay = kl / camKet;
  const choPhepMs = out.choPhepNgay * DAY;
  const rateCoSo = cs.nangSuat > 0 ? cs.nangSuat : camKet; // năng suất thực nếu đã làm hàng, không thì cam kết
  // Hạn hết laytime: tính với các khoảng được trừ đã biết (đến lúc xong hàng hoặc hiện tại)
  const tinh = (rate) => {
    const kt = ketThucDuBao(v, cs, rate, now);
    if (kt == null) return null;
    const tru = khoangTru(v, stops, bd.t, kt);
    const han = hetLaytime(bd.t, choPhepMs, tru);
    const chenh = (han - kt) / DAY; // dương: xong trước hạn (thưởng); âm: quá hạn (phạt)
    // Giờ được trừ thực sự: phần nằm trong laytime (trước khi xong hàng và trước khi hết laytime)
    const loaiTru = tru.reduce((h, [a, b]) => h + Math.max(0, Math.min(b, kt, han) - a) / HOUR, 0);
    return { ketThuc: kt, han, loaiTruGio: loaiTru, chenhNgay: chenh, daDungNgay: out.choPhepNgay - chenh };
  };
  const coSo = tinh(rateCoSo);
  if (coSo) Object.assign(out, coSo);
  else out.han = hetLaytime(bd.t, choPhepMs, khoangTru(v, stops, bd.t, now));
  if (!v.kt_lam_hang && cs.conLai > 0) {
    const conNgay = (out.han - Math.max(now, ms(v.bd_lam_hang) ?? ms(v.atb) ?? now)) / DAY;
    out.nangSuatToiThieu = conNgay > 0 ? cs.conLai / conNgay : Infinity; // Infinity = đã hết laytime, không kịp
  }
  out.kichBan = v.kt_lam_hang ? [] : KICH_BAN.map((k) => ({ ...k, rate: rateCoSo * k.heSo, ...tinh(rateCoSo * k.heSo) }));
  if (tien) {
    out.tien = quyTien(out.chenhNgay, tien);
    out.kichBan = out.kichBan.map((k) => ({ ...k, tien: quyTien(k.chenhNgay, tien) }));
  }
  return out;
}

// CQD: giờ trống máng (khoảng dừng đánh dấu trong_mang) trong lúc làm hàng, phần vượt ngưỡng bị phạt
function duToanCQD(v, stops, tien, now, cs) {
  const tu = ms(v.bd_lam_hang) ?? ms(v.atb), den = ms(v.kt_lam_hang) ?? now;
  const nguong = +v.cqd_nguong_gio || 0;
  const trong = tu == null ? 0 : khoangGop(stops, tu, den, (s) => s.trong_mang).reduce((h, [a, b]) => h + (b - a) / HOUR, 0);
  const vuot = Math.max(0, trong - nguong);
  const out = { kieu: "cqd", cs, trongMangGio: trong, nguongGio: nguong, vuotGio: vuot, conLaiGio: Math.max(0, nguong - trong), chenhNgay: -vuot / 24, kichBan: [], tien: null, thieu: tu == null ? ["giờ cập bến / bắt đầu làm hàng"] : [] };
  if (tien && +tien.don_gia > 0) out.tien = { phat: (vuot / 24) * +tien.don_gia, thuong: 0, dv: tien.don_vi_tien || "USD" };
  return out;
}

// ETD không khả thi: (ETD − ATB) × CAM KẾT < KL còn phải làm. Trả về năng suất cần đạt (tấn/ngày) hoặc null nếu khả thi.
export function etdKhongKhaThi(v, now = Date.now()) {
  const etd = ms(v.etd), camKet = +v.cam_ket || 0, kl = +v.khoi_luong || 0;
  if (laCQD(v) || !etd || !(camKet > 0) || !(kl > 0) || v.kt_lam_hang || v.atd) return null;
  const cs = chiSo(v, [], now);
  if (!(cs.conLai > 0)) return null; // đã làm đủ khối lượng
  const tu = v.bd_lam_hang ? Math.max(now, ms(v.bd_lam_hang)) : ms(v.atb) ?? ms(v.etb);
  if (tu == null) return null;
  const ngayCon = (etd - tu) / DAY;
  const can = ngayCon > 0 ? cs.conLai / ngayCon : Infinity;
  return can > camKet ? { can, ngayCon, quaEtd: ngayCon <= 0, conLai: cs.conLai } : null;
}
