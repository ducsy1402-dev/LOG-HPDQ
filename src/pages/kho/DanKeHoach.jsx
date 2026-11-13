import { useMemo, useRef, useState } from "react";
import { ClipboardPaste, Upload, RotateCcw, Check } from "lucide-react";
import { useApp } from "@/store";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { MucIcon } from "@/components/common";
import { tachBang, docSo } from "@/lib/paste";
import { plain, so } from "@/lib/format";

// Dán nhanh / nhập Excel KẾ HOẠCH xuất – nhập kho của kỳ đang chọn: mỗi dòng một bãi nhỏ với khối lượng nhập và khối lượng xuất.
// Chỉ đưa số vào bảng kế hoạch đang mở (chưa ghi); bấm "Lưu kế hoạch" ở hộp Kế hoạch để ghi.
// Cột nhận được (dòng đầu là tiêu đề): bãi lớn · bãi nhỏ · hàng · nhập · xuất · ghi chú. Chỉ có cột "Bãi" thì khớp theo tên bãi lớn (bãi chỉ có một bãi nhỏ) hoặc "bãi lớn › bãi nhỏ".
const COT = [
  ["bai_lon", ["bai lon", "kho", "kho/bai", "kho bai", "ten kho", "ten bai"]],
  ["bai_nho", ["bai nho", "gian", "gian/lo", "gian lo", "khu", "ten khu", "gian / lo"]],
  ["bai", ["bai"]],
  ["hang", ["hang", "hang hoa", "ten hang", "loai hang"]],
  ["nhap", ["nhap", "kl nhap", "khoi luong nhap", "nhap kho", "nhap (t)", "nhap t", "nhap tan"]],
  ["xuat", ["xuat", "kl xuat", "khoi luong xuat", "xuat kho", "xuat (t)", "xuat t", "xuat tan"]],
  ["ghi_chu", ["ghi chu", "note"]],
];
const doanCot = (c) => { const p = plain(c).replace(/[()]/g, " ").replace(/\s+/g, " ").trim(); return p ? (COT.find(([, bi]) => bi.includes(p)) || COT.find(([, bi]) => bi.some((b) => b.length > 3 && p.startsWith(b))) || [])[0] || "" : ""; };
const tenKhu = (d) => `${d.ten_bai} › ${d.ten}`;

