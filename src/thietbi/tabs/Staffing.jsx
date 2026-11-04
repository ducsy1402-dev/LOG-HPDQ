import { useCotThem } from "../components/cotThemTB";
import { useEffect, useMemo, useState } from "react";
import { Users, AlertTriangle, CheckCircle2, Save, Scale, UserCog, ChevronDown, ChevronUp, Info, Upload, Clock3, MessageSquare, Plus, Pencil, Download } from "lucide-react";
import { useApp } from "../store";
import ImportDialog from "../components/ImportDialog";
import { downloadTemplate } from "../lib/excel";
import { Card, Badge, Select, Search, Seg, Empty, MultiSelect, Modal, Field, ConfirmButton } from "../components/ui";
import { PairBars } from "../components/charts";
import { chenhTone, chenhLabel, ACTIVE } from "../lib/compute";
import { vn, vnShort, thu, matchQ, shortTo } from "../lib/utils";
import { useChonNhieu, OTickTieuDe, OTick, ThanhChon } from "../components/chonNhieu";

// Các ca cần điền quân số: 2 ca đi ca (ca đang chạy + ca kế tiếp) đứng trước, ca hành chính để cuối
const useCaToi = (D) => useMemo(() => D.upcomingShifts().sort((a, b) => a.hc - b.hc || a.start - b.start).map((sh) => ({ sh, kip: D.shiftKip(sh), rows: D.shiftRows(sh) })), [D]);

export default function Staffing() {
  const { D } = useApp();
  const data = useCaToi(D);
  return (
    <>
      <div className="page-h">
        <div>
          <h1>Nhân sự & quân số ca</h1>
          <div className="sub">Mỗi xe sẵn sàng cần 1 người/ca · Xe đi ca: CA 1 (08h–20h), CA 2 (20h–08h) · Xe HC: CA HC (07h30–17h, thứ 2 – thứ 7) · Kíp tự tính theo lịch luân phiên. Cảnh báo quân số và biểu đồ người – xe xem ở Điều độ chung.</div>
        </div>
      </div>

      <div className="grid mb shift-grid">
        {data.map((x, i) => <ShiftCard key={x.sh.ngay + x.sh.ca} {...x} tag={x.sh.hc ? "Hành chính" : x.sh.dangChay ? "Đang diễn ra" : `Ca tới ${data.slice(0, i).filter((y) => !y.sh.hc && !y.sh.dangChay).length + 1}`} />)}
      </div>
    </>
  );
}

