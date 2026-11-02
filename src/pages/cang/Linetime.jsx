import { useMemo, useState } from "react";
import { Plus, ClipboardPaste, CalendarRange, CalendarClock, CalendarCheck, Rows3, Rows4, List, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Anchor, Clock3, Ruler } from "lucide-react";
import { useApp } from "@/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import SoMetBen from "./SoMetBen";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHead, TrangThaiBadge, TienDo, Empty, MucIcon } from "@/components/common";
import { cn } from "@/lib/utils";
import { trangThai, chiSo, khoangBen, TRANG_THAI } from "@/lib/linetime";
import { so, ngayGio, matchQ, DAY, thangCua, tenThang, congThang } from "@/lib/format";
import { useToanManHinh, NutToanManHinh } from "@/components/ui/toanManHinh";
import Gantt from "./Gantt";
import GanttMet from "./GanttMet";
import BangTauBen, { tenBen, tenBenChuyen } from "./BangTauBen";
import ChuyenForm from "./ChuyenForm";
import KhaiBaoTT, { UuTien } from "./KhaiBaoTT";
import DanNhanh from "./DanNhanh";
import SapDen from "./SapDen";
import KeHoachNgay from "./KeHoachNgay";

const homNay = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
const ZOOM = [36, 56, 84, 120];

