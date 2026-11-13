import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/store";
import { Dialog } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/input";
import { Empty } from "@/components/common";
import { so, pct, plain, thangCua, tenThang, congThang } from "@/lib/format";
import { ngayCuaThang } from "@/lib/sanLuongTT";
import { keHoachTheoNgay, tongNgay, thucTeNgay } from "@/lib/keHoachNgay";
import { cn } from "@/lib/utils";
import { useNhomHang } from "./useNhomHang";

// Xem kế hoạch (chỉ đọc): mục tiêu tháng, kế hoạch ngày (đặt ở nút Kế hoạch ngày) và thực tế của một tháng.
//   Bảng 1 theo loại hàng: mục tiêu tháng · kế hoạch ngày cộng lại · thực tế · % đạt mục tiêu · % đạt kế hoạch.
//   Bảng 2 theo ngày: kế hoạch / thực tế nhập, kế hoạch / thực tế xuất.
const HUONG = [["nhap", "Hàng nhập"], ["xuat", "Hàng xuất"]];
const pc = (a, b) => (b > 0 ? pct(a / b) : "");
const mau = (a, b) => (b > 0 && a >= b ? "text-ok" : ""); // chỉ tô xanh khi đạt đủ (giữa tháng chưa đủ là bình thường, không tô đỏ)

