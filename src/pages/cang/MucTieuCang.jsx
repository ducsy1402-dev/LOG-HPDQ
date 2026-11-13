import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ClipboardList, Eye, RefreshCw, Ship, Target, ChevronLeft, ChevronRight } from "lucide-react";
import { useApp } from "@/store";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { PageHead } from "@/components/common";
import EChart from "@/components/EChart";
import { Khung, Chon } from "../tongquan/khungBD";
import { MAU } from "../tongquan/khung";
import { so, pct, r2, plain, thangCua, tenThang, congThang } from "@/lib/format";
import { ngayCuaThang } from "@/lib/sanLuongTT";
import { keHoachTheoNgay, chuoiKeHoach, thucTeNgay, luyKe, demTau, ngayDia } from "@/lib/keHoachNgay";
import { useThietBi } from "@/thietbi/Host";
import { cn } from "@/lib/utils";
import { useNhomHang } from "./useNhomHang";
import { HopDatMucTieu, HopThucTe } from "./HopMucTieu";
import HopKeHoachNgay from "./HopKeHoachNgay";
import HopXemKeHoachSL from "./HopXemKeHoachSL";

// Khai thác Cảng › Mục tiêu sản lượng › tab Khai thác cảng (anh Sỹ chốt 13/11/2026):
//   3 thẻ tàu (HRC · thép thành phẩm · hàng nhập: đang làm hàng, chờ trong 24 giờ tới);
//   4 nút (Đặt mục tiêu · Xem kế hoạch · Kế hoạch ngày · Sản lượng thực tế), mỗi nút mở một hộp;
//   3 biểu đồ của tháng chọn (lũy kế nhập / xuất kế hoạch – thực tế; sản lượng theo ngày kế hoạch – thực tế; tiến độ theo loại hàng).
// Kế hoạch của biểu đồ: kế hoạch ngày theo tàu (SQL 13) nếu tháng đó đã đặt; chưa đặt thì mục tiêu tháng chia đều theo ngày.
const CAO = 340;
const HUONG = [["xuat", "Xuất"], ["nhap", "Nhập"]];
const mauHuong = { nhap: MAU.info, xuat: MAU.tim };

function TheTau({ ten, mota, tone, lam, cho, onMo }) {
  const chip = (ds, nhan) => (
    <div className="flex flex-wrap gap-1">
      {ds.slice(0, 4).map((v) => <button key={v.id} type="button" onClick={() => onMo(v.id)} className="max-w-[9rem] truncate rounded border px-1.5 py-0.5 text-[0.6875rem] hover:bg-accent" title={`${nhan}: ${v.ten_tau}`}>{v.ten_tau}</button>)}
      {ds.length > 4 && <span className="px-1 text-[0.6875rem] text-muted-foreground">+{ds.length - 4}</span>}
    </div>);
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-xl border bg-card p-3">
      <div className="flex items-center gap-2"><span className={cn("flex h-7 w-7 items-center justify-center rounded-md", tone)}><Ship className="h-4 w-4" /></span>
        <div className="min-w-0"><div className="truncate text-sm font-semibold">{ten}</div><div className="truncate text-[0.6875rem] text-muted-foreground">{mota}</div></div></div>
      <div className="grid grid-cols-2 gap-3">
        <div><div className="text-[0.6875rem] text-muted-foreground">Đang làm hàng</div><div className="text-[1.75rem] font-semibold leading-none tabular-nums">{lam.length}</div><div className="mt-1.5 min-h-[1.5rem]">{chip(lam, "Đang làm hàng")}</div></div>
        <div><div className="text-[0.6875rem] text-muted-foreground">Chờ trong 24h tới</div><div className={cn("text-[1.75rem] font-semibold leading-none tabular-nums", cho.length && "text-warn")}>{cho.length}</div><div className="mt-1.5 min-h-[1.5rem]">{chip(cho, "Chờ trong 24h tới")}</div></div>
      </div>
    </div>
  );
}

