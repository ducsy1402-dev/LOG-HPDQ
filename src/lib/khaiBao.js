// Trạng thái khai báo của một chuyến tàu, theo người phụ trách:
//   - Cầu bến (tàu & lịch cập): bến, ETB, khối lượng, số máng
//   - Lập phương án: chưa khai → sơ bộ (bãi / vận chuyển / vét – be hầm ghi ở chuyến) → đang lập (có phương án) → đã duyệt
export const TT_PA = {
  chua: { ten: "Chưa khai PA", ngan: "PA: chưa", tone: "default" },
  so_bo: { ten: "PA sơ bộ", ngan: "PA: sơ bộ", tone: "info" },
  lap: { ten: "Đang lập PA", ngan: "PA: đang lập", tone: "warn" },
  duyet: { ten: "PA đã duyệt", ngan: "PA: duyệt", tone: "ok" },
};

export function khaiBao(v, plans = [], { coSql19 = true } = {}) {
  const thieuCB = [!v.ben_ma && "bến", !v.etb && "ETB", !(+v.khoi_luong > 0) && "khối lượng", coSql19 && v.so_mang == null && "số máng"].filter(Boolean);
  const ps = (plans || []).filter((p) => p.trang_thai !== "huy");
  const phuongAn = ps.some((p) => p.trang_thai === "duyet") ? "duyet" : ps.length ? "lap"
    : v.bai_hang || (v.xe_van_chuyen || []).length || v.vet_ham || v.be_ham ? "so_bo" : "chua";
  return { thieuCB, cauBen: thieuCB.length ? "thieu" : "du", phuongAn };
}
