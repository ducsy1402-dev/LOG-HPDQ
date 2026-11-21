import { useMemo, useState } from "react";
import { Plus, Pencil, Save, X, Check } from "lucide-react";
import { ConfirmButton } from "@/thietbi/components/ui";
import { Trash2 } from "lucide-react";
import { so } from "@/lib/format";
import { docSo } from "@/lib/paste";
import { QUY_HOACH_CHUA, tenQuyHoach, loaiQuyHoach, kiemTraGianLo, tenKhu } from "@/lib/kho";

// Bảng con "Quy hoạch" của một kho / bãi (Danh mục › Khai báo & quy hoạch, anh Sỹ chốt 16/11/2026):
// mỗi dòng là một gian / lô (một dòng kho_bai) với Gian/lô · Diện tích phân bổ · Thiết bị bãi · Quy hoạch chứa (Hàng rời / Hàng kiện).
// Chỉ gian / lô đã quy hoạch ở đây mới hiện ở hai tab Kho hàng rời và Kho hàng kiện (thành phẩm).
// Quy tắc: gian / lô không trùng nhau trong cùng kho / bãi; tổng diện tích phân bổ không vượt diện tích kho / bãi.
const TRONG = { ten_khu: "", dien_tich: "", thiet_bi: "", loai_kho: "" };
const sapDong = (ds) => [...ds].sort((a, b) => String(tenKhu(a)).localeCompare(String(tenKhu(b)), "vi", { numeric: true, sensitivity: "base" }));

