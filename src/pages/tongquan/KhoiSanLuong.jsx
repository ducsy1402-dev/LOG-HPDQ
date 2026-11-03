import { useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { useApp } from "@/store";
import EChart from "@/components/EChart";
import { so, pct } from "@/lib/format";
import { NHOM, tenHuong, tenDonVi, DON_VI } from "@/lib/sanLuongTT";
import { chuoiKy, tongTheoNhom } from "@/lib/bieuDoSanLuong";
import { cn } from "@/lib/utils";
import { MAU } from "./khung";

// Khối 5 biểu đồ sản lượng phía trên Linetime (Tổng quan): chọn kỳ (tuần / tháng / quý / năm) dùng chung.
//  1. Cảng: mục tiêu – thực tế – lũy kế, nhập / xuất      2. Cảng: mục tiêu – lũy kế theo hướng · loại hàng
//  3. Vận tải: mục tiêu – thực tế – lũy kế, phục vụ cảng / sản xuất
//  4. Vận tải phục vụ cảng theo đơn vị thực hiện          5. Vận tải phục vụ sản xuất theo đơn vị thực hiện (4, 5 lọc theo đội xe)
// Số liệu từ bảng nhập thực tế theo ca / ngày (SQL 06); mục tiêu tháng chia đều theo ngày.

export const nghin = (x) => (x == null ? "—" : Math.abs(x) >= 1000 ? so(x / 1000, Math.abs(x) >= 1e5 ? 0 : 1) + "k" : so(x));
const MAU_HUONG = { nhap: MAU.info, xuat: MAU.tim, phuc_vu_cang: MAU.info, phuc_vu_san_xuat: MAU.warn };

export function Khung({ ten, phu, onChiTiet, bo, className, children }) {
  return (
    <section className={cn("flex min-w-0 flex-col rounded-md border border-border/70 bg-card/70 p-2.5", className)}>
      <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-[10px] text-primary">◆</span>
        <h3 className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{ten}</h3>
        {phu && <span className="truncate text-[10px] text-muted-foreground/80">· {phu}</span>}
        <div className="ml-auto flex items-center gap-2">
          {bo}
          {onChiTiet && <button type="button" onClick={onChiTiet} className="inline-flex shrink-0 items-center text-[11px] text-primary hover:underline">Chi tiết<ChevronRight className="h-3 w-3" /></button>}
        </div>
      </div>
      {children}
    </section>
  );
}
export const ChuaCo = ({ children }) => <div className="flex flex-1 items-center justify-center py-10 text-center text-xs text-muted-foreground">{children}</div>;

// Nhóm nút chọn
export function Chon({ gt, dat, ds }) {
  return (
    <div className="inline-flex overflow-hidden rounded border border-border/70 text-[10px]">
      {ds.map(([k, t]) => <button key={k} type="button" onClick={() => dat(k)} className={cn("px-1.5 py-0.5", gt === k ? "bg-primary/20 font-semibold text-primary" : "text-muted-foreground hover:bg-accent")}>{t}</button>)}
    </div>
  );
}
const ChonDoi = ({ gt, dat, ds }) => (
  <select value={gt} onChange={(e) => dat(e.target.value)} className="max-w-[110px] rounded border border-border/70 bg-transparent px-1 py-0.5 text-[10px] text-muted-foreground">
    <option value="">Mọi đội xe</option>
    {ds.map((d) => <option key={d} value={d}>{d}</option>)}
  </select>
);

// Mục tiêu + sản lượng thực tế của các tháng trong kỳ; null = chưa chạy SQL 06
function useSanLuongKy(nhom, thangs) {
  const { api, D } = useApp();
  const [kq, setKq] = useState(undefined);
  const khoa = thangs.join(",");
  useEffect(() => {
    let huy = false;
    Promise.all(khoa.split(",").map((t) => api.docSanLuongThang(nhom, t)))
      .then((rs) => { if (!huy) setKq(rs.some((r) => !r) ? null : { mucTieu: rs.flatMap((r, i) => r.mucTieu.map((x) => ({ ...x, thang: x.thang || khoa.split(",")[i] }))), thucTe: rs.flatMap((r) => r.thucTe) }); })
      .catch(() => { if (!huy) setKq(null); });
    return () => { huy = true; };
  }, [api, nhom, khoa, D]); // D đổi (có người sửa) thì tải lại
  return kq;
}

const dau = { symbol: "none" };
// Biểu đồ theo điểm của kỳ: cột thực tế (xếp chồng theo hướng), đường mục tiêu từng điểm, đường lũy kế thực tế và lũy kế mục tiêu (trục phải)
function optKy(c, huongs, nhomSL) {
  const cot = huongs.map((h) => ({ name: h ? tenHuong(nhomSL, h) : "Thực tế", type: "bar", stack: "tt", barMaxWidth: 18, itemStyle: { color: MAU_HUONG[h] || MAU.primary, opacity: 0.85 }, data: c.diem.map((o) => o.theo.get(h) ?? 0) }));
  const net = (ten, data, mau, truc) => ({ name: ten, type: "line", yAxisIndex: truc, smooth: false, showSymbol: false, connectNulls: false, data, lineStyle: { width: 2, color: mau, type: ten.includes("mục tiêu") ? "dashed" : "solid" }, itemStyle: { color: mau } });
  return {
    grid: { left: 4, right: 4, top: 34, bottom: 0, containLabel: true },
    legend: { top: 0, itemWidth: 12, itemHeight: 6, icon: "roundRect", textStyle: { fontSize: 10 } },
    tooltip: { valueFormatter: (v) => (v == null ? "—" : `${so(v)} t`) },
    xAxis: { type: "category", data: c.diem.map((o) => o.nhan), axisLabel: { fontSize: 10, hideOverlap: true } },
    yAxis: [
      { type: "value", axisLabel: { fontSize: 10, formatter: nghin } },
      { type: "value", axisLabel: { fontSize: 10, formatter: nghin }, splitLine: { show: false } },
    ],
    series: [
      ...cot,
      { ...net("Mục tiêu từng điểm", c.diem.map((o) => Math.round(o.mt)), MAU.xam, 0), lineStyle: { width: 1.5, color: MAU.xam, type: "dotted" } },
      net("Lũy kế thực tế", c.diem.map((o) => o.lkTt), MAU.ok, 1),
      net("Lũy kế mục tiêu", c.diem.map((o) => Math.round(o.lkMt)), MAU.warn, 1),
    ],
  };
}

// Cột ngang so mục tiêu với lũy kế thực hiện của từng nhóm (hướng · loại hàng, hoặc đơn vị thực hiện)
function optNhom(ds) {
  return {
    grid: { left: 4, right: 52, top: 26, bottom: 0, containLabel: true },
    legend: { top: 0, itemWidth: 12, itemHeight: 6, icon: "roundRect", textStyle: { fontSize: 10 } },
    tooltip: { axisPointer: { type: "shadow" }, valueFormatter: (v) => `${so(v)} t` },
    xAxis: { type: "value", axisLabel: { fontSize: 10, formatter: nghin } },
    yAxis: { type: "category", inverse: true, data: ds.map((d) => d.ten), axisLabel: { fontSize: 10, width: 96, overflow: "truncate" } },
    series: [
      { name: "Mục tiêu", type: "bar", barMaxWidth: 10, itemStyle: { color: MAU.xam, opacity: 0.55 }, data: ds.map((d) => Math.round(d.mt)) },
      { name: "Lũy kế", type: "bar", barMaxWidth: 10, itemStyle: { color: MAU.primary }, label: { show: true, position: "right", fontSize: 10, formatter: (p) => (ds[p.dataIndex].mt ? pct(ds[p.dataIndex].tt / ds[p.dataIndex].mt) : "") }, data: ds.map((d) => Math.round(d.tt)) },
    ],
  };
}
const chieuCao = (n) => Math.max(180, 56 + n * 34);

function SoLon({ tt, mt }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="font-mono text-2xl font-semibold tabular-nums">{nghin(tt)}</span>
      <span className="text-[11px] text-muted-foreground">{mt ? `/ ${nghin(mt)} t · đạt ${pct(tt / mt)}` : "t · chưa đặt mục tiêu"}</span>
    </div>
  );
}

