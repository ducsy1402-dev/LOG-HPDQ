import { useMemo, useState } from "react";
import { ClipboardPaste, RotateCcw, Save } from "lucide-react";
import { useApp } from "@/store";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { MucIcon } from "@/components/common";
import { tachBang } from "@/lib/paste";
import { so } from "@/lib/format";
import { docDanNgayBo } from "@/lib/keHoachTH";

// Dán nhanh / Excel cho bảng Xuất / nhập đường bộ của một ngày: cột Tên hàng · Hướng · Kho / bãi · Gian / lô · Khối lượng. Lưu là GHI LUÔN: các dòng dán được THÊM vào các dòng đã có của ngày đó.
export default function HopDanNgayBo({ ngay, dd, daLuu, onClose, onLuu }) {
  const { api, run } = useApp();
  const [text, setText] = useState("");
  const [bang, setBang] = useState(null);
  const doc = (t = text) => { const b = tachBang(t); if (b.length) setBang(b); };
  const kq = useMemo(() => (bang ? docDanNgayBo(bang) : null), [bang]);
  const soLoi = kq ? kq.dong.filter((x) => x.loi.length).length : 0;
  const luu = async () => {
    const them = kq.dong.map(({ hang, huong, ten_bai, ten_khu, tan }) => ({ hang, huong, ten_bai, ten_khu, tan }));
    const cu = daLuu.map((x) => ({ hang: x.hang, huong: x.huong, ten_bai: x.ten_bai, ten_khu: x.ten_khu, tan: +x.tan }));
    if (await run(() => api.luuKhNgayBo(ngay, [...cu, ...them]), `Đã thêm ${them.length} dòng vào kế hoạch đường bộ ngày ${dd.slice(0, 5)}`)) { onLuu(); onClose(); }
  };
  const mau = "Tên hàng\tHướng\tKho/bãi\tGian/lô\tKhối lượng\nThép cuộn HRC\tXuất\tKho nóng HRC1\tGian A\t1200";
  return (
    <Dialog onOpenChange={(o) => !o && onClose()} className="max-w-3xl" title={`Dán nhanh · Xuất / nhập đường bộ · ${dd}`}
      description="Chép bảng từ Excel (bôi đen, Ctrl+C) rồi dán vào ô dưới (Ctrl+V). Cột: Tên hàng · Hướng (nhập / xuất) · Kho/bãi · Gian/lô · Khối lượng."
      footer={kq && <>
        <span className={`mr-auto text-sm ${soLoi || kq.thieu.length ? "text-bad" : "text-muted-foreground"}`}>{kq.thieu.length ? `Thiếu cột: ${kq.thieu.join(", ")}` : soLoi ? `${soLoi} dòng lỗi, chưa lưu được` : `${kq.dong.length} dòng sẽ thêm vào ngày ${dd.slice(0, 5)}`}</span>
        <Button variant="outline" onClick={() => setBang(null)}><RotateCcw />Dán lại</Button>
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
            <thead><tr><th className="text-left">Tên hàng</th><th className="text-left">Hướng</th><th className="text-left">Kho / bãi</th><th className="text-left">Gian / lô</th><th className="text-right">Khối lượng (t)</th><th className="text-left">Ghi chú</th></tr></thead>
            <tbody>{kq.dong.map((x, i) => (
              <tr key={i} className={x.loi.length ? "bg-bad/5" : undefined}>
                <td className="font-medium">{x.hang || <span className="text-muted-foreground">(trống)</span>}</td>
                <td>{x.huong === "nhap" ? "Nhập" : x.huong === "xuat" ? "Xuất" : "?"}</td>
                <td>{x.ten_bai}</td><td>{x.ten_khu}</td>
                <td className="text-right tabular-nums">{so(x.tan, 0)}</td>
                <td className="text-xs">{x.loi.map((m, j) => <div key={j} className="flex gap-1 text-bad"><MucIcon muc="bad" className="h-3 w-3" />{m}</div>)}</td>
              </tr>))}</tbody>
          </table>
        </div>)}
    </Dialog>
  );
}
