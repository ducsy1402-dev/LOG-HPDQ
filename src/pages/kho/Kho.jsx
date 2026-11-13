import { useEffect, useMemo, useState } from "react";
import { Bell, ChevronRight, CalendarRange, Eye, PenLine, History, Layers, MoreHorizontal, ClipboardCheck, ClipboardPaste, Package, List, Network, Warehouse, Boxes } from "lucide-react";
import { useApp } from "@/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/menu";
import { PageHead, Empty, MucIcon } from "@/components/common";
import { so, pct } from "@/lib/format";
import { NGUONG_KHO, TAB_KHO, locKhoTheoTab } from "@/lib/kho";
import { cn } from "@/lib/utils";
import { KIEU_TONE, KIEU_NGAN, Chi, Thanh, NgayDay, ThongQua, LuuBai, T_NGAY_DAY, T_LUU_BAI, T_THONG_QUA, T_NHAP_XUAT } from "./khoUi";
import SoDoKhoBai from "./SoDoKhoBai";
import BieuDoTon from "./BieuDoTon";
import { useKho } from "./useKho";
import GiaoDichForm, { KiemKeForm, SuaKiemKe } from "./GiaoDichForm";
import DanNhanhKho from "./DanNhanhKho";
import KeHoachKho from "./KeHoachKho";
import PhanLoaiTon from "./PhanLoaiTon";
import XemKeHoach from "./XemKeHoach";
import { LichSuKho, BangLo, BangTon } from "./BangKho";

// Chi tiết một bãi lớn: từng bãi nhỏ với kiểu, hàng đang chứa, tồn / sức chứa, lưu lượng, dự kiến đầy, lưu bãi, thông qua
export function ChiTietBai({ b, kho, onClose }) {
  const l = kho.luuLuong.bai.get(b.ten_bai);
  return (
    <Dialog onOpenChange={(o) => !o && onClose()} className="max-w-6xl" title={b.ten_bai}
      description={`${b.dong.length} bãi nhỏ${b.dienTich ? ` · ${so(b.dienTich)} m²` : ""} · tồn ${so(b.ton)} t${b.sucChua ? ` / ${so(b.sucChua)} t (${pct(b.lapDay)})` : ""}${l?.kieu ? ` · ${l.kieu.chiTiet}` : ""}`}>
      <div className="grid gap-3">
        {l && (
          <div className="grid gap-x-6 gap-y-1 rounded-md border bg-muted/30 p-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <Chi ten={`Nhập / xuất TB (${l.soNgay} ngày)`} title={T_NHAP_XUAT}><span className="text-ok">+{so(l.nhap)}</span> / <span className="text-bad">−{so(l.xuat)}</span> t/ngày</Chi>
            <Chi ten="Dự kiến đầy" title={T_NGAY_DAY}><NgayDay l={l} /></Chi>
            <Chi ten="Lưu bãi bình quân" title={T_LUU_BAI}><LuuBai l={l} /></Chi>
            <Chi ten="Thông qua TT / năng lực" title={T_THONG_QUA}><ThongQua l={l} /></Chi>
          </div>)}
        <div className="scroll-x rounded-md border">
          <table className="tbl text-xs">
            <thead><tr><th>Bãi nhỏ</th><th>Kiểu</th><th>Hàng đang chứa</th><th className="num">Diện tích (m²)</th><th className="num">Tồn (t)</th><th className="num">Sức chứa (t)</th><th className="min-w-[120px]">Lấp đầy</th>
              <th className="num" title={T_NHAP_XUAT}>Nhập / xuất TB (t/ngày)</th><th title={T_NGAY_DAY}>Dự kiến đầy</th><th className="num" title={T_LUU_BAI}>Lưu bãi</th><th title={T_THONG_QUA}>Thông qua TT / năng lực</th></tr></thead>
            <tbody>{b.dong.map((d) => {
              const k = kho.luuLuong.khu.get(d.key);
              return (
                <tr key={d.key} className={cn(d.saiBai && "bg-bad/5")}>
                  <td className="min-w-[150px] font-medium">{d.ten}</td>
                  <td className="whitespace-nowrap">{d.saiBai ? <Badge tone="bad">Sai bãi</Badge> : <Badge tone={KIEU_TONE[d.kieu]}>{KIEU_NGAN[d.kieu]}{d.kieu === "co_dinh_nhom" && d.nhomBai ? ` ${d.nhomBai}` : ""}</Badge>}</td>
                  <td className="min-w-[150px] max-w-[240px]">{d.ten === d.hang && d.chua.length <= 1 && d.kieu === "co_dinh_hang" ? <span className="text-muted-foreground">—</span> : d.chua.length ? d.chua.map((c) => <div key={c.hang} className="flex justify-between gap-2"><span className="truncate">{c.hang}</span>{d.chua.length > 1 && <span className="tabular-nums text-muted-foreground">{so(c.ton)}</span>}</div>) : <span className="text-muted-foreground">{d.hang || "Chưa có hàng"}</span>}</td>
                  <td className="num">{d.dien_tich ? so(d.dien_tich) : ""}</td>
                  <td className={cn("num font-medium", d.ton < 0 && "text-bad")}>{so(d.ton)}</td>
                  <td className="num" title={d.cachTinh}>{d.sucChua ? so(d.sucChua) : <span className="text-muted-foreground">—</span>}</td>
                  <td><div className="flex items-center gap-2"><Thanh p={d.lapDay} className="h-2 flex-1" /><span className="w-10 text-right tabular-nums">{d.lapDay != null ? pct(d.lapDay) : "—"}</span></div></td>
                  <td className="num whitespace-nowrap">{k ? <><span className="text-ok">+{so(k.nhap)}</span> / <span className="text-bad">−{so(k.xuat)}</span></> : "—"}</td>
                  <td className="whitespace-nowrap"><NgayDay l={k} /></td>
                  <td className="num whitespace-nowrap"><LuuBai l={k} /></td>
                  <td className="whitespace-nowrap"><ThongQua l={k} /></td>
                </tr>);
            })}</tbody>
          </table>
        </div>
        <p className="text-[0.6875rem] text-muted-foreground">Bãi nhỏ, kiểu bãi (cố định 1 hàng / cố định nhóm / tự do), chiều cao chất đống sửa ở Danh mục › Kho bãi. Hàng nhập vào bãi lớn được xếp vào bãi nhỏ theo thứ tự: đúng hàng → khu cố định cùng nhóm → khu tự do; không khu nào nhận thì báo sai bãi. Rê chuột lên tiêu đề cột để xem cách tính.</p>
      </div>
    </Dialog>
  );
}

