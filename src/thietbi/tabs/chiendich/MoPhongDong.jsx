import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, SkipBack, Clock, History, Radio } from "lucide-react";
import { fmt } from "../../lib/utils";
import { ngayGio, gio, tan, thoiLuong } from "./chung";

// Mô phỏng chuyển động một tuyến: xe đứng ở điểm xếp, chạy có hàng tới điểm dỡ, dỡ, chạy về.
// Vị trí từng xe tại thời điểm t lấy đúng lịch đã mô phỏng (mp.chuyen[].doan), nên khớp biểu đồ chạy xe.
// Có chạy / dừng, tốc độ (1× = giờ thực … 20 phút / giây), kéo thanh thời gian, nút "Theo giờ thực" (bám đồng hồ).

const MAU_XE = ["#6366f1", "#f59e0b", "#14b8a6", "#ec4899", "#0ea5e9", "#22c55e", "#a78bfa", "#f97316", "#ef4444", "#84cc16", "#06b6d4", "#eab308"];
const TOC_DO = [[1, "1× (giờ thực)"], [10, "10×"], [60, "1 phút / giây"], [300, "5 phút / giây"], [1200, "20 phút / giây"]];
const TEN_TT = { doi: "Chờ xuất phát", cho_xep: "Chờ xếp", xep: "Đang xếp", phu: "Cân / thủ tục", di: "Chạy có hàng", cho_do: "Chờ dỡ", do: "Đang dỡ", ve: "Chạy về", nghi: "Nghỉ", xong: "Xong việc", dung: "Dừng (nghỉ / ngoài ca)" };

const THU = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const p2 = (n) => String(n).padStart(2, "0");
const gioGiay = (ms) => { const d = new Date(ms); return `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`; };
// "còn 4:05" / "2:10 trước"
const demNguoc = (ms) => { const s0 = Math.round(Math.abs(ms) / 1000), m = Math.floor(s0 / 60), txt = `${m}:${p2(s0 % 60)}`; return ms >= 0 ? `còn ${txt}` : `${txt} trước`; };
const MO_TA = {
  xep: (e) => `vào xếp ở điểm xếp ${e.c.diemXep + 1}`,
  di: () => "chạy có hàng tới điểm dỡ",
  cho_do: () => "tới điểm dỡ, phải chờ",
  do: (e) => `dỡ ở điểm dỡ ${e.c.diemDo + 1}`,
  ve: () => "chạy về điểm xếp",
  cho_xep: () => "về tới bãi xếp, chờ điểm xếp trống",
  nghi: () => "nghỉ luân phiên",
};
const SuKien = ({ e, tg }) => (
  <div><b className="mono">{gio(e.bd)}</b><span className="mute small">{demNguoc(e.bd - tg)}</span><span><i style={{ background: MAU_XE[e.xe % MAU_XE.length] }} />Xe {e.xe + 1} {MO_TA[e.k]?.(e) || e.k}</span></div>
);

// Khung vẽ (đơn vị của viewBox)
const W = 1000, HH = 360;
const XEP = { x0: 16, x1: 206, y0: 40, y1: 256 };   // khu điểm xếp
const DO = { x0: 794, x1: 984, y0: 40, y1: 256 };   // khu điểm dỡ
const NGHI = { x0: 16, x1: 206, y0: 268, y1: 344 }; // khu chờ / nghỉ
const DUONG = { x0: 226, x1: 774, yDi: 112, yVe: 186 };

// Gộp các đoạn liền nhau cùng loại của một chuyến thành một "việc" (đoạn bị cắt bởi giờ nghỉ vẫn là một việc)
function viecTheoXe(mp, A) {
  const out = Array.from({ length: A }, () => []);
  for (const c of mp.chuyen) {
    const ds = out[c.xe];
    let truoc = null;
    for (const [k, a, b] of c.doan) {
      const kk = k === "cho" ? (truoc && ["di", "phu", "xep"].includes(truoc.k) ? "cho_do" : "cho_xep") : k;
      if (truoc && truoc.k === kk && truoc.c === c) { truoc.manh.push([a, b]); truoc.kt = b; }
      else { truoc = { k: kk, c, bd: a, kt: b, manh: [[a, b]] }; ds.push(truoc); }
    }
  }
  for (const ds of out) for (const v of ds) v.tong = v.manh.reduce((s, [a, b]) => s + (b - a), 0);
  return out;
}
const daLam = (v, t) => v.manh.reduce((s, [a, b]) => s + Math.max(0, Math.min(t, b) - a), 0);

