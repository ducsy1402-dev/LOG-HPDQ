import { useEffect, useMemo, useRef, useState } from "react";
import { Boxes, ChevronDown, LineChart, BarChart3, Hourglass } from "lucide-react";
import { useApp } from "@/store";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import EChart, { tooltipGon } from "@/components/EChart";
import { so, pct, r2, ngayNam } from "@/lib/format";
import { chuoiTonLoaiHang } from "@/lib/bieuDoKho";
import { duBaoDay, tonTheoLoaiHang, duBaoTonDiem } from "@/lib/tonLoaiHang";
import { khoaDiem } from "@/lib/bieuDoSanLuong";
import { cn } from "@/lib/utils";
import { mucDay } from "./khoUi";
import { TonBaiNho, dsBaiLonCua, HangLoc, useKyKho, NhapXuatKeHoach, DuBaoTonKho, BoChonBai } from "./BieuDoTon";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

// Bốn khung của tab Kho hàng kiện (thành phẩm) ở Khai thác kho bãi (anh Sỹ 21/11/2026):
//   1. Tồn theo bãi nhỏ: mỗi lần MỘT kho / bãi (mặc định kho / bãi đầu tiên), nút ‹ › chuyển kho / bãi, nút Tất cả xem hết.
//   2. Tồn hiện tại theo loại hàng (biểu đồ cột; thanh mờ = sức chứa của các gian / lô chứa loại hàng đó).
//   3. Diễn biến tồn theo loại hàng (biểu đồ đường, kỳ Tháng / Quý / Năm; tính ngược từ tồn hiện tại theo sổ nhập – xuất).
//   4. Bảng Dự báo tồn: tình trạng từng loại hàng, NẾU KHÔNG XUẤT BÁN thì bao lâu đầy (còn trống ÷ nhập mỗi ngày).
// Mặc định xem theo HÀNG ĐANG CHỨA trong kho (đúng tên hàng như ở sổ kho / Danh mục kho bãi, VD "Thép cuộn HRC"); nút "Nhóm hàng" gộp theo nhóm trong Danh mục › Hàng hóa (VD "HRC").
const MAU = { ok: "#10b981", warn: "#f59e0b", bad: "#f43f5e", xam: "#64748b", nhan: "#6366f1" };
const MAU_DUONG = ["#6366f1", "#14b8a6", "#38bdf8", "#f59e0b", "#a855f7", "#ec4899", "#84cc16", "#f97316", "#06b6d4", "#e11d48", "#8b5cf6", "#22c55e"];
const KHONG_KH = [];
const TEN_HANG = (h) => h; // loại hàng = đúng tên hàng (mặc định); hằng số để các useMemo không dựng lại mỗi lần vẽ
const nghin = (v) => (Math.abs(v) >= 1000 ? `${r2(v / 1000)}k` : v);
const mauMuc = (lapDay) => { const m = mucDay(lapDay); return m === "xam" || MAU[m] === MAU.xam ? MAU.nhan : MAU[m]; };
const TT_DAY = {
  da_day: ["Đã đầy", "bad"], gap: ["Sắp đầy (≤ 7 ngày)", "bad"], chu_y: ["Cần chú ý (≤ 30 ngày)", "warn"], on: ["Còn rộng", "ok"],
  khong_nhap: ["Không có nhập", "default"], thieu_suc_chua: ["Chưa có sức chứa", "default"],
};
const tenNgay = (n) => (n ? ngayNam(new Date(n + "T00:00:00").getTime()) : "—");
const soNgay = (x) => (x == null ? "—" : x <= 0 ? "0" : x >= 1000 ? "> 1.000" : so(x, 0));

