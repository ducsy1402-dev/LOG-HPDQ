-- 11. Mục tiêu / sản lượng vận tải: đơn vị thực hiện chọn từng nhà thầu trong Danh mục › Nhà thầu (giá trị 'hoa_phat' hoặc 'nt:<tên nhà thầu>').
-- Bỏ giới hạn cột don_vi chỉ nhận 'hoa_phat' / 'nha_thau' ở SQL 06. Số liệu cũ ghi 'nha_thau' vẫn giữ, web hiện là "Nhà thầu (chung)". Chạy SAU 06. Chạy được nhiều lần.
do $$
declare r record;
begin
  for r in
    select c.conrelid::regclass as bang, c.conname
      from pg_constraint c
     where c.contype = 'c'
       and c.conrelid in ('public.muc_tieu_van_tai'::regclass, 'public.san_luong_van_tai'::regclass)
       and pg_get_constraintdef(c.oid) ilike '%don_vi%'
  loop
    execute format('alter table %s drop constraint %I', r.bang, r.conname);
  end loop;
end $$;
