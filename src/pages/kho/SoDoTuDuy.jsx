import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ChevronUp, ChevronsDownUp, ChevronsUpDown, Maximize2, Minus, Plus, Ship } from "lucide-react";
import { useApp } from "@/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/input";
import { so, pct, ngayNam } from "@/lib/format";
import { NGUONG_KHO, khaiBaoBai, khoaTenBai } from "@/lib/kho";
import { cn } from "@/lib/utils";
import { KIEU_TONE, KIEU_NGAN, Thanh } from "./khoUi";
import { ThemBaiNho, ThemBaiLon } from "./ThemBai";

// Tab Sơ đồ bãi dạng sơ đồ tư duy KHỔ NGANG: kho ở góc trên trái → các khu vực (cột Phạm vi / Khu vực ở Danh mục › Khai báo kho / bãi) → bãi lớn xếp một hàng ngang
// trong từng khu vực → bãi nhỏ xếp dọc dưới từng bãi lớn. Bộ lọc khu vực để xem gọn từng khu. Màu nút / đường nối theo mức lấp đầy tồn (xanh < vàng < đỏ).
// Thẻ bãi lớn: diện tích phân bổ (tổng diện tích các bãi nhỏ) trên diện tích bãi lớn đã khai báo, đỏ + cảnh báo khi vượt.
// Dấu + (quản trị kho): cuối mỗi bãi lớn thêm bãi nhỏ, cuối mỗi khu vực thêm bãi lớn. Bấm bãi lớn để xem chi tiết; mũi tên thu gọn / mở bãi nhỏ.
const W = { goc: 220, khu: 216, bai: 216, la: 196 };      // bề rộng nút
const H = { goc: 104, khu: 76, bai: 126, la: 44, them: 28 }; // chiều cao nút
const KC = { le: 14, ngang: 14, cao: 56, doc: 18, la: 6, nhomKhu: 30 }; // lề, khoảng giữa các nhánh, giữa các tầng, bãi lớn → bãi nhỏ, giữa các bãi nhỏ, giữa các khu vực
const LA_X = 20;                                          // bãi nhỏ thụt vào so với mép trái nhánh
const MAU = { ok: "#10b981", warn: "#f59e0b", bad: "#f43f5e", xam: "#64748b" };
const mucDay = (p) => (p == null ? "xam" : p > 1.0001 || p >= NGUONG_KHO.do ? "bad" : p >= NGUONG_KHO.vang ? "warn" : "ok");
const mucDT = (p) => (p == null ? "xam" : p > 1.0001 ? "bad" : p >= NGUONG_KHO.vang ? "warn" : "ok");
const vien = { ok: "border-ok/50", warn: "border-warn/70", bad: "border-bad/70", xam: "border-border" };
const chu = { ok: "text-ok", warn: "text-warn", bad: "text-bad", xam: "text-muted-foreground" };
const nenThanh = { ok: "bg-ok", warn: "bg-warn", bad: "bg-bad", xam: "bg-muted-foreground/40" };
const ZOOM_MIN = 0.35, ZOOM_MAX = 1.3;
const KHONG_KHU = "Chưa khai báo khu vực", TAT_CA = "";

