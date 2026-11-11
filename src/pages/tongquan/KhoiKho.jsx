import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/store";
import EChart from "@/components/EChart";
import { so, pct, r2, DAY } from "@/lib/format";
import { chuoiKho, tonTheoTuoi, dsNhomKho, NHOM_TUOI, nhomTuoi } from "@/lib/bieuDoKho";
import { useKho } from "../kho/useKho";
import { MAU } from "./khung";
import { Khung, ChuaCo, ChonDs, BangChiTiet, nghin } from "./khungBD";

// Khối 5 biểu đồ kho phía dưới Linetime (Tổng quan), cùng kỳ (tuần / tháng / quý / năm) với khối sản lượng:
//  1. Kho thành phẩm và 2. Kho nguyên liệu: kế hoạch – lũy kế nhập / xuất, tồn (kế hoạch lấy từ Kho › Kế hoạch Xuất/Nhập tồn), lọc theo loại hàng (nhóm hàng)
//  3. Cơ cấu tồn theo thời gian (cần giải phóng / đầu cơ / lưu động; khai báo ở Kho › Phân loại tồn, SQL 07; lưu động = tồn − hai loại kia)
//  4. Tuổi tồn theo nhóm ngày  5. Top 10 hàng cần xử lý (đã phân loại, hoặc gợi ý: tồn trên 60 ngày chưa phân loại)

const SoLon = ({ v, sub, tone }) => (
  <div className="flex items-baseline gap-2">
    <span className={`font-mono text-2xl font-semibold tabular-nums ${tone ? `text-${tone}` : ""}`}>{v}</span>
    {sub && <span className="truncate text-[0.6875rem] text-muted-foreground">{sub}</span>}
  </div>
);
const base = { grid: { left: 4, right: 8, top: 34, bottom: 0, containLabel: true }, legend: { top: 0, itemWidth: 12, itemHeight: 6, icon: "roundRect", textStyle: { fontSize: 10 } } };
const truc = { type: "value", axisLabel: { fontSize: 10, formatter: nghin } };
const duong = (name, data, color, { net = false, vung = false } = {}) => ({
  name, type: "line", showSymbol: false, connectNulls: false, data, itemStyle: { color }, lineStyle: { width: 2, color, type: net ? "dashed" : "solid" },
  ...(vung ? { areaStyle: { color, opacity: 0.12 } } : {}),
});

// Giao dịch kho trong khoảng ngày [tu, den] (sổ trong bộ nhớ chỉ giữ 35 ngày gần nhất)
function useGiaoDich(tu, den) {
  const { api, D } = useApp();
  const [gd, setGd] = useState(null);
  useEffect(() => {
    let huy = false;
    api.loadGiaoDichKhoang(tu, den).then((r) => { if (!huy) setGd(r || []); }).catch(() => { if (!huy) setGd([]); });
    return () => { huy = true; };
  }, [api, tu, den, D]);
  return gd;
}
export function useTonPhanLoai() {
  const { api, D } = useApp();
  const [r, setR] = useState(undefined);
  useEffect(() => {
    let huy = false;
    api.loadTonPhanLoai().then((x) => { if (!huy) setR(x); }).catch(() => { if (!huy) setR(null); });
    return () => { huy = true; };
  }, [api, D]);
  return r;
}

const tenBuoc = (k) => (k.buoc === "thang" ? "Tháng" : k.buoc === "tuan" ? "Tuần từ" : "Ngày");

