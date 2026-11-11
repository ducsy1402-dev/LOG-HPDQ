import { useMemo, useState } from "react";
import { Container } from "lucide-react";
import { useApp } from "@/store";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Empty } from "@/components/common";
import EChart from "@/components/EChart";
import { daLam } from "@/lib/linetime";
import { tinhThang, tinhKy } from "@/lib/sanLuong";
import { TEN_LOAI_KY, khoaKy, khoangKy, tenKy, tenNganKy, dsKy, congKy, thangDauKy } from "@/lib/ky";
import { so, pct, r2, thangCua, tenThang, congThang, plain } from "@/lib/format";
import { cn } from "@/lib/utils";
import { tenBenChuyen } from "../cang/BangTauBen";
import { useNhomHang } from "../cang/useNhomHang";
import { TheTQ, HopTQ, Dong, MAU } from "./khung";

const nghin = (x) => (Math.abs(x) >= 1000 ? so(x / 1000, Math.abs(x) >= 1e5 ? 0 : 1) + "k" : so(x));
function useKhoiLuong(thang) {
  const { D } = useApp();
  const nhom = useNhomHang();
  return useMemo(() => tinhThang(D, thang, nhom), [D, thang, nhom]);
}
const dat = (th, mt) => (mt > 0 ? th / mt : null);

export function TheKhoiLuong({ onMo }) {
  const { D } = useApp();
  const thang = thangCua(D.now);
  const k = useKhoiLuong(thang);
  const mt = k.mucTieu;
  // Mẫu số của thanh: mục tiêu, chưa đặt thì KL tàu trong tháng
  const mau = mt?.tong || k.klTau || 1;
  const tl = dat(k.thucHien, mt?.tong);
  // Tỷ lệ thời gian đã qua trong tháng, để so tiến độ sản lượng
  const [a, b] = [new Date(thang + "-01").getTime(), new Date(congThang(thang, 1) + "-01").getTime()];
  const quaThang = Math.min(1, Math.max(0, (D.now - a) / (b - a)));
  const tone = tl == null ? "info" : tl >= 1 ? "ok" : tl < quaThang * 0.8 ? "warn" : "info";
  return (
    <TheTQ icon={Container} ten="Khối lượng xếp dỡ" onMo={onMo} tone={tone}
      nhan={tl != null ? <Badge tone={tone === "warn" ? "warn" : tone === "ok" ? "ok" : "info"}>Đạt {pct(tl)} mục tiêu</Badge> : <Badge tone="outline">{D.coSql21 ? "Chưa đặt mục tiêu" : "Chưa chạy SQL 21"}</Badge>}
      so={nghin(k.thucHien)} donVi={`tấn thực hiện · ${tenThang(thang).toLowerCase()}`}
      phu={`${mt ? `Mục tiêu ${so(mt.tong)} t · ` : ""}KL tàu trong tháng ${so(k.klTau)} t (${k.ds.length} chuyến)`}
      hinh={
        <div>
          <div className="relative h-2.5 overflow-hidden rounded-full bg-muted" title={`Thực hiện ${so(k.thucHien)} / ${mt ? `mục tiêu ${so(mt.tong)}` : `KL tàu ${so(k.klTau)}`} t`}>
            <div className="absolute inset-y-0 left-0" style={{ width: `${Math.min(100, (k.nhap.th / mau) * 100)}%`, background: MAU.info }} />
            <div className="absolute inset-y-0" style={{ left: `${Math.min(100, (k.nhap.th / mau) * 100)}%`, width: `${Math.min(100, (k.xuat.th / mau) * 100)}%`, background: MAU.tim }} />
            <div className="absolute inset-y-[-2px] w-0.5 bg-foreground/60" style={{ left: `${quaThang * 100}%` }} title={`Đã qua ${pct(quaThang)} thời gian tháng`} />
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 text-[0.6875rem] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-sm" style={{ background: MAU.info }} />Nhập</span>
            <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-sm" style={{ background: MAU.tim }} />Xuất</span>
            <span className="inline-flex items-center gap-1"><i className="h-2.5 w-0.5 bg-foreground/60" />Hôm nay ({pct(quaThang)} tháng)</span>
            <span>Cả thanh = {mt ? "mục tiêu" : "KL tàu trong tháng"}</span>
          </div>
        </div>}
      chiSo={[
        [mt ? "Nhập (thực / mục tiêu)" : "Nhập thực hiện", mt ? `${nghin(k.nhap.th)} / ${nghin(mt.nhap)}` : nghin(k.nhap.th), mt && dat(k.nhap.th, mt.nhap) >= 1 ? "ok" : undefined],
        [mt ? "Xuất (thực / mục tiêu)" : "Xuất thực hiện", mt ? `${nghin(k.xuat.th)} / ${nghin(mt.xuat)}` : nghin(k.xuat.th), mt && dat(k.xuat.th, mt.xuat) >= 1 ? "ok" : undefined],
        ["Kho nhập / xuất", k.kho ? `${nghin(k.kho.nhap)} / ${nghin(k.kho.xuat)}` : "—"],
      ]} />
  );
}

