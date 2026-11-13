import { useMemo, useRef, useState } from "react";
import { ClipboardPaste, Upload, RotateCcw, Check } from "lucide-react";
import { useApp } from "@/store";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { MucIcon } from "@/components/common";
import { tachBang, docSo, docNgayGio } from "@/lib/paste";
import { plain, so } from "@/lib/format";
import { ngayDia } from "@/lib/keHoachNgay";

// Dán nhanh / nhập Excel cho hai hộp của Mục tiêu sản lượng › Khai thác cảng (anh Sỹ yêu cầu 13/11/2026):
//   • Đặt mục tiêu: mỗi dòng Hướng · Loại hàng · Mục tiêu (t) · Ghi chú;
//   • Sản lượng thực tế: mỗi dòng Ngày · Hướng · Loại hàng · Sản lượng (t).
// Dòng đầu là tiêu đề cột. Chỉ đưa số vào bảng đang mở (chưa ghi); bấm Lưu ở bảng đó để ghi.
const TRUONG = {
  huong: ["huong", "nhap/xuat", "nhap xuat", "loai", "chieu"],
  loai: ["loai hang", "hang", "nhom hang", "nhom", "ten hang", "hang hoa", "loai hang (nhom hang)"],
  tan: ["muc tieu", "muc tieu (t)", "muc tieu t", "khoi luong", "kl", "tan", "so tan", "san luong", "san luong (t)", "san luong t", "thuc te", "thuc hien", "thuc te (t)", "thuc nhap", "thuc xuat"],
  ghi_chu: ["ghi chu", "note"],
  ngay: ["ngay", "ngay thang", "date"],
};
const doanCot = (c) => { const p = plain(c).replace(/[()]/g, " ").replace(/\s+/g, " ").trim(); return p ? Object.entries(TRUONG).find(([, bi]) => bi.includes(p))?.[0] || "" : ""; };
export const docHuong = (x) => { const p = plain(x); return /xuat/.test(p) ? "xuat" : /nhap/.test(p) ? "nhap" : null; };

