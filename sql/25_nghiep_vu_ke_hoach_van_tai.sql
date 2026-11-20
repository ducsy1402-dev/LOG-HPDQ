-- 25. NGHIỆP VỤ của Kế hoạch vận tải (Kế hoạch tổng hợp › Đặt mục tiêu › Kế hoạch vận tải): thêm cột "Nghiệp vụ" với các giá trị
--     Nhập tàu · Xuất tàu · Trung chuyển · Thu hồi · Cấp sản xuất. Nghiệp vụ là một phần của khóa dòng: cùng loại hàng + hướng + loại xe + đơn vị
--     nhưng khác nghiệp vụ là hai dòng khác nhau. Dòng cũ để trống (nghiep_vu = ''). Sản lượng THỰC TẾ vận tải vẫn nhập theo cột (hướng, loại xe, đơn vị, loại hàng), không chia theo nghiệp vụ.
-- Áp cho mục tiêu tháng (muc_tieu_van_tai) và mục tiêu quý / năm (muc_tieu_ky). Chạy SAU 06 và 10 (và 11). Chạy được nhiều lần. Chạy TRƯỚC khi đẩy code.
alter table public.muc_tieu_van_tai add column if not exists nghiep_vu text not null default '';
alter table public.muc_tieu_ky      add column if not exists nghiep_vu text not null default '';

drop index if exists public.muc_tieu_van_tai_khoa;
create unique index if not exists muc_tieu_van_tai_khoa on public.muc_tieu_van_tai (thang, huong, loai_xe, don_vi, loai_hang, nghiep_vu);
drop index if exists public.muc_tieu_ky_khoa;
create unique index if not exists muc_tieu_ky_khoa on public.muc_tieu_ky (nhom, ky, huong, loai, don_vi, loai_hang, nghiep_vu);
