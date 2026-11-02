# Triển khai LOG-HPDQ (Supabase + Cloudflare Pages mới)

## 1. Supabase (project `tggigcprrbpbbospqfto`)
1. **Authentication › Providers › Email**: tắt "Allow new users to sign up" (web không cho tự đăng ký).
2. **Authentication › Users › Add user**: tạo tài khoản đầu tiên (email + mật khẩu, tích "Auto Confirm User").
3. **SQL Editor** chạy lần lượt (mỗi file một lần, dán toàn bộ rồi Run): `sql/01_cau_truc.sql`, `02_nap_danh_muc.sql`, `03_bo_tri_ben.sql`, rồi `06_san_luong_thuc_te.sql` (sau khi đã chạy 04).
4. Mở `sql/04_cap_quyen.sql`, sửa email cho đúng tài khoản vừa tạo, chạy.
5. (Tùy chọn) Database › Extensions: bật `pg_cron`, rồi chạy `sql/05_lich_chay_nen.sql`.
6. Thêm tài khoản khác: Authentication › Users › Add user, rồi vào web › Phân quyền để cấp vai trò từng phân hệ.

## 2. GitHub
Kho: https://github.com/ducsy1402-dev/LOG-HPDQ (nhánh `main`).

## 3. Cloudflare Pages
- Workers & Pages › Create › Pages › Connect to Git › chọn kho `LOG-HPDQ`, nhánh `main`.
- Framework preset: None (hoặc Vite). **Build command: `npm run build`. Build output directory: `dist`.** Root directory: để trống.
- Biến môi trường: không cần (khóa Supabase công khai nằm trong `src/config.js` và `src/thietbi/config.js`).
- Sau khi có địa chỉ `*.pages.dev`: mở web, đăng nhập, kiểm tra Tổng quan.

## 4. Kiểm tra sau triển khai
- Đăng nhập được; menu có Tổng quan, Thiết bị cơ giới, Khai thác Cảng, Kho bãi, Danh mục, Phân quyền.
- Danh mục › Cầu bến có 16 bến; Kho bãi có 41 dòng; Hàng hóa 133 loại; Cẩu 38.
- Thêm thử một chuyến tàu ở Linetime, xem phiếu chuyến.
