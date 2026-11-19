import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CalendarRange, RefreshCw } from "lucide-react";
import { useApp } from "@/store";
import { Button } from "@/components/ui/button";
import EChart from "@/components/EChart";
import { useThietBi } from "@/thietbi/Host";
import { Khung, ChuaCo } from "../tongquan/khungBD";
import { useKho } from "../kho/useKho";
import { so, pct, r2, plain, thangCua, tenThang } from "@/lib/format";
import { tongHopXuatBan, KHONG_LOAI_XE } from "@/lib/keHoachXuatBan";
import { HopDaiHan, HopNgay, ChonThang } from "./HopKeHoach";

// Kế hoạch tổng hợp (anh Sỹ 19/11/2026): ba bản kế hoạch chính xuất bán → sản xuất → nhập mua; từ đó ra kế hoạch xuất / nhập / tồn kho và kế hoạch vận tải, nối logic với nhau.
// Trang gồm biểu đồ thống kê và dự báo + hai nút: Kế hoạch dài hạn (xuất bán · sản xuất · nhập mua) và Kế hoạch ngày (đường bộ · đường biển).
// Bước đầu: tab Kế hoạch xuất bán (bảng, hộp Xuất kho, hộp Phân xe) và ba biểu đồ lấy từ kế hoạch xuất bán; các phần còn lại thiết kế sau.
const CAO = 330;
const MAU = { bo: "#6366f1", bien: "#38bdf8", hp: "#14b8a6", tn: "#f59e0b", ton: "#94a3b8", xuat: "#a855f7", thieu: "#f43f5e" };

function The({ ten, gt, phu, tone }) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2.5">
      <div className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">{ten}</div>
      <div className={`mt-0.5 text-xl font-semibold tabular-nums ${tone || ""}`}>{gt}</div>
      {phu && <div className="text-[0.6875rem] text-muted-foreground">{phu}</div>}
    </div>
  );
}

