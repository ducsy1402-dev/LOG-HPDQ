import { useEffect, useMemo, useState } from "react";
import { Gauge, Truck, Users, ClipboardList, BellRing, Wrench, Grid3x3, Activity, AlertTriangle, Info, ChevronRight, Clock } from "lucide-react";
import { useApp } from "../store";
import { useApp as useLogistics, useHash } from "@/store";
import { Card, Kpi, Badge, Empty, StateBadge } from "../components/ui";
import { tinhDieuDo } from "../lib/dieuDo";
import { tinhDaiHan } from "./plan/LongTerm";
import { chenhTone, chenhLabel, rateTone } from "../lib/compute";
import { fmtD } from "../lib/plan";
import { pct, vn, diffDays, thu, vnShort, shortTo } from "../lib/utils";

// Điều độ: nhìn bao quát thiết bị, nhân sự và năng lực đáp ứng của ca để quyết định điều tiết kế hoạch trong ca.
// Từ trên xuống: ca đang diễn ra · chỉ số chính · việc cần quyết định · thiết bị đang dừng · năng lực theo đội ·
// quân số các ca · dự báo xe các ca tới (theo Linetime). Mọi số lấy từ dữ liệu đã có (khai báo, kế hoạch ngày, kế hoạch dài hạn), không nhập thêm.
const luu = (k, v) => { try { localStorage.setItem(k, v); } catch { /* bỏ qua */ } };
const gioPhut = (ms) => { const p = Math.round(ms / 60000), h = Math.floor(p / 60); return h ? `${h} giờ ${p % 60 ? (p % 60) + " phút" : ""}`.trim() : `${p} phút`; };

