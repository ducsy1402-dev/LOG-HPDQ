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
- Thanh tàu (so với hôm nay, xem mục Linetime tự xếp bến): **cam** = chưa đến neo (chỉ có ETA) · **xanh dương** = đã đến neo (có NOR) chưa cập cầu · **vàng** = đang làm hàng · **xanh lá** = đã cập, chờ làm hàng · tím = xong hàng · xám = đã rời / hủy. Định nghĩa ở `TRANG_THAI` trong `src/lib/linetime.js`.
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

## Giao diện kiểu SCADA, chữ nhỏ gọn (12/11/2026, nhánh giao-dien-scada)
- **Cỡ chữ / biểu tượng ~90%**: `html { font-size: 14.5px }` ở `src/index.css` (mọi cỡ rem co theo), body 0,9 rem. Chữ cố định `text-[Npx]` đã đổi sang rem (sàn 10 px); viết mới nên dùng rem. Sơ đồ bãi vẽ SVG khung 1560 nên cũng nhỏ lại.
- **Font**: Roboto Condensed (`@fontsource/roboto-condensed`, có tiếng Việt) làm font chữ thường, Be Vietnam Pro dự phòng, số liệu đơn cách JetBrains Mono. Biểu đồ ECharts dùng cùng font (`EChart.jsx`).
- **Giao diện tối** (`.dark` trong `index.css`) theo màn hình điều khiển nhà máy: nền xanh đậm có lưới mờ; thẻ / khung viền xanh sáng; tab đang chọn và nút chính xanh bóng; tiêu đề cột bảng là ruy băng xanh; số trong bảng (`td.num`) chữ đơn cách xanh lá; ô nhập nền tối viền xanh; ok xanh lá `#4ade80`, cảnh báo vàng, lỗi đỏ hồng. Giao diện sáng giữ như cũ (chỉ đổi font, cỡ chữ).

## Kho › Sơ đồ bãi (11/11/2026, thay sơ đồ tư duy)
- `src/pages/kho/SoDoKhoBai.jsx`: sơ đồ CÂY có biểu tượng, nền xanh đậm cố định (theo mẫu anh Sỹ): mỗi khu vực một phần → bãi lớn (biểu tượng lớn + cột chữ bên phải) → ngoặc nối → bãi nhỏ / gian (biểu tượng nhỏ + cột chữ bên phải). Bãi lớn chỉ có 1 bãi nhỏ vẽ khối gọn (4 khối một hàng); bãi lớn trên 6 bãi nhỏ chia 3 cột. Đầu trang chỉ có ô tìm (bãi, gian, hàng). Bấm bãi mở `ChiTietBai`.
- Biểu tượng: **kho mái che** = mái vòm bán trụ khung sáng; **bãi lộ thiên** = đống vòm khung sáng (không vẽ nền bê tông), 1–2 đống theo tỉ lệ tồn của 2 hàng nhiều nhất. Mái che lấy cột "mái che" ở Khai báo kho / bãi nếu có; chưa có thì đoán theo tên (bắt đầu bằng "Kho", trừ "Kho hở").
- Hiệu ứng **mực đầy**: khối màu mặt sóng dâng từ đáy tới đúng % lấp đầy (CSS animation, dâng lại khi % đổi); xanh < 85% ≤ vàng < 95% ≤ đỏ (nhấp nháy). Mức chung ở `mucDay` (`khoUi.jsx`).
- Chỉ tiêu sức chứa: kho nguyên liệu hiện **thể tích tối đa** (chỉ số, m³) = diện tích × chiều cao chất đống (không có thì sức chứa ÷ tỉ trọng); kho thành phẩm hiện **diện tích (m²) · số lớp** khả dụng (`so_lop`). Bãi lớn: diện tích khai báo ưu tiên, không có thì cộng các bãi nhỏ.
- **Bản đồ định vị** (`BanDoDinhVi.jsx`): khung nhỏ nổi góc phải dưới, mỗi khu vực một ghim (màu theo mức đầy); bấm ghim cuộn tới khu, hiện các bãi lớn của khu (chấm + danh sách) → bấm để cuộn tới bãi (khung vàng nhấp nháy). Chưa có toạ độ thật: ghim xếp đều theo thứ tự khu vực. Thu nhỏ được.
- Đã bỏ sơ đồ tư duy cũ, các bản demo 3D / SCADA và dấu + thêm bãi trên sơ đồ (thêm bãi ở Danh mục › Kho bãi / Khai báo kho / bãi).
- "Ngày cấp" (kho nguyên liệu) = tồn của hàng đó ở mọi bãi ÷ tiêu thụ bình quân mỗi ngày (ô "Tiêu thụ / ngày" ở Danh mục › Kho bãi; trống thì lấy tổng xuất 30 ngày ÷ 30). Dưới 7 ngày vàng, dưới 3 ngày đỏ.

