import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CalendarRange, RefreshCw } from "lucide-react";
import { useApp } from "@/store";
import { Button } from "@/components/ui/button";
import EChart from "@/components/EChart";
import { useThietBi } from "@/thietbi/Host";
import { Khung, ChuaCo } from "../tongquan/khungBD";
import { useKho } from "../kho/useKho";
import { so, pct, r2, plain } from "@/lib/format";
import { dongKeHoach, tongPhanXe, KHONG_LOAI_XE } from "@/lib/keHoachTH";
import { HopDaiHan, HopNgay } from "./HopKeHoach";
import { ChonKy, useKyKH } from "./ChonKy";

// Kế hoạch tổng hợp (anh Sỹ 19/11/2026): ba bản kế hoạch chính xuất bán → sản xuất → nhập mua; từ đó ra kế hoạch xuất / nhập / tồn kho và kế hoạch vận tải, nối logic với nhau.
// Trang gồm thẻ số + biểu đồ thống kê và dự báo của kỳ đang chọn (Tháng / Quý / Năm) + hai nút: Kế hoạch dài hạn (xuất bán · sản xuất · nhập mua) và Kế hoạch ngày (đường bộ · đường biển).
// Đã làm: ba tab của Kế hoạch dài hạn và các biểu đồ lấy từ đó; Kế hoạch ngày thiết kế sau.
const CAO = 330;
const MAU = { bo: "#6366f1", bien: "#38bdf8", hp: "#14b8a6", tn: "#f59e0b", ton: "#94a3b8", xuat: "#a855f7", sx: "#14b8a6", mua: "#38bdf8", thieu: "#f43f5e" };

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
  const k = useKyKH(D.now);
  const [data, setData] = useState(undefined); // undefined: đang tải · null: chưa chạy SQL 22
  const [lan, setLan] = useState(0);
  const [mo, setMo] = useState(null); // "dai" | "ngay"
  const sua = !!(quyen.nhap || quyen.keHoachNgay || quyen.kho?.nhap);
  useEffect(() => {
    let huy = false;
    api.docKeHoachTH(k.khoa).then((r) => { if (!huy) setData(r); }).catch(() => { if (!huy) setData(null); });
    return () => { huy = true; };
  }, [api, k.khoa, lan]);
  const taiLai = () => setLan((n) => n + 1);

  // Danh sách hàng để thêm (thành phẩm trước) và loại xe gợi ý
  const dsHang = useMemo(() => [...(tb?.hanghoa || [])].sort((a, b) => (a.loai_hh === "roi") - (b.loai_hh === "roi") || String(a.loai_hang).localeCompare(String(b.loai_hang), "vi")).map((h) => h.loai_hang), [tb]);
  const loaiXe = useMemo(() => [...new Set(["Xe ben", "Xe đầu kéo", "Xe bồn", ...(tb?.vehicles || []).map((x) => x.doi).filter((d) => d && d !== "Cẩu"), ...(data?.xe || []).map((x) => x.loai_xe).filter(Boolean)])].sort((a, b) => a.localeCompare(b, "vi")), [tb, data]);

  // ---- Số liệu cho thẻ và biểu đồ ----
  const xb = useMemo(() => dongKeHoach(data?.th, "xuat_ban"), [data]), sx = useMemo(() => dongKeHoach(data?.th, "san_xuat"), [data]), nm = useMemo(() => dongKeHoach(data?.th, "nhap_mua"), [data]);
  const tong = (ds, f = "tong") => ds.reduce((s, x) => s + x[f], 0);
  const cXB = tong(xb), cBo = tong(xb, "bo"), cBien = tong(xb, "bien"), cSX = tong(sx), cNM = tong(nm);
  const px = tongPhanXe(data?.xe, "xuat_ban");
  const daKho = (loai) => (data?.kho || []).filter((x) => x.loai === loai).reduce((s, x) => s + (+x.tan || 0), 0);
  const pbXuat = daKho("xuat_ban"), pbSX = daKho("san_xuat"), pbNM = daKho("nhap_mua");
  const tonHang = useMemo(() => { const m = new Map(); for (const c of kho?.cap || []) m.set(plain(c.hang), (m.get(plain(c.hang)) || 0) + c.ton); return m; }, [kho]);
  const theoXe = useMemo(() => {
    const m = new Map();
    for (const r of data?.xe || []) { if (r.loai !== "xuat_ban") continue; const x = r.loai_xe || KHONG_LOAI_XE, o = m.get(x) || { loai: x, hp: 0, tn: 0 }; o[r.don_vi === "hoa_phat" ? "hp" : "tn"] += +r.tan || 0; m.set(x, o); }
    return [...m.values()].sort((a, b) => b.hp + b.tn - (a.hp + a.tn));
  }, [data]);
  // Dự báo tồn cuối kỳ của từng hàng có trong kế hoạch: tồn hiện tại + sản xuất + nhập mua − xuất bán
  const dbao = useMemo(() => {
    const ten = new Map(), cong = (ds, f) => { for (const x of ds) { ten.set(plain(x.hang), x.hang); const o = f.get(plain(x.hang)) || 0; f.set(plain(x.hang), o + x.tong); } };
    const fSX = new Map(), fNM = new Map(), fXB = new Map(); cong(sx, fSX); cong(nm, fNM); cong(xb, fXB);
    return [...ten].map(([key, hang]) => { const ton = tonHang.get(key) || 0, s = fSX.get(key) || 0, n = fNM.get(key) || 0, x = fXB.get(key) || 0; return { hang, ton: r2(ton), sx: r2(s), nm: r2(n), xb: r2(x), cuoi: r2(ton + s + n - x) }; }).sort((a, b) => b.xb + b.sx + b.nm - (a.xb + a.sx + a.nm));
  }, [sx, nm, xb, tonHang]);
  const thieu = dbao.filter((x) => x.cuoi < 0);
  const truc = { axisLabel: { fontSize: 10 } };
  const nghin = (v) => (Math.abs(v) >= 1000 ? `${r2(v / 1000)}k` : v);
  const tip = { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (v) => (v == null ? "—" : `${so(v, 0)} t`) };
  const grid = { left: 4, right: 14, top: 34, bottom: 0, containLabel: true };
  const leg = { itemWidth: 12, itemHeight: 6, textStyle: { fontSize: 10 } };

  const opHang = { tooltip: tip, legend: leg, grid, xAxis: { type: "value", ...truc, axisLabel: { fontSize: 10, formatter: nghin } }, yAxis: { type: "category", inverse: true, data: xb.map((x) => x.hang), axisLabel: { fontSize: 10, width: 120, overflow: "truncate" } },
    series: [{ name: "Đường bộ", type: "bar", stack: "t", barMaxWidth: 18, itemStyle: { color: MAU.bo }, data: xb.map((x) => x.bo) }, { name: "Đường biển", type: "bar", stack: "t", barMaxWidth: 18, itemStyle: { color: MAU.bien }, data: xb.map((x) => x.bien) }] };
  const opXe = { tooltip: tip, legend: leg, grid, xAxis: { type: "category", data: theoXe.map((x) => x.loai), axisLabel: { fontSize: 10, interval: 0, width: 90, overflow: "truncate" } }, yAxis: { type: "value", ...truc, axisLabel: { fontSize: 10, formatter: nghin } },
    series: [{ name: "Hòa Phát", type: "bar", stack: "t", barMaxWidth: 36, itemStyle: { color: MAU.hp }, data: theoXe.map((x) => x.hp) }, { name: "Thuê ngoài", type: "bar", stack: "t", barMaxWidth: 36, itemStyle: { color: MAU.tn }, data: theoXe.map((x) => x.tn) }] };
  const opTon = { tooltip: tip, legend: leg, grid, xAxis: { type: "category", data: dbao.map((x) => x.hang), axisLabel: { fontSize: 10, interval: 0, width: 70, overflow: "truncate" } }, yAxis: { type: "value", ...truc, axisLabel: { fontSize: 10, formatter: nghin } },
    series: [{ name: "Tồn hiện tại", type: "bar", barMaxWidth: 16, itemStyle: { color: MAU.ton }, data: dbao.map((x) => x.ton) },
      { name: "Sản xuất (+)", type: "bar", barMaxWidth: 16, itemStyle: { color: MAU.sx }, data: dbao.map((x) => x.sx) },
      { name: "Nhập mua (+)", type: "bar", barMaxWidth: 16, itemStyle: { color: MAU.mua }, data: dbao.map((x) => x.nm) },
      { name: "Xuất bán (−)", type: "bar", barMaxWidth: 16, itemStyle: { color: MAU.xuat }, data: dbao.map((x) => x.xb) },
      { name: "Tồn dự báo cuối kỳ", type: "bar", barMaxWidth: 16, data: dbao.map((x) => ({ value: x.cuoi, itemStyle: { color: x.cuoi < 0 ? MAU.thieu : "#22c55e" } })) }] };

  const nut = (Icon, ten, id, mota) => <Button variant="outline" size="sm" onClick={() => setMo(id)} title={mota}><Icon />{ten}</Button>;
  const dangTai = <ChuaCo>Đang tải…</ChuaCo>;
  const pc = (a, b) => (b > 0 ? pct(Math.min(1, a / b), 0) : "—");
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-1 text-lg font-semibold">Kế hoạch tổng hợp</h1>
        {nut(CalendarRange, "Kế hoạch dài hạn", "dai", "Kế hoạch xuất bán · sản xuất · nhập mua")}
        {nut(CalendarDays, "Kế hoạch ngày", "ngay", "Kế hoạch xuất / nhập theo ngày: đường bộ, đường biển")}
        {data === undefined && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
        <ChonKy k={k} className="ml-auto" />
      </div>

      {data === null && <div className="rounded-md border border-warn/40 bg-warn/5 px-3 py-2 text-sm">Chưa có bảng kế hoạch tổng hợp: quản trị chạy <b>sql/22_ke_hoach_xuat_ban.sql</b> trong Supabase › SQL Editor rồi tải lại web.</div>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <The ten={`Xuất bán · ${k.nhan}`} gt={`${so(cXB, 0)} t`} phu={`bộ ${so(cBo, 0)} · biển ${so(cBien, 0)} · ${xb.length} hàng`} />
        <The ten="Sản xuất" gt={`${so(cSX, 0)} t`} phu={`${sx.length} hàng`} />
        <The ten="Nhập mua" gt={`${so(cNM, 0)} t`} phu={`bộ ${so(tong(nm, "bo"), 0)} · biển ${so(tong(nm, "bien"), 0)}`} />
        <The ten="Hòa Phát tự vận chuyển (xuất bán)" gt={px.hp + px.tn > 0 ? pct(px.hp / (px.hp + px.tn), 0) : "—"} phu={`đã phân xe ${so(px.hp + px.tn, 0)} / ${so(cXB, 0)} t · thuê ngoài ${so(px.tn, 0)} t`} />
        <The ten="Đã phân bổ kho" gt={`Xuất ${pc(pbXuat, cXB)}`} phu={`Nhập kho: sản xuất ${pc(pbSX, cSX)} · nhập mua ${pc(pbNM, cNM)}`} tone={cXB > 0 && Math.abs(pbXuat - cXB) < 0.5 ? "text-ok" : ""} />
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <Khung cao={CAO} ten="Kế hoạch xuất bán theo hàng" phu={`${k.nhan} · đường bộ / đường biển`}>
          {data === undefined ? dangTai : xb.length ? <EChart height={CAO - 70} option={opHang} /> : <ChuaCo>Chưa có kế hoạch xuất bán. Bấm Kế hoạch dài hạn để lập.</ChuaCo>}
        </Khung>
        <Khung cao={CAO} ten="Phân xe xuất bán: Hòa Phát / Thuê ngoài" phu={`${k.nhan} · theo loại xe`}>
          {data === undefined ? dangTai : theoXe.length ? <EChart height={CAO - 70} option={opXe} /> : <ChuaCo>Chưa có số phân xe.</ChuaCo>}
        </Khung>
        <Khung cao={CAO} ten="Dự báo tồn kho cuối kỳ" phu={`${k.nhan} · tồn + sản xuất + nhập mua − xuất bán`}>
          {data === undefined ? dangTai : !kho ? <ChuaCo>Cần quyền Khai thác kho bãi để xem tồn kho.</ChuaCo> : dbao.length ? (
            <>
              <EChart height={CAO - 100} option={opTon} />
              <div className="mt-1 text-[0.6875rem] text-muted-foreground">{thieu.length ? <span className="text-bad">Thiếu hàng cuối kỳ: {thieu.map((x) => x.hang).join(", ")}.</span> : "Tồn dự báo cuối kỳ không âm với mọi hàng trong kế hoạch."} Tính theo tồn hiện tại (kho hiện đang chứa).</div>
            </>) : <ChuaCo>Chưa có kế hoạch.</ChuaCo>}
        </Khung>
      </div>

      {mo === "dai" && <HopDaiHan onClose={() => setMo(null)} k={k} data={data} kho={kho} sua={sua} dsHang={dsHang} loaiXe={loaiXe} onLuu={taiLai} />}
      {mo === "ngay" && <HopNgay onClose={() => setMo(null)} />}
    </div>
  );
}