// Một dòng cảnh báo kho (như dải cảnh báo ở Tổng quan): số cảnh báo / khẩn, bấm để xem danh sách
function DaiCanhBaoKho({ ds }) {
  const [mo, setMo] = useState(false);
  const khan = ds.filter((c) => c.muc === "bad").length;
  return (
    <>
      <button type="button" onClick={() => setMo(true)} className={cn("mt-3 flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-accent", khan ? "border-bad/40 bg-bad/5" : "border-warn/40 bg-warn/5")}>
        <span className={cn("inline-flex items-center gap-1.5 font-semibold", khan ? "text-bad" : "text-warn")}><Bell className="h-4 w-4" />{ds.length} cảnh báo kho{khan ? ` · ${khan} khẩn` : ""}</span>
        <span className="min-w-0 flex-1 truncate text-muted-foreground">{ds[0]?.nd}</span>
        <span className="ml-auto inline-flex items-center text-xs text-primary">Xem danh sách<ChevronRight className="h-3.5 w-3.5" /></span>
      </button>
      {mo && (
        <Dialog onOpenChange={(o) => !o && setMo(false)} className="max-w-2xl" title="Cảnh báo kho" description={`${ds.length} cảnh báo${khan ? ` · ${khan} khẩn` : ""}`}>
          <div className="grid max-h-[60vh] gap-1.5 overflow-y-auto">
            {[...ds].sort((a, b) => (a.muc === "bad" ? 0 : 1) - (b.muc === "bad" ? 0 : 1)).map((c, i) => <div key={i} className="flex items-start gap-2 text-sm"><MucIcon muc={c.muc} className="mt-0.5" />{c.nd}</div>)}
          </div>
        </Dialog>)}
    </>
  );
}

// Một nút thao tác của tab kho: biểu tượng + chữ ngắn (chữ ẩn trên màn hình hẹp, rê chuột xem tên đầy đủ)
function NutKho({ icon: Ic, ngan, title, onClick, disabled, chinh }) {
  return (
    <Button size="sm" variant={chinh ? "default" : "outline"} onClick={onClick} disabled={disabled} title={title} aria-label={title}>
      <Ic /><span className="hidden sm:inline">{ngan}</span>
    </Button>
  );
}