## Tổng quan dạng bảng điều khiển (03/11/2026)
- `src/pages/tongquan/BangDieuKhien.jsx`: dải chỉ số; ô chọn kỳ **Tuần / Tháng / Quý / Năm** dùng chung (`khoangKy` trong `src/lib/bieuDoSanLuong.js`; mục tiêu / kế hoạch tháng chia đều theo ngày); khối trên 5 biểu đồ sản lượng (`KhoiSanLuong.jsx`); Linetime theo mét (không còn thẻ hai bên); khối dưới 5 biểu đồ kho (`KhoiKho.jsx`); cuối cùng Kho bãi (lấp đầy 30 ngày) và Thiết bị cơ giới.
- Khối sản lượng: Sản lượng cảng và Sản lượng vận tải (cột thực tế theo hướng, mục tiêu từng điểm, lũy kế; nút Tổng / theo hướng); Cảng theo loại hàng (nút Tổng / Nhập / Xuất); Vận tải phục vụ cảng / phục vụ sản xuất theo đơn vị thực hiện (lọc đội xe).
- Khối kho (`src/lib/bieuDoKho.js`): Kho thành phẩm, Kho nguyên liệu (kế hoạch – lũy kế nhập / xuất / tồn, lọc theo nhóm hàng); Cơ cấu tồn (cần giải phóng + đầu cơ, % tổng tồn; lưu động = tồn − hai loại); Tuổi tồn (lô theo ngày nhập, hàng khác theo lần xuất gần nhất; 0–30 / 31–60 / 61–90 / >90 ngày); Hàng cần xử lý top 10 (đã khai báo + gợi ý hàng trên 60 ngày chưa phân loại).
- Mọi khung dùng `khungBD.jsx`: nút **Phóng to** (phủ màn hình, biểu đồ cao lên qua `PhongToCtx` của `EChart`) và **Chi tiết** mở hộp bảng số liệu của chính biểu đồ (`BangChiTiet`), không chuyển trang. Linetime, Kho bãi, Thiết bị vẫn mở hộp cũ (`HopTau`, `HopKho`, `HopThietBi`).

## Danh mục tổng hợp (04/11/2026)
- Nguồn: `Danh_muc_tong_hop.xlsx` ở gốc kho (không đưa lên GitHub). `npm run danh-muc` (`scripts/danh-muc.mjs`) sinh `src/data/danhMuc.json` (demo), `src/data/dmBang.json` (cột các bảng phụ, theo dòng tiêu đề sheet) và `sql/08_danh_muc_tong_hop.sql`; script in ra các chỗ lệch (bãi chưa khai báo, hàng chưa có trong danh mục).
- **Mã bến mới**: TL, B01…B11, HH2, HH3, 6CTH, 7CTH; mã cũ nằm ở Tên khác. Bố trí tuyến / mét mặc định: `VI_TRI_MAC_DINH` trong `src/data/danhMucGoc.js` (tuyến B03-B05-B10, B04-B06-B11, B07-B08-B09…). Phiếu in kế hoạch cảng vẫn ghi TL, 1…11.
- Trang Danh mục (`src/pages/DanhMuc.jsx`): 4 tab chính, mỗi tab có tab nhỏ: **Thiết bị cơ giới** (Danh sách xe, Cẩu cảng, Thiết bị gắn, Thông số cẩu cảng, Định mức cẩu cảng, Thông số xe 7 loại, Nhân sự, Nhà thầu) · **Hàng hóa** (Hàng rời, Hàng thành phẩm) · **Kho bãi** (Khai báo kho / bãi, Kho thành phẩm, Kho nguyên liệu) · **Cầu bến** (Danh sách bến, Bố trí tuyến bến). Danh sách xe, Nhân sự có nút Thêm cột (`src/thietbi/components/cotThemTB.jsx`; nhân sự cần SQL 08).
- Cẩu: tải trọng, tầm với theo Thông số cẩu cảng; năng suất (ẩn trên danh mục) = định mức cao nhất của loại cẩu. Cột Tình trạng của xe / cẩu trong file không nạp (tình trạng tính theo sự kiện). Kho: sức chứa khả dụng của file ghi vào `suc_chua_tay`; kiểu bãi theo Loại kho / bãi (Cố định → cố định 1 hàng, Tự do → tự do).
- Kho: **kiểu bãi và khu vực lấy theo tab Khai báo kho / bãi** (`khaiBaoBai` trong `src/lib/kho.js`: Loại "Cố định" → mỗi gian / lô chỉ nhận đúng hàng, "Tự do" → nhận mọi hàng; Phạm vi / Khu vực dùng ở Tổng quan › Quản lý kho bãi). Hai tab kho không còn cột Kiểu bãi, Nhóm, Khu vực. Tab Loại thiết bị gắn (danh sách tên chọn cho xe xúc đào / cẩu) và tab Tàu đã bỏ khỏi Danh mục (tàu vẫn tự lưu khi lưu chuyến).

