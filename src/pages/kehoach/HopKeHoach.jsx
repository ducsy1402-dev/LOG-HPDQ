import { Dialog } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ChonKy } from "./ChonKy";
import BangKeHoach from "./BangKeHoach";
import NgayBo from "./NgayBo";
import HopKeHoachNgay from "../cang/HopKeHoachNgay";
import HopTauNgay from "./HopTauNgay";

// Hộp "Kế hoạch dài hạn": kế hoạch xuất bán và nhập mua, lập theo Tháng / Quý / Năm (kế hoạch sản xuất chuyển sang Mục tiêu sản lượng › Đặt mục tiêu, 20/11/2026).
export function HopDaiHan({ onClose, k, data, ...chung }) {
  const bang = (loai) => <BangKeHoach loai={loai} ky={k.khoa} nhanKy={k.nhan} data={data} {...chung} />;
  return (
    <Dialog onOpenChange={(o) => !o && onClose()} className="max-w-3xl" title="Kế hoạch dài hạn"
      description="Kế hoạch xuất bán và nhập mua (kế hoạch sản xuất nằm ở Mục tiêu sản lượng › Đặt mục tiêu). Từ đó ra kế hoạch xuất / nhập / tồn kho và kế hoạch vận tải.">
      <div className="mb-3 flex flex-wrap items-center gap-2"><ChonKy k={k} /><span className="text-xs text-muted-foreground">Lập kế hoạch theo Tháng / Quý / Năm (tấn)</span></div>
      <Tabs defaultValue="xuat-ban">
        <TabsList>
          <TabsTrigger value="xuat-ban">Kế hoạch xuất bán</TabsTrigger>
          <TabsTrigger value="nhap-mua">Kế hoạch nhập mua</TabsTrigger>
        </TabsList>
        <TabsContent value="xuat-ban">{bang("xuat_ban")}</TabsContent>
        <TabsContent value="nhap-mua">{bang("nhap_mua")}</TabsContent>
      </Tabs>
      <div className="min-h-[200px]" />
    </Dialog>
  );
}

// Hộp "Kế hoạch ngày": kế hoạch xuất / nhập theo ngày, tách đường bộ và đường biển.
//   • Đường bộ: bảng theo ngày (Tên hàng · Hướng · Vào / ra kho bãi › gian / lô · Khối lượng), gian / lô chọn theo hàng đang chứa (NgayBo.jsx).
//   • Đường biển: giao diện Kế hoạch ngày của Mục tiêu sản lượng (line tàu + khung nhập theo ngày; HopKeHoachNgay nhúng); trỏ vào một dòng tàu có mũi tên mở hộp phân xe + xuất / nhập kho (HopTauNgay.jsx).
export function HopNgay({ onClose, kho, sua, dsHang, loaiXe }) {
  return (
    <Dialog onOpenChange={(o) => !o && onClose()} className="max-w-[min(1500px,calc(100vw-24px))]" title="Kế hoạch ngày" description="Kế hoạch xuất / nhập theo ngày, tách đường bộ và đường biển.">
      <Tabs defaultValue="bo">
        <TabsList>
          <TabsTrigger value="bo">Xuất / nhập đường bộ</TabsTrigger>
          <TabsTrigger value="bien">Xuất / nhập đường biển</TabsTrigger>
        </TabsList>
        <TabsContent value="bo"><NgayBo kho={kho} sua={sua} dsHang={dsHang} /></TabsContent>
        <TabsContent value="bien">
          <HopKeHoachNgay nhung onClose={() => {}}
            tiepTheo={({ v, ngay, neo, tong, onDong }) => <HopTauNgay key={`${v.id}|${ngay}`} neo={neo} onDong={onDong} v={v} ngay={ngay} tong={tong} kho={kho} loaiXe={loaiXe} sua={sua} />} />
        </TabsContent>
      </Tabs>
    </Dialog>
  );
}