// Một tab kho (HRC, Thanh/Cuộn, Nguyên liệu): 5 nút thao tác (mỗi nút mở một hộp) và 3 biểu đồ (tồn theo bãi nhỏ, nhập / xuất kế hoạch – thực tế, dự báo tồn)
function KhoTab({ tab, kho }) {
  const { quyen } = useApp();
  const [mo, setMo] = useState(null); // ke-hoach | xem-kh | nhap | lich-su | phan-loai | kiem-ke | dan | lo | ton
  const [sua, setSua] = useState(null); // lượt đang sửa (mở từ Lịch sử)
  const loai = tab.loai, tp = loai === "thanh_pham", nhap = quyen.kho.nhap;
  const tenBai = useMemo(() => new Set(kho.dong.map((d) => d.ten_bai)), [kho]);
  const canh = kho.canh.filter((c) => tenBai.has(c.bai));
  const dong = () => { setMo(null); };
  const Hop = ({ id, title, description, rong = "max-w-6xl", children }) => mo === id && (
    <Dialog onOpenChange={(o) => !o && dong()} className={rong} title={title} description={description}>{children}</Dialog>);
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <NutKho icon={CalendarRange} ngan="Kế hoạch" title="Kế hoạch xuất/nhập kho (đặt kế hoạch theo tháng)" onClick={() => setMo("ke-hoach")} />
        <NutKho icon={Eye} ngan="Xem KH" title="Xem kế hoạch (so với thực tế)" onClick={() => setMo("xem-kh")} />
        <NutKho icon={PenLine} ngan="Nhập / Xuất" title={nhap ? "Xuất/nhập kho" : "Xuất/nhập kho (cần quyền nhập liệu)"} onClick={() => setMo("nhap")} disabled={!nhap} chinh />
        <NutKho icon={History} ngan="Lịch sử" title="Lịch sử xuất/nhập kho" onClick={() => setMo("lich-su")} />
        <NutKho icon={Layers} ngan="Phân loại" title="Phân loại tồn (cần giải phóng / đầu cơ)" onClick={() => setMo("phan-loai")} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button size="sm" variant="ghost" title="Thao tác khác" aria-label="Thao tác khác"><MoreHorizontal /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {nhap && <DropdownMenuItem onSelect={() => setMo("kiem-ke")}><ClipboardCheck />Kiểm kê</DropdownMenuItem>}
            {nhap && <DropdownMenuItem onSelect={() => setMo("dan")}><ClipboardPaste />Dán nhanh / Excel</DropdownMenuItem>}
            {tp && <DropdownMenuItem onSelect={() => setMo("lo")}><Package />Lô thành phẩm ({kho.lo.length})</DropdownMenuItem>}
            <DropdownMenuItem onSelect={() => setMo("ton")}><List />Bảng tồn theo bãi nhỏ</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="ml-auto text-xs text-muted-foreground">{tab.ten}: {kho.dong.length} gian / lô · tồn {so(kho.dong.reduce((s, d) => s + d.ton, 0), 0)} t</span>
      </div>

      {canh.length > 0 && <DaiCanhBaoKho ds={canh} />}
      {kho.dong.length ? <BieuDoTon loai={loai} kho={kho} /> : <Empty>Chưa có gian / lô nào của {tab.ten.toLowerCase()}. Thêm ở Danh mục › Kho bãi (hàng của kho khai ở cột Hàng đang chứa).</Empty>}

      <Hop id="ke-hoach" title={`Kế hoạch xuất/nhập kho · ${tab.ten}`} description="Kế hoạch nhập / xuất cả tháng của từng bãi nhỏ."><KeHoachKho loai={loai} kho={kho} /></Hop>
      <Hop id="xem-kh" title={`Xem kế hoạch · ${tab.ten}`} description="Kế hoạch so với thực tế theo sổ nhập – xuất."><XemKeHoach kho={kho} /></Hop>
      <Hop id="lich-su" title={`Lịch sử xuất/nhập kho · ${tab.ten}`}><LichSuKho kho={kho} loai={loai} onSua={(g) => { setMo(null); setSua(g); }} /></Hop>
      <Hop id="phan-loai" title={`Phân loại tồn · ${tab.ten}`}><PhanLoaiTon loai={loai} kho={kho} /></Hop>
      <Hop id="lo" title="Lô thành phẩm" description={`${kho.lo.length} lô còn tồn`}><BangLo kho={kho} /></Hop>
      <Hop id="ton" title={`Tồn theo bãi nhỏ · ${tab.ten}`}><BangTon kho={kho} loai={loai} /></Hop>
      {mo === "nhap" && <GiaoDichForm loaiKho={loai} loaiGD="nhap" kho={kho} onClose={dong} />}
      {mo === "kiem-ke" && <KiemKeForm loaiKho={loai} kho={kho} onClose={dong} />}
      {mo === "dan" && <DanNhanhKho loaiKho={loai} kho={kho} onClose={dong} />}
      {sua && (sua.loai === "kiem_ke" ? <SuaKiemKe g={sua} onClose={() => setSua(null)} /> : <GiaoDichForm key={sua.id} loaiKho={loai} loaiGD={sua.loai} sua={sua} kho={kho} onClose={() => setSua(null)} />)}
    </div>
  );
}

