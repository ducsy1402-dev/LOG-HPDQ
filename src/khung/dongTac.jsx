import { createElement, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "../lib/utils";

// Bộ hoạt hình dùng chung của web (premium enterprise: tinh tế, nhanh, không gây xao nhãng).
// Nguyên tắc: chỉ transform + opacity; không đụng tới dữ liệu / truy vấn; tôn trọng "giảm chuyển động" của hệ điều hành.
// Đã thử Motion (framer-motion): thêm ~17 kB (nén) vào bản chính + ~17 kB tải thêm chỉ để làm hoạt hình thoát của thông báo, nên KHÔNG dùng:
//  · CSS (khung.css): vào trang / thẻ lần lượt, thanh tiến độ, khung xám chờ, đồng hồ, thông báo, hộp thoại (tailwindcss-animate). Rẻ nhất, chạy trên luồng đồ họa.
//  · Đếm số (SoDem) và giữ phần tử lại để chạy hoạt hình thoát (useThoatMuot): tự viết, vài chục dòng, không thêm thư viện.

// Giảm chuyển động theo cài đặt hệ điều hành (prefers-reduced-motion)
const TRUYVAN = "(prefers-reduced-motion: reduce)";
const dangKy = (cb) => { const q = window.matchMedia(TRUYVAN); q.addEventListener("change", cb); return () => q.removeEventListener("change", cb); };
export const useGiamChuyenDong = () => useSyncExternalStore(dangKy, () => window.matchMedia(TRUYVAN).matches, () => false);

// Giữ lại phần tử vừa bị gỡ khỏi danh sách thêm ms mili giây (có cờ thoat) để chạy hoạt hình thoát rồi mới gỡ khỏi màn hình
export function useThoatMuot(ds, khoa, ms = 200) {
  const [hien, setHien] = useState(() => ds.map((x) => ({ x, thoat: false })));
  useEffect(() => {
    const con = new Set(ds.map(khoa));
    setHien((cu) => {
      const moi = new Map(cu.map((o) => [khoa(o.x), o]));
      for (const x of ds) moi.set(khoa(x), { x, thoat: false });
      return [...moi.values()].map((o) => (con.has(khoa(o.x)) ? o : { ...o, thoat: true }));
    });
    const t = setTimeout(() => setHien((cu) => cu.filter((o) => !o.thoat)), ms);
    return () => clearTimeout(t);
  }, [ds]); // eslint-disable-line react-hooks/exhaustive-deps
  return hien;
}

// ---------- Đếm số (Count Up) ----------
// Nhận chuỗi đã định dạng (VD "67,53%", "16,83 giờ", "1.258,58k t") và đếm từ 0 (lần đầu) hoặc từ số cũ (khi số đổi) tới số mới.
// Chữ trước / sau số và số chữ số thập phân giữ nguyên; kết thúc luôn đặt đúng chuỗi gốc. Không có số trong chuỗi (VD "—") thì hiện nguyên.
const TOKEN = /(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?)/;
export function phanTich(s) {
  const m = TOKEN.exec(s);
  if (!m) return null;
  const raw = m[1], thapPhan = raw.includes(",") ? raw.split(",")[1].length : 0;
  return { truoc: s.slice(0, m.index), sau: s.slice(m.index + raw.length), n: parseFloat(raw.replace(/\./g, "").replace(",", ".")), thapPhan, nhom: raw.includes(".") };
}
export const dinhDang = (v, p) => v.toLocaleString("vi-VN", { minimumFractionDigits: p.thapPhan, maximumFractionDigits: p.thapPhan, useGrouping: p.nhom });

export function SoDem({ value, className, giay = 0.9 }) {
  const ref = useRef(null), truoc = useRef(null), giam = useGiamChuyenDong();
  const s = typeof value === "string" || typeof value === "number" ? String(value) : null;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || s == null) return;
    const p = phanTich(s);
    if (!p || giam) { el.textContent = s; truoc.current = p ? p.n : null; return; }
    const tu = truoc.current ?? 0;
    truoc.current = p.n;
    if (tu === p.n) { el.textContent = s; return; }
    let raf, t0;
    el.textContent = p.truoc + dinhDang(tu, p) + p.sau;
    const buoc = (t) => {
      t0 ??= t;
      const k = Math.min(1, (t - t0) / (giay * 1000)), e = 1 - (1 - k) ** 3; // easeOutCubic
      if (k < 1) { el.textContent = p.truoc + dinhDang(tu + (p.n - tu) * e, p) + p.sau; raf = requestAnimationFrame(buoc); } else el.textContent = s;
    };
    raf = requestAnimationFrame(buoc);
    return () => { cancelAnimationFrame(raf); el.textContent = s; };
  }, [s, giam, giay]);
  if (s == null) return value ?? null;
  return <span ref={ref} className={className} />;
}

// ---------- Vào trang lần lượt ----------
// Phần tử mờ dần + trượt lên nhẹ khi xuất hiện; con thứ n của cùng một lưới vào trễ n × 45 ms (xem .hien-vao ở khung.css).
// Dùng cho thẻ, hàng thẻ chỉ số, khối biểu đồ. i = thứ tự (nếu không nằm cạnh nhau trong cùng một lưới).
export function Hien({ as = "div", i, className, style, ...p }) {
  return createElement(as, { className: cn("hien-vao", className), style: i != null ? { ...style, "--i": Math.min(i, 8) } : style, ...p });
}

// ---------- Thanh tiến độ ----------
// Thanh nằm trong khung bo tròn: đầy từ 0 → p (0..1) khi hiện ra, đổi số thì trượt mượt. Chỉ dùng transform.
export function ThanhTienDo({ p = 0, className, mau = "bg-primary", ...rest }) {
  const k = Math.max(0, Math.min(1, Number.isFinite(p) ? p : 0));
  return (
    <div className={cn("h-2.5 overflow-hidden rounded-full bg-muted", className)} {...rest}>
      <div className={cn("thanh-day h-full w-full", mau)} style={{ transform: `scaleX(${k})` }} />
    </div>
  );
}

// ---------- Vạch tiến trình chạy ngang (đang tải dữ liệu) ----------
// Đặt sát đáy thanh trên cùng; hiện khi web đang tải / ghi dữ liệu. Chỉ là hình ảnh, không chạm vào truy vấn.
export function VachTai({ dang }) {
  return (
    <div className={cn("vach-tai", dang && "vach-tai-hien")} aria-hidden="true"><span /></div>
  );
}
