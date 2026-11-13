# Việc cần làm / lỗi anh Sỹ báo

## Kho › Sơ đồ bãi (11/11/2026) — đã làm
- Thay sơ đồ tư duy bằng sơ đồ kho bãi có biểu tượng (kho mái che = mái vòm, bãi lộ thiên = đống vòm), mực đầy dâng theo % (xanh / vàng / đỏ).
- Hiện thể tích tối đa (m³) cho kho nguyên liệu; kho thành phẩm hiện diện tích (m²) và số lớp khả dụng.
- Bản đồ định vị nhỏ (ghim khu vực, bấm để tới khu / bãi lớn).
- Đường nối không đè chữ; tên bãi, hàng, số liệu đứng thẳng hàng bên phải biểu tượng; đầu trang chỉ còn ô tìm kiếm.

## Giao diện kiểu fintech, sửa khối đè nhau (12/11/2026) — đã làm, chờ anh Sỹ xem (nhánh giao-dien-fintech)
- Anh báo: màu SCADA hôm qua khó nhìn, chói mắt → thiết kế lại màu sắc, bố cục theo kiểu web app tài chính hiện đại (sáng và tối).
- Anh báo: còn khối đè lên nhau → sửa đồng hồ đo (số đè cung), chú thích biểu đồ đè số trục, nhãn số đè cột, nhãn bến Linetime tràn hàng, thanh kỳ che thanh menu trên điện thoại, bản đồ kho che bãi, biểu đồ tàu ở bến tràn khung.

## Dựng lại CSDL sau khi xóa nhầm project Supabase (12/11/2026)
- Đã nối web vào project mới `vyrttgpqefaajoiaetyz`; SQL 01…11 đã chạy. Dữ liệu nhập cũ đã mất, nhập lại từ đầu.
- Còn: tạo tài khoản + chạy 04, đăng nhập thử, đẩy lên main, thêm địa chỉ web vào Authentication › URL Configuration của Supabase mới.

## Khai thác kho bãi 4 tab, tự tính sức chứa (13/11/2026) — đã làm, chờ anh Sỹ xem (nhánh kho-bai-4-tab)
- Hộp thêm kho thành phẩm / nguyên liệu: sức chứa khả dụng / danh nghĩa để trống thì tự tính, thiếu hệ số lưu chứa thì thông báo.
- Menu Khai thác kho bãi: tab Overview, Kho HRC, Kho Thanh/Cuộn, Kho Nguyên liệu; mỗi tab kho 3 biểu đồ + 5 nút. Đợt chỉnh theo góp ý: Dán nhanh / Excel nằm trong Kế hoạch và Nhập / Xuất, bỏ Kiểm kê và Bảng tồn; kế hoạch theo ngày / tuần / tháng / năm, mỗi bãi nhỏ một dòng nhập + xuất; hộp nhập liệu có Bãi nhỏ; chuông cảnh báo góc phải; tab và ô lọc nhỏ hơn; biểu đồ tồn xếp theo khu vực; sơ đồ bãi vẽ theo nhánh (GA, GB…).
- **Cần chạy `sql/12_bai_nho_ke_hoach_ky.sql` trong Supabase trước khi đẩy code** (chưa chạy thì bãi nhỏ và kế hoạch theo ngày / tuần / năm chưa dùng được).
- **Cần anh xác nhận**: cách chia hàng cho hai tab thành phẩm (HRC = hàng có chữ HRC; Thanh/Cuộn = mọi thành phẩm còn lại). Hiện Danh mục chưa có gian / lô nào của Thanh/Cuộn nên tab này đang trống.

## Mục tiêu sản lượng bố cục mới (13/11/2026) — đã làm, chờ anh Sỹ xem (nhánh muc-tieu-san-luong-moi)
- Khai thác cảng: hàng nút trên cùng, 3 thẻ tàu chỉ số lượng, 3 biểu đồ xem theo tháng / quý / năm (có đường kế hoạch – thực tế lọc loại hàng); Dán nhanh trong Đặt mục tiêu và Sản lượng thực tế; hộp Kế hoạch ngày có dòng Thực nhập / Thực xuất, cửa sổ 7 / 14 ngày, phím mũi tên, dán từ Excel. Mục tiêu vận tải chuyển sang Thiết bị cơ giới › Kế hoạch & phân bổ.
- **Cần chạy `sql/13_ke_hoach_san_luong_ngay.sql` trong Supabase trước khi đẩy code** (nút Kế hoạch ngày cần bảng này).
- Cần anh xác nhận: "tàu chờ trong 24h tới" đang tính là tàu chưa làm hàng mà giờ bắt đầu làm hàng dự kiến trong 24 giờ tới (hoặc đã quá giờ); Tàu thép thành phẩm không gồm HRC.

## Còn mở
- Cột "mái che" ở Danh mục › Khai báo kho / bãi (hiện đoán theo tên: "Kho …" = mái che, trừ "Kho hở").
- Toạ độ thật của các khu vực / bãi lớn cho bản đồ định vị (hiện xếp đều theo thứ tự).
- Diện tích từng gian kho thành phẩm (đang trống nên hiện "— m²").
