-- 06. Mục tiêu và sản lượng THỰC TẾ nhập tay theo ca / ngày, cho hai tab của Khai thác Cảng › Mục tiêu sản lượng:
--   Mục tiêu khai thác cảng : mục tiêu tháng dùng bảng muc_tieu_san_luong (SQL 21, theo hướng nhập / xuất và loại hàng);
--                             thực tế theo ca / ngày: bảng san_luong_cang (CA 1, CA 2).
--   Mục tiêu khai thác vận tải: mục tiêu tháng: bảng muc_tieu_van_tai, theo hướng (Phục vụ cảng / Phục vụ sản xuất), loại xe,
--                             đơn vị thực hiện (Hòa Phát / Nhà thầu); thực tế theo ca / ngày: bảng san_luong_van_tai.
-- Chạy SAU 01_cau_truc.sql. Chạy được nhiều lần.
-- Ai có quyền phần Cảng đọc được; nhập liệu trở lên nhập / sửa / xóa số thực tế; mục tiêu tháng chỉ quản lý trở lên.

create table if not exists public.san_luong_cang (
  id         bigint generated always as identity primary key,
  ngay       date not null,
  ca         text not null check (ca in ('CA 1', 'CA 2')),
  huong      text not null check (huong in ('nhap', 'xuat')),
  loai_hang  text not null,                         -- nhóm hàng như ở mục tiêu: Quặng, Than, HRC…
  tan        numeric not null check (tan >= 0),
  ghi_chu    text,
  nguoi      uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  unique (ngay, ca, huong, loai_hang)
);
create index if not exists san_luong_cang_ngay_idx on public.san_luong_cang (ngay);

create table if not exists public.muc_tieu_van_tai (
  id         bigint generated always as identity primary key,
  thang      text not null check (thang ~ '^\d{4}-(0[1-9]|1[0-2])$'),   -- 'YYYY-MM'
  huong      text not null check (huong in ('phuc_vu_cang', 'phuc_vu_san_xuat')),
  loai_xe    text not null,                         -- Xe ben, Xe đầu kéo…
  don_vi     text not null check (don_vi in ('hoa_phat', 'nha_thau')),
  tan        numeric not null check (tan >= 0),
  ghi_chu    text,
  updated_at timestamptz not null default now(),
  unique (thang, huong, loai_xe, don_vi)
);

create table if not exists public.san_luong_van_tai (
  id         bigint generated always as identity primary key,
  ngay       date not null,
  ca         text not null check (ca in ('CA 1', 'CA 2')),
  huong      text not null check (huong in ('phuc_vu_cang', 'phuc_vu_san_xuat')),
  loai_xe    text not null,
  don_vi     text not null check (don_vi in ('hoa_phat', 'nha_thau')),
  tan        numeric not null check (tan >= 0),
  ghi_chu    text,
  nguoi      uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  unique (ngay, ca, huong, loai_xe, don_vi)
);
create index if not exists san_luong_van_tai_ngay_idx on public.san_luong_van_tai (ngay);

alter table public.san_luong_cang    enable row level security;
alter table public.muc_tieu_van_tai  enable row level security;
alter table public.san_luong_van_tai enable row level security;

do $$
declare t text;
begin
  foreach t in array array['san_luong_cang', 'muc_tieu_van_tai', 'san_luong_van_tai'] loop
    execute format('drop policy if exists %I on public.%I', t || '_doc', t);
    execute format('create policy %I on public.%I for select using (public.co_quyen(''cang'', array[''xem'',''nhap'',''quan_ly'',''quan_tri'']))', t || '_doc', t);
  end loop;
  -- Số thực tế: nhập liệu trở lên thêm / sửa / xóa (xóa số trong ô là xóa dòng)
  foreach t in array array['san_luong_cang', 'san_luong_van_tai'] loop
    execute format('drop policy if exists %I on public.%I', t || '_ghi', t);
    execute format('create policy %I on public.%I for all using (public.co_quyen(''cang'', array[''nhap'',''quan_ly'',''quan_tri''])) with check (public.co_quyen(''cang'', array[''nhap'',''quan_ly'',''quan_tri'']))', t || '_ghi', t);
  end loop;
  -- Mục tiêu tháng vận tải: quản lý trở lên (giống mục tiêu cảng)
  drop policy if exists muc_tieu_van_tai_ghi on public.muc_tieu_van_tai;
  create policy muc_tieu_van_tai_ghi on public.muc_tieu_van_tai for all
    using (public.co_quyen('cang', array['quan_ly', 'quan_tri'])) with check (public.co_quyen('cang', array['quan_ly', 'quan_tri']));
end $$;

drop trigger if exists audit_san_luong_cang on public.san_luong_cang;
create trigger audit_san_luong_cang after insert or update or delete on public.san_luong_cang for each row execute function public.ghi_audit();
drop trigger if exists audit_muc_tieu_van_tai on public.muc_tieu_van_tai;
create trigger audit_muc_tieu_van_tai after insert or update or delete on public.muc_tieu_van_tai for each row execute function public.ghi_audit();
drop trigger if exists audit_san_luong_van_tai on public.san_luong_van_tai;
create trigger audit_san_luong_van_tai after insert or update or delete on public.san_luong_van_tai for each row execute function public.ghi_audit();