// loai: "muc_tieu" | "thuc_te"; thang (thực tế): chỉ nhận ngày trong tháng này
export default function HopDanSL({ loai, thang, onApDung, onClose }) {
  const { toast, fail } = useApp();
  const tt = loai === "thuc_te";
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
  const kq = useMemo(() => {
    if (!bang) return null;
    const dung = new Set(), cot = bang[0].map(doanCot).map((k) => (k && !dung.has(k) ? (dung.add(k), k) : ""));
    const can = tt ? ["ngay", "huong", "loai", "tan"] : ["huong", "loai", "tan"];
    const thieu = can.filter((k) => !cot.includes(k));
    if (thieu.length) return { loiCot: `Dòng đầu phải là tiêu đề cột. Chưa thấy cột: ${thieu.map((k) => ({ ngay: "Ngày", huong: "Hướng (nhập / xuất)", loai: "Loại hàng", tan: tt ? "Sản lượng (t)" : "Mục tiêu (t)" })[k]).join(", ")}.` };
    const ds = bang.slice(1).filter((r) => r.some((x) => x !== "" && x != null)).map((o) => {
      const r = {}; cot.forEach((k, i) => { if (k) r[k] = o[i]; });
      const loi = [], huong = docHuong(r.huong), loaiHang = String(r.loai ?? "").trim();
      if (!huong) loi.push(`Hướng "${r.huong ?? ""}" phải là nhập hoặc xuất`);
      if (!loaiHang) loi.push("Thiếu loại hàng");
      const v = typeof r.tan === "number" ? r.tan : docSo(r.tan);
      if (v == null || !(v >= 0)) loi.push(`${tt ? "Sản lượng" : "Mục tiêu"} "${r.tan ?? ""}" không hợp lệ`);
      let ngay = null;
      if (tt) {
        const t = docNgayGio(r.ngay); ngay = t ? ngayDia(new Date(t).getTime()) : null;
        if (!ngay) loi.push(`Ngày "${r.ngay ?? ""}" không đọc được`); else if (thang && ngay.slice(0, 7) !== thang) loi.push(`Ngày ${ngay.slice(8)}/${ngay.slice(5, 7)} ngoài tháng ${thang.slice(5)}/${thang.slice(0, 4)}`);
      }
      return { huong, loai: loaiHang, tan: v, ngay, ghi_chu: String(r.ghi_chu ?? "").trim(), loi };
    });
    return { ds };
  }, [bang, tt, thang]);
  const hopLe = kq?.ds?.filter((x) => !x.loi.length) || [];
  const mau = tt ? "Ngày\tHướng\tLoại hàng\tSản lượng\n05/11\tXuất\tHRC\t4.200\n05/11\tNhập\tQuặng\t12.500" : "Hướng\tLoại hàng\tMục tiêu\nXuất\tHRC\t70.000\nNhập\tQuặng\t400.000";
  return (
    <Dialog onOpenChange={(o) => !o && onClose()} className="max-w-[min(900px,calc(100vw-24px))]" title={tt ? "Dán nhanh / Excel · sản lượng thực tế" : "Dán nhanh / Excel · mục tiêu"}
      description={`Chép bảng từ Excel (Ctrl+C) rồi dán (Ctrl+V), hoặc chọn file Excel. Dòng đầu là tiêu đề: ${tt ? "Ngày · Hướng · Loại hàng · Sản lượng" : "Hướng · Loại hàng · Mục tiêu · Ghi chú"}. Số đưa vào bảng thay số đang có của đúng ô đó; chưa ghi cho tới khi bấm Lưu.`}
      footer={<>
        <span className="mr-auto text-sm text-muted-foreground">{kq?.ds ? `${hopLe.length} dòng hợp lệ · ${kq.ds.length - hopLe.length} dòng lỗi (bỏ qua)` : ""}</span>
        {bang && <Button variant="outline" onClick={() => setBang(null)}><RotateCcw />Dán lại</Button>}
        <Button disabled={!hopLe.length} onClick={() => { onApDung(hopLe); onClose(); }}><Check />Đưa {hopLe.length} dòng vào bảng</Button></>}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => { if (e.target.files[0]) docFile(e.target.files[0]); e.target.value = ""; }} />
        <Button variant="outline" onClick={() => fileRef.current.click()}><Upload />Chọn file Excel</Button>
      </div>
      {!bang ? (
        <div className="grid gap-2">
          <Textarea rows={9} className="font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} placeholder={mau}
            onPaste={(e) => { const t = e.clipboardData.getData("text"); setTimeout(() => docBang(tachBang(t)), 0); }} />
          <div><Button onClick={() => docBang(tachBang(text))} disabled={!text.trim()}><ClipboardPaste />Đọc bảng</Button></div>
        </div>
      ) : kq.loiCot ? <div className="flex gap-1.5 text-sm text-bad"><MucIcon muc="bad" className="mt-0.5" />{kq.loiCot}</div> : (
        <div className="scroll-x max-h-[50vh] rounded-md border">
          <table className="tbl text-xs">
            <thead><tr><th>Kết quả</th>{tt && <th>Ngày</th>}<th>Hướng</th><th>Loại hàng</th><th className="num">{tt ? "Sản lượng (t)" : "Mục tiêu (t)"}</th>{!tt && <th>Ghi chú</th>}</tr></thead>
            <tbody>{kq.ds.map((x, i) => (
              <tr key={i}>
                <td className="min-w-[160px] align-top">{x.loi.length ? x.loi.map((l, j) => <div key={j} className="flex gap-1 text-bad"><MucIcon muc="bad" className="h-3 w-3" />{l}</div>) : <span className="text-ok">Hợp lệ</span>}</td>
                {tt && <td className="tabular-nums">{x.ngay ? `${x.ngay.slice(8)}/${x.ngay.slice(5, 7)}` : ""}</td>}
                <td>{x.huong === "xuat" ? "Xuất" : x.huong === "nhap" ? "Nhập" : ""}</td><td>{x.loai}</td><td className="num">{x.tan != null ? so(x.tan) : ""}</td>{!tt && <td>{x.ghi_chu}</td>}
              </tr>))}</tbody>
          </table>
        </div>
      )}
    </Dialog>
  );
}
