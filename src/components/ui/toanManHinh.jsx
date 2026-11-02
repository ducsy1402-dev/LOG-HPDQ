import { createContext, useContext, useEffect, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Toàn màn hình cho một khối (thẻ, bảng, biểu đồ, hộp thoại): khối phủ kín cửa sổ và bật chế độ toàn màn hình
// của trình duyệt (ẩn thanh địa chỉ). Bấm nút lần nữa hoặc Esc để thu lại.
// Phóng bằng CSS (không dùng requestFullscreen trên chính khối) để các hộp nổi, danh sách chọn, phiếu chuyến mở từ trong khối vẫn hiện.
export function useToanManHinh() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!on) return;
    let daBat = false;
    const esc = (e) => { if (e.key === "Escape" && !document.fullscreenElement) { e.stopPropagation(); setOn(false); } };
    // Trình duyệt thoát toàn màn hình (Esc, F11) thì thu khối lại
    const doi = () => { if (document.fullscreenElement) daBat = true; else if (daBat) setOn(false); };
    window.addEventListener("keydown", esc, true);
    document.addEventListener("fullscreenchange", doi);
    document.documentElement.requestFullscreen?.().catch(() => { /* trình duyệt không cho: vẫn phủ kín cửa sổ */ });
    const tran = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", esc, true);
      document.removeEventListener("fullscreenchange", doi);
      document.body.style.overflow = tran;
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, [on]);
  return [on, () => setOn((x) => !x)];
}

export function NutToanManHinh({ on, onClick, className }) {
  const Ic = on ? Minimize2 : Maximize2;
  return (
    <button type="button" onClick={onClick} className={cn("inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground", className)}
      title={on ? "Thu nhỏ (Esc)" : "Toàn màn hình"} aria-label={on ? "Thu nhỏ" : "Toàn màn hình"} aria-pressed={on}>
      <Ic className="h-4 w-4" />
    </button>
  );
}

// Khối nằm trong hộp thoại thì không cần nút riêng (hộp thoại đã có nút Toàn màn hình)
export const TrongHopCtx = createContext(false);
export const useTrongHop = () => useContext(TrongHopCtx);
