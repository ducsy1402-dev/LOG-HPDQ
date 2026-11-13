import { useEffect, useMemo, useState } from "react";
import { Boxes, TrendingUp, ArrowLeftRight } from "lucide-react";
import { useApp } from "@/store";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/input";
import EChart from "@/components/EChart";
import { so, pct, r2, plain, thangCua, tenThang, congThang } from "@/lib/format";
import { khuCuaKeHoach, ngayStr } from "@/lib/kho";
import { chuoiKho } from "@/lib/bieuDoKho";
import { khoangKy } from "@/lib/bieuDoSanLuong";
import { ngayCuaThang } from "@/lib/sanLuongTT";
import { mucDay } from "./khoUi";

// Ba biểu đồ của mỗi tab kho ở Khai thác kho bãi (anh Sỹ chốt 13/11/2026):
//   1. Tồn theo bãi nhỏ: thanh tồn (màu theo mức lấp đầy) đè lên thanh sức chứa; lọc theo bãi lớn.
//   2. Nhập / xuất kho — kế hoạch / thực tế: lũy kế theo ngày của tháng chọn (kế hoạch nét đứt, thực tế nét liền).
//   3. Dự báo tồn theo loại hàng N ngày tới: mỗi ngày tồn + nhập − xuất; nhập / xuất lấy kế hoạch tháng (Kế hoạch Xuất/Nhập tồn, chia đều theo ngày) nếu có,
//      không có thì bình quân 30 ngày gần nhất theo sổ. Tồn không âm; ghi ngày dự kiến hết hàng.
// kho: bản kho đã lọc theo tab (locKhoTheoTab); loai: thanh_pham | nguyen_lieu.
const MAU = { ok: "#10b981", warn: "#f59e0b", bad: "#f43f5e", xam: "#64748b" };
const MAU_NHAP = "#6366f1", MAU_XUAT = "#38bdf8";
const DAY = 864e5;

function NhapXuatKeHoach({ kho, loai }) {
  const { D, api } = useApp();
  const [thang, setThang] = useState(() => thangCua(D.now));
  const [gd, setGd] = useState(null);
  const homNay = ngayStr(D.now);
  const thangs = useMemo(() => Array.from({ length: 14 }, (_, i) => congThang(thangCua(D.now), i - 3)), [D.now]);
  const kyInfo = useMemo(() => khoangKy("thang", `${thang}-01`, homNay), [thang, homNay]);
  useEffect(() => {
    let huy = false; setGd(null);
    api.loadGiaoDichKhoang(kyInfo.ngays[0], kyInfo.ngays[kyInfo.ngays.length - 1]).then((r) => { if (!huy) setGd(r || []); }).catch(() => { if (!huy) setGd([]); });
    return () => { huy = true; };
  }, [api, kyInfo, D.giaoDich]);
  const c = useMemo(() => gd && chuoiKho(kyInfo, { kho, loai, keHoach: D.khoKeHoach || [], giaoDich: gd, now: D.now }), [gd, kyInfo, kho, loai, D.khoKeHoach, D.now]);
  const duong = (name, data, color, net) => ({ name, type: "line", showSymbol: false, data, itemStyle: { color }, lineStyle: { width: net ? 1.6 : 2.4, type: net ? "dashed" : "solid", color } });
  const tom = (tt, kh) => `${so(tt, 0)} t${kh > 0 ? ` / KH ${so(kh, 0)} t (${pct(tt / kh, 0)})` : ""}`;
  return (
    <Card>
      <CardHeader><CardTitle><ArrowLeftRight />Nhập / xuất kho · kế hoạch / thực tế</CardTitle>
        <NativeSelect className="ml-auto h-8 w-40" value={thang} onChange={(e) => setThang(e.target.value)} options={thangs.map((x) => [x, tenThang(x) + (x === thangCua(D.now) ? " (này)" : "")])} aria-label="Tháng" />
      </CardHeader>
      <CardContent>
        {c ? (
          <>
            <EChart height={290} option={{
              tooltip: { trigger: "axis", valueFormatter: (v) => (v == null ? "—" : `${so(v)} t`) },
              legend: { itemWidth: 12, itemHeight: 6, textStyle: { fontSize: 10 } },
              xAxis: { type: "category", data: c.diem.map((o) => o.nhan), axisLabel: { fontSize: 10, hideOverlap: true } }, yAxis: { type: "value", axisLabel: { fontSize: 10 } },
              series: [
                duong("Nhập thực tế", c.diem.map((o) => (o.lkNhapTT == null ? null : r2(o.lkNhapTT))), MAU_NHAP), duong("Nhập kế hoạch", c.diem.map((o) => r2(o.lkNhapKH)), MAU_NHAP, true),
                duong("Xuất thực tế", c.diem.map((o) => (o.lkXuatTT == null ? null : r2(o.lkXuatTT))), MAU_XUAT), duong("Xuất kế hoạch", c.diem.map((o) => r2(o.lkXuatKH)), MAU_XUAT, true),
              ],
            }} />
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
              <span>Nhập: <b className="text-foreground">{tom(c.tongNhapTT, c.tongNhapKH)}</b></span>
              <span>Xuất: <b className="text-foreground">{tom(c.tongXuatTT, c.tongXuatKH)}</b></span>
              {!c.coKeHoach && <span>Chưa có kế hoạch tháng này (nút "Kế hoạch xuất/nhập kho").</span>}
            </div>
          </>
        ) : <p className="py-8 text-center text-sm text-muted-foreground">Đang tải…</p>}
      </CardContent>
    </Card>
  );
}