## Linetime: tự xếp bến và trạng thái theo giờ (04/11/2026)
- `src/lib/xepBen.js`: **chuyến mới chưa có bến, ETB, ETD** thì web tự xếp (form Thêm chuyến, Dán nhanh; nút **Tự xếp bến (n)** ở Linetime cho chuyến chưa có bến). Bến phải hợp DWT, mớn, chiều dài bến và có loại hàng trong "Loại hàng thường làm" (không bến nào có thì xét mọi bến hợp kích thước). Chọn bến cập sớm nhất; các bến cập trong vòng 6 giờ thì ưu tiên loại hàng đứng trước.
- Tàu thiếu DWT / LOA / mớn (TBA): ước theo khối lượng (DWT ≈ KL ÷ 0,9) hoặc ngược lại, bảng tàu hàng rời điển hình (`uocThongSo`). Lịch theo mét vẽ tàu chưa có LOA bằng LOA ước (ghi "≈… m"); không có gì thì 150 m.
- Mốc dự kiến (`mocDuKien`): ETB sau ETA và sau tàu trước rời **2 giờ**; bắt đầu làm hàng = cập + 1 giờ; kết thúc = bắt đầu + làm hàng (KL ÷ cam kết; không cam kết thì định mức cẩu cảng của bến × 20 giờ / ngày; không có thì 1 ngày); thủ tục = kết thúc + **2 giờ**; ATD dự kiến = thủ tục + **30 phút**. Phiếu chuyến › Mốc giờ hiện "dự kiến …" cạnh mốc chưa nhập.
- **Trạng thái so với hôm nay** (`trangThai(v, now)`): mốc thực tế chỉ tính khi đã qua; chưa nhập thì tự chạy theo giờ dự kiến (qua ETA → đã đến neo, qua ETB → đã cập, qua bắt đầu → đang làm hàng, qua kết thúc → xong hàng, qua ETD → đã rời; tàu đã có ATB mà chưa ghi ATD dừng ở xong hàng). Thanh đang theo dự kiến có "≈" trước tên (lịch theo bến thêm viền nét đứt). Giữ hai chế độ lịch theo bến / theo mét.
- Thứ tự xếp khi xếp nhiều chuyến cùng lúc (`xepNhieu` trong `src/lib/linetime.js`; nút Tự xếp bến, Dán nhanh): tàu ưu tiên ★ trước, rồi tàu chờ lâu hơn (từ NOR, chưa có NOR thì từ ETA), rồi ETA sớm; chuyến xếp trước chiếm bến cho chuyến sau. Một tàu thêm lẻ chỉ tìm khoảng trống sớm nhất, **không dời tàu đã xếp**. Tàu không bến nào hợp mớn / DWT / chiều dài (VD mớn 18,9 m > 18,5 m) thì không xếp. Bến chọn tay không bị chặn (chỉ có cảnh báo). Đã nhập ETB / ETD mà chưa có bến: giữ ETB / ETD nếu bến trống đúng giờ đó.
- **Chia sẻ bến theo số mét** (`etbSomNhatMet` trong `src/lib/capBen.js`, dùng cho tự xếp và ETB gợi ý): hai tàu cùng bến cùng lúc nếu đủ số mét theo quy tắc cập cầu bến; không đủ thì chờ tàu trước rời + 2 giờ. Tàu chưa có LOA hoặc bến / tuyến chưa có mét thì coi như chiếm cả bến (tàu bên cạnh trên cùng tuyến cũng bị coi là bận). Hàm tự xếp nằm ở `src/lib/tuXep.js`.
- **Xếp lại toàn bộ** (nút ở Linetime, quản lý trở lên; `xepLai` + `XepLaiToanBo.jsx`): xếp lại mọi chuyến chưa có ATB (bỏ bến / vị trí / ETB / ETD cũ), xem trước cũ → mới từng chuyến, tick Giữ nguyên để chuyến đó giữ chỗ (chuyến khác xếp quanh), lưu một lần. Tàu đã cập thật không bị đụng. Tàu có bến rồi **không tự dời** khi không bấm nút; chỉ ETB tự dời sau ETA / tàu trước khi sửa ETA hoặc ETB.
- **Tự xếp bến nền** (`src/pages/cang/TuXepTuDong.jsx`, gắn ở `App.jsx`): người có quyền nhập liệu phần Cảng mở web, chuyến chưa cập thật mà chưa có bến thì web tự xếp rồi lưu (thông báo "Web đã tự xếp bến cho n chuyến"). Chuyến không bến nào hợp thì để ở dòng "chưa xếp bến" và chỉ thử lại khi thông số của chuyến đổi. Nút **Xếp lại toàn bộ** hiện cho người có quyền nhập liệu trở lên.
- **Khớp loại hàng với bến** (`khopLoaiHang` trong `src/lib/xepBen.js`, dùng cho tự xếp và cảnh báo "hàng không có trong danh mục của bến"): so cả cụm từ chứ không so từng từ lẻ ("Xỉ thép" không khớp "Thép thành phẩm"). Sửa chuyến chưa cập thật có nút **Tự xếp lại bến** (đổi hàng, khối lượng… thì bấm để web chọn lại bến, ETB, ETD); bến đã có không tự đổi khi sửa hàng.