const IC_TAB = { overview: Network, hrc: Warehouse, "thanh-cuon": Warehouse, "nguyen-lieu": Boxes };
const tabTheoRoute = (r) => TAB_KHO.find((t) => `kho/${t.id}` === r)?.id || "overview";

// Khai thác kho bãi (anh Sỹ chốt 13/11/2026, thay hai trang Kho thành phẩm / Kho nguyên liệu): 4 tab
//   Overview: sơ đồ mọi kho mái che và bãi lộ thiên theo khu vực (bãi nhỏ xếp số tăng dần, chữ A–Z);
//   Kho HRC, Kho Thanh/Cuộn, Kho Nguyên liệu: 3 biểu đồ + 5 nút thao tác. Cách chia hàng cho tab: TAB_KHO ở lib/kho.js.
export default function Kho({ route = "kho" }) {
  const { D, quyen } = useApp();
  const kho = useKho();
  const [tabId, setTabId] = useState(() => tabTheoRoute(route));
  const [moBai, setMoBai] = useState(null);
  useEffect(() => { setTabId(tabTheoRoute(route)); }, [route]);
  const tab = TAB_KHO.find((t) => t.id === tabId) || TAB_KHO[0];
  const khoTab = useMemo(() => locKhoTheoTab(kho, tab), [kho, tab]);
  if (!D.coSql15 || !kho) return <div className="rounded-md border border-warn/40 bg-warn/5 px-3 py-2 text-sm">Phần kho bãi chưa sẵn sàng: quản trị cần chạy <b>sql/dung_lai/phan_1_cau_truc.sql</b> trong Supabase.</div>;

  return (
    <>
      <PageHead title="Khai thác kho bãi" desc={`Tồn luôn tính từ sổ nhập – xuất. Sức chứa = sức chứa khả dụng của gian / lô ở Danh mục › Kho bãi (để trống thì web tự tính). Vàng từ ${pct(NGUONG_KHO.vang)}, đỏ từ ${pct(NGUONG_KHO.do)} lấp đầy.`} />
      <Tabs value={tabId} onValueChange={setTabId} className="mt-3">
        <TabsList>
          {TAB_KHO.map((t) => { const Ic = IC_TAB[t.id]; return <TabsTrigger key={t.id} value={t.id}><Ic />{t.ten}</TabsTrigger>; })}
        </TabsList>

        <TabsContent value="overview">
          {kho.canh.length > 0 && <DaiCanhBaoKho ds={kho.canh} />}
          {kho.bai.length || quyen.kho.quanTri
            ? <div className="mt-3"><SoDoKhoBai bai={kho.bai} kho={kho} ten="Kho bãi" onMo={setMoBai} /></div>
            : <Empty>Chưa có kho / bãi. Thêm ở Danh mục › Kho bãi.</Empty>}
        </TabsContent>

        {TAB_KHO.filter((t) => t.loai).map((t) => (
          <TabsContent key={t.id} value={t.id}>{tabId === t.id && <KhoTab tab={t} kho={khoTab} />}</TabsContent>
        ))}
      </Tabs>
      {moBai && kho.bai.some((b) => b.ten_bai === moBai) && <ChiTietBai b={kho.bai.find((b) => b.ten_bai === moBai)} kho={kho} onClose={() => setMoBai(null)} />}
    </>
  );
}
