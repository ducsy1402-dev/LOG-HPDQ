// Cảnh báo của phân hệ Cảng: mốc giờ, laytime, khối lượng (không còn cảnh báo tàu - bến, trùng bến, năng suất: anh Sỹ chốt 14/11/2026).
// Mức: "bad" (đỏ), "warn" (vàng), "info" (xanh, lưu ý).
import { plain, so, met, thoiLuong, ms } from "./format";
import { chiSo, mocSaiThuTu, trangThai } from "./linetime";

export const NGUONG_MAC_DINH = { nangSuatTyLe: 0.9 };

// Tìm bến theo mã hoặc tên khác (B01, BTL, TL…)
export function timBen(berths, x) {
  if (x == null || x === "") return null;
  const p = plain(x).replace(/\s+/g, "").replace(/^ben/, "");
  const so0 = p.replace(/^b0*(?=\d)/, "");
  return berths.find((b) => [b.ma, ...(b.ten_khac || [])].some((t) => { const q = plain(t).replace(/\s+/g, ""); return q === p || q === so0; })) || null;
}

// Toàn bộ cảnh báo của một chuyến. ctx: { berths, trung (Map), stops, tien, nguong, now }
export function canhBaoChuyen(v, ctx) {
  const { stops = [], tien = null, nguong = NGUONG_MAC_DINH, now = Date.now(), plansOf, coSql15, coSql19 } = ctx;
  const st = trangThai(v);
  if (st === "huy") return [];
  const out = [];
  if (st === "da_roi") return out; // tàu đã rời: không còn cảnh báo
  const cs = chiSo(v, stops, now);
  if (st === "lam_hang" && +v.khoi_luong > 0 && cs.conLai <= 0) out.push({ muc: "warn", ma: "chua_kt", nd: "Đã làm đủ khối lượng nhưng chưa ghi giờ kết thúc làm hàng (laytime đang tính đến hiện tại)" });
  if (cs.hoanTat != null && cs.hoanTat > 1.0001) out.push({ muc: "info", ma: "vuot", nd: `Khối lượng đã làm vượt kế hoạch (${so(cs.hoanTat * 100, 2)}%)` });
  for (const s of mocSaiThuTu(v)) out.push({ muc: "warn", ma: "thu_tu", nd: `Mốc giờ sai thứ tự: ${s}` });
  if (v.kieu_tp !== "cqd" && v.atb && !v.nor && (v.moc_tinh_tp || "nor_12h").startsWith("nor")) out.push({ muc: "info", ma: "nor", nd: "Chưa có NOR: laytime tạm tính từ ATB" });
  if (!v.ben_ma) out.push({ muc: "info", ma: "ben", nd: "Chưa xếp bến" });
  if (v.kieu_tp !== "cqd" && !(+v.cam_ket > 0) && st !== "du_kien") out.push({ muc: "info", ma: "cam_ket", nd: v.cam_ket_ghi_chu ? `Cam kết dạng chữ "${v.cam_ket_ghi_chu}", chưa tính laytime` : "Chưa có cam kết xếp dỡ" });
  return out;
}

const THU_TU_MUC = { bad: 0, warn: 1, info: 2 };
// Danh sách cảnh báo đang mở cho chuông: các chuyến chưa rời
export function canhBaoMo(voyages, ctx) {
  const out = [];
  for (const v of voyages) {
    const st = trangThai(v);
    if (st === "huy" || st === "da_roi") continue;
    for (const c of canhBaoChuyen(v, { ...ctx, stops: ctx.stopsOf?.(v.id) || [], tien: ctx.tienOf?.(v.id) || null }))
      if (c.muc !== "info") out.push({ ...c, id: `${v.id}:${c.ma}`, voyage: v });
  }
  return out.sort((a, b) => THU_TU_MUC[a.muc] - THU_TU_MUC[b.muc]);
}
