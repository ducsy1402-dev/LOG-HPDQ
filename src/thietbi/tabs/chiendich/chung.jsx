// Thành phần và định dạng dùng chung của tab Chiến dịch
import { useState } from "react";
import { docSo, soGon } from "@/lib/format";
import { fmt } from "../../lib/utils";

const p2 = (n) => String(n).padStart(2, "0");
export const ngayGio = (ms) => { if (ms == null) return "–"; const d = new Date(ms); return `${p2(d.getDate())}/${p2(d.getMonth() + 1)} ${p2(d.getHours())}:${p2(d.getMinutes())}`; };
export const gio = (ms) => { const d = new Date(ms); return `${p2(d.getHours())}:${p2(d.getMinutes())}`; };
export const ngayVN = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : "");
export const phut = (h, d = 1) => fmt(h * 60, d);
export const tan = (v) => fmt(v, 0);
// Số giờ → "15 giờ 26 phút" / "2 ngày 3 giờ"
export function thoiLuong(h) {
  if (!Number.isFinite(h)) return "–";
  const p = Math.round(h * 60), g = Math.floor(p / 60), m = p % 60;
  if (g >= 48) { const n = Math.floor(g / 24); return `${n} ngày ${g % 24 ? (g % 24) + " giờ" : ""}`.trim(); }
  return g ? `${g} giờ${m ? " " + m + " phút" : ""}` : `${m} phút`;
}

// Ô nhập số kiểu Việt Nam: dấu phẩy là thập phân, dấu chấm ngăn nghìn; ghi khi rời ô / Enter
export function OSo({ value, onChange, disabled, w = 96, placeholder, title, className = "" }) {
  const [txt, setTxt] = useState(null);
  const hien = txt ?? (value == null || value === "" ? "" : soGon(value));
  const ghi = () => {
    if (txt == null) return;
    const n = txt.trim() === "" ? null : docSo(txt);
    onChange(Number.isFinite(n) ? n : null);
    setTxt(null);
  };
  return (
    <input className={"inp sm num " + className} style={{ width: w }} value={hien} disabled={disabled} placeholder={placeholder} title={title} inputMode="decimal"
      onChange={(e) => setTxt(e.target.value)} onBlur={ghi} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setTxt(null); e.currentTarget.blur(); } }} />
  );
}

// Một ô nhập có nhãn và đơn vị
export const O = ({ nhan, dv, goiY, children }) => (
  <label className="field cd-o">
    <span>{nhan}</span>
    <div className="cd-o-v">{children}{dv && <em>{dv}</em>}</div>
    {goiY && <small className="mute">{goiY}</small>}
  </label>
);

// Thanh mức sử dụng
export const ThanhSD = ({ v, nhan }) => {
  // dùng gần hết thời gian = tận dụng tốt (xanh); dùng ít = đang thừa (vàng)
  const tone = v >= 0.85 ? "var(--ok)" : v >= 0.6 ? "var(--info)" : "var(--warn)";
  return (
    <div className="cd-sd" title={`${nhan}: dùng ${fmt(v * 100, 0)}% thời gian`}>
      <span>{nhan}</span>
      <div className="track"><i style={{ width: `${Math.min(100, v * 100)}%`, background: tone }} /></div>
      <b className="mono">{fmt(v * 100, 0)}%</b>
    </div>
  );
};

// Màu các khâu của một chuyến (biểu đồ chạy xe)
export const KHAU = [
  ["xep", "Xếp hàng", "#6366f1"],
  ["phu", "Cân / thủ tục", "#a78bfa"],
  ["di", "Chạy có hàng", "#0ea5e9"],
  ["do", "Dỡ hàng", "#14b8a6"],
  ["ve", "Chạy về không tải", "#94a3b8"],
  ["cho", "Chờ điểm xếp / dỡ", "#f43f5e"],
  ["nghi", "Nghỉ luân phiên", "#facc15"],
];
export const MAU_KHAU = Object.fromEntries(KHAU.map(([k, , c]) => [k, c]));
export const TEN_KHAU = Object.fromEntries(KHAU.map(([k, l]) => [k, l]));
export const MAU_TUYEN = ["#6366f1", "#f59e0b", "#14b8a6", "#ec4899", "#0ea5e9", "#22c55e", "#a78bfa", "#f97316"];
