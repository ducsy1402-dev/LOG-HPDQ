import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ClipboardPaste, Copy, Plus, Save, X } from "lucide-react";
import { useApp } from "@/store";
import { Input, NativeSelect } from "@/components/ui/input";
import { ChonGo } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { so, plain } from "@/lib/format";
import { docSo } from "@/lib/paste";
import { khuCuaKeHoach, nhomCua, ngayStr } from "@/lib/kho";
import { LOAI_KY, kyCuaNgay, kyHienTai, dichKy, nhanKy, thangCuaKy, ngayCuaKy, ngayDauKy, kyCua, cungKy, ngayCuaKeHoach, trungNgay } from "@/lib/keHoachKy";
import { cn } from "@/lib/utils";
import DanKeHoach from "./DanKeHoach";

// Kế hoạch xuất / nhập kho (nút Kế hoạch của trang Khai thác kho bãi): chọn kỳ NGÀY / TUẦN / THÁNG / NĂM, mỗi bãi nhỏ một dòng với hai ô: khối lượng nhập, khối lượng xuất (tấn).
// Mỗi ô có số là một dòng kế hoạch trong bảng kho_ke_hoach (hướng nhập / xuất); khối lượng chia đều theo ngày của kỳ khi vẽ biểu đồ và so với thực tế.
// Hàng hóa để trống thì tự điền theo hàng chứa trong bãi nhỏ; nhóm hàng theo Danh mục › Hàng hóa.
// Kỳ ngày / tuần / năm cần SQL 12 (cột loai_ky, ky); chưa chạy thì chỉ lập được kế hoạch tháng. Hai kỳ chồng nhau của cùng bãi nhỏ + hàng + hướng không cho lưu (khỏi tính trùng).
const tenKhu = (d) => `${d.ten_bai} › ${d.ten}`;
const hangCua = (d) => [...new Set([d?.hang, ...(d?.chua || []).map((c) => c.hang)].map((x) => String(x || "").trim()).filter(Boolean))];
const ss = (a, b) => String(a).localeCompare(String(b), "vi", { numeric: true, sensitivity: "base" });
const fmt = (v) => (v == null ? "" : so(v));

// Chọn kỳ: loại kỳ, nút kỳ trước / sau, ô chọn ngày / tháng / năm
export function ChonKy({ loai, ky, coKy, homNay, onDoi }) {
  const dsLoai = coKy ? LOAI_KY : LOAI_KY.filter(([k]) => k === "thang");
  // Đổi loại kỳ: lấy kỳ mới chứa hôm nay nếu kỳ đang xem chứa hôm nay, không thì chứa ngày đầu kỳ đang xem
  const doiLoai = (l) => onDoi(l, kyCuaNgay(l, ngayCuaKy(loai, ky).includes(homNay) ? homNay : ngayDauKy(loai, ky)));
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <NativeSelect className="h-7 w-24 text-xs" value={loai} onChange={(e) => doiLoai(e.target.value)} options={dsLoai} aria-label="Loại kỳ" />
      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => onDoi(loai, dichKy(loai, ky, -1))} aria-label="Kỳ trước" title="Kỳ trước"><ChevronLeft /></Button>
      {loai === "ngay" || loai === "tuan" ? <Input type="date" className="h-7 w-36 text-xs" value={ngayDauKy(loai, ky)} onChange={(e) => e.target.value && onDoi(loai, kyCuaNgay(loai, e.target.value))} aria-label="Ngày" />
        : loai === "thang" ? <Input type="month" className="h-7 w-36 text-xs" value={ky} onChange={(e) => e.target.value && onDoi(loai, e.target.value)} aria-label="Tháng" />
        : <Input type="number" className="h-7 w-24 text-xs" value={ky} min={2000} max={2100} onChange={(e) => /^\d{4}$/.test(e.target.value) && onDoi(loai, e.target.value)} aria-label="Năm" />}
      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => onDoi(loai, dichKy(loai, ky, 1))} aria-label="Kỳ sau" title="Kỳ sau"><ChevronRight /></Button>
      <Button size="xs" variant="ghost" onClick={() => onDoi(loai, kyHienTai(loai, homNay))}>Hôm nay</Button>
      <span className="text-xs font-medium text-muted-foreground">{nhanKy(loai, ky)}</span>
    </div>
  );
}

