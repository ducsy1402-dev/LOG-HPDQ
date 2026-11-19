// Kế hoạch xuất bán (menu Kế hoạch tổng hợp › Kế hoạch dài hạn › tab Kế hoạch xuất bán, anh Sỹ 19/11/2026).
// Dữ liệu theo THÁNG: xe = [{ thang, hang, hinh_thuc: "bo" | "bien", loai_xe, don_vi: "hoa_phat" | "nha_thau", tan }] (đường bộ / đường biển chia theo loại xe và đơn vị),
//                      kho = [{ thang, hang, ten_bai, ten_khu, tan }] (xuất kho: phân bổ tổng về từng bãi – gian / lô). Tổng của hàng = đường bộ + đường biển (không lưu).
import { plain } from "./format";

export const HINH_THUC = [["bo", "Đường bộ"], ["bien", "Đường biển"]];
export const DON_VI_XE = [["hoa_phat", "Hòa Phát"], ["nha_thau", "Thuê ngoài"]];
export const KHONG_LOAI_XE = "(không chia loại xe)";
export const r2 = (x) => Math.round((+x || 0) * 100) / 100;

// Mỗi hàng một dòng: { hang, bo, bien, tong, hp, tn } (hp / tn: tổng Hòa Phát / Thuê ngoài của cả hai hình thức)
export function tongHopXuatBan(xe) {
  const m = new Map();
  for (const r of xe || []) {
    const k = plain(r.hang), o = m.get(k) || { hang: r.hang, bo: 0, bien: 0, tong: 0, hp: 0, tn: 0 }, t = +r.tan || 0;
    o[r.hinh_thuc === "bien" ? "bien" : "bo"] += t; o.tong += t; o[r.don_vi === "hoa_phat" ? "hp" : "tn"] += t;
    m.set(k, o);
  }
  return m;
}

// Các dòng loại xe của một (hàng, hình thức): [{ loai, hp, tn }] (cùng loại xe gộp một dòng)
export function gomXe(xe, hang, hinh) {
  const m = new Map();
  for (const r of xe || []) {
    if (plain(r.hang) !== plain(hang) || r.hinh_thuc !== hinh) continue;
    const loai = r.loai_xe || "", o = m.get(loai) || { loai, hp: 0, tn: 0 };
    o[r.don_vi === "hoa_phat" ? "hp" : "tn"] += +r.tan || 0; m.set(loai, o);
  }
  return [...m.values()];
}

// Các dòng ghi CSDL từ dòng loại xe của hộp Phân xe (cùng loại xe cộng dồn; không có số thì bỏ)
export function dongGhiXe(rows) {
  const m = new Map(), ten = new Map(); // ten: tên loại xe lần đầu gặp (viết hoa / thường khác nhau vẫn là một loại)
  for (const r of rows) {
    const l0 = String(r.loai || "").trim(), loai = ten.get(plain(l0)) ?? (ten.set(plain(l0), l0), l0);
    for (const [dv, v] of [["hoa_phat", r.hp], ["nha_thau", r.tn]]) {
      const t = r2(v); if (!(t > 0)) continue;
      const k = `${plain(loai)}|${dv}`, o = m.get(k) || { loai_xe: loai, don_vi: dv, tan: 0 };
      o.tan = r2(o.tan + t); m.set(k, o);
    }
  }
  return [...m.values()];
}

// Chia tong tấn cho các gian / lô theo tỉ lệ sức chứa. ds = [{ key, suc }]; lô không có sức chứa thì chia đều; làm tròn 2 số lẻ, phần lẻ dồn vào lô lớn nhất cho khớp tổng.
export function chiaTheoSucChua(tong, ds) {
  const out = new Map();
  if (!(tong > 0) || !ds.length) return out;
  const co = ds.reduce((s, x) => s + (x.suc > 0 ? x.suc : 0), 0), w = (x) => (co > 0 ? (x.suc > 0 ? x.suc : 0) / co : 1 / ds.length);
  let tot = 0;
  for (const x of ds) { const v = r2(tong * w(x)); out.set(x.key, v); tot += v; }
  const lon = [...ds].sort((a, b) => w(b) - w(a))[0], du = r2(tong - tot);
  if (du !== 0) out.set(lon.key, r2(out.get(lon.key) + du));
  return out;
}
