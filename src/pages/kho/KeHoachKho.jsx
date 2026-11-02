import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Plus, Save, X } from "lucide-react";
import { useApp } from "@/store";
import { Input, NativeSelect } from "@/components/ui/input";
import { ChonGo } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { so, thangCua, tenThang, congThang } from "@/lib/format";
import { docSo } from "@/lib/paste";
import { khuCuaKeHoach, nhomCua } from "@/lib/kho";
import { cn } from "@/lib/utils";

// Kho › Kế hoạch Xuất/Nhập tồn: kế hoạch nhập / xuất theo tháng của từng bãi nhỏ. Tổng quan › Quản lý kho bãi › Kế hoạch so thực tế dùng bảng này.
// Hàng hóa và nhóm hàng để trống thì tự điền: hàng đang chứa trong bãi nhỏ, nhóm theo cột Nhóm của Danh mục › Hàng hóa.
const HUONG = [["nhap", "Nhập"], ["xuat", "Xuất"]];
const tenKhu = (d) => `${d.ten_bai} › ${d.ten}`;
// Hàng chứa trong bãi nhỏ: hàng khai ở danh mục và các hàng đang có tồn
const hangCua = (d) => [...new Set([d?.hang, ...(d?.chua || []).map((c) => c.hang)].map((x) => String(x || "").trim()).filter(Boolean))];