export default function KeHoachKho({ loai, kho, nhan = "" }) {
  const { D, quyen, api, run, toast } = useApp();
  const sua = quyen.kho.nhap, coKy = !!D.coSql12, homNay = ngayStr(D.now);
  const [loaiKy, setLoaiKy] = useState("thang"), [ky, setKy] = useState(() => kyHienTai("thang", ngayStr(D.now)));
  const [dan, setDan] = useState(false);
  const dong = useMemo(() => kho.dong.filter((d) => d.loai === loai && !d.saiBai).sort((a, b) => ss(a.ten_bai, b.ten_bai) || ss(a.ten, b.ten)), [kho, loai]);
  const dongTheoKey = useMemo(() => new Map(dong.map((d) => [d.key, d])), [dong]);
  const nhoms = useMemo(() => [...new Set((kho.hangHoa || []).map((h) => String(h.nhom ?? "").trim()).filter(Boolean))].sort(ss), [kho.hangHoa]);
  const dem = useRef(0);
  const taoKey = () => `n${++dem.current}`;
  // kho.dongAll có khi kho đã lọc theo tab: dòng thuộc gian / lô của tab khác thì bỏ qua, không tìm thấy ở đâu mới là "bãi đã xóa"
  const lienQuan = (r) => { const d = khuCuaKeHoach(r, (kho.dongAll || kho.dong).filter((x) => !x.saiBai)); return d ? (kho.dongAll ? dongTheoKey.has(d.key) : d.loai === loai) : true; };
  const autoHang = (key) => { const hs = hangCua(dongTheoKey.get(key)); return hs.length === 1 ? hs[0] : ""; };
  const autoNhom = (key, hang) => { const d = dongTheoKey.get(key), h = hang || autoHang(key); return (h ? nhomCua(h, kho.hangHoa) : d?.nhomBai) || ""; };

  // Dòng kế hoạch đã lưu của một kỳ → các dòng bảng: gộp nhập + xuất của cùng bãi nhỏ + hàng
  const dongCuaKy = (lk, k) => {
    const m = new Map();
    for (const r of D.khoKeHoach || []) {
      if (!cungKy(r, lk, k) || !lienQuan(r)) continue;
      const d = khuCuaKeHoach(r, dong), key = d?.key || `mat|${r.ten_bai}|${r.ten_khu}`, mk = `${key}|${plain(r.hang || "")}`;
      if (!m.has(mk)) m.set(mk, { _k: `d${mk}`, khu_key: d?.key || "", mat: !d, ten_bai: r.ten_bai, ten_khu: r.ten_khu, hang: r.hang || "", nhom: r.nhom || "", nhap: "", xuat: "", idNhap: null, idXuat: null, ghi_chu: "" });
      const o = m.get(mk);
      if (r.huong === "xuat") { o.xuat = so(r.khoi_luong); o.idXuat = r.id; } else { o.nhap = so(r.khoi_luong); o.idNhap = r.id; }
      if (r.ghi_chu) o.ghi_chu = r.ghi_chu;
    }
    return m;
  };
  // Bảng: mỗi bãi nhỏ của kho một dòng (có sẵn số đã lưu); dòng kế hoạch của bãi nhỏ đã xóa vẫn hiện để xóa được
  const goc = useMemo(() => {
    const m = dongCuaKy(loaiKy, ky), out = [], dung = new Set();
    for (const d of dong) {
      const co = [...m.entries()].filter(([, r]) => r.khu_key === d.key);
      if (!co.length) out.push({ _k: `b${d.key}`, khu_key: d.key, mat: false, hang: "", nhom: "", nhap: "", xuat: "", idNhap: null, idXuat: null, ghi_chu: "", coDinh: true });
      for (const [mk, r] of co) { out.push({ ...r, coDinh: true }); dung.add(mk); }
    }
    for (const [mk, r] of m) if (!dung.has(mk)) out.push({ ...r, coDinh: false });
    return out;
  }, [D.khoKeHoach, loaiKy, ky, dong, loai]); // eslint-disable-line react-hooks/exhaustive-deps
  const [f, setF] = useState(goc);
  useEffect(() => { setF(goc); }, [goc]);
  if (!D.coSql27) return <div className="rounded-md border border-warn/40 bg-warn/5 px-3 py-2 text-sm">Chưa có bảng kế hoạch kho: quản trị cần chạy <b>sql/dung_lai/phan_1_cau_truc.sql</b> trong Supabase.</div>;

  const giong = (a, b) => ["khu_key", "hang", "ghi_chu"].every((k) => String(a[k] || "").trim() === String(b[k] || "").trim()) && (docSo(a.nhap) || 0) === (docSo(b.nhap) || 0) && (docSo(a.xuat) || 0) === (docSo(b.xuat) || 0);
  const gocTheo = new Map(goc.map((r) => [r._k, r]));
  const xoaMat = goc.filter((r) => !r.coDinh && !f.some((x) => x._k === r._k)); // dòng bãi đã xóa bị bỏ khỏi bảng
  const dat = (k, v) => setF((o) => o.map((r) => (r._k === k ? { ...r, ...v } : r)));
  const doi = f.filter((r) => { const g = gocTheo.get(r._k); return g ? !giong(r, g) : (docSo(r.nhap) > 0 || docSo(r.xuat) > 0); }).length + xoaMat.length;
  const chonHang = (r, hang) => dat(r._k, { hang, nhom: hang ? nhomCua(hang, kho.hangHoa) || r.nhom : "" });
  const them = () => setF((o) => [...o, { _k: taoKey(), khu_key: "", mat: false, hang: "", nhom: "", nhap: "", xuat: "", idNhap: null, idXuat: null, ghi_chu: "", coDinh: false }]);
  const doiKy = (lk, k) => { if (doi && !confirm("Có thay đổi chưa lưu. Bỏ thay đổi để chuyển kỳ?")) return; setLoaiKy(lk); setKy(k); };
  const kyTruoc = dichKy(loaiKy, ky, -1), mTruoc = dongCuaKy(loaiKy, kyTruoc);
  // Chép số của kỳ liền trước vào bảng (chưa lưu)
  const chep = () => setF((o) => {
    let n = o;
    for (const r of mTruoc.values()) {
      if (!r.khu_key) continue;
      const cungHang = n.findIndex((x) => x.khu_key === r.khu_key && plain(x.hang || "") === plain(r.hang || "") && x.coDinh);
      const i = cungHang >= 0 ? cungHang : n.findIndex((x) => x.khu_key === r.khu_key && !x.hang && !x.nhap && !x.xuat && x.coDinh);
      const mau = { nhap: r.nhap, xuat: r.xuat, hang: r.hang, nhom: r.nhom, ghi_chu: r.ghi_chu };
      if (i >= 0) n = n.map((x, j) => (j === i ? { ...x, ...mau } : x));
      else n = [...n, { _k: taoKey(), khu_key: r.khu_key, mat: false, idNhap: null, idXuat: null, coDinh: false, ...mau }];
    }
    return n;
  });
  // Đưa số từ Dán nhanh / Excel vào bảng (chưa lưu)
  const apDung = (ds) => setF((o) => {
    let n = o;
    for (const x of ds) {
      const key = x.khu.key, hang = x.hang;
      let i = n.findIndex((r) => r.khu_key === key && (!hang || plain(r.hang || "") === plain(hang) || !r.hang) && !r.mat);
      const mau = { ...(x.nhap != null ? { nhap: so(x.nhap) } : {}), ...(x.xuat != null ? { xuat: so(x.xuat) } : {}), ...(hang ? { hang } : {}), ...(x.ghi_chu ? { ghi_chu: x.ghi_chu } : {}) };
      if (i >= 0) n = n.map((r, j) => (j === i ? { ...r, ...mau } : r));
      else n = [...n, { _k: taoKey(), khu_key: key, mat: false, nhom: "", nhap: "", xuat: "", idNhap: null, idXuat: null, ghi_chu: "", coDinh: false, ...mau }];
    }
    return n;
  });

  const luu = async () => {
    const out = { them: [], sua: [], xoa: xoaMat.flatMap((r) => [r.idNhap, r.idXuat].filter(Boolean)) };
    const ngayKy = new Set(ngayCuaKy(loaiKy, ky)), viTri = new Map(); // viTri: bãi nhỏ + hàng đã gặp trong bảng
    for (const r of f) {
      const g = gocTheo.get(r._k), d = dongTheoKey.get(r.khu_key);
      const nhapS = String(r.nhap || "").trim(), xuatS = String(r.xuat || "").trim();
      if (!r.khu_key && !nhapS && !xuatS && !r.idNhap && !r.idXuat) continue; // dòng trống vừa thêm: bỏ qua
      if (r.mat) { if (!nhapS && !xuatS) { out.xoa.push(...[r.idNhap, r.idXuat].filter(Boolean)); } continue; }
      if (!d) { toast("Chọn bãi nhỏ cho mọi dòng (hoặc bấm x để bỏ dòng)", "bad"); return; }
      const kN = docSo(nhapS), kX = docSo(xuatS);
      if ((nhapS && (kN == null || !(kN >= 0))) || (xuatS && (kX == null || !(kX >= 0)))) { toast(`${tenKhu(d)}: khối lượng phải là số tấn`, "bad"); return; }
      const hang = String(r.hang || "").trim() || autoHang(r.khu_key), nhom = String(r.nhom || "").trim() || autoNhom(r.khu_key, hang);
      const trungDong = `${r.khu_key}|${plain(hang)}`;
      if (viTri.has(trungDong) && (kN > 0 || kX > 0)) { toast(`${tenKhu(d)}${hang ? ` · ${hang}` : ""} có hai dòng trong bảng: gộp thành một dòng`, "bad"); return; }
      viTri.set(trungDong, true);
      const nen = { thang: thangCuaKy(loaiKy, ky), ten_bai: d.ten_bai, khu_key: d.key, ten_khu: d.ten, hang: hang || null, nhom: nhom || null, ghi_chu: String(r.ghi_chu || "").trim() || null, ...(coKy ? { loai_ky: loaiKy, ky } : {}) };
      const doiNen = !g || !giong({ ...r, nhap: "", xuat: "" }, { ...g, nhap: "", xuat: "" }); // đổi bãi / hàng / ghi chú: ghi lại cả hai hướng
      for (const [huong, kl, id, cu] of [["nhap", kN, r.idNhap, g?.nhap], ["xuat", kX, r.idXuat, g?.xuat]]) {
        const co = kl > 0;
        if (!co) { if (id) out.xoa.push(id); continue; }
        if (!id) out.them.push({ ...nen, huong, khoi_luong: kl });
        else if (doiNen || (docSo(cu) || 0) !== kl) out.sua.push({ id, ...nen, huong, khoi_luong: kl });
      }
    }
    // Không cho hai kỳ chồng nhau của cùng bãi nhỏ + hàng + hướng (khỏi tính trùng kế hoạch)
    const dangSua = new Set(f.flatMap((r) => [r.idNhap, r.idXuat]).filter(Boolean));
    const khac = (D.khoKeHoach || []).filter((r) => !dangSua.has(r.id) && !out.xoa.includes(r.id));
    for (const m of [...out.them, ...out.sua]) {
      const hit = khac.find((r) => r.huong === m.huong && (r.khu_key === m.khu_key || (plain(r.ten_bai) === plain(m.ten_bai) && plain(r.ten_khu) === plain(m.ten_khu))) && plain(r.hang || "") === plain(m.hang || "") && trungNgay(ngayCuaKeHoach(r), [...ngayKy]));
      if (hit) { const k = kyCua(hit); toast(`${m.ten_bai} › ${m.ten_khu}: ${m.huong === "xuat" ? "xuất" : "nhập"} đã có kế hoạch ${nhanKy(k.loai, k.ky).toLowerCase()} trùng thời gian với ${nhanKy(loaiKy, ky).toLowerCase()}. Sửa hoặc xóa kế hoạch kia trước.`, "bad"); return; }
    }
    if (!out.them.length && !out.sua.length && !out.xoa.length) return;
    await run(() => api.saveKeHoachKho(out), `Đã lưu kế hoạch ${nhanKy(loaiKy, ky).toLowerCase()}`);
  };
  const tong = (c) => f.reduce((s, r) => s + (docSo(r[c]) || 0), 0);
  const khuOpts = dong.map((d) => [d.key, tenKhu(d)]);
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <ChonKy loai={loaiKy} ky={ky} coKy={coKy} homNay={homNay} onDoi={doiKy} />
        {sua && <Button size="xs" variant="outline" onClick={() => setDan(true)} title="Dán bảng từ Excel hoặc chọn file Excel"><ClipboardPaste />Dán nhanh / Excel</Button>}
        {sua && mTruoc.size > 0 && <Button size="xs" variant="outline" onClick={chep} title="Đưa số của kỳ liền trước vào bảng (chưa lưu)"><Copy />Chép {nhanKy(loaiKy, kyTruoc).toLowerCase()}</Button>}
        <div className="ml-auto flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <span><span className="text-muted-foreground">Nhập</span> <b className="tabular-nums text-ok">{so(tong("nhap"))}</b></span>
          <span><span className="text-muted-foreground">Xuất</span> <b className="tabular-nums text-warn">{so(tong("xuat"))}</b></span>
          <span><span className="text-muted-foreground">chênh</span> <b className="tabular-nums">{so(tong("nhap") - tong("xuat"))} t</b></span>
        </div>
      </div>
      {!coKy && <p className="rounded-md border border-warn/40 bg-warn/5 px-3 py-1.5 text-xs">Chỉ lập được kế hoạch theo tháng. Quản trị chạy <b>sql/12_bai_nho_ke_hoach_ky.sql</b> trong Supabase để lập theo ngày / tuần / năm.</p>}
      <div className="scroll-x max-h-[60vh] rounded-md border">
        <table className="tbl text-xs">
          <thead><tr><th className="min-w-[200px]">Bãi nhỏ</th><th className="min-w-[170px]">Hàng hóa</th><th className="num">Nhập (t)</th><th className="num">Xuất (t)</th><th>Ghi chú</th>{sua && <th></th>}</tr></thead>
          <tbody>
            {f.map((r) => {
              const d = dongTheoKey.get(r.khu_key), hs = hangCua(d), g = gocTheo.get(r._k), sa = g ? !giong(r, g) : docSo(r.nhap) > 0 || docSo(r.xuat) > 0;
              const phHang = hs.length ? (hs.length === 1 ? hs[0] : `${hs.length} hàng trong bãi nhỏ`) : "Hàng trong bãi nhỏ";
              return (
                <tr key={r._k} className={cn(sa && sua && "bg-warn/5")}>
                  <td className="whitespace-nowrap">{sua && !r.coDinh
                    ? <NativeSelect className="h-8 w-full min-w-[190px]" value={r.khu_key} onChange={(e) => dat(r._k, { khu_key: e.target.value, hang: autoHang(e.target.value), mat: false })} placeholder="Chọn bãi nhỏ" options={khuOpts} aria-label="Bãi nhỏ" />
                    : <span className="font-medium">{d ? tenKhu(d) : `${r.ten_bai} › ${r.ten_khu}`}</span>}
                    {r.mat && <Badge tone="bad" className="ml-1" title="Bãi nhỏ này không còn trong Danh mục › Kho bãi">Bãi đã xóa</Badge>}</td>
                  <td>{sua ? <ChonGo className="min-w-[160px]" value={r.hang} onChange={(x) => chonHang(r, x)} options={hs} placeholder={phHang} /> : r.hang || <span className="text-muted-foreground">{phHang}</span>}</td>
                  <td className="num">{sua ? <Input className="ml-auto h-8 w-28 text-right tabular-nums" inputMode="decimal" value={r.nhap} placeholder="0" onChange={(e) => dat(r._k, { nhap: e.target.value })} aria-label="Khối lượng nhập" /> : r.nhap}</td>
                  <td className="num">{sua ? <Input className="ml-auto h-8 w-28 text-right tabular-nums" inputMode="decimal" value={r.xuat} placeholder="0" onChange={(e) => dat(r._k, { xuat: e.target.value })} aria-label="Khối lượng xuất" /> : r.xuat}</td>
                  <td>{sua ? <Input className="h-8" value={r.ghi_chu} onChange={(e) => dat(r._k, { ghi_chu: e.target.value })} aria-label="Ghi chú" /> : r.ghi_chu}</td>
                  {sua && <td className="w-8">{!r.coDinh && <button type="button" className="rounded p-1 text-muted-foreground hover:text-bad" onClick={() => setF((o) => o.filter((x) => x._k !== r._k))} title="Bỏ dòng" aria-label="Bỏ dòng"><X className="h-4 w-4" /></button>}</td>}
                </tr>);
            })}
            {!f.length && <tr><td colSpan={sua ? 6 : 5} className="py-4 text-center text-muted-foreground">Kho này chưa có bãi nhỏ nào. Thêm ở Danh mục › Kho bãi.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-[0.6875rem] text-muted-foreground">Mỗi bãi nhỏ một dòng: nhập khối lượng nhập và / hoặc khối lượng xuất của kỳ (tấn), ô trống là không có kế hoạch. Hàng hóa để trống thì tự điền theo hàng chứa trong bãi nhỏ. Cần thêm hàng khác cho cùng bãi nhỏ thì bấm Thêm dòng.</p>
        {sua && <Button size="sm" variant="outline" onClick={them}><Plus />Thêm dòng</Button>}
        {sua && <Button size="sm" disabled={!doi} onClick={luu}><Save />Lưu kế hoạch{doi ? ` (${doi} thay đổi)` : ""}</Button>}
      </div>
      {dan && <DanKeHoach dong={dong} nhan={`${nhan ? nhan + " · " : ""}${nhanKy(loaiKy, ky).toLowerCase()}`} onApDung={apDung} onClose={() => setDan(false)} />}
    </div>
  );
}
