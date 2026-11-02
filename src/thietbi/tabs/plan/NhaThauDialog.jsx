import { useState } from "react";
import { HardHat, Plus, Trash2 } from "lucide-react";
import { useApp } from "../../store";
import { Modal, Badge } from "../../components/ui";

// Danh mục nhà thầu (đơn vị thực hiện) dùng khi gán xe nhà thầu. Quản trị sửa, các vai trò khác chỉ xem.
export default function NhaThauDialog({ list, onClose }) {
  const { api, run, isAdmin, toast, D } = useApp();
  const [rows, setRows] = useState(() => list.map((x) => ({ ten: "", lien_he: "", ghi_chu: "", dang_dung: true, ...x })));
  const set = (i, k, v) => setRows((o) => o.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  // Số dòng kế hoạch đang dùng mỗi nhà thầu (chỉ để tham khảo khi xóa)
  const dung = (ten) => (D.plan?.assignments || []).filter((a) => a.nha_thau === ten).length;
  const save = async () => {
    const clean = rows.map((r) => ({ ...r, ten: r.ten.replace(/\s+/g, " ").trim(), lien_he: r.lien_he.trim(), ghi_chu: r.ghi_chu.trim() })).filter((r) => r.ten);
    const trung = clean.map((r) => r.ten.toLowerCase()).find((t, i, a) => a.indexOf(t) !== i);
    if (trung) return toast(`Tên nhà thầu bị trùng: ${trung}`, "bad");
    if (await run(() => api.saveNhaThau(clean), "Đã lưu danh mục nhà thầu")) onClose();
  };

  return (
    <Modal width={820} onClose={onClose} title={<span className="row" style={{ gap: 8 }}><HardHat size={16} />Danh mục nhà thầu</span>}
      footer={isAdmin ? <><button className="btn" onClick={onClose}>Hủy</button><button className="btn pri" onClick={save}>Lưu</button></> : <button className="btn" onClick={onClose}>Đóng</button>}>
      <div className="small mute mb">
        Nhà thầu là <b>đơn vị thực hiện</b> khi gán xe thuê ngoài: không cần mã xe hay biển số, chỉ chọn nhà thầu và số xe.
        Bỏ dấu tích <b>Đang dùng</b> để ẩn nhà thầu khỏi hộp thoại gán xe mà vẫn giữ kế hoạch cũ.
        {!isAdmin && " Chỉ quản trị sửa được danh mục này."}
      </div>
      <div className="tw" style={{ maxHeight: 380 }}>
        <table className="t">
          <thead><tr><th>#</th><th>Tên nhà thầu *</th><th>Liên hệ</th><th>Ghi chú</th><th>Đang dùng</th><th className="n">Đã gán</th><th></th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="mono mute">{i + 1}</td>
                <td>{isAdmin ? <input className="inp sm" value={r.ten} onChange={(e) => set(i, "ten", e.target.value)} placeholder="VD: NT Bảo Hưng" style={{ width: 180 }} /> : <b>{r.ten}</b>}</td>
                <td>{isAdmin ? <input className="inp sm" value={r.lien_he} onChange={(e) => set(i, "lien_he", e.target.value)} placeholder="Người liên hệ, SĐT" style={{ width: 170 }} /> : r.lien_he}</td>
                <td>{isAdmin ? <input className="inp sm" value={r.ghi_chu} onChange={(e) => set(i, "ghi_chu", e.target.value)} style={{ width: 170 }} /> : r.ghi_chu}</td>
                <td>{isAdmin ? <input type="checkbox" checked={r.dang_dung !== false} onChange={(e) => set(i, "dang_dung", e.target.checked)} aria-label="Đang dùng" />
                  : <Badge tone={r.dang_dung !== false ? "ok" : ""} plain>{r.dang_dung !== false ? "Đang dùng" : "Tạm ngừng"}</Badge>}</td>
                <td className="n">{dung(r.ten) || ""}</td>
                <td>{isAdmin && <button className="btn ghost icon danger" onClick={() => setRows((o) => o.filter((_, j) => j !== i))} aria-label="Xóa"><Trash2 size={14} /></button>}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} className="mute">Chưa có nhà thầu.</td></tr>}
          </tbody>
        </table>
      </div>
      {isAdmin && <button className="btn sm" style={{ marginTop: 8 }} onClick={() => setRows((o) => [...o, { ten: "", lien_he: "", ghi_chu: "", dang_dung: true }])}><Plus size={14} />Thêm nhà thầu</button>}
    </Modal>
  );
}
