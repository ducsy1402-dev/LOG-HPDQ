import { Construction } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ChonKy } from "./ChonKy";
import BangKeHoach from "./BangKeHoach";

const SapThietKe = ({ ten, y }) => (
  <div className="flex flex-col items-center gap-2 rounded-md border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">
    <Construction className="h-6 w-6" />
    <div className="font-medium text-foreground">{ten}</div>
    <div className="max-w-md text-xs">{y}</div>
  </div>
);

// Hộp "Kế hoạch dài hạn": ba bản kế hoạch chính, theo thứ tự xuất bán → sản xuất → nhập mua; lập theo Tháng / Quý / Năm.
export function HopDaiHan({ onClose, k, data, ...chung }) {
  const bang = (loai) => <BangKeHoach loai={loai} ky={k.khoa} nhanKy={k.nhan} data={data} {...chung} />;
  return (
    <Dialog onOpenChange={(o) => !o && onClose()} className="max-w-3xl" title="Kế hoạch dài hạn"
      description="Ba bản kế hoạch chính: xuất bán → sản xuất → nhập mua. Từ đó ra kế hoạch xuất / nhập / tồn kho và kế hoạch vận tải.">
      <div className="mb-3 flex flex-wrap items-center gap-2"><ChonKy k={k} /><span className="text-xs text-muted-foreground">Lập kế hoạch theo Tháng / Quý / Năm (tấn)</span></div>
      <Tabs defaultValue="xuat-ban">
        <TabsList>
          <TabsTrigger value="xuat-ban">Kế hoạch xuất bán</TabsTrigger>
          <TabsTrigger value="san-xuat">Kế hoạch sản xuất</TabsTrigger>
          <TabsTrigger value="nhap-mua">Kế hoạch nhập mua</TabsTrigger>
        </TabsList>
        <TabsContent value="xuat-ban">{bang("xuat_ban")}</TabsContent>
        <TabsContent value="san-xuat">{bang("san_xuat")}</TabsContent>
        <TabsContent value="nhap-mua">{bang("nhap_mua")}</TabsContent>
      </Tabs>
      <div className="min-h-[200px]" />
    </Dialog>
  );
}

// Hộp "Kế hoạch ngày": kế hoạch xuất / nhập theo ngày, tách đường bộ và đường biển. Thiết kế sau.
export function HopNgay({ onClose }) {
  return (
    <Dialog onOpenChange={(o) => !o && onClose()} className="max-w-3xl" title="Kế hoạch ngày" description="Kế hoạch xuất / nhập theo ngày, lấy từ kế hoạch dài hạn.">
      <Tabs defaultValue="bo">
        <TabsList>
          <TabsTrigger value="bo">Xuất / nhập đường bộ</TabsTrigger>
          <TabsTrigger value="bien">Xuất / nhập đường biển</TabsTrigger>
        </TabsList>
        <TabsContent value="bo"><SapThietKe ten="Xuất / nhập đường bộ" y="Sẽ thiết kế sau: kế hoạch ngày của xe vào / ra theo kế hoạch dài hạn." /></TabsContent>
        <TabsContent value="bien"><SapThietKe ten="Xuất / nhập đường biển" y="Sẽ thiết kế sau: kế hoạch ngày theo tàu (liên kết với Linetime tàu cập bến)." /></TabsContent>
      </Tabs>
    </Dialog>
  );
}
