import { useMemo, useState } from "react";
import { ClipboardPaste, Save, RotateCcw } from "lucide-react";
import { useApp } from "@/store";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea, NativeSelect, Checkbox } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MucIcon } from "@/components/common";
import { useThietBi } from "@/thietbi/Host";
import { tachBang } from "@/lib/paste";
import { COT_TAU, MAU_BANG, nhanDienBang, docDongTau, cotThieu } from "@/lib/danTau";
import { timBen } from "@/lib/checks";
import { maChuyenMoi } from "@/lib/linetime";
import { so, plain, ms } from "@/lib/format";
import { ghiDanhMuc } from "./ChuyenForm";
import { tenBenChuyen } from "./BangTauBen";

// Dán nhanh bảng tàu theo FORM MẪU (anh Sỹ chốt 14/11/2026): BẾN · TÊN TÀU · DRAFT · LOA · DWT · GEAR · HÀNG NHẬP · HÀNG XUẤT · KHỐI LƯỢNG · CAM KẾT · DEM/day ·
// PT. Vận chuyển · Kho-Bãi · PT. Kho Bãi · LAYTIME · LSD · Ghi chú · ETA · ETB · ETD. Quy tắc đọc cột: src/lib/danTau.js.
// Còn dòng lỗi (thiếu cột bắt buộc, khối lượng không phải số, ngày sai, vừa nhập vừa xuất…) thì KHÔNG lưu được cả lần: sửa ngay trong bảng xem trước hoặc dán lại.
// Dòng không có tên tàu bị bỏ qua. Cùng tên tàu (không phải TBA) đang chưa rời bến thì CẬP NHẬT chuyến đó (chỉ các ô có nội dung); còn lại thêm mới.
// Web không tự xếp bến hay tự tính giờ: bến, ETA, ETB, ETD lấy đúng như bảng.
export default function DanNhanh({ onClose }) {
  const { D, api, run, toast } = useApp();
  const hangHoa = useThietBi()?.D?.hanghoa || [];
  const [text, setText] = useState("");
  const [bang, setBang] = useState(null);
  const [cot, setCot] = useState([]);
  const [coTieuDe, setCoTieuDe] = useState(true);

  const doc = (t = text) => {
    const b = tachBang(t);
    if (!b.length) return toast("Chưa có dữ liệu để đọc", "warn");
    const n = Math.max(...b.map((r) => r.length));
    const day = b.map((r) => [...r, ...Array(n - r.length).fill("")]);
    const nd = nhanDienBang(day);
    setBang(day); setCot(nd.cot); setCoTieuDe(nd.coTieuDe);
  };
  const dong = bang ? (coTieuDe ? bang.slice(1) : bang) : [];
  // Nhóm hàng: danh mục hàng hóa; hàng chỉ có ở chuyến cũ thì lấy loại hàng của chuyến đó
  const nhomCua = (ten) => hangHoa.find((h) => plain(h.loai_hang) === plain(ten))?.nhom || D.voyages.find((x) => x.ten_hang && x.loai_hang && plain(x.ten_hang) === plain(ten))?.loai_hang || null;
  const ketQua = useMemo(() => {
    const moi = [];
    return dong.map((o) => {
      if (o.every((c) => !String(c ?? "").trim())) return null;
      const kq = docDongTau(o, cot, { berthOf: (x) => timBen(D.berths, x), now: D.now, nhomCua });
      if (!kq) return null; // không có tên tàu: bỏ qua
      const { v } = kq;
      if (!D.coSql28) delete v.ben_phu; // chưa chạy SQL 28: chưa lưu được bến phụ
      if (!D.coSql19) { delete v.hang_ds; }
      const goc = v.ten_tau !== "TBA" ? D.voyages.filter((x) => x.ten_tau === v.ten_tau && !x.atd && !x.huy).sort((a, b) => b.id - a.id)[0] || null : null;
      if (!goc) {
        const nam = new Date(ms(v.etb || v.eta) || Date.now()).getFullYear();
        v.ma_chuyen = maChuyenMoi(v.ten_tau, nam, [...D.voyages, ...moi]);
        moi.push(v);
      }
      return { ...kq, goc };
    });
  }, [dong, cot, D, hangHoa]); // eslint-disable-line react-hooks/exhaustive-deps
  const dsDong = ketQua.filter(Boolean);
  const soLoi = dsDong.filter((x) => x.loi.length).length;
  const thieu = bang ? cotThieu(cot) : [];
  const coCot = D.coCotDan;
  const choLuu = dsDong.length > 0 && soLoi === 0 && thieu.length === 0 && coCot;

  const luu = async () => {
    const them = dsDong.filter((x) => !x.goc).map((x) => x.v), sua = dsDong.filter((x) => x.goc);
    const r = await run(async () => {
      if (them.length) await api.insertVoyages(them);
      for (const x of sua) { const patch = { ...x.v }; delete patch.ma_chuyen; delete patch.ten_tau; if (Object.keys(patch).length) await api.updateVoyage(x.goc.id, patch); }
      for (const x of dsDong) await ghiDanhMuc(api, D, x.v);
    }, `Đã lưu: thêm ${them.length} chuyến, cập nhật ${sua.length} chuyến`);
    if (r) onClose();
  };

  return (
    <Dialog onOpenChange={(o) => !o && onClose()} className="max-w-[min(1400px,calc(100vw-24px))]" title="Dán nhanh bảng tàu"
      description="Chép bảng tàu từ Excel (bôi đen, Ctrl+C) rồi dán vào ô dưới (Ctrl+V), theo đúng thứ tự cột của bảng mẫu. Còn dòng lỗi thì chưa lưu được."
      footer={bang && <>
        <span className={`mr-auto text-sm ${soLoi || thieu.length ? "text-bad" : "text-muted-foreground"}`}>
          {thieu.length ? `Thiếu cột bắt buộc: ${thieu.join(", ")}` : soLoi ? `${soLoi} dòng lỗi: sửa trong bảng hoặc dán lại, chưa lưu được` : `${dsDong.filter((x) => !x.goc).length} thêm mới · ${dsDong.filter((x) => x.goc).length} cập nhật`}
        </span>
        <Button variant="outline" onClick={() => setBang(null)}><RotateCcw />Dán lại</Button>
        <Button onClick={luu} disabled={!choLuu} title={!coCot ? "Cần chạy SQL thêm cột GEAR, DEM/day… (xem sql/01_cau_truc.sql)" : soLoi || thieu.length ? "Còn lỗi, chưa lưu được" : undefined}><Save />Lưu {dsDong.length} tàu</Button></>}>
      {!coCot && <div className="mb-2 rounded-md border border-bad/40 bg-bad/5 px-3 py-2 text-sm">CSDL chưa có các cột mới của chuyến tàu (GEAR, DEM/day, LAYTIME, LSD, PT. Vận chuyển, PT. Kho Bãi): quản trị chạy phần <b>"Form Dán nhanh bảng tàu"</b> trong <b>sql/01_cau_truc.sql</b> (các dòng <code>alter table public.voyages add column…</code>) ở Supabase › SQL Editor rồi tải lại web.</div>}
      {!bang ? (
        <div className="grid gap-2">
          <Textarea rows={10} className="font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} placeholder={MAU_BANG}
            onPaste={(e) => { const t = e.clipboardData.getData("text"); setTimeout(() => doc(t), 0); }} />
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => doc()} disabled={!text.trim()}><ClipboardPaste />Đọc bảng</Button>
            <Button variant="ghost" onClick={() => { setText(MAU_BANG); doc(MAU_BANG); }}>Thử với dòng mẫu</Button>
          </div>
          <ul className="grid gap-0.5 text-xs text-muted-foreground">
            <li><b>Cột:</b> {COT_TAU.map((c) => c.ten).join(" · ")}. <b>Bắt buộc:</b> Bến, Tên tàu, Hàng nhập hoặc Hàng xuất (không được cả hai), Khối lượng (số), ETA, ETB, ETD (ngày).</li>
            <li><b>Hàng nhập / xuất, Kho-Bãi, PT. Vận chuyển, PT. Kho Bãi:</b> nhiều mục ngăn cách bằng dấu phẩy, dấu cộng hoặc dấu chấm phẩy; số sau dấu gạch ngang "-" là khối lượng của mục đó (VD <code>Cán 1-1221, Cán 2-1000</code>).</li>
            <li><b>ETA</b> dạng <code>18-19/11/2026</code> được hiểu là ngày sau dấu gạch ngang (19/11/2026). Số kiểu Excel <code>3,500</code> = 3.500. Dòng không có tên tàu bị bỏ qua; ô trống hiện "trống".</li>
          </ul>
        </div>
      ) : (
        <div className="grid gap-2">
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={coTieuDe} onChange={(e) => setCoTieuDe(e.target.checked)} />Dòng đầu là tiêu đề (không lưu)</label>
          <div className="scroll-x max-h-[60vh] rounded-md border">
            <table className="tbl text-xs">
              <thead><tr>
                <th className="min-w-[200px]">Kết quả</th>
                {cot.map((k, i) => (
                  <th key={i} className="min-w-[110px] normal-case">
                    {coTieuDe && <div className="mb-1 truncate font-normal" title={bang[0][i]}>{bang[0][i] || `Cột ${i + 1}`}</div>}
                    <NativeSelect className="h-7 text-xs" value={k} onChange={(e) => setCot((c) => c.map((x, j) => (j === i ? e.target.value : x === e.target.value ? "" : x)))}
                      options={[["", "— Bỏ qua —"], ...COT_TAU.map((t) => [t.k, t.ten])]} />
                  </th>))}
              </tr></thead>
              <tbody>{dong.map((o, r) => { const kq = ketQua[r], trongDong = !o.some((c) => String(c ?? "").trim()); return (
                <tr key={r} className={kq?.loi.length ? "bg-bad/5" : undefined}>
                  <td className="align-top">
                    {!kq ? <span className="text-muted-foreground">{trongDong ? "Dòng trống" : "Không có tên tàu: bỏ qua"}</span> : <>
                      <div className="flex flex-wrap items-center gap-1">{kq.goc ? <Badge tone="info">Cập nhật</Badge> : <Badge tone="ok">Thêm mới</Badge>}<b>{kq.v.ten_tau}</b></div>
                      <div className="text-[0.6875rem] text-muted-foreground">{kq.goc?.ma_chuyen || kq.v.ma_chuyen}{kq.v.ben_ma ? ` · ${tenBenChuyen(kq.v)}` : ""}{kq.v.khoi_luong != null ? ` · ${so(kq.v.khoi_luong)} t` : ""}</div>
                      {kq.loi.map((nd, i) => <div key={i} className="flex gap-1 text-[0.6875rem] text-bad"><MucIcon muc="bad" className="h-3 w-3" />{nd}</div>)}
                    </>}
                  </td>
                  {o.map((c, i) => (
                    <td key={i} className="p-1 align-top">
                      <input className="w-full min-w-[90px] rounded border border-transparent bg-transparent px-1 py-0.5 placeholder:text-muted-foreground/50 hover:border-input focus:border-ring focus:outline-none" value={c} placeholder={cot[i] && kq ? "trống" : ""}
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
