import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/store";
import { useThietBi } from "@/thietbi/Host";
import EChart from "@/components/EChart";
import { so, pct, r2, soGon, thangCua, tenThang, DAY } from "@/lib/format";
import { trangThai, TRANG_THAI } from "@/lib/linetime";
import { tonTheoNgay, NGUONG_KHO } from "@/lib/kho";
import { ngayCuaThang } from "@/lib/sanLuongTT";
import { cn } from "@/lib/utils";
import GanttMet from "../cang/GanttMet";
import { useKho } from "../kho/useKho";
import { MAU } from "./khung";
import KhoiSanLuong from "./KhoiSanLuong";
import { Khung, Chon } from "./khungBD";
import KhoiKho from "./KhoiKho";
import { KY, khoangKy } from "@/lib/bieuDoSanLuong";

// Tổng quan dạng bảng điều khiển: dải chỉ số trên cùng; khối trên 5 biểu đồ sản lượng (KhoiSanLuong); giữa là lịch cầu bến theo mét (Linetime);
// khối dưới 5 biểu đồ kho (KhoiKho); cuối cùng lấp đầy kho bãi và thiết bị cơ giới. Mỗi khung có nút Phóng to và "Chi tiết" mở hộp dữ liệu của chính biểu đồ (không chuyển trang). Số sản lượng lấy từ bảng nhập thực tế theo ca / ngày (SQL 06).

const nghin = (x) => (x == null ? "—" : Math.abs(x) >= 1000 ? soGon(x / 1000) + "k" : soGon(x));
const ddmm = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const ngayStr = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

// Một đường trong biểu đồ
const duong = (ten, data, mau, { net = false, vung = false, rong = 2 } = {}) => ({
  name: ten, type: "line", smooth: true, showSymbol: data.filter((v) => v != null).length <= 2, connectNulls: false, data,
  lineStyle: { width: rong, color: mau, type: net ? "dashed" : "solid" }, itemStyle: { color: mau },
  ...(vung ? { areaStyle: { color: mau, opacity: 0.1 } } : {}),
});
const optDuong = (x, series, { phanTram = false, donVi = "t", nguong } = {}) => ({
  grid: { left: 4, right: 8, top: 24, bottom: 0, containLabel: true },
  legend: { top: 0, itemWidth: 14, itemHeight: 3, icon: "roundRect" },
  tooltip: { valueFormatter: (v) => (v == null ? "—" : phanTram ? pct(v, 1) : `${so(v)} ${donVi}`) },
  xAxis: { type: "category", data: x, boundaryGap: false, axisLabel: { fontSize: 10 } },
  yAxis: { type: "value", axisLabel: { fontSize: 10, formatter: (v) => (phanTram ? pct(v) : nghin(v)) }, ...(phanTram ? { min: (v) => Math.max(0, Math.floor(v.min * 10) / 10), max: (v) => Math.max(1, Math.ceil(v.max * 10) / 10) } : {}) },
  series: nguong != null ? [...series, { type: "line", data: [], markLine: { symbol: "none", silent: true, lineStyle: { color: MAU.warn, type: "dotted" }, label: { show: false }, data: [{ yAxis: nguong }] } }] : series,
});

const SoLon = ({ v, sub, tone }) => (
  <div className="flex items-baseline gap-2">
    <span className={cn("font-mono text-2xl font-semibold tabular-nums", tone && `text-${tone}`)}>{v}</span>
    {sub && <span className="text-[11px] text-muted-foreground">{sub}</span>}
  </div>
);
const ChuaCo = ({ children }) => <div className="flex flex-1 items-center justify-center py-6 text-center text-xs text-muted-foreground">{children}</div>;

// Mục tiêu + sản lượng thực tế (nhập theo ca / ngày) tháng này của một nhóm; null = chưa chạy SQL 06
function useSanLuong(nhom, thang) {
  const { api, D } = useApp();
  const [kq, setKq] = useState(undefined);
  useEffect(() => {
    let huy = false;
    api.docSanLuongThang(nhom, thang).then((r) => { if (!huy) setKq(r); }).catch(() => { if (!huy) setKq(null); });
    return () => { huy = true; };
  }, [api, nhom, thang, D]); // D đổi (có người sửa) thì tải lại
  return kq;
}

// Lũy kế thực tế so với kế hoạch (mục tiêu chia đều theo ngày) trong tháng
function luyKe(kq, thang, homNay, loc = () => true) {
  const ngays = ngayCuaThang(thang), n = ngays.length;
  const mt = (kq?.mucTieu || []).filter(loc).reduce((s, r) => s + (+r.tan || 0), 0);
  const theoNgay = new Map();
  for (const r of (kq?.thucTe || []).filter(loc)) { const d = String(r.ngay).slice(0, 10); theoNgay.set(d, (theoNgay.get(d) || 0) + (+r.tan || 0)); }
  let cong = 0;
  const thuc = ngays.map((d) => { cong += theoNgay.get(d) || 0; return d <= homNay ? cong : null; });
  return { ngays, mt, th: cong, thuc, ke: ngays.map((_, i) => (mt ? r2((mt * (i + 1)) / n) : null)), theoNgay };
}

