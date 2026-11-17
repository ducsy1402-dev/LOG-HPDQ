import { useState } from "react";
import { useApp } from "@/store";
import { NativeSelect } from "@/components/ui/input";
import { thangCua, tenThang, congThang } from "@/lib/format";
import { khoaKy, dsKy, tenKy } from "@/lib/ky";
import { cn } from "@/lib/utils";
import SanLuongTab from "@/pages/cang/SanLuongTab";

// Mục tiêu khai thác VẬN TẢI (trước là tab của Khai thác Cảng › Mục tiêu sản lượng; anh Sỹ chuyển sang Thiết bị cơ giới › Kế hoạch & phân bổ 13/11/2026):
// mục tiêu theo hướng (phục vụ cảng / sản xuất), loại xe, đơn vị thực hiện (Hòa Phát / nhà thầu) + nhập thực tế theo ngày.
// Kỳ: Tháng (bảng mục tiêu + nhập số theo ngày), Quý hoặc Năm (mục tiêu nhập riêng cho kỳ, SQL 10; thực tế cộng từ các tháng).
const luu = (k, v) => { try { localStorage.setItem(k, v); } catch { /* bỏ qua */ } };
const doc = (k, mac) => { try { return localStorage.getItem(k) || mac; } catch { return mac; } };
const KY = [["thang", "Tháng"], ["quy", "Quý"], ["nam", "Năm"]];

export default function MucTieuVanTai({ trai }) {
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
      <div className="flex flex-wrap items-center gap-2">
        {trai}
        <div className="ml-auto flex flex-wrap items-center gap-2">
        <div className="inline-flex gap-0.5 rounded-md bg-muted p-0.5 text-xs" role="tablist" aria-label="Kỳ mục tiêu">
          {KY.map(([k, ten]) => (
            <button key={k} type="button" role="tab" aria-selected={kyLoai === k} onClick={() => { setKyLoai(k); luu("lg-mt-ky", k); }}
              className={cn("rounded px-2.5 py-1 font-medium transition-colors", kyLoai === k ? "bg-card text-foreground shadow-sm dark:bg-accent" : "text-muted-foreground hover:text-foreground")}>{ten}</button>))}
        </div>
        <NativeSelect className="h-8 w-52" value={ky} onChange={(e) => setChon((o) => ({ ...o, [kyLoai]: e.target.value }))}
          options={dsChon[kyLoai].map(([x, ten]) => [x, ten + (x === hienTai[kyLoai] ? " (này)" : "")])} aria-label={KY.find(([k]) => k === kyLoai)[1]} />
        </div>
      </div>
      <SanLuongTab nhom="van_tai" thang={ky} kyLoai={kyLoai} />
    </div>
  );
}

