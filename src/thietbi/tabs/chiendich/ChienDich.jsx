import { useCallback, useEffect, useMemo, useState } from "react";
import { Database, Plus, Copy, Save, Undo2, Truck, Route, Gauge, Flag, Shovel, ArrowDownToLine, Layers, Info } from "lucide-react";
import { useApp } from "../../store";
import { Seg, Kpi, ConfirmButton, Empty } from "../../components/ui";
import { chienDichMoi, moPhongCD, TRANG_THAI_CD, maMoi } from "../../lib/chienDich";
import { fmt } from "../../lib/utils";
import { ngayGio, thoiLuong, tan } from "./chung";
import ThongSo from "./ThongSo";
import BieuDoXe from "./BieuDoXe";
import LinetimeKL from "./LinetimeKL";
import ThucTe from "./ThucTe";

// Chiến dịch vận chuyển: nhập khối lượng, quãng đường, tốc độ, năng suất xếp / vun… → web tính số xe, số điểm xếp / dỡ,
// xe vun, giãn cách chạy xe; mô phỏng từng chuyến (biểu đồ chạy xe), linetime khối lượng; nhập thực tế theo ca và báo cáo.
// Lưu ở bảng chien_dich / chien_dich_thuc_te (SQL 17). Công thức ở lib/chienDich.js.
const doc = (k, mac) => { try { return localStorage.getItem(k) || mac; } catch { return mac; } };
const luu = (k, v) => { try { localStorage.setItem(k, v); } catch { /* bỏ qua */ } };
const TAB = [["tinh", "Thông số & tính toán"], ["xe", "Trực tiếp & biểu đồ chạy xe"], ["kl", "Linetime khối lượng"], ["tt", "Thực tế & báo cáo"]];
const clone = (x) => JSON.parse(JSON.stringify(x));
const TEN_TT = Object.fromEntries(TRANG_THAI_CD);
const TONE_TT = { ke_hoach: "info", dang_chay: "ok", xong: "", huy: "bad" };

