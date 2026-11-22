import { useThoatMuot } from "../khung/dongTac";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, AlertTriangle, Info, XCircle } from "lucide-react";
import { useApp } from "@/store";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { TRANG_THAI } from "@/lib/linetime";
import { pct } from "@/lib/format";

export function Toasts() {
  const { toasts } = useApp();
  const ds = useThoatMuot(toasts, (t) => t.id, 220);
  const I = { ok: CheckCircle2, bad: XCircle, warn: AlertTriangle, info: Info };
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(420px,calc(100vw-32px))] flex-col gap-2" role="status" aria-live="polite">
      {ds.map(({ x: t, thoat }) => { const Ic = I[t.tone] || Info; return (
        <div key={t.id} style={{ "--ms": `${t.tone === "bad" ? 6500 : 3800}ms` }}
          className={cn("toast-tin pointer-events-auto relative flex items-start gap-2 overflow-hidden rounded-lg border bg-popover px-3 py-2.5 text-sm shadow-lg", thoat && "toast-thoat",
            t.tone === "bad" && "border-bad/50", t.tone === "warn" && "border-warn/50")}>
          <Ic className={cn("mt-0.5 h-4 w-4 shrink-0", t.tone === "bad" ? "text-bad" : t.tone === "warn" ? "text-warn" : "text-ok")} />
          <span>{t.msg}</span>
          <span className={cn("toast-dem", t.tone === "bad" ? "text-bad" : t.tone === "warn" ? "text-warn" : "text-ok")} aria-hidden="true" />
        </div>); })}
    </div>
  );
}

export function Kpi({ label, value, sub, tone, icon: Ic, onClick }) {
  const T = { ok: "text-ok", warn: "text-warn", bad: "text-bad", info: "text-info", primary: "text-primary" };
  const Tag = onClick ? "button" : "div";
  return (
    <Tag onClick={onClick} className={cn("rounded-lg border bg-card p-3 text-left shadow-sm", onClick && "transition-colors hover:border-primary/50")}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{Ic && <Ic className="h-3.5 w-3.5" />}{label}</div>
      <div className={cn("mt-1 text-2xl font-semibold tabular-nums leading-tight", T[tone])}>{value}</div>
      {sub && <div className="mt-0.5 text-[0.6875rem] text-muted-foreground">{sub}</div>}
    </Tag>
  );
}

export const Empty = ({ children, className }) => <div className={cn("rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground", className)}>{children}</div>;

export function TrangThaiBadge({ st }) {
  const t = TRANG_THAI[st] || TRANG_THAI.du_kien;
  return <Badge tone={t.tone}>{t.ten}</Badge>;
}
export const MUC = { bad: { tone: "bad", ten: "Khẩn" }, warn: { tone: "warn", ten: "Cảnh báo" }, info: { tone: "info", ten: "Lưu ý" } };
export const MucIcon = ({ muc, className }) => { const I = muc === "bad" ? XCircle : muc === "warn" ? AlertTriangle : Info; return <I className={cn("h-4 w-4 shrink-0", muc === "bad" ? "text-bad" : muc === "warn" ? "text-warn" : "text-info", className)} />; };

// Thanh tiến độ như hình 3: xanh = đã làm, đỏ = còn lại; vượt 100% thì cả thanh xanh và gắn nhãn
export function TienDo({ v, className }) {
  const p = v == null ? null : Math.max(0, v);
  return (
    <div className={cn("flex min-w-[120px] items-center gap-2", className)}>
      <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-bad/70" title={p == null ? "Chưa có khối lượng" : `Hoàn tất ${pct(p, 2)}`}>
        <div className="absolute inset-y-0 left-0 rounded-full bg-ok" style={{ width: `${Math.min(100, (p ?? 0) * 100)}%` }} />
      </div>
      <span className={cn("w-14 text-right text-xs tabular-nums", p > 1.0001 && "font-semibold text-info")}>{p == null ? "—" : pct(p, p > 1 || (p > 0 && p < 0.01) ? 2 : 0)}</span>
    </div>
  );
}

// Nút xóa hai bước (bấm lần hai để xác nhận)
export function ConfirmButton({ onConfirm, children, confirmText = "Bấm lần nữa để xóa", size = "xs", variant = "ghost", className }) {
  const [hoi, setHoi] = useState(false);
  const t = useRef();
  useEffect(() => () => clearTimeout(t.current), []);
  return (
    <Button size={size} variant={hoi ? "destructive" : variant} className={cn(!hoi && "text-bad", className)}
      onClick={() => { if (hoi) { setHoi(false); onConfirm(); } else { setHoi(true); t.current = setTimeout(() => setHoi(false), 3500); } }}>
      {hoi ? confirmText : children}
    </Button>
  );
}

export function PageHead({ title, desc, children }) {
  return (
    // Đầu trang gọn một hàng (anh Sỹ 17/11/2026, theo Mục tiêu sản lượng): tiêu đề cỡ lg, mô tả dài không chiếm dòng riêng mà hiện khi rê chuột vào tiêu đề; nút nằm cùng hàng.
    // Tiêu đề trang không hiện nữa (anh Sỹ 22/11/2026: thanh trên đã có đường dẫn Phân hệ › Trang › Tab); vẫn có <h1> ẩn cho trình đọc màn hình.
    <div className={desc && typeof desc !== "string" || children ? "mb-2 flex flex-wrap items-center gap-2" : undefined}>
      <h1 className="sr-only">{title}</h1>
      {desc && typeof desc !== "string" && <div className="text-xs text-muted-foreground">{desc}</div>}
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
