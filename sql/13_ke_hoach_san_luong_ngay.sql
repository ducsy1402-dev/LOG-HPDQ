-- 13. KẾ HOẠCH SẢN LƯỢNG THEO NGÀY, THEO LINE TÀU (Khai thác Cảng › Mục tiêu sản lượng › nút "Kế hoạch ngày").
-- Người lập kế hoạch đặt số tấn kế hoạch cho từng ngày của từng chuyến tàu trong line tàu cập; hướng (nhập / xuất) và loại hàng lấy theo chuyến tàu.
-- Các biểu đồ so kế hoạch với thực tế (bảng san_luong_cang, SQL 06) dùng bảng này. Chạy SAU 01…12. Chạy được nhiều lần.
-- Ai có quyền phần Cảng đọc được; nhập liệu trở lên thêm / sửa / xóa (xóa số trong ô là xóa dòng).
create table if not exists public.ke_hoach_san_luong_ngay (
  id          bigint generated always as identity primary key,
  voyage_id   bigint not null references public.voyages(id) on delete cascade,
  ngay        date not null,
  khoi_luong  numeric not null check (khoi_luong >= 0),   -- tấn kế hoạch của chuyến trong ngày đó
  ghi_chu     text,
  nguoi       uuid default auth.uid(),
  updated_at  timestamptz not null default now(),
  unique (voyage_id, ngay)
);
create index if not exists ke_hoach_sl_ngay_idx on public.ke_hoach_san_luong_ngay (ngay);

alter table public.ke_hoach_san_luong_ngay enable row level security;
drop policy if exists ke_hoach_sl_ngay_doc on public.ke_hoach_san_luong_ngay;
drop policy if exists ke_hoach_sl_ngay_ghi on public.ke_hoach_san_luong_ngay;
create policy ke_hoach_sl_ngay_doc on public.ke_hoach_san_luong_ngay for select
  using (public.co_quyen('cang', array['xem','nhap','quan_ly','quan_tri']));
create policy ke_hoach_sl_ngay_ghi on public.ke_hoach_san_luong_ngay for all
  using (public.co_quyen('cang', array['nhap','quan_ly','quan_tri']))
  with check (public.co_quyen('cang', array['nhap','quan_ly','quan_tri']));

drop trigger if exists audit_ke_hoach_sl_ngay on public.ke_hoach_san_luong_ngay;
create trigger audit_ke_hoach_sl_ngay after insert or update or delete on public.ke_hoach_san_luong_ngay
  for each row execute function public.ghi_audit();
