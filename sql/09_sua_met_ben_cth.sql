-- 09. Sửa số mét hai bến Cảng Tổng hợp: 7CTH từ mét 0–250, 6CTH từ mét 250–490 (trước đó đặt ngược). Chạy được nhiều lần.
update public.berths set met_tu = 0,   met_den = 250 where ma = '7CTH';
update public.berths set met_tu = 250, met_den = 490 where ma = '6CTH';
