# Dự án: LOG-HPDQ – Web Quản trị Logistics (bản tách từ web gốc)

Chủ dự án: Lê Đức Sỹ, không phải lập trình viên. **Trả lời bằng tiếng Việt, ngắn gọn; chưa chắc thì hỏi trước khi làm.**

## Đây là gì
- Bản **tách riêng** từ web Quản trị Logistics gốc (kho `WEB-QLTB`, web https://quanlythietbi-98y.pages.dev), chạy trên **Supabase và Cloudflare Pages khác**: Supabase project `tggigcprrbpbbospqfto`, kho GitHub `ducsy1402-dev/LOG-HPDQ`.
- React + Vite + Tailwind + shadcn/ui (JSX), ECharts. Mã nằm ở **gốc kho** (không có thư mục `app/` hay `logistics/`). Build: `npm run build` → thư mục `dist`.
- Hai bản không dùng chung dữ liệu hay mã. Sửa ở bản này không ảnh hưởng web gốc, và ngược lại.

## Có những phần nào
- **Tổng quan**: Linetime tàu cập bến (Quản lý Cảng), Khối lượng xếp dỡ, Quản lý kho bãi, Quản lý Thiết bị cơ giới, chuông cảnh báo.
- **Thiết bị cơ giới** (`src/thietbi/`): Tình trạng & sự kiện, Nhân sự & quân số, Kế hoạch & phân bổ (ngắn hạn, dài hạn).
- **Khai thác Cảng**: Linetime tàu cập bến (lịch cầu bến, theo mét, sơ đồ cầu bến, phiếu chuyến, kế hoạch ngày tới), Mục tiêu sản lượng.
- **Khai thác kho bãi**: Kho thành phẩm, Kho nguyên liệu.
- **Danh mục**, **Phân quyền**.

## ĐÃ BỎ so với web gốc (chủ ý)
- Trang Phương án làm hàng, Thưởng phạt tàu, Điều độ chung; thẻ Thưởng phạt và Tiến độ ở Tổng quan; bảng `cargo_plans` và `voyage_tien` (không có trong SQL).
- Không còn tiền thưởng phạt (đơn giá, tỷ lệ thưởng). **Giữ** phần giờ laytime / CQD trong phiếu chuyến (cam kết xếp dỡ, hạn laytime, chênh lệch giờ).
- Kế hoạch Dài hạn chỉ lấy thiết bị và mốc thời gian theo phiếu chuyến › Bãi & Thiết bị (không còn "phương án đã duyệt").
- `src/lib/phuongAn.js`, `bieuMauPA.js` vẫn còn trong mã vì các hàm tính xe / thiết bị / in kế hoạch cảng dùng chung; chỉ bỏ giao diện và dữ liệu phương án.
- Dữ liệu xe, nhân sự, nhà thầu mẫu, bảng phân bổ cố định của web gốc **không** được nạp: bắt đầu trống, chỉ có Danh mục (cầu bến, cẩu, hàng hóa, kho bãi) và thông số model xe.

## Cơ sở dữ liệu (thư mục `sql/`)
Chạy lần lượt trong Supabase › SQL Editor, trên project mới còn trống:
1. `01_cau_truc.sql` – toàn bộ bảng, hàm, quyền (RLS), cấu hình danh mục chung. **Chỉ chạy MỘT lần.**
2. `02_nap_danh_muc.sql` – nạp cầu bến, cẩu, hàng hóa, kho bãi (do `npm run danh-muc` sinh từ `Danh mục.xlsx`; không sửa tay).
3. `03_bo_tri_ben.sql` – tuyến bến, mét từng bến, thứ tự bến, băng tải của bến.
4. `04_cap_quyen.sql` – cấp quyền quản trị cho tài khoản đầu tiên (tạo người dùng ở Authentication trước).
5. `05_lich_chay_nen.sql` – tùy chọn, cần bật tiện ích pg_cron (dọn kế hoạch ngắn hạn cũ mỗi ngày).
Thay đổi CSDL về sau: viết file SQL mới đánh số tiếp (06, 07…), báo anh Sỹ chạy trong Supabase **trước** khi đẩy code.

## Cách làm việc (đã chốt)
1. Làm trên nhánh riêng, cho anh Sỹ xem bản demo (`?demo`; thử vai trò `?demo=xem|nhap|quan_ly`).
2. Chỉ đẩy lên `main` (web thật) khi anh đồng ý.
3. Commit kết thúc bằng dòng `Co-Authored-By: Claude <model> <noreply@anthropic.com>` đúng model đang làm.
4. Ghi lỗi / yêu cầu anh báo vào `docs/TASKS.md`.

## Chạy thử
- `npm install` rồi `npm run dev`, mở http://localhost:5174/?demo
- Kiểm thử công thức: `npm test`. Build: `npm run build` (Cloudflare chạy lệnh này, đăng thư mục `dist`).

## Nơi đặt logic (như web gốc)
- Phần Cảng, trong `src/lib/`: `linetime.js` (9 mốc giờ, trạng thái), `laytime.js` (giờ laytime), `checks.js` (cảnh báo), `paste.js` (dán nhanh), `thietBi.js`, `phuongAn.js` (tính xe / thiết bị chuyến), `capBen.js` (quy tắc số mét cập cầu bến, bến phụ, sơ đồ), `kho.js` (kho bãi), `tauDaiHan.js` (tàu → việc Dài hạn).
- Phần Thiết bị cơ giới: `src/thietbi/lib/compute.js`, `plan.js`.
- Quyền: Thiết bị cơ giới theo `user_roles`; Cảng / kho theo `user_module_roles` + `co_quyen()`.
