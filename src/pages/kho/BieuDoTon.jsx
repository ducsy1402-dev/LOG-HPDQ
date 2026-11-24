import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Boxes, ArrowLeftRight, LineChart, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/store";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/input";
import EChart, { tooltipGon } from "@/components/EChart";
import { so, pct, r2 } from "@/lib/format";
import { ngayStr, khaiBaoBai, khoaTenBai } from "@/lib/kho";
import { chuoiKho } from "@/lib/bieuDoKho";
import { khoaKy, dsKy, tenKy, khoangKy as khoangKhoa } from "@/lib/ky";
import { khoangKy } from "@/lib/bieuDoSanLuong";
import { mucDay } from "./khoUi";

// Ba biểu đồ của mỗi tab kho ở Khai thác kho bãi (anh Sỹ chốt 13/11/2026):
//   1. Tồn theo bãi nhỏ: thanh tồn (màu theo mức lấp đầy) đè lên thanh sức chứa; lọc theo bãi lớn.
//   2. Nhập / xuất kho — kế hoạch / thực tế: lũy kế theo ngày của tháng chọn (kế hoạch nét đứt, thực tế nét liền).
//   (Biểu đồ thứ 3 «Dự báo tồn kho» đã bỏ 24/11/2026 theo yêu cầu của anh Sỹ.)
// kho: bản kho đã lọc theo tab (locKhoTheoTab); loai: thanh_pham | nguyen_lieu.
const MAU = { ok: "#10b981", warn: "#f59e0b", bad: "#f43f5e", xam: "#64748b" };
const MAU_NHAP = "#6366f1", MAU_XUAT = "#38bdf8";

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
// cho = phần tử DOM ở đầu khung (khe trong CardHeader): hàng điều khiển được vẽ NGAY CẠNH tiêu đề thay vì nằm dưới (anh Sỹ 24/11/2026), chữ nhỏ hơn cho gọn
export function HangLoc({ k, dsBai, bai, setBai, nhanBai = "Tất cả kho / bãi", anBai = false, them = null, cho = null }) {
  const noi = (
    <div className={cn("flex items-center gap-1.5", cho ? "min-w-0 shrink" : "mb-1 flex-wrap")}>
      {!anBai && <NativeSelect className="h-7 w-44 text-xs" value={bai} onChange={(e) => setBai(e.target.value)} placeholder={nhanBai} options={dsBai} aria-label="Lọc kho / bãi" />}
      <div className="inline-flex gap-0.5 rounded-md bg-muted p-0.5 text-xs" role="tablist" aria-label="Kỳ">
        {KY_KHO.map(([x, ten]) => (
          <button key={x} type="button" role="tab" aria-selected={k.kyLoai === x} onClick={() => k.setKyLoai(x)}
            className={`rounded px-2.5 py-1 font-medium transition-colors ${k.kyLoai === x ? "bg-card text-foreground shadow-sm dark:bg-accent" : "text-muted-foreground hover:text-foreground"}`}>{ten}</button>))}
      </div>
      <NativeSelect className={cn("h-7 text-xs", cho ? "w-32" : "w-44")} value={k.khoa} onChange={(e) => k.dat(e.target.value)} options={k.dsChon} aria-label="Kỳ" />
      {them}
    </div>
  );
  return cho ? createPortal(noi, cho) : noi;
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
    <div className="ml-auto flex w-full items-center gap-0.5 outline-none sm:w-auto" role="group" aria-label="Chọn kho / bãi" tabIndex={0} onKeyDown={phim}>
      <span className="mr-2 hidden whitespace-nowrap text-[0.6875rem] tabular-nums text-muted-foreground sm:inline" title="Thứ tự kho / bãi đang xem trên tổng số">{tatCa ? `${n} kho / bãi` : n ? `${mod(pos + dich, n) + 1}/${n}` : ""}</span>
      <button type="button" className={nut} onClick={() => chay(-1)} disabled={n < 2} aria-label="Kho / bãi trước"><ChevronLeft className="h-5 w-5" /></button>
      <div className="relative h-8 min-w-0 flex-1 overflow-hidden sm:w-[20.25rem] sm:flex-none" style={{ maskImage: mep, WebkitMaskImage: mep }}>
        {tatCa ? (
          <span className="kfade absolute inset-0 flex items-center justify-center whitespace-nowrap text-xs font-semibold">Tất cả kho / bãi</span>
        ) : n ? (
          <div className="flex h-full items-center" style={{ width: "166.667%", transform: `translateX(${(-1 - dich) * 20}%)`, transition: dich ? "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)" : "none" }}>
            {cacO.map((abs) => {
              const tam = abs === pos + dich, ten = ds[mod(abs, n)];
              return (
                <button key={abs} type="button" onClick={() => { if (abs === pos - 1) chay(-1); else if (abs === pos + 1) chay(1); }} tabIndex={-1} title={ten}
                  className={cn("flex w-1/5 shrink-0 items-center justify-center whitespace-nowrap px-1 transition-all duration-300", tam ? "scale-110 text-xs font-semibold text-foreground" : "scale-90 text-[0.6875rem] text-muted-foreground/70 hover:text-foreground")}>
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
              tooltip: tooltipGon(10),
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
