import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { useApp } from "@/store";
import { useThietBi } from "@/thietbi/Host";
import EChart from "@/components/EChart";
import { so, pct, thangCua, tenThang, congThang, DAY } from "@/lib/format";
import { trangThai, chiSo, TRANG_THAI } from "@/lib/linetime";
import { tinhThang } from "@/lib/sanLuong";
import { tonTheoNgay, NGUONG_KHO } from "@/lib/kho";
import { ngayCuaThang } from "@/lib/sanLuongTT";
import { cn } from "@/lib/utils";
import GanttMet from "../cang/GanttMet";
import { useNhomHang } from "../cang/useNhomHang";
import { useKho } from "../kho/useKho";
import { MAU } from "./khung";

// Tổng quan dạng bảng điều khiển: dải chỉ số trên cùng; hàng trên 3 khung (sản lượng cảng lũy kế, sản lượng theo ngày, thiết bị cơ giới);
// giữa là lịch cầu bến theo mét (Linetime) kẹp hai cột chỉ số tàu; hàng dưới 2 khung (kho bãi, vận tải). Ưu tiên biểu đồ đường.
// Mỗi khung có "Chi tiết" mở hộp chi tiết cũ (onMo(khóa)). Số sản lượng lấy từ bảng nhập thực tế theo ca / ngày (SQL 06).

const nghin = (x) => (x == null ? "—" : Math.abs(x) >= 1000 ? so(x / 1000, Math.abs(x) >= 1e5 ? 0 : 1) + "k" : so(x));
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

// Khung: tiêu đề nhỏ in hoa, nút Chi tiết
function Khung({ ten, phu, onChiTiet, className, children }) {
  return (
    <section className={cn("flex min-w-0 flex-col rounded-md border border-border/70 bg-card/70 p-2.5", className)}>
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-[10px] text-primary">◆</span>
        <h3 className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{ten}</h3>
        {phu && <span className="truncate text-[10px] text-muted-foreground/80">· {phu}</span>}
        {onChiTiet && <button type="button" onClick={onChiTiet} className="ml-auto inline-flex shrink-0 items-center text-[11px] text-primary hover:underline">Chi tiết<ChevronRight className="h-3 w-3" /></button>}
      </div>
      {children}
    </section>
  );
}
const SoLon = ({ v, sub, tone }) => (
  <div className="flex items-baseline gap-2">
    <span className={cn("font-mono text-2xl font-semibold tabular-nums", tone && `text-${tone}`)}>{v}</span>
    {sub && <span className="text-[11px] text-muted-foreground">{sub}</span>}
  </div>
);
const TheNho = ({ ten, v, sub, mau }) => (
  <div className="rounded-md border border-border/70 bg-card/70 px-2.5 py-2" style={mau ? { borderLeft: `3px solid ${mau}` } : undefined}>
    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{ten}</div>
    <div className="font-mono text-xl font-semibold tabular-nums">{v}</div>
    {sub && <div className="truncate text-[10px] text-muted-foreground">{sub}</div>}
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
  return { ngays, mt, th: cong, thuc, ke: ngays.map((_, i) => (mt ? Math.round((mt * (i + 1)) / n) : null)), theoNgay };
}

