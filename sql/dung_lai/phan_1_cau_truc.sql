-- ================================================================
-- DỰNG LẠI PROJECT SUPABASE MỚI — PHẦN 1/2 (chạy MỘT LẦN, project còn trống)
-- Gồm: 01 cấu trúc, 02 danh mục, 03 bố trí bến, 06 sản lượng thực tế, 07 phân loại tồn.
-- Dán toàn bộ vào Supabase > SQL Editor > New query > Run. Xong chạy tiếp PHẦN 2.
-- ================================================================


-- >>>>>>>>>> 01_cau_truc.sql <<<<<<<<<<
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



-- >>>>>>>>>> 02_nap_danh_muc.sql <<<<<<<<<<
-- =====================================================================
-- BƯỚC 2: NẠP DANH MỤC DÙNG CHUNG TỪ FILE "Danh mục.xlsx" (chạy SAU 01_cau_truc.sql)
-- File này do máy sinh ra (scripts/danh-muc.mjs, lệnh: npm run danh-muc). Không sửa tay.
-- Sinh lúc 18:51:38 2/11/2026 từ Danh mục.xlsx.
--   A. 16 cầu bến: thêm mới hoặc cập nhật trọng tải, mớn, chiều dài theo file (mớn ghi <= là giới hạn cứng).
--   B. 38 cẩu thành xe đội "Cẩu" trong danh mục thiết bị cơ giới (theo dõi hỏng / bảo dưỡng như xe).
--      Có rồi thì chỉ cập nhật loại, bến phục vụ và thông số kỹ thuật; không đổi tổ, chế độ, ghi chú đã sửa trên web.
--   C. Hàng hóa: XÓA danh sách cũ, thay bằng 133 loại trong file (đã thống nhất thay hẳn).
--   D. Kho bãi: nạp 41 dòng (bãi – loại hàng) CHỈ KHI bảng đang trống (không ghi đè dữ liệu đã nhập trên web).
-- Chạy lại: A, B cập nhật lại theo file; C thay lại toàn bộ hàng hóa theo file; D bỏ qua nếu đã có dữ liệu.
-- =====================================================================

-- A. Cầu bến
insert into public.berths (ma, ten_khac, dwt_max, mon_max, mon_cung, loa_max, loai_hang, thu_tu, ghi_chu) values
  ('1A', '{"TL","BTL","B1A","Tàu Lai","Bến 1A"}', 8000, 7.2, false, 140, 'Thép thành phẩm, HRC, phôi vuông', 1, null),
  ('1', '{"B01","B1","Bến 1"}', 8000, 7.2, false, 140, 'Thép thành phẩm, HRC, phôi vuông', 2, null),
  ('2', '{"B02","B2","Bến 2"}', 8000, 7.2, false, 140, 'Xỉ, thép thành phẩm, HRC', 3, null),
  ('3', '{"B03","B3","Bến 3"}', 40000, 12, false, 200, 'HRC, xỉ, quặng hồi, thạch cao', 4, null),
  ('5', '{"B05","B5","Bến 5"}', 150000, 14.7, false, 300, 'Than, quặng, HRC, thép cuộn', 5, null),
  ('10', '{"B10","Bến 10"}', 250000, 18.5, true, 410, 'Than, quặng, HRC xuất khẩu', 6, null),
  ('4', '{"B04","B4","Bến 4"}', 30000, 8.9, false, 200, 'Xỉ hạt, phế liệu nội địa', 7, null),
  ('6', '{"B06","B6","Bến 6"}', 110000, 14.9, false, 300, 'Than, quặng, HRC, thép cuộn', 8, null),
  ('11', '{"B11","Bến 11"}', 250000, 18.5, true, 410, 'Than, quặng, HRC xuất khẩu', 9, null),
  ('7', '{"B07","B7","Bến 7"}', 20000, 9, false, 180, 'Đá, xỉ, quặng hồi, HRC', 10, null),
  ('8', '{"B08","B8","Bến 8"}', 10000, 7.2, false, 126.5, 'Đá, xỉ, quặng hồi', 11, null),
  ('9', '{"B09","B9","Bến 9"}', 10000, 7.2, false, 126.5, 'Đá, xỉ, quặng hồi', 12, null),
  ('HH2', '{"BHH2","Bến 2-HH"}', 50000, 11.7, true, 242, 'HRC, phôi, đá, xỉ, thiết bị', 13, null),
  ('HH3', '{"BHH3","Bến 3-HH"}', 30000, 10.8, true, 190, 'HRC, phôi, đá, xỉ, thiết bị', 14, null),
  ('6CTH', '{"B6CTH","Bến 6-CTH"}', 70000, 12.2, false, 250, 'Phế, HRC, thép cuộn, phôi, slab, xỉ', 15, null),
  ('7CTH', '{"B7CTH","Bến 7-CTH"}', 70000, 12.2, false, 250, 'Phế, HRC, thép cuộn, phôi, slab, xỉ', 16, null)