export default function KeHoachKho({ loai, kho }) {
  const { D, quyen, api, run, toast } = useApp();
  const sua = quyen.kho.nhap;
  const [thang, setThang] = useState(() => thangCua(D.now));
  const thangs = useMemo(() => Array.from({ length: 14 }, (_, i) => congThang(thangCua(D.now), i - 3)), [D.now]);
  const dong = useMemo(() => kho.dong.filter((d) => d.loai === loai && !d.saiBai), [kho, loai]);
  const dongTheoKey = useMemo(() => new Map(dong.map((d) => [d.key, d])), [dong]);
  const nhoms = useMemo(() => [...new Set((kho.hangHoa || []).map((h) => String(h.nhom ?? "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "vi")), [kho.hangHoa]);
  const dem = useRef(0);
  const taoKey = () => `n${++dem.current}`;
  // Dòng đã lưu của tháng thuộc kho này (bãi nhỏ của kho này, hoặc bãi nhỏ đã bị xóa khỏi danh mục để còn xóa được)
  const lienQuan = (r) => { const d = khuCuaKeHoach(r, kho.dong.filter((x) => !x.saiBai)); return d ? d.loai === loai : true; };
  const goc = useMemo(() => (D.khoKeHoach || []).filter((r) => r.thang === thang && lienQuan(r)).map((r) => ({
    _k: `d${r.id}`, id: r.id, khu_key: khuCuaKeHoach(r, dong)?.key || "", mat: !khuCuaKeHoach(r, dong), ten_bai: r.ten_bai, ten_khu: r.ten_khu,
    hang: r.hang || "", nhom: r.nhom || "", huong: r.huong, khoi_luong: so(r.khoi_luong), ghi_chu: r.ghi_chu || "",
  })), [D.khoKeHoach, thang, dong, loai]); // eslint-disable-line react-hooks/exhaustive-deps
  const [f, setF] = useState(goc);
  useEffect(() => { setF(goc); }, [goc]);
  if (!D.coSql27) return <div className="rounded-md border border-warn/40 bg-warn/5 px-3 py-2 text-sm">Chưa có bảng kế hoạch kho: quản trị cần chạy <b>sql/27_kho_ke_hoach.sql</b> trong Supabase.</div>;

  const giong = (a, b) => ["khu_key", "hang", "nhom", "huong", "ghi_chu"].every((k) => (a[k] || "").trim() === (b[k] || "").trim()) && (docSo(a.khoi_luong) || 0) === (docSo(b.khoi_luong) || 0);
  const gocTheo = new Map(goc.map((r) => [r.id, r]));
  const xoa = goc.filter((r) => !f.some((x) => x.id === r.id));
  const doi = f.filter((r) => (r.id ? !giong(r, gocTheo.get(r.id) || {}) : true)).length + xoa.length;
  const dat = (k, v) => setF((o) => o.map((r) => (r._k === k ? { ...r, ...v } : r)));
  const autoHang = (key) => { const hs = hangCua(dongTheoKey.get(key)); return hs.length === 1 ? hs[0] : ""; };
  const autoNhom = (key, hang) => {
    const d = dongTheoKey.get(key), h = hang || autoHang(key);
    return (h ? nhomCua(h, kho.hangHoa) : d?.nhomBai) || "";
  };
  const chonKhu = (k, key) => { const hang = autoHang(key); dat(k, { khu_key: key, hang, nhom: autoNhom(key, hang), mat: false }); };
  const chonHang = (r, hang) => dat(r._k, { hang, nhom: hang ? nhomCua(hang, kho.hangHoa) || r.nhom : autoNhom(r.khu_key, "") });
  const them = () => setF((o) => [...o, { _k: taoKey(), id: null, khu_key: "", hang: "", nhom: "", huong: "nhap", khoi_luong: "", ghi_chu: "" }]);
  const truoc = congThang(thang, -1);
  const dsTruoc = (D.khoKeHoach || []).filter((r) => r.thang === truoc && lienQuan(r) && khuCuaKeHoach(r, dong));
  const chep = () => setF((o) => [...o, ...dsTruoc.map((r) => { const d = khuCuaKeHoach(r, dong); return { _k: taoKey(), id: null, khu_key: d.key, hang: r.hang || "", nhom: r.nhom || "", huong: r.huong, khoi_luong: so(r.khoi_luong), ghi_chu: r.ghi_chu || "" }; })]);
  const luu = async () => {
    const out = { them: [], sua: [], xoa: xoa.map((r) => r.id) };
    for (const r of f) {
      if (!r.khu_key && !(r.khoi_luong || "").trim() && !r.id) continue; // dòng trống vừa thêm: bỏ qua
      const d = dongTheoKey.get(r.khu_key);
      if (!d) { toast("Chọn bãi nhỏ cho mọi dòng (hoặc bấm x để bỏ dòng)", "bad"); return; }
      const kl = docSo(r.khoi_luong);
      if (!(kl >= 0)) { toast(`${tenKhu(d)}: khối lượng phải là số tấn`, "bad"); return; }
      const hang = r.hang.trim() || autoHang(r.khu_key), nhom = r.nhom.trim() || autoNhom(r.khu_key, hang);
      const dl = { thang, ten_bai: d.ten_bai, khu_key: d.key, ten_khu: d.ten, hang: hang || null, nhom: nhom || null, huong: r.huong, khoi_luong: kl, ghi_chu: r.ghi_chu.trim() || null };
      if (!r.id) out.them.push(dl);
      else if (!giong(r, gocTheo.get(r.id) || {})) out.sua.push({ id: r.id, ...dl });
    }
    if (!out.them.length && !out.sua.length && !out.xoa.length) return;
    await run(() => api.saveKeHoachKho(out), `Đã lưu kế hoạch ${tenThang(thang).toLowerCase()}`);
  };
  const chonThang = (x) => { if (doi && !confirm("Có thay đổi chưa lưu. Bỏ thay đổi để chuyển tháng?")) return; setThang(x); };
  const tong = (h) => f.filter((r) => r.huong === h).reduce((s, r) => s + (docSo(r.khoi_luong) || 0), 0);
  const thuTu = new Map(dong.map((d, i) => [d.key, i]));
  const ds = [...f].sort((a, b) => (thuTu.get(a.khu_key) ?? 1e9) - (thuTu.get(b.khu_key) ?? 1e9) || (a.huong === b.huong ? 0 : a.huong === "nhap" ? -1 : 1));
  const khuOpts = dong.map((d) => [d.key, tenKhu(d)]);
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect className="h-8 w-40" value={thang} onChange={(e) => chonThang(e.target.value)} options={thangs.map((x) => [x, tenThang(x) + (x === thangCua(D.now) ? " (này)" : "")])} aria-label="Tháng kế hoạch" />
        {sua && dsTruoc.length > 0 && <Button size="sm" variant="outline" onClick={chep} title="Thêm các dòng kế hoạch của tháng trước vào bảng (chưa lưu)"><Copy />Chép kế hoạch {tenThang(truoc).toLowerCase()}</Button>}
        <div className="ml-auto flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <span><span className="text-muted-foreground">Kế hoạch nhập</span> <b className="tabular-nums text-ok">{so(tong("nhap"))}</b></span>
          <span><span className="text-muted-foreground">xuất</span> <b className="tabular-nums text-warn">{so(tong("xuat"))}</b></span>
          <span><span className="text-muted-foreground">chênh</span> <b className="tabular-nums">{so(tong("nhap") - tong("xuat"))} t</b></span>
        </div>
      </div>
      <div className="scroll-x max-h-[60vh] rounded-md border">
        <table className="tbl text-xs">
          <thead><tr><th className="min-w-[200px]">Tên bãi (bãi nhỏ)</th><th className="min-w-[170px]">Hàng hóa</th><th className="min-w-[130px]">Nhóm hàng</th><th>Hướng</th><th className="num">Khối lượng (t)</th><th className="min-w-[130px]">Ghi chú</th>{sua && <th className="w-8" />}</tr></thead>
          <tbody>
            {ds.map((r) => {
              const d = dongTheoKey.get(r.khu_key), hs = hangCua(d), g = r.id ? gocTheo.get(r.id) : null, sa = !g || !giong(r, g);
              const phHang = hs.length ? (hs.length === 1 ? hs[0] : `${hs.length} hàng trong bãi`) : "Hàng trong bãi", phNhom = autoNhom(r.khu_key, r.hang) || "Theo danh mục hàng";
              return (
                <tr key={r._k} className={cn(sa && sua && "bg-warn/5")}>
                  <td className="whitespace-nowrap">{sua
                    ? <NativeSelect className="h-8 w-full min-w-[190px]" value={r.khu_key} onChange={(e) => chonKhu(r._k, e.target.value)} placeholder="Chọn bãi nhỏ" options={khuOpts} aria-label="Bãi nhỏ" />
                    : <span className="font-medium">{d ? tenKhu(d) : `${r.ten_bai} › ${r.ten_khu}`}</span>}
                    {r.mat && <Badge tone="bad" className="ml-1" title="Bãi nhỏ này không còn trong Danh mục › Kho bãi">Bãi đã xóa: {r.ten_bai} › {r.ten_khu}</Badge>}</td>
                  <td>{sua ? <ChonGo className="min-w-[160px]" value={r.hang} onChange={(x) => chonHang(r, x)} options={hs} placeholder={phHang} /> : r.hang || <span className="text-muted-foreground">{phHang}</span>}</td>
                  <td>{sua ? <ChonGo className="min-w-[120px]" value={r.nhom} onChange={(x) => dat(r._k, { nhom: x })} options={nhoms} placeholder={phNhom} /> : r.nhom || <span className="text-muted-foreground">{phNhom}</span>}</td>
                  <td>{sua ? <NativeSelect className="h-8 w-24" value={r.huong} onChange={(e) => dat(r._k, { huong: e.target.value })} options={HUONG} aria-label="Hướng" /> : <Badge tone={r.huong === "nhap" ? "ok" : "warn"}>{r.huong === "nhap" ? "Nhập" : "Xuất"}</Badge>}</td>
                  <td className="num">{sua ? <Input className="ml-auto h-8 w-28 text-right tabular-nums" inputMode="decimal" value={r.khoi_luong} placeholder="0" onChange={(e) => dat(r._k, { khoi_luong: e.target.value })} aria-label="Khối lượng (t)" /> : so(docSo(r.khoi_luong) || 0)}</td>
                  <td>{sua ? <Input className="h-8" value={r.ghi_chu} onChange={(e) => dat(r._k, { ghi_chu: e.target.value })} aria-label="Ghi chú" /> : r.ghi_chu}</td>
                  {sua && <td className="w-8"><button type="button" className="rounded p-1 text-muted-foreground hover:text-bad" onClick={() => setF((o) => o.filter((x) => x._k !== r._k))} title="Xóa dòng" aria-label="Xóa dòng"><X className="size-4" /></button></td>}
                </tr>);
            })}
            {!ds.length && <tr><td colSpan={sua ? 7 : 6} className="py-4 text-center text-muted-foreground">Chưa có kế hoạch {tenThang(thang).toLowerCase()}. {sua ? "Bấm Thêm dòng, chọn bãi nhỏ, hướng, nhập khối lượng rồi bấm Lưu." : ""}</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-[11px] text-muted-foreground">Kế hoạch nhập / xuất cả tháng của từng bãi nhỏ. Để trống Hàng hóa hoặc Nhóm hàng thì tự điền theo hàng chứa trong bãi nhỏ và cột Nhóm của Danh mục › Hàng hóa. Tổng quan › Quản lý kho bãi › Kế hoạch so thực tế chia kế hoạch tháng theo ngày / cộng theo quý để so với sổ kho.</p>
        {sua && <Button size="sm" variant="outline" onClick={them}><Plus />Thêm dòng</Button>}
        {sua && <Button size="sm" disabled={!doi} onClick={luu}><Save />Lưu kế hoạch{doi ? ` (${doi} thay đổi)` : ""}</Button>}
      </div>
    </div>
  );
}
