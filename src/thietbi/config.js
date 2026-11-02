// Cấu hình kết nối Supabase. Anon key là khóa công khai, an toàn vì mọi bảng đã bật RLS.
// TUYỆT ĐỐI không đưa service_role key vào đây.
export const SUPABASE_URL = "https://tggigcprrbpbbospqfto.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnZ2lnY3BycmJwYmJvc3BxZnRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1Nzc1OTksImV4cCI6MjEwOTE1MzU5OX0.aSG_hxAcPPQ-cclmPkj9WTbUef6jvbjXyVTee3cpYUs";

// Mở trang với ?demo để chạy bằng dữ liệu giả lập trong trình duyệt (không cần đăng nhập, không ghi vào CSDL)
export const DEMO = typeof location !== "undefined" && new URLSearchParams(location.search).has("demo");

export const VAI_TRO = { xem: "Xem", nhap: "Nhập liệu", quan_tri: "Quản trị" };
export const APP_NAME = "Quản trị Logistics";
