import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Plus, Save, X, RefreshCw } from "lucide-react";
import { useApp } from "@/store";
import { Card, CardContent } from "@/components/ui/card";
import { Input, NativeSelect } from "@/components/ui/input";
import { ChonGo } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/common";
import { so, pct, tenThang, congThang } from "@/lib/format";
import { docSo } from "@/lib/paste";
import { cn } from "@/lib/utils";
import { tinhThang, khoaLoai } from "@/lib/sanLuong";
import { CA, DON_VI, NHOM, tenDonVi, khoaDong, khoaCua, tuDb, ngayCuaThang, khoaO, tongTheoCot } from "@/lib/sanLuongTT";
import { useThietBi } from "@/thietbi/Host";
import { useNhomHang } from "./useNhomHang";

const THU = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const fmt = (n) => (n == null ? "" : Number.isInteger(+n) ? so(n) : so(n, 2));

// Một tab của Khai thác Cảng › Mục tiêu sản lượng (nhom = "cang" | "van_tai"): bảng mục tiêu tháng và bảng nhập thực tế theo ca / ngày.
// Dữ liệu của tháng đang chọn tải riêng từ Supabase (SQL 06); sau mỗi lần lưu tải lại.
export default function SanLuongTab({ nhom, thang }) {
  const { api } = useApp();
  const [lan, setLan] = useState(0);
  const [kq, setKq] = useState(undefined); // undefined: đang tải · null: chưa chạy SQL · { mucTieu, thucTe }
  const tai = useCallback(() => setLan((x) => x + 1), []);
  useEffect(() => {
    let huy = false;
    api.docSanLuongThang(nhom, thang).then((r) => { if (!huy) setKq(r); }).catch(() => { if (!huy) setKq(null); });
    return () => { huy = true; };
  }, [api, nhom, thang, lan]);
  if (kq === null) return <div className="rounded-md border border-warn/40 bg-warn/5 px-3 py-2 text-sm">Chưa có bảng sản lượng: quản trị cần chạy <b>sql/06_san_luong_thuc_te.sql</b> trong Supabase (sau 01 … 04).</div>;
  if (kq === undefined) return <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><RefreshCw className="h-4 w-4 animate-spin" />Đang tải số liệu {tenThang(thang).toLowerCase()}…</div>;
  return (
    <div className="grid gap-4">
      <Card><CardContent className="pt-4"><BangMucTieu key={`mt-${nhom}-${thang}-${lan}`} nhom={nhom} thang={thang} mucTieu={kq.mucTieu} thucTe={kq.thucTe} onLuu={tai} /></CardContent></Card>
      <Card><CardContent className="pt-4"><BangThucTe key={`tt-${nhom}-${thang}-${lan}`} nhom={nhom} thang={thang} mucTieu={kq.mucTieu} thucTe={kq.thucTe} onLuu={tai} /></CardContent></Card>
    </div>
  );
}

// Danh sách gợi ý loại hàng (cảng: nhóm hàng trong Danh mục) hoặc loại xe (vận tải: đội xe trong Thiết bị cơ giới)
function useLoaiGoiY(nhom, hangDaCo) {
  const { D } = useApp();
  const tb = useThietBi()?.D;
  return useMemo(() => {
    if (nhom === "van_tai") {
      const doi = (tb?.vehicles || []).map((x) => x.doi).filter((d) => d && d !== "Cẩu");
      return [...new Set(["Xe ben", "Xe đầu kéo", ...doi, ...hangDaCo])].sort((a, b) => a.localeCompare(b, "vi"));
    }
    const nhomDM = [...new Set((tb?.hanghoa || []).map((h) => String(h.nhom ?? "").trim()).filter(Boolean))];
    return [...new Set(nhomDM.length ? [...nhomDM, ...hangDaCo] : [...hangDaCo, ...(D.mucTieu || []).map((m) => m.loai_hang)].filter((x) => x && x !== "(chưa ghi)"))].sort((a, b) => a.localeCompare(b, "vi"));
  }, [nhom, tb, D.mucTieu, hangDaCo]);
}