// 1. Tồn theo bãi nhỏ, chuyển từng kho / bãi
// 1. Tồn theo bãi nhỏ: mỗi lần MỘT kho / bãi (mặc định kho / bãi đầu), bộ chọn băng chuyền BoChonBai ở BieuDoTon.jsx
function TonBaiNhoMotBai({ kho, loai }) {
  const ds = useMemo(() => dsBaiLonCua(kho, loai), [kho, loai]);
  const [bai, setBai] = useState(null); // null: chưa chọn -> kho / bãi đầu; "" = Tất cả
  const huongRef = useRef(1);
  const baiOk = bai === "" ? "" : ds.includes(bai) ? bai : ds[0] || "";
  return (
    <Card>
      <CardHeader className="flex-wrap">
        <CardTitle><Boxes />Tồn theo bãi nhỏ</CardTitle>
        <BoChonBai ds={ds} bai={baiOk} onChange={(b, h) => { huongRef.current = h; setBai(b); }} />
      </CardHeader>
      <CardContent>
        <div key={baiOk || "tat-ca"} className="kfade" style={{ "--dx": `${huongRef.current * 22}px` }}>
          <TonBaiNho kho={kho} loai={loai} baiLon={baiOk} />
        </div>
      </CardContent>
    </Card>
  );
}

// 2. Tồn hiện tại theo loại hàng (cột)
function TonHienTai({ kho, loai, nhomOf, theo }) {
  return (
    <Card>
      <CardHeader><CardTitle><BarChart3 />Tồn hiện tại theo {theo === "nhom" ? "nhóm hàng" : "hàng"}</CardTitle></CardHeader>
      <CardContent><TonHienTaiBD kho={kho} loai={loai} nhomOf={nhomOf} theo={theo} /></CardContent>
    </Card>
  );
}
// Phần biểu đồ (dùng lại ở Tổng quan › Kho bãi: khung "Tồn hiện tại"); cao = chiều cao biểu đồ
export function TonHienTaiBD({ kho, loai, nhomOf = TEN_HANG, theo = "hang", cao = 300 }) {
  const ds = useMemo(() => tonTheoLoaiHang({ kho, loai, nhomOf }).filter((x) => x.ton > 1e-6 || x.sucChua > 0), [kho, loai, nhomOf]);
  const tong = ds.reduce((s, x) => s + x.ton, 0), tongSC = ds.reduce((s, x) => s + x.sucChua, 0);
  return (
    <>
        {ds.length ? (
          <>
            <div className="overflow-x-auto pb-1"><div style={{ minWidth: ds.length > 8 ? ds.length * 58 : undefined }}><EChart height={cao} option={{
              grid: { left: 4, right: 10, top: 34, bottom: 4, containLabel: true }, legend: { data: ["Tồn", "Sức chứa"], itemWidth: 12, itemHeight: 6, textStyle: { fontSize: 10 } },
              tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, formatter: (p) => { const x = ds[p[0].dataIndex]; return `<b>${x.ten}</b><br/>Tồn: ${so(x.ton)} t${x.sucChua > 0 ? `<br/>Sức chứa: ${so(x.sucChua)} t<br/>Lấp đầy: ${pct(x.lapDay)}` : ""}`; } },
              xAxis: { type: "category", data: ds.map((x) => x.ten), axisLabel: { fontSize: 10, interval: 0, width: 80, overflow: "truncate", rotate: ds.length > 6 ? 30 : 0 } },
              yAxis: { type: "value", axisLabel: { fontSize: 10, formatter: nghin } },
              series: [
                { name: "Sức chứa", type: "bar", barMaxWidth: 34, barGap: "-100%", itemStyle: { color: "rgba(148,163,184,0.28)" }, data: ds.map((x) => (x.sucChua > 0 ? r2(x.sucChua) : null)), z: 1 },
                { name: "Tồn", type: "bar", barMaxWidth: 34, z: 2, data: ds.map((x) => ({ value: r2(Math.max(0, x.ton)), itemStyle: { color: mauMuc(x.lapDay) } })),
                  label: { show: true, position: "top", fontSize: 10, textBorderWidth: 0, formatter: (p) => (ds[p.dataIndex].lapDay != null ? pct(ds[p.dataIndex].lapDay, 0) : nghin(p.value)) } },
              ],
            }} /></div></div>
            <p className="mt-1 text-xs text-muted-foreground">Tổng tồn <b className="text-foreground">{so(tong, 0)} t</b>{tongSC > 0 ? <> / sức chứa <b className="text-foreground">{so(tongSC, 0)} t</b> ({pct(tong / tongSC, 0)})</> : ""}. Nhãn trên cột là % lấp đầy; thanh mờ là sức chứa của các gian / lô chứa {theo === "nhom" ? "nhóm hàng" : "hàng"} đó (gian / lô nhiều hàng chia theo tỉ lệ tồn).</p>
          </>) : <p className="py-8 text-center text-sm text-muted-foreground">Chưa có tồn kho.</p>}
    </>
  );
}

