import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/store";
import { Empty } from "@/components/common";
import { so, pct } from "@/lib/format";
import { khuCuaKeHoach, ngayStr } from "@/lib/kho";
import { kyHienTai, ngayCuaKy, ngayCuaKeHoach, nhanKy } from "@/lib/keHoachKy";
import { cn } from "@/lib/utils";
import { ChonKy } from "./KeHoachKho";

// Xem kế hoạch (chỉ đọc): kế hoạch nhập / xuất của kỳ (ngày · tuần · tháng · năm) so với thực tế theo sổ nhập – xuất, từng bãi nhỏ của kho đang xem.
// Kế hoạch của kỳ khác độ dài lấy phần nằm trong kỳ đang xem (chia đều theo ngày). Sửa kế hoạch ở hộp "Kế hoạch".
// Thực tế = tổng các lượt nhập / xuất trong kỳ (không tính điều chuyển, tồn đầu kỳ, kiểm kê).
export default function XemKeHoach({ kho }) {
  const { D, api } = useApp();
  const homNay = ngayStr(D.now), coKy = !!D.coSql12;
  const [loaiKy, setLoaiKy] = useState("thang"), [ky, setKy] = useState(() => kyHienTai("thang", ngayStr(D.now)));
  const [gd, setGd] = useState(null);
  const ngays = useMemo(() => ngayCuaKy(loaiKy, ky), [loaiKy, ky]);
  useEffect(() => {
    let huy = false; setGd(null);
    api.loadGiaoDichKhoang(ngays[0], ngays[ngays.length - 1]).then((r) => { if (!huy) setGd(r || []); }).catch(() => { if (!huy) setGd([]); });
    return () => { huy = true; };
  }, [api, ngays, D.giaoDich]);

  const dong = useMemo(() => kho.dong.filter((d) => !d.saiBai), [kho]);
  const { ds, tong } = useMemo(() => {
    const trongKy = new Set(ngays), m = new Map(), lay = (d) => { if (!m.has(d.key)) m.set(d.key, { d, nhapKH: 0, xuatKH: 0, nhapTT: 0, xuatTT: 0 }); return m.get(d.key); };
    for (const r of D.khoKeHoach || []) {
      const nd = ngayCuaKeHoach(r), chung = nd.filter((n) => trongKy.has(n)).length;
      if (!chung) continue;
      const d = khuCuaKeHoach(r, dong); if (!d) continue;
      lay(d)[r.huong === "xuat" ? "xuatKH" : "nhapKH"] += (+r.khoi_luong || 0) * chung / nd.length;
    }
    const byKey = new Map(dong.map((d) => [d.key, d]));
    for (const g of gd || []) {
      if (g.loai !== "nhap" && g.loai !== "xuat") continue;
      const d = byKey.get(kho.gan(g.ten_bai, g.hang, g.ten_khu)); if (!d) continue;
      lay(d)[g.loai === "xuat" ? "xuatTT" : "nhapTT"] += +g.so_luong || 0;
    }
    const ds = [...m.values()].sort((a, b) => a.d.ten_bai.localeCompare(b.d.ten_bai, "vi", { numeric: true }) || String(a.d.ten).localeCompare(String(b.d.ten), "vi", { numeric: true }));
    const tong = ds.reduce((t, r) => ({ nhapKH: t.nhapKH + r.nhapKH, xuatKH: t.xuatKH + r.xuatKH, nhapTT: t.nhapTT + r.nhapTT, xuatTT: t.xuatTT + r.xuatTT }), { nhapKH: 0, xuatKH: 0, nhapTT: 0, xuatTT: 0 });
    return { ds, tong };
  }, [D.khoKeHoach, ngays, dong, gd, kho]);

  const dat = (tt, kh) => (kh > 0 ? <span className={cn("ml-1 text-xs", tt / kh >= 1 ? "text-ok" : tt / kh >= 0.7 ? "text-warn" : "text-bad")}>{pct(tt / kh)}</span> : null);
  const o = (a, b) => <><td className="num">{a ? so(a) : <span className="text-muted-foreground">—</span>}</td><td className="num">{so(b)}{dat(b, a)}</td></>;
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <ChonKy loai={loaiKy} ky={ky} coKy={coKy} homNay={homNay} onDoi={(l, k) => { setLoaiKy(l); setKy(k); }} />
        <span className="text-xs text-muted-foreground">{gd == null ? "Đang tải thực tế…" : "Kế hoạch so với số nhập / xuất thực tế theo sổ."}</span>
      </div>
      {ds.length ? (
        <div className="scroll-x max-h-[60vh] rounded-md border">
          <table className="tbl text-xs">
            <thead><tr><th>Bãi nhỏ</th><th className="num">Nhập KH (t)</th><th className="num">Nhập TT (t)</th><th className="num">Xuất KH (t)</th><th className="num">Xuất TT (t)</th></tr></thead>
            <tbody>
              {ds.map((r) => <tr key={r.d.key}><td className="font-medium">{r.d.ten_bai} › {r.d.ten}</td>{o(r.nhapKH, r.nhapTT)}{o(r.xuatKH, r.xuatTT)}</tr>)}
              <tr className="font-semibold"><td>Cộng</td>{o(tong.nhapKH, tong.nhapTT)}{o(tong.xuatKH, tong.xuatTT)}</tr>
            </tbody>
          </table>
        </div>
      ) : <Empty>Chưa có kế hoạch hay lượt nhập / xuất nào của {nhanKy(loaiKy, ky).toLowerCase()}. Đặt kế hoạch ở nút "Kế hoạch".</Empty>}
    </div>
  );
}