export default function DieuDo() {
  const { D, openVehicle } = useApp();
  const [, go] = useHash();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(id); }, []);
  const X = useMemo(() => tinhDieuDo(D, now), [D, now]);
  const { caNay, sXe, sCau, doiBang, canhBao, dung, quanSo, nhuCau } = X;

  const mo = (v) => {
    if (v.xe) return openVehicle(v.xe);
    if (v.tab) { luu("qltb-kb-tab", v.tab); return go("thiet-bi/khai-bao"); }
    if (v.kh) { luu("qltb-kh-tab", v.kh); return go("thiet-bi/ke-hoach"); }
  };

  const rowsNay = caNay ? D.shiftRows(caNay) : [];
  const tongNay = rowsNay.reduce((a, r) => ({ tt: a.tt + (r.thucTe ?? 0), xe: a.xe + r.xeCan, co: a.co || r.thucTe != null }), { tt: 0, xe: 0, co: false });
  const thieuNay = rowsNay.reduce((a, r) => a + (r.chenh < 0 ? -r.chenh : 0), 0);
  const thuaNay = rowsNay.reduce((a, r) => a + (r.chenh > 0 ? r.chenh : 0), 0);
  const canDoi = !tongNay.co ? null : thieuNay ? -thieuNay : thuaNay;
  const nh = nhuCau?.hienTai;
  const nBad = canhBao.filter((x) => x.muc === "bad").length;
  const tienDoCa = caNay ? Math.min(1, Math.max(0, (+now - caNay.start) / (caNay.end - caNay.start))) : 0;

  return (
    <>
      <div className="page-h">
        <div>
          <h1>Điều độ</h1>
          <div className="sub">Thiết bị, nhân sự và năng lực đáp ứng trong một màn hình để điều tiết kế hoạch trong ca. Số liệu cập nhật theo dữ liệu khai báo; bấm vào việc cần xử lý để mở nơi sửa.</div>
        </div>
      </div>

      {caNay && (
        <section className="card dd-ca">
          <div className="dd-ca-t">
            <Clock size={16} />
            <div>
              <div><b>{D.shiftLabel(caNay)}</b> <span className="mute">{caNay.ca.replace(/^CA \S+ /, "")}</span> · {caNay.dangChay ? <span className="ok">đang diễn ra, còn {gioPhut(caNay.end - +now)}</span> : <span className="warn">bắt đầu lúc {String(caNay.start.getHours()).padStart(2, "0")}h{String(caNay.start.getMinutes()).padStart(2, "0")}</span>}</div>
              <div className="small mute">{thu(caNay.ngay)} {vn(caNay.ngay)} · {caNay.hc ? "Kíp HC" : `Kíp ${D.shiftKip(caNay)}`}{X.caTiep && <> · ca tới {D.shiftLabel(X.caTiep)}</>}</div>
            </div>
          </div>
          <div className="dd-bar" aria-hidden="true"><i style={{ width: `${tienDoCa * 100}%` }} /></div>
        </section>
      )}

      <div className="grid g-kpi dd-kpi mb">
        <Kpi icon={Truck} label="Xe sẵn sàng" value={`${sXe.ready}/${sXe.tong}`} foot={`${pct(sXe.rate, 1)} · hỏng ${sXe.hong} · BD CL ${sXe.bdcl}`} tone={rateTone(sXe.rate, D.T)} meter={sXe.rate} />
        <Kpi icon={Wrench} label="Cẩu cảng sẵn sàng" value={sCau.tong ? `${sCau.ready}/${sCau.tong}` : "–"} foot={sCau.tong ? `${pct(sCau.rate, 1)} · hỏng ${sCau.hong}` : "Chưa có cẩu"} tone={sCau.tong ? rateTone(sCau.rate, D.T) : ""} meter={sCau.tong ? sCau.rate : undefined} />
        <Kpi icon={Users} label="Quân số ca này" value={tongNay.co ? `${tongNay.tt}/${tongNay.xe}` : `–/${tongNay.xe}`} foot={`Cân đối: ${canDoi == null ? "chưa nhập" : canDoi === 0 ? "đủ" : canDoi > 0 ? "thừa " + canDoi : "thiếu " + -canDoi}`} tone={canDoi == null ? "" : canDoi < 0 ? "bad" : "ok"} onClick={() => mo({ tab: "quan-so" })} />
        <Kpi icon={ClipboardList} label="Nhu cầu xe ca này" value={nh ? `${nh.tongGan}/${nh.tongCan}` : "–"} foot={nh ? (nh.tongThieu ? `thiếu ${nh.tongThieu} xe · ${nh.soThieu} nhu cầu` : "đã đủ xe") : nhuCau ? "Ca này chưa có nhu cầu" : "Chưa có kế hoạch ngày"} tone={nh ? (nh.tongThieu ? "bad" : "ok") : ""} onClick={() => mo({ kh: "ngay" })} />
        <Kpi icon={BellRing} label="Việc cần quyết định" value={canhBao.length} foot={nBad ? `${nBad} khẩn` : canhBao.length ? "không khẩn" : "ổn"} tone={nBad ? "bad" : canhBao.length ? "warn" : "ok"} alert={nBad > 0} />
      </div>

      <div className="grid g-2 mb">
        <Card title={`Việc cần quyết định (${canhBao.length})`} icon={BellRing} hint="đỏ trước, vàng sau">
          <div className="alerts dd-viec">
            {canhBao.length ? canhBao.map((a, i) => (
              <button key={i} type="button" className={"alert dd-it " + (a.muc === "info" ? "info" : a.muc)} onClick={() => mo(a)}>
                {a.muc === "info" ? <Info size={15} /> : <AlertTriangle size={15} />}
                <span>{a.nd}</span><ChevronRight size={15} className="dd-go" />
              </button>
            )) : <div className="alert ok"><Activity size={15} /><span>Không có việc nào cần quyết định: thiết bị, quân số và kế hoạch của các ca tới đều ổn.</span></div>}
          </div>
        </Card>

        <Card title={`Thiết bị đang dừng (${dung.length})`} icon={Wrench} hint="hỏng / BD chiến lược" right={<button type="button" className="btn sm" onClick={() => mo({ tab: "su-kien" })}>Mở Khai báo</button>}>
          {dung.length ? (
            <div className="tw" style={{ maxHeight: 330 }}>
              <table className="t compact">
                <thead><tr><th>Mã xe</th><th>Tổ</th><th>Tình trạng</th><th className="n">Ngày</th><th>Dự kiến xong</th></tr></thead>
                <tbody>{dung.slice(0, 30).map((e) => {
                  const v = D.vmap[e.ma_xe] || {};
                  const f = D.flags(e);
                  return (
                    <tr key={e.id}>
                      <td><button className="ma" onClick={() => openVehicle(e.ma_xe)}>{e.ma_xe}</button></td>
                      <td>{shortTo(v.to_xe)}<div className="small mute">{v.doi}</div></td>
                      <td className="wrap"><StateBadge s={D.stateOf(e.ma_xe)} /><div className="small mute">{e.nhom || e.loai}{e.mo_ta && e.mo_ta !== e.nhom ? " · " + e.mo_ta : ""}</div>{f.length > 0 && <div className="row" style={{ gap: 4, marginTop: 2 }}>{f.map((x) => <Badge key={x.k} tone={x.tone} plain>{x.label}</Badge>)}</div>}</td>
                      <td className="n">{diffDays(e.ngay_vao, D.today)}</td>
                      <td className={e.ngay_du_kien && e.ngay_du_kien < D.today ? "bad" : ""}>{e.ngay_du_kien ? vnShort(e.ngay_du_kien) : "–"}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          ) : <Empty>Không có thiết bị nào đang dừng.</Empty>}
        </Card>
      </div>

      <Card className="mb" title="Năng lực đáp ứng theo đội · ca này" icon={Gauge}
        hint={nh ? `nhu cầu theo ${nh.label}` : "chưa có nhu cầu trong kế hoạch ngày"}>
        {doiBang.length ? (
          <div className="tw">
            <table className="t dd-doi">
              <thead><tr><th>Đội</th><th>Sẵn sàng</th><th className="n">Hỏng</th><th className="n">BDCL</th><th className="n" title="Người có mặt / xe sẵn sàng cần người của ca">Người / xe cần</th><th className="n" title="Số xe đã gán / số xe nhu cầu yêu cầu">Nhu cầu (gán/cần)</th><th className="n" title="Xe sẵn sàng của ca chưa gán việc: có thể điều tiết">Xe rảnh</th></tr></thead>
              <tbody>{doiBang.map((d) => (
                <tr key={d.doi}>
                  <td><b>{d.doi}</b></td>
                  <td><div className="bar-cell"><div className="track"><i style={{ width: pct(d.rate), background: `var(--c-${d.tone === "ok" ? "ok" : d.tone === "warn" ? "warn" : "bad"})` }} /></div><span className={"mono small " + d.tone}>{d.ready}/{d.tong}</span></div></td>
                  <td className="n bad">{d.hong || ""}</td>
                  <td className="n warn">{d.bdcl || ""}</td>
                  <td className={"n " + chenhTone(d.chenh)} title={chenhLabel(d.chenh)}>{d.thucTe == null ? <span className="mute">–</span> : d.thucTe}<span className="mute small">/{d.xeCan}</span></td>
                  <td className={"n " + (d.thieuXe > 0 ? "bad" : "")}>{d.can == null ? <span className="mute">–</span> : d.can ? <>{d.can - d.thieuXe}<span className="mute small">/{d.can}</span></> : <span className="mute">0</span>}</td>
                  <td className={"n " + (d.ranh > 0 ? "ok" : "")}>{d.ranh == null ? <span className="mute">–</span> : <b>{d.ranh}</b>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <Empty>Chưa có đội xe.</Empty>}
        <div className="small mute" style={{ marginTop: 8 }}>Xe rảnh = xe sẵn sàng của ca chưa được gán vào nhu cầu nào trong Kế hoạch ngày. Đội thiếu xe mà đội khác còn xe rảnh thì cân nhắc điều tiết.</div>
      </Card>

      <Card className="mb" title="Quân số các ca tới" icon={Users} hint="có mặt / xe sẵn sàng cần người" right={<button type="button" className="btn sm" onClick={() => mo({ tab: "quan-so" })}>Nhập quân số</button>}>
        <MaTranQuanSo quanSo={quanSo} />
      </Card>

      <Card className="mb" title="Dự báo thừa / thiếu xe các ca tới" icon={Grid3x3} hint="theo Linetime tàu và kế hoạch dài hạn · có − cần">
        <DuBao />
      </Card>
    </>
  );
}

// Bảng ca × đội: số người có mặt trên số xe sẵn sàng cần người, tô màu theo cân đối
function MaTranQuanSo({ quanSo }) {
  const { D } = useApp();
  const doi = D.doiList.filter((d) => quanSo.some((q) => q.rows.some((r) => r.doi === d)));
  if (!quanSo.length || !doi.length) return <Empty>Chưa có ca nào để hiển thị.</Empty>;
  return (
    <div className="tw">
      <table className="t dd-mt">
        <thead><tr><th>Ca</th>{doi.map((d) => <th key={d} className="n">{d}</th>)}<th className="n">Cân đối</th></tr></thead>
        <tbody>{quanSo.map(({ sh, rows }) => {
          const thieu = rows.reduce((a, r) => a + (r.chenh < 0 ? -r.chenh : 0), 0), thua = rows.reduce((a, r) => a + (r.chenh > 0 ? r.chenh : 0), 0);
          const co = rows.some((r) => r.thucTe != null), cd = !co ? null : thieu ? -thieu : thua;
          return (
            <tr key={sh.ngay + sh.ca} className={sh.dangChay ? "dd-now" : ""}>
              <td><b>{D.shiftLabel(sh)}</b><div className="small mute">{thu(sh.ngay)} {vnShort(sh.ngay)}{sh.dangChay ? " · đang diễn ra" : ""}</div></td>
              {doi.map((d) => { const r = rows.find((x) => x.doi === d); return (
                <td key={d} className={"n " + (r ? chenhTone(r.chenh) : "")} title={r ? chenhLabel(r.chenh) : ""}>
                  {r ? <>{r.thucTe ?? "–"}<span className="mute small">/{r.xeCan}</span></> : <span className="mute">·</span>}
                </td>); })}
              <td className={"n " + chenhTone(cd)}><b>{cd == null ? "–" : cd > 0 ? "+" + cd : cd === 0 ? "Đủ" : cd}</b></td>
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
}

// Dải 12 ca tới của từng đội: số xe có − số xe cần (cảng + bãi) theo công thức kế hoạch dài hạn
function DuBao() {
  const { D } = useApp();
  const LD = useLogistics()?.D;
  const pp = D.plan?.params?.dai_han;
  const ds = useMemo(() => {
    if (!D.plan || !pp) return null;
    try { return D.doiList.filter((d) => d !== "Cẩu" && D.vehicles.some((v) => v.doi === d)).map((doi) => ({ doi, ...tinhDaiHan(D, LD, pp, doi) })).filter((x) => x.R.ves.some((r) => r.dung > 0) || x.R.fixed.length); } catch { return null; }
  }, [D, LD, pp]);
  if (!D.plan) return <Empty>CSDL chưa có bảng kế hoạch (Giai đoạn 2).</Empty>;
  if (!ds) return <Empty>Chưa tính được dự báo.</Empty>;
  if (!ds.length) return <Empty>Chưa có tàu hoặc việc bãi nào trong kế hoạch dài hạn để dự báo.</Empty>;
  const cot = ds[0].R.shifts.slice(0, 12);
  return (
    <>
      <div className="tw">
        <table className="t dd-mt dd-dub">
          <thead>
            <tr><th>Đội</th>{cot.map((s, i) => <th key={i} className={"n" + (s.now ? " dd-now-h" : "")} title={`${fmtD(s.st)} ${s.lab === "N" ? "CA 1 (ngày)" : "CA 2 (đêm)"}`}>{fmtD(s.st)}<div className="small mute">{s.lab === "N" ? "Ngày" : "Đêm"}</div></th>)}<th className="n">Ca thiếu</th></tr>
          </thead>
          <tbody>{ds.map((x) => (
            <tr key={x.doi}>
              <td><b>{x.doi}</b><div className="small mute">{x.capCang}+{x.capBai} xe</div></td>
              {x.R.shifts.slice(0, 12).map((s, i) => (
                <td key={i} className={"n dd-c " + (s.balChung < 0 ? "bad" : s.balChung === 0 ? "" : "ok")} title={`${fmtD(s.st)} · cảng ${s.balCang >= 0 ? "+" : ""}${s.balCang}, bãi ${s.balBai >= 0 ? "+" : ""}${s.balBai} · ${s.tt}`}>{s.balChung > 0 ? "+" + s.balChung : s.balChung}</td>
              ))}
              <td className={"n " + (x.R.kpi.caTHIEU ? "bad" : "ok")}><b>{x.R.kpi.caTHIEU}</b></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="small mute" style={{ marginTop: 8 }}>Số âm (đỏ) = thiếu xe so với nhu cầu của tàu và việc bãi trong ca đó. Chi tiết từng tàu xem ở Kế hoạch & báo cáo › Kế hoạch dài hạn › Linetime năng lực đáp ứng.</div>
    </>
  );
}
