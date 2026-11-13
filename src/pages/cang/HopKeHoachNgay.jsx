import { useEffect, useMemo, useState } from "react";
import { Eraser, Save, Wand2 } from "lucide-react";
import { useApp } from "@/store";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Empty } from "@/components/common";
import { so, soGon, plain, thangCua, tenThang, congThang } from "@/lib/format";
import { docSo } from "@/lib/paste";
import { ngayCuaThang } from "@/lib/sanLuongTT";
import { dongHang } from "@/lib/sanLuong";
import { klCanLam, trangThai, TRANG_THAI } from "@/lib/linetime";
import { ngayCuaChuyen, chiaDeuTheoGio, ngayDia } from "@/lib/keHoachNgay";
import { cn } from "@/lib/utils";
import { useNhomHang } from "./useNhomHang";

// Kế hoạch ngày (nút "Kế hoạch ngày" của Mục tiêu sản lượng › Khai thác cảng, SQL 13): LINE TÀU CẬP của tháng, mỗi chuyến một dòng, mỗi ngày một ô.
// Người lập kế hoạch đặt số tấn kế hoạch cho từng ngày của từng tàu (ô chỉ mở trong các ngày tàu ở bến); lọc theo loại hàng và hướng.
// "Chia đều" điền khối lượng cần làm của tàu theo giờ làm hàng dự kiến; xóa số trong ô là xóa kế hoạch ngày đó. Nhập liệu trở lên sửa được.
const THU = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const fmt = (n) => (n ? soGon(n) : "");
const gio = (t) => (t ? new Date(t).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");

export default function HopKeHoachNgay({ thang0, onClose, onLuu }) {
  const { D, api, quyen, run, toast } = useApp();
  const nhomHang = useNhomHang(), nhap = quyen.nhap;
  const [thang, setThang] = useState(thang0 || thangCua(D.now));
  const [loc, setLoc] = useState({ nhom: "", huong: "" });
  const [rows, setRows] = useState(undefined); // undefined: đang tải · null: chưa chạy SQL 13
  const [lan, setLan] = useState(0);
  const [sua, setSua] = useState({}); // ô đã gõ: "mã chuyến|ngày" -> chữ
  const ngays = useMemo(() => ngayCuaThang(thang), [thang]);
  const homNay = ngayDia(D.now);
  useEffect(() => {
    let huy = false; setRows(undefined); setSua({});
    api.docKeHoachNgay(ngays[0], ngays[ngays.length - 1]).then((r) => { if (!huy) setRows(r); }).catch(() => { if (!huy) setRows(null); });
    return () => { huy = true; };
  }, [api, ngays, lan]);

  const goc = useMemo(() => { const m = {}; for (const r of rows || []) m[`${r.voyage_id}|${String(r.ngay).slice(0, 10)}`] = +r.khoi_luong || 0; return m; }, [rows]);
  // Line tàu: chuyến chiếm bến trong tháng, theo giờ cập; lọc theo loại hàng (nhóm hàng) và hướng
  const tatCa = useMemo(() => {
    const t = new Set(ngays);
    return D.voyages.filter((v) => !v.huy).map((v) => ({ v, ben: ngayCuaChuyen(v), dong: dongHang(v, nhomHang) }))
      .filter((x) => x.ben.some((n) => t.has(n)) || ngays.some((n) => `${x.v.id}|${n}` in goc))
      .sort((a, b) => (new Date(a.v.atb || a.v.etb || a.v.eta).getTime() || 0) - (new Date(b.v.atb || b.v.etb || b.v.eta).getTime() || 0));
  }, [D.voyages, nhomHang, ngays, goc]);
  const dsNhom = useMemo(() => [...new Set(tatCa.flatMap((x) => x.dong.map((h) => h.loai)))].sort((a, b) => a.localeCompare(b, "vi")), [tatCa]);
  const tau = useMemo(() => tatCa.filter((x) => (!loc.huong || (x.v.huong === "xuat" ? "xuat" : "nhap") === loc.huong) && (!loc.nhom || x.dong.some((h) => plain(h.loai) === plain(loc.nhom)))), [tatCa, loc]);

  const key = (v, n) => `${v.id}|${n}`;
  const giaTri = (k) => (k in sua ? docSo(sua[k]) || 0 : goc[k] || 0);
  const hienThi = (k) => (k in sua ? sua[k] : fmt(goc[k]));
  const kDirty = Object.keys(sua).filter((k) => (sua[k] || "").trim() !== fmt(goc[k]));
  const tongTau = (v) => ngays.reduce((s, n) => s + giaTri(key(v, n)), 0);
  const tongNgay = (n, h) => tau.filter((x) => (x.v.huong === "xuat" ? "xuat" : "nhap") === h).reduce((s, x) => s + giaTri(key(x.v, n)), 0);
  const chiaDeu = (v) => {
    const m = chiaDeuTheoGio(v), moi = {};
    for (const n of ngays) { const k = key(v, n), tan = m.get(n) || 0; if (tan > 0 || goc[k]) moi[k] = tan > 0 ? soGon(tan) : ""; }
    setSua((o) => ({ ...o, ...moi }));
  };
  const xoaTau = (v) => setSua((o) => { const n = { ...o }; for (const d of ngays) if (goc[key(v, d)] || key(v, d) in o) n[key(v, d)] = ""; return n; });
  const luu = async () => {
    const out = [];
    for (const k of kDirty) {
      const [vid, ngay] = k.split("|"), txt = (sua[k] || "").trim(), tan = txt ? docSo(txt) : null;
      if (txt && !(tan >= 0)) return toast(`Ngày ${ngay.slice(8)}/${ngay.slice(5, 7)}: "${txt}" không phải số tấn`, "bad");
      if (tan == null && !(k in goc)) continue;
      out.push({ voyage_id: +vid, ngay, khoi_luong: tan });
    }
    if (!out.length) { setSua({}); return; }
    if (await run(() => api.saveKeHoachNgay(out), `Đã lưu kế hoạch ngày (${out.length} ô)`)) { setLan((x) => x + 1); onLuu?.(); }
  };

  return (
    <Dialog onOpenChange={(o) => !o && onClose()} className="max-w-[min(1600px,calc(100vw-24px))]" title="Kế hoạch sản lượng theo ngày"
      description="Line tàu cập trong tháng: đặt số tấn kế hoạch cho từng ngày của từng tàu. Ô chỉ mở trong các ngày tàu ở bến.">
      {rows === null ? <div className="rounded-md border border-warn/40 bg-warn/5 px-3 py-2 text-sm">Chưa có bảng kế hoạch ngày: quản trị cần chạy <b>sql/13_ke_hoach_san_luong_ngay.sql</b> trong Supabase.</div> : (
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <NativeSelect className="h-7 w-44 text-xs" value={thang} onChange={(e) => { if (kDirty.length && !confirm("Có số chưa lưu. Bỏ thay đổi để chuyển tháng?")) return; setThang(e.target.value); }} aria-label="Tháng"
              options={Array.from({ length: 13 }, (_, i) => congThang(thangCua(D.now), i - 6)).map((x) => [x, tenThang(x) + (x === thangCua(D.now) ? " (này)" : "")])} />
            <NativeSelect className="h-7 w-44 text-xs" value={loc.nhom} onChange={(e) => setLoc({ ...loc, nhom: e.target.value })} placeholder="Tất cả loại hàng" options={dsNhom} aria-label="Lọc theo loại hàng" />
            <NativeSelect className="h-7 w-32 text-xs" value={loc.huong} onChange={(e) => setLoc({ ...loc, huong: e.target.value })} placeholder="Nhập + xuất" options={[["nhap", "Hàng nhập"], ["xuat", "Hàng xuất"]]} aria-label="Lọc theo hướng" />
            <span className="text-xs text-muted-foreground">{rows === undefined ? "Đang tải…" : `${tau.length} chuyến`}</span>
            <div className="ml-auto flex items-center gap-2">
              {kDirty.length > 0 && <Button size="sm" variant="outline" onClick={() => setSua({})}>Bỏ thay đổi</Button>}
              {nhap && <Button size="sm" disabled={!kDirty.length} onClick={luu}><Save />Lưu kế hoạch{kDirty.length ? ` (${kDirty.length} ô)` : ""}</Button>}
            </div>
          </div>
          {tau.length ? (
            <div className="scroll-x max-h-[68vh] rounded-md border">
              <table className="tbl text-xs" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
                <thead>
                  <tr style={{ position: "sticky", top: 0, zIndex: 4 }} className="bg-card">
                    <th style={{ position: "sticky", left: 0, zIndex: 5, minWidth: 250 }} className="bg-card">Tàu · hàng</th>
                    <th className="num bg-card">KL tàu (t)</th><th className="num bg-card">Σ kế hoạch</th>
                    {ngays.map((n) => { const d = new Date(n + "T00:00:00"), cn0 = d.getDay() === 0, hn = n === homNay;
                      return <th key={n} className={cn("num min-w-[68px] border-l bg-card", hn && "bg-primary/10", cn0 && !hn && "bg-muted/60")}>{n.slice(8)}/{n.slice(5, 7)}<div className={cn("text-[0.6875rem] font-normal", cn0 ? "text-bad" : "text-muted-foreground")}>{THU[d.getDay()]}{hn ? " · nay" : ""}</div></th>; })}
                  </tr>
                </thead>
                <tbody>
                  {tau.map(({ v, ben, dong }) => {
                    const st = TRANG_THAI[trangThai(v, D.now)], kl = klCanLam(v), tong = tongTau(v), tapBen = new Set(ben);
                    return (
                      <tr key={v.id}>
                        <td style={{ position: "sticky", left: 0, zIndex: 2 }} className="border-t bg-card">
                          <div className="flex items-center gap-1.5">
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: st.mau }} title={st.ten} />
                            <b className="truncate">{v.ten_tau}</b><Badge tone={v.huong === "xuat" ? "warn" : "info"} className="shrink-0">{v.huong === "xuat" ? "Xuất" : "Nhập"}</Badge>
                            {nhap && <><button type="button" onClick={() => chiaDeu(v)} className="ml-auto rounded p-1 text-muted-foreground hover:text-primary" title="Chia đều khối lượng tàu theo giờ làm hàng dự kiến" aria-label={`Chia đều ${v.ten_tau}`}><Wand2 className="h-3.5 w-3.5" /></button>
                              <button type="button" onClick={() => xoaTau(v)} className="rounded p-1 text-muted-foreground hover:text-bad" title="Xóa kế hoạch của tàu trong tháng" aria-label={`Xóa kế hoạch ${v.ten_tau}`}><Eraser className="h-3.5 w-3.5" /></button></>}
                          </div>
                          <div className="truncate text-[0.6875rem] text-muted-foreground">{[...new Set(dong.map((h) => h.loai))].join(", ") || v.ten_hang || "—"} · {v.ben_ma || "chưa bến"} · {gio(v.atb || v.etb || v.eta)}</div>
                        </td>
                        <td className="num border-t tabular-nums">{so(kl, 0)}</td>
                        <td className={cn("num border-t font-semibold tabular-nums", kl > 0 && tong > kl + 1 && "text-bad")} title={kl > 0 && tong > kl + 1 ? "Kế hoạch trong tháng vượt khối lượng tàu" : undefined}>{tong ? so(tong, 0) : ""}</td>
                        {ngays.map((n) => {
                          const k = key(v, n), mo = tapBen.has(n) || k in goc, co = k in sua && sua[k].trim() !== fmt(goc[k]), hn = n === homNay;
                          return (
                            <td key={n} className={cn("num border-l border-t p-0.5", !mo && "bg-muted/30", co && "bg-warn/10", hn && !co && mo && "bg-primary/5")}>
                              {!mo ? null : nhap
                                ? <input className="h-7 w-16 rounded border border-transparent bg-transparent px-1 text-right tabular-nums hover:border-input focus:border-ring focus:bg-background focus:outline-none" inputMode="decimal" value={hienThi(k)} onChange={(e) => setSua((o) => ({ ...o, [k]: e.target.value }))} aria-label={`${v.ten_tau} ngày ${n.slice(8)}`} />
                                : <span className="px-1">{hienThi(k)}</span>}
                            </td>);
                        })}
                      </tr>);
                  })}
                </tbody>
                <tfoot style={{ position: "sticky", bottom: 0, zIndex: 4 }}>
                  {[["nhap", "Cộng nhập"], ["xuat", "Cộng xuất"]].filter(([h]) => !loc.huong || loc.huong === h).map(([h, ten]) => (
                    <tr key={h} className="bg-card font-semibold"><td style={{ position: "sticky", left: 0, zIndex: 5 }} className="border-t bg-card">{ten}</td><td className="border-t bg-card" /><td className="num border-t bg-card tabular-nums">{so(ngays.reduce((s, n) => s + tongNgay(n, h), 0), 0)}</td>
                      {ngays.map((n) => <td key={n} className="num border-l border-t bg-card tabular-nums">{tongNgay(n, h) ? so(tongNgay(n, h), 0) : ""}</td>)}</tr>))}
                </tfoot>
              </table>
            </div>
          ) : rows === undefined ? null : <Empty>Không có chuyến tàu nào trong {tenThang(thang).toLowerCase()}{loc.nhom || loc.huong ? " ứng với bộ lọc" : ""}. Thêm chuyến ở Khai thác Cảng › Linetime.</Empty>}
          <p className="text-[0.6875rem] text-muted-foreground">{nhap ? "Gõ số tấn kế hoạch của tàu trong ngày (vd 12.500). Biểu tượng cây đũa phép chia đều khối lượng tàu theo giờ làm hàng dự kiến; cục tẩy xóa kế hoạch của tàu trong tháng. Bấm Lưu kế hoạch để ghi. Số này là kế hoạch của biểu đồ; chưa đặt thì biểu đồ dùng mục tiêu tháng chia đều." : "Vai trò Xem chỉ xem kế hoạch."}</p>
        </div>)}
    </Dialog>
  );
}