// Trạng thái xe tại t
function trangThai(ds, t) {
  if (!ds.length || t < ds[0].bd) return { tt: "doi", bd: -Infinity };
  let lo = 0, hi = ds.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (ds[m].bd <= t) lo = m; else hi = m - 1; }
  const v = ds[lo];
  if (t < v.kt) {
    const f = v.tong ? daLam(v, t) / v.tong : 1;
    const dangDung = !v.manh.some(([a, b]) => a <= t && t < b);
    return { tt: v.k, f, c: v.c, bd: v.bd, dung: dangDung && !v.k.startsWith("cho") };
  }
  // giữa hai việc: vừa chạy về / nghỉ xong thì đứng chờ ở bãi xếp; hết chuyến thì xong
  if (lo === ds.length - 1) return { tt: "xong", bd: v.kt };
  if (["ve", "nghi"].includes(v.k)) return { tt: "cho_xep", bd: v.kt, c: ds[lo + 1].c };
  return { tt: v.k, f: 1, c: v.c, bd: v.bd, dung: true };
}

export default function MoPhongDong({ x, cd, thucTe = [] }) {
  const { mp, pa, t } = x;
  const viec = useMemo(() => viecTheoXe(mp, pa.A), [mp, pa.A]);
  const tMin = mp.t0 - 5 * 60000, tMax = mp.ketThuc + 30 * 60000;
  // Mặc định TRỰC TIẾP: bám đồng hồ, xe ở đâu ngay lúc này theo kế hoạch. "Xem lại / tua" là chế độ phụ.
  const [che, setChe] = useState("truc_tiep");
  const [tg, setTg] = useState(() => Date.now());
  const [chay, setChay] = useState(false);
  const [toc, setToc] = useState(60);
  const ref = useRef({ tg, toc });
  ref.current.toc = toc;

  useEffect(() => {
    if (che !== "truc_tiep") return;
    const cap = () => { ref.current.tg = Date.now(); setTg(ref.current.tg); };
    cap();
    const id = setInterval(cap, 200); // 5 lần / giây: xe nhích đều theo giờ thật
    return () => clearInterval(id);
  }, [che]);
  useEffect(() => {
    if (che !== "xem_lai" || !chay) return;
    let id, cuoi = performance.now(), ve = 0;
    const buoc = (now) => {
      const dt = now - cuoi; cuoi = now;
      let moi = ref.current.tg + dt * ref.current.toc;
      if (moi >= tMax) { moi = tMax; setChay(false); }
      ref.current.tg = moi;
      if (now - ve > 33) { ve = now; setTg(moi); }
      id = requestAnimationFrame(buoc);
    };
    id = requestAnimationFrame(buoc);
    return () => cancelAnimationFrame(id);
  }, [che, chay, tMax]);
  const datTg = (v) => { ref.current.tg = v; setTg(v); };
  const xemLai = () => { setChe("xem_lai"); setChay(false); datTg(Math.min(tMax, Math.max(tMin, Date.now()))); };
  const veTrucTiep = () => { setChay(false); setChe("truc_tiep"); };
  const trucTiep = che === "truc_tiep";

  const L = mp.lich;
  const w = L.caCua(tg);
  const nghiChung = w ? L.khoangNghi(w, -1).find(([a, b]) => a <= tg && tg < b) : null;
  const tenNghi = nghiChung ? (cd.cau_hinh.nghi || []).filter((b) => b.kieu !== "luan").find((b) => Math.abs(w.s + (+b.sau || 0) * 3600e3 - nghiChung[0]) < 1000)?.ten || "Nghỉ" : null;
  const trangCa = !w ? "Ngoài ca" : tenNghi ? `CA ${w.so} · ${tenNghi} (cả tuyến dừng)` : `CA ${w.so} · đang làm`;

  // Khối lượng đã dỡ xong tới t
  const daGiao = useMemo(() => { let v = 0; for (const [g, c] of mp.tich) { if (g > tg) break; v = c; } return v; }, [mp.tich, tg]);

  // Vị trí từng xe
  const xe = viec.map((ds, i) => ({ i, ...trangThai(ds, tg) }));
  const dem = {};
  for (const v of xe) dem[v.tt] = (dem[v.tt] || 0) + 1;
  const hang = (tt) => xe.filter((v) => v.tt === tt).sort((a, b) => a.bd - b.bd || a.i - b.i);
  const viTri = {};
  const caoXep = (XEP.y1 - XEP.y0 - 24) / Math.max(1, pa.Cx), caoDo = (DO.y1 - DO.y0 - 24) / Math.max(1, pa.Cd);
  const yXep = (j) => XEP.y0 + 24 + caoXep * (j + 0.5), yDo = (j) => DO.y0 + 24 + caoDo * (j + 0.5);
  for (const v of xe) {
    const d = DUONG;
    if (v.tt === "xep") viTri[v.i] = [118, yXep(v.c.diemXep), 1, v.f];
    else if (v.tt === "phu") viTri[v.i] = [d.x0 + 18, d.yDi, 1, 1];
    else if (v.tt === "di") viTri[v.i] = [d.x0 + 40 + (d.x1 - d.x0 - 60) * v.f, d.yDi, 1, 1];
    else if (v.tt === "do") viTri[v.i] = [DO.x0 + 78, yDo(v.c.diemDo), 1, 1 - v.f];
    else if (v.tt === "ve") viTri[v.i] = [d.x1 - 20 - (d.x1 - d.x0 - 40) * v.f, d.yVe, -1, 0];
  }
  hang("cho_xep").forEach((v, k) => { viTri[v.i] = [XEP.x1 - 22 - (k % 2) * 34, XEP.y1 - 16 - Math.floor(k / 2) * 22, 1, 0]; });
  hang("cho_do").forEach((v, k) => { viTri[v.i] = [DO.x0 + 22 + (k % 2) * 34, DO.y1 - 16 - Math.floor(k / 2) * 22, 1, 1]; });
  [...hang("nghi"), ...hang("doi"), ...hang("xong")].forEach((v, k) => { viTri[v.i] = [NGHI.x0 + 26 + (k % 5) * 36, NGHI.y0 + 30 + Math.floor(k / 5) * 22, 1, 0]; });

  const ptXep = new Set(xe.filter((v) => v.tt === "xep").map((v) => v.c.diemXep));
  const ptDo = new Set(xe.filter((v) => v.tt === "do").map((v) => v.c.diemDo));
  const nghiTatCa = !w || !!tenNghi;

  // Việc sắp tới / vừa diễn ra (mốc bắt đầu các việc của mọi xe)
  const moc = useMemo(() => viec.flatMap((ds, i) => ds.filter((v) => v.k !== "phu").map((v) => ({ xe: i, k: v.k, bd: v.bd, c: v.c }))).sort((a2, b2) => a2.bd - b2.bd), [viec]);
  const sapToi = moc.filter((e) => e.bd > tg && e.bd <= tg + 30 * 60000).slice(0, 8);
  const vuaXong = moc.filter((e) => e.bd <= tg && e.bd > tg - 30 * 60000).slice(-5).reverse();
  // Thực tế đã nhập của tuyến so với kế hoạch tới hết ca cuối đã nhập
  const soTT = useMemo(() => {
    const ds = thucTe.filter((r) => r.tuyen_id === t.id && r.khoi_luong != null);
    if (!ds.length) return null;
    const cuoi = ds.reduce((m, r) => (`${r.ngay}|${r.ca}` > `${m.ngay}|${m.ca}` ? r : m));
    const khoa = `${cuoi.ngay}|${cuoi.ca}`;
    let kh = 0;
    for (const c of mp.caKH) { kh += c.kl; if (c.key === khoa) break; }
    return { tt: ds.reduce((a2, r) => a2 + +r.khoi_luong, 0), kh, ca: cuoi.ca, ngay: `${cuoi.ngay.slice(8, 10)}/${cuoi.ngay.slice(5, 7)}` };
  }, [thucTe, t.id, mp.caKH]);

  return (
    <div className="cd-mp">
      <div className="cd-mp-dau">
        {trucTiep ? <span className="cd-live"><i />TRỰC TIẾP</span> : <span className="badge b-warn">ĐANG XEM LẠI</span>}
        <span className="cd-mp-dongho">{gioGiay(tg)}</span>
        <span className="small mute">{THU[new Date(tg).getDay()]} {ngayGio(tg).slice(0, 5)}</span>
        <span className={"cd-mp-ca " + (nghiTatCa ? "warn" : "ok")}>{trangCa}{w && !tenNghi ? ` · còn ${thoiLuong((w.e - tg) / 3600e3)} hết ca` : ""}</span>
        <span style={{ flex: 1 }} />
        {trucTiep
          ? <button type="button" className="btn sm" onClick={xemLai} title="Tua nhanh / xem lại các ca khác"><History size={14} /> Xem lại / tua</button>
          : <button type="button" className="btn sm pri" onClick={veTrucTiep}><Radio size={14} /> Về trực tiếp</button>}
      </div>
      {trucTiep && tg < mp.t0 && <div className="alert info" style={{ marginBottom: 8 }}><Clock size={15} /><span>Tuyến chưa bắt đầu: xe đầu tiên vào xếp lúc <b>{ngayGio(mp.t0)}</b> (còn {thoiLuong((mp.t0 - tg) / 3600e3)}). Xe đang đứng ở khu chờ.</span></div>}
      {trucTiep && tg > mp.ketThuc && <div className="alert ok" style={{ marginBottom: 8 }}><Clock size={15} /><span>Theo kế hoạch tuyến đã xong lúc <b>{ngayGio(mp.ketThuc)}</b>. Bấm "Xem lại / tua" để xem lại quá trình chạy.</span></div>}
      {!trucTiep && <>
        <div className="row" style={{ marginBottom: 6 }}>
          <button type="button" className="btn sm" onClick={() => { if (tg >= tMax) datTg(mp.t0); setChay(!chay); }}>{chay ? <><Pause size={14} /> Dừng</> : <><Play size={14} /> Chạy</>}</button>
          <button type="button" className="btn sm" onClick={() => { setChay(false); datTg(mp.t0); }} title="Về lúc bắt đầu"><SkipBack size={14} /></button>
          <select className="inp sm" style={{ width: "auto" }} value={toc} onChange={(e) => setToc(+e.target.value)} title="Tốc độ tua">{TOC_DO.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </div>
        <input type="range" className="cd-mp-truot" min={tMin} max={tMax} step={1000} value={Math.min(tMax, Math.max(tMin, tg))} onChange={(e) => { setChay(false); datTg(+e.target.value); }} />
        <div className="small mute" style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span>{ngayGio(mp.t0)}</span><span>{ngayGio(mp.ketThuc)}</span></div>
      </>}

      <svg viewBox={`0 0 ${W} ${HH}`} className="cd-mp-svg" role="img" aria-label="Mô phỏng chuyển động xe">
        <defs>
          <marker id="cdmp-mt" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="currentColor" /></marker>
        </defs>
        {/* Khu điểm xếp */}
        <rect x={XEP.x0} y={XEP.y0} width={XEP.x1 - XEP.x0} height={XEP.y1 - XEP.y0} rx="10" className="cd-mp-khu" />
        <text x={XEP.x0 + 10} y={XEP.y0 + 16} className="cd-mp-nhan">ĐIỂM XẾP · {t.diem_xep || t.loai_xep}</text>
        {Array.from({ length: pa.Cx }, (_, j) => (
          <g key={j}>
            <rect x={XEP.x0 + 8} y={yXep(j) - caoXep / 2 + 3} width="140" height={Math.max(18, caoXep - 6)} rx="6" className={"cd-mp-o" + (ptXep.has(j) ? " on" : "")} />
            <ThietBi x={XEP.x0 + 30} y={yXep(j)} loai={t.loai_xep} chay={ptXep.has(j) && !nghiTatCa} />
            <text x={XEP.x0 + 14} y={yXep(j) - caoXep / 2 + 14} className="cd-mp-so">{j + 1}</text>
          </g>
        ))}
        {/* Khu chờ / nghỉ */}
        <rect x={NGHI.x0} y={NGHI.y0} width={NGHI.x1 - NGHI.x0} height={NGHI.y1 - NGHI.y0} rx="10" className="cd-mp-khu nghi" />
        <text x={NGHI.x0 + 10} y={NGHI.y0 + 14} className="cd-mp-nhan">KHU CHỜ / NGHỈ</text>
        {/* Đường */}
        <rect x={DUONG.x0} y={DUONG.yDi - 26} width={DUONG.x1 - DUONG.x0} height={DUONG.yVe - DUONG.yDi + 52} rx="12" className="cd-mp-duong" />
        <line x1={DUONG.x0 + 10} x2={DUONG.x1 - 10} y1={(DUONG.yDi + DUONG.yVe) / 2} y2={(DUONG.yDi + DUONG.yVe) / 2} className="cd-mp-vach" />
        <line x1={DUONG.x0 + 60} x2={DUONG.x1 - 30} y1={DUONG.yDi - 18} y2={DUONG.yDi - 18} className="cd-mp-mui" markerEnd="url(#cdmp-mt)" />
        <line x1={DUONG.x1 - 30} x2={DUONG.x0 + 30} y1={DUONG.yVe + 18} y2={DUONG.yVe + 18} className="cd-mp-mui" markerEnd="url(#cdmp-mt)" />
        <text x={(DUONG.x0 + DUONG.x1) / 2} y={DUONG.yDi - 34} textAnchor="middle" className="cd-mp-nhan">CÓ TẢI → {fmt(+t.quang_duong || 0, 2)} km · {fmt(t.toc_do_co_hang, 0)} km/h</text>
        <text x={(DUONG.x0 + DUONG.x1) / 2} y={DUONG.yVe + 44} textAnchor="middle" className="cd-mp-nhan">← KHÔNG TẢI · {fmt(t.toc_do_khong_tai, 0)} km/h</text>
        {(+t.tg_phu || 0) > 0 && <><rect x={DUONG.x0 + 4} y={DUONG.yDi - 14} width="30" height="28" rx="4" className="cd-mp-can" /><text x={DUONG.x0 + 19} y={DUONG.yDi + 26} textAnchor="middle" className="cd-mp-so">cân</text></>}
        {/* Khu điểm dỡ */}
        <rect x={DO.x0} y={DO.y0} width={DO.x1 - DO.x0} height={DO.y1 - DO.y0} rx="10" className="cd-mp-khu" />
        <text x={DO.x0 + 10} y={DO.y0 + 16} className="cd-mp-nhan">ĐIỂM DỠ · {t.diem_do || ""}</text>
        {Array.from({ length: pa.Cd }, (_, j) => (
          <g key={j}>
            <rect x={DO.x0 + 44} y={yDo(j) - caoDo / 2 + 3} width="138" height={Math.max(18, caoDo - 6)} rx="6" className={"cd-mp-o" + (ptDo.has(j) ? " on" : "")} />
            <text x={DO.x0 + 50} y={yDo(j) - caoDo / 2 + 14} className="cd-mp-so">{j + 1}</text>
            <path d={`M${DO.x0 + 128},${yDo(j) + 8} q14,-22 30,0 z`} className="cd-mp-dong" />
          </g>
        ))}
        {pa.soXeVun ? Array.from({ length: pa.soXeVun }, (_, j) => (
          <ThietBi key={j} x={DO.x1 - 22} y={yDo(j % pa.Cd) - 4 + Math.floor(j / pa.Cd) * 14} loai={t.loai_vun} nho chay={!nghiTatCa} />
        )) : null}
        {/* Xe */}
        {xe.map((v) => {
          const p = viTri[v.i];
          if (!p) return null;
          return <Xe key={v.i} x={p[0]} y={p[1]} huong={p[2]} tai={p[3]} so={v.i + 1} mau={MAU_XE[v.i % MAU_XE.length]} mo={v.tt === "xong" || v.tt === "doi"} dung={v.dung} tieuDe={`Xe ${v.i + 1}: ${TEN_TT[v.dung ? "dung" : v.tt]}${v.c ? ` · chuyến ${v.c.so}` : ""}`} />;
        })}
      </svg>

      <div className="cd-mp-tk">
        <div><span>Đã dỡ xong</span><b>{tan(daGiao)} t</b><small>{fmt((daGiao / (+t.khoi_luong || 1)) * 100, 1)}% · còn {tan((+t.khoi_luong || 0) - daGiao)} t</small></div>
        {["cho_xep", "xep", "di", "cho_do", "do", "ve", "nghi"].map((k) => (
          <div key={k}><span>{TEN_TT[k]}</span><b>{dem[k] || 0}</b><small>xe</small></div>
        ))}
      </div>
      <div className="grid g-2" style={{ marginTop: 10 }}>
        <div className="cd-mp-sk">
          <h4>Sắp tới (30 phút)</h4>
          {sapToi.length ? sapToi.map((e, k) => <SuKien key={k} e={e} tg={tg} />) : <div className="mute small">Không có việc nào trong 30 phút tới.</div>}
        </div>
        <div className="cd-mp-sk">
          <h4>Vừa diễn ra</h4>
          {vuaXong.length ? vuaXong.map((e, k) => <SuKien key={k} e={e} tg={tg} />) : <div className="mute small">Chưa có.</div>}
          {soTT && <div className="cd-mp-tt">
            <span>Thực tế đã nhập: <b>{tan(soTT.tt)} t</b> tới hết CA {soTT.ca} {soTT.ngay}</span>
            <span>Kế hoạch tới hết ca đó: <b>{tan(soTT.kh)} t</b> · <b className={soTT.tt >= soTT.kh ? "ok" : "bad"}>{soTT.tt >= soTT.kh ? "+" : ""}{tan(soTT.tt - soTT.kh)} t</b></span>
          </div>}
        </div>
      </div>
      <div className="small mute" style={{ marginTop: 6 }}>Chưa có định vị xe nên vị trí là <b>theo kế hoạch</b>: lấy đúng lịch mô phỏng từng chuyến (giãn cách, chờ, giờ nghỉ), khớp biểu đồ chạy xe. Thùng xe tô màu = có hàng. Rê chuột lên xe để xem trạng thái. Khi có GPS có thể vẽ thêm vị trí xe thật lên sơ đồ này.</div>
    </div>
  );
}

// Xe ben nhìn ngang: huong 1 = sang phải, -1 = sang trái; tai 0..1 = lượng hàng trên thùng
function Xe({ x, y, huong, tai, so, mau, mo, dung, tieuDe }) {
  return (
    <g transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`} opacity={mo ? 0.45 : 1}>
      <title>{tieuDe}</title>
      <g transform={`scale(${huong},1)`}>
        <rect x="-15" y="-8" width="20" height="11" rx="2" fill="none" stroke={mau} strokeWidth="1.6" />
        {tai > 0.02 && <rect x="-14" y={3 - 10 * Math.min(1, tai)} width="18" height={10 * Math.min(1, tai)} fill="#b45309" opacity="0.9" />}
        <rect x="6" y="-6" width="9" height="9" rx="2" fill={mau} />
        <circle cx="-10" cy="5.5" r="2.6" className="cd-mp-banh" /><circle cx="0" cy="5.5" r="2.6" className="cd-mp-banh" /><circle cx="11" cy="5.5" r="2.6" className="cd-mp-banh" />
      </g>
      <text y="-11" textAnchor="middle" className="cd-mp-xe">{so}</text>
      {dung && <circle cx="14" cy="-11" r="3" fill="var(--warn)" />}
    </g>
  );
}

// Biểu tượng thiết bị xếp / vun: xe xúc, băng tải, cẩu
function ThietBi({ x, y, loai, chay, nho }) {
  const s = nho ? 0.7 : 1;
  const l = String(loai || "").toLowerCase();
  return (
    <g transform={`translate(${x},${y}) scale(${s})`} className={"cd-mp-tb" + (chay ? " chay" : "")}>
      {l.includes("băng") ? (
        <><line x1="-16" y1="8" x2="16" y2="-8" strokeWidth="4" /><circle cx="-16" cy="8" r="3" /><circle cx="16" cy="-8" r="3" /></>
      ) : l.includes("cẩu") ? (
        <><line x1="-8" y1="10" x2="-8" y2="-12" strokeWidth="3" /><line x1="-8" y1="-12" x2="16" y2="-6" strokeWidth="2.5" /><line x1="14" y1="-6" x2="14" y2="2" strokeWidth="1.2" /><rect x="-14" y="8" width="12" height="4" /></>
      ) : (
        <><rect x="-12" y="-4" width="16" height="10" rx="2" /><line x1="4" y1="-2" x2="14" y2="-8" strokeWidth="2.5" /><path d="M12,-10 l7,3 l-3,6 z" /><circle cx="-8" cy="8" r="2.5" /><circle cx="2" cy="8" r="2.5" /></>
      )}
    </g>
  );
}
