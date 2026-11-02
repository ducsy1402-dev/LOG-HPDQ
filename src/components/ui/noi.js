import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

// Vị trí cho bảng chọn nổi (position: fixed) bám dưới một ô, lật lên trên khi gần đáy màn hình.
// Hộp thoại có transform làm "fixed" tính theo hộp thoại chứ không theo màn hình, nên đo gốc thật của khung chứa rồi trừ đi.
// Trả { popRef, style }; bấm ra ngoài (ngoài ô neo và bảng) thì gọi onNgoai.
export function useNoi(mo, neoRef, { cao = 260, onNgoai } = {}) {
  const popRef = useRef();
  const [vt, setVt] = useState(null);
  const tinh = useCallback(() => {
    const neo = neoRef.current, pop = popRef.current;
    if (!neo || !pop) return;
    const r = neo.getBoundingClientRect();
    const cu = pop.style.cssText;
    pop.style.top = "0px"; pop.style.left = "0px"; pop.style.transform = "none";
    const g = pop.getBoundingClientRect();
    pop.style.cssText = cu;
    const len = window.innerHeight - r.bottom < cao && r.top > cao;
    const left = Math.max(4 - g.left, Math.min(r.left - g.left, window.innerWidth - g.left - pop.offsetWidth - 4));
    setVt({ left, top: (len ? r.top - 4 : r.bottom + 4) - g.top, transform: len ? "translateY(-100%)" : undefined, neoW: r.width });
  }, [neoRef, cao]);
  useLayoutEffect(() => { if (mo) tinh(); else setVt(null); }, [mo, tinh]);
  const ngoaiRef = useRef(onNgoai);
  ngoaiRef.current = onNgoai;
  useEffect(() => {
    if (!mo) return;
    const trong = (t) => t instanceof Node && (neoRef.current?.contains(t) || popRef.current?.contains(t));
    const cuon = (e) => { if (!trong(e.target)) tinh(); };
    const ngoai = (e) => { if (!trong(e.target)) ngoaiRef.current?.(); };
    document.addEventListener("pointerdown", ngoai, true);
    window.addEventListener("scroll", cuon, true);
    window.addEventListener("resize", tinh);
    return () => { document.removeEventListener("pointerdown", ngoai, true); window.removeEventListener("scroll", cuon, true); window.removeEventListener("resize", tinh); };
  }, [mo, tinh, neoRef]);
  return { popRef, neoW: vt?.neoW, style: { position: "fixed", ...(vt ? { left: vt.left, top: vt.top, transform: vt.transform } : { left: 0, top: 0, visibility: "hidden" }) } };
}
