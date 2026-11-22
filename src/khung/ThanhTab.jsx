import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "../lib/utils";

// Thanh tab của mọi trang: nằm trên nội dung, tab đang chọn nổi bật (chữ đậm màu nhấn + gạch chân trượt sang tab mới).
// tabs = [[mã, tên, Icon?]]. Phím ← → Home End chuyển tab khi đang chọn thanh tab. phai = nút đặt sát mép phải của thanh (VD chuông cảnh báo của kho).
export default function ThanhTab({ value, onChange, tabs, label, phai, className }) {
  const ds = useRef(null);
  const daDo = useRef(false);
  const [vt, setVt] = useState({ x: 0, w: 0, hien: false, muot: false });

  const do_ = useCallback(() => {
    const el = ds.current?.querySelector('[aria-selected="true"]');
    if (!el) return setVt((v) => (v.hien ? { ...v, hien: false } : v));
    setVt((v) => (v.x === el.offsetLeft && v.w === el.offsetWidth && v.hien ? v : { x: el.offsetLeft, w: el.offsetWidth, hien: true, muot: daDo.current }));
    daDo.current = true;
  }, []);
  useLayoutEffect(do_, [value, tabs, do_]);
  useEffect(() => {
    if (!ds.current || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => do_());
    ro.observe(ds.current);
    return () => ro.disconnect();
  }, [do_]);
  // Tab đang chọn luôn nằm trong vùng nhìn thấy (thanh tab cuộn ngang trên điện thoại)
  useEffect(() => { ds.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: "nearest", inline: "nearest" }); }, [value]);

  const phim = (e) => {
    const i = tabs.findIndex((t) => t[0] === value);
    let j = -1;
    if (e.key === "ArrowRight") j = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") j = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = tabs.length - 1;
    if (j < 0) return;
    e.preventDefault();
    onChange(tabs[j][0]);
    requestAnimationFrame(() => ds.current?.querySelector('[aria-selected="true"]')?.focus());
  };

  return (
    <div className={cn("tt", className)}>
      <div ref={ds} className="tt-ds" role="tablist" aria-label={label} onKeyDown={phim}>
        {tabs.map(([k, ten, Icon]) => (
          <button key={k} type="button" role="tab" id={`tab-${k}`} aria-selected={value === k} tabIndex={value === k ? 0 : -1} className="tt-tab" onClick={() => onChange(k)}>
            {Icon && <Icon aria-hidden="true" />}<span>{ten}</span>
          </button>
        ))}
        <span aria-hidden="true" className={cn("tt-thanh", vt.muot && "tt-muot")} style={{ transform: `translateX(${vt.x}px) scaleX(${vt.w})`, opacity: vt.hien ? 1 : 0 }} />
      </div>
      {phai && <div className="tt-phai">{phai}</div>}
    </div>
  );
}

// Giữ các tab đã xem còn nguyên (không dựng lại): chuyển tab chỉ ẩn / hiện, nên bộ lọc, vị trí cuộn trong tab và dữ liệu đang nhập dở không mất.
// cac = { mã tab: nội dung }; tab chỉ được dựng lần đầu khi mở tới.
export function GiuTab({ active, cac }) {
  const [da, setDa] = useState(() => new Set([active]));
  useEffect(() => { setDa((s) => (s.has(active) ? s : new Set(s).add(active))); }, [active]);
  const hien = da.has(active) ? da : new Set(da).add(active);
  return Object.keys(cac).filter((k) => hien.has(k)).map((k) => (
    <div key={k} role="tabpanel" aria-labelledby={`tab-${k}`} hidden={k !== active} className={k === active ? "pg-vao" : undefined}>{cac[k]}</div>
  ));
}