on conflict (ma) do update set ten_khac = excluded.ten_khac, dwt_max = excluded.dwt_max, mon_max = excluded.mon_max,
  mon_cung = excluded.mon_cung, loa_max = excluded.loa_max, updated_at = now();

-- B. Cẩu -> đội "Cẩu" trong danh mục thiết bị cơ giới
update public.danh_muc set data = jsonb_set(data, '{doi}', (data->'doi') || '["Cẩu"]'::jsonb), updated_at = now()
where id = 'meta' and jsonb_typeof(data->'doi') = 'array' and not (data->'doi') ? 'Cẩu';
insert into public.vehicles (ma, doi, model, che_do, ben_phuc_vu, tai_nang, tam_voi, nang_suat, pham_vi, bang_tai, ghi_chu) values
  ('OHC 40T', 'Cẩu', 'Cầu trục', 'Đi ca', '{"1A","1","2"}', '40 T', null, null, null, null, null),
  ('OHC 30T', 'Cẩu', 'Cầu trục', 'Đi ca', '{"1A","1","2"}', '30 T', null, null, null, null, null),
  ('SLD bến 2', 'Cẩu', 'Ship loader (SLD)', 'Đi ca', '{"2"}', null, null, '720', null, null, null),
  ('QC03', 'Cẩu', 'Cẩu giàn', 'Đi ca', '{"3"}', '40 T', '20 m', null, '15-210m', null, null),
  ('QC04', 'Cẩu', 'Cẩu giàn', 'Đi ca', '{"3"}', '40 T', '35 m', null, '40-350m', null, null),
  ('QC05', 'Cẩu', 'Cẩu giàn', 'Đi ca', '{"3"}', '40 T', '35 m', null, '60-480m', null, null),
  ('SC02', 'Cẩu', 'Cẩu gọng kìm', 'Đi ca', '{"5"}', '32 T', '43 m', null, '220-500m', '#1, #2', null),
  ('QC10', 'Cẩu', 'Cẩu giàn', 'Đi ca', '{"5"}', '52 T', '40 m', '2000', '280-580m', '#1, #2, #5', null),
  ('QC11', 'Cẩu', 'Cẩu giàn', 'Đi ca', '{"5"}', '52 T', '40 m', '2000', '370-790m', '#1, #2, #5', null),
  ('QC08', 'Cẩu', 'Cẩu giàn', 'Đi ca', '{"10"}', '62 T', '43 m', '2000', '530-830m', '#1, #2, #5', null),
  ('QC06', 'Cẩu', 'Cẩu giàn', 'Đi ca', '{"10"}', '62 T', '43 m', '2000', '530-830m', '#1, #2, #5', null),
  ('QC07', 'Cẩu', 'Cẩu giàn', 'Đi ca', '{"10"}', '62 T', '43 m', '2000', '640-910m', '#1, #2, #5', null),
  ('SLD bến 4', 'Cẩu', 'Ship loader (SLD)', 'Đi ca', '{"4"}', null, '15 m', '1000', '30-170m', null, null),
  ('SC01', 'Cẩu', 'Cẩu gọng kìm', 'Đi ca', '{"4"}', '16 T', '30 m', null, '40-275m', null, 'Cẩu 16 tấn, hạn chế khi nào không thể cẩu máy đào (xe nhóp 22-25 Tấn) xuống hầm tàu, chỉ cẩu được máy đào nhỏ dưới 16T'),
  ('SC07', 'Cẩu', 'Cẩu gọng kìm', 'Đi ca', '{"6"}', '32 T', '43 m', null, '205-400m', '#3, #4', null),
  ('SC06', 'Cẩu', 'Cẩu gọng kìm', 'Đi ca', '{"6"}', '32 T', '43 m', null, '205-505m', '#3, #4', null),
  ('SC05', 'Cẩu', 'Cẩu gọng kìm', 'Đi ca', '{"6"}', '32 T', '43 m', null, '310-550m', '#3, #4', null),
  ('SLD bến 6', 'Cẩu', 'Ship loader (SLD)', 'Đi ca', '{"6"}', null, null, null, null, null, null),
  ('QC01', 'Cẩu', 'Cẩu giàn', 'Đi ca', '{"11"}', '62 T', '43 m', '2500', '530-830m', '#3, #4, #5', null),
  ('QC02', 'Cẩu', 'Cẩu giàn', 'Đi ca', '{"11"}', '62 T', '43 m', '2500', '640-910m', '#3, #4, #5', null),
  ('QC09', 'Cẩu', 'Cẩu giàn', 'Đi ca', '{"11"}', '62 T', '43 m', '2500', '530-830m', '#3, #4, #5', null),
  ('QC12', 'Cẩu', 'Cẩu giàn', 'Đi ca', '{"11"}', '52 T', '40 m', '2000', '355-805m', '#3, #4, #5', null),
  ('SC11', 'Cẩu', 'Cẩu gọng kìm', 'Đi ca', '{"7"}', '32 T', '30 m', '1000', '0-193m', '#101,#201,#301', null),
  ('SC12', 'Cẩu', 'Cẩu gọng kìm', 'Đi ca', '{"7"}', '32 T', '30 m', '1000', '0-293m', '#101,#201,#301', null),
  ('SLD bến 7', 'Cẩu', 'Ship loader (SLD)', 'Đi ca', '{"7"}', null, null, '280', '60-120m', null, null),
  ('SC12A', 'Cẩu', 'Cẩu gọng kìm', 'Đi ca', '{"8"}', '16 T', '30 m', '1000', '55-355m', '#101,#201,#301', null),
  ('SC08', 'Cẩu', 'Cẩu gọng kìm', 'Đi ca', '{"8"}', '16 T', '30 m', '1000', '107-407m', '#101,#201', null),
  ('SC09', 'Cẩu', 'Cẩu gọng kìm', 'Đi ca', '{"9"}', '16 T', '25 m', '1000', '158-433m', '#101,#201', null),
  ('SC10', 'Cẩu', 'Cẩu gọng kìm', 'Đi ca', '{"9"}', '50 T', '25 m', '1000', '208-433m', '#101,#201', null),
  ('SCHH02', 'Cẩu', 'Cẩu gọng kìm', 'Đi ca', '{"HH2"}', '50 T', '35 m', null, '40-310m', null, null),
  ('SCHH03', 'Cẩu', 'Cẩu gọng kìm', 'Đi ca', '{"HH2"}', '50 T', '35 m', null, '90-370m', null, null),
  ('Cẩu xích 350T', 'Cẩu', 'Cẩu xích', 'Đi ca', '{"HH3"}', '86 / 47 / 33 T', '20 / 30 / 40 m', null, null, null, 'Biểu đồ tải: 86T tầm 20m, 47T tầm 30m, 33T tầm 40m'),
  ('Cẩu xích 260T #1', 'Cẩu', 'Cẩu xích', 'Đi ca', '{"HH3"}', '51 / 30 / 20 T', '20 / 30 / 40 m', null, null, null, 'Biểu đồ tải: 51T tầm 20m, 30T tầm 30m, 20T tầm 40m'),
  ('Cẩu xích 260T #2', 'Cẩu', 'Cẩu xích', 'Đi ca', '{"HH3"}', '51 / 30 / 20 T', '20 / 30 / 40 m', null, null, null, 'Biểu đồ tải: 51T tầm 20m, 30T tầm 30m, 20T tầm 40m'),
  ('SHC01', 'Cẩu', 'Cẩu xích', 'Đi ca', '{"6CTH"}', '40 T', '37.5 m', null, '90-460m', null, null),
  ('SHC02', 'Cẩu', 'Cẩu xích', 'Đi ca', '{"6CTH"}', '40 T', '37.5 m', null, '155-485m', null, null),
  ('SC03', 'Cẩu', 'Cẩu xích', 'Đi ca', '{"7CTH"}', '32 T', '43 m', null, '10-315m', null, null),
  ('SC04', 'Cẩu', 'Cẩu xích', 'Đi ca', '{"7CTH"}', '32 T', '43 m', null, '40-415m', null, null)
