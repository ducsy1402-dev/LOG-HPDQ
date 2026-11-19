import { useState } from "react";
import { Plus, Save, X } from "lucide-react";
import { useApp } from "@/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChonGo } from "@/components/ui/combobox";
import { so, docSo } from "@/lib/format";
import { dongGhiXe, gomXe, r2, HINH_THUC, KE_HOACH } from "@/lib/keHoachTH";
import { PopupBenCanh } from "./PopupBenCanh";

// Hộp nhỏ khi bấm số Đường bộ / Đường biển của một hàng.
//   • Ô trên cùng: khối lượng kế hoạch của hình thức đó (nhập / sửa ở đây);
//   • Nếu hình thức đó có "Phân xe" (xuất bán: bộ và biển; nhập mua: chỉ biển): cột loại xe (tùy chọn) + ô Hòa Phát + ô Thuê ngoài; cuối hộp báo đã phân bao nhiêu, còn bao nhiêu chưa phân xe.
// Lưu ghi số kế hoạch (kh_tong_hop) và phân xe (kh_phan_xe) cùng lúc.
export default function HopPhanXe({ neo, onDong, loai, ky, hang, hinh, dong, xe, loaiXe, sua, onLuu }) {
  const { api, run } = useApp();
  const cfg = KE_HOACH[loai], coXe = hinh === "bo" ? cfg.xeBo : cfg.xeBien;
  const ten = HINH_THUC.find(([k]) => k === hinh)?.[1] || hinh;
  const [soKH, setSoKH] = useState(String(dong[hinh] || ""));
  const [rows, setRows] = useState(() => {
    const g = gomXe(xe, loai, hang, hinh).map((r, i) => ({ id: i, loai: r.loai, hp: r.hp ? String(r.hp) : "", tn: r.tn ? String(r.tn) : "" }));
    return g.length ? g : [{ id: 0, loai: "", hp: "", tn: "" }];
  });
  const set = (id, k, val) => setRows((o) => o.map((r) => (r.id === id ? { ...r, [k]: val } : r)));
  const tongHP = r2(rows.reduce((s, r) => s + (docSo(r.hp) || 0), 0)), tongTN = r2(rows.reduce((s, r) => s + (docSo(r.tn) || 0), 0));
  const kh = r2(docSo(soKH) || 0), chua = r2(kh - tongHP - tongTN);
  const luu = async () => {
    const moi = { hang, bo: dong.bo, bien: dong.bien }; moi[hinh] = kh; moi.tong = r2(moi.bo + moi.bien);
    const ghi = coXe ? dongGhiXe(rows.map((r) => ({ loai: r.loai, hp: docSo(r.hp), tn: docSo(r.tn) }))) : null;
    const ok = await run(async () => { await Promise.all([api.luuKhDong(loai, ky, { ghi: [moi] }), ghi ? api.luuKhPhanXe(loai, ky, hang, hinh, ghi) : null]); }, `Đã lưu ${cfg[hinh === "bo" ? "namBo" : "namBien"]} · ${hang}`);
    if (ok) { onLuu(); onDong(); }
  };
  return (
    <PopupBenCanh neo={neo} onDong={onDong} tieuDe={coXe ? `Phân xe · ${ten} · ${hang}` : `${ten} · ${hang}`} phu={coXe ? "Nhập khối lượng, rồi chia cho Hòa Phát / Thuê ngoài (loại xe tùy chọn)" : "Nhập khối lượng kế hoạch"} rong={coXe ? 440 : 320}>
      <div className="flex items-center gap-2 border-b px-3 py-2"><span className="flex-1 text-xs font-medium">Khối lượng {ten.toLowerCase()} (t)</span>
        <Input className="h-8 w-28 text-right tabular-nums" inputMode="decimal" disabled={!sua} value={soKH} placeholder="0" onChange={(e) => setSoKH(e.target.value)} /></div>
      {coXe && (
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
          <div className="grid gap-1.5">
            <div className="grid grid-cols-[1fr_6.5rem_6.5rem_1.5rem] gap-2 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground"><span>Loại xe</span><span className="text-right">Hòa Phát (t)</span><span className="text-right">Thuê ngoài (t)</span><span /></div>
            {rows.map((r) => (
              <div key={r.id} className="grid grid-cols-[1fr_6.5rem_6.5rem_1.5rem] items-center gap-2">
                <ChonGo value={r.loai} onChange={(x) => set(r.id, "loai", x)} options={loaiXe} placeholder="(không chia loại xe)" disabled={!sua} inputClassName="h-8" />
                <Input className="h-8 text-right tabular-nums" inputMode="decimal" disabled={!sua} value={r.hp} placeholder="0" onChange={(e) => set(r.id, "hp", e.target.value)} />
                <Input className="h-8 text-right tabular-nums" inputMode="decimal" disabled={!sua} value={r.tn} placeholder="0" onChange={(e) => set(r.id, "tn", e.target.value)} />
                <button type="button" disabled={!sua || rows.length < 2} onClick={() => setRows((o) => o.filter((x) => x.id !== r.id))} className="rounded p-0.5 text-muted-foreground hover:text-bad disabled:opacity-30" aria-label="Bỏ dòng"><X className="h-4 w-4" /></button>
              </div>))}
            <Button size="sm" variant="ghost" className="justify-self-start" disabled={!sua} onClick={() => setRows((o) => [...o, { id: Math.max(-1, ...o.map((x) => x.id)) + 1, loai: "", hp: "", tn: "" }])}><Plus />Thêm loại xe</Button>
          </div>
        </div>)}
      <div className="grid gap-2 border-t px-3 py-2">
        {coXe && (
          <div className="grid grid-cols-[1fr_6.5rem_6.5rem_1.5rem] items-center gap-2 text-xs font-semibold"><span>Đã phân xe: {so(tongHP + tongTN, 0)} t</span><span className="text-right tabular-nums">{so(tongHP, 0)}</span><span className="text-right tabular-nums">{so(tongTN, 0)}</span><span /></div>)}
        {coXe && <div className={`text-xs ${Math.abs(chua) < 0.005 ? "text-ok" : chua < 0 ? "text-bad" : "text-warn"}`}>{Math.abs(chua) < 0.005 ? "Phân xe khớp khối lượng" : chua > 0 ? `Chưa phân xe ${so(chua, 0)} t` : `Phân xe vượt khối lượng ${so(-chua, 0)} t`}</div>}
        <div className="flex justify-end"><Button size="sm" disabled={!sua} onClick={luu}><Save />Lưu</Button></div>
      </div>
    </PopupBenCanh>
  );
}
