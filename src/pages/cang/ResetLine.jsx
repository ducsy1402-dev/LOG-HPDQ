import { useState } from "react";
import { Trash2, TriangleAlert } from "lucide-react";
import { useApp } from "@/store";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { tenBenChuyen } from "./BangTauBen";
import { ngayGio } from "@/lib/format";

// Reset line tàu cập (anh Sỹ chốt 14/11/2026): XÓA HẲN mọi chuyến tàu (cùng khoảng dừng, nhật ký, trả hàng, kế hoạch ngày của chuyến). Không hoàn tác được.
// Chỉ quản trị thấy nút. Phải gõ lại đúng mã ngẫu nhiên web đưa ra; web tự tải file Excel sao lưu mọi chuyến trước khi xóa.
async function taiSaoLuu(voyages) {
  const XLSX = await import("xlsx");
  const dong = voyages.map((v) => ({
    "Mã chuyến": v.ma_chuyen, "Bến": tenBenChuyen(v), "Tên tàu": v.ten_tau, "Hướng": v.huong === "xuat" ? "Xuất" : "Nhập", "Hàng": v.ten_hang || v.loai_hang || "", "Khối lượng (t)": v.khoi_luong ?? "",
    "Đã làm (t)": v.da_lam ?? "", DRAFT: v.draft ?? "", LOA: v.loa ?? "", DWT: v.dwt ?? "", GEAR: v.gear || "", "Cam kết": v.cam_ket ?? v.cam_ket_ghi_chu ?? "", "DEM/day": v.dem_day || "",
    "PT. Vận chuyển": (v.pt_van_chuyen || []).map((m) => (m.gia_tri != null ? `${m.ten}-${m.gia_tri}` : m.ten)).join(", "),
    "Kho-Bãi": (v.bai_kl || []).map((b) => (b.khoi_luong != null ? `${b.bai}-${b.khoi_luong}` : b.bai)).join(", "),
    "PT. Kho Bãi": (v.pt_kho_bai || []).map((m) => (m.gia_tri != null ? `${m.ten}-${m.gia_tri}` : m.ten)).join(", "),
    LAYTIME: v.laytime_txt || "", LSD: v.lsd || "", "Ghi chú": v.ghi_chu || "",
    ETA: v.eta ? ngayGio(v.eta) : "", ETB: v.etb ? ngayGio(v.etb) : "", ETD: v.etd ? ngayGio(v.etd) : "", ATB: v.atb ? ngayGio(v.atb) : "", ATD: v.atd ? ngayGio(v.atd) : "", "Hủy": v.huy ? "x" : "",
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dong), "Chuyến tàu");
  const d = new Date(), p = (n) => String(n).padStart(2, "0");
  XLSX.writeFile(wb, `sao-luu-line-tau-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.xlsx`);
}

export default function ResetLine({ onClose }) {
  const { D, api, run, setVoyageMo } = useApp();
  const [ma] = useState(() => String(10000 + Math.floor(Math.random() * 90000)));
  const [nhap, setNhap] = useState("");
  const n = D.voyages.length, dung = nhap.trim() === ma;
  const xoa = async () => {
    const ok = await run(async () => { if (n) await taiSaoLuu(D.voyages); await api.deleteAllVoyages(); }, `Đã reset line tàu: xóa ${n} chuyến (file Excel sao lưu đã tải về)`);
    if (ok) { setVoyageMo(null); onClose(); }
  };
  return (
    <Dialog onOpenChange={(o) => !o && onClose()} className="max-w-md" title="Reset line tàu cập"
      footer={<><Button variant="outline" onClick={onClose}>Hủy</Button><Button variant="destructive" disabled={!dung} onClick={xoa}><Trash2 />Xóa tất cả {n} chuyến</Button></>}>
      <div className="grid gap-3 text-sm">
        <div className="flex gap-2 rounded-md border border-bad/40 bg-bad/5 p-2.5"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-bad" />
          <div>Sẽ <b>xóa hẳn {n} chuyến tàu</b> trong line tàu cập, cùng khoảng dừng, nhật ký, trả hàng và kế hoạch ngày của các chuyến đó. <b>Không hoàn tác được.</b> Web tự tải về file Excel sao lưu trước khi xóa.</div></div>
        <div>
          <div className="mb-1">Gõ lại mã <b className="rounded bg-muted px-1.5 py-0.5 font-mono text-base tracking-widest">{ma}</b> để xác nhận:</div>
          <Input value={nhap} onChange={(e) => setNhap(e.target.value)} inputMode="numeric" autoComplete="off" placeholder="Nhập mã" autoFocus />
        </div>
      </div>
    </Dialog>
  );
}
