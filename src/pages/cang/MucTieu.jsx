import { useEffect, useMemo, useState } from "react";
import { Copy, Plus, Save, X } from "lucide-react";
import { useApp } from "@/store";
import { Card, CardContent } from "@/components/ui/card";
import { Input, NativeSelect } from "@/components/ui/input";
import { ChonGo } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHead } from "@/components/common";
import { so, pct, thangCua, tenThang, congThang } from "@/lib/format";
import { docSo } from "@/lib/paste";
import { cn } from "@/lib/utils";
import { dongHang, khoaLoai, tinhThang } from "@/lib/sanLuong";
import { useThietBi } from "@/thietbi/Host";
import { useNhomHang } from "./useNhomHang";

// Khai thác Cảng › Mục tiêu sản lượng: đặt mục tiêu tấn hàng theo tháng, hướng (nhập / xuất) và loại hàng.
// Tổng quan › Khối lượng xếp dỡ so thực hiện với các mục tiêu này.
export default function MucTieu() {
  return (
    <>
      <PageHead title="Mục tiêu sản lượng" desc="Mục tiêu tấn hàng xếp dỡ mỗi tháng theo hướng nhập / xuất và loại hàng. Tổng quan › Khối lượng xếp dỡ so thực hiện với mục tiêu này." />
      <Card><CardContent className="pt-4"><MucTieuThang /></CardContent></Card>
    </>
  );
}

