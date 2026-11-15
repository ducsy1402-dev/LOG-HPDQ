-- 14 · Quân số thực tế theo TỔ (Thiết bị cơ giới › Khai báo › Nhân sự & quân số)
-- Trước đây quân số chỉ nhập theo ĐỘI (bảng headcount). Nay nhập theo từng TỔ trong mỗi ca (bảng headcount_to);
-- quân số của đội = cộng các tổ của đội đó. Bảng headcount cũ giữ nguyên (số đã nhập theo đội vẫn đọc được cho đến khi nhập theo tổ).
-- Chạy được nhiều lần. Chạy TRƯỚC khi đẩy code lên main; chưa chạy thì tab Nhân sự & quân số báo cần chạy SQL 14 và dùng bảng nhập theo đội như cũ.

create table if not exists public.headcount_to (
  ngay       date not null,
  ca         text not null,
  to_xe      text not null,
  doi        text,
  thuc_te    int check (thuc_te >= 0),
  ghi_chu    text,
  updated_at timestamptz not null default now(),
  primary key (ngay, ca, to_xe)
);
create index if not exists headcount_to_ngay_idx on public.headcount_to (ngay);

alter table public.headcount_to enable row level security;
drop policy if exists hct_doc on public.headcount_to;
drop policy if exists hct_ghi on public.headcount_to;
create policy hct_doc on public.headcount_to for select using (public.co_vai_tro(array['xem','nhap','quan_tri']));
create policy hct_ghi on public.headcount_to for all using (public.co_vai_tro(array['nhap','quan_tri'])) with check (public.co_vai_tro(array['nhap','quan_tri']));

-- Tự cập nhật updated_at khi sửa
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists headcount_to_updated on public.headcount_to;
create trigger headcount_to_updated before update on public.headcount_to
  for each row execute function public.set_updated_at();

-- Dấu vân tay dữ liệu Thiết bị cơ giới (web hỏi mỗi 10 giây để biết có người khác vừa sửa): thêm bảng mới vào danh sách theo dõi
create or replace function public.dau_van_tay_du_lieu(p_nhom text default 'cang') returns text
language plpgsql stable security definer set search_path = public as $$
declare
  v text;
  x text;
  b text;
  ds text[];
begin
  if auth.uid() is null then return null; end if;   -- khách chưa đăng nhập không hỏi được
  if p_nhom = 'thiet_bi' then
    v := 'tb';
    ds := array['danh_muc', 'vehicles', 'staff', 'ca_kip', 'headcount', 'headcount_to', 'events', 'model_specs', 'hang_hoa', 'thiet_bi_gan_sl',
                'demand_batches', 'demands', 'assignments', 'gan_co_dinh', 'plan_params', 'plan_jobs', 'user_roles'];
  else
    v := (select coalesce(max(id), 0)::text from public.audit_log);
    ds := array['berths', 'vessels', 'agents', 'kho_bai', 'kho_lo', 'danh_muc_cot', 'user_module_roles'];
  end if;
  foreach b in array ds loop
    if to_regclass('public.' || b) is not null then   -- bảng chưa có (chưa chạy SQL tương ứng) thì bỏ qua
      execute format('select count(*) || '':'' || coalesce(sum(hashtext(t::text)), 0) from public.%I t', b) into x;
      v := v || '|' || x;
    end if;
  end loop;
  return v;
end $$;

revoke all on function public.dau_van_tay_du_lieu(text) from public, anon;
grant execute on function public.dau_van_tay_du_lieu(text) to authenticated;

-- Kiểm tra: phải thấy 1 dòng headcount_to
select table_name from information_schema.tables where table_schema = 'public' and table_name = 'headcount_to';
