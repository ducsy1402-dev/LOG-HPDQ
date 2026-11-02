// Cảnh báo của phân hệ Cảng: tàu - bến, trùng bến, ETD không khả thi, năng suất, chờ neo, mốc giờ.
// Mức: "bad" (đỏ), "warn" (vàng), "info" (xanh, lưu ý).
import { plain, so, thoiLuong, ms } from "./format";
import { chiSo, mocSaiThuTu, trangThai } from "./linetime";
import { choBenTheoChuyen, nhanCho, laBenLienKe } from "./capBen";
import { duToan, etdKhongKhaThi } from "./laytime";
import { khaiBao } from "./khaiBao";

export const NGUONG_MAC_DINH = { choNeoGio: 48, nangSuatTyLe: 0.9, khaiBaoGio: 72 };

// Tìm bến theo mã hoặc tên khác (B01, BTL, TL…)
export function timBen(berths, x) {
  if (x == null || x === "") return null;
  const p = plain(x).replace(/\s+/g, "").replace(/^ben/, "");
  const so0 = p.replace(/^b0*(?=\d)/, "");
  return berths.find((b) => [b.ma, ...(b.ten_khac || [])].some((t) => { const q = plain(t).replace(/\s+/g, ""); return q === p || q === so0; })) || null;
}

// Tàu so với giới hạn bến. Giới hạn ghi "≤" (mon_cung) là giới hạn cứng -> đỏ.
// Tàu cập hai bến liền nhau (bPhu = bến phụ): DWT và mớn phải đạt cả hai bến; LOA so với tổng chiều dài hai bến.
// berths (nếu có) để kiểm tra bến phụ có liền kề bến chính không.
export function kiemTraBen(v, b, bPhu = null, berths = null) {
  const out = [];
  if (!b) return out;
  if (bPhu && berths && !laBenLienKe(berths, b.ma, bPhu.ma)) { out.push({ muc: "warn", ma: "ben_phu", nd: `Bến phụ ${bPhu.ma} không liền kề bến ${b.ma}: chưa tính tàu cập hai bến` }); bPhu = null; }
  for (const x of bPhu ? [b, bPhu] : [b]) {
    if (+v.dwt > 0 && +x.dwt_max > 0 && +v.dwt > +x.dwt_max) out.push({ muc: "bad", ma: "dwt", nd: `DWT ${so(v.dwt)} vượt trọng tải bến ${x.ma} (${so(x.dwt_max)})` });
    if (+v.draft > 0 && +x.mon_max > 0 && +v.draft > +x.mon_max) out.push({ muc: x.mon_cung ? "bad" : "warn", ma: "mon", nd: `Mớn ${so(v.draft, 2)} m vượt mớn bến ${x.ma} (${x.mon_cung ? "≤" : ""}${so(x.mon_max, 2)} m${x.mon_cung ? ", giới hạn cứng" : ""})` });
  }
  if (bPhu) {
    const dai = +b.loa_max + +bPhu.loa_max;
    if (+v.loa > 0 && +b.loa_max > 0 && +bPhu.loa_max > 0 && +v.loa > dai) out.push({ muc: "warn", ma: "loa", nd: `LOA ${so(v.loa, 1)} m dài hơn hai bến ${b.ma} + ${bPhu.ma} (${so(dai, 1)} m)` });
  } else if (+v.loa > 0 && +b.loa_max > 0 && +v.loa > +b.loa_max) out.push({ muc: "warn", ma: "loa", nd: `LOA ${so(v.loa, 1)} m dài hơn bến ${b.ma} (${so(b.loa_max, 1)} m)` });
  const hang = plain(v.loai_hang || v.ten_hang);
  if (hang && b.loai_hang) {
    const ds = plain(b.loai_hang).split(/[,;/]+/).map((s) => s.trim()).filter(Boolean);
    const khop = ds.some((h) => hang.includes(h) || h.includes(hang) || h.split(" ").some((w) => w.length > 2 && hang.split(" ").includes(w)));
    if (!khop) out.push({ muc: "info", ma: "hang", nd: `Hàng "${v.loai_hang || v.ten_hang}" không có trong danh mục hàng của bến ${b.ma} (${b.loai_hang})` });
  }
  return out;
}

// Chuyến không đủ chỗ ở bến cùng lúc: Map id -> [khoảng không đủ chỗ] (số mét theo quy tắc cập cầu bến, xem capBen.js).
// Hai tàu cùng bến cùng lúc vẫn được nếu đủ số mét; thiếu LOA / chiều dài bến thì không tính được và báo trùng bến như cũ.
export function trungBen(voyages, now = Date.now(), stopsOf = () => [], berths = []) {
  return choBenTheoChuyen(voyages, berths, stopsOf, now);
}

