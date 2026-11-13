import { useMemo, useState } from "react";
import { Search, Pencil, Trash2 } from "lucide-react";
import { useApp } from "@/store";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Empty, ConfirmButton } from "@/components/common";
import { so, ngayNam, matchQ } from "@/lib/format";
import { LOAI_GD, TRANG_THAI_LO, NGUONG_KHO } from "@/lib/kho";
import { cn } from "@/lib/utils";

// Các bảng mở trong hộp thao tác của trang Khai thác kho bãi (chuyển từ các tab cũ của trang Kho): Lịch sử nhập – xuất, Lô thành phẩm.
// kho: bản kho đã lọc theo tab (locKhoTheoTab); loai: thanh_pham | nguyen_lieu
const TEN_GD = Object.fromEntries(LOAI_GD);
const TEN_NGUON = { tau: "Tàu", cap_sx: "Cấp sản xuất", san_xuat: "Từ sản xuất", don_hang: "Đơn hàng", khac: "Khác" };

// Lịch sử xuất / nhập: các lượt trong 35 ngày gần nhất của gian / lô thuộc tab, tìm nhanh, sửa / xóa theo quyền
export function LichSuKho({ kho, loai, onSua }) {
  const { D, quyen, run, api } = useApp();
  const [qSo, setQSo] = useState("");
  const tp = loai === "thanh_pham", nhap = quyen.kho.nhap;
  const keys = useMemo(() => new Set(kho.dong.map((d) => d.key)), [kho]);
  const gd = useMemo(() => (D.giaoDich || []).filter((g) => keys.has(kho.gan(g.ten_bai, g.hang, g.ten_khu)) || (g.den_bai && keys.has(kho.gan(g.den_bai, g.hang, g.den_khu))))
    .sort((a, b) => String(b.ngay).localeCompare(String(a.ngay)) || b.id - a.id), [D.giaoDich, keys, kho]);
  const gdLoc = qSo.trim() ? gd.filter((g) => matchQ(qSo, ngayNam(g.ngay), g.ca, TEN_GD[g.loai], g.ten_bai, g.den_bai, g.hang, g.so_lo, g.chung_tu, g.ghi_chu, TEN_NGUON[g.nguon], g.voyage_id ? D.vmap.get(g.voyage_id)?.ten_tau : "")) : gd;
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" value={qSo} onChange={(e) => setQSo(e.target.value)} placeholder="Tìm nhanh: ngày, bãi, hàng, lô, tàu, chứng từ, ghi chú…" aria-label="Tìm nhanh trong lịch sử nhập – xuất" />
        </div>
        <span className="text-xs text-muted-foreground">{qSo.trim() ? `${gdLoc.length}/${gd.length} lượt` : "Các lượt trong 35 ngày gần nhất, mới nhất ở trên."}</span>
      </div>
      {gd.length && !gdLoc.length ? <Empty>Không có lượt nào khớp "{qSo}".</Empty> : gd.length ? (
        <div className="scroll-x max-h-[60vh]">
          <table className="tbl">
            <thead><tr><th>Ngày</th><th>Ca</th><th>Loại</th><th>Bãi</th><th>Hàng</th><th className="num">Số lượng (t)</th>{tp && <th>Lô</th>}<th>Nguồn / chuyến</th><th>Chứng từ, ghi chú</th>{nhap && <th></th>}</tr></thead>
            <tbody>{gdLoc.slice(0, 400).map((g) => (
              <tr key={g.id}>
                <td className="whitespace-nowrap tabular-nums">{ngayNam(g.ngay)}</td><td>{g.ca}</td>
                <td><Badge tone={g.loai === "nhap" || g.loai === "dau_ky" ? "ok" : g.loai === "xuat" ? "warn" : g.loai === "kiem_ke" ? "info" : "default"}>{TEN_GD[g.loai]}</Badge></td>
                <td>{g.ten_bai}{g.ten_khu ? ` › ${g.ten_khu}` : ""}{g.den_bai ? ` → ${g.den_bai}${g.den_khu ? ` › ${g.den_khu}` : ""}` : ""}</td><td>{g.hang}</td>
                <td className={cn("num", g.loai === "xuat" && "text-warn")}>{g.loai === "xuat" ? "−" : ""}{so(g.so_luong, 2)}</td>
                {tp && <td className="font-mono text-xs">{g.so_lo}</td>}
                <td className="text-xs">{g.voyage_id ? D.vmap.get(g.voyage_id)?.ten_tau || "Tàu" : ""}{g.nguon && !g.voyage_id ? g.nguon === "cap_sx" ? "Cấp sản xuất" : g.nguon === "san_xuat" ? "Từ sản xuất" : g.nguon === "don_hang" ? "Đơn hàng" : "" : ""}</td>
                <td className="max-w-[260px] truncate text-xs text-muted-foreground" title={[g.chung_tu, g.ghi_chu].filter(Boolean).join(" · ")}>{[g.chung_tu, g.ghi_chu].filter(Boolean).join(" · ")}</td>
                {nhap && <td className="whitespace-nowrap"><Button size="icon" variant="ghost" className="h-7 w-7" title="Sửa lượt này" aria-label="Sửa lượt này" onClick={() => onSua(g)}><Pencil /></Button>{quyen.kho.quanLy && <ConfirmButton confirmText="Xóa?" onConfirm={() => run(() => api.deleteGiaoDich(g.id), "Đã xóa lượt")}><Trash2 /></ConfirmButton>}</td>}
              </tr>))}</tbody>
          </table>
        </div>
      ) : <Empty>Chưa có lượt nhập – xuất. Bấm Nhập / Xuất, hoặc Dán nhanh / Excel để nạp cả bảng (kể cả tồn đầu kỳ).</Empty>}
    </div>
  );
}

