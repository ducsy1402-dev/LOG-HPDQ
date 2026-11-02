// Sao lưu toàn bộ dữ liệu Logistics đang tải ra một file Excel (mỗi bảng một sheet).
// Supabase gói miễn phí tạm dừng project sau 7 ngày không dùng: nên xuất định kỳ.
import { pad } from "./format";

export async function saoLuuExcel(api, D, quyen) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const sheet = (ten, rows) => {
    const sach = rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Array.isArray(v) ? v.join("; ") : v && typeof v === "object" ? JSON.stringify(v) : v])));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sach.length ? sach : [{ "(trống)": "" }]), ten);
  };
  sheet("voyages", D.voyages);
  sheet("voyage_stops", D.stops);
  sheet("voyage_events", await api.loadEventsMany(D.voyages.map((v) => v.id)));
  sheet("berths", D.berths);
  sheet("vessels", D.vessels);
  sheet("agents", D.agents);
  sheet("kho_bai", D.khoBai);
  if (D.mucTieu) sheet("muc_tieu_san_luong", D.mucTieu);
  const d = new Date();
  XLSX.writeFile(wb, `Sao_luu_Logistics_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}.xlsx`);
}
