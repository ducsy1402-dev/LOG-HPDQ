-- 22. KẾ HOẠCH TỔNG HỢP (menu "Kế hoạch tổng hợp"): ba bản kế hoạch chính XUẤT BÁN → SẢN XUẤT → NHẬP MUA, lập theo THÁNG / QUÝ / NĂM và theo HÀNG.
--   kh_tong_hop : số kế hoạch của từng hàng (xuất bán và nhập mua chia đường bộ / đường biển; sản xuất chỉ có tổng). Tổng = bộ + biển (web ghi sẵn).
--   kh_phan_xe  : phân xe của đường bộ / đường biển (xuất bán, nhập mua): loại xe (tùy chọn) × đơn vị (Hòa Phát / Thuê ngoài).
--   kh_phan_kho : phân bổ về từng bãi – gian / lô: xuất kho (xuất bán) hoặc nhập kho (sản xuất, nhập mua).
-- Kỳ (ky): tháng '2026-11' · quý '2026-Q4' · năm '2026' (cùng khóa với lib/ky.js). Mỗi kỳ là một bản kế hoạch riêng, không tự cộng từ kỳ nhỏ.
-- Chạy SAU 01…19 (cần co_quyen, co_nhom, ghi_audit). Chạy được nhiều lần. (Bản đầu của file này, nếu đã chạy: xóa hai bảng kh_xuat_ban_xe, kh_xuat_kho.)
drop table if exists public.kh_xuat_ban_xe;
drop table if exists public.kh_xuat_kho;

create table if not exists public.kh_tong_hop (
  id          bigint generated always as identity primary key,
  loai        text not null check (loai in ('xuat_ban', 'san_xuat', 'nhap_mua')),
  ky          text not null,
  hang        text not null,                                          -- tên hàng (Danh mục › Hàng hóa)
  bo          numeric not null default 0 check (bo >= 0),             -- đường bộ (t)
  bien        numeric not null default 0 check (bien >= 0),           -- đường biển (t)
  tong        numeric not null default 0 check (tong >= 0),           -- tổng (t); sản xuất chỉ dùng cột này
  ghi_chu     text,
  updated_at  timestamptz not null default now(),
  unique (loai, ky, hang)
);
create index if not exists kh_tong_hop_ky_idx on public.kh_tong_hop (ky);

create table if not exists public.kh_phan_xe (
  id          bigint generated always as identity primary key,
  loai        text not null check (loai in ('xuat_ban', 'nhap_mua')),
  ky          text not null,
  hang        text not null,
  hinh_thuc   text not null check (hinh_thuc in ('bo', 'bien')),
  loai_xe     text not null default '',                               -- '' = không chia loại xe
  don_vi      text not null check (don_vi in ('hoa_phat', 'nha_thau')),
  tan         numeric not null check (tan >= 0),
  updated_at  timestamptz not null default now(),
  unique (loai, ky, hang, hinh_thuc, loai_xe, don_vi)
);
create index if not exists kh_phan_xe_ky_idx on public.kh_phan_xe (ky);

create table if not exists public.kh_phan_kho (
  id          bigint generated always as identity primary key,
  loai        text not null check (loai in ('xuat_ban', 'san_xuat', 'nhap_mua')),
  ky          text not null,
  hang        text not null,
  ten_bai     text not null,                                          -- kho / bãi
  ten_khu     text not null default '',                               -- gian / lô
  tan         numeric not null check (tan >= 0),
  updated_at  timestamptz not null default now(),
  unique (loai, ky, hang, ten_bai, ten_khu)
);
create index if not exists kh_phan_kho_ky_idx on public.kh_phan_kho (ky);

do $$
declare t text;
begin
  foreach t in array array['kh_tong_hop', 'kh_phan_xe', 'kh_phan_kho'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_doc', t);
    execute format('drop policy if exists %I on public.%I', t || '_ghi', t);
    execute format('drop policy if exists %I on public.%I', t || '_ghi_nhom', t);
    -- đọc: có quyền phần Cảng hoặc Kho bãi
    execute format($f$create policy %I on public.%I for select using (public.co_quyen('cang', array['xem','nhap','quan_ly','quan_tri']) or public.co_quyen('kho', array['xem','nhap','quan_ly','quan_tri']))$f$, t || '_doc', t);
    -- ghi: nhập liệu trở lên ở Cảng hoặc Kho bãi
    execute format($f$create policy %I on public.%I for all using (public.co_quyen('cang', array['nhap','quan_ly','quan_tri']) or public.co_quyen('kho', array['nhap','quan_ly','quan_tri'])) with check (public.co_quyen('cang', array['nhap','quan_ly','quan_tri']) or public.co_quyen('kho', array['nhap','quan_ly','quan_tri']))$f$, t || '_ghi', t);
    -- ghi theo nhóm quyền khu vực (SQL 16): xuất nhập, kho bãi, vận tải
    execute format($f$create policy %I on public.%I for all using (public.co_nhom(array['xuat_nhap','kho_bai','van_tai'])) with check (public.co_nhom(array['xuat_nhap','kho_bai','van_tai']))$f$, t || '_ghi_nhom', t);
    execute format('drop trigger if exists %I on public.%I', 'audit_' || t, t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.ghi_audit()', 'audit_' || t, t);
  end loop;
end $$;
