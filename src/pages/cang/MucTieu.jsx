import { useState } from "react";
import { Anchor, Truck } from "lucide-react";
import { useApp } from "@/store";
import { NativeSelect } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { thangCua, tenThang, congThang } from "@/lib/format";
import { khoaKy, dsKy, tenKy } from "@/lib/ky";
import { cn } from "@/lib/utils";
import { PageHead } from "@/components/common";
import SanLuongTab from "./SanLuongTab";
import MucTieuCang from "./MucTieuCang";

// Khai thác Cảng › Mục tiêu sản lượng, hai tab:
//   Khai thác cảng  : bảng điều khiển mới (13/11/2026): 3 thẻ tàu, 4 nút (Đặt mục tiêu, Xem kế hoạch, Kế hoạch ngày, Sản lượng thực tế), 3 biểu đồ — xem MucTieuCang.jsx.
//   Khai thác vận tải: như cũ — mục tiêu theo hướng (phục vụ cảng / sản xuất), loại xe, đơn vị thực hiện (Hòa Phát / nhà thầu) + nhập thực tế theo ngày.
// Kỳ của tab vận tải: Tháng (bảng mục tiêu + nhập số theo ngày), Quý hoặc Năm (mục tiêu nhập riêng cho kỳ, SQL 10; thực tế cộng từ các tháng).
// Tổng quan › Khối lượng xếp dỡ vẫn so khối lượng chuyến tàu với mục tiêu cảng của tháng.
const luu = (k, v) => { try { localStorage.setItem(k, v); } catch { /* bỏ qua */ } };
const doc = (k, mac) => { try { return localStorage.getItem(k) || mac; } catch { return mac; } };
const KY = [["thang", "Tháng"], ["quy", "Quý"], ["nam", "Năm"]];

function VanTai() {
  const { D } = useApp();
  const [kyLoai, setKyLoai] = useState(() => (["quy", "nam"].includes(doc("lg-mt-ky", "thang")) ? doc("lg-mt-ky", "thang") : "thang"));
  const [chon, setChon] = useState(() => ({ thang: thangCua(D.now), quy: khoaKy("quy", D.now), nam: khoaKy("nam", D.now) }));
  const hienTai = { thang: thangCua(D.now), quy: khoaKy("quy", D.now), nam: khoaKy("nam", D.now) };
  const dsChon = {
    thang: Array.from({ length: 13 }, (_, i) => congThang(thangCua(D.now), i - 6)).map((x) => [x, tenThang(x)]),
    quy: dsKy("quy", D.now, 6, 3).map((x) => [x, tenKy("quy", x)]),
    nam: dsKy("nam", D.now, 3, 2).map((x) => [x, tenKy("nam", x)]),
  };
  const ky = chon[kyLoai];
  return (
    <div className="grid gap-3">
      <PageHead title="Mục tiêu sản lượng" desc="Khai thác vận tải: mục tiêu và số liệu thực tế theo ngày của đội xe, Hòa Phát và nhà thầu." />
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex overflow-hidden rounded-md border" role="tablist" aria-label="Kỳ mục tiêu">
          {KY.map(([k, ten]) => (
            <button key={k} type="button" role="tab" aria-selected={kyLoai === k} onClick={() => { setKyLoai(k); luu("lg-mt-ky", k); }}
              className={cn("h-8 px-3 text-sm font-medium transition-colors", kyLoai === k ? "bg-primary text-primary-foreground" : "hover:bg-accent")}>{ten}</button>))}
        </div>
        <NativeSelect className="h-8 w-52" value={ky} onChange={(e) => setChon((o) => ({ ...o, [kyLoai]: e.target.value }))}
          options={dsChon[kyLoai].map(([x, ten]) => [x, ten + (x === hienTai[kyLoai] ? " (này)" : "")])} aria-label={KY.find(([k]) => k === kyLoai)[1]} />
      </div>
      <SanLuongTab nhom="van_tai" thang={ky} kyLoai={kyLoai} />
    </div>
  );
}

export default function MucTieu() {
  const [tab, setTab] = useState(() => (doc("lg-mt-tab", "cang") === "van_tai" ? "van_tai" : "cang"));
  return (
    <Tabs value={tab} onValueChange={(v) => { setTab(v); luu("lg-mt-tab", v); }}>
      <TabsList className="h-8 p-0.5">
        <TabsTrigger value="cang" className="h-7 px-2.5 py-0 text-xs"><Anchor className="mr-1.5 h-3.5 w-3.5" />Khai thác cảng</TabsTrigger>
        <TabsTrigger value="van_tai" className="h-7 px-2.5 py-0 text-xs"><Truck className="mr-1.5 h-3.5 w-3.5" />Khai thác vận tải</TabsTrigger>
      </TabsList>
      <TabsContent value="cang"><MucTieuCang /></TabsContent>
      <TabsContent value="van_tai"><VanTai /></TabsContent>
    </Tabs>
  );
}
