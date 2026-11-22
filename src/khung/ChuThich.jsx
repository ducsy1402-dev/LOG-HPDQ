import { useEffect, useState } from "react";

// Chú thích nhanh: rê chuột (hoặc Tab tới) vào phần tử có data-tip="…" thì hiện NGAY, không chờ ~1 giây như thuộc tính title của trình duyệt.
// data-tip-side="right" | "bottom" (mặc định). Một bộ lắng nghe chung cho cả web, gắn một lần ở khung điều hướng.
export default function ChuThich() {
  const [t, setT] = useState(null);
  useEffect(() => {
    const hien = (e) => {
      const el = e.target?.closest?.("[data-tip]");
      if (!el || !el.dataset.tip) return setT(null);
      const r = el.getBoundingClientRect();
      const right = el.dataset.tipSide === "right";
      setT({ ten: el.dataset.tip, right, x: right ? r.right + 10 : Math.min(Math.max(r.left + r.width / 2, 90), window.innerWidth - 90), y: right ? r.top + r.height / 2 : r.bottom + 8 });
    };
    const an = () => setT(null);
    document.addEventListener("mouseover", hien);
    document.addEventListener("focusin", hien);
    document.addEventListener("mouseleave", an);
    document.addEventListener("focusout", an);
    document.addEventListener("pointerdown", an, true);
    window.addEventListener("scroll", an, true);
    return () => { document.removeEventListener("mouseover", hien); document.removeEventListener("focusin", hien); document.removeEventListener("mouseleave", an); document.removeEventListener("focusout", an); document.removeEventListener("pointerdown", an, true); window.removeEventListener("scroll", an, true); };
  }, []);
  if (!t) return null;
  return <div role="tooltip" className="ct" style={{ left: t.x, top: t.y, transform: t.right ? "translateY(-50%)" : "translateX(-50%)" }}>{t.ten}</div>;
}
