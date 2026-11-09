import { useCotThem } from "./cotThemTB";
import { useState } from "react";
import { Truck, Wrench, History, Pencil, Trash2, Gauge, Plus, CheckCircle2 } from "lucide-react";
import { useApp } from "../store";
import { Drawer, Modal, StateBadge, Badge, Field, Select, Empty } from "./ui";
import EventForm from "./EventForm";
import { vn, diffDays, fmt } from "../lib/utils";
import { docSo } from "@/lib/format";

export const SPEC_FIELDS = [
  ["trong_luong_kg", "Trọng lượng bản thân", "kg"],
  ["the_tich_gau_m3", "Thể tích gầu", "m³", 2],
  ["tai_trong_nang_kg", "Tải trọng nâng", "kg"],
  ["kich_thuoc", "Kích thước D × R × C", "mm"],
  ["chieu_sau_dao_mm", "Chiều sâu đào", "mm"],
  ["chieu_cao_do_hang_mm", "Chiều cao đổ hàng", "mm"],
  ["ban_kinh_quay_mm", "Bán kính quay", "mm"],
  ["toc_do_quay_vph", "Tốc độ quay toa", "vòng/phút", 1],
  ["dung_tich_nhien_lieu", "Dung tích nhiên liệu", "lít / kWh"],
];
export const specVal = (s, [k, , u, d]) => (s[k] == null || s[k] === "" ? null : typeof s[k] === "number" ? `${fmt(s[k], d ?? 0)} ${u}` : `${s[k]} ${u}`);

export function SpecTable({ spec }) {
  const items = SPEC_FIELDS.map((f) => [f[1], specVal(spec, f)]).filter(([, v]) => v);
  return <div className="spec">{items.flatMap(([l, v]) => [<div key={l}>{l}</div>, <div key={l + "v"}>{v}</div>])}</div>;
}

export default function VehicleDrawer() {
  const { D, drawer, closeVehicle, canWrite, isAdmin, api, run } = useApp();
  const [mode, setMode] = useState(null); // 'event' | 'edit'
  const v = D?.vmap[drawer];
  if (!drawer || !D) return null;
  if (!v) return <Drawer head={<b>{drawer}</b>} onClose={closeVehicle}><Empty>Không tìm thấy xe.</Empty></Drawer>;
  const s = D.stateOf(v.ma);
  const spec = D.specOf(v);
  const evs = D.events.filter((e) => e.ma_xe === v.ma).sort((a, b) => (a.ngay_xong ? 1 : 0) - (b.ngay_xong ? 1 : 0) || b.ngay_vao.localeCompare(a.ngay_vao));
  const sameModel = D.vehicles.filter((x) => x.model === v.model).length;
  const del = async () => {
    if (D.events.some((e) => e.ma_xe === v.ma)) return alert(`Xe ${v.ma} đã có sự kiện nên không xóa được. Có thể sửa thông tin thay vì xóa.`);
    if (!confirm(`Xóa xe ${v.ma} khỏi danh mục?`)) return;
    if (await run(() => api.deleteVehicle(v.ma), `Đã xóa ${v.ma}`)) closeVehicle();
  };

  return (
    <Drawer onClose={closeVehicle} head={
      <div>
        <div className="row" style={{ gap: 8 }}>
          <span className="mono" style={{ fontSize: 20, fontWeight: 800, color: "var(--accent)" }}>{v.ma}</span>
          <StateBadge s={s} />
          <Badge tone="accent" plain>{v.che_do}</Badge>
          {v.doi === "Xe nâng" && <Badge tone={v.tai_trong ? "info" : "warn"} plain>{D.taiTrongOf(v)}</Badge>}
          {v.doi === "Xúc đào" && <Badge tone={v.thiet_bi_gan ? "info" : "warn"} plain>{D.thietBiGanOf(v)}</Badge>}
        </div>
        <div className="small mute" style={{ marginTop: 4 }}>{v.model || "Chưa có model"}</div>
      </div>
    }>
      <div className="row" style={{ marginBottom: 14 }}>
        {canWrite && <button className="btn pri sm" onClick={() => setMode("event")}><Plus size={14} />Ghi nhận hỏng / BD</button>}
        {isAdmin && <button className="btn sm" onClick={() => setMode("edit")}><Pencil size={14} />Sửa thông tin</button>}
        {isAdmin && <button className="btn sm danger" onClick={del}><Trash2 size={14} />Xóa</button>}
      </div>

      <div className="sec-t"><Truck size={14} />Thông tin xe</div>
      <div className="spec">
        <div>Đội xe</div><div>{v.doi}</div>
        <div>Tổ</div><div>{v.to_xe || "–"}</div>
        {v.doi === "Xe nâng" && <><div>Tải trọng</div><div className={v.tai_trong ? "" : "warn"}>{D.taiTrongOf(v)}</div></>}
        {v.doi === "Xúc đào" && <><div>Thiết bị gắn</div><div className={v.thiet_bi_gan ? "" : "warn"}>{D.thietBiGanOf(v)}</div></>}
        <div>Chế độ làm việc</div><div>{v.che_do}{v.che_do === "Đi ca" ? " (CA 1 ngày, CA 2 đêm)" : " (CA HC 07h30–17h, thứ 2 – thứ 7)"}</div>
        <div>Định biên</div><div>{D.dinhBienXe[v.che_do] ?? 1} người</div>
        {v.ghi_chu && <><div>Ghi chú</div><div style={{ fontFamily: "inherit", fontWeight: 400 }}>{v.ghi_chu}</div></>}
      </div>

      <div className="sec-t"><Gauge size={14} />Thông số kỹ thuật</div>
      {spec ? (
        <>
          <SpecTable spec={spec} />
          <div className="small mute" style={{ marginTop: 6 }}>Model: {spec.model} · {sameModel} xe cùng model trong đội hình</div>
        </>
      ) : <div className="alert warn"><Gauge size={16} /><span>Chưa có thông số cho model <b>{v.model || "(trống)"}</b>. Bổ sung vào bảng <span className="mono">model_specs</span>.</span></div>}

      <div className="sec-t"><History size={14} />Sự kiện 3 tháng gần đây ({evs.length})</div>
      {evs.length ? (
        <div className="timeline">
          {evs.map((e) => (
            <div className="tl-item" key={e.id}>
              <div className="row" style={{ gap: 8 }}>
                <Badge tone={e.loai === "Hỏng" ? "bad" : e.loai === "BD chiến lược" ? "orange" : "info"}>{e.loai}</Badge>
                <b>{e.nhom || ""}</b>
                <span className="spacer" />
                {e.ngay_xong ? <span className="small ok row" style={{ gap: 4 }}><CheckCircle2 size={13} />Xong {vn(e.ngay_xong)}</span> : <Badge tone="warn" plain>Đang xử lý</Badge>}
              </div>
              {e.mo_ta && <div style={{ marginTop: 4 }}>{e.mo_ta}</div>}
              <div className="small mute" style={{ marginTop: 4 }}>
                Vào {vn(e.ngay_vao)} · {diffDays(e.ngay_vao, e.ngay_xong || D.today)} ngày
                {e.ngay_du_kien && !e.ngay_xong ? ` · dự kiến ${vn(e.ngay_du_kien)}` : ""}{e.phu_tung ? ` · ${e.phu_tung}` : ""}{e.pic ? ` · ${e.pic}` : ""}
              </div>
            </div>
          ))}
        </div>
      ) : <Empty>Chưa có sự kiện nào.</Empty>}

      {mode === "event" && (
        <Modal title={<span className="row" style={{ gap: 8 }}><Wrench size={16} />Ghi nhận sự kiện · <span className="mono accent">{v.ma}</span></span>} onClose={() => setMode(null)} width={760}>
          <EventForm initialMa={v.ma} compact onDone={() => setMode(null)} />
        </Modal>
      )}
      {mode === "edit" && <VehicleForm v={v} onClose={() => setMode(null)} />}
    </Drawer>
  );
}

