import { useMemo, useState } from "react";
import { Search, Pencil, Trash2, Check, X } from "lucide-react";
import { useApp } from "@/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Empty, ConfirmButton } from "@/components/common";
import { so, ngayNam, matchQ, plain } from "@/lib/format";
import { docSo } from "@/lib/paste";
import { LOAI_GD } from "@/lib/kho";
import { laTonDauDatLai } from "@/lib/tonDau";
import { cn } from "@/lib/utils";

// Các bảng mở trong hộp thao tác của trang Khai thác kho bãi (chuyển từ các tab cũ của trang Kho): Lịch sử nhập – xuất.
// kho: bản kho đã lọc theo tab (locKhoTheoTab); loai: thanh_pham | nguyen_lieu
const TEN_GD = Object.fromEntries(LOAI_GD);
const TEN_NGUON = { tau: "Tàu", cap_sx: "Cấp sản xuất", san_xuat: "Từ sản xuất", don_hang: "Đơn hàng", khac: "Khác" };

// Lịch sử xuất / nhập: các lượt trong 35 ngày gần nhất của gian / lô thuộc tab, tìm nhanh, sửa / xóa theo quyền
export function LichSuKho({ kho, loai, onSua }) {
  const { D, quyen, run, api, toast } = useApp();
  const [qSo, setQSo] = useState("");
  const [dangSua, setDangSua] = useState(null); // lượt đang SỬA TẠI DÒNG: { id, ngay, so_luong, ghi_chu } (anh Sỹ 21/11/2026); tồn đầu / kiểm kê vẫn mở hộp riêng
  const tp = loai === "thanh_pham", nhap = quyen.kho.theoLoai(loai);
  const keys = useMemo(() => new Set(kho.dong.map((d) => d.key)), [kho]);
  const gd = useMemo(() => (D.giaoDich || []).filter((g) => keys.has(kho.gan(g.ten_bai, g.hang, g.ten_khu)) || (g.den_bai && keys.has(kho.gan(g.den_bai, g.hang, g.den_khu))))
    .sort((a, b) => String(b.ngay).localeCompare(String(a.ngay)) || b.id - a.id), [D.giaoDich, keys, kho]);
  const gdLoc = qSo.trim() ? gd.filter((g) => matchQ(qSo, ngayNam(g.ngay), g.ca, TEN_GD[g.loai], g.ten_bai, g.den_bai, g.hang, g.so_lo, g.chung_tu, g.ghi_chu, TEN_NGUON[g.nguon], g.voyage_id ? D.vmap.get(g.voyage_id)?.ten_tau : "")) : gd;
  // Sửa được ngay trên dòng: lượt nhập / xuất / điều chuyển (ngày, khối lượng, ghi chú). Tồn đầu kỳ và kiểm kê có cách tính riêng nên vẫn mở hộp sửa.
  const suaTaiDong = (g) => g.loai === "nhap" || g.loai === "xuat" || g.loai === "dieu_chuyen";
  const batSua = (g) => {
    // Tồn đầu kỳ là số ĐẶT LẠI (do_thuc_te = số khai, so_luong = chênh lệch so với sổ): sửa riêng so_luong sẽ làm sai tồn / cộng dồn, nên không mở hộp sửa; khai lại tồn đầu ở bảng nhập liệu phía trên (lượt mới thay số cũ)
    if (g.loai === "dau_ky") return toast("Tồn đầu kỳ là số đặt lại: muốn đổi, khai lại ô Tồn đầu của gian / lô ở bảng nhập liệu phía trên (lượt mới thay số cũ, không cộng dồn).", "warn");
    return suaTaiDong(g) ? setDangSua({ id: g.id, ngay: String(g.ngay).slice(0, 10), so_luong: String(g.so_luong ?? "").replace(".", ","), ghi_chu: g.ghi_chu || "" }) : onSua(g);
  };
  const ton = (key, hang) => kho.cap.find((c) => c.key === key && plain(c.hang) === plain(hang))?.ton || 0;
  const luuSua = async (g) => {
    const v = docSo(dangSua.so_luong);
    if (v == null || !(v >= 0)) return toast("Khối lượng phải là số không âm", "bad");
    if (!dangSua.ngay) return toast("Chọn ngày", "bad");
    // Kiểm tra tồn sau khi đổi khối lượng: chênh lệch d so với số cũ không làm tồn của gian / lô nào âm
    const d = v - (+g.so_luong || 0), kDi = kho.gan(g.ten_bai, g.hang, g.ten_khu), kDen = g.den_bai ? kho.gan(g.den_bai, g.hang, g.den_khu) : null;
    if (d) {
      const am = (t) => t < -1e-6;
      if (g.loai === "nhap" && am(ton(kDi, g.hang) + d)) return toast(`Giảm khối lượng nhập làm tồn ${g.ten_bai}${g.ten_khu ? " › " + g.ten_khu : ""} âm (đang có ${so(ton(kDi, g.hang))} t)`, "bad");
      if (g.loai === "xuat" && am(ton(kDi, g.hang) - d)) return toast(`Vượt tồn: ${g.ten_bai}${g.ten_khu ? " › " + g.ten_khu : ""} chỉ còn ${so(ton(kDi, g.hang))} t`, "bad");
      if (g.loai === "dieu_chuyen" && (am(ton(kDi, g.hang) - d) || (kDen && am(ton(kDen, g.hang) + d)))) return toast("Đổi khối lượng điều chuyển làm tồn gian / lô đi hoặc đến bị âm", "bad");
    }
    if (await run(() => api.updateGiaoDich(g.id, { ngay: dangSua.ngay, so_luong: v, ghi_chu: dangSua.ghi_chu.trim() || null }), "Đã sửa lượt")) setDangSua(null);
  };
  const phim = (e, g) => { if (e.key === "Enter") luuSua(g); if (e.key === "Escape") setDangSua(null); };
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
        <div className="scroll-x max-h-[45vh]">
          <table className="tbl">
            <thead><tr><th>Ngày</th><th>Ca</th><th>Loại</th><th>Bãi</th><th>Hàng</th><th className="num">Khối lượng (t)</th>{tp && <th>Lô</th>}<th>Nguồn / chuyến</th><th>Chứng từ, ghi chú</th>{nhap && <th></th>}</tr></thead>
            <tbody>{gdLoc.slice(0, 400).map((g) => { const dangG = dangSua?.id === g.id; return (
              <tr key={g.id} className={cn(dangG && "bg-primary/10")}>
                <td className="whitespace-nowrap tabular-nums">{dangG ? <Input type="date" className="h-8 w-36 text-xs" value={dangSua.ngay} onChange={(e) => setDangSua({ ...dangSua, ngay: e.target.value })} onKeyDown={(e) => phim(e, g)} aria-label="Ngày" /> : ngayNam(g.ngay)}</td><td>{g.ca}</td>
                <td><Badge tone={g.loai === "nhap" || g.loai === "dau_ky" ? "ok" : g.loai === "xuat" ? "warn" : g.loai === "kiem_ke" ? "info" : "default"}>{TEN_GD[g.loai]}</Badge></td>
                <td>{g.ten_bai}{g.ten_khu ? ` › ${g.ten_khu}` : ""}{g.den_bai ? ` → ${g.den_bai}${g.den_khu ? ` › ${g.den_khu}` : ""}` : ""}</td><td>{g.hang}</td>
                <td className={cn("num", g.loai === "xuat" && "text-warn")}>{dangG ? <Input className="ml-auto h-8 w-28 text-right tabular-nums" inputMode="decimal" autoFocus value={dangSua.so_luong} onChange={(e) => setDangSua({ ...dangSua, so_luong: e.target.value })} onKeyDown={(e) => phim(e, g)} aria-label="Khối lượng (tấn)" /> : laTonDauDatLai(g) ? <>= {so(g.do_thuc_te, 2)}<div className="text-[0.6875rem] font-normal text-muted-foreground" title="Tồn đầu kỳ đặt lại: lượt này điều chỉnh số tồn sổ để đầu ngày đúng bằng số khai báo">({g.so_luong > 0 ? "+" : ""}{so(g.so_luong, 2)})</div></> : <>{g.loai === "xuat" ? "−" : ""}{so(g.so_luong, 2)}</>}</td>
                {tp && <td className="font-mono text-xs">{g.so_lo}</td>}
                <td className="text-xs">{g.voyage_id ? D.vmap.get(g.voyage_id)?.ten_tau || "Tàu" : ""}{g.nguon && !g.voyage_id ? g.nguon === "cap_sx" ? "Cấp sản xuất" : g.nguon === "san_xuat" ? "Từ sản xuất" : g.nguon === "don_hang" ? "Đơn hàng" : "" : ""}</td>
                <td className={cn("text-xs text-muted-foreground", !dangG && "max-w-[260px] truncate")} title={dangG ? undefined : [g.chung_tu, g.ghi_chu].filter(Boolean).join(" · ")}>{dangG ? <Input className="h-8 min-w-[160px]" value={dangSua.ghi_chu} placeholder="Ghi chú" onChange={(e) => setDangSua({ ...dangSua, ghi_chu: e.target.value })} onKeyDown={(e) => phim(e, g)} aria-label="Ghi chú" /> : [g.chung_tu, g.ghi_chu].filter(Boolean).join(" · ")}</td>
                {nhap && <td className="whitespace-nowrap">{dangG
                  ? <><Button size="icon" variant="ghost" className="h-7 w-7 text-primary" title="Lưu (Enter)" aria-label="Lưu lượt" onClick={() => luuSua(g)}><Check /></Button><Button size="icon" variant="ghost" className="h-7 w-7" title="Hủy sửa (Esc)" aria-label="Hủy sửa" onClick={() => setDangSua(null)}><X /></Button></>
                  : <Button size="icon" variant="ghost" className="h-7 w-7" title={g.loai === "dau_ky" ? "Tồn đầu kỳ: khai lại ở bảng nhập liệu" : suaTaiDong(g) ? "Sửa tại dòng" : "Sửa lượt này"} aria-label="Sửa lượt này" onClick={() => batSua(g)}><Pencil /></Button>}{quyen.kho.theoLoai(loai) && <ConfirmButton confirmText="Xóa?" onConfirm={() => run(() => api.deleteGiaoDich(g.id), "Đã xóa lượt")}><Trash2 /></ConfirmButton>}</td>}
              </tr>); })}</tbody>
          </table>
        </div>
      ) : <Empty>Chưa có lượt nhập – xuất. Bấm Nhập / Xuất, hoặc Dán nhanh / Excel để nạp cả bảng (kể cả tồn đầu kỳ).</Empty>}
    </div>
  );
}