// 3. Diễn biến tồn theo loại hàng (đường)
function DienBienTon({ kho, loai, nhomOf, theo }) {
  return (
    <Card>
      <CardHeader><CardTitle><LineChart />Diễn biến tồn theo {theo === "nhom" ? "nhóm hàng" : "hàng"}</CardTitle></CardHeader>
      <CardContent><DienBienTonBD kho={kho} loai={loai} nhomOf={nhomOf} theo={theo} /></CardContent>
    </Card>
  );
}
// Phần biểu đồ + bộ lọc (dùng lại ở Tổng quan › Kho bãi: khung "Diễn biến tồn"); cao = chiều cao biểu đồ
// kyChung: kỳ của cả trang (Tổng quan: thanh chọn kỳ ở đầu trang) thì dùng luôn kỳ đó, không hiện bộ chọn Tháng / Quý / Năm riêng
export function DienBienTonBD({ kho, loai, nhomOf = TEN_HANG, theo = "hang", cao = 300, kyChung = null }) {
  const { D, api } = useApp();
  const k0 = useKyKho(), k = kyChung ? { ...k0, kyInfo: kyChung, homNay: kyChung.homNay } : k0, kyInfo = k.kyInfo, dau = kyInfo.ngays[0];
  const [gd, setGd] = useState(null);
  useEffect(() => {
    let huy = false; setGd(null);
    if (dau > k.homNay) { setGd([]); return undefined; }
    api.loadGiaoDichKhoang(dau, k.homNay).then((r) => { if (!huy) setGd(r || []); }).catch(() => { if (!huy) setGd([]); });
    return () => { huy = true; };
  }, [api, dau, k.homNay, D.giaoDich]);
  const c = useMemo(() => gd && chuoiTonLoaiHang(kyInfo, { kho, loai, nhomOf, giaoDich: gd, now: D.now }), [gd, kyInfo, kho, loai, nhomOf, D.now]);
  // Lọc nhiều hàng (anh Sỹ 21/11/2026): chon = khóa các hàng được chọn; rỗng = tất cả. Màu của mỗi hàng cố định theo thứ tự tồn, bỏ chọn hàng khác không làm đổi màu.
  const [chon, setChon] = useState([]);
  const tatCaKey = c ? c.ds.map((x) => x.k) : [];
  const dangChon = new Set(chon.length ? chon.filter((x) => tatCaKey.includes(x)) : tatCaKey);
  const hien = c ? c.ds.map((x, i) => ({ ...x, i })).filter((x) => dangChon.has(x.k)) : [];
  const lat = (key) => { const m = new Set(dangChon); if (m.has(key)) m.delete(key); else m.add(key); if (!m.size) return; setChon(m.size === tatCaKey.length ? [] : [...m]); };
  // Dự báo tồn (anh Sỹ 22/11/2026): luôn vẽ thêm đường NÉT ĐỨT cùng màu từ hôm nay tới hết kỳ; mỗi hàng tự chọn nguồn: có kế hoạch Xuất/Nhập tồn thì theo kế hoạch, không có thì theo trung bình thực tế 30 ngày
  const keHoach = D.khoKeHoach || KHONG_KH;
  const db = useMemo(() => (c ? duBaoTonDiem(kyInfo, { c: { ...c, ds: hien }, kho, loai, nhomOf, keHoach, giaoDich: D.giaoDich || [], now: D.now }) : null), [c, hien.map((x) => x.k).join("|"), kyInfo, kho, loai, nhomOf, keHoach, D.giaoDich, D.now]); // eslint-disable-line react-hooks/exhaustive-deps
  const iHN = c ? c.diem.findIndex((o) => khoaDiem(kyInfo.buoc, o.dau) === khoaDiem(kyInfo.buoc, kyInfo.homNay)) : -1;
  const boLoc = c && c.ds.length > 1 ? (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="flex h-7 items-center gap-1 rounded-md border border-input bg-background px-2 text-xs hover:bg-accent" aria-label="Lọc hàng (chọn nhiều)">
          Hàng: <b>{dangChon.size === tatCaKey.length ? "Tất cả" : `${dangChon.size}/${tatCaKey.length}`}</b><ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-1.5" align="end">
        <div className="mb-1 flex items-center gap-1 border-b px-1 pb-1.5">
          <button type="button" className="rounded px-1.5 py-0.5 text-xs text-primary hover:bg-accent" onClick={() => setChon([])}>Chọn tất cả</button>
          <button type="button" className="rounded px-1.5 py-0.5 text-xs text-primary hover:bg-accent" onClick={() => setChon(c.ds.slice(0, 5).map((x) => x.k))} title="Chỉ 5 hàng tồn nhiều nhất">Top 5</button>
          <span className="ml-auto pr-1 text-[0.6875rem] text-muted-foreground">{dangChon.size}/{tatCaKey.length} hàng</span>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {c.ds.map((x, i) => (
            <label key={x.k} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-accent">
              <input type="checkbox" className="h-3.5 w-3.5 accent-[hsl(var(--primary))]" checked={dangChon.has(x.k)} onChange={() => lat(x.k)} />
              <i className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: MAU_DUONG[i % MAU_DUONG.length] }} />
              <span className="min-w-0 flex-1 truncate">{x.ten}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">{so(x.hienTai, 0)} t</span>
            </label>))}
        </div>
      </PopoverContent>
    </Popover>) : null;
  return (
    <>
        {kyChung ? (boLoc && <div className="mb-1 flex justify-end">{boLoc}</div>) : <HangLoc k={k} dsBai={[]} bai="" setBai={() => {}} anBai them={boLoc} />}
        {c ? (c.ds.length ? (
          <>
            <EChart height={cao} option={{
              tooltip: tooltipGon(10),
              legend: { type: "scroll", data: hien.map((x) => x.ten), itemWidth: 12, itemHeight: 6, textStyle: { fontSize: 10 } },
              grid: { left: 4, right: 12, top: 36, bottom: 0, containLabel: true },
              xAxis: { type: "category", boundaryGap: false, data: c.diem.map((o) => o.nhan), axisLabel: { fontSize: 10, hideOverlap: true } },
              yAxis: { type: "value", axisLabel: { fontSize: 10, formatter: nghin } },
              series: [
                ...hien.map((x, j) => ({ name: x.ten, type: "line", showSymbol: kyInfo.ky !== "thang", symbolSize: 4, data: x.ton, itemStyle: { color: MAU_DUONG[x.i % MAU_DUONG.length] }, lineStyle: { width: 2, color: MAU_DUONG[x.i % MAU_DUONG.length] },
                  ...(j === 0 && db?.theo.size && iHN >= 0 ? { markLine: { symbol: "none", silent: true, lineStyle: { color: "#94a3b8", type: "dotted" }, label: { formatter: "Hôm nay", fontSize: 10, color: "#94a3b8" }, data: [{ xAxis: iHN }] } } : {}) })),
                // Phần dự báo: nét đứt cùng màu với hàng, không vào chú thích
                ...hien.filter((x) => db?.theo.get(x.k)).map((x) => ({ name: `${x.ten} · dự báo`, type: "line", showSymbol: false, data: db.theo.get(x.k), itemStyle: { color: MAU_DUONG[x.i % MAU_DUONG.length] }, lineStyle: { width: 2, type: "dashed", color: MAU_DUONG[x.i % MAU_DUONG.length] } })),
              ],
            }} />
            <p className="mt-1 text-xs text-muted-foreground">{kyInfo.nhan} · tồn hiện tại <b className="text-foreground">{so(hien.reduce((s, x) => s + x.hienTai, 0), 0)} t</b>{hien.length < c.ds.length ? ` (${hien.length}/${c.ds.length} hàng đã chọn)` : ""}. Mỗi đường một {theo === "nhom" ? "nhóm hàng" : "hàng"}; tính ngược từ tồn hiện tại theo sổ nhập – xuất (điểm chưa tới để trống).
              {db && (db.theo.size ? <> <b className="text-foreground">Nét đứt = dự báo</b> tới hết kỳ: tồn hôm nay + nhập − xuất mỗi ngày, theo {(() => { const kh = [...db.nguon.values()].filter((x) => x === "kh").length, bq = db.nguon.size - kh; return kh && bq ? `kế hoạch Xuất/Nhập tồn (${kh} hàng) hoặc trung bình thực tế 30 ngày gần nhất (${bq} hàng chưa có kế hoạch)` : kh ? "kế hoạch Xuất/Nhập tồn" : "trung bình thực tế 30 ngày gần nhất (chưa có kế hoạch)"; })()}{db.coSo ? `; dự kiến nhập ${so(db.tongNhap, 0)} t, xuất ${so(db.tongXuat, 0)} t.` : "; chưa có nhập / xuất nên tồn giữ nguyên."}</> : " Kỳ đã qua hết nên không có phần dự báo.")}</p>
          </>) : <p className="py-8 text-center text-sm text-muted-foreground">Chưa có tồn kho.</p>) : <p className="py-8 text-center text-sm text-muted-foreground">Đang tải…</p>}
    </>
  );
}

