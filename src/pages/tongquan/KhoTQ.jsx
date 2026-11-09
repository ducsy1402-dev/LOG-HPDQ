import { useEffect, useMemo, useState } from "react";
import { Warehouse, ChevronLeft, X } from "lucide-react";
import { useApp } from "@/store";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChonGo } from "@/components/ui/combobox";
import { NativeSelect } from "@/components/ui/input";
import { Empty, MucIcon } from "@/components/common";
import EChart from "@/components/EChart";
import { so, pct, r2, ngayNam, DAY } from "@/lib/format";
import { NGUONG_KHO, tonTheoNgay, ngayStr, khuVucKho, soSanhKhoTheoKhu } from "@/lib/kho";
import { TEN_LOAI_KY, khoaKy, khoangKy, tenKy, dsKy } from "@/lib/ky";
import { cn } from "@/lib/utils";
import { useKho } from "../kho/useKho";
import { TheTQ, HopTQ, Dong, MAU } from "./khung";

const TEN_LOAI = { thanh_pham: "Thành phẩm", nguyen_lieu: "Nguyên liệu", hon_hop: "Hỗn hợp" };
const mauDay = (p) => (p == null ? MAU.xam : p > 1.0001 || p >= NGUONG_KHO.do ? MAU.bad : p >= NGUONG_KHO.vang ? MAU.warn : MAU.ok);

// Tổng hợp toàn kho: tồn / sức chứa, bãi gần đầy, nhập / xuất hôm nay, cảnh báo
function useTongHopKho() {
  const { D } = useApp();
  const kho = useKho();
  return useMemo(() => {
    if (!kho) return null;
    const coSuc = kho.bai.filter((b) => b.sucChua > 0);
    const ton = kho.bai.reduce((s, b) => s + b.ton, 0), suc = coSuc.reduce((s, b) => s + b.sucChua, 0);
    const tonCoSuc = coSuc.reduce((s, b) => s + b.ton, 0);
    const homNay = ngayStr(D.now);
    const gdHomNay = (D.giaoDich || []).filter((g) => String(g.ngay).slice(0, 10) === homNay);
    const nhap = gdHomNay.filter((g) => g.loai === "nhap").reduce((s, g) => s + +g.so_luong, 0);
    const xuat = gdHomNay.filter((g) => g.loai === "xuat").reduce((s, g) => s + +g.so_luong, 0);
    const ganDay = kho.bai.filter((b) => b.lapDay != null && b.lapDay >= NGUONG_KHO.vang);
    return { kho, ton, suc, soCoSuc: coSuc.length, lapDay: suc > 0 ? tonCoSuc / suc : null, nhap, xuat, ganDay, khan: kho.canh.filter((c) => c.muc === "bad").length };
  }, [kho, D.now, D.giaoDich]);
}

export function TheKho({ onMo, sqlChua }) {
  const th = useTongHopKho();
  if (!th) return <TheTQ icon={Warehouse} ten="Quản lý kho bãi" so="—" phu={sqlChua ? "Chưa chạy SQL 15 (kho bãi)" : "Đang tải dữ liệu kho"} khoa />;
  const { kho, ton, suc, soCoSuc, lapDay, nhap, xuat, ganDay, khan } = th;
  const bai = [...kho.bai].sort((a, b) => (b.lapDay ?? -1) - (a.lapDay ?? -1)).slice(0, 14);
  return (
    <TheTQ icon={Warehouse} ten="Quản lý kho bãi" onMo={onMo} tone={lapDay >= NGUONG_KHO.do || khan ? "bad" : lapDay >= NGUONG_KHO.vang || ganDay.length ? "warn" : "ok"}
      nhan={kho.canh.length > 0 && <Badge tone={khan ? "bad" : "warn"}>{kho.canh.length} cảnh báo</Badge>}
      so={lapDay != null ? pct(lapDay) : "—"} donVi="lấp đầy toàn kho"
      phu={`Tồn ${so(ton)} t · sức chứa ${so(suc)} t${soCoSuc < kho.bai.length ? ` (${soCoSuc}/${kho.bai.length} bãi đã khai báo)` : ` · ${kho.bai.length} bãi`}`}
      hinh={
        <div className="flex h-[38px] items-end gap-[3px]" aria-label="Lấp đầy các bãi">
          {bai.map((b) => (
            <div key={b.ten_bai} className="flex h-full min-w-0 flex-1 flex-col justify-end rounded-sm bg-muted" title={`${b.ten_bai}: ${b.lapDay != null ? pct(b.lapDay) : "chưa có sức chứa"} · ${so(b.ton)} t`}>
              <div className="rounded-sm" style={{ height: `${Math.min(100, Math.max(4, (b.lapDay ?? 0) * 100))}%`, background: mauDay(b.lapDay) }} />
            </div>))}
        </div>}
      chiSo={[
        [`Bãi ≥ ${pct(NGUONG_KHO.vang)}`, ganDay.length, ganDay.length ? "warn" : undefined],
        ["Nhập hôm nay", `${so(nhap)} t`, "ok"],
        ["Xuất hôm nay", `${so(xuat)} t`, "bad"],
      ]} />
  );
}

