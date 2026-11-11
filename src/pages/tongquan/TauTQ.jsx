import { useEffect, useMemo, useRef, useState } from "react";
import { Ship } from "lucide-react";
import { useApp } from "@/store";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Empty, TrangThaiBadge, TienDo } from "@/components/common";
import { trangThai, chiSo, TRANG_THAI } from "@/lib/linetime";
import { so, pct, ngayGio, thoiLuong, DAY } from "@/lib/format";
import { cn } from "@/lib/utils";
import { tenBen, tenBenChuyen } from "../cang/BangTauBen";
import Gantt from "../cang/Gantt";
import KeHoachNgay, { trongKeHoachNgay } from "../cang/KeHoachNgay";
import { laSapDen } from "../cang/SapDen";
import { NativeSelect } from "@/components/ui/input";
import { UuTien } from "../cang/KhaiBaoTT";
import { TheTQ, HopTQ } from "./khung";

const O_BEN = ["cap_ben", "lam_hang", "xong_hang"];

// Tàu đang ở cảng / chờ neo, bến đang có tàu, số tàu cập trong kế hoạch ngày tới, sắp đến 7 ngày
function useTongHopTau() {
  const { D } = useApp();
  return useMemo(() => {
    const ds = D.voyages.filter((v) => !v.huy).map((v) => ({ v, st: trangThai(v) }));
    const dem = (s) => ds.filter((x) => x.st === s).length;
    const benCo = new Map();
    for (const x of ds) if (x.v.ben_ma && O_BEN.includes(x.st)) for (const ma of [x.v.ben_ma, x.v.ben_phu].filter(Boolean)) (benCo.get(ma) || benCo.set(ma, []).get(ma)).push(x); // tàu hai bến tính ở cả hai bến
    const keHoach = D.voyages.filter((v) => trongKeHoachNgay(v, D.now)).length;
    const sapDen = D.voyages.filter((v) => laSapDen(v, D.now)).length;
    return { ds, dem, benCo, keHoach, sapDen };
  }, [D]);
}

