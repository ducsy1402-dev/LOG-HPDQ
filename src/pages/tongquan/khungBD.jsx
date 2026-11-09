import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { useToanManHinh, NutToanManHinh } from "@/components/ui/toanManHinh";
import { PhongToCtx } from "@/components/EChart";
import { so, pct, soGon } from "@/lib/format";
import { cn } from "@/lib/utils";

// Khung biểu đồ dùng chung của Tổng quan: tiêu đề nhỏ in hoa, bộ lọc (bo), nút Phóng to (khung phủ kín màn hình, biểu đồ cao lên)
// và nút Chi tiết: chiTiet = { title, description, node } mở hộp dữ liệu chi tiết của chính biểu đồ; onChiTiet = tự mở hộp riêng.
export const nghin = (x) => (x == null ? "—" : Math.abs(x) >= 1000 ? soGon(x / 1000) + "k" : soGon(x));

export function Khung({ ten, phu, bo, chiTiet, onChiTiet, className, children }) {
  const [to, doiTo] = useToanManHinh();
  const [mo, setMo] = useState(false);
  const coCT = chiTiet || onChiTiet;
  return (
    <section className={cn("flex min-w-0 flex-col rounded-md border border-border/70 bg-card/70 p-2.5", to && "fixed inset-0 z-40 overflow-auto rounded-none border-0 bg-card p-4", className)}>
      <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-[10px] text-primary">◆</span>
        <h3 className={cn("truncate font-semibold uppercase tracking-wider text-muted-foreground", to ? "text-sm" : "text-[11px]")}>{ten}</h3>
        {phu && <span className="truncate text-[10px] text-muted-foreground/80">· {phu}</span>}
        <div className="ml-auto flex items-center gap-1.5">
          {bo}
          {coCT && <button type="button" onClick={() => (chiTiet ? setMo(true) : onChiTiet())} className="inline-flex shrink-0 items-center text-[11px] text-primary hover:underline">Chi tiết<ChevronRight className="h-3 w-3" /></button>}
          <NutToanManHinh on={to} onClick={doiTo} className="h-6 w-6" />
        </div>
      </div>
      <PhongToCtx.Provider value={to}>{children}</PhongToCtx.Provider>
      {mo && chiTiet && (
        <Dialog onOpenChange={(o) => !o && setMo(false)} className="max-w-4xl" title={chiTiet.title || ten} description={chiTiet.description || phu}>
          {chiTiet.node}
        </Dialog>)}
    </section>
  );
}

export const ChuaCo = ({ children }) => <div className="flex flex-1 items-center justify-center py-10 text-center text-xs text-muted-foreground">{children}</div>;

// Nhóm nút chọn
export function Chon({ gt, dat, ds }) {
  return (
    <div className="inline-flex overflow-hidden rounded border border-border/70 text-[10px]">
      {ds.map(([k, t]) => <button key={k} type="button" onClick={() => dat(k)} className={cn("px-1.5 py-0.5", gt === k ? "bg-primary/20 font-semibold text-primary" : "text-muted-foreground hover:bg-accent")}>{t}</button>)}
    </div>
  );
}
// Ô chọn thả xuống nhỏ; tatCa = nhãn dòng "tất cả" (giá trị "")
export const ChonDs = ({ gt, dat, ds, tatCa }) => (
  <select value={gt} onChange={(e) => dat(e.target.value)} className="max-w-[130px] rounded border border-border/70 bg-transparent px-1 py-0.5 text-[10px] text-muted-foreground">
    <option value="">{tatCa}</option>
    {ds.map((d) => <option key={d} value={d}>{d}</option>)}
  </select>
);

// Bảng chi tiết: cot = [[tiêu đề, kiểu]] (kiểu: "t" tấn, "%" phần trăm, "n" số, "" chữ); dong = mảng các mảng giá trị; tong = dòng tổng (tùy chọn)
const oSo = (v, k) => (v == null || v === "" ? "—" : k === "t" ? so(v) : k === "%" ? pct(v, 1) : k === "n" ? so(v) : v);
export function BangChiTiet({ cot, dong, tong }) {
  if (!dong.length) return <ChuaCo>Chưa có dữ liệu.</ChuaCo>;
  return (
    <div className="scroll-x max-h-[65vh] rounded-md border">
      <table className="tbl text-xs">
        <thead><tr>{cot.map(([t, k], i) => <th key={i} className={k ? "num" : ""}>{t}</th>)}</tr></thead>
        <tbody>
          {dong.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j} className={cn(cot[j][1] ? "num tabular-nums" : "", j === 0 && "whitespace-nowrap font-medium")}>{oSo(v, cot[j][1])}</td>)}</tr>)}
          {tong && <tr className="font-semibold">{tong.map((v, j) => <td key={j} className={cot[j][1] ? "num tabular-nums" : ""}>{oSo(v, cot[j][1])}</td>)}</tr>}
        </tbody>
      </table>
    </div>
  );
}