on conflict (ma) do update set doi = excluded.doi, model = excluded.model, ben_phuc_vu = excluded.ben_phuc_vu, tai_nang = excluded.tai_nang,
  tam_voi = excluded.tam_voi, nang_suat = excluded.nang_suat, pham_vi = excluded.pham_vi, bang_tai = excluded.bang_tai;

-- C. Hàng hóa: thay hẳn bằng danh sách trong file
delete from public.hang_hoa;
insert into public.hang_hoa (loai_hang, nhom, ti_trong, ghi_chu) values
  ('Phế HMS', 'Phế', 0.6, null),
  ('Phế HS', 'Phế', 0.7, null),
  ('Phế PNS', 'Phế', 0.7, null),
  ('Phế băm', 'Phế', 1.1, null),
  ('Phế bloom', 'Phế', null, null),
  ('Phế nội', 'Phế', 0.2, null),
  ('Thép phế >= 3mm', 'Phế', 0.2, null),
  ('Phế hình (nhật)', 'Phế', 0.7, null),
  ('Bùn đất', 'Đất', 1.2, null),
  ('Phế cấp phối', 'Phế', 0.6, null),
  ('Phế lẫn đất', 'Đất', 0.9, null),
  ('Xỉ lật phôi vuông', 'Xỉ', 1.623, null),
  ('Xỉ gầm lò', 'Xỉ', 1.564, null),
  ('Liệu hồi trạm đá', 'Bụi', 1.54, null),
  ('Vật liệu chịu lửa phế', 'Vật liệu chịu lửa', 0, null),
  ('Rác thải CN', 'Rác', 0, null),
  ('Kim loại màu', 'Phế', 0.5, null),
  ('Quặng trung hòa', 'Quặng', 1.877, null),
  ('Quặng hồi thiêu kết', 'Quặng', 1.994, null),
  ('Quặng hồi lò cao', 'Quặng', 1.992, null),
  ('Quặng cỡ Hemantit Lào', 'Quặng', 1.958, null),
  ('Quặng vê viên thành phẩm', 'Quặng', 2.21, null),
  ('Quặng thiêu kết thành phẩm', 'Quặng', 1.576, null),
  ('Quặng Cỡ Roy Hill-Úc', 'Quặng', 1.992, null),
  ('Quặng cỡ Glencore', 'Quặng', 2.355, null),
  ('Quặng cỡ Fenix-Úc', 'Quặng', 2.205, null),
  ('Quặng cỡ Newman - Úc', 'Quặng', 1.946, null),
  ('Quặng cỡ BOMI - LIBERIA', 'Quặng', 2.31, null),
  ('Quắc Zit', 'Quặng', 1.423, null),
  ('Hot Briquetted Iron (HBI)', 'Phế', 2.72, null),
  ('Xí thép nghiền cỡ hạt (5x20)mm', 'Xỉ', 1.538, null),
  ('Xí thép cấp phối SS10', 'Xỉ', 1.603, null),
  ('Xí thép cấp phối SS14', 'Xỉ', 1.779, null),
  ('Xí thép cấp phối SS40', 'Xỉ', 1.45, null),
  ('Xỉ vệ sinh gầm lò thổi', 'Xỉ', 1.564, null),
  ('Xỉ sau ủ', 'Xỉ', 2.371, null),
  ('Xỉ tổng hợp', 'Xỉ', 2.734, null),
  ('Xí thép sau ủ (tách lọc mê > 200 mm)', 'Xỉ', 1.704, null),
  ('Xí thép sau ủ (chưa tách lọc mê)', 'Xỉ', 2.37, null),
  ('Xỉ làm việc NM cán TD', 'Xỉ', 1.623, null),
  ('Xỉ làm việc NM cán QSP', 'Xỉ', 1.438, null),
  ('Xỉ hạt lò cao', 'Xỉ', 0.942, null),
  ('Xỉ hạt lò cao nghiền mịn', 'Xỉ', 0.952, null),
  ('Đá vôi 10-20 mm', 'Đá', 1.532, null),
  ('Đá vôi < 10 mm', 'Đá', 1.459, null),
  ('Đá vôi < 20 mm', 'Đá', 1.46, null),
  ('Đá vôi < 40 mmm', 'Đá', 1.559, null),
  ('Đá vôi > 40 mmm', 'Đá', 1.44, null),
  ('Đá vôi 20 -45', 'Đá', 1.118, null),
  ('Đá vôi 40-90', 'Đá', 1.446, null),
  ('Đá loại lò Dolo đứng', 'Đá', 1.761, null),
  ('Dolomite nung thành phẩm', 'Đá', 1.101, null),
  ('Đá dolomite <10', 'Đá', 1.657, null),
  ('Đá dolomite 20-40', 'Đá', 1.46, null),
  ('Đá dolomite 40-90', 'Đá', 1.45, null),
  ('Đá dolomite 45-100', 'Đá', 1.478, null),
  ('Đá dolomite 50-100', 'Đá', 1.531, null),
  ('Bột đá vôi <3 mm', 'Đá', 1.435, null),
  ('Bột đá Dolomite nung 0-3', 'Đá', 1.118, null),
  ('Bột đá Dolomite 0-3', 'Đá', 1.658, null),
  ('Bụi coke', 'Bụi', 0.898, null),
  ('Bụi túi vải LT', 'Bụi', 1.081, null),
  ('Bụi tĩnh điện LT', 'Bụi', 0.771, null),
  ('Bụi trọng lực LT', 'Bụi', 1.757, null),
  ('Bụi silo ngầm LG', 'Bụi', 0.765, null),
  ('Bụi túi vải LG', 'Bụi', 0.996, null),
  ('Bụi trọng lực LG (quặng hồi)', 'Quặng', 1.254, null),
  ('Vỉa thép 0-10 mm', 'Vải', 1.751, null),
  ('Vỉa thép 10-40 mm', 'Vải', 1.864, null),
  ('Vỉa thép 40-200 mm', 'Vải', 1.773, null),
  ('Vôi bôt lò quay', 'Đá', 1.364, null),
  ('Vôi nung lò quay', 'Đá', 1.151, null),
  ('Coke 0-80 chưa qua sàng', 'Cốc', 0.576, null),
  ('Coke 10-80', 'Cốc', 0.586, null),
  ('Vảy cán thu hồi từ S95', 'Vảy cán', 4.373, null),
  ('Vảy cán mua ngoài', 'Vảy cán', 2.23, null),
  ('Gang thỏi', 'Gang thỏi', 3.837, null),
  ('Than coke < 10', 'Cốc', 0.796, null),
  ('Thạch cao', 'Thạch cao', 0.786, null),
  ('Quặng tinh Sino iron (Ma)', 'Quặng', 1.597, null),
  ('Quặng He Kumba fines', 'Quặng', 2.535, null),
  ('Quặng Cám Limonit Tắc Ái', 'Quặng', 1.467, null),
  ('Quặng Li FB - FMG', 'Quặng', 1.89, null),
  ('Quặng Li Simec 1ow-Frade', 'Quặng', 1.807, null),
  ('Quặng He Yara', 'Quặng', 1.4, null),
  ('Quặng vê viên dưới cỡ', 'Quặng', 1.57, null),
  ('Quặng He Spain 1ow-Frade', 'Quặng', 1.432, null),
  ('Quặng He Brazil Low-grade', 'Quặng', 1.06, null),
  ('Quặng Li SS-FMG', 'Quặng', 1.888, null),
  ('Quặng He BRBF Vale', 'Quặng', 2.12, null),
  ('Quặng Li Carina', 'Quặng', 1.991, null),
  ('Quặng cám Roy Hill-Úc', 'Quặng', 1.892, null),
  ('Quặng cám Tiến Bộ', 'Quặng', 1.539, null),
  ('Quặng cám He Fenix-Úc', 'Quặng', 1.95, null),
  ('Quặng cám BHP-Úc', 'Quặng', 1.912, null),
  ('Quặng cám Newman High Grade-Úc', 'Quặng', 2.055, null),
  ('Quặng hồi máy bản lược', 'Quặng', 1.85, null),
  ('Quặng Manhetic Sin Quyen', 'Quặng', 1.55, null),
  ('Quặng Manhetic Nhât Anh', 'Quặng', 1.708, null),
  ('Quặng Manhetit noi dia (Si thíÏp)', 'Quặng', 1.565, null),
  ('Quăng Manhetit noi dia (Si cao)', 'Quặng', 1.7, null),
  ('Quặng sau nghien tinh (QMA noi dia)', 'Quặng', 2.01, null),
  ('Quặng tinh Tho Nhï Kÿ', 'Quặng', 1.057, null),
  ('Quặng tinh Karara-Úc', 'Quặng', 1.504, null),
  ('Huỳnh thạch cỡ hạt 0-10', 'Huỳnh thạch', 1.712, null),
  ('Huỳnh thạch cỡ hạt 10-90', 'Huỳnh thạch', 1.35, null),
  ('Than HCC Mabu', 'Than', 0.641, null),
  ('Than PCI HWW', 'Than', 0.661, null),
  ('Than HCC Byerwen', 'Than', 0.711, null),
  ('Than HCC Saraji', 'Than', 0.733, null),
  ('Than HCC Illawara', 'Than', 0.657, null),
  ('Than HCC BBP', 'Than', 0.57, null),
  ('Than HCC Leer', 'Than', 0.629, null),
  ('Than SHCC Raspadskaya', 'Than', 0.721, null),
  ('Than PCI Yarranbee', 'Than', 0.758, null),
  ('Than PCI Bachatsky', 'Than', 0.724, null),
  ('Than PCI ASSH-UHG', 'Than', 0.835, null),
  ('Than PCI Middle Mount', 'Than', 0.671, null),
  ('Than PCI Lake Vermont', 'Than', 0.835, null),
  ('Than PCI MV', 'Than', null, null),
  ('Than PCI LV', 'Than', null, null),
  ('Than HCC Appin', 'Than', 0.72, null),
  ('Than HCC HV Uvalnaya', 'Than', 0.84, null),
  ('Than HCC Peck Down North', 'Than', 0.698, null),
  ('Than HCC Sonoina', 'Than', 0.82, null),
  ('Than HCC Riverside', 'Than', 0.696, null),
  ('Than HCC Caval Ridge', 'Than', 0.684, null),
  ('Than HCC Peak Down', 'Than', 0.72, null),
  ('Than SHCC Nantoy', 'Than', 0.651, null),
  ('Than cám 2A', 'Than', 0.723, null),
  ('Than cám nghiền', 'Than', 0.694, null),
  ('Than HCC Oaky North', 'Than', 0.669, null),
  ('Trấu luyện kim qua nung', 'Trấu', 0.164, null);

