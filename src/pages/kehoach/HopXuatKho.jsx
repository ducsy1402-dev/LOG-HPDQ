import { useMemo, useState } from "react";
import { Save, Scale } from "lucide-react";
import { useApp } from "@/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { so, docSo, plain } from "@/lib/format";
import { chiaTheoSucChua, r2 } from "@/lib/keHoachXuatBan";
import { PopupBenCanh } from "./PopupBenCanh";

// Hộp nhỏ "Xuất kho" (bấm số TỔNG của một hàng): cột trái = bãi › gian / lô đang chứa hàng đó (kèm tồn, sức chứa), ô bên phải = khối lượng xuất của gian / lô đó;
// nút "Phân bổ đều theo tỉ lệ sức chứa" chia tổng kế hoạch về các gian / lô theo sức chứa. Lưu ghi bảng kh_xuat_kho (thay toàn bộ phân bổ của hàng trong tháng).
export default function HopXuatKho({ neo, onDong, thang, hang, tong, kho, khoRows, sua, onLuu }) {
  const { api, run } = useApp();
  // Các gian / lô đang chứa hàng (tồn > 0) cộng các gian / lô đã có phân bổ từ trước
  const ds = useMemo(() => {
    const dong = new Map((kho?.dong || []).map((d) => [d.key, d]));
    const m = new Map();
    for (const c of kho?.cap || []) {
      if (plain(c.hang) !== plain(hang) || !(c.ton > 1e-6)) continue;
      const d = dong.get(c.key); if (!d) continue;
      const o = m.get(d.key) || { key: d.key, ten_bai: d.ten_bai, ten_khu: d.ten, ton: 0, suc: +d.sucChua || 0 };
      o.ton += c.ton; m.set(d.key, o);
    }
    for (const r of khoRows) {
      const d = (kho?.dong || []).find((x) => x.ten_bai === r.ten_bai && x.ten === r.ten_khu);
      const key = d?.key || `${r.ten_bai}|${r.ten_khu}`;
      if (!m.has(key)) m.set(key, { key, ten_bai: r.ten_bai, ten_khu: r.ten_khu, ton: 0, suc: +d?.sucChua || 0 });
    }
    return [...m.values()].sort((a, b) => String(a.ten_bai).localeCompare(String(b.ten_bai), "vi", { numeric: true }) || String(a.ten_khu).localeCompare(String(b.ten_khu), "vi", { numeric: true }));
  }, [kho, hang, khoRows]);
  const [v, setV] = useState(() => Object.fromEntries(khoRows.map((r) => {
    const d = (kho?.dong || []).find((x) => x.ten_bai === r.ten_bai && x.ten === r.ten_khu);
    return [d?.key || `${r.ten_bai}|${r.ten_khu}`, String(r.tan)];
  })));
  const gt = (k) => docSo(v[k]) || 0;
  const daChia = r2(ds.reduce((s, x) => s + gt(x.key), 0)), con = r2(tong - daChia);
  const chiaDeu = () => { const m = chiaTheoSucChua(tong, ds); setV(Object.fromEntries(ds.map((x) => [x.key, m.has(x.key) ? String(m.get(x.key)) : ""]))); };
  const luu = async () => {
    const rows = ds.map((x) => ({ ten_bai: x.ten_bai, ten_khu: x.ten_khu, tan: r2(gt(x.key)) })).filter((r) => r.tan > 0);
    if (await run(() => api.luuKhXuatKho(thang, hang, rows), `Đã lưu xuất kho ${hang}`)) { onLuu(); onDong(); }
  };
  return (
    <PopupBenCanh neo={neo} onDong={onDong} tieuDe={`Xuất kho · ${hang}`} phu={`Tổng kế hoạch xuất bán: ${so(tong, 0)} t`} rong={400}>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {!ds.length ? <div className="py-4 text-center text-xs text-muted-foreground">Chưa có bãi – gian / lô nào đang chứa hàng này (hàng chưa có tồn trong kho).</div> : (
          <div className="grid gap-1.5">
            <div className="grid grid-cols-[1fr_6.5rem] gap-2 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground"><span>Bãi › gian / lô</span><span className="text-right">Xuất (t)</span></div>
            {ds.map((x) => {
              const vuot = gt(x.key) > x.ton + 1e-6;
              return (
                <div key={x.key} className="grid grid-cols-[1fr_6.5rem] items-center gap-2">
                  <div className="min-w-0"><div className="truncate" title={`${x.ten_bai} › ${x.ten_khu}`}>{x.ten_bai} › {x.ten_khu}</div>
                    <div className="text-[0.6875rem] text-muted-foreground">tồn <b className={vuot ? "text-bad" : "text-foreground"}>{so(x.ton, 0)}</b> t{x.suc > 0 ? ` · sức chứa ${so(x.suc, 0)} t` : ""}</div></div>
                  <Input className="h-8 text-right tabular-nums" inputMode="decimal" disabled={!sua} value={v[x.key] ?? ""} placeholder="0" onChange={(e) => setV((o) => ({ ...o, [x.key]: e.target.value }))} />
                </div>);
            })}
          </div>)}
      </div>
      <div className="grid gap-2 border-t px-3 py-2">
        <div className="flex items-center justify-between text-xs">
          <span>Đã phân bổ <b className="tabular-nums">{so(daChia, 0)}</b> / <b className="tabular-nums">{so(tong, 0)}</b> t</span>
          <span className={Math.abs(con) < 0.005 ? "font-medium text-ok" : con < 0 ? "font-medium text-bad" : "font-medium text-warn"}>{Math.abs(con) < 0.005 ? "Khớp tổng" : con > 0 ? `còn thiếu ${so(con, 0)} t` : `vượt ${so(-con, 0)} t`}</span>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button size="sm" variant="outline" disabled={!sua || !ds.length || !(tong > 0)} onClick={chiaDeu} title="Chia tổng kế hoạch về các gian / lô theo tỉ lệ sức chứa"><Scale />Phân bổ đều theo tỉ lệ sức chứa</Button>
          <Button size="sm" disabled={!sua || !ds.length} onClick={luu}><Save />Lưu</Button>
        </div>
      </div>
    </PopupBenCanh>
  );
}
