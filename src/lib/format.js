// Định dạng số, ngày giờ, thời lượng kiểu Việt Nam. Thời gian lưu dạng ISO (timestamptz), hiển thị theo giờ máy.
export const HOUR = 3600e3;
export const DAY = 24 * HOUR;
export const pad = (n) => String(n).padStart(2, "0");

export const ms = (v) => (v == null || v === "" ? null : typeof v === "number" ? v : new Date(v).getTime());
export const iso = (t) => (t == null || Number.isNaN(t) ? null : new Date(t).toISOString());

const nf = (d) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: d, minimumFractionDigits: 0 });
const NF = [nf(0), nf(1), nf(2), nf(3)];
export const so = (v, d = 0) => (v == null || v === "" || Number.isNaN(+v) ? "" : NF[d].format(+v));
export const pct = (v, d = 0) => (v == null || !Number.isFinite(v) ? "" : NF[d].format(v * 100) + "%");
// Tiền theo đơn vị của chuyến: 12.500 USD / 12.345.678 ₫
export const tien = (v, dv = "USD") => (v == null || !Number.isFinite(v) ? "" : dv === "VND" ? NF[0].format(Math.round(v)) + " ₫" : NF[0].format(Math.round(v)) + " USD");
// Tiền rút gọn cho thẻ số: 1,25 tỷ ₫ / 340 tr ₫ / 125.000 USD
export const tienGon = (v, dv = "USD") => {
  if (v == null || !Number.isFinite(v)) return "";
  if (dv !== "VND") return NF[0].format(Math.round(v)) + " USD";
  const a = Math.abs(v);
  return a >= 1e9 ? NF[2].format(v / 1e9) + " tỷ ₫" : a >= 1e6 ? NF[1].format(v / 1e6) + " tr ₫" : NF[0].format(v) + " ₫";
};

export const gio = (t) => { if (t == null) return ""; const d = new Date(ms(t)); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const ngay = (t) => { if (t == null) return ""; const d = new Date(ms(t)); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`; };
export const ngayNam = (t) => { if (t == null) return ""; const d = new Date(ms(t)); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; };
export const ngayGio = (t) => (t == null || t === "" ? "" : `${ngay(t)} ${gio(t)}`);
export const ngayGioNam = (t) => (t == null || t === "" ? "" : `${ngayNam(t)} ${gio(t)}`);

// Thời lượng (giờ) -> "5 ngày 5,25 giờ" như phiếu chuyến tàu; âm thì thêm dấu trừ
export function thoiLuong(h, { ngan = false } = {}) {
  if (h == null || !Number.isFinite(h)) return "";
  const am = h < 0, a = Math.abs(h), d = Math.floor(a / 24 + 1e-9), r = Math.round((a - d * 24) * 100) / 100;
  const s = d ? `${d}${ngan ? "n" : " ngày"}${r ? ` ${NF[2].format(r)}${ngan ? "g" : " giờ"}` : ""}` : `${NF[2].format(r)}${ngan ? "g" : " giờ"}`;
  return (am ? "−" : "") + s;
}

// <input type="datetime-local"> dùng giờ máy, không có múi giờ
export const toLocalInput = (t) => {
  if (t == null || t === "") return "";
  const d = new Date(ms(t));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const fromLocalInput = (s) => (s ? new Date(s).toISOString() : null);

// Bỏ dấu tiếng Việt để tìm kiếm / so khớp tên cột
export const plain = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim();
export const matchQ = (q, ...f) => !q || plain(f.join(" ")).includes(plain(q));

// Tháng dạng "2026-10" -> [đầu tháng, đầu tháng sau] (ms, giờ máy)
export const thangKhoang = (ym) => { const [y, m] = ym.split("-").map(Number); return [new Date(y, m - 1, 1).getTime(), new Date(y, m, 1).getTime()]; };
export const thangCua = (t) => { const d = new Date(ms(t)); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
export const tenThang = (ym) => { const [y, m] = ym.split("-"); return `Tháng ${+m}/${y}`; };
export const congThang = (ym, n) => { const [y, m] = ym.split("-").map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
