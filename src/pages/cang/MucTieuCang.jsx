import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ClipboardList, Eye, RefreshCw, Ship, Target, ChevronLeft, ChevronRight } from "lucide-react";
import { useApp } from "@/store";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import EChart from "@/components/EChart";
import { Khung, Chon } from "../tongquan/khungBD";
import { MAU } from "../tongquan/khung";
import { so, pct, r2, plain } from "@/lib/format";
import { KY, khoangKy, kyTruoc, kySau, chuoiKy, tongTheoNhom } from "@/lib/bieuDoSanLuong";
import { keHoachTheoNgay, keHoachTheoDiem, luyKe, demTau, ngayDia } from "@/lib/keHoachNgay";
import { useThietBi } from "@/thietbi/Host";
import { useSanLuongKy, khoaKyRieng } from "../tongquan/KhoiSanLuong";
import { cn } from "@/lib/utils";
import { useNhomHang } from "./useNhomHang";
import { HopDatMucTieu, HopThucTe } from "./HopMucTieu";
import HopKeHoachNgay from "./HopKeHoachNgay";
import HopXemKeHoachSL from "./HopXemKeHoachSL";

// Khai thác Cảng › Mục tiêu sản lượng (anh Sỹ chốt 13/11/2026):
//   hàng nút trên cùng (Đặt mục tiêu · Xem kế hoạch · Kế hoạch ngày · Sản lượng thực tế) và chọn kỳ Tháng / Quý / Năm;
//   3 thẻ tàu (HRC · thép thành phẩm · hàng nhập): chỉ số lượng đang làm hàng và chờ trong 24 giờ tới;
//   3 biểu đồ theo kỳ chọn (tháng: điểm theo ngày; quý: theo tuần; năm: theo tháng): lũy kế nhập / xuất; đường kế hoạch – thực tế (lọc loại hàng); tiến độ theo loại hàng.
// Kế hoạch của biểu đồ: kế hoạch ngày theo tàu (SQL 13) của các tháng đã đặt; tháng chưa đặt dùng mục tiêu chia đều. Vận tải: Thiết bị cơ giới › Kế hoạch & phân bổ.
const CAO = 340;
const HUONG = [["xuat", "Xuất"], ["nhap", "Nhập"]];
const mauHuong = { nhap: MAU.info, xuat: MAU.tim };
const luu = (k, v) => { try { localStorage.setItem(k, v); } catch { /* bỏ qua */ } };
const doc = (k, mac) => { try { return localStorage.getItem(k) || mac; } catch { return mac; } };
const nghin = (v) => (Math.abs(v) >= 1000 ? `${r2(v / 1000)}k` : v);

function TheTau({ ten, mota, tone, lam, cho }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border bg-card p-3">
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", tone)}><Ship className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{ten}</div><div className="truncate text-[0.6875rem] text-muted-foreground">{mota}</div></div>
      <div className="text-center"><div className="text-[1.6rem] font-semibold leading-none tabular-nums">{lam.length}</div><div className="mt-0.5 text-[0.6875rem] text-muted-foreground">đang làm</div></div>
      <div className="text-center"><div className={cn("text-[1.6rem] font-semibold leading-none tabular-nums", cho.length && "text-warn")}>{cho.length}</div><div className="mt-0.5 text-[0.6875rem] text-muted-foreground">chờ 24h tới</div></div>
    </div>
  );
}