export default function SoDoTuDuy({ bai, kho, ten, tp, loai, onMo, coSua }) {
  const { D } = useApp();
  const khung = useRef();
  const [rong, setRong] = useState(1200);
  useLayoutEffect(() => {
    const el = khung.current; if (!el) return;
    setRong(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setRong(e.contentRect.width)); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [dong, setDong] = useState(() => new Set()); // bãi lớn đang thu gọn
  const [zoom, setZoom] = useState(1);
  const [khuChon, setKhuChon] = useState(TAT_CA);   // lọc theo Phạm vi / Khu vực
  const [them, setThem] = useState(null);           // { nho: tên bãi lớn } | { lon: khu vực mặc định }
  const thuGon = (t) => setDong((o) => { const n = new Set(o); if (n.has(t)) n.delete(t); else n.add(t); return n; });
  const khoMoi = (D.khoBai || []).some((r) => "so_lop" in r);

  // Khai báo kho / bãi: khu vực và diện tích của bãi lớn
  const kb = useMemo(() => khaiBaoBai(D.dmBang), [D.dmBang]);
  const khaiBao = (b) => kb.get(khoaTenBai(b.ten_bai));
  const khuCua = (b) => khaiBao(b)?.khuVuc || KHONG_KHU;
  const tongDT = (b) => khaiBao(b)?.dienTich ?? null;
  const dsKhu = useMemo(() => {
    const ks = [...new Set(bai.map(khuCua))];
    return ks.sort((a, b) => (a === KHONG_KHU) - (b === KHONG_KHU) || a.localeCompare(b, "vi", { numeric: true }));
  }, [bai, kb]); // eslint-disable-line react-hooks/exhaustive-deps
  const coKhu = dsKhu.some((k) => k !== KHONG_KHU);
  const khuHieu = dsKhu.includes(khuChon) ? khuChon : TAT_CA;

  // Nhóm theo khu vực (bãi lớn trong khu: lấp đầy cao trước)
  const nhom = useMemo(() => {
    const ks = coKhu ? (khuHieu ? [khuHieu] : dsKhu) : [null];
    return ks.map((k) => {
      const ds = [...bai].filter((b) => k == null || khuCua(b) === k).sort((a, b) => (b.lapDay ?? -1) - (a.lapDay ?? -1));
      const ton = ds.reduce((s, b) => s + b.ton, 0), suc = ds.reduce((s, b) => s + (b.sucChua || 0), 0);
      const pb = ds.reduce((s, b) => s + (b.dienTich || 0), 0), tong = ds.reduce((s, b) => s + (tongDT(b) || 0), 0);
      return { k, ds, ton, suc, lap: suc > 0 ? ton / suc : null, pb, tong, vuot: ds.filter((b) => tongDT(b) > 0 && b.dienTich > tongDT(b) + 0.5).length };
    });
  }, [bai, kb, coKhu, khuHieu, dsKhu]); // eslint-disable-line react-hooks/exhaustive-deps
  const ds = useMemo(() => nhom.flatMap((g) => g.ds), [nhom]);

  // Bố trí: kho → (khu vực) → hàng bãi lớn → bãi nhỏ; cuối mỗi bãi lớn có "+ bãi nhỏ", cuối mỗi khu vực có "+ bãi lớn"
  const bd = useMemo(() => {
    const cot = W.bai + KC.ngang, yKhu = KC.le + H.goc + KC.cao;
    const y0 = coKhu ? yKhu + H.khu + KC.cao : yKhu;
    let x = KC.le, tongH = y0 + H.bai + KC.le;
    const gs = nhom.map((g) => {
      const gx = x;
      const nhanh = g.ds.map((b, i) => {
        const n = dong.has(b.ten_bai) ? 0 : b.dong.length, bx = gx + i * cot;
        const themY = y0 + H.bai + KC.doc + n * (H.la + KC.la);
        const hh = coSua ? themY - y0 + H.them : n ? H.bai + KC.doc + n * H.la + (n - 1) * KC.la : H.bai;
        tongH = Math.max(tongH, y0 + Math.max(H.bai, hh) + KC.le);
        return { b, n, x: bx, y: y0, themY, la: n ? b.dong.map((d, j) => ({ d, x: bx + LA_X, y: y0 + H.bai + KC.doc + j * (H.la + KC.la) })) : [] };
      });
      const soCot = g.ds.length + (coSua ? 1 : 0);
      x += Math.max(1, soCot) * cot + (coKhu ? KC.nhomKhu : 0);
      return { ...g, x: gx, nhanh, themLon: coSua ? { x: gx + g.ds.length * cot, y: y0 } : null, yKhu, y0 };
    });
    return { gs, tongW: Math.max(x - (coKhu ? KC.nhomKhu : 0) - KC.ngang + KC.le, W.goc + KC.le * 2), tongH, goc: { x: KC.le, y: KC.le }, yKhu, y0 };
  }, [nhom, dong, coKhu, coSua]);

  const ton = ds.reduce((s, b) => s + b.ton, 0), suc = ds.reduce((s, b) => s + (b.sucChua || 0), 0), lap = suc > 0 ? ton / suc : null;
  const soNho = ds.reduce((s, b) => s + b.dong.length, 0), soVuot = nhom.reduce((s, g) => s + g.vuot, 0);
  const gx = bd.goc.x, gy = bd.goc.y, rootCx = gx + W.goc / 2, bus1 = gy + H.goc + KC.cao / 2;
  const datZoom = (z) => setZoom(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100)));
  const vuaKhung = () => datZoom((rong - 4) / bd.tongW);
  const dsBaiLon = (g) => g.ds.map((b) => b.ten_bai);
  const baiThem = them?.nho ? bai.find((b) => b.ten_bai === them.nho) : null;

  let truocRoot = rootCx; // điểm bắt đầu đoạn ngang tầng 1 (kho → các khu vực)
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {coKhu && <NativeSelect className="h-7 w-48 text-xs" value={khuHieu} onChange={(e) => setKhuChon(e.target.value)} aria-label="Lọc theo phạm vi / khu vực"
          options={[[TAT_CA, `Tất cả khu vực (${dsKhu.length})`], ...dsKhu.map((k) => [k, `${k} (${bai.filter((b) => khuCua(b) === k).length})`])]} />}
        <Button size="xs" variant="outline" onClick={() => setDong(new Set())}><ChevronsUpDown />Mở tất cả</Button>
        <Button size="xs" variant="outline" onClick={() => setDong(new Set(ds.map((b) => b.ten_bai)))}><ChevronsDownUp />Thu gọn tất cả</Button>
        <div className="inline-flex items-center gap-0.5 rounded-md border p-0.5" role="group" aria-label="Thu phóng sơ đồ">
          <Button size="icon" variant="ghost" className="h-6 w-6" disabled={zoom <= ZOOM_MIN} onClick={() => datZoom(zoom - 0.1)} aria-label="Thu nhỏ"><Minus /></Button>
          <button type="button" className="w-12 text-center text-xs tabular-nums hover:text-foreground" onClick={() => setZoom(1)} title="Về cỡ thật (100%)">{Math.round(zoom * 100)}%</button>
          <Button size="icon" variant="ghost" className="h-6 w-6" disabled={zoom >= ZOOM_MAX} onClick={() => datZoom(zoom + 0.1)} aria-label="Phóng to"><Plus /></Button>
        </div>
        <Button size="xs" variant="outline" onClick={vuaKhung} title="Thu cả sơ đồ vừa chiều ngang khung"><Maximize2 />Vừa khung</Button>
        {soVuot > 0 && <span className="inline-flex items-center gap-1 font-semibold text-bad"><AlertTriangle className="h-3.5 w-3.5" />{soVuot} bãi lớn phân bổ vượt diện tích</span>}
        <span className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1"><i className="h-2.5 w-4 rounded-sm" style={{ background: MAU.ok }} />Dưới {pct(NGUONG_KHO.vang)}</span>
          <span className="inline-flex items-center gap-1"><i className="h-2.5 w-4 rounded-sm" style={{ background: MAU.warn }} />Từ {pct(NGUONG_KHO.vang)}</span>
          <span className="inline-flex items-center gap-1"><i className="h-2.5 w-4 rounded-sm" style={{ background: MAU.bad }} />Từ {pct(NGUONG_KHO.do)} / vượt diện tích</span>
          <span>Thẻ bãi lớn: diện tích phân bổ / diện tích bãi · bấm bãi lớn để xem chi tiết{coSua ? " · dấu + để thêm bãi" : ""}</span>
        </span>
      </div>
      <div ref={khung} className="scroll-x rounded-lg border bg-card/40">
        <div style={{ width: bd.tongW * zoom, height: bd.tongH * zoom }}>
          <div className="relative origin-top-left" style={{ width: bd.tongW, height: bd.tongH, transform: `scale(${zoom})` }}>
            <svg className="pointer-events-none absolute inset-0" width={bd.tongW} height={bd.tongH} aria-hidden="true">
              <path d={`M${rootCx},${gy + H.goc} V${bus1}`} fill="none" stroke={MAU[mucDay(lap)]} strokeOpacity="0.8" strokeWidth="3" />
              {bd.gs.map((g) => {
                const khuCx = g.x + W.khu / 2, m = MAU[mucDay(g.lap)], bus2 = bd.yKhu + H.khu + KC.cao / 2, busY = coKhu ? bus2 : bus1;
                const dau = truocRoot; truocRoot = khuCx;
                let truoc = coKhu ? khuCx : rootCx; // điểm bắt đầu đoạn ngang nối các bãi lớn của nhóm
                return (
                  <g key={g.k ?? "tat-ca"}>
                    {coKhu && <path d={`M${dau},${bus1} H${khuCx} V${bd.yKhu}`} fill="none" stroke={m} strokeOpacity="0.8" strokeWidth="3" strokeLinejoin="round" />}
                    {coKhu && <path d={`M${khuCx},${bd.yKhu + H.khu} V${bus2}`} fill="none" stroke={m} strokeOpacity="0.8" strokeWidth="3" />}
                    {g.nhanh.map((k) => {
                      const mk = MAU[mucDay(k.b.lapDay)], cx = k.x + W.bai / 2, truc = k.x + 10, tu = truoc;
                      truoc = cx;
                      const cuoi = k.la.length ? k.la[k.la.length - 1].y + H.la / 2 : 0, themMy = k.themY + H.them / 2;
                      return (
                        <g key={k.b.ten_bai}>
                          <path d={`M${tu},${busY} H${cx} V${k.y}`} fill="none" stroke={mk} strokeOpacity="0.8" strokeWidth="3" strokeLinejoin="round" />
                          {(k.la.length > 0 || coSua) && <path d={`M${truc},${k.y + H.bai} V${coSua ? themMy - 6 : cuoi}`} fill="none" stroke={mk} strokeOpacity="0.55" strokeWidth="1.6" />}
                          {k.la.map(({ d, x, y }) => {
                            const my = y + H.la / 2, mc = d.saiBai ? MAU.bad : MAU[mucDay(d.lapDay)];
                            return <path key={d.key} d={`M${truc},${my - 6} Q${truc},${my} ${truc + 6},${my} H${x}`} fill="none" stroke={mc} strokeOpacity="0.6" strokeWidth="1.6" />;
                          })}
                          {coSua && <path d={`M${truc},${themMy - 6} Q${truc},${themMy} ${truc + 6},${themMy} H${k.x + LA_X}`} fill="none" stroke={mk} strokeOpacity="0.45" strokeWidth="1.6" strokeDasharray="4 3" />}
                        </g>);
                    })}
                    {g.themLon && <path d={`M${truoc},${busY} H${g.themLon.x + W.bai / 2} V${g.themLon.y}`} fill="none" stroke={MAU.xam} strokeOpacity="0.6" strokeWidth="2.2" strokeDasharray="5 4" strokeLinejoin="round" />}
                  </g>);
              })}
            </svg>

            {/* Nút gốc: cả kho */}
            <div className={cn("absolute grid content-center gap-1 rounded-2xl border-2 bg-card px-3 py-2 shadow-md", vien[mucDay(lap)])} style={{ left: gx, top: gy, width: W.goc, height: H.goc }}>
              <div className="truncate text-sm font-bold">{ten}</div>
              <Thanh p={lap} className="h-2" />
              <div className="flex justify-between text-[11px] tabular-nums"><span>{so(ton)} t</span><span className={cn("font-semibold", chu[mucDay(lap)])}>{lap != null ? pct(lap) : "—"}</span></div>
              <div className="text-[11px] text-muted-foreground">{coKhu ? `${nhom.length} khu vực · ` : ""}{ds.length} bãi lớn · {soNho} bãi nhỏ{suc ? ` · SC ${so(suc)} t` : ""}</div>
            </div>

            {bd.gs.map((g) => {
              const gm = mucDay(g.lap), tl = g.tong > 0 ? g.pb / g.tong : null, dm = mucDT(tl);
              return (
                <div key={g.k ?? "tat-ca"}>
                  {/* Nút khu vực */}
                  {coKhu && (
                    <div className={cn("absolute flex flex-col justify-center gap-1 rounded-xl border-2 bg-card px-2.5 py-1.5 shadow-sm", vien[g.vuot ? "bad" : gm])} style={{ left: g.x, top: bd.yKhu, width: W.khu, height: H.khu }}
                      title={`${g.k}: ${g.ds.length} bãi lớn · tồn ${so(g.ton)} t${g.suc ? ` / ${so(g.suc)} t` : ""} · phân bổ ${so(g.pb)} m²${g.tong ? ` / ${so(g.tong)} m²` : ""}`}>
                      <b className="truncate text-[13px]">{g.k}</b>
                      <Thanh p={g.lap} className="h-1.5" />
                      <div className="truncate text-[10px] tabular-nums text-muted-foreground">{g.ds.length} bãi lớn · tồn {so(g.ton)} t{g.lap != null ? ` (${pct(g.lap)})` : ""}</div>
                      <div className={cn("truncate text-[10px] tabular-nums", g.vuot ? "font-semibold text-bad" : tl != null ? chu[dm] : "text-muted-foreground")}>Phân bổ {g.tong ? `${so(g.pb)} / ${so(g.tong)} m²` : `${so(g.pb)} m²`}{g.vuot ? ` · ${g.vuot} bãi vượt` : ""}</div>
                    </div>)}
                  {g.nhanh.map((k) => {
                    const b = k.b, l = kho.luuLuong.bai.get(b.ten_bai), thu = dong.has(b.ten_bai);
                    const tong = tongDT(b), pb = b.dienTich || 0, tlDT = tong > 0 ? pb / tong : null, vuot = tong > 0 && pb > tong + 0.5;
                    const muc = vuot ? "bad" : mucDay(b.lapDay), mDT = mucDT(tlDT);
                    const trong = kho.choTrong(b.ten_bai), tauVe = (l?.tau || []).reduce((s, t) => s + t.con, 0), tauVuot = trong != null && tauVe > trong;
                    const ganDay = l?.trangThaiDay === "da_day" || (l?.trangThaiDay === "tang" && l.ngayDay < NGUONG_KHO.ngayDayVang);
                    return (
                      <div key={b.ten_bai}>
                        <div role="button" tabIndex={0} onClick={() => onMo(b.ten_bai)} onKeyDown={(e) => e.key === "Enter" && onMo(b.ten_bai)}
                          title={`${b.ten_bai}: tồn ${so(b.ton)} t${b.sucChua ? ` / ${so(b.sucChua)} t` : ""}${l ? ` · nhập +${so(l.nhap)} / xuất −${so(l.xuat)} t/ngày (${l.soNgay} ngày)` : ""} · diện tích phân bổ ${so(pb)} m²${tong ? ` / ${so(tong)} m²` : " (chưa khai báo diện tích bãi lớn)"}`}
                          className={cn("absolute grid cursor-pointer content-center gap-1 rounded-xl border-2 bg-card px-2.5 py-1.5 shadow-sm transition-colors hover:bg-accent", vien[muc])}
                          style={{ left: k.x, top: k.y, width: W.bai, height: H.bai }}>
                          <b className="truncate text-[13px]">{b.ten_bai}</b>
                          <div className="h-2.5 overflow-hidden rounded-full bg-muted" title="Diện tích phân bổ / diện tích bãi lớn"><div className={cn("h-full", nenThanh[tong > 0 ? mDT : "xam"])} style={{ width: `${Math.min(100, (tlDT ?? 0) * 100)}%` }} /></div>
                          <div className="flex justify-between gap-1 text-[11px] tabular-nums">
                            <span className="text-muted-foreground" title="Diện tích phân bổ cho các bãi nhỏ">{so(pb)} m²</span>
                            <span className={cn("font-semibold", chu[tong > 0 ? mDT : "xam"])}>{tong > 0 ? `${pct(tlDT)} / ${so(tong)} m²` : "chưa khai báo diện tích"}</span>
                          </div>
                          {vuot && <div className="flex items-center gap-1 truncate text-[10px] font-semibold text-bad"><AlertTriangle className="h-3 w-3 shrink-0" />Vượt {so(pb - tong)} m² so với diện tích bãi</div>}
                          <div className="flex items-center justify-between gap-1 text-[10px] tabular-nums text-muted-foreground"><span>Tồn {so(b.ton)} t</span><span className={cn("font-semibold", chu[mucDay(b.lapDay)])}>{b.lapDay != null ? pct(b.lapDay) : "—"}</span></div>
                          <div className="flex items-center gap-2 truncate text-[10px] text-muted-foreground">
                            {l?.kieu && <Badge tone={KIEU_TONE[l.kieu.ma]} className="px-1.5 py-0 text-[10px] font-medium" title={l.kieu.chiTiet}>{l.kieu.ten}</Badge>}
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
                              title={`${d.ten}${d.hang && d.hang !== d.ten ? ` (${d.hang})` : ""}: tồn ${so(d.ton)} t${d.sucChua ? ` / ${so(d.sucChua)} t` : ""}${d.dien_tich ? ` · ${so(d.dien_tich)} m²` : ""}${d.ngayCap != null ? ` · đủ cấp ${so(d.ngayCap, 1)} ngày` : ""}${d.saiBai ? " · hàng nằm sai bãi" : ""}`}>
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
                        {coSua && (
                          <button type="button" onClick={() => setThem({ nho: b.ten_bai })} title={`Thêm bãi nhỏ (gian / lô) vào ${b.ten_bai}`}
                            className="absolute flex items-center justify-center gap-1 rounded-lg border border-dashed border-primary/50 text-[11px] text-primary hover:bg-primary/10"
                            style={{ left: k.x + LA_X, top: k.themY, width: W.la, height: H.them }}><Plus className="h-3.5 w-3.5" />Thêm bãi nhỏ</button>)}
                      </div>);
                  })}
                  {g.themLon && (
                    <button type="button" onClick={() => setThem({ lon: g.k && g.k !== KHONG_KHU ? g.k : "" })} title={g.k ? `Thêm bãi lớn vào khu vực ${g.k}` : "Thêm bãi lớn"}
                      className="absolute flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-primary/50 text-xs text-primary hover:bg-primary/10"
                      style={{ left: g.themLon.x, top: g.themLon.y, width: W.bai, height: 56 }}><Plus className="h-5 w-5" />Thêm bãi lớn{g.k && g.k !== KHONG_KHU ? ` · ${g.k}` : ""}</button>)}
                </div>);
            })}
          </div>
        </div>
      </div>
      {them?.nho && baiThem && <ThemBaiNho baiLon={them.nho} loai={loai} tp={tp} khoMoi={khoMoi} tong={tongDT(baiThem)} daPB={baiThem.dienTich || 0} onClose={() => setThem(null)} />}
      {them && "lon" in them && <ThemBaiLon loai={loai} tp={tp} khoMoi={khoMoi} khu={them.lon} dsKhu={dsKhu.filter((k) => k !== KHONG_KHU)} onClose={() => setThem(null)} />}
    </div>
  );
}
