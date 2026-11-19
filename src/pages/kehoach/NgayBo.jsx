import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ClipboardPaste, Plus, Save, X } from "lucide-react";
import { useApp } from "@/store";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { ChonGo } from "@/components/ui/combobox";
import { so, docSo, DAY } from "@/lib/format";
import { ngayDia } from "@/lib/keHoachNgay";
import { loChuaHang, r2 } from "@/lib/keHoachTH";
import HopDanNgayBo from "./HopDanNgayBo";

// Tab "Xuất / nhập đường bộ" của Kế hoạch ngày (anh Sỹ 20/11/2026): chọn NGÀY; mỗi dòng Tên hàng · Hướng (nhập / xuất) · Kho / bãi › gian / lô · Khối lượng.
// Chọn hướng thì ô kho / bãi › gian / lô chỉ liệt kê các gian / lô ĐANG CHỨA hàng đó (hàng chưa có tồn thì gợi ý gian / lô khai báo chứa hàng đó). Có Dán nhanh / Excel; Lưu ghi cả ngày (SQL 23).
let SO_DONG = 0;
const rong = () => ({ id: ++SO_DONG, hang: "", huong: "xuat", kho: "", tan: "" });
const khoaKho = (r) => `${r.ten_bai}|${r.ten_khu}`;