export function HopKho({ onClose, go }) {
  const th = useTongHopKho();
  const [tab, setTab] = useState("bai");
  const [loaiKho, setLoaiKho] = useState(""); // lọc loại kho cho tab Lấp đầy và Dự báo tồn: "" | thanh_pham | nguyen_lieu (hỗn hợp tính vào nguyên liệu)
  const khoLoc = useMemo(() => (th && loaiKho ? { ...th.kho, bai: th.kho.bai.filter((b) => (loaiKho === "thanh_pham" ? b.loai === "thanh_pham" : b.loai !== "thanh_pham")) } : th?.kho), [th, loaiKho]);
  if (!th) return null;
  const { kho, ton, suc, lapDay } = th;
  return (
    <HopTQ title="Quản lý kho bãi" onClose={onClose}
      description={`Tồn ${so(ton)} t${suc ? ` / ${so(suc)} t (${pct(lapDay)})` : ""} · ${kho.bai.length} bãi lớn · ${kho.canh.length} cảnh báo`}
      moTrang={[["Mở Kho thành phẩm", () => go("kho/thanh-pham")], ["Mở Kho nguyên liệu", () => go("kho/nguyen-lieu")]]}>
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex flex-wrap items-center gap-2">
          <TabsList>
            <TabsTrigger value="bai">Lấp đầy các bãi</TabsTrigger>
            <TabsTrigger value="ton">Dự báo tồn</TabsTrigger>
            <TabsTrigger value="kh">Kế hoạch so thực tế</TabsTrigger>
            <TabsTrigger value="canh">Cảnh báo kho ({kho.canh.length})</TabsTrigger>
          </TabsList>
          {(tab === "bai" || tab === "ton") && (
            <div className="ml-auto inline-flex rounded-md border p-0.5" role="group" aria-label="Loại kho">
              {[["", "Cả hai kho"], ["thanh_pham", "Kho thành phẩm"], ["nguyen_lieu", "Kho nguyên liệu"]].map(([k, t]) => <Button key={k} size="xs" variant={loaiKho === k ? "secondary" : "ghost"} className={cn(loaiKho === k && "text-primary")} aria-pressed={loaiKho === k} onClick={() => setLoaiKho(k)}>{t}</Button>)}
            </div>)}
        </div>
        <TabsContent value="bai"><LapDay key={loaiKho} kho={khoLoc} /></TabsContent>
        <TabsContent value="ton"><TonDuBao key={loaiKho} kho={khoLoc} /></TabsContent>
        <TabsContent value="kh"><KeHoachThucTe kho={kho} /></TabsContent>
        <TabsContent value="canh"><CanhBaoKho ds={kho.canh} /></TabsContent>
      </Tabs>
    </HopTQ>
  );
}

