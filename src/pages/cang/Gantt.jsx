import { Fragment, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/store";
import { khoangBen, doanBen, trangThai, chiSo, TRANG_THAI } from "@/lib/linetime";
import { kiemTraXepBen, nhanCho, laBenLienKe } from "@/lib/capBen";
import { kiemTraBen } from "@/lib/checks";
import { DAY, ngayGio, so, pad, iso, ms } from "@/lib/format";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MucIcon } from "@/components/common";
import { cn } from "@/lib/utils";
import { tenBen, tenBenChuyen, noiHaiBen } from "./BangTauBen";
import { viTriChu } from "@/lib/tenBen";
import { tenBai, moTaTB } from "@/lib/thietBi";
import { thietBiChuyen, TRANG_THAI_PA } from "@/lib/phuongAn";
import { dsGanCau } from "@/lib/thietBi";
import { useCau } from "./useCau";
import { MOC } from "@/lib/linetime";
import { thoiLuong, ngayGioNam } from "@/lib/format";

export const SNAP = 30 * 60e3;
// Kích thước dòng / thanh: bình thường và chế độ gọn
const CO = {
  thuong: { row: 46, lan: 26, bar: 22, top: 4, label: 76, head: 38, chu: "text-[11px]" },
  gon: { row: 28, lan: 18, bar: 15, top: 3, label: 58, head: 30, chu: "text-[10px]" },
};
export const THU = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
export const KEO_DUOC = new Set(["du_kien", "cho_neo"]);

// Xếp các thanh chồng nhau trong cùng bến thành nhiều làn
function chiaLan(ds) {
  const lan = [];
  for (const x of ds.sort((a, b) => a.la - b.la)) {
    let i = lan.findIndex((end) => end <= x.la);
    if (i < 0) { i = lan.length; lan.push(0); }
    lan[i] = x.b; x.lan = i;
  }
  return Math.max(1, lan.length);
}

