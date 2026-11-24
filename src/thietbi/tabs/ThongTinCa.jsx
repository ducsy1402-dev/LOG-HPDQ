import { useMemo, useState } from "react";
import { Save, Info, Database, Eye } from "lucide-react";
import { useApp } from "../store";
import { Modal, Select } from "../components/ui";
import { vnShort, thu, shortTo, iso } from "../lib/utils";

// Khai báo › Thông tin đầu/cuối ca (SQL 18, anh Sỹ yêu cầu 16/11/2026): chỉ hiện CA ĐANG LÀM và ca hành chính của hôm nay (cả chủ nhật), chọn Đầu ca / Cuối ca;
// mỗi TỔ một nút (tách theo đội) → bấm mở hộp nhập liệu có SẴN ĐỦ xe của tổ (không phải chọn xe): mỗi xe một dòng gồm
// Mã xe · Tình trạng (Sẵn sàng / Hỏng / BDĐK / BDCL; gợi ý theo tình trạng hiện tại của xe) · Vị trí / BPSD (bộ phận sử dụng).
// Nút tổ hiện số xe đã khai / số xe của tổ và số xe không sẵn sàng. Ghi vào bảng thong_tin_ca (khóa: ngày + ca + đầu/cuối + mã xe).
export const TINH_TRANG = [["san_sang", "Sẵn sàng"], ["hong", "Hỏng"], ["bddk", "BDĐK"], ["bdcl", "BDCL"]];
const TEN_TT = Object.fromEntries(TINH_TRANG);
const THEO_TRANG_THAI = { ss: "san_sang", hong: "hong", bddk: "bddk", bdcl: "bdcl" }; // stateOf của xe -> tình trạng gợi ý
const LOAI = [["dau", "Đầu ca"], ["cuoi", "Cuối ca"]];

// Ca hành chính của hôm nay, kể cả chủ nhật (lịch ca bình thường bỏ ca HC ngày nghỉ)
function caHCHomNay(D, now) {
  const c = D.caDef.find((x) => x.hc);
  if (!c) return null;
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate()), kt = c.ketThuc ?? 17;
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(c.gio), Math.round((c.gio % 1) * 60));
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + (kt <= c.gio ? 1 : 0), Math.floor(kt), Math.round((kt % 1) * 60));
  return { ngay: iso(d), ca: c.ten, so: c.so, hc: true, start, end, dangChay: start <= now && now < end };
}

export default function ThongTinCa() {
  const { D } = useApp();
  const now = new Date();
  const cas = useMemo(() => {
    const ds = D.upcomingShifts(now), nay = ds.find((x) => x.dangChay && !x.hc) || ds.find((x) => !x.hc) || null, hc = ds.find((x) => x.hc && x.ngay === iso(now)) || caHCHomNay(D, now);
    return [nay, hc].filter(Boolean);
  }, [D]); // eslint-disable-line react-hooks/exhaustive-deps
  const [chon, setChon] = useState(0);
  const [loai, setLoai] = useState("dau");
  const sh = cas[Math.min(chon, cas.length - 1)];

  if (!D.coSql18) {
    return <div className="alert warn mb"><Database size={16} /><span>CSDL chưa có bảng <b className="mono">thong_tin_ca</b>. Quản trị chạy file <b className="mono">sql/18_thong_tin_dau_cuoi_ca.sql</b> trong Supabase (SQL Editor) rồi tải lại web.</span></div>;
  }
  if (!sh) return <div className="card"><div className="alert info"><Info size={16} /><span>Chưa có ca nào để khai báo.</span></div></div>;
  return (
    <div className="qs">
      <div className="qs-cas" role="tablist" aria-label="Chọn ca">
        {cas.map((x, k) => (
          <button key={x.ngay + x.ca} type="button" role="tab" aria-selected={x === sh} className={"qs-ca" + (x === sh ? " on" : "") + (x.dangChay ? " now" : "")} onClick={() => setChon(k)}>
            <b>{D.shiftLabel(x)}</b>
            <span>{x.hc ? "Hành chính" : x.dangChay ? "Đang diễn ra" : "Ca tới"} · {thu(x.ngay)} {vnShort(x.ngay)}</span>
          </button>
        ))}
      </div>
      <div className="kb-tabs" role="tablist" aria-label="Đầu ca hay cuối ca" style={{ maxWidth: 360 }}>
        {LOAI.map(([k, ten]) => <button key={k} type="button" role="tab" aria-selected={loai === k} className={loai === k ? "on" : ""} onClick={() => setLoai(k)}>{ten}</button>)}
      </div>
      <CaThongTin key={sh.ngay + "|" + sh.ca + "|" + loai} sh={sh} loai={loai} />
    </div>
  );
}

