import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Plus, Save, X, RefreshCw } from "lucide-react";
import { useApp } from "@/store";
import { Card, CardContent } from "@/components/ui/card";
import { Input, NativeSelect } from "@/components/ui/input";
import { ChonGo } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/common";
import { so, soGon, pct, tenThang, congThang } from "@/lib/format";
import { khoangKy, thangTrongKy, tenKy } from "@/lib/ky";
import { docSo } from "@/lib/paste";
import { cn } from "@/lib/utils";
import { tinhThang, khoaLoai } from "@/lib/sanLuong";
import { DON_VI, NHOM, tenDonVi, dsDonVi, khoaDong, khoaCua, tuDb, ngayCuaThang, tongTheoCot, khopDoiXe } from "@/lib/sanLuongTT";

import { DEFAULT_NHA_THAU } from "@/thietbi/lib/plan";

// Đơn vị thực hiện để chọn: Hòa Phát + các nhà thầu đang dùng trong Danh mục › Nhà thầu (+ đơn vị đã có số liệu)
function useDonVi(daCo) {
  const tb = useThietBi()?.D;
  return useMemo(() => dsDonVi((tb?.nhaThau?.list?.length ? tb.nhaThau.list : DEFAULT_NHA_THAU).filter((x) => x.dang_dung !== false).map((x) => x.ten), daCo), [tb, daCo]);
}

const tenKyThuong = (kyLoai, ky) => (kyLoai === "thang" ? tenThang(ky) : tenKy(kyLoai, ky)).toLowerCase();
import { useThietBi } from "@/thietbi/Host";
import { useNhomHang } from "./useNhomHang";

const THU = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const fmt = (n) => (n == null ? "" : soGon(n));

// Một tab của Khai thác Cảng › Mục tiêu sản lượng (nhom = "cang" | "van_tai"): bảng mục tiêu tháng và bảng nhập thực tế theo ca / ngày.
// Tab vận tải có thêm cột Loại hàng (nhóm hàng như bên cảng) và bộ lọc đội xe (Xe ben, Xe đầu kéo, Xe bồn…) áp cho cả hai bảng.
// Dữ liệu của tháng đang chọn tải riêng từ Supabase (SQL 06); sau mỗi lần lưu tải lại.
export default function SanLuongTab({ nhom, thang, kyLoai = "thang" }) {
  const { api } = useApp();
  const [lan, setLan] = useState(0);
  const [kq, setKq] = useState(undefined); // undefined: đang tải · null: chưa chạy SQL · { mucTieu, thucTe }
  const [doiXe, setDoiXe] = useState(""); // bộ lọc đội xe (vận tải); "" = tất cả
  const tai = useCallback(() => setLan((x) => x + 1), []);
  useEffect(() => {
    let huy = false;
    const dau = `${kyLoai}|${thang}`; // đánh dấu số liệu thuộc kỳ nào: đổi kỳ thì chờ tải xong, không dùng số liệu của kỳ trước
    if (kyLoai === "thang") api.docSanLuongThang(nhom, thang).then((r) => { if (!huy) setKq(r && { ...r, dau }); }).catch(() => { if (!huy) setKq(null); });
    else {
      // Quý / năm: mục tiêu riêng của kỳ (SQL 10) + mục tiêu và sản lượng thực tế của từng tháng trong kỳ
      const { tu, den } = khoangKy(kyLoai, thang), ts = thangTrongKy(tu, den).map((x) => x.thang);
      Promise.all([api.docMucTieuKy(nhom, thang), ...ts.map((t) => api.docSanLuongThang(nhom, t))])
        .then(([rieng, ...rs]) => { if (!huy) setKq(rieng == null || rs.some((r) => !r) ? null : { dau, mucTieu: rieng, thucTe: rs.flatMap((r) => r.thucTe), mucTieuThang: rs.flatMap((r) => r.mucTieu), thangs: ts }); })
        .catch(() => { if (!huy) setKq(null); });
    }
    return () => { huy = true; };
  }, [api, nhom, thang, kyLoai, lan]);
  const loaiDaCo = useMemo(() => (nhom === "van_tai" && kq ? [...kq.mucTieu, ...kq.thucTe].map((r) => r.loai_xe) : []), [nhom, kq]);
  const dsDoiXe = useLoaiGoiY("van_tai", loaiDaCo);
  if (kq === null) return <div className="rounded-md border border-warn/40 bg-warn/5 px-3 py-2 text-sm">Chưa có bảng sản lượng: quản trị cần chạy <b>sql/06_san_luong_thuc_te.sql</b>{kyLoai !== "thang" && <> và <b>sql/10_muc_tieu_quy_nam.sql</b></>} trong Supabase (sau 01 … 04).</div>;
  if (kq === undefined || (kq && kq.dau !== `${kyLoai}|${thang}`)) return <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><RefreshCw className="h-4 w-4 animate-spin" />Đang tải số liệu {tenKyThuong(kyLoai, thang)}…</div>;
  const loc = nhom === "van_tai" ? (r) => khopDoiXe(r, doiXe) : () => true;
  return (
    <div className="grid gap-4">
      {nhom === "van_tai" && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Đội xe</span>
          <NativeSelect className="h-8 w-48" value={doiXe} onChange={(e) => setDoiXe(e.target.value)} options={[["", "Tất cả đội xe"], ...dsDoiXe.map((x) => [x, x])]} aria-label="Lọc theo đội xe" />
          {doiXe && <Button size="sm" variant="ghost" onClick={() => setDoiXe("")}><X />Bỏ lọc</Button>}
          {doiXe && <span className="text-xs text-muted-foreground">Cả hai bảng chỉ hiện {doiXe}; tổng và % Đạt tính theo đội xe đang lọc.</span>}
        </div>)}
      <Card><CardContent className="pt-4"><BangMucTieu key={`mt-${nhom}-${kyLoai}-${thang}-${lan}`} nhom={nhom} thang={thang} kyLoai={kyLoai} mucTieu={kq.mucTieu} mucTieuThang={kq.mucTieuThang} thucTe={kq.thucTe} loc={loc} onLuu={tai} /></CardContent></Card>
      <Card><CardContent className="pt-4">{kyLoai === "thang"
        ? <BangThucTe key={`tt-${nhom}-${thang}-${lan}`} nhom={nhom} thang={thang} mucTieu={kq.mucTieu} thucTe={kq.thucTe} loc={loc} onLuu={tai} />
        : <BangTheoThang nhom={nhom} kyLoai={kyLoai} ky={thang} thangs={kq.thangs} mucTieu={kq.mucTieu} thucTe={kq.thucTe} loc={loc} />}</CardContent></Card>
    </div>
  );
}

