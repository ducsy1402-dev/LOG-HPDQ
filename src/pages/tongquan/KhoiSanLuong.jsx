import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/store";
import EChart from "@/components/EChart";
import { so, pct, r2 } from "@/lib/format";
import { NHOM, tenHuong, tenDonVi, dsDonVi } from "@/lib/sanLuongTT";
import { chuoiKy, tongTheoNhom } from "@/lib/bieuDoSanLuong";
import { khoaKy } from "@/lib/ky";
import { MAU } from "./khung";
import { Khung, ChuaCo, Chon, ChonDs, BangChiTiet, nghin } from "./khungBD";

// Khối 5 biểu đồ sản lượng phía trên Linetime (Tổng quan): chọn kỳ (tuần / tháng / quý / năm) dùng chung.
//  1. Cảng: mục tiêu – thực tế – lũy kế, nhập / xuất      2. Cảng: mục tiêu – lũy kế theo hướng · loại hàng
//  3. Vận tải: mục tiêu – thực tế – lũy kế, phục vụ cảng / sản xuất
//  4. Vận tải phục vụ cảng theo đơn vị thực hiện          5. Vận tải phục vụ sản xuất theo đơn vị thực hiện (4, 5 lọc theo đội xe)
// Số liệu từ bảng nhập thực tế theo ca / ngày (SQL 06); mục tiêu tháng chia đều theo ngày.

const MAU_HUONG = { nhap: MAU.info, xuat: MAU.tim, phuc_vu_cang: MAU.info, phuc_vu_san_xuat: "#ec4899" };

// Mục tiêu + sản lượng thực tế của các tháng trong kỳ; null = chưa chạy SQL 06
export function useSanLuongKy(nhom, thangs, kyKhoa, tat = false) {
  const { api, D } = useApp();
  const [kq, setKq] = useState(undefined);
  const khoa = thangs.join(",");
  useEffect(() => {
    if (tat) return undefined;
    let huy = false;
    // Quý / năm có mục tiêu riêng (SQL 10) thì dùng; chưa chạy SQL 10 hoặc chưa nhập thì cộng các tháng như trước
    Promise.all([Promise.all(khoa.split(",").map((t) => api.docSanLuongThang(nhom, t))), kyKhoa ? api.docMucTieuKy(nhom, kyKhoa).catch(() => null) : null])
      .then(([rs, rieng]) => { if (!huy) setKq(rs.some((r) => !r) ? null : { mucTieuKy: rieng || [], mucTieu: rs.flatMap((r, i) => r.mucTieu.map((x) => ({ ...x, thang: x.thang || khoa.split(",")[i] }))), thucTe: rs.flatMap((r) => r.thucTe) }); })
      .catch(() => { if (!huy) setKq(null); });
    return () => { huy = true; };
  }, [api, nhom, khoa, kyKhoa, D, tat]); // D đổi (có người sửa) thì tải lại
  return kq;
}

// Biểu đồ theo điểm của kỳ: cột thực tế (xếp chồng theo hướng), đường mục tiêu từng điểm, đường lũy kế thực tế và lũy kế mục tiêu (trục phải)
function optKy(c, huongs, nhomSL) {
  const cot = huongs.map((h) => ({ name: h ? tenHuong(nhomSL, h) : "Thực tế", type: "bar", stack: "tt", barMaxWidth: 18, itemStyle: { color: MAU_HUONG[h] || MAU.primary, opacity: 0.85 }, data: c.diem.map((o) => o.theo.get(h) ?? 0) }));
  const net = (ten, data, mau, truc) => ({ name: ten, type: "line", yAxisIndex: truc, smooth: false, showSymbol: false, connectNulls: false, data, lineStyle: { width: 2, color: mau, type: ten.includes("mục tiêu") ? "dashed" : "solid" }, itemStyle: { color: mau } });
  return {
    grid: { left: 4, right: 4, top: 34, bottom: 0, containLabel: true },
    legend: { top: 0, itemWidth: 12, itemHeight: 6, icon: "roundRect", textStyle: { fontSize: 10 } },
    tooltip: { valueFormatter: (v) => (v == null ? "—" : `${so(v)} t`) },
    xAxis: { type: "category", data: c.diem.map((o) => o.nhan), axisLabel: { fontSize: 10, hideOverlap: true } },
    yAxis: [
      { type: "value", axisLabel: { fontSize: 10, formatter: nghin } },
      { type: "value", axisLabel: { fontSize: 10, formatter: nghin }, splitLine: { show: false } },
    ],
    series: [
      ...cot,
      { ...net("Mục tiêu từng điểm", c.diem.map((o) => r2(o.mt)), MAU.xam, 0), lineStyle: { width: 1.5, color: MAU.xam, type: "dotted" } },
      net("Lũy kế thực tế", c.diem.map((o) => o.lkTt), MAU.ok, 1),
      net("Lũy kế mục tiêu", c.diem.map((o) => r2(o.lkMt)), MAU.warn, 1),
    ],
  };
}

