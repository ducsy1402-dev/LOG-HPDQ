-- =====================================================================
-- 01. CẤU TRÚC CƠ SỞ DỮ LIỆU CHO PROJECT SUPABASE MỚI (LOG-HPDQ)
-- Chạy MỘT LẦN trong Supabase > SQL Editor > New query > dán toàn bộ > Run, trên project còn trống.
-- Gom từ các file SQL 1 … 28 của web gốc, đã BỎ: Phương án làm hàng (cargo_plans), Thưởng phạt tàu (tiền: voyage_tien),
-- nạp xe / nhân sự mẫu, bảng phân bổ cố định mẫu. Tài khoản đăng nhập tạo ở Authentication, cấp quyền bằng 04_cap_quyen.sql.
-- Thứ tự chạy cả bộ:  01_cau_truc.sql  ->  02_nap_danh_muc.sql  ->  03_bo_tri_ben.sql  ->  04_cap_quyen.sql  (->  05_lich_chay_nen.sql, tùy chọn)
-- =====================================================================


-- =====================================================================
-- A. Quyền người dùng và bảng của Thiết bị cơ giới (xe, nhân sự, sự kiện, kíp, quân số)
-- =====================================================================

-- 1. Quyền người dùng: xem | nhap | quan_tri
create table public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  vai_tro text not null check (vai_tro in ('xem','nhap','quan_tri')),
  ho_ten  text
);