// Cảnh báo quân số, người so với xe sẵn sàng, lái xe theo kíp (hiển thị ở Điều độ chung)
export function KhoiQuanSo() {
  const { D } = useApp();
  const data = useCaToi(D);

  // Cảnh báo tổng hợp
  const alerts = [];
  for (const { sh, kip, rows } of data) {
    const name = `${D.shiftLabel(sh)} · ${thu(sh.ngay)} ${vn(sh.ngay)}`;
    for (const r of rows) {
      if (r.chenh != null && r.chenh < 0) alerts.push({ tone: "bad", text: <><b>{name}</b> – đội {r.doi}: <b>thiếu {-r.chenh} người</b> (có {r.thucTe}, cần {r.xeCan} cho xe sẵn sàng).</> });
      else if (r.chenh != null && r.chenh > 0) alerts.push({ tone: "info", text: <><b>{name}</b> – đội {r.doi}: thừa {r.chenh} người so với {r.xeCan} xe sẵn sàng.</> });
      if (r.thucTe == null && kip && r.xeCan > 0 && r.dinhBien < r.xeCan) alerts.push({ tone: "warn", text: <><b>{name}</b> – đội {r.doi}: định biên kíp {kip} chỉ có {r.dinhBien} người, ít hơn {r.xeCan} xe sẵn sàng.</> });
    }
    const missing = rows.filter((r) => r.thucTe == null).map((r) => r.doi);
    if (missing.length) alerts.push({ tone: "mute", text: <><b>{name}</b>: chưa nhập quân số thực tế đội {missing.join(", ")}.</> });
  }
  const nBad = alerts.filter((a) => a.tone === "bad").length;

  // Biểu đồ: cân đối người – xe của ca đang chọn
  const [caXem, setCaXem] = useState(0);
  const caSel = data[Math.min(caXem, data.length - 1)];
  const balanceRows = (caSel?.rows || []).map((r) => ({ name: r.doi, tt: r.thucTe ?? r.dinhBien, xe: r.xeCan }));
  // Biểu đồ: nhân sự theo kíp so với xe sẵn sàng cần người
  // Biểu đồ lái xe theo kíp: lọc theo đội (chọn nhiều, rỗng = tất cả)
  const [doiKip, setDoiKip] = useState([]);
  const coDoi = (x) => !doiKip.length || doiKip.includes(x);
  const readyDiCa = D.vehicles.filter((v) => coDoi(v.doi) && v.che_do === "Đi ca" && D.isReady(v.ma)).length;
  const readyHC = D.vehicles.filter((v) => coDoi(v.doi) && v.che_do === "HC" && D.isReady(v.ma)).length;
  const kipRows = D.kipList.map((k) => ({ name: k === "HC" ? "Kíp HC" : `Kíp ${k}`, ns: D.laiXeActive.filter((s) => coDoi(s.doi) && s.kip === k).length, can: k === "HC" ? readyHC : readyDiCa }));

  return (
      <div className="grid g-3 mb">
        <Card title="Cảnh báo quân số" icon={AlertTriangle} right={nBad ? <Badge tone="bad">{nBad} thiếu người</Badge> : <Badge tone="ok">Không thiếu</Badge>}>
          <div className="alerts" style={{ maxHeight: 260, overflow: "auto" }}>
            {alerts.length ? alerts.map((a, i) => (
              <div key={i} className={"alert " + (a.tone === "mute" ? "" : a.tone)}>
                {a.tone === "bad" || a.tone === "warn" ? <AlertTriangle size={15} /> : a.tone === "info" ? <Info size={15} /> : <Clock3 size={15} className="mute" />}
                <span>{a.text}</span>
              </div>
            )) : <div className="alert ok"><CheckCircle2 size={15} /><span>Tất cả các ca tới đã đủ người.</span></div>}
          </div>
        </Card>
        <Card title="Người so với xe" icon={Scale} hint="Chưa nhập thì lấy định biên kíp"
          right={data.length > 1 && <Seg value={Math.min(caXem, data.length - 1)} onChange={setCaXem} options={data.map((x, i) => [i, D.shiftLabel(x.sh)])} />}>
          <div className="scroll-y" style={{ "--h": "232px" }}>
            <PairBars horizontal rowH={26} rows={balanceRows} a={{ key: "tt", label: "Người", color: "accent" }} b={{ key: "xe", label: "Xe SS cần người", color: "ss" }} />
          </div>
        </Card>
        <Card title="Lái xe theo kíp" icon={Users} hint={doiKip.length ? "Theo đội đã chọn" : "So với xe sẵn sàng"}
          right={<MultiSelect prefix="Đội" value={doiKip} onChange={setDoiKip} options={D.doiList} style={{ width: 170 }} />}>
          <PairBars rows={kipRows} height={200} a={{ key: "ns", label: "Lái xe" }} b={{ key: "can", label: "Xe SS cần", color: "ss" }} />
        </Card>
      </div>
  );
}