// Toàn bộ cảnh báo của một chuyến. ctx: { berths, trung (Map), stops, tien, nguong, now }
export function canhBaoChuyen(v, ctx) {
  const { berths = [], trung, stops = [], tien = null, nguong = NGUONG_MAC_DINH, now = Date.now(), plansOf, coSql15, coSql19 } = ctx;
  const st = trangThai(v);
  if (st === "huy") return [];
  const out = [];
  out.push(...kiemTraBen(v, berths.find((b) => b.ma === v.ben_ma), v.ben_phu ? berths.find((b) => b.ma === v.ben_phu) : null, berths));
  for (const t of trung?.get(v.id) || []) out.push({ muc: "warn", ma: "trung", nd: nhanCho(t, v) });
  if (st === "da_roi") return out; // tàu đã rời: chỉ còn lưu ý tàu - bến, trùng bến
  const cs = chiSo(v, stops, now);
  const etd = etdKhongKhaThi(v, now);
  if (etd) out.push({ muc: "bad", ma: "etd", nd: etd.quaEtd
    ? `Đã quá ETD mà còn ${so(etd.conLai)} t chưa làm: cần cập nhật ETD hoặc KL đã làm`
    : `ETD không khả thi: còn ${thoiLuong(etd.ngayCon * 24)} phải làm ${so(etd.conLai)} t, cần ${so(etd.can)} t/ngày (cam kết ${so(v.cam_ket)})` });
  if (st === "lam_hang" && cs.nangSuat != null && +v.cam_ket > 0 && cs.lamHangThuc >= 6 && cs.nangSuat < +v.cam_ket * nguong.nangSuatTyLe)
    out.push({ muc: "warn", ma: "nang_suat", nd: `Năng suất thực ${so(cs.nangSuat)} t/ngày thấp hơn cam kết ${so(v.cam_ket)}` });
  if (st === "lam_hang" || st === "cap_ben" || st === "cho_neo") {
    const dt = duToan(v, stops, tien, now);
    if (dt.kieu === "cqd") {
      if (dt.vuotGio > 0) out.push({ muc: "bad", ma: "phat", nd: `CQD: trống máng ${thoiLuong(dt.trongMangGio)}, vượt ngưỡng ${thoiLuong(dt.nguongGio) || "0 giờ"} là ${thoiLuong(dt.vuotGio)}: bị phạt` });
      else if (dt.nguongGio > 0 && dt.trongMangGio >= dt.nguongGio * 0.8) out.push({ muc: "warn", ma: "phat", nd: `CQD: trống máng ${thoiLuong(dt.trongMangGio)}, sắp chạm ngưỡng ${thoiLuong(dt.nguongGio)}` });
    } else if (dt.chenhNgay != null && dt.chenhNgay < 0) out.push({ muc: "bad", ma: "phat", nd: `Dự báo bị phạt: quá laytime ${thoiLuong(-dt.chenhNgay * 24)}` });
  }
  if (cs.choNeo != null && cs.choNeo > nguong.choNeoGio) out.push({ muc: "warn", ma: "cho_neo", nd: `Chờ neo ${thoiLuong(cs.choNeo)} (ngưỡng ${nguong.choNeoGio} giờ)` });
  if (st === "lam_hang" && +v.khoi_luong > 0 && cs.conLai <= 0) out.push({ muc: "warn", ma: "chua_kt", nd: "Đã làm đủ khối lượng nhưng chưa ghi giờ kết thúc làm hàng (thưởng phạt đang tính đến hiện tại)" });
  if (cs.hoanTat != null && cs.hoanTat > 1.0001) out.push({ muc: "info", ma: "vuot", nd: `Khối lượng đã làm vượt kế hoạch (${so(cs.hoanTat * 100, 2)}%)` });
  for (const s of mocSaiThuTu(v)) out.push({ muc: "warn", ma: "thu_tu", nd: `Mốc giờ sai thứ tự: ${s}` });
  if (v.kieu_tp !== "cqd" && v.atb && !v.nor && (v.moc_tinh_tp || "nor_12h").startsWith("nor")) out.push({ muc: "info", ma: "nor", nd: "Chưa có NOR: laytime tạm tính từ ATB" });
  if (!v.ben_ma) out.push({ muc: "info", ma: "ben", nd: "Chưa xếp bến" });
  // Tàu sắp cập (trong ngưỡng, mặc định 72 giờ tới ETB / ETA): nhắc cầu bến và người lập phương án còn thiếu khai báo
  if (st === "du_kien" || st === "cho_neo") {
    const moc = ms(v.etb || v.eta), con = moc != null ? (moc - now) / 36e5 : null;
    if (con != null && con <= (nguong.khaiBaoGio ?? 72)) {
      const kb = khaiBao(v, plansOf?.(v.id) || [], { coSql19 });
      const truoc = con > 0 ? `Còn ${thoiLuong(Math.round(con))} tới ${v.etb ? "ETB" : "ETA"}` : `Đã tới ${v.etb ? "ETB" : "ETA"}`;
      const muc = con <= 24 ? "bad" : "warn";
      if (kb.thieuCB.length) out.push({ muc, ma: "kb_cau_ben", nd: `${truoc}: cầu bến chưa khai báo ${kb.thieuCB.join(", ")}` });
    }
  }
  if (v.kieu_tp !== "cqd" && !(+v.cam_ket > 0) && st !== "du_kien") out.push({ muc: "info", ma: "cam_ket", nd: v.cam_ket_ghi_chu ? `Cam kết dạng chữ "${v.cam_ket_ghi_chu}", chưa tính thưởng phạt` : "Chưa có cam kết xếp dỡ" });
  return out;
}

const THU_TU_MUC = { bad: 0, warn: 1, info: 2 };
// Danh sách cảnh báo đang mở cho chuông: các chuyến chưa rời (và chuyến trùng bến)
export function canhBaoMo(voyages, ctx) {
  const trung = trungBen(voyages, ctx.now, ctx.stopsOf, ctx.berths);
  const out = [];
  for (const v of voyages) {
    const st = trangThai(v);
    if (st === "huy" || st === "da_roi") continue;
    for (const c of canhBaoChuyen(v, { ...ctx, trung, stops: ctx.stopsOf?.(v.id) || [], tien: ctx.tienOf?.(v.id) || null }))
      if (c.muc !== "info") out.push({ ...c, id: `${v.id}:${c.ma}`, voyage: v });
  }
  return out.sort((a, b) => THU_TU_MUC[a.muc] - THU_TU_MUC[b.muc]);
}
