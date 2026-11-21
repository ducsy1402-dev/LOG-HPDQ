import { Fragment, useContext, useMemo, useState } from "react";
import { PhongToCtx } from "@/components/EChart";
import { useApp } from "@/store";
import { trangThai, laUoc, chiSo, TRANG_THAI, TRANG_THAI_HIEN } from "@/lib/linetime";
import { cacTuyen, viTriTrenLich, benTheoViTri, tenTuyen } from "@/lib/capBen";
import { DAY, ngayGio, met, pad, iso, ms, thoiLuong } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { docSo } from "@/lib/format";
import { tenBen, noiHaiBen } from "./BangTauBen";
import { viTriChu } from "@/lib/tenBen";
import { TheTau, SNAP, THU, KEO_DUOC } from "./Gantt";
import { choBatDau, kieuCho, PhanChoHang, ChuThichCho } from "./doanCho";
import { MAU_CHO } from "@/lib/linetime";

// Lịch cầu bến theo mét (bảng phân bổ cầu bến): ngang là thời gian, dọc là mét dọc từng tuyến bến (3-5-10, 4-6-11, 7-8-9, HH2-HH3…).
// Mỗi tàu là một khối: dài theo thời gian ở bến, cao theo LOA, nằm đúng vị trí mét (chưa ghi vị trí: chỗ web tự xếp lúc tàu vào bến, viền đứt).
// Kéo ngang đổi giờ dự kiến (tàu chưa cập, bước 30 phút), kéo dọc đổi vị trí mét; kéo qua ranh giới / sang tuyến khác thì bến chính, bến phụ
// tự theo phần tàu chiếm. Khi kéo hiện mét đầu – cuối tàu, bến và giờ cập – rời để căn chỉnh.
// che = "toan": thêm đoạn chờ bến (đỏ) trước thanh tàu và vạch NOR / làm hàng, giống lịch theo bến. Khoảng chờ hàng / bãi (xanh lá) luôn hiện trên thanh tàu.
const CO = {
  thuong: { mPx: 0.3, label: 96, head: 38, pad: 6, chu: "text-[0.6875rem]" },
  gon: { mPx: 0.18, label: 80, head: 30, pad: 4, chu: "text-[0.6875rem]" },
};

