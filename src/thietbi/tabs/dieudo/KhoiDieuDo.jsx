import { useMemo, useState } from "react";
import { Ship, Wrench, Boxes, ClipboardCheck, Truck, Copy } from "lucide-react";
import { useApp } from "../../store";
import { useApp as useLogistics } from "@/store";
import { Card, Empty, Modal, Select, StateBadge } from "../../components/ui";
import { useKho } from "@/pages/kho/useKho";
import EChart from "@/components/EChart";
import { trangThai } from "@/lib/linetime";
import { mocDuKien } from "@/lib/xepBen";
import { daLam, klCanLam } from "@/lib/linetime";
import { so, plain, r2, pct } from "@/lib/format";
import { shortTo, thu, vnShort } from "../../lib/utils";
import { TEN_TT } from "../ThongTinCa";

// Các khối của trang Điều độ (anh Sỹ yêu cầu 16/11/2026): Tàu đang làm hàng · Thiết bị gắn xe xúc đào · Tồn kho các bãi · Giao ca · hộp Xe rảnh.
const gio = (t) => { if (t == null) return ""; const d = new Date(t), p = (n) => String(n).padStart(2, "0"); return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`; };
const mocMs = (x) => (x ? new Date(x).getTime() : null);
// Một danh sách mục của chuyến tàu: [{ ten, gia_tri }] (phương tiện) hoặc [{ bai, khu, khoi_luong }] (kho-bãi)
const mucPT = (ds) => (Array.isArray(ds) ? ds : []).map((x) => [x.ten, x.gia_tri].filter((y) => y != null && y !== "").join(" ")).filter(Boolean);
const mucBai = (v) => (Array.isArray(v.bai_kl) && v.bai_kl.length ? v.bai_kl.map((x) => [[x.bai, x.khu].filter(Boolean).join(" › "), x.khoi_luong ? `${so(x.khoi_luong, 0)} t` : ""].filter(Boolean).join(": ")) : String(v.bai_hang || "").split(";").map((x) => x.trim()).filter(Boolean));

export function useTauLamHang(now) {
  const LD = useLogistics()?.D;
  return useMemo(() => (LD?.voyages ? LD.voyages.filter((v) => !v.huy && trangThai(v, +now) === "lam_hang").sort((a, b) => (mocMs(a.bd_lam_hang) ?? 0) - (mocMs(b.bd_lam_hang) ?? 0)) : null), [LD, now]);
}

// ---------- Tàu đang làm hàng ----------
export function TauLamHang({ now, ds }) {
  return (
    <Card title={`Tàu đang làm hàng${ds ? ` (${ds.length})` : ""}`} icon={Ship} hint="thời gian · phương tiện vận chuyển · kho bãi · phương tiện kho bãi">
      {ds == null ? <Empty>Cần quyền Khai thác Cảng để xem tàu.</Empty> : !ds.length ? <Empty>Hiện không có tàu nào đang làm hàng.</Empty> : (
        <div className="tw">
          <table className="t compact dd-tau">
            <thead><tr><th>Tàu</th><th>Thời gian</th><th>Phương tiện vận chuyển</th><th>Kho - Bãi</th><th>Phương tiện kho bãi</th></tr></thead>
            <tbody>{ds.map((v) => {
              const m = mocDuKien(v), cl = klCanLam(v), dl = daLam(v), tl = cl > 0 ? Math.min(1, dl / cl) : null, con = m.kt != null ? m.kt - +now : null;
              return (
                <tr key={v.id}>
                  <td className="wrap"><b>{v.ten_tau}</b> <span className="mono small mute">{v.ben_ma || ""}</span>
                    <div className="small mute">{v.huong === "xuat" ? "Xuất" : "Nhập"} {v.ten_hang || v.loai_hang || ""} · {so(v.khoi_luong, 0)} t{tl != null && <> · đã làm {pct(tl, 0)}</>}</div></td>
                  <td className="wrap small">
                    <div>Cập: {gio(m.cap) || "–"}{v.atb ? "" : " (dự kiến)"}</div>
                    <div>BĐ làm hàng: {gio(m.bd) || "–"}{v.bd_lam_hang ? "" : " (dự kiến)"}</div>
                    <div>KT dự kiến: {gio(m.kt) || "–"}{con != null && <span className={con < 0 ? " bad" : " mute"}> · {con < 0 ? "quá giờ" : `còn ${Math.floor(con / 36e5)}h${String(Math.round((con % 36e5) / 6e4)).padStart(2, "0")}`}</span>}</div>
                    <div>ETD: {gio(m.roi) || "–"}</div>
                  </td>
                  <td className="wrap small">{mucPT(v.pt_van_chuyen).join(", ") || <span className="mute">–</span>}</td>
                  <td className="wrap small">{mucBai(v).join("; ") || <span className="mute">–</span>}</td>
                  <td className="wrap small">{mucPT(v.pt_kho_bai).join(", ") || <span className="mute">–</span>}</td>
                </tr>);
            })}</tbody>
          </table>
        </div>)}
    </Card>
  );
}

// ---------- Thiết bị gắn của xe xúc đào ----------
export function ThietBiGan() {
  const { D, openVehicle } = useApp();
  const xe = useMemo(() => D.vehicles.filter((v) => v.doi === "Xúc đào"), [D]);
  const bang = useMemo(() => {
    const m = new Map();
    for (const v of xe) {
      const ten = D.thietBiGanOf(v) || "Chưa khai báo";
      for (const t of String(ten).split(/[,;+]/).map((x) => x.trim()).filter(Boolean)) { if (!m.has(t)) m.set(t, []); m.get(t).push(v); }
    }
    const thuTu = [...D.thietBiGanList, "Chưa khai báo"];
    return [...m.entries()].sort(([a], [b]) => (thuTu.indexOf(a) < 0 ? 99 : thuTu.indexOf(a)) - (thuTu.indexOf(b) < 0 ? 99 : thuTu.indexOf(b)) || a.localeCompare(b, "vi")).map(([ten, vs]) => ({ ten, vs, ss: vs.filter((v) => D.isReady(v.ma)).length }));
  }, [D, xe]);
  return (
    <Card title={`Thiết bị gắn · xe xúc đào (${xe.length} xe)`} icon={Wrench} hint="theo thiết bị gắn đã khai báo ở Danh mục xe">
      {!xe.length ? <Empty>Chưa có xe xúc đào.</Empty> : (
        <div className="tw">
          <table className="t compact">
            <thead><tr><th>Thiết bị gắn</th><th className="n">Số xe</th><th className="n">Sẵn sàng</th><th className="n">Không SS</th><th>Mã xe</th></tr></thead>
            <tbody>{bang.map((b) => (
              <tr key={b.ten}>
                <td><b>{b.ten}</b></td>
                <td className="n">{b.vs.length}</td>
                <td className="n ok">{b.ss}</td>
                <td className={"n " + (b.vs.length - b.ss ? "bad" : "")}>{b.vs.length - b.ss || ""}</td>
                <td className="wrap"><div style={{ maxHeight: 96, overflowY: "auto" }}>{b.vs.map((v) => <button key={v.ma} type="button" className={"ma small " + (D.isReady(v.ma) ? "" : "bad")} style={{ marginRight: 8 }} onClick={() => openVehicle(v.ma)} title={`${shortTo(v.to_xe)} · ${D.isReady(v.ma) ? "sẵn sàng" : "đang dừng"}`}>{v.ma}</button>)}</div></td>
              </tr>))}</tbody>
          </table>
        </div>)}
    </Card>
  );
}

// ---------- Tồn kho các bãi (lọc theo bãi, hàng) ----------
export function TonKhoBai() {
  const kho = useKho();
  const [bai, setBai] = useState(""), [hang, setHang] = useState("");
  const dong = useMemo(() => (kho ? kho.dong.filter((d) => !d.saiBai) : []), [kho]);
  const dsBai = useMemo(() => [...new Set(dong.map((d) => d.ten_bai))].sort((a, b) => a.localeCompare(b, "vi", { numeric: true })), [dong]);
  const dsHang = useMemo(() => { const m = new Map(); for (const d of dong) for (const c of d.chua || []) if (c.ton > 1e-6) m.set(plain(c.hang), c.hang); return [...m.values()].sort((a, b) => a.localeCompare(b, "vi")); }, [dong]);
  const ds = useMemo(() => {
    const tonCua = (d) => (hang ? (d.chua || []).filter((c) => plain(c.hang) === plain(hang)).reduce((s, c) => s + c.ton, 0) : d.ton);
    let rows;
    if (bai) rows = dong.filter((d) => d.ten_bai === bai).map((d) => ({ ten: d.ten, ton: tonCua(d), suc: d.sucChua || 0 }));
    else { const m = new Map(); for (const d of dong) { const o = m.get(d.ten_bai) || { ten: d.ten_bai, ton: 0, suc: 0 }; o.ton += tonCua(d); o.suc += d.sucChua || 0; m.set(d.ten_bai, o); } rows = [...m.values()]; }
    return rows.filter((r) => (hang ? r.ton > 1e-6 : true)).sort((a, b) => b.ton - a.ton);
  }, [dong, bai, hang]);
  const tong = ds.reduce((s, r) => s + r.ton, 0);
  return (
    <Card title="Tồn kho các bãi" icon={Boxes} hint={`${bai ? "theo gian / lô của " + bai : "theo bãi lớn"}${hang ? " · " + hang : ""}`}
      right={<><Select value={bai} onChange={setBai} blank="Tất cả bãi" options={dsBai} className="inp sm" style={{ width: 150 }} aria-label="Lọc bãi" />
        <Select value={hang} onChange={setHang} blank="Tất cả hàng" options={dsHang} className="inp sm" style={{ width: 170 }} aria-label="Lọc hàng" /></>}>
      {!kho ? <Empty>Cần quyền Khai thác kho bãi để xem tồn kho.</Empty> : !ds.length ? <Empty>Không có tồn khớp bộ lọc.</Empty> : (
        <>
          <div className="small mute" style={{ marginBottom: 4 }}>Tổng tồn <b>{so(tong, 0)} t</b>{!hang && ds.some((r) => r.suc > 0) ? ` · sức chứa ${so(ds.reduce((s, r) => s + r.suc, 0), 0)} t` : ""} · {ds.length} {bai ? "gian / lô" : "bãi"}</div>
          <div style={{ maxHeight: 420, overflowY: "auto" }}>
            <EChart height={Math.max(220, 40 + ds.length * 24)} option={{
              legend: hang ? undefined : { data: ["Tồn", "Sức chứa"] },
              grid: { left: 4, right: 56, top: hang ? 8 : 30, bottom: 4, containLabel: true }, tooltip: { axisPointer: { type: "shadow" }, valueFormatter: (v) => (v == null ? "" : `${so(v)} t`) },
              xAxis: { type: "value", axisLabel: { fontSize: 10 } },
              yAxis: { type: "category", inverse: true, data: ds.map((r) => r.ten), axisLabel: { fontSize: 10, width: 150, overflow: "truncate" } },
              series: [
                ...(hang ? [] : [{ name: "Sức chứa", type: "bar", barMaxWidth: 14, barGap: "-100%", itemStyle: { color: "rgba(148,163,184,0.28)" }, data: ds.map((r) => r2(r.suc)), z: 1 }]),
                { name: "Tồn", type: "bar", barMaxWidth: 14, z: 2, itemStyle: { color: "#6366f1" }, data: ds.map((r) => r2(Math.max(0, r.ton))),
                  label: { show: true, position: "right", fontSize: 10, textBorderWidth: 0, formatter: (p) => (!hang && ds[p.dataIndex].suc > 0 ? pct(ds[p.dataIndex].ton / ds[p.dataIndex].suc, 0) : so(p.value, 0)) } },
              ],
            }} />
          </div>
        </>)}
    </Card>
  );
}

// ---------- Hộp mã xe rảnh của một đội ----------
export function HopXeRanh({ doi, xe, onClose }) {
  const { D, openVehicle } = useApp();
  const theoTo = useMemo(() => { const m = new Map(); for (const x of xe) { if (!m.has(x.to)) m.set(x.to, []); m.get(x.to).push(x); } return [...m.entries()]; }, [xe]);
  return (
    <Modal title={`Xe rảnh · ${doi} (${xe.length})`} onClose={onClose} nho width={520}
      footer={<button type="button" className="btn" onClick={onClose}>Đóng</button>}>
      <div className="small mute mb">Xe sẵn sàng của ca này chưa được gán vào nhu cầu nào trong Kế hoạch ngày. Bấm mã xe để xem chi tiết.</div>
      {theoTo.map(([to, ds]) => (
        <div key={to} style={{ marginBottom: 10 }}>
          <div className="small mute">{shortTo(to) || "Chưa có tổ"} · {ds.length} xe</div>
          <div className="row" style={{ gap: 6, flexWrap: "wrap", marginTop: 4 }}>
            {ds.map((x) => <button key={x.ma} type="button" className="btn sm" onClick={() => openVehicle(x.ma)}>{x.ma}{x.state === "bddk" && <span className="mute small"> · BDĐK</span>}</button>)}
          </div>
        </div>))}
      {!xe.length && <Empty>Không có xe rảnh.</Empty>}
    </Modal>
  );
}

// ---------- Giao ca ----------
// Bản tóm tắt tự động để người điều độ giao cho ca sau: thiết bị, thông tin cuối ca đã khai, quân số ca tới, tàu đang làm hàng / sắp cập – rời, nhu cầu xe, việc chưa quyết định.
// Có nút sao chép thành văn bản (dán vào nhóm chat giao ca).
export function GiaoCa({ X, now, tau }) {
  const { D, toast } = useApp();
  const LD = useLogistics()?.D;
  const { caNay, caTiep, sXe, dung, canhBao, nhuCau } = X;
  const cuoiCa = useMemo(() => (caNay ? D.thongTinCa.filter((r) => r.ngay === caNay.ngay && r.ca === caNay.ca && r.loai === "cuoi") : []), [D, caNay]);
  const khongSS = useMemo(() => {
    const m = new Map();
    for (const r of cuoiCa) if (r.tinh_trang !== "san_sang") { const k = `${shortTo(r.to_xe)}`; if (!m.has(k)) m.set(k, []); m.get(k).push(r); }
    return [...m.entries()];
  }, [cuoiCa]);
  const tcRows = caTiep ? D.shiftRows(caTiep) : [];
  const thieuCaTiep = tcRows.filter((r) => r.chenh != null && r.chenh < 0);
  const chuaNhapTiep = tcRows.filter((r) => r.thucTe == null && r.xeCan > 0);
  const sapDen = useMemo(() => {
    if (!LD?.voyages || !caTiep) return { cap: [], roi: [] };
    const tu = +now, den = caTiep.end ? +caTiep.end : tu + 12 * 36e5;
    const trong = (t) => t != null && t >= tu && t <= den;
    const cap = [], roi = [];
    for (const v of LD.voyages) { if (v.huy) continue; const tt = trangThai(v, tu); if (tt === "da_roi") continue; const m = mocDuKien(v); if (!v.atb && trong(m.cap)) cap.push(v); if (!v.atd && trong(m.roi) && ["cap_ben", "lam_hang", "xong_hang"].includes(tt)) roi.push(v); }
    return { cap, roi };
  }, [LD, caTiep, now]);
  const nh = nhuCau?.keTiep;
  const nBad = canhBao.filter((x) => x.muc === "bad").length;

  const dong = [
    ["Thiết bị", `Xe sẵn sàng ${sXe.ready}/${sXe.tong} (${pct(sXe.rate, 1)}) · hỏng ${sXe.hong} · BD chiến lược ${sXe.bdcl}${dung.length ? ` · đang dừng ${dung.length}` : ""}`],
    ["Cuối ca đã khai", !D.coSql18 ? "chưa chạy SQL 18" : cuoiCa.length ? `${cuoiCa.length} xe${khongSS.length ? ` · không sẵn sàng: ${khongSS.map(([to, rs]) => `${to} (${rs.map((r) => `${r.ma_xe} ${TEN_TT[r.tinh_trang]}`).join(", ")})`).join("; ")}` : " · đều sẵn sàng"}` : "chưa khai (Khai báo › Thông tin đầu/cuối ca)"],
    ["Quân số ca tới", !caTiep ? "chưa có ca tới" : thieuCaTiep.length ? `thiếu: ${thieuCaTiep.map((r) => `${r.doi} −${-r.chenh}`).join(", ")}` : chuaNhapTiep.length ? `chưa nhập: ${chuaNhapTiep.map((r) => r.doi).join(", ")}` : "đủ người"],
    ["Nhu cầu xe ca tới", nh ? (nh.tongThieu ? `thiếu ${nh.tongThieu} xe / ${nh.tongCan} (${nh.soThieu} nhu cầu)` : `đã đủ xe (${nh.tongCan})`) : "chưa có nhu cầu trong kế hoạch ngày"],
    ["Tàu đang làm hàng", tau == null ? "cần quyền Cảng" : tau.length ? tau.map((v) => `${v.ten_tau}${v.ben_ma ? " (" + v.ben_ma + ")" : ""}`).join(", ") : "không có"],
    ["Tàu sắp cập / rời", `cập: ${sapDen.cap.map((v) => `${v.ten_tau} ${gio(mocDuKien(v).cap)}`).join(", ") || "không"} · rời: ${sapDen.roi.map((v) => `${v.ten_tau} ${gio(mocDuKien(v).roi)}`).join(", ") || "không"}`],
    ["Việc cần quyết định", canhBao.length ? `${canhBao.length}${nBad ? ` (${nBad} khẩn)` : ""}: ${canhBao.slice(0, 3).map((a) => a.nd).join(" | ")}${canhBao.length > 3 ? " …" : ""}` : "không có"],
  ];
  const chep = async () => {
    const tieuDe = `GIAO CA ${caNay ? D.shiftLabel(caNay) : ""}${caTiep ? " → " + D.shiftLabel(caTiep) : ""} · ${gio(+now)}`;
    const van = [tieuDe, ...dong.map(([k, v]) => `- ${k}: ${v}`)].join("\n");
    try { await navigator.clipboard.writeText(van); toast("Đã sao chép nội dung giao ca", "ok"); } catch { toast("Không sao chép được, hãy bôi đen nội dung rồi chép tay", "bad"); }
  };
  return (
    <Card title={`Giao ca${caNay ? ` · ${D.shiftLabel(caNay)}${caTiep ? " → " + D.shiftLabel(caTiep) : ""}` : ""}`} icon={ClipboardCheck} hint={caNay ? `${thu(caNay.ngay)} ${vnShort(caNay.ngay)}` : ""}
      right={<button type="button" className="btn sm" onClick={chep}><Copy size={14} />Sao chép</button>}>
      <div className="tw">
        <table className="t compact">
          <tbody>{dong.map(([k, v]) => <tr key={k}><td style={{ width: 170 }}><b>{k}</b></td><td className="wrap">{v}</td></tr>)}</tbody>
        </table>
      </div>
      {dung.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div className="small mute" style={{ marginBottom: 4 }}>Thiết bị đang dừng cần giao ({Math.min(dung.length, 12)}/{dung.length})</div>
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            {dung.slice(0, 12).map((e) => <span key={e.id} className="badge plain" title={`${e.nhom || e.loai}${e.mo_ta ? " · " + e.mo_ta : ""}`}><b className="mono">{e.ma_xe}</b> <StateBadge s={D.stateOf(e.ma_xe)} /></span>)}
          </div>
        </div>)}
    </Card>
  );
}

export { Truck };
