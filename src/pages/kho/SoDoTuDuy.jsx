import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, ChevronsDownUp, ChevronsUpDown, Maximize2, Minus, Plus, Ship } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { so, pct, ngayNam } from "@/lib/format";
import { NGUONG_KHO } from "@/lib/kho";
import { cn } from "@/lib/utils";
import { KIEU_TONE, KIEU_NGAN, Thanh } from "./khoUi";

// Tab Sơ đồ bãi dạng sơ đồ tư duy KHỔ NGANG: kho ở góc trên trái, một đường ngang chung nối xuống các bãi lớn xếp thành một hàng ngang bên dưới, mỗi bãi lớn nối xuống
// các bãi nhỏ của nó. Màu nút và đường nối theo mức lấp đầy (xanh < vàng < đỏ như thanh lấp đầy). Bấm bãi lớn để xem chi tiết; nút mũi tên
// thu gọn / mở bãi nhỏ. Cuộn ngang để xem hết, hoặc thu nhỏ / "Vừa khung" để xem cả sơ đồ trong một màn hình.
const W = { goc: 220, bai: 216, la: 196 };            // bề rộng nút
const H = { goc: 104, bai: 112, la: 44 };             // chiều cao nút
const KC = { le: 14, ngang: 14, cao: 56, doc: 18, la: 6 }; // lề, khoảng giữa các nhánh, từ kho xuống bãi lớn, từ bãi lớn xuống bãi nhỏ, giữa các bãi nhỏ
const LA_X = 20;                                      // bãi nhỏ thụt vào so với mép trái nhánh
const MAU = { ok: "#10b981", warn: "#f59e0b", bad: "#f43f5e", xam: "#64748b" };
const mucDay = (p) => (p == null ? "xam" : p > 1.0001 || p >= NGUONG_KHO.do ? "bad" : p >= NGUONG_KHO.vang ? "warn" : "ok");
const vien = { ok: "border-ok/50", warn: "border-warn/70", bad: "border-bad/70", xam: "border-border" };
const chu = { ok: "text-ok", warn: "text-warn", bad: "text-bad", xam: "text-muted-foreground" };
const ZOOM_MIN = 0.35, ZOOM_MAX = 1.3;

