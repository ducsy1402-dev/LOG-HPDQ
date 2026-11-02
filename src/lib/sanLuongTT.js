// Mục tiêu tháng và sản lượng thực tế theo ca / ngày của Khai thác Cảng › Mục tiêu sản lượng (SQL 06).
// Hai nhóm: "cang" (hướng nhập / xuất, loại hàng) và "van_tai" (hướng phục vụ cảng / sản xuất, loại xe, đơn vị thực hiện).
import { plain, pad } from "./format";

export const CA = ["CA 1", "CA 2"];
export const DON_VI = [["hoa_phat", "Hòa Phát"], ["nha_thau", "Nhà thầu"]];
export const tenDonVi = (k) => DON_VI.find(([x]) => x === k)?.[1] || k || "";
export const NHOM = {
  cang: {
    ten: "Mục tiêu khai thác cảng", huong: [["nhap", "Hàng nhập"], ["xuat", "Hàng xuất"]], nhanLoai: "Loại hàng", coDonVi: false,
    bangMT: "muc_tieu_san_luong", bangTT: "san_luong_cang", cotLoai: "loai_hang",
  },
  van_tai: {
    ten: "Mục tiêu khai thác vận tải", huong: [["phuc_vu_cang", "Phục vụ cảng"], ["phuc_vu_san_xuat", "Phục vụ sản xuất"]], nhanLoai: "Loại xe", coDonVi: true,
    bangMT: "muc_tieu_van_tai", bangTT: "san_luong_van_tai", cotLoai: "loai_xe",
  },
};
export const tenHuong = (nhom, h) => NHOM[nhom].huong.find(([x]) => x === h)?.[1] || h;

// Khóa một dòng / cột: hướng | loại (hàng hoặc xe) | đơn vị (vận tải; cảng để trống)
export const khoaDong = (huong, loai, donVi = "") => `${huong}|${plain(loai)}|${donVi || ""}`;
// Dòng trong CSDL -> dạng chung { huong, loai, donVi, ... }; và ngược lại
export const tuDb = (nhom, r) => ({ ...r, loai: r[NHOM[nhom].cotLoai], donVi: NHOM[nhom].coDonVi ? r.don_vi : "" });
export const raDb = (nhom, r) => (NHOM[nhom].coDonVi ? { loai_xe: r.loai, don_vi: r.donVi } : { loai_hang: r.loai });
export const khoaCua = (r) => khoaDong(r.huong, r.loai, r.donVi);

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
