import { useMemo, useState } from "react";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceArea, Cell } from "recharts";
import { SlidersHorizontal, BarChart3, GanttChart, Ship, Plus, Save, AlertTriangle, Anchor, Layers, RotateCcw, Trash2, GripVertical, Truck } from "lucide-react";
import { useApp } from "../../store";
import { Card, Kpi, Badge, Modal, Field, Select, Empty, DateInput, DateTimeInput, ConfirmButton, isoToLocal, localToIso, usePalette, MultiSelect } from "../../components/ui";
import { calc12, cfgOf, capTinhOf, withCap, DOI_GOC, doiCuaViec, byThuTu, hangColor, HANG_COLOR, BAI_COLOR, fmtDT, fmtD } from "../../lib/plan";
import { pad, vn } from "../../lib/utils";
import { useApp as useLogistics } from "@/store";
import { viecTauTuLinetime, viecBaiTuLinetime, laViecCangTay, DAU_VIEC_CANG } from "@/lib/tauDaiHan";
import { tenBen } from "@/pages/cang/BangTauBen";

const clone = (x) => JSON.parse(JSON.stringify(x));
const LS_DOI = "qltb-dh-doi";

// Kế hoạch dài hạn của một đội: xe dành cho cảng / bãi (theo công thức hoặc nhập tay), tàu từ Linetime + việc bãi nhập tay,
// kết quả từng ca (calc12). Dùng ở trang Dài hạn (tham số đang sửa) và Tổng quan › Năng lực đáp ứng (tham số đã lưu).
export function tinhDaiHan(D, LD, pp, doi) {
  const cfg = cfgOf(pp, doi);
  const goc = doi === DOI_GOC;
  const phanBo = pp.phanBo?.[doi] || [];
  // ---- Xe dành cho cảng / bãi theo công thức ----
  const tinh = capTinhOf(pp, doi);
  const ssDoi = D.vehicles.filter((v) => v.doi === doi && D.isReady(v.ma));
  const theoLoai = (loai) => (x) => !goc || !loai || loai === "Tất cả" || (x.ma ? loaiXucDao(x) : x.loai) === loai;
  const capCangTinh = tinh.cang?.length ? ssDoi.filter((v) => tinh.cang.includes(v.to_xe)).length : null;
  const capBaiTinh = tinh.bai ? ssDoi.filter(theoLoai(tinh.bai)).length - phanBo.filter(theoLoai(tinh.bai)).reduce((a, r) => a + (+r.so_xe || 0), 0) : null;
  const capCang = capCangTinh ?? (+cfg.capCang || 0), capBai = capBaiTinh ?? (+cfg.capBai || 0);
  // Xe tổ cảng cũng nằm trong phần "còn lại" của bãi = bị tính hai lần
  const trung = tinh.cang?.length && tinh.bai ? ssDoi.filter((v) => tinh.cang.includes(v.to_xe) && theoLoai(tinh.bai)(v)).length : 0;
  const tauLT = viecTauTuLinetime(LD, doi, { cranes: D.vehicles.filter((x) => x.doi === "Cẩu").map((x) => ({ ...x, loai: x.model, nang_suat_th: x.nang_suat })), tenBen, now: LD?.now });
  const cranesLT = D.vehicles.filter((x) => x.doi === "Cẩu").map((x) => ({ ...x, loai: x.model, nang_suat_th: x.nang_suat }));
  const baiLT = viecBaiTuLinetime(LD, doi, { cranes: cranesLT, now: LD?.now });
  // Việc tàu nhập tay đời cũ bị bỏ (tàu lấy từ Linetime); việc Cảng nhập tay bằng nút "Thêm việc cảng" thì giữ
  const jobs = [...tauLT, ...baiLT, ...D.plan.jobs.filter((j) => j.loai !== "tau" || laViecCangTay(j))];
  const R = calc12(withCap(pp, doi, capCang, capBai), jobs, doi);
  return { cfg, goc, phanBo, tinh, ssDoi, capCang, capBai, trung, R };
}

