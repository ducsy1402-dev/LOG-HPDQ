import { useMemo, useState } from "react";
import { PackagePlus, PackageMinus, Plus, Trash2, Save, AlertTriangle } from "lucide-react";
import { useApp } from "@/store";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Field } from "@/components/ui/input";
import { ChonGo } from "@/components/ui/combobox";
import { NgayGio } from "@/components/ui/ngaygio";
import { useThietBi } from "@/thietbi/Host";
import { so, plain } from "@/lib/format";
import { cn } from "@/lib/utils";
import { docSo } from "@/lib/paste";
import { deXuatKhoTuTau, kiemTraDongKho, giaoDichTuDong } from "@/lib/khoTuTau";
import { useKho } from "./useKho";
import { caHienTai, dsCa, tenCa } from "./GiaoDichForm";

// Dòng "Kho" trong phiếu chuyến (tab Làm hàng): đã ghi kho bao nhiêu, còn bao nhiêu; nút Nhập kho từ tàu (tàu nhập) / Xuất kho cho tàu (tàu xuất).
// Bấm nút: hộp xem trước các dòng giao dịch (bãi, hàng, lô, tấn) lấy từ KL đã làm − phần đã ghi, sửa được rồi ghi một lần.
export default function GhiKhoTuTau({ v }) {
  const { D, quyen } = useApp();
  const kho = useKho();
  const [mo, setMo] = useState(false);
  const dx = useMemo(() => (kho ? deXuatKhoTuTau(v, { kho, giaoDich: D.giaoDich || [], plans: D.plansOf(v.id), now: D.now }) : null), [kho, D, v]);
  if (!D.coSql15 || !kho || !quyen.kho?.co) return null;
  const xuat = dx.huong === "xuat";
  const Ic = xuat ? PackageMinus : PackagePlus;
  const ten = xuat ? "Xuất kho cho tàu" : "Nhập kho từ tàu";
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border bg-muted/30 px-3 py-2 text-sm">
      <span className="font-medium">{xuat ? "Xuất kho" : "Nhập kho"}</span>
      <span className="text-muted-foreground">Đã ghi <b className="tabular-nums text-foreground">{so(dx.daGhi)}</b> / KL đã làm <b className="tabular-nums text-foreground">{so(dx.daLam)}</b> t</span>
      {dx.conLai >= 0.5 ? <span className="font-medium text-warn">Chưa ghi {so(dx.conLai)} t</span> : dx.daLam > 0 ? <span className="text-ok">Đã ghi đủ</span> : null}
      {quyen.kho.nhap && dx.conLai >= 0.5 && <Button size="sm" className="ml-auto" onClick={() => setMo(true)}><Ic />{ten}</Button>}
      {mo && <HopGhi v={v} kho={kho} dx={dx} ten={ten} onClose={() => setMo(false)} />}
    </div>
  );
}

