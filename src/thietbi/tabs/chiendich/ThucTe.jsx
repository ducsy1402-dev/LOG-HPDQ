import { useMemo, useState } from "react";
import { ClipboardList, BarChart3, Save, Download, Info, Flag, Target, Layers, TrendingUp } from "lucide-react";
import EChart from "@/components/EChart";
import { useApp } from "../../store";
import { Card, Seg, Kpi, Empty } from "../../components/ui";
import { bangCa, tomTat, TEN_UU_TIEN, TEN_NUT_THAT, gioLamCa } from "../../lib/chienDich";
import { fmt } from "../../lib/utils";
import { OSo, ngayGio, ngayVN, gio, tan, thoiLuong } from "./chung";

const H = 3600e3;

export default function ThucTe({ cd, kq, thucTe, taiLai, chiXem, sua }) {
  const { api, toast, fail } = useApp();
  const [tid, setTid] = useState("all");
  const [nhap, setNhap] = useState({}); // key "ngay|ca|tuyen" → {khoi_luong, so_chuyen, so_xe, ghi_chu}
  const [dangLuu, setDangLuu] = useState(false);
  const [now] = useState(() => Date.now());
  const t = cd.tuyen.find((x) => x.id === tid) || null;
  const rows = useMemo(() => bangCa(kq, thucTe, t?.id || null, now), [kq, thucTe, t, now]);
  const tongKL = t ? +t.khoi_luong || 0 : kq.tongKL;
  const tom = useMemo(() => tomTat(kq, rows, tongKL, now), [kq, rows, tongKL, now]);
  const ketThucKH = t ? kq.tuyen.find((x) => x.t.id === t.id)?.mp?.ketThuc : kq.ketThuc;
  const soSua = Object.keys(nhap).length;
  const choNhap = !!t && !chiXem && !!cd.id;

  const giaTri = (r, k) => {
    const key = `${r.ngay}|${r.so}|${t.id}`;
    if (nhap[key] && k in nhap[key]) return nhap[key][k];
    const d = r.dong[0];
    return d ? d[k] ?? null : null;
  };
  const datGT = (r, k, v) => setNhap((m) => {
    const key = `${r.ngay}|${r.so}|${t.id}`, d = r.dong[0] || {};
    const cu = m[key] || { khoi_luong: d.khoi_luong ?? null, so_chuyen: d.so_chuyen ?? null, so_xe: d.so_xe ?? null, ghi_chu: d.ghi_chu ?? "" };
    return { ...m, [key]: { ...cu, [k]: v } };
  });
  const luu = async () => {
    setDangLuu(true);
    try {
      const ds = Object.entries(nhap).map(([key, v]) => { const [ngay, ca, tuyen_id] = key.split("|"); return { chien_dich_id: cd.id, tuyen_id, ngay, ca: +ca, khoi_luong: v.khoi_luong, so_chuyen: v.so_chuyen == null ? null : Math.round(v.so_chuyen), so_xe: v.so_xe == null ? null : Math.round(v.so_xe), ghi_chu: v.ghi_chu || null }; });
      await api.luuThucTeCD(ds);
      setNhap({}); await taiLai(); toast(`Đã lưu thực tế ${ds.length} ca`);
    } catch (e) { fail(e); } finally { setDangLuu(false); }
  };

  const option = useMemo(() => {
    const ds = rows.filter((r) => r.kh > 0 || r.tt != null);
    if (!ds.length) return null;
    return {
      tooltip: { trigger: "axis", valueFormatter: (v) => (v == null ? "–" : `${tan(v)} t`) },
      legend: { top: 0 },
      grid: { left: 10, right: 10, top: 34, bottom: 4, containLabel: true },
      xAxis: { type: "category", data: ds.map((r) => `CA ${r.so} ${ngayVN(r.ngay)}`) },
      yAxis: [{ type: "value", name: "t/ca", axisLabel: { formatter: (v) => tan(v) } }, { type: "value", name: "lũy kế", splitLine: { show: false }, axisLabel: { formatter: (v) => tan(v) } }],
      series: [
        { type: "bar", name: "Kế hoạch ca", data: ds.map((r) => r.kh), itemStyle: { color: "#6366f1" }, barMaxWidth: 26 },
        { type: "bar", name: "Thực tế ca", data: ds.map((r) => r.tt), itemStyle: { color: "#f59e0b" }, barMaxWidth: 26 },
        { type: "line", name: "Lũy kế kế hoạch", yAxisIndex: 1, data: ds.map((r) => r.lkKH), itemStyle: { color: "#818cf8" }, lineStyle: { type: "dashed" }, smooth: false },
        { type: "line", name: "Lũy kế thực tế", yAxisIndex: 1, data: ds.map((r) => (r.s <= now || r.tt != null ? r.lkTT : null)), itemStyle: { color: "#f97316" }, smooth: false },
      ],
    };
  }, [rows, now]);

  return (
    <>
      <div className="row mb">
        <Seg value={tid} onChange={(v) => { if (soSua && !confirm("Có số chưa lưu. Bỏ để chuyển tuyến?")) return; setNhap({}); setTid(v); }} options={[["all", "Cả chiến dịch"], ...cd.tuyen.map((x) => [x.id, x.ten])]} />
        <span style={{ flex: 1 }} />
        <button type="button" className="btn sm" onClick={() => xuatExcel(cd, kq, thucTe).catch(fail)}><Download size={14} /> Xuất Excel báo cáo</button>
      </div>

      <div className="grid g-kpi mb">
        <Kpi icon={Target} label="Kế hoạch tới nay" value={tan(tom.khDenNay)} unit="t" foot={`${fmt(tom.pctKH * 100, 1)}% tổng ${tan(tongKL)} t`} />
        <Kpi icon={Layers} label="Thực tế lũy kế" value={tan(tom.tt)} unit="t" foot={`${fmt(tom.pct * 100, 1)}% · còn ${tan(tom.con)} t`} meter={tom.pct} tone={tom.pct >= 1 ? "ok" : ""} />
        <Kpi icon={TrendingUp} label="Chênh lệch so kế hoạch" value={(tom.chenh >= 0 ? "+" : "") + tan(tom.chenh)} unit="t" tone={tom.soCaTT ? (tom.chenh >= 0 ? "ok" : tom.chenh > -0.05 * tongKL ? "warn" : "bad") : ""} foot={tom.caCuoiTT ? `${tom.chenh >= 0 ? "vượt" : "chậm"} kế hoạch tới hết CA ${tom.caCuoiTT.so} ${ngayVN(tom.caCuoiTT.ngay)}` : "chưa nhập thực tế"} />
        <Kpi icon={BarChart3} label="Nhịp thực tế" value={tom.nhip ? tan(tom.nhip) : "–"} unit="t/ca" foot={tom.soCaTT ? `bình quân ${tom.soCaTT} ca đã nhập` : "chưa nhập thực tế"} />
        <Kpi icon={Flag} label="Dự báo xong (theo nhịp thực tế)" value={tom.duBao ? ngayGio(tom.duBao) : "–"} tone={tom.treKH == null ? "" : tom.treKH > H ? "bad" : "ok"}
          foot={tom.duBao && ketThucKH ? (Math.abs(tom.duBao - ketThucKH) < H ? "đúng kế hoạch" : tom.duBao > ketThucKH ? `trễ ${thoiLuong((tom.duBao - ketThucKH) / H)} so kế hoạch` : `sớm ${thoiLuong((ketThucKH - tom.duBao) / H)} so kế hoạch`) : `kế hoạch xong ${ngayGio(ketThucKH)}`} />
      </div>

      {option && <Card className="mb" title="Kế hoạch – thực tế theo ca" icon={BarChart3}><EChart option={option} height={300} /></Card>}

      <Card className="mb" title={t ? `Nhập thực tế · ${t.ten}` : "Thực tế theo ca · cả chiến dịch"} icon={ClipboardList}
        hint={t ? "nhập khối lượng dỡ xong trong ca; xóa hết số của ca = xóa" : "chọn một tuyến ở trên để nhập số"}
        right={choNhap && <button type="button" className="btn sm pri" disabled={!soSua || dangLuu} onClick={luu}><Save size={14} /> {dangLuu ? "Đang lưu…" : `Lưu thực tế${soSua ? ` (${soSua})` : ""}`}</button>}>
        {!cd.id && <div className="alert info mb"><Info size={15} /><span>Lưu chiến dịch trước rồi mới nhập được thực tế.</span></div>}
        {sua && cd.id && <div className="alert warn mb"><Info size={15} /><span>Chiến dịch có thay đổi chưa lưu: kế hoạch theo ca đang tính theo số đang sửa.</span></div>}
        {rows.length ? (
          <div className="tw">
            <table className="t compact cd-tt">
              <thead><tr>
                <th>Ca</th><th className="n">KH (t)</th><th className="n">KH chuyến</th><th className="n">KH xe</th>
                <th className="n">TT (t)</th><th className="n">TT chuyến</th><th className="n">TT xe</th>
                <th className="n">Chênh (t)</th><th className="n">Đạt</th><th className="n">Lũy kế KH</th><th className="n">Lũy kế TT</th>{t && <th>Ghi chú</th>}
              </tr></thead>
              <tbody>{rows.map((r) => {
                const moO = choNhap && r.s <= now;
                const tt = t ? giaTri(r, "khoi_luong") : r.tt;
                const chenh = tt == null ? null : tt - r.kh;
                return (
                  <tr key={r.key} className={r.dangChay ? "cd-dong-chon" : ""}>
                    <td><b>CA {r.so}</b> {ngayVN(r.ngay)} <span className="small mute">{gio(r.s)}–{gio(r.e)}</span>{r.dangChay && <span className="badge b-ok plain" style={{ marginLeft: 6 }}>đang chạy</span>}</td>
                    <td className="n">{r.kh ? tan(r.kh) : <span className="mute">–</span>}</td>
                    <td className="n mute">{r.khChuyen || "–"}</td>
                    <td className="n mute">{r.khXe || "–"}</td>
                    {t ? <>
                      <td className="n">{moO ? <OSo value={giaTri(r, "khoi_luong")} w={80} onChange={(v) => datGT(r, "khoi_luong", v)} /> : tan(tt) || <span className="mute">–</span>}</td>
                      <td className="n">{moO ? <OSo value={giaTri(r, "so_chuyen")} w={56} onChange={(v) => datGT(r, "so_chuyen", v)} /> : giaTri(r, "so_chuyen") ?? <span className="mute">–</span>}</td>
                      <td className="n">{moO ? <OSo value={giaTri(r, "so_xe")} w={48} onChange={(v) => datGT(r, "so_xe", v)} /> : giaTri(r, "so_xe") ?? <span className="mute">–</span>}</td>
                    </> : <>
                      <td className="n">{r.tt == null ? <span className="mute">–</span> : tan(r.tt)}</td>
                      <td className="n">{r.ttChuyen ?? <span className="mute">–</span>}</td>
                      <td className="n">{r.ttXe ?? <span className="mute">–</span>}</td>
                    </>}
                    <td className={"n " + (chenh == null ? "" : chenh >= 0 ? "ok" : "bad")}>{chenh == null ? "" : (chenh >= 0 ? "+" : "") + tan(chenh)}</td>
                    <td className="n">{tt != null && r.kh ? `${fmt((tt / r.kh) * 100, 0)}%` : ""}</td>
                    <td className="n mute">{tan(r.lkKH)}</td>
                    <td className="n">{r.s <= now || r.tt != null ? tan(r.lkTT) : ""}</td>
                    {t && <td>{moO ? <input className="inp sm" style={{ width: 160 }} value={giaTri(r, "ghi_chu") || ""} onChange={(e) => datGT(r, "ghi_chu", e.target.value)} /> : <span className="small">{giaTri(r, "ghi_chu") || ""}</span>}</td>}
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        ) : <Empty>Chưa có ca nào.</Empty>}
      </Card>
    </>
  );
}

// Báo cáo Excel: Tổng hợp (thông số + kết quả từng tuyến), Theo ca (kế hoạch – thực tế), Chuyến xe (kế hoạch từng chuyến), Thực tế (số đã nhập)
async function xuatExcel(cd, kq, thucTe) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const ca = cd.cau_hinh;
  const r2 = (v, d = 2) => (Number.isFinite(v) ? Math.round(v * 10 ** d) / 10 ** d : null);
  const tong = [
    ["Chiến dịch", cd.ten], ["Bắt đầu", ngayGio(+new Date(cd.bat_dau))], ["Dự kiến xong", ngayGio(kq.ketThuc)],
    ["Ca", `${ca.so_ca} ca × ${ca.do_dai} giờ từ ${ca.gio_bd}, ${r2(gioLamCa(ca))} giờ làm định mức / ca`],
    ["Giờ nghỉ", (ca.nghi || []).map((b) => `${b.ten}: sau ${b.sau} giờ, ${b.phut} phút, ${b.kieu === "luan" ? `luân phiên ${b.nhom} nhóm` : "cùng lúc"}`).join("; ")],
    [],
    ["Tuyến", "Hàng", "Điểm xếp", "Điểm dỡ", "Khối lượng (t)", "Tải / chuyến (t)", "Quãng đường (km)", "Tốc độ có hàng", "Tốc độ không tải", "TG phụ (phút)", "Thiết bị xếp", "NS 1 điểm xếp (t/h)", "TG dỡ (phút)", "Xe vun", "NS 1 xe vun (t/h)", "Ưu tiên",
      "Vòng xe (phút)", "Xe vận chuyển", "Điểm xếp", "Điểm dỡ", "Xe vun", "Năng suất (t/h)", "t/ca", "Giãn cách (phút)", "Nút thắt", "Giờ làm", "Số ca", "Số chuyến", "Dự kiến xong"],
    ...kq.tuyen.map(({ t, pa, mp }) => [t.ten, t.hang, t.diem_xep, t.diem_do, t.khoi_luong, t.tai_chuyen, t.quang_duong, t.toc_do_co_hang, t.toc_do_khong_tai, t.tg_phu, t.loai_xep, t.ns_xep, t.tg_do, t.loai_vun, t.ns_vun, TEN_UU_TIEN[t.uu_tien],
      ...(pa.loi ? [pa.loi.join(". ")] : [r2(pa.ly.T * 60, 1), pa.A, pa.Cx, pa.Cd, pa.soXeVun, r2(pa.ns, 1), r2(pa.nsCa, 0), r2(pa.gianCach, 1), TEN_NUT_THAT[pa.nutThat], r2(pa.gio), r2(pa.soCa), pa.soChuyen, mp ? ngayGio(mp.ketThuc) : ""])]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(tong), "Tổng hợp");
  const now = Date.now();
  const caRows = [["Ngày", "Ca", "Từ", "Đến", ...cd.tuyen.flatMap((t) => [`${t.ten} KH (t)`, `${t.ten} TT (t)`]), "Tổng KH (t)", "Tổng TT (t)", "Lũy kế KH", "Lũy kế TT"]];
  const theoT = cd.tuyen.map((t) => Object.fromEntries(bangCa(kq, thucTe, t.id, now).map((r) => [r.key, r])));
  for (const r of bangCa(kq, thucTe, null, now)) caRows.push([ngayVN(r.ngay), r.so, ngayGio(r.s), ngayGio(r.e), ...theoT.flatMap((m) => [r2(m[r.key]?.kh, 2), m[r.key]?.tt ?? null]), r2(r.kh), r.tt, r2(r.lkKH), r2(r.lkTT)]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(caRows), "Theo ca");
  const ch = [["Tuyến", "Xe", "Chuyến", "Khối lượng (t)", "Điểm xếp", "Bắt đầu xếp", "Xếp xong", "Đến điểm dỡ", "Điểm dỡ", "Dỡ xong", "Về tới bãi xếp", "Chờ (phút)"]];
  for (const { t, mp } of kq.tuyen) if (mp) for (const c of mp.chuyen) ch.push([t.ten, c.xe + 1, c.so, r2(c.kl), c.diemXep + 1, ngayGio(c.bd), ngayGio(c.kxep), ngayGio(c.ddi), c.diemDo + 1, ngayGio(c.giao), ngayGio(c.ve), r2(c.doan.filter(([k]) => k === "cho").reduce((s, [, a, b]) => s + (b - a), 0) / 60000, 1)]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ch), "Chuyến xe");
  const ten = Object.fromEntries(cd.tuyen.map((t) => [t.id, t.ten]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Tuyến", "Ngày", "Ca", "Khối lượng (t)", "Số chuyến", "Số xe", "Ghi chú"], ...thucTe.map((r) => [ten[r.tuyen_id] || r.tuyen_id, ngayVN(r.ngay), r.ca, r.khoi_luong, r.so_chuyen, r.so_xe, r.ghi_chu])]), "Thực tế");
  XLSX.writeFile(wb, `Chien_dich_${String(cd.ten).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[^\w]+/g, "_").slice(0, 40)}.xlsx`);
}
