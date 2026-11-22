// Edge Function "tao-tai-khoan": quản trị thêm tài khoản mới ngay trên web (màn hình Phân quyền › Thêm tài khoản).
// Cần vì web chỉ có khóa công khai, không được phép tạo người dùng; hàm này chạy phía Supabase và giữ khóa bí mật (service_role) ở đó.
//
// CÁCH ĐƯA LÊN SUPABASE (làm một lần, không cần cài gì):
//   1. Supabase › Edge Functions › Deploy a new function › Via Editor.
//   2. Đặt tên đúng:  tao-tai-khoan   (đúng từng chữ, có gạch ngang).
//   3. Xóa mã mẫu, dán TOÀN BỘ nội dung file này vào, bấm Deploy.
//   4. Không cần nhập khóa nào: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY Supabase tự cấp cho hàm.
// Chỉ tài khoản ĐANG LÀ QUẢN TRỊ (user_roles.vai_tro = 'quan_tri') gọi được; người khác nhận lỗi 403.
// Chạy sql/27_phan_quyen_moi.sql trước (bảng user_xem, user_nhom).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TEN_MIEN = "hpdq.test"; // trùng TEN_MIEN_TAI_KHOAN ở src/lib/quyen.js
const MUC_XEM = ["tat_ca", "tong_quan", "khai_bao", "dieu_do", "linetime", "ke_hoach_th", "kho", "danh_muc"];
const MUC_SUA = ["khai_bao", "dieu_do", "linetime", "kh_dai_han", "kh_cang", "kh_van_tai", "san_luong", "kho_hang_kien", "kho_hang_roi", "dm_thiet_bi", "dm_hang", "dm_kho", "dm_cau_ben"];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const tra = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return tra({ loi: "Chỉ nhận yêu cầu POST" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const khoaBiMat = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 1. Người gọi phải đăng nhập và là quản trị
    const nguoiGoi = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: u } = await nguoiGoi.auth.getUser();
    if (!u?.user) return tra({ loi: "Chưa đăng nhập" }, 401);
    const admin = createClient(url, khoaBiMat, { auth: { persistSession: false } });
    const { data: vt } = await admin.from("user_roles").select("vai_tro").eq("user_id", u.user.id).maybeSingle();
    if (vt?.vai_tro !== "quan_tri") return tra({ loi: "Chỉ quản trị mới tạo được tài khoản" }, 403);

    // 2. Kiểm tra dữ liệu gửi lên
    const b = await req.json();
    const ten = String(b.ten ?? "").trim().toLowerCase();
    const email = ten.includes("@") ? ten : `${ten}@${TEN_MIEN}`;
    const matKhau = String(b.mat_khau ?? "");
    const hoTen = String(b.ho_ten ?? "").trim();
    if (!/^[a-z0-9._-]{3,40}(@[a-z0-9.-]+\.[a-z]{2,})?$/.test(ten)) return tra({ loi: "Tên đăng nhập chỉ gồm chữ không dấu, số, dấu . _ - (3 đến 40 ký tự)" }, 400);
    if (matKhau.length < 8) return tra({ loi: "Mật khẩu cần ít nhất 8 ký tự" }, 400);
    const quanTri = b.quan_tri === true;
    const xem: string[] = (Array.isArray(b.xem) ? b.xem : []).filter((x: string) => MUC_XEM.includes(x));
    const sua: string[] = (Array.isArray(b.sua) ? b.sua : []).filter((x: string) => MUC_SUA.includes(x));

    // 3. Tạo tài khoản (đã xác nhận sẵn, không cần thư kích hoạt)
    const { data: moi, error: loiTao } = await admin.auth.admin.createUser({ email, password: matKhau, email_confirm: true, user_metadata: { ho_ten: hoTen } });
    if (loiTao || !moi?.user) {
      const trung = /already|registered|exists/i.test(loiTao?.message ?? "");
      return tra({ loi: trung ? `Tên đăng nhập "${ten}" đã có người dùng` : (loiTao?.message ?? "Không tạo được tài khoản") }, trung ? 409 : 400);
    }
    const id = moi.user.id;

    // 4. Ghi quyền; lỗi thì xóa tài khoản vừa tạo để khỏi để lại tài khoản không quyền
    const huy = async (loi: string) => { await admin.auth.admin.deleteUser(id); return tra({ loi }, 500); };
    const r1 = await admin.from("user_roles").insert({ user_id: id, vai_tro: quanTri ? "quan_tri" : "xem", ho_ten: hoTen || null });
    if (r1.error) return huy("Không ghi được vai trò: " + r1.error.message);
    if (!quanTri) {
      if (xem.length) {
        const r2 = await admin.from("user_xem").insert(xem.map((muc) => ({ user_id: id, muc })));
        if (r2.error) return huy("Không ghi được quyền xem (đã chạy SQL 27 chưa?): " + r2.error.message);
      }
      if (sua.length) {
        const r3 = await admin.from("user_nhom").insert(sua.map((nhom) => ({ user_id: id, nhom })));
        if (r3.error) return huy("Không ghi được quyền chỉnh sửa (đã chạy SQL 27 chưa?): " + r3.error.message);
      }
    }
    return tra({ ok: true, user_id: id, email });
  } catch (e) {
    return tra({ loi: "Lỗi hàm: " + (e instanceof Error ? e.message : String(e)) }, 500);
  }
});