// Lô thành phẩm còn tồn (đổi tình trạng lô theo quyền nhập liệu)
export function BangLo({ kho }) {
  const { quyen, run, api } = useApp();
  const nhap = quyen.kho.nhap;
  const lo = [...kho.lo].sort((a, b) => (b.tuoi ?? 0) - (a.tuoi ?? 0));
  if (!lo.length) return <Empty>Chưa có lô thành phẩm nào còn tồn. Nhập thành phẩm kèm số lô ở nút Nhập / Xuất.</Empty>;
  return (
    <div className="scroll-x max-h-[60vh]">
      <table className="tbl">
        <thead><tr><th>Số lô</th><th>Hàng</th><th>Bãi</th><th>Ngày nhập</th><th className="num">Tuổi tồn (ngày)</th><th className="num">Tồn (t)</th><th>Tình trạng</th><th>Ghi chú</th></tr></thead>
        <tbody>{lo.map((l) => (
          <tr key={l.so_lo + l.ten_bai}>
            <td className="font-mono">{l.so_lo}</td><td>{l.hang}</td><td>{l.ten_bai}</td><td className="tabular-nums">{ngayNam(l.ngay_nhap)}</td>
            <td className={cn("num", l.tuoi > NGUONG_KHO.tonLauNgay && "font-semibold text-warn")}>{l.tuoi}</td><td className="num">{so(l.ton)}</td>
            <td>{nhap ? <NativeSelect className="h-8 w-36" value={l.trang_thai} options={Object.entries(TRANG_THAI_LO).map(([k, t]) => [k, t.ten])}
              onChange={(e) => run(() => api.saveLo([{ so_lo: l.so_lo, hang: l.hang, ngay_nhap: l.ngay_nhap, trang_thai: e.target.value }]), `Đã đổi tình trạng lô ${l.so_lo}`)} />
              : <Badge tone={TRANG_THAI_LO[l.trang_thai].tone}>{TRANG_THAI_LO[l.trang_thai].ten}</Badge>}</td>
            <td className="text-xs text-muted-foreground">{l.ghi_chu}</td>
          </tr>))}</tbody>
      </table>
    </div>
  );
}
