import { useMemo, useState } from "react";
import EChart from "@/components/EChart";
import { so, pct, r2 } from "@/lib/format";
import { NHOM, tenHuong, tenDonVi } from "@/lib/sanLuongTT";
import { tongTheoNhom, chuoiKy } from "@/lib/bieuDoSanLuong";
import { MAU } from "./khung";
import { Khung, ChuaCo, Chon, nghin } from "./khungBD";

// Mảng Sản lượng của Tổng quan (anh Sỹ chốt 11/2026): đúng 6 biểu đồ, mỗi biểu đồ một khung CỐ ĐỊNH chiều cao (CAO), dài thì cuộn trong khung:
//   1. Cơ cấu sản lượng cảng (loại hàng)            2. Cơ cấu sản lượng theo đơn vị vận chuyển (Hòa Phát / nhà thầu)
//   3. Lũy kế sản lượng nhập / xuất cảng theo loại hàng   4. Lũy kế sản lượng theo đội xe
//   5. Lũy kế sản lượng nhập / xuất cảng thực tế – kế hoạch   6. Lũy kế sản lượng phục vụ cảng / phục vụ sản xuất thực tế – kế hoạch
export const CAO = 350;
const base = { grid: { left: 4, right: 10, top: 30, bottom: 0, containLabel: true }, legend: { top: 0, itemWidth: 12, itemHeight: 6, icon: "roundRect", textStyle: { fontSize: 10 } } };
const truc = { type: "value", axisLabel: { fontSize: 10, formatter: nghin } };
const MAU_T = { ok: MAU.ok, warn: MAU.warn, bad: MAU.bad };
const MAU_HUONG = { nhap: MAU.info, xuat: MAU.tim, phuc_vu_cang: MAU.info, phuc_vu_san_xuat: "#ec4899" };
const MAU_LAT = ["#6366f1", "#14b8a6", "#38bdf8", "#f59e0b", "#a78bfa", "#ec4899", "#f97316", "#22c55e", "#94a3b8"];
const chieuCao = (n) => Math.max(250, 40 + n * 36);

// Biểu đồ lũy kế theo thời gian: mỗi hướng hai đường, lũy kế kế hoạch (nét đứt) và lũy kế thực tế (nét liền). Cảng: nhập, xuất; vận tải: phục vụ cảng, phục vụ sản xuất
const TEN_NGAN = { nhap: "nhập", xuat: "xuất", phuc_vu_cang: "phục vụ cảng", phuc_vu_san_xuat: "phục vụ sản xuất" };
function optLuyKe(cs) { // cs: [[huong, chuoiKy của riêng hướng đó]]
  const diem = cs[0][1].diem, series = [];
  for (const [h, c] of cs) {
    const mau = MAU_HUONG[h] || MAU.primary;
    series.push({ name: `Lũy kế ${TEN_NGAN[h] || h} · kế hoạch`, type: "line", showSymbol: false, data: c.diem.map((o) => r2(o.lkMt)), itemStyle: { color: mau }, lineStyle: { width: 2, type: "dashed", color: mau } });
    series.push({ name: `Lũy kế ${TEN_NGAN[h] || h} · thực tế`, type: "line", showSymbol: false, connectNulls: false, data: c.diem.map((o) => (o.lkTt == null ? null : r2(o.lkTt))), itemStyle: { color: mau }, lineStyle: { width: 3, color: mau }, areaStyle: { color: mau, opacity: 0.07 } });
  }
  return {
    ...base, grid: { ...base.grid, top: 56, right: 8 }, tooltip: { trigger: "axis", valueFormatter: (v) => (v == null ? "—" : `${so(v)} t`) },
    xAxis: { type: "category", data: diem.map((o) => o.nhan), axisLabel: { fontSize: 10, hideOverlap: true } }, yAxis: truc, series,
  };
}