// ---------- Bảng mục tiêu tháng ----------
function BangMucTieu({ nhom, thang, mucTieu, thucTe, onLuu }) {
  const { D, quyen, api, run, toast } = useApp();
  const c = NHOM[nhom], nhomHang = useNhomHang();
  const goc = useMemo(() => Object.fromEntries(mucTieu.map((m) => { const r = tuDb(nhom, m); return [khoaCua(r), { huong: r.huong, loai: r.loai, donVi: r.donVi, tan: so(r.tan), ghi_chu: r.ghi_chu || "" }]; })), [mucTieu, nhom]);
  const [f, setF] = useState(goc);
  const [xoa, setXoa] = useState(() => new Set());
  const [them, setThem] = useState({});
  const th = useMemo(() => tongTheoCot(nhom, thucTe), [nhom, thucTe]);
  const tau = useMemo(() => (nhom === "cang" ? tinhThang(D, thang, nhomHang) : null), [nhom, D, thang, nhomHang]);
  const goiY = useLoaiGoiY(nhom, useMemo(() => [...new Set(thucTe.map((r) => tuDb(nhom, r).loai))], [thucTe, nhom]));
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
    const donVi = c.coDonVi ? t.donVi || DON_VI[0][0] : "", k = khoaDong(huong, loai, donVi);
    if (!dong[k]) { setF({ ...f, [k]: { huong, loai, donVi, tan: "", ghi_chu: "" } }); setXoa((o) => { const n = new Set(o); n.delete(k); return n; }); }
    setThem({ ...them, [huong]: { ...t, loai: "" } });
  };
  const truoc = congThang(thang, -1);
  const [dsTruoc, setDsTruoc] = useState(null);
  useEffect(() => { let huy = false; if (sua) api.docSanLuongThang(nhom, truoc).then((r) => { if (!huy) setDsTruoc(r?.mucTieu || []); }).catch(() => {}); return () => { huy = true; }; }, [api, nhom, truoc, sua]);
  const chepTruoc = () => {
    const moi = { ...f };
    for (const m of dsTruoc || []) { const r = tuDb(nhom, m), k = khoaCua(r); if (!(dong[k]?.tan || "").trim()) moi[k] = { huong: r.huong, loai: r.loai, donVi: r.donVi, tan: so(r.tan), ghi_chu: dong[k]?.ghi_chu || r.ghi_chu || "" }; }
    setF(moi); setXoa(new Set());
  };
  const luu = async () => {
    const rows = daXoa.map((k) => ({ thang, huong: goc[k].huong, loai: goc[k].loai, donVi: goc[k].donVi, tan: null }));
    for (const k of doi.filter((x) => !daXoa.includes(x))) {
      const r = dong[k], txt = r.tan.trim(), tan = txt ? docSo(txt) : null;
      if (txt && !(tan >= 0)) return toast(`${r.loai}: mục tiêu phải là số tấn`, "bad");
      rows.push({ thang, huong: r.huong, loai: r.loai, donVi: r.donVi, tan, ghi_chu: r.ghi_chu.trim() || null });
    }
    if (await run(() => api.saveMucTieuNhom(nhom, rows), `Đã lưu mục tiêu ${tenThang(thang).toLowerCase()} (${rows.length} dòng)`)) onLuu();
  };
  const tongMT = (huong) => Object.values(dong).filter((r) => r.huong === huong).reduce((s, r) => s + (docSo(r.tan) || 0), 0);
  const tongTH = (huong) => [...th.entries()].filter(([k]) => k.startsWith(huong + "|")).reduce((s, [, v]) => s + v, 0);
  const tongAll = (fn) => c.huong.reduce((s, [h]) => s + fn(h), 0);
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">Mục tiêu {tenThang(thang).toLowerCase()}</h2>
        {sua && dsTruoc?.length > 0 && <Button size="sm" variant="outline" onClick={chepTruoc} title="Điền mục tiêu tháng trước vào các dòng còn trống"><Copy />Chép mục tiêu {tenThang(truoc).toLowerCase()}</Button>}
        <div className="ml-auto flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {c.huong.map(([h, ten]) => <span key={h}><span className="text-muted-foreground">{ten}</span> <b className="tabular-nums">{so(tongMT(h))}</b></span>)}
          <span><span className="text-muted-foreground">cộng</span> <b className="tabular-nums text-primary">{so(tongAll(tongMT))} t</b></span>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {c.huong.map(([huong, ten]) => {
          const ds = Object.entries(dong).filter(([, r]) => r.huong === huong).sort((a, b) => (docSo(b[1].tan) || 0) - (docSo(a[1].tan) || 0) || a[1].loai.localeCompare(b[1].loai, "vi"));
          const mtT = tongMT(huong), thT = tongTH(huong), t = them[huong] || {};
          return (
            <div key={huong} className="rounded-md border">
              <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2 text-sm font-semibold">{ten}<span className="ml-auto text-xs font-normal text-muted-foreground">{ds.length} dòng</span></div>
              <div className="scroll-x max-h-[50vh]">
                <table className="tbl text-xs">
                  <thead><tr><th>{c.nhanLoai}</th>{c.coDonVi && <th>Đơn vị</th>}<th className="num">Mục tiêu (t)</th><th className="num">Thực hiện</th><th className="num">Đạt</th><th>Ghi chú</th>{sua && <th className="w-8" />}</tr></thead>
                  <tbody>
                    {ds.map(([k, r]) => {
                      const mt = docSo(r.tan) || 0, tt = th.get(k) || 0, tauT = tau?.theoLoai.get(khoaLoai(huong, r.loai))?.tau;
                      return (
                        <tr key={k} className={cn(doi.includes(k) && "bg-warn/5")}>
                          <td className="whitespace-nowrap font-medium">{r.loai}{tauT > 0 && <div className="text-[11px] font-normal text-muted-foreground">tàu trong tháng {so(tauT)} t</div>}</td>
                          {c.coDonVi && <td className="whitespace-nowrap">{tenDonVi(r.donVi)}</td>}
                          <td className="num">{sua ? <Input className="ml-auto h-8 w-28 text-right tabular-nums" inputMode="decimal" value={r.tan} placeholder="—" onChange={(e) => dat1(k, "tan", e.target.value)} aria-label={`Mục tiêu ${r.loai}`} /> : (r.tan || "—")}</td>
                          <td className="num">{so(tt)}</td>
                          <td className={cn("num", mt > 0 && tt >= mt && "font-semibold text-ok")}>{mt ? pct(tt / mt) : ""}</td>
                          <td className="min-w-[110px]">{sua ? <Input className="h-8" value={r.ghi_chu} onChange={(e) => dat1(k, "ghi_chu", e.target.value)} aria-label={`Ghi chú ${r.loai}`} /> : r.ghi_chu}</td>
                          {sua && <td className="w-8"><button type="button" className="rounded p-1 text-muted-foreground hover:text-bad" onClick={() => xoaDong(k)} title={`Xóa dòng ${r.loai}`} aria-label={`Xóa dòng ${r.loai}`}><X className="h-4 w-4" /></button></td>}
                        </tr>);
                    })}
                    {!ds.length && <tr><td colSpan={(sua ? 6 : 5) + (c.coDonVi ? 1 : 0)} className="py-4 text-center text-muted-foreground">Chưa có dòng nào. Chọn {c.nhanLoai.toLowerCase()} ở ô bên dưới rồi bấm Thêm, nhập mục tiêu và bấm Lưu.</td></tr>}
                  </tbody>
                  <tfoot><tr className="font-semibold"><td>Tổng</td>{c.coDonVi && <td />}<td className="num">{so(mtT)}</td><td className="num">{so(thT)}</td><td className="num">{mtT ? pct(thT / mtT) : ""}</td><td />{sua && <td />}</tr></tfoot>
                </table>
              </div>
              {sua && (
                <div className="flex flex-wrap items-center gap-2 border-t p-2">
                  <ChonGo className="min-w-[160px] flex-1" value={t.loai || ""} onChange={(x) => setThem({ ...them, [huong]: { ...t, loai: x } })} options={goiY} placeholder={`Thêm ${c.nhanLoai.toLowerCase()} (chọn hoặc gõ)`} />
                  {c.coDonVi && <NativeSelect className="h-9 w-32" value={t.donVi || DON_VI[0][0]} onChange={(e) => setThem({ ...them, [huong]: { ...t, donVi: e.target.value } })} options={DON_VI} aria-label="Đơn vị thực hiện" />}
                  <Button size="sm" variant="outline" disabled={!(t.loai || "").trim()} onClick={() => themDong(huong)}><Plus />Thêm</Button>
                </div>)}
            </div>);
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-[11px] text-muted-foreground">{sua ? "Gõ số tấn (vd 400.000). Cột Thực hiện là tổng số đã nhập ở bảng thực tế bên dưới. Xóa số hoặc bấm x là bỏ mục tiêu dòng đó (bấm Lưu mới xóa hẳn). " : "Chỉ Quản lý / Quản trị đặt mục tiêu. Cột Thực hiện là tổng số đã nhập ở bảng thực tế bên dưới. "}</p>
        {sua && <Button size="sm" disabled={!doi.length} onClick={luu}><Save />Lưu mục tiêu{doi.length ? ` (${doi.length} dòng)` : ""}</Button>}
      </div>
    </div>
  );
}

// ---------- Bảng nhập thực tế theo ca / ngày ----------
function BangThucTe({ nhom, thang, mucTieu, thucTe, onLuu }) {
  const { D, quyen, api, run, toast } = useApp();
  const c = NHOM[nhom], nhap = quyen.nhap;
  const ngays = useMemo(() => ngayCuaThang(thang), [thang]);
  const homNay = useMemo(() => { const d = new Date(D.now); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }, [D.now]);
  // Số đã lưu theo ô
  const goc = useMemo(() => { const m = {}; for (const r of thucTe) { const x = tuDb(nhom, r); m[khoaO(String(r.ngay).slice(0, 10), r.ca, khoaCua(x))] = +r.tan; } return m; }, [thucTe, nhom]);
  const [sua, setSua] = useState({}); // ô đã gõ: khóa ô -> chữ
  const [extra, setExtra] = useState([]); // cột người dùng vừa thêm (chưa có số)
  const [them, setThem] = useState({ huong: c.huong[0][0], loai: "", donVi: DON_VI[0][0] });
  // Cột: mọi dòng có mục tiêu hoặc có số thực tế + cột vừa thêm; sắp theo hướng rồi mục tiêu giảm dần
  const cot = useMemo(() => {
    const m = new Map(), mt = new Map();
    for (const r of mucTieu) { const x = tuDb(nhom, r); m.set(khoaCua(x), { huong: x.huong, loai: x.loai, donVi: x.donVi }); mt.set(khoaCua(x), +x.tan || 0); }
    for (const r of thucTe) { const x = tuDb(nhom, r), k = khoaCua(x); if (!m.has(k)) m.set(k, { huong: x.huong, loai: x.loai, donVi: x.donVi }); }
    for (const x of extra) { const k = khoaCua(x); if (!m.has(k)) m.set(k, x); }
    const thuTuHuong = c.huong.map(([h]) => h);
    return [...m.entries()].map(([k, x]) => ({ ...x, k, mt: mt.get(k) || 0 }))
      .sort((a, b) => thuTuHuong.indexOf(a.huong) - thuTuHuong.indexOf(b.huong) || b.mt - a.mt || a.loai.localeCompare(b.loai, "vi") || a.donVi.localeCompare(b.donVi));
  }, [mucTieu, thucTe, extra, nhom, c.huong]);
  const goiY = useLoaiGoiY(nhom, useMemo(() => cot.map((x) => x.loai), [cot]));
  const giaTri = (key) => (key in sua ? docSo(sua[key]) || 0 : goc[key] || 0);
  const hienThi = (key) => (key in sua ? sua[key] : key in goc ? fmt(goc[key]) : "");
  const kDirty = Object.keys(sua).filter((key) => (sua[key] || "").trim() !== (key in goc ? fmt(goc[key]) : ""));
  const cotCua = useMemo(() => new Map(cot.map((x) => [x.k, x])), [cot]);
  const tongCot = (k, ca) => ngays.reduce((s, n) => s + (ca ? giaTri(khoaO(n, ca, k)) : CA.reduce((t, cc) => t + giaTri(khoaO(n, cc, k)), 0)), 0);
  const tongDong = (n, ca) => cot.reduce((s, x) => s + (ca ? giaTri(khoaO(n, ca, x.k)) : CA.reduce((t, cc) => t + giaTri(khoaO(n, cc, x.k)), 0)), 0);
  const nhomCot = c.huong.map(([h, ten]) => ({ h, ten, n: cot.filter((x) => x.huong === h).length })).filter((x) => x.n);
  const luu = async () => {
    const rows = [];
    for (const key of kDirty) {
      const [ngay, ca, ...r] = key.split("|"), col = cotCua.get(r.join("|")), txt = (sua[key] || "").trim(), tan = txt ? docSo(txt) : null;
      if (txt && !(tan >= 0)) return toast(`Ngày ${ngay.slice(8)}/${ngay.slice(5, 7)} ${ca} ${col.loai}: không phải số tấn`, "bad");
      if (tan == null && !(key in goc)) continue;
      rows.push({ ngay, ca, huong: col.huong, loai: col.loai, donVi: col.donVi, tan });
    }
    if (!rows.length) { setSua({}); return; }
    if (await run(() => api.saveThucTe(nhom, rows), `Đã lưu sản lượng thực tế (${rows.length} ô)`)) onLuu();
  };
  const themCot = () => {
    const loai = them.loai.trim(); if (!loai) return;
    setExtra((o) => [...o, { huong: them.huong, loai, donVi: c.coDonVi ? them.donVi : "" }]);
    setThem({ ...them, loai: "" });
  };
  const ngayHienTai = (n) => n === homNay;
  const stk = (left) => ({ position: "sticky", left, zIndex: 2 });
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">Sản lượng thực tế {tenThang(thang).toLowerCase()} theo ca / ngày (tấn)</h2>
        <span className="text-xs text-muted-foreground">CA 1: 08h–20h · CA 2: 20h–08h</span>
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
                <th rowSpan={2} style={{ ...stk(0), minWidth: 64, zIndex: 5 }} className="bg-card">Ngày</th>
                <th rowSpan={2} style={{ ...stk(64), minWidth: 56, zIndex: 5 }} className="bg-card">Ca</th>
                {nhomCot.map((g) => <th key={g.h} colSpan={g.n} className="border-l bg-muted/40 text-center">{g.ten}</th>)}
                <th rowSpan={2} className="num border-l bg-card">Tổng</th>
              </tr>
              <tr style={{ position: "sticky", top: 28, zIndex: 4 }} className="bg-card">
                {cot.map((x, i) => (
                  <th key={x.k} className={cn("num min-w-[96px] bg-card", (i === 0 || cot[i - 1].huong !== x.huong) && "border-l")}>
                    {x.loai}{c.coDonVi && <div className="text-[10px] font-normal text-muted-foreground">{tenDonVi(x.donVi)}</div>}
                    {x.mt > 0 && <div className="text-[10px] font-normal text-muted-foreground">MT {so(x.mt)}</div>}
                  </th>))}
              </tr>
            </thead>
            <tbody>
              {ngays.map((n) => {
                const d = new Date(n + "T00:00:00"), cn0 = d.getDay() === 0, hn = ngayHienTai(n);
                const nen = hn ? "bg-primary/10" : cn0 ? "bg-muted/60" : "bg-card";
                return [
                  ...CA.map((ca, i) => (
                    <tr key={n + ca}>
                      {i === 0 && <td rowSpan={3} style={{ ...stk(0), verticalAlign: "top" }} className={cn("whitespace-nowrap border-t font-semibold tabular-nums", nen)}>{n.slice(8)}/{n.slice(5, 7)}<div className={cn("text-[10px] font-normal", cn0 ? "text-bad" : "text-muted-foreground")}>{THU[d.getDay()]}{hn ? " · nay" : ""}</div></td>}
                      <td style={stk(64)} className={cn("whitespace-nowrap", i === 0 && "border-t", nen)}>{ca}</td>
                      {cot.map((x, j) => {
                        const key = khoaO(n, ca, x.k), co = key in sua && sua[key].trim() !== (key in goc ? fmt(goc[key]) : "");
                        return (
                          <td key={x.k} className={cn("num p-0.5", (j === 0 || cot[j - 1].huong !== x.huong) && "border-l", i === 0 && "border-t", co && "bg-warn/10")}>
                            {nhap
                              ? <input className="h-7 w-24 rounded border border-transparent bg-transparent px-1.5 text-right tabular-nums hover:border-input focus:border-ring focus:bg-background focus:outline-none" inputMode="decimal" value={hienThi(key)} onChange={(e) => setSua((o) => ({ ...o, [key]: e.target.value }))} aria-label={`${ca} ngày ${n.slice(8)} ${x.loai}`} />
                              : <span className="px-1.5">{hienThi(key)}</span>}
                          </td>);
                      })}
                      <td className={cn("num border-l tabular-nums", i === 0 && "border-t")}>{so(tongDong(n, ca)) || ""}</td>
                    </tr>)),
                  <tr key={n + "sum"} className="font-semibold">
                    <td style={stk(64)} className={cn("whitespace-nowrap", nen)}>Cộng ngày</td>
                    {cot.map((x, j) => <td key={x.k} className={cn("num bg-muted/30 tabular-nums", (j === 0 || cot[j - 1].huong !== x.huong) && "border-l")}>{(() => { const v = CA.reduce((t, cc) => t + giaTri(khoaO(n, cc, x.k)), 0); return v ? so(v) : ""; })()}</td>)}
                    <td className="num border-l bg-muted/30 tabular-nums">{so(tongDong(n, null)) || ""}</td>
                  </tr>,
                ];
              })}
            </tbody>
            <tfoot style={{ position: "sticky", bottom: 0, zIndex: 4 }}>
              <tr className="bg-card font-semibold"><td colSpan={2} style={{ ...stk(0), zIndex: 5 }} className="border-t bg-card">Cộng tháng</td>{cot.map((x) => <td key={x.k} className="num border-t bg-card tabular-nums">{so(tongCot(x.k, null))}</td>)}<td className="num border-l border-t bg-card tabular-nums">{so(cot.reduce((s, x) => s + tongCot(x.k, null), 0))}</td></tr>
              <tr className="bg-card"><td colSpan={2} style={{ ...stk(0), zIndex: 5 }} className="bg-card">Mục tiêu tháng</td>{cot.map((x) => <td key={x.k} className="num bg-card tabular-nums">{x.mt ? so(x.mt) : "—"}</td>)}<td className="num border-l bg-card tabular-nums">{so(cot.reduce((s, x) => s + x.mt, 0))}</td></tr>
              <tr className="bg-card font-semibold"><td colSpan={2} style={{ ...stk(0), zIndex: 5 }} className="bg-card">Đạt</td>{cot.map((x) => { const t = tongCot(x.k, null); return <td key={x.k} className={cn("num bg-card tabular-nums", x.mt > 0 && t >= x.mt && "text-ok")}>{x.mt ? pct(t / x.mt) : ""}</td>; })}<td className="num border-l bg-card tabular-nums">{(() => { const m = cot.reduce((s, x) => s + x.mt, 0), t = cot.reduce((s, x) => s + tongCot(x.k, null), 0); return m ? pct(t / m) : ""; })()}</td></tr>
            </tfoot>
          </table>
        </div>
      ) : <Empty>Chưa có {c.nhanLoai.toLowerCase()} nào. Đặt mục tiêu ở bảng trên, hoặc thêm cột bên dưới rồi nhập số.</Empty>}
      {nhap && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border p-2">
          <span className="text-xs text-muted-foreground">Thêm cột</span>
          <NativeSelect className="h-9 w-40" value={them.huong} onChange={(e) => setThem({ ...them, huong: e.target.value })} options={c.huong} aria-label="Hướng" />
          <ChonGo className="min-w-[160px] flex-1" value={them.loai} onChange={(x) => setThem({ ...them, loai: x })} options={goiY} placeholder={`${c.nhanLoai} (chọn hoặc gõ)`} />
          {c.coDonVi && <NativeSelect className="h-9 w-32" value={them.donVi} onChange={(e) => setThem({ ...them, donVi: e.target.value })} options={DON_VI} aria-label="Đơn vị thực hiện" />}
          <Button size="sm" variant="outline" disabled={!them.loai.trim()} onClick={themCot}><Plus />Thêm</Button>
        </div>)}
      <p className="text-[11px] text-muted-foreground">{nhap ? "Gõ số tấn vào ô của từng ca (vd 12.500), bấm Lưu số liệu. Xóa số trong ô là xóa số của ca đó. Cột có mục tiêu hiện sẵn; muốn nhập loại khác thì Thêm cột." : "Vai trò Xem chỉ xem số liệu."}</p>
    </div>
  );
}
