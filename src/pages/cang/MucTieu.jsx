import { useState } from "react";
import { Anchor, Truck } from "lucide-react";
import { useApp } from "@/store";
import { NativeSelect } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHead } from "@/components/common";
import { thangCua, tenThang, congThang } from "@/lib/format";
import SanLuongTab from "./SanLuongTab";

// Khai thác Cảng › Mục tiêu sản lượng, hai tab:
//   Mục tiêu khai thác cảng : mục tiêu tháng theo hướng nhập / xuất và loại hàng + nhập thực tế theo ca / ngày.
//   Mục tiêu khai thác vận tải: mục tiêu tháng theo hướng (phục vụ cảng / sản xuất), loại xe, đơn vị thực hiện (Hòa Phát / nhà thầu) + nhập thực tế theo ca / ngày.
// Tháng đang chọn dùng chung cho cả hai tab. Tổng quan › Khối lượng xếp dỡ vẫn so khối lượng chuyến tàu với mục tiêu cảng.
const luu = (k, v) => { try { localStorage.setItem(k, v); } catch { /* bỏ qua */ } };
const doc = (k, mac) => { try { return localStorage.getItem(k) || mac; } catch { return mac; } };

export default function MucTieu() {
  const { D } = useApp();
  const [tab, setTab] = useState(() => (doc("lg-mt-tab", "cang") === "van_tai" ? "van_tai" : "cang"));
  const [thang, setThang] = useState(() => thangCua(D.now));
  const thangs = Array.from({ length: 13 }, (_, i) => congThang(thangCua(D.now), i - 6));
  return (
    <>
      <PageHead title="Mục tiêu sản lượng" desc="Mục tiêu tháng và số liệu thực tế theo ca, theo ngày của khai thác cảng và khai thác vận tải.">
        <NativeSelect className="h-8 w-40" value={thang} onChange={(e) => setThang(e.target.value)} options={thangs.map((x) => [x, tenThang(x) + (x === thangCua(D.now) ? " (này)" : "")])} aria-label="Tháng" />
      </PageHead>
      <Tabs value={tab} onValueChange={(v) => { setTab(v); luu("lg-mt-tab", v); }}>
        <TabsList>
          <TabsTrigger value="cang"><Anchor className="mr-1.5 h-4 w-4" />Mục tiêu khai thác cảng</TabsTrigger>
          <TabsTrigger value="van_tai"><Truck className="mr-1.5 h-4 w-4" />Mục tiêu khai thác vận tải</TabsTrigger>
        </TabsList>
        <TabsContent value="cang"><SanLuongTab nhom="cang" thang={thang} /></TabsContent>
        <TabsContent value="van_tai"><SanLuongTab nhom="van_tai" thang={thang} /></TabsContent>
      </Tabs>
    </>
  );
}
