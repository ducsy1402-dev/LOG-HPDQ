// Edge Function "tao-tai-khoan": quản trị thêm / đổi tên đăng nhập / xóa tài khoản ngay trên web (màn hình Phân quyền).
// Cần vì web chỉ có khóa công khai, không được phép tạo hay xóa người dùng; hàm này chạy phía Supabase và giữ khóa bí mật (service_role) ở đó.
// Việc làm: hanh_dong = "tao" (mặc định) · "doi_ten" (đổi tên đăng nhập = email) · "xoa" (xóa tài khoản).
//
// CÁCH ĐƯA LÊN SUPABASE (làm một lần, không cần cài gì; hàm đã có từ trước thì mở lại, dán đè nội dung mới rồi Deploy):
//   1. Supabase › Edge Functions › Deploy a new function › Via Editor (hoặc mở hàm tao-tai-khoan đã có).
//   2. Đặt tên đúng:  tao-tai-khoan   (đúng từng chữ, có gạch ngang).
//   3. Xóa mã cũ, dán TOÀN BỘ nội dung file này vào, bấm Deploy.
//   4. Không cần nhập khóa nào: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY Supabase tự cấp cho hàm.
// Chỉ tài khoản ĐANG LÀ QUẢN TRỊ (user_roles.vai_tro = 'quan_tri') gọi được; người khác nhận lỗi 403.
// Chạy sql/27_phan_quyen_moi.sql trước (bảng user_xem, user_nhom).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TEN_MIEN = "hpdq.test"; // trùng TEN_MIEN_TAI_KHOAN ở src/lib/quyen.js
const MUC_XEM = ["tat_ca", "tong_quan", "khai_bao", "dieu_do", "linetime", "ke_hoach_th", "kho", "danh_muc"];
const MUC_SUA = ["khai_bao", "dieu_do", "linetime", "kh_dai_han", "kh_cang", "kh_van_tai", "san_luong", "kho_hang_kien", "kho_hang_roi", "dm_thiet_bi", "dm_hang", "dm_kho", "dm_cau_ben"];
const MAU_TEN = /^[a-z0-9._-]{3,40}(@[a-z0-9.-]+\.[a-z]{2,})?$/;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const tra = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const emailTu = (ten: string) => (ten.includes("@") ? ten : `${ten}@${TEN_MIEN}`);

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
    if (vt?.vai_tro !== "quan_tri") return tra({ loi: "Chỉ quản trị mới quản lý được tài khoản" }, 403);

    const b = await req.json();
    const hanhDong = String(b.hanh_dong ?? "tao");

    // ---- XÓA tài khoản ----
    if (hanhDong === "xoa") {
      const id = String(b.user_id ?? "");
      if (!id) return tra({ loi: "Thiếu tài khoản cần xóa" }, 400);
      if (id === u.user.id) return tra({ loi: "Không tự xóa tài khoản của chính mình" }, 400);
      const { data: dich } = await admin.from("user_roles").select("vai_tro").eq("user_id", id).maybeSingle();
      if (dich?.vai_tro === "quan_tri") {
        const { count } = await admin.from("user_roles").select("user_id", { count: "exact", head: true }).eq("vai_tro", "quan_tri");
        if ((count ?? 0) <= 1) return tra({ loi: "Đây là quản trị cuối cùng, không xóa được" }, 400);
      }
      // Xóa quyền trước rồi mới xóa người dùng (bảng quyền đã tự xóa theo, xóa tay cho chắc)
      for (const bang of ["user_xem", "user_nhom", "user_module_roles", "user_roles"]) await admin.from(bang).delete().eq("user_id", id);
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) return tra({ loi: "Không xóa được tài khoản: " + error.message }, 400);
      return tra({ ok: true });
    }

    // ---- ĐỔI tên đăng nhập ----
    if (hanhDong === "doi_ten") {
      const id = String(b.user_id ?? "");
      const ten = String(b.ten ?? "").trim().toLowerCase();
      if (!id) return tra({ loi: "Thiếu tài khoản cần đổi tên" }, 400);
      if (!MAU_TEN.test(ten)) return tra({ loi: "Tên đăng nhập chỉ gồm chữ không dấu, số, dấu . _ - (3 đến 40 ký tự)" }, 400);
      const email = emailTu(ten);
      const { error } = await admin.auth.admin.updateUserById(id, { email, email_confirm: true });
      if (error) {
        const trung = /already|registered|exists/i.test(error.message);
        return tra({ loi: trung ? `Tên đăng nhập "${ten}" đã có người dùng` : "Không đổi được tên đăng nhập: " + error.message }, trung ? 409 : 400);
      }
      return tra({ ok: true, email });
    }

    // ---- TẠO tài khoản ----
    const ten = String(b.ten ?? "").trim().toLowerCase();
    const email = emailTu(ten);
    const matKhau = String(b.mat_khau ?? "");
    const hoTen = String(b.ho_ten ?? "").trim();
    if (!MAU_TEN.test(ten)) return tra({ loi: "Tên đăng nhập chỉ gồm chữ không dấu, số, dấu . _ - (3 đến 40 ký tự)" }, 400);
    if (matKhau.length < 8) return tra({ loi: "Mật khẩu cần ít nhất 8 ký tự" }, 400);
    const quanTri = b.quan_tri === true;
    const xem: string[] = (Array.isArray(b.xem) ? b.xem : []).filter((x: string) => MUC_XEM.includes(x));
    const sua: string[] = (Array.isArray(b.sua) ? b.sua : []).filter((x: string) => MUC_SUA.includes(x));

    // Tạo tài khoản (đã xác nhận sẵn, không cần thư kích hoạt)
    const { data: moi, error: loiTao } = await admin.auth.admin.createUser({ email, password: matKhau, email_confirm: true, user_metadata: { ho_ten: hoTen } });
    if (loiTao || !moi?.user) {
      const trung = /already|registered|exists/i.test(loiTao?.message ?? "");
      return tra({ loi: trung ? `Tên đăng nhập "${ten}" đã có người dùng` : (loiTao?.message ?? "Không tạo được tài khoản") }, trung ? 409 : 400);
    }
    const id = moi.user.id;

    // Ghi quyền; lỗi thì xóa tài khoản vừa tạo để khỏi để lại tài khoản không quyền
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
