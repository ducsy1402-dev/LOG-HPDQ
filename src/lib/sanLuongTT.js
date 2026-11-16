// Mục tiêu tháng và sản lượng thực tế theo ngày (mỗi ngày một dòng) của Khai thác Cảng › Mục tiêu sản lượng (SQL 06).
// Hai nhóm: "cang" (hướng nhập / xuất, loại hàng) và "van_tai" (hướng phục vụ cảng / sản xuất, loại xe = đội xe, đơn vị thực hiện, loại hàng).
import { plain, pad } from "./format";

export const CA = ["CA 1", "CA 2"];
// Đơn vị thực hiện (vận tải), anh Sỹ chốt 15/11/2026: chỉ "Hòa Phát" ("hoa_phat") và "Thuê ngoài" ("nha_thau"), không chọn từng nhà thầu.
// Số liệu cũ ghi theo từng nhà thầu ("nt:<tên>", SQL 11) vẫn đọc được và hiện là "Thuê ngoài · <tên>".
export const DON_VI = [["hoa_phat", "Hòa Phát"], ["nha_thau", "Thuê ngoài"]];
export const TIEN_TO_NT = "nt:";
export const tenDonVi = (k) => (k === "hoa_phat" ? "Hòa Phát" : k === "nha_thau" ? "Thuê ngoài" : String(k || "").startsWith(TIEN_TO_NT) ? "Thuê ngoài · " + k.slice(TIEN_TO_NT.length) : k || "");
// Danh sách chọn đơn vị: Hòa Phát và Thuê ngoài -> [[giá trị, tên hiển thị]]
export const dsDonVi = () => DON_VI.map(([k, ten]) => [k, ten]);
export const NHOM = {
  cang: {
    ten: "Mục tiêu khai thác cảng", huong: [["nhap", "Hàng nhập"], ["xuat", "Hàng xuất"]], nhanLoai: "Loại hàng", coDonVi: false, coLoaiHang: false,
    bangMT: "muc_tieu_san_luong", bangTT: "san_luong_cang", cotLoai: "loai_hang",
  },
  van_tai: {
    ten: "Mục tiêu khai thác vận tải", huong: [["phuc_vu_cang", "Phục vụ cảng"], ["phuc_vu_san_xuat", "Phục vụ sản xuất"]], nhanLoai: "Loại xe", coDonVi: true, coLoaiHang: true,
    bangMT: "muc_tieu_van_tai", bangTT: "san_luong_van_tai", cotLoai: "loai_xe",
  },
};
export const tenHuong = (nhom, h) => NHOM[nhom].huong.find(([x]) => x === h)?.[1] || h;

// Khóa một dòng / cột: hướng | loại (hàng hoặc xe) | đơn vị (vận tải) | loại hàng (vận tải; trống = mọi hàng)
export const khoaDong = (huong, loai, donVi = "", hang = "") => `${huong}|${plain(loai)}|${donVi || ""}|${plain(hang)}`;
// Dòng trong CSDL -> dạng chung { huong, loai, donVi, hang, ... }; và ngược lại
export const tuDb = (nhom, r) => ({ ...r, loai: r[NHOM[nhom].cotLoai], donVi: NHOM[nhom].coDonVi ? r.don_vi : "", hang: NHOM[nhom].coLoaiHang ? r.loai_hang || "" : "" });
export const raDb = (nhom, r) => (NHOM[nhom].coDonVi ? { loai_xe: r.loai, don_vi: r.donVi, loai_hang: r.hang || "" } : { loai_hang: r.loai });
export const khoaCua = (r) => khoaDong(r.huong, r.loai, r.donVi, r.hang);

// Các ngày YYYY-MM-DD của tháng YYYY-MM
export function ngayCuaThang(thang) {
  const [y, m] = thang.split("-").map(Number), n = new Date(y, m, 0).getDate();
  return Array.from({ length: n }, (_, i) => `${y}-${pad(m)}-${pad(i + 1)}`);
}
export const khoaO = (ngay, ca, khoaCot) => `${ngay}|${ca}|${khoaCot}`;
// Tổng thực tế theo cột (cả tháng): Map khóa dòng -> tấn
export function tongTheoCot(nhom, thucTe) {
  const m = new Map();
  for (const r of thucTe || []) { const k = khoaCua(tuDb(nhom, r)); m.set(k, (m.get(k) || 0) + (+r.tan || 0)); }
  return m;
}
// Bộ lọc đội xe (chỉ vận tải): "" = tất cả
export const khopDoiXe = (r, doiXe) => !doiXe || plain(r.loai) === plain(doiXe);

// ---------- Mục tiêu vận tải: một dòng = (loại hàng, hướng, loại xe) với hai ô Hòa Phát / Thuê ngoài (anh Sỹ chốt 16/11/2026, theo bảng Excel) ----------
// CSDL vẫn lưu mỗi đơn vị một dòng (don_vi = hoa_phat | nha_thau), nên không đổi SQL. Tổng = Hòa Phát + Thuê ngoài.
export const HUONG_NGAN = { phuc_vu_cang: "PVC", phuc_vu_san_xuat: "PVSX" };
// dong: { khóa: { huong, loai (loại xe), donVi, hang, tan, ghi_chu } } -> [{ g, huong, loai, hang, hp, tn, khac, donViTN }]
// hp / tn: khóa dòng Hòa Phát / Thuê ngoài (null = chưa có); khac: các dòng thuê ngoài cũ ghi theo từng nhà thầu (nt:<tên>) — tính vào tổng, không sửa ở đây
export function nhomDongVT(dong, thuTuHuong = []) {
  const m = new Map();
  for (const [k, r] of Object.entries(dong)) {
    const g = `${r.huong}|${plain(r.loai)}|${plain(r.hang)}`;
    const o = m.get(g) || { g, huong: r.huong, loai: r.loai, hang: r.hang || "", hp: null, tn: null, khac: [], donViTN: "nha_thau" };
    if (r.donVi === "hoa_phat") o.hp = k;
    else if (r.donVi === "nha_thau" || o.tn == null) { if (o.tn != null) o.khac.push(o.tn); o.tn = k; o.donViTN = r.donVi || "nha_thau"; }
    else o.khac.push(k);
    m.set(g, o);
  }
  return [...m.values()].sort((a, b) => thuTuHuong.indexOf(a.huong) - thuTuHuong.indexOf(b.huong) || a.hang.localeCompare(b.hang, "vi") || a.loai.localeCompare(b.loai, "vi"));
}
