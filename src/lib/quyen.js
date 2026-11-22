// Phân quyền theo tài khoản (SQL 27, anh Sỹ chốt 22/11/2026). Mỗi tài khoản có 3 phần:
//  - QUYỀN XEM  (bảng user_xem): trang nào hiện trên menu. Chỉ ẩn / hiện trên web, không chặn đọc ở CSDL.
//  - QUYỀN CHỈNH SỬA (bảng user_nhom): 13 mục; chặn thật ở CSDL (chính sách RLS dùng co_nhom, xem sql/27_phan_quyen_moi.sql);
//    web chỉ ẩn / khóa nút theo cùng các mục này.
//  - QUẢN TRỊ (user_roles.vai_tro = quan_tri): xem và sửa tất cả, đặt quyền cho người khác.
export const BAC = { xem: 0, nhap: 1, quan_ly: 2, quan_tri: 3 };

// Quyền XEM: id khớp thuộc tính `xem` của từng trang ở khung/menu.js
export const MUC_XEM = [
  { id: "tat_ca", ten: "Tất cả" },
  { id: "tong_quan", ten: "Tổng quan" },
  { id: "khai_bao", ten: "Khai báo" },
  { id: "dieu_do", ten: "Điều độ" },
  { id: "linetime", ten: "Linetime tàu cập bến" },
  { id: "ke_hoach_th", ten: "Kế hoạch tổng hợp" },
  { id: "kho", ten: "Khai thác kho bãi" },
  { id: "danh_muc", ten: "Danh mục" },
];
export const DS_XEM = MUC_XEM.map((m) => m.id);

// Quyền CHỈNH SỬA, xếp nhóm theo khu vực. `xem` = trang cần xem được để dùng mục này (tick sửa thì web tự thêm quyền xem trang đó).
// Kho Overview chỉ là sơ đồ (không có ô nhập) nên không có mục sửa riêng.
export const NHOM_SUA = [
  { ten: "Thiết bị cơ giới", muc: [
    { id: "khai_bao", ten: "Khai báo", xem: "khai_bao", sua: "Tình trạng & sự kiện, nhân sự & quân số, thông tin đầu / cuối ca, loại thiết bị gắn" },
    { id: "dieu_do", ten: "Điều độ", xem: "dieu_do", sua: "Trang Điều độ (hiện chưa có ô nhập; quyền để sẵn)" },
  ] },
  { ten: "Khai thác Cảng", muc: [
    { id: "linetime", ten: "Linetime tàu cập bến", xem: "linetime", sua: "Chuyến tàu, khoảng dừng, trả hàng, mốc giờ, dán nhanh bảng tàu" },
    { id: "kh_dai_han", ten: "Kế hoạch tổng hợp › Kế hoạch dài hạn", xem: "ke_hoach_th", sua: "Mục tiêu nhập / xuất cảng, kế hoạch sản xuất, kế hoạch vận tải (tháng, quý, năm)" },
    { id: "kh_cang", ten: "Kế hoạch tổng hợp › Kế hoạch Cảng", xem: "ke_hoach_th", sua: "Kế hoạch sản lượng theo ngày của từng tàu" },
    { id: "kh_van_tai", ten: "Kế hoạch tổng hợp › Kế hoạch vận tải", xem: "ke_hoach_th", sua: "Kế hoạch ngày, dài hạn (Linetime năng lực đáp ứng) và Chiến dịch của thiết bị cơ giới" },
    { id: "san_luong", ten: "Kế hoạch tổng hợp › Sản lượng thực tế", xem: "ke_hoach_th", sua: "Sản lượng thực tế cảng và vận tải" },
  ] },
  { ten: "Khai thác kho bãi", muc: [
    { id: "kho_hang_kien", ten: "Kho hàng kiện (thành phẩm)", xem: "kho", sua: "Sổ nhập – xuất, kế hoạch, phân loại tồn của kho hàng kiện" },
    { id: "kho_hang_roi", ten: "Kho hàng rời", xem: "kho", sua: "Sổ nhập – xuất, kế hoạch, phân loại tồn của kho hàng rời" },
  ] },
  { ten: "Danh mục", muc: [
    { id: "dm_thiet_bi", ten: "Danh mục › Thiết bị cơ giới", xem: "danh_muc", sua: "Xe, cẩu, nhân sự, nhà thầu, thông số và định mức" },
    { id: "dm_hang", ten: "Danh mục › Hàng hóa", xem: "danh_muc", sua: "Hàng rời, hàng thành phẩm" },
    { id: "dm_kho", ten: "Danh mục › Kho bãi", xem: "danh_muc", sua: "Khai báo & quy hoạch kho bãi, hàng đang chứa, sức chứa" },
    { id: "dm_cau_ben", ten: "Danh mục › Cầu bến", xem: "danh_muc", sua: "Danh sách bến, bố trí tuyến bến" },
  ] },
];
export const MUC_SUA = Object.fromEntries(NHOM_SUA.flatMap((g) => g.muc.map((m) => [m.id, { ...m, nhom: g.ten }])));
export const DS_SUA = Object.keys(MUC_SUA);
export const TEN_SUA = (id) => MUC_SUA[id]?.ten || id;