export function KhungKho({ ten, loai, kho, kyInfo, gd, keHoach, now, cao }) {
  const [nhom, setNhom] = useState("");
  const nhoms = useMemo(() => dsNhomKho(kho, loai, keHoach), [kho, loai, keHoach]);
  const c = useMemo(() => chuoiKho(kyInfo, { kho, loai, nhom, keHoach, giaoDich: gd, now }), [kyInfo, kho, loai, nhom, keHoach, gd, now]);
  const opt = {
    ...base, tooltip: { valueFormatter: (v) => (v == null ? "—" : `${so(v)} t`) },
    xAxis: { type: "category", data: c.diem.map((o) => o.nhan), axisLabel: { fontSize: 10, hideOverlap: true } }, yAxis: truc,
    series: [
      duong("Nhập thực tế", c.diem.map((o) => o.lkNhapTT), MAU.info), duong("Nhập kế hoạch", c.diem.map((o) => r2(o.lkNhapKH)), MAU.info, { net: true }),
      duong("Xuất thực tế", c.diem.map((o) => o.lkXuatTT), MAU.tim), duong("Xuất kế hoạch", c.diem.map((o) => r2(o.lkXuatKH)), MAU.tim, { net: true }),
      duong("Tồn thực tế", c.diem.map((o) => o.tonCuoi), MAU.ok, { vung: true }), duong("Tồn kế hoạch", c.diem.map((o) => r2(o.tonKH)), MAU.ok, { net: true }),
    ],
  };
  const chiTiet = {
    description: `${kyInfo.nhan}${nhom ? ` · ${nhom}` : " · mọi loại hàng"} · tồn đầu kỳ ${so(c.tonDau)} t`,
    node: <BangChiTiet cot={[[tenBuoc(kyInfo), ""], ["Nhập KH", "t"], ["Nhập TT", "t"], ["Xuất KH", "t"], ["Xuất TT", "t"], ["Lũy kế nhập KH", "t"], ["Lũy kế nhập TT", "t"], ["Lũy kế xuất KH", "t"], ["Lũy kế xuất TT", "t"], ["Tồn KH", "t"], ["Tồn TT", "t"]]}
      dong={c.diem.map((o) => [o.nhan, o.nhapKH, o.nhapTT, o.xuatKH, o.xuatTT, o.lkNhapKH, o.lkNhapTT, o.lkXuatKH, o.lkXuatTT, o.tonKH, o.tonCuoi])}
      tong={["Cả kỳ", c.tongNhapKH, c.tongNhapTT, c.tongXuatKH, c.tongXuatTT, null, null, null, null, null, null]} />,
  };
  return (
    <Khung cao={cao} ten={ten} phu={`${kyInfo.nhan} · kế hoạch – lũy kế nhập / xuất / tồn`} chiTiet={chiTiet} bo={<ChonDs gt={nhom} dat={setNhom} ds={nhoms} tatCa="Mọi loại hàng" />}>
      <SoLon v={nghin(c.tonHT)} sub={`t tồn · nhập ${nghin(c.tongNhapTT)}${c.coKeHoach ? ` / KH ${nghin(c.tongNhapKH)}` : ""} · xuất ${nghin(c.tongXuatTT)}${c.coKeHoach ? ` / KH ${nghin(c.tongXuatKH)}` : ""}`} />
      <EChart height={210} option={opt} />
      {!c.coKeHoach && <div className="mt-1 text-[0.6875rem] text-muted-foreground">Chưa có kế hoạch nhập / xuất của kỳ này (Kho › Kế hoạch Xuất/Nhập tồn).</div>}
    </Khung>
  );
}

const MAU_PL = { can_giai_phong: MAU.bad, dau_co: MAU.warn, goi_y: MAU.xam };
const TEN_PL = { can_giai_phong: "Cần giải phóng", dau_co: "Đầu cơ", goi_y: "Gợi ý: lâu không xuất" };

// Cơ cấu tồn theo thời gian: cột chồng cần giải phóng / đầu cơ (tấn, trục trái) và tỉ trọng của hai loại này trên tổng tồn (trục phải); lưu động ở tooltip
export function KhungCoCau({ p, kyInfo, cao }) {
  const h = p.hien, chet = h ? h.cgp + h.dc : null;
  const cot = (name, khoa, color) => ({ name, type: "bar", stack: "ton", barMaxWidth: 16, itemStyle: { color, opacity: 0.85 }, data: p.diem.map((o) => (o[khoa] == null ? null : r2(o[khoa]))) });
  const opt = {
    ...base,
    tooltip: { formatter: (ds) => { const o = p.diem[ds[0].dataIndex]; return o.tong == null ? `${o.nhan}<br/>Chưa tới` : `${o.nhan}<br/>Cần giải phóng: <b>${so(o.cgp)} t</b><br/>Đầu cơ: <b>${so(o.dc)} t</b><br/>Lưu động: ${so(o.ld)} t<br/>Giải phóng + đầu cơ: <b>${pct((o.cgp + o.dc) / (o.tong || 1), 1)}</b> tổng tồn`; } },
    xAxis: { type: "category", data: p.diem.map((o) => o.nhan), axisLabel: { fontSize: 10, hideOverlap: true } },
    yAxis: [truc, { type: "value", axisLabel: { fontSize: 10, formatter: (v) => pct(v, 1) }, splitLine: { show: false }, min: 0 }],
    series: [
      cot("Cần giải phóng", "cgp", MAU.bad), cot("Đầu cơ", "dc", MAU.warn),
      { ...duong("% trên tổng tồn", p.diem.map((o) => (o.tong ? (o.cgp + o.dc) / o.tong : null)), MAU.info), yAxisIndex: 1 },
    ],
  };
  return (
    <Khung cao={cao} ten="Cơ cấu tồn kho" phu={`${kyInfo.nhan} · cần giải phóng + đầu cơ`} chiTiet={{
      node: <BangChiTiet cot={[[tenBuoc(kyInfo), ""], ["Cần giải phóng", "t"], ["Đầu cơ", "t"], ["Lưu động", "t"], ["Tổng tồn", "t"], ["% giải phóng + đầu cơ", "%"]]}
        dong={p.diem.filter((o) => o.tong != null).map((o) => [o.nhan, o.cgp, o.dc, o.ld, o.tong, o.tong ? (o.cgp + o.dc) / o.tong : null])} />,
    }}>
      <SoLon v={chet == null ? "—" : nghin(chet)} tone={h && h.tong > 0 && chet / h.tong >= 0.2 ? "warn" : undefined}
        sub={h && h.tong > 0 ? `t · ${pct(chet / h.tong, 1)} tồn · lưu động ${nghin(h.ld)} t${p.sucChua ? ` · còn trống ${nghin(Math.max(0, p.sucChua - h.tong))} t` : ""}` : "t"} />
      <EChart height={200} option={opt} />
      {!p.coKhaiBao && <div className="mt-1 text-[0.6875rem] text-muted-foreground">Chưa khai báo phân loại: toàn bộ đang tính là lưu động (Kho › Phân loại tồn).</div>}
    </Khung>
  );
}

