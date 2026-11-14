import { useMemo, useState } from "react";
import EChart from "@/components/EChart";
import { useApp } from "@/store";
import { so, pct, r2 } from "@/lib/format";
import { khoangBen } from "@/lib/linetime";
import { dongHang } from "@/lib/sanLuong";
import { cangCuaChuyen, KHONG_CANG } from "@/lib/cangTrucThuoc";
import { useNhomHang } from "../cang/useNhomHang";
import { NHOM, tenHuong, tenDonVi } from "@/lib/sanLuongTT";
import { tongTheoNhom, chuoiKy } from "@/lib/bieuDoSanLuong";
import { MAU } from "./khung";
import { Khung, ChuaCo, Chon, nghin } from "./khungBD";

// Mảng Sản lượng của Tổng quan (anh Sỹ chốt 11/2026): 6 biểu đồ (thêm 2 biểu đồ theo CẢNG TRỰC THUỘC 14/11/2026), mỗi biểu đồ một khung CỐ ĐỊNH chiều cao (CAO), dài thì cuộn trong khung:
//   1. Cơ cấu sản lượng cảng (loại hàng)            2. Cơ cấu sản lượng theo đơn vị vận chuyển (Hòa Phát / nhà thầu)
//   3. Lũy kế sản lượng nhập / xuất cảng theo loại hàng   4. Lũy kế sản lượng theo đội xe
//   5. Lũy kế sản lượng nhập / xuất cảng thực tế – kế hoạch   6. Lũy kế sản lượng phục vụ cảng / phục vụ sản xuất thực tế – kế hoạch
//   7. Cơ cấu sản lượng theo cảng trực thuộc   8. Sản lượng từng cảng trực thuộc theo loại hàng (cột chồng)
//   Hai biểu đồ 7, 8 tính từ KL đã làm của các chuyến tàu cập bến trong kỳ, cảng = cột "Cảng trực thuộc" của bến chuyến cập (Danh mục › Cầu bến › Danh sách bến).
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
export function BanhVong({ ds }) {
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

// KL đã làm của các chuyến cập bến trong kỳ theo (cảng trực thuộc, loại hàng); huong "" = cả hai. Trả { cang: null | [{ ten, tong, loai: Map }] }
export function useTheoCang(kyInfo, huong) {
  const { D } = useApp(), nhomHang = useNhomHang();
  return useMemo(() => {
    const cang = cangCuaChuyen(D.dmCot, D.berths);
    if (!cang) return null;
    const m = new Map();
    for (const v of D.voyages) {
      if (v.huy || (huong && (v.huong === "xuat" ? "xuat" : "nhap") !== huong)) continue;
      const k = khoangBen(v, D.now); if (!k || k.a < kyInfo.tu || k.a >= kyInfo.den) continue;
      const ten = cang(v), o = m.get(ten) || { ten, tong: 0, loai: new Map() };
      for (const h of dongHang(v, nhomHang)) { if (!(h.lam > 0)) continue; o.tong += h.lam; o.loai.set(h.loai, (o.loai.get(h.loai) || 0) + h.lam); }
      m.set(ten, o);
    }
    return [...m.values()].filter((o) => o.tong > 0).sort((a, b) => (a.ten === KHONG_CANG) - (b.ten === KHONG_CANG) || b.tong - a.tong);
  }, [D.voyages, D.dmCot, D.berths, D.now, kyInfo, huong, nhomHang]);
}
// Cột chồng: mỗi cảng một dòng, mỗi loại hàng một màu (top 7 loại, còn lại gộp "Khác")
export function optCangLoai(ds) {
  const tongLoai = new Map(); for (const d of ds) for (const [l, v] of d.loai) tongLoai.set(l, (tongLoai.get(l) || 0) + v);
  const top = [...tongLoai].sort((a, b) => b[1] - a[1]).slice(0, 7).map(([l]) => l), set = new Set(top), coKhac = tongLoai.size > top.length;
  const val = (d, l) => r2(l === "Khác" ? [...d.loai].filter(([k]) => !set.has(k)).reduce((s, [, v]) => s + v, 0) : d.loai.get(l) || 0);
  const ten = [...top, ...(coKhac ? ["Khác"] : [])];
  return {
    grid: { left: 4, right: 14, top: 40, bottom: 0, containLabel: true }, legend: { type: "scroll", top: 0, itemWidth: 12, itemHeight: 6, icon: "roundRect", textStyle: { fontSize: 10 } },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (v) => `${so(v)} t` },
    xAxis: { type: "value", axisLabel: { fontSize: 10, formatter: nghin } },
    yAxis: { type: "category", inverse: true, data: ds.map((d) => d.ten), axisLabel: { fontSize: 10, width: 100, overflow: "truncate" } },
    series: ten.map((l, i) => ({ name: l, type: "bar", stack: "t", barMaxWidth: 22, itemStyle: { color: l === "Khác" ? MAU.xam : MAU_LAT[i % MAU_LAT.length] }, data: ds.map((d) => val(d, l)) })),
  };
}
export const CHUA_CO_CANG = <ChuaCo>Chưa có cột <b>Cảng trực thuộc</b>: vào Danh mục › Cầu bến › Danh sách bến, bấm Thêm cột rồi ghi cảng cho từng bến.</ChuaCo>;

const bo = (gt, dat, nhom) => <Chon gt={gt} dat={dat} ds={[["", "Tổng"], ...NHOM[nhom].huong]} />;

// cang / vt: dữ liệu đã tải (mục tiêu + thực tế); tdC, tdV: tienDoSanLuong (dòng tóm tắt)
export default function BieuDoSanLuongTQ({ kyInfo, cang, vt, tdC, tdV }) {
  const [hCoCau, setHCoCau] = useState(""), [hDV, setHDV] = useState(""), [hLoai, setHLoai] = useState(""), [hDoi, setHDoi] = useState(""), [hCang, setHCang] = useState(""), [hCangLoai, setHCangLoai] = useState("");
  const cangTong = useTheoCang(kyInfo, hCang), cangLoai = useTheoCang(kyInfo, hCangLoai);
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
      <Khung cao={CAO} ten="Cơ cấu sản lượng theo cảng trực thuộc" phu={`${kyInfo.nhan} · KL đã làm của tàu cập bến`} bo={bo(hCang, setHCang, "cang")}>
        {cangTong == null ? CHUA_CO_CANG : cangTong.length ? <BanhVong ds={cangTong.map((o) => ({ name: o.ten, value: r2(o.tong) }))} /> : <ChuaCo>Chưa có tàu cập bến trong kỳ.</ChuaCo>}
      </Khung>
      <Khung cao={CAO} ten="Sản lượng từng cảng trực thuộc theo loại hàng" phu={`${kyInfo.nhan} · KL đã làm của tàu cập bến`} bo={bo(hCangLoai, setHCangLoai, "cang")}>
        {cangLoai == null ? CHUA_CO_CANG : cangLoai.length ? <EChart height={chieuCao(cangLoai.length)} option={optCangLoai(cangLoai)} /> : <ChuaCo>Chưa có tàu cập bến trong kỳ.</ChuaCo>}
      </Khung>
    </div>
  );
}