// Biểu đồ lấp đầy (vạch ngưỡng vàng / đỏ), mỗi thanh một dòng ds: { ten, khu, lapDay, ton, sucChua }; bấm thanh hoặc tên gọi onChon(i)
// Chiều cao biểu đồ lấp đầy; bảng bên cạnh dùng cùng chiều cao để hai khối bằng nhau
const caoLapDay = (ds) => Math.max(220, ds.length * 26 + 42);
function BieuDoLapDay({ ds, onChon }) {
  const coChon = !!onChon;
  const opt = useMemo(() => {
    const r = [...ds].reverse();
    return {
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, formatter: (p) => { const b = r[p[0].dataIndex]; return `<b>${b.ten}</b>${b.khu ? ` · ${b.khu}` : ""}<br/>Tồn ${so(b.ton)} t${b.sucChua ? ` / ${so(b.sucChua)} t` : ""}<br/>Lấp đầy ${b.lapDay != null ? pct(b.lapDay) : "chưa có sức chứa"}${coChon ? "<br/><i>Bấm để xem bãi nhỏ</i>" : ""}`; } },
      grid: { left: 14, right: 40, top: 22, bottom: 4, containLabel: true },
      xAxis: { type: "value", max: (x) => Math.max(1, x.max), axisLabel: { formatter: (x) => Math.round(x * 100) + "%" } },
      // Bãi đầu mỗi khu vực (trên cùng của nhóm) có nhãn khu vực đứng trước tên
      yAxis: { type: "category", data: r.map((b) => b.ten), triggerEvent: coChon, axisLabel: { width: 190, overflow: "truncate", rich: { k: { color: MAU.primary, fontWeight: 600, fontSize: 10, padding: [0, 4, 0, 0] } },
        formatter: (ten, i) => (r[i]?.khu && r[i + 1]?.khu !== r[i].khu ? `{k|${r[i].khu}} ${ten}` : ten) } },
      series: [{ type: "bar", cursor: coChon ? "pointer" : "default", data: r.map((b) => ({ value: b.lapDay ?? 0, itemStyle: { color: mauDay(b.lapDay), borderRadius: 3 } })), barMaxWidth: 16,
        label: { show: true, position: "right", fontSize: 10, color: "inherit", formatter: (p) => (r[p.dataIndex].lapDay != null ? pct(p.value) : "—") },
        markLine: { symbol: "none", silent: true, label: { fontSize: 10, formatter: (p) => pct(p.value) }, data: [{ xAxis: NGUONG_KHO.vang, lineStyle: { color: MAU.warn, type: "dashed" }, label: { color: MAU.warn } }, { xAxis: NGUONG_KHO.do, lineStyle: { color: MAU.bad, type: "dashed" }, label: { color: MAU.bad } }] } }],
    };
  }, [ds, coChon]);
  // Bấm thanh (series) hoặc bấm tên trên trục tung
  const bam = onChon && ((p) => { const i = p.componentType === "yAxis" ? ds.findIndex((b) => b.ten === p.value) : ds.length - 1 - p.dataIndex; if (i >= 0) onChon(i); });
  return <EChart option={opt} height={caoLapDay(ds)} onClick={bam} />;
}

const DuKienDay = ({ l }) => (!l ? "—" : l.trangThaiDay === "da_day" ? <span className="font-semibold text-bad">Đã đầy</span>
  : l.trangThaiDay === "tang" ? <span className={cn(l.ngayDay < NGUONG_KHO.ngayDayVang && "font-semibold text-warn")}>{ngayNam(l.luc)} · {so(l.ngayDay, l.ngayDay < 10 ? 1 : 0)} ngày</span>
  : <span className="text-muted-foreground">{l.trangThaiDay ? "Không" : "Chưa có sức chứa"}</span>);
const NhapXuatTB = ({ l }) => (l ? <><span className="text-ok">+{so(l.nhap)}</span> / <span className="text-bad">−{so(l.xuat)}</span></> : "—");

// Lấp đầy các bãi lớn, xếp theo cột Khu vực của danh mục kho bãi (chưa có cột này thì theo % lấp đầy);
// bấm một bãi (trên biểu đồ hoặc trong bảng) để xem biểu đồ và bảng các bãi nhỏ của bãi đó
const theoLapDay = (a, b) => (b.lapDay ?? -1) - (a.lapDay ?? -1);
function LapDay({ kho }) {
  const { D } = useApp();
  const kv = useMemo(() => khuVucKho(D.dmCot, D.dmBang), [D.dmCot, D.dmBang]);
  const [chon, setChon] = useState(null); // tên bãi lớn đang xem chi tiết
  const bai = useMemo(() => (kv ? kv.sapBai(kho.bai) : [...kho.bai].sort(theoLapDay)).map((b) => ({ ...b, ten: b.ten_bai, khu: kv?.cuaBai(b) })), [kho, kv]);
  const b = chon && bai.find((x) => x.ten_bai === chon);
  if (b) return <ChiTietBaiLon b={b} kho={kho} kv={kv} onQuayLai={() => setChon(null)} />;
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <BieuDoLapDay ds={bai} onChon={(i) => setChon(bai[i].ten_bai)} />
      <div className="scroll-x rounded-md border" style={{ maxHeight: caoLapDay(bai) }}>
        <table className="tbl text-xs">
          <thead><tr>{kv && <th>{kv.ten}</th>}<th>Bãi lớn</th><th>Loại</th><th className="num">Tồn (t)</th><th className="num">Nhập / xuất TB (t/ngày)</th><th>Dự kiến đầy</th><th>Tàu nhập 7 ngày</th></tr></thead>
          <tbody>{bai.map((x) => { const l = kho.luuLuong.bai.get(x.ten_bai); const tau = (l?.tau || []).reduce((s, t) => s + t.con, 0); const trong = kho.choTrong(x.ten_bai); return (
            <tr key={x.ten_bai} className="cursor-pointer hover:bg-accent" onClick={() => setChon(x.ten_bai)} title="Bấm để xem các bãi nhỏ">
              {kv && <td className="whitespace-nowrap">{x.khu || <span className="text-muted-foreground">—</span>}</td>}
              <td className="whitespace-nowrap font-medium">{x.ten_bai}<div className="text-[11px] text-primary">{x.dong.length} bãi nhỏ ›</div></td>
              <td>{TEN_LOAI[x.loai]}</td>
              <td className="num">{so(x.ton)}{x.sucChua ? <div className="text-[11px] text-muted-foreground">/ {so(x.sucChua)}</div> : ""}</td>
              <td className="num whitespace-nowrap"><NhapXuatTB l={l} /></td>
              <td className="whitespace-nowrap"><DuKienDay l={l} /></td>
              <td className={cn("whitespace-nowrap", trong != null && tau > trong && "font-semibold text-bad")}>{l?.tau.length ? `${l.tau.length} tàu · ${so(tau)} t` : <span className="text-muted-foreground">—</span>}</td>
            </tr>); })}</tbody>
        </table>
      </div>
    </div>
  );
}