export default function QuyHoachBai({ bai, dong, hangHoa, coSua, onLuu, onXoa, toast }) {
  const [f, setF] = useState(TRONG);
  const [id, setId] = useState(null); // dòng đang sửa (null = thêm mới)
  const ds = useMemo(() => sapDong(dong), [dong]);
  const daPhanBo = dong.reduce((s, r) => s + (+r.dien_tich || 0), 0);
  const tong = +bai.dienTich > 0 ? +bai.dienTich : null;
  const conLai = tong != null ? tong - daPhanBo : null;
  const set = (k, v) => setF((o) => ({ ...o, [k]: v }));
  const huy = () => { setF((o) => ({ ...TRONG, loai_kho: o.loai_kho })); setId(null); };
  const sua = (r) => { setId(r.id); setF({ ten_khu: String(tenKhu(r)), dien_tich: r.dien_tich ?? "", thiet_bi: r.thiet_bi || "", loai_kho: loaiQuyHoach(r) === "trong" ? "" : loaiQuyHoach(r) }); };
  const luu = async () => {
    const dt = f.dien_tich === "" ? null : docSo(String(f.dien_tich));
    if (f.dien_tich !== "" && !Number.isFinite(dt)) return toast("Diện tích phân bổ không phải số", "bad");
    const r = { ...(id != null ? { id } : {}), ten_khu: String(f.ten_khu).trim(), dien_tich: dt };
    const loi = kiemTraGianLo(r, dong, tong);
    if (loi) return toast(loi, "bad");

    const tenBai = dong[0]?.ten_bai || bai.ten;
    if (await onLuu({ ...r, ten_bai: tenBai, thiet_bi: String(f.thiet_bi).trim() || null, loai_kho: f.loai_kho || null }, id == null)) huy();
  };
  const phanTram = tong ? Math.min(100, (daPhanBo / tong) * 100) : 0;
  return (
    <div style={{ padding: "6px 4px 10px 28px", borderLeft: "3px solid var(--accent, #6366f1)", marginLeft: 6 }}>
      <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
        <b>Quy hoạch gian / lô · {bai.ten}</b>
        <span className="small mute">
          {tong != null ? `Đã phân bổ ${so(daPhanBo)} / ${so(tong)} m² · còn ${so(Math.max(0, conLai))} m²` : `Đã phân bổ ${so(daPhanBo)} m² (kho / bãi chưa khai báo diện tích nên chưa kiểm vượt)`}
        </span>
        {tong != null && <span style={{ flex: "0 0 140px", height: 6, borderRadius: 3, background: "var(--line, #2a3042)", overflow: "hidden" }} aria-hidden>
          <span style={{ display: "block", height: "100%", width: `${phanTram}%`, background: conLai < 0 ? "var(--bad)" : phanTram > 95 ? "var(--warn)" : "var(--accent, #6366f1)" }} /></span>}
      </div>
      <div className="tw">
        <table className="t">
          <thead><tr><th>Gian / lô</th><th className="n">Diện tích phân bổ (m²)</th><th>Thiết bị bãi</th><th>Quy hoạch chứa</th>{coSua && <th className="act"></th>}</tr></thead>
          <tbody>
            {ds.map((r) => id === r.id ? (
              /* Đang sửa TẠI DÒNG: ô nhập ngay trên dòng, ✓ lưu, ✗ hủy (anh Sỹ 21/11/2026) */
              <tr key={r.id} style={{ background: "color-mix(in srgb, var(--accent, #6366f1) 10%, transparent)" }}>
                <td><input className="inp" value={f.ten_khu} placeholder="Tên gian / lô *" autoFocus onChange={(e) => set("ten_khu", e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") luu(); if (e.key === "Escape") huy(); }} aria-label="Tên gian / lô" /></td>
                <td className="n"><input className="inp num" inputMode="decimal" value={f.dien_tich} placeholder={conLai > 0 ? `≤ ${so(conLai + (+r.dien_tich || 0))}` : "m²"} onChange={(e) => set("dien_tich", e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") luu(); if (e.key === "Escape") huy(); }} aria-label="Diện tích phân bổ" /></td>
                <td><input className="inp" value={f.thiet_bi} placeholder="Cầu trục, cổng trục…" onChange={(e) => set("thiet_bi", e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") luu(); if (e.key === "Escape") huy(); }} aria-label="Thiết bị bãi" /></td>
                <td><select className="inp" value={f.loai_kho} onChange={(e) => set("loai_kho", e.target.value)} aria-label="Quy hoạch chứa">
                  <option value="">Trống</option>{QUY_HOACH_CHUA.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></td>
                <td className="act"><div className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
                  <button className="btn sm pri" onClick={luu} title="Lưu dòng (Enter)" aria-label="Lưu dòng"><Check size={13} /></button>
                  <button className="btn sm" onClick={huy} title="Hủy sửa (Esc)" aria-label="Hủy sửa"><X size={13} /></button>
                </div></td>
              </tr>
            ) : (
              <tr key={r.id}>
                <td><span className="ma" style={{ cursor: "default" }}>{tenKhu(r)}</span></td>
                <td className="n">{r.dien_tich != null && r.dien_tich !== "" ? so(r.dien_tich, 2) : ""}</td>
                <td>{r.thiet_bi || ""}</td>
                <td>{tenQuyHoach(loaiQuyHoach(r))}</td>
                {coSua && <td className="act"><div className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
                  <button className="btn sm" title="Sửa tại dòng" aria-label="Sửa quy hoạch" onClick={() => sua(r)}><Pencil size={13} /></button>
                  <ConfirmButton onConfirm={() => onXoa(r)} confirmText="Xóa?" title={`Xóa quy hoạch gian / lô ${tenKhu(r)} (sổ nhập – xuất đã ghi không mất)`}><Trash2 size={13} /></ConfirmButton>
                </div></td>}
              </tr>))}
            {!ds.length && <tr><td colSpan={coSua ? 5 : 4} className="mute">Chưa quy hoạch gian / lô nào. Kho / bãi này chưa hiện ở Kho hàng rời hay Kho hàng kiện.</td></tr>}
            {coSua && id == null && (
              <tr>
                <td><input className="inp" value={f.ten_khu} placeholder="Tên gian / lô *" onChange={(e) => set("ten_khu", e.target.value)} onKeyDown={(e) => e.key === "Enter" && luu()} /></td>
                <td className="n"><input className="inp num" inputMode="decimal" value={f.dien_tich} placeholder={conLai > 0 ? `≤ ${so(conLai)}` : "m²"} onChange={(e) => set("dien_tich", e.target.value)} onKeyDown={(e) => e.key === "Enter" && luu()} /></td>
                <td><input className="inp" value={f.thiet_bi} placeholder="Cầu trục, cổng trục…" onChange={(e) => set("thiet_bi", e.target.value)} onKeyDown={(e) => e.key === "Enter" && luu()} /></td>
                <td><select className="inp" value={f.loai_kho} onChange={(e) => set("loai_kho", e.target.value)}>
                  <option value="">Trống</option>{QUY_HOACH_CHUA.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></td>
                <td className="act"><div className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
                  <button className="btn sm pri" onClick={luu} title={id == null ? "Thêm quy hoạch gian / lô" : "Lưu sửa"}>{id == null ? <Plus size={13} /> : <Save size={13} />}{id == null ? "Quy hoạch" : "Lưu"}</button>
                  {id != null && <button className="btn sm" onClick={huy} title="Hủy sửa" aria-label="Hủy sửa"><X size={13} /></button>}
                </div></td>
              </tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
