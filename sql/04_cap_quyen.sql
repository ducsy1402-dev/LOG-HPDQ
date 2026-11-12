-- 04. CẤP QUYỀN CHO TÀI KHOẢN ĐẦU TIÊN (chạy SAU khi đã tạo người dùng ở Supabase > Authentication > Users > Add user).
-- Đổi email và họ tên bên dưới cho đúng tài khoản vừa tạo. Quản trị (quan_tri) có toàn quyền ở mọi phân hệ.
-- Muốn thêm người khác: dùng màn hình Phân quyền trên web (sau khi họ có tài khoản), hoặc copy một khối INSERT, đổi email.
--   Vai trò chung (user_roles): 'xem' | 'nhap' | 'quan_tri'.
insert into public.user_roles (user_id, vai_tro, ho_ten)
select id, 'quan_tri', 'Điều độ cảng' from auth.users where email = 'dieudocanghpdq@gmail.com'
on conflict (user_id) do update set vai_tro = excluded.vai_tro, ho_ten = excluded.ho_ten;

-- Kiểm tra: phải thấy 1 dòng
select u.email, r.vai_tro, r.ho_ten from public.user_roles r join auth.users u on u.id = r.user_id;
