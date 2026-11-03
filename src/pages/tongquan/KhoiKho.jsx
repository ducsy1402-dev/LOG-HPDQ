import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/store";
import EChart from "@/components/EChart";
import { so, pct } from "@/lib/format";
import { chuoiKho, chuoiPhanLoai, tuoiTon, tonTheoTuoi, hangCanXuLy, NHOM_TUOI } from "@/lib/bieuDoKho";
import { DAY } from "@/lib/format";
import { useKho } from "../kho/useKho";
import { MAU } from "./khung";
import { Khung, ChuaCo, nghin } from "./KhoiSanLuong";

// Khối 5 biểu đồ kho phía dưới Linetime (Tổng quan), cùng kỳ (tuần / tháng / quý / năm) với khối sản lượng:
//  1. Kho thành phẩm và 2. Kho nguyên liệu: kế hoạch – lũy kế nhập / xuất, tồn (kế hoạch lấy từ Kho › Kế hoạch Xuất/Nhập tồn)
//  3. Cơ cấu tồn theo thời gian (cần giải phóng / đầu cơ / lưu động; khai báo ở Kho › Phân loại tồn, SQL 07; lưu động = tồn − hai loại kia)
//  4. Tuổi tồn theo nhóm ngày  5. Top 10 hàng cần xử lý (đã phân loại, hoặc gợi ý: tồn trên 60 ngày chưa phân loại)

const SoLon = ({ v, sub, tone }) => (
  <div className="flex items-baseline gap-2">
    <span className={`font-mono text-2xl font-semibold tabular-nums ${tone ? `text-${tone}` : ""}`}>{v}</span>
    {sub && <span className="truncate text-[11px] text-muted-foreground">{sub}</span>}
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
function useTonPhanLoai() {
  const { api, D } = useApp();
  const [r, setR] = useState(undefined);
  useEffect(() => {
    let huy = false;
    api.loadTonPhanLoai().then((x) => { if (!huy) setR(x); }).catch(() => { if (!huy) setR(null); });
    return () => { huy = true; };
  }, [api, D]);
  return r;
}

function KhungKho({ ten, c, kyInfo, onMo }) {
  const opt = {
    ...base, tooltip: { valueFormatter: (v) => (v == null ? "—" : `${so(v)} t`) },
    xAxis: { type: "category", data: c.diem.map((o) => o.nhan), axisLabel: { fontSize: 10, hideOverlap: true } }, yAxis: truc,
    series: [
      duong("Nhập thực tế", c.diem.map((o) => o.lkNhapTT), MAU.info), duong("Nhập kế hoạch", c.diem.map((o) => Math.round(o.lkNhapKH)), MAU.info, { net: true }),
      duong("Xuất thực tế", c.diem.map((o) => o.lkXuatTT), MAU.tim), duong("Xuất kế hoạch", c.diem.map((o) => Math.round(o.lkXuatKH)), MAU.tim, { net: true }),
      duong("Tồn thực tế", c.diem.map((o) => o.tonCuoi), MAU.ok, { vung: true }), duong("Tồn kế hoạch", c.diem.map((o) => Math.round(o.tonKH)), MAU.ok, { net: true }),
    ],
  };
  return (
    <Khung ten={ten} phu={`${kyInfo.nhan} · kế hoạch – lũy kế nhập / xuất / tồn`} onChiTiet={onMo}>
      <SoLon v={nghin(c.tonHT)} sub={`t tồn · nhập ${nghin(c.tongNhapTT)}${c.coKeHoach ? ` / KH ${nghin(c.tongNhapKH)}` : ""} · xuất ${nghin(c.tongXuatTT)}${c.coKeHoach ? ` / KH ${nghin(c.tongXuatKH)}` : ""}`} />
      <EChart height={210} option={opt} />
      {!c.coKeHoach && <div className="mt-1 text-[10px] text-muted-foreground">Chưa có kế hoạch nhập / xuất của kỳ này (Kho › Kế hoạch Xuất/Nhập tồn).</div>}
    </Khung>
  );
}

const MAU_PL = { can_giai_phong: MAU.bad, dau_co: MAU.warn, goi_y: MAU.xam };
const TEN_PL = { can_giai_phong: "Cần giải phóng", dau_co: "Đầu cơ", goi_y: "Gợi ý: lâu không xuất" };

// Cơ cấu tồn theo thời gian: cột chồng cần giải phóng / đầu cơ (tấn, trục trái) và tỉ trọng của hai loại này trên tổng tồn (trục phải); lưu động ở tooltip
function KhungCoCau({ p, kyInfo, onMo }) {
  const h = p.hien, chet = h ? h.cgp + h.dc : null;
  const cot = (name, khoa, color) => ({ name, type: "bar", stack: "ton", barMaxWidth: 16, itemStyle: { color, opacity: 0.85 }, data: p.diem.map((o) => (o[khoa] == null ? null : Math.round(o[khoa]))) });
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
    <Khung ten="Cơ cấu tồn kho" phu={`${kyInfo.nhan} · cần giải phóng + đầu cơ`} onChiTiet={onMo}>
      <SoLon v={chet == null ? "—" : nghin(chet)} tone={h && h.tong > 0 && chet / h.tong >= 0.2 ? "warn" : undefined}
        sub={h && h.tong > 0 ? `t · ${pct(chet / h.tong, 1)} tồn · lưu động ${nghin(h.ld)} t${p.sucChua ? ` · còn trống ${nghin(Math.max(0, p.sucChua - h.tong))} t` : ""}` : "t"} />
      <EChart height={200} option={opt} />
      {!p.coKhaiBao && <div className="mt-1 text-[10px] text-muted-foreground">Chưa khai báo phân loại: toàn bộ đang tính là lưu động (Kho › Phân loại tồn).</div>}
    </Khung>
  );
}

