import { useMemo } from "react";
import { Save } from "lucide-react";
import { useApp } from "@/store";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ngayGio } from "@/lib/format";
import { useCtxXep, xepNhieu } from "./useXepBen";

// Tự xếp bến cho các chuyến chưa có bến (chưa cập thật): xem trước bến, ETB, ETD web đề xuất rồi lưu một lần.
export const chuaCoBen = (v) => !v.huy && !v.atb && !v.ben_ma;
export default function TuXepBen({ onClose }) {
  const { D, api, run } = useApp();
  const ctx = useCtxXep();
  const kq = useMemo(() => xepNhieu(D.voyages.filter(chuaCoBen), ctx), [D.voyages, ctx]);
  const duoc = kq.filter((x) => x.r);
  const luu = async () => {
    if (await run(async () => { for (const { v, r } of duoc) await api.updateVoyage(v.id, { ben_ma: r.ben_ma, etb: r.etb, etd: r.etd }); }, `Đã tự xếp bến ${duoc.length} chuyến`)) onClose();
  };
  return (
    <Dialog onOpenChange={(o) => !o && onClose()} className="max-w-3xl" title="Tự xếp bến"
      description="Các chuyến chưa có bến: web chọn bến hợp mớn, chiều dài, DWT và loại hàng thường làm, cập sớm nhất (sau ETA và sau tàu trước rời 2 giờ). ETD = ETB + 1 giờ + làm hàng + 2 giờ thủ tục + 30 phút."
      footer={<><Button variant="outline" onClick={onClose}>Hủy</Button><Button onClick={luu} disabled={!duoc.length}><Save />Lưu {duoc.length} chuyến</Button></>}>
      {kq.length ? (
        <div className="scroll-x rounded-md border">
          <table className="tbl text-xs">
            <thead><tr><th>Tàu</th><th>Hàng</th><th className="num">KL (t)</th><th>ETA</th><th>Bến</th><th>ETB</th><th>ETD</th><th>Ghi chú</th></tr></thead>
            <tbody>{kq.map(({ v, r }) => (
              <tr key={v.id}>
                <td className="font-medium">{v.ten_tau}</td><td>{v.loai_hang || v.ten_hang}</td><td className="num">{v.khoi_luong ?? ""}</td><td className="whitespace-nowrap">{ngayGio(v.eta)}</td>
                {r ? <><td className="font-semibold">{r.ben_ma}</td><td className="whitespace-nowrap">{ngayGio(r.etb)}</td><td className="whitespace-nowrap">{ngayGio(r.etd)}</td>
                  <td className="text-muted-foreground">{r.uoc.length ? `Ước ${r.uoc.map((k) => ({ dwt: "DWT", loa: "LOA", draft: "mớn", khoi_luong: "khối lượng" })[k]).join(", ")}` : ""}{r.hangKhop ? "" : " · không bến nào có loại hàng này"}</td></>
                  : <td colSpan={4} className="text-bad">Không bến nào hợp mớn / chiều dài / DWT</td>}
              </tr>))}</tbody>
          </table>
        </div>
      ) : <div className="text-sm text-muted-foreground">Không có chuyến nào chưa xếp bến.</div>}
    </Dialog>
  );
}