-- 2. Danh mục chung (danh sách chọn, ngưỡng) lưu dạng JSON
create table public.danh_muc (
  id text primary key,              -- 'meta' | 'nguong'
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- 3. Danh mục xe
create table public.vehicles (
  ma      text primary key,         -- mã xe, VD: XL-VT31
  doi     text not null,            -- đội xe / dòng xe, VD: Xúc lật
  model   text,
  to_xe   text,                     -- tổ / khu vực, VD: HRC2
  che_do  text not null default 'Đi ca' check (che_do in ('Đi ca','HC')),
  ghi_chu text,
  created_at timestamptz not null default now()
);

-- 4. Danh mục nhân sự
create table public.staff (
  ma         text primary key,
  ho_ten     text not null,
  doi        text,
  to_xe      text,
  kip        text,                  -- A, B, C, D, HC
  nhom       text,                  -- Lái xe | Vận hành
  trang_thai text not null default 'Đang làm việc'
);

-- 5. Sự kiện xe (hỏng / bảo dưỡng)
create table public.events (
  id           bigint generated always as identity primary key,
  ma_xe        text not null references public.vehicles(ma) on update cascade,
  loai         text not null,       -- Hỏng | BD định kỳ | BD chiến lược
  nhom         text,
  mo_ta        text,
  ngay_vao     date not null default current_date,
  ngay_du_kien date,
  ngay_xong    date,                -- để trống = đang xử lý
  phu_tung     text,
  pic          text,
  nguoi_nhap   uuid default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (ngay_xong is null or ngay_xong >= ngay_vao),
  check (ngay_du_kien is null or ngay_du_kien >= ngay_vao)
);
create index events_ngay_xong_idx on public.events (ngay_xong);
create index events_ma_xe_idx on public.events (ma_xe);

-- 6. Kíp đi ca theo ngày + ca
create table public.ca_kip (
  ngay date not null,
  ca   text not null,
  kip  text,
  primary key (ngay, ca)
);

-- 7. Quân số thực tế theo ngày + ca + đội
create table public.headcount (
  ngay    date not null,
  ca      text not null,
  doi     text not null,
  thuc_te int check (thuc_te >= 0),
  ghi_chu text,
  updated_at timestamptz not null default now(),
  primary key (ngay, ca, doi)
);

-- Tự cập nhật updated_at khi sửa sự kiện
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
create trigger events_updated before update on public.events
  for each row execute function public.set_updated_at();

-- Hàm kiểm tra vai trò của người đang đăng nhập
create or replace function public.co_vai_tro(cac text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles
                 where user_id = auth.uid() and vai_tro = any(cac));
$$;

-- Bật Row Level Security
alter table public.user_roles enable row level security;
alter table public.danh_muc   enable row level security;
alter table public.vehicles   enable row level security;
alter table public.staff      enable row level security;
alter table public.events     enable row level security;
alter table public.ca_kip     enable row level security;
alter table public.headcount  enable row level security;

-- user_roles: mỗi người xem quyền của mình; quản trị xem và sửa tất cả
create policy ur_doc on public.user_roles for select
  using (user_id = auth.uid() or public.co_vai_tro(array['quan_tri']));
create policy ur_ghi on public.user_roles for all
  using (public.co_vai_tro(array['quan_tri'])) with check (public.co_vai_tro(array['quan_tri']));

-- Đọc: mọi người đã được cấp quyền
create policy dm_doc on public.danh_muc  for select using (public.co_vai_tro(array['xem','nhap','quan_tri']));
create policy vh_doc on public.vehicles  for select using (public.co_vai_tro(array['xem','nhap','quan_tri']));
create policy st_doc on public.staff     for select using (public.co_vai_tro(array['xem','nhap','quan_tri']));
create policy ev_doc on public.events    for select using (public.co_vai_tro(array['xem','nhap','quan_tri']));
create policy ck_doc on public.ca_kip    for select using (public.co_vai_tro(array['xem','nhap','quan_tri']));
create policy hc_doc on public.headcount for select using (public.co_vai_tro(array['xem','nhap','quan_tri']));

-- Ghi sự kiện, kíp, quân số: người nhập liệu + quản trị
create policy ev_them on public.events for insert with check (public.co_vai_tro(array['nhap','quan_tri']));
create policy ev_sua  on public.events for update using (public.co_vai_tro(array['nhap','quan_tri'])) with check (public.co_vai_tro(array['nhap','quan_tri']));
create policy ev_xoa  on public.events for delete using (public.co_vai_tro(array['quan_tri']));
create policy ck_ghi  on public.ca_kip    for all using (public.co_vai_tro(array['nhap','quan_tri'])) with check (public.co_vai_tro(array['nhap','quan_tri']));
create policy hc_ghi  on public.headcount for all using (public.co_vai_tro(array['nhap','quan_tri'])) with check (public.co_vai_tro(array['nhap','quan_tri']));

-- Ghi danh mục xe, nhân sự, danh mục chung: chỉ quản trị
create policy vh_ghi on public.vehicles for all using (public.co_vai_tro(array['quan_tri'])) with check (public.co_vai_tro(array['quan_tri']));
create policy st_ghi on public.staff    for all using (public.co_vai_tro(array['quan_tri'])) with check (public.co_vai_tro(array['quan_tri']));
create policy dm_ghi on public.danh_muc for all using (public.co_vai_tro(array['quan_tri'])) with check (public.co_vai_tro(array['quan_tri']));

-- =====================================================================
-- B. Thông số model, hàng hóa
-- =====================================================================

-- 1. Thông số kỹ thuật theo model (dùng cho tra cứu và Giai đoạn 3: năng suất)
create table if not exists public.model_specs (
  model                 text primary key,        -- tên model đầy đủ như trong file thông số
  ma_model              text,                    -- mã nhận diện, VD PC350-8MO; khớp với vehicles.model
  loai_xe               text,                    -- Xúc đào | Xúc lật | ...
  trong_luong_kg        numeric,
  the_tich_gau_m3       numeric,
  tai_trong_nang_kg     numeric,
  kich_thuoc            text,                    -- D x R x C (mm)
  chieu_sau_dao_mm      numeric,
  chieu_cao_do_hang_mm  numeric,
  ban_kinh_quay_mm      numeric,
  toc_do_quay_vph       numeric,                 -- vòng/phút
  dung_tich_nhien_lieu  numeric,                 -- lít hoặc kWh
  ghi_chu               text,
  updated_at            timestamptz not null default now()
);
create index if not exists model_specs_ma_model_idx on public.model_specs (ma_model);

-- 2. Danh mục hàng hóa và tỉ trọng (tấn/m3) cho Giai đoạn 3
create table if not exists public.hang_hoa (
  loai_hang  text primary key,
  ti_trong   numeric,                            -- để trống nếu chưa xác định
  ghi_chu    text,
  updated_at timestamptz not null default now()
);

-- 3. Phân quyền: ai có vai trò đều được đọc, chỉ quản trị được ghi
alter table public.model_specs enable row level security;
alter table public.hang_hoa    enable row level security;

drop policy if exists ms_doc on public.model_specs;
drop policy if exists ms_ghi on public.model_specs;
drop policy if exists hh_doc on public.hang_hoa;
drop policy if exists hh_ghi on public.hang_hoa;
create policy ms_doc on public.model_specs for select using (public.co_vai_tro(array['xem','nhap','quan_tri']));
create policy ms_ghi on public.model_specs for all using (public.co_vai_tro(array['quan_tri'])) with check (public.co_vai_tro(array['quan_tri']));
create policy hh_doc on public.hang_hoa for select using (public.co_vai_tro(array['xem','nhap','quan_tri']));
create policy hh_ghi on public.hang_hoa for all using (public.co_vai_tro(array['quan_tri'])) with check (public.co_vai_tro(array['quan_tri']));

-- =====================================================================
-- C. Kế hoạch dài hạn / ngắn hạn, phân công xe, nhập file nhu cầu
-- =====================================================================

-- ---------- A. XE NÂNG THEO TẢI TRỌNG ----------
alter table public.vehicles add column if not exists tai_trong text;
alter table public.vehicles drop constraint if exists vehicles_tai_trong_chk;
alter table public.vehicles add constraint vehicles_tai_trong_chk
  check (tai_trong is null or tai_trong in ('3T','5T','10T','15T','28T'));
-- Chỉ xe nâng mới có tải trọng
alter table public.vehicles drop constraint if exists vehicles_tai_trong_doi_chk;
alter table public.vehicles add constraint vehicles_tai_trong_doi_chk
  check (tai_trong is null or doi = 'Xe nâng');

-- ---------- B. KẾ HOẠCH DÀI HẠN ----------
-- Tham số (id 'dai_han': thời gian, đội xe, hệ số, bảng năng suất; id 'ngan_han': cửa sổ giờ làm)
create table if not exists public.plan_params (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

-- Công việc dài hạn: tàu (loai = 'tau') và việc bãi (loai = 'bai')
create table if not exists public.plan_jobs (
  id          bigint generated always as identity primary key,
  loai        text not null check (loai in ('tau','bai')),
  ten         text not null,
  hang        text,
  vi_tri      text,                 -- bến (tàu) hoặc bến/bãi (việc bãi)
  bat_dau     timestamptz,          -- tàu: giờ bắt đầu làm hàng
  khoi_luong  numeric,              -- tàu: tổng khối lượng (tấn)
  con_lai     numeric,              -- tàu: khối lượng còn lại tại mốc cập nhật
  nang_suat   numeric,              -- tàu: năng suất làm hàng (tấn/giờ)
  gio_dung    numeric not null default 0,
  so_xe_tay   int,                  -- tàu: số xe nhập tay (trống = lấy gợi ý)
  tu_ngay     date,                 -- việc bãi
  den_ngay    date,                 -- việc bãi
  xe_ngay     int not null default 0,  -- việc bãi: số xe CA 1 (ngày)
  xe_dem      int not null default 0,  -- việc bãi: số xe CA 2 (đêm)
  ghi_chu     text,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- C. KẾ HOẠCH NGẮN HẠN ----------
create table if not exists public.demand_batches (
  id          bigint generated always as identity primary key,
  file_name   text,
  so_dong     int,
  is_current  boolean not null default true,
  imported_by uuid default auth.uid(),
  imported_at timestamptz not null default now()
);

create table if not exists public.demands (
  id           bigint generated always as identity primary key,
  batch_id     bigint not null references public.demand_batches(id) on delete cascade,
  ma_nhu_cau   text not null,
  stt          text,
  hinh_thuc    text,
  hang_muc     text,
  loai_pt      text,
  bp_yeu_cau   text,
  loai_hang    text,
  noi_dung     text,
  khoi_luong   numeric,
  dvt          text,
  tg_bat_dau   timestamptz not null,
  tg_ket_thuc  timestamptz not null,
  ca_kip       text,
  vi_tri_bd    text,
  vi_tri_kt    text,
  muc_do       text,
  so_pt        int not null default 1,
  so_chuyen    text,
  dau_moi      text,
  sdt_dau_moi  text,
  thu_cong     boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists demands_batch_idx on public.demands (batch_id);
create index if not exists demands_ma_idx on public.demands (ma_nhu_cau);

-- Phân công xe: giờ lưu dạng số phút lệch so với đầu ca để ca qua ngày không lỗi
create table if not exists public.assignments (
  id            bigint generated always as identity primary key,
  ma_nhu_cau    text not null,
  ca_bat_dau    timestamptz not null,
  ma_xe         text not null references public.vehicles(ma) on update cascade,
  bat_dau_phut  int not null,
  ket_thuc_phut int not null,
  ghi_chu       text,
  created_by    uuid default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists assignments_ma_idx on public.assignments (ma_nhu_cau);
create index if not exists assignments_ca_idx on public.assignments (ca_bat_dau);

drop trigger if exists plan_jobs_updated on public.plan_jobs;
create trigger plan_jobs_updated before update on public.plan_jobs for each row execute function public.set_updated_at();
drop trigger if exists assignments_updated on public.assignments;
create trigger assignments_updated before update on public.assignments for each row execute function public.set_updated_at();

-- ---------- PHÂN QUYỀN ----------
alter table public.plan_params    enable row level security;
alter table public.plan_jobs      enable row level security;
alter table public.demand_batches enable row level security;
alter table public.demands        enable row level security;
alter table public.assignments    enable row level security;

drop policy if exists pp_doc on public.plan_params;
drop policy if exists pp_ghi on public.plan_params;
create policy pp_doc on public.plan_params for select using (public.co_vai_tro(array['xem','nhap','quan_tri']));
create policy pp_ghi on public.plan_params for all using (public.co_vai_tro(array['quan_tri'])) with check (public.co_vai_tro(array['quan_tri']));

drop policy if exists pj_doc on public.plan_jobs;
drop policy if exists pj_them on public.plan_jobs;
drop policy if exists pj_sua on public.plan_jobs;
drop policy if exists pj_xoa on public.plan_jobs;
create policy pj_doc  on public.plan_jobs for select using (public.co_vai_tro(array['xem','nhap','quan_tri']));
create policy pj_them on public.plan_jobs for insert with check (public.co_vai_tro(array['nhap','quan_tri']));
create policy pj_sua  on public.plan_jobs for update using (public.co_vai_tro(array['nhap','quan_tri'])) with check (public.co_vai_tro(array['nhap','quan_tri']));
create policy pj_xoa  on public.plan_jobs for delete using (public.co_vai_tro(array['quan_tri']));

drop policy if exists db_doc on public.demand_batches;
drop policy if exists db_ghi on public.demand_batches;
create policy db_doc on public.demand_batches for select using (public.co_vai_tro(array['xem','nhap','quan_tri']));
create policy db_ghi on public.demand_batches for all using (public.co_vai_tro(array['nhap','quan_tri'])) with check (public.co_vai_tro(array['nhap','quan_tri']));

drop policy if exists dm2_doc on public.demands;
drop policy if exists dm2_ghi on public.demands;
create policy dm2_doc on public.demands for select using (public.co_vai_tro(array['xem','nhap','quan_tri']));
create policy dm2_ghi on public.demands for all using (public.co_vai_tro(array['nhap','quan_tri'])) with check (public.co_vai_tro(array['nhap','quan_tri']));

drop policy if exists as_doc on public.assignments;
drop policy if exists as_ghi on public.assignments;
create policy as_doc on public.assignments for select using (public.co_vai_tro(array['xem','nhap','quan_tri']));
create policy as_ghi on public.assignments for all using (public.co_vai_tro(array['nhap','quan_tri'])) with check (public.co_vai_tro(array['nhap','quan_tri']));

-- ---------- NHẬP FILE NHU CẦU (một giao dịch) ----------
-- p_rows: mảng JSON các nhu cầu đã chuẩn hóa ở trang web.
-- Lô mới thành "hiện hành"; phân công của nhu cầu còn trong file mới được giữ (theo ma_nhu_cau),
-- phân công từ thời điểm bắt đầu của file mới trở đi mà nhu cầu không còn thì bị bỏ.
-- Phân công trước thời điểm đó giữ lại làm lịch sử.
create or replace function public.import_demands(p_file text, p_rows jsonb, p_win_a int default 30, p_win_b int default 30)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare v_batch bigint; v_min timestamptz; v_dropped int; v_moved int; v_kept int;
begin
  if not public.co_vai_tro(array['nhap','quan_tri']) then
    raise exception 'Tài khoản không có quyền nhập nhu cầu';
  end if;
  update demand_batches set is_current = false where is_current;
  insert into demand_batches (file_name, so_dong) values (p_file, jsonb_array_length(p_rows)) returning id into v_batch;

  insert into demands (batch_id, ma_nhu_cau, stt, hinh_thuc, hang_muc, loai_pt, bp_yeu_cau, loai_hang, noi_dung,
                       khoi_luong, dvt, tg_bat_dau, tg_ket_thuc, ca_kip, vi_tri_bd, vi_tri_kt, muc_do, so_pt,
                       so_chuyen, dau_moi, sdt_dau_moi)
  select v_batch, r->>'ma_nhu_cau', r->>'stt', r->>'hinh_thuc', r->>'hang_muc', r->>'loai_pt', r->>'bp_yeu_cau',
         r->>'loai_hang', r->>'noi_dung', nullif(r->>'khoi_luong','')::numeric, r->>'dvt',
         (r->>'tg_bat_dau')::timestamptz, (r->>'tg_ket_thuc')::timestamptz, r->>'ca_kip', r->>'vi_tri_bd',
         r->>'vi_tri_kt', r->>'muc_do', coalesce(nullif(r->>'so_pt','')::int, 1), r->>'so_chuyen', r->>'dau_moi', r->>'sdt_dau_moi'
  from jsonb_array_elements(p_rows) r;

  select min(tg_bat_dau) into v_min from demands where batch_id = v_batch;

  delete from assignments a
  where a.ca_bat_dau >= v_min
    and not exists (select 1 from demands d where d.batch_id = v_batch and d.ma_nhu_cau = a.ma_nhu_cau);
  get diagnostics v_dropped = row_count;

  -- Nhu cầu đổi ca: chuyển phân công sang ca mới, đặt lại giờ bằng cả cửa sổ làm việc của ca
  update assignments a
  set ca_bat_dau = d.tg_bat_dau,
      bat_dau_phut = p_win_a,
      ket_thuc_phut = (extract(epoch from (d.tg_ket_thuc - d.tg_bat_dau)) / 60)::int - p_win_b
  from demands d
  where d.batch_id = v_batch and d.ma_nhu_cau = a.ma_nhu_cau and a.ca_bat_dau >= v_min
    and a.ca_bat_dau <> d.tg_bat_dau;
  get diagnostics v_moved = row_count;

  select count(*) into v_kept from assignments a
  where exists (select 1 from demands d where d.batch_id = v_batch and d.ma_nhu_cau = a.ma_nhu_cau);

  return jsonb_build_object('batch_id', v_batch, 'kept', v_kept, 'dropped', v_dropped, 'moved', v_moved);
end $$;
grant execute on function public.import_demands(text, jsonb, int, int) to authenticated;

-- ---------- THAM SỐ MẶC ĐỊNH (chỉ thêm nếu chưa có) ----------
insert into public.plan_params (id, data) values
('dai_han', '{
  "p": {"bd": "2026-10-12T00:00", "gioN": 8, "caLen": 12, "capCang": 32, "capBai": 9, "ramp1": 0.6, "ramp2": 0.85, "ramp3": 0.6,
        "flag": 1, "moc": "2026-10-12T08:00", "nShifts": 60, "daoTao": 1},
  "prod": [
    {"hang": "quặng", "ns": 200, "min": 3, "max": 11, "pt": "gầu"},
    {"hang": "than",  "ns": 100, "min": 3, "max": 11, "pt": "gầu"},
    {"hang": "đá",    "ns": 250, "min": 3, "max": 7,  "pt": "gầu"},
    {"hang": "phế",   "ns": 30,  "min": 2, "max": 6,  "pt": "nhóp"},
    {"hang": "cuộn",  "ns": 100, "min": 1, "max": 4,  "pt": "mooc"}
  ]}'::jsonb),
('ngan_han', '{"winA": 30, "winB": 30}'::jsonb)
on conflict (id) do nothing;

-- =====================================================================
-- D. Cấu hình danh mục chung của Thiết bị cơ giới (đội xe, ca, kíp, thiết bị gắn, ánh xạ phương tiện, nhà thầu) và thông số model
-- =====================================================================

insert into public.danh_muc (id, data) values
('meta', '{"doi":["Xúc đào","Xúc lật"],"to":["Tổ MCT GPMB","Tổ MCT HRC1","Tổ MCT HRC2","Tổ MCT Tuyển xỉ","Tổ PVC","Tổ PVDA","Tổ Trước gang"],"tienTo":{"XĐ":"Xúc đào","XL":"Xúc lật"},"loai":["Hỏng","BD định kỳ","BD chiến lược"],"loaiDung":["Hỏng","BD chiến lược"],"nhom":{"Hỏng":["Động cơ","Truyền động / hộp số","Hệ thống thủy lực","Điện - điều khiển","Gầm / lốp / xích","Phanh","Va chạm / tai nạn","Khác"],"BD định kỳ":["BD 250 giờ","BD 500 giờ","BD 1000 giờ","BD theo lịch tháng"],"BD chiến lược":["Đại tu động cơ","Đại tu thủy lực","Thay cụm lớn","Nâng cấp / cải tạo"]},"pt":["Đủ phụ tùng","Chờ phụ tùng","Không cần"],"pic":["Tổ Cơ khí","Tổ Điện","Tổ Thủy lực","Thầu ngoài"],"ca":["Ca 1 (20h–08h)","Ca 2 (08h–20h)","Ca 3 HC (08h–17h)"],"caDef":[{"ten":"Ca 1 (20h–08h)","gio":20,"ketThuc":8,"hc":false},{"ten":"Ca 2 (08h–20h)","gio":8,"ketThuc":20,"hc":false},{"ten":"Ca 3 HC (08h–17h)","gio":8,"ketThuc":17,"hc":true,"boNgay":[0]}],"kip":["A","B","C","HC"],"cheDo":["Đi ca","HC"],"dinhBien":{"Đi ca":3,"HC":1}}'::jsonb),
('nguong', '{"ss":0.85,"red":0.7,"qh":3,"lau":7,"cm":0.9,"tl":3,"luu_thang":3}'::jsonb)
on conflict (id) do update set data = excluded.data, updated_at = now();
update public.danh_muc
set data = data || '{"doi":["Xúc đào","Xúc lật","Xe nâng","Xe đầu kéo","Xe ben","Xe bồn","Xe cẩu thùng","Xe gang lỏng","PT chuyên dụng khác"],"to":["Tổ MCT GPMB","Tổ MCT HRC1","Tổ MCT HRC2","Tổ MCT Tuyển xỉ","Tổ PVC","Tổ PVDA","Tổ Trước gang","Tổ Phục vụ CTH","Tổ Phục vụ DA","Tổ vận hành đầu kéo","Tổ Vận hành nâng hạ lắp đặt, dự án Ca","Tổ Vận hành nâng hạ lắp đặt, dự án HC","Tổ vận hành xe ben","Tổ vận hành xe bồn","Tổ vận hành xe nâng 28T","Tổ VH xe nâng DA","Tổ VH xe nâng Hành chính","Tổ VH xe nâng sản xuất","Tổ VH xe nâng thành phẩm"],"tienTo":{"XĐ":"Xúc đào","XL":"Xúc lật","XN":"Xe nâng","ĐK":"Xe đầu kéo","XT":"Xe ben","XB":"Xe bồn","XBN":"Xe bồn","XC":"Xe cẩu thùng","XGL":"Xe gang lỏng","XNN":"PT chuyên dụng khác","XR":"PT chuyên dụng khác","XU":"PT chuyên dụng khác","XLU":"PT chuyên dụng khác"},"tai_trong_xe_nang":["3T","5T","10T","15T","28T"],"ca":["CA 1 (08h–20h)","CA 2 (20h–08h)","CA HC (07h30–17h)"],"caDef":[{"ten":"CA 1 (08h–20h)","so":1,"gio":8,"ketThuc":20,"hc":false},{"ten":"CA 2 (20h–08h)","so":2,"gio":20,"ketThuc":8,"hc":false},{"ten":"CA HC (07h30–17h)","so":"HC","gio":7.5,"ketThuc":17,"hc":true,"boNgay":[0]}],"kipLich":{"goc":"2022-07-07","ca1":["B","A","C"],"ca2":{"B":"C","C":"A","A":"B"}},"gioLam":{"Đi ca":11,"HC":8},"kip":["A","B","C","HC"],"dinhBien":{"Đi ca":3,"HC":1},"thietBiGan":["Búa","Mâm từ","Nhóp","Gầu","Xới"]}'::jsonb, updated_at = now()
where id = 'meta';

-- 2. Ánh xạ "Loại Phương Tiện" của file nhu cầu sang đội xe (quản trị sửa được trên web)
insert into public.danh_muc (id, data) values ('map_pt', '{"rules":[{"tu_khoa":"xúc lật","doi":"Xúc lật"},{"tu_khoa":"nâng người","doi":"PT chuyên dụng khác","model":"nâng người"},{"tu_khoa":"nâng","doi":"Xe nâng","tai_trong":"tu_dong"},{"tu_khoa":"đầu kéo","doi":"Xe đầu kéo"},{"tu_khoa":"đào","doi":"Xúc đào"},{"tu_khoa":"đục","doi":"Xúc đào"},{"tu_khoa":"ben","doi":"Xe ben"},{"tu_khoa":"hooklift","doi":"PT chuyên dụng khác","model":"rác"},{"tu_khoa":"rác","doi":"PT chuyên dụng khác","model":"rác"},{"tu_khoa":"cẩu","doi":"Xe cẩu thùng"},{"tu_khoa":"bồn","doi":"Xe bồn"},{"tu_khoa":"gang lỏng","doi":"Xe gang lỏng"},{"tu_khoa":"ủi","doi":"PT chuyên dụng khác","model":"ủi"},{"tu_khoa":"xe lu","doi":"PT chuyên dụng khác","model":"lu"},{"tu_khoa":"xúc","doi":"Xúc đào"}]}'::jsonb)
on conflict (id) do nothing;
insert into public.model_specs (model,ma_model,loai_xe,trong_luong_kg,the_tich_gau_m3,tai_trong_nang_kg,kich_thuoc,chieu_sau_dao_mm,chieu_cao_do_hang_mm,ban_kinh_quay_mm,toc_do_quay_vph,dung_tich_nhien_lieu,ghi_chu) values
('Xe đào bánh lốp Doosan DX190W','DX190W','Xúc đào',18500,0.8,null,'8700 x 2500 x 3100',5580,6420,2500,10.9,310,null),
('Xe xúc đào bánh xích CAT 323GX','323GX','Xúc đào',22100,1.2,null,'9520 x 2980 x 3450',6710,6500,2830,11,390,null),
('Xe xúc đào bánh xích Doosan DX340LCA','DX340LCA','Xúc đào',34000,1.4,null,'11000 x 3000 x 3000',7000,7000,3600,9.5,500,null),
('Xe đào mini Cat 301.5','301.5','Xúc đào',1800,0.25,null,'3680 x 990 x 2310',2340,2450,1400,9.7,22,null),
('Xe xúc đào bánh xích Komatsu PC300-8MO','PC300-8MO','Xúc đào',32000,1.4,null,'10500 x 3190 x 3285',7280,7050,3450,9.5,605,null),
('Xe xúc đào bánh xích Komatsu PC350-8MO','PC350-8MO','Xúc đào',32960,1.4,null,'11140 x 3190 x 3285',7280,7050,3450,9.5,605,null),
('Xe xúc đào bánh xích Komatsu PC450-8MO','PC450-8MO','Xúc đào',45000,1.6,null,'11800 x 3350 x 3450',7800,7050,3700,9,650,null),
('Xe xúc đào bánh xích Komatsu PC220-8MO','PC220-8MO','Xúc đào',22600,1.2,null,'9885 x 2980 x 3055',6620,6715,2750,11,400,null),
('Xe xúc đào bánh xích DX360LCA-K, Doosan','DX360LCA-K','Xúc đào',36200,1.4,null,'11315 x 3103 x 2890',7500,7000,3600,9.5,500,null),
('Xe xúc đào mini Komatsu PC55','PC55','Xúc đào',5260,0.3,null,'5550 x 1960 x 2590',3770,4500,1590,9,65,null),
('Xe xúc đào mini Develon DX60D','DX60D','Xúc đào',5950,0.3,null,'5900 x 2000 x 2700',3812,4046,2415,11,130,null),
('Xe xúc lật LiuGong ZL50CN','ZL50CN','Xúc lật',16700,3,5000,'8025 x 3016 x 3380',null,2970,6200,null,270,null),
('Xe xúc lật SEM655D','SEM655D','Xúc lật',17100,4.5,5000,'8357 x 2750 x 3460',null,3300,6400,null,300,null),
('Xe xúc lật LeMan 936LC','936LC','Xúc lật',10000,1.2,3000,'7100 x 2400 x 3100',null,3000,5500,null,140,null),
('Xe xúc lật Doosan SD300','SD300','Xúc lật',16500,3,5000,'8085 x 3016 x 3380',null,2970,6200,null,270,null),
('Xe xúc lật LeMan 915LC','915LC','Xúc lật',10000,1.2,3000,'7100 x 2400 x 3100',null,3000,5500,null,140,null),
('Xe xúc lật laigong WL906','WL906','Xúc lật',2600,0.6,1500,'4700 x 1600 x 2600',null,2500,4200,null,40,null),
('Xe xúc lật SEM656D','SEM656D','Xúc lật',17100,4.5,5000,'8357 x 2750 x 3460',null,3300,6400,null,300,null),
('Xe xúc lật SANY SW956E','SW956E','Xúc lật',20000,3.2,5800,'8540 x 2996 x 3588',null,3250,7265,null,350,null)
on conflict (model) do update set
  ma_model = excluded.ma_model,
  loai_xe = excluded.loai_xe,
  trong_luong_kg = excluded.trong_luong_kg,
  the_tich_gau_m3 = excluded.the_tich_gau_m3,
  tai_trong_nang_kg = excluded.tai_trong_nang_kg,
  kich_thuoc = excluded.kich_thuoc,
  chieu_sau_dao_mm = excluded.chieu_sau_dao_mm,
  chieu_cao_do_hang_mm = excluded.chieu_cao_do_hang_mm,
  ban_kinh_quay_mm = excluded.ban_kinh_quay_mm,
  toc_do_quay_vph = excluded.toc_do_quay_vph,
  dung_tich_nhien_lieu = excluded.dung_tich_nhien_lieu,
  ghi_chu = excluded.ghi_chu;

-- =====================================================================
-- E. Nhà thầu, kế hoạch nhiều đội, thiết bị gắn xúc đào, gán xe cố định, khối lượng từng xe
-- =====================================================================

-- ---------- A. XE NHÀ THẦU ----------
-- Dòng phân công xe nhà thầu không có mã xe, chỉ có đơn vị thực hiện và số xe
alter table public.assignments alter column ma_xe drop not null;
alter table public.assignments add column if not exists nha_thau text;
alter table public.assignments add column if not exists so_luong int not null default 1;
alter table public.assignments drop constraint if exists assignments_pt_chk;
alter table public.assignments add constraint assignments_pt_chk check (ma_xe is not null or nha_thau is not null);
alter table public.assignments drop constraint if exists assignments_so_luong_chk;
alter table public.assignments add constraint assignments_so_luong_chk check (so_luong >= 1);

-- ---------- B. KẾ HOẠCH DÀI HẠN NHIỀU ĐỘI ----------
alter table public.plan_jobs add column if not exists doi text;        -- việc bãi: đội xe (trống = Xúc đào)
alter table public.plan_jobs add column if not exists so_xe_doi jsonb; -- tàu: số xe nhập tay cho đội khác Xúc đào, VD {"Xe ben": 4}
alter table public.plan_jobs add column if not exists thu_tu int;      -- thứ tự dòng do người dùng kéo thả

-- ---------- C. DANH MỤC NHÀ THẦU ----------
insert into public.danh_muc (id, data) values ('nha_thau', '{"list": [
  {"ten": "NT Bảo Hưng",  "lien_he": "", "ghi_chu": "", "dang_dung": true},
  {"ten": "NT An Khang",  "lien_he": "", "ghi_chu": "", "dang_dung": true},
  {"ten": "NT Bình Sơn",  "lien_he": "", "ghi_chu": "", "dang_dung": true},
  {"ten": "NT Cường Sơn", "lien_he": "", "ghi_chu": "", "dang_dung": true}
]}'::jsonb)
on conflict (id) do nothing;

-- ---------- D. HỆ SỐ CA CUỐI ----------
update public.plan_params
set data = jsonb_set(data, '{p,ramp3}', '0.6'::jsonb), updated_at = now()
where id = 'dai_han' and not (data -> 'p' ? 'ramp3');
alter table public.vehicles add column if not exists thiet_bi_gan text;

-- Chỉ xe xúc đào mới có thiết bị gắn
alter table public.vehicles drop constraint if exists vehicles_thiet_bi_gan_doi_chk;
alter table public.vehicles add constraint vehicles_thiet_bi_gan_doi_chk
  check (thiet_bi_gan is null or doi = 'Xúc đào');

-- Danh mục thiết bị gắn (giữ nguyên các khóa khác của meta)
update public.danh_muc
set data = data || '{"thietBiGan": ["Búa", "Mâm từ", "Nhóp", "Gầu", "Xới"]}'::jsonb, updated_at = now()
where id = 'meta';
create table if not exists public.gan_co_dinh (
  id          bigint generated always as identity primary key,
  khoa        text not null,          -- khóa nhu cầu đã chuẩn hóa: bộ phận | loại PT | nội dung | điểm đi | điểm đến
  ca_so       int  not null default 0, -- 0 = áp cho mọi ca (để dành nếu sau này cần mẫu riêng CA 1 / CA 2)
  mo_ta       jsonb,                  -- thông tin nhu cầu để hiển thị (bộ phận, nội dung, vị trí…)
  xe          jsonb not null,         -- [{ma_xe, nha_thau, so_luong, bat_dau_phut, ket_thuc_phut, ghi_chu}], giờ tính từ đầu nhu cầu
  created_by  uuid default auth.uid(),
  updated_at  timestamptz not null default now(),
  unique (khoa, ca_so)
);

alter table public.gan_co_dinh enable row level security;
drop policy if exists gcd_doc on public.gan_co_dinh;
drop policy if exists gcd_ghi on public.gan_co_dinh;
create policy gcd_doc on public.gan_co_dinh for select using (public.co_vai_tro(array['xem','nhap','quan_tri']));
create policy gcd_ghi on public.gan_co_dinh for all using (public.co_vai_tro(array['nhap','quan_tri'])) with check (public.co_vai_tro(array['nhap','quan_tri']));
alter table public.assignments add column if not exists khoi_luong numeric;

-- =====================================================================
-- F. Phân hệ Khai thác Cảng: phân quyền theo phân hệ, cầu bến, tàu, chuyến, khoảng dừng, nhật ký
-- =====================================================================

-- ---------- A. Phân quyền theo phân hệ ----------
create table if not exists public.user_module_roles (
  user_id    uuid not null references auth.users(id) on delete cascade,
  phan_he    text not null check (phan_he in ('thiet_bi','cang','kho')),
  vai_tro    text not null check (vai_tro in ('xem','nhap','quan_ly','quan_tri')),
  updated_at timestamptz not null default now(),
  primary key (user_id, phan_he)
);

create or replace function public.co_quyen(p_phan_he text, cac text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and vai_tro = 'quan_tri')
      or exists (select 1 from public.user_module_roles where user_id = auth.uid() and phan_he = p_phan_he and vai_tro = any(cac))
      or ('xem' = any(cac)
          and not exists (select 1 from public.user_module_roles where user_id = auth.uid() and phan_he = p_phan_he)
          and exists (select 1 from public.user_roles where user_id = auth.uid()));
$$;

-- Vai trò của người đang đăng nhập ở một phân hệ (web dùng để ẩn / hiện chức năng)
create or replace function public.vai_tro_phan_he(p_phan_he text) returns text
language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from public.user_roles where user_id = auth.uid() and vai_tro = 'quan_tri') then 'quan_tri'
    else coalesce(
      (select vai_tro from public.user_module_roles where user_id = auth.uid() and phan_he = p_phan_he),
      (select 'xem' from public.user_roles where user_id = auth.uid()))
  end;
$$;

-- Danh sách tài khoản cho màn hình Phân quyền (chỉ quản trị gọi được)
create or replace function public.ds_nguoi_dung()
returns table (user_id uuid, email text, ho_ten text, vai_tro_cu text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.co_vai_tro(array['quan_tri']) then raise exception 'Chỉ quản trị xem được danh sách tài khoản'; end if;
  return query select u.id, u.email::text, r.ho_ten, r.vai_tro from auth.users u left join public.user_roles r on r.user_id = u.id order by u.email;
end $$;

alter table public.user_module_roles enable row level security;
drop policy if exists umr_doc on public.user_module_roles;
drop policy if exists umr_ghi on public.user_module_roles;
create policy umr_doc on public.user_module_roles for select using (user_id = auth.uid() or public.co_vai_tro(array['quan_tri']));
create policy umr_ghi on public.user_module_roles for all using (public.co_vai_tro(array['quan_tri'])) with check (public.co_vai_tro(array['quan_tri']));

-- ---------- B. Danh mục dùng chung ----------
create table if not exists public.berths (
  ma         text primary key,              -- 1A, 1 … 11, HH2, HH3, 6CTH, 7CTH
  ten_khac   text[] not null default '{}',  -- tên gọi khác: TL, BTL, B01…
  dwt_max    numeric,                       -- trọng tải tối đa (DWT)
  mon_max    numeric,                       -- mớn nước tối đa (m)
  mon_cung   boolean not null default false,-- true: giới hạn ghi "≤" trong file, là giới hạn CỨNG
  loa_max    numeric,                       -- chiều dài tàu tối đa (m)
  loai_hang  text,                          -- hàng chính, cách nhau dấu phẩy
  thu_tu     int,
  ghi_chu    text,
  updated_at timestamptz not null default now()
);

-- Cẩu / thiết bị làm hàng: là xe đội "Cẩu" trong bảng vehicles (theo dõi hỏng / bảo dưỡng như xe), thêm cột thông số
alter table public.vehicles add column if not exists ben_phuc_vu text[] not null default '{}'; -- các bến cẩu phục vụ
alter table public.vehicles add column if not exists tai_nang   text;  -- tải trọng nâng (tấn), cẩu xích ghi theo biểu đồ tải
alter table public.vehicles add column if not exists tam_voi    text;  -- tầm với (m)
alter table public.vehicles add column if not exists nang_suat  text;  -- năng suất (tấn/giờ)
alter table public.vehicles add column if not exists pham_vi    text;  -- phạm vi di chuyển (m - m)
alter table public.vehicles add column if not exists bang_tai   text;  -- đường băng tải làm hàng: #1, #2, #5…

-- Hàng hóa: dùng chung bảng hang_hoa (tỉ trọng) của web Thiết bị cơ giới, thêm nhóm hàng
alter table public.hang_hoa add column if not exists nhom text;

-- Kho bãi: mỗi dòng một bãi – một loại hàng (theo sheet "Danh mục kho bãi")
create table if not exists public.kho_bai (
  id         bigint generated by default as identity primary key,
  ten_bai    text not null,
  dien_tich  numeric,                       -- m2
  hang       text,                          -- tên hàng hóa chứa
  thiet_bi   text,                          -- thiết bị của bãi (cầu trục, cổng trục…)
  ghi_chu    text,
  updated_at timestamptz not null default now()
);

create table if not exists public.vessels (
  ten        text primary key,
  dwt        numeric, loa numeric, draft numeric,
  dai_ly     text,
  ghi_chu    text,
  updated_at timestamptz not null default now()
);
create table if not exists public.agents (
  ten text primary key, lien_he text, ghi_chu text, updated_at timestamptz not null default now()
);

-- ---------- C. Chuyến tàu ----------
create table if not exists public.voyages (
  id               bigint generated always as identity primary key,
  ma_chuyen        text not null unique,    -- TÊN TÀU / năm / 0001
  ten_tau          text not null,           -- TBA khi chưa biết tàu
  dai_ly           text,
  huong            text not null default 'nhap' check (huong in ('nhap','xuat')),
  loai_hang        text,
  ten_hang         text,
  khoi_luong       numeric,                 -- tấn
  da_lam           numeric,                 -- tấn đã làm (có thể vượt khối lượng)
  ben_ma           text references public.berths(ma) on update cascade on delete set null,
  draft            numeric, loa numeric, dwt numeric,
  cam_ket          numeric,                 -- CAM KẾT xếp dỡ (tấn/ngày)
  cam_ket_ghi_chu  text,                    -- ô chữ trong cột CAM KẾT (CQD…), chưa tính
  eta              timestamptz,             -- mốc 1: ETA báo về
  etb              timestamptz,             -- dự kiến cập
  etd              timestamptz,             -- dự kiến rời
  den_neo          timestamptz,             -- mốc 2
  nor              timestamptz,             -- mốc 3: nộp NOR
  cho_phep_cap     timestamptz,             -- mốc 4: được phép cập / hoa tiêu
  atb              timestamptz,             -- mốc 5: cập bến
  bd_lam_hang      timestamptz,             -- mốc 6
  kt_lam_hang      timestamptz,             -- mốc 7
  hoan_tat_tt      timestamptz,             -- mốc 8: hoàn tất thủ tục, giám định
  atd              timestamptz,             -- mốc 9: rời bến
  -- Thưởng phạt theo hợp đồng: kiểu tính laytime hoặc CQD (trống máng lâu là phạt)
  kieu_tp          text not null default 'laytime' check (kieu_tp in ('laytime','cqd')),
  -- Laytime bắt đầu: NOR + 12h | NOR + 24h | 8h ngày kế tiếp sau ngày trao NOR | ngay khi NOR | ATB | bắt đầu làm hàng | giờ nhập tay
  -- (làm hàng sớm hơn mốc NOR + … thì tính từ lúc bắt đầu làm hàng; Chủ nhật, lễ vẫn tính)
  moc_tinh_tp      text not null default 'nor_12h' check (moc_tinh_tp in ('nor_12h','nor_24h','nor_8h','nor','atb','bd_lam_hang','tay')),
  tg_tinh_tp       timestamptz,             -- giờ bắt đầu tính nhập tay (moc_tinh_tp = 'tay'), VD "TG tính thưởng phạt" trên phiếu tàu
  tru_hoa_tieu     boolean not null default true, -- tự trừ thời gian hoa tiêu lên tàu -> lai dắt -> cập bến khỏi laytime
  cqd_nguong_gio   numeric,                 -- CQD: số giờ trống máng cho phép, vượt thì phạt
  cau              text[] not null default '{}', -- cẩu / thiết bị làm hàng
  bai_hang         text,                    -- tàu nhập: bãi nhận; tàu xuất: bãi lấy hàng
  xe_van_chuyen    jsonb not null default '[]', -- xe vận chuyển mỗi ca: [{loai, so, don_vi: hoa_phat|nha_thau}]
  hot_vet          jsonb not null default '[]', -- thiết bị hót vét: [{loai, so, don_vi}]
  vun_hang         jsonb not null default '[]', -- tàu xuất: thiết bị lên hàng; tàu nhập: thiết bị vun hàng: [{loai, so, don_vi}]
  huy              boolean not null default false,
  ghi_chu          text,
  created_by       uuid default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
-- Bổ sung cột cho trường hợp đã chạy bản cũ của file này
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'voyages' and column_name = 'bai_nhan')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'voyages' and column_name = 'bai_hang') then
    alter table public.voyages rename column bai_nhan to bai_hang;
  end if;
end $$;
alter table public.voyages add column if not exists bai_hang text;
alter table public.voyages add column if not exists xe_van_chuyen jsonb not null default '[]';
alter table public.voyages add column if not exists hot_vet jsonb not null default '[]';
alter table public.voyages add column if not exists vun_hang jsonb not null default '[]';
alter table public.voyages add column if not exists kieu_tp text not null default 'laytime';
alter table public.voyages add column if not exists tru_hoa_tieu boolean not null default true;
alter table public.voyages add column if not exists cqd_nguong_gio numeric;
alter table public.voyages drop constraint if exists voyages_moc_tinh_tp_check;
alter table public.voyages alter column moc_tinh_tp set default 'nor_12h';
update public.voyages set moc_tinh_tp = 'nor_12h' where moc_tinh_tp in ('den_neo','cho_phep_cap');
alter table public.voyages add constraint voyages_moc_tinh_tp_check check (moc_tinh_tp in ('nor_12h','nor_24h','nor_8h','nor','atb','bd_lam_hang','tay'));
alter table public.voyages drop constraint if exists voyages_kieu_tp_check;
alter table public.voyages add constraint voyages_kieu_tp_check check (kieu_tp in ('laytime','cqd'));
create index if not exists voyages_eta_idx on public.voyages (eta);
create index if not exists voyages_etb_idx on public.voyages (etb);
create index if not exists voyages_atb_idx on public.voyages (atb);
create index if not exists voyages_atd_idx on public.voyages (atd);
create index if not exists voyages_ben_idx on public.voyages (ben_ma);

create table if not exists public.voyage_events (
  id         bigint generated always as identity primary key,
  voyage_id  bigint not null references public.voyages(id) on delete cascade,
  thoi_diem  timestamptz not null,
  noi_dung   text not null,
  kl_luy_ke  numeric,                       -- khối lượng lũy kế tại thời điểm này (nếu có)
  nguoi      uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists voyage_events_v_idx on public.voyage_events (voyage_id, thoi_diem);

create table if not exists public.voyage_stops (
  id         bigint generated always as identity primary key,
  voyage_id  bigint not null references public.voyages(id) on delete cascade,
  tu         timestamptz not null,
  den        timestamptz,                   -- trống = đang dừng
  ly_do      text not null,                 -- Mưa, Hỏng thiết bị, Chờ hàng, Chờ xe, Nghỉ ca, Khác
  tru_tp     boolean not null default true, -- thời gian đình trệ cho phép: trừ khỏi laytime (thời tiết xấu, hoa tiêu, lai dắt…)
  trong_mang boolean not null default false,-- CQD: tính là thời gian trống máng
  ghi_chu    text,
  created_at timestamptz not null default now()
);
create index if not exists voyage_stops_v_idx on public.voyage_stops (voyage_id);
alter table public.voyage_stops add column if not exists trong_mang boolean not null default false;

-- ---------- E. Nhật ký thay đổi ----------
create table if not exists public.audit_log (
  id        bigint generated always as identity primary key,
  bang      text not null,
  khoa      text,
  hanh_dong text not null,                  -- INSERT / UPDATE / DELETE
  cu        jsonb,
  moi       jsonb,
  user_id   uuid default auth.uid(),
  luc       timestamptz not null default now()
);
create index if not exists audit_log_khoa_idx on public.audit_log (bang, khoa, luc desc);

create or replace function public.ghi_audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare k text;
begin
  k := coalesce(to_jsonb(coalesce(new, old)) ->> 'voyage_id', to_jsonb(coalesce(new, old)) ->> 'id');
  insert into public.audit_log (bang, khoa, hanh_dong, cu, moi)
  values (tg_table_name, k, tg_op,
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

drop trigger if exists audit_voyages on public.voyages;
create trigger audit_voyages after insert or update or delete on public.voyages for each row execute function public.ghi_audit();
drop trigger if exists audit_voyage_stops on public.voyage_stops;
create trigger audit_voyage_stops after insert or update or delete on public.voyage_stops for each row execute function public.ghi_audit();

-- ---------- Phân quyền (RLS) ----------
alter table public.berths        enable row level security;
alter table public.vessels       enable row level security;
alter table public.agents        enable row level security;
alter table public.kho_bai       enable row level security;
alter table public.voyages       enable row level security;
alter table public.voyage_events enable row level security;
alter table public.voyage_stops  enable row level security;
alter table public.audit_log     enable row level security;

do $$
declare t text;
begin
  -- Đọc: mọi vai trò của phân hệ Cảng
  foreach t in array array['berths','vessels','agents','voyages','voyage_events','voyage_stops'] loop
    execute format('drop policy if exists %I on public.%I', t || '_doc', t);
    execute format('create policy %I on public.%I for select using (public.co_quyen(''cang'', array[''xem'',''nhap'',''quan_ly'',''quan_tri'']))', t || '_doc', t);
  end loop;
  -- Bến: chỉ quản trị sửa
  foreach t in array array['berths'] loop
    execute format('drop policy if exists %I on public.%I', t || '_ghi', t);
    execute format('create policy %I on public.%I for all using (public.co_quyen(''cang'', array[''quan_tri''])) with check (public.co_quyen(''cang'', array[''quan_tri'']))', t || '_ghi', t);
  end loop;
  -- Tàu, đại lý, chuyến, nhật ký, khoảng dừng: nhập liệu thêm / sửa; quản lý trở lên xóa
  foreach t in array array['vessels','agents','voyages','voyage_events','voyage_stops'] loop
    execute format('drop policy if exists %I on public.%I', t || '_them', t);
    execute format('drop policy if exists %I on public.%I', t || '_sua', t);
    execute format('drop policy if exists %I on public.%I', t || '_xoa', t);
    execute format('create policy %I on public.%I for insert with check (public.co_quyen(''cang'', array[''nhap'',''quan_ly'',''quan_tri'']))', t || '_them', t);
    execute format('create policy %I on public.%I for update using (public.co_quyen(''cang'', array[''nhap'',''quan_ly'',''quan_tri''])) with check (public.co_quyen(''cang'', array[''nhap'',''quan_ly'',''quan_tri'']))', t || '_sua', t);
    execute format('create policy %I on public.%I for delete using (public.co_quyen(''cang'', array[''quan_ly'',''quan_tri'']))', t || '_xoa', t);
  end loop;
end $$;

-- Người nhập liệu được xóa nhật ký / khoảng dừng do chính mình ghi nhầm
drop policy if exists voyage_events_xoa_minh on public.voyage_events;
create policy voyage_events_xoa_minh on public.voyage_events for delete using (nguoi = auth.uid() and public.co_quyen('cang', array['nhap']));

-- Kho bãi: mọi vai trò phân hệ kho đọc; quản trị sửa
drop policy if exists kho_bai_doc on public.kho_bai;
drop policy if exists kho_bai_ghi on public.kho_bai;
create policy kho_bai_doc on public.kho_bai for select using (public.co_quyen('kho', array['xem','nhap','quan_ly','quan_tri']) or public.co_quyen('cang', array['xem','nhap','quan_ly','quan_tri']));
create policy kho_bai_ghi on public.kho_bai for all using (public.co_quyen('kho', array['quan_tri'])) with check (public.co_quyen('kho', array['quan_tri']));

-- Nhật ký thay đổi: quản lý trở lên đọc; ghi qua trigger
drop policy if exists audit_log_doc on public.audit_log;
create policy audit_log_doc on public.audit_log for select using (public.co_quyen('cang', array['quan_ly','quan_tri']));

-- =====================================================================
-- G. Kho bãi: sức chứa, sổ nhập xuất, lô, tồn kho
-- =====================================================================

-- ---------- C. Kho bãi: thông số sức chứa ----------
alter table public.kho_bai add column if not exists chieu_cao numeric;     -- chiều cao chất đống tối đa (m)
alter table public.kho_bai add column if not exists suc_chua_tay numeric;  -- sức chứa nhập tay (tấn), ghi đè công thức
alter table public.kho_bai add column if not exists loai_kho text;         -- thanh_pham | nguyen_lieu; trống = tự theo nhóm hàng
alter table public.kho_bai add column if not exists tieu_thu_ngay numeric; -- nguyên liệu: tiêu thụ / ngày nhập tay; trống = bình quân 30 ngày
alter table public.kho_bai drop constraint if exists kho_bai_loai_kho_check;
alter table public.kho_bai add constraint kho_bai_loai_kho_check check (loai_kho is null or loai_kho in ('thanh_pham','nguyen_lieu'));

-- ---------- D. Sổ nhập – xuất kho, lô thành phẩm ----------
create table if not exists public.kho_giao_dich (
  id          bigint generated always as identity primary key,
  ngay        date not null default current_date,
  ca          text,                                  -- CA 1 / CA 2 / HC
  loai        text not null check (loai in ('dau_ky','nhap','xuat','dieu_chuyen','kiem_ke')),
  ten_bai     text not null,                         -- bãi (điều chuyển: bãi đi)
  den_bai     text,                                  -- điều chuyển: bãi đến
  hang        text not null,
  so_luong    numeric not null,                      -- tấn; kiểm kê: chênh lệch (đo − sổ), có thể âm
  so_lo       text,                                  -- lô thành phẩm
  nguon       text,                                  -- tau | san_xuat | don_hang | cap_sx | khac
  voyage_id   bigint references public.voyages(id) on delete set null,
  chung_tu    text,
  do_thuc_te  numeric,                               -- kiểm kê: số đo thực tế
  so_sach     numeric,                               -- kiểm kê: tồn theo sổ lúc kiểm
  ghi_chu     text,
  nguoi       uuid default auth.uid(),
  created_at  timestamptz not null default now()
);
create index if not exists kho_gd_ngay_idx on public.kho_giao_dich (ngay);
create index if not exists kho_gd_bai_idx on public.kho_giao_dich (ten_bai, hang);
create index if not exists kho_gd_lo_idx on public.kho_giao_dich (so_lo);
create index if not exists kho_gd_v_idx on public.kho_giao_dich (voyage_id);

create table if not exists public.kho_lo (
  so_lo       text primary key,
  hang        text,
  ngay_nhap   date,
  trang_thai  text not null default 'san_sang' check (trang_thai in ('san_sang','cho_kiem','giu_lai')),
  ghi_chu     text,
  updated_at  timestamptz not null default now()
);

alter table public.kho_giao_dich enable row level security;
alter table public.kho_lo enable row level security;
do $$
declare t text;
begin
  foreach t in array array['kho_giao_dich','kho_lo'] loop
    execute format('drop policy if exists %I on public.%I', t || '_doc', t);
    execute format('drop policy if exists %I on public.%I', t || '_them', t);
    execute format('drop policy if exists %I on public.%I', t || '_sua', t);
    execute format('drop policy if exists %I on public.%I', t || '_xoa', t);
    execute format('create policy %I on public.%I for select using (public.co_quyen(''kho'', array[''xem'',''nhap'',''quan_ly'',''quan_tri'']) or public.co_quyen(''cang'', array[''xem'',''nhap'',''quan_ly'',''quan_tri'']))', t || '_doc', t);
    execute format('create policy %I on public.%I for insert with check (public.co_quyen(''kho'', array[''nhap'',''quan_ly'',''quan_tri'']))', t || '_them', t);
    execute format('create policy %I on public.%I for update using (public.co_quyen(''kho'', array[''nhap'',''quan_ly'',''quan_tri''])) with check (public.co_quyen(''kho'', array[''nhap'',''quan_ly'',''quan_tri'']))', t || '_sua', t);
    execute format('create policy %I on public.%I for delete using (public.co_quyen(''kho'', array[''quan_ly'',''quan_tri'']))', t || '_xoa', t);
  end loop;
end $$;
drop trigger if exists audit_kho_giao_dich on public.kho_giao_dich;
create trigger audit_kho_giao_dich after insert or update or delete on public.kho_giao_dich for each row execute function public.ghi_audit();

-- ---------- E. Tồn hiện tại theo bãi – hàng – lô (tính từ sổ) ----------
create or replace view public.kho_ton with (security_invoker = true) as
with gd as (
  select ten_bai, hang, coalesce(so_lo, '') as so_lo, ngay,
         case when loai in ('xuat','dieu_chuyen') then -so_luong else so_luong end as sl
  from public.kho_giao_dich
  union all
  select den_bai, hang, coalesce(so_lo, ''), ngay, so_luong
  from public.kho_giao_dich where loai = 'dieu_chuyen' and den_bai is not null
)
select ten_bai, hang, so_lo, sum(sl) as ton, min(ngay) as ngay_dau, max(ngay) as ngay_cuoi
from gd group by ten_bai, hang, so_lo;
grant select on public.kho_ton to authenticated;
alter table public.kho_bai add column if not exists ten_khu text;   -- tên bãi nhỏ / khu; trống = tên hàng
alter table public.kho_bai add column if not exists kieu_bai text;  -- trống = cố định 1 hàng
alter table public.kho_bai add column if not exists nhom_bai text;  -- cố định nhóm: tên nhóm; trống = nhóm của hàng trên dòng
alter table public.kho_bai drop constraint if exists kho_bai_kieu_bai_check;
alter table public.kho_bai add constraint kho_bai_kieu_bai_check check (kieu_bai is null or kieu_bai in ('co_dinh_hang', 'co_dinh_nhom', 'tu_do'));

-- =====================================================================
-- H. Danh mục: cột tự thêm
-- =====================================================================

create table if not exists public.danh_muc_cot (
  bang text not null,        -- ben | cau | tbGan | hang | kho | nhaThau | tau | daiLy
  ma text not null,          -- mã cột tự sinh, giữ nguyên khi đổi tên cột
  ten text not null,
  loai text not null default 'text' check (loai in ('text', 'so', 'bool')),
  thu_tu int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (bang, ma)
);
alter table public.danh_muc_cot enable row level security;
drop policy if exists danh_muc_cot_doc on public.danh_muc_cot;
drop policy if exists danh_muc_cot_ghi on public.danh_muc_cot;
create policy danh_muc_cot_doc on public.danh_muc_cot for select using (auth.uid() is not null);
create policy danh_muc_cot_ghi on public.danh_muc_cot for all
  using (public.co_quyen('cang', array['quan_tri']) or public.co_quyen('kho', array['quan_tri']))
  with check (public.co_quyen('cang', array['quan_tri']) or public.co_quyen('kho', array['quan_tri']));

-- Giá trị cột phụ của từng dòng: { mã cột: giá trị }
-- (Nhà thầu, thiết bị gắn lưu trong bảng danh_muc nên không cần thêm cột)
alter table public.berths   add column if not exists them jsonb not null default '{}';
alter table public.vehicles add column if not exists them jsonb not null default '{}';
alter table public.hang_hoa add column if not exists them jsonb not null default '{}';
alter table public.kho_bai  add column if not exists them jsonb not null default '{}';
alter table public.vessels  add column if not exists them jsonb not null default '{}';
alter table public.agents   add column if not exists them jsonb not null default '{}';

-- =====================================================================
-- I. Chuyến tàu: nhiều loại hàng, số máng, cẩu tàu, thiết bị gắn của cẩu, bến phụ và vị trí, chuyển bến, trả hàng
-- =====================================================================

alter table public.voyages add column if not exists so_mang int;                          -- số máng (cầu bến)
alter table public.voyages add column if not exists uu_tien boolean not null default false; -- tàu ưu tiên vào sớm (cầu bến)
alter table public.voyages add column if not exists vet_ham boolean not null default false; -- vét hầm (tàu nhập hàng rời)
alter table public.voyages add column if not exists be_ham  boolean not null default false; -- be hầm (tàu xuất thành phẩm)
alter table public.voyages add column if not exists bai_kl  jsonb not null default '[]';    -- [{ bai, khu, khoi_luong }] bãi lớn, bãi nhỏ, khối lượng
alter table public.voyages add column if not exists hang_ds jsonb not null default '[]';    -- [{ ten_hang, loai_hang, khoi_luong }] các loại hàng của tàu
alter table public.voyages add column if not exists bang_tai text;                          -- tuyến băng tải làm hàng của chuyến: "#1, #2"
alter table public.berths add column if not exists bang_tai text;  -- VD "#1, #2, #5" (điền ở 03_bo_tri_ben.sql)
alter table public.voyages add column if not exists cau_tau jsonb;
alter table public.voyages add column if not exists cau_gan jsonb;
alter table public.voyage_stops add column if not exists loai text not null default 'dung';
alter table public.voyage_stops drop constraint if exists voyage_stops_loai_check;
alter table public.voyage_stops add constraint voyage_stops_loai_check check (loai in ('dung', 'shifting', 'ra_neo'));
alter table public.voyage_stops add column if not exists ben_cu text;            -- bến tàu rời (shifting / ra neo)
alter table public.voyage_stops add column if not exists ben_moi text;           -- bến tàu cập lại (trống = chưa biết; ra neo mà trống thì quay lại bến cũ)
alter table public.voyage_stops add column if not exists do_ai text;             -- cang | tau | khac: bên yêu cầu / gây ra
alter table public.voyage_stops add column if not exists chi_phi boolean not null default false;  -- có phát sinh chi phí
alter table public.voyage_stops add column if not exists chi_phi_ghi_chu text;

create table if not exists public.voyage_tra_hang (
  id         bigint generated always as identity primary key,
  voyage_id  bigint not null references public.voyages(id) on delete cascade,
  thoi_diem  timestamptz not null,
  kieu       text not null default 'tam' check (kieu in ('het', 'tam')),  -- het: trả luôn, không nhận vào bãi nữa; tam: trả (ra neo tạm) rồi tiếp tục nhận
  khoi_luong numeric not null check (khoi_luong >= 0),                    -- tấn trả lại
  ly_do      text,                                                         -- VD: chất lượng không đạt
  ghi_chu    text,
  nguoi      uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists voyage_tra_hang_v_idx on public.voyage_tra_hang (voyage_id);

alter table public.voyage_tra_hang enable row level security;
drop policy if exists voyage_tra_hang_doc on public.voyage_tra_hang;
drop policy if exists voyage_tra_hang_them on public.voyage_tra_hang;
drop policy if exists voyage_tra_hang_sua on public.voyage_tra_hang;
drop policy if exists voyage_tra_hang_xoa on public.voyage_tra_hang;
create policy voyage_tra_hang_doc  on public.voyage_tra_hang for select using (public.co_quyen('cang', array['xem','nhap','quan_ly','quan_tri']));
create policy voyage_tra_hang_them on public.voyage_tra_hang for insert with check (public.co_quyen('cang', array['nhap','quan_ly','quan_tri']));
create policy voyage_tra_hang_sua  on public.voyage_tra_hang for update using (public.co_quyen('cang', array['nhap','quan_ly','quan_tri'])) with check (public.co_quyen('cang', array['nhap','quan_ly','quan_tri']));
create policy voyage_tra_hang_xoa  on public.voyage_tra_hang for delete using (public.co_quyen('cang', array['quan_ly','quan_tri']));

drop trigger if exists audit_voyage_tra_hang on public.voyage_tra_hang;
create trigger audit_voyage_tra_hang after insert or update or delete on public.voyage_tra_hang for each row execute function public.ghi_audit();
alter table public.berths add column if not exists tuyen text;
alter table public.berths add column if not exists met_tu numeric;
alter table public.berths add column if not exists met_den numeric;
alter table public.berths add column if not exists goc_vuong text;
alter table public.voyages add column if not exists ben_phu text;
alter table public.voyages add column if not exists vi_tri numeric;
alter table public.voyage_stops add column if not exists ben_phu_cu text;
alter table public.voyage_stops add column if not exists ben_phu_moi text;
alter table public.voyage_stops add column if not exists vi_tri_cu numeric;
alter table public.voyage_stops add column if not exists vi_tri_moi numeric;

-- =====================================================================
-- J. Thiết bị gắn theo loại, mục tiêu sản lượng, kế hoạch xuất / nhập tồn kho, dấu vân tay dữ liệu
-- =====================================================================

create table if not exists public.thiet_bi_gan_sl (
  id         bigint generated by default as identity primary key,
  ten        text not null,                 -- loại thiết bị gắn
  dung_cho   text,                          -- Xúc đào / Cẩu cảng / Khác
  tong       int not null default 0 check (tong >= 0),
  hong       int not null default 0 check (hong >= 0),
  ghi_chu    text,
  thu_tu     int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.thiet_bi_gan_sl enable row level security;
drop policy if exists tbg_doc on public.thiet_bi_gan_sl;
drop policy if exists tbg_them on public.thiet_bi_gan_sl;
drop policy if exists tbg_sua on public.thiet_bi_gan_sl;
drop policy if exists tbg_xoa on public.thiet_bi_gan_sl;
create policy tbg_doc  on public.thiet_bi_gan_sl for select using (public.co_vai_tro(array['xem','nhap','quan_tri']));
create policy tbg_them on public.thiet_bi_gan_sl for insert with check (public.co_vai_tro(array['nhap','quan_tri']));
create policy tbg_sua  on public.thiet_bi_gan_sl for update using (public.co_vai_tro(array['nhap','quan_tri'])) with check (public.co_vai_tro(array['nhap','quan_tri']));
create policy tbg_xoa  on public.thiet_bi_gan_sl for delete using (public.co_vai_tro(array['quan_tri']));

-- Nạp sẵn các loại thiết bị gắn của xúc đào đang có trong danh mục (chỉ khi bảng còn trống);
-- tổng tạm = số xe xúc đào đang lắp loại đó, anh sửa lại theo thực tế
insert into public.thiet_bi_gan_sl (ten, dung_cho, tong, thu_tu)
select t.x, 'Xúc đào', (select count(*) from public.vehicles v where v.thiet_bi_gan = t.x), t.ord
  from public.danh_muc d, jsonb_array_elements_text(d.data -> 'thietBiGan') with ordinality t(x, ord)
 where d.id = 'meta' and not exists (select 1 from public.thiet_bi_gan_sl);
create table if not exists public.muc_tieu_san_luong (
  id         bigint generated by default as identity primary key,
  thang      text not null check (thang ~ '^\d{4}-(0[1-9]|1[0-2])$'),  -- 'YYYY-MM'
  huong      text not null check (huong in ('nhap', 'xuat')),
  loai_hang  text not null,                                         -- nhóm hàng: Quặng, Than, HRC…
  tan        numeric not null check (tan >= 0),
  ghi_chu    text,
  updated_at timestamptz not null default now(),
  unique (thang, huong, loai_hang)
);

alter table public.muc_tieu_san_luong enable row level security;
drop policy if exists mtsl_doc on public.muc_tieu_san_luong;
drop policy if exists mtsl_ghi on public.muc_tieu_san_luong;
create policy mtsl_doc on public.muc_tieu_san_luong for select
  using (public.co_quyen('cang', array['xem', 'nhap', 'quan_ly', 'quan_tri']));
create policy mtsl_ghi on public.muc_tieu_san_luong for all
  using (public.co_quyen('cang', array['quan_ly', 'quan_tri']))
  with check (public.co_quyen('cang', array['quan_ly', 'quan_tri']));

-- Ghi lịch sử sửa như các bảng Cảng khác
drop trigger if exists audit_muc_tieu_san_luong on public.muc_tieu_san_luong;
create trigger audit_muc_tieu_san_luong after insert or update or delete on public.muc_tieu_san_luong
  for each row execute function public.ghi_audit();
create table if not exists public.kho_ke_hoach (
  id          bigint generated always as identity primary key,
  thang       text not null check (thang ~ '^[0-9]{4}-[0-9]{2}$'),   -- yyyy-mm
  ten_bai     text not null,                                          -- bãi lớn
  khu_key     text,                                                   -- khóa bãi nhỏ (kho_bai.id)
  ten_khu     text,                                                   -- tên bãi nhỏ
  hang        text,                                                   -- hàng hóa (trống = hàng chứa trong bãi nhỏ)
  nhom        text,                                                   -- nhóm hàng (trống = theo danh mục hàng hóa)
  huong       text not null check (huong in ('nhap', 'xuat')),
  khoi_luong  numeric not null check (khoi_luong >= 0),               -- tấn
  ghi_chu     text,
  nguoi       uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists kho_ke_hoach_thang_idx on public.kho_ke_hoach (thang);

alter table public.kho_ke_hoach enable row level security;
drop policy if exists kho_ke_hoach_doc on public.kho_ke_hoach;
drop policy if exists kho_ke_hoach_them on public.kho_ke_hoach;
drop policy if exists kho_ke_hoach_sua on public.kho_ke_hoach;
drop policy if exists kho_ke_hoach_xoa on public.kho_ke_hoach;
create policy kho_ke_hoach_doc  on public.kho_ke_hoach for select using (public.co_quyen('kho', array['xem','nhap','quan_ly','quan_tri']) or public.co_quyen('cang', array['xem','nhap','quan_ly','quan_tri']));
create policy kho_ke_hoach_them on public.kho_ke_hoach for insert with check (public.co_quyen('kho', array['nhap','quan_ly','quan_tri']));
create policy kho_ke_hoach_sua  on public.kho_ke_hoach for update using (public.co_quyen('kho', array['nhap','quan_ly','quan_tri'])) with check (public.co_quyen('kho', array['nhap','quan_ly','quan_tri']));
create policy kho_ke_hoach_xoa  on public.kho_ke_hoach for delete using (public.co_quyen('kho', array['nhap','quan_ly','quan_tri']));

drop trigger if exists audit_kho_ke_hoach on public.kho_ke_hoach;
create trigger audit_kho_ke_hoach after insert or update or delete on public.kho_ke_hoach for each row execute function public.ghi_audit();
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
    ds := array['danh_muc', 'vehicles', 'staff', 'ca_kip', 'headcount', 'events', 'model_specs', 'hang_hoa', 'thiet_bi_gan_sl',
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

-- Chỉ người đã đăng nhập web gọi được
revoke all on function public.dau_van_tay_du_lieu(text) from public, anon;
grant execute on function public.dau_van_tay_du_lieu(text) to authenticated;

-- Kiểm tra: phải thấy các bảng bên dưới
select table_name from information_schema.tables where table_schema = 'public' order by table_name;

