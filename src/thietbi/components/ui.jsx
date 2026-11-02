import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, AlertTriangle, X, Search as SearchIcon, ChevronDown } from "lucide-react";
import { NgayGio } from "@/components/ui/ngaygio";
import { useToanManHinh, NutToanManHinh, useTrongHop } from "@/components/ui/toanManHinh";
import { useApp } from "../store";
import { matchQ } from "../lib/utils";

// toanManHinh: nút Toàn màn hình ở cuối tiêu đề (mặc định có; thẻ nằm trong hộp thoại thì không)
export function Card({ title, icon: Icon, hint, right, className = "", toanManHinh = true, children, ...p }) {
  const trongHop = useTrongHop();
  const [on, doi] = useToanManHinh();
  const coNut = toanManHinh && !trongHop && !!title;
  return (
    <section data-tmh={on ? "" : undefined} className={"card " + className + (on ? " card-fs" : "")} {...p}>
      {(title || right) && (
        <div className="card-h">
          {title && <h3>{Icon && <Icon size={16} />}{title}</h3>}
          {hint && <span className="hint">{hint}</span>}
          {right && <div className="right">{right}</div>}
          {coNut && <NutToanManHinh on={on} onClick={doi} className={"khong-ttb" + (right ? "" : " ml-auto")} />}
        </div>
      )}
      {children}
    </section>
  );
}

export function Kpi({ label, value, unit, foot, tone, icon: Icon, meter, alert, onClick }) {
  return (
    <div className={`card kpi ${tone ? "t-" + tone : ""} ${alert ? "kpi-alert" : ""}`} onClick={onClick} style={onClick ? { cursor: "pointer" } : undefined}>
      <div className="lb">{Icon && <Icon size={14} />}{label}</div>
      <div className="v">{value}{unit && <small>{unit}</small>}</div>
      {foot && <div className="ft">{foot}</div>}
      {meter != null && <div className="meter"><i style={{ width: `${Math.max(0, Math.min(1, meter)) * 100}%` }} /></div>}
    </div>
  );
}

const ST_CLS = { ss: "b-ok", bddk: "b-info", bdcl: "b-orange", hong: "b-bad" };
const ST_LBL = { ss: "Sẵn sàng", bddk: "SS · BD định kỳ", bdcl: "BD chiến lược", hong: "Hỏng" };
export const StateBadge = ({ s }) => <span className={"badge " + ST_CLS[s]}>{ST_LBL[s]}</span>;
export const Badge = ({ tone = "", plain, children }) => <span className={`badge ${tone ? "b-" + tone : ""} ${plain ? "plain" : ""}`}>{children}</span>;

export function Seg({ value, onChange, options }) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => {
        const [v, l] = Array.isArray(o) ? o : [o, o];
        return <button key={v} type="button" className={v === value ? "on" : ""} onClick={() => onChange(v)}>{l}</button>;
      })}
    </div>
  );
}

export function Search({ value, onChange, placeholder = "Tìm…", style }) {
  return (
    <label className="search" style={style}>
      <SearchIcon size={15} />
      <input className="inp" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}

export function Select({ value, onChange, options, blank, className = "inp", ...p }) {
  return (
    <select className={className} value={value ?? ""} onChange={(e) => onChange(e.target.value)} {...p}>
      {blank != null && <option value="">{blank}</option>}
      {options.map((o) => {
        const [v, l] = Array.isArray(o) ? o : [o, o];
        return <option key={v} value={v}>{l}</option>;
      })}
    </select>
  );
}

// Ô chọn nhiều giá trị (danh sách có dấu tích + ô tìm). value = mảng; mảng rỗng = "Tất cả".
// prefix: chữ đứng trước giá trị khi đặt ngoài form (VD "Đội"), width: độ rộng ô.
export function MultiSelect({ value = [], onChange, options, placeholder = "Tất cả", prefix, style, className = "" }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef();
  useEffect(() => {
    if (!open) { setQ(""); return; }
    const h = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const k = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", h); document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
  }, [open]);
  const opts = options.map((o) => (Array.isArray(o) ? o : [o, o]));
  const sel = value.filter((v) => opts.some((o) => o[0] === v));
  const lblOf = (v) => opts.find((o) => o[0] === v)?.[1];
  const lbl = !sel.length ? placeholder : sel.length === 1 ? lblOf(sel[0]) : `Đã chọn ${sel.length}`;
  const shown = opts.filter(([, l]) => matchQ(q, l));
  const toggle = (v) => onChange(sel.includes(v) ? sel.filter((x) => x !== v) : opts.map((o) => o[0]).filter((x) => x === v || sel.includes(x)));
  // "Chọn hết" theo kết quả tìm: nếu đang tìm thì chỉ thêm các mục đang hiện
  const chonHet = () => onChange(opts.map((o) => o[0]).filter((x) => sel.includes(x) || shown.some((o) => o[0] === x)));
  return (
    <div className={"msel " + className} ref={ref} style={style}>
      <button type="button" className={"inp msel-btn" + (sel.length ? " on" : "")} onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} title={sel.map(lblOf).join(", ")}>
        <span>{prefix && <span className="msel-pre">{prefix}: </span>}{lbl}</span><ChevronDown size={14} />
      </button>
      {open && (
        <div className="msel-pop" role="listbox" aria-multiselectable="true">
          <label className="search msel-q"><SearchIcon size={14} /><input className="inp sm" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm…" aria-label="Tìm trong danh sách" /></label>
          <div className="msel-top">
            <button type="button" onClick={chonHet}>{q ? "Chọn các mục tìm được" : "Chọn hết"}</button>
            <button type="button" onClick={() => onChange([])}>Bỏ chọn (tất cả)</button>
          </div>
          {shown.map(([v, l]) => (
            <label key={v} className="msel-it" role="option" aria-selected={sel.includes(v)}>
              <input type="checkbox" checked={sel.includes(v)} onChange={() => toggle(v)} /><span>{l}</span>
            </label>
          ))}
          {!shown.length && <div className="small mute" style={{ padding: 8 }}>{opts.length ? "Không tìm thấy" : "Không có lựa chọn"}</div>}
        </div>
      )}
    </div>
  );
}

