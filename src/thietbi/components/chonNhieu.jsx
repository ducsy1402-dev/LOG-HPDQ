import { useEffect, useRef, useState } from "react";
import { Trash2, X } from "lucide-react";
import { ConfirmButton } from "./ui";

// Chọn nhiều dòng để xóa cùng lúc (các bảng danh mục): ô tick đầu dòng, ô tick ở tiêu đề chọn / bỏ tất cả dòng đang hiện (theo ô tìm, bộ lọc),
// thanh "Đã chọn N dòng · Xóa N dòng · Bỏ chọn". Chỉ tính các dòng đã chọn mà đang hiện, nên đổi ô tìm không xóa nhầm dòng bị ẩn.
export function useChonNhieu() {
  const [chon, setChon] = useState(() => new Set());
  const bat = (k) => setChon((o) => { const n = new Set(o); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const datTatCa = (keys, on) => setChon((o) => { const n = new Set(o); for (const k of keys) { if (on) n.add(k); else n.delete(k); } return n; });
  const bo = () => setChon(new Set());
  return { chon, bat, datTatCa, bo };
}

// Ô tick ở tiêu đề: tick khi đã chọn hết các dòng đang hiện, gạch ngang khi chọn một phần
export function OTickTieuDe({ c, keys }) {
  const ref = useRef();
  const so = keys.filter((k) => c.chon.has(k)).length, het = keys.length > 0 && so === keys.length;
  useEffect(() => { if (ref.current) ref.current.indeterminate = so > 0 && !het; }, [so, het]);
  return (
    <th style={{ width: 30 }}>
      <input ref={ref} type="checkbox" checked={het} disabled={!keys.length} onChange={(e) => c.datTatCa(keys, e.target.checked)}
        aria-label="Chọn tất cả dòng đang hiện" title="Chọn / bỏ chọn tất cả dòng đang hiện" style={{ width: 16, height: 16, cursor: "pointer" }} />
    </th>
  );
}

export function OTick({ c, k, ten }) {
  return (
    <td style={{ width: 30 }}>
      <input type="checkbox" checked={c.chon.has(k)} onChange={() => c.bat(k)} aria-label={`Chọn ${ten ?? k}`} style={{ width: 16, height: 16, cursor: "pointer" }} />
    </td>
  );
}

// Thanh thao tác khi đã chọn dòng. keys: khóa các dòng đang hiện; onXoa(khóa đã chọn) trả true khi xóa xong
export function ThanhChon({ c, keys, onXoa }) {
  const ds = keys.filter((k) => c.chon.has(k));
  if (!ds.length) return null;
  return (
    <div className="row mb" style={{ gap: 8, alignItems: "center", padding: "6px 10px", borderRadius: 8, background: "color-mix(in srgb, var(--bad) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--bad) 35%, transparent)" }}>
      <b>Đã chọn {ds.length} dòng</b>
      <ConfirmButton onConfirm={async () => { if (await onXoa(ds)) c.bo(); }} confirmText={`Bấm lần nữa để xóa ${ds.length} dòng`}
        title="Xóa hẳn các dòng đã chọn khỏi danh mục (không hoàn tác được)"><Trash2 size={13} />Xóa {ds.length} dòng</ConfirmButton>
      <button type="button" className="btn sm" onClick={c.bo}><X size={13} />Bỏ chọn</button>
    </div>
  );
}
