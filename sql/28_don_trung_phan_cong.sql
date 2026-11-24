-- 28 · DỌN XE GÁN BỊ TRÙNG (anh Sỹ báo 24/11/2026: mỗi lần mở Kế hoạch vận tải web lại "Đã gán theo mẫu cố định cho 17 nhu cầu")
-- Nguyên nhân: web chỉ tải xe đã gán của 3 ngày gần nhất, trong khi nhu cầu của ca bắt đầu cách đây hơn 3 ngày (vẫn còn vì ca mới kết thúc trong 3 ngày) bị coi là "chưa gán xe"
-- nên mẫu cố định tự gán lại các xe đó mỗi lần mở trang: bảng assignments có nhiều dòng GIỐNG HỆT nhau. Code web đã sửa (tải 5 ngày, không tự gán ca đã kết thúc);
-- file này xóa các dòng thừa, mỗi cụm dòng giống hệt chỉ giữ dòng id nhỏ nhất. Chỉ xét xe nội bộ (có mã xe); dòng nhà thầu giữ nguyên.
-- Chạy được nhiều lần. Chạy trên Supabase TRƯỚC khi đẩy code (hoặc sau cũng được: không ảnh hưởng gì nếu không có dòng trùng).

-- Xem trước: số dòng thừa sẽ bị xóa
select count(*) as so_dong_thua
from public.assignments a
where a.ma_xe is not null and exists (
  select 1 from public.assignments b
  where b.id < a.id and b.ma_nhu_cau = a.ma_nhu_cau and b.ca_bat_dau = a.ca_bat_dau and b.ma_xe = a.ma_xe
    and b.bat_dau_phut = a.bat_dau_phut and b.ket_thuc_phut = a.ket_thuc_phut and b.ghi_chu is not distinct from a.ghi_chu);

-- Xóa dòng thừa
delete from public.assignments a
where a.ma_xe is not null and exists (
  select 1 from public.assignments b
  where b.id < a.id and b.ma_nhu_cau = a.ma_nhu_cau and b.ca_bat_dau = a.ca_bat_dau and b.ma_xe = a.ma_xe
    and b.bat_dau_phut = a.bat_dau_phut and b.ket_thuc_phut = a.ket_thuc_phut and b.ghi_chu is not distinct from a.ghi_chu);

-- Kiểm tra: phải ra 0 dòng
select ma_nhu_cau, ca_bat_dau, ma_xe, count(*) as so_dong
from public.assignments where ma_xe is not null
group by ma_nhu_cau, ca_bat_dau, ma_xe, bat_dau_phut, ket_thuc_phut, ghi_chu
having count(*) > 1;