// Cột ngang so kế hoạch với lũy kế thực hiện của từng nhóm
const optNhom = (ds) => ({
  grid: { left: 4, right: 52, top: 26, bottom: 0, containLabel: true },
  legend: { top: 0, itemWidth: 12, itemHeight: 6, icon: "roundRect", textStyle: { fontSize: 10 } },
  tooltip: { axisPointer: { type: "shadow" }, valueFormatter: (v) => `${so(v)} t` },
  xAxis: { type: "value", axisLabel: { fontSize: 10, formatter: nghin } },
  yAxis: { type: "category", inverse: true, data: ds.map((d) => d.ten), axisLabel: { fontSize: 10, width: 100, overflow: "truncate" } },
  series: [
    { name: "Kế hoạch", type: "bar", barMaxWidth: 9, barGap: "45%", itemStyle: { color: MAU.xam, opacity: 0.5 }, data: ds.map((d) => r2(d.mt)) },
    { name: "Lũy kế thực tế", type: "bar", barMaxWidth: 9, itemStyle: { color: MAU.primary }, label: { show: true, position: "right", fontSize: 10, distance: 4, formatter: (p) => (ds[p.dataIndex].mt ? pct(ds[p.dataIndex].tt / ds[p.dataIndex].mt) : "") }, data: ds.map((d) => r2(d.tt)) },
  ],
});

// Bánh vòng cơ cấu (top 8, còn lại gộp "Khác"); số tổng ở giữa
function BanhVong({ ds }) {
  const tong = ds.reduce((s, d) => s + d.value, 0), top = ds.slice(0, 8), khac = ds.slice(8).reduce((s, d) => s + d.value, 0);
  const data = [...top, ...(khac > 0 ? [{ name: "Khác", value: r2(khac) }] : [])].map((d, i) => ({ ...d, itemStyle: { color: MAU_LAT[i % MAU_LAT.length] } }));
  return (
    <div className="relative">
      <EChart height={268} option={{
        tooltip: { trigger: "item", formatter: (p) => `${p.marker}${p.name}: <b>${so(p.value)} t</b> (${pct(p.value / tong, 1)})` }, legend: { type: "scroll", bottom: 0, itemWidth: 10, itemHeight: 8, textStyle: { fontSize: 10 } },
        series: [{ type: "pie", radius: ["46%", "70%"], center: ["50%", "45%"], label: { show: false }, data }],
      }} />
      <div className="pointer-events-none absolute left-1/2 top-[45%] -translate-x-1/2 -translate-y-1/2 text-center leading-tight"><div className="text-lg font-semibold tabular-nums">{nghin(tong)}</div><div className="text-[0.6875rem] text-muted-foreground">tấn</div></div>
    </div>
  );
}

const bo = (gt, dat, nhom) => <Chon gt={gt} dat={dat} ds={[["", "Tổng"], ...NHOM[nhom].huong]} />;

