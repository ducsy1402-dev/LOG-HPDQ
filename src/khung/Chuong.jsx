import { Bell } from "lucide-react";
import { useApp } from "../store";
import { cn } from "../lib/utils";
import { MucIcon } from "../components/common";
import { Popover, PopoverTrigger, PopoverContent } from "../components/ui/menu";
import { tenBenChuyen } from "../lib/tenBen";

// Chuông cảnh báo trên thanh trên cùng: số cảnh báo đang mở (đỏ nếu có cảnh báo khẩn, vàng nếu chỉ có cảnh báo thường) của các chuyến chưa rời bến
export default function Chuong({ onMo }) {
  const { D } = useApp();
  const ds = D?.alerts || [];
  const khan = ds.filter((a) => a.muc === "bad").length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="tb-nut relative" aria-label={`Cảnh báo đang mở: ${ds.length}${khan ? `, ${khan} khẩn` : ""}`} data-tip="Cảnh báo đang mở">
          <Bell className="h-[1.15rem] w-[1.15rem]" />
          {ds.length > 0 && <span className={cn("absolute right-0.5 top-0.5 min-w-[18px] rounded-full px-1 text-center text-[0.6875rem] font-bold leading-[18px] text-white ring-2 ring-card", khan ? "bg-bad" : "bg-warn")}>{ds.length > 99 ? "99+" : ds.length}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="w-[min(420px,calc(100vw-24px))]">
        <div className="flex items-center justify-between border-b px-3 py-2"><span className="text-sm font-semibold">Cảnh báo đang mở</span><span className="text-xs text-muted-foreground">{khan} khẩn · {ds.length - khan} cảnh báo</span></div>
        <div className="max-h-[60vh] overflow-y-auto">
          {ds.length ? ds.map((a) => (
            <button key={a.id} onClick={() => onMo(a.voyage.id)} className="flex min-h-[44px] w-full items-start gap-2 border-b px-3 py-2 text-left text-sm last:border-0 hover:bg-accent">
              <MucIcon muc={a.muc} className="mt-0.5" />
              <span className="min-w-0"><span className="font-medium">{a.voyage.ten_tau}</span>{a.voyage.ben_ma && <span className="text-muted-foreground"> · Bến {tenBenChuyen(a.voyage)}</span>}<span className="block text-xs text-muted-foreground">{a.nd}</span></span>
            </button>
          )) : <div className="px-3 py-6 text-center text-sm text-muted-foreground">Không có cảnh báo.</div>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
