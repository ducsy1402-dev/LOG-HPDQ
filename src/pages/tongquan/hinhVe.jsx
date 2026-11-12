import { cn } from "@/lib/utils";
import { pct } from "@/lib/format";
import { MAU } from "./khung";

// Hình vẽ minh họa của Tổng quan (SVG tự vẽ, không cần file ảnh): đồng hồ đo, biểu tượng tàu / cẩu / xe / kho,
// ảnh nền từng mảng, sơ đồ bãi chứa có mực hàng, bảng đội xe từng chiếc.
export const MAU_TONE = { ok: MAU.ok, warn: MAU.warn, bad: MAU.bad, info: MAU.info, primary: MAU.primary };

// ---------- Đồng hồ đo (nửa vòng) ----------
const diem = (cx, cy, r, t) => { const a = Math.PI * (1 - t); return [cx + r * Math.cos(a), cy - r * Math.sin(a)]; };
const cung = (cx, cy, r, t0, t1) => { const [x0, y0] = diem(cx, cy, r, t0), [x1, y1] = diem(cx, cy, r, t1); return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`; };
// v: 0..max (mặc định 1 = 100%); vung: [[từ, đến, màu]] các vùng nền (xanh / vàng / đỏ); mau: màu kim;
// children: số lớn, đặt sát đường đáy của cung (chỗ lòng cung rộng nhất) để không đè lên cung; duoi: dòng chữ nhỏ nằm DƯỚI đồng hồ
export function Gauge({ v, max = 1, vung = [], mau = MAU.primary, size = 132, className, children, duoi }) {
  const t = v == null || !Number.isFinite(v) ? 0 : Math.max(0, Math.min(1, v / max));
  const [kx, ky] = diem(60, 60, 46, t);
  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className="relative" style={{ width: size, height: size * 0.6 }}>
        <svg viewBox="0 0 120 72" className="absolute inset-0 h-full w-full" aria-hidden>
          <path d={cung(60, 60, 46, 0, 1)} fill="none" stroke="currentColor" strokeOpacity={0.1} strokeWidth={7} strokeLinecap="round" />
          {vung.map(([a, b, c], i) => <path key={i} d={cung(60, 60, 53, a / max, Math.min(1, b / max))} fill="none" stroke={c} strokeOpacity={0.5} strokeWidth={2} />)}
          {t > 0 && <path d={cung(60, 60, 46, 0, t)} fill="none" stroke={mau} strokeWidth={7} strokeLinecap="round" />}
          {v != null && <circle cx={kx} cy={ky} r={3.6} fill="hsl(var(--card))" stroke={mau} strokeWidth={2} />}
        </svg>
        <div className="absolute inset-x-0 flex justify-center leading-none" style={{ bottom: "16%" }}>{children}</div>
      </div>
      {duoi && <div className="mt-1 text-[0.6875rem] leading-tight text-muted-foreground">{duoi}</div>}
    </div>
  );
}

// ---------- Biểu tượng nhỏ (24 x 24) ----------
const Svg = ({ children, className }) => <svg viewBox="0 0 24 24" className={cn("h-5 w-5", className)} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{children}</svg>;
export const IcTau = (p) => <Svg {...p}><path d="M2.5 15h19l-2.6 4.5H5.4z" /><path d="M6 15V10.5h9V15M9 10.5V7.5h4v3M11 7.5V5" /></Svg>;
export const IcCau = (p) => <Svg {...p}><path d="M4 21V9l8-5 8 5v12" /><path d="M4 9h16M12 4v17M8 21v-6M16 21v-6" /></Svg>;
export const IcXe = (p) => <Svg {...p}><path d="M2.5 17V8h10v9M12.5 11h4.3l3 3.2V17h-7.3" /><circle cx="7" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /></Svg>;
export const IcKho = (p) => <Svg {...p}><path d="M3 10l9-6 9 6v10H3z" /><path d="M8 20v-6h8v6M8 17h8" /></Svg>;
export const IcSanLuong = (p) => <Svg {...p}><path d="M4 20V10M10 20V5M16 20v-7M22 20H2" /><path d="M3 8l6-4 5 4 7-5" /></Svg>;
export const IcDongHo = (p) => <Svg {...p}><path d="M4.5 18a8.5 8.5 0 1 1 15 0" /><path d="M12 13l4-4" /><circle cx="12" cy="14" r="1.2" /></Svg>;

// ---------- Ảnh nền từng mảng (SVG phủ góc phải thẻ mảng) ----------
export function AnhMang({ loai, className }) {
  const song = <path d="M0 78 q12-6 25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 V100H0z" fill="currentColor" opacity=".35" />;
  const ve = {
    sanluong: <>
      {song}
      <path d="M170 76h150l-14 14H184z" fill="currentColor" opacity=".7" /><rect x="190" y="58" width="22" height="18" fill="currentColor" opacity=".55" /><rect x="214" y="58" width="22" height="18" fill="currentColor" opacity=".4" /><rect x="238" y="58" width="22" height="18" fill="currentColor" opacity=".55" /><rect x="262" y="62" width="30" height="14" fill="currentColor" opacity=".5" />
      <path d="M120 80V30h60M120 30l-30 22M150 30v20" stroke="currentColor" strokeWidth="3" opacity=".6" fill="none" /><path d="M20 80l30-26 30 26z" fill="currentColor" opacity=".45" /><path d="M0 80l24-18 24 18z" fill="currentColor" opacity=".3" />
    </>,
    cauben: <>
      {song}
      <path d="M0 62h400v6H0z" fill="currentColor" opacity=".55" /><path d="M60 62v-34h46M60 28l-24 20M90 28v18M84 28v-8h12v8" stroke="currentColor" strokeWidth="3" fill="none" opacity=".65" />
      <path d="M180 76h170l-16 14H196z" fill="currentColor" opacity=".7" /><rect x="214" y="52" width="70" height="24" fill="currentColor" opacity=".45" /><rect x="228" y="40" width="26" height="12" fill="currentColor" opacity=".55" /><path d="M244 40V26" stroke="currentColor" strokeWidth="3" opacity=".6" />
      {[130, 160, 190, 220].map((x) => <circle key={x} cx={x} cy="60" r="3" fill="currentColor" opacity=".7" />)}
    </>,
    kho: <>
      <path d="M0 86h400" stroke="currentColor" strokeWidth="2" opacity=".4" />
      <path d="M40 86V44l50-24 50 24v42z" fill="currentColor" opacity=".5" /><rect x="76" y="58" width="28" height="28" fill="currentColor" opacity=".35" />
      <path d="M170 86l36-44 36 44z" fill="currentColor" opacity=".55" /><path d="M230 86l28-30 28 30z" fill="currentColor" opacity=".4" /><path d="M296 86l24-22 24 22z" fill="currentColor" opacity=".5" />
      <path d="M350 86V50h8v36" stroke="currentColor" strokeWidth="3" opacity=".5" />
    </>,
    thietbi: <>
      <path d="M0 86h400" stroke="currentColor" strokeWidth="2" opacity=".4" />
      <path d="M30 84h56v-12H30z M42 72V56h26l10 16" fill="currentColor" opacity=".55" /><circle cx="42" cy="86" r="7" fill="currentColor" opacity=".7" /><circle cx="74" cy="86" r="7" fill="currentColor" opacity=".7" />
      <path d="M120 84V40l50-14M170 26l30 24" stroke="currentColor" strokeWidth="5" fill="none" opacity=".55" strokeLinecap="round" /><path d="M200 50l12 14h-24z" fill="currentColor" opacity=".6" />
      <rect x="260" y="56" width="70" height="28" fill="currentColor" opacity=".45" /><rect x="330" y="64" width="30" height="20" fill="currentColor" opacity=".55" /><circle cx="278" cy="86" r="7" fill="currentColor" opacity=".7" /><circle cx="346" cy="86" r="7" fill="currentColor" opacity=".7" />
    </>,
  }[loai];
  return <svg viewBox="0 0 400 100" preserveAspectRatio="xMaxYMax slice" className={cn("pointer-events-none absolute inset-0 h-full w-full", className)} aria-hidden>{ve}</svg>;
}

// ---------- Sơ đồ bãi: mỗi bãi lớn là một bể, mực hàng dâng theo tỉ lệ lấp đầy ----------
// bai: [{ ten_bai, ton, sucChua, lapDay }]
export function SoDoBai({ bai, tone, nhan, onBai }) {
  if (!bai.length) return <div className="py-6 text-center text-xs text-muted-foreground">Chưa có bãi nào.</div>;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {bai.map((b, i) => {
        const t = tone(b), mau = MAU_TONE[t] || MAU.primary, p = b.lapDay != null ? Math.min(1, b.lapDay) : null, muc = 58 * (p ?? 0.18);
        return (
          <button key={b.ten_bai} type="button" onClick={onBai ? () => onBai(b) : undefined} title={`${b.ten_bai}: tồn ${Math.round(b.ton).toLocaleString("vi-VN")} t${b.sucChua > 0 ? ` / sức chứa ${Math.round(b.sucChua).toLocaleString("vi-VN")} t` : " (chưa khai báo sức chứa)"}`}
            className="group relative overflow-hidden rounded-lg border bg-card/60 p-2 text-left transition-all hover:-translate-y-0.5 hover:border-primary/50">
            <svg viewBox="0 0 200 64" className="h-[58px] w-full" aria-hidden>
              <defs><clipPath id={`bt${i}`}><rect x="2" y="2" width="196" height="60" rx="6" /></clipPath></defs>
              <rect x="2" y="2" width="196" height="60" rx="6" fill="currentColor" fillOpacity=".07" stroke="currentColor" strokeOpacity=".25" />
              <g clipPath={`url(#bt${i})`}>
                <path d={`M0 ${62 - muc} q25-5 50 0 t50 0 t50 0 t50 0 t50 0 V64 H0z`} fill={mau} fillOpacity={p == null ? 0.25 : 0.55} />
                <path d={`M-10 ${64 - muc} q30 5 60 0 t60 0 t60 0 t60 0 t60 0 V64 H-10z`} fill={mau} fillOpacity=".3" />
              </g>
              <text x="100" y="38" textAnchor="middle" fontSize="17" fontWeight="700" fill="currentColor">{p == null ? "—" : pct(b.lapDay)}</text>
              {b.lapDay > 1 && <text x="100" y="52" textAnchor="middle" fontSize="8" fontWeight="600" fill={MAU.bad}>VƯỢT SỨC CHỨA</text>}
            </svg>
            <div className="mt-1 truncate text-[0.6875rem] font-semibold">{b.ten_bai}</div>
            <div className="truncate text-[0.6875rem] text-muted-foreground">{nhan(b)}</div>
          </button>);
      })}
    </div>
  );
}

