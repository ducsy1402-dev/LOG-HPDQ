import { useMemo, useState } from "react";
import { ClipboardPaste, RotateCcw, Save } from "lucide-react";
import { useApp } from "@/store";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { MucIcon } from "@/components/common";
import { tachBang } from "@/lib/paste";
import { so } from "@/lib/format";
import { KE_HOACH, docDanKeHoach } from "@/lib/keHoachTH";

// Dán nhanh / Excel cho bảng kế hoạch (xuất bán, sản xuất, nhập mua): cột đúng như bảng (Tên hàng · Tổng · Đường bộ · Đường biển; sản xuất: Tên hàng · Tổng).
// Dòng đầu là tiêu đề thì nhận cột theo tên. Bấm Lưu là GHI LUÔN các dòng vào kỳ đang chọn: hàng đã có thì cập nhật số (phân xe và phân bổ kho đã nhập giữ nguyên), hàng chưa có thì thêm; hàng khác không đụng.
export default function HopDanKeHoach({ loai, ky, nhanKy, onClose, onLuu }) {
  const { api, run } = useApp();
  const cfg = KE_HOACH[loai], bb = cfg.boBien;
  const [text, setText] = useState("");
  const [bang, setBang] = useState(null);
  const doc = (t = text) => { const b = tachBang(t); if (b.length) setBang(b); };
  const kq = useMemo(() => (bang ? docDanKeHoach(bang, loai) : null), [bang, loai]);
  const soLoi = kq ? kq.dong.filter((x) => x.loi.length).length : 0;
  const luu = async () => {
    const ghi = kq.dong.map(({ hang, bo, bien, tong }) => ({ hang, bo, bien, tong }));
    if (await run(() => api.luuKhDong(loai, ky, { ghi }), `Đã lưu ${ghi.length} dòng ${cfg.ten.toLowerCase()} ${nhanKy}`)) { onLuu(); onClose(); }
  };
  const mau = bb ? "Loại hàng\tTổng\tĐường bộ\tĐường biển\nHRC\t30000\t10000\t20000" : "Loại hàng\tTổng\nHRC\t35000";
  return (
    <Dialog onOpenChange={(o) => !o && onClose()} className="max-w-2xl" title={`Dán nhanh · ${cfg.ten} · ${nhanKy}`}
      description={bb ? "Chép bảng từ Excel (bôi đen, Ctrl+C) rồi dán vào ô dưới (Ctrl+V). Cột: Loại hàng · Tổng · Đường bộ · Đường biển (tổng lấy bộ + biển)." : "Chép bảng từ Excel (bôi đen, Ctrl+C) rồi dán vào ô dưới (Ctrl+V). Cột: Loại hàng · Tổng."}
      footer={kq && <>
        <span className={`mr-auto text-sm ${soLoi || kq.thieu.length ? "text-bad" : "text-muted-foreground"}`}>{kq.thieu.length ? `Thiếu cột: ${kq.thieu.join(", ")}` : soLoi ? `${soLoi} dòng lỗi, chưa lưu được` : `${kq.dong.length} dòng sẽ ghi vào ${nhanKy}`}</span>
        <Button variant="outline" onClick={() => { setBang(null); }}><RotateCcw />Dán lại</Button>
        <Button disabled={!kq.dong.length || soLoi > 0 || kq.thieu.length > 0} onClick={luu}><Save />Lưu {kq.dong.length} dòng</Button></>}>
      {!bang ? (
        <div className="grid gap-2">
          <Textarea rows={8} className="font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} placeholder={mau} onPaste={(e) => { const t = e.clipboardData.getData("text"); setTimeout(() => doc(t), 0); }} />
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => doc()} disabled={!text.trim()}><ClipboardPaste />Đọc bảng</Button>
            <Button variant="ghost" onClick={() => { setText(mau); doc(mau); }}>Thử với dòng mẫu</Button>
          </div>
        </div>
      ) : (
        <div className="scroll-x max-h-[55vh] rounded-md border">
          <table className="tbl text-sm">
            <thead><tr><th className="text-left">Loại hàng</th><th className="text-right">Tổng (t)</th>{bb && <><th className="text-right">Đường bộ (t)</th><th className="text-right">Đường biển (t)</th></>}<th className="text-left">Ghi chú</th></tr></thead>
            <tbody>{kq.dong.map((x, i) => (
              <tr key={i} className={x.loi.length ? "bg-bad/5" : undefined}>
                <td className="font-medium">{x.hang || <span className="text-muted-foreground">(trống)</span>}</td>
                <td className="text-right tabular-nums">{so(x.tong, 0)}</td>
                {bb && <><td className="text-right tabular-nums">{so(x.bo, 0)}</td><td className="text-right tabular-nums">{so(x.bien, 0)}</td></>}
                <td className="text-xs">{x.loi.map((m, j) => <div key={j} className="flex gap-1 text-bad"><MucIcon muc="bad" className="h-3 w-3" />{m}</div>)}{x.canh.map((m, j) => <div key={j} className="text-warn">{m}</div>)}</td>
              </tr>))}</tbody>
          </table>
        </div>)}
    </Dialog>
  );
}
