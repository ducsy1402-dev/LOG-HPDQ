import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useApp } from "@/store";
import { useThietBi } from "@/thietbi/Host";
import { useKho } from "../kho/useKho";
import { tenKy } from "@/lib/ky";
import BangKeHoach from "./BangKeHoach";

// Mục "Kế hoạch sản xuất" của hộp Đặt mục tiêu sản lượng (anh Sỹ 20/11/2026, trước là tab của Kế hoạch tổng hợp › Kế hoạch dài hạn):
// bảng Tên hàng · Tổng của kỳ đang chọn (Tháng / Quý / Năm), bấm số Tổng để nhập tổng và phân bổ nhập kho; có Dán nhanh, dòng thêm.
// Cùng dữ liệu kh_tong_hop (loại san_xuat, SQL 22): Kế hoạch tổng hợp vẫn dùng số này để dự báo tồn kho.
export default function SanXuatKeHoach({ kyLoai, ky, onPhanBo }) {
  const { api, quyen } = useApp();
  const tb = useThietBi()?.D;
  const kho = useKho();
  const [data, setData] = useState(undefined); // undefined: đang tải · null: chưa chạy SQL 22
  const [lan, setLan] = useState(0);
  const sua = !!(quyen.nhap || quyen.keHoachNgay || quyen.kho?.nhap);
  useEffect(() => {
    let huy = false; setData(undefined);
    api.docKeHoachTH(ky).then((r) => { if (!huy) setData(r); }).catch(() => { if (!huy) setData(null); });
    return () => { huy = true; };
  }, [api, ky, lan]);
  const dsHang = useMemo(() => [...(tb?.hanghoa || [])].sort((a, b) => (a.loai_hh === "roi") - (b.loai_hh === "roi") || String(a.loai_hang).localeCompare(String(b.loai_hang), "vi")).map((h) => h.loai_hang), [tb]);
  if (data === null) return <div className="rounded-md border border-warn/40 bg-warn/5 px-3 py-2 text-sm">Chưa có bảng kế hoạch: quản trị chạy <b>sql/22_ke_hoach_xuat_ban.sql</b> trong Supabase › SQL Editor rồi tải lại web.</div>;
  if (data === undefined) return <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><RefreshCw className="h-4 w-4 animate-spin" />Đang tải kế hoạch sản xuất…</div>;
  return <BangKeHoach loai="san_xuat" ky={ky} nhanKy={tenKy(kyLoai, ky)} data={data} kho={kho} sua={sua} dsHang={dsHang} loaiXe={[]} onLuu={() => setLan((n) => n + 1)} onPhanBo={onPhanBo} />;
}