## Chốt 09/11/2026: xếp bến, nhập liệu kho, định dạng số
- **Mét Cảng Tổng hợp**: 7CTH 0–250, 6CTH 250–490 (`VI_TRI_MAC_DINH`, demo, SQL 03 / 08; CSDL đang chạy cần `sql/09_sua_met_ben_cth.sql`).
- **Tự xếp chỉ cho chuyến chưa có bến**: tự xếp nền, nút Tự xếp bến, Dán nhanh, form chỉ chọn bến cho chuyến chưa khai báo bến. `xepBenTuDong` gặp chuyến đã có `ben_ma` thì giữ bến, chỉ tính ETB / ETD. **Xếp lại toàn bộ** giữ nguyên bến đã khai báo, chỉ xếp lại giờ (ETB, ETD). Nút "Tự xếp lại bến" trong form sửa chuyến là bấm tay, vẫn bỏ bến cũ.
- **Hàng chờ ở bến**: đã thay bằng hàng chờ động (xem mục "Hàng chờ động 10/11/2026" cuối file); `etbSomHangDoi` đã bỏ.
- **Kho › Nhập liệu**: một nút Nhập liệu; hộp chọn nghiệp vụ Nhập / Xuất / Điều chuyển ngay trong hộp (`GiaoDichForm.jsx`, đổi nghiệp vụ giữ ngày, ca, bãi, số lượng). Kiểm kê, Dán nhanh vẫn là nút riêng.
- **Định dạng số** (`src/lib/format.js`): `so(v)` luôn đủ 2 chữ số thập phân (1.234,56); `so(v, 0)` cho số đếm; `pct`, `soGon` tối đa 2 chữ số bỏ số 0 thừa; `r2` làm tròn dữ liệu biểu đồ; tooltip biểu đồ mặc định theo `so`. **Nhập số** dùng `docSo` (cũng ở `format.js`, `paste.js` chỉ xuất lại): dấu phẩy là thập phân ("667,756" = 667,756 t), dấu chấm ngăn nghìn ("110.680"), vẫn nhận "12.5" và kiểu Anh "1,234,567". Tiền ở `docDonGia` vẫn hiểu "25,000" là 25 nghìn. Phiếu in kế hoạch cảng (`bieuMauPA.js`, `keHoachCang.js`) giữ số cột như mẫu cũ.