const KIEU_NGAN = { co_dinh_hang: "Cố định", co_dinh_nhom: "Nhóm", tu_do: "Tự do" };
// Chi tiết một bãi lớn: chỉ số chung, biểu đồ lấp đầy và bảng từng bãi nhỏ (kiểu, hàng đang chứa, tồn, lưu lượng, dự kiến đầy, lưu bãi)
function ChiTietBaiLon({ b, kho, kv, onQuayLai }) {
  const l = kho.luuLuong.bai.get(b.ten_bai);
  const dong = useMemo(() => (kv ? kv.sapDong(b.dong) : [...b.dong].sort(theoLapDay)).map((d) => ({ ...d, khu: kv?.cua(d) })), [b, kv]);
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={onQuayLai}><ChevronLeft />Tất cả bãi lớn</Button>
        <b className="text-sm">{b.ten_bai}</b>
        {b.khu && <Badge tone="outline">{b.khu}</Badge>}
        {l?.kieu && <Badge tone="info" title={l.kieu.chiTiet}>{l.kieu.ten}</Badge>}
        <span className="text-xs text-muted-foreground">{b.dong.length} bãi nhỏ · tồn {so(b.ton)} t{b.sucChua ? ` / ${so(b.sucChua)} t (${pct(b.lapDay)})` : " · chưa đủ sức chứa"}</span>
      </div>
      {l && (
        <div className="grid gap-x-6 gap-y-1 rounded-md border bg-muted/30 p-3 sm:grid-cols-2 lg:grid-cols-4">
          <Dong ten={`Nhập / xuất TB (${l.soNgay} ngày)`}><NhapXuatTB l={l} /> t/ngày</Dong>
          <Dong ten="Dự kiến đầy"><DuKienDay l={l} /></Dong>
          <Dong ten="Lưu bãi bình quân">{l.luuBai != null ? `${so(l.luuBai, l.luuBai < 10 ? 1 : 0)} ngày` : "—"}</Dong>
          <Dong ten="Tàu nhập 7 ngày">{l.tau.length ? l.tau.map((t) => `${t.ten} ${so(t.con)} t`).join(", ") : "—"}</Dong>
        </div>)}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <BieuDoLapDay ds={dong} />
        <div className="scroll-x rounded-md border" style={{ maxHeight: caoLapDay(dong) }}>
          <table className="tbl text-xs">
            <thead><tr>{kv && <th>{kv.ten}</th>}<th>Bãi nhỏ</th><th>Kiểu</th><th>Hàng đang chứa</th><th className="num">Tồn / sức chứa (t)</th><th className="num">Nhập / xuất TB</th><th>Dự kiến đầy</th><th className="num">Lưu bãi</th></tr></thead>
            <tbody>{dong.map((d) => { const k = kho.luuLuong.khu.get(d.key); return (
              <tr key={d.key} className={cn(d.saiBai && "bg-bad/5")}>
                {kv && <td className="whitespace-nowrap">{d.khu || <span className="text-muted-foreground">—</span>}</td>}
                <td className="min-w-[120px] font-medium">{d.ten}</td>
                <td className="whitespace-nowrap">{d.saiBai ? <Badge tone="bad">Sai bãi</Badge> : <Badge tone="outline">{KIEU_NGAN[d.kieu] || "—"}{d.kieu === "co_dinh_nhom" && d.nhomBai ? ` ${d.nhomBai}` : ""}</Badge>}</td>
                <td className="min-w-[130px] max-w-[220px]">{d.chua.length ? d.chua.map((c) => <div key={c.hang} className="flex justify-between gap-2"><span className="truncate">{c.hang}</span>{d.chua.length > 1 && <span className="tabular-nums text-muted-foreground">{so(c.ton)}</span>}</div>) : <span className="text-muted-foreground">{d.hang || "Chưa có hàng"}</span>}</td>
                <td className={cn("num whitespace-nowrap", d.lapDay >= NGUONG_KHO.vang && "font-semibold text-warn", d.ton < 0 && "text-bad")}>{so(d.ton)}{d.sucChua ? <span className="text-muted-foreground"> / {so(d.sucChua)}</span> : ""}{d.lapDay != null && <div className="text-[11px]">{pct(d.lapDay)}</div>}</td>
                <td className="num whitespace-nowrap"><NhapXuatTB l={k} /></td>
                <td className="whitespace-nowrap"><DuKienDay l={k} /></td>
                <td className="num whitespace-nowrap">{k?.luuBai != null ? `${so(k.luuBai, k.luuBai < 10 ? 1 : 0)} ngày` : "—"}</td>
              </tr>); })}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Dự báo tồn: tồn cuối ngày 30 ngày qua và đường dự báo 7 ngày tới theo nhập − xuất bình quân 30 ngày.
// Chưa chọn gì: hai đường kho thành phẩm / nguyên liệu. Chọn tối đa 3 bãi lớn hoặc bãi nhỏ để so sánh.
const MAU_CHON = [MAU.info, MAU.tim, MAU.primary];
const TOI_DA = 3;
function TonDuBao({ kho }) {
  const { D } = useApp();
  const [cap, setCap] = useState("lon"); // lon: bãi lớn · nho: bãi nhỏ
  const [chon, setChon] = useState([]); // khóa: "b:tên bãi lớn" | "k:khóa bãi nhỏ"
  const [them, setThem] = useState("");
  const kv = useMemo(() => khuVucKho(D.dmCot, D.dmBang), [D.dmCot, D.dmBang]);
  // Danh sách để chọn (xếp theo khu vực nếu danh mục có cột Khu vực) và cách tính từng mục
  const muc = useMemo(() => {
    const m = new Map();
    for (const b of kv ? kv.sapBai(kho.bai) : kho.bai) {
      m.set(`b:${b.ten_bai}`, { ten: b.ten_bai, khu: kv?.cuaBai(b), cap: "lon", ton: b.ton, suc: b.sucChua, rong: kho.luuLuong.bai.get(b.ten_bai)?.rong || 0, loc: (x) => x === b.ten_bai });
      for (const d of kv ? kv.sapDong(b.dong) : b.dong) if (!d.saiBai) m.set(`k:${d.key}`, { ten: `${b.ten_bai} › ${d.ten}`, khu: kv?.cua(d), cap: "nho", ton: d.ton, suc: d.sucChua, rong: kho.luuLuong.khu.get(d.key)?.rong || 0, loc: (x, h) => kho.gan(x, h) === d.key });
    }
    return m;
  }, [kho, kv]);
  const opt = useMemo(() => {
    // Trục ngày: 30 ngày qua + 7 ngày dự báo; đường thực tế và đường dự báo nối nhau ở hôm nay
    const ngay = Array.from({ length: 37 }, (_, i) => D.now - (29 - i) * DAY);
    const dsVe = chon.length ? chon.map((k, i) => ({ ...muc.get(k), mau: MAU_CHON[i] })).filter((x) => x.ten)
      : ["thanh_pham", "nguyen_lieu"].map((l) => {
        const bai = kho.bai.filter((b) => b.loai === l || (l === "nguyen_lieu" && b.loai === "hon_hop"));
        const ten = new Set(bai.map((b) => b.ten_bai));
        return bai.length && { ten: TEN_LOAI[l], ton: bai.reduce((s, b) => s + b.ton, 0), suc: bai.reduce((s, b) => s + (b.sucChua || 0), 0), rong: bai.reduce((s, b) => s + (kho.luuLuong.bai.get(b.ten_bai)?.rong || 0), 0), loc: (x) => ten.has(x), mau: l === "thanh_pham" ? MAU.info : MAU.tim };
      }).filter(Boolean);
    const series = [];
    let sucMax = 0;
    for (const x of dsVe) {
      const seri = tonTheoNgay(x.ton, D.giaoDich || [], x.loc, 30, D.now);
      const cuoi = seri[seri.length - 1][1];
      sucMax = Math.max(sucMax, x.suc || 0);
      series.push({ name: x.ten, type: "line", smooth: true, showSymbol: false, data: [...seri.map(([, v]) => r2(v)), ...Array(7).fill(null)], itemStyle: { color: x.mau }, areaStyle: { opacity: 0.08 },
        markLine: x.suc > 0 ? { symbol: "none", silent: true, data: [{ yAxis: r2(x.suc), label: { formatter: `Sức chứa ${x.ten} ${so(x.suc)} t`, fontSize: 10, position: "insideStartTop", color: "inherit" }, lineStyle: { color: x.mau, type: "dotted" } }] } : undefined });
      // Đường dự báo cùng tên với đường thực tế: chú giải gọn, bấm chú giải ẩn / hiện cả hai
      series.push({ name: x.ten, type: "line", smooth: true, showSymbol: false, data: [...Array(29).fill(null), ...Array.from({ length: 8 }, (_, i) => r2(Math.max(0, cuoi + x.rong * i)))], itemStyle: { color: x.mau }, lineStyle: { type: "dashed" } });
    }
    return {
      legend: { data: dsVe.map((x) => x.ten), type: "scroll" },
      tooltip: { trigger: "axis", formatter: (ps) => `${ps[0].axisValue}<br/>` + ps.filter((q) => q.value != null).map((q) => `${q.marker}${q.seriesName}${q.seriesIndex % 2 ? " (dự báo)" : ""}: <b>${so(q.value)} t</b>`).join("<br/>") },
      xAxis: { type: "category", data: ngay.map((t) => ngayNam(t).slice(0, 5)), axisLabel: { interval: 3 } },
      yAxis: { type: "value", max: (v) => Math.ceil(Math.max(v.max, sucMax) * 1.05), axisLabel: { formatter: (v) => (v >= 1000 ? so(v / 1000) + "k" : v) } },
      series,
    };
  }, [kho, muc, chon, D.giaoDich, D.now]);
  const luaChon = [...muc].filter(([k, x]) => x.cap === cap && !chon.includes(k)).map(([k, x]) => [k, x.ten, x.khu]);
  const themMuc = (k) => { if (k && muc.has(k) && !chon.includes(k) && chon.length < TOI_DA) setChon([...chon, k]); setThem(""); };
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="Cấp bãi">
          {[["lon", "Bãi lớn"], ["nho", "Bãi nhỏ"]].map(([k, t]) => <Button key={k} size="xs" variant={cap === k ? "secondary" : "ghost"} className={cn(cap === k && "text-primary")} aria-pressed={cap === k} onClick={() => setCap(k)}>{t}</Button>)}
        </div>
        <ChonGo className="w-72" tuDo={false} value={them} onChange={(k, o) => (o?.chon ? themMuc(k) : setThem(k))} options={luaChon} disabled={chon.length >= TOI_DA}
          placeholder={chon.length >= TOI_DA ? `Đã chọn đủ ${TOI_DA}` : `Chọn ${cap === "lon" ? "bãi lớn" : "bãi nhỏ"} (tối đa ${TOI_DA})`} aria-label="Chọn bãi để dự báo" />
        {chon.map((k, i) => (
          <span key={k} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs" style={{ borderColor: MAU_CHON[i] }}>
            <i className="h-2 w-2 rounded-full" style={{ background: MAU_CHON[i] }} />{muc.get(k)?.ten}
            <button type="button" className="ml-0.5 text-muted-foreground hover:text-foreground" onClick={() => setChon(chon.filter((x) => x !== k))} aria-label={`Bỏ ${muc.get(k)?.ten}`}><X className="h-3 w-3" /></button>
          </span>))}
        {chon.length > 0 && <Button size="xs" variant="ghost" onClick={() => setChon([])}>Bỏ chọn</Button>}
      </div>
      <EChart option={opt} height={340} />
      <p className="mt-1 text-[11px] text-muted-foreground">Chưa chọn bãi: hai đường kho thành phẩm và kho nguyên liệu. Nét liền: tồn cuối ngày 30 ngày qua; nét đứt: dự báo 7 ngày theo nhập − xuất bình quân 30 ngày; nét chấm: sức chứa.</p>
    </div>
  );
}