const LOAI_KL = ["tuan", "thang", "quy"]; // xem theo tuần / tháng / quý
const SO_KY = { tuan: 12, thang: 12, quy: 7 }; // số kỳ gần nhất để chọn

export function HopKhoiLuong({ onClose, go }) {
  const { D, tuThang, moRongKhoang } = useApp();
  const [loai, setLoai] = useState("thang");
  const [khoa, setKhoa] = useState(() => khoaKy("thang", D.now));
  const dsK = useMemo(() => dsKy(loai, D.now, SO_KY[loai]).reverse(), [loai, D.now]); // mới → cũ
  const nhomHang = useNhomHang();
  const k = useMemo(() => tinhKy(D, loai, khoa, nhomHang), [D, loai, khoa, nhomHang]);
  const mt = k.mucTieu;
  const datKy = (l, x) => { setKhoa(x); const t = thangDauKy(l, congKy(l, x, -6)); if (t < tuThang) moRongKhoang(t); }; // tải thêm dữ liệu cho 7 kỳ của biểu đồ
  const chonKy = (x) => datKy(loai, x);
  const doiLoai = (l) => { setLoai(l); datKy(l, khoaKy(l, D.now)); };
  const tenK = TEN_LOAI_KY[loai].toLowerCase();
  const [tab, setTab] = useState("thang");
  const [huong, setHuong] = useState(""); // lọc hàng nhập / xuất cho tab Theo loại hàng và Theo bến
  const dsHuong = useMemo(() => k.ds.filter((v) => !huong || (huong === "xuat") === (v.huong === "xuat")), [k.ds, huong]);
  // Theo loại hàng: chỉ các loại hàng có trong bảng Mục tiêu sản lượng (đúng hướng đang lọc; cả hai hướng thì cộng lại)
  const dongLoai = useMemo(() => {
    const m = new Map();
    for (const r of k.theoLoai.values()) {
      if (r.mt == null || (huong && r.huong !== huong)) continue;
      const kk = plain(r.loai), x = m.get(kk) || { ten: r.loai, kl: 0, lam: 0, mt: 0 };
      x.kl += r.tau; x.lam += r.th; x.mt += r.mt; m.set(kk, x);
    }
    return [...m.values()];
  }, [k, huong]);
  // Theo bến: khối lượng các chuyến của kỳ (đúng hướng đang lọc) theo bến
  const dongBen = useMemo(() => {
    const m = new Map();
    for (const v of dsHuong) { const ten = tenBenChuyen(v) || "(chưa xếp bến)", x = m.get(ten) || { ten, kl: 0, lam: 0, mt: null }; x.kl += +v.khoi_luong || 0; x.lam += daLam(v); m.set(ten, x); }
    return [...m.values()];
  }, [dsHuong]);
  const Pt = ({ th, m }) => (m > 0 ? <span className={cn("ml-1 text-[0.6875rem]", th >= m ? "text-ok" : "text-muted-foreground")}>({pct(th / m)})</span> : null);
  return (
    <HopTQ title="Khối lượng xếp dỡ" onClose={onClose}
      description={`${tenKy(loai, khoa)} · thực hiện ${so(k.thucHien)} t${mt ? ` / mục tiêu ${so(mt.tong)} t (${pct(dat(k.thucHien, mt.tong))})` : " · chưa đặt mục tiêu"} · kỳ của chuyến tính theo ngày cập bến; thực hiện lấy ở ô "KL đã làm" của chuyến${loai !== "thang" ? "; mục tiêu cộng / chia từ mục tiêu tháng" : ""}`}
      moTrang={[["Đặt mục tiêu sản lượng", () => go("cang/muc-tieu")], ["Mở Linetime tàu cập bến", () => go("cang/linetime")]]}>
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex flex-wrap items-center gap-2">
          <TabsList>
            <TabsTrigger value="thang">Theo {tenK}</TabsTrigger>
            <TabsTrigger value="hang">Theo loại hàng</TabsTrigger>
            <TabsTrigger value="ben">Theo bến</TabsTrigger>
          </TabsList>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {tab !== "thang" && (
              <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="Hướng hàng">
                {[["", "Nhập + xuất"], ["nhap", "Hàng nhập"], ["xuat", "Hàng xuất"]].map(([h, t]) => <Button key={h} size="xs" variant={huong === h ? "secondary" : "ghost"} className={cn(huong === h && "text-primary")} aria-pressed={huong === h} onClick={() => setHuong(h)}>{t}</Button>)}
              </div>)}
            <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="Xem theo">
              {LOAI_KL.map((l) => <Button key={l} size="xs" variant={loai === l ? "secondary" : "ghost"} className={cn(loai === l && "text-primary")} aria-pressed={loai === l} onClick={() => doiLoai(l)}>{TEN_LOAI_KY[l]}</Button>)}
            </div>
            <NativeSelect className="h-8 w-52" value={khoa} onChange={(e) => chonKy(e.target.value)} options={dsK.map((x) => [x, tenKy(loai, x)])} aria-label={TEN_LOAI_KY[loai]} />
          </div>
        </div>
        <div className="mt-2 grid gap-x-6 gap-y-1 rounded-md border bg-muted/30 p-3 sm:grid-cols-2 lg:grid-cols-4">
            <Dong ten="Nhập thực hiện / mục tiêu"><b>{so(k.nhap.th)}</b> / {mt ? so(mt.nhap) : "—"} t<Pt th={k.nhap.th} m={mt?.nhap} /></Dong>
            <Dong ten="Xuất thực hiện / mục tiêu"><b>{so(k.xuat.th)}</b> / {mt ? so(mt.xuat) : "—"} t<Pt th={k.xuat.th} m={mt?.xuat} /></Dong>
            <Dong ten={`KL tàu trong ${tenK} (nhập / xuất)`}>{so(k.nhap.tau)} / {so(k.xuat.tau)} t · {k.ds.length} chuyến</Dong>
            <Dong ten="Kho nhập / xuất (sổ kho)">{k.kho ? `${so(k.kho.nhap)} / ${so(k.kho.xuat)} t` : "—"}{loai !== "thang" && k.kho ? <span className="block text-[0.6875rem] text-muted-foreground">sổ kho chỉ tải 35 ngày gần nhất</span> : null}</Dong>
        </div>
        <TabsContent value="thang"><TheoKy loai={loai} khoa={khoa} /></TabsContent>
        <TabsContent value="hang"><TheoNhom rows={dongLoai} trong={`Chưa đặt mục tiêu${huong ? ` hàng ${huong === "xuat" ? "xuất" : "nhập"}` : ""} cho loại hàng nào trong kỳ này. Biểu đồ chỉ hiện các loại hàng có trong Mục tiêu sản lượng.`} /></TabsContent>
        <TabsContent value="ben"><TheoNhom rows={dongBen} trong="Không có chuyến trong kỳ này." /></TabsContent>
      </Tabs>
    </HopTQ>
  );
}