-- D. Kho bãi: chỉ nạp khi bảng trống
insert into public.kho_bai (ten_bai, dien_tich, hang, thiet_bi, ghi_chu)
select * from (values
  ('Bãi Duafat', 5500, 'Bột đá V 0-3mm', null, null),
  ('Bãi Duafat', 1500, 'Bùn vảy cán HRC', null, null),
  ('Bãi Duafat', 10000, 'Phế', null, null),
  ('Bãi Duafat', 5200, 'Quặng vê viên', null, null),
  ('Bãi Duafat', 2000, 'Quặng cỡ titan', null, null),
  ('Bãi Duafat', 900, 'Quặng cỡ Khumani', null, null),
  ('Bãi Duafat', 2500, 'Quặng cỡ BOMI - LIBERIA', null, null),
  ('Bãi DQS7', 6300, 'HBI', null, null),
  ('Bãi DQS7', 12500, 'Đá 40-90mm', null, null),
  ('Bãi DQS7', 7500, 'Đá 45-100mm', null, null),
  ('Bãi HRCE', 12000, 'Phế', null, null),
  ('Bãi HRCE', 5200, 'Xỉ thép sau tuyển', null, null),
  ('Bãi HRCE', 3000, 'Đá 45-100mm', null, null),
  ('Bãi 02 DQ2', 6000, 'Xỉ hạt lò cao', null, null),
  ('Bãi đuôi kho 3', 3500, 'Đá vôi <20mm', null, null),
  ('Bãi đuôi kho 3', 3000, 'Bột đá D 0-3mm', null, null),
  ('Bãi đuôi kho 3', 2000, 'Bột đá V 0-3mm', null, null),
  ('Bãi đuôi kho 3', 4500, 'Quặng cỡ Pilbara-Úc', null, null),
  ('Bãi đuôi kho 3', 4200, 'Quặng cỡ Kumba', null, null),
  ('Bãi đuôi kho 3', null, 'Quặng cỡ Khumani', null, null),
  ('Bãi đuôi kho 2', null, 'Vảy cán thu hồi giá S = 0', null, null),
  ('Bãi đuôi kho 2', 2000, 'Đá 20-45mm', null, null),
  ('Bãi đuôi kho 2', 1500, 'Đá dolomit 20-40mm', null, null),
  ('Bãi đuôi kho 2', 10000, 'Xỉ hạt lò cao', null, null),
  ('Bãi cốc 3', 2600, 'Xỉ thép sau tuyển', null, null),
  ('Bãi cốc 3', 6000, 'Phế', null, null),
  ('Kho hở TX2', 1000, 'Xỉ thép sau tuyển', null, null),
  ('Bãi Hào hưng', 2800, 'Bột đá D 0-3mm', null, null),
  ('Bãi Hào hưng', 2700, 'Đá 40-90mm', null, null),
  ('Bãi Hào hưng', 5000, 'Đá 45-100mm', null, null),
  ('Bãi C2 CTH', 9240, 'Than cốc 10-80mm', null, null),
  ('Bãi CTH', 73000, 'Phế', null, null),
  ('Kho F', 7500, 'Phế', null, null),
  ('Kho G', 9000, 'Phế', null, null),
  ('Bãi KTX', 3900, 'Đá vôi <20mm', null, null),
  ('Bãi KTX', 8500, 'Đá vôi <40mm', null, null),
  ('Bãi KTX', 7100, 'Đá 45-100mm', null, null),
  ('Bãi KTX', 9500, 'Đá 40-90mm', null, null),
  ('Bãi xe BP.LOG', 6000, null, null, null),
  ('Bãi S95', 6000, 'Xỉ hạt lò cao', '2 cầu trục', null),
  ('Bãi lò cao 6', 19200, 'Phế', '6 cổng trục', null)
) as t(ten_bai, dien_tich, hang, thiet_bi, ghi_chu)
where not exists (select 1 from public.kho_bai);

