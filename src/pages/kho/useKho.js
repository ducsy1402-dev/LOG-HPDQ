import { useMemo } from "react";
import { useApp } from "@/store";
import { useThietBi } from "@/thietbi/Host";
import { tongHopKho, canhBaoKho, choTrongBai, luuLuongKho, khaiBaoBai, khoaTenBai } from "@/lib/kho";

// Tổng hợp kho dùng chung (trang Kho, Phương án làm hàng, chuông cảnh báo, Tổng quan).
// Hàng hóa (tỉ trọng, nhóm) lấy từ danh mục chung của phần Thiết bị cơ giới.
export function useKho() {
  const { D } = useApp();
  const hangHoa = useThietBi()?.D?.hanghoa;
  return useMemo(() => {
    if (!D || D.khoTon == null) return null;
    // Kiểu bãi theo Khai báo kho / bãi (Cố định / Tự do); bãi chưa khai báo giữ kiểu đã lưu ở từng gian / lô
    const kb = khaiBaoBai(D.dmBang);
    const khoBai = kb.size ? D.khoBai.map((r) => { const k = kb.get(khoaTenBai(r.ten_bai))?.kieu; return k ? { ...r, kieu_bai: k } : r; }) : D.khoBai;
    const th = tongHopKho({ khoBai, khoTon: D.khoTon, khoLo: D.khoLo || [], giaoDich: D.giaoDich || [], hangHoa: hangHoa || [], now: D.now });
    const canh = canhBaoKho(th, { voyages: D.voyages, giaoDich: D.giaoDich || [], now: D.now });
    const luuLuong = luuLuongKho(th, { giaoDich: D.giaoDich || [], voyages: D.voyages, now: D.now });
    return { ...th, canh, luuLuong, hangHoa: hangHoa || [], choTrong: (bai) => choTrongBai(th, bai) };
  }, [D, hangHoa]);
}