## Chốt 09/11/2026 (đợt 2): mét, Sổ nhập – xuất, mục tiêu quý / năm
- **Số mét cầu bến** (vị trí, từ – đến mét, chiều dài bến, LOA) dùng `met()` ở `src/lib/format.js`: nguyên văn, tối đa 2 số lẻ, không ép đủ 2 số (306,5 m). Mớn, tấn vẫn đủ 2 số.
- **Kho › Sổ nhập – xuất**: mỗi dòng có nút Sửa (nhập liệu trở lên, xóa vẫn quản lý trở lên). Lượt nhập / xuất / điều chuyển / tồn đầu kỳ mở lại `GiaoDichForm` với `sua` (kiểm tra tồn đã cộng lại số lượng cũ); kiểm kê mở `SuaKiemKe` (số đo thực tế, chênh lệch tính lại theo số sổ lúc kiểm).
- **Mục tiêu sản lượng**: ô chọn kỳ **Tháng / Quý / Năm** (`MucTieu.jsx`, nhớ ở localStorage `lg-mt-ky`). Tháng như cũ. **Quý / Năm** (`SanLuongTab.jsx`): bảng mục tiêu nhập RIÊNG cho kỳ (bảng `muc_tieu_ky`, **SQL 10**, khóa `YYYY-Qn` / `YYYY`), có cột Σ các tháng và nút "Lấy tổng mục tiêu các tháng"; bảng dưới là sản lượng thực tế từng tháng (chỉ xem, cộng từ số nhập theo ca / ngày; nhập số ở chế độ Tháng). API `docMucTieuKy`, `saveMucTieuKy` (Supabase + demo).
- **Tổng quan** chọn Quý / Năm: dòng (hướng · loại · đơn vị · hàng) nào có mục tiêu riêng của kỳ thì dùng số đó (chia đều theo ngày của kỳ), dòng chưa nhập thì cộng mục tiêu các tháng (`mucTieuNgay`, `tongTheoNhom` trong `src/lib/bieuDoSanLuong.js`). Dải chỉ số và Khối lượng xếp dỡ vẫn theo tháng.

## Chốt 10/11/2026: giải trùng bến, nhà thầu ở mục tiêu vận tải
- **Giải trùng bến**: `giaiTrung` đã gộp vào hàng chờ động `hangChoLai` (cuối file).
- **Đơn vị thực hiện (vận tải)**: chọn Hòa Phát hoặc từng nhà thầu trong Danh mục › Nhà thầu (đang dùng). Lưu `hoa_phat` hoặc `nt:<tên nhà thầu>` (`dsDonVi`, `tenDonVi` ở `src/lib/sanLuongTT.js`); số cũ `nha_thau` hiện là "Nhà thầu (chung)". Biểu đồ Tổng quan theo đơn vị hiện Hòa Phát + từng nhà thầu có số liệu. CSDL cần `sql/11_don_vi_nha_thau.sql` (bỏ giới hạn cột don_vi).