-- Kiểm tra
select 'berths' as bang, count(*) from public.berths
union all select 'vehicles (Cẩu)', count(*) from public.vehicles where doi = 'Cẩu'
union all select 'hang_hoa', count(*) from public.hang_hoa
union all select 'kho_bai', count(*) from public.kho_bai;


-- >>>>>>>>>> 03_bo_tri_ben.sql <<<<<<<<<<
-- 03. Bố trí tuyến bến (mét từng bến, góc vuông, thứ tự hiển thị) và băng tải của bến. Chạy SAU 02_nap_danh_muc.sql. Chạy được nhiều lần.

-- Bố trí theo sơ đồ cầu bến: 1A, 1, 2 song song (mỗi bến một tuyến 0–140 m); mặt tây 3 – 5 – 10; mặt đông 4 – 6 – 11 (đầu mét 0 của bến 4
-- góc vuông với tuyến bến 7); tuyến 7 – 8 – 9 (đầu tây bến 7 góc vuông với mặt đông); HH2 – HH3; 6CTH – 7CTH.
update public.berths b set tuyen = x.tuyen, met_tu = x.tu, met_den = x.den, goc_vuong = x.goc, thu_tu = x.tt
from (values
  ('1A', '1A', 0, 140, null, 1), ('1', '1', 0, 140, null, 2), ('2', '2', 0, 140, null, 3),
  ('3', '3-5-10', 0, 200, null, 4), ('5', '3-5-10', 200, 500, null, 5), ('10', '3-5-10', 500, 910, null, 6),
  ('4', '4-6-11', 0, 200, 'dau', 7), ('6', '4-6-11', 200, 500, null, 8), ('11', '4-6-11', 500, 910, null, 9),
  ('7', '7-8-9', 0, 180, 'dau', 10), ('8', '7-8-9', 180, 306.5, null, 11), ('9', '7-8-9', 306.5, 433, null, 12),
  ('HH2', 'HH2-HH3', 0, 242, null, 13), ('HH3', 'HH2-HH3', 242, 432, null, 14),
  ('6CTH', '6CTH-7CTH', 250, 490, null, 15), ('7CTH', '6CTH-7CTH', 0, 250, null, 16)
) as x(ma, tuyen, tu, den, goc, tt)
where b.ma = x.ma;