// Nhập / xuất / tồn cuối kỳ của các bãi nhỏ: kế hoạch (bảng Kế hoạch Xuất/Nhập tồn ở trang Kho) so với thực tế (sổ kho), xem theo ngày / tháng / quý
const LOAI_KHO = ["ngay", "thang", "quy"];
const CHI_SO = { nhap: "Nhập", xuat: "Xuất", ton: "Tồn cuối kỳ" };
const LOAI_KHO_LOC = [["", "Cả hai kho"], ["nguyen_lieu", "Kho nguyên liệu"], ["thanh_pham", "Kho thành phẩm"]];
function KeHoachThucTe({ kho }) {
  const { D, api } = useApp();
  const [loai, setLoai] = useState("ngay");
  const [khoa, setKhoa] = useState(() => khoaKy("ngay", D.now));
  const [chiSo, setChiSo] = useState("nhap");
  const [loaiKho, setLoaiKho] = useState("");
  const dsK = useMemo(() => (loai === "ngay" ? dsKy("ngay", D.now, 30, 7) : loai === "thang" ? dsKy("thang", D.now, 11, 2) : dsKy("quy", D.now, 7, 1)).reverse(), [loai, D.now]); // tương lai → quá khứ
  const { tu, den } = khoangKy(loai, khoa);
  // Sổ kho web chỉ tải sẵn 35 ngày gần nhất; kỳ cũ hơn thì tải thêm từ ngày trước đầu kỳ đến hôm nay
  const tuNgay = ngayStr(Math.min(tu, D.now) - DAY), canTai = tuNgay < ngayStr(D.now - 34 * DAY);
  const [them, setThem] = useState({ tuNgay: null, ds: [] });
  const [loi, setLoi] = useState(null);
  useEffect(() => {
    if (!canTai || them.tuNgay === tuNgay) return;
    let huy = false; setLoi(null);
    api.loadGiaoDichKhoang(tuNgay, ngayStr(D.now)).then((ds) => !huy && setThem({ tuNgay, ds })).catch((e) => !huy && setLoi(e?.message || "Không tải được sổ kho"));
    return () => { huy = true; };
  }, [canTai, tuNgay]); // eslint-disable-line react-hooks/exhaustive-deps
  const dangTai = canTai && them.tuNgay !== tuNgay && !loi;
  const giaoDich = canTai && them.tuNgay === tuNgay ? them.ds : D.giaoDich || [];
  const kq = useMemo(() => soSanhKhoTheoKhu({
    dong: kho.dong, keHoach: D.khoKeHoach || [], giaoDich, gan: kho.gan, tu, den, now: D.now,
  }), [kho, D.khoKeHoach, D.now, giaoDich, tu, den]);
  const cot = { nhap: ["nhapKH", "nhapTT"], xuat: ["xuatKH", "xuatTT"], ton: ["tonKH", "tonTT"] }[chiSo];
  const ten = (r) => `${r.ten_bai} › ${r.ten}`;
  const rows = kq.rows.filter((r) => (!loaiKho || r.loai === loaiKho) && (["nhapKH", "nhapTT", "xuatKH", "xuatTT"].some((k) => r[k] > 0.5) || r.tonTT > 0.5 || r.tonKH > 0.5));
  const ds = [...rows].sort((a, b) => Math.max(a[cot[0]], a[cot[1]]) - Math.max(b[cot[0]], b[cot[1]])); // lớn nhất ở trên cùng của biểu đồ ngang
  const opt = useMemo(() => ({
    legend: { data: ["Kế hoạch", "Thực tế"] },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (x) => `${so(x)} t` },
    grid: { left: 14, right: 24, top: 34, bottom: 4, containLabel: true },
    xAxis: { type: "value", axisLabel: { formatter: (v) => (v >= 1000 ? so(v / 1000) + "k" : v) } },
    yAxis: { type: "category", data: ds.map(ten) },
    series: [
      { name: "Kế hoạch", type: "bar", data: ds.map((r) => r2(r[cot[0]])), itemStyle: { color: MAU.info, borderRadius: [0, 3, 3, 0] }, barMaxWidth: 14 },
      { name: "Thực tế", type: "bar", data: ds.map((r) => r2(r[cot[1]])), itemStyle: { color: MAU.ok, borderRadius: [0, 3, 3, 0] }, barMaxWidth: 14 },
    ],
  }), [ds, cot[0]]); // eslint-disable-line react-hooks/exhaustive-deps
  const doiLoai = (l) => { setLoai(l); setKhoa(khoaKy(l, D.now)); };
  const chenh = (a, b) => { const x = b - a; return <span className={cn("tabular-nums", Math.abs(x) < 0.5 ? "text-muted-foreground" : x < 0 ? "text-bad" : "text-ok")}>{x > 0 ? "+" : ""}{so(x)}</span>; };
  if (!D.coSql27) return <div className="rounded-md border border-warn/40 bg-warn/5 px-3 py-2 text-sm">Chưa có bảng kế hoạch kho: quản trị cần chạy <b>sql/27_kho_ke_hoach.sql</b> trong Supabase. Sau đó nhập kế hoạch ở trang Kho › tab Kế hoạch Xuất/Nhập tồn.</div>;
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="Chỉ tiêu">
          {Object.entries(CHI_SO).map(([k, t]) => <Button key={k} size="xs" variant={chiSo === k ? "secondary" : "ghost"} className={cn(chiSo === k && "text-primary")} aria-pressed={chiSo === k} onClick={() => setChiSo(k)}>{t}</Button>)}
        </div>
        <NativeSelect className="h-8 w-40" value={loaiKho} onChange={(e) => setLoaiKho(e.target.value)} options={LOAI_KHO_LOC} aria-label="Kho" />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="Xem theo">
            {LOAI_KHO.map((l) => <Button key={l} size="xs" variant={loai === l ? "secondary" : "ghost"} className={cn(loai === l && "text-primary")} aria-pressed={loai === l} onClick={() => doiLoai(l)}>{TEN_LOAI_KY[l]}</Button>)}
          </div>
          <NativeSelect className="h-8 w-44" value={khoa} onChange={(e) => setKhoa(e.target.value)} options={dsK.map((x) => [x, tenKy(loai, x)])} aria-label={TEN_LOAI_KY[loai]} />
        </div>
      </div>
      {dangTai && <div className="mb-2 text-xs text-muted-foreground">Đang tải sổ kho của kỳ này…</div>}
      {loi && <div className="mb-2 text-xs text-bad">{loi}</div>}
      {ds.length ? <EChart option={opt} height={Math.max(240, ds.length * 44 + 60)} /> : <Empty>Không có số liệu kho trong kỳ này.</Empty>}
      {rows.length > 0 && (
        <div className="scroll-x mt-3 max-h-[40vh] rounded-md border">
          <table className="tbl text-xs">
            <thead><tr><th>Bãi nhỏ</th><th className="num">Nhập KH</th><th className="num">Nhập TT</th><th className="num">Xuất KH</th><th className="num">Xuất TT</th><th className="num">Tồn KH</th><th className="num">Tồn TT</th><th className="num">Tồn TT − KH</th></tr></thead>
            <tbody>{[...rows].sort((a, b) => b.tonTT - a.tonTT).map((r) => (
              <tr key={r.key}><td className="font-medium">{ten(r)}</td>
                {[r.nhapKH, r.nhapTT, r.xuatKH, r.xuatTT, r.tonKH, r.tonTT].map((x, i) => <td key={i} className="num">{so(x)}</td>)}
                <td className="num">{chenh(r.tonKH, r.tonTT)}</td></tr>))}</tbody>
          </table>
        </div>)}
      <p className="mt-1 text-[11px] text-muted-foreground">
        Kế hoạch (KH) lấy từ trang Kho › tab Kế hoạch Xuất/Nhập tồn: kế hoạch nhập / xuất cả tháng của từng bãi nhỏ, chia đều theo ngày khi xem theo ngày, cộng các tháng khi xem theo quý. Thực tế (TT) lấy từ sổ kho theo bãi nhỏ nhận hàng. Điều chuyển giữa các bãi không tính vào Nhập / Xuất (vẫn tính vào tồn thực tế). Tồn KH cuối kỳ = tồn đầu kỳ + nhập KH − xuất KH.
        {kq.dangDienRa ? " Kỳ đang diễn ra: số thực tế mới đến hôm nay." : ""}{!(D.khoKeHoach || []).length ? " Chưa có kế hoạch nào: nhập ở trang Kho." : ""}{kq.matKH ? ` ${kq.matKH} dòng kế hoạch thuộc bãi nhỏ không còn trong danh mục nên không được tính.` : ""}
      </p>
    </div>
  );
}

function CanhBaoKho({ ds }) {
  if (!ds.length) return <Empty>Không có cảnh báo kho.</Empty>;
  return (
    <div className="grid max-h-[60vh] gap-0.5 overflow-y-auto">
      {[...ds].sort((a, b) => (a.muc === "bad" ? 0 : 1) - (b.muc === "bad" ? 0 : 1)).map((c, i) => (
        <div key={i} className="flex items-start gap-2 rounded-md px-1.5 py-1 text-sm"><MucIcon muc={c.muc} className="mt-0.5" /><span>{c.nd}</span></div>))}
    </div>
  );
}
