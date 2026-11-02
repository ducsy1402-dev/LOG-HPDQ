-- 03. Bố trí tuyến bến (mét từng bến, góc vuông, thứ tự hiển thị) và băng tải của bến. Chạy SAU 02_nap_danh_muc.sql. Chạy được nhiều lần.

-- Bố trí theo sơ đồ cầu bến: 1A, 1, 2 song song (mỗi bến một tuyến 0–140 m); mặt tây 3 – 5 – 10; mặt đông 4 – 6 – 11 (đầu mét 0 của bến 4
-- góc vuông với tuyến bến 7); tuyến 7 – 8 – 9 (đầu tây bến 7 góc vuông với mặt đông); HH2 – HH3; 6CTH – 7CTH.
update public.berths b set tuyen = x.tuyen, met_tu = x.tu, met_den = x.den, goc_vuong = x.goc, thu_tu = x.tt
from (values
  ('1A', '1A', 0, 140, null, 1), ('1', '1', 0, 140, null, 2), ('2', '2', 0, 140, null, 3),
  ('3', '3-5-10', 0, 200, null, 4), ('5', '3-5-10', 200, 500, null, 5), ('10', '3-5-10', 500, 910, null, 6),
  ('4', '4-6-11', 0, 200, 'dau', 7), ('6', '4-6-11', 200, 500, null, 8), ('11', '4-6-11', 500, 910, null, 9),
  ('7', '7-8-9', 0, 180, 'dau', 10), ('8', '7-8-9', 180, 306.5, null, 11), ('9', '7-8-9', 306.5, 433, null, 12),
  ('HH2', 'HH2-HH3', 0, 242, null, 13), ('HH3', 'HH2-HH3', 242, 432, null, 14),
  ('6CTH', '6CTH-7CTH', 0, 250, null, 15), ('7CTH', '6CTH-7CTH', 250, 500, null, 16)
) as x(ma, tuyen, tu, den, goc, tt)
where b.ma = x.ma;

-- Băng tải làm hàng của bến: gộp từ băng tải của các cẩu phục vụ bến (chỉ điền bến còn trống)
update public.berths b
   set bang_tai = s.ds
  from (select bp.ben, string_agg(distinct trim(t), ', ' order by trim(t)) ds
          from public.vehicles v
          cross join lateral unnest(v.ben_phuc_vu) bp(ben)
          cross join lateral unnest(string_to_array(v.bang_tai, ',')) t
         where v.bang_tai is not null and trim(t) <> ''
         group by bp.ben) s
 where s.ben = b.ma and (b.bang_tai is null or b.bang_tai = '');
