import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/store";
import EChart from "@/components/EChart";
import { Khung } from "../tongquan/khungBD";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { so, r2, plain, tenThang } from "@/lib/format";
import { khoaDiem } from "@/lib/bieuDoSanLuong";
import { luyKe } from "@/lib/keHoachNgay";
import { khoaKy } from "@/lib/ky";
import { useKho } from "../kho/useKho";
import { useNhomHang } from "./useNhomHang";

// Biểu đồ "Kế hoạch xuất hàng · HRC" ở Kế hoạch tổng hợp (anh Sỹ 17/11/2026, sửa lại 21/11/2026): CHỈ loại hàng HRC, MỘT trục khối lượng (t), theo NGÀY và chỉ các ngày của MỘT THÁNG (mỗi điểm một ngày, lũy kế tính từ đầu tháng).
// Kỳ của trang là Tháng thì xem đúng tháng đó; là Quý / Năm thì có ◀ ▶ chọn từng tháng trong kỳ (mặc định tháng hiện tại). kyDay / cDay truyền vào là chuỗi theo ngày của CẢ kỳ, ở đây cắt lấy một tháng.
//   • Lũy kế xuất KẾ HOẠCH (tím, nét đứt): kế hoạch ngày theo tàu, tháng chưa đặt thì mục tiêu chia đều;
//   • Lũy kế xuất THỰC TẾ (xanh trời): sản lượng xuất thực tế đã nhập, chỉ tới hôm nay;
//   • TỒN KHO HRC (hổ phách, nét liền): tồn thực tế tới hôm nay, tính ngược từ tồn hiện tại theo sổ nhập – xuất kho (điều chuyển nội bộ không đổi tồn);
//   • TỒN DỰ BÁO (nét đứt, từ hôm nay): tồn hôm nay + sản xuất kế hoạch − xuất kế hoạch của các ngày còn lại. Chưa có kế hoạch nhập kho nên dùng TỔNG KHỐI LƯỢNG SẢN XUẤT HRC trong Kế hoạch sản xuất của kỳ (Kế hoạch tổng hợp › Đặt mục tiêu),
//     chia đều theo ngày. Đường dự báo tô XANH LÁ khi tồn CAO HƠN mức tồn hôm nay (sản xuất đang lớn hơn xuất kế hoạch, tồn tăng) và ĐỎ khi THẤP HƠN (xuất kế hoạch lớn hơn sản xuất, tồn giảm); đường chấm ngang là mức tồn hôm nay.
// Tồn kho cần quyền Khai thác kho bãi; không có thì chỉ vẽ hai đường lũy kế xuất.
const MAU = { kh: "#a855f7", tt: "#38bdf8", ton: "#f59e0b", cao: "#22c55e", thap: "#f43f5e" };
const nghin = (v) => (Math.abs(v) >= 1000 ? `${r2(v / 1000)}k` : v);

