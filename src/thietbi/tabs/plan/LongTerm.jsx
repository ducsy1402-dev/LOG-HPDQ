import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceArea } from "recharts";
import { SlidersHorizontal, BarChart3, GanttChart, Ship, Plus, AlertTriangle, Anchor, Layers, RotateCcw, Trash2, GripVertical, Truck } from "lucide-react";
import { useApp } from "../../store";
import { Card, Kpi, Badge, Modal, Field, Select, Empty, DateInput, DateTimeInput, ConfirmButton, isoToLocal, localToIso, usePalette, MultiSelect } from "../../components/ui";
import { calc12, cfgOf, capTinhOf, withCap, DOI_GOC, coChiaCangBai, doiCuaViec, byThuTu, hangColor, luoiTuDong, HANG_COLOR, BAI_COLOR, fmtDT, fmtD } from "../../lib/plan";
import { pad, vn } from "../../lib/utils";
import { useApp as useLogistics } from "@/store";
import TimelineCa from "./TimelineCa";
import { viecTauTuLinetime, viecBaiTuLinetime, viecBaiTheoTau, DAU_BAI_TAU, laViecCangTay, DAU_VIEC_CANG, DAU_SO_XE_TAU, dongSoXeTau, dongSoXeBai, laDongSoXeBai } from "@/lib/tauDaiHan";
import { doanBen } from "@/lib/linetime";
import { tenBen } from "@/pages/cang/BangTauBen";

const clone = (x) => JSON.parse(JSON.stringify(x));
const LS_DOI = "qltb-dh-doi";