// 4. Bảng Dự báo tồn: nếu không xuất bán thì bao lâu đầy
function DuBaoTon({ kho, loai, nhomOf, theo }) {
  const { D } = useApp();
  const ds = useMemo(() => duBaoDay({ kho, loai, nhomOf, giaoDich: D.giaoDich || [], keHoach: D.khoKeHoach || [], now: D.now }), [kho, loai, nhomOf, D.giaoDich, D.khoKeHoach, D.now]);
  const thuTu = { da_day: 0, gap: 1, chu_y: 2, on: 3, khong_nhap: 4, thieu_suc_chua: 5 };
  const xep = [...ds].sort((a, b) => thuTu[a.trangThai] - thuTu[b.trangThai] || (a.ngayDay ?? 1e9) - (b.ngayDay ?? 1e9) || b.ton - a.ton);
  return (
    <Card>
      <CardHeader><CardTitle><Hourglass />Dự báo tồn · nếu không xuất bán</CardTitle></CardHeader>
      <CardContent className="grid gap-2">
        {xep.length ? (
          <div className="scroll-x max-h-[330px]">
            <table className="tbl text-xs">
              <thead><tr><th>{theo === "nhom" ? "Nhóm hàng" : "Hàng"}</th><th className="num">Tồn (t)</th><th className="num">Sức chứa (t)</th><th className="num">Còn trống (t)</th><th className="num" title="Nhập mỗi ngày: kế hoạch nhập đang có hiệu lực hôm nay, không có thì bình quân 30 ngày gần nhất theo sổ">Nhập / ngày (t)</th><th className="num">Đầy sau (ngày)</th><th>Dự kiến đầy</th><th>Tình trạng</th><th className="num" title="Nếu vẫn xuất bán như bình quân 30 ngày gần nhất">Theo xu hướng</th></tr></thead>
              <tbody>
                {xep.map((x) => (
                  <tr key={x.k}>
                    <td className="font-medium">{x.ten}</td>
                    <td className="num">{so(x.ton, 0)}</td>
                    <td className="num">{x.sucChua > 0 ? so(x.sucChua, 0) : "—"}</td>
                    <td className="num">{x.conTrong == null ? "—" : so(x.conTrong, 0)}{x.lapDay != null && <div className="text-[0.6875rem] font-normal text-muted-foreground">{pct(x.lapDay, 0)} đầy</div>}</td>
                    <td className="num">{x.nhapNgay > 0 ? so(x.nhapNgay, 0) : "0"}<div className="text-[0.6875rem] font-normal text-muted-foreground">{x.nguonNhap === "ke_hoach" ? "theo kế hoạch" : "bình quân 30 ngày"}</div></td>
                    <td className={cn("num font-semibold", (x.trangThai === "da_day" || x.trangThai === "gap") && "text-bad", x.trangThai === "chu_y" && "text-warn")}>{soNgay(x.ngayDay)}</td>
                    <td className="whitespace-nowrap tabular-nums">{x.trangThai === "da_day" ? "Đã đầy" : tenNgay(x.ngayDuKien)}</td>
                    <td><Badge tone={TT_DAY[x.trangThai][1]}>{TT_DAY[x.trangThai][0]}</Badge></td>
                    <td className="num text-muted-foreground">{x.conTrong == null || x.trangThai === "da_day" ? "—" : x.ngayDayXuHuong == null ? <span title={`Xuất bình quân ${so(x.xuatNgay, 0)} t/ngày không thua nhập`}>không đầy</span> : <span title={`Xuất bình quân ${so(x.xuatNgay, 0)} t/ngày`}>{soNgay(x.ngayDayXuHuong)} ngày</span>}</td>
                  </tr>))}
              </tbody>
            </table>
          </div>) : <p className="py-8 text-center text-sm text-muted-foreground">Chưa có số liệu để dự báo.</p>}
        <p className="text-[0.6875rem] text-muted-foreground">Đầy sau = (sức chứa − tồn) ÷ nhập mỗi ngày, <b>không trừ xuất</b> (coi như dừng xuất bán). Cột "Theo xu hướng" vẫn trừ lượng xuất bình quân 30 ngày. Sức chứa là tổng các gian / lô chứa loại hàng đó (gian / lô nhiều hàng chia theo tỉ lệ tồn).</p>
      </CardContent>
    </Card>
  );
}

