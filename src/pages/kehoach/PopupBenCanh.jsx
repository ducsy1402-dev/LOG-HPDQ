import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// Hộp nhỏ nổi BÊN CẠNH ô vừa bấm (bên phải ô; hết chỗ thì sang trái), dùng trong hộp thoại.
// Hộp thoại có transform làm "fixed" tính theo hộp thoại chứ không theo màn hình, nên đo gốc thật rồi trừ đi (như useNoi ở ui/noi.js).
// neo: phần tử vừa bấm; bấm ra ngoài (ngoài ô neo và hộp) hoặc bấm × thì đóng.
export function PopupBenCanh({ neo, onDong, tieuDe, phu, rong = 360, children }) {
  const popRef = useRef();
  const [vt, setVt] = useState(null);
  useLayoutEffect(() => {
    const pop = popRef.current;
    if (!neo || !pop) return;
    const a = neo.getBoundingClientRect(), cu = pop.style.cssText;
    pop.style.top = "0px"; pop.style.left = "0px"; pop.style.transform = "none";
    const g = pop.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
    pop.style.cssText = cu;
    let left = a.right + 8; if (left + w > window.innerWidth - 8) left = Math.max(8, a.left - w - 8);
    const top = Math.max(8, Math.min(a.top - 8, window.innerHeight - 8 - h));
    setVt({ left: left - g.left, top: top - g.top });
  }, [neo]);
  const dongRef = useRef(onDong);
  dongRef.current = onDong;
  useEffect(() => {
    const ngoai = (e) => { if (!(e.target instanceof Node) || neo?.contains(e.target) || popRef.current?.contains(e.target)) return; dongRef.current?.(); };
    document.addEventListener("pointerdown", ngoai, true);
    return () => document.removeEventListener("pointerdown", ngoai, true);
  }, [neo]);
  return (
    <div ref={popRef} role="dialog" aria-label={typeof tieuDe === "string" ? tieuDe : "Hộp nhập"} style={{ position: "fixed", width: rong, maxWidth: "calc(100vw - 16px)", ...(vt ? { left: vt.left, top: vt.top } : { left: 0, top: 0, visibility: "hidden" }) }}
      className={cn("z-[60] flex max-h-[80vh] flex-col rounded-lg border bg-popover text-sm text-popover-foreground shadow-xl")}>
      <div className="flex items-start gap-2 border-b px-3 py-2">
        <div className="min-w-0 flex-1"><div className="truncate font-semibold">{tieuDe}</div>{phu && <div className="text-[0.6875rem] text-muted-foreground">{phu}</div>}</div>
        <button type="button" onClick={onDong} className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Đóng"><X className="h-4 w-4" /></button>
      </div>
      {children}
    </div>
  );
}