// Kế hoạch dài hạn của một đội: xe dành cho cảng / bãi (theo công thức hoặc nhập tay), tàu từ Linetime + việc bãi nhập tay,
// kết quả từng ca (calc12). Dùng ở trang Dài hạn (tham số đang sửa) và Tổng quan › Năng lực đáp ứng (tham số đã lưu).
export function tinhDaiHan(D, LD, pp, doi) {
  const cfg = cfgOf(pp, doi);
  const goc = doi === DOI_GOC;
  const phanBo = []; // đã bỏ mục Phân bổ cố định (anh Sỹ 15/11/2026): xe bãi = xe sẵn sàng của loại đã chọn
  // ---- Xe dành cho cảng / bãi theo công thức ----
  const tinh = capTinhOf(pp, doi);
  const ssDoi = D.vehicles.filter((v) => v.doi === doi && D.isReady(v.ma));
  const theoLoai = (loai) => (x) => !goc || !loai || loai === "Tất cả" || (x.ma ? loaiXucDao(x) : x.loai) === loai;
  const capCangTinh = tinh.cang?.length ? ssDoi.filter((v) => tinh.cang.includes(v.to_xe)).length : null;
  const capBaiTinh = tinh.bai ? ssDoi.filter(theoLoai(tinh.bai)).length - phanBo.filter(theoLoai(tinh.bai)).reduce((a, r) => a + (+r.so_xe || 0), 0) : null;
  // Đội khác Xúc đào không chia cảng / bãi: một con số xe chung của đội (xe sẵn sàng của đội, hoặc nhập tay; dữ liệu cũ thì cộng cảng + bãi cũ)
  const chung = !coChiaCangBai(doi);
  const capChung = chung ? (tinh.tong === "ss" ? ssDoi.length : (+cfg.capCang || 0) + (+cfg.capBai || 0)) : null;
  const capCang = chung ? capChung : capCangTinh ?? (+cfg.capCang || 0), capBai = chung ? 0 : capBaiTinh ?? (+cfg.capBai || 0);
  // Xe tổ cảng cũng nằm trong phần "còn lại" của bãi = bị tính hai lần
  const trung = tinh.cang?.length && tinh.bai ? ssDoi.filter((v) => tinh.cang.includes(v.to_xe) && theoLoai(tinh.bai)(v)).length : 0;
  // Số xe của từng tàu CHỈ do người lập kế hoạch nhập ở cột "Số xe" của Timeline (dòng plan_jobs "xe_lt:<mã chuyến>"); không lấy từ phiếu chuyến / phương án
  const tauLT = viecTauTuLinetime(LD, doi, { cranes: D.vehicles.filter((x) => x.doi === "Cẩu").map((x) => ({ ...x, loai: x.model, nang_suat_th: x.nang_suat })), tenBen, now: LD?.now })
    .map((j) => { const ov = dongSoXeTau(D.plan.jobs, j.lt, doi); return ov ? { ...j, ...(ov.so_xe_tay != null ? { so_xe_tay: ov.so_xe_tay, nguon_xe: "nhập tay" } : {}), xe_ca: ov.so_xe_doi?.ca || null } : j; }); // ca sửa tay: so_xe_doi = { ca: { <giờ ca ISO>: số xe } }
  const cranesLT = D.vehicles.filter((x) => x.doi === "Cẩu").map((x) => ({ ...x, loai: x.model, nang_suat_th: x.nang_suat }));
  const baiLT = viecBaiTuLinetime(LD, doi, { cranes: cranesLT, now: LD?.now })
    .map((j) => { const ov = dongSoXeBai(D.plan.jobs, j.lt, doi); return ov ? { ...j, ...(ov.so_xe_tay != null ? { xe_ngay: ov.so_xe_tay, xe_dem: ov.so_xe_tay, nguon_xe: "nhập tay" } : {}), xe_ca: ov.so_xe_doi?.ca || null } : j; });
  // Việc tàu nhập tay đời cũ bị bỏ (tàu lấy từ Linetime); việc Cảng nhập tay bằng nút "Thêm việc cảng" thì giữ
  // Việc bãi thêm từ tàu (+bãi) chạy theo tàu: mốc giờ lấy lại từ thanh tàu ở bến, số xe dời theo (viecBaiTheoTau)
  const theoTau = { voyages: LD?.voyages || [], stopsOf: LD?.stopsOf, now: LD?.now ?? Date.now(), tauLT, caMs: (+pp.p?.caLen || 12) * 36e5, doanBen };
  const jobs = [...tauLT, ...baiLT, ...D.plan.jobs.filter((j) => (j.loai !== "tau" || laViecCangTay(j)) && !laDongSoXeBai(j)).map((j) => viecBaiTheoTau(j, theoTau))];
  const R = calc12(withCap(luoiTuDong(pp, LD?.now ?? Date.now()), doi, capCang, capBai), jobs, doi);
  return { cfg, goc, chung, phanBo, tinh, ssDoi, capCang, capBai, trung, R };
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
  const { cfg, goc, chung, tinh, ssDoi, capCang, capBai, trung, R } = useMemo(() => tinhDaiHan(D, LD, pp, doi), [D, LD, pp, doi]);
  const setTinh = (k, v) => setPp((o) => ({ ...o, capTinh: { ...(o.capTinh || {}), [doi]: { ...capTinhOf(o, doi), [k]: v } } }));
  const toCuaDoi = D.toList.filter((t) => D.vehicles.some((v) => v.doi === doi && v.to_xe === t));
  // Tham số TỰ LƯU (anh Sỹ 22/11/2026): quản trị sửa xong, đợi ~1 giây không gõ nữa thì ghi; không còn nút Lưu. Vai trò khác chỉ xem thử (không ghi được).
  const [luuTT, setLuuTT] = useState(""); // "" | "xong" | "loi"
  const ppRef = useRef(pp); ppRef.current = pp;
  useEffect(() => {
    if (!dirty || !isAdmin) return undefined;
    const h = setTimeout(async () => { const ok = await run(() => api.savePlanParams("dai_han", ppRef.current)); setLuuTT(ok ? "xong" : "loi"); }, 900);
    return () => clearTimeout(h);
  }, [pp, dirty, isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps
  const luuBar = isAdmin
    ? (dirty ? <span className={"small " + (luuTT === "loi" ? "bad" : "mute")}>{luuTT === "loi" ? "Chưa lưu được (sửa tiếp để thử lại)" : "Đang tự lưu…"}</span> : luuTT === "xong" ? <span className="small ok">Đã tự lưu</span> : null)
    : dirty && <>
      <span className="small warn">Đang xem thử, không lưu được (chỉ quản trị)</span>
      <button className="btn sm ghost" onClick={() => setPp(clone(saved))}><RotateCcw size={14} />Hoàn tác</button>
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
          Mọi số liệu bên dưới là của đội đang chọn.</span>
        <span className={"small " + (R.kpi.caTHIEU ? "bad" : "ok")} style={{ marginLeft: "auto", fontWeight: 600 }}>Số ca thiếu xe: {R.kpi.caTHIEU} / {pp.p.nShifts} ca</span>
      </div>

      <div className="dh-hang">
      <Card title={`Tham số · ${doi}`} icon={SlidersHorizontal} right={luuBar}>
        <div className="grid g-2">
          <div>
            <div className="sec-t">Thời gian & ca</div>
            <div className="form-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
              <Field label="Lưới ca" className="full"><label className="row" style={{ gap: 6, cursor: "pointer" }}><input type="checkbox" checked={pp.p.bdTuDong !== false} onChange={(e) => setP("bdTuDong", e.target.checked)} /><span>Tự theo hôm nay (lưới bắt đầu từ 00:00 hôm nay)</span></label></Field>
              {pp.p.bdTuDong === false && <Field label="Bắt đầu lưới" className="full"><DateTimeInput value={pp.p.bd} onChange={(v) => setP("bd", v)} /></Field>}
              <Field label="Giờ bắt đầu ca N">{numIn(pp.p.gioN, (v) => setP("gioN", v ?? 8), { min: 0, max: 23, style: { width: "100%" } })}</Field>
              <Field label="Số ca hiển thị">{numIn(pp.p.nShifts, (v) => setP("nShifts", Math.max(2, Math.min(120, v || 60))), { min: 2, max: 120, style: { width: "100%" } })}</Field>
            </div>
            <div className="small mute" style={{ marginTop: 4 }}>N = ca ngày từ {pad(pp.p.gioN)}h, Đ = ca đêm từ {pad((pp.p.gioN + pp.p.caLen) % 24)}h, mỗi ca {pp.p.caLen}h.</div>
          </div>
          <div>
            <div className="sec-t">{chung ? "Xe của đội · hệ số ca" : "Xe dành cho cảng / bãi · hệ số ca"}</div>
            <div className="form-grid" style={{ gridTemplateColumns: "minmax(0, 1fr)", gap: 8 }}>
              {chung ? (
                /* Đội khác Xúc đào: không chia cảng / bãi, một con số xe chung (anh Sỹ 22/11/2026) */
                <Field label="Xe của đội (dùng chung cho cảng và bãi)">
                  <span className="row cap-row">
                    <Select className="inp sm" value={tinh.tong === "ss" ? "ss" : "tay"} onChange={(m) => setTinh("tong", m === "ss" ? "ss" : "tay")} options={[["ss", "Xe sẵn sàng của đội"], ["tay", "Nhập tay"]]} style={{ width: 170 }} aria-label="Cách tính xe của đội" />
                    {tinh.tong === "ss" ? <b className="mono cap-v">= {capCang}</b>
                      : numIn(capCang, (v) => { setCfg("capCang", v ?? 0); setCfg("capBai", 0); })}
                  </span>
                </Field>
              ) : (
                /* Xúc đào: xe cảng và xe bãi cùng một dòng */
                <div className="row" style={{ gap: "8px 24px", flexWrap: "wrap", alignItems: "flex-start" }}>
                  <Field label="Xe dành cho cảng">
                    <span className="row cap-row">
                      <Select className="inp sm" value={tinh.cang?.length ? "to" : "tay"} onChange={(m) => setTinh("cang", m === "to" ? (toCuaDoi.includes("Tổ PVC") ? ["Tổ PVC"] : toCuaDoi.slice(0, 1)) : [])} options={[["to", "Xe sẵn sàng của tổ"], ["tay", "Nhập tay"]]} style={{ width: 150 }} aria-label="Cách tính xe cảng" />
                      {tinh.cang?.length ? <><MultiSelect prefix="Tổ" value={tinh.cang} onChange={(v) => setTinh("cang", v.length ? v : tinh.cang)} options={toCuaDoi} style={{ width: 150 }} /><b className="mono cap-v">= {capCang}</b></>
                        : numIn(cfg.capCang, (v) => setCfg("capCang", v ?? 0))}
                    </span>
                  </Field>
                  <Field label="Xe dành cho bãi">
                    <span className="row cap-row">
                      <Select className="inp sm" value={tinh.bai ? "con_lai" : "tay"} onChange={(m) => setTinh("bai", m === "con_lai" ? (goc ? "Bánh xích" : "Tất cả") : null)} options={[["con_lai", "Xe sẵn sàng còn lại"], ["tay", "Nhập tay"]]} style={{ width: 150 }} aria-label="Cách tính xe bãi" />
                      {tinh.bai ? <>{goc && <Select className="inp sm" value={tinh.bai} onChange={(v) => setTinh("bai", v)} options={[...LOAI_XD, "Tất cả"]} style={{ width: 110 }} aria-label="Loại xe" />}<b className="mono cap-v">= {capBai}</b></>
                        : numIn(cfg.capBai, (v) => setCfg("capBai", v ?? 0))}
                    </span>
                  </Field>
                </div>
              )}
              <Field label="Hệ số ca (chỉ một số đội xe dùng)">
                <span className="row cap-row">
                  <label className="row" style={{ gap: 6, cursor: "pointer" }}><input type="checkbox" checked={cfg.heSo !== false} onChange={(e) => setCfg("heSo", e.target.checked)} /><span>Áp dụng</span></label>
                  {cfg.heSo !== false && <>
                    <span className="small mute">ca đầu</span>{numIn(cfg.ramp1, (v) => setCfg("ramp1", v ?? 1), { step: 0.05, min: 0, max: 1, style: { width: 62 } })}
                    <span className="small mute">ca hai</span>{numIn(cfg.ramp2, (v) => setCfg("ramp2", v ?? 1), { step: 0.05, min: 0, max: 1, style: { width: 62 } })}
                    <span className="small mute">ca cuối</span>{numIn(cfg.ramp3, (v) => setCfg("ramp3", v ?? 1), { step: 0.05, min: 0, max: 1, style: { width: 62 } })}
                  </>}
                </span>
              </Field>
            </div>
            <div className="small mute" style={{ marginTop: 4 }}>{chung ? `Xe của đội = ${capCang} xe` : `Cảng + bãi = ${capCang + capBai} xe`} ({xeSS} sẵn sàng){cfg.heSo === false ? "; không áp dụng hệ số ca (mọi ca 100% số xe)" : ""}.{trung > 0 && <span className="warn"> {trung} xe của {tinh.cang.join(", ")} bị tính cả cảng và bãi.</span>}</div>
          </div>
        </div>
      </Card>

      <Card title="Thừa / thiếu xe theo ca" icon={BarChart3} hint={`Đội ${doi}: xe có − xe cần trong từng ca. Điểm dưới trục (chấm đỏ) là thiếu xe; vùng tô xanh là ca đang diễn ra. Kéo ngang để xem hết.`}>
        <BalanceChart R={R} />
      </Card>
      </div>

      <Card className="mb" title="Timeline theo ca" icon={GanttChart} hint={`Cảng: tàu theo bến như Linetime, nhập số xe ${doi} ngay trên thanh tàu. Bãi: việc bãi theo ca, thêm trực tiếp bằng nút Thêm việc bãi.`}>
        <TimelineCa R={R} doi={doi} onJob={(o) => (o.phieu != null ? lg?.setVoyageMo?.(o.phieu) : setDlg(o))} />
      </Card>
      {dlg && <JobDialog loai={dlg.loai} job={dlg.job} pp={pp} doi={doi} hangAll={hangAll} onClose={() => setDlg(null)} />}
    </>
  );
}

// Loại xúc đào (đã bỏ mục Phân bổ cố định 15/11/2026; còn bảng cơ cấu xúc đào theo loại và thiết bị gắn)
export const LOAI_XD = ["Bánh xích", "Bánh lốp", "Mini"];
// Loại xúc đào suy từ tên model: "mini" -> Mini, "bánh lốp" -> Bánh lốp, còn lại Bánh xích
export const loaiXucDao = (v) => (/mini/i.test(v.model || "") ? "Mini" : /bánh\s*lốp/i.test(v.model || "") ? "Bánh lốp" : "Bánh xích");
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
              <td className="n mono">{x.R.ves.filter((r) => r.dung > 0).length}</td>
              <td className={"n mono " + (x.R.kpi.caTHIEU ? "bad" : "ok")}>{x.R.kpi.caTHIEU}</td>
              <td className={"n mono " + (x.R.kpi.caThieuCang ? "warn" : "")}>{x.R.kpi.caThieuCang || ""}</td>
              <td className={"n mono " + (x.R.kpi.caThieuBai ? "warn" : "")}>{x.R.kpi.caThieuBai || ""}</td>
              <td className={"n mono " + (t < 0 ? "bad" : "")}>{t < 0 ? `${t} xe` : ""}</td>
            </tr>); })}</tbody>
        </table>
      </div>
      <div className="sec-t" style={{ marginTop: 0, flexWrap: "wrap" }}>Thừa / thiếu xe theo ca · đội {chon.doi} <span className="small mute" style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>· có {chon.capCang} xe cảng, {chon.capBai} xe bãi · {pp.p.nShifts} ca từ {fmtDT(R.moc)} · bấm dòng đội ở bảng trên để đổi</span></div>
      <BalanceChart R={R} />
      <div className="small mute" style={{ marginTop: 6 }}>Theo tham số đã lưu ở Kế hoạch & phân bổ › Dài hạn: xe có − xe cần trong từng ca; tàu lấy từ Linetime với số xe do người lập kế hoạch nhập ở Timeline theo ca, việc bãi theo phiếu chuyến hoặc nhập thêm ở Timeline. Cột đỏ là thiếu xe.</div>
    </>
  );
}