// Cột chồng nhập / xuất thực hiện theo 7 kỳ gần nhất (tuần / tháng / quý) tính đến kỳ đang chọn; đường mục tiêu và KL tàu trong kỳ
function TheoKy({ loai, khoa }) {
  const { D, tuThang } = useApp();
  const nhomHang = useNhomHang();
  const opt = useMemo(() => {
    const daTai = khoangKy("thang", tuThang).tu; // chỉ vẽ kỳ nằm trong khoảng dữ liệu đã tải
    const ks = Array.from({ length: 7 }, (_, i) => congKy(loai, khoa, i - 6)).filter((x) => khoangKy(loai, x).tu >= daTai || x === khoa);
    const m = new Map(ks.map((t) => [t, tinhKy(D, loai, t, nhomHang)]));
    const tenK = TEN_LOAI_KY[loai].toLowerCase();
    return {
      legend: { data: ["Nhập", "Xuất", "Mục tiêu", `KL tàu trong ${tenK}`] },
      tooltip: { trigger: "axis", valueFormatter: (x) => (x == null ? "chưa đặt" : `${so(x)} t`) },
      xAxis: { type: "category", data: ks.map((t) => tenNganKy(loai, t)) },
      yAxis: { type: "value", axisLabel: { formatter: nghin } },
      series: [
        { name: "Nhập", type: "bar", stack: "th", barMaxWidth: 48, data: ks.map((t) => r2(m.get(t).nhap.th)), itemStyle: { color: MAU.info } },
        { name: "Xuất", type: "bar", stack: "th", barMaxWidth: 48, data: ks.map((t) => r2(m.get(t).xuat.th)), itemStyle: { color: MAU.tim, borderRadius: [3, 3, 0, 0] } },
        { name: "Mục tiêu", type: "line", symbol: "rect", symbolSize: 9, connectNulls: true, data: ks.map((t) => (m.get(t).mucTieu ? r2(m.get(t).mucTieu.tong) : null)), itemStyle: { color: MAU.ok }, lineStyle: { width: 2 } },
        { name: `KL tàu trong ${tenK}`, type: "line", data: ks.map((t) => r2(m.get(t).klTau)), itemStyle: { color: MAU.xam }, lineStyle: { type: "dashed" } },
      ],
    };
  }, [D, loai, khoa, tuThang, nhomHang]);
  return <EChart option={opt} height={320} />;
}

