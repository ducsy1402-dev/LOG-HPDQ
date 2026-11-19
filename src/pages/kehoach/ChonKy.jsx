import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { khoaKy, dsKy, tenKy, congKy } from "@/lib/ky";

// Chọn kỳ lập kế hoạch: Tháng / Quý / Năm (anh Sỹ 19/11/2026). Mỗi kỳ là một bản kế hoạch riêng; khóa kỳ: '2026-11' · '2026-Q4' · '2026' (lib/ky.js).
// Trạng thái nằm ở trang (hook useKyKH) để trang, hộp Kế hoạch dài hạn và biểu đồ dùng chung một kỳ.
const KY = [["thang", "Tháng"], ["quy", "Quý"], ["nam", "Năm"]];
export function useKyKH(now) {
  const [kyLoai, setKyLoai] = useState("thang");
  const [chon, setChon] = useState(() => ({ thang: khoaKy("thang", now), quy: khoaKy("quy", now), nam: khoaKy("nam", now) }));
  const hienTai = useMemo(() => ({ thang: khoaKy("thang", now), quy: khoaKy("quy", now), nam: khoaKy("nam", now) }), [now]);
  const khoa = chon[kyLoai];
  return { kyLoai, setKyLoai, khoa, nhan: tenKy(kyLoai, khoa), laNay: khoa === hienTai[kyLoai], dat: (v) => setChon((o) => ({ ...o, [kyLoai]: v })), hienTai };
}

export function ChonKy({ k, className }) {
  const ds = useMemo(() => {
    const truoc = { thang: 8, quy: 6, nam: 3 }[k.kyLoai], sau = { thang: 6, quy: 3, nam: 2 }[k.kyLoai], d = dsKy(k.kyLoai, Date.now(), truoc, sau);
    return d.includes(k.khoa) ? d : [...d, k.khoa].sort();
  }, [k.kyLoai, k.khoa]);
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <div className="inline-flex gap-0.5 rounded-md bg-muted p-0.5 text-xs" role="tablist" aria-label="Kỳ kế hoạch">
        {KY.map(([x, ten]) => (
          <button key={x} type="button" role="tab" aria-selected={k.kyLoai === x} onClick={() => k.setKyLoai(x)}
            className={cn("rounded px-2.5 py-1 font-medium transition-colors", k.kyLoai === x ? "bg-card text-foreground shadow-sm dark:bg-accent" : "text-muted-foreground hover:text-foreground")}>{ten}</button>))}
      </div>
      <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => k.dat(congKy(k.kyLoai, k.khoa, -1))} aria-label="Kỳ trước"><ChevronLeft /></Button>
      <NativeSelect className="h-8 w-52" value={k.khoa} onChange={(e) => k.dat(e.target.value)} options={ds.map((x) => [x, tenKy(k.kyLoai, x) + (x === k.hienTai[k.kyLoai] ? " (này)" : "")])} aria-label="Kỳ" />
      <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => k.dat(congKy(k.kyLoai, k.khoa, 1))} aria-label="Kỳ sau"><ChevronRight /></Button>
    </div>
  );
}
