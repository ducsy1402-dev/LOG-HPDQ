-- 23. KẾ HOẠCH TỔNG HỢP › KẾ HOẠCH NGÀY (nút "Kế hoạch ngày" của menu Kế hoạch tổng hợp).
--   kh_ngay_bo       : xuất / nhập đường BỘ theo ngày: hàng, hướng (nhập / xuất), kho / bãi › gian / lô, khối lượng.
--   kh_ngay_tau_xe   : đường BIỂN, chi tiết một tàu trong một ngày: phân xe (loại xe tùy chọn × Hòa Phát / Thuê ngoài).
--   kh_ngay_tau_kho  : đường BIỂN, chi tiết một tàu trong một ngày: xuất kho (tàu xuất) hoặc nhập kho (tàu nhập) về từng gian / lô.
-- Khối lượng của tàu trong ngày vẫn là bảng ke_hoach_san_luong_ngay (SQL 13); hai bảng tau_* chỉ chia nhỏ số đó theo xe và theo kho.
-- Chạy SAU 13 và 16 (cần co_quyen, co_nhom, ghi_audit, voyages). Chạy được nhiều lần.
create table if not exists public.kh_ngay_bo (
  id          bigint generated always as identity primary key,
  ngay        date not null,
  hang        text not null,
  huong       text not null check (huong in ('nhap', 'xuat')),
  ten_bai     text not null default '',
  ten_khu     text not null default '',
  tan         numeric not null check (tan >= 0),
  updated_at  timestamptz not null default now()
);
create index if not exists kh_ngay_bo_ngay_idx on public.kh_ngay_bo (ngay);

create table if not exists public.kh_ngay_tau_xe (
  id          bigint generated always as identity primary key,
  voyage_id   bigint not null references public.voyages(id) on delete cascade,
  ngay        date not null,
  loai_xe     text not null default '',
  don_vi      text not null check (don_vi in ('hoa_phat', 'nha_thau')),
  tan         numeric not null check (tan >= 0),
  updated_at  timestamptz not null default now(),
  unique (voyage_id, ngay, loai_xe, don_vi)
);
create index if not exists kh_ngay_tau_xe_ngay_idx on public.kh_ngay_tau_xe (ngay);

create table if not exists public.kh_ngay_tau_kho (
  id          bigint generated always as identity primary key,
  voyage_id   bigint not null references public.voyages(id) on delete cascade,
  ngay        date not null,
  ten_bai     text not null,
  ten_khu     text not null default '',
  tan         numeric not null check (tan >= 0),
  updated_at  timestamptz not null default now(),
  unique (voyage_id, ngay, ten_bai, ten_khu)
);
create index if not exists kh_ngay_tau_kho_ngay_idx on public.kh_ngay_tau_kho (ngay);

do $$
declare t text;
begin
  foreach t in array array['kh_ngay_bo', 'kh_ngay_tau_xe', 'kh_ngay_tau_kho'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_doc', t);
    execute format('drop policy if exists %I on public.%I', t || '_ghi', t);
    execute format('drop policy if exists %I on public.%I', t || '_ghi_nhom', t);
    execute format($f$create policy %I on public.%I for select using (public.co_quyen('cang', array['xem','nhap','quan_ly','quan_tri']) or public.co_quyen('kho', array['xem','nhap','quan_ly','quan_tri']))$f$, t || '_doc', t);
    execute format($f$create policy %I on public.%I for all using (public.co_quyen('cang', array['nhap','quan_ly','quan_tri']) or public.co_quyen('kho', array['nhap','quan_ly','quan_tri'])) with check (public.co_quyen('cang', array['nhap','quan_ly','quan_tri']) or public.co_quyen('kho', array['nhap','quan_ly','quan_tri']))$f$, t || '_ghi', t);
    execute format($f$create policy %I on public.%I for all using (public.co_nhom(array['xuat_nhap','kho_bai','van_tai'])) with check (public.co_nhom(array['xuat_nhap','kho_bai','van_tai']))$f$, t || '_ghi_nhom', t);
    execute format('drop trigger if exists %I on public.%I', 'audit_' || t, t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.ghi_audit()', 'audit_' || t, t);
  end loop;
end $$;