export default function MucTieuCang() {
  const { D, api } = useApp();
  const hangHoa = useThietBi()?.D?.hanghoa || [], nhomHang = useNhomHang();
  const homNay = ngayDia(D.now);
  const [kyLoai, setKyLoai] = useState(() => (["thang", "quy", "nam"].includes(doc("lg-mt-ky2", "thang")) ? doc("lg-mt-ky2", "thang") : "thang"));
  const [ngayTC, setNgayTC] = useState(homNay);
  const [lan, setLan] = useState(0);
  const [kh, setKh] = useState(undefined); // kế hoạch ngày của kỳ ([] khi chưa chạy SQL 13)
  const [mo, setMo] = useState(null); // dat-mt | xem | ngay | thuc-te
  const [hD, setHD] = useState("xuat"), [nhomD, setNhomD] = useState(""), [hL, setHL] = useState("xuat");
  const kyInfo = useMemo(() => khoangKy(kyLoai, ngayTC, homNay), [kyLoai, ngayTC, homNay]);
  const tai = () => setLan((x) => x + 1);
  const du = useSanLuongKy("cang", kyInfo.thangs, khoaKyRieng(kyInfo));
  useEffect(() => {
    let huy = false;
    api.docKeHoachNgay(kyInfo.ngays[0], kyInfo.ngays[kyInfo.ngays.length - 1]).then((r) => { if (!huy) setKh(r || []); }).catch(() => { if (!huy) setKh([]); });
    return () => { huy = true; };
  }, [api, kyInfo, lan, D]);

  const the = useMemo(() => demTau(D.voyages, D.now, hangHoa), [D.voyages, D.now, hangHoa]);
  const khMap = useMemo(() => keHoachTheoNgay(kh || [], D.vmap, nhomHang), [kh, D.vmap, nhomHang]);
  const sanSang = !!du && kh !== undefined;

  // Một hướng (và nhóm hàng): thực tế, mục tiêu chia đều và kế hoạch theo từng điểm của kỳ
  const chuoi = (h, nhom = "") => {
    const c = chuoiKy(kyInfo, du, "cang", { loc: (x) => x.huong === h && (!nhom || plain(x.loai) === plain(nhom)) });
    const k = keHoachTheoDiem(kyInfo, khMap, h, nhom);
    const khD = c.diem.map((o, i) => (k.kh[i] != null ? k.kh[i] : o.mt));
    return { ...c, khD, nguon: k.du ? "kế hoạch ngày theo tàu" : k.coKh ? "kế hoạch ngày + mục tiêu chia đều (tháng chưa đặt)" : "mục tiêu chia đều" };
  };
  const nhanX = (c) => c.diem.map((o) => o.nhan);
  const veDuong = (name, data, color, net) => ({ name, type: "line", showSymbol: kyLoai !== "thang", symbolSize: 4, data, itemStyle: { color }, lineStyle: { width: net ? 1.6 : 2.4, type: net ? "dashed" : "solid", color }, smooth: false });
  const cs = useMemo(() => (sanSang ? { nhap: chuoi("nhap"), xuat: chuoi("xuat") } : null), [sanSang, du, khMap, kyInfo]); // eslint-disable-line react-hooks/exhaustive-deps
  const luyKeTT = (c) => c.diem.map((o) => (o.lkTt == null ? null : r2(o.lkTt)));
  const base = { grid: { left: 4, right: 10, top: 30, bottom: 0, containLabel: true }, legend: { itemWidth: 12, itemHeight: 6, textStyle: { fontSize: 10 } } };
  const op1 = cs && {
    ...base, tooltip: { trigger: "axis", valueFormatter: (v) => (v == null ? "—" : `${so(v)} t`) },
    xAxis: { type: "category", data: nhanX(cs.nhap), axisLabel: { fontSize: 10, hideOverlap: true } }, yAxis: { type: "value", axisLabel: { fontSize: 10, formatter: nghin } },
    series: [veDuong("Nhập thực tế", luyKeTT(cs.nhap), mauHuong.nhap), veDuong("Nhập kế hoạch", luyKe(cs.nhap.khD).map(r2), mauHuong.nhap, true), veDuong("Xuất thực tế", luyKeTT(cs.xuat), mauHuong.xuat), veDuong("Xuất kế hoạch", luyKe(cs.xuat.khD).map(r2), mauHuong.xuat, true)],
  };
  // Đường kế hoạch – thực tế theo điểm của kỳ, lọc hướng và loại hàng
  const dsNhom = useMemo(() => { if (!du) return []; const m = new Map(); for (const r of [...du.mucTieu, ...(du.mucTieuKy || []), ...du.thucTe]) if (r.huong === hD && r.loai_hang) m.set(plain(r.loai_hang), r.loai_hang); return [...m.values()].sort((a, b) => a.localeCompare(b, "vi")); }, [du, hD]);
  const c2 = useMemo(() => (sanSang ? chuoi(hD, dsNhom.includes(nhomD) ? nhomD : "") : null), [sanSang, du, khMap, kyInfo, hD, nhomD, dsNhom]); // eslint-disable-line react-hooks/exhaustive-deps
  const op2 = c2 && {
    ...base, tooltip: { trigger: "axis", valueFormatter: (v) => (v == null ? "—" : `${so(v)} t`) },
    xAxis: { type: "category", data: nhanX(c2), axisLabel: { fontSize: 10, hideOverlap: true } }, yAxis: { type: "value", axisLabel: { fontSize: 10, formatter: nghin } },
    series: [veDuong("Kế hoạch", c2.khD.map(r2), MAU.xam, true), veDuong("Thực tế", c2.diem.map((o) => (o.dau <= homNay ? r2(o.tt) : null)), mauHuong[hD])],
  };
  // Tiến độ theo loại hàng của hướng chọn: thực tế so mục tiêu của kỳ
  const loai = useMemo(() => {
    if (!sanSang) return [];
    const m = tongTheoNhom(kyInfo, du, "cang", (x) => x.loai, (x) => x.huong === hL);
    return [...m].map(([nhom, v]) => ({ nhom, ...v })).filter((x) => x.mt > 0 || x.tt > 0).sort((a, b) => b.mt - a.mt || b.tt - a.tt);
  }, [sanSang, du, kyInfo, hL]);
  const op3 = {
    grid: { left: 4, right: 70, top: 28, bottom: 0, containLabel: true }, legend: base.legend,
    tooltip: { axisPointer: { type: "shadow" }, valueFormatter: (v) => `${so(v)} t` },
    xAxis: { type: "value", axisLabel: { fontSize: 10, formatter: nghin } },
    yAxis: { type: "category", inverse: true, data: loai.map((x) => x.nhom), axisLabel: { fontSize: 10, width: 110, overflow: "truncate" } },
    series: [
      { name: "Mục tiêu", type: "bar", barMaxWidth: 9, barGap: "40%", itemStyle: { color: MAU.xam, opacity: 0.5 }, data: loai.map((x) => r2(x.mt)) },
      { name: "Thực tế", type: "bar", barMaxWidth: 9, itemStyle: { color: mauHuong[hL] }, data: loai.map((x) => r2(x.tt)),
        label: { show: true, position: "right", fontSize: 10, distance: 4, formatter: (p) => (loai[p.dataIndex].mt ? pct(loai[p.dataIndex].tt / loai[p.dataIndex].mt, 0) : so(loai[p.dataIndex].tt, 0)) } },
    ],
  };
  const tomTat = (h) => { const c = cs?.[h]; return c ? `${so(c.tongTt, 0)} t${c.tongMt ? ` / mục tiêu ${so(c.tongMt, 0)} t (${pct(c.tongTt / c.tongMt, 0)})` : ""}` : ""; };
  const nut = (icon, ten, id, tt) => { const Ic = icon; return <Button size="sm" variant="outline" onClick={() => setMo(id)} title={tt}><Ic />{ten}</Button>; };
  const dangTai = <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">Đang tải…</div>;
  const chuaCo = du === null ? <div className="rounded-md border border-warn/40 bg-warn/5 px-3 py-2 text-sm">Chưa có bảng sản lượng: quản trị cần chạy <b>sql/06_san_luong_thuc_te.sql</b> trong Supabase (sau 01 … 04).</div> : null;
  // Tháng mặc định của các hộp: tháng của hôm nay nếu nằm trong kỳ đang xem, không thì tháng đầu kỳ
  const thang0 = kyInfo.ngays.includes(homNay) ? homNay.slice(0, 7) : kyInfo.ngays[0].slice(0, 7);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-1 text-lg font-semibold">Mục tiêu sản lượng</h1>
        {nut(Target, "Đặt mục tiêu", "dat-mt", "Mục tiêu sản lượng theo tháng / quý / năm")}
        {nut(Eye, "Xem kế hoạch", "xem", "Xem mục tiêu, kế hoạch ngày và thực tế")}
        {nut(CalendarDays, "Kế hoạch ngày", "ngay", "Đặt sản lượng kế hoạch từng ngày theo line tàu")}
        {nut(ClipboardList, "Sản lượng thực tế", "thuc-te", "Nhập sản lượng nhập / xuất thực tế theo ngày")}
        {!sanSang && !chuaCo && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <div className="inline-flex gap-0.5 rounded-md bg-muted p-0.5 text-xs" role="tablist" aria-label="Kỳ">
            {KY.filter(([k]) => k !== "tuan").map(([k, ten]) => (
              <button key={k} type="button" role="tab" aria-selected={kyLoai === k} onClick={() => { setKyLoai(k); luu("lg-mt-ky2", k); }} className={cn("rounded px-2.5 py-1 font-medium transition-colors", kyLoai === k ? "bg-card text-foreground shadow-sm dark:bg-accent" : "text-muted-foreground hover:text-foreground")}>{ten}</button>))}
          </div>
          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setNgayTC(kyTruoc(kyInfo).ngays[0])} aria-label="Kỳ trước"><ChevronLeft /></Button>
          <span className="min-w-[7.5rem] text-center text-sm font-medium tabular-nums">{kyInfo.nhan}</span>
          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setNgayTC(kySau(kyInfo).ngays[0])} aria-label="Kỳ sau"><ChevronRight /></Button>
          {!kyInfo.ngays.includes(homNay) && <Button size="xs" variant="ghost" onClick={() => setNgayTC(homNay)}>Hôm nay</Button>}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <TheTau ten="Tàu HRC" mota="Xuất thép cuộn cán nóng" tone="bg-primary/12 text-primary" {...the.hrc} />
        <TheTau ten="Tàu thép thành phẩm" mota="Thép cuộn, thép thanh… (không gồm HRC)" tone="bg-info/12 text-info" {...the.tp} />
        <TheTau ten="Tàu hàng nhập" mota="Quặng, than, phế, đá…" tone="bg-ok/12 text-ok" {...the.nhap} />
      </div>

      {chuaCo}
      {!chuaCo && (
        <div className="grid gap-3 xl:grid-cols-3">
          <Khung cao={CAO} ten="Lũy kế sản lượng nhập / xuất" phu={`${kyInfo.nhan} · kế hoạch so thực tế`}>
            {op1 ? <><EChart height={CAO - 90} option={op1} />
              <div className="mt-1 grid gap-0.5 text-[0.6875rem] text-muted-foreground"><span>Nhập: <b className="text-foreground">{tomTat("nhap")}</b> · KH: {cs.nhap.nguon}</span><span>Xuất: <b className="text-foreground">{tomTat("xuat")}</b> · KH: {cs.xuat.nguon}</span></div></> : dangTai}
          </Khung>
          <Khung cao={CAO} ten="Sản lượng kế hoạch / thực tế" phu={`${kyInfo.nhan} · theo ${kyInfo.buoc === "ngay" ? "ngày" : kyInfo.buoc === "tuan" ? "tuần" : "tháng"}`}
            bo={<><NativeSelect className="h-6 w-32 text-[0.6875rem]" value={dsNhom.includes(nhomD) ? nhomD : ""} onChange={(e) => setNhomD(e.target.value)} placeholder="Mọi loại hàng" options={dsNhom} aria-label="Lọc theo loại hàng" /><Chon gt={hD} dat={setHD} ds={HUONG} /></>}>
            {op2 ? <><EChart height={CAO - 90} option={op2} /><div className="mt-1 text-[0.6875rem] text-muted-foreground">Thực tế {so(c2.tongTt, 0)} t · KH: {c2.nguon}</div></> : dangTai}
          </Khung>
          <Khung cao={CAO} ten="Tiến độ theo loại hàng" phu={`${kyInfo.nhan} · thực tế so mục tiêu`} bo={<Chon gt={hL} dat={setHL} ds={HUONG} />}>
            {loai.length ? <EChart height={Math.max(CAO - 70, 40 + loai.length * 30)} option={op3} /> : <div className="flex flex-1 items-center justify-center text-center text-xs text-muted-foreground">{!sanSang ? "Đang tải…" : "Chưa có mục tiêu hay số thực tế. Bấm Đặt mục tiêu."}</div>}
          </Khung>
        </div>)}

      {mo === "dat-mt" && <HopDatMucTieu thang0={thang0} onClose={() => setMo(null)} onLuu={tai} />}
      {mo === "xem" && <HopXemKeHoachSL thang0={thang0} onClose={() => setMo(null)} />}
      {mo === "ngay" && <HopKeHoachNgay thang0={thang0} onClose={() => setMo(null)} onLuu={tai} />}
      {mo === "thuc-te" && <HopThucTe thang0={thang0} onClose={() => setMo(null)} onLuu={tai} />}
    </div>
  );
}
