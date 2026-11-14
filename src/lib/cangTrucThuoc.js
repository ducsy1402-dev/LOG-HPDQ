// "Cảng trực thuộc" của bến: cột tự thêm ở Danh mục › Cầu bến › Danh sách bến (nút Thêm cột, SQL 18; giá trị nằm trong berths.them).
// Chuyến tàu thuộc cảng của bến mà nó cập (ben_ma). Dùng cho thẻ tàu ở Mục tiêu sản lượng và biểu đồ cơ cấu sản lượng theo cảng ở Tổng quan.
import { plain } from "./format";

export const KHONG_CANG = "(chưa khai báo)";

// Cột "Cảng trực thuộc" trong danh sách cột tự thêm (khớp theo tên, không phân biệt dấu / hoa thường); null nếu chưa có
export const cotCangTrucThuoc = (dmCot) => (dmCot || []).find((c) => c.bang === "ben" && /truc thuoc/.test(plain(c.ten))) || null;

// Hàm (chuyến) -> tên cảng trực thuộc ("(chưa khai báo)" nếu bến chưa ghi cảng hoặc chuyến chưa có bến); null nếu chưa có cột nào để tra
export function cangCuaChuyen(dmCot, berths) {
  const c = cotCangTrucThuoc(dmCot);
  if (!c) return null;
  const m = new Map((berths || []).map((b) => [String(b.ma), String(b.them?.[c.ma] ?? "").trim()]));
  return (v) => m.get(String(v?.ben_ma ?? "")) || KHONG_CANG;
}

// Gom danh sách chuyến theo cảng: [[tên cảng, [chuyến]]], cảng nhiều tàu trước, "(chưa khai báo)" cuối
export function gomTheoCang(ds, cang) {
  const m = new Map();
  for (const v of ds || []) { const k = cang(v); if (!m.has(k)) m.set(k, []); m.get(k).push(v); }
  return [...m].sort((a, b) => (a[0] === KHONG_CANG) - (b[0] === KHONG_CANG) || b[1].length - a[1].length || a[0].localeCompare(b[0], "vi"));
}
