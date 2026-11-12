import { ArrowDownRight, ArrowUpRight, Minus, ChevronLeft, ChevronRight, ChevronDown, AlertTriangle, CheckCircle2, Siren } from "lucide-react";
import { cn } from "@/lib/utils";
import { pct, so } from "@/lib/format";
import { Gauge, AnhMang, MAU_TONE } from "./hinhVe";
import { MAU } from "./khung";

// Thành phần giao diện của Tổng quan mới: thẻ chỉ số (KPI), thanh chọn kỳ, thẻ sức khỏe có đồng hồ, khối mảng có ảnh nền, danh sách vấn đề.
const CHU = { ok: "text-ok", warn: "text-warn", bad: "text-bad", info: "text-info", primary: "text-primary" };
const CHAM = { ok: "bg-ok", warn: "bg-warn", bad: "bg-bad", info: "bg-info", primary: "bg-primary" };
const NHAN_TONE = { ok: "bg-ok/12 text-ok", warn: "bg-warn/12 text-warn", bad: "bg-bad/12 text-bad", info: "bg-info/12 text-info", primary: "bg-primary/12 text-primary" };
export const TEN_TONE = { ok: "Bình thường", warn: "Cần chú ý", bad: "Cần xử lý ngay" };
const ICON_TONE = { ok: CheckCircle2, warn: AlertTriangle, bad: Siren };

// Mũi tên thay đổi so với kỳ trước: doi = tỉ lệ (0,12 = +12%); tot = "cao" (tăng là tốt) hoặc "thap" (tăng là xấu)
export function Delta({ doi, tot = "cao", nhan = "so kỳ trước", diem, className }) {
  if (doi == null || !Number.isFinite(doi)) return <span className={cn("text-[0.6875rem] text-muted-foreground", className)}>— {nhan}</span>;
  const phang = Math.abs(doi) < 0.005, tang = doi > 0, tuot = phang ? null : tang === (tot === "cao");
  const Ic = phang ? Minus : tang ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[0.6875rem] font-medium tabular-nums", phang ? "text-muted-foreground" : tuot ? "text-ok" : "text-bad", className)}>
      <Ic className="h-3 w-3" />{doi > 0 ? "+" : "−"}{diem ? `${so(Math.abs(doi) * 100)} điểm` : pct(Math.abs(doi), 1)}<span className="ml-0.5 font-normal text-muted-foreground">{nhan}</span>
    </span>
  );
}