// Cột ngang so mục tiêu với lũy kế thực hiện của từng nhóm (hướng · loại hàng, hoặc đơn vị thực hiện)
function optNhom(ds) {
  return {
    grid: { left: 4, right: 52, top: 26, bottom: 0, containLabel: true },
    legend: { top: 0, itemWidth: 12, itemHeight: 6, icon: "roundRect", textStyle: { fontSize: 10 } },
    tooltip: { axisPointer: { type: "shadow" }, valueFormatter: (v) => `${so(v)} t` },
    xAxis: { type: "value", axisLabel: { fontSize: 10, formatter: nghin } },
    yAxis: { type: "category", inverse: true, data: ds.map((d) => d.ten), axisLabel: { fontSize: 10, width: 96, overflow: "truncate" } },
    series: [
      { name: "Mục tiêu", type: "bar", barMaxWidth: 10, itemStyle: { color: MAU.xam, opacity: 0.55 }, data: ds.map((d) => r2(d.mt)) },
      { name: "Lũy kế", type: "bar", barMaxWidth: 10, itemStyle: { color: MAU.primary }, label: { show: true, position: "right", fontSize: 10, formatter: (p) => (ds[p.dataIndex].mt ? pct(ds[p.dataIndex].tt / ds[p.dataIndex].mt) : "") }, data: ds.map((d) => r2(d.tt)) },
    ],
  };
}
// Hộp chi tiết: từng điểm của kỳ (mục tiêu, thực tế theo hướng, lũy kế, % đạt lũy kế)
function ctKy(c, huongs, nhomSL, kyInfo) {
  const cot = [[kyInfo.buoc === "thang" ? "Tháng" : kyInfo.buoc === "tuan" ? "Tuần từ" : "Ngày", ""], ["Mục tiêu", "t"], ...huongs.map((h) => [tenHuong(nhomSL, h), "t"]), ["Thực tế", "t"], ["Lũy kế mục tiêu", "t"], ["Lũy kế thực tế", "t"], ["% đạt lũy kế", "%"]];
  const dong = c.diem.map((o) => [o.nhan, o.mt, ...huongs.map((h) => o.theo.get(h) ?? 0), o.tt, o.lkMt, o.lkTt, o.lkTt != null && o.lkMt ? o.lkTt / o.lkMt : null]);
  return { node: <BangChiTiet cot={cot} dong={dong} tong={["Cả kỳ", c.tongMt, ...huongs.map((h) => c.diem.reduce((s, o) => s + (o.theo.get(h) || 0), 0)), c.tongTt, null, null, c.tongMt ? c.tongTt / c.tongMt : null]} /> };
}
// Hộp chi tiết: từng nhóm (mục tiêu cả kỳ, lũy kế, % đạt, còn thiếu)
function ctNhom(ds, tenNhom) {
  const mt = ds.reduce((s, d) => s + d.mt, 0), tt = ds.reduce((s, d) => s + d.tt, 0);
  return { node: <BangChiTiet cot={[[tenNhom, ""], ["Mục tiêu kỳ", "t"], ["Lũy kế", "t"], ["% đạt", "%"], ["Còn thiếu", "t"]]}
    dong={ds.map((d) => [d.ten, d.mt, d.tt, d.mt ? d.tt / d.mt : null, Math.max(0, d.mt - d.tt)])} tong={["Tổng", mt, tt, mt ? tt / mt : null, Math.max(0, mt - tt)]} /> };
}
const chieuCao = (n) => Math.max(180, 56 + n * 34);

function SoLon({ tt, mt }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="font-mono text-2xl font-semibold tabular-nums">{nghin(tt)}</span>
      <span className="text-[11px] text-muted-foreground">{mt ? `/ ${nghin(mt)} t · đạt ${pct(tt / mt)}` : "t · chưa đặt mục tiêu"}</span>
    </div>
  );
}

// Khóa kỳ có mục tiêu riêng (SQL 10): quý "2026-Q4", năm "2026"; tuần / tháng không có
export const khoaKyRieng = (kyInfo) => (kyInfo.ky === "quy" ? khoaKy("quy", new Date(kyInfo.ngays[0] + "T00:00:00").getTime()) : kyInfo.ky === "nam" ? kyInfo.ngays[0].slice(0, 4) : null);