export default function KhoiSanLuong({ kyInfo, go }) {
  const [huongC, setHuongC] = useState(""), [huongV, setHuongV] = useState(""), [huongH, setHuongH] = useState("");
  const [doiC, setDoiC] = useState(""), [doiS, setDoiS] = useState("");
  const cang = useSanLuongKy("cang", kyInfo.thangs), vt = useSanLuongKy("van_tai", kyInfo.thangs);
  const loadHuong = (nhom) => NHOM[nhom].huong.map(([k]) => k);

  const c1 = useMemo(() => (cang ? chuoiKy(kyInfo, cang, "cang", { loc: (x) => !huongC || x.huong === huongC, chia: (x) => x.huong }) : null), [kyInfo, cang, huongC]);
  const c3 = useMemo(() => (vt ? chuoiKy(kyInfo, vt, "van_tai", { loc: (x) => !huongV || x.huong === huongV, chia: (x) => x.huong }) : null), [kyInfo, vt, huongV]);
  const nhomHang = useMemo(() => {
    if (!cang) return [];
    const m = tongTheoNhom(kyInfo, cang, "cang", (x) => `${x.huong}|${x.loai}`, (x) => !huongH || x.huong === huongH);
    return [...m].map(([k, v]) => { const [h, loai] = k.split("|"); return { ...v, ten: `${tenHuong("cang", h)} · ${loai}`, ord: (h === "nhap" ? 0 : 1) + loai }; }).sort((a, b) => a.ord.localeCompare(b.ord, "vi"));
  }, [kyInfo, cang, huongH]);
  const doiXe = useMemo(() => [...new Set([...(vt?.mucTieu || []), ...(vt?.thucTe || [])].map((r) => r.loai_xe).filter(Boolean))].sort((a, b) => a.localeCompare(b, "vi")), [vt]);
  const theoDonVi = (huong, doi) => {
    if (!vt) return [];
    const m = tongTheoNhom(kyInfo, vt, "van_tai", (x) => x.donVi, (x) => x.huong === huong && (!doi || x.loai === doi));
    return DON_VI.map(([k]) => ({ ...(m.get(k) || { mt: 0, tt: 0 }), ten: tenDonVi(k) }));
  };
  const dvCang = useMemo(() => theoDonVi("phuc_vu_cang", doiC), [kyInfo, vt, doiC]); // eslint-disable-line react-hooks/exhaustive-deps
  const dvSX = useMemo(() => theoDonVi("phuc_vu_san_xuat", doiS), [kyInfo, vt, doiS]); // eslint-disable-line react-hooks/exhaustive-deps

  const chuaSql = cang === null || vt === null;
  const tai = cang === undefined || vt === undefined;
  const huongList = (nhom, sel, c) => (sel ? [sel] : loadHuong(nhom).filter((h) => c?.nhomChia.includes(h)));
  const boHuong = (nhom, gt, dat) => <Chon gt={gt} dat={dat} ds={[["", "Tổng"], ...NHOM[nhom].huong]} />;
  const tongDV = (ds) => ({ mt: ds.reduce((s, d) => s + d.mt, 0), tt: ds.reduce((s, d) => s + d.tt, 0) });
  const khungDV = (ten, ds, doi, datDoi, huong) => (
    <Khung ten={ten} phu={kyInfo.nhan} onChiTiet={() => go("cang/muc-tieu")} bo={<ChonDoi gt={doi} dat={datDoi} ds={doiXe} />}>
      <SoLon {...tongDV(ds)} />
      <EChart height={chieuCao(ds.length)} option={optNhom(ds)} />
    </Khung>
  );

  return (
    <div className="grid gap-2.5">
      {chuaSql ? <ChuaCo>Chưa có bảng sản lượng thực tế (chạy sql/06).</ChuaCo>
        : tai ? <ChuaCo>Đang tải sản lượng…</ChuaCo>
        : <>
          <div className="grid gap-2.5 lg:grid-cols-2">
            <Khung ten="Sản lượng cảng" phu={`${kyInfo.nhan} · mục tiêu – thực tế – lũy kế`} onChiTiet={() => go("cang/muc-tieu")} bo={boHuong("cang", huongC, setHuongC)}>
              <SoLon tt={c1.tongTt} mt={c1.tongMt} />
              <EChart height={210} option={optKy(c1, huongList("cang", huongC, c1), "cang")} />
            </Khung>
            <Khung ten="Sản lượng vận tải" phu={`${kyInfo.nhan} · mục tiêu – thực tế – lũy kế`} onChiTiet={() => go("cang/muc-tieu")} bo={boHuong("van_tai", huongV, setHuongV)}>
              <SoLon tt={c3.tongTt} mt={c3.tongMt} />
              <EChart height={210} option={optKy(c3, huongList("van_tai", huongV, c3), "van_tai")} />
            </Khung>
          </div>
          <div className="grid gap-2.5 lg:grid-cols-3">
            <Khung ten="Cảng theo loại hàng" phu={`${kyInfo.nhan} · mục tiêu – lũy kế`} onChiTiet={() => go("cang/muc-tieu")} bo={boHuong("cang", huongH, setHuongH)}>
              {nhomHang.length ? <>
                <SoLon {...tongDV(nhomHang)} />
                <EChart height={chieuCao(nhomHang.length)} option={optNhom(nhomHang)} />
              </> : <ChuaCo>Chưa có mục tiêu hay số thực tế trong kỳ.</ChuaCo>}
            </Khung>
            {khungDV("Vận tải phục vụ cảng", dvCang, doiC, setDoiC)}
            {khungDV("Vận tải phục vụ sản xuất", dvSX, doiS, setDoiS)}
          </div>
        </>}
    </div>
  );
}