export default function Linetime() {
  const { D, quyen, setVoyageMo, tuThang, moRongKhoang } = useApp();
  const [tab, setTab] = useState(() => { try { return localStorage.getItem("lg-linetime-tab") || "gantt"; } catch { return "gantt"; } });
  const [f, setF] = useState({ q: "", ben: "", st: "", huong: "", thang: "" });
  const [tu, setTu] = useState(() => homNay() - 3 * DAY);
  const [soNgay, setSoNgay] = useState(30);
  const [zoom, setZoom] = useState(1);
  // Chế độ xem lịch cầu bến: "ben" chỉ thời gian chiếm bến, "toan" thêm thời gian chờ từ lúc đến neo / NOR; gon: dòng thấp, chữ nhỏ
  const doc = (k, md) => { try { return localStorage.getItem(k) ?? md; } catch { return md; } };
  const ghi = (k, v) => { try { localStorage.setItem(k, v); } catch { /* bỏ qua */ } };
  const [che, setChe] = useState(() => doc("lg-gantt-che", "ben"));
  const [gon, setGon] = useState(() => doc("lg-gantt-gon", "0") === "1");
  // Trục dọc của lịch: "ben" mỗi bến một dòng; "met" theo mét dọc tuyến bến (đặt vị trí mét, tàu hai bến)
  const [truc, setTruc] = useState(() => doc("lg-gantt-truc", "ben"));
  const [them, setThem] = useState(false);
  const [toanMH, doiToanMH] = useToanManHinh();
  const [dan, setDan] = useState(false);
  const doiTab = (t) => { setTab(t); try { localStorage.setItem("lg-linetime-tab", t); } catch { /* bỏ qua */ } };

  const loc = useMemo(() => D.voyages.filter((v) => {
    const st = trangThai(v);
    if (f.st ? st !== f.st : st === "huy") return false;
    if (f.ben && (f.ben === "_" ? !!v.ben_ma : v.ben_ma !== f.ben && v.ben_phu !== f.ben)) return false; // lọc bến: kể cả tàu có bến phụ là bến đó
    if (f.huong && v.huong !== f.huong) return false;
    if (f.thang) { const k = khoangBen(v, D.now); if (!k || thangCua(k.a) !== f.thang) return false; }
    return matchQ(f.q, v.ten_tau, v.ma_chuyen, v.loai_hang, v.ten_hang, (v.cau || []).join(" "));
  }), [D.voyages, D.now, f]);

  const thangs = useMemo(() => { const now = thangCua(D.now); return Array.from({ length: 15 }, (_, i) => congThang(now, 3 - i)); }, [D.now]);
  const chonThang = (t) => { setF({ ...f, thang: t }); if (t && t < tuThang) moRongKhoang(t); };
  const canhCua = useMemo(() => { const m = new Map(); for (const a of D.alerts) (m.get(a.voyage.id) || m.set(a.voyage.id, []).get(a.voyage.id)).push(a); return m; }, [D.alerts]);

  return (
    <>
      <PageHead title="Linetime tàu cập bến" desc="Lịch cầu bến, tiến độ theo bến và danh sách chuyến. Bấm vào tàu để mở phiếu chuyến (9 mốc giờ, nhật ký, khoảng dừng, laytime).">
        {quyen.nhap && <><Button variant="outline" onClick={() => setDan(true)}><ClipboardPaste />Dán nhanh</Button><Button onClick={() => setThem(true)}><Plus />Thêm chuyến</Button></>}
      </PageHead>
      <Card className="mb-3">
        <CardContent className="flex flex-wrap items-center gap-2 pt-4">
          <Input className="w-56" placeholder="Tìm tàu, mã chuyến, hàng, đại lý, cẩu…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
          <NativeSelect className="w-36" value={f.ben} onChange={(e) => setF({ ...f, ben: e.target.value })} placeholder="Mọi bến" options={[...D.berths.map((b) => [b.ma, tenBen(b.ma)]), ["_", "Chưa xếp bến"]]} />
          <NativeSelect className="w-40" value={f.st} onChange={(e) => setF({ ...f, st: e.target.value })} placeholder="Mọi trạng thái (trừ hủy)" options={Object.entries(TRANG_THAI).map(([k, t]) => [k, t.ten])} />
          <NativeSelect className="w-28" value={f.huong} onChange={(e) => setF({ ...f, huong: e.target.value })} placeholder="Nhập + xuất" options={[["nhap", "Nhập"], ["xuat", "Xuất"]]} />
          {tab === "ds" && <NativeSelect className="w-40" value={f.thang} onChange={(e) => chonThang(e.target.value)} placeholder="Mọi tháng đang tải" options={thangs.map((t) => [t, tenThang(t)])} />}
          <span className="ml-auto text-xs text-muted-foreground">{loc.length} chuyến</span>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={doiTab}>
        <TabsList>
          <TabsTrigger value="gantt"><CalendarRange />Lịch cầu bến</TabsTrigger>
          <TabsTrigger value="ben"><Rows3 />Tàu theo bến</TabsTrigger>
          <TabsTrigger value="met"><Ruler />Sơ đồ cầu bến</TabsTrigger>
          <TabsTrigger value="kh"><CalendarCheck />Kế hoạch ngày tới</TabsTrigger>
          <TabsTrigger value="sap"><CalendarClock />Tàu sắp đến (7 ngày)</TabsTrigger>
          <TabsTrigger value="ds"><List />Danh sách chuyến</TabsTrigger>
        </TabsList>

        <TabsContent value="gantt">
          {/* Lịch cầu bến có nút Toàn màn hình: thanh công cụ + lịch phủ kín màn hình */}
          <div className={cn(toanMH && "fixed inset-0 z-[45] flex flex-col overflow-auto bg-background p-3")}>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setTu(tu - 7 * DAY)} aria-label="Lùi 7 ngày"><ChevronLeft /></Button>
            <Button size="sm" variant="outline" onClick={() => setTu(homNay() - 3 * DAY)}>Hôm nay</Button>
            <Button size="sm" variant="outline" onClick={() => setTu(tu + 7 * DAY)} aria-label="Tới 7 ngày"><ChevronRight /></Button>
            <span className="text-sm tabular-nums">{ngayGio(tu).slice(0, 5)} → {ngayGio(tu + (soNgay - 1) * DAY).slice(0, 5)}</span>
            <NativeSelect className="h-8 w-28" value={soNgay} onChange={(e) => setSoNgay(+e.target.value)} options={[[14, "14 ngày"], [30, "30 ngày"], [45, "45 ngày"], [60, "60 ngày"], [90, "90 ngày"]]} />
            <Button size="icon" variant="ghost" disabled={zoom === 0} onClick={() => setZoom(zoom - 1)} aria-label="Thu nhỏ"><ZoomOut /></Button>
            <Button size="icon" variant="ghost" disabled={zoom === ZOOM.length - 1} onClick={() => setZoom(zoom + 1)} aria-label="Phóng to"><ZoomIn /></Button>
            <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="Trục dọc">
              {[["ben", "Theo bến", "Mỗi bến một dòng"], ["met", "Theo mét", "Dọc theo mét từng tuyến bến: tàu nằm đúng vị trí mét, kéo dọc để đặt vị trí / đổi bến, kéo ngang để đổi giờ"]].map(([k, t, mo]) => (
                <Button key={k} size="xs" variant={truc === k ? "secondary" : "ghost"} className={cn(truc === k && "text-primary")} title={mo} aria-pressed={truc === k}
                  onClick={() => { setTruc(k); ghi("lg-gantt-truc", k); }}>{k === "met" ? <Ruler /> : <Rows4 />}{t}</Button>))}
            </div>
            {truc === "ben" && <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="Chế độ xem">
              {[["ben", "Chiếm bến", "Thanh tàu = thời gian ở bến (ATB / ETB → ATD / ETD)"], ["toan", "Toàn thời gian", "Thêm đoạn chờ từ lúc đến neo / NOR tới lúc cập bến, vạch NOR và làm hàng"]].map(([k, t, mo]) => (
                <Button key={k} size="xs" variant={che === k ? "secondary" : "ghost"} className={cn(che === k && "text-primary")} title={mo} aria-pressed={che === k}
                  onClick={() => { setChe(k); ghi("lg-gantt-che", k); }}>{k === "toan" ? <Clock3 /> : <Anchor />}{t}</Button>))}
            </div>}
            <Button size="xs" variant={gon ? "secondary" : "outline"} className={cn(gon && "text-primary")} aria-pressed={gon} title="Dòng thấp, chữ nhỏ: xem được nhiều bến hơn"
              onClick={() => { setGon(!gon); ghi("lg-gantt-gon", gon ? "0" : "1"); }}><Rows4 />Gọn</Button>
            {quyen.nhap && <span className="text-xs text-muted-foreground">{truc === "met" ? "Kéo ngang đổi giờ (tàu chưa cập, bước 30 phút), kéo dọc đặt vị trí mét / đổi bến." : "Kéo thanh tàu chưa cập bến để đổi bến / giờ dự kiến (bước 30 phút)."}</span>}
            <NutToanManHinh on={toanMH} onClick={doiToanMH} className="ml-auto" />
          </div>
          {truc === "met"
            ? <GanttMet voyages={loc} tu={tu} soNgay={soNgay} pxNgay={ZOOM[zoom]} gon={gon} maxH={toanMH ? "calc(100dvh - 130px)" : undefined} />
            : <Gantt voyages={loc} tu={tu} soNgay={soNgay} pxNgay={ZOOM[zoom]} che={che} gon={gon} maxH={toanMH ? "calc(100dvh - 130px)" : undefined} />}
          </div>
        </TabsContent>

        <TabsContent value="met"><SoMetBen /></TabsContent>

        <TabsContent value="ben"><Card><CardContent className="pt-4"><BangTauBen /></CardContent></Card></TabsContent>

        <TabsContent value="kh"><KeHoachNgay voyages={loc} /></TabsContent>

        <TabsContent value="sap"><SapDen voyages={loc} /></TabsContent>

        <TabsContent value="ds">
          <Card><CardContent className="pt-4">
            {loc.length ? (
              <div className="scroll-x max-h-[65vh]">
                <table className="tbl">
                  <thead><tr><th>Tàu / mã chuyến</th><th>Bến</th><th>Hàng</th><th className="num">KL (t)</th><th>ETA</th><th>Cập (ATB/ETB)</th><th>Rời (ATD/ETD)</th><th className="num">Cam kết</th><th>Trạng thái</th><th>Khai báo</th><th className="min-w-[150px]">Tiến độ</th><th>Cảnh báo</th></tr></thead>
                  <tbody>
                    {[...loc].sort((a, b) => (khoangBen(b, D.now)?.a ?? 0) - (khoangBen(a, D.now)?.a ?? 0)).map((v) => {
                      const cs = chiSo(v, D.stopsOf(v.id), D.now), cb = canhCua.get(v.id) || [];
                      return (
                        <tr key={v.id} className="cursor-pointer" onClick={() => setVoyageMo(v.id)}>
                          <td><div className="font-medium"><UuTien v={v} />{v.ten_tau}</div><div className="text-[11px] text-muted-foreground">{v.ma_chuyen}</div></td>
                          <td className="font-mono">{tenBenChuyen(v) || "—"}</td>
                          <td>{v.huong === "xuat" ? "Xuất" : "Nhập"} {v.loai_hang}<div className="max-w-[180px] truncate text-[11px] text-muted-foreground">{v.ten_hang}</div></td>
                          <td className="num">{so(v.khoi_luong)}</td>
                          <td className="whitespace-nowrap tabular-nums">{ngayGio(v.eta)}</td>
                          <td className="whitespace-nowrap tabular-nums">{v.atb ? ngayGio(v.atb) : <span className="text-muted-foreground">{ngayGio(v.etb)}</span>}</td>
                          <td className="whitespace-nowrap tabular-nums">{v.atd ? ngayGio(v.atd) : <span className="text-muted-foreground">{ngayGio(v.etd)}</span>}</td>
                          <td className="num">{+v.cam_ket ? so(v.cam_ket) : <span className="text-muted-foreground">{v.cam_ket_ghi_chu || "—"}</span>}</td>
                          <td><TrangThaiBadge st={cs.trangThai} /></td>
                          <td>{["du_kien", "cho_neo"].includes(cs.trangThai) ? <KhaiBaoTT v={v} /> : <span className="text-xs text-muted-foreground">—</span>}</td>
                          <td><TienDo v={cs.hoanTat} /></td>
                          <td>{cb.length ? <span className="flex items-center gap-1" title={cb.map((a) => a.nd).join("\n")}><MucIcon muc={cb[0].muc} />{cb.length}</span> : ""}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <Empty>Không có chuyến phù hợp bộ lọc.</Empty>}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
      {them && <ChuyenForm onClose={() => setThem(false)} onSaved={(v) => v && setVoyageMo(v.id)} />}
      {dan && <DanNhanh onClose={() => setDan(false)} />}
    </>
  );
}