// 2. Tuổi tồn: cột ngang chồng theo nhóm tuổi cho kho thành phẩm và kho nguyên liệu
const MAU_TUOI = [MAU.ok, MAU.info, MAU.warn, MAU.bad];
function KhungTuoi({ tuoi, onMo }) {
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
    <Khung ten="Tuổi tồn" phu="tỉ lệ theo nhóm ngày · lô theo ngày nhập, còn lại theo lần xuất gần nhất" onChiTiet={onMo}>
      <SoLon v={nghin(lau)} tone={tong > 0 && lau / tong >= 0.2 ? "warn" : undefined} sub={`t tồn trên 60 ngày${tong > 0 ? ` · ${pct(lau / tong)} tổng tồn` : ""}`} />
      <EChart height={200} option={opt} />
    </Khung>
  );
}

// 3. Top 10 hàng cần xử lý: đã khai báo cần giải phóng / đầu cơ và hàng gợi ý (trên 60 ngày chưa phân loại)
function KhungTop({ ds, onMo }) {
  const opt = {
    grid: { left: 4, right: 58, top: 4, bottom: 0, containLabel: true },
    tooltip: { trigger: "item", formatter: (x) => { const r = ds[x.dataIndex]; return `${r.hang} · ${r.ten_bai}<br/>${TEN_PL[r.kieu]}: <b>${so(r.tan)} t</b><br/>Tuổi tồn ${so(r.tuoi)} ngày`; } },
    xAxis: truc, yAxis: { type: "category", inverse: true, data: ds.map((r) => `${r.hang} · ${r.ten_bai}`), axisLabel: { fontSize: 10, width: 130, overflow: "truncate" } },
    series: [{ type: "bar", barMaxWidth: 12, data: ds.map((r) => ({ value: Math.round(r.tan), itemStyle: { color: MAU_PL[r.kieu], opacity: r.kieu === "goi_y" ? 0.6 : 1 } })),
      label: { show: true, position: "right", fontSize: 10, formatter: (x) => `${so(ds[x.dataIndex].tuoi)} ngày` } }],
  };
  return (
    <Khung ten="Hàng cần xử lý" phu="top 10 theo số tấn" onChiTiet={onMo}>
      <div className="mb-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
        {Object.entries(TEN_PL).map(([k, t]) => <span key={k} className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: MAU_PL[k], opacity: k === "goi_y" ? 0.6 : 1 }} />{t}</span>)}
      </div>
      {ds.length ? <EChart height={Math.max(180, 20 + ds.length * 26)} option={opt} /> : <ChuaCo>Không có hàng tồn lâu hay đã phân loại cần xử lý.</ChuaCo>}
    </Khung>
  );
}

export default function KhoiKho({ kyInfo, go }) {
  const { D } = useApp();
  const kho = useKho();
  const gd = useGiaoDich(kyInfo.ngays[0], kyInfo.homNay);
  const gd120 = useGiaoDich(new Date(D.now - 120 * DAY).toISOString().slice(0, 10), kyInfo.homNay); // tuổi tồn: lần xuất gần nhất trong 120 ngày
  const khaiBao = useTonPhanLoai();
  const th = useMemo(() => (kho && gd ? chuoiKho(kyInfo, { kho, loai: "thanh_pham", keHoach: D.khoKeHoach || [], giaoDich: gd, now: D.now }) : null), [kho, gd, kyInfo, D.khoKeHoach, D.now]);
  const nl = useMemo(() => (kho && gd ? chuoiKho(kyInfo, { kho, loai: "nguyen_lieu", keHoach: D.khoKeHoach || [], giaoDich: gd, now: D.now }) : null), [kho, gd, kyInfo, D.khoKeHoach, D.now]);
  const pl = useMemo(() => (kho && gd ? chuoiPhanLoai(kyInfo, { kho, declarations: khaiBao || [], giaoDich: gd, now: D.now }) : null), [kho, gd, kyInfo, khaiBao, D.now]);
  const tuoi = useMemo(() => (kho && gd120 ? tuoiTon({ kho, khoTon: D.khoTon || [], giaoDich: gd120, now: D.now }) : null), [kho, gd120, D.khoTon, D.now]);
  const top = useMemo(() => (tuoi ? hangCanXuLy({ tuoi, declarations: khaiBao || [], homNay: kyInfo.homNay }) : []), [tuoi, khaiBao, kyInfo.homNay]);
  if (!kho) return <ChuaCo>Phần kho bãi chưa sẵn sàng.</ChuaCo>;
  if (!th) return <ChuaCo>Đang tải số liệu kho…</ChuaCo>;
  return (
    <div className="grid gap-2.5">
      <div className="grid gap-2.5 lg:grid-cols-2">
        <KhungKho ten="Kho thành phẩm" c={th} kyInfo={kyInfo} onMo={() => go("kho/thanh-pham")} />
        <KhungKho ten="Kho nguyên liệu" c={nl} kyInfo={kyInfo} onMo={() => go("kho/nguyen-lieu")} />
      </div>
      <div className="grid gap-2.5 lg:grid-cols-3">
        {khaiBao === null ? <Khung ten="Cơ cấu tồn kho"><ChuaCo>Chưa có bảng phân loại tồn (chạy sql/07).</ChuaCo></Khung>
          : <KhungCoCau p={pl} kyInfo={kyInfo} onMo={() => go("kho/thanh-pham")} />}
        {tuoi ? <KhungTuoi tuoi={tuoi} onMo={() => go("kho/thanh-pham")} /> : <Khung ten="Tuổi tồn"><ChuaCo>Đang tải…</ChuaCo></Khung>}
        <KhungTop ds={top} onMo={() => go("kho/thanh-pham")} />
      </div>
    </div>
  );
}
