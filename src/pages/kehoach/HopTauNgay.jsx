import { useEffect, useMemo, useState } from "react";
import { Plus, Save, Scale, X } from "lucide-react";
import { useApp } from "@/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChonGo } from "@/components/ui/combobox";
import { so, docSo } from "@/lib/format";
import { chiaTheoSucChua, dongGhiXe, loChuaHang, hangCuaTau, r2 } from "@/lib/keHoachTH";
import { PopupBenCanh } from "./PopupBenCanh";

// Hộp tiếp theo khi trỏ vào một dòng tàu trong khung "Ngày dd/mm" của Kế hoạch ngày đường biển và bấm mũi tên (anh Sỹ 20/11/2026): hai mục
//   • "Phân xe": loại xe (tùy chọn) × Hòa Phát × Thuê ngoài — chia khối lượng kế hoạch của tàu trong ngày đó cho xe;
//   • "Xuất kho" (tàu xuất) / "Nhập kho" (tàu nhập): chia khối lượng đó về các bãi › gian / lô (nút phân bổ theo tỉ lệ sức chứa).
// Khối lượng của tàu trong ngày (tong) là số ở ô của khung (bảng ke_hoach_san_luong_ngay); hộp này chỉ chia nhỏ. Lưu ghi kh_ngay_tau_xe và kh_ngay_tau_kho (SQL 23).
export default function HopTauNgay({ neo, onDong, v, ngay, tong, kho, loaiXe, sua }) {
  const { api, run } = useApp();
  const xuat = v.huong === "xuat", ten = xuat ? "Xuất kho" : "Nhập kho", dd = ngay.slice(8) + "/" + ngay.slice(5, 7);
  const [muc, setMuc] = useState("xe");
  const [goc, setGoc] = useState(undefined); // dữ liệu đã lưu; undefined: đang tải · null: chưa chạy SQL 23
  const [rows, setRows] = useState([{ id: 0, loai: "", hp: "", tn: "" }]);
  const [kv, setKv] = useState({});
  useEffect(() => {
    let huy = false;
    api.docKhNgayTau(v.id, ngay).then((r) => {
      if (huy) return; setGoc(r);
      if (!r) return;
      const m = new Map(); for (const x of r.xe) { const o = m.get(x.loai_xe) || { loai: x.loai_xe, hp: 0, tn: 0 }; o[x.don_vi === "hoa_phat" ? "hp" : "tn"] += +x.tan; m.set(x.loai_xe, o); }
      if (m.size) setRows([...m.values()].map((o, i) => ({ id: i, loai: o.loai, hp: o.hp ? String(o.hp) : "", tn: o.tn ? String(o.tn) : "" })));
      setKv(Object.fromEntries(r.kho.map((x) => [`${x.ten_bai}|${x.ten_khu}`, String(x.tan)])));
    }).catch(() => { if (!huy) setGoc(null); });
    return () => { huy = true; };
  }, [api, v.id, ngay]);
  const khoRows = useMemo(() => Object.keys(kv).map((k) => { const [ten_bai, ten_khu] = k.split("|"); return { ten_bai, ten_khu }; }), [kv]);
  const ds = useMemo(() => loChuaHang(kho, hangCuaTau(v), khoRows), [kho, v, khoRows]);
  const set = (id, k, val) => setRows((o) => o.map((r) => (r.id === id ? { ...r, [k]: val } : r)));
  const hp = r2(rows.reduce((s, r) => s + (docSo(r.hp) || 0), 0)), tn = r2(rows.reduce((s, r) => s + (docSo(r.tn) || 0), 0)), chuaXe = r2(tong - hp - tn);
  const gt = (k) => docSo(kv[k]) || 0, daKho = r2(ds.reduce((s, x) => s + gt(x.key), 0)), chuaKho = r2(tong - daKho);
  const chia = () => { const m = chiaTheoSucChua(tong, ds); setKv(Object.fromEntries(ds.map((x) => [x.key, m.has(x.key) ? String(m.get(x.key)) : ""]))); };
  const luu = async () => {
    const xe = dongGhiXe(rows.map((r) => ({ loai: r.loai, hp: docSo(r.hp), tn: docSo(r.tn) })));
    const khoGhi = ds.map((x) => ({ ten_bai: x.ten_bai, ten_khu: x.ten_khu, tan: r2(gt(x.key)) })).filter((r) => r.tan > 0);
    if (await run(() => api.luuKhNgayTau(v.id, ngay, { xe, kho: khoGhi }), `Đã lưu phân xe và ${ten.toLowerCase()} · ${v.ten_tau} ngày ${dd}`)) onDong();
  };
  const khop = (x) => (Math.abs(x) < 0.005 ? "text-ok" : x < 0 ? "text-bad" : "text-warn");
  return (
    <PopupBenCanh neo={neo} onDong={onDong} tieuDe={`${v.ten_tau} · ${xuat ? "Xuất" : "Nhập"} · ngày ${dd}`} phu={`Khối lượng kế hoạch trong ngày: ${so(tong, 0)} t${tong > 0 ? "" : " (nhập số tấn ở khung bên trái trước)"}`} rong={430}>
      {goc === null ? <div className="px-3 py-4 text-sm text-warn">Chưa có bảng chi tiết kế hoạch ngày: quản trị chạy <b>sql/23_ke_hoach_ngay.sql</b> rồi tải lại web.</div> : (
        <>
          <div className="flex gap-1 border-b px-3 py-1.5">
            {[["xe", "Phân xe"], ["kho", ten]].map(([k, t]) => <button key={k} type="button" onClick={() => setMuc(k)} className={`rounded px-2.5 py-1 text-xs font-medium ${muc === k ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}>{t}</button>)}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
            {goc === undefined ? <div className="py-4 text-center text-xs text-muted-foreground">Đang tải…</div> : muc === "xe" ? (
              <div className="grid gap-1.5">
                <div className="grid grid-cols-[1fr_6rem_6rem_1.5rem] gap-2 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground"><span>Loại xe</span><span className="text-right">Hòa Phát (t)</span><span className="text-right">Thuê ngoài (t)</span><span /></div>
                {rows.map((r) => (
                  <div key={r.id} className="grid grid-cols-[1fr_6rem_6rem_1.5rem] items-center gap-2">
                    <ChonGo value={r.loai} onChange={(x) => set(r.id, "loai", x)} options={loaiXe} placeholder="(không chia loại xe)" disabled={!sua} inputClassName="h-8" />
                    <Input className="h-8 text-right tabular-nums" inputMode="decimal" disabled={!sua} value={r.hp} placeholder="0" onChange={(e) => set(r.id, "hp", e.target.value)} />
                    <Input className="h-8 text-right tabular-nums" inputMode="decimal" disabled={!sua} value={r.tn} placeholder="0" onChange={(e) => set(r.id, "tn", e.target.value)} />
                    <button type="button" disabled={!sua || rows.length < 2} onClick={() => setRows((o) => o.filter((x) => x.id !== r.id))} className="rounded p-0.5 text-muted-foreground hover:text-bad disabled:opacity-30" aria-label="Bỏ dòng"><X className="h-4 w-4" /></button>
                  </div>))}
                <Button size="sm" variant="ghost" className="justify-self-start" disabled={!sua} onClick={() => setRows((o) => [...o, { id: Math.max(-1, ...o.map((x) => x.id)) + 1, loai: "", hp: "", tn: "" }])}><Plus />Thêm loại xe</Button>
                <div className={`text-xs ${khop(chuaXe)}`}>Đã phân xe {so(hp + tn, 0)} / {so(tong, 0)} t · {Math.abs(chuaXe) < 0.005 ? "khớp" : chuaXe > 0 ? `chưa phân ${so(chuaXe, 0)} t` : `vượt ${so(-chuaXe, 0)} t`}</div>
              </div>
            ) : !ds.length ? <div className="py-4 text-center text-xs text-muted-foreground">Chưa có bãi – gian / lô nào đang chứa hoặc khai báo chứa hàng của tàu này ({hangCuaTau(v).join(", ") || "chưa ghi hàng"}).</div> : (
              <div className="grid gap-1.5">
                <div className="grid grid-cols-[1fr_6.5rem] gap-2 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground"><span>Bãi › gian / lô</span><span className="text-right">{xuat ? "Xuất" : "Nhập"} (t)</span></div>
                {ds.map((x) => {
                  const vuot = xuat && gt(x.key) > x.ton + 1e-6;
                  return (
                    <div key={x.key} className="grid grid-cols-[1fr_6.5rem] items-center gap-2">
                      <div className="min-w-0"><div className="truncate" title={`${x.ten_bai} › ${x.ten_khu}`}>{x.ten_bai} › {x.ten_khu}</div>
                        <div className="text-[0.6875rem] text-muted-foreground">tồn <b className={vuot ? "text-bad" : "text-foreground"}>{so(x.ton, 0)}</b> t{x.suc > 0 ? ` · sức chứa ${so(x.suc, 0)} t` : ""}</div></div>
                      <Input className="h-8 text-right tabular-nums" inputMode="decimal" disabled={!sua} value={kv[x.key] ?? ""} placeholder="0" onChange={(e) => setKv((o) => ({ ...o, [x.key]: e.target.value }))} />
                    </div>);
                })}
                <div className={`text-xs ${khop(chuaKho)}`}>Đã phân bổ {so(daKho, 0)} / {so(tong, 0)} t · {Math.abs(chuaKho) < 0.005 ? "khớp" : chuaKho > 0 ? `còn thiếu ${so(chuaKho, 0)} t` : `vượt ${so(-chuaKho, 0)} t`}</div>
              </div>)}
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t px-3 py-2">
            {muc === "kho" && <Button size="sm" variant="outline" disabled={!sua || !ds.length || !(tong > 0)} onClick={chia} title="Chia khối lượng của tàu trong ngày về các gian / lô theo tỉ lệ sức chứa"><Scale />Phân bổ theo tỉ lệ sức chứa</Button>}
            <Button size="sm" disabled={!sua || goc === undefined} onClick={luu}><Save />Lưu</Button>
          </div>
        </>)}
    </PopupBenCanh>
  );
}