export default function HopXemKeHoachSL({ thang0, onClose }) {
  const { D, api } = useApp();
  const nhomHang = useNhomHang();
  const [thang, setThang] = useState(thang0 || thangCua(D.now));
  const [kq, setKq] = useState(undefined);
  const ngays = useMemo(() => ngayCuaThang(thang), [thang]);
  useEffect(() => {
    let huy = false; setKq(undefined);
    Promise.all([api.docSanLuongThang("cang", thang), api.docKeHoachNgay(ngays[0], ngays[ngays.length - 1])])
      .then(([sl, kh]) => { if (!huy) setKq({ sl, kh: kh || [] }); }).catch(() => { if (!huy) setKq(null); });
    return () => { huy = true; };
  }, [api, thang, ngays]);

  const t = useMemo(() => {
    if (!kq?.sl) return null;
    const kh = keHoachTheoNgay(kq.kh, D.vmap, nhomHang);
    const loai = new Map(); // "huong|nhóm" -> { huong, nhom, mt, kh, tt }
    const o = (huong, nhom) => { const k = `${huong}|${plain(nhom)}`; if (!loai.has(k)) loai.set(k, { huong, nhom, mt: 0, kh: 0, tt: 0 }); return loai.get(k); };
    for (const m of kq.sl.mucTieu) o(m.huong, m.loai_hang).mt += +m.tan || 0;
    for (const [k, v] of kh) { const [, huong, nhom] = k.split("|"); o(huong, nhom).kh += v; }
    for (const r of kq.sl.thucTe) o(r.huong, r.loai_hang).tt += +r.tan || 0;
    const ngay = ngays.map((n, i) => ({ n, i }));
    const k2 = Object.fromEntries(HUONG.map(([h]) => [h, { kh: tongNgay(kh, ngays, h), tt: thucTeNgay(kq.sl.thucTe, ngays, h) }]));
    return { loai: [...loai.values()].sort((a, b) => b.mt - a.mt || b.tt - a.tt || a.nhom.localeCompare(b.nhom, "vi")), ngay, k2 };
  }, [kq, ngays, D.vmap, nhomHang]);

  return (
    <Dialog onOpenChange={(o) => !o && onClose()} className="max-w-[min(1200px,calc(100vw-24px))]" title="Xem kế hoạch" description="Mục tiêu tháng, kế hoạch ngày và thực tế. Chỉ xem; sửa ở các nút Đặt mục tiêu, Kế hoạch ngày, Sản lượng thực tế.">
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect className="h-7 w-44 text-xs" value={thang} onChange={(e) => setThang(e.target.value)} aria-label="Tháng"
            options={Array.from({ length: 13 }, (_, i) => congThang(thangCua(D.now), i - 6)).map((x) => [x, tenThang(x) + (x === thangCua(D.now) ? " (này)" : "")])} />
          {kq === undefined && <span className="text-xs text-muted-foreground">Đang tải…</span>}
        </div>
        {kq === null || (kq && !kq.sl) ? <div className="rounded-md border border-warn/40 bg-warn/5 px-3 py-2 text-sm">Chưa có bảng sản lượng: quản trị cần chạy <b>sql/06_san_luong_thuc_te.sql</b> trong Supabase.</div> : t && (
          <>
            <section className="grid gap-2">
              <h3 className="text-sm font-semibold">Theo loại hàng · {tenThang(thang)}</h3>
              {t.loai.length ? (
                <div className="scroll-x rounded-md border">
                  <table className="tbl text-xs">
                    <thead><tr><th>Hướng</th><th>Loại hàng</th><th className="num">Mục tiêu tháng (t)</th><th className="num">Kế hoạch ngày (t)</th><th className="num">Thực tế (t)</th><th className="num">% mục tiêu</th><th className="num">% kế hoạch</th></tr></thead>
                    <tbody>
                      {t.loai.map((r) => (
                        <tr key={`${r.huong}|${r.nhom}`}>
                          <td>{r.huong === "xuat" ? "Xuất" : "Nhập"}</td><td className="font-medium">{r.nhom}</td>
                          <td className="num">{r.mt ? so(r.mt, 0) : "—"}</td><td className="num">{r.kh ? so(r.kh, 0) : "—"}</td><td className="num">{so(r.tt, 0)}</td>
                          <td className={cn("num", mau(r.tt, r.mt))}>{pc(r.tt, r.mt)}</td><td className={cn("num", mau(r.tt, r.kh))}>{pc(r.tt, r.kh)}</td>
                        </tr>))}
                    </tbody>
                    <tfoot>{HUONG.map(([h, ten]) => { const ds = t.loai.filter((r) => r.huong === h); if (!ds.length) return null; const s = (c) => ds.reduce((x, r) => x + r[c], 0);
                      return <tr key={h} className="font-semibold"><td colSpan={2}>Cộng {ten.toLowerCase()}</td><td className="num">{so(s("mt"), 0)}</td><td className="num">{so(s("kh"), 0)}</td><td className="num">{so(s("tt"), 0)}</td><td className={cn("num", mau(s("tt"), s("mt")))}>{pc(s("tt"), s("mt"))}</td><td className={cn("num", mau(s("tt"), s("kh")))}>{pc(s("tt"), s("kh"))}</td></tr>; })}</tfoot>
                  </table>
                </div>
              ) : <Empty>Chưa có mục tiêu, kế hoạch hay số thực tế nào trong {tenThang(thang).toLowerCase()}.</Empty>}
            </section>
            <section className="grid gap-2">
              <h3 className="text-sm font-semibold">Theo ngày</h3>
              <div className="scroll-x max-h-[45vh] rounded-md border">
                <table className="tbl text-xs">
                  <thead><tr><th rowSpan={2}>Ngày</th><th colSpan={2} className="border-l text-center">Hàng nhập (t)</th><th colSpan={2} className="border-l text-center">Hàng xuất (t)</th></tr>
                    <tr><th className="num border-l">Kế hoạch</th><th className="num">Thực tế</th><th className="num border-l">Kế hoạch</th><th className="num">Thực tế</th></tr></thead>
                  <tbody>
                    {t.ngay.map(({ n, i }) => (
                      <tr key={n}><td className="whitespace-nowrap font-medium tabular-nums">{n.slice(8)}/{n.slice(5, 7)}</td>
                        {HUONG.map(([h]) => <><td key={h + "k"} className="num border-l">{t.k2[h].kh[i] ? so(t.k2[h].kh[i], 0) : ""}</td><td key={h + "t"} className={cn("num", mau(t.k2[h].tt[i], t.k2[h].kh[i]))}>{t.k2[h].tt[i] ? so(t.k2[h].tt[i], 0) : ""}</td></>)}
                      </tr>))}
                  </tbody>
                </table>
              </div>
            </section>
          </>)}
      </div>
    </Dialog>
  );
}
