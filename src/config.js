// Cùng project Supabase với web Thiết bị cơ giới (app/src/config.js). Anon key là khóa công khai, an toàn vì mọi bảng bật RLS.
// TUYỆT ĐỐI không đưa service_role key vào đây.
export const SUPABASE_URL = "https://tggigcprrbpbbospqfto.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnZ2lnY3BycmJwYmJvc3BxZnRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1Nzc1OTksImV4cCI6MjEwOTE1MzU5OX0.aSG_hxAcPPQ-cclmPkj9WTbUef6jvbjXyVTee3cpYUs";

// ?demo: dữ liệu giả lập trong trình duyệt, không đăng nhập, không ghi CSDL. ?demo=xem | nhap | quan_ly để thử vai trò.
const qs = typeof location !== "undefined" ? new URLSearchParams(location.search) : new URLSearchParams();
export const DEMO = qs.has("demo");
export const DEMO_ROLE = ["xem", "nhap", "quan_ly", "quan_tri"].includes(qs.get("demo")) ? qs.get("demo") : "quan_tri";

export const APP_NAME = "Quản trị Logistics";
export const VAI_TRO = { xem: "Xem", nhap: "Nhập liệu", quan_ly: "Quản lý", quan_tri: "Quản trị" };
export const PHAN_HE = { thiet_bi: "Thiết bị cơ giới", cang: "Khai thác Cảng", kho: "Khai thác kho bãi" };
