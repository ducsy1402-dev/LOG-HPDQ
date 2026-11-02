import { cn } from "@/lib/utils";
import { so, pct, ngayNam } from "@/lib/format";
import { NGUONG_KHO } from "@/lib/kho";

// Phần hiển thị dùng chung của trang Kho: màu lấp đầy, thanh lấp đầy, dự kiến đầy, thông qua, lưu bãi (Sơ đồ bãi, chi tiết bãi)
export const mauDay = (p) => (p == null ? "bg-muted-foreground/40" : p > 1.0001 || p >= NGUONG_KHO.do ? "bg-bad" : p >= NGUONG_KHO.vang ? "bg-warn" : "bg-ok");

export const KIEU_TONE = { co_dinh_hang: "info", co_dinh_nhom: "primary", tu_do: "ok", hon_hop: "outline" };
export const KIEU_NGAN = { co_dinh_hang: "Cố định", co_dinh_nhom: "Nhóm", tu_do: "Tự do" };
export const Chi = ({ ten, title, children, className }) => <div title={title} className={cn("flex justify-between gap-2", className)}><span className="text-muted-foreground">{ten}</span><span className="text-right tabular-nums">{children}</span></div>;
export const Thanh = ({ p, className }) => <div className={cn("h-2.5 overflow-hidden rounded-full bg-muted", className)}><div className={cn("h-full", mauDay(p))} style={{ width: `${Math.min(100, (p ?? 0) * 100)}%` }} /></div>;
export const NgayDay = ({ l }) => (!l ? "—" : l.trangThaiDay === "da_day" ? <span className="font-semibold text-bad">Đã đầy</span>
  : l.trangThaiDay === "tang" ? <span className={cn(l.ngayDay < NGUONG_KHO.ngayDayVang && "font-semibold text-warn")}>{ngayNam(l.luc)} · {l.ngayDay < 1 ? "dưới 1" : so(l.ngayDay, l.ngayDay < 10 ? 1 : 0)} ngày</span>
  : l.trangThaiDay ? <span className="text-muted-foreground">Không ({l.trangThaiDay === "giam" ? "tồn đang giảm" : "nhập ≈ xuất"})</span>
  : <span className="text-muted-foreground">Chưa có sức chứa</span>);
export const ThongQua = ({ l }) => (!l ? "—" : l.nangLuc ? <>{so(l.thucTe)} / {so(l.nangLuc)} t/ngày <span className={cn(l.suDung >= 0.9 ? "text-bad" : l.suDung >= 0.75 ? "text-warn" : "text-muted-foreground")}>({pct(l.suDung)})</span></> : l.thucTe ? `${so(l.thucTe)} t/ngày` : "—");
export const LuuBai = ({ l }) => (l?.luuBai != null ? `${so(l.luuBai, l.luuBai < 10 ? 1 : 0)} ngày` : "—");
export const T_NGAY_DAY = "(Sức chứa − tồn) ÷ (nhập − xuất bình quân mỗi ngày)";
export const T_LUU_BAI = "Tồn bình quân ÷ xuất bình quân mỗi ngày: hàng nằm bãi bao lâu thì được xuất";
export const T_THONG_QUA = `Năng lực thông qua = sức chứa × ${pct(NGUONG_KHO.heSoBai)} ÷ lưu bãi bình quân (t/ngày)`;
export const T_NHAP_XUAT = "Bình quân mỗi ngày, gồm điều chuyển đến / đi; không tính tồn đầu kỳ và kiểm kê";
