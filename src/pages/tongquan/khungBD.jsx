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

// cao (px): khung CỐ ĐỊNH chiều cao (cộng 12 px cho dòng phụ dưới tên), nội dung dài hơn thì cuộn trong khung (không đổi kích thước khung); phóng to thì bỏ giới hạn
export function Khung({ ten, phu, bo, chiTiet, onChiTiet, className, cao, children }) {
  const [to, doiTo] = useToanManHinh();
  const [mo, setMo] = useState(false);
  const coCT = chiTiet || onChiTiet;
  return (
    <section style={!to && cao ? { height: cao + 12 } : undefined} className={cn("flex min-w-0 flex-col rounded-xl border bg-card p-3", to && "fixed inset-0 z-40 overflow-auto rounded-none border-0 bg-card p-4", className)}>
      {/* Đầu khung: tên + dòng phụ (trái, tự cắt bớt chữ) và các nút (phải); không đủ chỗ thì các nút xuống dòng, không đè lên tên */}
      <div className="mb-2 flex flex-wrap items-start gap-x-2 gap-y-1">
        <div className="min-w-0 flex-1 basis-[180px]">
          <h3 title={ten} className={cn("truncate font-semibold leading-tight text-foreground", to ? "text-base" : "text-[0.8125rem]")}>{ten}</h3>
          {phu && <div title={phu} className="truncate text-[0.6875rem] leading-tight text-muted-foreground">{phu}</div>}
        </div>
        <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          {bo}
          {coCT && <button type="button" onClick={() => (chiTiet ? setMo(true) : onChiTiet())} className="inline-flex shrink-0 items-center text-[0.6875rem] text-primary hover:underline">Chi tiết<ChevronRight className="h-3 w-3" /></button>}
          <NutToanManHinh on={to} onClick={doiTo} className="h-6 w-6" />
        </div>
      </div>
      <PhongToCtx.Provider value={to}>{cao && !to ? <div className="flex min-h-0 flex-1 flex-col overflow-auto pr-1 [justify-content:safe_center] [scrollbar-width:thin]">{children}</div> : children}</PhongToCtx.Provider>
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
    <div className="inline-flex gap-0.5 rounded-md bg-muted p-0.5 text-[0.6875rem]">
      {ds.map(([k, t]) => <button key={k} type="button" onClick={() => dat(k)} className={cn("rounded px-1.5 py-0.5 font-medium transition-colors", gt === k ? "bg-card text-foreground shadow-sm dark:bg-accent" : "text-muted-foreground hover:text-foreground")}>{t}</button>)}
    </div>
  );
}
// Ô chọn thả xuống nhỏ; tatCa = nhãn dòng "tất cả" (giá trị "")
export const ChonDs = ({ gt, dat, ds, tatCa }) => (
  <select value={gt} onChange={(e) => dat(e.target.value)} className="max-w-[130px] rounded-md border bg-transparent px-1 py-0.5 text-[0.6875rem] text-muted-foreground">
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
