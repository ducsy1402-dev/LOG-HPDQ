import { Plus, X } from "lucide-react";
import { Input, NativeSelect } from "@/components/ui/input";
import { ChonGo } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { so, pct } from "@/lib/format";
import { docSo } from "@/lib/paste";
import { cn } from "@/lib/utils";
import { NHOM, HUONG_NGAN } from "@/lib/sanLuongTT";

// Bảng mục tiêu VẬN TẢI theo form Excel của anh Sỹ (16/11/2026): Loại hàng · Hướng · Loại xe · ĐVT · Tổng · Hòa Phát · Thuê ngoài · Ghi chú (không có Stt).
// Mỗi dòng gộp hai dòng CSDL (Hòa Phát, Thuê ngoài) của cùng loại hàng + hướng + loại xe; Tổng = Hòa Phát + Thuê ngoài (tự cộng, không nhập).
// Thêm hai cột đối chiếu: Thực hiện (cộng từ bảng thực tế) và Đạt (%). Quý / năm có thêm cột Σ các tháng.
export default function BangMucTieuVT({ ds, dong, th, kyMode, tongThang, sua, doi, datO, datGhiChu, xoaNhom, them, setThem, themNhom, goiY, goiYHang }) {
  const c = NHOM.van_tai;
  const v = (k) => (k ? dong[k]?.tan ?? "" : "");
  const num = (k) => (k ? docSo(String(v(k))) || 0 : 0);
  const tongNhom = (o) => num(o.hp) + num(o.tn) + o.khac.reduce((s, k) => s + num(k), 0);
  const thNhom = (o) => (th.get(o.hp) || 0) + (th.get(o.tn) || 0) + o.khac.reduce((s, k) => s + (th.get(k) || 0), 0);
  const tHP = ds.reduce((s, o) => s + num(o.hp), 0), tTN = ds.reduce((s, o) => s + num(o.tn) + o.khac.reduce((x, k) => x + num(k), 0), 0), tTong = tHP + tTN;
  const tTH = ds.reduce((s, o) => s + thNhom(o), 0);
  const tThang = kyMode ? [...tongThang.values()].reduce((s, r) => s + r.tan, 0) : 0;
  const sigma = (o) => [o.hp, o.tn, ...o.khac].reduce((s, k) => s + (k && tongThang.has(k) ? tongThang.get(k).tan : 0), 0);
  const doiNhom = (o) => [o.hp, o.tn, ...o.khac].some((k) => k && doi.includes(k));
  const o_ = (o, slot) => (
    sua
      ? <Input className="ml-auto h-8 w-28 text-right tabular-nums" inputMode="decimal" value={v(o[slot])} onChange={(e) => datO(o, slot, e.target.value)}
          aria-label={`${slot === "hp" ? "Hòa Phát" : "Thuê ngoài"}: ${o.hang || "mọi hàng"} ${HUONG_NGAN[o.huong]} ${o.loai}`} />
      : v(o[slot]));
  const ghiChu = (o) => [o.hp, o.tn].map((k) => (k ? dong[k]?.ghi_chu : "")).find(Boolean) || "";
  return (
    <div className="rounded-md border">
      <div className="scroll-x max-h-[60vh]">
        <table className="tbl text-xs">
          <thead><tr><th>Loại hàng</th><th>Hướng</th><th>Loại xe</th><th>ĐVT</th><th className="num">Tổng (t)</th><th className="num">Hòa Phát</th><th className="num">Thuê ngoài</th>
            {kyMode && <th className="num">Σ các tháng</th>}<th className="num">Thực hiện</th><th className="num">Đạt</th><th>Ghi chú</th>{sua && <th className="w-8" />}</tr></thead>
          <tbody>
            {ds.map((o) => {
              const tong = tongNhom(o), tt = thNhom(o);
              return (
                <tr key={o.g} className={cn(doiNhom(o) && "bg-warn/5")}>
                  <td className="whitespace-nowrap font-medium">{o.hang || <span className="font-normal text-muted-foreground">Mọi hàng</span>}</td>
                  <td className="whitespace-nowrap" title={c.huong.find(([h]) => h === o.huong)?.[1]}>{HUONG_NGAN[o.huong] || o.huong}</td>
                  <td className="whitespace-nowrap">{o.loai}</td>
                  <td>Tấn</td>
                  <td className="num font-semibold tabular-nums">{tong ? so(tong) : ""}</td>
                  <td className="num">{o_(o, "hp")}</td>
                  <td className="num" title={o.khac.length ? "Có số thuê ngoài cũ ghi theo từng nhà thầu, đã cộng vào Tổng" : undefined}>{o_(o, "tn")}</td>
                  {kyMode && <td className="num text-muted-foreground">{sigma(o) ? so(sigma(o)) : ""}</td>}
                  <td className="num">{so(tt)}</td>
                  <td className={cn("num", tong > 0 && tt >= tong && "font-semibold text-ok")}>{tong ? pct(tt / tong) : ""}</td>
                  <td className="min-w-[120px]">{sua ? <Input className="h-8" value={ghiChu(o)} onChange={(e) => datGhiChu(o, e.target.value)} aria-label={`Ghi chú ${o.hang} ${o.loai}`} /> : ghiChu(o)}</td>
                  {sua && <td className="w-8"><button type="button" className="rounded p-1 text-muted-foreground hover:text-bad" onClick={() => xoaNhom(o)} title="Xóa dòng" aria-label={`Xóa dòng ${o.hang || "mọi hàng"} ${o.loai}`}><X className="h-4 w-4" /></button></td>}
                </tr>);
            })}
            {!ds.length && <tr><td colSpan={(sua ? 11 : 10) + (kyMode ? 1 : 0)} className="py-4 text-center text-muted-foreground">Chưa có dòng nào. Chọn loại hàng, hướng, loại xe ở ô bên dưới rồi bấm Thêm dòng, nhập Hòa Phát / Thuê ngoài và bấm Lưu.</td></tr>}
          </tbody>
          <tfoot><tr className="font-semibold"><td colSpan={4}>Tổng</td><td className="num">{so(tTong)}</td><td className="num">{so(tHP)}</td><td className="num">{so(tTN)}</td>{kyMode && <td className="num text-muted-foreground">{so(tThang)}</td>}<td className="num">{so(tTH)}</td><td className="num">{tTong ? pct(tTH / tTong) : ""}</td><td />{sua && <td />}</tr></tfoot>
        </table>
      </div>
      {sua && (
        <div className="flex flex-wrap items-center gap-2 border-t p-2">
          <ChonGo className="min-w-[170px] flex-1" value={them.hang || ""} onChange={(x) => setThem({ ...them, hang: x })} options={goiYHang} placeholder="Loại hàng (để trống = mọi hàng)" />
          <NativeSelect className="h-9 w-36" value={them.huong || c.huong[0][0]} onChange={(e) => setThem({ ...them, huong: e.target.value })} options={c.huong.map(([h, t]) => [h, `${HUONG_NGAN[h]} · ${t}`])} aria-label="Hướng" />
          <ChonGo className="min-w-[150px] flex-1" value={them.loai || ""} onChange={(x) => setThem({ ...them, loai: x })} options={goiY} placeholder="Loại xe (chọn hoặc gõ)" />
          <Button size="sm" variant="outline" disabled={!(them.loai || "").trim()} onClick={themNhom}><Plus />Thêm dòng</Button>
        </div>)}
    </div>
  );
}