// cang / vt: dữ liệu đã tải (mục tiêu + thực tế); tdC, tdV: tienDoSanLuong (dòng tóm tắt)
export default function BieuDoSanLuongTQ({ kyInfo, cang, vt, tdC, tdV }) {
  const [hCoCau, setHCoCau] = useState(""), [hDV, setHDV] = useState(""), [hLoai, setHLoai] = useState(""), [hDoi, setHDoi] = useState("");
  const coCauCang = useMemo(() => [...tongTheoNhom(kyInfo, cang, "cang", (x) => x.loai, (x) => !hCoCau || x.huong === hCoCau)].map(([k, v]) => ({ name: k, value: r2(v.tt) })).filter((d) => d.value > 0).sort((a, b) => b.value - a.value), [kyInfo, cang, hCoCau]);
  const coCauDV = useMemo(() => [...tongTheoNhom(kyInfo, vt, "van_tai", (x) => x.donVi, (x) => !hDV || x.huong === hDV)].map(([k, v]) => ({ name: tenDonVi(k), value: r2(v.tt) })).filter((d) => d.value > 0).sort((a, b) => b.value - a.value), [kyInfo, vt, hDV]);
  const theoLoai = useMemo(() => [...tongTheoNhom(kyInfo, cang, "cang", (x) => `${x.huong}|${x.loai}`, (x) => !hLoai || x.huong === hLoai)].map(([k, v]) => { const [h, loai] = k.split("|"); return { ...v, ten: `${tenHuong("cang", h)} · ${loai}`, ord: (h === "nhap" ? 0 : 1) + loai }; }).sort((a, b) => a.ord.localeCompare(b.ord, "vi")), [kyInfo, cang, hLoai]);
  const theoDoi = useMemo(() => [...tongTheoNhom(kyInfo, vt, "van_tai", (x) => x.loai, (x) => !hDoi || x.huong === hDoi)].map(([k, v]) => ({ ...v, ten: k || "(chưa ghi)" })).sort((a, b) => b.tt - a.tt), [kyInfo, vt, hDoi]);
  const luyKe = (du, nhom) => NHOM[nhom].huong.map(([h]) => [h, chuoiKy(kyInfo, du, nhom, { loc: (x) => x.huong === h })]);
  const csC = useMemo(() => luyKe(cang, "cang"), [kyInfo, cang]); // eslint-disable-line react-hooks/exhaustive-deps
  const csV = useMemo(() => luyKe(vt, "van_tai"), [kyInfo, vt]); // eslint-disable-line react-hooks/exhaustive-deps
  const tieuDe = (td) => (td ? `${nghin(td.tt)} / ${nghin(td.mt)} t · đạt ${td.mt ? pct(td.dat, 1) : "—"}${td.duBaoDat != null && !td.xong ? ` · dự báo ${pct(td.duBaoDat)}` : ""}` : "");
  return (
    <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr))]">
      <Khung cao={CAO} ten="Cơ cấu sản lượng cảng" phu={`${kyInfo.nhan} · theo loại hàng`} bo={bo(hCoCau, setHCoCau, "cang")}>
        {coCauCang.length ? <BanhVong ds={coCauCang} /> : <ChuaCo>Chưa có sản lượng thực tế trong kỳ.</ChuaCo>}
      </Khung>
      <Khung cao={CAO} ten="Cơ cấu sản lượng theo đơn vị vận chuyển" phu={`${kyInfo.nhan} · Hòa Phát / nhà thầu`} bo={bo(hDV, setHDV, "van_tai")}>
        {coCauDV.length ? <BanhVong ds={coCauDV} /> : <ChuaCo>Chưa có sản lượng vận tải trong kỳ.</ChuaCo>}
      </Khung>
      <Khung cao={CAO} ten="Lũy kế nhập / xuất cảng theo loại hàng" phu={`${kyInfo.nhan} · kế hoạch – thực tế`} bo={bo(hLoai, setHLoai, "cang")}>
        {theoLoai.length ? <EChart height={chieuCao(theoLoai.length)} option={optNhom(theoLoai)} /> : <ChuaCo>Chưa có kế hoạch hay số thực tế.</ChuaCo>}
      </Khung>
      <Khung cao={CAO} ten="Lũy kế sản lượng theo đội xe" phu={`${kyInfo.nhan} · kế hoạch – thực tế`} bo={bo(hDoi, setHDoi, "van_tai")}>
        {theoDoi.length ? <EChart height={chieuCao(theoDoi.length)} option={optNhom(theoDoi)} /> : <ChuaCo>Chưa có kế hoạch hay số thực tế vận tải.</ChuaCo>}
      </Khung>
      <Khung cao={CAO} ten="Lũy kế nhập / xuất cảng" phu={`${kyInfo.nhan} · thực tế – kế hoạch`}>
        <div className="mb-1 text-[0.6875rem] text-muted-foreground">{tieuDe(tdC)}</div>
        <EChart height={280} option={optLuyKe(csC)} />
      </Khung>
      <Khung cao={CAO} ten="Lũy kế phục vụ cảng / phục vụ sản xuất" phu={`${kyInfo.nhan} · thực tế – kế hoạch`}>
        <div className="mb-1 text-[0.6875rem] text-muted-foreground">{tieuDe(tdV)}</div>
        <EChart height={280} option={optLuyKe(csV)} />
      </Khung>
    </div>
  );
}
