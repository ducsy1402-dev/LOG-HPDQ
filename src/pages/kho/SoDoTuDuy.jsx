import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronsDownUp, ChevronsUpDown, Ship } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { so, pct, ngayNam } from "@/lib/format";
import { NGUONG_KHO } from "@/lib/kho";
import { cn } from "@/lib/utils";
import { KIEU_TONE, KIEU_NGAN, Thanh } from "./khoUi";

// Tab Sơ đồ bãi dạng sơ đồ tư duy: kho ở giữa, các bãi lớn tỏa sang hai bên (màn hình hẹp: một bên), mỗi bãi lớn nối tới các bãi nhỏ.
// Màu nút và đường nối theo mức lấp đầy (xanh < vàng < đỏ như thanh lấp đầy). Bấm bãi lớn để xem chi tiết; nút mũi tên thu gọn / mở bãi nhỏ.
const W = { goc: 190, bai: 200, la: 210 };          // bề rộng nút
const H = { goc: 104, bai: 112, la: 44 };           // chiều cao nút
const KC = { cot: 40, la: 6, bai: 16, le: 12 };      // khoảng cách: giữa các cột, giữa lá, giữa nhánh bãi lớn, lề
const MAU = { ok: "#10b981", warn: "#f59e0b", bad: "#f43f5e", xam: "#64748b" };
const mucDay = (p) => (p == null ? "xam" : p > 1.0001 || p >= NGUONG_KHO.do ? "bad" : p >= NGUONG_KHO.vang ? "warn" : "ok");
const vien = { ok: "border-ok/50", warn: "border-warn/70", bad: "border-bad/70", xam: "border-border" };
const chu = { ok: "text-ok", warn: "text-warn", bad: "text-bad", xam: "text-muted-foreground" };

