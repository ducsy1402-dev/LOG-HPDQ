import { useEffect, useState } from "react";
import { useApp } from "@/store";
import { khoaKy } from "@/lib/ky";

// Tải mục tiêu + sản lượng thực tế cho Tổng quan (dùng ở TongQuanMoi)
// Mục tiêu + sản lượng thực tế của các tháng trong kỳ; null = chưa chạy SQL 06
export function useSanLuongKy(nhom, thangs, kyKhoa, tat = false) {
  const { api, D } = useApp();
  const [kq, setKq] = useState(undefined);
  const khoa = thangs.join(",");
  useEffect(() => {
    if (tat) return undefined;
    let huy = false;
    // Quý / năm có mục tiêu riêng (SQL 10) thì dùng; chưa chạy SQL 10 hoặc chưa nhập thì cộng các tháng như trước
    Promise.all([Promise.all(khoa.split(",").map((t) => api.docSanLuongThang(nhom, t))), kyKhoa ? api.docMucTieuKy(nhom, kyKhoa).catch(() => null) : null])
      .then(([rs, rieng]) => { if (!huy) setKq(rs.some((r) => !r) ? null : { mucTieuKy: rieng || [], mucTieu: rs.flatMap((r, i) => r.mucTieu.map((x) => ({ ...x, thang: x.thang || khoa.split(",")[i] }))), thucTe: rs.flatMap((r) => r.thucTe) }); })
      .catch(() => { if (!huy) setKq(null); });
    return () => { huy = true; };
  }, [api, nhom, khoa, kyKhoa, D, tat]); // D đổi (có người sửa) thì tải lại
  return kq;
}

// Khóa kỳ có mục tiêu riêng (SQL 10): quý "2026-Q4", năm "2026"; tuần / tháng không có
export const khoaKyRieng = (kyInfo) => (kyInfo.ky === "quy" ? khoaKy("quy", new Date(kyInfo.ngays[0] + "T00:00:00").getTime()) : kyInfo.ky === "nam" ? kyInfo.ngays[0].slice(0, 4) : null);
