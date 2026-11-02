import { useState } from "react";
import { BookOpen, Download } from "lucide-react";
import { useApp } from "../store";
import { Modal, Seg, Search, Empty, MultiSelect } from "./ui";
import { SPEC_FIELDS } from "./VehicleDrawer";
import { matchQ, fmt, maModel } from "../lib/utils";
import { exportLookup } from "../lib/excel";

// Tra cứu thông số model và tỉ trọng hàng hóa
export default function LookupDialog({ onClose, initial = "specs" }) {
  const { D, openVehicle, fail } = useApp();
  const [tab, setTab] = useState(initial);
  const [q, setQ] = useState("");
  const [loai, setLoai] = useState([]);

  const count = (s) => D.vehicles.filter((v) => maModel(v.model) === (s.ma_model || maModel(s.model)));
  const specs = D.specs.filter((s) => (!loai.length || loai.includes(s.loai_xe)) && matchQ(q, s.model, s.ma_model, s.loai_xe));
  const hh = D.hanghoa.filter((h) => matchQ(q, h.loai_hang));
  const loaiXe = [...new Set(D.specs.map((s) => s.loai_xe).filter(Boolean))];

  const exp = () => (tab === "specs"
    ? exportLookup(D.specs.map((s) => ({ "Loại xe": s.loai_xe, "Model": s.model, "Mã model": s.ma_model, ...Object.fromEntries(SPEC_FIELDS.map((f) => [`${f[1]} (${f[2]})`, s[f[0]]])), "Số xe": count(s).length })), "Thong_so_model")
    : exportLookup(D.hanghoa.map((h) => ({ "Loại hàng": h.loai_hang, "Tỉ trọng (t/m³)": h.ti_trong })), "Ti_trong_hang_hoa")).catch(fail);

  return (
    <Modal width={1100} onClose={onClose} title={<span className="row" style={{ gap: 8 }}><BookOpen size={17} />Tra cứu dữ liệu kỹ thuật</span>}>
      <div className="row mb">
        <Seg value={tab} onChange={(v) => { setTab(v); setQ(""); }} options={[["specs", `Thông số model (${D.specs.length})`], ["hh", `Hàng hóa (${D.hanghoa.length})`]]} />
        {tab === "specs" && <MultiSelect prefix="Loại xe" value={loai} onChange={setLoai} options={loaiXe} style={{ width: 200 }} />}
        <Search value={q} onChange={setQ} placeholder={tab === "specs" ? "Tìm model…" : "Tìm loại hàng…"} style={{ flex: "1 1 200px" }} />
        <button className="btn" onClick={exp}><Download size={15} /><span className="lbl-m">Xuất Excel</span></button>
      </div>
      {tab === "specs" ? (
        specs.length ? (
          <div className="tw">
            <table className="t">
              <thead><tr><th>Model</th><th>Loại</th><th className="n">Số xe</th>{SPEC_FIELDS.map((f) => <th key={f[0]} className={f[0] === "kich_thuoc" ? "" : "n"}>{f[1]}<br /><span style={{ textTransform: "none" }}>{f[2]}</span></th>)}</tr></thead>
              <tbody>
                {specs.map((s) => {
                  const vs = count(s);
                  return (
                    <tr key={s.model}>
                      <td className="wrap" style={{ minWidth: 300, maxWidth: 380 }}><b>{s.model}</b><div className="small mono accent">{s.ma_model}</div>
                        {vs.length > 0 && <div className="chips" style={{ marginTop: 6 }}>{vs.slice(0, 12).map((v) => <button key={v.ma} className={"chip s-" + D.stateOf(v.ma)} onClick={() => openVehicle(v.ma)}><i />{v.ma}</button>)}{vs.length > 12 && <span className="small mute">+{vs.length - 12}</span>}</div>}
                      </td>
                      <td>{s.loai_xe}</td>
                      <td className="n"><b>{vs.length}</b></td>
                      {SPEC_FIELDS.map((f) => <td key={f[0]} className={f[0] === "kich_thuoc" ? "mono" : "n"}>{s[f[0]] == null ? <span className="mute">–</span> : typeof s[f[0]] === "number" ? fmt(s[f[0]], f[3] ?? 0) : s[f[0]]}</td>)}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <Empty>{D.specs.length ? "Không tìm thấy." : "Chưa có dữ liệu thông số. Chạy file SQL 4 và 5 trên Supabase."}</Empty>
      ) : (
        hh.length ? (
          <div className="tw">
            <table className="t">
              <thead><tr><th>#</th><th>Loại hàng</th><th className="n">Tỉ trọng (tấn/m³)</th><th>Mức</th></tr></thead>
              <tbody>
                {hh.map((h, i) => (
                  <tr key={h.loai_hang}>
                    <td className="mute mono">{i + 1}</td>
                    <td className="wrap">{h.loai_hang}</td>
                    <td className="n"><b>{h.ti_trong == null ? "–" : fmt(h.ti_trong, 3)}</b></td>
                    <td><div className="bar-cell"><div className="track"><i style={{ width: `${Math.min(100, (h.ti_trong || 0) / 4.5 * 100)}%`, background: "var(--accent)" }} /></div></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>{D.hanghoa.length ? "Không tìm thấy." : "Chưa có dữ liệu hàng hóa. Chạy file SQL 4 và 5 trên Supabase."}</Empty>
      )}
      {tab === "specs" && <div className="small mute" style={{ marginTop: 8 }}>Xe được khớp với thông số theo mã model (VD: PC350-8MO). Bấm vào mã xe để xem chi tiết.</div>}
    </Modal>
  );
}
