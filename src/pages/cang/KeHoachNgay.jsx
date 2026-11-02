import { useState } from "react";
import { CalendarCheck, ChevronLeft, ChevronRight, FileText, FileSpreadsheet } from "lucide-react";
import { useApp } from "@/store";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/input";
import logo from "@/assets/logo_hoa_phat.png?inline";
import { CANG, duLieuKeHoachCang, xuatPdfKeHoachCang, xuatExcelKeHoachCang } from "@/lib/keHoachCang";
import { TrangThaiBadge, Empty } from "@/components/common";
import { trangThai } from "@/lib/linetime";
import { so, ngayGio, ms, DAY } from "@/lib/format";
import { moTaTB } from "@/lib/thietBi";
import { thietBiChuyen } from "@/lib/phuongAn";
import { useCau } from "./useCau";
import { tenBen, tenBenChuyen } from "./BangTauBen";
import { viTriChu } from "@/lib/tenBen";
import KhaiBaoTT, { UuTien } from "./KhaiBaoTT";

const GIO_MOC = 17; // kế hoạch ngày tính từ 17h hôm nay đến 17h hôm sau
const mocNgay = (now, lech) => { const d = new Date(now); d.setHours(GIO_MOC, 0, 0, 0); return d.getTime() + lech * DAY; };
const gioCap = (v) => ms(v.atb || v.etb);
// Chuyến thuộc kế hoạch ngày (ATB, chưa cập thì ETB, trong 24 giờ từ 17h hôm nay); dùng cả ở trang Phương án làm hàng
export const trongKeHoachNgay = (v, now, lech = 0) => { const t = gioCap(v), tu = mocNgay(now, lech); return !v.huy && t != null && t >= tu && t < tu + DAY; };