// Bảng đặt mục tiêu sản lượng một tháng, theo hướng (nhập / xuất) và loại hàng. Quản lý / quản trị sửa được;
// xóa số của một dòng là bỏ mục tiêu loại hàng đó. Chỉ hiện loại hàng đã lưu mục tiêu và loại vừa bấm Thêm; không tự thêm theo chuyến tàu.
const HUONG = [["nhap", "Hàng nhập"], ["xuat", "Hàng xuất"]];
function MucTieuThang() {
  const { D, quyen, api, run, toast, tuThang, moRongKhoang } = useApp();
  const hangHoa = useThietBi()?.D?.hanghoa;
  const nhomHang = useNhomHang();
  const [thang, setThang] = useState(() => thangCua(D.now));
  const thangs = useMemo(() => Array.from({ length: 13 }, (_, i) => congThang(thangCua(D.now), i - 6)), [D.now]);
  const k = useMemo(() => tinhThang(D, thang, nhomHang), [D, thang, nhomHang]);
  // Mục tiêu đã lưu của tháng: khóa "hướng|loại hàng" -> { huong, loai_hang, tan (chữ), ghi_chu }
  const goc = useMemo(() => Object.fromEntries((D.mucTieu || []).filter((x) => x.thang === thang)
    .map((m) => [khoaLoai(m.huong, m.loai_hang), { huong: m.huong, loai_hang: m.loai_hang, tan: so(m.tan), ghi_chu: m.ghi_chu || "" }])), [D.mucTieu, thang]);
  const [f, setF] = useState(goc);
  const [them, setThem] = useState({ nhap: "", xuat: "" });
  const [xoa, setXoa] = useState(() => new Set()); // dòng bấm x: ẩn ngay, bấm Lưu thì xóa mục tiêu đã lưu của dòng đó
  useEffect(() => { setF(goc); setXoa(new Set()); }, [goc]);
  // Chỉ hiện các dòng đã lưu mục tiêu và các dòng vừa bấm Thêm (chưa lưu): không tự thêm loại hàng theo chuyến tàu trong tháng
  const dong = useMemo(() => {
    const out = { ...f };
    for (const kk of xoa) delete out[kk];
    return out;
  }, [f, xoa]);
  if (!D.coSql21) return <div className="rounded-md border border-warn/40 bg-warn/5 px-3 py-2 text-sm">Chưa có bảng mục tiêu: quản trị cần chạy <b>sql/21_muc_tieu_san_luong.sql</b> trong Supabase.</div>;
  const sua = quyen.quanLy;
  const rong = { tan: "", ghi_chu: "" };
  const giong = (a, b) => (a?.tan || "").trim() === (b?.tan || "").trim() && (a?.ghi_chu || "").trim() === (b?.ghi_chu || "").trim();
  const daXoa = [...xoa].filter((kk) => goc[kk]); // dòng đã lưu mà bị bấm x
  const doi = [...Object.keys(dong).filter((kk) => !giong(dong[kk], goc[kk] || rong)), ...daXoa];
  const boAn = (kks) => setXoa((o) => { const n = new Set(o); for (const kk of kks) n.delete(kk); return n; });
  const xoaDong = (kk) => { setXoa((o) => new Set(o).add(kk)); setF((o) => { const n = { ...o }; delete n[kk]; return n; }); };
  const dat1 = (kk, key, val) => setF({ ...f, [kk]: { ...dong[kk], [key]: val } });
  const chonThang = (x) => { if (doi.length && !confirm("Có mục tiêu chưa lưu. Bỏ thay đổi để chuyển tháng?")) return; setThang(x); if (x < tuThang) moRongKhoang(x); };
  // Danh sách chọn loại hàng: các nhóm hàng (cột Nhóm trong Danh mục › Hàng hóa). Chưa có danh mục thì tạm lấy theo hàng của các chuyến.
  const nhomDanhMuc = [...new Set((hangHoa || []).map((h) => String(h.nhom ?? "").trim()).filter(Boolean))];
  const loaiHang = (nhomDanhMuc.length ? nhomDanhMuc : [...new Set([...D.voyages.flatMap((v) => dongHang(v, nhomHang).map((h) => h.loai)), ...(D.mucTieu || []).map((m) => m.loai_hang)].filter((x) => x && x !== "(chưa ghi)"))]).sort((a, b) => a.localeCompare(b, "vi"));
  const themDong = (huong) => {
    const ten = them[huong].trim(); if (!ten) return;
    const kk = khoaLoai(huong, ten);
    if (!dong[kk]) { setF({ ...f, [kk]: { huong, loai_hang: ten, tan: "", ghi_chu: "" } }); boAn([kk]); }
    setThem({ ...them, [huong]: "" });
  };
  // Chép mục tiêu tháng trước vào các dòng còn trống
  const truoc = congThang(thang, -1);
  const dsTruoc = (D.mucTieu || []).filter((x) => x.thang === truoc);
  const chepTruoc = () => {
    const moi = { ...f };
    for (const m of dsTruoc) { const kk = khoaLoai(m.huong, m.loai_hang); if (!(dong[kk]?.tan || "").trim()) moi[kk] = { huong: m.huong, loai_hang: m.loai_hang, tan: so(m.tan), ghi_chu: dong[kk]?.ghi_chu || m.ghi_chu || "" }; }
    setF(moi);
    boAn(dsTruoc.map((m) => khoaLoai(m.huong, m.loai_hang)));
  };
  const luu = async () => {
    const rows = [];
    for (const kk of daXoa) rows.push({ thang, huong: goc[kk].huong, loai_hang: goc[kk].loai_hang, tan: null, ghi_chu: null });
    for (const kk of doi.filter((x) => !daXoa.includes(x))) {
      const r = dong[kk], txt = r.tan.trim(), tan = txt ? docSo(txt) : null;
      if (txt && !(tan >= 0)) { toast(`${r.loai_hang}: mục tiêu phải là số tấn`, "bad"); return; }
      rows.push({ thang, huong: r.huong, loai_hang: r.loai_hang, tan, ghi_chu: r.ghi_chu.trim() || null });
    }
    await run(() => api.saveMucTieu(rows), `Đã lưu mục tiêu ${tenThang(thang).toLowerCase()} (${rows.length} dòng)`);
  };
  const daTai = thang >= tuThang;
  const tongCot = (huong) => Object.values(dong).filter((r) => r.huong === huong).reduce((s, r) => s + (docSo(r.tan) || 0), 0);
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect className="h-8 w-40" value={thang} onChange={(e) => chonThang(e.target.value)} options={thangs.map((x) => [x, tenThang(x) + (x === thangCua(D.now) ? " (này)" : "")])} aria-label="Tháng đặt mục tiêu" />
        {sua && dsTruoc.length > 0 && <Button size="sm" variant="outline" onClick={chepTruoc} title="Điền mục tiêu tháng trước vào các dòng còn trống"><Copy />Chép mục tiêu {tenThang(truoc).toLowerCase()}</Button>}
        <div className="ml-auto flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <span><span className="text-muted-foreground">Mục tiêu nhập</span> <b className="tabular-nums">{so(tongCot("nhap"))}</b></span>
          <span><span className="text-muted-foreground">xuất</span> <b className="tabular-nums">{so(tongCot("xuat"))}</b></span>
          <span><span className="text-muted-foreground">cộng</span> <b className="tabular-nums text-primary">{so(tongCot("nhap") + tongCot("xuat"))} t</b></span>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {HUONG.map(([huong, ten]) => {
          const ds = Object.entries(dong).filter(([, r]) => r.huong === huong).sort((a, b) => (docSo(b[1].tan) || 0) - (docSo(a[1].tan) || 0) || a[1].loai_hang.localeCompare(b[1].loai_hang, "vi"));
          const thTong = daTai ? k[huong].th : null, mtTong = tongCot(huong);
          return (
            <div key={huong} className="rounded-md border">
              <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2 text-sm font-semibold">{ten}<span className="ml-auto text-xs font-normal text-muted-foreground">{ds.length} loại hàng</span></div>
              <div className="scroll-x max-h-[60vh]">
                <table className="tbl text-xs">
                  <thead><tr><th>Loại hàng</th><th className="num">Mục tiêu (t)</th><th className="num">Thực hiện</th><th className="num">Đạt</th><th>Ghi chú</th>{sua && <th className="w-8" />}</tr></thead>
                  <tbody>
                    {ds.map(([kk, r]) => { const x = k.theoLoai.get(kk), mt = docSo(r.tan) || 0; return (
                      <tr key={kk} className={cn(doi.includes(kk) && "bg-warn/5")}>
                        <td className="whitespace-nowrap font-medium">{r.loai_hang}{x?.tau > 0 && <div className="text-[11px] font-normal text-muted-foreground">tàu trong tháng {so(x.tau)} t</div>}</td>
                        <td className="num">{sua ? <Input className="ml-auto h-8 w-28 text-right tabular-nums" inputMode="decimal" value={r.tan} placeholder="—" onChange={(e) => dat1(kk, "tan", e.target.value)} aria-label={`Mục tiêu ${ten.toLowerCase()} ${r.loai_hang}`} /> : r.tan || "—"}</td>
                        <td className="num">{daTai ? so(x?.th || 0) : <span className="text-muted-foreground">chưa tải</span>}</td>
                        <td className={cn("num", daTai && mt && (x?.th || 0) >= mt && "font-semibold text-ok")}>{daTai && mt ? pct((x?.th || 0) / mt) : ""}</td>
                        <td className="min-w-[120px]">{sua ? <Input className="h-8" value={r.ghi_chu} onChange={(e) => dat1(kk, "ghi_chu", e.target.value)} aria-label={`Ghi chú ${r.loai_hang}`} /> : r.ghi_chu}</td>
                        {sua && <td className="w-8"><button type="button" className="rounded p-1 text-muted-foreground hover:text-bad" onClick={() => xoaDong(kk)} title={`Xóa dòng ${r.loai_hang}`} aria-label={`Xóa dòng ${r.loai_hang}`}><X className="h-4 w-4" /></button></td>}
                      </tr>); })}
                    {!ds.length && <tr><td colSpan={sua ? 6 : 5} className="py-4 text-center text-muted-foreground">Chưa có loại hàng nào. Chọn loại hàng ở ô bên dưới rồi bấm Thêm, nhập mục tiêu và bấm Lưu.</td></tr>}
                  </tbody>
                  <tfoot><tr className="font-semibold"><td>Tổng</td><td className="num">{so(mtTong)}</td><td className="num">{thTong != null ? so(thTong) : ""}</td><td className="num">{thTong != null && mtTong ? pct(thTong / mtTong) : ""}</td><td />{sua && <td />}</tr></tfoot>
                </table>
              </div>
              {sua && (
                <div className="flex items-center gap-2 border-t p-2">
                  <ChonGo className="flex-1" value={them[huong]} onChange={(x) => setThem({ ...them, [huong]: x })} options={loaiHang} placeholder="Thêm loại hàng (chọn hoặc gõ)" />
                  <Button size="sm" variant="outline" disabled={!them[huong].trim()} onClick={() => themDong(huong)}><Plus />Thêm</Button>
                </div>)}
            </div>);
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-[11px] text-muted-foreground">{sua ? "Gõ số tấn (vd 400.000). Xóa số của một dòng, hoặc bấm x ở cuối dòng, là bỏ mục tiêu loại hàng đó (bấm Lưu mới xóa hẳn). " : "Chỉ Quản lý / Quản trị phần Cảng được đặt mục tiêu. "}Loại hàng là nhóm hàng (cột Nhóm trong Danh mục › Hàng hóa: Quặng, Than, Đá, Phế…), mỗi loại hàng của chuyến tàu được xếp vào nhóm theo danh mục. Thực hiện = KL đã làm của các chuyến cập bến trong tháng; chuyến nhiều dòng hàng chia theo tỉ lệ khối lượng từng dòng.</p>
        {sua && <Button size="sm" disabled={!doi.length} onClick={luu}><Save />Lưu mục tiêu{doi.length ? ` (${doi.length} dòng)` : ""}</Button>}
      </div>
    </div>
  );
}

