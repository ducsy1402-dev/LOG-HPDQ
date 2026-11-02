import { useMemo, useState } from "react";
import { useApp } from "@/store";
import { trangThai, chiSo, TRANG_THAI } from "@/lib/linetime";
import { cacTuyen, viTriTrenLich, benTheoViTri, kiemTraXepBen, nhanCho, tenTuyen } from "@/lib/capBen";
import { kiemTraBen } from "@/lib/checks";
import { DAY, ngayGio, so, pad, iso, ms } from "@/lib/format";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MucIcon } from "@/components/common";
import { cn } from "@/lib/utils";
import { tenBen, noiHaiBen } from "./BangTauBen";
import { viTriChu } from "@/lib/tenBen";
import { TheTau, SNAP, THU, KEO_DUOC } from "./Gantt";

// Lịch cầu bến theo mét (bảng phân bổ cầu bến): ngang là thời gian, dọc là mét dọc từng tuyến bến (3-5-10, 4-6-11, 7-8-9, HH2-HH3…).
// Mỗi tàu là một khối: dài theo thời gian ở bến, cao theo LOA, nằm đúng vị trí mét (chưa ghi vị trí: chỗ web tự xếp lúc tàu vào bến, viền đứt).
// Kéo ngang đổi giờ dự kiến (tàu chưa cập, bước 30 phút), kéo dọc đổi vị trí mét; kéo qua ranh giới / sang tuyến khác thì bến chính, bến phụ
// tự theo phần tàu chiếm. Khi kéo hiện mét đầu – cuối tàu, bến và giờ cập – rời để căn chỉnh.
const CO = {
  thuong: { mPx: 0.3, label: 96, head: 38, pad: 6, chu: "text-[11px]" },
  gon: { mPx: 0.18, label: 80, head: 30, pad: 4, chu: "text-[10px]" },
};

