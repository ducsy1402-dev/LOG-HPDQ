import { useMemo, useState } from "react";
import { Save } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChonGo } from "@/components/ui/combobox";
import { plain, so } from "@/lib/format";
import { klCanLam } from "@/lib/linetime";

// Quy tên hàng của các chuyến tàu về NHÓM hàng (anh Sỹ 25/11/2026): liệt kê các tên hàng chưa có nhóm (trùng khi không phân biệt hoa thường, dấu: "bonus" và "Bonus" là một),
// mỗi dòng chọn / gõ nhóm (Phế, Quặng, Than…), bấm Lưu thì thêm vào Danh mục › Hàng hóa (cột Nhóm). Mọi bộ lọc / thống kê theo nhóm hàng của web dùng danh mục này nên đổi theo.

// Các tên hàng (tách theo ";") của chuyến chưa xếp được vào nhóm nào: [{ khoa, ten, kl, tau }] giảm dần theo khối lượng
export function tenHangChuaNhom(voyages, nhomHang) {
  const m = new Map();
  for (const v of voyages || []) {
    if (v.huy) continue;
    const ds = (v.hang_ds || []).filter((h) => h && (h.ten_hang || h.loai_hang));
    const dong = ds.length < 2 ? [{ ten_hang: v.ten_hang, loai_hang: v.loai_hang, khoi_luong: klCanLam(v) }] : ds;
    for (const h of dong) {
      const tens = String(h.ten_hang || "").split(/[;]+/).map((x) => x.trim()).filter(Boolean);
      for (const ten of tens.length ? tens : [String(h.loai_hang || "").trim()].filter(Boolean)) {
        if (nhomHang.co(ten, "")) continue;
        const k = plain(ten), o = m.get(k) || { khoa: k, ten, kl: 0, tau: 0 };
        o.kl += (+h.khoi_luong || 0) / Math.max(1, tens.length); o.tau += 1; m.set(k, o);
      }
    }
  }
  return [...m.values()].sort((a, b) => b.kl - a.kl || a.ten.localeCompare(b.ten, "vi"));
}

// Gợi ý nhóm: nhóm đã có mà tên nhóm nằm trong tên hàng như một từ trọn vẹn ("Thép phế >= 3mm" → Phế)
const goiYNhom = (ten, dsNhom) => {
  const k = ` ${plain(ten).replace(/[^a-z0-9]+/g, " ")} `;
  return [...dsNhom].sort((a, b) => b.length - a.length).find((n) => k.includes(` ${plain(n).replace(/[^a-z0-9]+/g, " ").trim()} `)) || "";
};

export default function QuyNhomHang({ voyages, hanghoa, nhomHang, onSave, onClose }) {
  const dsNhom = useMemo(() => [...new Set((hanghoa || []).map((h) => String(h.nhom || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "vi")), [hanghoa]);
  const ds = useMemo(() => tenHangChuaNhom(voyages, nhomHang), [voyages, nhomHang]);
  const [chon, setChon] = useState(() => Object.fromEntries(ds.map((x) => [x.khoa, goiYNhom(x.ten, dsNhom)])));
  const [luu, setLuu] = useState(false);
  const [q, setQ] = useState("");
  const hien = q ? ds.filter((x) => plain(x.ten).includes(plain(q))) : ds;
  const n = ds.filter((x) => String(chon[x.khoa] || "").trim()).length;
  const ghi = async () => {
    // tên đã có trong Danh mục (nhưng để trống nhóm) thì chỉ điền nhóm, giữ nguyên các cột khác; tên mới thì thêm là hàng rời
    const rows = ds.filter((x) => String(chon[x.khoa] || "").trim()).map((x) => { const co = (hanghoa || []).find((h) => plain(h.loai_hang) === x.khoa); return { loai_hang: co ? co.loai_hang : x.ten, nhom: String(chon[x.khoa]).trim(), ...(co ? {} : { loai_hh: "roi" }) }; });
    if (!rows.length) return;
    setLuu(true);
    try { if (await onSave(rows)) onClose(); } finally { setLuu(false); }
  };
  return (
    <Dialog onOpenChange={(o) => !o && onClose()} nho="48rem" title="Quy tên hàng về nhóm hàng"
      description="Chọn nhóm cho từng tên hàng (Phế, Quặng, Than…) hoặc gõ nhóm mới. Bấm Lưu: tên hàng được thêm vào Danh mục › Hàng hóa kèm cột Nhóm, các bộ lọc theo nhóm hàng đổi theo."
      footer={<>
        <span className="mr-auto text-sm text-muted-foreground">{n}/{ds.length} tên hàng đã chọn nhóm</span>
        <Button size="sm" disabled={!n || luu} onClick={ghi}><Save />{luu ? "Đang lưu…" : `Lưu ${n} tên hàng`}</Button>
      </>}>
      {!ds.length ? <div className="rounded-md border border-ok/40 bg-ok/5 px-3 py-3 text-sm">Mọi tên hàng của các chuyến tàu đều đã có nhóm.</div> : (
        <div className="grid gap-2">
          <input className="h-8 w-full rounded-md border bg-background px-2 text-sm" placeholder="Tìm tên hàng…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="max-h-[55vh] overflow-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground"><tr><th className="px-2 py-1.5">Tên hàng (của chuyến tàu)</th><th className="px-2 py-1.5 text-right">Khối lượng</th><th className="w-52 px-2 py-1.5">Nhóm hàng</th></tr></thead>
              <tbody>
                {hien.map((x) => (
                  <tr key={x.khoa} className="border-t">
                    <td className="px-2 py-1 font-medium">{x.ten}</td>
                    <td className="px-2 py-1 text-right tabular-nums text-muted-foreground">{x.kl > 0 ? `${so(x.kl, 0)} t` : ""}<span className="ml-1 text-xs">· {x.tau} chuyến</span></td>
                    <td className="px-2 py-1"><ChonGo value={chon[x.khoa] || ""} onChange={(v) => setChon((o) => ({ ...o, [x.khoa]: v }))} options={dsNhom} placeholder="Chọn / gõ nhóm" /></td>
                  </tr>
                ))}
                {!hien.length && <tr><td colSpan={3} className="px-2 py-3 text-muted-foreground">Không có tên hàng nào khớp.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Dialog>
  );
}