export default function SoDoTuDuy({ bai, kho, ten, tp, onMo }) {
  const khung = useRef();
  const [rong, setRong] = useState(1200);
  useLayoutEffect(() => {
    const el = khung.current; if (!el) return;
    setRong(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setRong(e.contentRect.width)); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [dong, setDong] = useState(() => new Set()); // bãi lớn đang thu gọn (các bãi không còn trong danh sách bị bỏ qua)
  const [zoom, setZoom] = useState(1);
  const thuGon = (t) => setDong((o) => { const n = new Set(o); if (n.has(t)) n.delete(t); else n.add(t); return n; });
  const ds = useMemo(() => [...bai].sort((a, b) => (b.lapDay ?? -1) - (a.lapDay ?? -1)), [bai]);

  // Bố cục: một hàng nhánh, mỗi nhánh = bãi lớn ở trên, các bãi nhỏ xếp dọc bên dưới
  const bd = useMemo(() => {
    const cot = W.bai + KC.ngang, y0 = KC.le + H.goc + KC.cao;
    const nhanh = ds.map((b, i) => {
      const n = dong.has(b.ten_bai) ? 0 : b.dong.length;
      const x = KC.le + i * cot;
      return { b, n, x, y: y0, h: H.bai + (n ? KC.doc + n * H.la + (n - 1) * KC.la : 0),
        la: n ? b.dong.map((d, j) => ({ d, x: x + LA_X, y: y0 + H.bai + KC.doc + j * (H.la + KC.la) })) : [] };
    });
    const tongW = Math.max(KC.le * 2 + ds.length * cot - KC.ngang, W.goc + KC.le * 2);
    const tongH = y0 + Math.max(H.bai, ...nhanh.map((k) => k.h)) + KC.le;
    return { nhanh, tongW, tongH, goc: { x: KC.le, y: KC.le } };
  }, [ds, dong]);

  const ton = ds.reduce((s, b) => s + b.ton, 0), suc = ds.reduce((s, b) => s + (b.sucChua || 0), 0), lap = suc > 0 ? ton / suc : null;
  const soNho = ds.reduce((s, b) => s + b.dong.length, 0);
  const gx = bd.goc.x, gy = bd.goc.y, busY = gy + H.goc + KC.cao / 2; // đường ngang chung nối kho với các bãi lớn
  bd.nhanh.forEach((k, i) => { k.truocX = i ? bd.nhanh[i - 1].x + W.bai / 2 : gx + W.goc / 2; });
  const datZoom = (z) => setZoom(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100)));
  const vuaKhung = () => datZoom((rong - 4) / bd.tongW);

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Button size="xs" variant="outline" onClick={() => setDong(new Set())}><ChevronsUpDown />Mở tất cả</Button>
        <Button size="xs" variant="outline" onClick={() => setDong(new Set(ds.map((b) => b.ten_bai)))}><ChevronsDownUp />Thu gọn tất cả</Button>
        <div className="inline-flex items-center gap-0.5 rounded-md border p-0.5" role="group" aria-label="Thu phóng sơ đồ">
          <Button size="icon" variant="ghost" className="h-6 w-6" disabled={zoom <= ZOOM_MIN} onClick={() => datZoom(zoom - 0.1)} aria-label="Thu nhỏ"><Minus /></Button>
          <button type="button" className="w-12 text-center text-xs tabular-nums hover:text-foreground" onClick={() => setZoom(1)} title="Về cỡ thật (100%)">{Math.round(zoom * 100)}%</button>
          <Button size="icon" variant="ghost" className="h-6 w-6" disabled={zoom >= ZOOM_MAX} onClick={() => datZoom(zoom + 0.1)} aria-label="Phóng to"><Plus /></Button>
        </div>
        <Button size="xs" variant="outline" onClick={vuaKhung} title="Thu cả sơ đồ vừa chiều ngang khung"><Maximize2 />Vừa khung</Button>
        <span className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1"><i className="h-2.5 w-4 rounded-sm" style={{ background: MAU.ok }} />Dưới {pct(NGUONG_KHO.vang)}</span>
          <span className="inline-flex items-center gap-1"><i className="h-2.5 w-4 rounded-sm" style={{ background: MAU.warn }} />Từ {pct(NGUONG_KHO.vang)}</span>
          <span className="inline-flex items-center gap-1"><i className="h-2.5 w-4 rounded-sm" style={{ background: MAU.bad }} />Từ {pct(NGUONG_KHO.do)}</span>
          <span>Bấm bãi lớn để xem chi tiết · mũi tên dưới bãi lớn để thu gọn / mở bãi nhỏ</span>
        </span>
      </div>
      <div ref={khung} className="scroll-x rounded-lg border bg-card/40">
        <div style={{ width: bd.tongW * zoom, height: bd.tongH * zoom }}>
          <div className="relative origin-top-left" style={{ width: bd.tongW, height: bd.tongH, transform: `scale(${zoom})` }}>
            <svg className="pointer-events-none absolute inset-0" width={bd.tongW} height={bd.tongH} aria-hidden="true">
              <path d={`M${gx + W.goc / 2},${gy + H.goc} V${busY}`} fill="none" stroke={MAU[mucDay(lap)]} strokeOpacity="0.8" strokeWidth="3" />
              {bd.nhanh.map((k) => {
                const m = MAU[mucDay(k.b.lapDay)], cx = k.x + W.bai / 2, truc = k.x + 10;
                const cuoi = k.la.length ? k.la[k.la.length - 1].y + H.la / 2 : 0;
                return (
                  <g key={k.b.ten_bai}>
                    <path d={`M${k.truocX},${busY} H${cx} V${k.y}`} fill="none" stroke={m} strokeOpacity="0.8" strokeWidth="3" strokeLinejoin="round" />
                    {k.la.length > 0 && <path d={`M${truc},${k.y + H.bai} V${cuoi}`} fill="none" stroke={m} strokeOpacity="0.55" strokeWidth="1.6" />}
                    {k.la.map(({ d, x, y }) => {
                      const my = y + H.la / 2, mc = d.saiBai ? MAU.bad : MAU[mucDay(d.lapDay)];
                      return <path key={d.key} d={`M${truc},${my - 6} Q${truc},${my} ${truc + 6},${my} H${x}`} fill="none" stroke={mc} strokeOpacity="0.6" strokeWidth="1.6" />;
                    })}
                  </g>);
              })}
            </svg>

            {/* Nút gốc: cả kho */}
            <div className={cn("absolute grid content-center gap-1 rounded-2xl border-2 bg-card px-3 py-2 shadow-md", vien[mucDay(lap)])} style={{ left: gx, top: gy, width: W.goc, height: H.goc }}>
              <div className="truncate text-sm font-bold">{ten}</div>
              <Thanh p={lap} className="h-2" />
              <div className="flex justify-between text-[11px] tabular-nums"><span>{so(ton)} t</span><span className={cn("font-semibold", chu[mucDay(lap)])}>{lap != null ? pct(lap) : "—"}</span></div>
              <div className="text-[11px] text-muted-foreground">{ds.length} bãi lớn · {soNho} bãi nhỏ{suc ? ` · SC ${so(suc)} t` : ""}</div>
            </div>

            {/* Bãi lớn và bãi nhỏ */}
            {bd.nhanh.map((k) => {
              const b = k.b, l = kho.luuLuong.bai.get(b.ten_bai), muc = mucDay(b.lapDay), thu = dong.has(b.ten_bai);
              const trong = kho.choTrong(b.ten_bai), tauVe = (l?.tau || []).reduce((s, t) => s + t.con, 0), tauVuot = trong != null && tauVe > trong;
              const ganDay = l?.trangThaiDay === "da_day" || (l?.trangThaiDay === "tang" && l.ngayDay < NGUONG_KHO.ngayDayVang);
              return (
                <div key={b.ten_bai}>
                  <div role="button" tabIndex={0} onClick={() => onMo(b.ten_bai)} onKeyDown={(e) => e.key === "Enter" && onMo(b.ten_bai)}
                    title={`${b.ten_bai}: tồn ${so(b.ton)} t${b.sucChua ? ` / ${so(b.sucChua)} t` : ""}${l ? ` · nhập +${so(l.nhap)} / xuất −${so(l.xuat)} t/ngày (${l.soNgay} ngày)` : ""}${b.dienTich ? ` · ${so(b.dienTich)} m²` : ""}`}
                    className={cn("absolute grid cursor-pointer content-center gap-1 rounded-xl border-2 bg-card px-2.5 py-1.5 shadow-sm transition-colors hover:bg-accent", vien[muc])}
                    style={{ left: k.x, top: k.y, width: W.bai, height: H.bai }}>
                    <b className="truncate text-[13px]">{b.ten_bai}</b>
                    <Thanh p={b.lapDay} className="h-2" />
                    <div className="flex justify-between text-[11px] tabular-nums"><span>{so(b.ton)} t</span><span className={cn("font-semibold", chu[muc])}>{b.lapDay != null ? `${pct(b.lapDay)}${b.sucChua ? ` / ${so(b.sucChua)}` : ""}` : "chưa có sức chứa"}</span></div>
                    {l?.kieu && <div className="truncate"><Badge tone={KIEU_TONE[l.kieu.ma]} className="px-1.5 py-0 text-[10px] font-medium" title={l.kieu.chiTiet}>{l.kieu.ten}</Badge></div>}
                    <div className="flex items-center gap-2 truncate text-[10px] text-muted-foreground">
                      {ganDay ? <span className="font-semibold text-warn">{l.trangThaiDay === "da_day" ? "Đã đầy" : `Đầy ${ngayNam(l.luc).slice(0, 5)} · ${so(l.ngayDay, 1)} ngày`}</span> : <span>{b.dong.length} bãi nhỏ</span>}
                      {l?.tau?.length > 0 && <span className={cn("inline-flex items-center gap-0.5", tauVuot && "font-semibold text-bad")} title={l.tau.map((t) => `${t.ten} ${so(t.con)} t`).join(", ")}><Ship className="h-3 w-3" />{l.tau.length} tàu {so(tauVe)} t</span>}
                    </div>
                  </div>
                  {b.dong.length > 0 && (
                    <button type="button" onClick={() => thuGon(b.ten_bai)} title={thu ? "Mở bãi nhỏ" : "Thu gọn bãi nhỏ"} aria-label={thu ? `Mở bãi nhỏ của ${b.ten_bai}` : `Thu gọn bãi nhỏ của ${b.ten_bai}`}
                      className={cn("absolute z-10 flex h-5 w-5 items-center justify-center rounded-full border bg-card text-muted-foreground shadow hover:text-foreground", thu && "border-primary text-primary")}
                      style={{ left: k.x + W.bai / 2 - 10, top: k.y + H.bai - 10 }}>
                      {thu ? <span className="text-[9px] font-bold">{b.dong.length}</span> : <ChevronUp className="h-3.5 w-3.5" />}
                    </button>)}
                  {k.la.map(({ d, x, y }) => {
                    const m = d.saiBai ? "bad" : mucDay(d.lapDay), capMuc = d.ngayCap == null ? null : d.ngayCap < NGUONG_KHO.ngayCapDo ? "bad" : d.ngayCap < NGUONG_KHO.ngayCapVang ? "warn" : "xam";
                    return (
                      <div key={d.key} className={cn("absolute grid content-center gap-0.5 rounded-lg border bg-card px-2 py-1", vien[m], d.saiBai && "bg-bad/5")} style={{ left: x, top: y, width: W.la, height: H.la }}
                        title={`${d.ten}${d.hang && d.hang !== d.ten ? ` (${d.hang})` : ""}: tồn ${so(d.ton)} t${d.sucChua ? ` / ${so(d.sucChua)} t` : ""}${d.ngayCap != null ? ` · đủ cấp ${so(d.ngayCap, 1)} ngày` : ""}${d.saiBai ? " · hàng nằm sai bãi" : ""}`}>
                        <div className="flex items-center gap-1 text-[11px]">
                          <span className={cn("min-w-0 flex-1 truncate font-medium", d.saiBai && "text-bad")}>{d.ten}{d.kieu && d.kieu !== "co_dinh_hang" && <span className="font-normal text-primary"> · {KIEU_NGAN[d.kieu]}</span>}{d.saiBai && " · sai bãi"}</span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">{so(d.ton)} t</span>
                          <span className={cn("w-9 shrink-0 text-right font-semibold tabular-nums", chu[m])}>{d.lapDay != null ? pct(d.lapDay) : "—"}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Thanh p={d.lapDay} className="h-1.5 flex-1" />
                          {!tp && capMuc && <span className={cn("shrink-0 text-[10px] tabular-nums", chu[capMuc], capMuc !== "xam" && "font-semibold")} title="Ngày cấp: tồn của hàng này ÷ tiêu thụ bình quân mỗi ngày">cấp {so(d.ngayCap, 1)} ngày</span>}
                        </div>
                      </div>);
                  })}
                </div>);
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
