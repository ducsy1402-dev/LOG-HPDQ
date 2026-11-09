import { useState } from "react";
import { Anchor, Truck } from "lucide-react";
import { useApp } from "@/store";
import { NativeSelect } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHead } from "@/components/common";
import { thangCua, tenThang, congThang } from "@/lib/format";
import { khoaKy, dsKy, tenKy } from "@/lib/ky";
import { cn } from "@/lib/utils";
import SanLuongTab from "./SanLuongTab";

// Khai thác Cảng › Mục tiêu sản lượng, hai tab:
//   Mục tiêu khai thác cảng : mục tiêu theo hướng nhập / xuất và loại hàng + nhập thực tế theo ca / ngày.
//   Mục tiêu khai thác vận tải: mục tiêu theo hướng (phục vụ cảng / sản xuất), loại xe, đơn vị thực hiện (Hòa Phát / nhà thầu) + nhập thực tế theo ca / ngày.
// Kỳ: Tháng (bảng mục tiêu + nhập số theo ca / ngày), Quý hoặc Năm (mục tiêu nhập riêng cho kỳ, SQL 10; thực tế cộng từ các tháng).
// Kỳ đang chọn dùng chung cho cả hai tab. Tổng quan › Khối lượng xếp dỡ vẫn so khối lượng chuyến tàu với mục tiêu cảng của tháng.
const luu = (k, v) => { try { localStorage.setItem(k, v); } catch { /* bỏ qua */ } };
const doc = (k, mac) => { try { return localStorage.getItem(k) || mac; } catch { return mac; } };
const KY = [["thang", "Tháng"], ["quy", "Quý"], ["nam", "Năm"]];

export default function MucTieu() {
  const { D } = useApp();
  const [tab, setTab] = useState(() => (doc("lg-mt-tab", "cang") === "van_tai" ? "van_tai" : "cang"));
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
    <>
      <PageHead title="Mục tiêu sản lượng" desc="Mục tiêu tháng, quý, năm và số liệu thực tế theo ca, theo ngày của khai thác cảng và khai thác vận tải.">
        <div className="inline-flex overflow-hidden rounded-md border" role="tablist" aria-label="Kỳ mục tiêu">
          {KY.map(([k, ten]) => (
            <button key={k} type="button" role="tab" aria-selected={kyLoai === k} onClick={() => { setKyLoai(k); luu("lg-mt-ky", k); }}
              className={cn("h-8 px-3 text-sm font-medium transition-colors", kyLoai === k ? "bg-primary text-primary-foreground" : "hover:bg-accent")}>{ten}</button>))}
        </div>
        <NativeSelect className="h-8 w-52" value={ky} onChange={(e) => setChon((o) => ({ ...o, [kyLoai]: e.target.value }))}
          options={dsChon[kyLoai].map(([x, ten]) => [x, ten + (x === hienTai[kyLoai] ? " (này)" : "")])} aria-label={KY.find(([k]) => k === kyLoai)[1]} />
      </PageHead>
      <Tabs value={tab} onValueChange={(v) => { setTab(v); luu("lg-mt-tab", v); }}>
        <TabsList>
          <TabsTrigger value="cang"><Anchor className="mr-1.5 h-4 w-4" />Mục tiêu khai thác cảng</TabsTrigger>
          <TabsTrigger value="van_tai"><Truck className="mr-1.5 h-4 w-4" />Mục tiêu khai thác vận tải</TabsTrigger>
        </TabsList>
        <TabsContent value="cang"><SanLuongTab nhom="cang" thang={ky} kyLoai={kyLoai} /></TabsContent>
        <TabsContent value="van_tai"><SanLuongTab nhom="van_tai" thang={ky} kyLoai={kyLoai} /></TabsContent>
      </Tabs>
    </>
  );
}