export default function DanKeHoach({ dong, nhan, onApDung, onClose }) {
  const { toast, fail } = useApp();
  const [text, setText] = useState("");
  const [bang, setBang] = useState(null);
  const fileRef = useRef();
  const docBang = (b) => {
    if (!b.length) return toast("Chưa có dữ liệu để đọc", "warn");
    const n = Math.max(...b.map((r) => r.length));
    setBang(b.map((r) => [...r, ...Array(n - r.length).fill("")]));
  };
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
    const cot = bang[0].map(doanCot), dung = new Set(), c = cot.map((k) => (k && !dung.has(k) ? (dung.add(k), k) : ""));
    if (!c.includes("nhap") && !c.includes("xuat")) return { loiCot: "Không thấy cột Nhập hoặc Xuất ở dòng đầu. Dòng đầu phải là tiêu đề cột, ví dụ: Bãi lớn · Bãi nhỏ · Hàng · Nhập · Xuất." };
    if (!c.includes("bai_nho") && !c.includes("bai") && !c.includes("bai_lon")) return { loiCot: "Không thấy cột Bãi nhỏ (hoặc Bãi) ở dòng đầu." };
    const dsDong = bang.slice(1).filter((r) => r.some((x) => x !== "" && x != null)).map((o) => {
      const r = {}; c.forEach((k, i) => { if (k) r[k] = o[i]; });
      const lon = plain(r.bai_lon ?? ""), nho = plain(r.bai_nho ?? ""), bai = plain(r.bai ?? ""), loi = [];
      let khu = null;
      if (nho) { const ds = dong.filter((d) => plain(d.ten) === nho && (!lon || plain(d.ten_bai) === lon)); khu = ds.length === 1 ? ds[0] : null; if (ds.length > 1) loi.push(`Bãi nhỏ "${r.bai_nho}" có ở nhiều bãi lớn: thêm cột Bãi lớn`); else if (!ds.length) loi.push(`Không có bãi nhỏ "${r.bai_nho}"${lon ? ` trong ${r.bai_lon}` : ""} ở kho này`); }
      else { const t = lon || bai; const ds = dong.filter((d) => plain(d.ten_bai) === t || plain(tenKhu(d)) === t); khu = ds.length === 1 ? ds[0] : null; if (ds.length > 1) loi.push(`"${r.bai_lon ?? r.bai}" có ${ds.length} bãi nhỏ: thêm cột Bãi nhỏ`); else if (!ds.length) loi.push(`Không có bãi "${r.bai_lon ?? r.bai}" ở kho này`); }
      const so1 = (x, ten) => { if (x === "" || x == null) return null; const v = typeof x === "number" ? x : docSo(x); if (v == null || !(v >= 0)) { loi.push(`${ten} "${x}" không hợp lệ`); return null; } return v; };
      const nhap = so1(r.nhap, "Nhập"), xuat = so1(r.xuat, "Xuất");
      if (nhap == null && xuat == null && !loi.length) loi.push("Không có khối lượng nhập / xuất");
      return { khu, hang: String(r.hang ?? "").trim(), nhap, xuat, ghi_chu: String(r.ghi_chu ?? "").trim(), loi };
    });
    return { dsDong };
  }, [bang, dong]);
  const hopLe = kq?.dsDong?.filter((x) => !x.loi.length) || [];

  return (
    <Dialog onOpenChange={(o) => !o && onClose()} className="max-w-[min(1000px,calc(100vw-24px))]" title="Dán nhanh / nhập Excel kế hoạch" description={`Kế hoạch ${nhan}. Chép bảng từ Excel (Ctrl+C) rồi dán (Ctrl+V), hoặc chọn file Excel. Dòng đầu là tiêu đề: Bãi lớn · Bãi nhỏ · Hàng · Nhập · Xuất · Ghi chú (Hàng, Ghi chú có thể bỏ).`}
      footer={<>
        <span className="mr-auto text-sm text-muted-foreground">{kq?.dsDong ? `${hopLe.length} dòng hợp lệ · ${kq.dsDong.length - hopLe.length} dòng lỗi (bỏ qua)` : ""}</span>
        {bang && <Button variant="outline" onClick={() => setBang(null)}><RotateCcw />Dán lại</Button>}
        <Button disabled={!hopLe.length} onClick={() => { onApDung(hopLe); onClose(); }}><Check />Đưa {hopLe.length} dòng vào bảng</Button></>}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => { if (e.target.files[0]) docFile(e.target.files[0]); e.target.value = ""; }} />
        <Button variant="outline" onClick={() => fileRef.current.click()}><Upload />Chọn file Excel</Button>
        <span className="text-xs text-muted-foreground">Số đưa vào bảng thay số đang có của bãi nhỏ đó; chưa ghi cho tới khi bấm Lưu kế hoạch.</span>
      </div>
      {!bang ? (
        <div className="grid gap-2">
          <Textarea rows={9} className="font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} placeholder={"Bãi lớn\tBãi nhỏ\tHàng\tNhập\tXuất\nKho nóng HRC1\tGian A\tThép cuộn HRC\t5.800\t5.000"}
            onPaste={(e) => { const t = e.clipboardData.getData("text"); setTimeout(() => docBang(tachBang(t)), 0); }} />
          <div><Button onClick={() => docBang(tachBang(text))} disabled={!text.trim()}><ClipboardPaste />Đọc bảng</Button></div>
        </div>
      ) : kq.loiCot ? <div className="flex gap-1.5 text-sm text-bad"><MucIcon muc="bad" className="mt-0.5" />{kq.loiCot}</div> : (
        <div className="scroll-x max-h-[55vh] rounded-md border">
          <table className="tbl text-xs">
            <thead><tr><th>Kết quả</th><th>Bãi nhỏ</th><th>Hàng</th><th className="num">Nhập (t)</th><th className="num">Xuất (t)</th><th>Ghi chú</th></tr></thead>
            <tbody>{kq.dsDong.map((x, i) => (
              <tr key={i}>
                <td className="min-w-[160px] align-top">{x.loi.length ? x.loi.map((l, j) => <div key={j} className="flex gap-1 text-bad"><MucIcon muc="bad" className="h-3 w-3" />{l}</div>) : <span className="text-ok">Hợp lệ</span>}</td>
                <td>{x.khu ? tenKhu(x.khu) : "—"}</td><td>{x.hang}</td><td className="num">{x.nhap != null ? so(x.nhap) : ""}</td><td className="num">{x.xuat != null ? so(x.xuat) : ""}</td><td>{x.ghi_chu}</td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
    </Dialog>
  );
}