// Danh sách gợi ý loại hàng (cảng: nhóm hàng trong Danh mục) hoặc loại xe / đội xe (vận tải: đội xe trong Thiết bị cơ giới)
function useLoaiGoiY(nhom, daCo) {
  const { D } = useApp();
  const tb = useThietBi()?.D;
  return useMemo(() => {
    if (nhom === "van_tai") {
      const doi = (tb?.vehicles || []).map((x) => x.doi).filter((d) => d && d !== "Cẩu");
      return [...new Set(["Xe ben", "Xe đầu kéo", "Xe bồn", ...doi, ...daCo])].sort((a, b) => a.localeCompare(b, "vi"));
    }
    const nhomDM = [...new Set((tb?.hanghoa || []).map((h) => String(h.nhom ?? "").trim()).filter(Boolean))];
    return [...new Set(nhomDM.length ? [...nhomDM, ...daCo] : [...daCo, ...(D.mucTieu || []).map((m) => m.loai_hang)].filter((x) => x && x !== "(chưa ghi)"))].sort((a, b) => a.localeCompare(b, "vi"));
  }, [nhom, tb, D.mucTieu, daCo]);
}

// ---------- Bảng mục tiêu tháng ----------
function BangMucTieu({ nhom, thang, kyLoai = "thang", mucTieu, mucTieuThang = [], thucTe, loc, onLuu }) {
  const { D, quyen, api, run, toast } = useApp();
  const c = NHOM[nhom], nhomHang = useNhomHang();
  const goc = useMemo(() => Object.fromEntries(mucTieu.map((m) => { const r = tuDb(nhom, m); return [khoaCua(r), { huong: r.huong, loai: r.loai, donVi: r.donVi, hang: r.hang, tan: soGon(r.tan), ghi_chu: r.ghi_chu || "" }]; })), [mucTieu, nhom]);
  const [f, setF] = useState(goc);
  const [xoa, setXoa] = useState(() => new Set());
  const [them, setThem] = useState({});
  const thRows = useMemo(() => thucTe.map((r) => tuDb(nhom, r)), [thucTe, nhom]);
  const th = useMemo(() => tongTheoCot(nhom, thucTe), [nhom, thucTe]);
  const kyMode = kyLoai !== "thang", tenK = tenKyThuong(kyLoai, thang);
  const tau = useMemo(() => (nhom === "cang" && !kyMode ? tinhThang(D, thang, nhomHang) : null), [nhom, D, thang, nhomHang, kyMode]);
  // Quý / năm: tổng mục tiêu các tháng trong kỳ theo từng dòng (để đối chiếu và chép vào mục tiêu của kỳ)
  const tongThang = useMemo(() => { const m = new Map(); for (const x of mucTieuThang) { const r = tuDb(nhom, x), k = khoaCua(r), o = m.get(k) || { huong: r.huong, loai: r.loai, donVi: r.donVi, hang: r.hang, tan: 0 }; o.tan += +r.tan || 0; m.set(k, o); } return m; }, [mucTieuThang, nhom]);
  const goiY = useLoaiGoiY(nhom, useMemo(() => [...new Set(thRows.map((r) => r.loai))], [thRows]));
  const goiYHang = useLoaiGoiY("cang", useMemo(() => [...new Set(thRows.map((r) => r.hang).filter(Boolean))], [thRows]));
  const dsDV = useDonVi(useMemo(() => [...new Set([...thRows, ...mucTieu.map((m) => tuDb(nhom, m))].map((r) => r.donVi).filter(Boolean))], [thRows, mucTieu, nhom]));
  const sua = quyen.quanLy;
  const dong = useMemo(() => { const o = { ...f }; for (const k of xoa) delete o[k]; return o; }, [f, xoa]);
  const rong = { tan: "", ghi_chu: "" };
  const giong = (a, b) => (a?.tan || "").trim() === (b?.tan || "").trim() && (a?.ghi_chu || "").trim() === (b?.ghi_chu || "").trim();
  const daXoa = [...xoa].filter((k) => goc[k]);
  const doi = [...Object.keys(dong).filter((k) => !giong(dong[k], goc[k] || rong)), ...daXoa];
  const dat1 = (k, key, val) => setF({ ...f, [k]: { ...dong[k], [key]: val } });
  const xoaDong = (k) => { setXoa((o) => new Set(o).add(k)); setF((o) => { const n = { ...o }; delete n[k]; return n; }); };
  const themDong = (huong) => {
    const t = them[huong] || {}, loai = (t.loai || "").trim(); if (!loai) return;
    const donVi = c.coDonVi ? t.donVi || DON_VI[0][0] : "", hang = c.coLoaiHang ? (t.hang || "").trim() : "", k = khoaDong(huong, loai, donVi, hang);
    if (!dong[k]) { setF({ ...f, [k]: { huong, loai, donVi, hang, tan: "", ghi_chu: "" } }); setXoa((o) => { const n = new Set(o); n.delete(k); return n; }); }
    setThem({ ...them, [huong]: { ...t, loai: "", hang: "" } });
  };
  const truoc = congThang(thang, -1);
  const [dsTruoc, setDsTruoc] = useState(null);
  useEffect(() => { let huy = false; if (sua && !kyMode) api.docSanLuongThang(nhom, truoc).then((r) => { if (!huy) setDsTruoc(r?.mucTieu || []); }).catch(() => {}); return () => { huy = true; }; }, [api, nhom, truoc, sua, kyMode]);
  const chepTruoc = () => {
    const moi = { ...f };
    if (kyMode) { for (const [k, r] of tongThang) if (!(dong[k]?.tan || "").trim()) moi[k] = { huong: r.huong, loai: r.loai, donVi: r.donVi, hang: r.hang, tan: soGon(r.tan), ghi_chu: dong[k]?.ghi_chu || "" }; }
    else for (const m of dsTruoc || []) { const r = tuDb(nhom, m), k = khoaCua(r); if (!(dong[k]?.tan || "").trim()) moi[k] = { huong: r.huong, loai: r.loai, donVi: r.donVi, hang: r.hang, tan: soGon(r.tan), ghi_chu: dong[k]?.ghi_chu || r.ghi_chu || "" }; }
    setF(moi); setXoa(new Set());
  };
  const luu = async () => {
    const rows = daXoa.map((k) => ({ thang, huong: goc[k].huong, loai: goc[k].loai, donVi: goc[k].donVi, hang: goc[k].hang, tan: null }));
    for (const k of doi.filter((x) => !daXoa.includes(x))) {
      const r = dong[k], txt = r.tan.trim(), tan = txt ? docSo(txt) : null;
      if (txt && !(tan >= 0)) return toast(`${r.loai}: mục tiêu phải là số tấn`, "bad");
      rows.push({ thang, huong: r.huong, loai: r.loai, donVi: r.donVi, hang: r.hang, tan, ghi_chu: r.ghi_chu.trim() || null });
    }
    if (await run(() => (kyMode ? api.saveMucTieuKy(nhom, rows) : api.saveMucTieuNhom(nhom, rows)), `Đã lưu mục tiêu ${tenK} (${rows.length} dòng)`)) onLuu();
  };
  // Tổng theo hướng, chỉ tính các dòng đang hiện (theo bộ lọc đội xe)
  const tongMT = (huong) => Object.values(dong).filter((r) => r.huong === huong && loc(r)).reduce((s, r) => s + (docSo(r.tan) || 0), 0);
  const tongTH = (huong) => thRows.filter((r) => r.huong === huong && loc(r)).reduce((s, r) => s + (+r.tan || 0), 0);
  const tongAll = (fn) => c.huong.reduce((s, [h]) => s + fn(h), 0);
  const soCotPhu = (c.coDonVi ? 1 : 0) + (c.coLoaiHang ? 1 : 0);
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">Mục tiêu {tenK}</h2>
        {sua && kyMode && tongThang.size > 0 && <Button size="sm" variant="outline" onClick={chepTruoc} title="Điền tổng mục tiêu các tháng trong kỳ vào các dòng còn trống"><Copy />Lấy tổng mục tiêu các tháng</Button>}
        {sua && !kyMode && dsTruoc?.length > 0 && <Button size="sm" variant="outline" onClick={chepTruoc} title="Điền mục tiêu tháng trước vào các dòng còn trống"><Copy />Chép mục tiêu {tenThang(truoc).toLowerCase()}</Button>}
        <div className="ml-auto flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {c.huong.map(([h, ten]) => <span key={h}><span className="text-muted-foreground">{ten}</span> <b className="tabular-nums">{so(tongMT(h))}</b></span>)}
          <span><span className="text-muted-foreground">cộng</span> <b className="tabular-nums text-primary">{so(tongAll(tongMT))} t</b></span>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {c.huong.map(([huong, ten]) => {
          const ds = Object.entries(dong).filter(([, r]) => r.huong === huong && loc(r)).sort((a, b) => (docSo(b[1].tan) || 0) - (docSo(a[1].tan) || 0) || a[1].loai.localeCompare(b[1].loai, "vi") || a[1].hang.localeCompare(b[1].hang, "vi"));
          const mtT = tongMT(huong), thT = tongTH(huong), t = them[huong] || {};
          return (
            <div key={huong} className="rounded-md border">
              <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2 text-sm font-semibold">{ten}<span className="ml-auto text-xs font-normal text-muted-foreground">{ds.length} dòng</span></div>
              <div className="scroll-x max-h-[50vh]">
                <table className="tbl text-xs">
                  <thead><tr><th>{c.nhanLoai}</th>{c.coDonVi && <th>Đơn vị</th>}{c.coLoaiHang && <th>Loại hàng</th>}<th className="num">Mục tiêu (t)</th>{kyMode && <th className="num">Σ các tháng</th>}<th className="num">Thực hiện</th><th className="num">Đạt</th><th>Ghi chú</th>{sua && <th className="w-8" />}</tr></thead>
                  <tbody>
                    {ds.map(([k, r]) => {
                      const mt = docSo(r.tan) || 0, tt = th.get(k) || 0, tauT = tau?.theoLoai.get(khoaLoai(huong, r.loai))?.tau;
                      return (
                        <tr key={k} className={cn(doi.includes(k) && "bg-warn/5")}>
                          <td className="whitespace-nowrap font-medium">{r.loai}{tauT > 0 && <div className="text-[11px] font-normal text-muted-foreground">tàu trong tháng {so(tauT)} t</div>}</td>
                          {c.coDonVi && <td className="whitespace-nowrap">{tenDonVi(r.donVi)}</td>}
                          {c.coLoaiHang && <td className="whitespace-nowrap">{r.hang || <span className="text-muted-foreground">Mọi hàng</span>}</td>}
                          <td className="num">{sua ? <Input className="ml-auto h-8 w-28 text-right tabular-nums" inputMode="decimal" value={r.tan} placeholder="—" onChange={(e) => dat1(k, "tan", e.target.value)} aria-label={`Mục tiêu ${r.loai} ${r.hang}`} /> : (r.tan || "—")}</td>
                          {kyMode && <td className="num text-muted-foreground">{tongThang.has(k) ? so(tongThang.get(k).tan) : "—"}</td>}
                          <td className="num">{so(tt)}</td>
                          <td className={cn("num", mt > 0 && tt >= mt && "font-semibold text-ok")}>{mt ? pct(tt / mt) : ""}</td>
                          <td className="min-w-[110px]">{sua ? <Input className="h-8" value={r.ghi_chu} onChange={(e) => dat1(k, "ghi_chu", e.target.value)} aria-label={`Ghi chú ${r.loai} ${r.hang}`} /> : r.ghi_chu}</td>
                          {sua && <td className="w-8"><button type="button" className="rounded p-1 text-muted-foreground hover:text-bad" onClick={() => xoaDong(k)} title={`Xóa dòng ${r.loai}`} aria-label={`Xóa dòng ${r.loai} ${r.hang}`}><X className="h-4 w-4" /></button></td>}
                        </tr>);
                    })}
                    {!ds.length && <tr><td colSpan={(sua ? 6 : 5) + soCotPhu + (kyMode ? 1 : 0)} className="py-4 text-center text-muted-foreground">Chưa có dòng nào. Chọn {c.nhanLoai.toLowerCase()}{c.coLoaiHang ? ", loại hàng" : ""} ở ô bên dưới rồi bấm Thêm, nhập mục tiêu và bấm Lưu.</td></tr>}
                  </tbody>
                  <tfoot><tr className="font-semibold"><td>Tổng</td>{c.coDonVi && <td />}{c.coLoaiHang && <td />}<td className="num">{so(mtT)}</td>{kyMode && <td className="num text-muted-foreground">{so([...tongThang.values()].filter((r) => r.huong === huong && loc(r)).reduce((s, r) => s + r.tan, 0))}</td>}<td className="num">{so(thT)}</td><td className="num">{mtT ? pct(thT / mtT) : ""}</td><td />{sua && <td />}</tr></tfoot>
                </table>
              </div>
              {sua && (
                <div className="flex flex-wrap items-center gap-2 border-t p-2">
                  <ChonGo className="min-w-[170px] flex-1" value={t.loai || ""} onChange={(x) => setThem({ ...them, [huong]: { ...t, loai: x } })} options={goiY} placeholder={`${c.nhanLoai} (chọn hoặc gõ)`} />
                  {c.coLoaiHang && <ChonGo className="min-w-[170px] flex-1" value={t.hang || ""} onChange={(x) => setThem({ ...them, [huong]: { ...t, hang: x } })} options={goiYHang} placeholder="Loại hàng (để trống = mọi hàng)" />}
                  {c.coDonVi && <NativeSelect className="h-9 w-32" value={t.donVi || DON_VI[0][0]} onChange={(e) => setThem({ ...them, [huong]: { ...t, donVi: e.target.value } })} options={dsDV} aria-label="Đơn vị thực hiện" />}
                  <Button size="sm" variant="outline" disabled={!(t.loai || "").trim()} onClick={() => themDong(huong)}><Plus />Thêm</Button>
                </div>)}
            </div>);
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-[11px] text-muted-foreground">{sua ? "Gõ số tấn (vd 400.000). Cột Thực hiện là tổng số đã nhập ở bảng thực tế bên dưới. Xóa số hoặc bấm x là bỏ mục tiêu dòng đó (bấm Lưu mới xóa hẳn). " : "Chỉ Quản lý / Quản trị đặt mục tiêu. Cột Thực hiện là tổng số đã nhập ở bảng thực tế bên dưới. "}{kyMode ? " Mục tiêu quý / năm nhập riêng; dòng nào chưa nhập thì Tổng quan cộng mục tiêu các tháng." : ""}</p>
        {sua && <Button size="sm" disabled={!doi.length} onClick={luu}><Save />Lưu mục tiêu{doi.length ? ` (${doi.length} dòng)` : ""}</Button>}
      </div>
    </div>
  );
}

// ---------- Quý / năm: sản lượng thực tế từng tháng trong kỳ (chỉ xem; nhập số ở chế độ Tháng) ----------
function BangTheoThang({ nhom, kyLoai, ky, thangs, mucTieu, thucTe, loc }) {
  const c = NHOM[nhom];
  const cot = useMemo(() => {
    const m = new Map(), mt = new Map();
    for (const r of mucTieu) { const x = tuDb(nhom, r); m.set(khoaCua(x), { huong: x.huong, loai: x.loai, donVi: x.donVi, hang: x.hang }); mt.set(khoaCua(x), +x.tan || 0); }
    for (const r of thucTe) { const x = tuDb(nhom, r), k = khoaCua(x); if (!m.has(k)) m.set(k, { huong: x.huong, loai: x.loai, donVi: x.donVi, hang: x.hang }); }
    const thuTuHuong = c.huong.map(([h]) => h);
    return [...m.entries()].map(([k, x]) => ({ ...x, k, mt: mt.get(k) || 0 })).filter(loc)
      .sort((a, b) => thuTuHuong.indexOf(a.huong) - thuTuHuong.indexOf(b.huong) || b.mt - a.mt || a.loai.localeCompare(b.loai, "vi") || a.donVi.localeCompare(b.donVi) || a.hang.localeCompare(b.hang, "vi"));
  }, [mucTieu, thucTe, nhom, c.huong, loc]);
  const theoThang = useMemo(() => { const m = new Map(); for (const r of thucTe) { const k = String(r.ngay).slice(0, 7) + "|" + khoaCua(tuDb(nhom, r)); m.set(k, (m.get(k) || 0) + (+r.tan || 0)); } return m; }, [thucTe, nhom]);
  const o = (t, k) => theoThang.get(t + "|" + k) || 0;
  const tongCot = (k) => thangs.reduce((s, t) => s + o(t, k), 0);
  const tongMT = cot.reduce((s, x) => s + x.mt, 0), tongTT = cot.reduce((s, x) => s + tongCot(x.k), 0);
  const nhomCot = c.huong.map(([h, ten]) => ({ h, ten, n: cot.filter((x) => x.huong === h).length })).filter((x) => x.n);
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">Sản lượng thực tế {tenKyThuong(kyLoai, ky)} theo tháng (tấn)</h2>
        <span className="text-xs text-muted-foreground">Cộng từ số nhập theo ngày; muốn nhập hoặc sửa số, chọn chế độ Tháng.</span>
      </div>
      {cot.length ? (
        <div className="scroll-x rounded-md border">
          <table className="tbl text-xs">
            <thead>
              <tr><th rowSpan={2}>Tháng</th>{nhomCot.map((g) => <th key={g.h} colSpan={g.n} className="border-l bg-muted/40 text-center">{g.ten}</th>)}<th rowSpan={2} className="num border-l">Tổng</th></tr>
              <tr>{cot.map((x, i) => (
                <th key={x.k} className={cn("num min-w-[96px]", (i === 0 || cot[i - 1].huong !== x.huong) && "border-l")}>
                  {c.coLoaiHang ? (x.hang || "Mọi hàng") : x.loai}
                  {c.coLoaiHang && <div className="text-[10px] font-normal text-muted-foreground">{x.loai}</div>}
                  {c.coDonVi && <div className="text-[10px] font-normal text-muted-foreground">{tenDonVi(x.donVi)}</div>}
                </th>))}</tr>
            </thead>
            <tbody>
              {thangs.map((t) => (
                <tr key={t}><td className="whitespace-nowrap font-medium">{tenThang(t)}</td>
                  {cot.map((x, j) => <td key={x.k} className={cn("num tabular-nums", (j === 0 || cot[j - 1].huong !== x.huong) && "border-l")}>{o(t, x.k) ? so(o(t, x.k)) : ""}</td>)}
                  <td className="num border-l tabular-nums">{so(cot.reduce((s, x) => s + o(t, x.k), 0))}</td></tr>))}
            </tbody>
            <tfoot>
              <tr className="font-semibold"><td>Cộng {tenKyThuong(kyLoai, ky)}</td>{cot.map((x) => <td key={x.k} className="num tabular-nums">{so(tongCot(x.k))}</td>)}<td className="num border-l tabular-nums">{so(tongTT)}</td></tr>
              <tr><td>Mục tiêu</td>{cot.map((x) => <td key={x.k} className="num tabular-nums">{x.mt ? so(x.mt) : "—"}</td>)}<td className="num border-l tabular-nums">{so(tongMT)}</td></tr>
              <tr className="font-semibold"><td>Đạt</td>{cot.map((x) => { const t = tongCot(x.k); return <td key={x.k} className={cn("num tabular-nums", x.mt > 0 && t >= x.mt && "text-ok")}>{x.mt ? pct(t / x.mt) : ""}</td>; })}<td className="num border-l tabular-nums">{tongMT ? pct(tongTT / tongMT) : ""}</td></tr>
            </tfoot>
          </table>
        </div>
      ) : <Empty>Chưa có mục tiêu hay số thực tế nào trong {tenKyThuong(kyLoai, ky)}. Đặt mục tiêu ở bảng trên.</Empty>}
    </div>
  );
}

// ---------- Bảng nhập thực tế theo NGÀY: mỗi ngày một dòng (anh Sỹ chốt 11/2026) ----------
// Bảng CSDL vẫn có cột ca: số nhập theo ngày lưu ở dòng ca "CA 1" (không cần SQL mới). Số cũ nhập theo ca (CA 1 / CA 2) vẫn còn: ô của ngày hiện TỔNG các ca;
// sửa ô thì ghi cả ngày vào một dòng "CA 1" và xóa dòng "CA 2" của ô đó.
const CA_NGAY = "CA 1", CA_BO = "CA 2";
function BangThucTe({ nhom, thang, mucTieu, thucTe, loc, onLuu }) {
  const { D, quyen, api, run, toast } = useApp();
  const c = NHOM[nhom], nhap = quyen.nhap;
  const ngays = useMemo(() => ngayCuaThang(thang), [thang]);
  const homNay = useMemo(() => { const d = new Date(D.now); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }, [D.now]);
  const kOu = (ngay, k) => `${ngay}|${k}`; // khóa ô: ngày | khóa cột
  // Số đã lưu theo ô (tổng các dòng của ngày đó)
  const goc = useMemo(() => { const m = {}; for (const r of thucTe) { const x = tuDb(nhom, r), key = kOu(String(r.ngay).slice(0, 10), khoaCua(x)); m[key] = (m[key] || 0) + (+r.tan || 0); } return m; }, [thucTe, nhom]);
  const [sua, setSua] = useState({}); // ô đã gõ: khóa ô -> chữ
  const [extra, setExtra] = useState([]); // cột người dùng vừa thêm (chưa có số)
  const [them, setThem] = useState({ huong: c.huong[0][0], loai: "", hang: "", donVi: DON_VI[0][0] });
  // Cột: mọi dòng có mục tiêu hoặc có số thực tế + cột vừa thêm; sắp theo hướng, đội xe rồi mục tiêu giảm dần
  const cotTat = useMemo(() => {
    const m = new Map(), mt = new Map();
    for (const r of mucTieu) { const x = tuDb(nhom, r); m.set(khoaCua(x), { huong: x.huong, loai: x.loai, donVi: x.donVi, hang: x.hang }); mt.set(khoaCua(x), +x.tan || 0); }
    for (const r of thucTe) { const x = tuDb(nhom, r), k = khoaCua(x); if (!m.has(k)) m.set(k, { huong: x.huong, loai: x.loai, donVi: x.donVi, hang: x.hang }); }
    for (const x of extra) { const k = khoaCua(x); if (!m.has(k)) m.set(k, x); }
    const thuTuHuong = c.huong.map(([h]) => h);
    return [...m.entries()].map(([k, x]) => ({ ...x, k, mt: mt.get(k) || 0 }))
      .sort((a, b) => thuTuHuong.indexOf(a.huong) - thuTuHuong.indexOf(b.huong) || (nhom === "van_tai" ? a.loai.localeCompare(b.loai, "vi") : 0) || b.mt - a.mt || a.loai.localeCompare(b.loai, "vi") || a.donVi.localeCompare(b.donVi) || a.hang.localeCompare(b.hang, "vi"));
  }, [mucTieu, thucTe, extra, nhom, c.huong]);
  const cot = useMemo(() => cotTat.filter(loc), [cotTat, loc]); // các cột đang hiện (theo bộ lọc đội xe)
  const goiY = useLoaiGoiY(nhom, useMemo(() => cotTat.map((x) => x.loai), [cotTat]));
  const dsDV = useDonVi(useMemo(() => [...new Set(cotTat.map((x) => x.donVi).filter(Boolean))], [cotTat]));
  const goiYHang = useLoaiGoiY("cang", useMemo(() => cotTat.map((x) => x.hang).filter(Boolean), [cotTat]));
  const giaTri = (key) => (key in sua ? docSo(sua[key]) || 0 : goc[key] || 0);
  const hienThi = (key) => (key in sua ? sua[key] : key in goc ? fmt(goc[key]) : "");
  const kDirty = Object.keys(sua).filter((key) => (sua[key] || "").trim() !== (key in goc ? fmt(goc[key]) : ""));
  const cotCua = useMemo(() => new Map(cotTat.map((x) => [x.k, x])), [cotTat]);
  const tongCot = (k) => ngays.reduce((s, n) => s + giaTri(kOu(n, k)), 0);
  const tongDong = (n) => cot.reduce((s, x) => s + giaTri(kOu(n, x.k)), 0);
  const nhomCot = c.huong.map(([h, ten]) => ({ h, ten, n: cot.filter((x) => x.huong === h).length })).filter((x) => x.n);
  const luu = async () => {
    const rows = [];
    for (const key of kDirty) {
      const ngay = key.slice(0, 10), col = cotCua.get(key.slice(11)), txt = (sua[key] || "").trim(), tan = txt ? docSo(txt) : null;
      if (txt && !(tan >= 0)) return toast(`Ngày ${ngay.slice(8)}/${ngay.slice(5, 7)} ${col.loai}: không phải số tấn`, "bad");
      if (tan == null && !(key in goc)) continue;
      const r = { ngay, huong: col.huong, loai: col.loai, donVi: col.donVi, hang: col.hang };
      rows.push({ ...r, ca: CA_NGAY, tan }, { ...r, ca: CA_BO, tan: null }); // cả ngày vào một dòng; dòng ca cũ còn lại bị xóa
    }
    if (!rows.length) { setSua({}); return; }
    if (await run(() => api.saveThucTe(nhom, rows), `Đã lưu sản lượng thực tế (${rows.length / 2} ô)`)) onLuu();
  };
  const themCot = () => {
    const loai = them.loai.trim(); if (!loai) return;
    setExtra((o) => [...o, { huong: them.huong, loai, donVi: c.coDonVi ? them.donVi : "", hang: c.coLoaiHang ? them.hang.trim() : "" }]);
    setThem({ ...them, loai: "", hang: "" });
  };
  const stk = (left) => ({ position: "sticky", left, zIndex: 2 });
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">Sản lượng thực tế {tenKyThuong("thang", thang)} theo ngày (tấn)</h2>
        <span className="text-xs text-muted-foreground">Mỗi ngày một dòng</span>
        <div className="ml-auto flex items-center gap-2">
          {kDirty.length > 0 && <Button size="sm" variant="outline" onClick={() => setSua({})}>Bỏ thay đổi</Button>}
          {nhap && <Button size="sm" disabled={!kDirty.length} onClick={luu}><Save />Lưu số liệu{kDirty.length ? ` (${kDirty.length} ô)` : ""}</Button>}
        </div>
      </div>
      {cot.length ? (
        <div className="scroll-x max-h-[70vh] rounded-md border">
          <table className="tbl text-xs" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
            <thead>
              <tr style={{ position: "sticky", top: 0, zIndex: 4 }} className="bg-card">
                <th rowSpan={2} style={{ ...stk(0), minWidth: 84, zIndex: 5 }} className="bg-card">Ngày</th>
                {nhomCot.map((g) => <th key={g.h} colSpan={g.n} className="border-l bg-muted/40 text-center">{g.ten}</th>)}
                <th rowSpan={2} className="num border-l bg-card">Tổng ngày</th>
              </tr>
              <tr style={{ position: "sticky", top: 28, zIndex: 4 }} className="bg-card">
                {cot.map((x, i) => (
                  <th key={x.k} className={cn("num min-w-[96px] bg-card", (i === 0 || cot[i - 1].huong !== x.huong) && "border-l")}>
                    {c.coLoaiHang ? (x.hang || "Mọi hàng") : x.loai}
                    {c.coLoaiHang && <div className="text-[10px] font-normal text-muted-foreground">{x.loai}</div>}
                    {c.coDonVi && <div className="text-[10px] font-normal text-muted-foreground">{tenDonVi(x.donVi)}</div>}
                    {x.mt > 0 && <div className="text-[10px] font-normal text-muted-foreground">MT {so(x.mt)}</div>}
                  </th>))}
              </tr>
            </thead>
            <tbody>
              {ngays.map((n) => {
                const d = new Date(n + "T00:00:00"), cn0 = d.getDay() === 0, hn = n === homNay;
                const nen = hn ? "bg-primary/10" : cn0 ? "bg-muted/60" : "bg-card";
                return (
                  <tr key={n}>
                    <td style={stk(0)} className={cn("whitespace-nowrap border-t font-semibold tabular-nums", nen)}>{n.slice(8)}/{n.slice(5, 7)}<span className={cn("ml-1.5 text-[10px] font-normal", cn0 ? "text-bad" : "text-muted-foreground")}>{THU[d.getDay()]}{hn ? " · nay" : ""}</span></td>
                    {cot.map((x, j) => {
                      const key = kOu(n, x.k), co = key in sua && sua[key].trim() !== (key in goc ? fmt(goc[key]) : "");
                      return (
                        <td key={x.k} className={cn("num border-t p-0.5", (j === 0 || cot[j - 1].huong !== x.huong) && "border-l", co && "bg-warn/10", hn && !co && "bg-primary/5")}>
                          {nhap
                            ? <input className="h-7 w-24 rounded border border-transparent bg-transparent px-1.5 text-right tabular-nums hover:border-input focus:border-ring focus:bg-background focus:outline-none" inputMode="decimal" value={hienThi(key)} onChange={(e) => setSua((o) => ({ ...o, [key]: e.target.value }))} aria-label={`Ngày ${n.slice(8)} ${x.loai} ${x.hang}`} />
                            : <span className="px-1.5">{hienThi(key)}</span>}
                        </td>);
                    })}
                    <td className="num border-l border-t font-semibold tabular-nums">{tongDong(n) ? so(tongDong(n)) : ""}</td>
                  </tr>);
              })}
            </tbody>
            <tfoot style={{ position: "sticky", bottom: 0, zIndex: 4 }}>
              <tr className="bg-card font-semibold"><td style={{ ...stk(0), zIndex: 5 }} className="border-t bg-card">Cộng tháng</td>{cot.map((x) => <td key={x.k} className="num border-t bg-card tabular-nums">{so(tongCot(x.k))}</td>)}<td className="num border-l border-t bg-card tabular-nums">{so(cot.reduce((s, x) => s + tongCot(x.k), 0))}</td></tr>
              <tr className="bg-card"><td style={{ ...stk(0), zIndex: 5 }} className="bg-card">Mục tiêu tháng</td>{cot.map((x) => <td key={x.k} className="num bg-card tabular-nums">{x.mt ? so(x.mt) : "—"}</td>)}<td className="num border-l bg-card tabular-nums">{so(cot.reduce((s, x) => s + x.mt, 0))}</td></tr>
              <tr className="bg-card font-semibold"><td style={{ ...stk(0), zIndex: 5 }} className="bg-card">Đạt</td>{cot.map((x) => { const t = tongCot(x.k); return <td key={x.k} className={cn("num bg-card tabular-nums", x.mt > 0 && t >= x.mt && "text-ok")}>{x.mt ? pct(t / x.mt) : ""}</td>; })}<td className="num border-l bg-card tabular-nums">{(() => { const m = cot.reduce((s, x) => s + x.mt, 0), t = cot.reduce((s, x) => s + tongCot(x.k), 0); return m ? pct(t / m) : ""; })()}</td></tr>
            </tfoot>
          </table>
        </div>
      ) : <Empty>Chưa có {c.nhanLoai.toLowerCase()} nào{cotTat.length ? " ứng với bộ lọc đội xe" : ""}. Đặt mục tiêu ở bảng trên, hoặc thêm cột bên dưới rồi nhập số.</Empty>}
      {nhap && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border p-2">
          <span className="text-xs text-muted-foreground">Thêm cột</span>
          <NativeSelect className="h-9 w-40" value={them.huong} onChange={(e) => setThem({ ...them, huong: e.target.value })} options={c.huong} aria-label="Hướng" />
          <ChonGo className="min-w-[170px] flex-1" value={them.loai} onChange={(x) => setThem({ ...them, loai: x })} options={goiY} placeholder={`${c.nhanLoai} (chọn hoặc gõ)`} />
          {c.coLoaiHang && <ChonGo className="min-w-[170px] flex-1" value={them.hang} onChange={(x) => setThem({ ...them, hang: x })} options={goiYHang} placeholder="Loại hàng (trống = mọi hàng)" />}
          {c.coDonVi && <NativeSelect className="h-9 w-32" value={them.donVi} onChange={(e) => setThem({ ...them, donVi: e.target.value })} options={dsDV} aria-label="Đơn vị thực hiện" />}
          <Button size="sm" variant="outline" disabled={!them.loai.trim()} onClick={themCot}><Plus />Thêm</Button>
        </div>)}
      <p className="text-[11px] text-muted-foreground">{nhap ? "Gõ số tấn của cả ngày vào ô (vd 12.500), bấm Lưu số liệu. Xóa số trong ô là xóa số của ngày đó. Cột có mục tiêu hiện sẵn; muốn nhập loại khác thì Thêm cột." : "Vai trò Xem chỉ xem số liệu."}</p>
    </div>
  );
}
