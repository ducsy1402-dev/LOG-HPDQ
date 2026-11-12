// Project Supabase của web LOG-HPDQ (dựng lại 12/11/2026 sau khi project cũ bị xóa nhầm).
// Khóa dưới đây là khóa CÔNG KHAI (publishable), an toàn vì mọi bảng bật RLS.
// TUYỆT ĐỐI không đưa service_role key / secret key vào đây.
export const SUPABASE_URL = "https://vyrttgpqefaajoiaetyz.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_I8M0ccD5lpoPhjT60441Jg_MFP4Z46i";

// ?demo: dữ liệu giả lập trong trình duyệt, không đăng nhập, không ghi CSDL. ?demo=xem | nhap | quan_ly để thử vai trò.
const qs = typeof location !== "undefined" ? new URLSearchParams(location.search) : new URLSearchParams();
export const DEMO = qs.has("demo");
export const DEMO_ROLE = ["xem", "nhap", "quan_ly", "quan_tri"].includes(qs.get("demo")) ? qs.get("demo") : "quan_tri";

export const APP_NAME = "Quản trị Logistics";
export const VAI_TRO = { xem: "Xem", nhap: "Nhập liệu", quan_ly: "Quản lý", quan_tri: "Quản trị" };
export const PHAN_HE = { thiet_bi: "Thiết bị cơ giới", cang: "Khai thác Cảng", kho: "Khai thác kho bãi" };
