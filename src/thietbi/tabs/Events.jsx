import { useState } from "react";
import { ClipboardPlus, CheckCircle2, RotateCcw, Trash2, ListChecks, Activity, Wrench, History, Database, Plus, Eye, Upload, Pencil } from "lucide-react";
import { useApp } from "../store";
import { Card, Seg, Search, Select, Badge, Empty, StateBadge, DateInput, MultiSelect, Modal, Field, ConfirmButton } from "../components/ui";
import { StatusDonut } from "../components/charts";
import EventForm from "../components/EventForm";
import { vn, diffDays, matchQ, countBy, shortTo, pct } from "../lib/utils";
import { rateTone } from "../lib/compute";

const LOAI_TONE = { "Hỏng": "bad", "BD chiến lược": "orange", "BD định kỳ": "info" };

// Tình trạng & sự kiện chia 3 tab nhỏ: Thiết bị gắn (đếm theo loại), Thiết bị di động (xe), Cẩu cảng
const NHOM_TT = [["gan", "Thiết bị gắn"], ["di_dong", "Thiết bị di động"], ["cau", "Cẩu cảng"]];
export default function TinhTrang() {
  const [nhom, setNhom] = useState(() => { try { return localStorage.getItem("qltb-tt-nhom") || "di_dong"; } catch { return "di_dong"; } });
  const chon = (x) => { setNhom(x); try { localStorage.setItem("qltb-tt-nhom", x); } catch { /* bỏ qua */ } };
  const tab = <Seg value={nhom} onChange={chon} options={NHOM_TT} />;
  return nhom === "gan" ? <ThietBiGan tab={tab} /> : <SuKien key={nhom} nhom={nhom} tab={tab} />;
}

// Xe thuộc nhóm: cẩu cảng = đội "Cẩu", thiết bị di động = các đội còn lại
const thuocNhom = (nhom) => (v) => (nhom === "cau" ? v?.doi === "Cẩu" : v && v.doi !== "Cẩu");

