import { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useNoi } from "@/components/ui/noi";
import { plain } from "@/lib/format";
import { cn } from "@/lib/utils";

// Ô vừa chọn vừa gõ: bấm ▾ (hoặc bấm vào ô) để xem hết danh sách, gõ để lọc (không cần dấu).
// options: ["giá trị"] hoặc [[giá trị, nhãn, chữ phụ]].
// tuDo = true: chữ gõ chính là giá trị (gõ tên mới được). tuDo = false: chỉ chọn trong danh sách, gõ để lọc.
export function ChonGo({ value, onChange, options = [], tuDo = true, placeholder, className, inputClassName, ...p }) {
  const [mo, setMo] = useState(false);
  const [go, setGo] = useState(null); // chữ đang gõ để lọc; null = hiện hết
  const [hl, setHl] = useState(0);
  const ref = useRef();
  const ds = options.map((o) => (Array.isArray(o) ? { v: o[0], l: String(o[1] ?? o[0]), g: o[2] } : { v: o, l: String(o) }));
  const nhan = ds.find((o) => o.v === value)?.l;
  const hien = go ? ds.filter((o) => plain(o.l).includes(plain(go))) : ds;
  const dong = () => { setMo(false); setGo(null); };
  const { popRef, style, neoW } = useNoi(mo, ref, { onNgoai: dong });
  const moDs = () => { setMo(true); setHl(Math.max(0, ds.findIndex((o) => o.v === value))); };
  const chon = (o) => { onChange(o.v, { chon: true }); dong(); }; // tham số 2 cho biết là bấm chọn (không phải đang gõ)
  const phim = (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!mo) return moDs();
      setHl((i) => Math.max(0, Math.min(hien.length - 1, i + (e.key === "ArrowDown" ? 1 : -1))));
    } else if (e.key === "Enter" && mo && hien[hl]) { e.preventDefault(); chon(hien[hl]); }
    else if (e.key === "Escape" && mo) { e.stopPropagation(); dong(); }
    else if (e.key === "Tab") dong();
  };
  return (
    <div ref={ref} className={cn("relative", className)}>
      <Input {...p} autoComplete="off" placeholder={placeholder} className={cn("pr-8", inputClassName)}
        value={tuDo ? value ?? "" : go ?? nhan ?? ""}
        onChange={(e) => { if (tuDo) onChange(e.target.value); setGo(e.target.value); setHl(0); if (!mo) moDs(); }}
        onFocus={moDs} onClick={() => !mo && moDs()} onKeyDown={phim} />
      <button type="button" tabIndex={-1} aria-label="Mở danh sách" onMouseDown={(e) => e.preventDefault()}
        onClick={() => { if (mo) dong(); else { setGo(null); moDs(); ref.current.querySelector("input")?.focus(); } }}
        className="absolute right-0 top-0 flex h-9 w-8 items-center justify-center text-muted-foreground hover:text-foreground"><ChevronDown className="h-4 w-4" /></button>
      {mo && (
        <div ref={popRef} data-chongo style={{ ...style, width: neoW }} onMouseDown={(e) => e.preventDefault()}
          className="z-[60] max-h-60 overflow-auto rounded-md border bg-popover p-1 text-sm text-popover-foreground shadow-lg">
          {hien.length ? hien.slice(0, 300).map((o, i) => (
            <div key={String(o.v)} onClick={() => chon(o)} onMouseEnter={() => setHl(i)}
              className={cn("cursor-pointer rounded px-2 py-1.5", i === hl && "bg-accent", o.v === value && "font-medium text-primary")}>
              {o.l}{o.g && <span className="ml-1.5 text-xs text-muted-foreground">{o.g}</span>}
            </div>))
            : <div className="px-2 py-1.5 text-xs text-muted-foreground">{tuDo ? "Không có trong danh sách (giữ chữ đã gõ)" : "Không có dòng khớp"}</div>}
        </div>)}
    </div>
  );
}
