import { useState } from "react";
import { Settings2, Coffee, Route, Plus, Trash2, Copy, RotateCcw, AlertTriangle, ChevronDown, ChevronRight, Scale, Target } from "lucide-react";
import { Card, Seg, Select, DateTimeInput, isoToLocal, localToIso } from "../../components/ui";
import {
  UU_TIEN, LOAI_XEP, LOAI_VUN, TRANG_THAI_CD, DON_VI_HAN, TEN_NUT_THAT, TEN_UU_TIEN,
  gioLamCa, soCaNgay, nghiMoi, tuyenMoi, maMoi, thuSoXe, soSanh,
} from "../../lib/chienDich";
import { fmt } from "../../lib/utils";
import { OSo, O, ThanhSD, ngayGio, phut, tan, thoiLuong, MAU_TUYEN } from "./chung";

const p2 = (n) => String(n).padStart(2, "0");
const hhmm = (phutTuNuaDem) => { const m = ((Math.round(phutTuNuaDem) % 1440) + 1440) % 1440; return `${p2(Math.floor(m / 60))}:${p2(m % 60)}`; };

export default function ThongSo({ cd, kq, doi, chiXem }) {
  const ca = cd.cau_hinh;
  const doiCa = (fn) => doi((x) => fn(x.cau_hinh));
  const [hh, mm] = String(ca.gio_bd || "08:00").split(":").map((v) => +v || 0);
  const goc = hh * 60 + mm;
  const nCa = soCaNgay(ca);

  return (
    <>
      <div className="grid g-2 mb">
        <Card title="Thông tin chung" icon={Settings2}>
          <div className="cd-form">
            <O nhan="Tên chiến dịch"><input className="inp sm" value={cd.ten} disabled={chiXem} onChange={(e) => doi((x) => { x.ten = e.target.value; })} style={{ width: "100%" }} /></O>
            <O nhan="Bắt đầu"><DateTimeInput value={isoToLocal(cd.bat_dau)} disabled={chiXem} onChange={(v) => v && doi((x) => { x.bat_dau = localToIso(v); })} className="inp sm" /></O>
            <O nhan="Trạng thái"><Select className="inp sm" value={cd.trang_thai} disabled={chiXem} onChange={(v) => doi((x) => { x.trang_thai = v; })} options={TRANG_THAI_CD} /></O>
            <O nhan="Ghi chú"><input className="inp sm" value={cd.ghi_chu || ""} disabled={chiXem} onChange={(e) => doi((x) => { x.ghi_chu = e.target.value; })} style={{ width: "100%" }} /></O>
          </div>
        </Card>

        <Card title="Ca làm việc & giờ nghỉ" icon={Coffee} hint={`${fmt(gioLamCa(ca), 2)} giờ làm định mức / ca`}>
          <div className="cd-form">
            <O nhan="Ca 1 bắt đầu"><input type="time" className="inp sm" value={ca.gio_bd} disabled={chiXem} onChange={(e) => e.target.value && doiCa((c) => { c.gio_bd = e.target.value; })} /></O>
            <O nhan="Số ca / ngày"><OSo value={ca.so_ca} disabled={chiXem} w={70} onChange={(v) => doiCa((c) => { c.so_ca = Math.max(1, Math.round(v || 1)); })} /></O>
            <O nhan="Độ dài 1 ca" dv="giờ"><OSo value={ca.do_dai} disabled={chiXem} w={70} onChange={(v) => doiCa((c) => { c.do_dai = v || 12; })} /></O>
          </div>
          <div className="small mute" style={{ margin: "6px 0 8px" }}>
            {Array.from({ length: nCa }, (_, k) => `CA ${k + 1}: ${hhmm(goc + k * ca.do_dai * 60)}–${hhmm(goc + (k + 1) * ca.do_dai * 60)}`).join(" · ")}
          </div>
          <div className="tw" style={{ maxHeight: 260 }}>
            <table className="t compact">
              <thead><tr><th>Giờ nghỉ</th><th className="n">Sau đầu ca (giờ)</th><th className="n">Phút</th><th>Kiểu</th><th className="n">Số nhóm</th><th>Giờ nghỉ thực tế</th>{!chiXem && <th />}</tr></thead>
              <tbody>
                {(ca.nghi || []).map((b, i) => {
                  const sua = (fn) => doiCa((c) => fn(c.nghi[i]));
                  const nhom = b.kieu === "luan" ? Math.max(1, +b.nhom || 1) : 1;
                  return (
                    <tr key={b.id || i}>
                      <td><input className="inp sm" value={b.ten || ""} disabled={chiXem} onChange={(e) => sua((x) => { x.ten = e.target.value; })} style={{ width: 130 }} /></td>
                      <td className="n"><OSo value={b.sau} disabled={chiXem} w={64} onChange={(v) => sua((x) => { x.sau = v ?? 0; })} /></td>
                      <td className="n"><OSo value={b.phut} disabled={chiXem} w={60} onChange={(v) => sua((x) => { x.phut = v ?? 0; })} /></td>
                      <td><Select className="inp sm" value={b.kieu} disabled={chiXem} onChange={(v) => sua((x) => { x.kieu = v; })} options={[["cung", "Cùng lúc"], ["luan", "Luân phiên"]]} style={{ width: 110 }} /></td>
                      <td className="n">{b.kieu === "luan" ? <OSo value={b.nhom} disabled={chiXem} w={50} onChange={(v) => sua((x) => { x.nhom = Math.max(1, Math.round(v || 1)); })} /> : <span className="mute">–</span>}</td>
                      <td className="small">
                        {Array.from({ length: nCa }, (_, k) => {
                          const s = goc + k * ca.do_dai * 60 + (+b.sau || 0) * 60;
                          return <div key={k}>CA {k + 1}: {hhmm(s)}–{hhmm(s + (+b.phut || 0) * nhom)}</div>;
                        })}
                        {b.kieu === "luan" && <div className="mute">{nhom} nhóm xe lần lượt nghỉ {b.phut} phút, tuyến vẫn chạy</div>}
                      </td>
                      {!chiXem && <td><button type="button" className="btn ghost icon sm" title="Xóa giờ nghỉ" onClick={() => doiCa((c) => { c.nghi.splice(i, 1); })}><Trash2 size={14} /></button></td>}
                    </tr>
                  );
                })}
                {!ca.nghi?.length && <tr><td colSpan={7} className="mute">Không nghỉ: xe chạy liên tục cả ca.</td></tr>}
              </tbody>
            </table>
          </div>
          {!chiXem && <button type="button" className="btn sm" style={{ marginTop: 8 }} onClick={() => doiCa((c) => { (c.nghi ||= []).push(nghiMoi({ ten: "Nghỉ giữa ca", sau: 8, phut: 15 })); })}><Plus size={14} /> Thêm giờ nghỉ</button>}
          <div className="small mute" style={{ marginTop: 6 }}>Nghỉ cùng lúc: cả tuyến dừng. Nghỉ luân phiên: xe chia nhóm (xe 1 nhóm 1, xe 2 nhóm 2…), nhóm sau nghỉ khi nhóm trước xong.</div>
        </Card>
      </div>

      {cd.tuyen.map((t, i) => (
        <TuyenCard key={t.id} t={t} i={i} kq={kq.tuyen[i]} ca={ca} chiXem={chiXem} soTuyen={cd.tuyen.length}
          doiT={(fn) => doi((x) => fn(x.tuyen[i]))}
          xoa={() => doi((x) => { x.tuyen.splice(i, 1); })}
          saoChep={() => doi((x) => { x.tuyen.splice(i + 1, 0, { ...JSON.parse(JSON.stringify(t)), id: maMoi(), ten: t.ten + " (bản sao)" }); })} />
      ))}
      {!chiXem && <button type="button" className="btn" onClick={() => doi((x) => { x.tuyen.push(tuyenMoi(x.tuyen.length + 1)); })}><Plus size={15} /> Thêm tuyến</button>}
    </>
  );
}