export function TheTau({ onMo }) {
  const { D } = useApp();
  const { dem, benCo, keHoach, sapDen } = useTongHopTau();
  const khan = D.alerts.filter((a) => a.muc === "bad").length;
  const choNeo = dem("cho_neo");
  // Mỗi bến một ô: màu theo trạng thái tàu đang ở bến (ưu tiên đang làm hàng)
  const UU = { lam_hang: 3, cap_ben: 2, xong_hang: 1 };
  return (
    <TheTQ icon={Ship} ten="Quản lý Cảng" onMo={onMo} tone={khan ? "bad" : choNeo ? "warn" : "primary"}
      nhan={khan > 0 && <Badge tone="bad">{khan} khẩn</Badge>}
      so={dem("lam_hang")} donVi="tàu đang làm hàng"
      phu={`${dem("cap_ben")} tàu đã cập chờ làm · ${dem("xong_hang")} xong hàng chưa rời`}
      hinh={
        <div>
          <div className="flex flex-wrap gap-1">
            {D.berths.map((b) => {
              const o = (benCo.get(b.ma) || []).sort((x, y) => UU[y.st] - UU[x.st]);
              const st = o[0]?.st;
              return <span key={b.ma} title={`${tenBen(b.ma)}: ${o.length ? o.map((x) => `${x.v.ten_tau} (${TRANG_THAI[x.st].ten})`).join(", ") : "trống"}`}
                className={cn("flex h-5 min-w-[26px] items-center justify-center rounded px-1 font-mono text-[0.6875rem] font-medium", st ? "text-white" : "bg-muted text-muted-foreground")}
                style={st ? { background: TRANG_THAI[st].mau } : undefined}>{b.ma}</span>;
            })}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 text-[0.6875rem] text-muted-foreground">
            {["lam_hang", "cap_ben", "xong_hang"].map((k) => <span key={k} className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-sm" style={{ background: TRANG_THAI[k].mau }} />{TRANG_THAI[k].ten}</span>)}
            <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-muted ring-1 ring-border" />Bến trống</span>
          </div>
        </div>}
      chiSo={[
        ["Đang chờ neo", choNeo, choNeo ? "warn" : undefined],
        ["Bến trống", `${D.berths.length - benCo.size}/${D.berths.length}`, "ok"],
        ["Cập ngày tới · 7 ngày", `${keHoach} · ${sapDen}`],
      ]} />
  );
}

export function HopTau({ onClose, go }) {
  const { ds, dem } = useTongHopTau();
  return (
    <HopTQ title="Quản lý Cảng" onClose={onClose}
      description={`${dem("lam_hang")} đang làm hàng · ${dem("cap_ben")} đã cập · ${dem("cho_neo")} chờ neo · ${dem("xong_hang")} xong hàng chưa rời · bấm vào tàu để mở phiếu chuyến`}
      moTrang={[["Mở Linetime tàu cập bến", () => go("cang/linetime")]]}>
      <Tabs defaultValue="cang">
        <TabsList>
          <TabsTrigger value="cang">Tàu tại cảng</TabsTrigger>
          <TabsTrigger value="lich">Lịch cầu bến</TabsTrigger>
          <TabsTrigger value="ngay">Kế hoạch ngày tới</TabsTrigger>
        </TabsList>
        <TabsContent value="cang"><TauTaiCang ds={ds} /></TabsContent>
        <TabsContent value="lich"><LichCauBen /></TabsContent>
        <TabsContent value="ngay"><KeHoachNgay chiXem /></TabsContent>
      </Tabs>
    </HopTQ>
  );
}

// Lịch cầu bến thu gọn: chọn số ngày hiển thị (nhớ lựa chọn trên máy), độ rộng mỗi ngày tự giãn cho vừa khung
const SO_NGAY = [3, 5, 7, 10, 14, 21, 30, 60, 90];
function LichCauBen() {
  const { D } = useApp();
  const [soNgay, setSoNgay] = useState(() => { try { return +localStorage.getItem("tq-lich-so-ngay") || 10; } catch { return 10; } });
  const chon = (n) => { setSoNgay(n); try { localStorage.setItem("tq-lich-so-ngay", String(n)); } catch { /* bỏ qua */ } };
  // Bắt đầu từ hôm qua (xem ≤ 7 ngày) hoặc hôm kia
  const tu = useMemo(() => { const d = new Date(D.now); d.setHours(0, 0, 0, 0); return d.getTime() - (soNgay <= 7 ? 1 : 2) * DAY; }, [D.now, soNgay]);
  // Độ rộng mỗi ngày vừa khung (trừ cột tên bến của chế độ gọn), tối thiểu 36px thì kéo ngang
  const khung = useRef(), [rong, setRong] = useState(1040);
  useEffect(() => { const ro = new ResizeObserver(([e]) => setRong(e.contentRect.width)); ro.observe(khung.current); return () => ro.disconnect(); }, []);
  const pxNgay = Math.max(36, Math.floor((rong - 62) / soNgay));
  return (
    <>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Hiển thị</span>
        <NativeSelect className="h-8 w-28" value={soNgay} onChange={(e) => chon(+e.target.value)} options={SO_NGAY.map((n) => [n, `${n} ngày`])} aria-label="Số ngày hiển thị" />
        <span className="tabular-nums text-muted-foreground">{ngayGio(tu).slice(0, 5)} → {ngayGio(tu + (soNgay - 1) * DAY).slice(0, 5)}</span>
      </div>
      <div ref={khung} className="rounded-md border"><Gantt voyages={D.voyages.filter((v) => !v.huy)} tu={tu} soNgay={soNgay} pxNgay={pxNgay} gon /></div>
      <p className="mt-1.5 text-[0.6875rem] text-muted-foreground">Kéo thả, lùi / tới ngày, xem toàn bộ thời gian chờ: mở trang Linetime.</p>
    </>
  );
}

// Tàu chờ neo / ở bến: mốc chính, giờ chờ, giờ ở bến, năng suất so cam kết, tiến độ
function TauTaiCang({ ds }) {
  const { D, setVoyageMo } = useApp();
  const THU = { lam_hang: 0, cap_ben: 1, xong_hang: 2, cho_neo: 3 };
  const hang = ds.filter((x) => x.st in THU).map((x) => ({ ...x, cs: chiSo(x.v, D.stopsOf(x.v.id), D.now) }))
    .sort((a, b) => THU[a.st] - THU[b.st] || String(a.v.ben_ma || "").localeCompare(String(b.v.ben_ma || "")));
  if (!hang.length) return <Empty>Không có tàu ở cảng hoặc chờ neo.</Empty>;
  const nho = "text-[0.6875rem] text-muted-foreground";
  return (
    <div className="scroll-x max-h-[62vh] rounded-md border">
      <table className="tbl text-xs">
        <thead><tr><th>Tàu</th><th>Bến</th><th>Trạng thái</th><th>Hàng</th><th className="num">KL (t)</th><th>Cập (ATB)</th><th className="num">Chờ neo</th><th className="num">Ở bến</th><th className="num">NS thực / cam kết</th><th className="min-w-[150px]">Tiến độ</th><th>ETD</th></tr></thead>
        <tbody>{hang.map(({ v, st, cs }) => (
          <tr key={v.id} className="cursor-pointer" onClick={() => setVoyageMo(v.id)}>
            <td className="whitespace-nowrap font-medium"><UuTien v={v} />{v.ten_tau}</td>
            <td className="font-mono">{tenBenChuyen(v) || "—"}</td>
            <td><TrangThaiBadge st={st} /></td>
            <td className="min-w-[120px]">{v.huong === "xuat" ? "Xuất" : "Nhập"} · {v.ten_hang || v.loai_hang || "—"}</td>
            <td className="num">{so(v.khoi_luong)}</td>
            <td className="whitespace-nowrap tabular-nums">{ngayGio(v.atb) || <span className="text-muted-foreground">ETB {ngayGio(v.etb) || "—"}</span>}</td>
            <td className="num whitespace-nowrap">{cs.choNeo != null ? thoiLuong(cs.choNeo, { ngan: true }) : ""}</td>
            <td className="num whitespace-nowrap">{cs.oBen != null ? thoiLuong(cs.oBen, { ngan: true }) : ""}</td>
            <td className="num whitespace-nowrap">{cs.nangSuat != null ? so(cs.nangSuat) : "—"}{+v.cam_ket ? <span className="text-muted-foreground"> / {so(v.cam_ket)}</span> : ""}{cs.soCamKet != null && <div className={nho}>{pct(cs.soCamKet)}</div>}</td>
            <td>{["lam_hang", "xong_hang"].includes(st) ? <TienDo v={cs.hoanTat} /> : <span className="text-muted-foreground">—</span>}</td>
            <td className="whitespace-nowrap tabular-nums">{ngayGio(v.atd || v.etd) || "—"}</td>
          </tr>))}</tbody>
      </table>
    </div>
  );
}