export default function GanttMet({ voyages, tu, soNgay, pxNgay, che = "ben", gon = false, maxH: maxHGoc = "70vh" }) {
  const phongTo = useContext(PhongToCtx), maxH = phongTo ? "calc(100dvh - 150px)" : maxHGoc; // khung Tổng quan phóng to: lịch cao hết màn hình
  const K = gon ? CO.gon : CO.thuong, LABEL = K.label;
  const { D, quyen, run, api, setVoyageMo, toast } = useApp();
  const [keo, setKeo] = useState(null); // { it, x0, y0, dx, dy, moved }
  const [gian, setGian] = useState(null); // kéo giãn mép trái / phải thanh tàu: { it, canh: "trai" | "phai", x0, dx, moved }
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

  const tau = useMemo(() => viTriTrenLich(voyages, D.berths, D.stopsOf, tu, den, D.now).map((it) => ({ ...it, st: trangThai(it.v, D.now), uocTT: laUoc(it.v, D.now) })), [voyages, D.berths, D.stopsOf, tu, den, D.now]);
  const chuaXep = voyages.filter((v) => !v.huy && !v.ben_ma).length;

  // Đổi giờ được khi tàu chưa cập và chuyến không có chuyển bến (một đoạn); đổi vị trí được với đoạn bến hiện tại
  const doiGioDuoc = (it) => KEO_DUOC.has(it.st) && it.seg.cuoi && !it.seg.nguon;
  const doiMetDuoc = (it) => coSua && it.seg.cuoi;
  // Vị trí đang kéo: dải dưới mép trên của khối, mét đầu tàu (làm tròn 1 m), giờ lệch (bước 30 phút)
  const tinh = (k) => {
    const it = k.it, d0 = daiCua.get(it.tuyen.ma);
    const top = yMet(d0, it.x) + (doiMetDuoc(it) ? k.dy : 0);
    const d = dai.find((z) => top >= z.y && top < z.y + z.h) || (top < 0 ? dai[0] : dai[dai.length - 1]);
    const x = doiMetDuoc(it) ? Math.round(d.t.tu + (top - d.y - K.pad) / K.mPx) : it.x;
    const lech = doiGioDuoc(it) ? Math.round(((k.dx / pxNgay) * DAY) / SNAP) * SNAP : 0;
    const ben = benTheoViTri(D.berths, d.t.bens[0].ma, x, it.L);
    return { d, x, lech, ben, a: it.seg.a + lech, b: it.seg.b + lech };
  };
  // ---- Chỉnh nhanh mét cầu cập (anh Sỹ 20/11/2026): nút ghim trên thanh tàu mở hộp nhỏ gõ mét đầu, nhích ± hoặc bấm sát đầu / cuối bến. LOA của tàu KHÔNG đổi (mét cuối = mét đầu + LOA);
  // chỉ ghi vị trí mét (vi_tri) và bến chính / phụ theo phần tàu chiếm. Chỉ đoạn bến hiện tại không do khoảng dừng chuyển bến.
  const coChinhMet = (it) => doiMetDuoc(it) && !it.seg.nguon;
  const [hop, setHop] = useState(null); // { it, dau (mét đầu, chuỗi đang gõ), cx, cy }
  const moHop = (e, it) => { e.stopPropagation(); setTro(null); const r = e.currentTarget.getBoundingClientRect(); setHop({ it, dau: String(Math.round(it.x * 100) / 100), cx: r.left, cy: r.bottom + 4 }); };
  const kqHop = (h) => {
    const it = h.it, t = it.tuyen, x = docSo(h.dau);
    if (h.dau.trim() === "" || !Number.isFinite(x)) return { x: null, ben: null, ngoai: true };
    return { x, ben: benTheoViTri(D.berths, t.bens[0].ma, x, it.L), ngoai: x < t.tu - 1e-6 || x + it.L > t.den + 1e-6 };
  };
  const luuHop = () => {
    const h = hop, r = kqHop(h), v = h.it.v;
    if (r.x == null) return toast("Mét đầu phải là một số", "warn");
    if (!r.ben || r.ngoai) return toast(`Mét ${met(r.x)}–${met(r.x + h.it.L)} ra ngoài tuyến ${tenTuyen(h.it.tuyen, tenBen)} (mét ${met(h.it.tuyen.tu)}–${met(h.it.tuyen.den)}) hoặc chiếm hơn hai bến`, "warn");
    setHop(null);
    if (r.x === h.it.x && h.it.coDinh) return;
    run(() => api.updateVoyage(v.id, { vi_tri: r.x, ben_ma: r.ben.ben_ma, ben_phu: r.ben.ben_phu || null }), `${v.ten_tau}: bến ${noiHaiBen(r.ben.ben_ma, r.ben.ben_phu)} ${viTriChu(r.x, h.it.L)}`);
  };
  // ---- Kéo giãn giờ (như Lịch cầu bến › Theo bến): nắm mép PHẢI thanh tàu đổi ETD (đã có ATD thì ATD), mép TRÁI đổi ETB (đã có ATB thì ATB); bước 30 phút, tối thiểu 30 phút ở bến ----
  // Chỉ mép trái của đoạn đầu và mép phải của đoạn cuối (tàu có chuyển bến: các mốc giữa sửa ở phiếu chuyến). Lưu ngay khi thả.
  const coGian = (it) => quyen.nhap && !it.v.huy;
  const moc = (it, canh) => (canh === "trai" ? (it.v.atb ? "atb" : "etb") : (it.v.atd ? "atd" : "etd"));
  const tenMoc = { atb: "ATB", etb: "ETB", atd: "ATD", etd: "ETD" };
  const tinhGian = ({ it, canh, dx }) => {
    const lech = Math.round(((dx / pxNgay) * DAY) / SNAP) * SNAP;
    return canh === "trai" ? { a: Math.min(it.seg.a + lech, it.seg.b - SNAP), b: it.seg.b } : { a: it.seg.a, b: Math.max(it.seg.b + lech, it.seg.a + SNAP) };
  };
  const onDownGian = (e, it, canh) => {
    if (e.button !== 0) return;
    e.stopPropagation(); setTro(null);
    e.currentTarget.setPointerCapture(e.pointerId);
    setGian({ it, canh, x0: e.clientX, dx: 0, moved: false });
  };
  const xongGian = () => {
    const g = gian; setGian(null);
    if (!g?.moved) return;
    const { a, b } = tinhGian(g), m = moc(g.it, g.canh), gia = g.canh === "trai" ? a : b, cu = g.canh === "trai" ? g.it.seg.a : g.it.seg.b;
    if (gia === cu) return;
    run(() => api.updateVoyage(g.it.v.id, { [m]: iso(gia) }), `${g.it.v.ten_tau}: ${tenMoc[m]} → ${ngayGio(gia)} (ở bến ${thoiLuong((b - a) / 36e5, { ngan: true })})`);
  };
  const onDown = (e, it) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setTro(null);
    setKeo({ it, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, moved: false });
  };
  const onMove = (e) => {
    if (gian) {
      const dx = e.clientX - gian.x0;
      if (!gian.moved && Math.abs(dx) < 4) return;
      return setGian({ ...gian, dx, cx: e.clientX, cy: e.clientY, moved: true });
    }
    if (!keo) return;
    const dx = e.clientX - keo.x0, dy = e.clientY - keo.y0;
    if (!keo.moved && Math.hypot(dx, dy) < 5) return;
    setKeo({ ...keo, dx, dy, moved: true, cx: e.clientX, cy: e.clientY });
  };
  const onUp = () => {
    if (gian) return xongGian();
    if (!keo) return;
    const k = keo; setKeo(null);
    if (!k.moved) return setVoyageMo(k.it.v.id);
    const it = k.it;
    if (!doiMetDuoc(it) && !doiGioDuoc(it)) return toast(!quyen.nhap ? "Vai trò Xem không dời được lịch" : !D.coSql28 ? "Cần chạy SQL 28 để ghi vị trí mét" : "Đoạn này là bến cũ trước khi chuyển bến: sửa ở phiếu chuyến", "warn");
    const r = tinh(k);
    if (!r.lech && r.x === it.x && it.coDinh) return;
    if (!r.ben) return toast(`Mét ${met(r.x)}–${met(r.x + it.L)} ra ngoài tuyến ${tenTuyen(r.d.t, tenBen)} (mét ${met(r.d.t.tu)}–${met(r.d.t.den)}) hoặc chiếm hơn hai bến`, "warn");
    const v = it.v, n = it.seg.nguon;
    const patch = { ...(doiMetDuoc(it) ? { ben_ma: r.ben.ben_ma, ben_phu: r.ben.ben_phu || null, vi_tri: r.x } : {}), ...(r.lech ? { etb: iso(r.a), etd: iso(r.b) } : {}) };
    const luu = () => run(async () => {
      if (n && doiMetDuoc(it)) await api.updateStop(n.s.id, n.phia === "moi" ? { ben_moi: r.ben.ben_ma, ben_phu_moi: r.ben.ben_phu || null, vi_tri_moi: r.x } : { ben_cu: r.ben.ben_ma, ben_phu_cu: r.ben.ben_phu || null, vi_tri_cu: r.x });
      await api.updateVoyage(v.id, patch);
    }, `Đã dời ${v.ten_tau}: bến ${noiHaiBen(r.ben.ben_ma, r.ben.ben_phu)} ${viTriChu(r.x, it.L)}, cập ${ngayGio(r.a)}`);
    luu(); // line chỉ hiển thị và kéo thả: lưu ngay, không kiểm tra hay cảnh báo
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
          <div className="relative" style={{ height: cao }} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => { setKeo(null); setGian(null); }}>
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
                      <div className="pointer-events-auto sticky left-0 z-20 flex h-full flex-col justify-center overflow-hidden border-r bg-card px-2 leading-tight" style={{ width: LABEL }}
                        title={`Bến ${b.ma}: mét ${met(b.tu)}–${met(b.den)}${b.goc ? ` · đầu ${b.goc === "dau" ? "mét " + met(b.tu) : "mét " + met(b.den)} góc vuông` : ""}`}>
                        <span className={cn("w-fit font-mono font-semibold", gon ? "text-[0.6875rem]" : "text-[0.8125rem]", b.goc === "dau" && "border-t-2 border-warn", b.goc === "cuoi" && "border-b-2 border-warn")}>{tenBen(b.ma)}</span>
                        {(b.den - b.tu) * K.mPx > 26 && <span className="truncate text-[0.6875rem] tabular-nums text-muted-foreground">{met(b.tu)}–{met(b.den)} m</span>}
                      </div>
                    </div>
                  </div>))}
              </div>))}
            {/* Tàu */}
            {tau.map((it) => {
              const d = daiCua.get(it.tuyen.ma);
              if (!d) return null;
              const dangKeo = keo?.moved && keo.it === it;
              const gx = gian?.moved && gian.it === it ? tinhGian(gian) : null; // đang kéo giãn thanh này: vẽ theo mốc mới
              const xa = gx?.a ?? it.seg.a, xb = gx?.b ?? it.seg.b;
              const left = Math.max(0, xOf(xa)), right = Math.min(W, xOf(xb)), w = Math.max(6, right - left);
              const gianTrai = coGian(it) && it.seg.dau, gianPhai = coGian(it) && it.seg.cuoi, tayG = Math.min(8, Math.max(4, w / 4));
              const top = yMet(d, it.x), h = Math.max(8, it.L * K.mPx);
              const nutMet = coChinhMet(it);
              const cs = it.st === "lam_hang" ? chiSo(it.v, D.stopsOf(it.v.id), D.now) : null;
              const mau = TRANG_THAI[it.st].mau;
              const keoDuoc = doiMetDuoc(it) || doiGioDuoc(it);
              const dsStops = D.stopsOf(it.v.id);
              // Toàn thời gian: đoạn chờ bến đỏ ngay trước thanh tàu (chỉ đoạn bến đầu của chuyến) và các vạch mốc
              const choTu = it.seg.dau ? choBatDau(it.v, che) : null, a0 = choTu != null && choTu < it.seg.a ? choTu : null;
              const choL = a0 != null ? Math.max(0, xOf(a0)) : null, choR = a0 != null ? Math.min(W, xOf(xa)) : null, coCho = choL != null && choR > choL;
              const vach = che === "toan" ? [it.v.nor, it.v.bd_lam_hang, it.v.kt_lam_hang].filter((t) => t && ms(t) >= tu && ms(t) <= den) : [];
              return (
                <Fragment key={`${it.v.id}:${it.seg.a}`}>
                {coCho && (
                  <div onClick={() => setVoyageMo(it.v.id)} className={cn("absolute z-10 flex cursor-pointer items-center justify-end overflow-hidden rounded-l border border-r-0 px-1 font-medium", K.chu, dangKeo && "opacity-40")}
                    style={{ left: LABEL + choL, width: choR - choL, top, height: h, ...kieuCho(MAU_CHO.ben, false) }}>
                    <PhanChoHang stops={dsStops} t0={a0} t1={it.seg.a} xOf={xOf} left0={choL} now={D.now} gon={gon} />
                    {choR - choL > 70 && !gon && <span className="relative truncate">Chờ bến {thoiLuong((it.seg.a - a0) / 36e5, { ngan: true })}</span>}
                  </div>)}
                {vach.map((t) => <div key={t} className="pointer-events-none absolute z-20 w-0.5 rounded bg-white/90 shadow" style={{ left: LABEL + xOf(ms(t)) - 1, top: top - 2, height: h + 4 }} />)}
                <div onPointerDown={(e) => onDown(e, it)}
                  onPointerMove={(e) => !keo && e.pointerType === "mouse" && setTro({ x: it, cx: e.clientX, cy: e.clientY })} onPointerLeave={() => setTro(null)}
                  className={cn("absolute z-10 flex touch-none flex-col justify-center overflow-hidden rounded px-1.5 font-medium leading-tight text-white shadow-sm", K.chu,
                    keoDuoc ? "cursor-grab" : "cursor-pointer",
                    dangKeo && "z-30 cursor-grabbing opacity-90 ring-2 ring-white", gx && "z-30 ring-2 ring-white")}
                  style={{ left: LABEL + left, width: w, top, height: h, background: mau, transform: dangKeo ? `translate(${doiGioDuoc(it) ? keo.dx : 0}px, ${doiMetDuoc(it) ? keo.dy : 0}px)` : undefined }}
                  aria-label={`${it.v.ten_tau}: ${TRANG_THAI[it.st].ten}`}>
                  {cs && <div className="absolute inset-y-0 left-0 bg-black/25" style={{ width: `${Math.min(100, (cs.hoanTat || 0) * 100)}%` }} />}
                  <span className="relative truncate">{it.uocTT ? "≈ " : ""}{it.v.uu_tien ? "★ " : ""}{it.v.ten_tau}</span>
                  {h >= 26 && <span className="relative truncate opacity-85">{it.v._loaUoc || it.thuNho ? "≈" : ""}{met(it.L)} m · {noiHaiBen(it.seg.ben, it.seg.phu)} {viTriChu(it.x, it.L)}</span>}
                  {/* Nút ghim: mở hộp chỉnh nhanh mét cầu cập (không đổi LOA) */}
                  {nutMet && h >= 14 && <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => moHop(e, it)} title="Chỉnh nhanh mét cầu cập (không đổi LOA)" aria-label={`Chỉnh mét cầu cập ${it.v.ten_tau}`}
                    className="absolute right-2 top-0.5 z-20 flex h-3.5 w-3.5 items-center justify-center rounded bg-black/30 text-[0.5625rem] font-bold leading-none text-white opacity-60 hover:bg-black/60 hover:opacity-100">m</button>}
                  {/* Tay nắm kéo giãn: mép trái đổi ETB / ATB, mép phải đổi ETD / ATD */}
                  {gianTrai && <span onPointerDown={(e) => onDownGian(e, it, "trai")} title={`Kéo để đổi ${tenMoc[moc(it, "trai")]}`} className="group/g absolute inset-y-0 left-0 z-20 flex cursor-ew-resize items-center justify-center bg-black/0 hover:bg-white/40" style={{ width: tayG }}><i className="h-1/2 w-px bg-white/0 group-hover/g:bg-white" /></span>}
                  {gianPhai && <span onPointerDown={(e) => onDownGian(e, it, "phai")} title={`Kéo để đổi ${tenMoc[moc(it, "phai")]}`} className="group/g absolute inset-y-0 right-0 z-20 flex cursor-ew-resize items-center justify-center bg-black/0 hover:bg-white/40" style={{ width: tayG }}><i className="h-1/2 w-px bg-white/0 group-hover/g:bg-white" /></span>}
                </div>
                </Fragment>);
            })}
          </div>
        </div>
      </div>
      {gian?.moved && (() => { const g = tinhGian(gian), m = moc(gian.it, gian.canh), lech = gian.canh === "trai" ? g.a - gian.it.seg.a : g.b - gian.it.seg.b; return (
        <div className="pointer-events-none fixed z-50 rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-lg" style={{ left: (gian.cx ?? 0) + 16, top: (gian.cy ?? 0) + 16 }}>
          <div className="font-semibold">{gian.it.v.ten_tau}</div>
          <div>{tenMoc[m]}: <b className="tabular-nums">{ngayGio(gian.canh === "trai" ? g.a : g.b)}</b>{lech ? <span className="text-muted-foreground"> ({lech > 0 ? "+" : "−"}{thoiLuong(Math.abs(lech) / 36e5, { ngan: true })})</span> : null}</div>
          <div className="text-muted-foreground">Ở bến {ngayGio(g.a)} → {ngayGio(g.b)} · {thoiLuong((g.b - g.a) / 36e5, { ngan: true })}</div>
        </div>); })()}
      {/* Đang kéo: mét, bến, giờ cập – rời để căn chỉnh */}
      {/* Hộp chỉnh nhanh mét cầu cập: LOA tàu giữ nguyên, chỉ đổi vị trí mét */}
      {hop && (() => {
        const it = hop.it, t = it.tuyen, r = kqHop(hop), x = r.x ?? it.x;
        const dat = (m) => setHop({ ...hop, dau: String(Math.round(m * 100) / 100) });
        const chip = t.bens.flatMap((b) => [[`Đầu ${tenBen(b.ma)}`, b.tu], [`Cuối ${tenBen(b.ma)}`, b.den - it.L]]).filter(([, m]) => m >= t.tu - 1e-6 && m + it.L <= t.den + 1e-6);
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setHop(null)} />
            <div className="fixed z-50 w-72 rounded-lg border bg-popover p-3 text-xs text-popover-foreground shadow-xl" style={{ left: Math.max(8, Math.min(hop.cx, window.innerWidth - 296)), top: Math.max(8, Math.min(hop.cy, window.innerHeight - 270)) }}>
              <div className="text-sm font-semibold">{it.v.ten_tau}</div>
              <div className="text-muted-foreground">LOA {met(it.L)} m (không đổi) · tuyến {tenTuyen(t, tenBen)} (mét {met(t.tu)}–{met(t.den)})</div>
              <div className="mt-2 flex items-center gap-2">
                <span className="shrink-0">Mét đầu</span>
                <Input autoFocus className="h-8 w-24 tabular-nums" value={hop.dau} inputMode="decimal" onFocus={(e) => e.target.select()} onChange={(e) => setHop({ ...hop, dau: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") luuHop(); if (e.key === "Escape") setHop(null); }} aria-label="Mét đầu tàu" />
                <span className="text-muted-foreground">→ cuối <b className="tabular-nums text-foreground">{r.x == null ? "?" : met(x + it.L)}</b></span>
              </div>
              <div className="mt-2 flex gap-1">
                {[-10, -1, 1, 10].map((d) => <Button key={d} size="xs" variant="outline" className="flex-1 tabular-nums" onClick={() => dat(x + d)}>{d > 0 ? "+" : "−"}{Math.abs(d)} m</Button>)}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {chip.map(([ten, m]) => <Button key={ten} size="xs" variant="ghost" className="border" onClick={() => dat(m)}>{ten}</Button>)}
              </div>
              <div className="mt-2">{r.ben && !r.ngoai ? <>Cập bến <b>{noiHaiBen(r.ben.ben_ma, r.ben.ben_phu)}</b> · mét {met(x)}–{met(x + it.L)}</> : <span className="text-bad">Ra ngoài tuyến / chiếm hơn hai bến</span>}</div>
              <div className="mt-2 flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => setHop(null)}>Hủy</Button><Button size="sm" disabled={!r.ben || r.ngoai} onClick={luuHop}>Lưu</Button></div>
            </div>
          </>);
      })()}
      {dang && (
        <div className="pointer-events-none fixed z-50 rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-lg" style={{ left: (keo.cx ?? 0) + 16, top: (keo.cy ?? 0) + 16 }}>
          <div className="font-semibold">{keo.it.v.ten_tau} · {met(keo.it.L)} m</div>
          <div>Mét <b className="tabular-nums">{met(dang.x)} – {met(dang.x + keo.it.L)}</b> · {dang.ben ? <>bến <b>{noiHaiBen(dang.ben.ben_ma, dang.ben.ben_phu)}</b></> : <span className="text-bad">ra ngoài tuyến / chiếm hơn hai bến</span>}</div>
          <div>Cập <b className="tabular-nums">{ngayGio(dang.a)}</b> → rời <b className="tabular-nums">{ngayGio(dang.b)}</b>{dang.lech ? <span className="text-muted-foreground"> ({dang.lech > 0 ? "+" : "−"}{met(Math.abs(dang.lech) / 36e5, 1)} giờ)</span> : null}</div>
          {!doiGioDuoc(keo.it) && <div className="text-muted-foreground">Tàu đã cập / có chuyển bến: chỉ đổi vị trí mét</div>}
          {!doiMetDuoc(keo.it) && <div className="text-muted-foreground">{D.coSql28 ? "Chỉ đổi giờ" : "Chạy SQL 28 để đổi vị trí mét"}</div>}
        </div>)}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.6875rem] text-muted-foreground">
        {TRANG_THAI_HIEN.map(([k, t]) => <span key={k} className="flex items-center gap-1"><i className="inline-block h-2.5 w-4 rounded-sm" style={{ background: t.mau }} />{t.ten}</span>)}
        <ChuThichCho toan={che === "toan"} />
        {che === "toan" && <span className="flex items-center gap-1"><i className="inline-block h-3 w-0.5 bg-white" />Vạch NOR, bắt đầu / kết thúc làm hàng</span>}
        <span className="flex items-center gap-1"><i className="inline-block h-3 w-4 border-t-2 border-warn" />Đầu góc vuông</span>
        {quyen.nhap && <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-1 cursor-ew-resize rounded-sm bg-white ring-1 ring-slate-400" />Kéo mép trái / phải thanh tàu để đổi ETB·ATB / ETD·ATD</span>}
        {coSua && <span className="flex items-center gap-1"><i className="inline-flex h-3.5 w-3.5 items-center justify-center rounded bg-slate-500 text-[0.5625rem] font-bold not-italic text-white">m</i>Bấm để chỉnh nhanh mét cầu cập (không đổi LOA)</span>}
        <span>≈ trước tên tàu: trạng thái theo giờ dự kiến · ≈ trước số mét: LOA ước tính (tàu chưa có LOA)</span>
        {chuaXep > 0 && <span>{chuaXep} chuyến chưa có bến (không vẽ trên lịch theo mét)</span>}
      </div>
      {tro && !keo && !hop && !gian && <TheTau x={tro.x} cx={tro.cx} cy={tro.cy} />}
    </>
  );
}
