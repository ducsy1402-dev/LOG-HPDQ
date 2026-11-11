import { ChevronRight, ExternalLink } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Màu biểu đồ dùng chung cho Tổng quan (khớp màu trạng thái ở lib/linetime.js)
export const MAU = { ok: "#10b981", warn: "#f59e0b", bad: "#f43f5e", info: "#3b82f6", primary: "#06b6d4", xam: "#94a3b8", tim: "#8b5cf6" };
const VIEN = { ok: "before:bg-ok", warn: "before:bg-warn", bad: "before:bg-bad", info: "before:bg-info", primary: "before:bg-primary" };
const CHU = { ok: "text-ok", warn: "text-warn", bad: "text-bad", info: "text-info", primary: "text-primary" };

// Thẻ tổng quan: tiêu đề, một số lớn, hình nhỏ, 3 chỉ số phụ. Bấm vào để mở hộp biểu đồ / chi tiết.
// tone: màu vạch bên trái và số lớn (ok / warn / bad / info / primary)
export function TheTQ({ icon: Ic, ten, nhan, so, donVi, phu, tone, hinh, chiSo = [], onMo, khoa }) {
  return (
    <button type="button" onClick={onMo} disabled={khoa}
      className={cn("group relative flex min-h-[208px] flex-col overflow-hidden rounded-lg border bg-card p-3.5 pl-4 text-left shadow-sm transition-all",
        "before:absolute before:inset-y-0 before:left-0 before:w-1", VIEN[tone] || "before:bg-border",
        khoa ? "cursor-default opacity-70" : "hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}>
      <div className="flex items-center gap-2">
        {Ic && <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary"><Ic className="h-4 w-4" /></span>}
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{ten}</span>
        {nhan}
        {!khoa && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className={cn("text-[1.75rem] font-semibold leading-none tabular-nums tracking-tight", CHU[tone])}>{so}</span>
        {donVi && <span className="text-xs text-muted-foreground">{donVi}</span>}
      </div>
      {phu && <div className="mt-1 truncate text-[0.6875rem] text-muted-foreground">{phu}</div>}
      <div className="mt-2.5 min-h-[34px] flex-1">{hinh}</div>
      {chiSo.length > 0 && (
        <div className="mt-2.5 grid grid-cols-3 gap-2 border-t pt-2.5">
          {chiSo.map(([ten, gt, t], i) => (
            <div key={i} className="min-w-0">
              <div className="truncate text-[0.6875rem] text-muted-foreground" title={ten}>{ten}</div>
              <div className={cn("truncate text-sm font-semibold tabular-nums", CHU[t])}>{gt}</div>
            </div>))}
        </div>)}
    </button>
  );
}

// Thanh xếp chồng nhiều phần (mỗi phần [giá trị, màu, tên]); hiện chú thích bên dưới nếu chuThich
export function ThanhChong({ phan, chuThich = true, className }) {
  const tong = phan.reduce((s, [x]) => s + (x > 0 ? x : 0), 0);
  return (
    <div className={className}>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
        {tong > 0 && phan.map(([x, mau, ten], i) => x > 0 && <div key={i} title={`${ten}: ${x}`} style={{ width: `${(x / tong) * 100}%`, background: mau }} />)}
      </div>
      {chuThich && (
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[0.6875rem] text-muted-foreground">
          {phan.map(([x, mau, ten], i) => <span key={i} className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-sm" style={{ background: mau }} />{ten} <b className="font-medium tabular-nums text-foreground">{x}</b></span>)}
        </div>)}
    </div>
  );
}

// Hộp chi tiết của một thẻ: rộng, có nút mở trang đầy đủ ở chân hộp
export function HopTQ({ title, description, onClose, children, moTrang }) {
  return (
    <Dialog onOpenChange={(o) => !o && onClose()} className="max-w-6xl" title={title} description={description}
      footer={moTrang && moTrang.map(([ten, fn]) => <Button key={ten} variant="outline" size="sm" onClick={() => { onClose(); fn(); }}><ExternalLink />{ten}</Button>)}>
      {children}
    </Dialog>
  );
}

// Dòng số liệu nhỏ: tên bên trái, giá trị bên phải
export const Dong = ({ ten, children, className }) => <div className={cn("flex justify-between gap-2 text-xs", className)}><span className="text-muted-foreground">{ten}</span><span className="text-right tabular-nums">{children}</span></div>;
