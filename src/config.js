// Project Supabase của web LOG-HPDQ (dựng lại 12/11/2026 sau khi project cũ bị xóa nhầm).
// Khóa dưới đây là khóa CÔNG KHAI (publishable), an toàn vì mọi bảng bật RLS.
// TUYỆT ĐỐI không đưa service_role key / secret key vào đây.
export const SUPABASE_URL = "https://vyrttgpqefaajoiaetyz.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_I8M0ccD5lpoPhjT60441Jg_MFP4Z46i";

// ?demo: dữ liệu giả lập trong trình duyệt, không đăng nhập, không ghi CSDL. ?demo=xem | nhap | quan_ly để thử vai trò.
const qs = typeof location !== "undefined" ? new URLSearchParams(location.search) : new URLSearchParams();
export const DEMO = qs.has("demo");
// ?demo=van_tai | kho_bai | xuat_nhap | cau_ben | nhap_lieu | dieu_do (hoặc quan_tri_log): thử giao diện của tài khoản nhóm quyền (xem tất cả, chỉ sửa khu vực của nhóm). Demo không chặn ghi ở máy chủ, chỉ khóa nút.
export const DEMO_NHOM = ["van_tai", "kho_bai", "xuat_nhap", "cau_ben", "nhap_lieu", "dieu_do", "chi_xem"].includes(qs.get("demo")) ? qs.get("demo") : null;
export const DEMO_ROLE = DEMO_NHOM ? "quan_tri" : ["xem", "nhap", "quan_ly", "quan_tri"].includes(qs.get("demo")) ? qs.get("demo") : "quan_tri"; // vai trò ở tầng giả lập (quyền ghi); giao diện theo DEMO_NHOM

export const APP_NAME = "Quản trị Logistics";
export const VAI_TRO = { xem: "Xem", nhap: "Nhập liệu", quan_ly: "Quản lý", quan_tri: "Quản trị" };
export const PHAN_HE = { thiet_bi: "Thiết bị cơ giới", cang: "Khai thác Cảng", kho: "Khai thác kho bãi" };