function SuKien({ nhom, tab }) {
  const { D, api, run, canWrite, isAdmin, openVehicle } = useApp();
  // Bộ lọc chọn nhiều: mảng rỗng = tất cả
  const [doi, setDoi] = useState([]);
  const [q, setQ] = useState("");
  const [loaiF, setLoaiF] = useState([]);
  const T = D.T;
  const thuoc = thuocNhom(nhom);
  const doiNhom = D.doiList.filter((x) => D.vehicles.some((v) => v.doi === x && thuoc(v)));

  const has = (arr, x) => !arr.length || arr.includes(x);
  const vsDoi = D.vehicles.filter((v) => thuoc(v) && has(doi, v.doi));
  const sum = D.summarize(vsDoi);
  const openAll = D.open.filter((e) => thuoc(D.vmap[e.ma_xe]) && has(doi, D.vmap[e.ma_xe]?.doi));
  const open = openAll.filter((e) => has(loaiF, e.loai) && matchQ(q, e.ma_xe, D.vmap[e.ma_xe]?.to_xe, e.loai, e.nhom, e.mo_ta, e.pic))
    .sort((a, b) => a.ngay_vao.localeCompare(b.ngay_vao));
  const closed = D.events.filter((e) => e.ngay_xong && thuoc(D.vmap[e.ma_xe]) && has(doi, D.vmap[e.ma_xe]?.doi) && matchQ(q, e.ma_xe, e.loai, e.nhom, e.mo_ta))
    .sort((a, b) => b.ngay_xong.localeCompare(a.ngay_xong)).slice(0, 60);
  const byNhom = Object.entries(countBy(openAll.filter((e) => e.loai !== "BD định kỳ"), (e) => e.nhom || "Khác")).sort((a, b) => b[1] - a[1]);
  const maxNhom = Math.max(1, ...byNhom.map((x) => x[1]));

  const upd = (id, patch, msg) => run(() => api.updateEvent(id, patch), msg);
  const del = (e) => confirm(`Xóa hẳn sự kiện ${e.loai} của xe ${e.ma_xe}?`) && run(() => api.deleteEvent(e.id), "Đã xóa sự kiện");


  return (
    <>
      <div className="page-h">
        <div>
          <h1>Tình trạng & sự kiện · {nhom === "cau" ? "Cẩu cảng" : "Thiết bị di động"}</h1>
          <div className="sub">{nhom === "cau" ? "Cẩu bờ, cẩu xích, cầu trục… (đội Cẩu)." : "Xe ben, đầu kéo, xúc đào, xúc lật…"} Sẵn sàng = không hỏng, không BD chiến lược; đang BD định kỳ vẫn tính sẵn sàng. Mã xe sẵn sàng theo tổ xem ở Điều độ chung.</div>
        </div>
        <div className="tools">{tab}{doiNhom.length > 1 && <MultiSelect prefix="Đội" value={doi} onChange={setDoi} options={doiNhom} style={{ width: 230 }} />}</div>
      </div>

      <div className="grid g-main mb">
        <Card title={nhom === "cau" ? "Ghi nhận cẩu hỏng / vào bảo dưỡng" : "Ghi nhận xe hỏng / vào bảo dưỡng"} icon={ClipboardPlus}>
          {canWrite ? <EventForm /> : <div className="alert info"><Eye size={16} /><span>Tài khoản của bạn chỉ có quyền xem. Người nhập liệu hoặc quản trị mới ghi nhận được sự kiện.</span></div>}
        </Card>
        <Card title="Xem nhanh" icon={Activity} right={<Badge tone={rateTone(sum.rate, T)} plain>SS {pct(sum.rate, 1)}</Badge>}>
          <div className="grid" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 16, alignItems: "start" }}>
            <StatusDonut sum={sum} size={150} />
            <div>
              <div className="small mute" style={{ marginBottom: 8, fontWeight: 600 }}>Xe dừng theo nhóm lỗi</div>
              {byNhom.length ? byNhom.slice(0, 7).map(([k, n]) => (
                <div key={k} style={{ marginBottom: 7 }}>
                  <div className="row small" style={{ justifyContent: "space-between", gap: 6, flexWrap: "nowrap" }}><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k}</span><b className="mono">{n}</b></div>
                  <div className="bar-cell"><div className="track"><i style={{ width: `${(n / maxNhom) * 100}%`, background: "var(--c-bad)" }} /></div></div>
                </div>
              )) : <div className="small ok">Không có xe dừng.</div>}
            </div>
          </div>
        </Card>
      </div>

      <Card className="mb" title={`Đang xử lý (${open.length})`} icon={Wrench}
        right={<>
          <MultiSelect prefix="Loại" value={loaiF} onChange={setLoaiF} options={D.loaiList} style={{ width: 190 }} />
          <Search value={q} onChange={setQ} placeholder="Tìm mã xe, tổ, mô tả…" style={{ width: 230 }} />
        </>}>
        {open.length ? (
          <div className="tw">
            <table className="t">
              <thead><tr><th>Mã xe</th><th>Tổ</th><th>Loại</th><th>Nhóm · Mô tả</th><th>Ngày vào</th><th className="n">Ngày</th><th>Dự kiến xong</th><th>Phụ tùng</th><th>PIC</th><th>Cảnh báo</th><th></th></tr></thead>
              <tbody>
                {open.map((e) => {
                  const v = D.vmap[e.ma_xe] || {};
                  return (
                    <tr key={e.id}>
                      <td><button className="ma" onClick={() => openVehicle(e.ma_xe)}>{e.ma_xe}</button></td>
                      <td>{shortTo(v.to_xe)}</td>
                      <td><Badge tone={LOAI_TONE[e.loai]}>{e.loai}</Badge></td>
                      <td className="wrap"><b>{e.nhom}</b>{e.mo_ta && <div className="small mute">{e.mo_ta}</div>}</td>
                      <td>{vn(e.ngay_vao)}</td>
                      <td className="n">{diffDays(e.ngay_vao, D.today)}</td>
                      <td>{canWrite ? <DateInput className="inp sm" value={e.ngay_du_kien} min={e.ngay_vao} onChange={(x) => upd(e.id, { ngay_du_kien: x || null }, "Đã cập nhật ngày dự kiến")} style={{ width: 130 }} /> : vn(e.ngay_du_kien)}</td>
                      <td>{canWrite ? <Select className="inp sm" value={e.phu_tung} onChange={(x) => upd(e.id, { phu_tung: x || null }, "Đã cập nhật phụ tùng")} options={D.meta.pt || []} blank="—" style={{ width: 130 }} /> : e.phu_tung}</td>
                      <td>{e.pic}</td>
                      <td><div className="row" style={{ gap: 4 }}>{D.flags(e).map((f) => <Badge key={f.k} tone={f.tone} plain>{f.label}</Badge>)}</div></td>
                      <td>
                        <div className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
                          {canWrite && <button className="btn sm ok" onClick={() => upd(e.id, { ngay_xong: D.today }, `Xe ${e.ma_xe} đã hoàn thành`)}><CheckCircle2 size={13} />Hoàn thành</button>}
                          {isAdmin && <button className="btn sm ghost danger icon" title="Xóa sự kiện" onClick={() => del(e)}><Trash2 size={13} /></button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <Empty>{q || loaiF.length ? "Không tìm thấy sự kiện phù hợp." : "Không có xe nào đang hỏng hoặc bảo dưỡng."}</Empty>}
      </Card>

      <div className="grid g-2">
        <Card title="Hoàn thành gần đây" icon={History} hint={`60 dòng mới nhất · lưu ${T.luu_thang} tháng`}>
          {closed.length ? (
            <div className="tw short">
              <table className="t">
                <thead><tr><th>Mã xe</th><th>Loại</th><th>Nhóm</th><th>Vào</th><th>Xong</th><th className="n">Ngày</th><th></th></tr></thead>
                <tbody>{closed.map((e) => (
                  <tr key={e.id}>
                    <td><button className="ma" onClick={() => openVehicle(e.ma_xe)}>{e.ma_xe}</button></td>
                    <td><Badge tone={LOAI_TONE[e.loai]} plain>{e.loai}</Badge></td><td>{e.nhom}</td>
                    <td>{vn(e.ngay_vao)}</td><td>{vn(e.ngay_xong)}</td><td className="n">{diffDays(e.ngay_vao, e.ngay_xong)}</td>
                    <td>{canWrite && <button className="btn sm ghost" onClick={() => upd(e.id, { ngay_xong: null }, "Đã mở lại sự kiện")}><RotateCcw size={13} />Mở lại</button>}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <Empty />}
        </Card>

      </div>
    </>
  );
}

// Mã xe sẵn sàng theo tổ (hiển thị ở Điều độ chung): chip màu theo tình trạng, bấm để mở chi tiết xe
export function MaXeSanSang({ doi = [] }) {
  const { D, openVehicle } = useApp();
  const [showAll, setShowAll] = useState(false);
  const T = D.T;
  const vsDoi = D.vehicles.filter((v) => !doi.length || doi.includes(v.doi));
  const sum = D.summarize(vsDoi);
  return (
    <Card className="mb" title={`Mã xe sẵn sàng · ${sum.ready}/${sum.tong}`} icon={ListChecks}
      right={<>
        <span className="legend">
          <span><i style={{ background: "var(--c-ok)" }} />Sẵn sàng</span><span><i style={{ background: "var(--c-info)" }} />BD định kỳ</span>
          {showAll && <><span><i style={{ background: "var(--c-bad)" }} />Hỏng</span><span><i style={{ background: "var(--c-warn)" }} />BD chiến lược</span></>}
        </span>
        <Seg value={showAll ? "all" : "ready"} onChange={(v) => setShowAll(v === "all")} options={[["ready", "Chỉ xe sẵn sàng"], ["all", "Tất cả xe"]]} />
      </>}>
      <div className="scroll-y" style={{ "--h": "330px" }}>
        <div className="to-grid">
          {[...D.toList, ""].map((to) => {
            const vs = vsDoi.filter((v) => (v.to_xe || "") === to);
            if (!vs.length) return null;
            const ready = vs.filter((v) => D.isReady(v.ma));
            const list = showAll ? vs : ready;
            return (
              <div className="to-block" key={to || "(trống)"}>
                <div className="to-head">
                  <b>{to || "(Chưa có tổ)"}</b>
                  <Badge tone={rateTone(ready.length / vs.length, T)} plain>{ready.length}/{vs.length}</Badge>
                  <span className="small mute">Đi ca {ready.filter((v) => v.che_do === "Đi ca").length} · HC {ready.filter((v) => v.che_do === "HC").length}</span>
                </div>
                <div className="chips">
                  {list.map((v) => (
                    <button key={v.ma} className={"chip s-" + D.stateOf(v.ma)} onClick={() => openVehicle(v.ma)} title={`${v.model || ""} · ${v.che_do}`}>
                      <i />{v.ma}{v.che_do === "HC" && <span className="hc">HC</span>}
                    </button>
                  ))}
                  {!list.length && <span className="small bad">Không có xe sẵn sàng</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

// ---------- Thiết bị gắn: đếm theo loại (tổng, hỏng, sẵn sàng), không theo dõi mã từng chiếc ----------
const DUNG_CHO = ["Xúc đào", "Cẩu cảng", "Khác"];
function ThietBiGan({ tab }) {
  const { D, api, run, canWrite, isAdmin } = useApp();
  const [loc, setLoc] = useState("");
  const [sua, setSua] = useState(null); // {} = thêm, dòng = sửa
  const ds = D.tbGanSl;
  const T = D.T;
  const hien = (ds || []).filter((x) => !loc || (x.dung_cho || "Khác") === loc);
  const tong = hien.reduce((s, x) => s + (+x.tong || 0), 0), hong = hien.reduce((s, x) => s + Math.min(+x.hong || 0, +x.tong || 0), 0);
  // Xúc đào đang lắp loại thiết bị gắn này (danh mục xe)
  const dangLap = (ten) => D.vehicles.filter((v) => v.doi === "Xúc đào" && v.thiet_bi_gan === ten).length;
  const luuSo = (x, k, val) => { const n = Math.max(0, Math.round(+val || 0)); if (n !== (+x[k] || 0)) run(() => api.saveTbGanSl({ id: x.id, [k]: n }), `Đã cập nhật ${x.ten}`); };
  return (
    <>
      <div className="page-h">
        <div>
          <h1>Tình trạng & sự kiện · Thiết bị gắn</h1>
          <div className="sub">Nhóp, mâm từ, búa, gầu ngoạm… theo dõi theo loại: sẵn sàng = tổng − hỏng. Cột "Dùng cho" tách thiết bị gắn của xúc đào, cẩu cảng.</div>
        </div>
        <div className="tools">{tab}</div>
      </div>
      {ds == null ? (
        <div className="card"><div className="alert warn"><Database size={16} /><span>Chưa có bảng thiết bị gắn: quản trị cần chạy <b className="mono">sql/20_thiet_bi_gan_so_luong.sql</b> trong Supabase rồi tải lại trang.</span></div></div>
      ) : (
        <Card title={`Thiết bị gắn (${hien.length} loại)`} icon={Wrench}
          right={<>
            <Seg value={loc} onChange={setLoc} options={[["", "Tất cả"], ...DUNG_CHO.map((x) => [x, x])]} />
            {canWrite && <button className="btn sm pri" onClick={() => setSua({})}><Plus size={14} />Thêm loại</button>}
          </>}>
          <div className="row mb" style={{ gap: 18 }}>
            <span>Tổng <b className="mono">{tong}</b></span><span className="bad">Hỏng <b className="mono">{hong}</b></span>
            <span className="ok">Sẵn sàng <b className="mono">{tong - hong}</b></span>
            <Badge tone={rateTone(tong ? (tong - hong) / tong : 1, T)} plain>SS {pct(tong ? (tong - hong) / tong : 1, 1)}</Badge>
          </div>
          {hien.length ? (
            <div className="tw">
              <table className="t">
                <thead><tr><th>Loại thiết bị gắn</th><th>Dùng cho</th><th className="n">Tổng</th><th className="n">Hỏng</th><th className="n">Sẵn sàng</th><th>Tỷ lệ sẵn sàng</th><th className="n" title="Số xúc đào đang lắp loại này (danh mục xe)">Xúc đào đang lắp</th><th>Ghi chú</th>{canWrite && <th className="act"></th>}</tr></thead>
                <tbody>{hien.map((x) => {
                  const h = Math.min(+x.hong || 0, +x.tong || 0), ss = (+x.tong || 0) - h, tl = x.tong ? ss / x.tong : null;
                  return (
                    <tr key={x.id}>
                      <td><b>{x.ten}</b></td>
                      <td><Badge tone={x.dung_cho === "Cẩu cảng" ? "info" : x.dung_cho === "Xúc đào" ? "accent" : ""} plain>{x.dung_cho || "Khác"}</Badge></td>
                      <td className="n">{canWrite ? <input key={`t${x.id}-${x.tong}`} className="inp sm num mono" type="number" min={0} defaultValue={x.tong} style={{ width: 70 }} onBlur={(e) => luuSo(x, "tong", e.target.value)} /> : x.tong}</td>
                      <td className="n">{canWrite ? <input key={`h${x.id}-${x.hong}`} className="inp sm num mono" type="number" min={0} defaultValue={x.hong} style={{ width: 70 }} onBlur={(e) => luuSo(x, "hong", e.target.value)} /> : <span className={h ? "bad" : ""}>{x.hong}</span>}</td>
                      <td className="n"><b className={ss ? "ok" : "bad"}>{ss}</b></td>
                      <td style={{ minWidth: 140 }}>{tl != null ? <div className="bar-cell"><div className="track"><i style={{ width: `${tl * 100}%`, background: tl < 0.8 ? "var(--c-bad)" : "var(--c-ok)" }} /></div><span className="small mono">{pct(tl, 0)}</span></div> : <span className="mute">—</span>}</td>
                      <td className="n">{x.dung_cho === "Xúc đào" ? dangLap(x.ten) : <span className="mute">—</span>}</td>
                      <td className="wrap small">{x.ghi_chu}</td>
                      {canWrite && <td className="act"><div className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
                        <button className="btn sm" onClick={() => setSua(x)}><Pencil size={13} />Sửa</button>
                        {isAdmin && <ConfirmButton onConfirm={() => run(() => api.deleteTbGanSl(x.id), `Đã xóa ${x.ten}`)} title={`Xóa ${x.ten}`} />}
                      </div></td>}
                    </tr>);
                })}</tbody>
              </table>
            </div>
          ) : <Empty>Chưa có loại thiết bị gắn nào{loc ? ` dùng cho ${loc}` : ""}. Bấm "Thêm loại" để khai báo.</Empty>}
          <div className="small mute" style={{ marginTop: 8 }}>Sửa số Tổng / Hỏng ngay trên bảng (lưu khi rời ô). Danh sách loại thiết bị gắn để chọn cho xe xúc đào nằm ở Danh mục › Thiết bị cơ giới › Thiết bị gắn.</div>
        </Card>
      )}
      {sua && <TbGanDialog x={sua} onClose={() => setSua(null)} />}
    </>
  );
}

function TbGanDialog({ x, onClose }) {
  const { D, api, run } = useApp();
  const moi = !x.id;
  const [f, setF] = useState({ ten: x.ten || "", dung_cho: x.dung_cho || "Xúc đào", tong: x.tong ?? 0, hong: x.hong ?? 0, ghi_chu: x.ghi_chu || "" });
  const set = (k) => (e) => setF((o) => ({ ...o, [k]: e?.target ? e.target.value : e }));
  const goiY = [...new Set([...(D.thietBiGanList || []), "Mâm từ", "Gầu ngoạm", "Móc C", "Ngáng / cáp vải", "Nhóp", "Búa"])];
  const luu = async () => {
    const ten = f.ten.trim();
    if (!ten) return alert("Nhập tên loại thiết bị gắn");
    const tong = Math.max(0, Math.round(+f.tong || 0)), hong = Math.max(0, Math.round(+f.hong || 0));
    if (hong > tong) return alert("Số hỏng lớn hơn tổng");
    const rec = { ...(moi ? { thu_tu: (D.tbGanSl || []).length } : { id: x.id }), ten, dung_cho: f.dung_cho || null, tong, hong, ghi_chu: f.ghi_chu.trim() || null };
    if (await run(() => api.saveTbGanSl(rec), moi ? `Đã thêm ${ten}` : `Đã lưu ${ten}`)) onClose();
  };
  return (
    <Modal title={moi ? "Thêm loại thiết bị gắn" : `Sửa ${x.ten}`} onClose={onClose} width={560}
      footer={<><button className="btn" onClick={onClose}>Hủy</button><button className="btn pri" onClick={luu}>Lưu</button></>}>
      <div className="form-grid">
        <Field label="Loại thiết bị gắn *" className="wide"><input className="inp" list="dl-tbg" value={f.ten} onChange={set("ten")} placeholder="VD: Mâm từ" /><datalist id="dl-tbg">{goiY.map((t) => <option key={t} value={t} />)}</datalist></Field>
        <Field label="Dùng cho"><Select value={f.dung_cho} onChange={set("dung_cho")} options={DUNG_CHO} /></Field>
        <Field label="Tổng"><input className="inp num" type="number" min={0} value={f.tong} onChange={set("tong")} /></Field>
        <Field label="Hỏng"><input className="inp num" type="number" min={0} value={f.hong} onChange={set("hong")} /></Field>
        <Field label="Ghi chú" className="wide"><input className="inp" value={f.ghi_chu} onChange={set("ghi_chu")} /></Field>
      </div>
    </Modal>
  );
}
