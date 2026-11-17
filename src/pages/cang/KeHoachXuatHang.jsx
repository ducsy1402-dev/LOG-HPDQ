import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/store";
import { NativeSelect } from "@/components/ui/input";
import EChart from "@/components/EChart";
import { Khung } from "../tongquan/khungBD";
import { MAU } from "../tongquan/khung";
import { so, r2, plain } from "@/lib/format";
import { khoaDiem } from "@/lib/bieuDoSanLuong";
import { luyKe } from "@/lib/keHoachNgay";
import { useKho } from "../kho/useKho";
import { useNhomHang } from "./useNhomHang";

// Biểu đồ "Kế hoạch xuất hàng" ở Mục tiêu sản lượng (anh Sỹ 17/11/2026): theo kỳ đang chọn ở đầu trang (Tháng / Quý / Năm; điểm theo ngày / tuần / tháng), lọc theo loại hàng (nhóm hàng):
//   • Lũy kế sản lượng XUẤT kế hoạch (nét đứt): kế hoạch ngày theo tàu, tháng chưa đặt thì mục tiêu chia đều (cùng nguồn các biểu đồ khác của trang);
//   • Lũy kế sản lượng XUẤT thực tế (nét liền): sản lượng thực tế đã nhập, chỉ tới hôm nay;
//   • Tồn kho theo ngày (trục phải): tồn cuối mỗi điểm của kỳ, tính ngược từ tồn hiện tại theo sổ nhập – xuất kho (tồn hiện tại − các lượt phát sinh sau điểm đó); điều chuyển nội bộ không đổi tồn. Chỉ tới hôm nay.
// Tồn kho cần quyền Khai thác kho bãi; không có quyền thì chỉ vẽ hai đường lũy kế.
export default function KeHoachXuatHang({ kyInfo, homNay, c, nhomX, setNhomX, dsNhom, cao, nguon }) {
  const { api } = useApp();
  const kho = useKho(), nhomHang = useNhomHang();
  const [gd, setGd] = useState(null); // sổ kho từ đầu kỳ tới hôm nay
  const dau = kyInfo.ngays[0];
  useEffect(() => {
    let huy = false; setGd(null);
    if (dau > homNay) { setGd([]); return undefined; }
    api.loadGiaoDichKhoang(dau, homNay).then((r) => { if (!huy) setGd(r || []); }).catch(() => { if (!huy) setGd([]); });
    return () => { huy = true; };
  }, [api, dau, homNay]);

  const lamNhom = (hang) => (!nhomX || plain(nhomHang(hang, "")) === plain(nhomX));
  const dsLoc = useMemo(() => {
    const m = new Map(dsNhom.map((n) => [plain(n), n]));
    for (const x of kho?.cap || []) { const n = nhomHang(x.hang, ""); if (n && x.ton > 1e-6) m.set(plain(n), n); }
    return [...m.values()].sort((a, b) => a.localeCompare(b, "vi"));
  }, [dsNhom, kho, nhomHang]);

  // Ngày cuối của từng điểm trên biểu đồ
  const cuoi = useMemo(() => {
    const m = new Map(); for (const d of kyInfo.ngays) m.set(khoaDiem(kyInfo.buoc, d), d);
    return c.diem.map((o) => m.get(khoaDiem(kyInfo.buoc, o.dau)) || o.dau);
  }, [kyInfo, c]);
  // Tồn cuối điểm = tồn hiện tại (theo nhóm hàng) − tổng thay đổi của các lượt sổ SAU ngày cuối điểm (tới hôm nay)
  const ton = useMemo(() => {
    if (!kho || !gd) return null;
    const tonNay = kho.cap.filter((x) => lamNhom(x.hang)).reduce((s, x) => s + x.ton, 0);
    const dl = (g) => (g.loai === "xuat" ? -(+g.so_luong || 0) : g.loai === "dieu_chuyen" ? 0 : +g.so_luong || 0);
    const luot = gd.filter((g) => lamNhom(g.hang)).map((g) => [String(g.ngay).slice(0, 10), dl(g)]);
    return cuoi.map((d) => (d > homNay ? null : r2(tonNay - luot.filter(([n]) => n > d).reduce((s, [, v]) => s + v, 0))));
  }, [kho, gd, cuoi, homNay, nhomX]); // eslint-disable-line react-hooks/exhaustive-deps

  const lkKH = luyKe(c.khD).map(r2), lkTT = c.diem.map((o) => (o.lkTt == null ? null : r2(o.lkTt)));
  const mauX = MAU.tim, mauT = MAU.ok;
  const duong = (name, data, color, o = {}) => ({ name, type: "line", showSymbol: kyInfo.ky !== "thang", symbolSize: 4, data, itemStyle: { color }, lineStyle: { width: o.net ? 1.6 : 2.4, type: o.net ? "dashed" : "solid", color }, ...o.them });
  const series = [duong("Lũy kế xuất · kế hoạch", lkKH, mauX, { net: true }), duong("Lũy kế xuất · thực tế", lkTT, mauX),
    ...(ton ? [duong("Tồn kho", ton, mauT, { them: { yAxisIndex: 1, areaStyle: { color: mauT, opacity: 0.08 } } })] : [])];
  const option = {
    grid: { left: 4, right: ton ? 8 : 10, top: 44, bottom: 0, containLabel: true }, legend: { itemWidth: 12, itemHeight: 6, textStyle: { fontSize: 10 } },
    tooltip: { trigger: "axis", valueFormatter: (v) => (v == null ? "—" : `${so(v)} t`) },
    xAxis: { type: "category", data: c.diem.map((o) => o.nhan), axisLabel: { fontSize: 10, hideOverlap: true } },
    yAxis: [{ type: "value", name: "Lũy kế (t)", nameTextStyle: { fontSize: 10 }, axisLabel: { fontSize: 10, formatter: (v) => (Math.abs(v) >= 1000 ? `${r2(v / 1000)}k` : v) } },
      ...(ton ? [{ type: "value", name: "Tồn kho (t)", nameTextStyle: { fontSize: 10 }, position: "right", splitLine: { show: false }, axisLabel: { fontSize: 10, formatter: (v) => (Math.abs(v) >= 1000 ? `${r2(v / 1000)}k` : v) } }] : [])],
    series,
  };
  const cuoiTT = lkTT.filter((v) => v != null).slice(-1)[0] ?? 0, cuoiKH = lkKH[lkKH.length - 1] || 0, tonCuoi = ton ? ton.filter((v) => v != null).slice(-1)[0] : null;
  return (
    <Khung cao={cao} className="xl:col-span-2" ten="Kế hoạch xuất hàng" phu={`${kyInfo.nhan} · theo ${kyInfo.buoc === "ngay" ? "ngày" : kyInfo.buoc === "tuan" ? "tuần" : "tháng"}${nhomX ? " · " + nhomX : " · mọi loại hàng"}`}
      bo={<NativeSelect className="h-6 w-36 text-[0.6875rem]" value={dsLoc.includes(nhomX) ? nhomX : ""} onChange={(e) => setNhomX(e.target.value)} placeholder="Mọi loại hàng" options={dsLoc} aria-label="Lọc theo loại hàng" />}>
      <EChart height={cao - 100} option={option} />
      <div className="mt-1 grid gap-0.5 text-[0.6875rem] text-muted-foreground">
        <span>Xuất thực tế <b className="text-foreground">{so(cuoiTT, 0)} t</b> / kế hoạch cả kỳ <b className="text-foreground">{so(cuoiKH, 0)} t</b> · KH: {nguon}</span>
        <span>{kho ? <>Tồn kho cuối kỳ tới hôm nay: <b className="text-foreground">{tonCuoi != null ? `${so(tonCuoi, 0)} t` : "—"}</b>{gd ? "" : " (đang tải sổ kho…)"}</> : "Tồn kho: cần quyền Khai thác kho bãi để xem."}</span>
      </div>
    </Khung>
  );
}