// du: { cang, vt } đã tải sẵn ở trang cha (Tổng quan mới) thì dùng luôn, không tải lại
export default function KhoiSanLuong({ kyInfo, du }) {
  const [huongC, setHuongC] = useState(""), [huongV, setHuongV] = useState(""), [huongH, setHuongH] = useState("");
  const [doiC, setDoiC] = useState(""), [doiS, setDoiS] = useState("");
  const kyKhoa = khoaKyRieng(kyInfo);
  const cang0 = useSanLuongKy("cang", kyInfo.thangs, kyKhoa, !!du), vt0 = useSanLuongKy("van_tai", kyInfo.thangs, kyKhoa, !!du);
  const cang = du ? du.cang : cang0, vt = du ? du.vt : vt0;
  const loadHuong = (nhom) => NHOM[nhom].huong.map(([k]) => k);

  const c1 = useMemo(() => (cang ? chuoiKy(kyInfo, cang, "cang", { loc: (x) => !huongC || x.huong === huongC, chia: (x) => x.huong }) : null), [kyInfo, cang, huongC]);
  const c3 = useMemo(() => (vt ? chuoiKy(kyInfo, vt, "van_tai", { loc: (x) => !huongV || x.huong === huongV, chia: (x) => x.huong }) : null), [kyInfo, vt, huongV]);
  const nhomHang = useMemo(() => {
    if (!cang) return [];
    const m = tongTheoNhom(kyInfo, cang, "cang", (x) => `${x.huong}|${x.loai}`, (x) => !huongH || x.huong === huongH);
    return [...m].map(([k, v]) => { const [h, loai] = k.split("|"); return { ...v, ten: `${tenHuong("cang", h)} · ${loai}`, ord: (h === "nhap" ? 0 : 1) + loai }; }).sort((a, b) => a.ord.localeCompare(b.ord, "vi"));
  }, [kyInfo, cang, huongH]);
  const doiXe = useMemo(() => [...new Set([...(vt?.mucTieu || []), ...(vt?.thucTe || [])].map((r) => r.loai_xe).filter(Boolean))].sort((a, b) => a.localeCompare(b, "vi")), [vt]);
  const theoDonVi = (huong, doi) => {
    if (!vt) return [];
    const m = tongTheoNhom(kyInfo, vt, "van_tai", (x) => x.donVi, (x) => x.huong === huong && (!doi || x.loai === doi));
    // Hòa Phát luôn hiện, rồi từng nhà thầu có mục tiêu / số liệu (Danh mục › Nhà thầu)
    return dsDonVi([], [...m.keys()].sort((a, b) => tenDonVi(a).localeCompare(tenDonVi(b), "vi"))).map(([k]) => ({ ...(m.get(k) || { mt: 0, tt: 0 }), ten: tenDonVi(k) }));
  };
  const dvCang = useMemo(() => theoDonVi("phuc_vu_cang", doiC), [kyInfo, vt, doiC]); // eslint-disable-line react-hooks/exhaustive-deps
  const dvSX = useMemo(() => theoDonVi("phuc_vu_san_xuat", doiS), [kyInfo, vt, doiS]); // eslint-disable-line react-hooks/exhaustive-deps

  const chuaSql = cang === null || vt === null;
  const tai = cang === undefined || vt === undefined;
  const huongList = (nhom, sel, c) => (sel ? [sel] : loadHuong(nhom).filter((h) => c?.nhomChia.includes(h)));
  const boHuong = (nhom, gt, dat) => <Chon gt={gt} dat={dat} ds={[["", "Tổng"], ...NHOM[nhom].huong]} />;
  const tongDV = (ds) => ({ mt: ds.reduce((s, d) => s + d.mt, 0), tt: ds.reduce((s, d) => s + d.tt, 0) });
  const khungDV = (ten, ds, doi, datDoi) => (
    <Khung ten={ten} phu={kyInfo.nhan} chiTiet={{ ...ctNhom(ds, "Đơn vị thực hiện"), description: `${kyInfo.nhan}${doi ? ` · ${doi}` : " · mọi đội xe"}` }} bo={<ChonDs gt={doi} dat={datDoi} ds={doiXe} tatCa="Mọi đội xe" />}>
      <SoLon {...tongDV(ds)} />
      <EChart height={chieuCao(ds.length)} option={optNhom(ds)} />
    </Khung>
  );

  return (
    <div className="grid gap-2.5">
      {chuaSql ? <ChuaCo>Chưa có bảng sản lượng thực tế (chạy sql/06).</ChuaCo>
        : tai ? <ChuaCo>Đang tải sản lượng…</ChuaCo>
        : <>
          <div className="grid gap-2.5 lg:grid-cols-3">
            <Khung ten="Cảng theo loại hàng" phu={`${kyInfo.nhan} · mục tiêu – lũy kế`} chiTiet={ctNhom(nhomHang, "Hướng · loại hàng")} bo={boHuong("cang", huongH, setHuongH)}>
              {nhomHang.length ? <>
                <SoLon {...tongDV(nhomHang)} />
                <EChart height={chieuCao(nhomHang.length)} option={optNhom(nhomHang)} />
              </> : <ChuaCo>Chưa có mục tiêu hay số thực tế trong kỳ.</ChuaCo>}
            </Khung>
            {khungDV("Vận tải phục vụ cảng", dvCang, doiC, setDoiC)}
            {khungDV("Vận tải phục vụ sản xuất", dvSX, doiS, setDoiS)}
          </div>
        </>}
    </div>
  );
}
