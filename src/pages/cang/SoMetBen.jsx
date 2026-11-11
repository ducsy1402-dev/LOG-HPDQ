import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { NgayGio } from "@/components/ui/ngaygio";
import { Dialog } from "@/components/ui/dialog";
import { Empty, MucIcon } from "@/components/common";
import { useApp } from "@/store";
import { met, toLocalInput, fromLocalInput, ms, ngayGio, HOUR } from "@/lib/format";
import { trangThai, TRANG_THAI } from "@/lib/linetime";
import { soDoCauBen, tenTuyen, benTheoViTri, kiemTraXepBen, nhanCho, noiViPham, TEN_HINH } from "@/lib/capBen";
import { kiemTraBen } from "@/lib/checks";
import { cn } from "@/lib/utils";
import { tenBen, noiHaiBen } from "./BangTauBen";
import { viTriChu } from "@/lib/tenBen";

// Tab "Sơ đồ cầu bến": tại một thời điểm, mỗi tuyến bến (đoạn cầu cảng thẳng) vẽ theo mét, tàu đang cập nằm đúng vị trí mét
// (đã ghi vị trí: viền liền; chưa ghi: web tự xếp, viền đứt). Kéo tàu dọc tuyến để đặt vị trí mét; kéo sang tuyến khác để đổi bến.
// Bến chính / bến phụ tự theo phần tàu chiếm. Mỗi tuyến kèm số mét cần (e hai đầu tuyến + chiều dài tàu + d giữa tàu), còn trống,
// tàu thêm vào dài tối đa ở từng bến và cảnh báo không đủ chỗ.
const BUOC = 6 * HOUR;
export default function SoMetBen() {
  const { D, quyen, run, api, setVoyageMo } = useApp();
  const [gio, setGio] = useState(() => toLocalInput(new Date(D.now).toISOString()));
  const t = ms(fromLocalInput(gio)) ?? D.now;
  const doiGio = (lech) => setGio(toLocalInput(new Date(t + lech).toISOString()));
  const bang = soDoCauBen(D.voyages, D.berths, D.stopsOf, t, D.now).filter((r) => r.dai > 0);
  const keoDuoc = quyen.nhap && D.coSql28;
  const [keo, setKeo] = useState(null); // { item, r, cx, cy, dx, dy, nam (mét từ đầu tàu tới chỗ bấm), moved }
  const [xacNhan, setXacNhan] = useState(null);
  // Mỗi tuyến vẽ hết bề ngang theo chiều dài của nó (ghi mét ở từng bến)
  const pct = (m, r) => `${(m / r.dai) * 100}%`;

  const metTai = (r, el, cx) => { const q = el.getBoundingClientRect(); return r.tuyen.tu + ((cx - q.left) / q.width) * r.dai; }; // mét tại điểm cx trên dải tuyến
  const daiEl = (ma) => document.querySelector(`[data-strip="${CSS.escape(ma)}"]`);
  const onDown = (e, item, r) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setKeo({ item, r, cx: e.clientX, cy: e.clientY, dx: 0, dy: 0, nam: metTai(r, daiEl(r.tuyen.ma), e.clientX) - item.x, moved: false });
  };
  const onMove = (e) => { if (!keo) return; const dx = e.clientX - keo.cx, dy = e.clientY - keo.cy; if (!keo.moved && Math.hypot(dx, dy) < 4) return; setKeo({ ...keo, dx, dy, moved: true }); };
  // Vị trí mới khi đang kéo: tuyến dưới con trỏ, mét đầu tàu (làm tròn 1 m) theo chỗ con trỏ trên dải tuyến đó
  const viTriMoi = (k) => {
    const cx = k.cx + k.dx, cy = k.cy + k.dy;
    const maT = document.elementsFromPoint(cx, cy).find((e) => e.dataset?.tuyen)?.dataset.tuyen || k.r.tuyen.ma;
    const r2 = bang.find((x) => x.tuyen.ma === maT) || k.r;
    const x = Math.round(metTai(r2, daiEl(r2.tuyen.ma), cx) - k.nam);
    return { r2, x, ben: benTheoViTri(D.berths, r2.tuyen.bens[0].ma, x, k.item.L) };
  };
  const onUp = () => {
    if (!keo) return;
    const k = keo; setKeo(null);
    if (!k.moved) { setVoyageMo(k.item.v.id); return; }
    if (!keoDuoc) return;
    if (!k.item.seg.cuoi) return setXacNhan({ loi: "Đoạn này là bến cũ trước khi chuyển bến: sửa ở phiếu chuyến › Chuyển bến & trả hàng." });
    const { r2, x, ben } = viTriMoi(k);
    if (!ben) return setXacNhan({ loi: `Mét ${met(x)}–${met(x + k.item.L)} ra ngoài tuyến ${tenTuyen(r2.tuyen, tenBen)} (mét ${met(r2.tuyen.tu)}–${met(r2.tuyen.den)}) hoặc chiếm hơn hai bến.` });
    const v = k.item.v, vMoi = { ...v, ben_ma: ben.ben_ma, ben_phu: ben.ben_phu, vi_tri: x };
    const canh = kiemTraBen(vMoi, D.bmap[ben.ben_ma], ben.ben_phu ? D.bmap[ben.ben_phu] : null, D.berths).filter((c) => c.muc !== "info");
    for (const c of kiemTraXepBen(vMoi, ben.ben_ma, k.item.seg.a, k.item.seg.b, { voyages: D.voyages, berths: D.berths, stopsOf: D.stopsOf, now: D.now })) canh.push({ muc: "warn", nd: nhanCho(c, vMoi) });
    const n = k.item.seg.nguon;
    const luu = () => run(async () => {
      // Đoạn đang ở bến ghi trong khoảng dừng chuyển bến: sửa cả khoảng dừng đó cho khớp
      if (n) await api.updateStop(n.s.id, n.phia === "moi" ? { ben_moi: ben.ben_ma, ben_phu_moi: ben.ben_phu || null, vi_tri_moi: x } : { ben_cu: ben.ben_ma, ben_phu_cu: ben.ben_phu || null, vi_tri_cu: x });
      await api.updateVoyage(v.id, { ben_ma: ben.ben_ma, ben_phu: ben.ben_phu || null, vi_tri: x });
    }, `Đã đặt ${v.ten_tau} ở bến ${noiHaiBen(ben.ben_ma, ben.ben_phu)} ${viTriChu(x, v.loa)}`);
    setXacNhan({ v, ben, x, canh, luu });
  };
  const boViTri = (item) => run(async () => {
    const n = item.seg.nguon;
    if (n) await api.updateStop(n.s.id, n.phia === "moi" ? { vi_tri_moi: null } : { vi_tri_cu: null });
    await api.updateVoyage(item.v.id, { vi_tri: null });
  }, `Đã bỏ vị trí mét của ${item.v.ten_tau} (web tự xếp)`);
  const dangKeo = keo?.moved ? viTriMoi(keo) : null;

  return (
    <Card><CardContent className="grid gap-3 pt-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Xem tại thời điểm" className="w-56"><NgayGio value={gio} onChange={setGio} /></Field>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => doiGio(-BUOC)} aria-label="Lùi 6 giờ" title="Lùi 6 giờ"><ChevronLeft /></Button>
          <Button size="sm" variant="outline" onClick={() => setGio(toLocalInput(new Date(D.now).toISOString()))}>Bây giờ</Button>
          <Button size="sm" variant="outline" onClick={() => doiGio(BUOC)} aria-label="Tới 6 giờ" title="Tới 6 giờ"><ChevronRight /></Button>
        </div>
        <div className="min-w-[260px] flex-1 text-xs text-muted-foreground">
          Số mét cần = e (đầu tuyến) + chiều dài các tàu + d giữa các tàu + e (cuối tuyến). d theo tàu lớn hơn; e chỉ tính ở hai đầu tuyến, đầu góc vuông (mét 0 bến 4, đầu tây bến 7) dùng hàng (b).
          Ranh giới giữa hai bến chỉ là mốc chia bến: tàu một bến nằm trọn trong bến đó, tàu hai bến (VD 7/8) nằm vắt qua ranh giới.
          {keoDuoc ? " Kéo tàu dọc tuyến để đặt vị trí mét, kéo sang tuyến khác để đổi bến; bấm vào tàu để mở phiếu chuyến." : !D.coSql28 ? " Chạy sql/28 để ghi vị trí mét và kéo thả tàu." : ""}
        </div>
      </div>
      {bang.length ? (
        <div className="grid gap-2" onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => setKeo(null)}>
          {bang.map((r) => (
            <div key={r.tuyen.ma} data-tuyen={r.tuyen.ma} className={cn("rounded-md border p-2", dangKeo?.r2.tuyen.ma === r.tuyen.ma && "border-primary bg-primary/5")}>
              <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                <b className="font-mono text-[0.8125rem]">{tenTuyen(r.tuyen, tenBen)}</b>
                <span className="text-muted-foreground">{met(r.dai)} m</span>
                {r.tau.length > 0 && (r.thieu ? <Badge tone="warn">Thiếu LOA</Badge> : r.vua ? <Badge tone="ok">Vừa</Badge> : <Badge tone="bad">Không vừa</Badge>)}
                {r.tau.length > 0 && !r.thieu && r.can != null && <span>cần <b>{met(r.can)}</b> m · còn trống <b className={cn(r.du < 0 && "text-bad")}>{met(r.du)}</b> m</span>}
                {r.themTheoBen && <span className="text-muted-foreground">thêm tối đa: {r.themTheoBen.map((x) => `${tenBen(x.ma)} ${x.them ? met(x.them) + " m" : "không"}`).join(" · ")}</span>}
                {!r.thieu && r.vua === false && <span className="font-medium text-bad">{noiViPham({ ...r, tauVP: r.tau[r.viPham?.i]?.v })}{r.thieuM ? `, thiếu ${met(r.thieuM)} m` : ""}</span>}
              </div>
              <div className="relative h-[60px]" data-strip={r.tuyen.ma}>
                {r.tuyen.bens.map((b) => (
                  <div key={b.ma} className={cn("absolute bottom-0 flex h-[20px] items-center justify-center border border-muted-foreground/40 bg-muted/60 text-[0.6875rem] font-semibold",
                    b.goc === "dau" && "border-l-4 border-l-warn", b.goc === "cuoi" && "border-r-4 border-r-warn")}
                    style={{ left: pct(b.tu - r.tuyen.tu, r), width: pct(b.den - b.tu, r) }}
                    title={`Bến ${b.ma}: mét ${met(b.tu)}–${met(b.den)}${b.goc ? ` · ${TEN_HINH.vuong_goc} ở mét ${met(b.goc === "dau" ? b.tu : b.den)}` : ""}`}>
                    <span className="truncate px-1">{tenBen(b.ma)} <span className="font-normal text-muted-foreground">{met(b.tu)}–{met(b.den)}</span></span>
                  </div>))}
                {r.tau.map((item) => {
                  if (item.x == null || !(item.L > 0)) return null;
                  const dangKeoTau = keo?.moved && keo.item.v.id === item.v.id && keo.item.seg.a === item.seg.a;
                  const loi = r.vua === false && r.tau[r.viPham?.i]?.v.id === item.v.id;
                  const mau = TRANG_THAI[trangThai(item.v)]?.mau || "#64748b";
                  return (
                    <div key={`${item.v.id}:${item.seg.a}`} onPointerDown={(e) => onDown(e, item, r)}
                      className={cn("absolute top-1 flex h-[30px] touch-none items-center overflow-hidden rounded px-1.5 text-[0.6875rem] font-medium text-white shadow-sm",
                        keoDuoc && item.seg.cuoi ? "cursor-grab" : "cursor-pointer", !item.coDinh && "border-2 border-dashed border-white/80 opacity-80",
                        loi && "outline outline-2 outline-offset-1 outline-bad", dangKeoTau && "z-30 cursor-grabbing ring-2 ring-white")}
                      style={{ left: pct(item.x - r.tuyen.tu, r), width: pct(item.L, r), background: mau, transform: dangKeoTau ? `translate(${keo.dx}px, ${keo.dy}px)` : undefined }}
                      title={`${item.v.ten_tau} · ${met(item.L)} m · bến ${noiHaiBen(item.ben, item.phu)} ${viTriChu(item.x, item.L)}${item.coDinh ? "" : " (web tự xếp, chưa ghi vị trí)"}`}>
                      <span className="truncate">{item.v.ten_tau} <span className="opacity-80">{viTriChu(item.x, item.L)}</span></span>
                    </div>);
                })}
              </div>
              {keoDuoc && r.tau.some((x) => x.coDinh && x.seg.cuoi) && (
                <div className="mt-1 flex flex-wrap gap-3 text-[0.6875rem] text-muted-foreground">
                  {r.tau.filter((x) => x.coDinh && x.seg.cuoi).map((x) => <button key={x.v.id} type="button" className="hover:text-primary hover:underline" onClick={() => boViTri(x)}>Bỏ vị trí {x.v.ten_tau}</button>)}
                </div>)}
            </div>))}
        </div>
      ) : <Empty>Chưa có bến nào khai chiều dài.</Empty>}
      {dangKeo && (
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md border bg-popover px-3 py-1.5 text-sm shadow-lg">
          {keo.item.v.ten_tau}: mét {met(dangKeo.x)}–{met(dangKeo.x + keo.item.L)} · {dangKeo.ben ? `bến ${noiHaiBen(dangKeo.ben.ben_ma, dangKeo.ben.ben_phu)}` : <span className="text-bad">ra ngoài tuyến / chiếm hơn hai bến</span>}
        </div>)}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.6875rem] text-muted-foreground">
        <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-5 rounded-sm bg-slate-500" />Tàu đã ghi vị trí mét</span>
        <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-5 rounded-sm border-2 border-dashed border-slate-400" />Web tự xếp (chưa ghi vị trí)</span>
        <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2 border-l-4 border-l-warn" />Đầu góc vuông</span>
        <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-5 rounded-sm outline outline-2 outline-bad" />Tàu không đủ chỗ</span>
      </div>
      {xacNhan && (
        <Dialog onOpenChange={(o) => !o && setXacNhan(null)} title={xacNhan.loi ? "Không đặt được" : `Đặt ${xacNhan.v.ten_tau}?`}
          description={xacNhan.loi ? null : `Bến ${noiHaiBen(xacNhan.ben.ben_ma, xacNhan.ben.ben_phu)} · mét ${met(xacNhan.x)}–${met(xacNhan.x + +xacNhan.v.loa)} · xem lúc ${ngayGio(t)}`}
          footer={xacNhan.loi ? <Button onClick={() => setXacNhan(null)}>Đóng</Button>
            : <><Button variant="outline" onClick={() => setXacNhan(null)}>Hủy</Button><Button variant={xacNhan.canh.length ? "destructive" : "default"} onClick={() => { xacNhan.luu(); setXacNhan(null); }}>{xacNhan.canh.length ? "Vẫn đặt" : "Đặt"}</Button></>}>
          {xacNhan.loi ? <div className="text-sm">{xacNhan.loi}</div>
            : xacNhan.canh.length ? <div className="grid gap-2 text-sm">{xacNhan.canh.map((c, i) => <div key={i} className="flex gap-2"><MucIcon muc={c.muc} className="mt-0.5" />{c.nd}</div>)}</div>
            : <div className="text-sm text-ok">Đủ chỗ theo quy tắc cập cầu bến trong suốt thời gian tàu ở bến.</div>}
        </Dialog>)}
    </CardContent></Card>
  );
}
