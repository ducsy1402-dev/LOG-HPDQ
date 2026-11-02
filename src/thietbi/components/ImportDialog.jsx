import { useRef, useState } from "react";
import { Upload, FileSpreadsheet, Download, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { useApp } from "../store";
import { Modal, Badge } from "./ui";
import { readTable, prepareVehicles, prepareStaff, downloadTemplate, VEHICLE_COLS, STAFF_COLS } from "../lib/excel";

// Import danh mục xe / nhân sự: chỉ THÊM MỚI hoặc CẬP NHẬT theo mã, không bao giờ xóa
export default function ImportDialog({ kind, onClose }) {
  const { D, api, run, fail } = useApp();
  const isV = kind === "vehicles";
  const cols = isV ? VEHICLE_COLS : STAFF_COLS;
  const [res, setRes] = useState(null);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const nSample = isV ? 0 : D.staff.filter((s) => s.ma.startsWith("MAU-")).length;
  const [xoaMau, setXoaMau] = useState(true);
  const inp = useRef();

  const pick = async (f) => {
    if (!f) return;
    setFile(f); setRes(null);
    try {
      const t = await readTable(f);
      setRes(isV ? prepareVehicles(t, D) : prepareStaff(t, D));
    } catch (e) { fail(e); setFile(null); }
  };
  const save = async () => {
    setSaving(true);
    const clearSample = !isV && nSample > 0 && xoaMau;
    const ok = await run(async () => {
      if (res.rows.length) await (isV ? api.upsertVehicles(res.rows) : api.upsertStaff(res.rows));
      if (clearSample) await api.deleteSampleStaff();
    },
      `Đã import ${res.rows.length} ${isV ? "xe" : "nhân sự"} (${res.stats.moi} mới, ${res.stats.sua} cập nhật)${clearSample ? `, xóa ${nSample} nhân sự mẫu` : ""}`);
    setSaving(false);
    if (ok) onClose();
  };
  const hardErr = res?.errors.filter((e) => !e.includes("vẫn nạp")) || [];
  const old = isV ? D.vmap : Object.fromEntries(D.staff.map((s) => [s.ma, s]));

  return (
    <Modal width={820} onClose={onClose} title={<span className="row" style={{ gap: 8 }}><Upload size={17} />{isV ? "Import danh mục xe" : "Import nhân sự"}</span>}
      footer={<>
        <button className="btn" onClick={onClose}>Đóng</button>
        <button className="btn pri" disabled={!res || (!res.rows.length && !(nSample && xoaMau)) || saving} onClick={save}>
          <CheckCircle2 size={15} />{saving ? "Đang lưu…" : res ? `Xác nhận nạp ${res.rows.length} dòng` : "Xác nhận nạp"}
        </button>
      </>}>
      <div className="alert info mb"><Info size={16} /><div>
        Nạp file Excel (.xlsx) hoặc CSV. Dòng có <b>mã trùng</b> sẽ được <b>cập nhật</b>, mã mới sẽ được <b>thêm</b>.
        {isV ? " Xe" : " Nhân sự"} không có trong file được <b>giữ nguyên</b>, không bị xóa.
        <div className="small mute" style={{ marginTop: 4 }}>
          Cột nhận dạng: {cols.map((c) => <span key={c.key} className="mono" style={{ marginRight: 8 }}>{c.key}{c.required ? "*" : ""}</span>)}
          {isV && "· Không có cột doi thì tự suy ra từ tiền tố mã (XĐ, XL)."}
        </div>
      </div></div>

      <div className="row mb">
        <input ref={inp} type="file" accept=".xlsx,.xls,.csv" hidden style={{ display: "none" }} onChange={(e) => { pick(e.target.files[0]); e.target.value = ""; }} />
        <button className="btn pri" onClick={() => inp.current.click()}><FileSpreadsheet size={15} />Chọn file…</button>
        <button className="btn" onClick={() => downloadTemplate(kind, D).catch(fail)}><Download size={15} />Tải file mẫu{(isV ? D.vehicles : D.staff).length ? " (kèm dữ liệu hiện có)" : ""}</button>
        {file && <span className="small mute mono">{file.name}</span>}
      </div>

      {res && (
        <>
          <div className="balance">
            <div className="bal ok"><div className="d">Thêm mới</div><div className="big ok">{res.stats.moi}</div></div>
            <div className="bal info"><div className="d">Cập nhật</div><div className="big info">{res.stats.sua}</div></div>
            <div className="bal"><div className="d">Không đổi</div><div className="big">{res.stats.giu}</div></div>
            <div className="bal"><div className="d">Có trên web, không có trong file</div><div className="big mute">{res.stats.khongCo}</div></div>
            <div className={"bal " + (hardErr.length ? "bad" : "")}><div className="d">Dòng lỗi (bỏ qua)</div><div className={"big " + (hardErr.length ? "bad" : "")}>{hardErr.length}</div></div>
          </div>
          {nSample > 0 && (
            <label className="alert warn mb" style={{ cursor: "pointer" }}>
              <input type="checkbox" checked={xoaMau} onChange={(e) => setXoaMau(e.target.checked)} style={{ marginTop: 3 }} />
              <span>Xóa <b>{nSample} nhân sự mẫu</b> (mã MAU-xxxx) sau khi nạp file này. Chỉ xóa các mã mẫu, nhân sự thật không bị ảnh hưởng.</span>
            </label>
          )}
          {res.errors.length > 0 && (
            <div className="alert warn mb"><AlertTriangle size={16} /><div style={{ maxHeight: 120, overflow: "auto", width: "100%" }}>{res.errors.map((e, i) => <div key={i} className="small">{e}</div>)}</div></div>
          )}
          {res.rows.length > 0 ? (
            <div className="tw short">
              <table className="t">
                <thead><tr><th></th>{cols.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
                <tbody>
                  {res.rows.slice(0, 300).map((r) => (
                    <tr key={r.ma}>
                      <td>{old[r.ma] ? <Badge tone="info" plain>Sửa</Badge> : <Badge tone="ok" plain>Mới</Badge>}</td>
                      {cols.map((c) => {
                        const changed = old[r.ma] && (old[r.ma][c.key] ?? null) !== (r[c.key] ?? null);
                        return <td key={c.key} className={c.key === "ma" ? "mono" : ""} style={changed ? { color: "var(--info)", fontWeight: 600 } : undefined} title={changed ? `Cũ: ${old[r.ma][c.key] ?? "(trống)"}` : undefined}>{r[c.key] ?? ""}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="alert ok"><CheckCircle2 size={16} /><span>Dữ liệu trong file giống hệt dữ liệu trên web, không có gì cần nạp.</span></div>}
          {res.rows.length > 300 && <div className="small mute" style={{ marginTop: 6 }}>Hiển thị 300/{res.rows.length} dòng thay đổi.</div>}
        </>
      )}
    </Modal>
  );
}
