import { useMemo } from "react";
import { useApp } from "@/store";
import { useThietBi } from "@/thietbi/Host";
import { tongHopKho, canhBaoKho, choTrongBai, luuLuongKho } from "@/lib/kho";

// Tổng hợp kho dùng chung (trang Kho, Phương án làm hàng, chuông cảnh báo, Tổng quan).
// Hàng hóa (tỉ trọng, nhóm) lấy từ danh mục chung của phần Thiết bị cơ giới.
export function useKho() {
  const { D } = useApp();
  const hangHoa = useThietBi()?.D?.hanghoa;
  return useMemo(() => {
    if (!D || D.khoTon == null) return null;
    const th = tongHopKho({ khoBai: D.khoBai, khoTon: D.khoTon, khoLo: D.khoLo || [], giaoDich: D.giaoDich || [], hangHoa: hangHoa || [], now: D.now });
    const canh = canhBaoKho(th, { voyages: D.voyages, giaoDich: D.giaoDich || [], now: D.now });
    const luuLuong = luuLuongKho(th, { giaoDich: D.giaoDich || [], voyages: D.voyages, now: D.now });
    return { ...th, canh, luuLuong, hangHoa: hangHoa || [], choTrong: (bai) => choTrongBai(th, bai) };
  }, [D, hangHoa]);
}
