import { useState } from "react";
import { Settings2, Plus, ArrowUp, ArrowDown, Trash2 } from "lucide-react";
import { useApp } from "../../store";
import { Modal, Select, Badge } from "../../components/ui";
import { rulesOf, mapLoaiPt } from "../../lib/plan";

// Quản trị sửa bảng ánh xạ "Loại Phương Tiện" (file nhu cầu) -> đội xe. Quy tắc đầu tiên khớp được dùng.
export default function MapPtDialog({ demands, onClose }) {
  const { D, api, run } = useApp();
  const [rules, setRules] = useState(() => rulesOf(D.mapPt).map((r) => ({ ...r, tai_trong: r.tai_trong === "tu_dong" ? "tu_dong" : Array.isArray(r.tai_trong) ? r.tai_trong.join(",") : "" })));
  const set = (i, k, v) => setRules((o) => o.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const move = (i, d) => setRules((o) => { const n = [...o], j = i + d; if (j < 0 || j >= n.length) return o; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const clean = () => rules.filter((r) => r.tu_khoa.trim() && r.doi).map((r) => {
    const out = { tu_khoa: r.tu_khoa.trim(), doi: r.doi };
    if (r.model?.trim()) out.model = r.model.trim();
    if (r.tai_trong === "tu_dong") out.tai_trong = "tu_dong";
    else if (r.tai_trong?.trim()) out.tai_trong = r.tai_trong.split(/[,; ]+/).map((x) => x.trim().toUpperCase()).filter((x) => D.taiTrongList.includes(x));
    return out;
  });
  const lpts = [...new Set(demands.map((d) => d.loai_pt).filter(Boolean))].sort((a, b) => a.localeCompare(b, "vi"));
  const preview = clean();

  return (
    <Modal width={980} onClose={onClose} title={<span className="row" style={{ gap: 8 }}><Settings2 size={16} />Ánh xạ loại phương tiện → đội xe</span>}
      footer={<><button className="btn" onClick={onClose}>Hủy</button><button className="btn pri" onClick={async () => (await run(() => api.saveMapPt(clean()), "Đã lưu bảng ánh xạ")) && onClose()}>Lưu</button></>}>
      <div className="small mute mb">
        "Loại Phương Tiện" trong file nhu cầu được so (không phân biệt hoa thường) với <b>từ khóa</b> theo thứ tự từ trên xuống; quy tắc đầu tiên khớp được dùng.
        <b> Lọc model</b>: chỉ nhận xe có model chứa chữ này (VD Hooklift → model chứa "rác").
        <b> Tải trọng</b>: "Tự động" lấy số trong tên (VD "Nâng 10 - 15T" → 10T, 15T), hoặc ghi cố định như "3T,5T".
      </div>
      <div className="tw" style={{ maxHeight: 360 }}>
        <table className="t">
          <thead><tr><th>#</th><th>Từ khóa</th><th>Đội xe</th><th>Lọc model</th><th>Tải trọng (xe nâng)</th><th></th></tr></thead>
          <tbody>
            {rules.map((r, i) => (
              <tr key={i}>
                <td className="mono mute">{i + 1}</td>
                <td><input className="inp sm" value={r.tu_khoa} onChange={(e) => set(i, "tu_khoa", e.target.value)} style={{ width: 140 }} /></td>
                <td><Select className="inp sm" value={r.doi} onChange={(v) => set(i, "doi", v)} options={D.doiList} style={{ width: 170 }} /></td>
                <td><input className="inp sm" value={r.model || ""} onChange={(e) => set(i, "model", e.target.value)} style={{ width: 120 }} /></td>
                <td>{r.doi === "Xe nâng"
                  ? <span className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                      <Select className="inp sm" value={r.tai_trong === "tu_dong" ? "tu_dong" : r.tai_trong ? "co_dinh" : ""} onChange={(v) => set(i, "tai_trong", v === "tu_dong" ? "tu_dong" : v === "co_dinh" ? D.taiTrongList[0] : "")}
                        options={[["tu_dong", "Tự động"], ["co_dinh", "Cố định"]]} blank="Không giới hạn" style={{ width: 130 }} />
                      {r.tai_trong && r.tai_trong !== "tu_dong" && <input className="inp sm mono" value={r.tai_trong} onChange={(e) => set(i, "tai_trong", e.target.value)} placeholder="3T,5T" style={{ width: 90 }} />}
                    </span>
                  : <span className="mute">–</span>}</td>
                <td>
                  <div className="row" style={{ gap: 2, flexWrap: "nowrap" }}>
                    <button className="btn ghost icon" onClick={() => move(i, -1)} aria-label="Lên"><ArrowUp size={14} /></button>
                    <button className="btn ghost icon" onClick={() => move(i, 1)} aria-label="Xuống"><ArrowDown size={14} /></button>
                    <button className="btn ghost icon danger" onClick={() => setRules((o) => o.filter((_, j) => j !== i))} aria-label="Xóa"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="btn sm" style={{ marginTop: 8 }} onClick={() => setRules((o) => [...o, { tu_khoa: "", doi: D.doiList[0], model: "", tai_trong: "" }])}><Plus size={14} />Thêm quy tắc</button>

      {lpts.length > 0 && <>
        <div className="sec-t" style={{ marginTop: 16 }}>Kiểm tra với file nhu cầu hiện tại</div>
        <div className="row" style={{ gap: 6 }}>
          {lpts.map((l) => { const m = mapLoaiPt(l, preview, D.taiTrongList); return <Badge key={l} tone={m ? "ok" : "bad"} plain>{l} → {m ? `${m.doi}${m.model ? ` (model "${m.model}")` : ""}${m.taiTrong ? " " + m.taiTrong.join("/") : ""}` : "không khớp"}</Badge>; })}
        </div>
      </>}
    </Modal>
  );
}
