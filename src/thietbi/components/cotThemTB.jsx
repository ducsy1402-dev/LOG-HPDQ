import { useState } from "react";
import { Columns3 } from "lucide-react";
import { useApp as useAppChung } from "@/store";
import CotThem from "@/components/CotThem";
import { Field } from "./ui";
import { docSo } from "@/lib/format";

// Cột tự thêm cho danh sách xe ("xe") và nhân sự ("nhan_su"): định nghĩa ở bảng danh_muc_cot của web chung (SQL 18),
// giá trị lưu trong cột them của từng dòng (vehicles.them có sẵn; staff.them thêm ở SQL 08).
// cotGoc: [[khóa, tên]] các cột có sẵn để không đặt trùng tên.
export function useCotThem(bang, cotGoc, { can08 = false } = {}) {
  const { D, api, run, toast } = useAppChung();
  const [mo, setMo] = useState(false);
  const coBang = !!D.coSql18 && (!can08 || !!D.coSql08);
  const cot = coBang ? (D.dmCot || []).filter((c) => c.bang === bang).sort((a, b) => a.thu_tu - b.thu_tu) : [];
  const hien = (r, c) => { const v = r?.them?.[c.ma]; return c.loai === "bool" ? (v ? "✓" : "") : v ?? ""; };
  return {
    cot,
    nut: <button className="btn sm" onClick={() => (coBang ? setMo(true) : toast(can08 ? "Cần chạy SQL 08 trong Supabase trước khi thêm cột" : "Cần chạy SQL 18 trong Supabase trước khi thêm cột", "bad"))} title="Thêm / đổi tên / xóa cột tự đặt của bảng này"><Columns3 size={14} />Thêm cột</button>,
    th: cot.map((c) => <th key={c.ma} className={c.loai === "so" ? "n" : undefined}>{c.ten}</th>),
    td: (r) => cot.map((c) => <td key={c.ma} className={c.loai === "so" ? "n" : undefined}>{hien(r, c)}</td>),
    hop: mo && <CotThem ten={bang === "xe" ? "Danh sách xe" : "Nhân sự"} cotGoc={cotGoc} cot={cot} onClose={() => setMo(false)} onLuu={(ds) => run(() => api.saveCot(bang, ds), "Đã lưu cột")} />,
    // Ô nhập trong hộp sửa: f.them = { mã cột: giá trị }
    truong: (f, setF) => cot.map((c) => {
      const v = f.them?.[c.ma], dat = (x) => setF((o) => ({ ...o, them: { ...(o.them || {}), [c.ma]: x } }));
      return (
        <Field key={c.ma} label={c.ten}>
          {c.loai === "bool" ? <input type="checkbox" style={{ width: 18, height: 18, marginTop: 6 }} checked={!!v} onChange={(e) => dat(e.target.checked)} />
            : <input className={"inp" + (c.loai === "so" ? " num" : "")} inputMode={c.loai === "so" ? "decimal" : undefined} value={v ?? ""}
              onChange={(e) => dat(c.loai === "so" ? (e.target.value.trim() === "" ? null : docSo(e.target.value) ?? e.target.value) : e.target.value)} />}
        </Field>);
    }),
    // Giá trị them sạch để lưu (bỏ ô trống)
    gom: (them) => (coBang ? { them: Object.fromEntries(Object.entries(them || {}).filter(([, x]) => x !== "" && x != null)) } : {}),
  };
}