// Luôn theo HÀNG ĐANG CHỨA trong kho (tên hàng thật như ở sổ kho / Danh mục kho bãi)
const theoHang = (h) => h;

// Kho hàng kiện (thành phẩm): bốn khung
export default function BieuDoTonKien({ loai, kho }) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <TonBaiNhoMotBai kho={kho} loai={loai} />
        <TonHienTai kho={kho} loai={loai} nhomOf={theoHang} theo="hang" />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <DienBienTon kho={kho} loai={loai} nhomOf={theoHang} theo="hang" />
        <DuBaoTon kho={kho} loai={loai} nhomOf={theoHang} theo="hang" />
      </div>
    </div>
  );
}

// Kho hàng rời (21/11/2026): giữ biểu đồ Nhập / xuất kho kế hoạch – thực tế và Dự báo tồn kho; Tồn theo bãi nhỏ dạng băng chuyền như Kho hàng kiện;
// "Tồn kho · các kho / bãi theo ngày" được thay bằng Diễn biến tồn theo hàng; thêm bảng Dự báo tồn nếu không xuất bán.
export function BieuDoTonRoi({ loai, kho }) {
  const dsBai = useMemo(() => dsBaiLonCua(kho, loai), [kho, loai]);
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <TonBaiNhoMotBai kho={kho} loai={loai} />
        <NhapXuatKeHoach kho={kho} loai={loai} dsBai={dsBai} />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <DienBienTon kho={kho} loai={loai} nhomOf={theoHang} theo="hang" />
        <DuBaoTonKho kho={kho} loai={loai} />
      </div>
      <DuBaoTon kho={kho} loai={loai} nhomOf={theoHang} theo="hang" />
    </div>
  );
}
