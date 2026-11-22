// Project Supabase của web LOG-HPDQ (dựng lại 12/11/2026 sau khi project cũ bị xóa nhầm).
// Khóa dưới đây là khóa CÔNG KHAI (publishable), an toàn vì mọi bảng bật RLS.
// TUYỆT ĐỐI không đưa service_role key / secret key vào đây.
export const SUPABASE_URL = "https://vyrttgpqefaajoiaetyz.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_I8M0ccD5lpoPhjT60441Jg_MFP4Z46i";

// ?demo: dữ liệu giả lập trong trình duyệt, không đăng nhập, không ghi CSDL. ?demo=xem (chỉ xem) hoặc ?demo=<mục chỉnh sửa> để thử vai trò.
const qs = typeof location !== "undefined" ? new URLSearchParams(location.search) : new URLSearchParams();
export const DEMO = qs.has("demo");
// ?demo=van_tai | kho_bai | xuat_nhap | cau_ben | nhap_lieu | dieu_do (hoặc quan_tri_log): thử giao diện của tài khoản nhóm quyền (xem tất cả, chỉ sửa khu vực của nhóm). Demo không chặn ghi ở máy chủ, chỉ khóa nút.
const MUC_SUA_DEMO = ["khai_bao", "dieu_do", "linetime", "kh_dai_han", "kh_cang", "kh_van_tai", "san_luong", "kho_hang_kien", "kho_hang_roi", "dm_thiet_bi", "dm_hang", "dm_kho", "dm_cau_ben"];
const dsDemo = (qs.get("demo") || "").split(",").map((s) => s.trim()).filter(Boolean);
// ?demo=<mục>[,<mục>…] (VD ?demo=linetime,kh_cang) hoặc ?demo=chi_xem: giao diện của tài khoản thường chỉ sửa ở các mục đó. Mảng các mục; null = không dùng.
export const DEMO_NHOM = dsDemo.length && dsDemo.every((x) => x === "chi_xem" || MUC_SUA_DEMO.includes(x)) ? dsDemo.filter((x) => x !== "chi_xem") : null;
export const DEMO_ROLE = DEMO_NHOM ? "quan_tri" : qs.get("demo") === "xem" ? "xem" : "quan_tri"; // vai trò ở tầng giả lập (quyền ghi); giao diện theo DEMO_NHOM

export const APP_NAME = "Quản trị Logistics";
export const VAI_TRO = { xem: "Xem", nhap: "Nhập liệu", quan_ly: "Quản lý", quan_tri: "Quản trị" };
export const PHAN_HE = { thiet_bi: "Thiết bị cơ giới", cang: "Khai thác Cảng", kho: "Khai thác kho bãi" };
