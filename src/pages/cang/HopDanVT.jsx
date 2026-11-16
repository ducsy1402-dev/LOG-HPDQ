import { useMemo, useRef, useState } from "react";
import { ClipboardPaste, Upload, RotateCcw, Check } from "lucide-react";
import { useApp } from "@/store";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { MucIcon } from "@/components/common";
import { tachBang } from "@/lib/paste";
import { so } from "@/lib/format";
import { HUONG_NGAN } from "@/lib/sanLuongTT";
import { COT_DAN_VT, MAU_DAN_VT, docBangMucTieuVT, thanhDongDonVi } from "@/lib/mucTieuVT";

// Dán nhanh / Excel mục tiêu vận tải theo form bảng Excel của anh Sỹ: Loại hàng · Hướng · Loại xe · ĐVT · Tổng · Hòa Phát · Thuê ngoài · Ghi chú (không có Stt).
// Chỉ đưa số vào bảng đang mở (chưa ghi); bấm Lưu mục tiêu ở bảng để ghi. Quy tắc đọc cột: lib/mucTieuVT.js.
export default function HopDanVT({ onApDung, onClose }) {
  const { toast, fail } = useApp();
  const [text, setText] = useState("");
  const [bang, setBang] = useState(null);
  const fileRef = useRef();
  const docBang = (b) => { if (!b.length) return toast("Chưa có dữ liệu để đọc", "warn"); const n = Math.max(...b.map((r) => r.length)); setBang(b.map((r) => [...r, ...Array(n - r.length).fill("")])); };
  const docFile = async (file) => {
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer());
      const aoa = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: "" }).filter((r) => r.some((c) => c !== "" && c != null));
      docBang(aoa.map((r) => r.map((c) => (typeof c === "number" ? c : String(c)))));
    } catch (e) { fail(e); }
  };
  const kq = useMemo(() => (bang ? docBangMucTieuVT(bang) : null), [bang]);
  const hopLe = kq?.ds?.filter((x) => !x.loi.length) || [];
  return (
    <Dialog onOpenChange={(o) => !o && onClose()} className="max-w-[min(1000px,calc(100vw-24px))]" title="Dán nhanh / Excel · mục tiêu vận tải"
      description={`Chép bảng từ Excel (Ctrl+C) rồi dán (Ctrl+V), hoặc chọn file Excel. Dòng đầu là tiêu đề: ${COT_DAN_VT.map(([, t]) => t).join(" · ")}. Không cần cột Stt; ô trống hoặc "-" là không có số.`}
      footer={<>
        <span className="mr-auto text-sm text-muted-foreground">{kq?.ds ? `${hopLe.length} dòng hợp lệ · ${kq.ds.length - hopLe.length} dòng lỗi (bỏ qua)` : ""}</span>
        {bang && <Button variant="outline" onClick={() => setBang(null)}><RotateCcw />Dán lại</Button>}
        <Button disabled={!hopLe.length} onClick={() => { onApDung(thanhDongDonVi(hopLe)); onClose(); }}><Check />Đưa {hopLe.length} dòng vào bảng</Button></>}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => { if (e.target.files[0]) docFile(e.target.files[0]); e.target.value = ""; }} />
        <Button variant="outline" onClick={() => fileRef.current.click()}><Upload />Chọn file Excel</Button>
      </div>
      {!bang ? (
        <div className="grid gap-2">
          <Textarea rows={9} className="font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} placeholder={MAU_DAN_VT}
            onPaste={(e) => { const t = e.clipboardData.getData("text"); setTimeout(() => docBang(tachBang(t)), 0); }} />
          <div><Button onClick={() => docBang(tachBang(text))} disabled={!text.trim()}><ClipboardPaste />Đọc bảng</Button></div>
        </div>
      ) : kq.loiCot ? <div className="flex gap-1.5 text-sm text-bad"><MucIcon muc="bad" className="mt-0.5" />{kq.loiCot}</div> : (
        <div className="scroll-x max-h-[50vh] rounded-md border">
          <table className="tbl text-xs">
            <thead><tr><th>Kết quả</th><th>Loại hàng</th><th>Hướng</th><th>Loại xe</th><th>ĐVT</th><th className="num">Tổng</th><th className="num">Hòa Phát</th><th className="num">Thuê ngoài</th><th>Ghi chú</th></tr></thead>
            <tbody>{kq.ds.map((x, i) => (
              <tr key={i}>
                <td className="min-w-[180px] align-top">
                  {x.loi.length ? x.loi.map((l, j) => <div key={j} className="flex gap-1 text-bad"><MucIcon muc="bad" className="h-3 w-3" />{l}</div>) : <span className="text-ok">Hợp lệ</span>}
                  {x.canh.map((l, j) => <div key={"c" + j} className="flex gap-1 text-warn"><MucIcon muc="warn" className="h-3 w-3" />{l}</div>)}
                </td>
                <td>{x.hang || "Mọi hàng"}</td><td>{HUONG_NGAN[x.huong] || ""}</td><td>{x.loai}</td><td>Tấn</td>
                <td className="num">{x.tong != null ? so(x.tong) : ""}</td><td className="num">{x.hp != null ? so(x.hp) : ""}</td><td className="num">{x.tn != null ? so(x.tn) : ""}</td><td>{x.ghi_chu}</td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
    </Dialog>
  );
}