// Ô ngày / ngày giờ dùng chung với phần Cảng – kho: gõ trực tiếp (24/10/2026 14:30) hoặc chọn trên lịch, giờ cách nhau 10 phút.
// DateInput: giá trị "YYYY-MM-DD"; DateTimeInput: "YYYY-MM-DDTHH:mm" giờ địa phương
export function DateInput({ value, onChange, min, max, required, className = "inp", style, placeholder = "dd/mm/yyyy" }) {
  return <NgayGio chiNgay value={value || ""} onChange={onChange} min={min} max={max} required={required} placeholder={placeholder} inputClassName={className} style={style} />;
}
export function DateTimeInput({ value, onChange, required, disabled, className = "inp", style }) {
  return <NgayGio value={value ? String(value).slice(0, 16) : ""} onChange={onChange} required={required} disabled={disabled} inputClassName={className} style={style} />;
}
// Đổi giữa timestamptz (ISO) và "YYYY-MM-DDTHH:mm" giờ địa phương
export const isoToLocal = (iso) => { if (!iso) return ""; const d = new Date(iso), p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
export const localToIso = (s) => (s ? new Date(s).toISOString() : null);

// Nút xóa hai bước: bấm lần 1 đổi thành "Xác nhận", bấm lần 2 trong 3 giây mới thực hiện
export function ConfirmButton({ onConfirm, children = "Xóa", confirmText = "Xác nhận", className = "btn sm danger", title }) {
  const [ask, setAsk] = useState(false);
  useEffect(() => { if (!ask) return; const t = setTimeout(() => setAsk(false), 3000); return () => clearTimeout(t); }, [ask]);
  return (
    <button type="button" title={title} className={className} style={ask ? { background: "var(--bad)", color: "#fff", borderColor: "var(--bad)" } : undefined}
      onClick={() => { if (ask) { setAsk(false); onConfirm(); } else setAsk(true); }}>
      {ask ? confirmText : children}
    </button>
  );
}

export const Field = ({ label, children, className = "" }) => <label className={"field " + className}><span>{label}</span>{children}</label>;
export const Empty = ({ children = "Không có dữ liệu." }) => <div className="empty">{children}</div>;

function useEsc(onClose) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
}

export function Modal({ title, onClose, children, footer, width }) {
  useEsc(onClose);
  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="modal" style={width ? { "--w": width + "px" } : undefined} role="dialog" aria-modal="true">
        <div className="modal-h"><h3>{title}</h3><span className="spacer" /><button className="btn ghost icon" onClick={onClose} aria-label="Đóng"><X size={18} /></button></div>
        <div className="modal-b">{children}</div>
        {footer && <div className="modal-f">{footer}</div>}
      </div>
    </>
  );
}

export function Drawer({ head, onClose, children }) {
  useEsc(onClose);
  return (
    <>
      <div className="overlay" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true">
        <div className="drawer-h"><div style={{ flex: 1, minWidth: 0 }}>{head}</div><button className="btn ghost icon" onClick={onClose} aria-label="Đóng"><X size={18} /></button></div>
        <div className="drawer-b">{children}</div>
      </aside>
    </>
  );
}

export function Toasts() {
  const { toasts } = useApp();
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={"toast " + t.tone}>
          {t.tone === "bad" ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}<span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

// Bảng màu biểu đồ lấy từ biến CSS của chủ đề hiện tại.
// Trong web chung, biến màu khai báo trên khung .ttb (không phải gốc trang): đọc qua một phần tử .ttb ẩn.
let mauNguon = null;
const phanTuMau = () => {
  if (!mauNguon || !mauNguon.isConnected) { mauNguon = document.createElement("div"); mauNguon.className = "ttb"; mauNguon.style.display = "none"; document.body.appendChild(mauNguon); }
  return mauNguon;
};
export function usePalette() {
  const theme = document.documentElement.dataset.theme || "dark"; // đổi giao diện ở khung chung thì vẽ lại theo màu mới
  return useMemo(() => {
    const cs = getComputedStyle(phanTuMau());
    const g = (n) => cs.getPropertyValue(n).trim();
    return {
      // Màu trạng thái cho biểu đồ (đã kiểm tra phân biệt được với người mù màu)
      ss: g("--c-ok"), bddk: g("--c-info"), bdcl: g("--c-warn"), hong: g("--c-bad"),
      ok: g("--c-ok"), warn: g("--c-warn"), bad: g("--c-bad"), info: g("--c-info"), orange: g("--c-warn"),
      surface: g("--surface"),
      accent: g("--accent"), accent2: g("--accent2"), mute: g("--mute"), line: g("--line"), ink: g("--ink"), ink2: g("--ink2"), raise: g("--raise"),
      series: [g("--accent"), g("--accent2"), g("--ok"), g("--warn"), g("--info"), g("--orange"), g("--bad")],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);
}