export function VehicleForm({ v, onClose }) {
  const { D, api, run } = useApp();
  const isNew = !v;
  const [f, setF] = useState(() => v ? { ...v, tai_trong: v.tai_trong || "", thiet_bi_gan: v.thiet_bi_gan || "" } : { ma: "", doi: D.doiList[0], model: "", to_xe: "", che_do: "Đi ca", tai_trong: "", thiet_bi_gan: "", ghi_chu: "" });
  const laXeNang = f.doi === "Xe nâng";
  const coXuong = D.vehicles.some((x) => "xuong" in x); // SQL 08: xưởng, hệ số làm việc
  const ct = useCotThem("xe", [["ma", "Mã xe"], ["doi", "Đội xe"], ["model", "Model"], ["to_xe", "Tổ"], ["che_do", "Chế độ"], ["xuong", "Xưởng"], ["he_so", "Hệ số làm việc"], ["tai_trong", "Tải trọng"], ["thiet_bi_gan", "Thiết bị gắn"], ["ghi_chu", "Ghi chú"]]);
  const laXucDao = f.doi === "Xúc đào";
  const set = (k) => (x) => setF((o) => ({ ...o, [k]: x?.target ? x.target.value : x }));
  const models = [...new Set([...D.vehicles.map((x) => x.model), ...D.specs.map((s) => s.model)].filter(Boolean))].sort();
  const save = async () => {
    const rec = { ma: f.ma.trim().toUpperCase(), doi: f.doi, model: f.model?.trim() || null, to_xe: f.to_xe?.replace(/\s+/g, " ").trim() || null, che_do: f.che_do, tai_trong: laXeNang ? f.tai_trong || null : null, thiet_bi_gan: laXucDao ? f.thiet_bi_gan || null : null, ghi_chu: f.ghi_chu?.trim() || null };
    Object.assign(rec, ct.gom(f.them));
    if (coXuong) { rec.xuong = String(f.xuong ?? "").trim() || null; const hs = docSo(f.he_so) ?? NaN; rec.he_so = String(f.he_so ?? "").trim() !== "" && Number.isFinite(hs) ? hs : null; }
    if (laXeNang && !rec.tai_trong) return alert("Xe nâng phải chọn tải trọng");
    if (!/^[A-ZĐ0-9][A-ZĐ0-9\-_.]*$/.test(rec.ma)) return alert("Mã xe chỉ gồm chữ, số, dấu gạch");
    if (isNew && D.vmap[rec.ma]) return alert(`Mã ${rec.ma} đã có trong danh mục`);
    if (await run(() => api.upsertVehicles([rec]), (isNew ? "Đã thêm " : "Đã cập nhật ") + rec.ma)) onClose();
  };
  return (
    <Modal title={isNew ? "Thêm xe mới" : `Sửa thông tin xe ${v.ma}`} onClose={onClose} width={640}
      footer={<><button className="btn" onClick={onClose}>Hủy</button><button className="btn pri" onClick={save}>Lưu</button></>}>
      <div className="form-grid">
        <Field label="Mã xe *"><input className="inp mono" value={f.ma} onChange={set("ma")} readOnly={!isNew} placeholder="VD: XL-VT60" /></Field>
        <Field label="Đội xe *"><Select value={f.doi} onChange={set("doi")} options={D.doiList} /></Field>
        <Field label="Tổ (chọn hoặc gõ tên mới)">
          <input className="inp" list="dl-to" value={f.to_xe || ""} onChange={set("to_xe")} placeholder="VD: Tổ MCT GPMB" />
          <datalist id="dl-to">{D.toList.map((x) => <option key={x} value={x} />)}</datalist>
        </Field>
        <Field label="Chế độ"><Select value={f.che_do} onChange={set("che_do")} options={D.meta.cheDo || ["Đi ca", "HC"]} /></Field>
        {coXuong && <Field label="Xưởng"><input className="inp" value={f.xuong || ""} onChange={set("xuong")} /></Field>}
        {coXuong && <Field label="Hệ số làm việc"><input className="inp num" inputMode="decimal" value={f.he_so ?? ""} onChange={set("he_so")} /></Field>}
        {laXeNang && <Field label="Tải trọng *"><Select value={f.tai_trong} onChange={set("tai_trong")} options={D.taiTrongList} blank="— chọn —" /></Field>}
        {laXucDao && <Field label="Thiết bị gắn"><Select value={f.thiet_bi_gan} onChange={set("thiet_bi_gan")} options={[...new Set([...D.thietBiGanList, f.thiet_bi_gan].filter(Boolean))]} blank="— chưa khai báo —" /></Field>}
        <Field label="Model" className="wide">
          <input className="inp" list="dl-model" value={f.model || ""} onChange={set("model")} />
          <datalist id="dl-model">{models.map((x) => <option key={x} value={x} />)}</datalist>
        </Field>
        <Field label="Ghi chú" className="wide"><input className="inp" value={f.ghi_chu || ""} onChange={set("ghi_chu")} /></Field>
        {ct.truong(f, setF)}
      </div>
    </Modal>
  );
}

