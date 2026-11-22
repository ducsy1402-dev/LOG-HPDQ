import * as D from "@radix-ui/react-dialog";
import { ArrowLeft } from "lucide-react";
import { TrongHopCtx } from "./toanManHinh";

// Hộp thoại (anh Sỹ chốt 22/11/2026): mọi hộp mở ra TOÀN MÀN HÌNH, có nút mũi tên quay lại ở góc trái (Esc cũng đóng); không còn nút toàn màn hình và dấu X.
// Hộp vốn là biểu mẫu nhỏ (className không đặt max-w-… hoặc đặt cỡ nhỏ) thì nội dung giữ độ rộng cũ và nằm giữa màn hình; hộp rộng (bảng, kế hoạch…) dùng hết bề ngang.
// side="right" (phiếu chuyến) cũng toàn màn hình. Thẻ (Card) bên trong hộp không hiện nút phóng riêng; biểu đồ tự vừa khít khung (data-tmh).
const NHO = { sm: "24rem", md: "28rem", lg: "32rem", xl: "36rem", "2xl": "42rem", "3xl": "48rem" };
function beRongNoiDung(className, side) {
  if (side === "right") return null;
  const m = /(?:^|\s)(?:[a-z]+:)?max-w-(sm|md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|full|\[[^\]]*\])(?=\s|$)/.exec(className || "");
  if (!m) return NHO.lg;
  if (m[1][0] === "[") { const px = /(\d+)px/.exec(m[1]); return px && +px[1] <= 800 ? `${px[1]}px` : null; }
  return NHO[m[1]] || null;
}

export function Dialog({ open = true, onOpenChange, title, description, children, footer, className, side }) {
  const rong = beRongNoiDung(className, side);
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Content
          data-tmh="" data-hop=""
          className="fixed inset-0 z-50 flex flex-col bg-background focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-2 data-[state=open]:duration-200">
          <div className="flex shrink-0 items-center gap-2 border-b bg-card px-2 py-1.5 sm:px-3">
            <D.Close className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" aria-label="Quay lại" data-tip="Quay lại (Esc)">
              <ArrowLeft className="h-5 w-5" />
            </D.Close>
            <div className="min-w-0 flex-1">
              <D.Title className="truncate text-base font-semibold leading-snug">{title}</D.Title>
              <D.Description className={description ? "truncate text-xs text-muted-foreground" : "sr-only"} title={typeof description === "string" ? description : undefined}>{description || (typeof title === "string" ? title : "Hộp thoại")}</D.Description>
            </div>
          </div>
          <TrongHopCtx.Provider value={true}>
            <div className="min-h-0 flex-1 overflow-auto px-3 py-3 sm:px-4">
              <div className="mx-auto w-full" style={rong ? { maxWidth: rong } : undefined}>{children}</div>
            </div>
          </TrongHopCtx.Provider>
          {footer && <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t bg-card px-4 py-3">{footer}</div>}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
