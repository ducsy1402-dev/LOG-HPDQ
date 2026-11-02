import { useMemo, useState } from "react";
import { ClipboardPaste, Save, RotateCcw } from "lucide-react";
import { useApp } from "@/store";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea, NativeSelect, Checkbox } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MucIcon } from "@/components/common";
import { TRUONG_DAN, tachBang, nhanDienTieuDe, dongThanhChuyen, fmtNgayNhap } from "@/lib/paste";
import { timBen, kiemTraBen } from "@/lib/checks";
import { maChuyenMoi, rangBuocEtb } from "@/lib/linetime";
import { so, ms } from "@/lib/format";
import { ghiDanhMuc } from "./ChuyenForm";
import { tenBen, tenBenChuyen } from "./BangTauBen";

const MAU = "Bến\tTên tàu\tDRAFT\tLOA\tDWT\tHàng nhập\tHàng xuất\tKL\tCAM KẾT\tDEM/des\tETA\nB10\tMARINE HONESTY\t14,6\t229\t81.500\tQuặng\t\t110.680\t15.000\t10tr\t20/10 06:00";

// Dán nhanh bảng tàu từ phần mềm khác (không xuất Excel được) hoặc từ Excel: tách cột, xem trước, sửa ô, rồi lưu.
// Trùng mã chuyến, hoặc cùng tên tàu đang chưa rời bến, thì CẬP NHẬT chuyến đó (chỉ các ô có giá trị); còn lại thêm mới.
export default function DanNhanh({ onClose }) {
  const { D, api, run, quyen, toast } = useApp();
  const [text, setText] = useState("");
  const [bang, setBang] = useState(null);
  const [cot, setCot] = useState([]);
  const [coTieuDe, setCoTieuDe] = useState(true);

  const doc = (t = text) => {
    const b = tachBang(t);
    if (!b.length) return toast("Chưa có dữ liệu để đọc", "warn");
    const n = Math.max(...b.map((r) => r.length));
    const day = b.map((r) => [...r, ...Array(n - r.length).fill("")]);
    const nd = nhanDienTieuDe(day);
    setBang(day); setCot(nd.cot.length ? nd.cot : Array(n).fill("")); setCoTieuDe(nd.coTieuDe);
  };
  const dong = bang ? (coTieuDe ? bang.slice(1) : bang) : [];
  const ketQua = useMemo(() => {
    const moi = [];
    return dong.map((o) => {
      if (o.every((c) => !String(c).trim())) return null;
      const { v, loi } = dongThanhChuyen(o, cot, { berthOf: (x) => timBen(D.berths, x), now: D.now });
      if (!D.coSql28) delete v.ben_phu; // chưa chạy SQL 28: chưa lưu được bến phụ
      let goc = v.ma_chuyen ? D.voyages.find((x) => x.ma_chuyen === v.ma_chuyen) : null;
      if (!goc && v.ten_tau !== "TBA" && !v.ma_chuyen) goc = D.voyages.filter((x) => x.ten_tau === v.ten_tau && !x.atd && !x.huy).sort((a, b) => b.id - a.id)[0] || null;
      if (!goc && !v.ma_chuyen) {
        const nam = new Date(ms(v.etb || v.eta) || Date.now()).getFullYear();
        v.ma_chuyen = maChuyenMoi(v.ten_tau, nam, [...D.voyages, ...moi]);
      }
      if (!goc) moi.push(v);
      const vg = { ...goc, ...v };
      const canh = kiemTraBen(vg, D.bmap[vg.ben_ma], vg.ben_phu ? D.bmap[vg.ben_phu] : null, D.berths).filter((c) => c.muc !== "info");
      return { v, loi, goc, canh };
    });
  }, [dong, cot, D]); // eslint-disable-line react-hooks/exhaustive-deps
  const hopLe = ketQua.filter(Boolean);
  const coTien = cot.includes("dem");

  const luu = async () => {
    const them = hopLe.filter((x) => !x.goc).map((x) => x.v), sua = hopLe.filter((x) => x.goc);
    const r = await run(async () => {
      const tachTien = (v) => { const { _tien, ...rest } = v; return [rest, _tien]; };
      const ctxEtb = { voyages: D.voyages, stopsOf: D.stopsOf, now: D.now };
      const daThem = them.length ? await api.insertVoyages(them.map((v) => rangBuocEtb({}, tachTien(v)[0], ctxEtb))) : [];
      for (const x of sua) { const [patch0] = tachTien(x.v); const patch = rangBuocEtb(x.goc, patch0, ctxEtb); delete patch.ma_chuyen; delete patch.ten_tau; if (Object.keys(patch).length) await api.updateVoyage(x.goc.id, patch); }
      for (const v of them) await ghiDanhMuc(api, D, v);
    }, `Đã lưu: thêm ${them.length} chuyến, cập nhật ${sua.length} chuyến`);
    if (r) onClose();
  };

  return (
    <Dialog onOpenChange={(o) => !o && onClose()} className="max-w-[min(1200px,calc(100vw-24px))]" title="Dán nhanh bảng tàu"
      description="Chép bảng từ phần mềm tàu hoặc Excel (bôi đen, Ctrl+C) rồi dán vào ô dưới (Ctrl+V). Web tự tách cột theo tiêu đề; chỉnh lại cột hoặc sửa ô nếu cần rồi bấm Lưu."
      footer={bang && <><span className="mr-auto text-sm text-muted-foreground">{hopLe.filter((x) => !x.goc).length} thêm mới · {hopLe.filter((x) => x.goc).length} cập nhật{coTien ? " · cột DEM bỏ qua" : ""}</span>
        <Button variant="outline" onClick={() => setBang(null)}><RotateCcw />Dán lại</Button><Button onClick={luu} disabled={!hopLe.length}><Save />Lưu {hopLe.length} dòng</Button></>}>
      {!bang ? (
        <div className="grid gap-2">
          <Textarea rows={10} className="font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} placeholder={MAU}
            onPaste={(e) => { const t = e.clipboardData.getData("text"); setTimeout(() => doc(t), 0); }} />
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => doc()} disabled={!text.trim()}><ClipboardPaste />Đọc bảng</Button>
            <Button variant="ghost" onClick={() => { setText(MAU); doc(MAU); }}>Thử với dòng mẫu</Button>
            <span className="text-xs text-muted-foreground">Nhận các cột: {TRUONG_DAN.map((t) => t.ten).join(", ")}. Ngày giờ dạng 22/10 09:15; số dạng 110.680 hoặc 7,2. Ô chữ ở CAM KẾT / DEM (CQD, 10tr…) lưu làm ghi chú.</span>
          </div>
        </div>
      ) : (
        <div className="grid gap-2">
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={coTieuDe} onChange={(e) => setCoTieuDe(e.target.checked)} />Dòng đầu là tiêu đề (không lưu)</label>
          <div className="scroll-x max-h-[60vh] rounded-md border">
            <table className="tbl text-xs">
              <thead><tr>
                <th>Kết quả</th>
                {cot.map((k, i) => (
                  <th key={i} className="min-w-[110px] normal-case">
                    {coTieuDe && <div className="mb-1 truncate font-normal" title={bang[0][i]}>{bang[0][i] || `Cột ${i + 1}`}</div>}
                    <NativeSelect className="h-7 text-xs" value={k} onChange={(e) => setCot((c) => c.map((x, j) => (j === i ? e.target.value : x === e.target.value ? "" : x)))}
                      options={[["", "— Bỏ qua —"], ...TRUONG_DAN.map((t) => [t.k, t.ten])]} />
                  </th>))}
              </tr></thead>
              <tbody>{dong.map((o, r) => { const kq = ketQua[r]; return (
                <tr key={r}>
                  <td className="min-w-[180px] align-top">
                    {!kq ? <span className="text-muted-foreground">Dòng trống</span> : <>
                      <div className="flex flex-wrap items-center gap-1">{kq.goc ? <Badge tone="info">Cập nhật</Badge> : <Badge tone="ok">Thêm mới</Badge>}<b>{kq.v.ten_tau}</b></div>
                      <div className="text-[11px] text-muted-foreground">{kq.goc?.ma_chuyen || kq.v.ma_chuyen}{kq.v.ben_ma ? ` · ${tenBenChuyen(kq.v)}` : ""}{kq.v.khoi_luong ? ` · ${so(kq.v.khoi_luong)} t` : ""}{kq.v.eta ? ` · ETA ${fmtNgayNhap(kq.v.eta)}` : ""}</div>
                      {[...kq.loi.map((nd) => ({ muc: "bad", nd })), ...kq.canh].map((c, i) => <div key={i} className="flex gap-1 text-[11px]"><MucIcon muc={c.muc} className="h-3 w-3" />{c.nd}</div>)}
                    </>}
                  </td>
                  {o.map((c, i) => (
                    <td key={i} className="p-1 align-top">
                      <input className="w-full min-w-[90px] rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-input focus:border-ring focus:outline-none" value={c}
                        onChange={(e) => setBang((b) => b.map((row, rr) => (rr === r + (coTieuDe ? 1 : 0) ? row.map((x, ii) => (ii === i ? e.target.value : x)) : row)))} />
                    </td>))}
                </tr>); })}</tbody>
            </table>
          </div>
        </div>
      )}
    </Dialog>
  );
}