export default function BangDieuKhien({ onMo }) {
  const { D, quyen } = useApp();
  const tb = useThietBi()?.D;
  const kho = useKho();
  const thang = thangCua(D.now), homNay = ngayStr(D.now);
  const coCang = quyen.coCang, coTB = quyen.coThietBi, coKho = quyen.kho?.co || quyen.coCang;
  const [ky, setKy] = useState("thang");
  const kyInfo = useMemo(() => khoangKy(ky, homNay), [ky, homNay]);
  const slCang = useSanLuong("cang", thang), slVT = useSanLuong("van_tai", thang);

  // ---------- Sản lượng (dải chỉ số) ----------
  const lkCang = useMemo(() => luyKe(slCang, thang, homNay), [slCang, thang, homNay]);
  const lkVT = useMemo(() => luyKe(slVT, thang, homNay), [slVT, thang, homNay]);

  // ---------- Tàu (dải chỉ số) ----------
  const tau = useMemo(() => {
    const dem = (k) => D.voyages.filter((v) => !v.huy && trangThai(v) === k).length;
    return { lam: dem("lam_hang"), neo: dem("cho_neo") };
  }, [D]);

  // ---------- Thiết bị ----------
  const thietBi = useMemo(() => {
    if (!tb) return null;
    const xe = tb.vehicles.filter((v) => v.doi !== "Cẩu"), cau = tb.vehicles.filter((v) => v.doi === "Cẩu");
    const s = tb.summarize(xe), sc = tb.summarize(cau);
    const tx = tb.readinessTrend(30, xe), tc = cau.length ? tb.readinessTrend(30, cau) : null;
    return { s, sc, x: tx.map((r) => ddmm(r.d)), xe: tx.map((r) => r.rate), cau: tc?.map((r) => r.rate) || null, nguong: tb.T?.ss };
  }, [tb]);

  // ---------- Kho ----------
  const khoTH = useMemo(() => {
    if (!kho) return null;
    const theoLoai = (loai) => {
      const dong = kho.dong.filter((d) => d.loai === loai), ten = new Set(dong.map((d) => d.ten_bai));
      const bai = kho.bai.filter((b) => ten.has(b.ten_bai));
      const ton = dong.reduce((s, d) => s + d.ton, 0), suc = bai.reduce((s, b) => s + (b.sucChua || 0), 0);
      const chuoi = tonTheoNgay(ton, D.giaoDich || [], (b) => ten.has(b), 30, D.now);
      return { ton, suc, chuoi, lap: suc > 0 ? ton / suc : null };
    };
    const tp = theoLoai("thanh_pham"), nl = theoLoai("nguyen_lieu");
    const tong = tp.ton + nl.ton, suc = tp.suc + nl.suc;
    return { tp, nl, x: (nl.chuoi.length ? nl.chuoi : tp.chuoi).map(([t]) => ddmm(ngayStr(t))), lap: suc > 0 ? tong / suc : null, tong, canh: kho.canh.length };
  }, [kho, D]);

  // ---------- Lịch cầu bến theo mét: đo bề rộng để vừa khung ----------
  const khungLich = useRef();
  const [rongLich, setRongLich] = useState(900);
  useLayoutEffect(() => {
    const el = khungLich.current; if (!el) return;
    setRongLich(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setRongLich(e.contentRect.width)); ro.observe(el);
    return () => ro.disconnect();
  }, [coCang]);
  const soNgay = rongLich < 640 ? 6 : 10;
  const tuLich = useMemo(() => { const d = new Date(D.now); d.setHours(0, 0, 0, 0); return d.getTime() - 2 * DAY; }, [D.now]);
  const pxNgay = Math.max(48, Math.floor((rongLich - 84) / soNgay));
  const tauLich = useMemo(() => D.voyages.filter((v) => !v.huy), [D.voyages]);

  const datCang = lkCang.mt ? lkCang.th / lkCang.mt : null;

  return (
    <div className="grid gap-2.5">
      {/* Dải chỉ số */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-md border border-border/70 bg-card/70 px-3 py-1.5 font-mono text-[11px] tabular-nums">
        {coCang && <span><span className="text-muted-foreground">LÀM HÀNG</span> <b style={{ color: TRANG_THAI.lam_hang.mau }}>{tau.lam}</b></span>}
        {coCang && <span><span className="text-muted-foreground">ĐẾN NEO</span> <b style={{ color: TRANG_THAI.cho_neo.mau }}>{tau.neo}</b></span>}
        {coCang && <span><span className="text-muted-foreground">SẢN LƯỢNG {tenThang(thang).replace("Tháng ", "T")}</span> <b>{nghin(lkCang.th)}</b>{lkCang.mt ? <span className="text-muted-foreground"> / {nghin(lkCang.mt)} ({pct(datCang)})</span> : null}</span>}
        {coTB && thietBi && <span><span className="text-muted-foreground">XE SẴN SÀNG</span> <b className={thietBi.s.rate < (thietBi.nguong ?? 0.85) ? "text-warn" : "text-ok"}>{pct(thietBi.s.rate, 1)}</b></span>}
        {coKho && khoTH && <span><span className="text-muted-foreground">LẤP ĐẦY KHO</span> <b className={khoTH.lap >= NGUONG_KHO.vang ? "text-warn" : ""}>{khoTH.lap != null ? pct(khoTH.lap) : "—"}</b></span>}
        {coCang && <span><span className="text-muted-foreground">VẬN TẢI</span> <b>{nghin(lkVT.th)}</b>{lkVT.mt ? <span className="text-muted-foreground"> / {nghin(lkVT.mt)}</span> : null}</span>}
      </div>

      {/* Kỳ xem dùng chung cho khối biểu đồ sản lượng (trên) và khối kho (dưới) */}
      <div className="flex flex-wrap items-center gap-2">
        <Chon gt={ky} dat={setKy} ds={KY} />
        <span className="text-[11px] text-muted-foreground">{kyInfo.nhan} · áp dụng cho các biểu đồ sản lượng và kho · mục tiêu / kế hoạch tháng chia đều theo ngày (quý / năm có mục tiêu riêng thì dùng số đó)</span>
      </div>

      {/* Khối trên: 5 biểu đồ sản lượng cảng / vận tải */}
      {coCang && <KhoiSanLuong kyInfo={kyInfo} />}

      {/* Giữa: Linetime theo mét */}
      {coCang && (
        <Khung ten="Linetime tàu cập bến theo mét" phu="hôm kia → 8 ngày tới · toàn thời gian" onChiTiet={() => onMo("tau")}>
          <div ref={khungLich} className="min-w-0">
            <GanttMet voyages={tauLich} tu={tuLich} soNgay={soNgay} pxNgay={pxNgay} che="toan" gon maxH="520px" />
          </div>
        </Khung>)}

      {/* Khối dưới: 5 biểu đồ kho (thành phẩm, nguyên liệu, tồn cần giải phóng / đầu cơ / lưu động) */}
      {coKho && <KhoiKho kyInfo={kyInfo} />}

      {/* Hàng dưới */}
      <div className="grid gap-2.5 lg:grid-cols-2">
        {coKho && (
          <Khung ten="Kho bãi" phu="lấp đầy 30 ngày" onChiTiet={() => onMo("kho")}>
            {khoTH ? <>
              <SoLon v={khoTH.lap != null ? pct(khoTH.lap) : "—"} sub={`tồn ${so(khoTH.tong)} t · thành phẩm ${khoTH.tp.lap != null ? pct(khoTH.tp.lap) : "—"} · nguyên liệu ${khoTH.nl.lap != null ? pct(khoTH.nl.lap) : "—"}${khoTH.canh ? ` · ${khoTH.canh} cảnh báo` : ""}`} tone={khoTH.lap >= NGUONG_KHO.do ? "bad" : khoTH.lap >= NGUONG_KHO.vang ? "warn" : undefined} />
              <EChart height={160} option={optDuong(khoTH.x, [
                duong("Thành phẩm", khoTH.tp.suc ? khoTH.tp.chuoi.map(([, v]) => v / khoTH.tp.suc) : khoTH.tp.chuoi.map(() => null), MAU.tim),
                duong("Nguyên liệu", khoTH.nl.suc ? khoTH.nl.chuoi.map(([, v]) => v / khoTH.nl.suc) : khoTH.nl.chuoi.map(() => null), MAU.primary, { vung: true }),
              ], { phanTram: true, nguong: NGUONG_KHO.vang })} />
            </> : <ChuaCo>Phần kho bãi chưa sẵn sàng.</ChuaCo>}
          </Khung>)}
        {coTB && (
          <Khung ten="Thiết bị cơ giới" phu="tỉ lệ sẵn sàng 30 ngày" onChiTiet={() => onMo("thiet-bi")}>
            {thietBi ? <>
              <SoLon v={pct(thietBi.s.rate, 1)} sub={`${thietBi.s.ready}/${thietBi.s.tong} xe · cẩu ${thietBi.sc.ready}/${thietBi.sc.tong} · hỏng ${thietBi.s.hong} · BDCL ${thietBi.s.bdcl}`} tone={thietBi.s.rate < (thietBi.nguong ?? 0.85) ? "warn" : "ok"} />
              <EChart height={160} option={optDuong(thietBi.x, [duong("Xe di động", thietBi.xe, MAU.ok, { vung: true }), ...(thietBi.cau ? [duong("Cẩu cảng", thietBi.cau, MAU.info)] : [])], { phanTram: true, nguong: thietBi.nguong })} />
            </> : <ChuaCo>Đang tải dữ liệu thiết bị…</ChuaCo>}
          </Khung>)}
      </div>
    </div>
  );
}