export default function BieuDoTon({ loai, kho }) {
  const { D } = useApp();
  const [baiLon, setBaiLon] = useState(""), [soNgay, setSoNgay] = useState(30), [hangDB, setHangDB] = useState("");
  const cap = useMemo(() => kho.cap.filter((c) => c.loai === loai && c.ton > 1e-6), [kho, loai]);

  // 1. Tồn theo bãi nhỏ
  const dsBaiLon = useMemo(() => [...new Set(kho.dong.filter((d) => d.loai === loai && !d.saiBai).map((d) => d.ten_bai))].sort((a, b) => a.localeCompare(b, "vi", { numeric: true })), [kho, loai]);
  const baiNho = useMemo(() => kho.dong.filter((d) => d.loai === loai && !d.saiBai && (!baiLon || d.ten_bai === baiLon))
    .sort((a, b) => (b.lapDay ?? -1) - (a.lapDay ?? -1) || b.ton - a.ton), [kho, loai, baiLon]);

  // 3. Dự báo tồn theo loại hàng
  const duBao = useMemo(() => {
    const dongOk = kho.dong.filter((d) => !d.saiBai), loaiKey = new Map(kho.dong.map((d) => [d.key, d.loai]));
    const loaiOf = (b, h) => loaiKey.get(kho.gan(b, h));
    const ten = new Map(), tonH = new Map();
    for (const c of cap) { const k = plain(c.hang); if (!ten.has(k)) ten.set(k, c.hang); tonH.set(k, (tonH.get(k) || 0) + c.ton); }
    const homNay = ngayStr(D.now), tu30 = ngayStr(D.now - 30 * DAY), bq = new Map();
    for (const g of D.giaoDich || []) {
      const n = String(g.ngay).slice(0, 10);
      if (n <= tu30 || n > homNay || (g.loai !== "nhap" && g.loai !== "xuat") || loaiOf(g.ten_bai, g.hang) !== loai) continue;
      const k = plain(g.hang), o = bq.get(k) || { n: 0, x: 0 };
      o[g.loai === "nhap" ? "n" : "x"] += (+g.so_luong || 0) / 30; bq.set(k, o);
      if (!ten.has(k)) ten.set(k, g.hang);
    }
    const kh = new Map();
    for (const r of D.khoKeHoach || []) {
      const d = khuCuaKeHoach(r, dongOk); if (!d || d.loai !== loai) continue;
      const hang = r.hang || d.hang; if (!hang) continue;
      const k = plain(hang), khoa = `${k}|${r.thang}`, o = kh.get(khoa) || { n: null, x: null }, c = r.huong === "xuat" ? "x" : "n";
      o[c] = (o[c] || 0) + (+r.khoi_luong || 0) / (ngayCuaThang(r.thang).length || 30); kh.set(khoa, o);
      if (!ten.has(k)) ten.set(k, hang);
    }
    const ngays = Array.from({ length: soNgay + 1 }, (_, i) => ngayStr(D.now + i * DAY));
    const ds = [...ten.keys()].map((k) => {
      let t = tonH.get(k) || 0, het = null, coKH = false;
      const diem = [r2(t)], a = bq.get(k) || { n: 0, x: 0 };
      for (let i = 1; i < ngays.length; i++) {
        const p = kh.get(`${k}|${ngays[i].slice(0, 7)}`);
        if (p) coKH = true;
        t = Math.max(0, t + (p?.n ?? a.n) - (p?.x ?? a.x));
        if (t <= 1e-6 && het == null && (tonH.get(k) || 0) > 0) het = ngays[i];
        diem.push(r2(t));
      }
      return { k, ten: ten.get(k), ton: tonH.get(k) || 0, diem, het, coKH };
    }).filter((x) => x.ton > 0 || x.diem.some((v) => v > 0)).sort((a, b) => b.ton - a.ton);
    return { ngays, ds };
  }, [kho, cap, loai, soNgay, D.giaoDich, D.khoKeHoach, D.now]);
  const hien = hangDB ? duBao.ds.filter((x) => x.k === hangDB) : duBao.ds.slice(0, 6);
  const nhanNgay = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;

  const cao = (n) => Math.max(240, 30 + n * 24);
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle><Boxes />Tồn theo bãi nhỏ</CardTitle>
            <NativeSelect className="ml-auto h-8 w-52" value={baiLon} onChange={(e) => setBaiLon(e.target.value)} placeholder="Tất cả bãi lớn" options={dsBaiLon} />
          </CardHeader>
          <CardContent>
            {baiNho.length ? <div className="max-h-[330px] overflow-y-auto pr-1"><EChart height={Math.max(290, cao(baiNho.length))} option={{
              legend: { data: ["Tồn", "Sức chứa"] },
              grid: { left: 4, right: 52, top: 30, bottom: 4, containLabel: true }, tooltip: { axisPointer: { type: "shadow" }, valueFormatter: (v) => `${so(v)} t` },
              xAxis: { type: "value", axisLabel: { fontSize: 10 } }, yAxis: { type: "category", inverse: true, data: baiNho.map((d) => (baiLon ? d.ten : `${d.ten_bai} › ${d.ten}`)), axisLabel: { fontSize: 10, width: 150, overflow: "truncate" } },
              series: [
                { name: "Sức chứa", type: "bar", barMaxWidth: 14, barGap: "-100%", itemStyle: { color: "rgba(148,163,184,0.28)" }, data: baiNho.map((d) => r2(d.sucChua || 0)), z: 1 },
                { name: "Tồn", type: "bar", barMaxWidth: 14, itemStyle: { color: MAU.ok }, z: 2, data: baiNho.map((d) => ({ value: r2(Math.max(0, d.ton)), itemStyle: { color: MAU[mucDay(d.lapDay)] === MAU.xam ? MAU_NHAP : MAU[mucDay(d.lapDay)] } })),
                  label: { show: true, position: "right", fontSize: 10, textBorderWidth: 0, formatter: (p) => (baiNho[p.dataIndex].lapDay != null ? pct(baiNho[p.dataIndex].lapDay) : "") } },
              ],
            }} /></div> : <p className="py-8 text-center text-sm text-muted-foreground">Chưa có bãi nhỏ.</p>}
          </CardContent>
        </Card>
        <NhapXuatKeHoach kho={kho} loai={loai} />
      </div>
      <Card>
        <CardHeader><CardTitle><TrendingUp />Dự báo tồn kho</CardTitle>
          <NativeSelect className="ml-auto h-8 w-56" value={hangDB} onChange={(e) => setHangDB(e.target.value)} placeholder="6 hàng tồn nhiều nhất" options={duBao.ds.map((x) => [x.k, x.ten])} />
          <NativeSelect className="h-8 w-28" value={String(soNgay)} onChange={(e) => setSoNgay(+e.target.value)} options={[["15", "15 ngày"], ["30", "30 ngày"], ["60", "60 ngày"], ["90", "90 ngày"]]} />
        </CardHeader>
        <CardContent className="grid gap-2">
          {hien.length ? <EChart height={320} option={{
            tooltip: { trigger: "axis", valueFormatter: (v) => `${so(v)} t` },
            legend: { type: "scroll" },
            xAxis: { type: "category", boundaryGap: false, data: duBao.ngays.map(nhanNgay), axisLabel: { fontSize: 10 } },
            yAxis: { type: "value", axisLabel: { fontSize: 10 } },
            series: hien.map((x) => ({ name: x.ten, type: "line", symbol: "none", data: x.diem, ...(hien.length === 1 ? { areaStyle: {} } : {}) })),
          }} /> : <p className="py-8 text-center text-sm text-muted-foreground">Chưa có số liệu để dự báo.</p>}
          {hien.length > 0 && (
            <div className="flex flex-wrap gap-1.5 text-xs">
              {hien.map((x) => (
                <span key={x.k} className={`rounded-full border px-2 py-0.5 ${x.het ? "border-bad/50 bg-bad/10 text-bad" : "text-muted-foreground"}`}>
                  {x.ten}: {so(x.ton, 0)} t → {so(x.diem[x.diem.length - 1], 0)} t{x.het ? ` · hết hàng ~${nhanNgay(x.het)}` : ""}{x.coKH ? " · theo kế hoạch" : " · theo bình quân 30 ngày"}
                </span>))}
            </div>)}
          <p className="text-[0.6875rem] text-muted-foreground">Mỗi ngày: tồn + nhập − xuất. Nhập / xuất lấy kế hoạch tháng (nút Kế hoạch xuất/nhập kho, chia đều theo ngày) nếu có, không có thì lấy bình quân 30 ngày gần nhất theo sổ nhập – xuất. Tồn không xuống dưới 0.</p>
        </CardContent>
      </Card>
    </div>
  );
}