function TuyenCard({ t, i, kq, ca, chiXem, doiT, xoa, saoChep, soTuyen }) {
  const set = (k) => (v) => doiT((x) => { x[k] = v; });
  const setTxt = (k) => (e) => doiT((x) => { x[k] = e.target.value; });
  const pa = kq.pa, ly = pa?.ly;
  const [moSS, setMoSS] = useState(false);
  const tXepPhut = t.ns_xep > 0 && t.tai_chuyen > 0 ? (t.tai_chuyen / t.ns_xep) * 60 : null;
  const tChay = t.quang_duong > 0 && t.toc_do_co_hang > 0 && t.toc_do_khong_tai > 0 ? (t.quang_duong / t.toc_do_co_hang + t.quang_duong / t.toc_do_khong_tai) * 60 : null;
  const chonSua = (k) => (v) => doiT((x) => { x.chon = { ...(x.chon || {}), [k]: v ? Math.round(v) : null }; });
  const coSuaTay = !!(t.chon?.so_xe || t.chon?.so_diem_xep || t.chon?.so_diem_do);
  const mau = MAU_TUYEN[i % MAU_TUYEN.length];

  return (
    <Card className="mb cd-tuyen" style={{ "--mau": mau }} title={<><span className="cd-cham" />{t.ten || `Tuyến ${i + 1}`}</>} icon={Route}
      hint={[t.hang, t.diem_xep && t.diem_do ? `${t.diem_xep} → ${t.diem_do}` : ""].filter(Boolean).join(" · ")}
      right={!chiXem && (
        <div className="row" style={{ gap: 6 }}>
          <button type="button" className="btn sm ghost" onClick={saoChep} title="Sao chép tuyến"><Copy size={14} /></button>
          {soTuyen > 1 && <button type="button" className="btn sm ghost danger" onClick={() => confirm(`Xóa ${t.ten}?`) && xoa()} title="Xóa tuyến"><Trash2 size={14} /></button>}
        </div>
      )}>
      <div className="cd-tuyen-b">
        <div className="cd-nhap">
          <h4>Tuyến</h4>
          <div className="cd-form">
            <O nhan="Tên tuyến"><input className="inp sm" value={t.ten} disabled={chiXem} onChange={setTxt("ten")} /></O>
            <O nhan="Hàng"><input className="inp sm" value={t.hang || ""} disabled={chiXem} onChange={setTxt("hang")} /></O>
            <O nhan="Điểm xếp (nơi lấy hàng)"><input className="inp sm" value={t.diem_xep || ""} disabled={chiXem} onChange={setTxt("diem_xep")} /></O>
            <O nhan="Điểm dỡ (nơi hạ hàng)"><input className="inp sm" value={t.diem_do || ""} disabled={chiXem} onChange={setTxt("diem_do")} /></O>
            <O nhan="Khối lượng cần chở" dv="t"><OSo value={t.khoi_luong} disabled={chiXem} w={100} onChange={set("khoi_luong")} /></O>
            <O nhan="Tải 1 chuyến" dv="t/xe"><OSo value={t.tai_chuyen} disabled={chiXem} w={70} onChange={set("tai_chuyen")} /></O>
            <O nhan="Bắt đầu riêng" goiY={t.bat_dau ? "" : "trống = theo chiến dịch"}>
              <DateTimeInput value={isoToLocal(t.bat_dau)} disabled={chiXem} onChange={(v) => doiT((x) => { x.bat_dau = v ? localToIso(v) : null; })} className="inp sm" />
            </O>
          </div>
          <h4>Đường chạy</h4>
          <div className="cd-form">
            <O nhan="Quãng đường 1 chiều" dv="km"><OSo value={t.quang_duong} disabled={chiXem} w={70} onChange={set("quang_duong")} /></O>
            <O nhan="Tốc độ có hàng" dv="km/h"><OSo value={t.toc_do_co_hang} disabled={chiXem} w={60} onChange={set("toc_do_co_hang")} /></O>
            <O nhan="Tốc độ không tải" dv="km/h"><OSo value={t.toc_do_khong_tai} disabled={chiXem} w={60} onChange={set("toc_do_khong_tai")} /></O>
            <O nhan="Thời gian phụ / vòng" dv="phút" goiY="cân xe, quay đầu, thủ tục"><OSo value={t.tg_phu} disabled={chiXem} w={60} onChange={set("tg_phu")} /></O>
          </div>
          {tChay != null && <div className="small mute">Thời gian chạy đi + về: <b>{fmt(tChay, 1)} phút</b></div>}
          <h4>Điểm xếp · Điểm dỡ</h4>
          <div className="cd-form">
            <O nhan="Thiết bị xếp"><Select className="inp sm" value={t.loai_xep} disabled={chiXem} onChange={set("loai_xep")} options={LOAI_XEP} /></O>
            <O nhan="Năng suất 1 điểm xếp" dv="t/giờ" goiY={tXepPhut != null ? `≈ ${fmt(tXepPhut, 1)} phút xếp 1 xe` : ""}><OSo value={t.ns_xep} disabled={chiXem} w={70} onChange={set("ns_xep")} /></O>
            <O nhan="Thời gian dỡ 1 xe" dv="phút" goiY="vào điểm, nâng ben, ra"><OSo value={t.tg_do} disabled={chiXem} w={60} onChange={set("tg_do")} /></O>
            <O nhan="Xe vun / hạ ở điểm dỡ"><Select className="inp sm" value={t.loai_vun} disabled={chiXem} onChange={set("loai_vun")} options={LOAI_VUN} /></O>
            <O nhan="Năng suất 1 xe vun" dv="t/giờ" goiY="trống = không tính xe vun"><OSo value={t.ns_vun} disabled={chiXem} w={70} onChange={set("ns_vun")} /></O>
          </div>
          <h4>Ưu tiên tính theo</h4>
          <Seg value={t.uu_tien} onChange={(v) => !chiXem && doiT((x) => { x.uu_tien = v; x.chon = { so_xe: null, so_diem_xep: null, so_diem_do: null }; })} options={UU_TIEN.map(([k, l]) => [k, l])} />
          <div className="small mute" style={{ margin: "6px 0" }}>{UU_TIEN.find(([k]) => k === t.uu_tien)?.[2]}</div>
          <div className="cd-form">
            {t.uu_tien === "do" && <O nhan="Số điểm dỡ" dv="điểm"><OSo value={t.so_diem_do} disabled={chiXem} w={60} onChange={set("so_diem_do")} /></O>}
            {t.uu_tien === "xep" && <O nhan="Số điểm xếp" dv="điểm"><OSo value={t.so_diem_xep} disabled={chiXem} w={60} onChange={set("so_diem_xep")} /></O>}
            {t.uu_tien === "xe" && <O nhan="Số xe vận chuyển" dv="xe"><OSo value={t.so_xe} disabled={chiXem} w={60} onChange={set("so_xe")} /></O>}
            {t.uu_tien === "tg" && <>
              <O nhan="Hoàn thành trong"><OSo value={t.thoi_han} disabled={chiXem} w={70} onChange={set("thoi_han")} /></O>
              <O nhan="Đơn vị"><Select className="inp sm" value={t.don_vi_han} disabled={chiXem} onChange={set("don_vi_han")} options={DON_VI_HAN} /></O>
            </>}
          </div>
        </div>

        <div className="cd-kq">
          {pa?.loi ? (
            <div className="alert warn"><AlertTriangle size={15} /><span>{pa.loi.join(". ")}.</span></div>
          ) : (
            <>
              <div className="tw">
                <table className="t compact cd-bang-kq">
                  <thead><tr><th>Kết quả</th><th className="n" title="Đúng công thức file Excel, số lẻ">Lý thuyết</th><th className="n" title="Số nguyên áp dụng: web làm tròn lên, sửa tay được">Áp dụng</th></tr></thead>
                  <tbody>
                    <DongSo nhan="Xe vận chuyển" ly={ly.A} v={pa.A} tu={pa.tuDong.A} co={t.chon?.so_xe} onChange={chonSua("so_xe")} codinh={t.uu_tien === "xe"} chiXem={chiXem} dv="xe" />
                    <DongSo nhan={`Điểm xếp · ${t.loai_xep?.toLowerCase()}`} ly={ly.Cx} v={pa.Cx} tu={pa.tuDong.Cx} co={t.chon?.so_diem_xep} onChange={chonSua("so_diem_xep")} codinh={t.uu_tien === "xep"} chiXem={chiXem} dv="điểm" />
                    <DongSo nhan="Điểm dỡ" ly={ly.Cd} v={pa.Cd} tu={pa.tuDong.Cd} co={t.chon?.so_diem_do} onChange={chonSua("so_diem_do")} codinh={t.uu_tien === "do"} chiXem={chiXem} dv="điểm" />
                    <tr><td>Xe vun · {t.loai_vun?.toLowerCase()}</td><td className="n mute">{t.ns_vun > 0 ? fmt(ly.ns / t.ns_vun, 2) : "–"}</td><td className="n"><b>{pa.soXeVun ?? "–"}</b> <span className="mute small">xe</span></td></tr>
                    <tr><td>Năng suất tuyến</td><td className="n mute">{fmt(ly.ns, 1)}</td><td className="n"><b>{fmt(pa.ns, 1)}</b> <span className="mute small">t/giờ</span></td></tr>
                  </tbody>
                </table>
              </div>
              {coSuaTay && !chiXem && <button type="button" className="btn sm ghost" onClick={() => doiT((x) => { x.chon = { so_xe: null, so_diem_xep: null, so_diem_do: null }; })}><RotateCcw size={13} /> Trả về số tự động</button>}

              <div className="cd-chiso">
                <div><span>Vòng xe</span><b>{phut(ly.T)} phút</b><small>chạy {phut(ly.tChay)} · xếp {phut(ly.tXep)} · dỡ {phut(ly.tDo)}{ly.tPhu ? ` · phụ ${phut(ly.tPhu)}` : ""}</small></div>
                <div><span>Giãn cách chạy xe</span><b>{fmt(pa.gianCach, 1)} phút</b><small>tại 1 điểm xếp {fmt(pa.gcXep, 1)} · tại 1 điểm dỡ {fmt(pa.gcDo, 1)} phút</small></div>
                <div><span>Năng suất</span><b>{tan(pa.nsCa)} t/ca</b><small>{tan(pa.nsNgay)} t/ngày · {fmt(pa.chuyenXeCa, 1)} chuyến / xe / ca</small></div>
                <div><span>Thời gian làm</span><b>{thoiLuong(pa.gio)}</b><small>{fmt(pa.soCa, 2)} ca · {fmt(pa.soNgay, 2)} ngày định mức · {fmt(pa.soChuyen)} chuyến</small></div>
                <div><span>Dự kiến xong</span><b>{kq.mp ? ngayGio(kq.mp.ketThuc) : "–"}</b><small>theo mô phỏng từng chuyến, có giờ nghỉ</small></div>
                {t.uu_tien === "tg" && <div className={pa.datHan ? "" : "cd-loi"}><span><Target size={12} /> Thời hạn</span><b>{pa.datHan ? "Đạt" : "Không đạt"}</b><small>cần {thoiLuong(pa.gio)} / hạn {thoiLuong(pa.hanGio)} giờ làm</small></div>}
              </div>

              <div className="cd-nutthat">
                <Scale size={14} />
                <span>Nút thắt: <b>{TEN_NUT_THAT[pa.nutThat]}</b>.{" "}
                  {pa.cho > 1 / 600 ? <>Mỗi vòng xe chờ khoảng <b>{phut(pa.cho)} phút</b>{pa.nutThat === "do" ? " ở điểm dỡ" : pa.nutThat === "xep" ? " ở điểm xếp" : ""}: có thể bớt xe hoặc thêm điểm {pa.nutThat === "do" ? "dỡ" : "xếp"}.</> : "Xe chạy liên tục, không phải chờ."}
                </span>
              </div>
              <ThanhSD nhan="Xe vận chuyển" v={pa.suDung.xe} />
              <ThanhSD nhan="Điểm xếp" v={pa.suDung.xep} />
              <ThanhSD nhan="Điểm dỡ" v={pa.suDung.do} />

              <ThuSoXe t={t} ca={ca} pa={pa} />

              <button type="button" className="btn sm ghost" style={{ marginTop: 8 }} onClick={() => setMoSS(!moSS)}>{moSS ? <ChevronDown size={14} /> : <ChevronRight size={14} />} So sánh 4 trường hợp ưu tiên</button>
              {moSS && <SoSanh t={t} ca={ca} />}
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

function DongSo({ nhan, ly, v, tu, co, onChange, codinh, chiXem, dv }) {
  return (
    <tr>
      <td>{nhan}{codinh && <span className="badge b-info plain" style={{ marginLeft: 6 }}>cố định</span>}</td>
      <td className="n mute">{fmt(ly, 2)}</td>
      <td className="n">
        {codinh || chiXem ? <b>{v}</b> : <OSo value={co ?? null} placeholder={String(tu)} w={54} className={co ? "cd-tay" : ""} title={`Trống = tự làm tròn (${tu})`} onChange={onChange} />}
        {" "}<span className="mute small">{dv}</span>
      </td>
    </tr>
  );
}

function ThuSoXe({ t, ca, pa }) {
  const ds = thuSoXe(t, ca, pa);
  if (!ds.length) return null;
  const best = Math.max(...ds.map((x) => x.ns));
  return (
    <div style={{ marginTop: 10 }}>
      <div className="small mute" style={{ marginBottom: 4 }}>Thử số xe (giữ {pa.Cx} điểm xếp, {pa.Cd} điểm dỡ)</div>
      <div className="tw">
        <table className="t compact">
          <thead><tr><th className="n">Số xe</th><th className="n">t/giờ</th><th className="n">Giờ làm cần</th><th className="n">Chờ / vòng</th><th>Nút thắt</th></tr></thead>
          <tbody>{ds.map((x) => (
            <tr key={x.A} className={x.A === pa.A ? "cd-dong-chon" : ""}>
              <td className="n"><b>{x.A}</b></td>
              <td className={"n " + (x.ns >= best - 1e-6 ? "ok" : "")}>{fmt(x.ns, 0)}</td>
              <td className="n">{thoiLuong(x.gio)}</td>
              <td className="n">{x.cho > 1 / 600 ? `${phut(x.cho)} ph` : "–"}</td>
              <td>{TEN_NUT_THAT[x.nutThat]}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

function SoSanh({ t, ca }) {
  const ds = soSanh(t, ca);
  const dong = [
    ["Xe vận chuyển", (p) => p.A], ["Điểm xếp", (p) => p.Cx], ["Điểm dỡ", (p) => p.Cd], ["Xe vun", (p) => p.soXeVun ?? "–"],
    ["Năng suất (t/giờ)", (p) => fmt(p.ns, 0)], ["Giãn cách (phút)", (p) => fmt(p.gianCach, 1)], ["Thời gian làm", (p) => thoiLuong(p.gio)], ["Nút thắt", (p) => TEN_NUT_THAT[p.nutThat]],
  ];
  return (
    <div className="tw" style={{ marginTop: 6 }}>
      <table className="t compact">
        <thead><tr><th />{ds.map(({ u }) => <th key={u} className={"n " + (u === t.uu_tien ? "accent" : "")}>{TEN_UU_TIEN[u]}</th>)}</tr></thead>
        <tbody>{dong.map(([l, f]) => (
          <tr key={l}><td>{l}</td>{ds.map(({ u, pa }) => <td key={u} className="n">{pa.loi ? <span className="mute" title={pa.loi.join(". ")}>thiếu số</span> : f(pa)}</td>)}</tr>
        ))}</tbody>
      </table>
      <div className="small mute" style={{ marginTop: 4 }}>Mỗi cột dùng số cố định của trường hợp đó (số điểm dỡ, số điểm xếp, số xe, thời hạn đã nhập), các số còn lại web tự làm tròn lên.</div>
    </div>
  );
}
