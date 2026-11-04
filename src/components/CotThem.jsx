import { useState } from "react";
import { Plus, Save, Trash2, ArrowUp } from "lucide-react";
import { useApp } from "@/store";
import { plain } from "@/lib/format";
import { Modal, Select as TSelect } from "@/thietbi/components/ui";

// Hộp quản lý cột tự thêm của một danh mục: thêm, đổi tên, đổi loại, đổi thứ tự, xóa.
// Chỉ để ghi thêm thông tin; các phép tính của web chỉ dùng cột có sẵn.
export const LOAI_COT = [["text", "Chữ"], ["so", "Số"], ["bool", "Có / không"]];
export default function CotThem({ ten, cotGoc, cot, onClose, onLuu }) {
  const { toast } = useApp();
  const [ds, setDs] = useState(() => cot.map((c) => ({ ma: c.ma, ten: c.ten, loai: c.loai })));
  const set = (i, k, v) => setDs((o) => o.map((c, j) => (j === i ? { ...c, [k]: v } : c)));
  const len = (i) => setDs((o) => { const n = [...o]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; });
  const luu = async () => {
    const sach = ds.map((c) => ({ ...c, ten: c.ten.trim() }));
    if (sach.some((c) => !c.ten)) return toast("Còn cột chưa có tên", "bad");
    const ten = [...cotGoc.map((c) => plain(c[1])), ...sach.map((c) => plain(c.ten))];
    const trung = ten.find((t, i) => ten.indexOf(t) !== i);
    if (trung) return toast(`Trùng tên cột "${sach.find((c) => plain(c.ten) === trung)?.ten}"`, "bad");
    const moc = Date.now().toString(36);
    if (await onLuu(sach.map((c, i) => ({ ma: c.ma || `c${moc}${i}`, ten: c.ten, loai: c.loai, thu_tu: i })))) onClose();
  };
  return (
    <Modal title={`Cột thêm · ${ten}`} onClose={onClose} width={620}
      footer={<><button className="btn" onClick={onClose}>Hủy</button><button className="btn pri" onClick={luu}><Save size={14} />Lưu</button></>}>
      <div className="small mute mb">Cột thêm dùng để ghi thêm thông tin cho từng dòng (hiện trên bảng, hộp sửa, Import / Xuất Excel). Các phép tính của web chỉ dùng cột có sẵn. Xóa cột chỉ ẩn cột; thêm lại cùng tên không lấy lại số cũ.</div>
      <div className="grid" style={{ display: "grid", gap: 8 }}>
        {ds.map((c, i) => (
          <div key={c.ma || "moi" + i} className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
            <input className="inp" style={{ flex: 1 }} value={c.ten} placeholder="Tên cột" onChange={(e) => set(i, "ten", e.target.value)} autoFocus={!c.ma && i === ds.length - 1} />
            <TSelect value={c.loai} onChange={(v) => set(i, "loai", v)} options={LOAI_COT} style={{ width: 130 }} />
            <button className="btn sm" disabled={!i} onClick={() => len(i)} title="Đưa lên"><ArrowUp size={13} /></button>
            <button className="btn sm danger" onClick={() => setDs((o) => o.filter((_, j) => j !== i))} title="Xóa cột"><Trash2 size={13} /></button>
          </div>))}
        {!ds.length && <div className="small mute">Chưa có cột thêm.</div>}
        <div><button className="btn sm" onClick={() => setDs((o) => [...o, { ma: "", ten: "", loai: "text" }])}><Plus size={14} />Thêm cột</button></div>
      </div>
    </Modal>
  );
}
