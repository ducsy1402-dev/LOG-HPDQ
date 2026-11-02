import { useMemo } from "react";
import { useThietBi } from "@/thietbi/Host";
import { taoNhomHang } from "@/lib/sanLuong";

// Hàm tra nhóm hàng (Danh mục › Hàng hóa, cột Nhóm) cho thống kê khối lượng theo nhóm hàng
export function useNhomHang() {
  const hh = useThietBi()?.D?.hanghoa;
  return useMemo(() => taoNhomHang(hh || []), [hh]);
}