// Đường xu hướng nhỏ
export function Spark({ data, mau = MAU.primary, className }) {
  const d = (data || []).map((x) => (x == null || !Number.isFinite(x) ? null : x));
  const co = d.filter((x) => x != null);
  if (co.length < 2) return null;
  const lo = Math.min(...co), hi = Math.max(...co), r = hi - lo || 1, n = d.length - 1 || 1;
  const pts = d.map((x, i) => (x == null ? null : `${((i / n) * 100).toFixed(1)},${(26 - ((x - lo) / r) * 22).toFixed(1)}`)).filter(Boolean);
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={cn("h-7 w-full", className)} aria-hidden>
      <polyline points={`0,30 ${pts.join(" ")} 100,30`} fill={mau} fillOpacity=".12" stroke="none" />
      <polyline points={pts.join(" ")} fill="none" stroke={mau} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// Thẻ chỉ số: biểu tượng, tên, số lớn, mũi tên so kỳ trước, dòng phụ, đường xu hướng hoặc đồng hồ. tone viền / số theo mức (ok / warn / bad)
export function TheChiSo({ icon: Ic, ten, giaTri, donVi, tone, doi, tot = "cao", nhanDoi, diem, phu, spark, mauSpark, gauge, onClick, className, children }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick}
      className={cn("group relative flex min-w-0 flex-col gap-1 overflow-hidden rounded-xl border bg-card p-3 text-left transition-all",
        onClick && "hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}>
      <div className="flex items-center gap-1.5 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
        {Ic && <Ic className="h-4 w-4 shrink-0 text-primary/80" />}
        <span className="truncate">{ten}</span>
        {tone && tone !== "ok" && <span className={cn("ml-auto h-2 w-2 shrink-0 rounded-full", CHAM[tone])} />}
      </div>
      {gauge ? (
        <div className="flex items-center gap-2">
          <Gauge {...gauge} size={gauge.size || 112}><span className={cn("text-lg font-semibold tabular-nums", CHU[tone])}>{giaTri}</span></Gauge>
          <div className="min-w-0 flex-1 text-[0.6875rem] leading-snug text-muted-foreground">{children}</div>
        </div>
      ) : (
        <div className="flex items-baseline gap-1.5">
          <span className={cn("text-[1.625rem] font-semibold leading-none tabular-nums tracking-tight", CHU[tone])}>{giaTri}</span>
          {donVi && <span className="text-xs text-muted-foreground">{donVi}</span>}
        </div>
      )}
      {doi !== undefined && <Delta doi={doi} tot={tot} nhan={nhanDoi} diem={diem} />}
      {phu && <div className="text-[0.6875rem] leading-snug text-muted-foreground">{phu}</div>}
      {!gauge && children}
      {spark && <Spark data={spark} mau={mauSpark || MAU_TONE[tone] || MAU.primary} className="mt-auto" />}
    </Tag>
  );
}

// Thanh chọn kỳ: Tuần / Tháng / Quý / Năm, mũi tên kỳ trước – kỳ sau, về kỳ hiện tại
export function ThanhKy({ ky, dat, ds, nhan, truoc, sau, veNay, laNay, className }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="inline-flex overflow-hidden rounded-lg border border-border/80 bg-card/80 text-xs" role="tablist" aria-label="Loại kỳ">
        {ds.map(([k, t]) => (
          <button key={k} type="button" role="tab" aria-selected={ky === k} onClick={() => dat(k)}
            className={cn("px-3 py-1.5 font-medium transition-colors", ky === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")}>{t}</button>))}
      </div>
      <div className="inline-flex items-center gap-0.5 rounded-lg border border-border/80 bg-card/80 text-xs">
        <button type="button" onClick={truoc} className="rounded-l-lg px-1.5 py-1.5 text-muted-foreground hover:bg-accent" aria-label="Kỳ trước" title="Kỳ trước"><ChevronLeft className="h-4 w-4" /></button>
        <span className="min-w-[132px] px-1 text-center font-semibold tabular-nums">{nhan}</span>
        <button type="button" onClick={sau} className="rounded-r-lg px-1.5 py-1.5 text-muted-foreground hover:bg-accent" aria-label="Kỳ sau" title="Kỳ sau"><ChevronRight className="h-4 w-4" /></button>
      </div>
      {!laNay && <button type="button" onClick={veNay} className="rounded-lg border border-primary/50 bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/20">Về kỳ này</button>}
    </div>
  );
}

// Thẻ sức khỏe một mảng: đồng hồ lớn, trạng thái bằng chữ, dòng nói rõ điều gì đang xảy ra. Bấm để cuộn tới mảng
export function TheSucKhoe({ icon: Ic, ten, giaTri, nhan, tone, gauge, dong, onClick }) {
  const T = ICON_TONE[tone];
  return (
    <button type="button" onClick={onClick} className="flex min-w-0 flex-col items-center gap-1.5 rounded-xl border bg-card p-3 text-center transition-all hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <div className="flex w-full min-w-0 flex-wrap items-center gap-1.5 text-xs font-semibold text-muted-foreground">{Ic && <Ic className="h-4 w-4 shrink-0 text-primary" />}<span className="truncate">{ten}</span>
        <span className={cn("ml-auto inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[0.625rem] font-semibold", tone ? NHAN_TONE[tone] : "bg-muted text-muted-foreground")}>{T && <T className="h-3 w-3" />}{tone ? TEN_TONE[tone] : "Chưa có số liệu"}</span>
      </div>
      <Gauge {...gauge} size={136} duoi={nhan}><span className={cn("text-[1.3rem] font-semibold tabular-nums tracking-tight", CHU[tone])}>{giaTri}</span></Gauge>
      <div className="min-h-[28px] text-[0.6875rem] leading-snug text-muted-foreground">{dong}</div>
    </button>
  );
}

// Một mảng của trang: dải tiêu đề có ảnh nền minh họa, thu gọn / mở được
export function MangTQ({ id, icon: Ic, ten, mota, loai, tone, thu, onThu, kpi, children }) {
  return (
    <section id={id} className="scroll-mt-16 overflow-hidden rounded-2xl border bg-card/60">
      <button type="button" onClick={onThu} aria-expanded={!thu}
        className="relative flex w-full items-center gap-3 border-b bg-card px-4 py-3 text-left">
        <AnhMang loai={loai} className="text-primary opacity-[0.07]" />
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">{Ic && <Ic className="h-5 w-5" />}</span>
        <span className="relative min-w-0 flex-1">
          <span className="flex items-center gap-2 text-base font-semibold">{ten}
            {tone && <span className={cn("rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide", tone === "bad" ? "bg-bad/15 text-bad" : tone === "warn" ? "bg-warn/15 text-warn" : "bg-ok/15 text-ok")}>{TEN_TONE[tone]}</span>}
          </span>
          <span className="block truncate text-xs text-muted-foreground">{mota}</span>
        </span>
        <ChevronDown className={cn("relative h-5 w-5 shrink-0 text-muted-foreground transition-transform", thu && "-rotate-90")} />
      </button>
      {!thu && <div className="grid gap-3 p-3">
        {kpi && <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">{kpi}</div>}
        {children}
      </div>}
    </section>
  );
}

// Danh sách "Cần xử lý ngay": mỗi dòng một vấn đề, đỏ trước vàng, bấm để tới nơi xử lý
const NHAN_MANG = { sanluong: "Sản lượng", cauben: "Cầu bến", kho: "Kho bãi", thietbi: "Thiết bị" };
export function DaiVanDe({ ds, onMo, tongCanhBao, onXemCanhBao }) {
  const khan = ds.filter((x) => x.muc === "bad").length;
  return (
    <div className="flex min-w-0 flex-col rounded-xl border bg-card p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
        {ds.length ? <Siren className={cn("h-4 w-4", khan ? "text-bad" : "text-warn")} /> : <CheckCircle2 className="h-4 w-4 text-ok" />}
        Cần xử lý ngay
        <span className="ml-auto flex items-center gap-1.5 text-[0.6875rem] font-normal">
          {khan > 0 && <span className="rounded-full bg-bad/15 px-2 py-0.5 font-semibold text-bad">{khan} khẩn</span>}
          {ds.length - khan > 0 && <span className="rounded-full bg-warn/15 px-2 py-0.5 font-semibold text-warn">{ds.length - khan} chú ý</span>}
        </span>
      </div>
      {ds.length ? (
        <ul className="grid max-h-[236px] gap-1 overflow-y-auto pr-1 [scrollbar-width:thin]">
          {ds.map((x, i) => (
            <li key={i}>
              <button type="button" onClick={() => onMo(x.dich)} className="flex w-full items-start gap-2 rounded-lg border border-transparent px-2 py-1.5 text-left text-xs transition-colors hover:border-border hover:bg-accent/60">
                <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", x.muc === "bad" ? "bg-bad" : "bg-warn")} />
                <span className="min-w-0 flex-1"><span className="mr-1.5 rounded bg-muted px-1 py-px text-[0.6875rem] font-semibold uppercase text-muted-foreground">{NHAN_MANG[x.mang]}</span>{x.nd}</span>
                <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </button>
            </li>))}
        </ul>
      ) : <div className="rounded-lg bg-ok/5 px-3 py-4 text-center text-xs text-ok">Mọi chỉ số đang trong ngưỡng an toàn.</div>}
      <div className="mt-2 flex items-center gap-3 text-[0.6875rem]">
        {tongCanhBao > 0 && <button type="button" onClick={onXemCanhBao} className="ml-auto text-muted-foreground hover:text-primary hover:underline">Chuông cảnh báo chi tiết ({tongCanhBao})</button>}
      </div>
    </div>
  );
}