// Lịch cầu bến dạng Gantt: bến theo hàng, ngày theo cột. Kéo thả thanh tàu (chưa cập) để đổi bến hoặc giờ dự kiến.
// che = "ben": chỉ thời gian chiếm bến; "toan": thêm đoạn chờ từ lúc đến neo / NOR tới lúc cập, vạch NOR và làm hàng.
// gon: dòng thấp, chữ nhỏ để xem được nhiều bến một lúc. maxH: chiều cao tối đa khung lịch (toàn màn hình thì cao hơn).
export default function Gantt({ voyages, tu, soNgay, pxNgay, che = "ben", gon = false, maxH = "70vh" }) {
  const K = gon ? CO.gon : CO.thuong, ROW = K.row, LABEL = K.label;
  const { D, quyen, run, api, setVoyageMo, toast } = useApp();
  const [keo, setKeo] = useState(null); // { v, dx, dy, x0, y0, moved }
  const [xacNhan, setXacNhan] = useState(null);
  const [tro, setTro] = useState(null); // { x, cx, cy } thanh tàu đang trỏ chuột
  const khung = useRef();
  const den = tu + soNgay * DAY, W = soNgay * pxNgay;
  const xOf = (t) => ((t - tu) / DAY) * pxNgay;

  const hang = useMemo(() => {
    const rows = [...D.berths.map((b) => ({ ma: b.ma, b })), { ma: "", b: null }];
    const theoBen = new Map(rows.map((r) => [r.ma, []]));
    for (const v of voyages) {
      const k = khoangBen(v, D.now);
      if (!k) continue;
      // Toàn thời gian: bắt đầu từ lúc đến neo / NOR / được phép cập (mốc sớm nhất có ghi), nếu sớm hơn lúc chiếm bến
      const choTu = che === "toan" ? Math.min(...[v.den_neo, v.nor, v.cho_phep_cap].filter(Boolean).map(ms)) : Infinity;
      const a0 = choTu < k.a ? choTu : null, la = a0 ?? k.a;
      if (k.b < tu || la > den) continue;
      // Chuyển bến / ra neo: mỗi đoạn tàu chiếm một bến là một thanh riêng. Tàu cập hai bến (bến phụ): thanh ở cả hai dòng bến
      doanBen(v, D.stopsOf(v.id), D.now).forEach((d, i) => {
        if (d.b < tu || (i ? d.a : la) > den) return;
        const phu = d.phu && laBenLienKe(D.berths, d.ben, d.phu) ? d.phu : "";
        for (const ma of phu ? [d.ben, phu] : [d.ben || ""]) {
          const row = theoBen.has(ma) ? ma : "";
          theoBen.get(row).push({ v, a: d.a, b: d.b, uoc: d.uoc, a0: i ? null : a0, la: i ? d.a : la, st: trangThai(v), rowMa: row, haiBen: phu ? noiHaiBen(d.ben, phu) : null });
        }
      });
    }
    let y = 0;
    return rows.filter((r) => r.ma || theoBen.get("").length).map((r) => {
      const ds = theoBen.get(r.ma), soLan = chiaLan(ds), h = Math.max(ROW, soLan * K.lan + K.top * 2);
      const out = { ...r, ds, soLan, y, h }; y += h; return out;
    });
  }, [voyages, D.berths, D.now, tu, den, che, gon]); // eslint-disable-line react-hooks/exhaustive-deps
  const cao = hang.reduce((s, r) => s + r.h, 0);
  const canhBaoCua = useMemo(() => new Map(D.alerts.map((a) => [a.voyage.id, a.muc === "bad" ? "bad" : a.muc])), [D.alerts]);

  const benTaiY = (y) => hang.find((r) => y >= r.y && y < r.y + r.h)?.ma;
  const onDown = (e, x) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setKeo({ x, dx: 0, dy: 0, x0: e.clientX, y0: e.clientY, moved: false, coKeo: quyen.nhap && KEO_DUOC.has(x.st) });
  };
  const onMove = (e) => {
    if (!keo) return;
    const dx = e.clientX - keo.x0, dy = e.clientY - keo.y0;
    if (!keo.moved && Math.hypot(dx, dy) < 5) return;
    setKeo({ ...keo, dx, dy, moved: true, cx: e.clientX, cy: e.clientY });
  };
  // Bến và giờ mới theo chỗ đang kéo. Dời lên / xuống bao nhiêu dòng thì bến chính (và bến phụ, nếu có) dời bấy nhiêu dòng;
  // tàu hai bến dời sang hai bến mới vẫn liền nhau thì giữ hai bến
  const tinhKeo = ({ x, dx, dy }) => {
    const lech = Math.round(((dx / pxNgay) * DAY) / SNAP) * SNAP;
    const rowCu = hang.find((r) => r.ma === x.rowMa) || hang.find((r) => r.ma === (x.v.ben_ma || ""));
    const rowMoi = benTaiY(rowCu.y + x.lan * K.lan + K.top + dy + K.bar / 2) ?? rowCu.ma;
    let benMoi = x.v.ben_ma || "", phuMoi = x.v.ben_phu || "";
    if (rowMoi !== rowCu.ma) {
      const thu = D.berths.map((b) => b.ma), lechDong = thu.indexOf(rowMoi) - thu.indexOf(rowCu.ma);
      const doi = (ma) => (thu.includes(ma) && thu.indexOf(rowCu.ma) >= 0 && rowMoi ? thu[thu.indexOf(ma) + lechDong] || "" : "");
      benMoi = x.v.ben_phu ? doi(x.v.ben_ma) || rowMoi : rowMoi;
      phuMoi = x.v.ben_phu ? doi(x.v.ben_phu) : "";
      if (!laBenLienKe(D.berths, benMoi, phuMoi)) { benMoi = rowMoi; phuMoi = ""; }
    }
    return { lech, benMoi, phuMoi };
  };
  const onUp = () => {
    if (!keo) return;
    const { x, moved, coKeo } = keo;
    setKeo(null);
    if (!moved) return setVoyageMo(x.v.id);
    if (!coKeo) return toast(quyen.nhap ? "Tàu đã cập bến: sửa mốc giờ trong phiếu chuyến" : "Vai trò Xem không dời được lịch", "warn");
    const { lech, benMoi, phuMoi } = tinhKeo(keo);
    if (!lech && benMoi === (x.v.ben_ma || "") && phuMoi === (x.v.ben_phu || "")) return;
    const doiBen = benMoi !== (x.v.ben_ma || "") || phuMoi !== (x.v.ben_phu || "");
    // Đổi bến thì bỏ vị trí mét cũ (web tự xếp; đặt lại ở Sơ đồ cầu bến)
    const patch = { ben_ma: benMoi || null, etb: iso(x.a + lech), etd: iso(x.b + lech), ...(D.coSql28 ? { ben_phu: phuMoi || null, ...(doiBen ? { vi_tri: null } : {}) } : {}) };
    const vMoi = { ...x.v, ...patch };
    const canh = kiemTraBen(vMoi, D.bmap[benMoi], vMoi.ben_phu ? D.bmap[vMoi.ben_phu] : null, D.berths).filter((c) => c.muc !== "info");
    // Cập cùng tàu khác: kiểm tra số mét theo quy tắc cập cầu bến (đủ chỗ thì không báo)
    for (const t of kiemTraXepBen(vMoi, benMoi, x.a + lech, x.b + lech, { voyages, berths: D.berths, stopsOf: D.stopsOf, now: D.now })) canh.push({ muc: "warn", nd: nhanCho(t, vMoi) });
    const luu = () => run(() => api.updateVoyage(x.v.id, patch), `Đã dời ${x.v.ten_tau} sang ${benMoi ? "bến " + noiHaiBen(benMoi, patch.ben_phu) : "chưa xếp bến"}, cập ${ngayGio(patch.etb)}`);
    if (canh.length) setXacNhan({ v: x.v, patch, canh, luu }); else luu();
  };

  const ngayDs = Array.from({ length: soNgay }, (_, i) => tu + i * DAY);
  return (
    <>
      <div ref={khung} className="scroll-x relative rounded-md border" style={{ maxHeight: maxH }}>
        <div style={{ width: LABEL + W }} className="relative select-none">
          {/* Tiêu đề ngày */}
          <div className="sticky top-0 z-20 flex border-b bg-card" style={{ height: K.head }}>
            <div className={cn("sticky left-0 z-30 border-r bg-card px-2 py-1 font-semibold text-muted-foreground", K.chu)} style={{ width: LABEL, minWidth: LABEL }}>Bến</div>
            {ngayDs.map((t) => { const d = new Date(t), cn0 = d.getDay() === 0; return (
              <div key={t} className={cn("shrink-0 border-r text-center leading-tight", K.chu, cn0 && "bg-muted/60")} style={{ width: pxNgay }}>
                <div className={cn("font-semibold tabular-nums", gon ? "pt-0.5" : "pt-1")}>{pad(d.getDate())}/{pad(d.getMonth() + 1)}</div><div className="text-muted-foreground">{THU[d.getDay()]}</div>
              </div>); })}
          </div>
          {/* Hàng bến */}
          <div className="relative" style={{ height: cao }} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => setKeo(null)}>
            {ngayDs.map((t, i) => <div key={t} className={cn("absolute inset-y-0 border-r", new Date(t).getDay() === 0 && "bg-muted/40")} style={{ left: LABEL + i * pxNgay, width: pxNgay }} />)}
            {D.now >= tu && D.now <= den && <div className="absolute inset-y-0 z-10 w-0.5 bg-bad/80" style={{ left: LABEL + xOf(D.now) }} title={`Hiện tại ${ngayGio(D.now)}`} />}
            {hang.map((r) => (
              <div key={r.ma || "_"} className="absolute inset-x-0 border-b" style={{ top: r.y, height: r.h }}>
                <div className="sticky left-0 z-20 flex h-full flex-col justify-center border-r bg-card px-2" style={{ width: LABEL }}
                  title={r.b ? `Bến ${r.b.ma}: DWT ${so(r.b.dwt_max)} · mớn ${r.b.mon_cung ? "≤" : ""}${so(r.b.mon_max, 2)} m · dài ${so(r.b.loa_max, 1)} m\n${r.b.loai_hang || ""}` : "Chuyến chưa xếp bến"}>
                  <span className={cn("font-mono font-semibold", gon ? "text-[11px]" : "text-[13px]")}>{r.b ? tenBen(r.b.ma) : "Chưa xếp"}</span>
                  {r.b && !gon && <span className="text-[10px] text-muted-foreground">{r.b.mon_cung ? "≤" : ""}{so(r.b.mon_max, 1)}m · {so(r.b.loa_max)}m</span>}
                </div>
                {r.ds.map((x) => {
                  const dangKeo = keo?.x.v.id === x.v.id && keo.moved && keo.coKeo;
                  const left = Math.max(0, xOf(x.a)), right = Math.min(W, xOf(x.b)), w = Math.max(6, right - left);
                  const cs = x.st === "lam_hang" ? chiSo(x.v, D.stopsOf(x.v.id), D.now) : null;
                  const muc = canhBaoCua.get(x.v.id), mau = TRANG_THAI[x.st].mau;
                  const top = K.top + x.lan * K.lan, troVao = (e) => !keo && e.pointerType === "mouse" && setTro({ x, cx: e.clientX, cy: e.clientY });
                  // Toàn thời gian: đoạn chờ (đến neo / NOR -> cập bến) và các vạch mốc
                  const choL = x.a0 != null ? Math.max(0, xOf(x.a0)) : null, choR = x.a0 != null ? Math.min(W, xOf(x.a)) : null;
                  const coCho = choL != null && choR > choL;
                  const vach = che === "toan" ? [["NOR", x.v.nor], ["BĐ làm hàng", x.v.bd_lam_hang], ["KT làm hàng", x.v.kt_lam_hang]].filter(([, t]) => t && ms(t) >= tu && ms(t) <= den) : [];
                  return (
                    <Fragment key={x.v.id}>
                    {coCho && (
                      <div onPointerDown={(e) => { setTro(null); onDown(e, x); }} onPointerMove={troVao} onPointerLeave={() => setTro(null)}
                        className={cn("absolute z-10 flex cursor-pointer items-center overflow-hidden rounded-l-md border border-r-0 border-warn/70 px-1 font-medium text-warn", K.chu, dangKeo && "opacity-40")}
                        style={{ left: LABEL + choL, width: choR - choL, top, height: K.bar, background: "repeating-linear-gradient(135deg, hsl(var(--warn) / .22), hsl(var(--warn) / .22) 5px, transparent 5px, transparent 10px)" }}>
                        {choR - choL > 70 && !gon && <span className="truncate">Chờ {thoiLuong((x.a - x.a0) / 36e5, { ngan: true })}</span>}
                      </div>
                    )}
                    {vach.map(([ten, t]) => <div key={ten} className="pointer-events-none absolute z-20 w-0.5 rounded bg-white/90 shadow" style={{ left: LABEL + xOf(ms(t)) - 1, top: top - 2, height: K.bar + 4 }} />)}
                    <div onPointerDown={(e) => { setTro(null); onDown(e, x); }}
                      onPointerMove={troVao} onPointerLeave={() => setTro(null)}
                      className={cn("absolute z-10 flex items-center overflow-hidden rounded-md px-1.5 font-medium text-white shadow-sm", K.chu, coCho && "rounded-l-none",
                        KEO_DUOC.has(x.st) && quyen.nhap ? "cursor-grab" : "cursor-pointer", dangKeo && "z-30 cursor-grabbing opacity-90 ring-2 ring-white",
                        muc === "bad" && "outline outline-2 outline-offset-1 outline-bad", muc === "warn" && "outline outline-2 outline-offset-1 outline-warn", x.v.huy && "line-through opacity-50")}
                      style={{ left: LABEL + left, width: w, top, height: K.bar, background: x.uoc ? `repeating-linear-gradient(135deg, ${mau}, ${mau} 8px, ${mau}cc 8px, ${mau}cc 12px)` : mau,
                        transform: dangKeo ? `translate(${keo.dx}px, ${keo.dy}px)` : undefined }}
                      aria-label={`${x.v.ten_tau}: ${TRANG_THAI[x.st].ten}`}>
                      {cs && <div className="absolute inset-y-0 left-0 bg-black/25" style={{ width: `${Math.min(100, (cs.hoanTat || 0) * 100)}%` }} />}
                      <span className="relative truncate">{x.v.uu_tien ? "★ " : ""}{x.haiBen ? "⇕ " : ""}{x.v.ten_tau}{x.haiBen && !gon && w > 110 ? ` (${x.haiBen})` : ""}{!gon && w > 140 && x.v.khoi_luong ? ` · ${so(x.v.khoi_luong)}t` : ""}</span>
                    </div>
                    </Fragment>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {Object.entries(TRANG_THAI).map(([k, t]) => <span key={k} className="flex items-center gap-1"><i className="inline-block h-2.5 w-4 rounded-sm" style={{ background: t.mau }} />{t.ten}</span>)}
        <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-4 rounded-sm" style={{ background: "repeating-linear-gradient(135deg,#94a3b8,#94a3b8 4px,#94a3b8aa 4px,#94a3b8aa 6px)" }} />Giờ rời ước tính</span>
        <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-4 rounded-sm outline outline-2 outline-bad" />Có cảnh báo khẩn</span>
        <span className="flex items-center gap-1"><i className="inline-block h-3 w-0.5 bg-bad" />Hiện tại</span>
        {che === "toan" && <>
          <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-4 rounded-sm border border-warn/70" style={{ background: "repeating-linear-gradient(135deg, hsl(var(--warn) / .3), hsl(var(--warn) / .3) 3px, transparent 3px, transparent 6px)" }} />Chờ (từ đến neo / NOR tới cập bến)</span>
          <span className="flex items-center gap-1"><i className="inline-block h-3 w-0.5 bg-white" />Vạch NOR, bắt đầu / kết thúc làm hàng</span>
        </>}
      </div>
      {keo?.moved && keo.coKeo && (() => { const k = tinhKeo(keo); return (
        <div className="pointer-events-none fixed z-50 rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-lg" style={{ left: (keo.cx ?? 0) + 16, top: (keo.cy ?? 0) + 16 }}>
          <div className="font-semibold">{keo.x.v.ten_tau}{keo.x.v.loa ? ` · ${so(keo.x.v.loa)} m` : ""}</div>
          <div>Bến <b>{k.benMoi ? noiHaiBen(k.benMoi, k.phuMoi) : "chưa xếp"}</b>{k.benMoi !== (keo.x.v.ben_ma || "") && keo.x.v.vi_tri != null ? <span className="text-muted-foreground"> · bỏ vị trí mét cũ</span> : keo.x.v.vi_tri != null ? <> · mét <b>{viTriChu(keo.x.v.vi_tri, keo.x.v.loa)}</b></> : null}</div>
          <div>Cập <b className="tabular-nums">{ngayGio(keo.x.a + k.lech)}</b> → rời <b className="tabular-nums">{ngayGio(keo.x.b + k.lech)}</b>{k.lech ? <span className="text-muted-foreground"> ({k.lech > 0 ? "+" : "−"}{so(Math.abs(k.lech) / 36e5, 1)} giờ)</span> : null}</div>
          <div className="text-muted-foreground">Chọn vị trí mét: chuyển sang chế độ Theo mét</div>
        </div>); })()}
      {tro && !keo && <TheTau x={tro.x} cx={tro.cx} cy={tro.cy} />}
      {xacNhan && (
        <Dialog onOpenChange={(o) => !o && setXacNhan(null)} title={`Dời ${xacNhan.v.ten_tau}?`} description={`Bến ${noiHaiBen(xacNhan.patch.ben_ma, xacNhan.patch.ben_phu) || "—"} · cập ${ngayGio(xacNhan.patch.etb)} → rời ${ngayGio(xacNhan.patch.etd)}`}
          footer={<><Button variant="outline" onClick={() => setXacNhan(null)}>Hủy</Button><Button variant={xacNhan.canh.some((c) => c.muc === "bad") ? "destructive" : "default"} onClick={() => { xacNhan.luu(); setXacNhan(null); }}>Vẫn dời</Button></>}>
          <div className="grid gap-2 text-sm">
            {xacNhan.canh.map((c, i) => <div key={i} className="flex gap-2"><MucIcon muc={c.muc} className="mt-0.5" />{c.nd}</div>)}
          </div>
        </Dialog>
      )}
    </>
  );
}

// Khung thông tin đầy đủ khi trỏ chuột vào thanh tàu: hàng, khối lượng, tiến độ, mốc giờ, bãi, phương tiện, cẩu, cảnh báo
export function TheTau({ x, cx, cy }) {
  const { D, quyen } = useApp();
  const cranes = useCau();
  const tb = thietBiChuyen(x.v, D.plansOf(x.v.id), { cranes, stops: D.stopsOf(x.v.id), now: D.now });
  const v = x.v, cs = chiSo(v, D.stopsOf(v.id), D.now);
  const canh = D.alerts.filter((a) => a.voyage.id === v.id);
  const W = 340, trai = cx + 16 + W > window.innerWidth ? cx - W - 16 : cx + 16;
  const el = useRef(); const [cao, setCao] = useState(0);
  useLayoutEffect(() => { setCao(el.current?.offsetHeight || 0); }, [v.id]);
  // Đặt khung dưới con trỏ; không đủ chỗ thì đẩy lên cho vừa màn hình
  const tren = Math.max(8, Math.min(cy + 12, window.innerHeight - cao - 8));
  const moc = [["ETA", v.eta], ["Dự kiến cập (ETB)", v.etb], ["Dự kiến rời (ETD)", v.etd], ...MOC.slice(1).map((m) => [m.ngan, v[m.k]])].filter(([, t]) => t);
  const D2 = ({ l, children }) => <div className="flex gap-2"><span className="w-28 shrink-0 text-muted-foreground">{l}</span><span className="min-w-0 flex-1">{children}</span></div>;
  return (
    <div ref={el} className="pointer-events-none fixed z-50 grid max-h-[calc(100vh-16px)] gap-1.5 overflow-hidden rounded-lg border bg-popover p-3 text-xs text-popover-foreground shadow-xl"
      style={{ width: W, left: Math.max(8, trai), top: tren, visibility: cao ? "visible" : "hidden" }}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1"><div className="text-sm font-semibold">{v.ten_tau}</div><div className="text-muted-foreground">{v.ma_chuyen}</div></div>
        <span className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-white" style={{ background: TRANG_THAI[x.st].mau }}>{TRANG_THAI[x.st].ten}</span>
      </div>
      <D2 l="Bến">{v.ben_ma ? `${tenBenChuyen(v)}${v.vi_tri != null ? " " + viTriChu(v.vi_tri, v.loa) : ""}` : "Chưa xếp"}{v.dwt ? ` · DWT ${so(v.dwt)}` : ""}{v.draft ? ` · mớn ${so(v.draft, 2)} m` : ""}{v.loa ? ` · LOA ${so(v.loa, 1)} m` : ""}</D2>
      <D2 l="Hàng">{v.huong === "xuat" ? "Xuất" : "Nhập"} {v.loai_hang}{v.ten_hang && v.ten_hang !== v.loai_hang ? ` – ${v.ten_hang}` : ""}</D2>
      <D2 l="Khối lượng"><b>{so(v.khoi_luong)} t</b> · đã làm {so(cs.daLam)} t{cs.hoanTat != null ? ` (${so(cs.hoanTat * 100, 1)}%)` : ""} · còn {so(cs.conLai)} t</D2>
      {v.so_mang != null && <D2 l="Số máng">{v.so_mang} máng</D2>}
      <D2 l="Cam kết">{+v.cam_ket ? `${so(v.cam_ket)} t/ngày` : v.cam_ket_ghi_chu || "—"}{cs.nangSuat != null ? ` · thực ${so(cs.nangSuat)} t/ngày` : ""}</D2>
      <div className="mt-0.5 border-t pt-1.5">{moc.map(([l, t]) => <D2 key={l} l={l}><span className="tabular-nums">{ngayGioNam(t)}</span></D2>)}</div>
      {cs.choNeo != null && <D2 l="Chờ neo">{thoiLuong(cs.choNeo)}</D2>}
      <div className="mt-0.5 border-t pt-1.5 grid gap-1.5">
        <div className="text-[11px] text-muted-foreground">{tb.plan ? `Theo phương án ${tb.plan.ten} (${TRANG_THAI_PA[tb.plan.trang_thai]?.ten.toLowerCase() || tb.plan.trang_thai})` : "Theo phiếu chuyến (chưa có phương án)"}</div>
        <D2 l={tenBai(v)}>{tb.bai.map((b) => `${b.bai}${b.khu ? ` › ${b.khu}` : ""}${b.khoi_luong != null ? ` ${so(b.khoi_luong)} t` : ""}`).join("; ") || "—"}</D2>
        <D2 l="Xe vận chuyển">{moTaTB(tb.xe) || "—"}</D2>
        <D2 l="Hót vét / be hầm">{moTaTB(tb.hotVet) || "—"}</D2>
        <D2 l={v.huong === "xuat" ? "Lên hàng" : "Vun hàng"}>{moTaTB(tb.vunHang) || "—"}</D2>
        <D2 l="Cẩu">{tb.cau.join(", ") || "—"}{tb.bangTai ? ` · băng tải ${tb.bangTai}` : ""}</D2>
        {tb.cauTau && (+tb.cauTau.so > 0 || +tb.cauTau.nang_suat > 0) && <D2 l="Cẩu tàu">{tb.cauTau.so ?? "?"} cẩu × {tb.cauTau.nang_suat ?? "?"} t/h</D2>}
        {tb.cauGan.length > 0 && <D2 l="Gắn cẩu">{tb.cauGan.join(", ")}</D2>}
      </div>
      {canh.length > 0 && <div className="mt-0.5 grid gap-1 border-t pt-1.5">{canh.map((a) => <div key={a.id} className="flex gap-1.5"><MucIcon muc={a.muc} className="h-3.5 w-3.5" />{a.nd}</div>)}</div>}
      <div className="text-[11px] text-muted-foreground">{KEO_DUOC.has(x.st) && quyen.nhap ? "Kéo để đổi bến / giờ dự kiến · bấm để mở phiếu" : "Bấm để mở phiếu chuyến"}</div>
    </div>
  );
}
