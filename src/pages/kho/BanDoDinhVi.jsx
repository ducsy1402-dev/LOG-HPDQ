import { useMemo, useState } from "react";
import { Map as MapIcon, Minus } from "lucide-react";
import { so, pct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { mucDay } from "./khoUi";

// Bản đồ ĐỊNH VỊ nhỏ, nổi ở góc phải dưới của Sơ đồ kho bãi: mỗi khu vực là một ghim (màu theo mức lấp đầy, nhấp nháy khi vàng / đỏ).
// Bấm ghim → chọn khu vực, cuộn sơ đồ tới khu đó; các bãi lớn của khu hiện thành chấm quanh ghim và thành danh sách bên dưới → bấm để tới đúng bãi.
// Chưa có toạ độ thật: ghim xếp đều theo thứ tự khu vực (lệch nhẹ cho tự nhiên).
const W = 280, H = 180;
const MAU = { ok: "#10b981", warn: "#f59e0b", bad: "#f43f5e", xam: "#64748b" };
const lech = (s, m) => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return (h % (2 * m + 1)) - m; };
const cat = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export default function BanDoDinhVi({ nhom, ten, onKhu, onDi, onToanKho }) {
  const [thu, setThu] = useState(false), [chon, setChon] = useState(null);
  const ghim = useMemo(() => {
    const n = nhom.length, cols = Math.min(3, Math.max(1, n)), rows = Math.ceil(n / cols);
    return nhom.map((g, i) => {
      const c = i % cols, r = Math.floor(i / cols), ton = g.ds.reduce((s, b) => s + b.ton, 0), suc = g.ds.reduce((s, b) => s + (b.sucChua || 0), 0), lap = suc > 0 ? ton / suc : null;
      return { ...g, ton, lap, muc: mucDay(lap), x: Math.min(W - 36, Math.max(36, ((c + 0.5) / cols) * W + (r % 2 ? 14 : 0) + lech(g.k, 10))), y: Math.min(H - 32, Math.max(34, 16 + ((r + 0.5) / rows) * (H - 30) + lech(`${g.k}y`, 8))) };
    });
  }, [nhom]);
  const gc = ghim.find((g) => g.k === chon);
  const bamKhu = (k) => { setChon(k); onKhu(k); };

  if (thu) return (
    <button type="button" onClick={() => setThu(false)} className="fixed bottom-5 right-5 z-30 inline-flex items-center gap-1.5 rounded-full border bg-card/95 px-3 py-2 text-xs font-semibold shadow-lg backdrop-blur hover:bg-accent">
      <MapIcon className="h-4 w-4 text-primary" />Bản đồ
    </button>);
  return (
    <div className="fixed bottom-5 right-5 z-30 w-[280px] overflow-hidden rounded-xl border bg-card/95 shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between gap-2 border-b px-2.5 py-1.5 text-xs">
        <span className="inline-flex min-w-0 items-center gap-1 font-semibold"><MapIcon className="h-3.5 w-3.5 shrink-0 text-primary" /><span className="truncate">Bản đồ {ten.toLowerCase()}</span></span>
        <span className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={() => { setChon(null); onToanKho(); }} className="rounded px-1.5 py-0.5 text-[11px] text-primary hover:bg-primary/10">Toàn kho</button>
          <button type="button" onClick={() => setThu(true)} className="rounded p-0.5 text-muted-foreground hover:text-foreground" title="Thu nhỏ" aria-label="Thu nhỏ bản đồ"><Minus className="h-3.5 w-3.5" /></button>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full select-none text-foreground" role="img" aria-label="Bản đồ định vị các khu vực">
        <defs>
          <pattern id="dv-luoi" width="18" height="18" patternUnits="userSpaceOnUse"><path d="M18 0H0V18" fill="none" stroke="currentColor" strokeOpacity="0.07" /></pattern>
        </defs>
        <rect width={W} height={H} fill="currentColor" fillOpacity="0.05" /><rect width={W} height={H} fill="url(#dv-luoi)" />
        <path d={`M0 ${H * 0.55} C ${W * 0.3} ${H * 0.44}, ${W * 0.62} ${H * 0.64}, ${W} ${H * 0.5}`} fill="none" stroke="currentColor" strokeOpacity="0.13" strokeWidth="7" strokeLinecap="round" />
        <path d={`M${W * 0.34} 0 C ${W * 0.38} ${H * 0.4}, ${W * 0.31} ${H * 0.7}, ${W * 0.36} ${H}`} fill="none" stroke="currentColor" strokeOpacity="0.09" strokeWidth="5" strokeLinecap="round" />
        {ghim.map((g) => {
          const act = g.k === chon, m = MAU[g.muc];
          return (
            <g key={g.k}>
              <g className="cursor-pointer" onClick={() => bamKhu(g.k)} role="button" aria-label={`Khu vực ${g.k}`}>
                <title>{`${g.k}: ${g.ds.length} bãi lớn · tồn ${so(g.ton)} t${g.lap != null ? ` (${pct(g.lap)})` : ""}\nBấm để tới khu vực này`}</title>
                {(g.muc === "bad" || g.muc === "warn") && <circle cx={g.x} cy={g.y - 4} r="9" fill={m} opacity="0.35"><animate attributeName="r" values="8;18;8" dur={g.muc === "bad" ? "1.4s" : "2.4s"} repeatCount="indefinite" /><animate attributeName="opacity" values="0.45;0;0.45" dur={g.muc === "bad" ? "1.4s" : "2.4s"} repeatCount="indefinite" /></circle>}
                {act && <circle cx={g.x} cy={g.y - 4} r="15" fill="none" stroke="#38bdf8" strokeWidth="1.6" strokeDasharray="3 3" />}
                <path d={`M${g.x},${g.y + 8} C ${g.x - 9},${g.y - 2} ${g.x - 8},${g.y - 13} ${g.x},${g.y - 13} C ${g.x + 8},${g.y - 13} ${g.x + 9},${g.y - 2} ${g.x},${g.y + 8} Z`} fill={m} stroke="#fff" strokeOpacity="0.8" strokeWidth="1.2" />
                <circle cx={g.x} cy={g.y - 5} r="2.8" fill="#fff" />
                <text x={g.x} y={g.y + 20} textAnchor="middle" fontSize="9.5" fontWeight={act ? 700 : 500} fill="currentColor" paintOrder="stroke" stroke="hsl(var(--card))" strokeWidth="2.6">{cat(g.k, 18)}</text>
              </g>
              {act && g.ds.map((b, i) => {
                const a = (i / g.ds.length) * Math.PI * 2 - Math.PI / 2, bx = g.x + Math.cos(a) * 27, by = g.y - 4 + Math.sin(a) * 21, mb = MAU[mucDay(b.lapDay)];
                return <circle key={b.ten_bai} cx={bx} cy={by} r="4.5" fill={mb} stroke="#fff" strokeWidth="1" className="cursor-pointer" onClick={() => onDi(b.ten_bai)}><title>{`${b.ten_bai}${b.lapDay != null ? ` · ${pct(b.lapDay)}` : ""}`}</title></circle>;
              })}
            </g>);
        })}
      </svg>
      {gc && (
        <div className="max-h-[132px] overflow-y-auto border-t p-1.5">
          <div className="mb-1 px-1 text-[11px] font-semibold">{gc.k} · {gc.ds.length} bãi lớn</div>
          <div className="flex flex-wrap gap-1">
            {gc.ds.map((b) => { const m = mucDay(b.lapDay); return (
              <button key={b.ten_bai} type="button" onClick={() => onDi(b.ten_bai)} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] hover:bg-accent" title={`Tới ${b.ten_bai}`}>
                <i className="h-2 w-2 rounded-full" style={{ background: MAU[m] }} />{cat(b.ten_bai, 16)}<span className={cn("tabular-nums", m === "bad" ? "text-bad" : m === "warn" ? "text-warn" : "text-muted-foreground")}>{b.lapDay != null ? pct(b.lapDay) : ""}</span>
              </button>); })}
          </div>
        </div>)}
    </div>
  );
}
