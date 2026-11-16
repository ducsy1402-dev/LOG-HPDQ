-- 18 · Thông tin ĐẦU / CUỐI CA theo từng xe (Thiết bị cơ giới › Khai báo › Thông tin đầu/cuối ca)
-- Mỗi dòng: ngày + ca + (đầu ca | cuối ca) + mã xe, kèm tổ, tình trạng (sẵn sàng | hỏng | BD định kỳ | BD chiến lược) và vị trí / bộ phận sử dụng (BPSD).
-- Chạy được nhiều lần. Chạy TRƯỚC khi đẩy code lên main; chưa chạy thì tab Thông tin đầu/cuối ca báo cần chạy SQL 18.
-- Cần SQL 16 đã chạy (hàm co_nhom) nếu dùng nhóm quyền; chưa có thì bỏ qua phần chính sách nhóm.

create table if not exists public.thong_tin_ca (
  ngay       date not null,
  ca         text not null,
  loai       text not null check (loai in ('dau', 'cuoi')),
  ma_xe      text not null,
  to_xe      text,
  tinh_trang text not null default 'san_sang',
  vi_tri     text,
  updated_at timestamptz not null default now(),
  primary key (ngay, ca, loai, ma_xe)
);
-- Tình trạng: san_sang | hong | bddk (BD định kỳ) | bdcl (BD chiến lược)
alter table public.thong_tin_ca drop constraint if exists thong_tin_ca_tinh_trang_check;
alter table public.thong_tin_ca add constraint thong_tin_ca_tinh_trang_check check (tinh_trang in ('san_sang', 'hong', 'bddk', 'bdcl'));
create index if not exists thong_tin_ca_ngay_idx on public.thong_tin_ca (ngay);

alter table public.thong_tin_ca enable row level security;
drop policy if exists ttca_doc on public.thong_tin_ca;
drop policy if exists ttca_ghi on public.thong_tin_ca;
create policy ttca_doc on public.thong_tin_ca for select using (public.co_vai_tro(array['xem','nhap','quan_tri']));
create policy ttca_ghi on public.thong_tin_ca for all using (public.co_vai_tro(array['nhap','quan_tri'])) with check (public.co_vai_tro(array['nhap','quan_tri']));

do $$
begin
  if to_regprocedure('public.co_nhom(text[])') is not null then
    drop policy if exists thong_tin_ca_ghi_nhom on public.thong_tin_ca;
    create policy thong_tin_ca_ghi_nhom on public.thong_tin_ca for all
      using (public.co_nhom(array['van_tai'])) with check (public.co_nhom(array['van_tai']));
  end if;
end $$;

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists thong_tin_ca_updated on public.thong_tin_ca;
create trigger thong_tin_ca_updated before update on public.thong_tin_ca
  for each row execute function public.set_updated_at();

-- Dấu vân tay dữ liệu Thiết bị cơ giới: thêm bảng mới vào danh sách theo dõi (như SQL 14)
create or replace function public.dau_van_tay_du_lieu(p_nhom text default 'cang') returns text
language plpgsql stable security definer set search_path = public as $$
declare
  v text;
  x text;
  b text;
  ds text[];
begin
  if auth.uid() is null then return null; end if;
  if p_nhom = 'thiet_bi' then
    v := 'tb';
    ds := array['danh_muc', 'vehicles', 'staff', 'ca_kip', 'headcount', 'headcount_to', 'thong_tin_ca', 'events', 'model_specs', 'hang_hoa', 'thiet_bi_gan_sl',
                'demand_batches', 'demands', 'assignments', 'gan_co_dinh', 'plan_params', 'plan_jobs', 'user_roles'];
  else
    v := (select coalesce(max(id), 0)::text from public.audit_log);
    ds := array['berths', 'vessels', 'agents', 'kho_bai', 'kho_lo', 'danh_muc_cot', 'user_module_roles'];
  end if;
  foreach b in array ds loop
    if to_regclass('public.' || b) is not null then
      execute format('select count(*) || '':'' || coalesce(sum(hashtext(t::text)), 0) from public.%I t', b) into x;
      v := v || '|' || x;
    end if;
  end loop;
  return v;
end $$;

revoke all on function public.dau_van_tay_du_lieu(text) from public, anon;
grant execute on function public.dau_van_tay_du_lieu(text) to authenticated;

-- Kiểm tra: phải thấy 1 dòng thong_tin_ca
select table_name from information_schema.tables where table_schema = 'public' and table_name = 'thong_tin_ca';
