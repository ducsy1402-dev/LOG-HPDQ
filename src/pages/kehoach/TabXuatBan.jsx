import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChonGo } from "@/components/ui/combobox";
import { so, plain } from "@/lib/format";
import { tongHopXuatBan } from "@/lib/keHoachXuatBan";
import HopXuatKho from "./HopXuatKho";
import HopPhanXe from "./HopPhanXe";

// Tab "Kế hoạch xuất bán": bảng Tên hàng · Tổng · Đường bộ · Đường biển (tấn, theo tháng).
//   • bấm số TỔNG  → hộp nhỏ "Xuất kho" (phân bổ tổng về bãi – gian / lô đang chứa hàng, có nút chia theo tỉ lệ sức chứa);
//   • bấm số Đường bộ / Đường biển → hộp nhỏ "Phân xe" (loại xe tùy chọn × Hòa Phát / Thuê ngoài).
// Tổng = Đường bộ + Đường biển; hai số này là tổng của các ô trong hộp Phân xe.
export default function TabXuatBan({ thang, data, kho, sua, dsHang, loaiXe, onLuu }) {
  const [them, setThem] = useState([]); // hàng vừa thêm, chưa có số
  const [chon, setChon] = useState("");
  const [pop, setPop] = useState(null); // { hang, loai: "tong" | "bo" | "bien", neo }
  const tong = useMemo(() => tongHopXuatBan(data?.xe), [data]);
  const dong = useMemo(() => {
    const m = new Map([...tong].map(([k, v]) => [k, v]));
    for (const r of data?.kho || []) if (!m.has(plain(r.hang))) m.set(plain(r.hang), { hang: r.hang, bo: 0, bien: 0, tong: 0, hp: 0, tn: 0 });
    for (const h of them) if (!m.has(plain(h))) m.set(plain(h), { hang: h, bo: 0, bien: 0, tong: 0, hp: 0, tn: 0 });
    return [...m.values()].sort((a, b) => b.tong - a.tong || a.hang.localeCompare(b.hang, "vi"));
  }, [tong, data, them]);
  const cong = dong.reduce((s, x) => ({ bo: s.bo + x.bo, bien: s.bien + x.bien, tong: s.tong + x.tong }), { bo: 0, bien: 0, tong: 0 });
  const bam = (hang, loai) => (e) => setPop({ hang, loai, neo: e.currentTarget });
  // Hàm vẽ (không phải component): nếu là component khai báo trong hàm này thì mỗi lần vẽ lại nút bị tạo mới và ô neo của hộp nhỏ bị gỡ khỏi trang
  const so1 = (x, loai, gt, dam) => (
    <button type="button" onClick={bam(x.hang, loai)} title={loai === "tong" ? "Phân bổ xuất kho" : "Phân xe"}
      className={`ml-auto flex h-8 min-w-[6rem] items-center justify-end rounded-md border border-transparent px-2 tabular-nums transition-colors hover:border-input hover:bg-accent ${dam ? "font-semibold" : ""} ${pop?.hang === x.hang && pop?.loai === loai ? "border-primary bg-primary/10" : ""}`}>
      {gt > 0 ? so(gt, 0) : <span className="text-muted-foreground">—</span>}
    </button>);
  const them1 = () => { const h = chon.trim(); if (!h) return; if (!dong.some((x) => plain(x.hang) === plain(h))) setThem((o) => [...o, h]); setChon(""); };
  const dongPop = pop ? dong.find((x) => plain(x.hang) === plain(pop.hang)) : null;
  return (
    <div>
      <div className="overflow-x-auto rounded-md border">
        <table className="tbl w-full text-sm">
          <thead><tr><th className="text-left">Tên hàng</th><th className="text-right">Tổng (t)</th><th className="text-right">Đường bộ (t)</th><th className="text-right">Đường biển (t)</th></tr></thead>
          <tbody>
            {dong.map((x) => (
              <tr key={x.hang}>
                <td className="font-medium">{x.hang}</td>
                <td>{so1(x, "tong", x.tong, true)}</td>
                <td>{so1(x, "bo", x.bo)}</td>
                <td>{so1(x, "bien", x.bien)}</td>
              </tr>))}
            {!dong.length && <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">Chưa có kế hoạch xuất bán tháng này. Chọn hàng ở ô bên dưới rồi bấm Thêm hàng.</td></tr>}
          </tbody>
          <tfoot><tr className="font-semibold"><td>Cộng</td><td className="text-right tabular-nums pr-4">{so(cong.tong, 0)}</td><td className="text-right tabular-nums pr-4">{so(cong.bo, 0)}</td><td className="text-right tabular-nums pr-4">{so(cong.bien, 0)}</td></tr></tfoot>
        </table>
      </div>
      {sua && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <ChonGo className="min-w-[220px] flex-1 sm:max-w-sm" value={chon} onChange={setChon} options={dsHang} placeholder="Chọn hàng để thêm vào kế hoạch" />
          <Button size="sm" variant="outline" disabled={!chon.trim()} onClick={them1}><Plus />Thêm hàng</Button>
        </div>)}
      <p className="mt-2 text-[0.6875rem] text-muted-foreground">Bấm số <b>Đường bộ</b> / <b>Đường biển</b> để phân xe (Hòa Phát / Thuê ngoài, loại xe tùy chọn); bấm số <b>Tổng</b> (= bộ + biển) để phân bổ xuất kho về từng bãi – gian / lô đang chứa hàng.</p>
      {pop && dongPop && (pop.loai === "tong"
        ? <HopXuatKho key={`k|${pop.hang}`} neo={pop.neo} onDong={() => setPop(null)} thang={thang} hang={dongPop.hang} tong={dongPop.tong} kho={kho} khoRows={(data?.kho || []).filter((r) => plain(r.hang) === plain(dongPop.hang))} sua={sua} onLuu={onLuu} />
        : <HopPhanXe key={`x|${pop.hang}|${pop.loai}`} neo={pop.neo} onDong={() => setPop(null)} thang={thang} hang={dongPop.hang} hinh={pop.loai} xe={data?.xe || []} loaiXe={loaiXe} sua={sua} onLuu={onLuu} />)}
    </div>
  );
}
