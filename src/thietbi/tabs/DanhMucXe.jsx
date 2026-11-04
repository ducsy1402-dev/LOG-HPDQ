import { useState } from "react";
import { Database, Plus, Upload, Pencil, Download } from "lucide-react";
import { useApp } from "../store";
import { Card, Search, Badge, StateBadge, MultiSelect, ConfirmButton } from "../components/ui";
import { VehicleForm, RenameToDialog } from "../components/VehicleDrawer";
import ImportDialog from "../components/ImportDialog";
import { matchQ, shortTo } from "../lib/utils";
import { downloadTemplate } from "../lib/excel";
import { useChonNhieu, OTickTieuDe, OTick, ThanhChon } from "../components/chonNhieu";
import { useCotThem } from "../components/cotThemTB";

// Danh mục phương tiện (xe, cẩu…) – chuyển từ tab Tình trạng & sự kiện sang mục Danh mục của web chung.
// Bấm mã để xem chi tiết xe. Quản trị: Sửa / Xóa từng dòng hoặc tick chọn nhiều dòng rồi xóa một lần, Import, Thêm xe, Đổi tên tổ. Ai cũng Xuất Excel được.
export default function DanhMucXe() {
  const { D, isAdmin, openVehicle, api, run, fail } = useApp();
  const [sua, setSua] = useState(null);
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
              <tbody>{dm.map((v) => (
                <tr key={v.ma}>
                  {isAdmin && <OTick c={c} k={v.ma} />}
                  <td><button className="ma" onClick={() => openVehicle(v.ma)}>{v.ma}</button></td>
                  <td>{v.doi}</td><td>{v.model}</td><td>{D.taiTrongOf(v) ? <Badge tone={v.tai_trong ? "info" : "warn"} plain>{D.taiTrongOf(v)}</Badge> : D.thietBiGanOf(v) ? <Badge tone={v.thiet_bi_gan ? "accent" : ""} plain>{D.thietBiGanOf(v)}</Badge> : ""}</td><td>{shortTo(v.to_xe)}</td><td>{v.che_do}</td>{coXuong && <><td>{v.xuong}</td><td className="n">{v.he_so ?? ""}</td></>}{ct.td(v)}<td><StateBadge s={D.stateOf(v.ma)} /></td>
                  {isAdmin && <td className="act"><div className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
                    <button className="btn sm" onClick={() => setSua(v)}><Pencil size={13} />Sửa</button>
                    <ConfirmButton onConfirm={() => run(() => api.deleteVehicle(v.ma), `Đã xóa ${v.ma}`)} title={`Xóa ${v.ma} khỏi danh mục`} />
                  </div></td>}
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Card>
      {addXe && <VehicleForm onClose={() => setAddXe(false)} />}
      {sua && <VehicleForm v={sua} onClose={() => setSua(null)} />}
      {doiTen && <RenameToDialog onClose={() => setDoiTen(false)} />}
      {imp && <ImportDialog kind="vehicles" onClose={() => setImp(false)} />}
      {ct.hop}
    </>
  );
}
