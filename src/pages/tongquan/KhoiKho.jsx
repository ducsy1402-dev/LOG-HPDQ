import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/store";
import EChart from "@/components/EChart";
import { so, pct } from "@/lib/format";
import { chuoiKho, chuoiPhanLoai } from "@/lib/bieuDoKho";
import { useKho } from "../kho/useKho";
import { MAU } from "./khung";
import { Khung, ChuaCo, nghin } from "./KhoiSanLuong";

// Khối 5 biểu đồ kho phía dưới Linetime (Tổng quan), cùng kỳ (tuần / tháng / quý / năm) với khối sản lượng:
//  1. Kho thành phẩm và 2. Kho nguyên liệu: kế hoạch – lũy kế nhập / xuất, tồn (kế hoạch lấy từ Kho › Kế hoạch Xuất/Nhập tồn)
//  3. Tồn cần giải phóng  4. Tồn đầu cơ  5. Tồn lưu động: phân loại tồn khai báo ở Kho › Phân loại tồn (SQL 07); lưu động = tồn − hai loại kia.

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

// Giao dịch kho từ đầu kỳ đến hôm nay (sổ trong bộ nhớ chỉ giữ 35 ngày gần nhất)
function useGiaoDichKy(kyInfo) {
  const { api, D } = useApp();
  const [gd, setGd] = useState(null);
  const tu = kyInfo.ngays[0], den = kyInfo.homNay;
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

function KhungTon({ ten, phu, khoa, mau, p, onMo, canKhaiBao }) {
  const hien = p.hien, v = hien?.[khoa];
  const opt = {
    ...base, legend: { show: false }, grid: { left: 4, right: 8, top: 10, bottom: 0, containLabel: true },
    tooltip: { valueFormatter: (x) => (x == null ? "—" : `${so(x)} t`) },
    xAxis: { type: "category", data: p.diem.map((o) => o.nhan), axisLabel: { fontSize: 10, hideOverlap: true } }, yAxis: truc,
    series: [duong(ten, p.diem.map((o) => (o[khoa] == null ? null : Math.round(o[khoa]))), mau, { vung: true })],
  };
  return (
    <Khung ten={ten} phu={phu} onChiTiet={onMo}>
      <SoLon v={v == null ? "—" : nghin(v)} sub={hien && hien.tong > 0 ? `t · ${pct(v / hien.tong)} tổng tồn${p.sucChua ? ` · ${pct(v / p.sucChua)} sức chứa` : ""}` : "t"} />
      {canKhaiBao && !p.coKhaiBao ? <ChuaCo>Chưa khai báo. Vào Kho › Phân loại tồn để khai báo.</ChuaCo> : <EChart height={160} option={opt} />}
    </Khung>
  );
}

export default function KhoiKho({ kyInfo, go }) {
  const { D } = useApp();
  const kho = useKho();
  const gd = useGiaoDichKy(kyInfo);
  const khaiBao = useTonPhanLoai();
  const th = useMemo(() => (kho && gd ? chuoiKho(kyInfo, { kho, loai: "thanh_pham", keHoach: D.khoKeHoach || [], giaoDich: gd, now: D.now }) : null), [kho, gd, kyInfo, D.khoKeHoach, D.now]);
  const nl = useMemo(() => (kho && gd ? chuoiKho(kyInfo, { kho, loai: "nguyen_lieu", keHoach: D.khoKeHoach || [], giaoDich: gd, now: D.now }) : null), [kho, gd, kyInfo, D.khoKeHoach, D.now]);
  const pl = useMemo(() => (kho && gd ? chuoiPhanLoai(kyInfo, { kho, declarations: khaiBao || [], giaoDich: gd, now: D.now }) : null), [kho, gd, kyInfo, khaiBao, D.now]);
  if (!kho) return <ChuaCo>Phần kho bãi chưa sẵn sàng.</ChuaCo>;
  if (!th) return <ChuaCo>Đang tải số liệu kho…</ChuaCo>;
  const phu = `${kyInfo.nhan} · phân loại tồn`;
  return (
    <div className="grid gap-2.5">
      <div className="grid gap-2.5 lg:grid-cols-2">
        <KhungKho ten="Kho thành phẩm" c={th} kyInfo={kyInfo} onMo={() => go("kho/thanh-pham")} />
        <KhungKho ten="Kho nguyên liệu" c={nl} kyInfo={kyInfo} onMo={() => go("kho/nguyen-lieu")} />
      </div>
      {khaiBao === null ? <ChuaCo>Chưa có bảng phân loại tồn (chạy sql/07).</ChuaCo> : (
        <div className="grid gap-2.5 lg:grid-cols-3">
          <KhungTon ten="Tồn cần giải phóng" phu={phu} khoa="cgp" mau={MAU.bad} p={pl} canKhaiBao onMo={() => go("kho/thanh-pham")} />
          <KhungTon ten="Tồn đầu cơ" phu={phu} khoa="dc" mau={MAU.warn} p={pl} canKhaiBao onMo={() => go("kho/thanh-pham")} />
          <KhungTon ten="Tồn lưu động" phu={phu} khoa="ld" mau={MAU.ok} p={pl} onMo={() => go("kho/thanh-pham")} />
        </div>)}
    </div>
  );
}
