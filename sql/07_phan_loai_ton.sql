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
