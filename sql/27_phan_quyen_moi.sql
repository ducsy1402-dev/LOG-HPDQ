-- 27 · PHÂN QUYỀN MỚI: Quyền xem · Quyền chỉnh sửa (13 mục) · Quản trị (anh Sỹ chốt 22/11/2026)
-- Thay cách phân quyền cũ (vai trò Cảng / Kho / Thiết bị cơ giới + 6 nhóm của SQL 16) bằng 3 phần cho mỗi tài khoản:
--   QUYỀN XEM       bảng user_xem  (tat_ca, tong_quan, khai_bao, dieu_do, linetime, ke_hoach_th, kho, danh_muc)
--                   Chỉ ẩn / hiện trang trên web, KHÔNG chặn đọc ở CSDL (mọi tài khoản đã đăng nhập vẫn đọc được bảng).
--   QUYỀN CHỈNH SỬA bảng user_nhom (dùng lại bảng của SQL 16, đổi sang 13 mục mới); CHẶN THẬT ở CSDL bằng chính sách ghi <bảng>_ghi_nhom.
--   QUẢN TRỊ        user_roles.vai_tro = 'quan_tri' (xem và sửa tất cả, đặt quyền cho người khác, tạo tài khoản).
--
-- 13 mục chỉnh sửa → bảng được ghi:
--   khai_bao       events, headcount, headcount_to, thong_tin_ca, ca_kip, thiet_bi_gan_sl, danh_muc (loại thiết bị gắn…)
--   dieu_do        (quyền để sẵn, trang Điều độ chưa có ô nhập)
--   linetime       voyages, voyage_events, voyage_stops, voyage_tra_hang, vessels, agents
--   kh_dai_han     muc_tieu_san_luong, muc_tieu_ky, muc_tieu_van_tai, kh_tong_hop, kh_phan_kho, kh_phan_xe
--   kh_cang        ke_hoach_san_luong_ngay (+ kh_ngay_* cũ)
--   kh_van_tai     plan_params, plan_jobs, demand_batches, demands, assignments, gan_co_dinh, chien_dich(+thuc_te), danh_muc (nhà thầu, tổ trưởng…)
--   san_luong      san_luong_cang, san_luong_van_tai
--   kho_hang_kien, kho_hang_roi   kho_giao_dich, kho_ke_hoach, kho_ton_phan_loai, kho_lo
--                  (CSDL chưa tách riêng hai kho: ai có MỘT trong hai mục đều ghi được sổ kho; web mới khóa từng tab)
--   dm_thiet_bi    vehicles, staff, model_specs, danh_muc, thiet_bi_gan_sl, danh_muc_bang (trừ khai báo kho / bãi)
--   dm_hang        hang_hoa
--   dm_kho         kho_bai, danh_muc_bang (khai báo kho / bãi)
--   dm_cau_ben     berths
--
-- CHẠY LẦN ĐẦU sẽ ĐẶT LẠI quyền của mọi tài khoản không phải quản trị (anh Sỹ: "để trống, tự tích lại"):
--   - sao lưu bảng quyền cũ sang sao_luu_27_user_roles / _user_module_roles / _user_nhom (chỉ quản trị mở được bằng SQL Editor);
--   - xóa vai trò Cảng / Kho theo phân hệ và các nhóm cũ; vai trò chung 'nhap' hạ về 'xem';
--   - đặt Quyền xem = Tất cả cho mọi tài khoản (để không ai bị khóa khỏi web), Quyền chỉnh sửa = trống.
--   Quản trị vào Phân quyền để tích lại từng người. Chạy lại file này chỉ cập nhật chính sách, không đặt lại quyền.
-- Chạy SAU 01…26 (cần co_vai_tro, co_nhom của SQL 16). Chạy được nhiều lần.

-- 1. Bảng Quyền xem
create table if not exists public.user_xem (
  user_id    uuid not null references auth.users(id) on delete cascade,
  muc        text not null check (muc in ('tat_ca', 'tong_quan', 'khai_bao', 'dieu_do', 'linetime', 'ke_hoach_th', 'kho', 'danh_muc')),
  updated_at timestamptz not null default now(),
  primary key (user_id, muc)
);
alter table public.user_xem enable row level security;
drop policy if exists user_xem_doc on public.user_xem;
drop policy if exists user_xem_ghi on public.user_xem;
create policy user_xem_doc on public.user_xem for select using (user_id = auth.uid() or public.co_vai_tro(array['quan_tri']));
create policy user_xem_ghi on public.user_xem for all using (public.co_vai_tro(array['quan_tri'])) with check (public.co_vai_tro(array['quan_tri']));

