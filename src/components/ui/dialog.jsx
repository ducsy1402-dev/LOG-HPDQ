import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToanManHinh, NutToanManHinh, TrongHopCtx } from "./toanManHinh";

// Hộp thoại kiểu shadcn/ui. side="right" mở dạng ngăn kéo bên phải (phiếu chuyến tàu).
// Có nút Toàn màn hình cạnh nút đóng; thẻ (Card) bên trong hộp không hiện nút riêng.
export function Dialog({ open = true, onOpenChange, title, description, children, footer, className, side }) {
  const [on, doi] = useToanManHinh();
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <D.Content
          data-tmh={on ? "" : undefined}
          className={cn(
            "fixed z-50 flex flex-col border bg-card shadow-xl focus:outline-none",
            side === "right"
              ? "inset-y-0 right-0 w-full sm:max-w-3xl data-[state=open]:animate-in data-[state=open]:slide-in-from-right"
              : "left-1/2 top-1/2 max-h-[92vh] w-[calc(100vw-24px)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            className,
            on && "inset-0 left-0 top-0 h-[100dvh] max-h-none w-screen max-w-none translate-x-0 translate-y-0 rounded-none border-0 sm:max-w-none",
          )}>
          <div className="flex items-start gap-3 border-b px-4 py-3">
            <div className="min-w-0 flex-1">
              <D.Title className="text-base font-semibold leading-snug">{title}</D.Title>
              <D.Description className={description ? "mt-0.5 text-xs text-muted-foreground" : "sr-only"}>{description || (typeof title === "string" ? title : "Hộp thoại")}</D.Description>
            </div>
            <NutToanManHinh on={on} onClick={doi} className="-my-0.5" />
            <D.Close className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Đóng"><X className="h-4 w-4" /></D.Close>
          </div>
          <TrongHopCtx.Provider value={true}>
            <div className="min-h-0 flex-1 overflow-auto px-4 py-3">{children}</div>
          </TrongHopCtx.Provider>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t px-4 py-3">{footer}</div>}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