function CaThongTin({ sh, loai }) {
  const { D, sua } = useApp();
  const canWrite = sua("khai_bao");
  const [mo, setMo] = useState(null); // khóa (đội|tổ) đang mở hộp nhập
  const cheDo = sh.hc ? "HC" : "Đi ca";
  // Xe của từng (đội, tổ) trong ca này (cùng chế độ Đi ca / HC như tab Nhân sự & quân số); tổ có xe của nhiều đội thì mỗi đội một nút riêng
  const xeCua = useMemo(() => { const m = new Map(); for (const v of D.vehicles) if (v.to_xe && v.che_do === cheDo) { const k = (v.doi || "Khác") + "|" + v.to_xe; if (!m.has(k)) m.set(k, { doi: v.doi || "Khác", to: v.to_xe, vs: [] }); m.get(k).vs.push(v); } return m; }, [D, cheDo]); // eslint-disable-line react-hooks/exhaustive-deps
  const daKhai = useMemo(() => D.thongTinCa.filter((r) => r.ngay === sh.ngay && r.ca === sh.ca && r.loai === loai), [D, sh, loai]); // eslint-disable-line react-hooks/exhaustive-deps
  const khaiCua = (g) => daKhai.filter((r) => r.to_xe === g.to && g.vs.some((v) => v.ma === r.ma_xe));
  const nhom = useMemo(() => {
    const m = new Map();
    for (const g of xeCua.values()) { if (!m.has(g.doi)) m.set(g.doi, []); m.get(g.doi).push({ ...g, k: g.doi + "|" + g.to, khai: daKhai.filter((r) => r.to_xe === g.to && g.vs.some((v) => v.ma === r.ma_xe)) }); }
    const vt = (d) => (D.doiList.indexOf(d) < 0 ? 999 : D.doiList.indexOf(d));
    return [...m.entries()].sort(([a], [b]) => vt(a) - vt(b));
  }, [xeCua, daKhai, D]); // eslint-disable-line react-hooks/exhaustive-deps
  const tongKhai = daKhai.length, tongKhong = daKhai.filter((r) => r.tinh_trang !== "san_sang").length;
  const dangMo = mo && xeCua.get(mo);

  return (
    <>
      <div className="qs-sum">
        <span>{LOAI.find(([k]) => k === loai)[1]} · {D.shiftLabel(sh)}: đã khai <b>{tongKhai}</b> xe</span>
        {tongKhong > 0 && <span className="bad">Không sẵn sàng <b>{tongKhong}</b></span>}
        {!canWrite && <span className="mute"><Eye size={13} /> chỉ xem</span>}
      </div>
      {!nhom.length && <div className="card"><div className="alert info"><Info size={16} /><span>Chưa có tổ nào có xe cho ca này.</span></div></div>}
      {nhom.map(([doi, ds]) => (
        <section key={doi} className="qs-doi">
          <div className="qs-doi-h"><b>{doi}</b><span className="small mute">{ds.filter((x) => x.khai.length).length}/{ds.length} tổ đã khai</span></div>
          <div className="qs-tiles">
            {ds.map(({ k, to, vs, khai }) => {
              const khong = khai.filter((r) => r.tinh_trang !== "san_sang").length;
              const tone = !khai.length ? "chua" : khai.length >= vs.length ? (khong ? "bad" : "ok") : "info";
              return (
                <button key={k} type="button" className={"qs-tile " + tone} onClick={() => setMo(k)}>
                  <span className="qs-tn">{shortTo(to)}</span>
                  <span className="qs-tv"><b>{khai.length || "–"}</b><i>/{vs.length} xe</i></span>
                  <span className="qs-ts">{khong ? `Không SS ${khong}` : khai.length ? "Đã khai" : "Chưa khai"}</span>
                </button>);
            })}
          </div>
        </section>
      ))}
      {dangMo && <HopNhap sh={sh} loai={loai} to={dangMo.to} doi={dangMo.doi} vs={dangMo.vs} khai={khaiCua(dangMo)} onClose={() => setMo(null)} />}
    </>
  );
}