-- 2. Sao lưu + đặt lại quyền (chỉ lần chạy đầu: có bảng sao lưu rồi thì bỏ qua)
do $$
begin
  if to_regclass('public.sao_luu_27_user_roles') is null then
    create table public.sao_luu_27_user_roles as select * from public.user_roles;
    create table public.sao_luu_27_user_module_roles as select * from public.user_module_roles;
    alter table public.sao_luu_27_user_roles enable row level security;          -- không có chính sách = web không đọc được
    alter table public.sao_luu_27_user_module_roles enable row level security;
    if to_regclass('public.user_nhom') is not null then
      create table public.sao_luu_27_user_nhom as select * from public.user_nhom;
      alter table public.sao_luu_27_user_nhom enable row level security;
      delete from public.user_nhom;
    end if;
    delete from public.user_module_roles where user_id not in (select user_id from public.user_roles where vai_tro = 'quan_tri');
    update public.user_roles set vai_tro = 'xem' where vai_tro <> 'quan_tri';
    insert into public.user_xem (user_id, muc) select user_id, 'tat_ca' from public.user_roles on conflict do nothing;
  end if;
end $$;

-- 3. Bảng Quyền chỉnh sửa: 13 mục mới
create table if not exists public.user_nhom (
  user_id    uuid not null references auth.users(id) on delete cascade,
  nhom       text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, nhom)
);
delete from public.user_nhom where nhom <> all (array['khai_bao', 'dieu_do', 'linetime', 'kh_dai_han', 'kh_cang', 'kh_van_tai', 'san_luong', 'kho_hang_kien', 'kho_hang_roi', 'dm_thiet_bi', 'dm_hang', 'dm_kho', 'dm_cau_ben']);
alter table public.user_nhom drop constraint if exists user_nhom_nhom_check;
alter table public.user_nhom add constraint user_nhom_nhom_check check (nhom in ('khai_bao', 'dieu_do', 'linetime', 'kh_dai_han', 'kh_cang', 'kh_van_tai', 'san_luong', 'kho_hang_kien', 'kho_hang_roi', 'dm_thiet_bi', 'dm_hang', 'dm_kho', 'dm_cau_ben'));
alter table public.user_nhom enable row level security;
drop policy if exists user_nhom_doc on public.user_nhom;
drop policy if exists user_nhom_ghi on public.user_nhom;
create policy user_nhom_doc on public.user_nhom for select using (user_id = auth.uid() or public.co_vai_tro(array['quan_tri']));
create policy user_nhom_ghi on public.user_nhom for all using (public.co_vai_tro(array['quan_tri'])) with check (public.co_vai_tro(array['quan_tri']));

-- 4. Chính sách GHI theo mục chỉnh sửa (thay các chính sách <bảng>_ghi_nhom của SQL 16, 17, 18, 22, 23). Bảng chưa tạo thì bỏ qua.
do $$
declare r record;
begin
  for r in select * from (values
    -- Thiết bị cơ giới
    ('events',            '{khai_bao}'), ('headcount',   '{khai_bao}'), ('headcount_to', '{khai_bao}'), ('thong_tin_ca', '{khai_bao}'),
    ('ca_kip',            '{khai_bao,kh_van_tai}'),
    ('thiet_bi_gan_sl',   '{khai_bao,dm_thiet_bi}'),
    ('danh_muc',          '{khai_bao,kh_van_tai,dm_thiet_bi}'),
    ('plan_params',       '{kh_van_tai}'), ('plan_jobs', '{kh_van_tai}'), ('demand_batches', '{kh_van_tai}'), ('demands', '{kh_van_tai}'),
    ('assignments',       '{kh_van_tai}'), ('gan_co_dinh', '{kh_van_tai}'), ('chien_dich', '{kh_van_tai}'), ('chien_dich_thuc_te', '{kh_van_tai}'),
    ('vehicles',          '{dm_thiet_bi}'), ('staff', '{dm_thiet_bi}'), ('model_specs', '{dm_thiet_bi}'),
    -- Kế hoạch tổng hợp
    ('muc_tieu_san_luong','{kh_dai_han}'), ('muc_tieu_ky', '{kh_dai_han}'), ('muc_tieu_van_tai', '{kh_dai_han}'),
    ('kh_tong_hop',       '{kh_dai_han}'), ('kh_phan_kho', '{kh_dai_han}'), ('kh_phan_xe', '{kh_dai_han}'),
    ('ke_hoach_san_luong_ngay', '{kh_cang}'), ('kh_ngay_bo', '{kh_cang}'), ('kh_ngay_tau_xe', '{kh_cang}'), ('kh_ngay_tau_kho', '{kh_cang}'),
    ('san_luong_cang',    '{san_luong}'), ('san_luong_van_tai', '{san_luong}'),
    -- Linetime tàu cập
    ('voyages',           '{linetime}'), ('voyage_events', '{linetime}'), ('voyage_stops', '{linetime}'), ('voyage_tra_hang', '{linetime}'),
    ('vessels',           '{linetime}'), ('agents', '{linetime}'),
    -- Khai thác kho bãi (CSDL chưa tách kho hàng kiện / kho hàng rời)
    ('kho_giao_dich',     '{kho_hang_kien,kho_hang_roi}'), ('kho_ke_hoach', '{kho_hang_kien,kho_hang_roi}'),
    ('kho_ton_phan_loai', '{kho_hang_kien,kho_hang_roi}'), ('kho_lo', '{kho_hang_kien,kho_hang_roi}'),
    -- Danh mục
    ('hang_hoa',          '{dm_hang}'), ('kho_bai', '{dm_kho}'), ('berths', '{dm_cau_ben}')
  ) as x(t, g) loop
    if to_regclass('public.' || r.t) is null then continue; end if;
    execute format('drop policy if exists %I on public.%I', r.t || '_ghi_nhom', r.t);
    execute format('create policy %I on public.%I for all using (public.co_nhom(%L::text[])) with check (public.co_nhom(%L::text[]))', r.t || '_ghi_nhom', r.t, r.g, r.g);
  end loop;