// Biểu đồ thừa / thiếu xe theo ca. Trục ngang ghi ngày + ca giống tiêu đề timeline ("14/10" / "N 08h").
function BalanceChart({ R }) {
  const P0 = usePalette();
  const P = { ...P0, info: "#3b82f6" }; // đường Cảng: xanh dương (khác màu tím của đường Chung)
  const { shifts, capCang, capBai, chung } = R;
  const data = shifts.map((s, i) => ({ i, d: fmtD(s.st), ca: `${s.lab} ${pad(s.st.getHours())}h`, lab: s.lab, now: s.now, st: s.st, cang: s.balCang, bai: s.balBai, chung: s.balChung, tt: s.tt, cauCang: s.cang, cauBai: s.bai }));
  // Toàn màn hình: biểu đồ cao hết phần còn lại của khối và rộng bằng khung (xem EChart: sự kiện "tmh-doi" báo bật / tắt)
  const hop = useRef(null);
  const [dim, setDim] = useState({ h: null, w: 0 });
  const bo = () => {
    const el = hop.current; if (!el) return;
    const goc = el.closest("[data-tmh]"), w = el.clientWidth; let h = null;
    if (goc) { const top = el.getBoundingClientRect().top - goc.getBoundingClientRect().top + goc.scrollTop; h = Math.max(200, Math.floor(goc.clientHeight - top - (parseFloat(getComputedStyle(goc).paddingBottom) || 0) - 28)); }
    setDim((o) => (o.h === h && Math.abs(o.w - w) < 2 ? o : { h, w }));
  };
  useLayoutEffect(() => { bo(); });
  useEffect(() => {
    const lai = () => requestAnimationFrame(bo);
    window.addEventListener("tmh-doi", lai); window.addEventListener("resize", lai);
    return () => { window.removeEventListener("tmh-doi", lai); window.removeEventListener("resize", lai); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const fs = dim.h != null;
  const colW = 46, w = Math.max(640, shifts.length * colW + 50, fs ? dim.w : 0);
  const Tick = ({ x, y, payload }) => {
    const s = data[payload.value]; if (!s) return null;
    const c = s.now ? P.accent : s.lab === "N" ? P.ink2 : P.mute;
    return <g transform={`translate(${x},${y})`}><text dy={12} textAnchor="middle" fontSize={10.5} fontWeight={s.lab === "N" ? 700 : 500} fill={c}>{s.d}</text><text dy={25} textAnchor="middle" fontSize={10} fill={c}>{s.ca}</text></g>;
  };
  const Tip = ({ active, payload }) => {
    if (!active || !payload?.length) return null; const s = payload[0].payload;
    const r = (n, v, c, sub) => <div className="r" key={n}><span><i style={{ background: c }} />{n}{sub && <span className="mute"> {sub}</span>}</span><b className={"mono " + (v < 0 ? "bad" : "")}>{v > 0 ? "+" : ""}{v}</b></div>;
    return <div className="tip"><div className="h">{fmtDT(s.st)} · {s.lab === "N" ? "CA 1 (ngày)" : "CA 2 (đêm)"}{s.now ? " · đang diễn ra" : ""}</div>
      {chung ? r("Chung", s.chung, P.accent, `(có ${capCang}, cần ${s.cauCang + s.cauBai})`) : <>{r("Cảng", s.cang, P.info, `(có ${capCang}, cần ${s.cauCang})`)}{r("Bãi", s.bai, P.warn, `(có ${capBai}, cần ${s.cauBai})`)}{r("Chung", s.chung, P.accent)}</>}
      <div className="r" style={{ marginTop: 4 }}><span>Tình trạng</span><b className={s.tt === "OK" ? "ok" : s.tt === "THIẾU" ? "bad" : "warn"}>{s.tt}</b></div></div>;
  };
  const nowI = data.findIndex((s) => s.now);
  // Trục tung chia vạch cách nhau 5 xe (anh Sỹ 22/11/2026): làm tròn biên ra bội số của 5, luôn có vạch 0
  const giaTri = data.flatMap((s) => (chung ? [s.chung] : [s.cang, s.bai, s.chung])).filter((x) => Number.isFinite(x));
  const yMin = Math.min(0, Math.floor(Math.min(0, ...giaTri) / 5) * 5), yMax = Math.max(5, Math.ceil(Math.max(0, ...giaTri) / 5) * 5);
  const yTicks = Array.from({ length: (yMax - yMin) / 5 + 1 }, (_, k) => yMin + k * 5);
  return (
    <>
      <div className="legend mb">
        {!chung && <><span><i style={{ background: P.info }} />Cảng (có − cần)</span><span><i style={{ background: P.warn }} />Bãi (có − cần)</span></>}
        <span><i style={{ background: P.bad }} />Chấm đỏ: thiếu xe</span><span><i style={{ background: P.accent, height: 2 }} />{chung ? "Xe của đội (có − cần)" : "Chung (cảng + bãi)"}</span>
      </div>
      <div ref={hop} style={{ overflowX: "auto" }}>
        <ComposedChart width={w} height={fs ? Math.max(260, dim.h) : Math.min(440, Math.max(260, yTicks.length * 15 + 70))} data={data} margin={{ top: 10, right: 10, bottom: 22, left: 0 }}>
          <CartesianGrid stroke={P.line} vertical={false} />
          {nowI >= 0 && <ReferenceArea x1={nowI} x2={nowI} fill={P.accent} fillOpacity={0.12} stroke={P.accent} strokeOpacity={0.6} />}
          <XAxis dataKey="i" tick={<Tick />} interval={0} axisLine={false} tickLine={false} height={34} />
          <YAxis tick={{ fill: P.mute, fontSize: 11 }} axisLine={false} tickLine={false} width={34} allowDecimals={false} domain={[yMin, yMax]} ticks={yTicks} interval={0} />
          <ReferenceLine y={0} stroke={P.mute} />
          <Tooltip cursor={{ stroke: P.mute, strokeOpacity: 0.5 }} content={<Tip />} />
          {/* Đường cảng, bãi, chung; điểm nào thiếu xe (dưới 0) vẽ chấm đỏ */}
          {(chung ? [["chung", P.accent, 2.25]] : [["cang", P.info, 1.75], ["bai", P.warn, 1.75], ["chung", P.accent, 2.25]]).map(([k, c, sw]) => (
            <Line key={k} dataKey={k} type="monotone" stroke={c} strokeWidth={sw} isAnimationActive={false}
              dot={({ cx, cy, payload, index }) => (payload[k] < 0 ? <circle key={`${k}${index}`} cx={cx} cy={cy} r={3.5} fill={P.bad} stroke="none" /> : <g key={`${k}${index}`} />)}
              activeDot={{ r: 4 }} />
          ))}
        </ComposedChart>
      </div>
    </>
  );
}

function JobDialog({ loai, job, pp, doi, hangAll, onClose }) {
  const { D, api, run, toast, isAdmin } = useApp();
  const isTau = loai === "tau";
  const [f, setF] = useState(() => job ? { ...job, bat_dau: isoToLocal(job.bat_dau), doi: doiCuaViec(job), so_xe_tay: job.so_xe_tay ?? job.so_xe_doi?.[doiCuaViec(job)] ?? "",
    soXe: Math.max(+job.xe_ngay || 0, +job.xe_dem || 0), // việc bãi: một ô Số xe chung cho cả ngày lẫn đêm
    // Việc bãi: mốc giờ chính xác (cột tu / den, SQL 15); việc cũ chỉ có ngày thì từ 00:00 ngày đầu đến 23:59 ngày cuối
    tuG: job.tu ? isoToLocal(job.tu) : job.tu_ngay ? job.tu_ngay + "T00:00" : "", denG: job.den ? isoToLocal(job.den) : job.den_ngay ? job.den_ngay + "T23:59" : "" } : isTau
    ? { ten: "", hang: cfgOf(pp, doi).prod[0]?.hang || "", vi_tri: "", khoi_luong: "", con_lai: "", nang_suat: "", bat_dau: "", so_xe_tay: "", doi }
    : { ten: "", hang: "", vi_tri: "", tuG: "", denG: "", soXe: "", doi, khoi_luong: "" });
  const set = (k) => (v) => setF((o) => ({ ...o, [k]: v?.target ? v.target.value : v }));
  const n = (v) => (v === "" || v == null ? null : Number(v));
  const save = async () => {
    let rec;
    const kl0 = n(f.khoi_luong), cl0 = isTau ? n(f.con_lai) : null; // việc bãi không còn ô "Còn lại" / "Tiến độ"
    if (cl0 != null && kl0 != null && cl0 > kl0) return toast("Khối lượng còn lại không được lớn hơn khối lượng", "bad");
    if (isTau) {
      rec = { loai, ten: f.ten.trim(), hang: String(f.hang ?? "").trim(), vi_tri: String(f.vi_tri ?? "").trim(), khoi_luong: kl0, con_lai: cl0, nang_suat: n(f.nang_suat), bat_dau: localToIso(f.bat_dau), so_xe_tay: n(f.so_xe_tay), so_xe_doi: null, doi: f.doi || DOI_GOC, ghi_chu: DAU_VIEC_CANG };
      if (!rec.ten || !rec.hang || !rec.khoi_luong || !rec.nang_suat || !rec.bat_dau) return toast("Cần nhập tên công việc, hàng, khối lượng, năng suất và giờ bắt đầu", "bad");
      if (rec.so_xe_tay == null) return toast("Cần nhập số xe", "bad");
    } else {
      rec = { loai, ten: f.ten.trim(), hang: String(f.hang ?? "").trim(), vi_tri: String(f.vi_tri ?? "").trim(), tu_ngay: f.tuG ? f.tuG.slice(0, 10) : null, den_ngay: f.denG ? f.denG.slice(0, 10) : null, tu: localToIso(f.tuG) || null, den: localToIso(f.denG) || null, xe_ngay: n(f.soXe) || 0, xe_dem: n(f.soXe) || 0, doi: f.doi || DOI_GOC, khoi_luong: kl0, con_lai: cl0 };
      if (!rec.ten) return toast("Cần nhập tên công việc", "bad");
      if (rec.tu && rec.den && rec.den <= rec.tu) return toast("Giờ kết thúc phải sau giờ bắt đầu", "bad");
      // Việc bãi đang chạy theo tàu: sửa mốc giờ bằng tay thì cắt liên kết (không chạy theo tàu nữa); không sửa giờ thì giữ liên kết
      if (job?.theoTau && (f.tuG !== isoToLocal(job.tu) || f.denG !== isoToLocal(job.den))) rec.ghi_chu = null;
      else if (job?.theoTau) rec.ghi_chu = DAU_BAI_TAU + job.theoTau; // việc nhận theo tên (chưa có dấu) thì ghi dấu luôn
    }
    // Chưa chạy SQL 15 (chưa có cột tu / den): ghi lại không có mốc giờ, chỉ theo ngày như cũ
    const ghi = async () => {
      try { await (job ? api.updatePlanJob(job.id, rec) : api.insertPlanJob(rec)); }
      catch (e) {
        if (isTau || !/\b(tu|den)\b|schema cache|column/i.test(String(e?.message || e))) throw e;
        const { tu: _tu, den: _den, ...gon } = rec;
        await (job ? api.updatePlanJob(job.id, gon) : api.insertPlanJob(gon));
        toast("CSDL chưa có cột giờ của việc bãi (SQL 15): đã lưu theo ngày", "warn");
      }
    };
    if (await run(ghi, job ? "Đã sửa" : "Đã thêm")) onClose();
  };
  const coNs = cfgOf(pp, f.doi || DOI_GOC).prod.some((x) => x.hang === String(f.hang || "").trim());
  return (
    <Modal title={(job ? "Sửa " : "Thêm ") + (isTau ? "việc cảng" : "việc bãi")} onClose={onClose} width={720}
      footer={<>{job && isAdmin && <span style={{ marginRight: "auto" }}><ConfirmButton onConfirm={async () => { if (await run(() => api.deletePlanJob(job.id), `Đã xóa ${job.ten}`)) onClose(); }} title={`Xóa ${job.ten}`} /></span>}<button className="btn" onClick={onClose}>Hủy</button><button className="btn pri" onClick={save}>Lưu</button></>}>
      <div className="form-grid">
        <Field label={isTau ? "Tên công việc / tàu *" : "Tên công việc *"} className="wide"><input className="inp" value={f.ten} onChange={set("ten")} /></Field>
        <Field label={isTau ? "Hàng * (chọn hoặc gõ loại mới)" : "Hàng (chọn hoặc gõ)"}>
          <input className="inp" list="dl-hang" value={f.hang || ""} onChange={set("hang")} />
          <datalist id="dl-hang">{hangAll.map((h) => <option key={h} value={h} />)}</datalist>
        </Field>
        <Field label={isTau ? "Vị trí (bến)" : "Vị trí (bến, bãi…)"}><input className="inp" value={f.vi_tri || ""} onChange={set("vi_tri")} /></Field>
        <Field label="Đội xe"><Select value={f.doi} onChange={set("doi")} options={D.doiList} /></Field>
        <Field label={isTau ? "Khối lượng (tấn) *" : "Khối lượng (tấn)"}><input className="inp num" type="number" min="0" value={f.khoi_luong ?? ""} onChange={set("khoi_luong")} /></Field>
        {isTau && <Field label="Còn lại (tấn, trống nếu chưa biết)"><input className="inp num" type="number" min="0" value={f.con_lai ?? ""} onChange={set("con_lai")} /></Field>}
        {isTau ? <>
          <Field label="Năng suất tàu (tấn/giờ) *"><input className="inp num" type="number" step="any" value={f.nang_suat ?? ""} onChange={set("nang_suat")} /></Field>
          <Field label="Bắt đầu *"><DateTimeInput value={f.bat_dau} onChange={set("bat_dau")} /></Field>
          <Field label="Số xe *"><input className="inp num" type="number" min="0" value={f.so_xe_tay ?? ""} onChange={set("so_xe_tay")} /></Field>
        </> : <>
          <Field label="Từ giờ"><DateTimeInput value={f.tuG} onChange={set("tuG")} /></Field>
          <Field label="Đến giờ"><DateTimeInput value={f.denG} onChange={set("denG")} /></Field>
          <Field label="Số xe"><input className="inp num" type="number" min="0" value={f.soXe ?? ""} onChange={set("soXe")} /></Field>
        </>}
      </div>
      {isTau && <div className="small mute" style={{ marginTop: 10 }}>Việc cảng nhập tay (ngoài các tàu tự lấy từ Linetime), tính theo ca như tàu với số xe đã nhập. Cần xe của nhiều đội thì thêm cho từng đội.</div>}
      {!isTau && <div className="small mute" style={{ marginTop: 10 }}>Việc bãi không tự tính giờ kết thúc: số xe áp dụng cho mọi ca (ngày và đêm) có giờ nằm từ "Từ giờ" đến "Đến giờ".</div>}
    </Modal>
  );
}
