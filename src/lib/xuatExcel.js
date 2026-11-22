// Xuất bảng ra file Excel (.xlsx) ngay trong trình duyệt (thư viện xlsx, tải khi bấm nút nên không làm nặng lần mở web).
// sheets = [{ ten: "Tên sheet", hang: [[ô, ô, …], …], rong: [độ rộng cột…] (tùy chọn) }]; số giữ dạng số, chữ giữ dạng chữ.
// opts: { toast, fail } của useApp để báo kết quả; trả về true khi xuất xong.
const sachTen = (t) => String(t || "Sheet").replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Sheet";
export async function xuatExcel(tenFile, sheets, opts = {}) {
  try {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new(), dung = new Set();
    for (const s of sheets) {
      let ten = sachTen(s.ten), i = 2; while (dung.has(ten.toLowerCase())) ten = `${sachTen(s.ten).slice(0, 28)} ${i++}`;
      dung.add(ten.toLowerCase());
      const ws = XLSX.utils.aoa_to_sheet(s.hang.map((r) => r.map((c) => (c === undefined ? "" : c))));
      const n = Math.max(0, ...s.hang.map((r) => r.length));
      ws["!cols"] = Array.from({ length: n }, (_, k) => ({ wch: s.rong?.[k] || Math.min(40, Math.max(10, ...s.hang.map((r) => String(r[k] ?? "").length + 2))) }));
      XLSX.utils.book_append_sheet(wb, ws, ten);
    }
    XLSX.writeFile(wb, `${tenFile}.xlsx`);
    opts.toast?.(`Đã xuất file ${tenFile}.xlsx`);
    return true;
  } catch (e) { opts.fail?.(e); return false; }
}
// dd/mm/yyyy từ yyyy-mm-dd
export const ngayVN = (n) => `${String(n).slice(8, 10)}/${String(n).slice(5, 7)}/${String(n).slice(0, 4)}`;
