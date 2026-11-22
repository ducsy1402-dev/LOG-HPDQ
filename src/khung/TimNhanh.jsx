import { useEffect, useMemo, useRef, useState } from "react";
import * as Dlg from "@radix-ui/react-dialog";
import { Search, Ship, Anchor, CornerDownLeft } from "lucide-react";
import { cn } from "../lib/utils";
import { PHAN_HE, khongDau } from "./menu";
import { tenBenChuyen } from "../lib/tenBen";

// Hộp tìm nhanh (Ctrl+K): trang / tab trong web, tàu (mở phiếu chuyến), bến (mở Linetime). Gõ không dấu vẫn tìm được.
const GIOI_HAN = 6;
const khop = (vb, q) => q.every((t) => vb.includes(t));

export default function TimNhanh({ mo, doi, nav, go, D, coCang, moChuyen }) {
  const [q, setQ] = useState(""), [i, setI] = useState(0);
  const ds = useRef(null);
  useEffect(() => { if (mo) { setQ(""); setI(0); } }, [mo]);

  const trang = useMemo(() => {
    const r = [];
    for (const n of nav) {
      const ph = PHAN_HE.find((p) => p.id === n.ph);
      const phu = ph?.don ? "" : ph?.ten;
      r.push({ k: `t:${n.id}`, nhom: "Trang & tab", ten: n.ten, phu, icon: n.icon, chay: () => go(n.id) });
      n.tabs?.forEach(([id, ten]) => r.push({ k: `t:${n.id}/${id}`, nhom: "Trang & tab", ten: `${n.ten} › ${ten}`, phu, icon: n.icon, chay: () => go(`${n.id}/${id}`) }));
    }
    return r.map((x) => ({ ...x, vb: khongDau(`${x.ten} ${x.phu}`) }));
  }, [nav, go]);

  const kq = useMemo(() => {
    const t = khongDau(q).split(/\s+/).filter(Boolean);
    const loc = (a, gh) => a.filter((x) => khop(x.vb, t)).slice(0, gh);
    const r = loc(trang, t.length ? GIOI_HAN + 4 : 14);
    if (coCang && t.length) {
      const tau = (D?.voyages || []).map((v) => ({ v, vb: khongDau(`${v.ten_tau} ${v.ma_chuyen || ""} ${v.ben_ma || ""}`) })).filter((x) => khop(x.vb, t)).slice(0, GIOI_HAN);
      tau.forEach(({ v }) => r.push({ k: `v:${v.id}`, nhom: "Tàu", ten: v.ten_tau, phu: `${v.ma_chuyen || "Chuyến"}${v.ben_ma ? ` · Bến ${tenBenChuyen(v)}` : ""}`, icon: Ship, chay: () => moChuyen(v.id) }));
      (D?.berths || []).filter((b) => khop(khongDau(`ben ${b.ma} ${b.ten || ""}`), t)).slice(0, GIOI_HAN).forEach((b) => r.push({ k: `b:${b.ma}`, nhom: "Bến", ten: `Bến ${b.ma}`, phu: "Mở Linetime tàu cập bến", icon: Anchor, chay: () => go("cang/linetime") }));
    }
    return r;
  }, [q, trang, D, coCang, go, moChuyen]);

  useEffect(() => { setI(0); }, [q]);
  useEffect(() => { ds.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" }); }, [i, kq]);

  const chay = (x) => { if (!x) return; doi(false); setTimeout(x.chay, 0); };
  const phim = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setI((v) => Math.min(v + 1, kq.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setI((v) => Math.max(v - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); chay(kq[i]); }
  };
  let nhomCu = "";

  return (
    <Dlg.Root open={mo} onOpenChange={doi}>
      <Dlg.Portal>
        <Dlg.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dlg.Content aria-describedby={undefined} className="fixed left-1/2 top-[10vh] z-50 w-[min(640px,calc(100vw-24px))] -translate-x-1/2 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-2xl focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <Dlg.Title className="sr-only">Tìm nhanh</Dlg.Title>
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input autoFocus role="combobox" aria-expanded="true" aria-controls="tim-nhanh-ds" aria-activedescendant={kq[i] ? `tn-${i}` : undefined} aria-label="Tìm nhanh trang, tab, tàu, bến"
              value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={phim} placeholder="Gõ tên trang, tab, tàu, bến…"
              className="h-12 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground" style={{ boxShadow: "none" }} />
            <kbd className="rounded border px-1.5 py-0.5 text-[0.6875rem] text-muted-foreground">Esc</kbd>
          </div>
          <div ref={ds} id="tim-nhanh-ds" role="listbox" className="max-h-[52vh] overflow-y-auto p-1.5">
            {kq.length === 0 && <div className="px-3 py-8 text-center text-sm text-muted-foreground">Không tìm thấy “{q}”.</div>}
            {kq.map((x, j) => {
              const dau = x.nhom !== nhomCu; nhomCu = x.nhom;
              return (
                <div key={x.k}>
                  {dau && <div className="px-2.5 pb-1 pt-2 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">{x.nhom}</div>}
                  <div id={`tn-${j}`} role="option" aria-selected={j === i} onMouseMove={() => setI(j)} onClick={() => chay(x)}
                    className={cn("flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-sm", j === i ? "bg-primary/12 text-foreground" : "")}>
                    <x.icon className={cn("h-4 w-4 shrink-0", j === i ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate font-medium">{x.ten}</span>
                    {x.phu && <span className="shrink-0 truncate text-xs text-muted-foreground">{x.phu}</span>}
                    {j === i && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="hidden items-center gap-4 border-t px-3 py-2 text-[0.6875rem] text-muted-foreground sm:flex"><span>↑ ↓ chọn</span><span>Enter mở</span><span>Esc đóng</span><span className="ml-auto">Ctrl K mở hộp này ở mọi nơi</span></div>
        </Dlg.Content>
      </Dlg.Portal>
    </Dlg.Root>
  );
}
