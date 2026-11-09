// Định dạng số, ngày giờ, thời lượng kiểu Việt Nam. Thời gian lưu dạng ISO (timestamptz), hiển thị theo giờ máy.
export const HOUR = 3600e3;
export const DAY = 24 * HOUR;
export const pad = (n) => String(n).padStart(2, "0");

export const ms = (v) => (v == null || v === "" ? null : typeof v === "number" ? v : new Date(v).getTime());
export const iso = (t) => (t == null || Number.isNaN(t) ? null : new Date(t).toISOString());

// Số kiểu Việt Nam (1.234,56): mọi số đo (tấn, mét, mớn…) làm tròn đúng 2 chữ số thập phân; so(v, 0) cho số đếm nguyên (xe, tàu, chuyến…).
// pct / thời lượng: tối đa 2 chữ số, bỏ số 0 thừa. Anh Sỹ chốt 09/11/2026.
const nf = (min, max) => new Intl.NumberFormat("vi-VN", { minimumFractionDigits: min, maximumFractionDigits: max });
const N0 = nf(0, 0), N2 = nf(2, 2), NF = [nf(0, 0), nf(0, 1), nf(0, 2), nf(0, 2)];
export const so = (v, d) => (v == null || v === "" || Number.isNaN(+v) ? "" : (d === 0 ? N0 : N2).format(+v));
export const pct = (v, d = 2) => (v == null || !Number.isFinite(v) ? "" : NF[Math.min(d, 2)].format(v * 100) + "%");
// Làm tròn 2 chữ số (dữ liệu biểu đồ)
export const soGon = (v) => (v == null || v === "" || Number.isNaN(+v) ? "" : NF[2].format(+v)); // tối đa 2 số lẻ, bỏ số 0 thừa (nhãn trục biểu đồ)
export const met = (v) => (v == null || v === "" || Number.isNaN(+v) ? "" : NF[2].format(+v)); // số mét cầu bến / vị trí / LOA: nguyên văn, tối đa 2 số lẻ, không ép đủ 2 số
export const r2 = (x) => (x == null || !Number.isFinite(+x) ? x : Math.round(+x * 100) / 100);
// Đọc số người nhập theo cách phổ thông nhất ở Việt Nam: dấu phẩy là thập phân ("667,756" = 667,756), dấu chấm ngăn nghìn ("1.234,5", "110.680");
// vẫn nhận "12.5" (chấm thập phân) và "1,234,567" / "1,234.5" (kiểu Anh). Có đơn vị cuối ("15.000 t/ngày", "50 tấn") thì bỏ đơn vị. Không phải số -> null.
export function docSo(s) {
  if (s == null) return null;
  if (typeof s === "number") return s;
  let t = String(s).trim().toLowerCase().replace(/\s/g, "").replace(/(t\/ngày|t\/ngay|tấn|tan|dwt|t|m|%)$/, "");
  if (!/^-?[\d.,]*\d[\d.,]*$/.test(t)) return null; // còn chữ (CQD, 10tr…) thì không phải số
  const phay = t.split(",").length - 1, cham = t.split(".").length - 1;
  if (phay && cham) t = t.lastIndexOf(",") > t.lastIndexOf(".") ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  else if (phay) t = phay > 1 ? t.replace(/,/g, "") : t.replace(",", ".");
  else if (cham) t = cham > 1 || /^-?[1-9]\d{0,2}\.\d{3}$/.test(t) ? t.replace(/\./g, "") : t;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
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