-- Băng tải làm hàng của bến: gộp từ băng tải của các cẩu phục vụ bến (chỉ điền bến còn trống)
update public.berths b
   set bang_tai = s.ds
  from (select bp.ben, string_agg(distinct trim(t), ', ' order by trim(t)) ds
          from public.vehicles v
          cross join lateral unnest(v.ben_phuc_vu) bp(ben)
          cross join lateral unnest(string_to_array(v.bang_tai, ',')) t
         where v.bang_tai is not null and trim(t) <> ''
         group by bp.ben) s
 where s.ben = b.ma and (b.bang_tai is null or b.bang_tai = '');


-- >>>>>>>>>> 06_san_luong_thuc_te.sql <<<<<<<<<<
-- 06. Mục tiêu và sản lượng THỰC TẾ nhập tay theo ca / ngày, cho hai tab của Khai thác Cảng › Mục tiêu sản lượng:
--   Mục tiêu khai thác cảng : mục tiêu tháng dùng bảng muc_tieu_san_luong (SQL 21, theo hướng nhập / xuất và loại hàng);
--                             thực tế theo ca / ngày: bảng san_luong_cang (CA 1, CA 2).
--   Mục tiêu khai thác vận tải: mục tiêu tháng: bảng muc_tieu_van_tai, theo hướng (Phục vụ cảng / Phục vụ sản xuất), loại xe (đội xe),
--                             đơn vị thực hiện (Hòa Phát / Nhà thầu) và loại hàng (nhóm hàng như bên cảng; trống = mọi hàng);
--                             thực tế theo ca / ngày: bảng san_luong_van_tai.
-- Chạy SAU 01_cau_truc.sql. Chạy được nhiều lần (bản đã chạy trước khi có cột loại hàng của vận tải sẽ được bổ sung cột và khóa mới).
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
  loai_xe    text not null,                         -- đội xe: Xe ben, Xe đầu kéo, Xe bồn…
  don_vi     text not null check (don_vi in ('hoa_phat', 'nha_thau')),
  loai_hang  text not null default '',              -- nhóm hàng vận chuyển; trống = mọi hàng
  tan        numeric not null check (tan >= 0),
  ghi_chu    text,
  updated_at timestamptz not null default now()
);