export default function KeHoachXuatHang({ kyInfo: kyDay, homNay, c: cDay, nhom, cao }) {
  const { api, D } = useApp();
  const macDinh = kyDay.thangs.includes(homNay.slice(0, 7)) ? homNay.slice(0, 7) : kyDay.thangs[0];
  const [thangChon, setThangChon] = useState(macDinh);
  const thang = kyDay.thangs.includes(thangChon) ? thangChon : macDinh; // đổi kỳ thì về tháng mặc định
  // Cắt một tháng: các ngày, điểm của tháng và lũy kế thực tế tính lại từ đầu tháng
  const kyInfo = useMemo(() => ({ ...kyDay, ky: "thang", thangs: [thang], ngays: kyDay.ngays.filter((d) => d.slice(0, 7) === thang), nhan: tenThang(thang) }), [kyDay, thang]);
  const c = useMemo(() => {
    const idx = kyDay.ngays.map((d, i) => (d.slice(0, 7) === thang ? i : -1)).filter((i) => i >= 0);
    let lk = 0;
    const diemT = idx.map((i) => { const o = cDay.diem[i]; if (o.dau <= homNay) lk += +o.tt || 0; return { ...o, lkTt: o.dau <= homNay ? lk : null }; });
    return { ...cDay, diem: diemT, khD: idx.map((i) => cDay.khD[i]) };
  }, [kyDay, cDay, thang, homNay]);
  const kho = useKho(), nhomHang = useNhomHang();
  const [gd, setGd] = useState(null); // sổ kho từ đầu kỳ tới hôm nay
  const [sx, setSx] = useState(undefined); // tổng kế hoạch sản xuất HRC của kỳ (t); undefined: đang tải · null: chưa chạy SQL 22
  const dau = kyInfo.ngays[0];
  // Tải sổ từ đầu tháng tới MỌI NGÀY (kể cả lượt ghi ngày sau hôm nay): bảng tồn của hệ thống (kho_ton) cộng cả các lượt đó, nên muốn có tồn đúng theo sổ tới từng ngày phải biết chúng.
  // Tải lại khi tồn của store đổi (vừa lưu nhập / xuất / tồn đầu) để hai nguồn không lệch nhau.
  useEffect(() => {
    let huy = false; setGd(null);
    api.loadGiaoDichKhoang(dau, "9999-12-31").then((r) => { if (!huy) setGd(r || []); }).catch(() => { if (!huy) setGd([]); });
    return () => { huy = true; };
  }, [api, dau, D.khoTon]);
  // Kế hoạch sản xuất HRC của THÁNG đang xem; tháng chưa lập thì lấy kế hoạch quý ÷ 3, rồi kế hoạch năm ÷ 12
  const lamHRC = (hang) => plain(nhomHang(hang, "")) === plain(nhom);
  useEffect(() => {
    let huy = false; setSx(undefined);
    const tong = (r) => (r?.th || []).filter((x) => x.loai === "san_xuat" && lamHRC(x.hang)).reduce((s, x) => s + (+x.tong || 0), 0);
    (async () => {
      const r = await api.docKeHoachTH?.(thang), t0 = new Date(dau + "T00:00:00").getTime();
      if (r == null) return null;
      let t = tong(r);
      if (!(t > 0)) t = tong(await api.docKeHoachTH(khoaKy("quy", t0))) / 3;
      if (!(t > 0)) t = tong(await api.docKeHoachTH(khoaKy("nam", t0))) / 12;
      return t;
    })().then((t) => { if (!huy) setSx(t); }).catch(() => { if (!huy) setSx(null); });
    return () => { huy = true; };
  }, [api, thang, nhom, D.hanghoa]); // eslint-disable-line react-hooks/exhaustive-deps

  const lamNhom = (hang) => lamHRC(hang);
  // Số ngày của từng điểm trên biểu đồ và số ngày còn lại (sau hôm nay)
  const diem = useMemo(() => {
    const idx = new Map(), ds = [];
    for (const d of kyInfo.ngays) { const k = khoaDiem(kyInfo.buoc, d); if (!idx.has(k)) { idx.set(k, ds.length); ds.push({ dau: d, cuoi: d, ngay: 0, tuongLai: 0 }); } const o = ds[idx.get(k)]; o.cuoi = d; o.ngay++; if (d > homNay) o.tuongLai++; }
    return ds;
  }, [kyInfo, homNay]);
  // Tồn HRC theo bảng tồn của hệ thống: cộng MỌI lượt sổ, kể cả lượt ghi ngày SAU hôm nay
  const tonView = useMemo(() => (kho ? r2(kho.cap.filter((x) => lamNhom(x.hang)).reduce((s, x) => s + x.ton, 0)) : null), [kho, nhom, D.hanghoa]); // eslint-disable-line react-hooks/exhaustive-deps
  const dl = (g) => (g.loai === "xuat" ? -(+g.so_luong || 0) : g.loai === "dieu_chuyen" ? 0 : +g.so_luong || 0); // điều chuyển nội bộ cùng hàng: tổng không đổi
  // Tổng thay đổi của các lượt sổ HRC ghi ngày SAU hôm nay (nhập tương lai +, xuất tương lai −)
  const tuongLai = useMemo(() => (gd ? r2(gd.filter((g) => lamNhom(g.hang) && String(g.ngay).slice(0, 10) > homNay).reduce((s, g) => s + dl(g), 0)) : null), [gd, homNay, nhom, D.hanghoa]); // eslint-disable-line react-hooks/exhaustive-deps
  // Tồn thực tế HÔM NAY theo sổ = tồn hệ thống − các lượt ghi ngày tương lai (lỗi cũ: lấy nguyên tồn hệ thống nên mọi điểm trước đó lệch đúng bằng số này)
  const tonNay = tonView == null || tuongLai == null ? null : r2(tonView - tuongLai);
  // Tồn thực tế cuối mỗi điểm = tồn hôm nay − tổng thay đổi của các lượt sổ SAU ngày cuối điểm (tới hôm nay); chỉ cho các điểm đã qua hết
  // (đi lùi một lượt từ hôm nay: tồn cuối ngày d = tồn hôm nay − tổng thay đổi các ngày SAU d tới hôm nay)
  const ton = useMemo(() => {
    if (tonNay == null || !gd) return null;
    const delta = new Map();
    for (const g of gd) if (lamNhom(g.hang)) { const n = String(g.ngay).slice(0, 10); if (n <= homNay) delta.set(n, (delta.get(n) || 0) + dl(g)); }
    const ds = kyInfo.ngays.filter((d) => d <= homNay), cuoiNgay = new Map();
    let cur = tonNay;
    if (ds.length) { const last = ds[ds.length - 1]; for (const [n, v] of delta) if (n > last) cur -= v; } // kỳ đã qua: trừ các ngày sau kỳ tới hôm nay
    for (let i = ds.length - 1; i >= 0; i--) { cuoiNgay.set(ds[i], r2(cur)); cur -= delta.get(ds[i]) || 0; }
    return diem.map((o) => (o.cuoi > homNay ? null : cuoiNgay.get(o.cuoi) ?? null));
  }, [tonNay, gd, diem, kyInfo, homNay, nhom, D.hanghoa]); // eslint-disable-line react-hooks/exhaustive-deps

  const lkKH = luyKe(c.khD).map(r2), lkTT = c.diem.map((o) => (o.lkTt == null ? null : r2(o.lkTt)));
  // Tồn dự báo từ hôm nay: tồn hôm nay + (sản xuất kế hoạch − xuất kế hoạch) của các ngày còn lại; điểm chứa hôm nay chỉ tính phần ngày còn lại
  const dbao = useMemo(() => {
    if (ton == null || tonNay == null || !diem.some((o) => o.tuongLai > 0)) return null;
    const moiNgay = (sx || 0) / kyInfo.ngays.length, out = new Array(diem.length).fill(null);
    let tr = tonNay, sxCon = 0, xuCon = 0;
    const p0 = diem.findIndex((o) => o.tuongLai > 0); // điểm đầu tiên còn ngày sau hôm nay
    for (let p = p0; p < diem.length; p++) {
      const o = diem[p], s = moiNgay * o.tuongLai, x = (c.khD[p] || 0) * (o.tuongLai / o.ngay);
      tr = tr + s - x; sxCon += s; xuCon += x; out[p] = r2(tr);
    }
    if (p0 > 0 && ton[p0 - 1] != null) out[p0 - 1] = ton[p0 - 1]; // nối liền với đường thực tế
    const het = out.findIndex((v) => v != null && v < 0);
    return { out, sxCon: r2(sxCon), xuCon: r2(xuCon), cuoi: out[out.length - 1], het: het >= 0 ? c.diem[het].nhan : null };
  }, [ton, tonNay, diem, c, sx, kyInfo, homNay]);

  const duong = (name, data, color, o = {}) => ({ name, type: "line", showSymbol: false, data, itemStyle: { color }, lineStyle: { width: o.net ? 1.8 : 2.4, type: o.net ? "dashed" : "solid", color }, ...o.them });
  const series = [
    duong("Lũy kế xuất · kế hoạch", lkKH, MAU.kh, { net: true }),
    duong("Lũy kế xuất · thực tế", lkTT, MAU.tt),
    ...(ton ? [duong("Tồn kho HRC · thực tế", ton, MAU.ton, { them: { areaStyle: { color: MAU.ton, opacity: 0.07 } } })] : []),
    ...(dbao ? [duong("Tồn kho HRC · dự báo", dbao.out, MAU.cao, { net: true, them: { markLine: { symbol: "none", silent: true, animation: false,
      data: [{ yAxis: tonNay, name: "Tồn hôm nay", lineStyle: { color: "#94a3b8", type: "dotted", width: 1 }, label: { formatter: "tồn hôm nay", position: "insideEndTop", fontSize: 10, color: "#94a3b8" } }] } } })] : []),
  ];
  const option = {
    grid: { left: 4, right: 14, top: 44, bottom: 0, containLabel: true }, legend: { itemWidth: 14, itemHeight: 6, textStyle: { fontSize: 10 } },
    tooltip: { trigger: "axis", valueFormatter: (v) => (v == null ? "—" : `${so(v)} t`) },
    xAxis: { type: "category", data: c.diem.map((o) => o.nhan), axisLabel: { fontSize: 10, hideOverlap: true } },
    yAxis: { type: "value", name: "Khối lượng (t)", nameTextStyle: { fontSize: 10, align: "left" }, axisLabel: { fontSize: 10, formatter: nghin } },
    ...(dbao ? { visualMap: { show: false, type: "piecewise", seriesIndex: series.length - 1, dimension: 1, pieces: [{ lt: tonNay, color: MAU.thap }, { gte: tonNay, color: MAU.cao }], outOfRange: { color: "#94a3b8" } } } : {}),
    series,
  };
  const cuoiTT = lkTT.filter((v) => v != null).slice(-1)[0] ?? 0, cuoiKH = lkKH[lkKH.length - 1] || 0;
  return (
    <Khung cao={cao} className="xl:col-span-2" ten="Kế hoạch xuất hàng · HRC" phu={`${kyInfo.nhan} · theo ngày · tồn kho HRC thực tế và dự báo`}
      bo={kyDay.thangs.length > 1 ? (
        <div className="flex items-center gap-1">
          <Button size="icon" variant="outline" className="h-6 w-6" disabled={kyDay.thangs.indexOf(thang) <= 0} onClick={() => setThangChon(kyDay.thangs[kyDay.thangs.indexOf(thang) - 1])} aria-label="Tháng trước"><ChevronLeft /></Button>
          <NativeSelect className="h-6 w-32 text-[0.6875rem]" value={thang} onChange={(e) => setThangChon(e.target.value)} options={kyDay.thangs.map((t) => [t, tenThang(t)])} aria-label="Tháng của biểu đồ" />
          <Button size="icon" variant="outline" className="h-6 w-6" disabled={kyDay.thangs.indexOf(thang) >= kyDay.thangs.length - 1} onClick={() => setThangChon(kyDay.thangs[kyDay.thangs.indexOf(thang) + 1])} aria-label="Tháng sau"><ChevronRight /></Button>
        </div>) : null}>
      <EChart height={cao - 112} option={option} />
      <div className="mt-1 grid gap-0.5 text-[0.6875rem] text-muted-foreground">
        <span>Xuất thực tế <b className="text-foreground">{so(cuoiTT, 0)} t</b> / kế hoạch cả tháng <b className="text-foreground">{so(cuoiKH, 0)} t</b> · KH: {c.nguon}</span>
        {!kho ? <span>Tồn kho: cần quyền Khai thác kho bãi để xem.</span> : tonNay == null || gd == null ? <span>Đang tải sổ kho…</span> : dbao ? (
          <span>Tồn HRC hôm nay <b className="text-foreground">{so(tonNay, 0)} t</b> → dự báo cuối tháng <b className={dbao.cuoi >= tonNay ? "text-ok" : "text-bad"}>{so(dbao.cuoi, 0)} t</b> ({dbao.cuoi >= tonNay ? "tăng" : "giảm"} {so(Math.abs(dbao.cuoi - tonNay), 0)} t) = tồn hôm nay + sản xuất kế hoạch còn lại <b className="text-foreground">{so(dbao.sxCon, 0)} t</b> − xuất kế hoạch còn lại <b className="text-foreground">{so(dbao.xuCon, 0)} t</b>
            {dbao.het ? <b className="text-bad"> · dự kiến hết hàng từ {dbao.het}</b> : ""}. Đường dự báo <b className="text-ok">xanh</b> = cao hơn tồn hôm nay (sản xuất lớn hơn xuất kế hoạch), <b className="text-bad">đỏ</b> = thấp hơn.</span>
        ) : <span>Tồn kho HRC hôm nay: <b className="text-foreground">{so(tonNay, 0)} t</b>{kyInfo.ngays.every((d) => d <= homNay) ? " (tháng đã qua, không dự báo)" : ""}.</span>}
        {kho && tuongLai != null && Math.abs(tuongLai) > 0.5 && <span className="text-warn">Sổ kho có lượt HRC ghi ngày SAU hôm nay (tổng {tuongLai > 0 ? "+" : "−"}{so(Math.abs(tuongLai), 0)} t): biểu đồ chỉ tính tới hôm nay, còn tồn ở các trang kho khác đã cộng cả số này (tồn hệ thống {so(tonView, 0)} t). Kiểm tra ngày của các lượt đó ở Lịch sử sổ kho (dễ nhầm ngày / tháng khi dán nhanh).</span>}
        {dbao && sx !== undefined && !(sx > 0) && <span className="text-warn">{sx === null ? "Chưa có bảng Kế hoạch sản xuất (SQL 22)" : "Chưa có Kế hoạch sản xuất HRC của tháng này"}: dự báo mới chỉ trừ kế hoạch xuất. Lập ở Đặt mục tiêu › Kế hoạch sản xuất.</span>}
        {dbao && sx > 0 && <span>Sản xuất HRC kế hoạch của tháng <b className="text-foreground">{so(sx, 0)} t</b>, chia đều theo ngày.</span>}
      </div>
    </Khung>
  );
}
