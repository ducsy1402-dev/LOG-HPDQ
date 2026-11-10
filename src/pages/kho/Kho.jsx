import { useMemo, useState } from "react";
import { Boxes, PenLine, Pencil, ClipboardCheck, ClipboardPaste, Trash2, Bell, Package, Network, List, LineChart, CalendarRange, ChevronRight, Layers } from "lucide-react";
import { useApp } from "@/store";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHead, Empty, MucIcon, ConfirmButton } from "@/components/common";
import EChart from "@/components/EChart";
import { so, pct, r2, ngayNam, matchQ, plain } from "@/lib/format";
import { LOAI_GD, TRANG_THAI_LO, NGUONG_KHO, tonTheoNgay } from "@/lib/kho";
import { cn } from "@/lib/utils";
import { mauDay, KIEU_TONE, KIEU_NGAN, Chi, Thanh, NgayDay, ThongQua, LuuBai, T_NGAY_DAY, T_LUU_BAI, T_THONG_QUA, T_NHAP_XUAT } from "./khoUi";
import SoDoTuDuy from "./SoDoTuDuy";
import { useKho } from "./useKho";
import GiaoDichForm, { KiemKeForm, SuaKiemKe } from "./GiaoDichForm";
import DanNhanhKho from "./DanNhanhKho";
import KeHoachKho from "./KeHoachKho";
import PhanLoaiTon from "./PhanLoaiTon";

const TEN_LOAI = { thanh_pham: "Kho thành phẩm", nguyen_lieu: "Kho nguyên liệu" };
const TEN_GD = Object.fromEntries(LOAI_GD);

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
        <p className="text-[11px] text-muted-foreground">Bãi nhỏ, kiểu bãi (cố định 1 hàng / cố định nhóm / tự do), chiều cao chất đống sửa ở Danh mục › Kho bãi. Hàng nhập vào bãi lớn được xếp vào bãi nhỏ theo thứ tự: đúng hàng → khu cố định cùng nhóm → khu tự do; không khu nào nhận thì báo sai bãi. Rê chuột lên tiêu đề cột để xem cách tính.</p>
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