create table if not exists public.san_luong_van_tai (
  id         bigint generated always as identity primary key,
  ngay       date not null,
  ca         text not null check (ca in ('CA 1', 'CA 2')),
  huong      text not null check (huong in ('phuc_vu_cang', 'phuc_vu_san_xuat')),
  loai_xe    text not null,
  don_vi     text not null check (don_vi in ('hoa_phat', 'nha_thau')),
  loai_hang  text not null default '',
  tan        numeric not null check (tan >= 0),
  ghi_chu    text,
  nguoi      uuid default auth.uid(),
  updated_at timestamptz not null default now()
);
create index if not exists san_luong_van_tai_ngay_idx on public.san_luong_van_tai (ngay);

-- Bản đã chạy trước đây chưa có cột loại hàng: bổ sung, bỏ khóa duy nhất cũ (không có loại hàng)
alter table public.muc_tieu_van_tai  add column if not exists loai_hang text not null default '';
alter table public.san_luong_van_tai add column if not exists loai_hang text not null default '';
alter table public.muc_tieu_van_tai  drop constraint if exists muc_tieu_van_tai_thang_huong_loai_xe_don_vi_key;
alter table public.san_luong_van_tai drop constraint if exists san_luong_van_tai_ngay_ca_huong_loai_xe_don_vi_key;
create unique index if not exists muc_tieu_van_tai_khoa on public.muc_tieu_van_tai (thang, huong, loai_xe, don_vi, loai_hang);
create unique index if not exists san_luong_van_tai_khoa on public.san_luong_van_tai (ngay, ca, huong, loai_xe, don_vi, loai_hang);

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