function HopGhi({ v, kho, dx, ten, onClose }) {
  const { D, api, run, toast } = useApp();
  const tbD = useThietBi()?.D;
  const huong = dx.huong;
  const [rows, setRows] = useState(() => dx.rows.map((r) => ({ ...r, tan: String(r.tan) })));
  const [ca0] = useState(caHienTai);
  const [ngay, setNgay] = useState(ca0.ngay);
  const [ca, setCa] = useState(ca0.so);
  const baiDs = [...new Set(kho.dong.filter((d) => !d.saiBai).map((d) => d.ten_bai))];
  const hangDs = (bai) => huong === "nhap"
    ? [...new Set([...(kho.hangHoa || []).map((h) => h.loai_hang), ...kho.cap.filter((c) => c.ten_bai === bai).map((c) => c.hang)])]
    : [...new Set(kho.cap.filter((c) => c.ten_bai === bai && c.ton > 1e-6).map((c) => c.hang))];
  const sua = (i, p) => setRows((o) => o.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const loi = rows.map((r) => kiemTraDongKho({ ...r, tan: docSo(r.tan) }, kho, huong));
  const tong = rows.reduce((s, r) => s + (docSo(r.tan) || 0), 0);
  const quaMuc = tong > dx.conLai + 0.5;
  // Lô thành phẩm của một dòng: nhập thì gõ / lấy số lô gợi ý, xuất thì chọn trong các lô còn tồn của bãi + hàng
  const loXuat = (r) => kho.lo.filter((l) => l.ten_bai === r.bai && plain(l.hang) === plain(r.hang) && l.ton > 1e-6).map((l) => [l.so_lo, `${l.so_lo} · tồn ${so(l.ton)} t`]);
  const coLo = (r) => (huong === "nhap" ? !!String(r.so_lo || "").trim() || kho.dong.find((d) => d.key === kho.gan(r.bai, r.hang))?.loai === "thanh_pham" : kho.cap.find((c) => c.ten_bai === r.bai && plain(c.hang) === plain(r.hang))?.loai === "thanh_pham");
  const them = () => setRows((o) => [...o, { bai: o[o.length - 1]?.bai || "", hang: o[o.length - 1]?.hang || "", tan: "", so_lo: "" }]);
  const luu = async () => {
    if (!rows.length) return toast("Không có dòng nào để ghi", "bad");
    const l = loi.find(Boolean);
    if (l) return toast(l, "bad");
    const caTen = tenCa(tbD, ngay, ca);
    // Bãi nhỏ (SQL 12): nhập vào bãi nhỏ mà web xếp cho hàng; xuất từ bãi nhỏ đang có nhiều hàng đó nhất trong bãi
    const khuTen = (bai, hang) => {
      const key = huong === "nhap" ? kho.gan(bai, hang) : kho.cap.filter((c) => c.ten_bai === bai && plain(c.hang) === plain(hang) && c.ton > 1e-6).sort((x, y) => y.ton - x.ton)[0]?.key || kho.gan(bai, hang);
      return kho.dong.find((d) => d.key === key && !d.saiBai)?.ten || null;
    };
    const recs = rows.map((r) => giaoDichTuDong(v, { ...r, bai: baiDs.find((b) => plain(b) === plain(r.bai)) || r.bai }, { ngay, ca: caTen, huong }))
      .map((x) => (D.coSql12 ? { ...x, ten_khu: khuTen(x.ten_bai, x.hang) } : x));
    // Nhập thành phẩm: lô mới tự thêm vào danh sách lô (sẵn sàng xuất) như biểu mẫu Nhập kho
    const loMoi = huong === "nhap" ? [...new Map(recs.filter((x) => x.so_lo && !(D.khoLo || []).some((l) => l.so_lo === x.so_lo)).map((x) => [x.so_lo, { so_lo: x.so_lo, hang: x.hang, ngay_nhap: x.ngay, trang_thai: "san_sang" }])).values()] : [];
    const ok = await run(async () => {
      await api.addGiaoDich(recs);
      if (loMoi.length) await api.saveLo(loMoi);
    }, `Đã ghi ${recs.length} dòng ${huong === "nhap" ? "nhập" : "xuất"} kho (${so(tong)} t) cho tàu ${v.ten_tau}`);
    if (ok) onClose();
  };
  return (
    <Dialog onOpenChange={(o) => !o && onClose()} className="max-w-4xl" title={`${ten} · ${v.ten_tau}`}
      description={`KL đã làm ${so(dx.daLam)} t − đã ghi kho ${so(dx.daGhi)} t = chưa ghi ${so(dx.conLai)} t. Kiểm tra bãi, hàng, tấn rồi ghi; chưa bấm Ghi thì chưa lưu gì.`}
      footer={<><Button variant="outline" onClick={onClose}>Hủy</Button><Button onClick={luu} disabled={!rows.length}><Save />Ghi {rows.length} dòng ({so(tong)} t)</Button></>}>
      <div className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Ngày"><NgayGio chiNgay required value={ngay} onChange={(x) => { if (x) { setNgay(x); if (!dsCa(tbD, x).some((c) => c[0] === ca)) setCa(dsCa(tbD, x)[0]?.[0] || ca); } }} /></Field>
          <Field label="Ca"><NativeSelect value={ca} onChange={(e) => setCa(e.target.value)} options={dsCa(tbD, ngay).map(([k, t, gio]) => [k, gio ? `${t} ${gio}` : t])} /></Field>
        </div>
        {dx.canh.map((c, i) => <div key={i} className="flex items-start gap-2 rounded-md border border-warn/40 bg-warn/5 px-2.5 py-1.5 text-xs"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" />{c}</div>)}
        {quaMuc && <div className="flex items-start gap-2 rounded-md border border-warn/40 bg-warn/5 px-2.5 py-1.5 text-xs"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" />Tổng {so(tong)} t lớn hơn phần chưa ghi {so(dx.conLai)} t (KL đã làm của chuyến). Vẫn ghi được nếu số này đúng.</div>}
        <div className="scroll-x rounded-md border">
          <table className="tbl text-xs">
            <thead><tr><th className="min-w-[170px]">Bãi</th><th className="min-w-[170px]">Hàng</th><th className="min-w-[150px]">Số lô</th><th className="num">Tấn</th><th /></tr></thead>
            <tbody>{rows.map((r, i) => (
              <tr key={i} className={cn("align-top", loi[i] && "bg-bad/5")}>
                <td><ChonGo value={r.bai} onChange={(x) => sua(i, { bai: x })} options={baiDs} placeholder="Chọn bãi" /></td>
                <td><ChonGo value={r.hang} onChange={(x) => sua(i, { hang: x, so_lo: "" })} options={hangDs(baiDs.find((b) => plain(b) === plain(r.bai)) || r.bai)} placeholder="Chọn hàng" />
                  {loi[i] && <div className="mt-1 text-[0.6875rem] text-bad">{loi[i]}</div>}</td>
                <td>{coLo(r) ? (huong === "nhap"
                  ? <Input value={r.so_lo} onChange={(e) => sua(i, { so_lo: e.target.value })} placeholder="Số lô" />
                  : <NativeSelect value={r.so_lo} onChange={(e) => sua(i, { so_lo: e.target.value })} placeholder="Chọn lô" options={loXuat(r)} />) : <span className="text-muted-foreground">—</span>}</td>
                <td className="num"><Input className="w-28 text-right tabular-nums" inputMode="decimal" value={r.tan} onChange={(e) => sua(i, { tan: e.target.value })} aria-label="Số tấn" /></td>
                <td><Button size="icon" variant="ghost" onClick={() => setRows((o) => o.filter((_, j) => j !== i))} aria-label="Bỏ dòng"><Trash2 /></Button></td>
              </tr>))}
              {!rows.length && <tr><td colSpan={5} className="py-4 text-center text-muted-foreground">Chưa có dòng nào. Bấm Thêm dòng.</td></tr>}
            </tbody>
          </table>
        </div>
        <div><Button size="sm" variant="outline" onClick={them}><Plus />Thêm dòng</Button></div>
        <p className="text-[0.6875rem] text-muted-foreground">
          {huong === "nhap" ? "Mỗi dòng là một giao dịch nhập kho, nguồn Tàu, gắn với chuyến này. " : "Tàu xuất lấy thành phẩm theo lô cũ trước (ngày nhập sớm nhất), chỉ lô sẵn sàng xuất; đổi lô được nếu cần. "}
          Bãi chia theo khối lượng khai báo ở phiếu chuyến; chuyến nhiều dòng hàng chia theo tỉ lệ khối lượng từng hàng.
        </p>
      </div>
    </Dialog>
  );
}
