import { ChevronLeft, ChevronRight, Construction } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { congThang, tenThang } from "@/lib/format";
import TabXuatBan from "./TabXuatBan";

// Chọn tháng (◀ ▶ + danh sách) dùng chung trong các hộp
export function ChonThang({ thang, setThang, homNay }) {
  const ds = Array.from({ length: 13 }, (_, i) => congThang(homNay, i - 6));
  return (
    <div className="flex items-center gap-1.5">
      <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setThang(congThang(thang, -1))} aria-label="Tháng trước"><ChevronLeft /></Button>
      <NativeSelect className="h-8 w-52" value={thang} onChange={(e) => setThang(e.target.value)} options={(ds.includes(thang) ? ds : [...ds, thang].sort()).map((x) => [x, tenThang(x) + (x === homNay ? " (này)" : "")])} aria-label="Tháng" />
      <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setThang(congThang(thang, 1))} aria-label="Tháng sau"><ChevronRight /></Button>
    </div>
  );
}

const SapThietKe = ({ ten, y }) => (
  <div className="flex flex-col items-center gap-2 rounded-md border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">
    <Construction className="h-6 w-6" />
    <div className="font-medium text-foreground">{ten}</div>
    <div className="max-w-md text-xs">{y}</div>
  </div>
);

// Hộp "Kế hoạch dài hạn": ba bản kế hoạch chính, theo thứ tự xuất bán → sản xuất → nhập mua. Hiện làm xong tab Kế hoạch xuất bán; hai tab còn lại thiết kế sau.
export function HopDaiHan({ onClose, thang, setThang, homNay, ...tab }) {
  return (
    <Dialog onOpenChange={(o) => !o && onClose()} className="max-w-3xl" title="Kế hoạch dài hạn"
      description="Ba bản kế hoạch chính: xuất bán → sản xuất → nhập mua. Từ đó ra kế hoạch xuất / nhập / tồn kho và kế hoạch vận tải.">
      <div className="mb-3 flex flex-wrap items-center gap-2"><ChonThang thang={thang} setThang={setThang} homNay={homNay} /><span className="text-xs text-muted-foreground">Kế hoạch lập theo tháng (tấn)</span></div>
      <Tabs defaultValue="xuat-ban">
        <TabsList>
          <TabsTrigger value="xuat-ban">Kế hoạch xuất bán</TabsTrigger>
          <TabsTrigger value="san-xuat">Kế hoạch sản xuất</TabsTrigger>
          <TabsTrigger value="nhap-mua">Kế hoạch nhập mua</TabsTrigger>
        </TabsList>
        <TabsContent value="xuat-ban"><TabXuatBan thang={thang} {...tab} /></TabsContent>
        <TabsContent value="san-xuat"><SapThietKe ten="Kế hoạch sản xuất" y="Sẽ thiết kế sau: lập từ kế hoạch xuất bán, cho biết cần sản xuất bao nhiêu và còn thiếu bao nhiêu nguyên liệu." /></TabsContent>
        <TabsContent value="nhap-mua"><SapThietKe ten="Kế hoạch nhập mua" y="Sẽ thiết kế sau: nhập đường bộ / đường biển, lập từ nhu cầu của kế hoạch sản xuất." /></TabsContent>
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
