-- 20 · Đơn vị của gian / lô kho (Danh mục › Kho hàng kiện / Kho hàng rời): Tấn (mặc định) | Kiện (hàng kiện) | Khối (hàng rời)
-- Mọi số lượng của gian / lô đó (sức chứa, nhập, xuất, điều chuyển, kế hoạch, tồn) tính theo đơn vị này, không quy đổi.
-- Trống = Tấn. Chạy được nhiều lần. Chạy TRƯỚC khi đẩy code lên main (chưa chạy thì cột Đơn vị không lưu được).

alter table public.kho_bai add column if not exists don_vi text;
alter table public.kho_bai drop constraint if exists kho_bai_don_vi_check;
alter table public.kho_bai add constraint kho_bai_don_vi_check check (don_vi is null or don_vi in ('Tấn', 'Kiện', 'Khối'));

select column_name from information_schema.columns where table_schema = 'public' and table_name = 'kho_bai' and column_name = 'don_vi';
