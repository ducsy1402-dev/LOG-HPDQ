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
6. `06_san_luong_thuc_te.sql` – bảng mục tiêu / sản lượng thực tế theo ca, ngày (hai tab Mục tiêu sản lượng). Chạy sau 01…04.
7. `07_phan_loai_ton.sql` – bảng `kho_ton_phan_loai` (khai báo tồn cần giải phóng / đầu cơ; tab Kho › Phân loại tồn). Chạy được nhiều lần.
8. `08_danh_muc_tong_hop.sql` – **thay toàn bộ danh mục** theo `Danh_muc_tong_hop.xlsx` (do `npm run danh-muc` sinh; không sửa tay): đổi mã bến 1A → TL, 1…11 → B01…B11 (chuyến tàu đổi theo), nạp xe + cẩu, hàng rời + thành phẩm, kho (gian / lô), bảng `danh_muc_bang` (thiết bị gắn, thông số / định mức cẩu, thông số xe, khai báo kho / bãi); thêm cột xưởng, hệ số làm việc, loại hàng, đơn trọng, số lớp, sức chứa danh nghĩa. Thay dữ liệu của 02, 03.
Thay đổi CSDL về sau: viết file SQL mới đánh số tiếp (07, 08…), báo anh Sỹ chạy trong Supabase **trước** khi đẩy code.

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

## Quy định màu và mốc giờ (anh Sỹ chốt 02/11/2026)
- Thanh tàu: **cam** = chưa đến neo (chỉ có ETA) · **xanh dương** = đã đến neo (có NOR) chưa cập cầu · **vàng** = đang làm hàng · **xanh lá** = đã cập, chờ làm hàng · tím = xong hàng · xám = đã rời / hủy. Định nghĩa ở `TRANG_THAI` trong `src/lib/linetime.js`.
- Khoảng chờ vẽ trên lịch cầu bến (chế độ Toàn thời gian): **đỏ** = chờ có bến cập (từ NOR, tàu chưa đến neo thì từ ETA, tới lúc cập bến); **xanh lá** = chờ đủ hàng / chờ có bãi nhập (khoảng dừng có lý do "Chờ hàng" hoặc "Chờ bãi"). Màu ở `MAU_CHO`.
- Còn **7 mốc thực tế** (ETA, NOR, ATB, bắt đầu làm hàng, kết thúc làm hàng, hoàn tất thủ tục, ATD). Đã bỏ "Đến neo / phao" và "Được phép cập / hoa tiêu lên tàu" (cột `den_neo`, `cho_phep_cap` vẫn còn trong CSDL nhưng web không dùng). "Đã đến neo" = có NOR.
- **ETB luôn sau ETA**: nhập ETA hoặc ETB sai thì web tự đặt ETB = giờ gợi ý (sớm nhất từ ETA mà bến đã chọn trống, cách tàu trước 1 giờ), ETD dời theo. Hàm `etbGoiY`, `rangBuocEtb` trong `linetime.js`; áp ở form chuyến, mốc giờ trong phiếu, kéo thả lịch (theo bến và theo mét), dán nhanh. Tàu đã cập thật (có ATB) thì không đụng.
- Đã bỏ các cảnh báo: chờ neo, chưa khai báo cầu bến / số máng, chưa lập phương án, ETD không khả thi, dự báo bị phạt.
- Xanh lá = tàu CHƯA cập bến vì chưa đủ hàng / chưa có bãi nhập: ghi ở phiếu chuyến › Khoảng dừng với lý do "Chờ cập bến: chưa đủ hàng" hoặc "Chờ cập bến: chưa có bãi nhập" (không tính vào giờ dừng làm hàng, laytime). Không còn vẽ xanh lá trên thanh tàu đã cập.
- Không còn cảnh báo năng suất (cả chữ cảnh báo lẫn tô màu thấp hơn cam kết). Lịch cầu bến theo bến và theo mét đều có nút Chiếm bến / Toàn thời gian; đoạn chờ xanh lá vẽ cùng kiểu sọc với đoạn đỏ (`src/pages/cang/doanCho.jsx`). Chú thích màu không liệt kê "Hủy".

## Mục tiêu sản lượng: hai tab (SQL 06, anh Sỹ chốt 02/11/2026)
- Khai thác Cảng › Mục tiêu sản lượng có 2 tab, mỗi tab gồm **bảng mục tiêu tháng** và **bảng nhập thực tế theo ca / ngày** (CA 1, CA 2; tháng chọn ở góc phải, dùng chung hai tab). Code: `src/pages/cang/MucTieu.jsx` (khung + tab), `SanLuongTab.jsx` (hai bảng), `src/lib/sanLuongTT.js` (cấu hình, khóa dòng).
  - **Mục tiêu khai thác cảng**: hướng nhập / xuất × loại hàng (bảng `muc_tieu_san_luong`), thực tế `san_luong_cang`.
  - **Mục tiêu khai thác vận tải**: hướng Phục vụ cảng / Phục vụ sản xuất × loại xe (đội xe: Xe ben, Xe đầu kéo, Xe bồn…) × đơn vị thực hiện (Hòa Phát / Nhà thầu) × loại hàng (nhóm hàng như bên cảng; trống = mọi hàng): `muc_tieu_van_tai`, thực tế `san_luong_van_tai`. Có bộ lọc đội xe áp cho cả hai bảng.
