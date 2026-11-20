// Nhóm quyền theo khu vực (SQL 16, anh Sỹ 15/11/2026): mỗi tài khoản XEM tất cả, chỉ SỬA / THÊM / XÓA ở khu vực của nhóm mình.
// Web chỉ ẩn / khóa nút theo nhóm; chặn thật nằm ở CSDL (chính sách RLS dùng co_nhom, xem sql/16_nhom_quyen_tai_khoan.sql).
// Tài khoản cũ (vai trò Cảng / Kho / Thiết bị: xem, nhập, quản lý, quản trị) giữ nguyên cách tính cũ; nhóm chỉ CỘNG THÊM quyền ở khu vực của nhóm.
export const BAC = { xem: 0, nhap: 1, quan_ly: 2, quan_tri: 3 };

export const NHOM_QUYEN = {
  van_tai: { ten: "Kế hoạch vận tải", sua: "Thiết bị cơ giới, danh mục thiết bị cơ giới và hàng hóa, mục tiêu / sản lượng thực tế vận tải" },
  kho_bai: { ten: "Kế hoạch kho bãi", sua: "Khai thác kho bãi, danh mục kho bãi và hàng hóa" },
  xuat_nhap: { ten: "Kế hoạch xuất nhập", sua: "Kế hoạch tổng hợp phần cảng (mục tiêu, kế hoạch ngày, sản lượng thực tế) và danh mục hàng hóa" },
  cau_ben: { ten: "Kế hoạch cầu bến", sua: "Linetime tàu cập, danh mục cầu bến / tàu / đại lý và hàng hóa" },
  nhap_lieu: { ten: "Nhập liệu", sua: "Chỉ Sản lượng thực tế (cảng và vận tải)" },
  dieu_do: { ten: "Điều độ", sua: "Phần Điều độ (chưa có ô nhập; quyền để sẵn)" },
};
export const DS_NHOM = Object.keys(NHOM_QUYEN);

// Tên đăng nhập không có đuôi email: web tự thêm đuôi này (Supabase vẫn cần một địa chỉ email).
// Dùng đuôi .test (tên miền dành riêng theo RFC 2606, không ai đăng ký được) để không ai chiếm được tài khoản bằng thư "quên mật khẩu".
export const TEN_MIEN_TAI_KHOAN = "hpdq.test";
export const emailTuTenDangNhap = (t) => {
  const x = String(t ?? "").trim();
  return x.includes("@") ? x : x ? `${x.toLowerCase()}@${TEN_MIEN_TAI_KHOAN}` : "";
};
export const tenDangNhap = (email) => {
  const x = String(email ?? ""), duoi = "@" + TEN_MIEN_TAI_KHOAN;
  return x.toLowerCase().endsWith(duoi) ? x.slice(0, -duoi.length) : x;
};

// role: { cang, kho, thietBi, nhom: [...] } (từ api.getRole). Trả về đối tượng quyền dùng trong toàn web.
export function tinhQuyen(role) {
  const nhom = Array.isArray(role?.nhom) ? role.nhom : [];
  const co = (...n) => n.some((x) => nhom.includes(x));
  const bac = BAC[role?.cang] ?? -1, bk = BAC[role?.kho] ?? -1;
  // Phân hệ kho bãi
  const kho = { co: bk >= 0, nhap: bk >= 1 || co("kho_bai"), quanLy: bk >= 2 || co("kho_bai"), quanTri: bk >= 3 || co("kho_bai") };
  const adminTB = role?.thietBi === "quan_tri"; // quản trị cũ của Thiết bị cơ giới (không tính nhóm)
  return {
    kho, nhom,
    coCang: bac >= 0, chuaSql: role?.loi === "chua_sql", coThietBi: !!role?.thietBi, adminTB,
    // Linetime tàu cập, phiếu chuyến, cầu bến (khu vực cau_ben); quanTri cũ (reset line, phân quyền, thêm cột) không cho nhóm
    nhap: bac >= 1 || co("cau_ben"), quanLy: bac >= 2 || co("cau_ben"), quanTri: bac >= 3,
    // Mục tiêu sản lượng: nh = "cang" (khu vực xuat_nhap) hoặc "van_tai" (khu vực van_tai); thực tế còn cho nhóm nhap_lieu
    sl: (nh) => {
      const k = nh === "van_tai" ? "van_tai" : "xuat_nhap";
      return { datMucTieu: bac >= 2 || co(k), nhapThucTe: bac >= 1 || co(k, "nhap_lieu") };
    },
    keHoachNgay: bac >= 1 || co("xuat_nhap"),
    // Danh mục
    suaDmThietBi: adminTB || co("van_tai"), suaDmHang: adminTB || co("van_tai", "kho_bai", "xuat_nhap", "cau_ben"),
    suaDmKho: bac >= 3 || adminTB || co("kho_bai"), suaDmCauBen: bac >= 3 || co("cau_ben"),
    // Thiết bị cơ giới (phần Thiết bị cơ giới tự tính trong thietbi/store.jsx theo cùng quy tắc)
    suaThietBi: adminTB || role?.thietBi === "nhap" || co("van_tai"),
  };
}
