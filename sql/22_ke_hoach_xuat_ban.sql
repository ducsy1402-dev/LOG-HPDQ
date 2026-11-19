-- 22. KẾ HOẠCH TỔNG HỢP › KẾ HOẠCH DÀI HẠN › KẾ HOẠCH XUẤT BÁN (menu "Kế hoạch tổng hợp").
-- Kế hoạch xuất bán theo THÁNG và theo HÀNG, chia đường bộ / đường biển; mỗi hình thức chia theo loại xe (tùy chọn) và đơn vị thực hiện (Hòa Phát / Thuê ngoài).
-- Tổng của một hàng = đường bộ + đường biển (web tự cộng, không lưu). Kế hoạch xuất kho phân bổ tổng đó về từng bãi – gian / lô đang chứa hàng.
-- Chạy SAU 01…19 (cần co_quyen, co_nhom, ghi_audit). Chạy được nhiều lần.
create table if not exists public.kh_xuat_ban_xe (
  id          bigint generated always as identity primary key,
  thang       text not null,                                          -- 'yyyy-mm'
  hang        text not null,                                          -- tên hàng (Danh mục › Hàng hóa)
  hinh_thuc   text not null check (hinh_thuc in ('bo', 'bien')),      -- đường bộ / đường biển
  loai_xe     text not null default '',                               -- loại xe; '' = không chia loại xe
  don_vi      text not null check (don_vi in ('hoa_phat', 'nha_thau')),
  tan         numeric not null check (tan >= 0),
  updated_at  timestamptz not null default now(),
  unique (thang, hang, hinh_thuc, loai_xe, don_vi)
);
create index if not exists kh_xuat_ban_xe_thang_idx on public.kh_xuat_ban_xe (thang);

create table if not exists public.kh_xuat_kho (
  id          bigint generated always as identity primary key,
  thang       text not null,
  hang        text not null,
  ten_bai     text not null,                                          -- kho / bãi
  ten_khu     text not null default '',                               -- gian / lô
  tan         numeric not null check (tan >= 0),
  updated_at  timestamptz not null default now(),
  unique (thang, hang, ten_bai, ten_khu)
);
create index if not exists kh_xuat_kho_thang_idx on public.kh_xuat_kho (thang);

do $$
declare t text;
begin
  foreach t in array array['kh_xuat_ban_xe', 'kh_xuat_kho'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_doc', t);
    execute format('drop policy if exists %I on public.%I', t || '_ghi', t);
    execute format('drop policy if exists %I on public.%I', t || '_ghi_nhom', t);
    -- đọc: có quyền phần Cảng hoặc Kho bãi
    execute format($f$create policy %I on public.%I for select using (public.co_quyen('cang', array['xem','nhap','quan_ly','quan_tri']) or public.co_quyen('kho', array['xem','nhap','quan_ly','quan_tri']))$f$, t || '_doc', t);
    -- ghi: nhập liệu trở lên ở Cảng hoặc Kho bãi
    execute format($f$create policy %I on public.%I for all using (public.co_quyen('cang', array['nhap','quan_ly','quan_tri']) or public.co_quyen('kho', array['nhap','quan_ly','quan_tri'])) with check (public.co_quyen('cang', array['nhap','quan_ly','quan_tri']) or public.co_quyen('kho', array['nhap','quan_ly','quan_tri']))$f$, t || '_ghi', t);
    -- ghi theo nhóm quyền khu vực (SQL 16): xuất nhập, kho bãi
    execute format($f$create policy %I on public.%I for all using (public.co_nhom(array['xuat_nhap','kho_bai'])) with check (public.co_nhom(array['xuat_nhap','kho_bai']))$f$, t || '_ghi_nhom', t);
    execute format('drop trigger if exists %I on public.%I', 'audit_' || t, t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.ghi_audit()', 'audit_' || t, t);
  end loop;
end $$;
