import { useState } from "react";
import { Plus, Save, X } from "lucide-react";
import { useApp } from "@/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChonGo } from "@/components/ui/combobox";
import { so, docSo } from "@/lib/format";
import { dongGhiXe, gomXe, r2, HINH_THUC } from "@/lib/keHoachXuatBan";
import { PopupBenCanh } from "./PopupBenCanh";

// Hộp nhỏ "Phân xe" (bấm số Đường bộ hoặc Đường biển của một hàng): cột trái = loại xe (tùy chọn, để trống = không chia loại xe),
// hai ô khối lượng: Hòa Phát và Thuê ngoài. Số Đường bộ / Đường biển của hàng = tổng các ô này. Lưu ghi bảng kh_xuat_ban_xe (thay toàn bộ dòng của hàng + hình thức trong tháng).
export default function HopPhanXe({ neo, onDong, thang, hang, hinh, xe, loaiXe, sua, onLuu }) {
  const { api, run } = useApp();
  const [rows, setRows] = useState(() => {
    const g = gomXe(xe, hang, hinh).map((r, i) => ({ id: i, loai: r.loai, hp: r.hp ? String(r.hp) : "", tn: r.tn ? String(r.tn) : "" }));
    return g.length ? g : [{ id: 0, loai: "", hp: "", tn: "" }];
  });
  const set = (id, k, val) => setRows((o) => o.map((r) => (r.id === id ? { ...r, [k]: val } : r)));
  const tongHP = r2(rows.reduce((s, r) => s + (docSo(r.hp) || 0), 0)), tongTN = r2(rows.reduce((s, r) => s + (docSo(r.tn) || 0), 0));
  const ten = HINH_THUC.find(([k]) => k === hinh)?.[1] || hinh;
  const luu = async () => {
    const ghi = dongGhiXe(rows.map((r) => ({ loai: r.loai, hp: docSo(r.hp), tn: docSo(r.tn) })));
    if (await run(() => api.luuKhXuatBanXe(thang, hang, hinh, ghi), `Đã lưu phân xe ${ten.toLowerCase()} · ${hang}`)) { onLuu(); onDong(); }
  };
  return (
    <PopupBenCanh neo={neo} onDong={onDong} tieuDe={`Phân xe · ${ten} · ${hang}`} phu="Loại xe tùy chọn; số của hàng = tổng các ô bên dưới" rong={440}>
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
      </div>
      <div className="grid gap-2 border-t px-3 py-2">
        <div className="grid grid-cols-[1fr_6.5rem_6.5rem_1.5rem] items-center gap-2 text-xs font-semibold"><span>Cộng {ten.toLowerCase()}: {so(tongHP + tongTN, 0)} t</span><span className="text-right tabular-nums">{so(tongHP, 0)}</span><span className="text-right tabular-nums">{so(tongTN, 0)}</span><span /></div>
        <div className="flex justify-end"><Button size="sm" disabled={!sua} onClick={luu}><Save />Lưu</Button></div>
      </div>
    </PopupBenCanh>
  );
}
