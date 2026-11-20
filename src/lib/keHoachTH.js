// Kế hoạch tổng hợp (menu Kế hoạch tổng hợp › Kế hoạch dài hạn, anh Sỹ 19/11/2026): ba bản kế hoạch XUẤT BÁN → SẢN XUẤT → NHẬP MUA, lập theo Tháng / Quý / Năm.
// Dữ liệu một kỳ (ky = "2026-11" | "2026-Q4" | "2026"):
//   th  = [{ loai, ky, hang, bo, bien, tong }]   số kế hoạch từng hàng (xuất bán, nhập mua: đường bộ + đường biển, tổng = bộ + biển; sản xuất: chỉ tổng)
//   xe  = [{ loai, ky, hang, hinh_thuc: "bo" | "bien", loai_xe, don_vi: "hoa_phat" | "nha_thau", tan }]   phân xe
//   kho = [{ loai, ky, hang, ten_bai, ten_khu, tan }]   phân bổ về bãi – gian / lô (xuất kho hoặc nhập kho)
import { plain, docSo } from "./format";

export const KE_HOACH = {
  xuat_ban: { ten: "Kế hoạch xuất bán", boBien: true, tenKho: "Xuất kho", xeBo: true, xeBien: true, namBo: "xuất bán đường bộ", namBien: "xuất bán đường biển" },
  san_xuat: { ten: "Kế hoạch sản xuất", boBien: false, tenKho: "Nhập kho", xeBo: false, xeBien: false },
  nhap_mua: { ten: "Kế hoạch nhập mua", boBien: true, tenKho: "Nhập kho", xeBo: false, xeBien: true, namBo: "nhập mua đường bộ", namBien: "nhập mua đường biển" },
};
export const HINH_THUC = [["bo", "Đường bộ"], ["bien", "Đường biển"]];
export const DON_VI_XE = [["hoa_phat", "Hòa Phát"], ["nha_thau", "Thuê ngoài"]];
export const KHONG_LOAI_XE = "(không chia loại xe)";
export const r2 = (x) => Math.round((+x || 0) * 100) / 100;

// Các dòng của một bản kế hoạch: [{ hang, bo, bien, tong }] sắp theo tổng giảm dần
export function dongKeHoach(th, loai) {
  const bb = KE_HOACH[loai].boBien, m = new Map();
  for (const r of th || []) {
    if (r.loai !== loai) continue;
    const bo = +r.bo || 0, bien = +r.bien || 0;
    m.set(plain(r.hang), { hang: r.hang, bo: bb ? bo : 0, bien: bb ? bien : 0, tong: bb ? bo + bien : +r.tong || 0 });
  }
  return [...m.values()].sort((a, b) => b.tong - a.tong || a.hang.localeCompare(b.hang, "vi"));
}
export const tongDong = (loai, o) => (KE_HOACH[loai].boBien ? r2((+o.bo || 0) + (+o.bien || 0)) : r2(+o.tong || 0));

// Các dòng loại xe của một (kế hoạch, hàng, hình thức): [{ loai, hp, tn }] (cùng loại xe gộp một dòng)
export function gomXe(xe, loai, hang, hinh) {
  const m = new Map();
  for (const r of xe || []) {
    if (r.loai !== loai || plain(r.hang) !== plain(hang) || r.hinh_thuc !== hinh) continue;
    const l = r.loai_xe || "", o = m.get(l) || { loai: l, hp: 0, tn: 0 };
    o[r.don_vi === "hoa_phat" ? "hp" : "tn"] += +r.tan || 0; m.set(l, o);
  }
  return [...m.values()];
}
// Tổng phân xe: { hp, tn } của một kế hoạch (cả hai hình thức, mọi hàng)
export function tongPhanXe(xe, loai) {
  let hp = 0, tn = 0;
  for (const r of xe || []) { if (r.loai !== loai) continue; if (r.don_vi === "hoa_phat") hp += +r.tan || 0; else tn += +r.tan || 0; }
  return { hp, tn };
}

// Các dòng ghi CSDL từ dòng loại xe của hộp Phân xe (cùng loại xe cộng dồn, viết hoa / thường khác nhau vẫn một loại; không có số thì bỏ)
export function dongGhiXe(rows) {
  const m = new Map(), ten = new Map();
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

// ---- Dán nhanh / Excel ----
// Cột của bảng: sản xuất = Tên hàng · Tổng; xuất bán, nhập mua = Tên hàng · Tổng · Đường bộ · Đường biển. Dòng đầu là tiêu đề thì nhận cột theo tên, không thì theo thứ tự cột của bảng.
const TIEU_DE = { hang: ["ten hang", "hang", "hang hoa", "loai hang", "mat hang"], tong: ["tong", "tong cong", "tong (t)", "tong t", "cong"], bo: ["duong bo", "bo", "duong bo (t)", "nhap duong bo", "xuat duong bo", "kl duong bo"], bien: ["duong bien", "bien", "duong bien (t)", "nhap duong bien", "xuat duong bien", "kl duong bien"] };
const soO = (x) => { const t = String(x ?? "").trim(); if (!t || /^[-–—]+$/.test(t)) return 0; const v = docSo(t); return Number.isFinite(v) ? v : NaN; };
export function docDanKeHoach(bang, loai) {
  const bb = KE_HOACH[loai].boBien, mac = bb ? ["hang", "tong", "bo", "bien"] : ["hang", "tong"];
  const dau = (bang[0] || []).map((c) => plain(String(c ?? "")));
  const coTD = dau.some((c) => TIEU_DE.hang.includes(c)) || dau.filter((c) => Object.values(TIEU_DE).some((l) => l.includes(c))).length >= 2;
  const cot = coTD ? dau.map((c) => Object.keys(TIEU_DE).find((k) => TIEU_DE[k].includes(c)) || "") : mac;
  const dong = [], thieu = [];
  if (coTD) for (const k of mac) if (k !== "tong" && !cot.includes(k)) thieu.push(k === "hang" ? "Tên hàng" : k === "bo" ? "Đường bộ" : "Đường biển");
  if (coTD && !bb && !cot.includes("tong")) thieu.push("Tổng");
  (coTD ? bang.slice(1) : bang).forEach((o) => {
    if (o.every((c) => !String(c ?? "").trim())) return;
    const g = (k) => o[cot.indexOf(k)], hang = String(g("hang") ?? "").trim(), loi = [], canh = [];
    const bo = soO(g("bo")), bien = soO(g("bien")), tongO = cot.includes("tong") && String(g("tong") ?? "").trim() ? soO(g("tong")) : null;
    if (!hang) loi.push("Thiếu tên hàng");
    for (const [t, v] of [["Đường bộ", bo], ["Đường biển", bien], ["Tổng", tongO]]) if (Number.isNaN(v)) loi.push(`${t} không phải số`);
    let b = Number.isNaN(bo) ? 0 : bo, e = Number.isNaN(bien) ? 0 : bien, tong;
    if (bb) {
      tong = b + e;
      if (!loi.length && tong === 0) loi.push("Chưa có số đường bộ / đường biển");
      if (tongO != null && !Number.isNaN(tongO) && Math.abs(tongO - tong) > 0.5) canh.push(`Cột Tổng (${tongO}) lệch bộ + biển (${tong}): lấy bộ + biển`);
    } else { tong = tongO == null || Number.isNaN(tongO) ? 0 : tongO; b = 0; e = 0; if (!loi.length && !(tong > 0)) loi.push("Chưa có số Tổng"); }
    dong.push({ hang, bo: r2(b), bien: r2(e), tong: r2(tong), loi, canh });
  });
  return { dong, thieu };
}
