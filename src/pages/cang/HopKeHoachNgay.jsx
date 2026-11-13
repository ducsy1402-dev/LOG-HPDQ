import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Eraser, Save, Wand2 } from "lucide-react";
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
import { ngayCuaChuyen, chiaDeuTheoGio, thucTeNgay, ngayDia } from "@/lib/keHoachNgay";
import { cn } from "@/lib/utils";
import { useNhomHang } from "./useNhomHang";

// Kế hoạch ngày (nút "Kế hoạch ngày" của Mục tiêu sản lượng › Khai thác cảng, SQL 13): LINE TÀU CẬP của tháng, mỗi chuyến một dòng, mỗi ngày một ô.
// Người lập kế hoạch đặt số tấn kế hoạch cho từng ngày của từng tàu (ô chỉ mở trong các ngày tàu ở bến). Nhập liệu trở lên sửa được.
// Thao tác nhanh (13/11/2026): chỉ hiện một CỬA SỔ 7 / 14 ngày hoặc cả tháng, nút ◀ ▶ đổi cửa sổ (khỏi kéo thanh ngang); phím mũi tên / Enter chuyển ô;
// dán từ Excel (Ctrl+V) vào một ô thì điền các ô kế tiếp; "chia đều" điền khối lượng tàu theo giờ làm hàng dự kiến; chỉ hiện tàu có mặt trong cửa sổ.
// Lọc hướng và loại hàng áp cho cả các dòng cộng: dòng Kế hoạch nhập / xuất và Thực nhập / xuất ở cuối (thực tế = bảng san_luong_cang).
const THU = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const fmt = (n) => (n ? soGon(n) : "");
const gio = (t) => (t ? new Date(t).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");
const hDua = (v) => (v.huong === "xuat" ? "xuat" : "nhap");

export default function HopKeHoachNgay({ thang0, onClose, onLuu }) {
  const { D, api, quyen, run, toast } = useApp();
  const nhomHang = useNhomHang(), nhap = quyen.nhap;
  const [thang, setThang] = useState(thang0 || thangCua(D.now));
  const [loc, setLoc] = useState({ nhom: "", huong: "" });
  const [rows, setRows] = useState(undefined); // kế hoạch đã lưu; undefined: đang tải · null: chưa chạy SQL 13
  const [thucTe, setThucTe] = useState([]);
  const [lan, setLan] = useState(0);
  const [sua, setSua] = useState({}); // ô đã gõ: "mã chuyến|ngày" -> chữ
  const [cua, setCua] = useState({ co: 14, bat: 0 }); // cửa sổ ngày: số ngày (31 = cả tháng) và vị trí ngày đầu
  const khung = useRef();
  const ngays = useMemo(() => ngayCuaThang(thang), [thang]);
  const homNay = ngayDia(D.now);
  useEffect(() => { // đổi tháng: cửa sổ về đầu tháng, hoặc quanh hôm nay nếu là tháng này
    const i = ngays.indexOf(homNay);
    setCua((c) => ({ ...c, bat: i >= 0 && c.co < 31 ? Math.max(0, Math.min(i - 2, ngays.length - c.co)) : 0 }));
  }, [ngays]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    let huy = false; setRows(undefined); setSua({});
    Promise.all([api.docKeHoachNgay(ngays[0], ngays[ngays.length - 1]), api.docSanLuongThang("cang", thang).catch(() => null)])
      .then(([r, sl]) => { if (!huy) { setRows(r); setThucTe(sl?.thucTe || []); } }).catch(() => { if (!huy) setRows(null); });
    return () => { huy = true; };
  }, [api, ngays, thang, lan]);

  const goc = useMemo(() => { const m = {}; for (const r of rows || []) m[`${r.voyage_id}|${String(r.ngay).slice(0, 10)}`] = +r.khoi_luong || 0; return m; }, [rows]);
  // Line tàu: chuyến chiếm bến trong tháng, theo giờ cập; lọc theo loại hàng (nhóm hàng) và hướng
  const tatCa = useMemo(() => {
    const t = new Set(ngays);
    return D.voyages.filter((v) => !v.huy).map((v) => ({ v, ben: ngayCuaChuyen(v), dong: dongHang(v, nhomHang) }))
      .filter((x) => x.ben.some((n) => t.has(n)) || ngays.some((n) => `${x.v.id}|${n}` in goc))
      .sort((a, b) => (new Date(a.v.atb || a.v.etb || a.v.eta).getTime() || 0) - (new Date(b.v.atb || b.v.etb || b.v.eta).getTime() || 0));
  }, [D.voyages, nhomHang, ngays, goc]);
  const dsNhom = useMemo(() => [...new Set(tatCa.flatMap((x) => x.dong.map((h) => h.loai)))].sort((a, b) => a.localeCompare(b, "vi")), [tatCa]);
  const loc2 = useMemo(() => tatCa.filter((x) => (!loc.huong || hDua(x.v) === loc.huong) && (!loc.nhom || x.dong.some((h) => plain(h.loai) === plain(loc.nhom)))), [tatCa, loc]);
  const size = Math.min(cua.co, ngays.length), bat = Math.max(0, Math.min(cua.bat, ngays.length - size)), hien = ngays.slice(bat, bat + size);
  const tapHien = useMemo(() => new Set(hien), [hien]);
  // Chỉ hiện tàu có mặt trong cửa sổ (ở bến hoặc đã có kế hoạch trong các ngày đang xem)
  const tau = useMemo(() => loc2.filter((x) => x.ben.some((n) => tapHien.has(n)) || hien.some((n) => `${x.v.id}|${n}` in goc)), [loc2, tapHien, hien, goc]);

  const key = (v, n) => `${v.id}|${n}`;
  const giaTri = (k) => (k in sua ? docSo(sua[k]) || 0 : goc[k] || 0);
  const hienThi = (k) => (k in sua ? sua[k] : fmt(goc[k]));
  const kDirty = Object.keys(sua).filter((k) => (sua[k] || "").trim() !== fmt(goc[k]));
  const tongTau = (v) => ngays.reduce((s, n) => s + giaTri(key(v, n)), 0);
  // Phần của chuyến thuộc loại hàng đang lọc (chuyến nhiều dòng hàng chia theo khối lượng từng dòng); không lọc = cả chuyến
  const phan = (x) => {
    if (!loc.nhom) return 1;
    const tong = x.dong.reduce((s, h) => s + h.kl, 0), c = x.dong.filter((h) => plain(h.loai) === plain(loc.nhom));
    return tong > 0 ? c.reduce((s, h) => s + h.kl, 0) / tong : c.length ? 1 / x.dong.length : 0;
  };
  const khNgay = (n, h) => loc2.filter((x) => hDua(x.v) === h).reduce((s, x) => s + giaTri(key(x.v, n)) * phan(x), 0);
  const thuc = useMemo(() => ({ nhap: thucTeNgay(thucTe, ngays, "nhap", loc.nhom), xuat: thucTeNgay(thucTe, ngays, "xuat", loc.nhom) }), [thucTe, ngays, loc.nhom]);

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

  // ---- Thao tác bàn phím: mũi tên / Enter chuyển ô; dán nhiều ô từ Excel ----
  const oMo = (x, n) => x.ben.includes(n) || `${x.v.id}|${n}` in goc;
  const nhay = (r, c, dr, dc) => {
    let rr = r + dr, cc = c + dc;
    for (let i = 0; i < 60 && rr >= 0 && rr < tau.length && cc >= 0 && cc < hien.length; i++, rr += dr, cc += dc) {
      const el = khung.current?.querySelector(`[data-o="${rr}-${cc}"]`);
      if (el) { el.focus(); el.select?.(); return true; }
    }
    return false;
  };
  const phim = (e, r, c) => {
    const el = e.target, k = e.key;
    if (k === "ArrowDown" || k === "Enter") { if (nhay(r, c, 1, 0)) e.preventDefault(); }
    else if (k === "ArrowUp") { if (nhay(r, c, -1, 0)) e.preventDefault(); }
    else if (k === "ArrowRight" && (el.selectionStart === el.value.length || el.selectionStart !== el.selectionEnd)) { if (nhay(r, c, 0, 1)) e.preventDefault(); }
    else if (k === "ArrowLeft" && (el.selectionEnd === 0 || el.selectionStart !== el.selectionEnd)) { if (nhay(r, c, 0, -1)) e.preventDefault(); }
  };
  const dan = (e, r, c) => {
    const t = e.clipboardData.getData("text");
    if (!/[\t\n]/.test(t.trim())) return; // một giá trị: dán bình thường
    e.preventDefault();
    const moi = {};
    t.replace(/\r/g, "").replace(/\n+$/, "").split("\n").forEach((dong, i) => dong.split("\t").forEach((o, j) => {
      const x = tau[r + i], n = hien[c + j];
      if (x && n && oMo(x, n)) moi[key(x.v, n)] = o.trim();
    }));
    setSua((o) => ({ ...o, ...moi }));
  };
  const dichCua = (so_) => setCua((o) => ({ ...o, bat: Math.max(0, Math.min(o.bat + so_, ngays.length - Math.min(o.co, ngays.length))) }));
  const veHomNay = () => { const i = ngays.indexOf(homNay); if (i >= 0) setCua((o) => ({ ...o, bat: Math.max(0, Math.min(i - 2, ngays.length - Math.min(o.co, ngays.length))) })); };
  const doiCo = (co) => setCua((o) => ({ co, bat: co >= 31 ? 0 : Math.max(0, Math.min(o.bat, ngays.length - co)) }));

  const dongTong = [["nhap", "Kế hoạch nhập", "Thực nhập"], ["xuat", "Kế hoạch xuất", "Thực xuất"]].filter(([h]) => !loc.huong || loc.huong === h);
  return (
    <Dialog onOpenChange={(o) => !o && onClose()} className="max-w-[min(1500px,calc(100vw-24px))]" title="Kế hoạch sản lượng theo ngày"
      description="Line tàu cập trong tháng: đặt số tấn kế hoạch cho từng ngày của từng tàu. Ô chỉ mở trong các ngày tàu ở bến.">
      {rows === null ? <div className="rounded-md border border-warn/40 bg-warn/5 px-3 py-2 text-sm">Chưa có bảng kế hoạch ngày: quản trị cần chạy <b>sql/13_ke_hoach_san_luong_ngay.sql</b> trong Supabase.</div> : (
        <div className="grid gap-3" ref={khung}>
          <div className="flex flex-wrap items-center gap-2">
            <NativeSelect className="h-7 w-44 text-xs" value={thang} onChange={(e) => { if (kDirty.length && !confirm("Có số chưa lưu. Bỏ thay đổi để chuyển tháng?")) return; setThang(e.target.value); }} aria-label="Tháng"
              options={Array.from({ length: 13 }, (_, i) => congThang(thangCua(D.now), i - 6)).map((x) => [x, tenThang(x) + (x === thangCua(D.now) ? " (này)" : "")])} />
            <NativeSelect className="h-7 w-40 text-xs" value={loc.nhom} onChange={(e) => setLoc({ ...loc, nhom: e.target.value })} placeholder="Tất cả loại hàng" options={dsNhom} aria-label="Lọc theo loại hàng" />
            <NativeSelect className="h-7 w-32 text-xs" value={loc.huong} onChange={(e) => setLoc({ ...loc, huong: e.target.value })} placeholder="Nhập + xuất" options={[["nhap", "Hàng nhập"], ["xuat", "Hàng xuất"]]} aria-label="Lọc theo hướng" />
            <div className="inline-flex items-center gap-1 rounded-md border px-1" title="Số ngày hiển thị">
              {[[7, "7 ngày"], [14, "14 ngày"], [31, "Cả tháng"]].map(([co, ten]) => <button key={co} type="button" onClick={() => doiCo(co)} className={cn("rounded px-1.5 py-0.5 text-xs", cua.co === co ? "bg-primary/15 font-semibold text-primary" : "text-muted-foreground hover:text-foreground")}>{ten}</button>)}
            </div>
            {size < ngays.length && <div className="flex items-center gap-1">
              <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => dichCua(-size)} disabled={bat === 0} aria-label="Các ngày trước"><ChevronLeft /></Button>
              <span className="min-w-[6.5rem] text-center text-xs tabular-nums text-muted-foreground">{hien[0]?.slice(8)}/{hien[0]?.slice(5, 7)} – {hien[hien.length - 1]?.slice(8)}/{hien[hien.length - 1]?.slice(5, 7)}</span>
              <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => dichCua(size)} disabled={bat + size >= ngays.length} aria-label="Các ngày sau"><ChevronRight /></Button>
              {ngays.includes(homNay) && <Button size="xs" variant="ghost" onClick={veHomNay}>Hôm nay</Button>}
            </div>}
            <span className="text-xs text-muted-foreground">{rows === undefined ? "Đang tải…" : `${tau.length}/${loc2.length} chuyến`}</span>
            <div className="ml-auto flex items-center gap-2">
              {kDirty.length > 0 && <Button size="sm" variant="outline" onClick={() => setSua({})}>Bỏ thay đổi</Button>}
              {nhap && <Button size="sm" disabled={!kDirty.length} onClick={luu}><Save />Lưu kế hoạch{kDirty.length ? ` (${kDirty.length} ô)` : ""}</Button>}
            </div>
          </div>
          {tau.length || rows === undefined ? (
            <div className="scroll-x max-h-[68vh] rounded-md border">
              <table className="tbl text-xs" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
                <thead>
                  <tr style={{ position: "sticky", top: 0, zIndex: 4 }} className="bg-card">
                    <th style={{ position: "sticky", left: 0, zIndex: 5, minWidth: 280 }} className="bg-card">Tàu · hàng · khối lượng</th>
                    {hien.map((n) => { const d = new Date(n + "T00:00:00"), cn0 = d.getDay() === 0, hn = n === homNay;
                      return <th key={n} className={cn("num min-w-[72px] border-l bg-card", hn && "bg-primary/10", cn0 && !hn && "bg-muted/60")}>{n.slice(8)}/{n.slice(5, 7)}<div className={cn("text-[0.6875rem] font-normal", cn0 ? "text-bad" : "text-muted-foreground")}>{THU[d.getDay()]}{hn ? " · nay" : ""}</div></th>; })}
                  </tr>
                </thead>
                <tbody>
                  {tau.map((x, r) => {
                    const { v, dong } = x, st = TRANG_THAI[trangThai(v, D.now)], kl = klCanLam(v), tong = tongTau(v);
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
                          <div className="text-[0.6875rem] tabular-nums text-muted-foreground">KL tàu {so(kl, 0)} t · KH tháng <b className={cn(kl > 0 && tong > kl + 1 ? "text-bad" : "text-foreground")} title={kl > 0 && tong > kl + 1 ? "Kế hoạch trong tháng vượt khối lượng tàu" : undefined}>{so(tong, 0)}</b> t</div>
                        </td>
                        {hien.map((n, c) => {
                          const k = key(v, n), mo = oMo(x, n), co = k in sua && sua[k].trim() !== fmt(goc[k]), hn = n === homNay;
                          return (
                            <td key={n} className={cn("num border-l border-t p-0.5", !mo && "bg-muted/30", co && "bg-warn/10", hn && !co && mo && "bg-primary/5")}>
                              {!mo ? null : nhap
                                ? <input data-o={`${r}-${c}`} className="h-8 w-[4.5rem] rounded border border-transparent bg-transparent px-1 text-right tabular-nums hover:border-input focus:border-ring focus:bg-background focus:outline-none" inputMode="decimal" value={hienThi(k)} onChange={(e) => setSua((o) => ({ ...o, [k]: e.target.value }))}
                                  onKeyDown={(e) => phim(e, r, c)} onPaste={(e) => dan(e, r, c)} onFocus={(e) => e.target.select()} aria-label={`${v.ten_tau} ngày ${n.slice(8)}`} />
                                : <span className="px-1">{hienThi(k)}</span>}
                            </td>);
                        })}
                      </tr>);
                  })}
                  {!tau.length && <tr><td colSpan={hien.length + 1} className="py-5 text-center text-muted-foreground">Không có chuyến nào trong các ngày này. Bấm ▶ để xem các ngày sau.</td></tr>}
                </tbody>
                <tfoot style={{ position: "sticky", bottom: 0, zIndex: 4 }}>
                  {dongTong.flatMap(([h, tenKh, tenTt]) => [
                    <tr key={h + "k"} className="bg-card font-semibold"><td style={{ position: "sticky", left: 0, zIndex: 5 }} className="border-t bg-card">{tenKh}{loc.nhom ? ` · ${loc.nhom}` : ""} <span className="ml-1 text-[0.6875rem] font-normal text-muted-foreground tabular-nums">tháng {so(ngays.reduce((s, n) => s + khNgay(n, h), 0), 0)} t</span></td>
                      {hien.map((n) => <td key={n} className="num border-l border-t bg-card tabular-nums">{khNgay(n, h) ? so(khNgay(n, h), 0) : ""}</td>)}</tr>,
                    <tr key={h + "t"} className="bg-card font-semibold text-primary"><td style={{ position: "sticky", left: 0, zIndex: 5 }} className="bg-card">{tenTt}{loc.nhom ? ` · ${loc.nhom}` : ""} <span className="ml-1 text-[0.6875rem] font-normal text-muted-foreground tabular-nums">tháng {so(thuc[h].reduce((s, x) => s + x, 0), 0)} t</span></td>
                      {hien.map((n) => { const i = ngays.indexOf(n); return <td key={n} className="num border-l bg-card tabular-nums">{thuc[h][i] ? so(thuc[h][i], 0) : ""}</td>; })}</tr>,
                  ])}
                </tfoot>
              </table>
            </div>
          ) : <Empty>Không có chuyến tàu nào trong {tenThang(thang).toLowerCase()}{loc.nhom || loc.huong ? " ứng với bộ lọc" : ""}. Thêm chuyến ở Khai thác Cảng › Linetime.</Empty>}
          <p className="text-[0.6875rem] text-muted-foreground">{nhap ? "Gõ số tấn kế hoạch của tàu trong ngày (vd 12.500). Phím mũi tên và Enter chuyển ô; dán nhiều ô từ Excel (Ctrl+V) vào một ô thì điền các ô kế tiếp. Cây đũa phép chia đều khối lượng tàu theo giờ làm hàng dự kiến; cục tẩy xóa kế hoạch của tàu trong tháng. Bấm Lưu kế hoạch để ghi. Thực nhập / thực xuất lấy từ bảng Sản lượng thực tế." : "Vai trò Xem chỉ xem kế hoạch."}</p>
        </div>)}
    </Dialog>
  );
}