export default function LongTerm() {
  const { D, api, run, canWrite, isAdmin } = useApp();
  const P = D.plan;
  const saved = P.params.dai_han;
  const [pp, setPp] = useState(() => clone(saved));
  const [dlg, setDlg] = useState(null); // {loai, job?}
  const [doi, setDoiState] = useState(() => { try { const x = localStorage.getItem(LS_DOI); return x && D.doiList.includes(x) ? x : DOI_GOC; } catch { return DOI_GOC; } });
  const setDoi = (v) => { setDoiState(v); try { localStorage.setItem(LS_DOI, v); } catch { /* bỏ qua */ } };
  const dirty = JSON.stringify(pp) !== JSON.stringify(saved);
  // Tàu lấy tự động từ Linetime (phương án đã duyệt, chưa duyệt thì phiếu chuyến › Bãi & Thiết bị); việc Cảng / bãi khác nhập tay
  const lg = useLogistics();
  const LD = lg?.D;
  const { cfg, goc, phanBo, tinh, ssDoi, capCang, capBai, trung, R } = useMemo(() => tinhDaiHan(D, LD, pp, doi), [D, LD, pp, doi]);
  const setTinh = (k, v) => setPp((o) => ({ ...o, capTinh: { ...(o.capTinh || {}), [doi]: { ...capTinhOf(o, doi), [k]: v } } }));
  const toCuaDoi = D.toList.filter((t) => D.vehicles.some((v) => v.doi === doi && v.to_xe === t));
  const luuBar = dirty && <>
    <span className="small warn">{isAdmin ? "Có thay đổi chưa lưu" : "Đang xem thử, không lưu được (chỉ quản trị)"}</span>
    <button className="btn sm ghost" onClick={() => setPp(clone(saved))}><RotateCcw size={14} />Hoàn tác</button>
    {isAdmin && <button className="btn sm pri" onClick={() => run(() => api.savePlanParams("dai_han", pp), "Đã lưu tham số")}><Save size={14} />Lưu tham số</button>}
  </>;
  const setP = (k, v) => setPp((o) => ({ ...o, p: { ...o.p, [k]: v } }));
  // Sửa cấu hình của đội đang chọn (đội gốc lưu ở p / prod như cũ, đội khác lưu trong doi[tên đội])
  const setCfg = (k, v) => setPp((o) => {
    if (goc) return k === "prod" ? { ...o, prod: v } : { ...o, p: { ...o.p, [k]: v } };
    return { ...o, doi: { ...(o.doi || {}), [doi]: { ...cfgOf(o, doi), [k]: v } } };
  });
  const setProd = (i, k, v) => setCfg("prod", cfg.prod.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const numIn = (val, on, extra = {}) => <input className="inp sm num mono" type="number" value={val ?? ""} onChange={(e) => on(e.target.value === "" ? null : Number(e.target.value))} style={{ width: 80 }} {...extra} />;

  const xeDoi = D.vehicles.filter((v) => v.doi === doi);
  const xeSS = ssDoi.length;
  const hangAll = [...new Set([...Object.keys(HANG_COLOR), ...(pp.prod || []).map((x) => x.hang), ...Object.values(pp.doi || {}).flatMap((c) => (c.prod || []).map((x) => x.hang)), ...P.jobs.map((j) => j.hang)].filter(Boolean))];

  return (
    <>
      <div className="card mb doi-bar">
        <Truck size={16} className="accent" />
        <b>Đội xe lập kế hoạch</b>
        <Select className="inp sm" value={doi} onChange={setDoi} options={D.doiList} style={{ width: 190 }} aria-label="Chọn đội xe" />
        <span className="small mute">Đội có <b>{xeDoi.length}</b> xe, <b className="ok">{xeSS}</b> xe đang sẵn sàng.
          Mọi số liệu bên dưới (phân bổ, tham số, tàu, việc bãi, biểu đồ, timeline) là của đội đang chọn.</span>
      </div>

      <div className="grid g-kpi mb">
        <Kpi label="Ca THIẾU xe" value={R.kpi.caTHIEU} icon={AlertTriangle} tone={R.kpi.caTHIEU ? "bad" : "ok"} foot={`trong ${pp.p.nShifts} ca hiển thị`} />
        <Kpi label="Ca thiếu xe cảng" value={R.kpi.caThieuCang} icon={Anchor} tone={R.kpi.caThieuCang ? "warn" : "ok"} />
        <Kpi label="Ca thiếu xe bãi" value={R.kpi.caThieuBai} icon={Layers} tone={R.kpi.caThieuBai ? "warn" : "ok"} />
        <Kpi label="Cầu cảng cao nhất" value={R.kpi.cauCangMax} unit={`/ ${capCang} xe`} icon={BarChart3} tone={R.kpi.cauCangMax > R.capCang ? "bad" : "info"} />
        <Kpi label="Tàu đang làm" value={R.kpi.tauMoc} icon={Ship} tone="violet" foot={`tại mốc ${fmtDT(R.moc)}`} />
        <Kpi label="Tàu có cảnh báo" value={R.kpi.tauCanhBao} icon={AlertTriangle} tone={R.kpi.tauCanhBao ? "bad" : "ok"} foot="Trùng bến, thiếu bến, thiếu dữ liệu" />
      </div>

      <Card className="mb" title={`Phân bổ cố định${goc ? " & cơ cấu xe" : ""} · ${doi}`} icon={Layers} right={luuBar}>
        <div className={"grid " + (goc ? "g-2" : "")}>
          <PhanBoCoDinh doi={doi} rows={phanBo} onChange={(rows) => setPp((o) => ({ ...o, phanBo: { ...(o.phanBo || {}), [doi]: rows } }))} />
          {goc && <CoCauXucDao phanBo={phanBo} />}
        </div>
      </Card>

      <Card className="mb" title="Tham số" icon={SlidersHorizontal} right={luuBar}>
        <div className="grid g-3">
          <div>
            <div className="sec-t">Thời gian & ca (chung)</div>
            <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))" }}>
              <Field label="Ngày bắt đầu lưới"><DateTimeInput value={pp.p.bd} onChange={(v) => setP("bd", v)} /></Field>
              <Field label="Mốc cập nhật &quot;còn lại&quot;"><DateTimeInput value={pp.p.moc} onChange={(v) => setP("moc", v)} /></Field>
              <Field label="Giờ bắt đầu ca N (ngày)">{numIn(pp.p.gioN, (v) => setP("gioN", v ?? 8), { min: 0, max: 23 })}</Field>
              <Field label="Số ca hiển thị">{numIn(pp.p.nShifts, (v) => setP("nShifts", Math.max(2, Math.min(120, v || 60))), { min: 2, max: 120 })}</Field>
            </div>
            <div className="small mute" style={{ marginTop: 6 }}>N = CA 1 ngày từ {pad(pp.p.gioN)}h, Đ = CA 2 đêm từ {pad((pp.p.gioN + pp.p.caLen) % 24)}h. Mỗi ca {pp.p.caLen}h. Lưới bắt đầu từ ca đầu tiên kể từ "Ngày bắt đầu lưới".</div>
          </div>
          <div>
            <div className="sec-t">Đội {doi} & hệ số</div>
            <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }}>
              <Field label="Xe dành cho cảng" className="full">
                <span className="row cap-row">
                  <Select className="inp sm" value={tinh.cang?.length ? "to" : "tay"} onChange={(m) => setTinh("cang", m === "to" ? (toCuaDoi.includes("Tổ PVC") ? ["Tổ PVC"] : toCuaDoi.slice(0, 1)) : [])} options={[["to", "Xe sẵn sàng của tổ"], ["tay", "Nhập tay"]]} style={{ width: 160 }} aria-label="Cách tính xe cảng" />
                  {tinh.cang?.length ? <><MultiSelect prefix="Tổ" value={tinh.cang} onChange={(v) => setTinh("cang", v.length ? v : tinh.cang)} options={toCuaDoi} style={{ width: 180 }} /><b className="mono cap-v">= {capCang}</b></>
                    : numIn(cfg.capCang, (v) => setCfg("capCang", v ?? 0))}
                </span>
              </Field>
              <Field label="Xe dành cho bãi" className="full">
                <span className="row cap-row">
                  <Select className="inp sm" value={tinh.bai ? "con_lai" : "tay"} onChange={(m) => setTinh("bai", m === "con_lai" ? (goc ? "Bánh xích" : "Tất cả") : null)} options={[["con_lai", "Còn lại sau phân bổ"], ["tay", "Nhập tay"]]} style={{ width: 160 }} aria-label="Cách tính xe bãi" />
                  {tinh.bai ? <>{goc && <Select className="inp sm" value={tinh.bai} onChange={(v) => setTinh("bai", v)} options={[...LOAI_XD, "Tất cả"]} style={{ width: 120 }} aria-label="Loại xe" />}<b className="mono cap-v">= {capBai}</b></>
                    : numIn(cfg.capBai, (v) => setCfg("capBai", v ?? 0))}
                </span>
              </Field>
              <Field label="Hệ số ca đầu">{numIn(cfg.ramp1, (v) => setCfg("ramp1", v ?? 1), { step: 0.05, min: 0, max: 1 })}</Field>
              <Field label="Hệ số ca thứ hai">{numIn(cfg.ramp2, (v) => setCfg("ramp2", v ?? 1), { step: 0.05, min: 0, max: 1 })}</Field>
              <Field label="Hệ số ca cuối">{numIn(cfg.ramp3, (v) => setCfg("ramp3", v ?? 1), { step: 0.05, min: 0, max: 1 })}</Field>
            </div>
            {trung > 0 && <div className="small warn" style={{ marginTop: 6 }}>{trung} xe sẵn sàng của {tinh.cang.join(", ")} cũng nằm trong phần còn lại {goc && tinh.bai !== "Tất cả" ? "của " + tinh.bai.toLowerCase() : "của đội"}, nên đang được tính cả cho cảng và bãi.</div>}
            <div className="small mute" style={{ marginTop: 6 }}>
              Cảng + bãi = {capCang + capBai} xe ({xeSS} xe sẵn sàng). Số tự tính đổi theo tình trạng xe hằng ngày. Hệ số của đội {doi}: ca đầu của tàu chạy {Math.round(cfg.ramp1 * 100)}% số xe, ca thứ hai {Math.round(cfg.ramp2 * 100)}%,
              ca cuối (ca có giờ kết thúc) {Math.round(cfg.ramp3 * 100)}%, các ca giữa 100%.
            </div>
          </div>
          <div>
            <div className="sec-t">Năng suất & số xe theo hàng · {doi}</div>
            <div className="tw" style={{ maxHeight: 300 }}>
              <table className="t compact">
                <thead><tr><th>Hàng</th><th>Cách làm</th><th className="n">T/h mỗi xe</th><th className="n">Tối thiểu</th><th className="n">Tối đa</th><th></th></tr></thead>
                <tbody>{cfg.prod.map((x, i) => (
                  <tr key={i}>
                    <td><span className="row" style={{ gap: 6, flexWrap: "nowrap" }}><i style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: hangColor(x.hang), flex: "none" }} />
                      <input className="inp sm" list="dl-hang-ns" value={x.hang} onChange={(e) => setProd(i, "hang", e.target.value)} style={{ width: 86, fontWeight: 700 }} aria-label="Loại hàng" /></span></td>
                    <td><input className="inp sm" value={x.pt || ""} onChange={(e) => setProd(i, "pt", e.target.value)} style={{ width: 70 }} aria-label="Cách làm" /></td>
                    <td className="n">{numIn(x.ns, (v) => setProd(i, "ns", v ?? 1), { style: { width: 70 } })}</td>
                    <td className="n">{numIn(x.min, (v) => setProd(i, "min", v ?? 0), { style: { width: 56 } })}</td>
                    <td className="n">{numIn(x.max, (v) => setProd(i, "max", v ?? 0), { style: { width: 56 } })}</td>
                    <td><button className="btn ghost icon danger" title="Xóa loại hàng" onClick={() => setCfg("prod", cfg.prod.filter((_, j) => j !== i))}><Trash2 size={14} /></button></td>
                  </tr>
                ))}
                {!cfg.prod.length && <tr><td colSpan={6} className="mute">Chưa có loại hàng. Đội này chưa phục vụ tàu nào (trừ tàu nhập tay số xe).</td></tr>}
                </tbody>
              </table>
              <datalist id="dl-hang-ns">{hangAll.map((h) => <option key={h} value={h} />)}</datalist>
            </div>
            <button className="btn sm" style={{ marginTop: 8 }} onClick={() => setCfg("prod", [...cfg.prod, { hang: "", pt: "", ns: 100, min: 1, max: 5 }])}><Plus size={14} />Thêm loại hàng</button>
            <div className="small mute" style={{ marginTop: 6 }}>Xe gợi ý của tàu = làm tròn lên (T/h của tàu ÷ năng suất mỗi xe), trong khoảng tối thiểu – tối đa. Nhập số xe riêng cho tàu thì dùng số đó.</div>
          </div>
        </div>
      </Card>

      <Card className="mb" title="Thừa / thiếu xe theo ca" icon={BarChart3} hint={`Đội ${doi}: xe có − xe cần trong từng ca. Cột dưới trục (màu đỏ) là thiếu xe; vùng tô xanh là ca đang diễn ra. Kéo ngang để xem hết.`}>
        <BalanceChart R={R} />
      </Card>

      <Card className="mb" title="Timeline theo ca" icon={GanttChart} hint={`Số xe ${doi} mỗi tàu dùng trong từng ca (đã tính hệ số ca đầu, ca thứ hai, ca cuối).${canWrite ? " Kéo biểu tượng ⠿ ở đầu dòng để sắp xếp." : ""}`}>
        <Timeline R={R} />
      </Card>

      <Card title={`Danh sách công việc · ${doi} (${R.ves.length} tàu · ${R.fixed.length} việc bãi)`} icon={Ship}
        hint={LD?.voyages ? "Tự lấy từ Linetime tàu cập bến: chuyến đã duyệt phương án thì số lượng và thời gian theo phương án; chưa duyệt thì theo phiếu chuyến › Bãi & Thiết bị (ETB, cam kết, ETD). Tính cả xe / thiết bị nhà thầu. Xe vận chuyển, be hầm / hót vét, hỗ trợ chung là việc Cảng; thiết bị lên hàng / hạ hàng / vun hàng là việc bãi, đúng thời gian của chuyến tàu. Việc Cảng / bãi khác nhập tay." : "Tàu lấy từ Linetime: tài khoản cần quyền Khai thác Cảng."}
        right={canWrite && <div style={{ display: "flex", gap: 6 }}>
          <button className="btn sm" onClick={() => setDlg({ loai: "tau" })}><Plus size={14} />Thêm việc cảng</button>
          <button className="btn sm" onClick={() => setDlg({ loai: "bai" })}><Plus size={14} />Thêm việc bãi</button>
        </div>}>
        {R.ves.length || R.fixed.length ? (
          <div className="tw" style={{ maxHeight: 520 }}>
            <table className="t">
              <thead><tr><th>Loại</th><th>Tên công việc</th><th>Hàng</th><th>Vị trí</th><th>Bắt đầu</th><th>Kết thúc</th><th className="n">KL · còn lại</th><th>Số xe</th><th className="n">Tiến độ</th><th>Cảnh báo</th><th className="act"></th></tr></thead>
              <tbody>
                {R.ves.map((r) => {
                  return (
                    <tr key={r.id}>
                      <td><Badge tone="info" plain>{r.job.lt ? "Tàu" : "Cảng"}</Badge></td><td><b>{r.ten}</b></td><td>{r.hang}</td><td>{r.ben}</td>
                      <td className="mono">{fmtDT(r.bd)}</td><td className="mono">{fmtDT(r.kt)}</td>
                      <td className="n">{kl(r.kl)}{r.conlai != null && <span className="mute small"> · {kl(r.conlai)}</span>}</td>
                      <td><b>{r.dung ?? ""}</b>{r.job.nguon ? <span className="mute small"> theo {r.job.nguon}</span> : r.goi != null && r.dung !== r.goi && <span className="mute small"> (gợi ý {r.goi})</span>}</td>
                      <td className="n"><Progress v={r.tienDo} /></td>
                      <td><Badge tone={r.canh === "OK" ? "ok" : r.canh === "Đã xong" ? "" : "bad"} plain>{r.canh}</Badge></td>
                      <td className="act">{r.job.lt ? <button className="btn sm" onClick={() => lg?.setVoyageMo?.(r.job.lt)} title="Mở phiếu chuyến (sửa ở Linetime / Phương án làm hàng)">Phiếu chuyến</button> : <Acts job={r.job} onEdit={() => setDlg({ loai: "tau", job: r.job })} />}</td>
                    </tr>
                  );
                })}
                {R.fixed.map((f) => (
                  <tr key={f.id}>
                    <td><Badge tone="orange" plain>Bãi</Badge></td><td><b>{f.cv}</b></td><td>{f.hang}</td><td>{f.ben}</td>
                    <td className={f.job.tu ? "mono" : undefined}>{f.job.tu ? fmtDT(new Date(f.job.tu)) : vn(f.from)}</td><td className={f.job.den ? "mono" : undefined}>{f.job.den ? fmtDT(new Date(f.job.den)) : vn(f.to)}</td>
                    <td className="n">{kl(f.kl)}{f.conlai != null && <span className="mute small"> · {kl(f.conlai)}</span>}</td>
                    <td><b>{f.n}</b> ngày / <b>{f.d}</b> đêm{f.job.nguon && <span className="mute small"> theo {f.job.nguon}</span>}</td>
                    <td className="n"><Progress v={f.tienDo} /></td><td><Badge tone="ok" plain>OK</Badge></td>
                    <td className="act">{f.job.lt ? <button className="btn sm" onClick={() => lg?.setVoyageMo?.(f.job.lt)} title="Mở phiếu chuyến (sửa ở Linetime / Phương án làm hàng)">Phiếu chuyến</button> : <Acts job={f.job} onEdit={() => setDlg({ loai: "bai", job: f.job })} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>Chưa có tàu hay việc bãi nào.</Empty>}
      </Card>
      {dlg && <JobDialog loai={dlg.loai} job={dlg.job} pp={pp} doi={doi} hangAll={hangAll} onClose={() => setDlg(null)} />}
    </>
  );
}

const kl = (x) => (x == null ? "" : Number(x).toLocaleString("vi-VN"));

// ---------- Phân bổ phương tiện cố định (theo đội đang chọn) ----------
// Mỗi dòng: vị trí, loại xe + thiết bị gắn (xúc đào) hoặc ghi chú (đội khác), số xe. Lưu cùng tham số dài hạn (quản trị bấm "Lưu tham số").
export const LOAI_XD = ["Bánh xích", "Bánh lốp", "Mini"];
// Loại xúc đào suy từ tên model: "mini" -> Mini, "bánh lốp" -> Bánh lốp, còn lại Bánh xích
export const loaiXucDao = (v) => (/mini/i.test(v.model || "") ? "Mini" : /bánh\s*lốp/i.test(v.model || "") ? "Bánh lốp" : "Bánh xích");
const TBG_COLOR = { "Gầu": "#3b82f6", "Búa": "#f59e0b", "Nhóp": "#12a877", "Mâm từ": "#a855f7", "Xới": "#ec4899", "Chưa khai báo": "#64748b" };
const TbgDot = ({ t }) => <i className="tbg-dot" style={{ background: TBG_COLOR[t] || hangColor(t) }} />;
function PhanBoCoDinh({ doi, rows, onChange }) {
  const { D, canWrite } = useApp();
  const xd = doi === DOI_GOC;
  const set = (i, k, v) => onChange(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const tong = rows.reduce((a, r) => a + (+r.so_xe || 0), 0);
  const xe = D.vehicles.filter((v) => v.doi === doi);
  const ss = xe.filter((v) => D.isReady(v.ma)).length;
  const viTri = [...new Set([...rows.map((r) => r.vi_tri), ...D.plan.jobs.map((j) => j.vi_tri)].filter(Boolean))];
  const nCot = xd ? 5 : 4;
  return (
    <div>
      <div className="sec-t">Phân bổ phương tiện cố định · {doi}</div>
      <div className="tw" style={{ maxHeight: 330 }}>
        <table className="t compact">
          <thead><tr><th>Vị trí</th>{xd && <th>Loại xe</th>}{xd ? <th>Thiết bị gắn</th> : <th>Ghi chú</th>}<th className="n">Số xe</th><th></th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{canWrite ? <input className="inp sm" list="dl-vi-tri" value={r.vi_tri || ""} onChange={(e) => set(i, "vi_tri", e.target.value)} style={{ width: 130 }} aria-label="Vị trí" /> : <b>{r.vi_tri}</b>}</td>
                {xd && <td>{canWrite ? <Select className="inp sm" value={r.loai || ""} onChange={(v) => set(i, "loai", v)} options={LOAI_XD} blank="—" style={{ width: 108 }} aria-label="Loại xe" /> : r.loai}</td>}
                {xd
                  ? <td>{canWrite ? <Select className="inp sm" value={r.thiet_bi_gan || ""} onChange={(v) => set(i, "thiet_bi_gan", v || null)} options={D.thietBiGanList} blank="—" style={{ width: 100 }} aria-label="Thiết bị gắn" /> : r.thiet_bi_gan && <><TbgDot t={r.thiet_bi_gan} />{r.thiet_bi_gan}</>}</td>
                  : <td>{canWrite ? <input className="inp sm" value={r.ghi_chu || ""} onChange={(e) => set(i, "ghi_chu", e.target.value)} style={{ width: 130 }} aria-label="Ghi chú" /> : r.ghi_chu}</td>}
                <td className="n">{canWrite ? <input className="inp sm num mono" type="number" min="0" value={r.so_xe ?? ""} onChange={(e) => set(i, "so_xe", e.target.value === "" ? null : Math.max(0, +e.target.value))} style={{ width: 58 }} aria-label="Số xe" /> : r.so_xe}</td>
                <td>{canWrite && <button className="btn ghost icon danger" title="Xóa dòng" onClick={() => onChange(rows.filter((_, j) => j !== i))}><Trash2 size={14} /></button>}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={nCot} className="mute">Chưa có vị trí cố định cho đội {doi}.</td></tr>}
            {rows.length > 0 && <tr className="tot"><td colSpan={nCot - 2}>Tổng {rows.length} vị trí <span className="small mute" style={{ fontWeight: 500 }}>· {ss} xe sẵn sàng, còn <b className={ss - tong < 0 ? "bad" : ""}>{ss - tong}</b></span></td><td className="n">{tong}</td><td></td></tr>}
          </tbody>
        </table>
        <datalist id="dl-vi-tri">{viTri.map((x) => <option key={x} value={x} />)}</datalist>
      </div>
      {canWrite && <button className="btn sm" style={{ marginTop: 8 }} onClick={() => onChange([...rows, xd ? { vi_tri: "", loai: "Bánh xích", thiet_bi_gan: null, so_xe: 1 } : { vi_tri: "", so_xe: 1, ghi_chu: "" }])}><Plus size={14} />Thêm vị trí</button>}
    </div>
  );
}

// ---------- Cơ cấu xúc đào theo loại và thiết bị gắn (bảng) ----------
// Thiết bị gắn của xe lấy từ cột vehicles.thiet_bi_gan; phân bổ cố định khớp theo loại xe + thiết bị gắn của dòng phân bổ.
function CoCauXucDao({ phanBo }) {
  const { D } = useApp();
  const xe = D.vehicles.filter((v) => v.doi === DOI_GOC);
  const CHUA = "Chưa khai báo", KHONG_TB = "Chưa chọn TB gắn";
  const tbgList = [...new Set([...D.thietBiGanList, ...xe.map((v) => D.thietBiGanOf(v))])].sort((a, b) => (a === CHUA) - (b === CHUA));
  const pbOf = (loai, t) => phanBo.filter((x) => x.loai === loai && (t === KHONG_TB ? !x.thiet_bi_gan : x.thiet_bi_gan === t)).reduce((a, x) => a + (+x.so_xe || 0), 0);
  const nhom = LOAI_XD.map((loai) => {
    const vs = xe.filter((v) => loaiXucDao(v) === loai);
    const con = [...tbgList, KHONG_TB].map((t) => {
      const v2 = t === KHONG_TB ? [] : vs.filter((v) => D.thietBiGanOf(v) === t);
      return { t, tong: v2.length, ss: v2.filter((v) => D.isReady(v.ma)).length, pb: pbOf(loai, t) };
    }).filter((r) => r.tong || r.pb);
    const sum = con.reduce((a, r) => ({ tong: a.tong + r.tong, ss: a.ss + r.ss, pb: a.pb + r.pb }), { tong: 0, ss: 0, pb: 0 });
    return { loai, ...sum, con };
  }).filter((g) => g.tong || g.pb);
  const tot = nhom.reduce((a, g) => ({ tong: a.tong + g.tong, ss: a.ss + g.ss, pb: a.pb + g.pb }), { tong: 0, ss: 0, pb: 0 });
  const conLai = (r) => <td className={"n " + (r.ss - r.pb < 0 ? "bad" : "")}><b>{r.ss - r.pb}</b></td>;
  const chua = xe.filter((v) => !v.thiet_bi_gan).length;
  return (
    <div>
      <div className="sec-t">Cơ cấu xúc đào · thiết bị gắn</div>
      <div className="tw" style={{ maxHeight: 380 }}>
        <table className="t compact">
          <thead><tr><th>Loại</th><th>Thiết bị gắn</th><th className="n">Tổng xe</th><th className="n">Sẵn sàng</th><th className="n">Phân bổ cố định</th><th className="n">Còn lại</th></tr></thead>
          <tbody>
            {nhom.flatMap((g) => [
              <tr key={g.loai} className="cc-loai"><td><b>{g.loai}</b></td><td className="mute small">Cộng</td><td className="n"><b>{g.tong}</b></td><td className="n ok"><b>{g.ss}</b></td><td className="n"><b>{g.pb}</b></td>{conLai(g)}</tr>,
              ...g.con.map((r) => (
                <tr key={g.loai + r.t}><td></td><td className={r.t === CHUA || r.t === KHONG_TB ? "mute" : ""}>{r.t !== KHONG_TB && <TbgDot t={r.t} />}{r.t}</td>
                  <td className="n">{r.tong || ""}</td><td className="n ok">{r.tong ? r.ss : ""}</td><td className="n">{r.pb || ""}</td>{r.t === KHONG_TB ? <td className="n mute" title="Dòng phân bổ chưa chọn thiết bị gắn: chỉ trừ ở dòng Cộng của loại xe">–</td> : conLai(r)}</tr>
              )),
            ])}
            <tr className="tot"><td>Tổng</td><td></td><td className="n">{tot.tong}</td><td className="n">{tot.ss}</td><td className="n">{tot.pb}</td>{conLai(tot)}</tr>
          </tbody>
        </table>
      </div>
      {chua > 0 && <div className="small warn" style={{ marginTop: 6 }}>{chua} xe xúc đào chưa khai báo thiết bị gắn. Nhập ở Tab 2 › bấm mã xe › Sửa thông tin, hoặc điền cột thiet_bi_gan trong Danh mục xe.xlsx rồi Import.</div>}
      <div className="small mute" style={{ marginTop: 6 }}>Còn lại = xe sẵn sàng − phân bổ cố định, theo loại xe và thiết bị gắn của dòng phân bổ.</div>
    </div>
  );
}

function Progress({ v }) {
  if (v == null) return null;
  return <div className="bar-cell" style={{ minWidth: 100 }}><div className="track"><i style={{ width: `${v * 100}%`, background: "var(--accent)" }} /></div><span className="mono small">{Math.round(v * 100)}%</span></div>;
}

function Acts({ job, onEdit }) {
  const { api, run, canWrite, isAdmin } = useApp();
  return (
    <div className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
      {canWrite && <button className="btn sm" onClick={onEdit}>Sửa</button>}
      {isAdmin && <ConfirmButton onConfirm={() => run(() => api.deletePlanJob(job.id), `Đã xóa ${job.ten}`)} />}
    </div>
  );
}

// Tiêu đề cột ca dùng chung cho bảng thừa / thiếu và timeline: "14/10 · N 08h"
function ShiftHead({ shifts, label = "Ca" }) {
  return (
    <thead><tr><th className="tl-lab">{label}</th>{shifts.map((s, i) => (
      <th key={i} className={s.now ? "tl-now" : s.lab === "N" ? "tl-n" : "tl-d"}>{fmtD(s.st)}<br />{s.lab} {pad(s.st.getHours())}h</th>
    ))}</tr></thead>
  );
}

// Tổng quan › Tình trạng thiết bị › Năng lực đáp ứng: bảng các đội (số ca thiếu xe trong các ca hiển thị) và
// biểu đồ thừa / thiếu xe theo ca của đội đang chọn, theo tham số Dài hạn đã lưu.
export function NangLucDapUng() {
  const { D } = useApp();
  const LD = useLogistics()?.D;
  const pp = D.plan.params.dai_han;
  const tatCa = useMemo(() => D.doiList.filter((d) => d !== "Cẩu" && D.vehicles.some((v) => v.doi === d)).map((d) => ({ doi: d, ...tinhDaiHan(D, LD, pp, d) })), [D, LD, pp]);
  const [doi, setDoi] = useState(() => { try { const x = localStorage.getItem(LS_DOI); return x && D.doiList.includes(x) ? x : DOI_GOC; } catch { return DOI_GOC; } });
  const chon = tatCa.find((x) => x.doi === doi) || tatCa[0];
  if (!chon) return <Empty>Chưa có đội xe.</Empty>;
  const R = chon.R;
  const thieuNhat = (r) => Math.min(0, ...r.shifts.map((x) => x.balChung));
  return (
    <>
      <div className="tw mb" style={{ maxHeight: 260 }}>
        <table className="t">
          <thead><tr><th>Đội</th><th className="n">Xe cảng / bãi</th><th className="n">Tàu</th><th className="n">Ca THIẾU</th><th className="n">Ca thiếu cảng</th><th className="n">Ca thiếu bãi</th><th className="n">Thiếu nhiều nhất</th></tr></thead>
          <tbody>{tatCa.map((x) => { const t = thieuNhat(x.R); return (
            <tr key={x.doi} onClick={() => setDoi(x.doi)} style={{ cursor: "pointer", background: x.doi === chon.doi ? "var(--accent-soft)" : undefined }}>
              <td><b className={x.doi === chon.doi ? "accent" : ""}>{x.doi}</b></td>
              <td className="n mono">{x.capCang} / {x.capBai}</td>
              <td className="n mono">{x.R.ves.length}</td>
              <td className={"n mono " + (x.R.kpi.caTHIEU ? "bad" : "ok")}>{x.R.kpi.caTHIEU}</td>
              <td className={"n mono " + (x.R.kpi.caThieuCang ? "warn" : "")}>{x.R.kpi.caThieuCang || ""}</td>
              <td className={"n mono " + (x.R.kpi.caThieuBai ? "warn" : "")}>{x.R.kpi.caThieuBai || ""}</td>
              <td className={"n mono " + (t < 0 ? "bad" : "")}>{t < 0 ? `${t} xe` : ""}</td>
            </tr>); })}</tbody>
        </table>
      </div>
      <div className="sec-t" style={{ marginTop: 0, flexWrap: "wrap" }}>Thừa / thiếu xe theo ca · đội {chon.doi} <span className="small mute" style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>· có {chon.capCang} xe cảng, {chon.capBai} xe bãi · {pp.p.nShifts} ca từ {fmtDT(R.moc)} · bấm dòng đội ở bảng trên để đổi</span></div>
      <BalanceChart R={R} />
      <div className="small mute" style={{ marginTop: 6 }}>Theo tham số đã lưu ở Kế hoạch & phân bổ › Dài hạn: xe có − xe cần trong từng ca; tàu lấy từ Linetime (phương án đã duyệt, chưa duyệt thì phiếu chuyến › Bãi & Thiết bị), việc khác nhập tay. Cột đỏ là thiếu xe.</div>
    </>
  );
}

// Biểu đồ thừa / thiếu xe theo ca. Trục ngang ghi ngày + ca giống tiêu đề timeline ("14/10" / "N 08h").
function BalanceChart({ R }) {
  const P = usePalette();
  const { shifts, capCang, capBai } = R;
  const data = shifts.map((s, i) => ({ i, d: fmtD(s.st), ca: `${s.lab} ${pad(s.st.getHours())}h`, lab: s.lab, now: s.now, st: s.st, cang: s.balCang, bai: s.balBai, chung: s.balChung, tt: s.tt, cauCang: s.cang, cauBai: s.bai }));
  const colW = 46, w = Math.max(640, shifts.length * colW + 50);
  const Tick = ({ x, y, payload }) => {
    const s = data[payload.value]; if (!s) return null;
    const c = s.now ? P.accent : s.lab === "N" ? P.ink2 : P.mute;
    return <g transform={`translate(${x},${y})`}><text dy={12} textAnchor="middle" fontSize={10.5} fontWeight={s.lab === "N" ? 700 : 500} fill={c}>{s.d}</text><text dy={25} textAnchor="middle" fontSize={10} fill={c}>{s.ca}</text></g>;
  };
  const Tip = ({ active, payload }) => {
    if (!active || !payload?.length) return null; const s = payload[0].payload;
    const r = (n, v, c, sub) => <div className="r" key={n}><span><i style={{ background: c }} />{n}{sub && <span className="mute"> {sub}</span>}</span><b className={"mono " + (v < 0 ? "bad" : "")}>{v > 0 ? "+" : ""}{v}</b></div>;
    return <div className="tip"><div className="h">{fmtDT(s.st)} · {s.lab === "N" ? "CA 1 (ngày)" : "CA 2 (đêm)"}{s.now ? " · đang diễn ra" : ""}</div>
      {r("Cảng", s.cang, P.info, `(có ${capCang}, cần ${s.cauCang})`)}{r("Bãi", s.bai, P.warn, `(có ${capBai}, cần ${s.cauBai})`)}{r("Chung", s.chung, P.accent)}
      <div className="r" style={{ marginTop: 4 }}><span>Tình trạng</span><b className={s.tt === "OK" ? "ok" : s.tt === "THIẾU" ? "bad" : "warn"}>{s.tt}</b></div></div>;
  };
  const nowI = data.findIndex((s) => s.now);
  return (
    <>
      <div className="legend mb">
        <span><i style={{ background: P.info }} />Cảng (có − cần)</span><span><i style={{ background: P.warn }} />Bãi (có − cần)</span>
        <span><i style={{ background: P.bad }} />Cột đỏ: thiếu xe</span><span><i style={{ background: P.accent, height: 2 }} />Chung (cảng + bãi)</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <ComposedChart width={w} height={260} data={data} margin={{ top: 10, right: 10, bottom: 22, left: 0 }} barGap={1} barCategoryGap={5}>
          <CartesianGrid stroke={P.line} vertical={false} />
          {nowI >= 0 && <ReferenceArea x1={nowI} x2={nowI} fill={P.accent} fillOpacity={0.12} stroke={P.accent} strokeOpacity={0.6} />}
          <XAxis dataKey="i" tick={<Tick />} interval={0} axisLine={false} tickLine={false} height={34} />
          <YAxis tick={{ fill: P.mute, fontSize: 11 }} axisLine={false} tickLine={false} width={34} allowDecimals={false} />
          <ReferenceLine y={0} stroke={P.mute} />
          <Tooltip cursor={{ fill: P.raise, opacity: 0.5 }} content={<Tip />} />
          {[["cang", P.info], ["bai", P.warn]].map(([k, c]) => (
            <Bar key={k} dataKey={k} isAnimationActive={false} radius={[2, 2, 2, 2]} maxBarSize={16}>
              {data.map((s) => <Cell key={s.i} fill={s[k] < 0 ? P.bad : c} />)}
            </Bar>
          ))}
          <Line dataKey="chung" type="monotone" stroke={P.accent} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </div>
    </>
  );
}

function Timeline({ R }) {
  const { api, run, canWrite } = useApp();
  const { shifts, ves, fixed, capCang, capBai } = R;
  const [drag, setDrag] = useState(null); // {sec, id}
  const [over, setOver] = useState(null);
  const used = ves.filter((r) => r.cnt.some((c) => c > 0)), fx = fixed.filter((f) => f.cnt.some((c) => c > 0));
  const ttCls = (t) => (t === "OK" ? "ok" : t === "THIẾU" ? "tl-neg" : "warn");
  const sec = (t) => <tr className="tl-sec"><td className="tl-lab">{t}</td><td colSpan={shifts.length} /></tr>;
  const tot = (label, fn) => <tr><td className="tl-lab"><b>{label}</b></td>{shifts.map((s, i) => <td key={i} className="n">{fn(s)}</td>)}</tr>;

  // Kéo thả: đặt dòng được kéo vào vị trí dòng đích, lưu lại thứ tự cả nhóm (tàu hoặc việc bãi của đội)
  const drop = (secName, targetId) => {
    if (!drag || drag.sec !== secName || drag.id === targetId) return;
    const all = (secName === "tau" ? ves : fixed).map((x) => x.job).filter((j) => !j.lt).sort(byThuTu); // việc lấy từ chuyến tàu không kéo thả
    const from = all.findIndex((j) => j.id === drag.id), to = all.findIndex((j) => j.id === targetId);
    if (from < 0 || to < 0) return;
    const [m] = all.splice(from, 1); all.splice(to, 0, m);
    const rows = all.map((j, i) => ({ id: j.id, thu_tu: (i + 1) * 10 })).filter((r, i) => all[i].thu_tu !== r.thu_tu);
    if (rows.length) run(() => api.reorderPlanJobs(rows), "Đã lưu thứ tự dòng");
  };
  const dnd = (secName, id) => !canWrite ? {} : {
    draggable: true,
    onDragStart: (e) => { setDrag({ sec: secName, id }); e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", String(id)); } catch { /* bỏ qua */ } },
    onDragOver: (e) => { if (drag?.sec === secName) { e.preventDefault(); if (over !== id) setOver(id); } },
    onDragLeave: () => setOver((o) => (o === id ? null : o)),
    onDrop: (e) => { e.preventDefault(); drop(secName, id); setDrag(null); setOver(null); },
    onDragEnd: () => { setDrag(null); setOver(null); },
    className: (drag?.id === id ? "tl-dragging " : "") + (over === id && drag?.id !== id ? "tl-over" : ""),
  };
  const grip = canWrite ? <GripVertical size={13} className="tl-grip" aria-hidden="true" /> : null;
  const hangs = [...new Set(used.map((r) => r.hang).filter(Boolean))];

  return (
    <>
      <div className="legend mb">{hangs.map((h) => <span key={h}><i style={{ background: hangColor(h) }} />{h}</span>)}<span><i style={{ background: BAI_COLOR }} />việc bãi cố định</span></div>
      <div className="tw" style={{ maxHeight: 620 }}>
        <table className="t tl">
          <ShiftHead shifts={shifts} />
          <tbody>
            {sec("CẢNG – số xe theo từng tàu")}
            {used.map((r) => <tr key={r.id} {...(r.job.lt ? {} : dnd("tau", r.id))}><td className="tl-lab" title={r.ten}>{!r.job.lt && grip}<b>{r.ten}</b> <span className="mute">{r.hang} · bến {r.ben} · {r.dung ?? "?"} xe</span></td>
              {r.cnt.map((c, i) => <td key={i} className="tl-bar" style={c ? { background: hangColor(r.hang) } : undefined}>{c || ""}</td>)}</tr>)}
            {!used.length && <tr><td className="tl-lab mute">Đội này chưa có tàu trong lưới</td><td colSpan={shifts.length} /></tr>}
            {tot("Tổng cầu cảng", (s) => <b>{s.cang}</b>)}
            {tot("Xe cảng có", () => capCang)}
            <tr><td className="tl-lab"><b>Cân bằng cảng</b></td>{shifts.map((s, i) => <td key={i} className={"n " + (s.balCang < 0 ? "tl-neg" : "ok")}>{s.balCang}</td>)}</tr>
            {sec("BÃI – nhu cầu cố định")}
            {fx.map((f) => <tr key={f.id} {...(f.job.lt ? {} : dnd("bai", f.id))}><td className="tl-lab" title={f.cv}>{!f.job.lt && grip}<b>{f.cv}</b>{f.tienDo != null && <span className="mute"> · {Math.round(f.tienDo * 100)}%</span>}</td>{f.cnt.map((c, i) => <td key={i} className="tl-bar" style={c ? { background: BAI_COLOR } : undefined}>{c || ""}</td>)}</tr>)}
            {tot("Tổng cầu bãi", (s) => <b>{s.bai}</b>)}
            {tot("Xe bãi có", () => capBai)}
            <tr><td className="tl-lab"><b>Cân bằng bãi</b></td>{shifts.map((s, i) => <td key={i} className={"n " + (s.balBai < 0 ? "tl-neg" : "ok")}>{s.balBai}</td>)}</tr>
            {sec("KẾT LUẬN")}
            <tr><td className="tl-lab"><b>Cân bằng chung</b></td>{shifts.map((s, i) => <td key={i} className={"n " + (s.balChung < 0 ? "tl-neg" : "ok")}>{s.balChung}</td>)}</tr>
            <tr><td className="tl-lab"><b>Tình trạng</b></td>{shifts.map((s, i) => <td key={i} className={"tl-tt " + ttCls(s.tt)}>{s.tt}</td>)}</tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

function JobDialog({ loai, job, pp, doi, hangAll, onClose }) {
  const { D, api, run, toast } = useApp();
  const isTau = loai === "tau";
  const [f, setF] = useState(() => job ? { ...job, bat_dau: isoToLocal(job.bat_dau), doi: doiCuaViec(job), so_xe_tay: job.so_xe_tay ?? job.so_xe_doi?.[doiCuaViec(job)] ?? "" } : isTau
    ? { ten: "", hang: cfgOf(pp, doi).prod[0]?.hang || "", vi_tri: "", khoi_luong: "", con_lai: "", nang_suat: "", bat_dau: "", so_xe_tay: "", doi }
    : { ten: "", hang: "", vi_tri: "", tu_ngay: "", den_ngay: "", xe_ngay: 0, xe_dem: 0, doi, khoi_luong: "", con_lai: "" });
  const set = (k) => (v) => setF((o) => ({ ...o, [k]: v?.target ? v.target.value : v }));
  const n = (v) => (v === "" || v == null ? null : Number(v));
  const tienDo = n(f.khoi_luong) > 0 && n(f.con_lai) != null ? Math.max(0, 1 - n(f.con_lai) / n(f.khoi_luong)) : null;
  const save = async () => {
    let rec;
    const kl0 = n(f.khoi_luong), cl0 = n(f.con_lai);
    if (cl0 != null && kl0 != null && cl0 > kl0) return toast("Khối lượng còn lại không được lớn hơn khối lượng", "bad");
    if (isTau) {
      rec = { loai, ten: f.ten.trim(), hang: String(f.hang ?? "").trim(), vi_tri: String(f.vi_tri ?? "").trim(), khoi_luong: kl0, con_lai: cl0, nang_suat: n(f.nang_suat), bat_dau: localToIso(f.bat_dau), so_xe_tay: n(f.so_xe_tay), so_xe_doi: null, doi: f.doi || DOI_GOC, ghi_chu: DAU_VIEC_CANG };
      if (!rec.ten || !rec.hang || !rec.khoi_luong || !rec.nang_suat || !rec.bat_dau) return toast("Cần nhập tên công việc, hàng, khối lượng, năng suất và giờ bắt đầu", "bad");
    } else {
      rec = { loai, ten: f.ten.trim(), hang: String(f.hang ?? "").trim(), vi_tri: String(f.vi_tri ?? "").trim(), tu_ngay: f.tu_ngay || null, den_ngay: f.den_ngay || null, xe_ngay: n(f.xe_ngay) || 0, xe_dem: n(f.xe_dem) || 0, doi: f.doi || DOI_GOC, khoi_luong: kl0, con_lai: cl0 };
      if (!rec.ten) return toast("Cần nhập tên công việc", "bad");
      if (rec.tu_ngay && rec.den_ngay && rec.den_ngay < rec.tu_ngay) return toast("Đến ngày phải từ Từ ngày trở đi", "bad");
    }
    if (await run(() => (job ? api.updatePlanJob(job.id, rec) : api.insertPlanJob(rec)), job ? "Đã sửa" : "Đã thêm")) onClose();
  };
  const coNs = cfgOf(pp, f.doi || DOI_GOC).prod.some((x) => x.hang === String(f.hang || "").trim());
  return (
    <Modal title={(job ? "Sửa " : "Thêm ") + (isTau ? "việc cảng" : "việc bãi")} onClose={onClose} width={720}
      footer={<><button className="btn" onClick={onClose}>Hủy</button><button className="btn pri" onClick={save}>Lưu</button></>}>
      <div className="form-grid">
        <Field label={isTau ? "Tên công việc / tàu *" : "Tên công việc *"} className="wide"><input className="inp" value={f.ten} onChange={set("ten")} /></Field>
        <Field label={isTau ? "Hàng * (chọn hoặc gõ loại mới)" : "Hàng (chọn hoặc gõ)"}>
          <input className="inp" list="dl-hang" value={f.hang || ""} onChange={set("hang")} />
          <datalist id="dl-hang">{hangAll.map((h) => <option key={h} value={h} />)}</datalist>
        </Field>
        <Field label={isTau ? "Vị trí (bến)" : "Vị trí (bến, bãi…)"}><input className="inp" value={f.vi_tri || ""} onChange={set("vi_tri")} /></Field>
        <Field label="Đội xe"><Select value={f.doi} onChange={set("doi")} options={D.doiList} /></Field>
        <Field label={isTau ? "Khối lượng (tấn) *" : "Khối lượng (tấn)"}><input className="inp num" type="number" min="0" value={f.khoi_luong ?? ""} onChange={set("khoi_luong")} /></Field>
        <Field label="Còn lại (tấn, trống nếu chưa biết)"><input className="inp num" type="number" min="0" value={f.con_lai ?? ""} onChange={set("con_lai")} /></Field>
        {!isTau && <Field label="Tiến độ (tự tính)"><div className="inp" style={{ display: "flex", alignItems: "center" }}>{tienDo == null ? <span className="mute">–</span> : <Progress v={tienDo} />}</div></Field>}
        {isTau ? <>
          <Field label="Năng suất tàu (tấn/giờ) *"><input className="inp num" type="number" step="any" value={f.nang_suat ?? ""} onChange={set("nang_suat")} /></Field>
          <Field label="Bắt đầu *"><DateTimeInput value={f.bat_dau} onChange={set("bat_dau")} /></Field>
          <Field label={`Số xe (trống = gợi ý)${coNs ? "" : " · hàng chưa có năng suất"}`}><input className="inp num" type="number" min="0" value={f.so_xe_tay ?? ""} onChange={set("so_xe_tay")} placeholder="gợi ý" /></Field>
        </> : <>
          <Field label="Từ ngày"><DateInput value={f.tu_ngay} onChange={set("tu_ngay")} /></Field>
          <Field label="Đến ngày"><DateInput value={f.den_ngay} min={f.tu_ngay || undefined} onChange={set("den_ngay")} /></Field>
          <Field label="Số xe CA 1 (ngày)"><input className="inp num" type="number" min="0" value={f.xe_ngay ?? 0} onChange={set("xe_ngay")} /></Field>
          <Field label="Số xe CA 2 (đêm)"><input className="inp num" type="number" min="0" value={f.xe_dem ?? 0} onChange={set("xe_dem")} /></Field>
        </>}
      </div>
      {isTau && <div className="small mute" style={{ marginTop: 10 }}>Việc cảng nhập tay (ngoài các tàu tự lấy từ Linetime), tính theo ca như tàu: số xe trống thì gợi ý theo bảng năng suất của đội đã chọn. Cần xe của nhiều đội thì thêm cho từng đội.</div>}
      {!isTau && <div className="small mute" style={{ marginTop: 10 }}>Việc bãi không tự tính ngày kết thúc: số xe áp dụng từ "Từ ngày" đến "Đến ngày". Khối lượng và còn lại chỉ để theo dõi tiến độ.</div>}
    </Modal>
  );
}
