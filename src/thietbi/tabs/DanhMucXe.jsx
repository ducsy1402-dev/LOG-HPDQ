import { useState } from "react";
import { Database, Plus, Upload, Pencil, Download, Check, X, Trash2 } from "lucide-react";
import { useApp } from "../store";
import { Card, Search, Badge, StateBadge, MultiSelect, ConfirmButton, Select } from "../components/ui";
import { VehicleForm, RenameToDialog, banGhiXe } from "../components/VehicleDrawer";
import ImportDialog from "../components/ImportDialog";
import { matchQ, shortTo } from "../lib/utils";
import { downloadTemplate } from "../lib/excel";
import { useChonNhieu, OTickTieuDe, OTick, ThanhChon } from "../components/chonNhieu";
import { useCotThem } from "../components/cotThemTB";

// Danh mục phương tiện (xe, cẩu…) – chuyển từ tab Tình trạng & sự kiện sang mục Danh mục của web chung.
// Bấm mã để xem chi tiết xe. Quản trị: Sửa / Xóa từng dòng hoặc tick chọn nhiều dòng rồi xóa một lần, Import, Thêm xe, Đổi tên tổ. Ai cũng Xuất Excel được.
export default function DanhMucXe() {
  const { D, sua: coQuyen, openVehicle, api, run, fail } = useApp();
  const isAdmin = coQuyen("dm_thiet_bi");
  const [dang, setDang] = useState(null); // mã xe đang SỬA TẠI DÒNG (bút chì, như các bảng danh mục khác)
  const [fd, setFd] = useState(null);
  const [doi, setDoi] = useState([]);
  const [qDm, setQDm] = useState("");
  const [ttDm, setTtDm] = useState([]);
  const [tbgDm, setTbgDm] = useState([]);
  const [addXe, setAddXe] = useState(false);
  const [doiTen, setDoiTen] = useState(false);
  const [imp, setImp] = useState(false);
  const has = (arr, x) => !arr.length || arr.includes(x);
  const onImport = () => setImp(true);
  const dm = D.vehicles.filter((v) => has(doi, v.doi) && (!ttDm.length || ttDm.includes(D.taiTrongOf(v))) && (!tbgDm.length || tbgDm.includes(D.thietBiGanOf(v))) && matchQ(qDm, v.ma, v.model, v.to_xe, v.doi, v.che_do, v.tai_trong));
  const coXeNang = has(doi, "Xe nâng") && D.vehicles.some((v) => v.doi === "Xe nâng");
  const coXucDao = has(doi, "Xúc đào") && D.vehicles.some((v) => v.doi === "Xúc đào");
  const c = useChonNhieu();
  const ct = useCotThem("xe", [["ma", "Mã xe"], ["doi", "Đội xe"], ["model", "Model"], ["to_xe", "Tổ"], ["che_do", "Chế độ"], ["xuong", "Xưởng"], ["he_so", "Hệ số làm việc"], ["tai_trong", "Tải trọng"], ["thiet_bi_gan", "Thiết bị gắn"], ["ghi_chu", "Ghi chú"]]);
  const coXuong = D.vehicles.some((v) => "xuong" in v); // SQL 08: xưởng, hệ số làm việc
  const keys = dm.map((v) => v.ma);
  const models = [...new Set([...D.vehicles.map((x) => x.model), ...D.specs.map((x) => x.model)].filter(Boolean))].sort();
  const bat = (v) => { setDang(v.ma); setFd({ ...v, tai_trong: v.tai_trong || "", thiet_bi_gan: v.thiet_bi_gan || "", them: { ...(v.them || {}) } }); };
  const huy = () => { setDang(null); setFd(null); };
  const luu = async () => {
    const { rec, loi } = banGhiXe(fd, { D, ct, coXuong, moi: false });
    if (loi) return fail(new Error(loi));
    if (await run(() => api.upsertVehicles([rec]), `Đã cập nhật ${rec.ma}`)) huy();
  };
  const dat = (k) => (x) => setFd((o) => ({ ...o, [k]: x?.target ? x.target.value : x }));
  const phim = (e) => { if (e.key === "Enter") { e.preventDefault(); luu(); } else if (e.key === "Escape") huy(); };
  return (
    <>
        <Card title={`Danh mục xe (${dm.length})`} icon={Database}
          right={<>
            <MultiSelect prefix="Đội" value={doi} onChange={setDoi} options={D.doiList} style={{ width: 200 }} />
            {coXeNang && <MultiSelect prefix="Tải trọng" value={ttDm} onChange={setTtDm} options={[...D.taiTrongList, "Chưa phân loại"]} style={{ width: 190 }} />}
            {coXucDao && <MultiSelect prefix="TB gắn" value={tbgDm} onChange={setTbgDm} options={[...D.thietBiGanList, "Chưa khai báo"]} style={{ width: 190 }} />}
            <Search value={qDm} onChange={setQDm} placeholder="Mã, model, tổ…" style={{ width: 180 }} />
            <button className="btn sm" onClick={() => downloadTemplate("vehicles", D).catch(fail)}><Download size={14} />Xuất Excel</button>
            {isAdmin && <button className="btn sm" onClick={onImport}><Upload size={14} />Import</button>}
            {isAdmin && ct.nut}
            {isAdmin && <button className="btn sm" onClick={() => setDoiTen(true)}><Pencil size={14} />Đổi tên tổ</button>}
            {isAdmin && <button className="btn sm pri" onClick={() => setAddXe(true)}><Plus size={14} />Thêm xe</button>}
          </>}>
          {isAdmin && <ThanhChon c={c} keys={keys} onXoa={(mas) => run(() => api.deleteVehicles(mas), `Đã xóa ${mas.length} xe`)} />}
          <div className="tw short">
            <table className="t">
              <thead><tr>{isAdmin && <OTickTieuDe c={c} keys={keys} />}<th>Mã xe</th><th>Đội</th><th>Model</th><th>Tải trọng · TB gắn</th><th>Tổ</th><th>Chế độ</th>{coXuong && <><th>Xưởng</th><th className="n">Hệ số</th></>}{ct.th}<th>Tình trạng</th>{isAdmin && <th className="act"></th>}</tr></thead>
              <tbody>{dm.map((v) => (v.ma === dang && fd ? (
                <tr key={v.ma} style={{ background: "color-mix(in srgb, var(--accent, #6366f1) 10%, transparent)" }} onKeyDown={phim}>
                  {isAdmin && <td />}
                  <td><span className="ma" style={{ cursor: "default" }}>{v.ma}</span></td>
                  <td><Select value={fd.doi} onChange={dat("doi")} options={D.doiList} style={{ minWidth: 110 }} /></td>
                  <td><input className="inp sm" list="dl-model-dm" value={fd.model || ""} onChange={dat("model")} style={{ minWidth: 150 }} /><datalist id="dl-model-dm">{models.map((x) => <option key={x} value={x} />)}</datalist></td>
                  <td>{fd.doi === "Xe nâng" ? <Select value={fd.tai_trong} onChange={dat("tai_trong")} options={D.taiTrongList} blank="— chọn —" style={{ minWidth: 90 }} /> : fd.doi === "Xúc đào" ? <Select value={fd.thiet_bi_gan} onChange={dat("thiet_bi_gan")} options={[...new Set([...D.thietBiGanList, fd.thiet_bi_gan].filter(Boolean))]} blank="— chưa khai báo —" style={{ minWidth: 130 }} /> : ""}</td>
                  <td><input className="inp sm" list="dl-to-dm" value={fd.to_xe || ""} onChange={dat("to_xe")} style={{ minWidth: 130 }} /><datalist id="dl-to-dm">{D.toList.map((x) => <option key={x} value={x} />)}</datalist></td>
                  <td><Select value={fd.che_do} onChange={dat("che_do")} options={D.meta.cheDo || ["Đi ca", "HC"]} style={{ minWidth: 80 }} /></td>
                  {coXuong && <><td><input className="inp sm" value={fd.xuong || ""} onChange={dat("xuong")} style={{ minWidth: 90 }} /></td><td className="n"><input className="inp sm num" inputMode="decimal" value={fd.he_so ?? ""} onChange={dat("he_so")} style={{ width: 64 }} /></td></>}
                  {ct.cot.map((c) => <td key={c.ma} className={c.loai === "so" ? "n" : undefined}>{c.loai === "bool"
                    ? <input type="checkbox" checked={!!fd.them?.[c.ma]} onChange={(e) => setFd((o) => ({ ...o, them: { ...(o.them || {}), [c.ma]: e.target.checked } }))} />
                    : <input className={"inp sm" + (c.loai === "so" ? " num" : "")} inputMode={c.loai === "so" ? "decimal" : undefined} value={fd.them?.[c.ma] ?? ""} onChange={(e) => setFd((o) => ({ ...o, them: { ...(o.them || {}), [c.ma]: e.target.value } }))} style={{ minWidth: 90 }} />}</td>)}
                  <td><StateBadge s={D.stateOf(v.ma)} /></td>
                  <td className="act"><div className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
                    <button className="btn sm pri" onClick={luu} title="Lưu dòng (Enter)" aria-label="Lưu dòng"><Check size={13} /></button>
                    <button className="btn sm" onClick={huy} title="Hủy sửa (Esc)" aria-label="Hủy sửa"><X size={13} /></button>
                  </div></td>
                </tr>
              ) : (
                <tr key={v.ma}>
                  {isAdmin && <OTick c={c} k={v.ma} />}
                  <td><button className="ma" onClick={() => openVehicle(v.ma)}>{v.ma}</button></td>
                  <td>{v.doi}</td><td>{v.model}</td><td>{D.taiTrongOf(v) ? <Badge tone={v.tai_trong ? "info" : "warn"} plain>{D.taiTrongOf(v)}</Badge> : D.thietBiGanOf(v) ? <Badge tone={v.thiet_bi_gan ? "accent" : ""} plain>{D.thietBiGanOf(v)}</Badge> : ""}</td><td>{shortTo(v.to_xe)}</td><td>{v.che_do}</td>{coXuong && <><td>{v.xuong}</td><td className="n">{v.he_so ?? ""}</td></>}{ct.td(v)}<td><StateBadge s={D.stateOf(v.ma)} /></td>
                  {isAdmin && <td className="act"><div className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
                    <button className="btn sm" onClick={() => bat(v)} title="Sửa tại dòng" aria-label={`Sửa ${v.ma}`}><Pencil size={13} /></button>
                    <ConfirmButton onConfirm={() => run(() => api.deleteVehicle(v.ma), `Đã xóa ${v.ma}`)} title={`Xóa ${v.ma} khỏi danh mục`} confirmText="Xóa?"><Trash2 size={13} /></ConfirmButton>
                  </div></td>}
                </tr>
              )))}</tbody>
            </table>
          </div>
        </Card>
      {addXe && <VehicleForm onClose={() => setAddXe(false)} />}
      {doiTen && <RenameToDialog onClose={() => setDoiTen(false)} />}
      {imp && <ImportDialog kind="vehicles" onClose={() => setImp(false)} />}
      {ct.hop}
    </>
  );
}
