-- ⚠ ĐÃ THAY BẰNG sql/27_phan_quyen_moi.sql (Quyền xem · Quyền chỉnh sửa · Quản trị). Sau khi chạy SQL 27 KHÔNG chạy lại file này: nó tạo lại 6 nhóm cũ và bị bảng user_nhom mới từ chối.
-- 16 · NHÓM QUYỀN THEO KHU VỰC + 7 tài khoản (anh Sỹ 15/11/2026)
-- Mỗi tài khoản: XEM tất cả các phần; chỉ SỬA / THÊM / XÓA ở khu vực của nhóm mình.
-- Cách làm: thêm bảng user_nhom (tài khoản thuộc nhóm nào) và các chính sách GHI bổ sung (cộng thêm, không đụng chính sách cũ):
-- tài khoản cũ (quản trị, nhập liệu, quản lý…) giữ nguyên. Quyền XEM lấy từ vai trò chung 'xem' (user_roles).
--
-- Nhóm quyền            | Sửa / thêm / xóa ở
--   van_tai   (Kế hoạch vận tải)  | Thiết bị cơ giới (xe, nhân sự, sự kiện, quân số, kế hoạch ngày / dài hạn), danh mục thiết bị cơ giới + hàng hóa, mục tiêu và sản lượng thực tế vận tải
--   kho_bai   (Kế hoạch kho bãi)  | Khai thác kho bãi (sổ nhập – xuất, kế hoạch, phân loại tồn, lô), danh mục kho bãi + hàng hóa
--   xuat_nhap (Kế hoạch xuất nhập)| Mục tiêu sản lượng cảng (mục tiêu tháng / quý / năm, kế hoạch ngày, sản lượng thực tế cảng) + danh mục hàng hóa
--   cau_ben   (Kế hoạch cầu bến)  | Linetime tàu cập (chuyến, khoảng dừng, trả hàng, nhật ký), danh mục cầu bến, tàu, đại lý + hàng hóa
--   nhap_lieu (Nhập liệu)         | CHỈ Sản lượng thực tế (cảng và vận tải)
--   dieu_do   (Điều độ)           | Phần Điều độ (hiện trang Điều độ chưa có ô nhập; quyền để sẵn, bổ sung chính sách khi thiết kế)
-- Tài khoản bgdcty: chỉ xem (không thuộc nhóm nào).
--
-- Chạy được nhiều lần. Thứ tự: (1) tạo 7 tài khoản ở Supabase › Authentication › Users › Add user
-- (email dạng  bgdcty@hpdq.test  + mật khẩu, tick Auto Confirm User), (2) chạy file này. Chạy lại file này sau khi thêm tài khoản mới.
-- Đăng nhập trên web chỉ cần gõ TÊN (bgdcty), web tự thêm @hpdq.test.

-- 1. Nhóm của từng tài khoản
create table if not exists public.user_nhom (
  user_id    uuid not null references auth.users(id) on delete cascade,
  nhom       text not null check (nhom in ('van_tai', 'kho_bai', 'xuat_nhap', 'cau_ben', 'nhap_lieu', 'dieu_do')),
  updated_at timestamptz not null default now(),
  primary key (user_id, nhom)
);
alter table public.user_nhom enable row level security;
drop policy if exists user_nhom_doc on public.user_nhom;
drop policy if exists user_nhom_ghi on public.user_nhom;
-- Mỗi người xem nhóm của mình (web dùng để ẩn / khóa nút); quản trị xem và sửa tất cả (màn hình Phân quyền)
create policy user_nhom_doc on public.user_nhom for select using (user_id = auth.uid() or public.co_vai_tro(array['quan_tri']));
create policy user_nhom_ghi on public.user_nhom for all using (public.co_vai_tro(array['quan_tri'])) with check (public.co_vai_tro(array['quan_tri']));

-- 2. Hàm kiểm tra: người đang đăng nhập thuộc ít nhất một nhóm trong danh sách
create or replace function public.co_nhom(cac text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_nhom where user_id = auth.uid() and nhom = any(cac));
$$;

