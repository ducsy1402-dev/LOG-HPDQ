import { useEffect, useMemo, useState } from "react";
import { Save, Plus, Check, X } from "lucide-react";
import { useApp } from "../store";
import { Field, Select, StateBadge, DateInput } from "./ui";
import { addDays, plain } from "../lib/utils";
import { laBDDK, LOAI_CBM, chuanHoaMeta } from "../lib/compute";

// Ô chọn có dấu + (anh Sỹ 25/11/2026): bấm + hiện ô gõ giá trị mới ngay cạnh, Enter / ✓ để thêm vào danh sách (lưu ở CSDL, dùng chung), Esc / ✗ để bỏ.
// hoi = ô chọn thêm trong lúc thêm (VvD loại sự kiện: xe có còn sẵn sàng hay không). themVao(ten, phu) trả true khi đã lưu.
function ChonThem({ value, onChange, options, blank, themVao, tenGiaTri, khoa, hoi }) {
  const [dang, setDang] = useState(false), [ten, setTen] = useState(""), [phu, setPhu] = useState(hoi?.macDinh || ""), [luu, setLuu] = useState(false);
  const dong = () => { setDang(false); setTen(""); setPhu(hoi?.macDinh || ""); };
  const them = async () => {
    const t = ten.trim().replace(/\s+/g, " ");
    if (!t) return;
    const co = options.find((o) => plain(Array.isArray(o) ? o[0] : o) === plain(t)); // đã có (không phân biệt hoa thường, dấu) thì chỉ chọn lại
    if (co) { onChange(Array.isArray(co) ? co[0] : co); return dong(); }
    setLuu(true);
    const ok = await themVao(t, phu);
    setLuu(false);
    if (ok) { onChange(t); dong(); }
  };
  if (!dang) {
    return (
      <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
        <Select value={value} onChange={onChange} options={options} blank={blank} style={{ flex: 1, minWidth: 0 }} />
        <button type="button" className="btn ghost icon" disabled={khoa} onClick={() => setDang(true)} aria-label={`Thêm ${tenGiaTri}`} data-tip={khoa || `Thêm ${tenGiaTri} mới`}><Plus size={16} /></button>
      </div>
    );
  }
  return (
    <div className="grid" style={{ gap: 6 }}>
      <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
        <input className="inp" autoFocus style={{ flex: 1, minWidth: 0 }} value={ten} placeholder={`Tên ${tenGiaTri} mới`} onChange={(e) => setTen(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); them(); } else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); dong(); } }} />
        <button type="button" className="btn pri icon" disabled={luu || !ten.trim()} onClick={them} aria-label="Thêm" data-tip="Thêm (Enter)"><Check size={16} /></button>
        <button type="button" className="btn ghost icon" disabled={luu} onClick={dong} aria-label="Bỏ" data-tip="Bỏ (Esc)"><X size={16} /></button>
      </div>
      {hoi && <Select value={phu} onChange={setPhu} options={hoi.options} />}
    </div>
  );
}

// Form ghi nhận xe hỏng / vào bảo dưỡng
export default function EventForm({ initialMa = "", onDone, compact }) {
  const { D, api, run, toast } = useApp();
  const m = D.meta;
  // Thêm giá trị mới vào danh mục dùng chung (meta): loại sự kiện, nhóm (theo loại), PIC. Lưu cả danh sách đã chuẩn hóa để không mất mục mặc định.
  const mc = chuanHoaMeta(m);
  const themLoai = (ten, phu) => run(() => api.saveMetaSuKien({ loai: [...mc.loai, ten], loaiDung: phu === "sanSang" ? mc.loaiDung : [...mc.loaiDung, ten] }), `Đã thêm loại sự kiện "${ten}"`);
  const themNhom = (ten) => run(() => api.saveMetaSuKien({ nhom: { ...(m.nhom || {}), [f.loai]: [...((m.nhom || {})[f.loai] || []), ten] } }), `Đã thêm nhóm "${ten}" cho loại ${f.loai}`);
  const themPic = (ten) => run(() => api.saveMetaSuKien({ pic: [...mc.pic, ten] }), `Đã thêm PIC "${ten}"`);
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
        <Field label="Loại sự kiện *"><ChonThem value={f.loai} onChange={set("loai")} options={D.loaiList} themVao={themLoai} tenGiaTri="loại sự kiện"
          hoi={{ macDinh: "khong", options: [["khong", "Xe không sẵn sàng"], ["sanSang", "Xe vẫn sẵn sàng"]] }} /></Field>
        <Field label="Nhóm"><ChonThem value={f.nhom} onChange={set("nhom")} options={nhomList} blank="—" themVao={themNhom} tenGiaTri={`nhóm (của loại ${f.loai})`} khoa={!f.loai && "Chọn loại sự kiện trước"} /></Field>
        <Field label="Ngày vào *"><DateInput required value={f.ngay_vao} max={D.today} onChange={set("ngay_vao")} /></Field>
        <Field label="Dự kiến xong"><DateInput value={f.ngay_du_kien} min={f.ngay_vao} onChange={set("ngay_du_kien")} /></Field>
        <Field label="Phụ tùng"><Select value={f.phu_tung} onChange={set("phu_tung")} options={m.pt || []} blank="—" /></Field>
        <Field label="PIC"><ChonThem value={f.pic} onChange={set("pic")} options={m.pic || []} blank="—" themVao={themPic} tenGiaTri="PIC" /></Field>
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
        {laBDDK(f.loai) && <span className="small info">Bảo dưỡng định kỳ: xe vẫn được tính là sẵn sàng.</span>}
        {f.loai === LOAI_CBM && <span className="small warn">Bảo trì CBM: xe không được tính là sẵn sàng.</span>}
      </div>
    </form>
  );
}