export default function Kho({ loai }) {
  const { D, quyen, run, api } = useApp();
  const kho = useKho();
  const [q, setQ] = useState("");
  const [form, setForm] = useState(null); // { loai } | "kiem_ke" | "dan"
  const [baiBD, setBaiBD] = useState("");
  const [moBai, setMoBai] = useState(null);
  if (!D.coSql15 || !kho) return <div className="rounded-md border border-warn/40 bg-warn/5 px-3 py-2 text-sm">Phần kho bãi chưa sẵn sàng: quản trị cần chạy <b>sql/15_phuong_an_va_kho_bai.sql</b> trong Supabase.</div>;
  const tp = loai === "thanh_pham";
  const dong = kho.dong.filter((d) => d.loai === loai);
  const tenBai = new Set(dong.map((d) => d.ten_bai));
  const bai = kho.bai.filter((b) => tenBai.has(b.ten_bai));
  const lo = kho.lo.filter((l) => tenBai.has(l.ten_bai));
  const canh = kho.canh.filter((c) => tenBai.has(c.bai));
  const gd = (D.giaoDich || []).filter((g) => tenBai.has(g.ten_bai) || tenBai.has(g.den_bai)).sort((a, b) => String(b.ngay).localeCompare(String(a.ngay)) || b.id - a.id);
  const ton = dong.reduce((s, d) => s + d.ton, 0), suc = bai.reduce((s, b) => s + (b.sucChua || 0), 0);
  const nhap = quyen.kho.nhap;

  // Biểu đồ tồn 30 ngày: toàn kho hoặc một bãi
  const chon = baiBD && tenBai.has(baiBD) ? baiBD : "";
  const tonHT = chon ? bai.find((b) => b.ten_bai === chon)?.ton || 0 : ton;
  const chuoi = tonTheoNgay(tonHT, D.giaoDich || [], (b) => (chon ? b === chon : tenBai.has(b)), 30, D.now);
  const scBD = chon ? bai.find((b) => b.ten_bai === chon)?.sucChua : suc;
  const optBD = {
    tooltip: { trigger: "axis", valueFormatter: (x) => `${so(x)} t` },
    legend: { data: ["Tồn", ...(scBD ? ["Sức chứa"] : [])] },
    xAxis: { type: "category", data: chuoi.map(([t]) => ngayNam(t).slice(0, 5)) },
    yAxis: { type: "value" },
    series: [
      { name: "Tồn", type: "line", smooth: true, areaStyle: { opacity: 0.15 }, data: chuoi.map(([, v]) => r2(v)), itemStyle: { color: "#06b6d4" } },
      ...(scBD ? [{ name: "Sức chứa", type: "line", data: chuoi.map(() => r2(scBD)), lineStyle: { type: "dashed" }, symbol: "none", itemStyle: { color: "#f43f5e" } }] : []),
    ],
  };

  return (
    <>
      <PageHead title={TEN_LOAI[loai]} desc={`Tồn luôn tính từ sổ nhập – xuất. Sức chứa = sức chứa khả dụng của gian / lô ở Danh mục › Kho bãi; để trống thì tính diện tích × chiều cao × tỷ khối hàng. Vàng từ ${pct(NGUONG_KHO.vang)}, đỏ từ ${pct(NGUONG_KHO.do)} lấp đầy.`}>
        {nhap && <>
          <Button size="sm" onClick={() => setForm({ loai: "nhap" })}><PenLine />Nhập liệu</Button>
          <Button size="sm" variant="outline" onClick={() => setForm("kiem_ke")}><ClipboardCheck />Kiểm kê</Button>
          <Button size="sm" variant="outline" onClick={() => setForm("dan")}><ClipboardPaste />Dán nhanh / Excel</Button>
        </>}
      </PageHead>


      {canh.length > 0 && <DaiCanhBaoKho ds={canh} />}

      <Tabs defaultValue="so-do" className="mt-3">
        <TabsList>
          <TabsTrigger value="so-do"><Network />Sơ đồ bãi</TabsTrigger>
          <TabsTrigger value="ton"><List />Tồn theo bãi nhỏ</TabsTrigger>
          {tp && <TabsTrigger value="lo"><Package />Lô thành phẩm ({lo.length})</TabsTrigger>}
          <TabsTrigger value="so"><Boxes />Sổ nhập – xuất</TabsTrigger>
          <TabsTrigger value="bd"><LineChart />Biểu đồ tồn</TabsTrigger>
          <TabsTrigger value="kh"><CalendarRange />Kế hoạch Xuất/Nhập tồn</TabsTrigger>
          <TabsTrigger value="pl"><Layers />Phân loại tồn</TabsTrigger>
        </TabsList>

        <TabsContent value="so-do">
          {bai.length || quyen.kho.quanTri ? (
            <SoDoTuDuy bai={bai} kho={kho} ten={TEN_LOAI[loai]} tp={tp} loai={loai} onMo={setMoBai} coSua={quyen.kho.quanTri} />
          ) : <Empty>Chưa có bãi {tp ? "thành phẩm" : "nguyên liệu"}. Thêm ở Danh mục › Kho bãi (loại kho tự theo nhóm hàng, sửa được).</Empty>}
        </TabsContent>

        <TabsContent value="ton">
          <Card><CardContent className="pt-4">
            <Input className="mb-2 w-56" placeholder="Tìm bãi, hàng…" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="scroll-x max-h-[60vh]">
              <table className="tbl">
                <thead><tr><th>Bãi lớn</th><th>Bãi nhỏ</th><th>Hàng đang chứa</th><th className="num">Tồn (t)</th><th className="num">Sức chứa (t)</th><th className="min-w-[140px]">Lấp đầy</th>{!tp && <><th className="num">Tiêu thụ / ngày</th><th className="num">Ngày cấp</th></>}<th>Cách tính sức chứa</th></tr></thead>
                <tbody>{dong.filter((d) => matchQ(q, d.ten_bai, d.ten, d.hang, ...d.chua.map((c) => c.hang))).map((d, i) => (
                  <tr key={i} className={cn(d.saiBai && "bg-bad/5")}>
                    <td className="font-medium">{d.ten_bai}</td><td>{d.ten}{d.saiBai ? <Badge tone="bad" className="ml-1">Sai bãi</Badge> : d.kieu !== "co_dinh_hang" && <Badge tone={KIEU_TONE[d.kieu]} className="ml-1">{KIEU_NGAN[d.kieu]}</Badge>}</td><td className="text-xs">{d.chua.length ? d.chua.map((c) => c.hang).join(", ") : <span className="text-muted-foreground">—</span>}</td>
                    <td className={cn("num", d.ton < 0 && "text-bad")}>{so(d.ton)}</td><td className="num">{so(d.sucChua)}</td>
                    <td><div className="flex items-center gap-2"><div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className={cn("h-full", mauDay(d.lapDay))} style={{ width: `${Math.min(100, (d.lapDay ?? 0) * 100)}%` }} /></div><span className="w-12 text-right text-xs tabular-nums">{d.lapDay != null ? pct(d.lapDay) : "—"}</span></div></td>
                    {!tp && <><td className="num">{so(d.tieuThu)}</td><td className={cn("num", d.ngayCap < NGUONG_KHO.ngayCapDo ? "text-bad" : d.ngayCap < NGUONG_KHO.ngayCapVang ? "text-warn" : "")}>{d.ngayCap != null ? so(d.ngayCap, 1) : "—"}</td></>}
                    <td className="text-xs text-muted-foreground">{d.cachTinh}</td>
                  </tr>))}</tbody>
              </table>
            </div>
          </CardContent></Card>
        </TabsContent>

        {tp && (
          <TabsContent value="lo">
            <Card><CardContent className="pt-4">
              {lo.length ? (
                <div className="scroll-x max-h-[60vh]">
                  <table className="tbl">
                    <thead><tr><th>Số lô</th><th>Hàng</th><th>Bãi</th><th>Ngày nhập</th><th className="num">Tuổi tồn (ngày)</th><th className="num">Tồn (t)</th><th>Tình trạng</th><th>Ghi chú</th></tr></thead>
                    <tbody>{lo.sort((a, b) => (b.tuoi ?? 0) - (a.tuoi ?? 0)).map((l) => (
                      <tr key={l.so_lo + l.ten_bai}>
                        <td className="font-mono">{l.so_lo}</td><td>{l.hang}</td><td>{l.ten_bai}</td><td className="tabular-nums">{ngayNam(l.ngay_nhap)}</td>
                        <td className={cn("num", l.tuoi > NGUONG_KHO.tonLauNgay && "font-semibold text-warn")}>{l.tuoi}</td><td className="num">{so(l.ton)}</td>
                        <td>{nhap ? <NativeSelect className="h-8 w-36" value={l.trang_thai} options={Object.entries(TRANG_THAI_LO).map(([k, t]) => [k, t.ten])}
                          onChange={(e) => run(() => api.saveLo([{ so_lo: l.so_lo, hang: l.hang, ngay_nhap: l.ngay_nhap, trang_thai: e.target.value }]), `Đã đổi tình trạng lô ${l.so_lo}`)} />
                          : <Badge tone={TRANG_THAI_LO[l.trang_thai].tone}>{TRANG_THAI_LO[l.trang_thai].ten}</Badge>}</td>
                        <td className="text-xs text-muted-foreground">{l.ghi_chu}</td>
                      </tr>))}</tbody>
                  </table>
                </div>
              ) : <Empty>Chưa có lô thành phẩm nào còn tồn. Nhập thành phẩm kèm số lô ở nút Nhập.</Empty>}
            </CardContent></Card>
          </TabsContent>
        )}

        <TabsContent value="so">
          <Card><CardContent className="pt-4">
            <div className="mb-2 text-xs text-muted-foreground">Các lượt trong 35 ngày gần nhất, mới nhất ở trên.</div>
            {gd.length ? (
              <div className="scroll-x max-h-[60vh]">
                <table className="tbl">
                  <thead><tr><th>Ngày</th><th>Ca</th><th>Loại</th><th>Bãi</th><th>Hàng</th><th className="num">Số lượng (t)</th>{tp && <th>Lô</th>}<th>Nguồn / chuyến</th><th>Chứng từ, ghi chú</th>{nhap && <th></th>}</tr></thead>
                  <tbody>{gd.slice(0, 400).map((g) => (
                    <tr key={g.id}>
                      <td className="whitespace-nowrap tabular-nums">{ngayNam(g.ngay)}</td><td>{g.ca}</td>
                      <td><Badge tone={g.loai === "nhap" || g.loai === "dau_ky" ? "ok" : g.loai === "xuat" ? "warn" : g.loai === "kiem_ke" ? "info" : "default"}>{TEN_GD[g.loai]}</Badge></td>
                      <td>{g.ten_bai}{g.den_bai ? ` → ${g.den_bai}` : ""}</td><td>{g.hang}</td>
                      <td className={cn("num", g.loai === "xuat" && "text-warn")}>{g.loai === "xuat" ? "−" : ""}{so(g.so_luong, 2)}</td>
                      {tp && <td className="font-mono text-xs">{g.so_lo}</td>}
                      <td className="text-xs">{g.voyage_id ? D.vmap.get(g.voyage_id)?.ten_tau || "Tàu" : ""}{g.nguon && !g.voyage_id ? g.nguon === "cap_sx" ? "Cấp sản xuất" : g.nguon === "san_xuat" ? "Từ sản xuất" : g.nguon === "don_hang" ? "Đơn hàng" : "" : ""}</td>
                      <td className="max-w-[260px] truncate text-xs text-muted-foreground" title={[g.chung_tu, g.ghi_chu].filter(Boolean).join(" · ")}>{[g.chung_tu, g.ghi_chu].filter(Boolean).join(" · ")}</td>
                      {nhap && <td className="whitespace-nowrap"><Button size="icon" variant="ghost" className="h-7 w-7" title="Sửa lượt này" aria-label="Sửa lượt này" onClick={() => setForm({ loai: g.loai, sua: g })}><Pencil /></Button>{quyen.kho.quanLy && <ConfirmButton confirmText="Xóa?" onConfirm={() => run(() => api.deleteGiaoDich(g.id), "Đã xóa lượt")}><Trash2 /></ConfirmButton>}</td>}
                    </tr>))}</tbody>
                </table>
              </div>
            ) : <Empty>Chưa có lượt nhập – xuất. Bấm Nhập, hoặc Dán nhanh / Excel để nạp cả bảng (kể cả tồn đầu kỳ).</Empty>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="bd">
          <Card>
            <CardHeader><CardTitle><LineChart />Tồn 30 ngày</CardTitle>
              <NativeSelect className="ml-auto h-8 w-56" value={chon} onChange={(e) => setBaiBD(e.target.value)} placeholder={`Toàn ${TEN_LOAI[loai].toLowerCase()}`} options={bai.map((b) => b.ten_bai)} /></CardHeader>
            <CardContent><EChart option={optBD} height={300} /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kh">
          <Card><CardContent className="pt-4"><KeHoachKho loai={loai} kho={kho} /></CardContent></Card>
        </TabsContent>

        <TabsContent value="pl">
          <Card><CardContent className="pt-4"><PhanLoaiTon loai={loai} kho={kho} /></CardContent></Card>
        </TabsContent>
      </Tabs>

      {form && typeof form === "object" && (form.sua?.loai === "kiem_ke" ? <SuaKiemKe g={form.sua} onClose={() => setForm(null)} /> : <GiaoDichForm key={form.sua?.id ?? "moi"} loaiKho={loai} loaiGD={form.loai} sua={form.sua} kho={kho} onClose={() => setForm(null)} />)}
      {form === "kiem_ke" && <KiemKeForm loaiKho={loai} kho={kho} onClose={() => setForm(null)} />}
      {form === "dan" && <DanNhanhKho loaiKho={loai} kho={kho} onClose={() => setForm(null)} />}
      {moBai && kho.bai.some((b) => b.ten_bai === moBai) && <ChiTietBai b={kho.bai.find((b) => b.ten_bai === moBai)} kho={kho} onClose={() => setMoBai(null)} />}
    </>
  );
}