// Đổi tên một tổ cho toàn bộ xe và nhân sự của tổ đó
export function RenameToDialog({ onClose }) {
  const { D, api, run, toast } = useApp();
  const [cu, setCu] = useState(D.toList[0] || "");
  const [moi, setMoi] = useState("");
  const nXe = D.vehicles.filter((v) => v.to_xe === cu).length;
  const nNs = D.staff.filter((s) => s.to_xe === cu).length;
  const save = async () => {
    const ten = moi.replace(/\s+/g, " ").trim();
    if (!cu || !ten) return toast("Chọn tổ cần đổi và nhập tên mới", "bad");
    if (ten === cu) return toast("Tên mới trùng tên cũ", "bad");
    const gop = D.toList.includes(ten);
    if (gop && !confirm(`Tổ "${ten}" đã có. Gộp ${nXe} xe của "${cu}" vào tổ "${ten}"?`)) return;
    if (await run(() => api.renameTo(cu, ten), `Đã đổi "${cu}" thành "${ten}" (${nXe} xe, ${nNs} nhân sự)`)) onClose();
  };
  return (
    <Modal title="Đổi tên tổ" onClose={onClose} width={560}
      footer={<><button className="btn" onClick={onClose}>Hủy</button><button className="btn pri" onClick={save}>Đổi tên</button></>}>
      <div className="form-grid">
        <Field label="Tổ hiện tại" className="wide"><Select value={cu} onChange={setCu} options={D.toList} /></Field>
        <Field label="Tên mới" className="wide"><input className="inp" list="dl-to-moi" value={moi} onChange={(e) => setMoi(e.target.value)} placeholder="Gõ tên mới, hoặc chọn tổ có sẵn để gộp" />
          <datalist id="dl-to-moi">{D.toList.filter((x) => x !== cu).map((x) => <option key={x} value={x} />)}</datalist></Field>
      </div>
      <div className="small mute" style={{ marginTop: 10 }}>Áp dụng cho <b>{nXe}</b> xe và <b>{nNs}</b> nhân sự đang thuộc tổ này. Sự kiện và kế hoạch không bị ảnh hưởng.</div>
    </Modal>
  );
}