export default function SoDoTuDuy({ bai, kho, ten, tp, onMo }) {
  const khung = useRef();
  const [rong, setRong] = useState(1200);
  useLayoutEffect(() => {
    const el = khung.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setRong(e.contentRect.width)); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [dong, setDong] = useState(() => new Set()); // bãi lớn đang thu gọn
  useEffect(() => { setDong((o) => new Set([...o].filter((x) => bai.some((b) => b.ten_bai === x)))); }, [bai]);
  const thuGon = (t) => setDong((o) => { const n = new Set(o); if (n.has(t)) n.delete(t); else n.add(t); return n; });
  const ds = useMemo(() => [...bai].sort((a, b) => (b.lapDay ?? -1) - (a.lapDay ?? -1)), [bai]);

  // Bố cục: hai bên nếu đủ rộng, một bên (sang phải) nếu hẹp
  const haiBen = rong >= W.la * 2 + W.bai * 2 + W.goc + KC.cot * 4 + KC.le * 2;
  const bd = useMemo(() => {
    const khoi = ds.map((b) => {
      const n = dong.has(b.ten_bai) ? 0 : b.dong.length;
      const laH = n ? n * H.la + (n - 1) * KC.la : 0;
      return { b, n, laH, h: Math.max(H.bai, laH) };
    });
    // Chia hai bên cho cân chiều cao, giữ thứ tự (bãi đầy nhất ở trên)
    const ben = { phai: [], trai: [] }, cao = { phai: 0, trai: 0 };
    for (const k of khoi) { const s = !haiBen || cao.phai <= cao.trai ? "phai" : "trai"; ben[s].push(k); cao[s] += k.h + (ben[s].length > 1 ? KC.bai : 0); }
    const tongH = Math.max(cao.phai, cao.trai, H.goc) + KC.le * 2;
    const x = haiBen
      ? { laT: KC.le, baiT: KC.le + W.la + KC.cot, goc: KC.le + W.la + W.bai + KC.cot * 2, baiP: KC.le + W.la + W.bai + W.goc + KC.cot * 3, laP: KC.le + W.la + W.bai * 2 + W.goc + KC.cot * 4 }
      : { goc: KC.le, baiP: KC.le + W.goc + KC.cot, laP: KC.le + W.goc + W.bai + KC.cot * 2 };
    const tongW = haiBen ? x.laP + W.la + KC.le : x.laP + W.la + KC.le;
    const gocY = tongH / 2 - H.goc / 2;
    const nut = [];
    for (const s of ["phai", "trai"]) {
      let y = tongH / 2 - cao[s] / 2;
      for (const k of ben[s]) {
        const baiY = y + k.h / 2 - H.bai / 2, laY0 = y + k.h / 2 - k.laH / 2;
        nut.push({ ...k, ben: s, x: s === "phai" ? x.baiP : x.baiT, y: baiY,
          la: k.n ? k.b.dong.map((d, i) => ({ d, x: s === "phai" ? x.laP : x.laT, y: laY0 + i * (H.la + KC.la) })) : [] });
        y += k.h + KC.bai;
      }
    }
    return { nut, tongH, tongW, goc: { x: x.goc, y: gocY } };
  }, [ds, dong, haiBen]);

  // Đường nối cong từ (x1, y1) tới (x2, y2)
  const cong = (x1, y1, x2, y2) => { const dx = (x2 - x1) / 2; return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`; };
  const ton = ds.reduce((s, b) => s + b.ton, 0), suc = ds.reduce((s, b) => s + (b.sucChua || 0), 0), lap = suc > 0 ? ton / suc : null;
  const soNho = ds.reduce((s, b) => s + b.dong.length, 0);
  const gx = bd.goc.x, gy = bd.goc.y;

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Button size="xs" variant="outline" onClick={() => setDong(new Set())}><ChevronsUpDown />Mở tất cả</Button>
        <Button size="xs" variant="outline" onClick={() => setDong(new Set(ds.map((b) => b.ten_bai)))}><ChevronsDownUp />Thu gọn tất cả</Button>
        <span className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1"><i className="h-2.5 w-4 rounded-sm" style={{ background: MAU.ok }} />Dưới {pct(NGUONG_KHO.vang)}</span>
          <span className="inline-flex items-center gap-1"><i className="h-2.5 w-4 rounded-sm" style={{ background: MAU.warn }} />Từ {pct(NGUONG_KHO.vang)}</span>
          <span className="inline-flex items-center gap-1"><i className="h-2.5 w-4 rounded-sm" style={{ background: MAU.bad }} />Từ {pct(NGUONG_KHO.do)}</span>
          <span>Bấm bãi lớn để xem chi tiết · mũi tên để thu gọn / mở bãi nhỏ</span>
        </span>
      </div>
      <div ref={khung} className="scroll-x rounded-lg border bg-card/40">
        <div className="relative" style={{ width: Math.max(bd.tongW, 1), height: bd.tongH }}>
          <svg className="pointer-events-none absolute inset-0" width={bd.tongW} height={bd.tongH} aria-hidden="true">
            {bd.nut.map((k) => {
              const phai = k.ben === "phai", m = MAU[mucDay(k.b.lapDay)];
              const x1 = phai ? gx + W.goc : gx, y1 = gy + H.goc / 2, x2 = phai ? k.x : k.x + W.bai, y2 = k.y + H.bai / 2;
              return (
                <g key={k.b.ten_bai}>
                  <path d={cong(x1, y1, x2, y2)} fill="none" stroke={m} strokeOpacity="0.75" strokeWidth="3" />
                  {k.la.map(({ d, x, y }) => {
                    const a = phai ? k.x + W.bai : k.x, b = phai ? x : x + W.la;
                    return <path key={d.key} d={cong(a, y2, b, y + H.la / 2)} fill="none" stroke={d.saiBai ? MAU.bad : MAU[mucDay(d.lapDay)]} strokeOpacity="0.55" strokeWidth="1.6" />;
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
          {bd.nut.map((k) => {
            const b = k.b, l = kho.luuLuong.bai.get(b.ten_bai), muc = mucDay(b.lapDay), phai = k.ben === "phai", thu = dong.has(b.ten_bai);
            const trong = kho.choTrong(b.ten_bai), tauVe = (l?.tau || []).reduce((s, t) => s + t.con, 0), tauVuot = trong != null && tauVe > trong;
            const ganDay = l?.trangThaiDay === "da_day" || (l?.trangThaiDay === "tang" && l.ngayDay < NGUONG_KHO.ngayDayVang);
            const Mui = (phai ? !thu : thu) ? ChevronLeft : ChevronRight;
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
                    style={{ left: phai ? k.x + W.bai - 10 : k.x - 10, top: k.y + H.bai / 2 - 10 }}>
                    {thu ? <span className="text-[9px] font-bold">{b.dong.length}</span> : <Mui className="h-3.5 w-3.5" />}
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
  );
}
