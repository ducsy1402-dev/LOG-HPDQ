-- 10. Mục tiêu theo QUÝ / NĂM (Khai thác Cảng › Mục tiêu sản lượng, chọn Quý hoặc Năm). Chạy SAU 06. Chạy được nhiều lần.
-- Một bảng chung cho cả hai nhóm: nhom = 'cang' (loai = loại hàng) hoặc 'van_tai' (loai = loại xe, kèm đơn vị thực hiện và loại hàng).
-- ky = 'YYYY-Qn' (quý) hoặc 'YYYY' (năm). Mục tiêu tháng vẫn ở muc_tieu_san_luong / muc_tieu_van_tai, không đổi.
-- Quản lý trở lên đặt mục tiêu; ai có quyền phần Cảng đều xem được.
create table if not exists public.muc_tieu_ky (
  id         bigint generated always as identity primary key,
  nhom       text not null check (nhom in ('cang', 'van_tai')),
  ky         text not null check (ky ~ '^\d{4}(-Q[1-4])?$'),
  huong      text not null,
  loai       text not null,
  don_vi     text not null default '',
  loai_hang  text not null default '',
  tan        numeric not null check (tan >= 0),
  ghi_chu    text,
  updated_at timestamptz not null default now()
);
create unique index if not exists muc_tieu_ky_khoa on public.muc_tieu_ky (nhom, ky, huong, loai, don_vi, loai_hang);

alter table public.muc_tieu_ky enable row level security;
drop policy if exists muc_tieu_ky_doc on public.muc_tieu_ky;
drop policy if exists muc_tieu_ky_ghi on public.muc_tieu_ky;
create policy muc_tieu_ky_doc on public.muc_tieu_ky for select
  using (public.co_quyen('cang', array['xem', 'nhap', 'quan_ly', 'quan_tri']));
create policy muc_tieu_ky_ghi on public.muc_tieu_ky for all
  using (public.co_quyen('cang', array['quan_ly', 'quan_tri']))
  with check (public.co_quyen('cang', array['quan_ly', 'quan_tri']));

drop trigger if exists audit_muc_tieu_ky on public.muc_tieu_ky;
create trigger audit_muc_tieu_ky after insert or update or delete on public.muc_tieu_ky for each row execute function public.ghi_audit();
