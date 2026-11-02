import { useState } from "react";
import { Phone } from "lucide-react";
import { useApp } from "../../store";
import { Modal, Search } from "../../components/ui";
import { KIP_TT } from "../../lib/plan";
import { matchQ } from "../../lib/utils";

// Danh bạ tổ trưởng: tổ đi ca có tổ trưởng riêng từng kíp A / B / C, tổ hành chính chỉ một tổ trưởng (cột HC).
// Dùng cho cột SĐT của PDF / Excel theo BPSD. Quản trị sửa, các vai trò khác chỉ xem.
export default function ToTruongDialog({ onClose }) {
  const { D, api, run, isAdmin } = useApp();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState(() => {
    const cu = Object.fromEntries((D.toTruong?.list || []).map((x) => [x.to, x]));
    const ds = [...D.toList, ...Object.keys(cu).filter((t) => !D.toList.includes(t))];
    return ds.map((to) => {
      const vs = D.vehicles.filter((v) => v.to_xe === to);
      const coCa = vs.some((v) => v.che_do !== "HC"), coHc = vs.some((v) => v.che_do === "HC");
      // Cột được nhập: tổ có xe đi ca -> A/B/C, tổ có xe HC -> HC; tổ chưa có xe -> mở cả bốn cột
      const mo = { A: coCa || !vs.length, B: coCa || !vs.length, C: coCa || !vs.length, HC: coHc || !vs.length };
      const r = { to, mo };
      for (const k of KIP_TT) r[k] = { ten: cu[to]?.[k]?.ten || "", sdt: cu[to]?.[k]?.sdt || "" };
      return r;
    });
  });
  const set = (to, k, f, v) => setRows((o) => o.map((r) => (r.to === to ? { ...r, [k]: { ...r[k], [f]: v } } : r)));
  const save = async () => {
    const list = rows.map((r) => {
      const x = { to: r.to };
      for (const k of KIP_TT) { const ten = r[k].ten.replace(/\s+/g, " ").trim(), sdt = r[k].sdt.replace(/\s+/g, " ").trim(); if (ten || sdt) x[k] = { ten, sdt }; }
      return x;
    }).filter((x) => KIP_TT.some((k) => x[k]));
    if (await run(() => api.saveToTruong(list), "Đã lưu SĐT tổ trưởng")) onClose();
  };
  const hien = rows.filter((r) => matchQ(q, r.to, ...KIP_TT.map((k) => `${r[k].ten} ${r[k].sdt}`)));
  const daNhap = rows.filter((r) => KIP_TT.some((k) => r[k].sdt)).length;

  const o = (r, k) => {
    if (!r.mo[k] && !r[k].ten && !r[k].sdt) return <span className="mute">—</span>;
    if (!isAdmin) return r[k].ten || r[k].sdt ? <>{r[k].ten}<div className="mono">{r[k].sdt}</div></> : <span className="mute">Chưa nhập</span>;
    return (
      <div style={{ display: "grid", gap: 3 }}>
        <input className="inp sm" value={r[k].ten} onChange={(e) => set(r.to, k, "ten", e.target.value)} placeholder="Họ tên" style={{ width: 132 }} aria-label={`Tổ trưởng ${r.to} kíp ${k}`} />
        <input className="inp sm mono" value={r[k].sdt} onChange={(e) => set(r.to, k, "sdt", e.target.value)} placeholder="SĐT" inputMode="tel" style={{ width: 132 }} aria-label={`SĐT ${r.to} kíp ${k}`} />
      </div>
    );
  };

  return (
    <Modal width={860} onClose={onClose} title={<span className="row" style={{ gap: 8 }}><Phone size={16} />SĐT tổ trưởng</span>}
      footer={isAdmin ? <><button className="btn" onClick={onClose}>Hủy</button><button className="btn pri" onClick={save}>Lưu</button></> : <button className="btn" onClick={onClose}>Đóng</button>}>
      <div className="small mute mb">
        Số điện thoại in ở cột <b>SĐT</b> của PDF / Excel <b>theo BPSD</b>: lấy tổ trưởng của tổ xe theo <b>kíp của ca</b> đang in.
        Tổ đi ca nhập tổ trưởng từng kíp A, B, C; tổ hành chính chỉ nhập cột HC (xe HC và ca HC dùng cột này). Kíp nào để trống thì dùng tổ trưởng HC nếu có.
        {!isAdmin && " Chỉ quản trị sửa được danh bạ này."}
      </div>
      <div className="row mb" style={{ gap: 8 }}>
        <Search value={q} onChange={setQ} placeholder="Tìm tổ, tên, SĐT…" />
        <span className="small mute">Đã nhập {daNhap}/{rows.length} tổ</span>
      </div>
      <div className="tw" style={{ maxHeight: 440 }}>
        <table className="t">
          <thead><tr><th>Tổ</th>{KIP_TT.map((k) => <th key={k}>{k === "HC" ? "Hành chính" : "Kíp " + k}</th>)}</tr></thead>
          <tbody>
            {hien.map((r) => <tr key={r.to}><td className="wrap" style={{ maxWidth: 190 }}><b>{r.to}</b></td>{KIP_TT.map((k) => <td key={k}>{o(r, k)}</td>)}</tr>)}
            {!hien.length && <tr><td colSpan={5} className="mute">Không có tổ phù hợp.</td></tr>}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
