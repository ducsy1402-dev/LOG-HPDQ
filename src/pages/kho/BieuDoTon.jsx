import { useEffect, useMemo, useState } from "react";
import { Boxes, TrendingUp, ArrowLeftRight, LineChart, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/store";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/input";
import EChart from "@/components/EChart";
import { so, pct, r2, plain } from "@/lib/format";
import { khuCuaKeHoach, ngayStr, khaiBaoBai, khoaTenBai } from "@/lib/kho";
import { chuoiKho } from "@/lib/bieuDoKho";
import { khoaKy, dsKy, tenKy, khoangKy as khoangKhoa } from "@/lib/ky";
import { khoangKy } from "@/lib/bieuDoSanLuong";
import { ngayCuaKeHoach } from "@/lib/keHoachKy";
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

// Chọn kỳ Tháng / Quý / Năm cho biểu đồ (mỗi biểu đồ một bộ riêng, nhớ kỳ đã chọn của từng loại)
const KY_KHO = [["thang", "Tháng"], ["quy", "Quý"], ["nam", "Năm"]];
export function useKyKho() {
  const { D } = useApp();
  const homNay = ngayStr(D.now);
  const [kyLoai, setKyLoai] = useState("thang");
  const [chon, setChon] = useState(() => ({ thang: khoaKy("thang", D.now), quy: khoaKy("quy", D.now), nam: khoaKy("nam", D.now) }));
  const hienTai = useMemo(() => ({ thang: khoaKy("thang", D.now), quy: khoaKy("quy", D.now), nam: khoaKy("nam", D.now) }), [D.now]);
  const dsChon = useMemo(() => ({ thang: dsKy("thang", D.now, 11, 2), quy: dsKy("quy", D.now, 7, 1), nam: dsKy("nam", D.now, 3, 1) }), [D.now]);
  const khoa = chon[kyLoai];
  const kyInfo = useMemo(() => khoangKy(kyLoai, ngayStr(khoangKhoa(kyLoai, khoa).tu), homNay), [kyLoai, khoa, homNay]);
  return { kyLoai, setKyLoai, khoa, kyInfo, homNay, dat: (v) => setChon((o) => ({ ...o, [kyLoai]: v })), dsChon: dsChon[kyLoai].map((x) => [x, tenKy(kyLoai, x) + (x === hienTai[kyLoai] ? " (này)" : "")]) };
}
// Hàng điều khiển: kho / bãi, Tháng / Quý / Năm, kỳ. Nằm trong thân khung (không trong tiêu đề) để khỏi chen chữ khi khung hẹp.
export function HangLoc({ k, dsBai, bai, setBai, nhanBai = "Tất cả kho / bãi", anBai = false, them = null }) {
  return (
    <div className="mb-1 flex flex-wrap items-center gap-1.5">
      {!anBai && <NativeSelect className="h-7 w-44 text-xs" value={bai} onChange={(e) => setBai(e.target.value)} placeholder={nhanBai} options={dsBai} aria-label="Lọc kho / bãi" />}
      <div className="inline-flex gap-0.5 rounded-md bg-muted p-0.5 text-xs" role="tablist" aria-label="Kỳ">
        {KY_KHO.map(([x, ten]) => (
          <button key={x} type="button" role="tab" aria-selected={k.kyLoai === x} onClick={() => k.setKyLoai(x)}
            className={`rounded px-2.5 py-1 font-medium transition-colors ${k.kyLoai === x ? "bg-card text-foreground shadow-sm dark:bg-accent" : "text-muted-foreground hover:text-foreground"}`}>{ten}</button>))}
      </div>
      <NativeSelect className="h-7 w-44 text-xs" value={k.khoa} onChange={(e) => k.dat(e.target.value)} options={k.dsChon} aria-label="Kỳ" />
      {them}
    </div>
  );
}

// Bộ chọn kho / bãi kiểu BĂNG CHUYỀN QUAY VÒNG (anh Sỹ 21/11/2026), dùng cho Tồn theo bãi nhỏ và Nhập / xuất kho: mũi tên ‹ › cố định ở hai đầu bao ba tên (trước · đang xem · sau) trong ba ô cố định;
// bấm thì cả dải tên trượt một ô, tên đang xem to dần, tên kế tiếp chạy vào từ mép bên kia, hết lượt thì quay về đầu. Số thứ tự "1/5" bên trái, nút Tất cả bên phải.
// bai = "" là Tất cả kho / bãi; onChange(tênBãi | "", chiềuTrượt) được gọi ngay khi bắt đầu trượt (biểu đồ bên dưới đổi cùng lúc).
// pos là số đếm tăng / giảm không giới hạn (chỉ số kho / bãi = pos theo modulo) để mỗi tên giữ nguyên phần tử trên trang khi dải trượt, không bị dựng lại.
const mod = (j, n) => ((j % n) + n) % n;
export function BoChonBai({ ds, bai, onChange }) {
  const n = ds.length, tatCa = bai === "";
  const [pos, setPos] = useState(() => Math.max(0, ds.indexOf(bai))), [dich, setDich] = useState(0); // dich: 0 nghỉ, ±1 đang trượt
  useEffect(() => { // hết lượt trượt thì chốt vị trí (không dùng transitionend để khỏi kẹt khi tab bị ẩn)
    if (!dich) return undefined;
    const t = setTimeout(() => { setPos((j) => j + dich); setDich(0); }, 300);
    return () => clearTimeout(t);
  }, [dich]);
  const chay = (d) => {
    if (n < 2) return;
    if (tatCa) { onChange(ds[mod(pos, n)], d); return; } // đang xem Tất cả: bấm mũi tên là trở về kho / bãi đang chọn
    if (!dich) { setDich(d); onChange(ds[mod(pos + d, n)], d); }
  };
  const phim = (e) => { if (e.key === "ArrowLeft") { e.preventDefault(); chay(-1); } else if (e.key === "ArrowRight") { e.preventDefault(); chay(1); } };
  const nut = "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:scale-95 disabled:pointer-events-none disabled:opacity-30";
  const mep = "linear-gradient(to right, transparent, #000 16%, #000 84%, transparent)";
  const cacO = [-2, -1, 0, 1, 2].map((k) => pos + k); // năm ô: hai ô ngoài nằm ngoài khung nhìn, chờ trượt vào
  return (
    <div className="ml-auto flex items-center gap-0.5 outline-none" role="group" aria-label="Chọn kho / bãi" tabIndex={0} onKeyDown={phim} style={{ "--s": "6.75rem" }}>
      <span className="mr-2 whitespace-nowrap text-[0.6875rem] tabular-nums text-muted-foreground" title="Thứ tự kho / bãi đang xem trên tổng số">{tatCa ? `${n} kho / bãi` : n ? `${mod(pos + dich, n) + 1}/${n}` : ""}</span>
      <button type="button" className={nut} onClick={() => chay(-1)} disabled={n < 2} aria-label="Kho / bãi trước"><ChevronLeft className="h-5 w-5" /></button>
      <div className="relative h-8 w-[calc(var(--s)*3)] overflow-hidden" style={{ maskImage: mep, WebkitMaskImage: mep }}>
        {tatCa ? (
          <span className="kfade absolute inset-0 flex items-center justify-center whitespace-nowrap text-xs font-semibold">Tất cả kho / bãi</span>
        ) : n ? (
          <div className="flex h-full items-center" style={{ transform: `translateX(calc(var(--s) * ${-1 - dich}))`, transition: dich ? "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)" : "none" }}>
            {cacO.map((abs) => {
              const tam = abs === pos + dich, ten = ds[mod(abs, n)];
              return (
                <button key={abs} type="button" onClick={() => { if (abs === pos - 1) chay(-1); else if (abs === pos + 1) chay(1); }} tabIndex={-1} title={ten}
                  className={cn("flex w-[var(--s)] shrink-0 items-center justify-center whitespace-nowrap px-1 transition-all duration-300", tam ? "scale-110 text-xs font-semibold text-foreground" : "scale-90 text-[0.6875rem] text-muted-foreground/70 hover:text-foreground")}>
                  <span className="truncate">{ten}</span>
                </button>);
            })}
          </div>
        ) : <span className="flex h-full items-center justify-center text-xs text-muted-foreground">—</span>}
      </div>
      <button type="button" className={nut} onClick={() => chay(1)} disabled={n < 2} aria-label="Kho / bãi sau"><ChevronRight className="h-5 w-5" /></button>
      <button type="button" className={cn("ml-1 shrink-0 rounded-full px-2.5 py-1 text-[0.6875rem] font-medium transition-colors", tatCa ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground")} aria-pressed={tatCa}
        onClick={() => onChange(tatCa ? ds[mod(pos, n)] || "" : "", 1)} title="Xem tất cả kho / bãi cùng lúc">Tất cả</button>
    </div>
  );
}

export function NhapXuatKeHoach({ kho, loai, dsBai }) {
  const { D, api } = useApp();
  const k = useKyKho(), kyInfo = k.kyInfo;
  const [bai, setBai] = useState("");
  const [gd, setGd] = useState(null);
  useEffect(() => {
    let huy = false; setGd(null);
    api.loadGiaoDichKhoang(kyInfo.ngays[0], kyInfo.ngays[kyInfo.ngays.length - 1]).then((r) => { if (!huy) setGd(r || []); }).catch(() => { if (!huy) setGd([]); });
    return () => { huy = true; };
  }, [api, kyInfo, D.giaoDich]);
  const baiOk = dsBai.includes(bai) ? bai : "";
  const c = useMemo(() => gd && chuoiKho(kyInfo, { kho, loai, bai: baiOk, keHoach: D.khoKeHoach || [], giaoDich: gd, now: D.now }), [gd, kyInfo, kho, loai, baiOk, D.khoKeHoach, D.now]);
  const duong = (name, data, color, net) => ({ name, type: "line", showSymbol: kyInfo.ky !== "thang", symbolSize: 4, data, itemStyle: { color }, lineStyle: { width: net ? 1.6 : 2.4, type: net ? "dashed" : "solid", color } });
  const tom = (tt, kh) => `${so(tt, 0)} t${kh > 0 ? ` / KH ${so(kh, 0)} t (${pct(tt / kh, 0)})` : ""}`;
  return (
    <Card>
      <CardHeader className="flex-wrap"><CardTitle><ArrowLeftRight />Nhập / xuất kho · kế hoạch / thực tế</CardTitle><BoChonBai ds={dsBai} bai={baiOk} onChange={(b) => setBai(b)} /></CardHeader>
      <CardContent>
        <HangLoc k={k} dsBai={dsBai} bai={baiOk} setBai={setBai} anBai />
        {c ? (
          <>
            <EChart height={260} option={{
              tooltip: { trigger: "axis", valueFormatter: (v) => (v == null ? "—" : `${so(v)} t`) },
              legend: { itemWidth: 12, itemHeight: 6, textStyle: { fontSize: 10 } },
              xAxis: { type: "category", data: c.diem.map((o) => o.nhan), axisLabel: { fontSize: 10, hideOverlap: true } }, yAxis: { type: "value", axisLabel: { fontSize: 10 } },
              series: [
                duong("Nhập thực tế", c.diem.map((o) => (o.lkNhapTT == null ? null : r2(o.lkNhapTT))), MAU_NHAP), duong("Nhập kế hoạch", c.diem.map((o) => r2(o.lkNhapKH)), MAU_NHAP, true),
                duong("Xuất thực tế", c.diem.map((o) => (o.lkXuatTT == null ? null : r2(o.lkXuatTT))), MAU_XUAT), duong("Xuất kế hoạch", c.diem.map((o) => r2(o.lkXuatKH)), MAU_XUAT, true),
              ],
            }} />
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
              <span>{kyInfo.nhan}{baiOk ? ` · ${baiOk}` : " · tất cả kho / bãi"}</span>
              <span>Nhập: <b className="text-foreground">{tom(c.tongNhapTT, c.tongNhapKH)}</b></span>
              <span>Xuất: <b className="text-foreground">{tom(c.tongXuatTT, c.tongXuatKH)}</b></span>
              {!c.coKeHoach && <span>Chưa có kế hoạch kỳ này (nút "Kế hoạch xuất/nhập kho").</span>}
            </div>
          </>
        ) : <p className="py-8 text-center text-sm text-muted-foreground">Đang tải…</p>}
      </CardContent>
    </Card>
  );
}

export const dsBaiLonCua = (kho, loai) => [...new Set(kho.dong.filter((d) => d.loai === loai && !d.saiBai).map((d) => d.ten_bai))].sort((a, b) => a.localeCompare(b, "vi", { numeric: true }));

// Biểu đồ "Tồn theo bãi nhỏ": thanh tồn (màu theo mức lấp đầy) đè lên thanh sức chứa; baiLon = "" là tất cả kho / bãi (xếp theo khu vực), có tên thì chỉ từng gian / lô của kho / bãi đó
export function TonBaiNho({ kho, loai, baiLon }) {
  const { D } = useApp();
  const cap = (n) => Math.max(240, 30 + n * 24);
  // Xếp theo khu vực (Danh mục › Khai báo kho / bãi) → bãi lớn → bãi nhỏ (số tăng dần, chữ A–Z); mỗi khu vực có một dòng tiêu đề
  const kb = useMemo(() => khaiBaoBai(D.dmBang), [D.dmBang]);
  const KHONG_KHU = "Chưa khai báo khu vực";
  const khuCua = (d) => kb.get(khoaTenBai(d.ten_bai))?.khuVuc || KHONG_KHU;
  const ss = (a, b) => String(a).localeCompare(String(b), "vi", { numeric: true, sensitivity: "base" });
  const baiNho = useMemo(() => kho.dong.filter((d) => d.loai === loai && !d.saiBai && (!baiLon || d.ten_bai === baiLon))
    .sort((a, b) => (khuCua(a) === KHONG_KHU) - (khuCua(b) === KHONG_KHU) || ss(khuCua(a), khuCua(b)) || ss(a.ten_bai, b.ten_bai) || ss(a.ten, b.ten)), [kho, loai, baiLon, kb]); // eslint-disable-line react-hooks/exhaustive-deps
  const dongBieuDo = useMemo(() => { // baiNho chèn dòng tiêu đề khu vực (khi có từ 2 khu vực)
    const nhieuKhu = new Set(baiNho.map(khuCua)).size > 1, out = []; let cu = null;
    for (const d of baiNho) { const k = khuCua(d); if (nhieuKhu && k !== cu) { out.push({ tieuDe: k }); cu = k; } out.push(d); }
    return out;
  }, [baiNho]); // eslint-disable-line react-hooks/exhaustive-deps


  return (
    <>
            {baiNho.length ? <div className="max-h-[330px] overflow-y-auto pr-1"><EChart height={Math.max(290, cap(dongBieuDo.length))} option={{
              legend: { data: ["Tồn", "Sức chứa"] },
              grid: { left: 4, right: 52, top: 30, bottom: 4, containLabel: true }, tooltip: { axisPointer: { type: "shadow" }, valueFormatter: (v) => (v == null ? "" : `${so(v)} t`) },
              xAxis: { type: "value", axisLabel: { fontSize: 10 } },
              yAxis: { type: "category", inverse: true, data: dongBieuDo.map((d, i) => (d.tieuDe ? `§${d.tieuDe}§${i}` : baiLon ? d.ten : `${d.ten_bai} › ${d.ten}`)),
                axisLabel: { fontSize: 10, width: 170, overflow: "truncate", formatter: (v) => (v.startsWith("§") ? `{h|${v.split("§")[1]}}` : v), rich: { h: { fontSize: 10, fontWeight: 700, color: "#818cf8" } } } },
              series: [
                { name: "Sức chứa", type: "bar", barMaxWidth: 14, barGap: "-100%", itemStyle: { color: "rgba(148,163,184,0.28)" }, data: dongBieuDo.map((d) => (d.tieuDe ? null : r2(d.sucChua || 0))), z: 1 },
                { name: "Tồn", type: "bar", barMaxWidth: 14, itemStyle: { color: MAU.ok }, z: 2, data: dongBieuDo.map((d) => (d.tieuDe ? null : { value: r2(Math.max(0, d.ton)), itemStyle: { color: MAU[mucDay(d.lapDay)] === MAU.xam ? MAU_NHAP : MAU[mucDay(d.lapDay)] } })),
                  label: { show: true, position: "right", fontSize: 10, textBorderWidth: 0, formatter: (p) => (dongBieuDo[p.dataIndex]?.lapDay != null ? pct(dongBieuDo[p.dataIndex].lapDay) : "") } },
              ],
            }} /></div> : <p className="py-8 text-center text-sm text-muted-foreground">Chưa có bãi nhỏ.</p>}
    </>
  );
}

// Thẻ "Dự báo tồn kho" (biểu đồ đường N ngày tới theo hàng); dùng ở tab Kho hàng rời
export function DuBaoTonKho({ loai, kho }) {
  const { D } = useApp();
  const [soNgay, setSoNgay] = useState(30), [hangDB, setHangDB] = useState("");
  const cap = useMemo(() => kho.cap.filter((c) => c.loai === loai && c.ton > 1e-6), [kho, loai]);

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
      const k = plain(hang), c = r.huong === "xuat" ? "x" : "n", nd = ngayCuaKeHoach(r), moi = (+r.khoi_luong || 0) / (nd.length || 1);
      for (const n of nd) { const khoa = `${k}|${n}`, o = kh.get(khoa) || { n: null, x: null }; o[c] = (o[c] || 0) + moi; kh.set(khoa, o); } // kế hoạch chia đều theo ngày của kỳ (ngày / tuần / tháng / năm)
      if (!ten.has(k)) ten.set(k, hang);
    }
    const ngays = Array.from({ length: soNgay + 1 }, (_, i) => ngayStr(D.now + i * DAY));
    const ds = [...ten.keys()].map((k) => {
      let t = tonH.get(k) || 0, het = null, coKH = false;
      const diem = [r2(t)], a = bq.get(k) || { n: 0, x: 0 };
      for (let i = 1; i < ngays.length; i++) {
        const p = kh.get(`${k}|${ngays[i]}`);
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

  return (
      <Card>
        <CardHeader><CardTitle><TrendingUp />Dự báo tồn kho</CardTitle>
          <NativeSelect className="ml-auto h-7 w-48 text-xs" value={hangDB} onChange={(e) => setHangDB(e.target.value)} placeholder="6 hàng tồn nhiều nhất" options={duBao.ds.map((x) => [x.k, x.ten])} />
          <NativeSelect className="h-7 w-28 text-xs" value={String(soNgay)} onChange={(e) => setSoNgay(+e.target.value)} options={[["15", "15 ngày"], ["30", "30 ngày"], ["60", "60 ngày"], ["90", "90 ngày"]]} />
        </CardHeader>
        <CardContent className="grid gap-2">
          {hien.length ? <EChart height={340} option={{
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
  );
}