// ---------- Bảng đội xe: mỗi xe một ô vuông, màu theo tình trạng ----------
export const MAU_XE = { ss: MAU.ok, bddk: MAU.info, bdcl: MAU.tim, hong: MAU.bad };
export const TEN_XE = { ss: "Sẵn sàng", bddk: "Bảo dưỡng định kỳ", bdcl: "Bảo dưỡng chiến lược", hong: "Hỏng" };
// nhom: [{ ten, xe: [{ ma, s }] }]
export function BangDoiXe({ nhom, onXe }) {
  if (!nhom.length) return <div className="py-6 text-center text-xs text-muted-foreground">Chưa có thiết bị nào.</div>;
  return (
    <div className="grid gap-2">
      {nhom.map((g) => {
        const dung = g.xe.filter((x) => x.s === "hong" || x.s === "bdcl").length;
        return (
          <div key={g.ten} className="rounded-md border bg-card/40 p-2">
            <div className="mb-1.5 flex items-center gap-2 text-xs"><b>{g.ten}</b><span className="text-muted-foreground">{g.xe.length - dung}/{g.xe.length} sẵn sàng</span>{dung > 0 && <span className="font-medium text-bad">{dung} dừng</span>}</div>
            <div className="flex flex-wrap gap-1">
              {g.xe.map((x) => (
                <button key={x.ma} type="button" onClick={onXe ? () => onXe(x.ma) : undefined} title={`${x.ma} · ${TEN_XE[x.s]}`}
                  className="h-[18px] min-w-[18px] rounded-[4px] px-0.5 text-[0.6875rem] font-bold leading-[18px] text-black/70 transition-transform hover:scale-125" style={{ background: MAU_XE[x.s] }}>{x.s === "ss" ? "" : x.s === "hong" ? "!" : x.s === "bdcl" ? "B" : "·"}</button>))}
            </div>
          </div>);
      })}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[0.6875rem] text-muted-foreground">{Object.entries(TEN_XE).map(([k, t]) => <span key={k} className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: MAU_XE[k] }} />{t}</span>)}</div>
    </div>
  );
}
