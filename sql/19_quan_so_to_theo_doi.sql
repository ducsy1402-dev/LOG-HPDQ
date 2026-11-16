-- 19 · Quân số theo TỔ tách theo ĐỘI (Thiết bị cơ giới › Khai báo › Nhân sự & quân số)
-- Một tổ có xe của nhiều đội (VD tổ PVC: Xúc đào + Xúc lật): quân số nhập riêng từng (đội, tổ). Khóa của headcount_to đổi thành ngày + ca + tổ + đội.
-- Dòng cũ chưa ghi đội (doi trống) được giữ nguyên với doi = '' và web tính cho đội chính của tổ (đội có nhiều xe nhất).
-- Chạy được nhiều lần. Cần SQL 14 đã chạy. Chạy TRƯỚC khi đẩy code lên main (chưa chạy thì hai đội cùng tổ ghi đè số của nhau).

update public.headcount_to set doi = '' where doi is null;
alter table public.headcount_to alter column doi set default '';
alter table public.headcount_to alter column doi set not null;
alter table public.headcount_to drop constraint if exists headcount_to_pkey;
alter table public.headcount_to add primary key (ngay, ca, to_xe, doi);

-- Kiểm tra: cột khóa phải là ngay, ca, to_xe, doi
select a.attname from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
where i.indrelid = 'public.headcount_to'::regclass and i.indisprimary order by a.attnum;