export default function BangDieuKhien({ onMo, go }) {
  const { D, quyen } = useApp();
  const tb = useThietBi()?.D;
  const kho = useKho();
  const nhomHang = useNhomHang();
  const thang = thangCua(D.now), homNay = ngayStr(D.now);
  const coCang = quyen.coCang, coTB = quyen.coThietBi, coKho = quyen.kho?.co || quyen.coCang;
  const slCang = useSanLuong("cang", thang), slVT = useSanLuong("van_tai", thang);
  const thangTruoc = congThang(thang, -1);
  const slCangT = useSanLuong("cang", thangTruoc), slVTT = useSanLuong("van_tai", thangTruoc); // cho biểu đồ 30 ngày gần nhất

  // ---------- Sản lượng ----------
  const lkCang = useMemo(() => luyKe(slCang, thang, homNay), [slCang, thang, homNay]);
  const lkVT = useMemo(() => luyKe(slVT, thang, homNay), [slVT, thang, homNay]);
  const klTau = useMemo(() => (coCang ? tinhThang(D, thang, nhomHang) : null), [coCang, D, thang, nhomHang]);
  const ngayQua = lkCang.ngays.filter((d) => d <= homNay);
  // Sản lượng theo ngày, 30 ngày gần nhất (gộp tháng này và tháng trước)
  const ngay30 = useMemo(() => Array.from({ length: 30 }, (_, i) => ngayStr(D.now - (29 - i) * DAY)), [D.now]);
  const daily = useMemo(() => {
    const m = { nhap: new Map(), xuat: new Map(), vt: new Map() };
    const cong = (mm, r) => { const d = String(r.ngay).slice(0, 10); mm.set(d, (mm.get(d) || 0) + (+r.tan || 0)); };
    for (const r of [...(slCangT?.thucTe || []), ...(slCang?.thucTe || [])]) if (m[r.huong]) cong(m[r.huong], r);
    for (const r of [...(slVTT?.thucTe || []), ...(slVT?.thucTe || [])]) cong(m.vt, r);
    return m;
  }, [slCang, slCangT, slVT, slVTT]);
  const homQua = ngayStr(D.now - DAY);

  // ---------- Tàu ----------
  const tau = useMemo(() => {
    const st = D.voyages.filter((v) => !v.huy).map((v) => ({ v, st: trangThai(v) }));
    const dem = (k) => st.filter((x) => x.st === k).length;
    const choNeo = st.filter((x) => x.st === "cho_neo").map((x) => chiSo(x.v, D.stopsOf(x.v.id), D.now).choNeo).filter((h) => h != null);
    const sapDen = st.filter((x) => x.st === "du_kien" && (() => { const t = new Date(x.v.etb || x.v.eta).getTime(); return t >= D.now && t <= D.now + 7 * DAY; })()).length;
    const benCo = new Set(st.filter((x) => ["cap_ben", "lam_hang", "xong_hang"].includes(x.st)).flatMap((x) => [x.v.ben_ma, x.v.ben_phu].filter(Boolean))).size;
    return { lam: dem("lam_hang"), cap: dem("cap_ben"), neo: dem("cho_neo"), xong: dem("xong_hang"), sapDen, benCo, choTB: choNeo.length ? choNeo.reduce((s, h) => s + h, 0) / choNeo.length : null };
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

  const datCang = lkCang.mt ? lkCang.th / lkCang.mt : null, keHomNay = lkCang.ke[ngayQua.length - 1];
  const datVT = lkVT.mt ? lkVT.th / lkVT.mt : null;
  const chuaSql = slCang === null;

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

      {/* Hàng trên */}
      <div className="grid gap-2.5 lg:grid-cols-3">
        {coCang && (
          <Khung ten="Sản lượng cảng" phu={`lũy kế ${tenThang(thang).toLowerCase()}`} onChiTiet={() => onMo("khoi-luong")}>
            <SoLon v={nghin(lkCang.th)} sub={lkCang.mt ? `/ ${so(lkCang.mt)} t · đạt ${pct(datCang)}${keHomNay ? ` · kế hoạch đến nay ${nghin(keHomNay)}` : ""}` : "chưa đặt mục tiêu tháng"} tone={datCang != null && keHomNay ? (lkCang.th >= keHomNay ? "ok" : "warn") : undefined} />
            {chuaSql ? <ChuaCo>Chưa có bảng sản lượng thực tế (chạy sql/06).</ChuaCo>
              : <EChart height={150} option={optDuong(lkCang.ngays.map(ddmm), [duong("Thực hiện", lkCang.thuc, MAU.primary, { vung: true }), duong("Kế hoạch", lkCang.ke, MAU.xam, { net: true, rong: 1.5 })])} />}
            {klTau && <div className="mt-1 text-[10px] text-muted-foreground">KL tàu cập trong tháng {so(klTau.klTau)} t ({klTau.ds.length} chuyến)</div>}
          </Khung>)}
        {coCang && (
          <Khung ten="Sản lượng theo ngày" phu="30 ngày · nhập · xuất · vận tải" onChiTiet={() => go("cang/muc-tieu")}>
            <SoLon v={nghin((daily.nhap.get(homQua) || 0) + (daily.xuat.get(homQua) || 0))} sub={`t cảng ngày ${ddmm(homQua)} · vận tải ${nghin(daily.vt.get(homQua) || 0)} · hôm nay ${nghin((daily.nhap.get(homNay) || 0) + (daily.xuat.get(homNay) || 0))}`} />
            {chuaSql ? <ChuaCo>Chưa có bảng sản lượng thực tế (chạy sql/06).</ChuaCo>
              : <EChart height={150} option={optDuong(ngay30.map(ddmm), [
                duong("Nhập", ngay30.map((d) => daily.nhap.get(d) ?? null), MAU.info),
                duong("Xuất", ngay30.map((d) => daily.xuat.get(d) ?? null), MAU.tim),
                duong("Vận tải", ngay30.map((d) => daily.vt.get(d) ?? null), MAU.ok, { net: true }),
              ])} />}
          </Khung>)}
        {coTB && (
          <Khung ten="Thiết bị cơ giới" phu="tỉ lệ sẵn sàng 30 ngày" onChiTiet={() => onMo("thiet-bi")}>
            {thietBi ? <>
              <SoLon v={pct(thietBi.s.rate, 1)} sub={`${thietBi.s.ready}/${thietBi.s.tong} xe · cẩu ${thietBi.sc.ready}/${thietBi.sc.tong} · hỏng ${thietBi.s.hong} · BDCL ${thietBi.s.bdcl}`} tone={thietBi.s.rate < (thietBi.nguong ?? 0.85) ? "warn" : "ok"} />
              <EChart height={150} option={optDuong(thietBi.x, [duong("Xe di động", thietBi.xe, MAU.ok, { vung: true }), ...(thietBi.cau ? [duong("Cẩu cảng", thietBi.cau, MAU.info)] : [])], { phanTram: true, nguong: thietBi.nguong })} />
            </> : <ChuaCo>Đang tải dữ liệu thiết bị…</ChuaCo>}
          </Khung>)}
      </div>

      {/* Giữa: Linetime theo mét */}
      {coCang && (
        <div className="grid gap-2.5 lg:grid-cols-[150px_minmax(0,1fr)_150px]">
          <div className="grid content-start gap-2.5 max-lg:grid-cols-2 sm:max-lg:grid-cols-4">
            <TheNho ten="Đang làm hàng" v={tau.lam} mau={TRANG_THAI.lam_hang.mau} sub={`${tau.xong} xong hàng chưa rời`} />
            <TheNho ten="Đã cập, chờ làm" v={tau.cap} mau={TRANG_THAI.cap_ben.mau} />
            <TheNho ten="Đã đến neo" v={tau.neo} mau={TRANG_THAI.cho_neo.mau} sub={tau.choTB != null ? `chờ bến TB ${so(tau.choTB, 0)} giờ` : null} />
            <TheNho ten="Sắp cập (7 ngày)" v={tau.sapDen} mau={TRANG_THAI.du_kien.mau} />
          </div>
          <Khung ten="Linetime tàu cập bến theo mét" phu="hôm kia → 8 ngày tới · toàn thời gian" onChiTiet={() => go("cang/linetime")}>
            <div ref={khungLich} className="min-w-0">
              <GanttMet voyages={tauLich} tu={tuLich} soNgay={soNgay} pxNgay={pxNgay} che="toan" gon maxH="520px" />
            </div>
          </Khung>
          <div className="grid content-start gap-2.5 max-lg:grid-cols-2 sm:max-lg:grid-cols-4">
            <TheNho ten="Bến có tàu" v={`${tau.benCo}/${D.berths.length}`} sub="đang cập / làm hàng" />
            <TheNho ten="KL tàu tháng" v={nghin(klTau?.klTau)} sub={klTau ? `${klTau.ds.length} chuyến` : null} />
            <TheNho ten="Cảnh báo tàu" v={D.alerts.length} mau={D.alerts.some((a) => a.muc === "bad") ? MAU.bad : MAU.warn} sub={`${D.alerts.filter((a) => a.muc === "bad").length} khẩn`} />
            <button type="button" onClick={() => onMo("tau")} className="rounded-md border border-dashed border-border/70 px-2.5 py-2 text-left text-[11px] text-primary hover:bg-accent">Bảng tàu đang ở cảng ›</button>
          </div>
        </div>)}

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
        {coCang && (
          <Khung ten="Sản lượng vận tải" phu={`lũy kế ${tenThang(thang).toLowerCase()}`} onChiTiet={() => go("cang/muc-tieu")}>
            <SoLon v={nghin(lkVT.th)} sub={lkVT.mt ? `/ ${so(lkVT.mt)} t · đạt ${pct(datVT)}` : "chưa đặt mục tiêu vận tải"} />
            {slVT === null ? <ChuaCo>Chưa có bảng sản lượng thực tế (chạy sql/06).</ChuaCo>
              : <EChart height={160} option={optDuong(lkVT.ngays.map(ddmm), [
                duong("Phục vụ cảng", luyKe(slVT, thang, homNay, (r) => r.huong === "phuc_vu_cang").thuc, MAU.info),
                duong("Phục vụ sản xuất", luyKe(slVT, thang, homNay, (r) => r.huong === "phuc_vu_san_xuat").thuc, MAU.warn),
                duong("Tổng", lkVT.thuc, MAU.ok, { vung: true }),
                duong("Kế hoạch", lkVT.ke, MAU.xam, { net: true, rong: 1.5 }),
              ])} />}
          </Khung>)}
      </div>
    </div>
  );
}