-- 3. Chính sách GHI (thêm / sửa / xóa) theo nhóm, cho từng bảng. Bảng chưa tạo (chưa chạy SQL tương ứng) thì bỏ qua.
do $$
declare r record;
begin
  for r in select * from (values
    -- Thiết bị cơ giới + danh mục thiết bị cơ giới
    ('danh_muc',            '{van_tai}'), ('vehicles',     '{van_tai}'), ('staff',         '{van_tai}'), ('events',        '{van_tai}'),
    ('ca_kip',              '{van_tai}'), ('headcount',    '{van_tai}'), ('headcount_to',  '{van_tai}'), ('model_specs',   '{van_tai}'),
    ('plan_params',         '{van_tai}'), ('plan_jobs',    '{van_tai}'), ('demand_batches','{van_tai}'), ('demands',       '{van_tai}'),
    ('assignments',         '{van_tai}'), ('gan_co_dinh',  '{van_tai}'), ('thiet_bi_gan_sl','{van_tai}'),
    -- Mục tiêu / sản lượng thực tế vận tải
    ('muc_tieu_van_tai',    '{van_tai}'), ('san_luong_van_tai', '{van_tai,nhap_lieu}'),
    -- Danh mục hàng hóa: bốn nhóm kế hoạch cùng sửa
    ('hang_hoa',            '{van_tai,kho_bai,xuat_nhap,cau_ben}'),
    -- Khai thác kho bãi
    ('kho_bai',             '{kho_bai}'), ('kho_lo',       '{kho_bai}'), ('kho_giao_dich', '{kho_bai}'), ('kho_ke_hoach', '{kho_bai}'), ('kho_ton_phan_loai', '{kho_bai}'),
    -- Mục tiêu sản lượng cảng + sản lượng thực tế cảng
    ('muc_tieu_san_luong',  '{xuat_nhap}'), ('ke_hoach_san_luong_ngay', '{xuat_nhap}'), ('san_luong_cang', '{xuat_nhap,nhap_lieu}'),
    -- Linetime tàu cập, cầu bến, tàu, đại lý
    ('berths',              '{cau_ben}'), ('vessels',      '{cau_ben}'), ('agents',        '{cau_ben}'), ('voyages',       '{cau_ben}'),
    ('voyage_events',       '{cau_ben}'), ('voyage_stops', '{cau_ben}'), ('voyage_tra_hang', '{cau_ben}')
  ) as x(t, g) loop
    if to_regclass('public.' || r.t) is null then continue; end if;
    execute format('drop policy if exists %I on public.%I', r.t || '_ghi_nhom', r.t);
    execute format('create policy %I on public.%I for all using (public.co_nhom(%L::text[])) with check (public.co_nhom(%L::text[]))', r.t || '_ghi_nhom', r.t, r.g, r.g);
  end loop;
end $$;

-- Mục tiêu quý / năm: nhom = 'cang' do xuat_nhap sửa, nhom = 'van_tai' do van_tai sửa
do $$
begin
  if to_regclass('public.muc_tieu_ky') is not null then
    drop policy if exists muc_tieu_ky_ghi_nhom on public.muc_tieu_ky;
    create policy muc_tieu_ky_ghi_nhom on public.muc_tieu_ky for all
      using ((nhom = 'cang' and public.co_nhom(array['xuat_nhap'])) or (nhom = 'van_tai' and public.co_nhom(array['van_tai'])))
      with check ((nhom = 'cang' and public.co_nhom(array['xuat_nhap'])) or (nhom = 'van_tai' and public.co_nhom(array['van_tai'])));
  end if;
  -- Bảng danh mục phụ: thông số / định mức thiết bị do van_tai sửa; khai báo kho / bãi (bai_lon) do kho_bai sửa
  if to_regclass('public.danh_muc_bang') is not null then
    drop policy if exists danh_muc_bang_ghi_nhom on public.danh_muc_bang;
    create policy danh_muc_bang_ghi_nhom on public.danh_muc_bang for all
      using ((bang <> 'bai_lon' and public.co_nhom(array['van_tai'])) or (bang = 'bai_lon' and public.co_nhom(array['kho_bai'])))
      with check ((bang <> 'bai_lon' and public.co_nhom(array['van_tai'])) or (bang = 'bai_lon' and public.co_nhom(array['kho_bai'])));
  end if;
