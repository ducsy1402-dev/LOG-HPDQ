-- 12. (a) BÃI NHỎ trong sổ nhập – xuất kho; (b) KẾ HOẠCH kho theo NGÀY / TUẦN / THÁNG / NĂM. Chạy SAU 01…11. Chạy được nhiều lần.
--
-- (a) Hộp Nhập liệu có thêm ô Bãi nhỏ (gian / lô trong bãi lớn): lượt nhập / xuất ghi rõ bãi nhỏ nào, tồn từng bãi nhỏ tính đúng
--     (trước đây mọi hàng của bãi lớn có nhiều khu tự do đều dồn vào khu đầu tiên). Điều chuyển có thêm bãi nhỏ đến.
--     Lượt cũ không có bãi nhỏ (ten_khu trống) vẫn xếp theo hàng như trước.
alter table public.kho_giao_dich add column if not exists ten_khu text;   -- bãi nhỏ (điều chuyển: bãi nhỏ đi)
alter table public.kho_giao_dich add column if not exists den_khu text;   -- điều chuyển: bãi nhỏ đến

-- Tồn hiện tại theo bãi – bãi nhỏ – hàng – lô (cột ten_khu thêm vào CUỐI view để giữ nguyên các cột cũ)
create or replace view public.kho_ton with (security_invoker = true) as
with gd as (
  select ten_bai, hang, coalesce(so_lo, '') as so_lo, ngay,
         case when loai in ('xuat','dieu_chuyen') then -so_luong else so_luong end as sl,
         coalesce(ten_khu, '') as ten_khu
  from public.kho_giao_dich
  union all
  select den_bai, hang, coalesce(so_lo, ''), ngay, so_luong, coalesce(den_khu, '')
  from public.kho_giao_dich where loai = 'dieu_chuyen' and den_bai is not null
)
select ten_bai, hang, so_lo, sum(sl) as ton, min(ngay) as ngay_dau, max(ngay) as ngay_cuoi, ten_khu
from gd group by ten_bai, hang, so_lo, ten_khu;
grant select on public.kho_ton to authenticated;

-- (b) Kế hoạch theo kỳ: loai_ky = ngay | tuan | thang | nam; ky = yyyy-mm-dd (ngày; tuần: ngày thứ Hai đầu tuần) | yyyy-mm | yyyy.
--     Cột thang giữ làm tháng của ngày đầu kỳ (dòng cũ: ky = thang, loai_ky = 'thang').
alter table public.kho_ke_hoach add column if not exists loai_ky text not null default 'thang';
alter table public.kho_ke_hoach add column if not exists ky text;
update public.kho_ke_hoach set ky = thang where ky is null;
alter table public.kho_ke_hoach drop constraint if exists kho_ke_hoach_loai_ky_check;
alter table public.kho_ke_hoach add constraint kho_ke_hoach_loai_ky_check check (loai_ky in ('ngay', 'tuan', 'thang', 'nam'));
create index if not exists kho_ke_hoach_ky_idx on public.kho_ke_hoach (loai_ky, ky);
