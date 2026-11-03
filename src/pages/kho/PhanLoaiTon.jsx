import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useApp } from "@/store";
import { Input, NativeSelect } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmButton, Empty } from "@/components/common";
import { so, ngayNam } from "@/lib/format";
import { docSo } from "@/lib/paste";
import { ngayStr } from "@/lib/kho";

// Kho › Phân loại tồn (SQL 07): khai báo phần tồn của một bãi + hàng thuộc loại "cần giải phóng" hoặc "đầu cơ"; phần còn lại là tồn lưu động.
// Mỗi dòng là một lần khai báo "từ ngày X có N tấn"; khai báo mới thay số cũ của cùng bãi + hàng + loại; 0 tấn = hết phân loại.
export const LOAI_TON = { can_giai_phong: { ten: "Cần giải phóng", tone: "bad" }, dau_co: { ten: "Đầu cơ", tone: "warn" } };
const MO_TA = { can_giai_phong: "tồn lâu ngày không bán được / chưa có hướng xử lý, chiếm bãi", dau_co: "sản xuất đón đầu thị trường / mua dự trữ khi giá rẻ, dùng lâu dài" };

export default function PhanLoaiTon({ loai, kho }) {
  const { D, api, quyen, run } = useApp();
  const [ds, setDs] = useState(undefined);
  useEffect(() => { let huy = false; api.loadTonPhanLoai().then((r) => { if (!huy) setDs(r); }).catch(() => { if (!huy) setDs(null); }); return () => { huy = true; }; }, [api, D]);
  const cap = useMemo(() => kho.cap.filter((c) => c.loai === loai && !c.key.startsWith("sai|")).sort((a, b) => a.ten_bai.localeCompare(b.ten_bai, "vi") || a.hang.localeCompare(b.hang, "vi")), [kho, loai]);
  const tenBai = useMemo(() => new Set(kho.dong.filter((d) => d.loai === loai).map((d) => d.ten_bai)), [kho, loai]);
  const [f, setF] = useState({ ngay: ngayStr(D.now), cap: "", loai: "can_giai_phong", tan: "", ghi_chu: "" });
  const chon = cap[+f.cap];
  if (ds === null) return <div className="rounded-md border border-warn/40 bg-warn/5 px-3 py-2 text-sm">Chưa có bảng phân loại tồn: quản trị cần chạy <b>sql/07_phan_loai_ton.sql</b> trong Supabase.</div>;
  if (ds === undefined) return <Empty>Đang tải…</Empty>;
  const hang = ds.filter((r) => tenBai.has(r.ten_bai)).sort((a, b) => String(b.ngay).localeCompare(String(a.ngay)) || b.id - a.id);
  // Số đang có hiệu lực: lần khai báo mới nhất của cùng bãi + hàng + loại
  const hieuLuc = new Set(), daThay = new Set();
  for (const r of hang) { const k = `${r.ten_bai}|${r.hang}|${r.loai}`; if (!daThay.has(k)) { daThay.add(k); hieuLuc.add(r.id); } }
  const tan = docSo(f.tan);
  const luu = () => run(async () => {
    await api.addTonPhanLoai([{ ngay: f.ngay, ten_bai: chon.ten_bai, hang: chon.hang, loai: f.loai, tan, ghi_chu: f.ghi_chu.trim() || null }]);
    setF((o) => ({ ...o, tan: "", ghi_chu: "" }));
  }, "Đã khai báo phân loại tồn");
  return (
    <div className="grid gap-3">
      <p className="text-xs text-muted-foreground">
        Khai báo phần tồn thuộc <b>{LOAI_TON.can_giai_phong.ten.toLowerCase()}</b> ({MO_TA.can_giai_phong}) hoặc <b>{LOAI_TON.dau_co.ten.toLowerCase()}</b> ({MO_TA.dau_co}). Phần còn lại tự là <b>tồn lưu động</b>.
        Khai báo mới thay số cũ của cùng bãi + hàng + loại; nhập 0 tấn để kết thúc phân loại.
      </p>
      {quyen.kho.nhap && (
        <div className="flex flex-wrap items-end gap-2 rounded-md border bg-muted/30 p-3">
          <label className="grid gap-1 text-xs">Từ ngày<Input type="date" className="h-8 w-36" value={f.ngay} onChange={(e) => setF({ ...f, ngay: e.target.value })} /></label>
          <label className="grid gap-1 text-xs">Bãi › Hàng
            <NativeSelect className="h-8 w-72" value={f.cap} onChange={(e) => { const c = cap[+e.target.value]; setF({ ...f, cap: e.target.value, tan: c ? String(Math.max(0, Math.round(c.ton))) : "" }); }} placeholder="Chọn bãi và hàng" options={cap.map((c, i) => [String(i), `${c.ten_bai} › ${c.hang} (tồn ${so(c.ton)} t)`])} />
          </label>
          <label className="grid gap-1 text-xs">Loại<NativeSelect className="h-8 w-40" value={f.loai} onChange={(e) => setF({ ...f, loai: e.target.value })} options={Object.entries(LOAI_TON).map(([k, t]) => [k, t.ten])} /></label>
          <label className="grid gap-1 text-xs">Số tấn<Input className="h-8 w-28 text-right" inputMode="decimal" value={f.tan} onChange={(e) => setF({ ...f, tan: e.target.value })} /></label>
          <label className="grid min-w-[160px] flex-1 gap-1 text-xs">Ghi chú<Input className="h-8" value={f.ghi_chu} onChange={(e) => setF({ ...f, ghi_chu: e.target.value })} /></label>
          <Button size="sm" disabled={!chon || !f.ngay || tan == null || tan < 0} onClick={luu}><Plus />Khai báo</Button>
        </div>)}
      {hang.length ? (
        <div className="scroll-x max-h-[50vh] rounded-md border">
          <table className="tbl text-xs">
            <thead><tr><th>Từ ngày</th><th>Bãi</th><th>Hàng</th><th>Loại</th><th className="num">Số tấn</th><th>Ghi chú</th><th>Tình trạng</th>{quyen.kho.quanLy && <th></th>}</tr></thead>
            <tbody>{hang.map((r) => (
              <tr key={r.id} className={hieuLuc.has(r.id) ? "" : "text-muted-foreground"}>
                <td className="whitespace-nowrap tabular-nums">{ngayNam(r.ngay)}</td><td>{r.ten_bai}</td><td>{r.hang}</td>
                <td><Badge tone={LOAI_TON[r.loai].tone}>{LOAI_TON[r.loai].ten}</Badge></td><td className="num">{so(r.tan, 1)}</td><td>{r.ghi_chu}</td>
                <td>{hieuLuc.has(r.id) ? (+r.tan > 0 ? <Badge tone="ok">Đang hiệu lực</Badge> : <span>Đã kết thúc</span>) : <span>Đã thay</span>}</td>
                {quyen.kho.quanLy && <td><ConfirmButton confirmText="Xóa?" onConfirm={() => run(() => api.deleteTonPhanLoai(r.id), "Đã xóa khai báo")}><Trash2 /></ConfirmButton></td>}
              </tr>))}</tbody>
          </table>
        </div>
      ) : <Empty>Chưa khai báo tồn cần giải phóng hay đầu cơ nào: toàn bộ tồn của kho này đang tính là tồn lưu động.</Empty>}
    </div>
  );
}
