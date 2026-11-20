import { useMemo, useState } from "react";
import { Save, Scale } from "lucide-react";
import { useApp } from "@/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { so, docSo, plain } from "@/lib/format";
import { chiaTheoSucChua, r2, KE_HOACH } from "@/lib/keHoachTH";
import { PopupBenCanh } from "./PopupBenCanh";
import { FormPhanBoVT } from "../cang/HopPhanBoVT";
import { NV_SAN_XUAT } from "@/lib/sanLuongTT";

// Hộp nhỏ "Xuất kho" (kế hoạch xuất bán) / "Nhập kho" (kế hoạch sản xuất, nhập mua) khi bấm số TỔNG của một hàng:
// cột trái = bãi › gian / lô đang chứa hàng đó (kèm tồn, sức chứa), ô bên phải = khối lượng của gian / lô đó; nút "Phân bổ theo tỉ lệ sức chứa" chia tổng về các gian / lô theo sức chứa.
// Kế hoạch sản xuất không có đường bộ / biển nên tổng nhập ngay ở hộp này (tongSua). Gian / lô gồm: có tồn hàng này, khai báo chứa hàng này ở Danh mục, hoặc đã có phân bổ từ trước.
// vanTai (chỉ kế hoạch sản xuất): { kyLoai, hangVT, onXong } thêm mục "Phân bổ vận tải" (chọn Trung chuyển / Thu hồi / Cấp sản xuất, chia Băng tải / Chạy xe) cạnh mục Nhập kho.
export default function HopPhanKho({ neo, onDong, loai, ky, hang, tong, tongSua, kho, khoRows, sua, onLuu, vanTai }) {
  const { api, run } = useApp();
  const ten = KE_HOACH[loai].tenKho;
  const [tongTxt, setTongTxt] = useState(String(tong || ""));
  const [muc, setMuc] = useState("kho"); // kho | vt
  const tongHT = tongSua ? docSo(tongTxt) || 0 : tong;
  const ds = useMemo(() => {
    const dong = kho?.dong || [], theoKey = new Map(dong.map((d) => [d.key, d])), m = new Map();
    const them = (d, ton) => { const o = m.get(d.key) || { key: d.key, ten_bai: d.ten_bai, ten_khu: d.ten, ton: 0, suc: +d.sucChua || 0 }; o.ton += ton; m.set(d.key, o); };
    for (const c of kho?.cap || []) { if (plain(c.hang) === plain(hang) && c.ton > 1e-6 && theoKey.has(c.key)) them(theoKey.get(c.key), c.ton); }
    for (const r of khoRows) { const d = dong.find((x) => x.ten_bai === r.ten_bai && x.ten === r.ten_khu); if (d) { if (!m.has(d.key)) them(d, 0); } else m.set(`${r.ten_bai}|${r.ten_khu}`, { key: `${r.ten_bai}|${r.ten_khu}`, ten_bai: r.ten_bai, ten_khu: r.ten_khu, ton: 0, suc: 0 }); }
    // Hàng chưa có tồn và chưa phân bổ ở đâu (VD hàng mới nhập mua): gợi ý các gian / lô đã khai báo chứa hàng này ở Danh mục
    if (!m.size) for (const d of dong) if (!d.saiBai && plain(d.hang || "") === plain(hang)) them(d, 0);
    return [...m.values()].sort((a, b) => String(a.ten_bai).localeCompare(String(b.ten_bai), "vi", { numeric: true }) || String(a.ten_khu).localeCompare(String(b.ten_khu), "vi", { numeric: true }));
  }, [kho, hang, khoRows]);
  const [v, setV] = useState(() => Object.fromEntries(khoRows.map((r) => {
    const d = (kho?.dong || []).find((x) => x.ten_bai === r.ten_bai && x.ten === r.ten_khu);
    return [d?.key || `${r.ten_bai}|${r.ten_khu}`, String(r.tan)];
  })));
  const gt = (k) => docSo(v[k]) || 0;
  const daChia = r2(ds.reduce((s, x) => s + gt(x.key), 0)), con = r2(tongHT - daChia);
  const chia = () => { const m = chiaTheoSucChua(tongHT, ds); setV(Object.fromEntries(ds.map((x) => [x.key, m.has(x.key) ? String(m.get(x.key)) : ""]))); };
  const luu = async () => {
    const rows = ds.map((x) => ({ ten_bai: x.ten_bai, ten_khu: x.ten_khu, tan: r2(gt(x.key)) })).filter((r) => r.tan > 0);
    const ok = await run(async () => {
      await Promise.all([api.luuKhPhanKho(loai, ky, hang, rows), tongSua ? api.luuKhDong(loai, ky, { ghi: [{ hang, bo: 0, bien: 0, tong: r2(tongHT) }] }) : null]);
    }, `Đã lưu ${ten.toLowerCase()} · ${hang}`);
    if (ok) { onLuu(); onDong(); }
  };
  return (
    <PopupBenCanh neo={neo} onDong={onDong} tieuDe={`${ten} · ${hang}`} phu={tongSua ? "Nhập tổng kế hoạch rồi phân bổ về từng bãi – gian / lô" : `Tổng kế hoạch: ${so(tong, 0)} t`} rong={400}>
      {vanTai && (
        <div className="flex gap-1 border-b px-3 py-1.5">
          {[["kho", ten], ["vt", "Phân bổ vận tải"]].map(([k, t]) => <button key={k} type="button" onClick={() => setMuc(k)} className={`rounded px-2.5 py-1 text-xs font-medium ${muc === k ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}>{t}</button>)}
        </div>)}
      {vanTai && muc === "vt" && <FormPhanBoVT tong={tongHT} hang={hang} hangVT={vanTai.hangVT} nghiepVu={NV_SAN_XUAT} huongVT="phuc_vu_san_xuat" kyLoai={vanTai.kyLoai} ky={ky} sua={sua} onXong={vanTai.onXong} />}
      {!(vanTai && muc === "vt") && tongSua && (
        <div className="flex items-center gap-2 border-b px-3 py-2"><span className="flex-1 text-xs font-medium">Tổng kế hoạch (t)</span>
          <Input className="h-8 w-28 text-right tabular-nums" inputMode="decimal" disabled={!sua} value={tongTxt} placeholder="0" onChange={(e) => setTongTxt(e.target.value)} /></div>)}
      {!(vanTai && muc === "vt") && <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {!ds.length ? <div className="py-4 text-center text-xs text-muted-foreground">Chưa có bãi – gian / lô nào đang chứa hoặc khai báo chứa hàng này (Danh mục › Kho bãi).</div> : (
          <div className="grid gap-1.5">
            <div className="grid grid-cols-[1fr_6.5rem] gap-2 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground"><span>Bãi › gian / lô</span><span className="text-right">{ten === "Xuất kho" ? "Xuất" : "Nhập"} (t)</span></div>
            {ds.map((x) => {
              const vuot = loai === "xuat_ban" && gt(x.key) > x.ton + 1e-6;
              return (
                <div key={x.key} className="grid grid-cols-[1fr_6.5rem] items-center gap-2">
                  <div className="min-w-0"><div className="truncate" title={`${x.ten_bai} › ${x.ten_khu}`}>{x.ten_bai} › {x.ten_khu}</div>
                    <div className="text-[0.6875rem] text-muted-foreground">tồn <b className={vuot ? "text-bad" : "text-foreground"}>{so(x.ton, 0)}</b> t{x.suc > 0 ? ` · sức chứa ${so(x.suc, 0)} t` : ""}</div></div>
                  <Input className="h-8 text-right tabular-nums" inputMode="decimal" disabled={!sua} value={v[x.key] ?? ""} placeholder="0" onChange={(e) => setV((o) => ({ ...o, [x.key]: e.target.value }))} />
                </div>);
            })}
          </div>)}
      </div>}
      {!(vanTai && muc === "vt") && <div className="grid gap-2 border-t px-3 py-2">
        <div className="flex items-center justify-between text-xs">
          <span>Đã phân bổ <b className="tabular-nums">{so(daChia, 0)}</b> / <b className="tabular-nums">{so(tongHT, 0)}</b> t</span>
          <span className={Math.abs(con) < 0.005 ? "font-medium text-ok" : con < 0 ? "font-medium text-bad" : "font-medium text-warn"}>{Math.abs(con) < 0.005 ? "Khớp tổng" : con > 0 ? `còn thiếu ${so(con, 0)} t` : `vượt ${so(-con, 0)} t`}</span>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button size="sm" variant="outline" disabled={!sua || !ds.length || !(tongHT > 0)} onClick={chia} title="Chia tổng kế hoạch về các gian / lô theo tỉ lệ sức chứa"><Scale />Phân bổ theo tỉ lệ sức chứa</Button>
          <Button size="sm" disabled={!sua || (!ds.length && !tongSua)} onClick={luu}><Save />Lưu</Button>
        </div>
      </div>}
    </PopupBenCanh>
  );
}
