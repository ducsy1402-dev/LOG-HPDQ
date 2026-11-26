-- 29. QUY TẮC TỒN KHO: TỒN ĐẦU KỲ LẤY SỐ KHAI CỦA NGÀY KHAI MỚI NHẤT, KHÔNG CỘNG DỒN (anh Sỹ 26/11/2026; cả kho hàng kiện và kho hàng rời).
-- Với mỗi (bãi, bãi nhỏ / gian / lô, hàng):
--   • tồn đầu kỳ = số khai (do_thuc_te) của lượt "Tồn đầu kỳ" có NGÀY MỚI NHẤT (cùng ngày thì lượt ghi sau cùng, mã lớn nhất); các lần khai trước bị thay, không cộng dồn;
--   • từ ngày khai đó trở đi, nhập / xuất / điều chuyển / kiểm kê cộng trừ như bình thường (cùng ngày với ngày khai coi như xảy ra sau tồn đầu);
--   • mọi lượt ghi ngày TRƯỚC ngày khai mới nhất bị bỏ qua (kể cả lượt nhập / xuất ghi bổ sung SAU khi khai mà mang ngày cũ — đây là nguyên nhân tồn Kho nóng HRC1 / HRC2 lệch so với số khai).
--   • gian / lô chưa có lần khai kiểu đặt lại (do_thuc_te trống) thì cộng dồn toàn bộ sổ như trước.
-- Chỉ đổi cách TÍNH view kho_ton (cùng các cột như SQL 12); không sửa, không xóa dòng nào của kho_giao_dich. Chạy được nhiều lần. Chạy SAU 12 (và 26 nếu có lượt tồn đầu cũ).
-- Lưu ý: lượt cũ không ghi bãi nhỏ (ten_khu trống) được coi là một gian / lô riêng khi so với ngày khai (chỉ có ở sổ ghi trước SQL 12).
-- XEM TRƯỚC (chạy riêng, không đổi dữ liệu): tồn hiện tại và tồn theo quy tắc mới của các gian / lô có khai tồn đầu — xem sau khi chạy, so với số khai ở Lịch sử sổ kho.

create or replace view public.kho_ton with (security_invoker = true) as
with gd as (
  select id, ngay, loai, do_thuc_te, ten_bai, hang, coalesce(so_lo, '') as so_lo, coalesce(ten_khu, '') as ten_khu,
         case when loai in ('xuat', 'dieu_chuyen') then -so_luong else so_luong end as sl, false as la_dich
  from public.kho_giao_dich
  union all
  select id, ngay, loai, null::numeric, den_bai, hang, coalesce(so_lo, ''), coalesce(den_khu, ''), so_luong, true
  from public.kho_giao_dich where loai = 'dieu_chuyen' and den_bai is not null
),
moc as ( -- lần khai tồn đầu kỳ (kiểu đặt lại) mới nhất của từng (bãi, bãi nhỏ, hàng)
  select distinct on (ten_bai, ten_khu, hang) ten_bai, ten_khu, hang, ngay as ngay_khai, id as id_khai, do_thuc_te as so_khai
  from gd
  where loai = 'dau_ky' and do_thuc_te is not null and not la_dich
  order by ten_bai, ten_khu, hang, ngay desc, id desc
)
select g.ten_bai, g.hang, g.so_lo,
       sum(case
             when m.id_khai is null then g.sl                                              -- chưa khai kiểu đặt lại: cộng dồn sổ
             when g.loai = 'dau_ky' and g.do_thuc_te is not null and not g.la_dich
               then case when g.id = m.id_khai then g.do_thuc_te else 0 end               -- chỉ lần khai mới nhất, đặt đúng số khai
             when g.ngay >= m.ngay_khai then g.sl                                          -- từ ngày khai trở đi: cộng trừ bình thường
             else 0                                                                        -- ghi ngày trước ngày khai: bỏ qua
           end) as ton,
       min(g.ngay) as ngay_dau, max(g.ngay) as ngay_cuoi, g.ten_khu
from gd g
left join moc m on m.ten_bai = g.ten_bai and m.ten_khu = g.ten_khu and m.hang = g.hang
group by g.ten_bai, g.hang, g.so_lo, g.ten_khu;
grant select on public.kho_ton to authenticated;
