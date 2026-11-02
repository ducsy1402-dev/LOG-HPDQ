// Tiện ích ngày tháng (định dạng Việt Nam dd/mm/yyyy) và số liệu
export const pad = (n) => String(n).padStart(2, "0");
export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => iso(new Date());
export const addDays = (s, n) => { const d = new Date(s + "T00:00:00"); d.setDate(d.getDate() + n); return iso(d); };
export const diffDays = (a, b) => Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 864e5);
export const vn = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : "");
export const vnShort = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : "");
export const THU = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
export const thu = (s) => THU[new Date(s + "T00:00:00").getDay()];
export const pct = (x, d = 0) => (Number.isFinite(x) ? (x * 100).toFixed(d).replace(".", ",") + "%" : "–");
export const fmt = (n, d = 0) => (n == null || !Number.isFinite(+n) ? "–" : (+n).toLocaleString("vi-VN", { maximumFractionDigits: d }));
export const signed = (n) => (n == null ? "–" : n > 0 ? `+${n}` : String(n));

export const uniq = (a) => [...new Set(a.filter((x) => x != null && x !== ""))].sort((x, y) => String(x).localeCompare(String(y), "vi"));
export const sortBy = (order) => (a, b) => {
  const ia = order.indexOf(a), ib = order.indexOf(b);
  return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || String(a).localeCompare(String(b), "vi");
};
export const countBy = (arr, fn) => arr.reduce((m, x) => { const k = fn(x); m[k] = (m[k] || 0) + 1; return m; }, {});
export const groupBy = (arr, fn) => arr.reduce((m, x) => { const k = fn(x); (m[k] ||= []).push(x); return m; }, {});

// Bỏ dấu tiếng Việt, dùng cho tìm kiếm và đọc tiêu đề cột khi import
export const plain = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim();
export const matchQ = (q, ...fields) => !q || plain(fields.join(" ")).includes(plain(q));

// Tên tổ ngắn gọn cho biểu đồ: "Tổ MCT Tuyển xỉ" -> "MCT Tuyển xỉ"
export const shortTo = (s) => String(s || "(trống)").replace(/^Tổ\s+/i, "");

// Mã model (token đầu tiên có chữ số), dùng để khớp xe với bảng thông số
export const maModel = (s) => {
  const t = String(s || "").split(/\s+/).find((w) => /\d/.test(w));
  return t ? t.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "").toUpperCase() : null;
};