function ShiftCard({ sh, kip, rows, tag }) {
  const { D, api, run, canWrite } = useApp();
  const init = () => Object.fromEntries(rows.map((r) => [r.doi, { tt: r.thucTe ?? "", gc: r.ghiChu }]));
  const sig = JSON.stringify(rows.map((r) => [r.doi, r.thucTe, r.ghiChu]));
  const [f, setF] = useState(init);
  const [saving, setSaving] = useState(false);
  const [showTo, setShowTo] = useState(false);
  const [showGc, setShowGc] = useState(false);
  useEffect(() => setF(init()), [sig]); // eslint-disable-line react-hooks/exhaustive-deps

  const live = rows.map((r) => {
    const v = f[r.doi]?.tt;
    const tt = v === "" || v == null ? null : Math.max(0, parseInt(v, 10) || 0);
    return { ...r, tt, chenh: tt == null ? null : tt - r.xeCan };
  });
  const tot = live.reduce((a, r) => ({ db: a.db + r.dinhBien, tt: a.tt + (r.tt ?? 0), xe: a.xe + r.xeCan, has: a.has || r.tt != null }), { db: 0, tt: 0, xe: 0, has: false });
  // Không cho thừa ở đội này bù cho thiếu ở đội khác
  const thieu = live.reduce((a, r) => a + (r.chenh < 0 ? -r.chenh : 0), 0);
  const thua = live.reduce((a, r) => a + (r.chenh > 0 ? r.chenh : 0), 0);
  const totChenh = !tot.has ? null : thieu ? -thieu : thua;
  const dirty = live.some((r) => r.tt !== r.thucTe || (f[r.doi]?.gc || "") !== (r.ghiChu || ""));
  const kips = D.kipList.filter((k) => k !== "HC");

  const setKip = (k) => run(() => api.upsertCaKip({ ngay: sh.ngay, ca: sh.ca, kip: k || null }), k ? `Đã chọn kíp ${k} cho ${D.shiftLabel(sh).slice(0, 4)} ${vn(sh.ngay)}` : "Đã trả về kíp theo lịch");
  const save = async () => {
    setSaving(true);
    await run(() => api.upsertHeadcount(live.map((r) => ({ ngay: sh.ngay, ca: sh.ca, doi: r.doi, thuc_te: r.tt, ghi_chu: (f[r.doi]?.gc || "").trim() || null }))), `Đã lưu quân số ${D.shiftLabel(sh)} ${vn(sh.ngay)}`);
    setSaving(false);
  };
  const byTo = D.shiftByTo(sh);
  const lich = D.shiftLich(sh);
  const tuChon = !sh.hc && kip !== lich;

  return (
    <section className={"card shift" + (sh.dangChay ? " shift-now" : "")}>
      <div className="shift-h">
        <div style={{ minWidth: 0 }}>
          <div className="t1">{D.shiftLabel(sh)} <span className="mute" style={{ fontWeight: 500, fontSize: 12 }}>{sh.ca.replace(/^CA \S+ /, "")}</span></div>
          <div className="t2"><b className={sh.dangChay ? "accent" : ""}>{tag}</b> · {thu(sh.ngay)} {vnShort(sh.ngay)}</div>
        </div>
        <span className="spacer" />
        {sh.hc ? <Badge tone="accent" plain>Kíp HC</Badge> : canWrite ? (
          <Select className="inp sm" value={tuChon ? kip : ""} onChange={setKip} options={kips.filter((k) => k !== lich).map((k) => [k, `Kíp ${k}`])} blank={`Kíp ${lich} (lịch)`} style={{ width: 112 }} aria-label="Chọn kíp" />
        ) : <Badge tone="accent" plain>Kíp {kip}</Badge>}
      </div>
      <div className="shift-b">
        {tuChon && <div className="alert warn mb"><Info size={15} /><span>Đã đổi tay sang kíp <b>{kip}</b>, lịch luân phiên là kíp <b>{lich}</b>.</span></div>}
        <div className="balance mini">
          <div className="bal"><div className="d">Định biên</div><div className="big">{tot.db}</div></div>
          <div className="bal"><div className="d">Thực tế</div><div className="big">{tot.has ? tot.tt : "–"}</div></div>
          <div className="bal"><div className="d">Xe SS cần</div><div className="big ok">{tot.xe}</div></div>
          <div className={"bal " + chenhTone(totChenh)} title={thieu > 0 && thua > 0 ? `Thừa ${thua} ở đội khác` : undefined}><div className="d">Cân đối</div><div className={"big " + chenhTone(totChenh)} title={chenhLabel(totChenh)}>{totChenh == null ? "–" : totChenh > 0 ? "+" + totChenh : totChenh === 0 ? "Đủ" : totChenh}</div></div>
        </div>
        <div className="tw shift-tw">
          <table className="t compact shift-t">
            <colgroup><col /><col style={{ width: 34 }} /><col style={{ width: 58 }} /><col style={{ width: 52 }} /><col style={{ width: 40 }} /></colgroup>
            <thead><tr><th>Đội</th><th className="n" title="Định biên kíp: số lái xe đang làm việc của đội thuộc kíp ca này (không tính tổ trưởng, nhóm khác)">ĐB</th><th className="n">Thực tế</th><th className="n" title="Xe sẵn sàng / tổng xe">Xe SS</th><th className="n" title="Thực tế − xe sẵn sàng (âm = thiếu người)">±</th></tr></thead>
            <tbody>
              {live.map((r) => [
                <tr key={r.doi}>
                  <td className="doi"><b>{r.doi}</b>{!showGc && (f[r.doi]?.gc || r.ghiChu) && <div className="small mute gc-line" title={f[r.doi]?.gc || r.ghiChu}>{f[r.doi]?.gc || r.ghiChu}</div>}</td>
                  <td className="n">{r.dinhBien}</td>
                  <td className="n">{canWrite
                    ? <input className="inp sm num mono" type="number" min="0" inputMode="numeric" style={{ width: 50 }} value={f[r.doi]?.tt ?? ""} onChange={(e) => setF((o) => ({ ...o, [r.doi]: { ...o[r.doi], tt: e.target.value } }))} placeholder="–" />
                    : r.tt ?? "–"}</td>
                  <td className="n" title={`${r.xeCan} sẵn sàng / ${r.xeTong} xe`}>{r.xeCan}<span className="mute small">/{r.xeTong}</span></td>
                  <td className={"n " + chenhTone(r.chenh)} title={chenhLabel(r.chenh)}><b>{r.chenh == null ? <span className="mute">–</span> : r.chenh > 0 ? "+" + r.chenh : r.chenh === 0 ? "Đủ" : r.chenh}</b></td>
                </tr>,
                showGc && canWrite && (
                  <tr key={r.doi + "-gc"} className="gc-row">
                    <td colSpan={5}><input className="inp sm" placeholder={`Ghi chú ${r.doi} (VD: 2 phép, 1 ốm)`} value={f[r.doi]?.gc || ""}
                      onChange={(e) => setF((o) => ({ ...o, [r.doi]: { ...o[r.doi], gc: e.target.value } }))} /></td>
                  </tr>
                ),
              ])}
            </tbody>
          </table>
        </div>
        {canWrite && (
          <div className="row shift-f">
            <button className="btn pri sm" onClick={save} disabled={saving || !dirty}><Save size={14} />{saving ? "Đang lưu…" : "Lưu quân số"}</button>
            <button className="btn sm ghost" onClick={() => setShowGc((x) => !x)}><MessageSquare size={14} />{showGc ? "Ẩn ô ghi chú" : "Ghi chú"}</button>
            {dirty && <span className="small warn">Chưa lưu</span>}
          </div>
        )}

        <button className="btn ghost sm" style={{ marginTop: 8, width: "100%" }} onClick={() => setShowTo((x) => !x)}>
          {showTo ? <ChevronUp size={14} /> : <ChevronDown size={14} />}Chi tiết theo tổ (để xem)
        </button>
        {showTo && (
          <div className="tw" style={{ maxHeight: 300, marginTop: 8 }}>
            <table className="t compact">
              <thead><tr><th>Tổ</th><th className="n">Xe SS</th><th className="n">ĐB kíp</th></tr></thead>
              <tbody>{byTo.map((r) => (
                <tr key={r.to}><td>{shortTo(r.to)}<div className="small mute">{r.doi}</div></td><td className="n">{r.xeCan}<span className="mute small">/{r.xeTong}</span></td><td className="n">{r.dinhBien}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

// Danh sách nhân sự – chuyển sang mục Danh mục của web chung (Thêm / Sửa / Xóa / Import)
export function DanhSachNhanSu() {
  const [imp, setImp] = useState(false);
  return <><StaffList onImport={() => setImp(true)} />{imp && <ImportDialog kind="staff" onClose={() => setImp(false)} />}</>;
}

function StaffList({ onImport }) {
  const { D, isAdmin, api, run, fail } = useApp();
  const [q, setQ] = useState("");
  // Bộ lọc chọn nhiều: mảng rỗng = tất cả. Mặc định chỉ người đang làm việc.
  const [doi, setDoi] = useState([]);
  const [to, setTo] = useState([]);
  const [kip, setKip] = useState([]);
  const [nhom, setNhom] = useState([]);
  const [st, setSt] = useState([ACTIVE]);
  const [dlg, setDlg] = useState(null); // {} = thêm, nhân sự = sửa
  const has = (arr, x) => !arr.length || arr.includes(x);
  const KHONG_NHOM = "(Chưa có nhóm)";
  const nhomOf = (s) => s.nhom || KHONG_NHOM;
  const ttList = [...new Set([ACTIVE, ...D.staff.map((s) => s.trang_thai || ACTIVE)])];
  const toList = D.toList.filter((t) => D.staff.some((s) => s.to_xe === t && has(doi, s.doi)));
  const nhomList = [...new Set(D.staff.map(nhomOf))].sort((a, b) => a.localeCompare(b, "vi"));
  const list = D.staff.filter((s) => has(doi, s.doi) && has(to, s.to_xe) && has(kip, s.kip) && has(nhom, nhomOf(s)) && has(st, s.trang_thai || ACTIVE) && matchQ(q, s.ma, s.ho_ten, s.to_xe, s.nhom));
  // Đếm theo nhóm (Lái xe, Tổ trưởng…) trong các dòng đang lọc
  const demNhom = Object.entries(list.reduce((m, s) => ((m[nhomOf(s)] = (m[nhomOf(s)] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1]);
  const sample = D.staff.some((s) => s.ma.startsWith("MAU-"));
  const xoa = (s) => run(() => api.deleteStaff(s.ma), `Đã xóa ${s.ma} · ${s.ho_ten}`);
  // Tick chọn nhiều dòng (kể cả các dòng đang lọc mà chưa hiện hết) rồi xóa một lần
  const c = useChonNhieu();
  const keys = list.map((x) => x.ma);
  const ct = useCotThem("nhan_su", [["ma", "Mã NV"], ["ho_ten", "Họ tên"], ["doi", "Đội"], ["to_xe", "Tổ"], ["kip", "Kíp"], ["nhom", "Nhóm"], ["trang_thai", "Trạng thái"]], { can08: true });
  return (
    <Card title={`Danh sách nhân sự (${list.length}/${D.staff.length})`} icon={UserCog}
      right={<>
        <MultiSelect prefix="Đội" value={doi} onChange={setDoi} options={D.doiList} style={{ width: 160 }} />
        <MultiSelect prefix="Tổ" value={to} onChange={setTo} options={toList} style={{ width: 160 }} />
        <MultiSelect prefix="Kíp" value={kip} onChange={setKip} options={D.kipList} style={{ width: 110 }} />
        <MultiSelect prefix="Nhóm" value={nhom} onChange={setNhom} options={nhomList} style={{ width: 160 }} />
        <MultiSelect prefix="Trạng thái" value={st} onChange={setSt} options={ttList} style={{ width: 200 }} />
        <Search value={q} onChange={setQ} placeholder="Tìm tên, mã…" style={{ width: 170 }} />
        <button className="btn sm" onClick={() => downloadTemplate("staff", D).catch(fail)}><Download size={14} />Xuất Excel</button>
        {isAdmin && <button className="btn sm" onClick={onImport}><Upload size={14} />Import</button>}
        {isAdmin && ct.nut}
        {isAdmin && <button className="btn sm pri" onClick={() => setDlg({})}><Plus size={14} />Thêm</button>}
      </>}>
      {sample ? (
        <div className="alert warn mb"><Info size={16} /><span>Đang có <b>nhân sự mẫu</b> (mã MAU-xxxx) sinh theo định biên (xe đi ca 3 người, xe HC 1 người).
          {isAdmin ? <> Bấm <button className="btn sm" onClick={onImport}><Upload size={13} />Import nhân sự</button> để nạp file thật.</> : " Quản trị sẽ nạp file thật sau."}</span></div>
      ) : null}
      {isAdmin && <ThanhChon c={c} keys={keys} onXoa={(mas) => run(() => api.deleteStaffs(mas), `Đã xóa ${mas.length} nhân sự`)} />}
      {list.length ? (
        <div className="tw short">
          <table className="t">
            <thead><tr>{isAdmin && <OTickTieuDe c={c} keys={keys} />}<th>Mã</th><th>Họ tên</th><th>Đội</th><th>Tổ</th><th>Kíp</th><th>Nhóm</th><th>Trạng thái</th>{ct.th}{isAdmin && <th className="act"></th>}</tr></thead>
            <tbody>{list.slice(0, 500).map((s) => (
              <tr key={s.ma}>{isAdmin && <OTick c={c} k={s.ma} ten={s.ho_ten} />}<td className="mono">{s.ma}</td><td>{s.ho_ten}</td><td>{s.doi}</td><td>{shortTo(s.to_xe)}</td><td><Badge tone="accent" plain>{s.kip || "–"}</Badge></td><td>{s.nhom}</td>
                <td><Badge tone={(s.trang_thai || ACTIVE) === ACTIVE ? "ok" : "warn"}>{s.trang_thai || ACTIVE}</Badge></td>{ct.td(s)}
                {isAdmin && <td className="act"><div className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
                  <button className="btn sm" onClick={() => setDlg(s)}><Pencil size={13} />Sửa</button>
                  <ConfirmButton onConfirm={() => xoa(s)} title={`Xóa ${s.ma} khỏi danh sách`} />
                </div></td>}</tr>
            ))}</tbody>
          </table>
        </div>
      ) : <Empty />}
      <div className="ns-dem">
        <span><b>{list.length}</b> người theo bộ lọc</span>
        {demNhom.map(([k, n]) => <span key={k} className="badge plain">{k}: <b className="mono">{n}</b></span>)}
        {list.length > 500 && <span className="small mute">· Bảng hiển thị 500 dòng đầu, dùng bộ lọc / ô tìm để thu hẹp (số đếm vẫn tính đủ).</span>}
      </div>
      {dlg && <StaffForm s={dlg.ma ? dlg : null} onClose={() => setDlg(null)} />}
      {ct.hop}
    </Card>
  );
}

// Thêm / sửa một nhân sự (quản trị)
function StaffForm({ s, onClose }) {
  const { D, api, run, toast } = useApp();
  const isNew = !s;
  const [f, setF] = useState(() => s ? { ...s, doi: s.doi || "", to_xe: s.to_xe || "", kip: s.kip || "", nhom: s.nhom || "", trang_thai: s.trang_thai || ACTIVE }
    : { ma: "", ho_ten: "", doi: D.doiList[0] || "", to_xe: "", kip: "A", nhom: "Lái xe", trang_thai: ACTIVE });
  const set = (k) => (v) => setF((o) => ({ ...o, [k]: v?.target ? v.target.value : v }));
  const nhomList = [...new Set(["Lái xe", "Tổ trưởng", ...D.staff.map((x) => x.nhom)].filter(Boolean))];
  const ct = useCotThem("nhan_su", [["ma", "Mã NV"], ["ho_ten", "Họ tên"], ["doi", "Đội"], ["to_xe", "Tổ"], ["kip", "Kíp"], ["nhom", "Nhóm"], ["trang_thai", "Trạng thái"]], { can08: true });
  const ttList = [...new Set([ACTIVE, "Nghỉ việc", "Nghỉ dài hạn", ...D.staff.map((x) => x.trang_thai)].filter(Boolean))];
  const save = async () => {
    const gon = (x) => String(x ?? "").replace(/\s+/g, " ").trim();
    const rec = { ma: gon(f.ma).toUpperCase(), ho_ten: gon(f.ho_ten), doi: f.doi || null, to_xe: gon(f.to_xe) || null, kip: f.kip || null, nhom: gon(f.nhom) || null, trang_thai: f.trang_thai || ACTIVE };
    Object.assign(rec, ct.gom(f.them));
    if (!rec.ma || !rec.ho_ten) return toast("Cần nhập mã và họ tên", "bad");
    if (isNew && D.staff.some((x) => x.ma.toUpperCase() === rec.ma)) return toast(`Mã ${rec.ma} đã có trong danh sách`, "bad");
    if (await run(() => api.upsertStaff([rec]), (isNew ? "Đã thêm " : "Đã cập nhật ") + `${rec.ma} · ${rec.ho_ten}`)) onClose();
  };
  return (
    <Modal title={isNew ? "Thêm nhân sự" : `Sửa nhân sự ${s.ma}`} onClose={onClose} width={640}
      footer={<><button className="btn" onClick={onClose}>Hủy</button><button className="btn pri" onClick={save}><Save size={14} />Lưu</button></>}>
      <div className="form-grid">
        <Field label="Mã nhân viên *"><input className="inp mono" value={f.ma} onChange={set("ma")} readOnly={!isNew} placeholder="VD: HPDQ02100" /></Field>
        <Field label="Họ tên *" className="wide"><input className="inp" value={f.ho_ten} onChange={set("ho_ten")} /></Field>
        <Field label="Đội"><Select value={f.doi} onChange={set("doi")} options={D.doiList} blank="—" /></Field>
        <Field label="Tổ (chọn hoặc gõ)"><input className="inp" list="dl-ns-to" value={f.to_xe} onChange={set("to_xe")} /><datalist id="dl-ns-to">{D.toList.map((x) => <option key={x} value={x} />)}</datalist></Field>
        <Field label="Kíp"><Select value={f.kip} onChange={set("kip")} options={D.kipList} blank="—" /></Field>
        <Field label="Nhóm (chọn hoặc gõ)"><input className="inp" list="dl-ns-nhom" value={f.nhom} onChange={set("nhom")} /><datalist id="dl-ns-nhom">{nhomList.map((x) => <option key={x} value={x} />)}</datalist></Field>
        <Field label="Trạng thái"><Select value={f.trang_thai} onChange={set("trang_thai")} options={ttList} /></Field>
        {ct.truong(f, setF)}
      </div>
      <div className="small mute" style={{ marginTop: 10 }}>Định biên kíp ở các khối ca phía trên đếm người "Đang làm việc" theo đội và kíp. Người nghỉ thì đổi trạng thái thay vì xóa để giữ lịch sử.</div>
    </Modal>
  );
}