## Tổng quan thiết kế lại (10/11/2026, nhánh tong-quan-thiet-ke-lai)
- Thay `BangDieuKhien.jsx` (đã xóa) bằng `src/pages/tongquan/TongQuanMoi.jsx`: một trang cuộn. Trên cùng **thanh chọn kỳ** Tuần / Tháng / Quý / Năm + kỳ trước / kỳ sau (dính đầu trang); mọi chỉ số so với kỳ liền trước **cùng độ dài đã trôi** (hôm nay mới nhập dở nên không tính vào nhịp: `qua` = số ngày trước hôm nay). Rồi **4 đồng hồ sức khỏe** (sản lượng đạt, BOR, lấp đầy kho, xe sẵn sàng; bấm cuộn tới mảng) và danh sách **Cần xử lý ngay** (đỏ trước vàng, bấm tới nơi xử lý / mở phiếu chuyến); sau đó 4 mảng thu gọn được: Sản lượng · Cầu bến · Kho bãi · Thiết bị cơ giới.
- **Công thức chỉ số** ở `src/lib/chiSoTQ.js` (hàm thuần, kiểm thử ở `chi_so_tq.test.js`; mốc ở `NGUONG`): sản lượng (% đạt, tiến độ so kế hoạch, cần đạt mỗi ngày, dự báo cuối kỳ, năng suất t/ngày); cầu bến (BOR = giờ chiếm bến ÷ (số bến × giờ đã qua), hợp các đoạn chồng giờ cùng bến; chờ bến TB = ATB − NOR (chưa có NOR thì ETA); thời gian tàu ở bến = ATD − ATB; tàu chờ / ở bến / sắp đến 7 ngày; tàu cập – rời); kho (lấp đầy, nhập – xuất kỳ, ngày tồn = tồn ÷ xuất bình quân ngày, vòng quay, tồn trên 60 ngày, nguyên liệu dưới 7 ngày cấp, bãi vượt sức chứa); thiết bị (sẵn sàng bình quân kỳ và hiện tại, số lần hỏng, MTTR, xe-ngày dừng, quân số ca hiện tại). Không có OEE vì chưa có số liệu hiệu suất / chất lượng. Không đưa năng suất t/tàu-giờ và số tàu trùng / thiếu mét vào Tổng quan (anh Sỹ chốt).
- **Hình minh họa SVG** (`hinhVe.jsx`): đồng hồ đo `Gauge`; ảnh nền từng mảng `AnhMang`; `SoDoBai` (mỗi bãi lớn là một bể, mực hàng theo % lấp đầy); `BangDoiXe` (mỗi thiết bị một ô, màu theo tình trạng). Thẻ chỉ số, thanh kỳ, vùng mảng, danh sách vấn đề ở `TheChiSo.jsx`.
- Còn dùng lại: `KhoiSanLuong` (nhận `du` đã tải để khỏi tải lại; export `useSanLuongKy`, `khoaKyRieng`), `KhoiKho`, `GanttMet`, các hộp "Chi tiết" cũ (`HopTau`, `HopKho`, `HopThietBi`, `HopKhoiLuong`, chuông cảnh báo). `khoangKy(ky, ngayTC, homNay)` nhận ngày bất kỳ trong kỳ; `kyTruoc`, `kySau` ở `bieuDoSanLuong.js`.
- **Chỉnh lại sau khi anh Sỹ xem (10/11)**: bỏ hai biểu đồ sản lượng trùng ở khối chi tiết; "Phục vụ sản xuất" màu hồng `#ec4899` (không trùng vàng của đường mục tiêu); mảng Cầu bến dùng **Linetime theo mét** (`GanttMet`) thay sơ đồ cầu bến, có nút Chiếm bến / Toàn thời gian và chọn 5–30 ngày (nhớ ở localStorage `lg-tq-che`, `lg-tq-ngay`; kỳ này bắt đầu từ 2 ngày trước hôm nay, kỳ khác từ đầu kỳ); mảng Kho và Thiết bị: biểu đồ ở trên, Sơ đồ bãi và Bảng đội xe nằm trong mục ẩn.
- **Chỉnh lần 2 (10/11)**: khối "Phân tích chi tiết kho" (`KhoiKho`) hiện sẵn ở đầu mảng Kho (bỏ hai biểu đồ tuổi tồn / hàng cần xử lý trùng của mảng, chỉ giữ Lấp đầy 30 ngày); đường Dự báo màu xanh lá, tên "Dự báo lũy kế cuối kỳ (theo nhịp đến nay)"; chữ chú thích sáng hơn (lớp `tq-sang` ở `index.css` làm sáng `--muted-foreground` ở Tổng quan, chú thích biểu đồ giữ màu sáng ở `EChart.jsx`); khối Cần xử lý ngay cao tối đa 236 px, có thanh cuộn, không còn nút Xem thêm.

## Hàng chờ động (10/11/2026, nhánh hang-cho-dong)
- `hangChoLai` (`src/lib/tuXep.js`), chạy nền ở `TuXepTuDong.jsx`: xếp lại **giờ cập (ETB, ETD)** của mọi tàu chưa cập thật theo thứ tự ★ → đến trước (NOR, ETA) → ETA sớm; mỗi tàu lấy **chỗ trống sớm nhất** (`etbSomNhatMet`, chia sẻ bến theo số mét). Thêm tàu ETA sớm hơn hoặc có ★ thì tàu đó lên trước, tàu sau lùi; bến còn trống thì tàu bị kéo lên sớm (lỗi cũ: tàu phải cập sau giờ cập của mọi tàu đứng trước trong hàng nên ETB bị đẩy xa dù bến trống).
- Giữ nguyên, chiếm chỗ cho tàu khác: tàu có ATB, tàu có ETB đã qua (đang ở bến theo dự kiến), tàu có chuyển bến / ra neo, đã rời, đã hủy. Tàu đã có bến giữ bến (chỉ tàu chưa có bến mới được chọn bến). Giờ cập nhập tay của tàu chưa cập thật sẽ được web xếp lại theo thứ tự trên.
- Kiểm thử: `xep_ben.test.js` (kéo tàu lên sớm, tàu mới chen trước, ★, tàu cố định, ổn định khi chạy lại, ngẫu nhiên không thiếu mét).
- **Tàu chưa có LOA (10/11)**: `loaUoc` ở `capBen.js` — tàu thiếu LOA tính theo LOA ước (DWT / khối lượng / mớn, không có gì thì 150 m) trong mọi phép tính số mét (tự xếp, ETB gợi ý, cảnh báo trùng bến, hàng chờ động), giống lịch theo mét. Trước đó tàu thiếu LOA (VD TBA) bị coi là chiếm CẢ tuyến, làm các tàu khác cùng tuyến (B03-B05-B10…) bị đẩy ETB tới sau cả nhóm tàu đó dù bến còn chỗ.