export default function NgayBo({ kho, sua, dsHang }) {
  const { api, run, D } = useApp();
  const [ngay, setNgay] = useState(() => ngayDia(D.now));
  const [daLuu, setDaLuu] = useState(undefined); // các dòng đã lưu của ngày; undefined: đang tải · null: chưa chạy SQL 23
  const [rows, setRows] = useState([]);
  const [lan, setLan] = useState(0);
  const [dan, setDan] = useState(false);
  useEffect(() => {
    let huy = false; setDaLuu(undefined);
    api.docKhNgayBo(ngay, ngay).then((r) => {
      if (huy) return;
      setDaLuu(r);
      setRows(r?.length ? r.map((x) => ({ id: ++SO_DONG, hang: x.hang, huong: x.huong, kho: khoaKho(x), tan: String(x.tan) })) : [rong()]);
    }).catch(() => { if (!huy) setDaLuu(null); });
    return () => { huy = true; };
  }, [api, ngay, lan]);
  const set = (id, k, v) => setRows((o) => o.map((r) => (r.id === id ? { ...r, [k]: v, ...(k === "hang" || k === "huong" ? { kho: "" } : {}) } : r)));
  // Các gian / lô chọn được cho một dòng: theo hàng và hướng (xuất: gian / lô đang chứa hàng; nhập: như vậy, hàng chưa có tồn thì gian / lô khai báo)
  const luaChon = (r) => {
    if (!r.hang.trim()) return [];
    const [ten_bai, ten_khu] = (r.kho || "").split("|");
    const ds = loChuaHang(kho, [r.hang], r.kho ? [{ ten_bai, ten_khu }] : []);
    return ds.map((x) => [khoaKho(x), `${x.ten_bai} › ${x.ten_khu}${x.ton > 0 ? ` (tồn ${so(x.ton, 0)} t)` : ""}`]);
  };
  const ghi = useMemo(() => rows.filter((r) => r.hang.trim() && (docSo(r.tan) || 0) > 0).map((r) => { const [ten_bai, ten_khu] = (r.kho || "").split("|"); return { hang: r.hang.trim(), huong: r.huong, ten_bai: ten_bai || "", ten_khu: ten_khu || "", tan: r2(docSo(r.tan)) }; }), [rows]);
  const tong = (h) => r2(ghi.filter((x) => x.huong === h).reduce((s, x) => s + x.tan, 0));
  const doi = useMemo(() => {
    const a = JSON.stringify(ghi.map((x) => [x.hang, x.huong, x.ten_bai, x.ten_khu, x.tan])), b = JSON.stringify((daLuu || []).map((x) => [x.hang, x.huong, x.ten_bai, x.ten_khu, +x.tan]));
    return a !== b;
  }, [ghi, daLuu]);
  const luu = async () => { if (await run(() => api.luuKhNgayBo(ngay, ghi), `Đã lưu kế hoạch đường bộ ngày ${ngay.slice(8)}/${ngay.slice(5, 7)}`)) setLan((n) => n + 1); };
  const dich = (n) => { if (doi && !confirm("Có số chưa lưu. Bỏ thay đổi để chuyển ngày?")) return; setNgay(ngayDia(new Date(ngay + "T00:00:00").getTime() + n * DAY)); };
  const dd = ngay.slice(8) + "/" + ngay.slice(5, 7) + "/" + ngay.slice(0, 4);
  if (daLuu === null) return <div className="rounded-md border border-warn/40 bg-warn/5 px-3 py-2 text-sm">Chưa có bảng kế hoạch ngày: quản trị chạy <b>sql/23_ke_hoach_ngay.sql</b> trong Supabase › SQL Editor rồi tải lại web.</div>;
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => dich(-1)} aria-label="Ngày trước"><ChevronLeft /></Button>
        <Input type="date" className="h-8 w-40" value={ngay} onChange={(e) => e.target.value && (!doi || confirm("Có số chưa lưu. Bỏ thay đổi để chuyển ngày?")) && setNgay(e.target.value)} aria-label="Ngày" />
        <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => dich(1)} aria-label="Ngày sau"><ChevronRight /></Button>
        {ngay !== ngayDia(D.now) && <Button size="xs" variant="ghost" onClick={() => setNgay(ngayDia(D.now))}>Hôm nay</Button>}
        <span className="text-xs text-muted-foreground">{daLuu === undefined ? "Đang tải…" : `Ngày ${dd}`}</span>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={!sua} onClick={() => setDan(true)}><ClipboardPaste />Dán nhanh / Excel</Button>
          {sua && <Button size="sm" disabled={!doi} onClick={luu}><Save />Lưu{doi ? " thay đổi" : ""}</Button>}
        </div>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <table className="tbl w-full text-sm">
          <thead><tr><th className="text-left">Tên hàng</th><th className="text-left">Hướng</th><th className="text-left">Vào / ra kho bãi › gian / lô</th><th className="text-right">Khối lượng (t)</th><th className="w-8" /></tr></thead>
          <tbody>
            {rows.map((r) => {
              const ds = luaChon(r);
              return (
                <tr key={r.id}>
                  <td className="min-w-[180px]"><ChonGo value={r.hang} onChange={(x) => set(r.id, "hang", x)} options={dsHang} placeholder="Tên hàng" disabled={!sua} inputClassName="h-8" /></td>
                  <td className="w-28"><NativeSelect className="h-8" value={r.huong} onChange={(e) => set(r.id, "huong", e.target.value)} options={[["nhap", "Nhập"], ["xuat", "Xuất"]]} disabled={!sua} aria-label="Hướng" /></td>
                  <td className="min-w-[240px]"><NativeSelect className="h-8" value={r.kho} onChange={(e) => set(r.id, "kho", e.target.value)} options={ds} placeholder={!r.hang.trim() ? "Chọn hàng trước" : ds.length ? "Chọn kho / bãi › gian / lô" : "Chưa có gian / lô chứa hàng này"} disabled={!sua || !ds.length} aria-label="Kho bãi gian lô" /></td>
                  <td className="w-32"><Input className="h-8 text-right tabular-nums" inputMode="decimal" value={r.tan} placeholder="0" disabled={!sua} onChange={(e) => set(r.id, "tan", e.target.value)} /></td>
                  <td className="text-center">{sua && <button type="button" onClick={() => setRows((o) => (o.length > 1 ? o.filter((x) => x.id !== r.id) : [rong()]))} className="rounded p-1 text-muted-foreground hover:text-bad" aria-label="Bỏ dòng"><X className="h-4 w-4" /></button>}</td>
                </tr>);
            })}
          </tbody>
          <tfoot><tr className="font-semibold"><td colSpan={3}>Cộng ngày {dd.slice(0, 5)}: nhập {so(tong("nhap"), 0)} t · xuất {so(tong("xuat"), 0)} t</td><td className="pr-4 text-right tabular-nums">{so(tong("nhap") + tong("xuat"), 0)}</td><td /></tr></tfoot>
        </table>
      </div>
      {sua && <Button size="sm" variant="outline" className="mt-2" onClick={() => setRows((o) => [...o, rong()])}><Plus />Thêm dòng</Button>}
      <p className="mt-2 text-[0.6875rem] text-muted-foreground">Chọn <b>hướng</b> (nhập / xuất) và <b>hàng</b> thì ô kho / bãi › gian / lô chỉ liệt kê các gian / lô đang chứa hàng đó (kèm tồn). Bấm Lưu để ghi cả ngày.</p>
      {dan && <HopDanNgayBo ngay={ngay} dd={dd} daLuu={daLuu || []} onClose={() => setDan(false)} onLuu={() => setLan((n) => n + 1)} />}
    </div>
  );
}