export default function ChienDich() {
  const { api, canWrite, toast, fail } = useApp();
  const [ds, setDs] = useState(undefined); // undefined: đang tải · null: chưa chạy SQL 17
  const [chon, setChon] = useState(() => doc("qltb-cd-chon", ""));
  const [nhap, setNhap] = useState(null);  // bản đang sửa
  const [sua, setSua] = useState(false);   // có thay đổi chưa lưu
  const [thucTe, setThucTe] = useState([]);
  const [tab, setTab] = useState(() => { const t = doc("qltb-cd-tab", "tinh"); return TAB.some(([k]) => k === t) ? t : "tinh"; });
  const [dangLuu, setDangLuu] = useState(false);

  const taiDs = useCallback(async () => {
    try { const r = await api.docChienDich(); setDs(r); return r; } catch (e) { fail(e); setDs([]); return []; }
  }, [api, fail]);
  useEffect(() => { if (api) taiDs(); }, [api, taiDs]);

  // Chọn chiến dịch: mặc định cái nhớ lần trước, không có thì cái mới nhất
  useEffect(() => {
    if (!ds || sua) return;
    const cd = ds.find((x) => String(x.id) === String(chon)) || ds[0];
    if (!cd) { setNhap(null); return; }
    if (String(cd.id) !== String(chon)) setChon(String(cd.id));
    setNhap(clone(cd));
  }, [ds, chon, sua]);

  const taiTT = useCallback(async (id) => {
    if (!id) { setThucTe([]); return; }
    try { setThucTe(await api.docThucTeCD(id)); } catch (e) { fail(e); }
  }, [api, fail]);
  useEffect(() => { taiTT(nhap?.id); }, [nhap?.id, taiTT]);

  const doi = (fn) => { setNhap((x) => { const y = clone(x); fn(y); return y; }); setSua(true); };
  const chonCD = (id) => {
    if (sua && !confirm("Chiến dịch đang sửa chưa lưu. Bỏ thay đổi để mở chiến dịch khác?")) return;
    setSua(false); setChon(String(id)); luu("qltb-cd-chon", String(id));
  };
  const moi = () => {
    if (sua && !confirm("Chiến dịch đang sửa chưa lưu. Bỏ thay đổi để tạo chiến dịch mới?")) return;
    setNhap(chienDichMoi()); setSua(true); setThucTe([]); setTab("tinh");
  };
  const saoChep = () => {
    const x = clone(nhap); x.id = null; x.ten = nhap.ten + " (bản sao)"; x.trang_thai = "ke_hoach";
    x.tuyen = x.tuyen.map((t) => ({ ...t, id: maMoi() }));
    setNhap(x); setSua(true); setThucTe([]);
    toast("Đã tạo bản sao, bấm Lưu để ghi");
  };
  const huy = () => { setSua(false); if (!nhap?.id) setChon(String(ds?.[0]?.id || "")); };
  const ghi = async () => {
    if (!nhap.ten?.trim()) return toast("Chưa nhập tên chiến dịch", "bad");
    if (!nhap.tuyen?.length) return toast("Chiến dịch cần ít nhất một tuyến", "bad");
    setDangLuu(true);
    try {
      const { id, ten, bat_dau, trang_thai, cau_hinh, tuyen, ghi_chu } = nhap;
      const r = await api.luuChienDich({ id, ten: ten.trim(), bat_dau, trang_thai, cau_hinh, tuyen, ghi_chu });
      setSua(false); setChon(String(r.id)); luu("qltb-cd-chon", String(r.id));
      await taiDs();
      toast("Đã lưu chiến dịch");
    } catch (e) { fail(e); } finally { setDangLuu(false); }
  };
  const xoa = async () => {
    try { await api.xoaChienDich(nhap.id); setSua(false); setChon(""); await taiDs(); toast("Đã xóa chiến dịch"); } catch (e) { fail(e); }
  };

  const kq = useMemo(() => (nhap ? moPhongCD(nhap) : null), [nhap]);

  if (ds === undefined) return <div className="card"><Empty>Đang tải chiến dịch…</Empty></div>;
  if (ds === null) return (
    <div className="card"><div className="alert warn"><Database size={16} /><span>CSDL chưa có bảng Chiến dịch. Quản trị cần chạy file <b className="mono">sql/17_chien_dich.sql</b> trong Supabase › SQL Editor (sau SQL 16), rồi tải lại trang.</span></div></div>
  );

  const chiXem = !canWrite;
  const tuyenOk = kq?.tuyen.filter((x) => x.mp) || [];
  const batDau = nhap ? +new Date(nhap.bat_dau) : null;

  return (
    <>
      <section className="card cd-dau mb">
        <div className="row">
          <select className="inp cd-chon" value={nhap?.id ?? ""} onChange={(e) => chonCD(e.target.value)} disabled={!ds.length}>
            {!nhap?.id && nhap && <option value="">{nhap.ten} (chưa lưu)</option>}
            {ds.map((x) => <option key={x.id} value={x.id}>{x.ten} · {ngayGio(+new Date(x.bat_dau))} · {TEN_TT[x.trang_thai]}</option>)}
          </select>
          {nhap && <span className={"badge b-" + (TONE_TT[nhap.trang_thai] || "")}>{TEN_TT[nhap.trang_thai]}</span>}
          {sua && <span className="badge b-warn">chưa lưu</span>}
          <span style={{ flex: 1 }} />
          {canWrite && <button type="button" className="btn sm" onClick={moi}><Plus size={14} /> Chiến dịch mới</button>}
          {canWrite && nhap?.id && <button type="button" className="btn sm" onClick={saoChep}><Copy size={14} /> Sao chép</button>}
          {canWrite && nhap?.id && !sua && <ConfirmButton onConfirm={xoa} confirmText="Xóa chiến dịch và số thực tế?">Xóa</ConfirmButton>}
          {sua && <button type="button" className="btn sm" onClick={huy}><Undo2 size={14} /> Bỏ thay đổi</button>}
          {canWrite && <button type="button" className="btn sm pri" onClick={ghi} disabled={!sua || dangLuu}><Save size={14} /> {dangLuu ? "Đang lưu…" : "Lưu"}</button>}
        </div>
      </section>

      {!nhap || !kq ? (
        <div className="card"><Empty>{canWrite ? "Chưa có chiến dịch nào. Bấm \"Chiến dịch mới\" để bắt đầu." : "Chưa có chiến dịch nào."}</Empty></div>
      ) : (
        <>
          <div className="grid g-kpi mb">
            <Kpi icon={Layers} label="Khối lượng" value={tan(kq.tongKL)} unit="t" foot={`${nhap.tuyen.length} tuyến · ${fmt(kq.tong.chuyen)} chuyến`} />
            <Kpi icon={Truck} label="Xe vận chuyển" value={kq.tong.xe || "–"} foot={tuyenOk.map((x) => x.pa.A).join(" + ") || "chưa tính được"} />
            <Kpi icon={Shovel} label="Điểm xếp (xe lên hàng)" value={kq.tong.xep || "–"} foot={tuyenOk.map((x) => `${x.pa.Cx} ${x.t.loai_xep?.toLowerCase() || ""}`).join(" · ")} />
            <Kpi icon={ArrowDownToLine} label="Điểm dỡ · xe vun" value={kq.tong.do ? `${kq.tong.do} · ${kq.tong.vun}` : "–"} foot="xe vun / hạ ở điểm dỡ" />
            <Kpi icon={Gauge} label="Năng suất" value={kq.tong.ns ? fmt(kq.tong.ns, 0) : "–"} unit="t/giờ" foot={kq.tong.ns ? `${tan(tuyenOk.reduce((a, x) => a + x.pa.nsCa, 0))} t/ca` : ""} />
            <Kpi icon={Flag} label="Dự kiến xong" value={kq.ketThuc ? ngayGio(kq.ketThuc) : "–"} foot={kq.ketThuc ? `sau ${thoiLuong((kq.ketThuc - batDau) / 3600e3)} kể từ ${ngayGio(batDau)}` : "chưa tính được"} tone={kq.ketThuc ? "ok" : ""} />
          </div>

          {kq.loiCa.length > 0 && <div className="alert bad mb"><Info size={15} /><span>Ca làm việc: {kq.loiCa.join("; ")}.</span></div>}

          <div className="row mb">
            <Seg value={tab} onChange={(v) => { setTab(v); luu("qltb-cd-tab", v); }} options={TAB} />
            {chiXem && <span className="small mute">Chỉ xem: tài khoản không có quyền sửa chiến dịch.</span>}
          </div>

          {tab === "tinh" && <ThongSo cd={nhap} kq={kq} doi={doi} chiXem={chiXem} />}
          {tab === "xe" && <BieuDoXe cd={nhap} kq={kq} thucTe={thucTe} />}
          {tab === "kl" && <LinetimeKL cd={nhap} kq={kq} thucTe={thucTe} />}
          {tab === "tt" && <ThucTe cd={nhap} kq={kq} thucTe={thucTe} taiLai={() => taiTT(nhap.id)} chiXem={chiXem} sua={sua} />}
        </>
      )}
      {!nhap?.id && nhap && <div className="small mute"><Route size={13} /> Chiến dịch mới chưa lưu: bấm Lưu để ghi vào CSDL rồi mới nhập được thực tế.</div>}
    </>
  );
}