export default function MucTieuCang() {
  const { D, api, setVoyageMo } = useApp();
  const hangHoa = useThietBi()?.D?.hanghoa || [], nhomHang = useNhomHang();
  const [thang, setThang] = useState(thangCua(D.now));
  const [lan, setLan] = useState(0);
  const [kq, setKq] = useState(undefined); // { dau, sl, kh } · null = chưa chạy SQL 06
  const [mo, setMo] = useState(null); // dat-mt | xem | ngay | thuc-te
  const [hDo, setHDo] = useState("xuat"), [hLoai, setHLoai] = useState("xuat");
  const ngays = useMemo(() => ngayCuaThang(thang), [thang]);
  const tai = () => setLan((x) => x + 1);
  useEffect(() => {
    let huy = false;
    Promise.all([api.docSanLuongThang("cang", thang), api.docKeHoachNgay(ngays[0], ngays[ngays.length - 1])])
      .then(([sl, kh]) => { if (!huy) setKq(sl ? { dau: thang, sl, kh: kh || [], coKh: kh != null } : null); }).catch(() => { if (!huy) setKq(null); });
    return () => { huy = true; };
  }, [api, thang, ngays, lan]);

  const the = useMemo(() => demTau(D.voyages, D.now, hangHoa), [D.voyages, D.now, hangHoa]);
  const homNay = ngayDia(D.now), thangNay = thangCua(D.now);
  const nHT = thang === thangNay ? +homNay.slice(8) : thang < thangNay ? ngays.length : 0; // số ngày đã có số thực tế
  const t = useMemo(() => {
    if (!kq?.sl || kq.dau !== thang) return null;
    const khMap = keHoachTheoNgay(kq.kh, D.vmap, nhomHang);
    const mt = (h) => kq.sl.mucTieu.filter((m) => m.huong === h).reduce((s, m) => s + (+m.tan || 0), 0);
    const cs = Object.fromEntries(["nhap", "xuat"].map((h) => [h, { ...chuoiKeHoach(khMap, ngays, h, mt(h)), tt: thucTeNgay(kq.sl.thucTe, ngays, h), mt: mt(h) }]));
    return { cs };
  }, [kq, thang, D.vmap, nhomHang, ngays]);

  const duong = (name, data, color, net) => ({ name, type: "line", showSymbol: false, data, itemStyle: { color }, lineStyle: { width: net ? 1.6 : 2.4, type: net ? "dashed" : "solid", color } });
  const op1 = t && {
    tooltip: { trigger: "axis", valueFormatter: (v) => (v == null ? "—" : `${so(v)} t`) }, legend: { itemWidth: 12, itemHeight: 6, textStyle: { fontSize: 10 } },
    grid: { left: 4, right: 10, top: 30, bottom: 0, containLabel: true },
    xAxis: { type: "category", data: ngays.map((n) => n.slice(8)), axisLabel: { fontSize: 10, hideOverlap: true } }, yAxis: { type: "value", axisLabel: { fontSize: 10, formatter: (v) => (v >= 1000 ? `${r2(v / 1000)}k` : v) } },
    series: [
      duong("Nhập thực tế", luyKe(t.cs.nhap.tt, nHT).map((x) => (x == null ? null : r2(x))), mauHuong.nhap), duong("Nhập kế hoạch", luyKe(t.cs.nhap.kh).map(r2), mauHuong.nhap, true),
      duong("Xuất thực tế", luyKe(t.cs.xuat.tt, nHT).map((x) => (x == null ? null : r2(x))), mauHuong.xuat), duong("Xuất kế hoạch", luyKe(t.cs.xuat.kh).map(r2), mauHuong.xuat, true),
    ],
  };
  const c2 = t?.cs[hDo];
  const op2 = c2 && {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (v) => (v == null ? "—" : `${so(v)} t`) }, legend: { itemWidth: 12, itemHeight: 6, textStyle: { fontSize: 10 } },
    grid: { left: 4, right: 10, top: 30, bottom: 0, containLabel: true },
    xAxis: { type: "category", data: ngays.map((n) => n.slice(8)), axisLabel: { fontSize: 10, hideOverlap: true } }, yAxis: { type: "value", axisLabel: { fontSize: 10, formatter: (v) => (v >= 1000 ? `${r2(v / 1000)}k` : v) } },
    series: [
      { name: "Kế hoạch", type: "bar", barMaxWidth: 10, itemStyle: { color: MAU.xam, opacity: 0.55 }, data: c2.kh.map(r2) },
      { name: "Thực tế", type: "bar", barMaxWidth: 10, itemStyle: { color: mauHuong[hDo] }, data: c2.tt.map((x, i) => (i < nHT ? r2(x) : null)) },
    ],
  };
  // Tiến độ theo loại hàng của hướng chọn: thực tế so với mục tiêu tháng
  const loai = useMemo(() => {
    if (!kq?.sl || kq.dau !== thang) return [];
    const m = new Map(), o = (n) => { const k = plain(n); if (!m.has(k)) m.set(k, { nhom: n, mt: 0, tt: 0 }); return m.get(k); };
    for (const x of kq.sl.mucTieu) if (x.huong === hLoai) o(x.loai_hang).mt += +x.tan || 0;
    for (const x of kq.sl.thucTe) if (x.huong === hLoai) o(x.loai_hang).tt += +x.tan || 0;
    return [...m.values()].sort((a, b) => b.mt - a.mt || b.tt - a.tt);
  }, [kq, thang, hLoai]);
  const op3 = {
    grid: { left: 4, right: 70, top: 28, bottom: 0, containLabel: true }, legend: { itemWidth: 12, itemHeight: 6, textStyle: { fontSize: 10 } },
    tooltip: { axisPointer: { type: "shadow" }, valueFormatter: (v) => `${so(v)} t` },
    xAxis: { type: "value", axisLabel: { fontSize: 10, formatter: (v) => (v >= 1000 ? `${r2(v / 1000)}k` : v) } },
    yAxis: { type: "category", inverse: true, data: loai.map((x) => x.nhom), axisLabel: { fontSize: 10, width: 110, overflow: "truncate" } },
    series: [
      { name: "Mục tiêu tháng", type: "bar", barMaxWidth: 9, barGap: "40%", itemStyle: { color: MAU.xam, opacity: 0.5 }, data: loai.map((x) => r2(x.mt)) },
      { name: "Thực tế", type: "bar", barMaxWidth: 9, itemStyle: { color: mauHuong[hLoai] }, data: loai.map((x) => r2(x.tt)),
        label: { show: true, position: "right", fontSize: 10, distance: 4, formatter: (p) => (loai[p.dataIndex].mt ? pct(loai[p.dataIndex].tt / loai[p.dataIndex].mt, 0) : so(loai[p.dataIndex].tt, 0)) } },
    ],
  };
  const tongTT = (h) => (t ? t.cs[h].tt.reduce((s, x) => s + x, 0) : 0);
  const tomTat = (h) => (t ? `${so(tongTT(h), 0)} t${t.cs[h].mt ? ` / mục tiêu ${so(t.cs[h].mt, 0)} t (${pct(tongTT(h) / t.cs[h].mt, 0)})` : ""}` : "");
  const nguonTxt = (h) => (t ? (t.cs[h].nguon === "ngay" ? "kế hoạch ngày theo tàu" : t.cs[h].nguon === "muc_tieu" ? "mục tiêu tháng chia đều" : "chưa có kế hoạch") : "");
  const chuaCo = kq === null ? <div className="rounded-md border border-warn/40 bg-warn/5 px-3 py-2 text-sm">Chưa có bảng sản lượng: quản trị cần chạy <b>sql/06_san_luong_thuc_te.sql</b> trong Supabase (sau 01 … 04).</div> : null;
  const thangs = Array.from({ length: 13 }, (_, i) => congThang(thangNay, i - 6));
  const nut = (icon, ten, id, tt) => { const Ic = icon; return <Button size="sm" variant="outline" onClick={() => setMo(id)} title={tt}><Ic />{ten}</Button>; };

  return (
    <div className="grid gap-3">
      <PageHead title="Mục tiêu sản lượng" desc="Khai thác cảng: tàu đang làm hàng, mục tiêu, kế hoạch ngày và sản lượng thực tế nhập / xuất.">
        <div className="flex items-center gap-1.5">
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setThang(congThang(thang, -1))} aria-label="Tháng trước"><ChevronLeft /></Button>
          <NativeSelect className="h-8 w-52 text-sm" value={thang} onChange={(e) => setThang(e.target.value)} aria-label="Tháng" options={(thangs.includes(thang) ? thangs : [thang, ...thangs]).map((x) => [x, tenThang(x) + (x === thangNay ? " (này)" : "")])} />
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setThang(congThang(thang, 1))} aria-label="Tháng sau"><ChevronRight /></Button>
        </div>
      </PageHead>

      <div className="grid gap-3 md:grid-cols-3">
        <TheTau ten="Tàu HRC" mota="Xuất thép cuộn cán nóng" tone="bg-primary/12 text-primary" {...the.hrc} onMo={setVoyageMo} />
        <TheTau ten="Tàu thép thành phẩm" mota="Thép cuộn, thép thanh… (không gồm HRC)" tone="bg-info/12 text-info" {...the.tp} onMo={setVoyageMo} />
        <TheTau ten="Tàu hàng nhập" mota="Quặng, than, phế, đá…" tone="bg-ok/12 text-ok" {...the.nhap} onMo={setVoyageMo} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {nut(Target, "Đặt mục tiêu", "dat-mt", "Mục tiêu sản lượng theo tháng / quý / năm")}
        {nut(Eye, "Xem kế hoạch", "xem", "Xem mục tiêu, kế hoạch ngày và thực tế")}
        {nut(CalendarDays, "Kế hoạch ngày", "ngay", "Đặt sản lượng kế hoạch từng ngày theo line tàu")}
        {nut(ClipboardList, "Sản lượng thực tế", "thuc-te", "Nhập sản lượng nhập / xuất thực tế theo ngày")}
        {kq === undefined && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {chuaCo}
      {!chuaCo && (
        <div className="grid gap-3 xl:grid-cols-3">
          <Khung cao={CAO} ten="Lũy kế sản lượng nhập / xuất" phu={`${tenThang(thang)} · kế hoạch so thực tế`}>
            {op1 ? <><EChart height={CAO - 90} option={op1} />
              <div className="mt-1 grid gap-0.5 text-[0.6875rem] text-muted-foreground"><span>Nhập: <b className="text-foreground">{tomTat("nhap")}</b> · KH: {nguonTxt("nhap")}</span><span>Xuất: <b className="text-foreground">{tomTat("xuat")}</b> · KH: {nguonTxt("xuat")}</span></div></>
              : <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">Đang tải…</div>}
          </Khung>
          <Khung cao={CAO} ten="Sản lượng theo ngày" phu={`${HUONG.find(([k]) => k === hDo)[1]} · kế hoạch so thực tế`} bo={<Chon gt={hDo} dat={setHDo} ds={HUONG} />}>
            {op2 ? <><EChart height={CAO - 90} option={op2} /><div className="mt-1 text-[0.6875rem] text-muted-foreground">Tổng {so(tongTT(hDo), 0)} t · KH: {nguonTxt(hDo)}</div></> : <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">Đang tải…</div>}
          </Khung>
          <Khung cao={CAO} ten="Tiến độ theo loại hàng" phu={`${HUONG.find(([k]) => k === hLoai)[1]} · thực tế so mục tiêu tháng`} bo={<Chon gt={hLoai} dat={setHLoai} ds={HUONG} />}>
            {loai.length ? <EChart height={Math.max(CAO - 70, 40 + loai.length * 30)} option={op3} /> : <div className="flex flex-1 items-center justify-center text-center text-xs text-muted-foreground">{kq === undefined ? "Đang tải…" : "Chưa có mục tiêu hay số thực tế. Bấm Đặt mục tiêu."}</div>}
          </Khung>
        </div>)}

      {mo === "dat-mt" && <HopDatMucTieu thang0={thang} onClose={() => setMo(null)} onLuu={tai} />}
      {mo === "xem" && <HopXemKeHoachSL thang0={thang} onClose={() => setMo(null)} />}
      {mo === "ngay" && <HopKeHoachNgay thang0={thang} onClose={() => setMo(null)} onLuu={tai} />}
      {mo === "thuc-te" && <HopThucTe thang0={thang} onClose={() => setMo(null)} onLuu={tai} />}
    </div>
  );
}