end $$;

-- Nhóm cau_ben xem được tab Lịch sử của phiếu chuyến (nhật ký thay đổi audit_log, bản gốc chỉ cho quản lý trở lên)
do $$
begin
  if to_regclass('public.audit_log') is not null then
    drop policy if exists audit_log_doc_nhom on public.audit_log;
    create policy audit_log_doc_nhom on public.audit_log for select using (public.co_nhom(array['cau_ben']));
  end if;
end $$;

-- 4. Hàm nhập file nhu cầu xe (Thiết bị cơ giới › Kế hoạch ngày): cho phép thêm nhóm van_tai (bản gốc chỉ cho vai trò nhập / quản trị)
create or replace function public.import_demands(p_file text, p_rows jsonb, p_win_a int default 30, p_win_b int default 30)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare v_batch bigint; v_min timestamptz; v_dropped int; v_moved int; v_kept int;
begin
  if not (public.co_vai_tro(array['nhap','quan_tri']) or public.co_nhom(array['van_tai'])) then
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

-- 5. Gán 7 tài khoản (tìm theo PHẦN TÊN trước dấu @, nên đổi đuôi email thế nào cũng được). Tài khoản chưa tạo thì bỏ qua.
--    Quyền xem: vai trò chung 'xem'. Tài khoản đã là quản trị thì KHÔNG bị hạ quyền.
do $$
declare
  r record; n text;
begin
  for r in select * from (values
    ('bgdcty',         'BGD CTY',                       '{}'::text[]),
    ('kehoachvantailog',   'Kế hoạch vận tải LOG',          '{van_tai}'),
    ('kehoachkhobailog',   'Kế hoạch kho bãi LOG',          '{kho_bai}'),
    ('kehoachxuatnhaplog', 'Kế hoạch xuất nhập LOG',        '{xuat_nhap}'),
    ('kehoachcaubenlog',   'Kế hoạch cầu bến LOG',          '{cau_ben}'),
    ('nhaplieulog',        'Nhập liệu LOG',                 '{nhap_lieu}'),
    ('dieudolog',          'Điều độ LOG',                   '{dieu_do}')
  ) as x(ten, ho_ten, nhom) loop
    for n in select u.id::text from auth.users u where lower(split_part(u.email, '@', 1)) = r.ten loop
      insert into public.user_roles (user_id, vai_tro, ho_ten) values (n::uuid, 'xem', r.ho_ten)
        on conflict (user_id) do update set ho_ten = excluded.ho_ten, vai_tro = case when public.user_roles.vai_tro = 'quan_tri' then 'quan_tri' else 'xem' end;
      delete from public.user_module_roles where user_id = n::uuid;            -- không để quyền cũ của phân hệ nâng quyền ghi
      delete from public.user_nhom where user_id = n::uuid;
      insert into public.user_nhom (user_id, nhom) select n::uuid, g from unnest(r.nhom) g;
    end loop;
  end loop;
end $$;

-- Kiểm tra: 7 dòng (tài khoản đã tạo), mỗi dòng ghi rõ nhóm
select u.email, r.vai_tro, coalesce(string_agg(g.nhom, ', ' order by g.nhom), '(chỉ xem)') as nhom
from auth.users u join public.user_roles r on r.user_id = u.id left join public.user_nhom g on g.user_id = u.id
where lower(split_part(u.email, '@', 1)) in ('bgdcty','kehoachvantailog','kehoachkhobailog','kehoachxuatnhaplog','kehoachcaubenlog','nhaplieulog','dieudolog')
group by u.email, r.vai_tro order by u.email;
