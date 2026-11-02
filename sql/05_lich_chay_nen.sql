-- 05. (Tùy chọn) Việc nền chạy theo lịch trên Supabase (pg_cron), không cần ai mở web.
--     Hiện có 1 việc: dọn kế hoạch ngắn hạn cũ (nhu cầu đã kết thúc quá 3 ngày và xe đã gán của các ca cũ hơn 4 ngày),
--     chạy mỗi ngày 03:00 giờ Việt Nam. Trước đây việc này chỉ chạy khi có người nhập liệu mở trang Ngắn hạn.
--     Kết quả mỗi lần chạy ghi vào bảng viec_nen_log; web đọc để hiện "lần chạy cuối".
--
--     LƯU Ý: pg_cron phải được bật. Nếu dòng "create extension" báo lỗi, vào Supabase › Database › Extensions,
--     tìm "pg_cron" và bật, rồi chạy lại file này. Chạy được nhiều lần.

create extension if not exists pg_cron with schema pg_catalog;

-- ---------- Nhật ký chạy nền ----------
create table if not exists public.viec_nen_log (
  id       bigint generated always as identity primary key,
  viec     text not null,                       -- tên việc: don_nhu_cau…
  chay_luc timestamptz not null default now(),
  ket_qua  jsonb,
  loi      text
);
create index if not exists viec_nen_log_idx on public.viec_nen_log (viec, chay_luc desc);

alter table public.viec_nen_log enable row level security;
drop policy if exists viec_nen_log_doc on public.viec_nen_log;
-- Mọi người đăng nhập web (có vai trò) xem được; không ai ghi trực tiếp, chỉ hàm bên dưới ghi
create policy viec_nen_log_doc on public.viec_nen_log for select using (public.co_vai_tro(array['xem','nhap','quan_tri']));

-- ---------- Việc 1: dọn kế hoạch ngắn hạn cũ ----------
-- Giống hệt việc web từng làm khi mở trang Ngắn hạn: nhu cầu có giờ kết thúc trước (hôm nay − p_ngay) bị xóa;
-- xe đã gán của các ca bắt đầu trước (hôm nay − p_ngay − 1 ngày) bị xóa. Lỗi thì ghi vào nhật ký, không làm hỏng lịch chạy.
create or replace function public.viec_nen_don_nhu_cau(p_ngay int default 3) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_moc timestamptz := now() - make_interval(days => p_ngay);
  v_gan int; v_nc int; v_kq jsonb;
begin
  delete from public.assignments where ca_bat_dau < v_moc - interval '1 day';
  get diagnostics v_gan = row_count;
  delete from public.demands where tg_ket_thuc < v_moc;
  get diagnostics v_nc = row_count;
  v_kq := jsonb_build_object('nhu_cau_da_xoa', v_nc, 'phan_cong_da_xoa', v_gan);
  insert into public.viec_nen_log (viec, ket_qua) values ('don_nhu_cau', v_kq);
  delete from public.viec_nen_log where chay_luc < now() - interval '60 days';
  return v_kq;
exception when others then
  insert into public.viec_nen_log (viec, loi) values ('don_nhu_cau', sqlerrm);
  return jsonb_build_object('loi', sqlerrm);
end $$;

-- Chỉ lịch chạy nền (tài khoản postgres) gọi được; người dùng web và khách không gọi trực tiếp
revoke all on function public.viec_nen_don_nhu_cau(int) from public, anon, authenticated;

-- ---------- Lịch chạy ----------
-- pg_cron tính theo giờ UTC: 20:00 UTC = 03:00 giờ Việt Nam. Đặt lại lịch nếu đã có.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'hpdq-don-nhu-cau') then
    perform cron.unschedule('hpdq-don-nhu-cau');
  end if;
  perform cron.schedule('hpdq-don-nhu-cau', '0 20 * * *', 'select public.viec_nen_don_nhu_cau()');
end $$;

-- Kiểm tra sau khi chạy file này:
--   select jobname, schedule, active from cron.job;                       -- phải thấy hpdq-don-nhu-cau
--   select * from public.viec_nen_log order by chay_luc desc limit 5;     -- có dòng sau lần chạy đầu tiên (03:00 sáng hôm sau)
--   Chạy thử ngay (SQL Editor, quyền postgres):  select public.viec_nen_don_nhu_cau();