## Tổng quan tinh gọn (11/2026, nhánh tong-quan-tinh-gon)
- Mảng **Sản lượng** (`BieuDoSanLuongTQ.jsx`) chỉ còn 6 biểu đồ: cơ cấu sản lượng cảng · cơ cấu theo đơn vị vận chuyển (Hòa Phát / nhà thầu) · lũy kế nhập / xuất cảng theo loại hàng · lũy kế theo đội xe · lũy kế nhập / xuất cảng thực tế – kế hoạch · lũy kế phục vụ cảng / phục vụ sản xuất thực tế – kế hoạch. Mảng **Kho bãi** (`BieuDoKhoTQ.jsx`): cơ cấu tồn · tuổi tồn · tồn theo loại hàng · lấp đầy theo bãi · lũy kế xuất nhập tồn kế hoạch / thực tế (kho thành phẩm và kho nguyên liệu). Bỏ thẻ chỉ số, sơ đồ bãi, mức đạt, phân tích chi tiết cũ của hai mảng này (`KhoiSanLuong.jsx` chỉ còn hook tải số liệu; `KhoiKho.jsx` chỉ xuất các khung).
- **Khung cố định**: `Khung` nhận `cao` (px; `CAO = 350` ở `BieuDoSanLuongTQ.jsx`): khung giữ nguyên chiều cao, nội dung dài thì cuộn trong khung; phóng to thì bỏ giới hạn. Lưới `auto-fit minmax(420px, 1fr)` tự chia cột theo bề rộng. Áp cả cho các biểu đồ ở mảng Cầu bến và Thiết bị.
- **Chỉnh lần 2**: hai biểu đồ lũy kế theo thời gian chỉ còn 4 đường mỗi biểu đồ (lũy kế kế hoạch nét đứt + lũy kế thực tế nét liền cho nhập, xuất / phục vụ cảng, phục vụ sản xuất; `chuoiKy` tính riêng từng hướng); **Tồn theo loại hàng** có nút chuyển Thành phẩm / Nguyên liệu; **Lấp đầy theo bãi** chia theo khu vực (`khaiBaoBai` → khuVuc, như Sơ đồ bãi), mỗi bãi là một dòng bấm được, mở hộp `ChiTietBai` (xuất từ `Kho.jsx`) liệt kê các bãi nhỏ.
- Chú thích (tooltip) biểu đồ dùng `appendToBody` ở `EChart.jsx` để không bị khung cố định / thanh cuộn cắt hay đè; tên khu vực ở biểu đồ Lấp đầy theo bãi màu `text-primary` trên nền nhạt.

## Nhập sản lượng theo ngày, tìm nhanh sổ kho (11/2026)
- **Mục tiêu sản lượng › bảng thực tế**: nhập theo **NGÀY**, mỗi ngày một dòng (bỏ CA 1 / CA 2 và dòng Cộng ngày; cột Tổng ngày). Không cần SQL mới: bảng vẫn có cột ca, số nhập theo ngày lưu ở dòng ca "CA 1". Số cũ nhập theo ca vẫn còn: ô của ngày hiện **tổng** các ca; sửa ô thì ghi cả ngày vào dòng "CA 1" và xóa dòng "CA 2" của ô đó (`BangThucTe` trong `SanLuongTab.jsx`). Các nơi đọc (Tổng quan, bảng mục tiêu) vốn cộng theo ngày nên không đổi.
- **Kho › Sổ nhập – xuất** có ô **tìm nhanh** (ngày, ca, loại, bãi, hàng, lô, tàu, nguồn, chứng từ, ghi chú; không phân biệt dấu / hoa thường), hiện số lượt khớp.
