-- 26. TỒN ĐẦU KỲ KHÔNG CỘNG DỒN CHO CÁC LƯỢT CŨ (anh Sỹ 21/11/2026).
-- Từ 17/11/2026 web ghi "Tồn đầu kỳ" theo kiểu ĐẶT LẠI: lượt dau_ky có do_thuc_te = số khai báo, so_sach = tồn sổ ngay trước ngày đó, so_luong = số khai − tồn sổ trước (có thể âm),
-- nên cộng tất cả các lượt thì tồn đúng bằng số khai báo gần nhất. Các lượt tồn đầu GHI TRƯỚC 17/11 (do_thuc_te trống) vẫn là số CỘNG THÊM, nên khai tồn đầu nhiều lần (hoặc nhập lại file) bị cộng dồn.
-- File này đổi các lượt cũ đó sang kiểu đặt lại, theo thứ tự ngày (rồi mã lượt), cho từng (bãi, bãi nhỏ, hàng):
--     so_sach    = tồn sổ của (bãi, bãi nhỏ, hàng) ngay TRƯỚC lượt này (các lượt ngày sớm hơn, và lượt tồn đầu cùng ngày có mã nhỏ hơn; nhập / xuất cùng ngày coi như sau tồn đầu)
--     do_thuc_te = số đã khai (= so_luong cũ)
--     so_luong   = số đã khai − so_sach
-- Sau đó lần khai tồn đầu sau cùng thay hẳn các lần trước, không còn cộng dồn. Chạy được nhiều lần (chỉ đổi các lượt còn do_thuc_te trống). Chạy SAU 12.
-- AN TOÀN: các lượt sắp đổi được chép sang bảng kho_giao_dich_sao_luu_26 trước khi sửa (chỉ quản trị đọc được); việc sửa cũng nằm trong nhật ký kiểm toán.
-- XEM TRƯỚC (chạy riêng, không đổi dữ liệu): các (bãi, bãi nhỏ, hàng) đang có từ 2 lượt tồn đầu cũ, tức đang bị cộng dồn:
--   select ten_bai, coalesce(ten_khu, '') as ten_khu, hang, count(*) as so_luot, sum(so_luong) as dang_cong_don,
--          (array_agg(so_luong order by ngay desc, id desc))[1] as lan_khai_cuoi
--   from public.kho_giao_dich where loai = 'dau_ky' and do_thuc_te is null group by 1, 2, 3 having count(*) > 1 order by 1, 2, 3;

create table if not exists public.kho_giao_dich_sao_luu_26 as
  select * from public.kho_giao_dich where loai = 'dau_ky' and do_thuc_te is null;
alter table public.kho_giao_dich_sao_luu_26 enable row level security; -- không có chính sách: chỉ quản trị (qua SQL Editor) xem được

do $$
declare
  r record;
  truoc numeric;
  dem int := 0;
begin
  for r in select * from public.kho_giao_dich where loai = 'dau_ky' and do_thuc_te is null order by ngay, id loop
    select coalesce(sum(x.sl), 0) into truoc from (
      -- lượt nhập / xuất / điều chuyển đi / kiểm kê / tồn đầu (đã đổi) của đúng (bãi, bãi nhỏ, hàng), ngày sớm hơn; tồn đầu cùng ngày mã nhỏ hơn
      select case when g.loai in ('xuat', 'dieu_chuyen') then -g.so_luong else g.so_luong end as sl
        from public.kho_giao_dich g
       where g.ten_bai = r.ten_bai and coalesce(g.ten_khu, '') = coalesce(r.ten_khu, '') and g.hang = r.hang
         and (g.ngay < r.ngay or (g.ngay = r.ngay and g.loai = 'dau_ky' and g.id < r.id))
      union all
      -- điều chuyển ĐẾN gian / lô này
      select g.so_luong
        from public.kho_giao_dich g
       where g.loai = 'dieu_chuyen' and g.den_bai = r.ten_bai and coalesce(g.den_khu, '') = coalesce(r.ten_khu, '') and g.hang = r.hang
         and g.ngay < r.ngay
    ) x;
    update public.kho_giao_dich
       set do_thuc_te = r.so_luong, so_sach = truoc, so_luong = r.so_luong - truoc
     where id = r.id;
    dem := dem + 1;
  end loop;
  raise notice 'Đã đổi % lượt tồn đầu cũ sang kiểu đặt lại (không cộng dồn)', dem;
end $$;