// Hộp nhập thông tin đầu/cuối ca của một tổ: sẵn đủ xe của tổ, chỉ chọn tình trạng và gõ vị trí / BPSD
function HopNhap({ sh, loai, to, doi, vs, khai, onClose }) {
  const { D, api, run, sua } = useApp();
  const canWrite = sua("khai_bao");
  const macDinh = (ma) => THEO_TRANG_THAI[D.stateOf(ma)] || "san_sang"; // gợi ý theo tình trạng hiện tại của xe
  const [ds, setDs] = useState(() => vs.map((v) => v.ma).sort((a, b) => a.localeCompare(b, "vi", { numeric: true })).map((ma) => {
    const r = khai.find((x) => x.ma_xe === ma);
    return { ma, tt: r ? r.tinh_trang : macDinh(ma), vt: r?.vi_tri || "" };
  }));
  const [luu, setLuu] = useState(false);
  const dat = (i, p) => setDs((o) => o.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const ghi = async () => {
    const rows = ds.map((r) => ({ ngay: sh.ngay, ca: sh.ca, loai, to_xe: to, ma_xe: r.ma, tinh_trang: r.tt, vi_tri: r.vt.trim() || null }));
    const khong = rows.filter((r) => r.tinh_trang !== "san_sang");
    setLuu(true);
    const ok = await run(() => api.saveThongTinCa(rows, []), `Đã lưu ${shortTo(to)} (${doi}) · ${loai === "dau" ? "đầu ca" : "cuối ca"}: ${rows.length} xe${khong.length ? `, ${khong.length} không sẵn sàng` : ""}`);
    setLuu(false);
    if (ok) onClose();
  };
  const luoi = "minmax(90px,0.9fr) minmax(104px,0.9fr) minmax(130px,1.7fr)";
  return (
    <Modal nho title={`${shortTo(to)} (${doi}) · ${loai === "dau" ? "Đầu ca" : "Cuối ca"} · ${D.shiftLabel(sh)}`} onClose={onClose} width={640}
      footer={canWrite ? <><button type="button" className="btn" onClick={onClose}>Hủy</button><button type="button" className="btn pri" onClick={ghi} disabled={luu}><Save size={15} />{luu ? "Đang lưu…" : "Lưu"}</button></> : <button type="button" className="btn" onClick={onClose}>Đóng</button>}>
      <div className="small mute mb">Tổ {shortTo(to)} có {vs.length} xe của đội {doi}, đã liệt kê đủ. Chọn tình trạng (gợi ý theo tình trạng hiện tại của xe) và gõ vị trí / bộ phận sử dụng.</div>
      <div style={{ display: "grid", gap: 6, maxHeight: "55vh", overflowY: "auto" }}>
        <div className="small mute" style={{ display: "grid", gridTemplateColumns: luoi, gap: 6, position: "sticky", top: 0, background: "var(--surface, inherit)" }}><span>Mã xe</span><span>Tình trạng</span><span>Vị trí / BPSD</span></div>
        {ds.map((r, i) => (
          <div key={r.ma} style={{ display: "grid", gridTemplateColumns: luoi, gap: 6, alignItems: "center" }}>
            <b className="mono">{r.ma}</b>
            <Select value={r.tt} disabled={!canWrite} onChange={(tt) => dat(i, { tt })} options={TINH_TRANG} aria-label={`Tình trạng ${r.ma}`} className={"inp" + (r.tt === "hong" ? " bad" : r.tt === "san_sang" ? "" : " warn")} />
            <input className="inp" value={r.vt} disabled={!canWrite} placeholder="Vị trí / BPSD" onChange={(e) => dat(i, { vt: e.target.value })} aria-label={`Vị trí ${r.ma}`} />
          </div>))}
      </div>
    </Modal>
  );
}

export { TEN_TT };