end $$;

-- Chiến dịch: chính sách ghi cũ (SQL 17) còn nhắc nhóm van_tai → chỉ quản trị; người có mục kh_van_tai ghi qua chính sách *_ghi_nhom ở trên
do $$
begin
  if to_regclass('public.chien_dich') is not null then
    drop policy if exists cd_ghi on public.chien_dich;
    create policy cd_ghi on public.chien_dich for all using (public.co_vai_tro(array['quan_tri'])) with check (public.co_vai_tro(array['quan_tri']));
  end if;
  if to_regclass('public.chien_dich_thuc_te') is not null then
    drop policy if exists cdtt_ghi on public.chien_dich_thuc_te;
    create policy cdtt_ghi on public.chien_dich_thuc_te for all using (public.co_vai_tro(array['quan_tri'])) with check (public.co_vai_tro(array['quan_tri']));
  end if;
  -- Bảng danh mục phụ: khai báo kho / bãi (bai_lon) do dm_kho sửa, các bảng còn lại (thông số / định mức thiết bị…) do dm_thiet_bi sửa
  if to_regclass('public.danh_muc_bang') is not null then
    drop policy if exists danh_muc_bang_ghi_nhom on public.danh_muc_bang;
    create policy danh_muc_bang_ghi_nhom on public.danh_muc_bang for all
      using ((bang <> 'bai_lon' and public.co_nhom(array['dm_thiet_bi'])) or (bang = 'bai_lon' and public.co_nhom(array['dm_kho'])))
      with check ((bang <> 'bai_lon' and public.co_nhom(array['dm_thiet_bi'])) or (bang = 'bai_lon' and public.co_nhom(array['dm_kho'])));
  end if;
  -- Người có mục Linetime xem được tab Lịch sử của phiếu chuyến (nhật ký thay đổi)
  if to_regclass('public.audit_log') is not null then
    drop policy if exists audit_log_doc_nhom on public.audit_log;
    create policy audit_log_doc_nhom on public.audit_log for select using (public.co_nhom(array['linetime']));
  end if;
end $$;

-- 5. Hàm nhập file nhu cầu xe (Kế hoạch vận tải › Kế hoạch ngày): đổi điều kiện sang mục kh_van_tai
create or replace function public.import_demands(p_file text, p_rows jsonb, p_win_a int default 30, p_win_b int default 30)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare v_batch bigint; v_min timestamptz; v_dropped int; v_moved int; v_kept int;
begin
  if not (public.co_vai_tro(array['quan_tri']) or public.co_nhom(array['kh_van_tai'])) then
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

-- Kiểm tra: mỗi tài khoản một dòng (quyền xem, quyền chỉnh sửa, quản trị)
select u.email, (r.vai_tro = 'quan_tri') as quan_tri,
       coalesce((select string_agg(x.muc, ', ' order by x.muc) from public.user_xem x where x.user_id = u.id), '(không có)') as xem,
       coalesce((select string_agg(g.nhom, ', ' order by g.nhom) from public.user_nhom g where g.user_id = u.id), '(chỉ xem)') as chinh_sua
from auth.users u left join public.user_roles r on r.user_id = u.id
order by u.email;