export default function GanttMet({ voyages, tu, soNgay, pxNgay, gon = false, maxH = "70vh" }) {
  const K = gon ? CO.gon : CO.thuong, LABEL = K.label;
  const { D, quyen, run, api, setVoyageMo, toast } = useApp();
  const [keo, setKeo] = useState(null); // { it, x0, y0, dx, dy, moved }
  const [xacNhan, setXacNhan] = useState(null);
  const [tro, setTro] = useState(null);
  const den = tu + soNgay * DAY, W = soNgay * pxNgay;
  const xOf = (t) => ((t - tu) / DAY) * pxNgay;
  const coSua = quyen.nhap && D.coSql28;

  // Các dải tuyến bến xếp theo thứ tự bến trong danh mục; mỗi dải cao theo chiều dài tuyến
  const dai = useMemo(() => {
    const thu = new Map(D.berths.map((b, i) => [String(b.ma), i]));
    const ds = [...cacTuyen(D.berths).values()].filter((t) => t.den > t.tu).sort((a, b) => Math.min(...a.bens.map((x) => thu.get(x.ma) ?? 99)) - Math.min(...b.bens.map((x) => thu.get(x.ma) ?? 99)));
    let y = 0;
    return ds.map((t) => { const h = (t.den - t.tu) * K.mPx + K.pad * 2; const r = { t, y, h }; y += h; return r; });
  }, [D.berths, K.mPx, K.pad]);
  const cao = dai.reduce((s, d) => s + d.h, 0);
  const daiCua = new Map(dai.map((d) => [d.t.ma, d]));
  const yMet = (d, m) => d.y + K.pad + (m - d.t.tu) * K.mPx; // toạ độ dọc của mét m trên dải d

  const tau = useMemo(() => viTriTrenLich(voyages, D.berths, D.stopsOf, tu, den, D.now).map((it) => ({ ...it, st: trangThai(it.v) })), [voyages, D.berths, D.stopsOf, tu, den, D.now]);
  const chuaXep = voyages.filter((v) => !v.huy && !v.ben_ma).length;
  const canhBaoCua = useMemo(() => new Map(D.alerts.map((a) => [a.voyage.id, a.muc === "bad" ? "bad" : a.muc])), [D.alerts]);

  // Đổi giờ được khi tàu chưa cập và chuyến không có chuyển bến (một đoạn); đổi vị trí được với đoạn bến hiện tại
  const doiGioDuoc = (it) => KEO_DUOC.has(it.st) && it.seg.cuoi && !it.seg.nguon;
  const doiMetDuoc = (it) => coSua && it.seg.cuoi;
  // Vị trí đang kéo: dải dưới mép trên của khối, mét đầu tàu (làm tròn 1 m), giờ lệch (bước 30 phút)
  const tinh = (k) => {
    const it = k.it, d0 = daiCua.get(it.tuyen.ma);
    const top = yMet(d0, it.x) + (doiMetDuoc(it) ? k.dy : 0);
    const d = dai.find((z) => top >= z.y && top < z.y + z.h) || (top < 0 ? dai[0] : dai[dai.length - 1]);
    const x = doiMetDuoc(it) ? Math.round(d.t.tu + (top - d.y - K.pad) / K.mPx) : it.x;
    let lech = doiGioDuoc(it) ? Math.round(((k.dx / pxNgay) * DAY) / SNAP) * SNAP : 0;
    const eta = ms(it.v.eta); // ETB không được trước ETA
    if (lech && eta != null && !it.v.atb && it.seg.a + lech < eta) lech = eta - it.seg.a;
    const ben = benTheoViTri(D.berths, d.t.bens[0].ma, x, it.L);
    return { d, x, lech, ben, a: it.seg.a + lech, b: it.seg.b + lech };
  };
  const onDown = (e, it) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setTro(null);
    setKeo({ it, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, moved: false });
  };
  const onMove = (e) => {
    if (!keo) return;
    const dx = e.clientX - keo.x0, dy = e.clientY - keo.y0;
    if (!keo.moved && Math.hypot(dx, dy) < 5) return;
    setKeo({ ...keo, dx, dy, moved: true, cx: e.clientX, cy: e.clientY });
  };
  const onUp = () => {
    if (!keo) return;
    const k = keo; setKeo(null);
    if (!k.moved) return setVoyageMo(k.it.v.id);
    const it = k.it;
    if (!doiMetDuoc(it) && !doiGioDuoc(it)) return toast(!quyen.nhap ? "Vai trò Xem không dời được lịch" : !D.coSql28 ? "Cần chạy SQL 28 để ghi vị trí mét" : "Đoạn này là bến cũ trước khi chuyển bến: sửa ở phiếu chuyến", "warn");
    const r = tinh(k);
    if (!r.lech && r.x === it.x && it.coDinh) return;
    if (!r.ben) return setXacNhan({ loi: `Mét ${so(r.x)}–${so(r.x + it.L)} ra ngoài tuyến ${tenTuyen(r.d.t, tenBen)} (mét ${so(r.d.t.tu)}–${so(r.d.t.den)}) hoặc chiếm hơn hai bến.` });
    const v = it.v, n = it.seg.nguon;
    const patch = { ...(doiMetDuoc(it) ? { ben_ma: r.ben.ben_ma, ben_phu: r.ben.ben_phu || null, vi_tri: r.x } : {}), ...(r.lech ? { etb: iso(r.a), etd: iso(r.b) } : {}) };
    const vMoi = { ...v, ...patch };
    const canh = kiemTraBen(vMoi, D.bmap[vMoi.ben_ma], vMoi.ben_phu ? D.bmap[vMoi.ben_phu] : null, D.berths).filter((c) => c.muc !== "info");
    for (const c of kiemTraXepBen(vMoi, vMoi.ben_ma, r.a, r.b, { voyages: D.voyages, berths: D.berths, stopsOf: D.stopsOf, now: D.now })) canh.push({ muc: "warn", nd: nhanCho(c, vMoi) });
    const luu = () => run(async () => {
      if (n && doiMetDuoc(it)) await api.updateStop(n.s.id, n.phia === "moi" ? { ben_moi: r.ben.ben_ma, ben_phu_moi: r.ben.ben_phu || null, vi_tri_moi: r.x } : { ben_cu: r.ben.ben_ma, ben_phu_cu: r.ben.ben_phu || null, vi_tri_cu: r.x });
      await api.updateVoyage(v.id, patch);
    }, `Đã dời ${v.ten_tau}: bến ${noiHaiBen(r.ben.ben_ma, r.ben.ben_phu)} ${viTriChu(r.x, it.L)}, cập ${ngayGio(r.a)}`);
    setXacNhan({ v, r, it, canh, luu });
  };

  const ngayDs = Array.from({ length: soNgay }, (_, i) => tu + i * DAY);
  const dang = keo?.moved ? tinh(keo) : null;
  return (
    <>
      <div className="scroll-x relative rounded-md border" style={{ maxHeight: maxH }}>
        <div style={{ width: LABEL + W }} className="relative select-none">
          <div className="sticky top-0 z-20 flex border-b bg-card" style={{ height: K.head }}>
            <div className={cn("sticky left-0 z-30 border-r bg-card px-2 py-1 font-semibold text-muted-foreground", K.chu)} style={{ width: LABEL, minWidth: LABEL }}>Tuyến · mét</div>
            {ngayDs.map((t) => { const d = new Date(t); return (
              <div key={t} className={cn("shrink-0 border-r text-center leading-tight", K.chu, d.getDay() === 0 && "bg-muted/60")} style={{ width: pxNgay }}>
                <div className={cn("font-semibold tabular-nums", gon ? "pt-0.5" : "pt-1")}>{pad(d.getDate())}/{pad(d.getMonth() + 1)}</div><div className="text-muted-foreground">{THU[d.getDay()]}</div>
              </div>); })}
          </div>
          <div className="relative" style={{ height: cao }} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => setKeo(null)}>
            {ngayDs.map((t, i) => <div key={t} className={cn("absolute inset-y-0 border-r", new Date(t).getDay() === 0 && "bg-muted/40")} style={{ left: LABEL + i * pxNgay, width: pxNgay }} />)}
            {D.now >= tu && D.now <= den && <div className="absolute inset-y-0 z-10 w-0.5 bg-bad/80" style={{ left: LABEL + xOf(D.now) }} title={`Hiện tại ${ngayGio(D.now)}`} />}
            {/* Dải tuyến: ranh giới bến (vạch ngang) và nhãn bến ở cột trái */}
            {dai.map((d) => (
              <div key={d.t.ma} className={cn("absolute inset-x-0 border-b-2 border-muted-foreground/40", dang?.d === d && "bg-primary/5")} style={{ top: d.y, height: d.h }}>
                {d.t.bens.map((b, i) => (
                  <div key={b.ma}>
                    {i > 0 && <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-muted-foreground/50" style={{ top: K.pad + (b.tu - d.t.tu) * K.mPx }} />}
                    {/* Nhãn bến dính bên trái khi cuộn ngang */}
                    <div className="pointer-events-none absolute inset-x-0" style={{ top: K.pad + (b.tu - d.t.tu) * K.mPx, height: (b.den - b.tu) * K.mPx }}>
                      <div className="pointer-events-auto sticky left-0 z-20 flex h-full flex-col justify-center border-r bg-card px-2" style={{ width: LABEL }}
                        title={`Bến ${b.ma}: mét ${so(b.tu)}–${so(b.den)}${b.goc ? ` · đầu ${b.goc === "dau" ? "mét " + so(b.tu) : "mét " + so(b.den)} góc vuông` : ""}`}>
                        <span className={cn("w-fit font-mono font-semibold", gon ? "text-[11px]" : "text-[13px]", b.goc === "dau" && "border-t-2 border-warn", b.goc === "cuoi" && "border-b-2 border-warn")}>{tenBen(b.ma)}</span>
                        {(b.den - b.tu) * K.mPx > 26 && <span className="text-[10px] tabular-nums text-muted-foreground">{so(b.tu)}–{so(b.den)} m</span>}
                      </div>
                    </div>
                  </div>))}
              </div>))}
            {/* Tàu */}
            {tau.map((it) => {
              const d = daiCua.get(it.tuyen.ma);
              if (!d) return null;
              const dangKeo = keo?.moved && keo.it === it;
              const left = Math.max(0, xOf(it.seg.a)), right = Math.min(W, xOf(it.seg.b)), w = Math.max(6, right - left);
              const top = yMet(d, it.x), h = Math.max(8, it.L * K.mPx);
              const cs = it.st === "lam_hang" ? chiSo(it.v, D.stopsOf(it.v.id), D.now) : null;
              const muc = canhBaoCua.get(it.v.id), mau = TRANG_THAI[it.st].mau;
              const keoDuoc = doiMetDuoc(it) || doiGioDuoc(it);
              return (
                <div key={`${it.v.id}:${it.seg.a}`} onPointerDown={(e) => onDown(e, it)}
                  onPointerMove={(e) => !keo && e.pointerType === "mouse" && setTro({ x: it, cx: e.clientX, cy: e.clientY })} onPointerLeave={() => setTro(null)}
                  className={cn("absolute z-10 flex touch-none flex-col justify-center overflow-hidden rounded px-1.5 font-medium leading-tight text-white shadow-sm", K.chu,
                    keoDuoc ? "cursor-grab" : "cursor-pointer", !it.coDinh && "border-2 border-dashed border-white/70",
                    muc === "bad" && "outline outline-2 outline-offset-1 outline-bad", muc === "warn" && "outline outline-2 outline-offset-1 outline-warn",
                    dangKeo && "z-30 cursor-grabbing opacity-90 ring-2 ring-white")}
                  style={{ left: LABEL + left, width: w, top, height: h, background: mau, transform: dangKeo ? `translate(${doiGioDuoc(it) ? keo.dx : 0}px, ${doiMetDuoc(it) ? keo.dy : 0}px)` : undefined }}
                  aria-label={`${it.v.ten_tau}: ${TRANG_THAI[it.st].ten}`}>
                  {cs && <div className="absolute inset-y-0 left-0 bg-black/25" style={{ width: `${Math.min(100, (cs.hoanTat || 0) * 100)}%` }} />}
                  <span className="relative truncate">{it.v.uu_tien ? "★ " : ""}{it.v.ten_tau}</span>
                  {h >= 26 && <span className="relative truncate opacity-85">{so(it.L)} m · {noiHaiBen(it.seg.ben, it.seg.phu)} {viTriChu(it.x, it.L)}</span>}
                </div>);
            })}
          </div>
        </div>
      </div>
      {/* Đang kéo: mét, bến, giờ cập – rời để căn chỉnh */}
      {dang && (
        <div className="pointer-events-none fixed z-50 rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-lg" style={{ left: (keo.cx ?? 0) + 16, top: (keo.cy ?? 0) + 16 }}>
          <div className="font-semibold">{keo.it.v.ten_tau} · {so(keo.it.L)} m</div>
          <div>Mét <b className="tabular-nums">{so(dang.x)} – {so(dang.x + keo.it.L)}</b> · {dang.ben ? <>bến <b>{noiHaiBen(dang.ben.ben_ma, dang.ben.ben_phu)}</b></> : <span className="text-bad">ra ngoài tuyến / chiếm hơn hai bến</span>}</div>
          <div>Cập <b className="tabular-nums">{ngayGio(dang.a)}</b> → rời <b className="tabular-nums">{ngayGio(dang.b)}</b>{dang.lech ? <span className="text-muted-foreground"> ({dang.lech > 0 ? "+" : "−"}{so(Math.abs(dang.lech) / 36e5, 1)} giờ)</span> : null}</div>
          {!doiGioDuoc(keo.it) && <div className="text-muted-foreground">Tàu đã cập / có chuyển bến: chỉ đổi vị trí mét</div>}
          {!doiMetDuoc(keo.it) && <div className="text-muted-foreground">{D.coSql28 ? "Chỉ đổi giờ" : "Chạy SQL 28 để đổi vị trí mét"}</div>}
        </div>)}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {Object.entries(TRANG_THAI).map(([k, t]) => <span key={k} className="flex items-center gap-1"><i className="inline-block h-2.5 w-4 rounded-sm" style={{ background: t.mau }} />{t.ten}</span>)}
        <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-4 rounded-sm border-2 border-dashed border-slate-400" />Chưa ghi vị trí (web tự xếp)</span>
        <span className="flex items-center gap-1"><i className="inline-block h-3 w-4 border-t-2 border-warn" />Đầu góc vuông</span>
        {chuaXep > 0 && <span>{chuaXep} chuyến chưa xếp bến không hiện ở lịch theo mét</span>}
      </div>
      {tro && !keo && <TheTau x={tro.x} cx={tro.cx} cy={tro.cy} />}
      {xacNhan && (
        <Dialog onOpenChange={(o) => !o && setXacNhan(null)} title={xacNhan.loi ? "Không dời được" : `Dời ${xacNhan.v.ten_tau}?`}
          description={xacNhan.loi ? null : `Bến ${noiHaiBen(xacNhan.r.ben.ben_ma, xacNhan.r.ben.ben_phu)} · mét ${so(xacNhan.r.x)}–${so(xacNhan.r.x + xacNhan.it.L)} · cập ${ngayGio(xacNhan.r.a)} → rời ${ngayGio(xacNhan.r.b)}`}
          footer={xacNhan.loi ? <Button onClick={() => setXacNhan(null)}>Đóng</Button>
            : <><Button variant="outline" onClick={() => setXacNhan(null)}>Hủy</Button><Button variant={xacNhan.canh.length ? "destructive" : "default"} onClick={() => { xacNhan.luu(); setXacNhan(null); }}>{xacNhan.canh.length ? "Vẫn dời" : "Dời"}</Button></>}>
          {xacNhan.loi ? <div className="text-sm">{xacNhan.loi}</div>
            : xacNhan.canh.length ? <div className="grid gap-2 text-sm">{xacNhan.canh.map((c, i) => <div key={i} className="flex gap-2"><MucIcon muc={c.muc} className="mt-0.5" />{c.nd}</div>)}</div>
            : <div className="text-sm text-ok">Đủ chỗ theo quy tắc cập cầu bến trong suốt thời gian tàu ở bến.</div>}
        </Dialog>)}
    </>
  );
}
