import { useEffect, useMemo, useState } from "react";
import { Save } from "lucide-react";
import { useApp } from "../store";
import { Field, Select, StateBadge, DateInput } from "./ui";
import { addDays } from "../lib/utils";

// Form ghi nhận xe hỏng / vào bảo dưỡng
export default function EventForm({ initialMa = "", onDone, compact }) {
  const { D, api, run, toast } = useApp();
  const m = D.meta;
  const blank = () => ({ ma: initialMa, loai: D.loaiList[0], nhom: "", mo_ta: "", ngay_vao: D.today, ngay_du_kien: addDays(D.today, D.T.tl), phu_tung: (m.pt || [])[0] || "", pic: "" });
  const [f, setF] = useState(blank);
  const [saving, setSaving] = useState(false);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v?.target ? v.target.value : v }));
  const nhomList = (m.nhom || {})[f.loai] || [];
  useEffect(() => { setF((x) => ({ ...x, nhom: "" })); }, [f.loai]);

  const ma = f.ma.trim().toUpperCase();
  const v = D.vmap[ma];
  const openOfV = useMemo(() => D.open.filter((e) => e.ma_xe === ma), [D, ma]);

  const submit = async (e) => {
    e.preventDefault();
    if (!v) return toast("Mã xe không có trong danh mục", "bad");
    if (f.ngay_vao > D.today) return toast("Ngày vào không được sau hôm nay", "bad");
    if (f.ngay_du_kien && f.ngay_du_kien < f.ngay_vao) return toast("Ngày dự kiến xong phải từ ngày vào trở đi", "bad");
    setSaving(true);
    const rec = { ma_xe: ma, loai: f.loai, nhom: f.nhom || null, mo_ta: f.mo_ta.trim() || null, ngay_vao: f.ngay_vao, ngay_du_kien: f.ngay_du_kien || null, phu_tung: f.phu_tung || null, pic: f.pic || null };
    const ok = await run(() => api.insertEvent(rec), `Đã ghi nhận ${f.loai.toLowerCase()} xe ${ma}`);
    setSaving(false);
    if (ok) { setF({ ...blank(), ma: compact ? ma : "" }); onDone?.(); }
  };

  return (
    <form onSubmit={submit}>
      <div className="form-grid">
        <Field label="Mã xe *">
          <input className="inp mono" list="dl-xe" required value={f.ma} onChange={set("ma")} placeholder="VD: XL-VT31" readOnly={compact && !!initialMa} />
          <datalist id="dl-xe">{D.vehicles.map((x) => <option key={x.ma} value={x.ma}>{`${x.doi} · ${x.to_xe || ""}`}</option>)}</datalist>
        </Field>
        <Field label="Loại sự kiện *"><Select value={f.loai} onChange={set("loai")} options={D.loaiList} /></Field>
        <Field label="Nhóm"><Select value={f.nhom} onChange={set("nhom")} options={nhomList} blank="—" /></Field>
        <Field label="Ngày vào *"><DateInput required value={f.ngay_vao} max={D.today} onChange={set("ngay_vao")} /></Field>
        <Field label="Dự kiến xong"><DateInput value={f.ngay_du_kien} min={f.ngay_vao} onChange={set("ngay_du_kien")} /></Field>
        <Field label="Phụ tùng"><Select value={f.phu_tung} onChange={set("phu_tung")} options={m.pt || []} blank="—" /></Field>
        <Field label="PIC"><Select value={f.pic} onChange={set("pic")} options={m.pic || []} blank="—" /></Field>
        <Field label="Mô tả" className="wide"><input className="inp" value={f.mo_ta} onChange={set("mo_ta")} placeholder="Hiện tượng, nguyên nhân…" /></Field>
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn pri" disabled={saving}><Save size={15} />{saving ? "Đang lưu…" : "Lưu sự kiện"}</button>
        {ma && (v ? (
          <span className="small mute row" style={{ gap: 6 }}>
            <b className="mono" style={{ color: "var(--ink)" }}>{v.ma}</b>{v.doi} · {v.to_xe} · {v.che_do}<StateBadge s={D.stateOf(ma)} />
            {openOfV.length > 0 && <span className="warn">đang có {openOfV.length} sự kiện mở</span>}
          </span>
        ) : <span className="small bad">Không có mã xe này trong danh mục</span>)}
        {f.loai === "BD định kỳ" && <span className="small info">BD định kỳ: xe vẫn được tính là sẵn sàng.</span>}
      </div>
    </form>
  );
}