- Cột "Thực hiện" của bảng mục tiêu = tổng số đã nhập ở bảng thực tế (không còn lấy theo khối lượng chuyến tàu; vẫn ghi chú "tàu trong tháng X t" để đối chiếu). Quản lý trở lên đặt mục tiêu; nhập liệu trở lên nhập số thực tế (xóa số trong ô = xóa dòng).
- Tổng quan › Khối lượng xếp dỡ **chưa đổi**: vẫn lấy khối lượng chuyến tàu so với mục tiêu cảng.

## Kho › Sơ đồ bãi (02/11/2026)
- Tab Sơ đồ bãi là **sơ đồ tư duy khổ ngang** (`src/pages/kho/SoDoTuDuy.jsx`): kho ở góc trên trái, một đường ngang chung nối xuống một hàng các bãi lớn, mỗi bãi lớn nối xuống các bãi nhỏ xếp dọc; màu nút / đường nối theo mức lấp đầy; bấm bãi lớn mở chi tiết, mũi tên thu gọn / mở bãi nhỏ; có nút thu phóng (35–130%) và "Vừa khung". Phần hiển thị dùng chung của trang Kho ở `khoUi.jsx`.
- "Ngày cấp" (kho nguyên liệu) = tồn của hàng đó ở mọi bãi ÷ tiêu thụ bình quân mỗi ngày (ô "Tiêu thụ / ngày" ở Danh mục › Kho bãi; trống thì lấy tổng xuất 30 ngày ÷ 30). Dưới 7 ngày vàng, dưới 3 ngày đỏ.

## Tổng quan dạng bảng điều khiển (03/11/2026)
- `src/pages/tongquan/BangDieuKhien.jsx`: dải chỉ số; ô chọn kỳ **Tuần / Tháng / Quý / Năm** dùng chung (`khoangKy` trong `src/lib/bieuDoSanLuong.js`; mục tiêu / kế hoạch tháng chia đều theo ngày); khối trên 5 biểu đồ sản lượng (`KhoiSanLuong.jsx`); Linetime theo mét (không còn thẻ hai bên); khối dưới 5 biểu đồ kho (`KhoiKho.jsx`); cuối cùng Kho bãi (lấp đầy 30 ngày) và Thiết bị cơ giới.
- Khối sản lượng: Sản lượng cảng và Sản lượng vận tải (cột thực tế theo hướng, mục tiêu từng điểm, lũy kế; nút Tổng / theo hướng); Cảng theo loại hàng (nút Tổng / Nhập / Xuất); Vận tải phục vụ cảng / phục vụ sản xuất theo đơn vị thực hiện (lọc đội xe).
- Khối kho (`src/lib/bieuDoKho.js`): Kho thành phẩm, Kho nguyên liệu (kế hoạch – lũy kế nhập / xuất / tồn, lọc theo nhóm hàng); Cơ cấu tồn (cần giải phóng + đầu cơ, % tổng tồn; lưu động = tồn − hai loại); Tuổi tồn (lô theo ngày nhập, hàng khác theo lần xuất gần nhất; 0–30 / 31–60 / 61–90 / >90 ngày); Hàng cần xử lý top 10 (đã khai báo + gợi ý hàng trên 60 ngày chưa phân loại).
- Mọi khung dùng `khungBD.jsx`: nút **Phóng to** (phủ màn hình, biểu đồ cao lên qua `PhongToCtx` của `EChart`) và **Chi tiết** mở hộp bảng số liệu của chính biểu đồ (`BangChiTiet`), không chuyển trang. Linetime, Kho bãi, Thiết bị vẫn mở hộp cũ (`HopTau`, `HopKho`, `HopThietBi`).

## Danh mục tổng hợp (04/11/2026)
- Nguồn: `Danh_muc_tong_hop.xlsx` ở gốc kho (không đưa lên GitHub). `npm run danh-muc` (`scripts/danh-muc.mjs`) sinh `src/data/danhMuc.json` (demo), `src/data/dmBang.json` (cột các bảng phụ, theo dòng tiêu đề sheet) và `sql/08_danh_muc_tong_hop.sql`; script in ra các chỗ lệch (bãi chưa khai báo, hàng chưa có trong danh mục).
- **Mã bến mới**: TL, B01…B11, HH2, HH3, 6CTH, 7CTH; mã cũ nằm ở Tên khác. Bố trí tuyến / mét mặc định: `VI_TRI_MAC_DINH` trong `src/data/danhMucGoc.js` (tuyến B03-B05-B10, B04-B06-B11, B07-B08-B09…). Phiếu in kế hoạch cảng vẫn ghi TL, 1…11.
- Trang Danh mục (`src/pages/DanhMuc.jsx`): 4 tab chính, mỗi tab có tab nhỏ: **Thiết bị cơ giới** (Danh sách xe, Cẩu cảng, Thiết bị gắn, Thông số cẩu cảng, Định mức cẩu cảng, Thông số xe 7 loại, Nhân sự, Nhà thầu) · **Hàng hóa** (Hàng rời, Hàng thành phẩm) · **Kho bãi** (Khai báo kho / bãi, Kho thành phẩm, Kho nguyên liệu) · **Cầu bến** (Danh sách bến, Bố trí tuyến bến, Tàu).
- Cẩu: tải trọng, tầm với theo Thông số cẩu cảng; năng suất = định mức cao nhất của loại cẩu. Cột Tình trạng của xe / cẩu trong file không nạp (tình trạng tính theo sự kiện). Kho: sức chứa khả dụng của file ghi vào `suc_chua_tay`; kiểu bãi theo Loại kho / bãi (Cố định → cố định 1 hàng, Tự do → tự do).