// Kế hoạch ngày tới: các chuyến cập bến (ATB, chưa cập thì ETB) trong 24 giờ kể từ 17h hôm nay,
// kèm hàng, bến, cẩu, băng tải, bãi, phương tiện, hót vét / be hầm và trạng thái khai báo.
export default function KeHoachNgay({ voyages, chiXem = false }) {
  const { D, setVoyageMo, fail } = useApp();
  const [lech, setLech] = useState(0);
  const [cang, setCang] = useState(() => { try { return localStorage.getItem("lg-kh-cang") || "hpdq"; } catch { return "hpdq"; } });
  const chonCang = (x) => { setCang(x); try { localStorage.setItem("lg-kh-cang", x); } catch { /* bỏ qua */ } };
  const tu = mocNgay(D.now, lech), den = tu + DAY;
  const ds = (voyages || D.voyages)
    .filter((v) => trongKeHoachNgay(v, D.now, lech))
    .sort((a, b) => gioCap(a) - gioCap(b));
  const tongKL = ds.reduce((s, v) => s + (+v.khoi_luong || 0), 0);
  const hangCua = (v) => ((v.hang_ds || []).length > 1 ? v.hang_ds : [{ ten_hang: v.ten_hang, loai_hang: v.loai_hang, khoi_luong: v.khoi_luong }]);
  // Bãi, xe, cẩu, băng tải, hót vét: theo phiếu chuyến (Bãi & Thiết bị)
  const cranes = useCau();
  const tbCua = (v) => thietBiChuyen(v, D.plansOf(v.id), { cranes, stops: D.stopsOf(v.id), now: D.now });
  const nho = "text-[11px] text-muted-foreground";
  // In kế hoạch điều động tàu cập / rời cảng theo biểu mẫu từng cảng, từ tất cả các chuyến (không theo bộ lọc của trang)
  const du = duLieuKeHoachCang({ voyages: D.voyages, stopsOf: D.stopsOf, tu, den });
  const chon = cang === "tat_ca" ? CANG : CANG.filter((c) => c.ma === cang);
  const tongDong = chon.reduce((s, c) => s + du.theoCang[c.ma].roi.length + du.theoCang[c.ma].cap.length + du.theoCang[c.ma].shifting.length, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle><CalendarCheck />Kế hoạch ngày tới</CardTitle>
        <CardDescription>Tàu cập bến (ATB, chưa cập thì ETB) từ {GIO_MOC}h {ngayGio(tu).slice(0, 5)} đến {GIO_MOC}h {ngayGio(den).slice(0, 5)} · {ds.length} tàu · {so(tongKL)} t · bấm vào tàu để mở phiếu chuyến</CardDescription>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          {!chiXem && <>
          <NativeSelect className="h-8 w-48" value={cang} onChange={(e) => chonCang(e.target.value)} options={[...CANG.map((c) => [c.ma, c.ten]), ["tat_ca", "Cả 3 cảng"]]} aria-label="Cảng in kế hoạch" title="Chọn cảng để in kế hoạch điều động tàu cập / rời cảng" />
          <Button size="sm" variant="outline" onClick={() => xuatPdfKeHoachCang(du, cang, logo).catch(fail)} title={`In kế hoạch điều động tàu cập / rời cảng (PDF): ${tongDong} dòng, tàu cập / rời / shifting từ ${GIO_MOC}h ${ngayGio(tu).slice(0, 5)} đến ${GIO_MOC}h ${ngayGio(den).slice(0, 5)}`}><FileText />PDF</Button>
          <Button size="sm" variant="outline" onClick={() => xuatExcelKeHoachCang(du, cang, logo).catch(fail)} title="Xuất kế hoạch điều động tàu cập / rời cảng (Excel)"><FileSpreadsheet />Excel</Button>
          </>}
          <Button size="sm" variant="outline" onClick={() => setLech(lech - 1)} aria-label="Ngày trước"><ChevronLeft /></Button>
          <Button size="sm" variant={lech ? "outline" : "secondary"} onClick={() => setLech(0)}>Từ {GIO_MOC}h hôm nay</Button>
          <Button size="sm" variant="outline" onClick={() => setLech(lech + 1)} aria-label="Ngày sau"><ChevronRight /></Button>
        </div>
      </CardHeader>
      <CardContent>
        {!chiXem && <div className="mb-2 text-xs text-muted-foreground">In PDF / Excel: kế hoạch điều động tàu cập / rời cảng theo biểu mẫu của cảng đã chọn ({tongDong} dòng: tàu rời, tàu cập, shifting trong khoảng này){du.chuaXep > 0 ? ` · ${du.chuaXep} tàu chưa xếp bến nên chưa vào phiếu` : ""}.</div>}
        {ds.length ? (
          <div className="scroll-x max-h-[65vh]">
            <table className="tbl">
              <thead><tr><th>#</th><th>Tàu</th><th>Bến</th><th>Hàng</th><th className="num">KL (t)</th><th>Cập (ATB / ETB)</th><th>Rời (ETD)</th><th>Cẩu · băng tải</th><th>Bãi</th><th>Xe vận chuyển</th><th>Hót vét / be hầm</th><th>Khai báo</th><th>Trạng thái</th></tr></thead>
              <tbody>{ds.map((v, i) => { const tb = tbCua(v); return (
                <tr key={v.id} className="cursor-pointer align-top" onClick={() => setVoyageMo(v.id)}>
                  <td className="tabular-nums text-muted-foreground">{i + 1}</td>
                  <td className="whitespace-nowrap font-medium"><UuTien v={v} />{v.ten_tau}</td>
                  <td className="font-mono">{tenBenChuyen(v) || "—"}{v.vi_tri != null && <div className={nho}>{viTriChu(v.vi_tri, v.loa)}</div>}{v.so_mang != null && <div className={nho}>{v.so_mang} máng</div>}</td>
                  <td className="min-w-[160px]">{v.huong === "xuat" ? "Xuất" : "Nhập"}{hangCua(v).map((h, j) => (
                    <div key={j} className="flex justify-between gap-2 text-xs"><span className="truncate">{h.ten_hang || h.loai_hang || "—"}</span>{hangCua(v).length > 1 && h.khoi_luong != null && <span className="tabular-nums text-muted-foreground">{so(h.khoi_luong)}</span>}</div>))}</td>
                  <td className="num">{so(v.khoi_luong)}</td>
                  <td className="whitespace-nowrap tabular-nums">{ngayGio(v.atb || v.etb)}{v.atb ? <Badge tone="ok" className="ml-1">thực tế</Badge> : <div className={nho}>dự kiến</div>}</td>
                  <td className="whitespace-nowrap tabular-nums">{ngayGio(v.atd || v.etd) || "—"}</td>
                  <td className="text-xs">{tb.cau.join(", ") || <span className="text-muted-foreground">—</span>}{tb.bangTai && <div className={nho}>Băng tải {tb.bangTai}</div>}</td>
                  <td className="min-w-[150px] text-xs">{tb.bai.length ? tb.bai.map((b, j) => <div key={j}>{b.bai}{b.khu ? ` › ${b.khu}` : ""}{b.khoi_luong != null ? <span className="tabular-nums text-muted-foreground"> {so(b.khoi_luong)} t</span> : ""}</div>) : <span className="text-muted-foreground">—</span>}</td>
                  <td className="text-xs">{moTaTB(tb.xe) || <span className="text-muted-foreground">—</span>}</td>
                  <td className="text-xs">{moTaTB(tb.hotVet) || (v.vet_ham || v.be_ham ? "" : <span className="text-muted-foreground">—</span>)}{(v.vet_ham || v.be_ham) && <div className={nho}>{v.huong === "xuat" ? "Có be hầm" : "Có vét hầm"}</div>}</td>
                  <td><KhaiBaoTT v={v} />{tb.plan && <div className={nho}>theo PA {tb.plan.ten}</div>}</td>
                  <td><TrangThaiBadge st={trangThai(v)} /></td>
                </tr>); })}</tbody>
            </table>
          </div>
        ) : <Empty>Không có tàu cập bến từ {GIO_MOC}h {ngayGio(tu).slice(0, 5)} đến {GIO_MOC}h {ngayGio(den).slice(0, 5)}.</Empty>}
      </CardContent>
    </Card>
  );
}
