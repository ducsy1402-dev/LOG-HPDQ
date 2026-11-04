import { useMemo, useState } from "react";
import { Save } from "lucide-react";
import { useApp } from "@/store";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ngayGio, ms } from "@/lib/format";
import { useCtxXep, xepLai } from "./useXepBen";

// Xếp lại toàn bộ chuyến chưa cập thật theo nguyên tắc (ưu tiên ★, chờ lâu, ETA sớm; chia sẻ bến theo số mét): xem trước từng chuyến
// (bến, ETB, ETD cũ → mới), tick "Giữ nguyên" để chuyến đó giữ chỗ cũ (các chuyến khác xếp quanh nó), rồi lưu một lần. Chuyến đã cập thật không bị đụng.
export default function XepLaiToanBo({ onClose }) {
  const { D, api, run } = useApp();
  const ctx = useCtxXep();
  const [giu, setGiu] = useState(() => new Set());
  const kq = useMemo(() => xepLai(D.voyages, ctx, giu), [D.voyages, ctx, giu]);
  const doi = kq.filter((x) => x.doi), khongHop = kq.filter((x) => !x.r);
  const dsGiu = D.voyages.filter((v) => giu.has(v.id));
  const doiGiu = (id) => setGiu((o) => { const n = new Set(o); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const luu = async () => {
    if (await run(async () => {
      for (const { v, r } of doi) await api.updateVoyage(v.id, { ben_ma: r.ben_ma, etb: r.etb, etd: r.etd, ...(D.coSql28 ? { ben_phu: null, vi_tri: null } : {}) });
    }, `Đã xếp lại ${doi.length} chuyến`)) onClose();
  };
  const Doi = ({ cu, moi, doiGt }) => (doiGt ? <><span className="text-muted-foreground line-through">{cu || "—"}</span> → <b>{moi}</b></> : <span>{moi}</span>);
  return (
    <Dialog onOpenChange={(o) => !o && onClose()} className="max-w-5xl" title="Xếp lại toàn bộ"
      description="Xếp lại mọi chuyến chưa cập thật từ đầu: tàu ưu tiên ★ trước, rồi tàu chờ lâu hơn, rồi ETA sớm hơn; hai tàu cùng bến cùng lúc nếu đủ số mét. Tàu đã cập thật (có ATB) giữ nguyên. Xem trước rồi mới lưu; tick Giữ nguyên để chuyến đó không đổi."
      footer={<><span className="mr-auto text-sm text-muted-foreground">{doi.length} chuyến đổi · {kq.length - doi.length - khongHop.length} chuyến không đổi{khongHop.length ? ` · ${khongHop.length} không xếp được (giữ chỗ cũ)` : ""}{dsGiu.length ? ` · ${dsGiu.length} giữ nguyên` : ""}</span>
        <Button variant="outline" onClick={onClose}>Hủy</Button><Button onClick={luu} disabled={!doi.length}><Save />Lưu {doi.length} chuyến</Button></>}>
      {kq.length || dsGiu.length ? (
        <div className="scroll-x max-h-[62vh] rounded-md border">
          <table className="tbl text-xs">
            <thead><tr><th>Giữ nguyên</th><th>Thứ tự</th><th>Tàu</th><th>Hàng</th><th>ETA</th><th>Bến</th><th>ETB</th><th>ETD</th><th></th></tr></thead>
            <tbody>
              {kq.map(({ v, r, doi: d }, i) => (
                <tr key={v.id} className={d ? "bg-primary/5" : ""}>
                  <td><input type="checkbox" checked={false} onChange={() => doiGiu(v.id)} aria-label={`Giữ nguyên ${v.ten_tau}`} /></td>
                  <td className="tabular-nums">{r ? i + 1 : ""}</td><td className="font-medium">{v.uu_tien ? "★ " : ""}{v.ten_tau}</td><td>{v.loai_hang || v.ten_hang}</td><td className="whitespace-nowrap">{ngayGio(v.eta)}</td>
                  {r ? <>
                    <td><Doi cu={v.ben_ma} moi={r.ben_ma} doiGt={v.ben_ma !== r.ben_ma} /></td>
                    <td className="whitespace-nowrap"><Doi cu={ngayGio(v.etb)} moi={ngayGio(r.etb)} doiGt={ms(v.etb) !== ms(r.etb)} /></td>
                    <td className="whitespace-nowrap"><Doi cu={ngayGio(v.etd)} moi={ngayGio(r.etd)} doiGt={ms(v.etd) !== ms(r.etd)} /></td>
                    <td>{d ? <Badge tone="info">Đổi</Badge> : <span className="text-muted-foreground">Không đổi</span>}</td></>
                    : <><td colSpan={3} className="text-bad">Không bến nào hợp mớn / chiều dài / DWT: giữ chỗ cũ ({v.ben_ma || "chưa xếp"})</td><td /></>}
                </tr>))}
              {dsGiu.map((v) => (
                <tr key={v.id} className="text-muted-foreground">
                  <td><input type="checkbox" checked onChange={() => doiGiu(v.id)} aria-label={`Bỏ giữ nguyên ${v.ten_tau}`} /></td>
                  <td /><td className="font-medium">{v.uu_tien ? "★ " : ""}{v.ten_tau}</td><td>{v.loai_hang || v.ten_hang}</td><td className="whitespace-nowrap">{ngayGio(v.eta)}</td>
                  <td>{v.ben_ma || "—"}</td><td className="whitespace-nowrap">{ngayGio(v.etb)}</td><td className="whitespace-nowrap">{ngayGio(v.etd)}</td><td>Giữ nguyên</td>
                </tr>))}
            </tbody>
          </table>
        </div>
      ) : <div className="text-sm text-muted-foreground">Không có chuyến nào cần xếp (mọi chuyến đã cập thật hoặc đã hủy).</div>}
    </Dialog>
  );
}
