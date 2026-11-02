import { CalendarDays } from "lucide-react";
import { useApp } from "@/store";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { TrangThaiBadge, Empty } from "@/components/common";
import { trangThai } from "@/lib/linetime";
import { so, ngayGio, DAY } from "@/lib/format";
import { tenBen, tenBenChuyen } from "./BangTauBen";
import KhaiBaoTT, { UuTien } from "./KhaiBaoTT";

// Tàu sắp đến trong 7 ngày: chưa cập bến (dự kiến hoặc đang chờ neo), ETB / ETA trước 7 ngày tới; dùng cả ở trang Phương án làm hàng
export const laSapDen = (v, now) => { if (v.huy || !["du_kien", "cho_neo"].includes(trangThai(v))) return false; const t = new Date(v.etb || v.eta).getTime(); return !!t && t < now + 7 * DAY; };

// Tàu sắp đến trong 7 ngày, sắp theo giờ cập dự kiến
export default function SapDen({ voyages }) {
  const { D, setVoyageMo } = useApp();
  const ds = (voyages || D.voyages)
    .filter((v) => laSapDen(v, D.now))
    .sort((a, b) => String(a.etb || a.eta).localeCompare(String(b.etb || b.eta)));
  return (
    <Card>
      <CardHeader><CardTitle><CalendarDays />Tàu sắp đến (7 ngày)</CardTitle><CardDescription>{ds.length} tàu chưa cập bến · bấm vào tàu để mở phiếu chuyến</CardDescription></CardHeader>
      <CardContent>
        {ds.length ? (
          <div className="scroll-x max-h-[65vh]">
            <table className="tbl">
              <thead><tr><th>Tàu</th><th>Bến</th><th>Hàng</th><th className="num">KL (t)</th><th>ETA</th><th>Dự kiến cập</th><th>Dự kiến rời</th><th>Trạng thái</th><th>Khai báo</th></tr></thead>
              <tbody>{ds.map((v) => (
                <tr key={v.id} className="cursor-pointer" onClick={() => setVoyageMo(v.id)}>
                  <td className="whitespace-nowrap font-medium"><UuTien v={v} />{v.ten_tau}</td>
                  <td className="font-mono">{tenBenChuyen(v) || "—"}</td>
                  <td className="whitespace-nowrap">{v.huong === "xuat" ? "Xuất" : "Nhập"} {v.loai_hang}</td>
                  <td className="num">{so(v.khoi_luong)}</td>
                  <td className="whitespace-nowrap tabular-nums">{ngayGio(v.eta)}</td>
                  <td className="whitespace-nowrap tabular-nums">{ngayGio(v.etb)}</td>
                  <td className="whitespace-nowrap tabular-nums">{ngayGio(v.etd)}</td>
                  <td><TrangThaiBadge st={trangThai(v)} /></td>
                  <td><KhaiBaoTT v={v} /></td>
                </tr>))}</tbody>
            </table>
          </div>
        ) : <Empty>Không có tàu dự kiến đến trong 7 ngày.</Empty>}
      </CardContent>
    </Card>
  );
}