// Thanh ngang: đã làm và còn lại theo nhóm (loại hàng / bến / đại lý); mt: Map(tên nhóm chuẩn hóa -> tấn mục tiêu) vẽ thêm dấu mục tiêu
function TheoNhom({ rows, trong }) {
  const coMT = rows.some((r) => r.mt != null);
  const opt = useMemo(() => {
    const ds = [...rows].sort((a, b) => Math.max(a.kl, a.mt || 0) - Math.max(b.kl, b.mt || 0)); // lớn nhất ở trên cùng của biểu đồ ngang
    return {
      legend: { data: ["Đã làm", "Còn lại", ...(coMT ? ["Mục tiêu"] : [])] },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (x) => (x == null ? "—" : `${so(x)} t`) },
      grid: { left: 14, right: 24, top: 34, bottom: 4, containLabel: true },
      xAxis: { type: "value", axisLabel: { formatter: nghin } },
      yAxis: { type: "category", data: ds.map((r) => r.ten) },
      series: [
        { name: "Đã làm", type: "bar", stack: "a", data: ds.map((r) => r2(r.lam)), itemStyle: { color: MAU.ok }, barMaxWidth: 18 },
        { name: "Còn lại", type: "bar", stack: "a", data: ds.map((r) => r2(Math.max(0, r.kl - r.lam))), itemStyle: { color: MAU.xam, opacity: 0.45, borderRadius: [0, 3, 3, 0] }, barMaxWidth: 18 },
        ...(coMT ? [{ name: "Mục tiêu", type: "line", symbol: "diamond", symbolSize: 13, lineStyle: { opacity: 0 }, z: 5, data: ds.map((r) => (r.mt != null ? r2(r.mt) : null)), itemStyle: { color: MAU.warn } }] : []),
      ],
    };
  }, [rows, coMT]);
  if (!rows.length) return <Empty>{trong}</Empty>;
  return <EChart option={opt} height={Math.max(240, rows.length * 30 + 50)} />;
}