export default function KeHoachTongHop() {
  const { D, api, quyen } = useApp();
  const tb = useThietBi()?.D;
  const kho = useKho();
  const homNay = thangCua(D.now);
  const [thang, setThang] = useState(homNay);
  const [data, setData] = useState(undefined); // undefined: đang tải · null: chưa chạy SQL 22
  const [lan, setLan] = useState(0);
  const [mo, setMo] = useState(null); // "dai" | "ngay"
  const sua = !!(quyen.nhap || quyen.keHoachNgay || quyen.kho?.nhap);
  useEffect(() => {
    let huy = false;
    api.docKhXuatBan(thang).then((r) => { if (!huy) setData(r); }).catch(() => { if (!huy) setData(null); });
    return () => { huy = true; };
  }, [api, thang, lan]);
  const taiLai = () => setLan((n) => n + 1);

  // Danh sách hàng để thêm (thành phẩm trước) và loại xe gợi ý
  const dsHang = useMemo(() => [...(tb?.hanghoa || [])].sort((a, b) => (a.loai_hh === "roi") - (b.loai_hh === "roi") || String(a.loai_hang).localeCompare(String(b.loai_hang), "vi")).map((h) => h.loai_hang), [tb]);
  const loaiXe = useMemo(() => [...new Set(["Xe ben", "Xe đầu kéo", "Xe bồn", ...(tb?.vehicles || []).map((x) => x.doi).filter((d) => d && d !== "Cẩu"), ...(data?.xe || []).map((x) => x.loai_xe).filter(Boolean)])].sort((a, b) => a.localeCompare(b, "vi")), [tb, data]);

  // ---- Số liệu cho thẻ và biểu đồ ----
  const ds = useMemo(() => [...tongHopXuatBan(data?.xe).values()].sort((a, b) => b.tong - a.tong), [data]);
  const cong = ds.reduce((s, x) => ({ bo: s.bo + x.bo, bien: s.bien + x.bien, tong: s.tong + x.tong, hp: s.hp + x.hp, tn: s.tn + x.tn }), { bo: 0, bien: 0, tong: 0, hp: 0, tn: 0 });
  const daPhanBo = (data?.kho || []).reduce((s, x) => s + (+x.tan || 0), 0);
  const tonHang = useMemo(() => { const m = new Map(); for (const c of kho?.cap || []) m.set(plain(c.hang), (m.get(plain(c.hang)) || 0) + c.ton); return m; }, [kho]);
  const theoXe = useMemo(() => {
    const m = new Map();
    for (const r of data?.xe || []) { const k = r.loai_xe || KHONG_LOAI_XE, o = m.get(k) || { loai: k, hp: 0, tn: 0 }; o[r.don_vi === "hoa_phat" ? "hp" : "tn"] += +r.tan || 0; m.set(k, o); }
    return [...m.values()].sort((a, b) => b.hp + b.tn - (a.hp + a.tn));
  }, [data]);
  const truc = { axisLabel: { fontSize: 10 } };
  const nghin = (v) => (Math.abs(v) >= 1000 ? `${r2(v / 1000)}k` : v);
  const tip = { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (v) => (v == null ? "—" : `${so(v, 0)} t`) };
  const grid = { left: 4, right: 14, top: 34, bottom: 0, containLabel: true };
  const thieu = ds.filter((x) => x.tong > (tonHang.get(plain(x.hang)) || 0));

  const opHang = { tooltip: tip, legend: { itemWidth: 12, itemHeight: 6, textStyle: { fontSize: 10 } }, grid,
    xAxis: { type: "value", ...truc, axisLabel: { fontSize: 10, formatter: nghin } }, yAxis: { type: "category", inverse: true, data: ds.map((x) => x.hang), axisLabel: { fontSize: 10, width: 120, overflow: "truncate" } },
    series: [{ name: "Đường bộ", type: "bar", stack: "t", barMaxWidth: 18, itemStyle: { color: MAU.bo }, data: ds.map((x) => x.bo) }, { name: "Đường biển", type: "bar", stack: "t", barMaxWidth: 18, itemStyle: { color: MAU.bien }, data: ds.map((x) => x.bien) }] };
  const opXe = { tooltip: tip, legend: { itemWidth: 12, itemHeight: 6, textStyle: { fontSize: 10 } }, grid,
    xAxis: { type: "category", data: theoXe.map((x) => x.loai), axisLabel: { fontSize: 10, interval: 0, width: 90, overflow: "truncate" } }, yAxis: { type: "value", ...truc, axisLabel: { fontSize: 10, formatter: nghin } },
    series: [{ name: "Hòa Phát", type: "bar", stack: "t", barMaxWidth: 36, itemStyle: { color: MAU.hp }, data: theoXe.map((x) => x.hp) }, { name: "Thuê ngoài", type: "bar", stack: "t", barMaxWidth: 36, itemStyle: { color: MAU.tn }, data: theoXe.map((x) => x.tn) }] };
  const opTon = { tooltip: tip, legend: { itemWidth: 12, itemHeight: 6, textStyle: { fontSize: 10 } }, grid,
    xAxis: { type: "category", data: ds.map((x) => x.hang), axisLabel: { fontSize: 10, interval: 0, width: 80, overflow: "truncate" } }, yAxis: { type: "value", ...truc, axisLabel: { fontSize: 10, formatter: nghin } },
    series: [{ name: "Tồn kho hiện tại", type: "bar", barMaxWidth: 26, itemStyle: { color: MAU.ton }, data: ds.map((x) => r2(tonHang.get(plain(x.hang)) || 0)) },
      { name: "Kế hoạch xuất bán", type: "bar", barMaxWidth: 26, itemStyle: { color: MAU.xuat }, data: ds.map((x) => r2(x.tong)) },
      { name: "Tồn dự báo sau xuất", type: "bar", barMaxWidth: 26, data: ds.map((x) => { const v = r2((tonHang.get(plain(x.hang)) || 0) - x.tong); return { value: v, itemStyle: { color: v < 0 ? MAU.thieu : MAU.hp } }; }) }] };

  const nut = (Icon, ten, id, mota) => <Button variant="outline" size="sm" onClick={() => setMo(id)} title={mota}><Icon />{ten}</Button>;
  const dangTai = <ChuaCo>Đang tải…</ChuaCo>;
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-1 text-lg font-semibold">Kế hoạch tổng hợp</h1>
        {nut(CalendarRange, "Kế hoạch dài hạn", "dai", "Kế hoạch xuất bán · sản xuất · nhập mua")}
        {nut(CalendarDays, "Kế hoạch ngày", "ngay", "Kế hoạch xuất / nhập theo ngày: đường bộ, đường biển")}
        {data === undefined && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
        <div className="ml-auto flex flex-wrap items-center gap-1.5"><ChonThang thang={thang} setThang={setThang} homNay={homNay} /></div>
      </div>

      {data === null && <div className="rounded-md border border-warn/40 bg-warn/5 px-3 py-2 text-sm">Chưa có bảng kế hoạch xuất bán: quản trị chạy <b>sql/22_ke_hoach_xuat_ban.sql</b> trong Supabase › SQL Editor rồi tải lại web.</div>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <The ten={`Xuất bán ${tenThang(thang)}`} gt={`${so(cong.tong, 0)} t`} phu={`${ds.length} mặt hàng`} />
        <The ten="Đường bộ" gt={`${so(cong.bo, 0)} t`} phu={cong.tong ? pct(cong.bo / cong.tong, 0) + " tổng" : ""} />
        <The ten="Đường biển" gt={`${so(cong.bien, 0)} t`} phu={cong.tong ? pct(cong.bien / cong.tong, 0) + " tổng" : ""} />
        <The ten="Hòa Phát tự vận chuyển" gt={cong.tong ? pct(cong.hp / cong.tong, 0) : "—"} phu={`Thuê ngoài ${so(cong.tn, 0)} t`} />
        <The ten="Đã phân bổ xuất kho" gt={cong.tong ? pct(Math.min(1, daPhanBo / cong.tong), 0) : "—"} phu={`${so(daPhanBo, 0)} / ${so(cong.tong, 0)} t`} tone={cong.tong && Math.abs(daPhanBo - cong.tong) < 0.5 ? "text-ok" : ""} />
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <Khung cao={CAO} ten="Kế hoạch xuất bán theo hàng" phu={`${tenThang(thang)} · đường bộ / đường biển`}>
          {data === undefined ? dangTai : ds.length ? <EChart height={CAO - 70} option={opHang} /> : <ChuaCo>Chưa có kế hoạch xuất bán. Bấm Kế hoạch dài hạn để lập.</ChuaCo>}
        </Khung>
        <Khung cao={CAO} ten="Phân xe: Hòa Phát / Thuê ngoài" phu={`${tenThang(thang)} · theo loại xe`}>
          {data === undefined ? dangTai : theoXe.length ? <EChart height={CAO - 70} option={opXe} /> : <ChuaCo>Chưa có số phân xe.</ChuaCo>}
        </Khung>
        <Khung cao={CAO} ten="Dự báo: tồn kho sau xuất bán" phu={`${tenThang(thang)} · tồn hiện tại − kế hoạch xuất`}>
          {data === undefined ? dangTai : !kho ? <ChuaCo>Cần quyền Khai thác kho bãi để xem tồn kho.</ChuaCo> : ds.length ? (
            <>
              <EChart height={CAO - 100} option={opTon} />
              <div className="mt-1 text-[0.6875rem] text-muted-foreground">{thieu.length ? <span className="text-bad">Thiếu hàng để xuất: {thieu.map((x) => x.hang).join(", ")}.</span> : "Tồn kho hiện tại đủ cho kế hoạch xuất bán của tháng."} Chưa tính nhập mua và sản xuất (thiết kế sau).</div>
            </>) : <ChuaCo>Chưa có kế hoạch xuất bán.</ChuaCo>}
        </Khung>
      </div>

      {mo === "dai" && <HopDaiHan onClose={() => setMo(null)} thang={thang} setThang={setThang} homNay={homNay} data={data} kho={kho} sua={sua} dsHang={dsHang} loaiXe={loaiXe} onLuu={taiLai} />}
      {mo === "ngay" && <HopNgay onClose={() => setMo(null)} />}
    </div>
  );
}