-- >>>>>>>>>> 07_phan_loai_ton.sql <<<<<<<<<<
-- 07. PHÂN LOẠI TỒN KHO cho 3 biểu đồ ở khối dưới Tổng quan (chạy SAU 01…06; chạy được nhiều lần).
-- Tồn cần giải phóng: hàng tồn lâu ngày không bán / sử dụng được hoặc chưa có hướng xử lý, chiếm diện tích kho bãi.
-- Tồn đầu cơ: hàng sản xuất đón đầu thị trường hoặc mua về dự trữ khi giá rẻ; tăng đột biến, chiếm bãi nhiều, dùng lâu dài.
-- Tồn lưu động: phần còn lại (tồn bình thường, nhập / xuất mỗi ngày tương đối đều) = tồn kho − tồn cần giải phóng − tồn đầu cơ, nên không lưu ở đây.
-- Mỗi dòng là một lần KHAI BÁO: "từ ngày X, tại bãi Y, hàng Z có N tấn thuộc loại này". Lần khai báo mới nhất (ngày ≤ ngày xem) của cùng bãi + hàng + loại là số có hiệu lực;
-- khai báo 0 tấn = hết phân loại. Nhờ vậy biểu đồ vẽ lại được diễn biến theo ngày.
-- Ai có quyền phần Kho (hoặc Cảng) đọc được; nhập liệu trở lên khai báo; quản lý trở lên xóa.

create table if not exists public.kho_ton_phan_loai (
  id         bigint generated always as identity primary key,
  ngay       date not null default current_date,     -- ngày bắt đầu hiệu lực
  ten_bai    text not null,                          -- bãi lớn
  hang       text not null,
  loai       text not null check (loai in ('can_giai_phong', 'dau_co')),
  tan        numeric not null check (tan >= 0),      -- 0 = hết phân loại
  ghi_chu    text,
  nguoi      uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists kho_ton_phan_loai_idx on public.kho_ton_phan_loai (ngay);

alter table public.kho_ton_phan_loai enable row level security;
drop policy if exists kho_ton_phan_loai_doc on public.kho_ton_phan_loai;
drop policy if exists kho_ton_phan_loai_them on public.kho_ton_phan_loai;
drop policy if exists kho_ton_phan_loai_xoa on public.kho_ton_phan_loai;
create policy kho_ton_phan_loai_doc  on public.kho_ton_phan_loai for select using (public.co_quyen('kho', array['xem','nhap','quan_ly','quan_tri']) or public.co_quyen('cang', array['xem','nhap','quan_ly','quan_tri']));
create policy kho_ton_phan_loai_them on public.kho_ton_phan_loai for insert with check (public.co_quyen('kho', array['nhap','quan_ly','quan_tri']));
create policy kho_ton_phan_loai_xoa  on public.kho_ton_phan_loai for delete using (public.co_quyen('kho', array['quan_ly','quan_tri']));

drop trigger if exists audit_kho_ton_phan_loai on public.kho_ton_phan_loai;
create trigger audit_kho_ton_phan_loai after insert or update or delete on public.kho_ton_phan_loai for each row execute function public.ghi_audit();