// 2. Tuổi tồn: cột ngang chồng theo nhóm tuổi cho kho thành phẩm và kho nguyên liệu
const MAU_TUOI = [MAU.ok, MAU.info, MAU.warn, MAU.bad];
export function KhungTuoi({ tuoi, cao }) {
  const kq = tonTheoTuoi(tuoi), tong = tuoi.reduce((s, r) => s + r.ton, 0);
  const lau = tuoi.filter((r) => r.tuoi > 60).reduce((s, r) => s + r.ton, 0);
  const loai = ["thanh_pham", "nguyen_lieu"], tongLoai = loai.map((l) => kq[l].reduce((a, b) => a + b, 0));
  const opt = {
    ...base, grid: { left: 4, right: 12, top: 30, bottom: 0, containLabel: true },
    tooltip: { axisPointer: { type: "shadow" }, formatter: (ds) => `${ds[0].name} · tồn ${so(tongLoai[ds[0].dataIndex])} t<br/>` + ds.map((d) => `${d.marker}${d.seriesName}: <b>${so(kq[loai[d.dataIndex]][d.seriesIndex])} t</b> (${pct(d.value, 1)})`).join("<br/>") },
    xAxis: { type: "value", max: 1, axisLabel: { fontSize: 10, formatter: (v) => pct(v) } }, yAxis: { type: "category", data: ["Thành phẩm", "Nguyên liệu"], axisLabel: { fontSize: 10 } },
    series: NHOM_TUOI.map(([, , ten], i) => ({ name: ten, type: "bar", stack: "tuoi", barMaxWidth: 26, itemStyle: { color: MAU_TUOI[i] }, data: loai.map((l, j) => (tongLoai[j] ? kq[l][i] / tongLoai[j] : 0)) })),
  };
  return (
    <Khung cao={cao} ten="Tuổi tồn" phu="tỉ lệ theo nhóm ngày · lô theo ngày nhập, còn lại theo lần xuất gần nhất" chiTiet={{
      description: "Từng dòng tồn, cũ nhất ở trên. Lô thành phẩm tính từ ngày nhập lô; hàng khác tính từ lần xuất gần nhất của bãi + hàng.",
      node: <BangChiTiet cot={[["Hàng", ""], ["Bãi", ""], ["Lô", ""], ["Kho", ""], ["Tồn", "t"], ["Tuổi (ngày)", "n"], ["Nhóm tuổi", ""]]}
        dong={[...tuoi].sort((a, b) => b.tuoi - a.tuoi).map((r) => [r.hang, r.ten_bai, r.so_lo, r.loai === "thanh_pham" ? "Thành phẩm" : "Nguyên liệu", r.ton, r.tuoi, NHOM_TUOI[nhomTuoi(r.tuoi)][2]])} />,
    }}>
      <SoLon v={nghin(lau)} tone={tong > 0 && lau / tong >= 0.2 ? "warn" : undefined} sub={`t tồn trên 60 ngày${tong > 0 ? ` · ${pct(lau / tong)} tổng tồn` : ""}`} />
      <EChart height={200} option={opt} />
    </Khung>
  );
}