// Sau khi tick / bỏ tick: "Tất cả" thì thôi liệt kê từng trang; tick sửa một mục thì tự thêm quyền xem trang của mục đó
export const chuanQuyenXem = (xem) => (xem.includes("tat_ca") ? ["tat_ca"] : DS_XEM.filter((x) => x !== "tat_ca" && xem.includes(x)));
export const xemCanCho = (sua) => [...new Set(sua.map((k) => MUC_SUA[k]?.xem).filter(Boolean))];

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

// role: { admin, cang, kho, thietBi, xem: [...], nhom: [...] } (từ api.getRole; nhom = các mục chỉnh sửa). Trả về đối tượng quyền dùng trong toàn web.
export function tinhQuyen(role) {
  const nhom = (Array.isArray(role?.nhom) ? role.nhom : []).filter((x) => DS_SUA.includes(x));
  const xem = Array.isArray(role?.xem) ? role.xem : ["tat_ca"]; // chưa chạy SQL 27 thì xem tất cả
  const admin = !!role?.admin || role?.thietBi === "quan_tri" || role?.cang === "quan_tri";
  const co = (...k) => admin || k.some((x) => nhom.includes(x));
  const bac = BAC[role?.cang] ?? -1, bk = admin ? 3 : (BAC[role?.kho] ?? -1);
  const khoNhap = co("kho_hang_kien", "kho_hang_roi");
  return {
    admin, nhom, xem,
    // Trang nào được hiện trên menu (quản trị luôn thấy hết)
    thay: (id) => admin || xem.includes("tat_ca") || xem.includes(id),
    co,
    kho: {
      co: bk >= 0, nhap: khoNhap, quanLy: khoNhap, quanTri: khoNhap,
      // Sửa theo từng tab kho: loai = "thanh_pham" (hàng kiện) | "nguyen_lieu" (hàng rời)
      theoLoai: (loai) => co(loai === "thanh_pham" ? "kho_hang_kien" : "kho_hang_roi"),
    },
    coCang: bac >= 0, chuaSql: role?.loi === "chua_sql", coThietBi: !!role?.thietBi, adminTB: admin,
    // Linetime tàu cập, phiếu chuyến, cầu bến; quanTri (reset line, phân quyền, thêm cột) chỉ dành cho quản trị
    nhap: co("linetime"), quanLy: co("linetime"), quanTri: admin,
    // Kế hoạch tổng hợp: nh = "cang" hoặc "van_tai" (cùng một quyền: hộp Kế hoạch dài hạn đặt cả hai loại mục tiêu)
    sl: () => ({ datMucTieu: co("kh_dai_han"), nhapThucTe: co("san_luong") }),
    keHoachNgay: co("kh_cang"),
    // Danh mục
    suaDmThietBi: co("dm_thiet_bi"), suaDmHang: co("dm_hang"), suaDmKho: co("dm_kho"), suaDmCauBen: co("dm_cau_ben"),
    // Thiết bị cơ giới (phần Thiết bị cơ giới tự tính trong thietbi/store.jsx theo cùng quy tắc)
    suaThietBi: co("khai_bao", "dieu_do", "kh_van_tai", "dm_thiet_bi"),
  };
}
