-- 24. ĐỔI TÊN ĐĂNG NHẬP quantrilog -> bgdcty và HỌ TÊN thành "BGD CTY" (Ban giám đốc công ty), GIỮ NGUYÊN chức năng.
-- Tài khoản và quyền gắn theo mã người dùng (user_id), không gắn theo email, nên chỉ cần đổi email trong Authentication:
-- vai trò chung 'xem' (user_roles), nhóm quyền (user_nhom: không nhóm nào = chỉ xem), mật khẩu và lịch sử đều giữ nguyên.
-- Đăng nhập trên web vẫn chỉ gõ TÊN: bgdcty (web tự thêm đuôi @hpdq.test). Mật khẩu KHÔNG đổi.
-- Cách chạy: Supabase › SQL Editor › dán toàn bộ file này › Run. Chạy được nhiều lần (đã đổi rồi thì chỉ cập nhật lại họ tên).
-- Nếu đã có sẵn tài khoản tên bgdcty thì KHÔNG đổi email của ai, chỉ cập nhật họ tên của tài khoản bgdcty.
do $$
declare
  cu record;
begin
  if exists (select 1 from auth.users where lower(split_part(email, '@', 1)) = 'bgdcty') then
    raise notice 'Đã có tài khoản bgdcty: không đổi email, chỉ cập nhật họ tên.';
  else
    for cu in select id, email from auth.users where lower(split_part(email, '@', 1)) = 'quantrilog' loop
      update auth.users set email = 'bgdcty@' || split_part(cu.email, '@', 2), updated_at = now() where id = cu.id;
      update auth.identities
         set identity_data = jsonb_set(identity_data, '{email}', to_jsonb('bgdcty@' || split_part(cu.email, '@', 2))),
             provider_id = case when lower(provider_id) = lower(cu.email) then 'bgdcty@' || split_part(cu.email, '@', 2) else provider_id end,
             updated_at = now()
       where user_id = cu.id and provider = 'email';
      raise notice 'Đã đổi % -> bgdcty@%', cu.email, split_part(cu.email, '@', 2);
    end loop;
  end if;
  -- Họ tên hiển thị (cột ho_ten của user_roles)
  update public.user_roles set ho_ten = 'BGD CTY'
   where user_id in (select id from auth.users where lower(split_part(email, '@', 1)) = 'bgdcty');
end $$;

-- Kiểm tra: phải thấy bgdcty, vai trò xem, họ tên BGD CTY, nhóm (chỉ xem); không còn quantrilog
select u.email, r.vai_tro, r.ho_ten, coalesce(string_agg(g.nhom, ', ' order by g.nhom), '(chỉ xem)') as nhom
from auth.users u left join public.user_roles r on r.user_id = u.id left join public.user_nhom g on g.user_id = u.id
where lower(split_part(u.email, '@', 1)) in ('bgdcty', 'quantrilog')
group by u.email, r.vai_tro, r.ho_ten;
