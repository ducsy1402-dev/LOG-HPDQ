-- 15 · Việc bãi có mốc GIỜ chính xác (Thiết bị cơ giới › Kế hoạch dài hạn › Linetime năng lực đáp ứng)
-- Trước đây việc bãi nhập tay chỉ có "từ ngày / đến ngày". Nút +bãi trên thanh tàu nay lấy đúng giờ tàu ở bến (cập → rời),
-- nên thêm hai cột giờ chính xác. Chưa chạy file này thì web vẫn chạy: việc bãi chỉ lưu theo ngày như cũ.
-- Chạy được nhiều lần. Chạy TRƯỚC khi đẩy code lên main.
alter table public.plan_jobs add column if not exists tu  timestamptz;  -- việc bãi: bắt đầu (giờ chính xác)
alter table public.plan_jobs add column if not exists den timestamptz;  -- việc bãi: kết thúc (giờ chính xác)

-- Kiểm tra: phải thấy 2 dòng tu, den
select column_name from information_schema.columns where table_schema = 'public' and table_name = 'plan_jobs' and column_name in ('tu', 'den');
