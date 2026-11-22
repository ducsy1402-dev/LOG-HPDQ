import { useMemo, useRef, useState } from "react";
import { ClipboardPaste, Upload, RotateCcw, Check } from "lucide-react";
import { useApp } from "@/store";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { MucIcon } from "@/components/common";
import { tachBang, docSo, docNgayGio, doanThuTuNgay } from "@/lib/paste";
import { plain, so } from "@/lib/format";
import { ngayDia } from "@/lib/keHoachNgay";
import HopDanVT from "./HopDanVT";

// Dán nhanh / nhập Excel cho hai hộp của Mục tiêu sản lượng › Khai thác cảng (anh Sỹ yêu cầu 13/11/2026):
//   • Đặt mục tiêu: mỗi dòng Hướng · Loại hàng · Mục tiêu (t) · Ghi chú;
//   • Sản lượng thực tế: mỗi dòng Ngày · Hướng · Loại hàng · Sản lượng (t).
// Dòng đầu là tiêu đề cột. Chỉ đưa số vào bảng đang mở (chưa ghi); bấm Lưu ở bảng đó để ghi.
const TRUONG = {
  huong: ["huong", "nhap/xuat", "nhap xuat", "loai", "chieu"],
  loai: ["loai hang", "hang", "nhom hang", "nhom", "ten hang", "hang hoa", "loai hang (nhom hang)"],
  tan: ["muc tieu", "muc tieu (t)", "muc tieu t", "khoi luong", "kl", "tan", "so tan", "san luong", "san luong (t)", "san luong t", "thuc te", "thuc hien", "thuc te (t)", "thuc nhap", "thuc xuat"],
  ghi_chu: ["ghi chu", "note"],
  ngay: ["ngay", "ngay thang", "date"],
};
// Vận tải (mục tiêu vận tải ở Thiết bị cơ giới): Hướng (phục vụ cảng / sản xuất) · Loại xe · Đơn vị (Hòa Phát / Thuê ngoài) · Loại hàng (trống = mọi hàng) · Mục tiêu · Ghi chú
const TRUONG_VT = {
  ngay: TRUONG.ngay,
  huong: ["huong", "phuc vu", "muc dich", "huong phuc vu"],
  loai: ["loai xe", "doi xe", "xe", "loai phuong tien", "phuong tien"],
  donVi: ["don vi", "don vi thuc hien", "thuc hien", "nguon xe"],
  hang: ["loai hang", "hang", "nhom hang", "hang hoa"],
  tan: TRUONG.tan,
  ghi_chu: TRUONG.ghi_chu,
};
const doanCot = (c, bang = TRUONG) => { const p = plain(c).replace(/[()]/g, " ").replace(/\s+/g, " ").trim(); return p ? Object.entries(bang).find(([, bi]) => bi.includes(p))?.[0] || "" : ""; };
export const docHuong = (x) => { const p = plain(x); return /xuat/.test(p) ? "xuat" : /nhap/.test(p) ? "nhap" : null; };
export const docHuongVT = (x) => { const p = plain(x); return /san xuat|\bsx\b/.test(p) ? "phuc_vu_san_xuat" : /cang/.test(p) ? "phuc_vu_cang" : null; };
// Đơn vị thực hiện: trống hoặc Hòa Phát = hoa_phat; thuê ngoài / nhà thầu = nha_thau; còn lại không hợp lệ
export const docDonVi = (x) => { const p = plain(x); return !p || /hoa phat|\bhp\b/.test(p) ? "hoa_phat" : /thue|nha thau|\bnt\b/.test(p) ? "nha_thau" : null; };

// loai: "muc_tieu" | "thuc_te"; thang (thực tế): chỉ nhận ngày trong tháng này
// Mục tiêu vận tải dùng form riêng theo bảng Excel (Loại hàng · Hướng · Loại xe · ĐVT · Tổng · Hòa Phát · Thuê ngoài · Ghi chú): HopDanVT
export default function HopDanSL(props) {
  return props.nhom === "van_tai" && props.loai !== "thuc_te" ? <HopDanVT onApDung={props.onApDung} onClose={props.onClose} /> : <HopDanSLChung {...props} />;
}
function HopDanSLChung({ loai, nhom = "cang", thang, onApDung, onClose }) {
  const { toast, fail } = useApp();
  const tt = loai === "thuc_te", vt = nhom === "van_tai";
  const [text, setText] = useState("");
  const [bang, setBang] = useState(null);
  const fileRef = useRef();
  const docBang = (b) => { if (!b.length) return toast("Chưa có dữ liệu để đọc", "warn"); const n = Math.max(...b.map((r) => r.length)); setBang(b.map((r) => [...r, ...Array(n - r.length).fill("")])); };
  const docFile = async (file) => {
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer());
      const aoa = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: "" }).filter((r) => r.some((c) => c !== "" && c != null));
      docBang(aoa.map((r) => r.map((c) => (typeof c === "number" ? c : String(c)))));
    } catch (e) { fail(e); }
  };
  const kq = useMemo(() => {
    if (!bang) return null;
    const dung = new Set(), cot = bang[0].map((c) => doanCot(c, vt ? TRUONG_VT : TRUONG)).map((k) => (k && !dung.has(k) ? (dung.add(k), k) : ""));
    const can = tt ? ["ngay", "huong", "loai", "tan"] : ["huong", "loai", "tan"];
    const thieu = can.filter((k) => !cot.includes(k));
    if (thieu.length) return { loiCot: `Dòng đầu phải là tiêu đề cột. Chưa thấy cột: ${thieu.map((k) => ({ ngay: "Ngày", huong: vt ? "Hướng (phục vụ cảng / sản xuất)" : "Hướng (nhập / xuất)", loai: vt ? "Loại xe" : "Loại hàng", tan: tt ? "Sản lượng (t)" : "Mục tiêu (t)" })[k]).join(", ")}.` };
    const thuTu = doanThuTuNgay(bang.slice(1).map((o) => o[cot.indexOf("ngay")])); // dd/mm hay mm/dd: theo cả cột Ngày
    const ds = bang.slice(1).filter((r) => r.some((x) => x !== "" && x != null)).map((o) => {
      const r = {}; cot.forEach((k, i) => { if (k) r[k] = o[i]; });
      const loi = [], huong = vt ? docHuongVT(r.huong) : docHuong(r.huong), loaiHang = String(r.loai ?? "").trim();
      if (!huong) loi.push(vt ? `Hướng "${r.huong ?? ""}" phải là phục vụ cảng hoặc phục vụ sản xuất` : `Hướng "${r.huong ?? ""}" phải là nhập hoặc xuất`);
      if (!loaiHang) loi.push(vt ? "Thiếu loại xe" : "Thiếu loại hàng");
      const donVi = vt ? docDonVi(r.donVi) : "";
      if (vt && !donVi) loi.push(`Đơn vị "${r.donVi ?? ""}" phải là Hòa Phát hoặc Thuê ngoài`);
      const v = typeof r.tan === "number" ? r.tan : docSo(r.tan);
      if (v == null || !(v >= 0)) loi.push(`${tt ? "Sản lượng" : "Mục tiêu"} "${r.tan ?? ""}" không hợp lệ`);
      let ngay = null;
      if (tt) {
        const t = docNgayGio(r.ngay, Date.now(), { thuTu }); ngay = t ? ngayDia(new Date(t).getTime()) : null;
        if (!ngay) loi.push(`Ngày "${r.ngay ?? ""}" không đọc được`); else if (thang && ngay.slice(0, 7) !== thang) loi.push(`Ngày ${ngay.slice(8)}/${ngay.slice(5, 7)} ngoài tháng ${thang.slice(5)}/${thang.slice(0, 4)}`);
      }
      return { huong, loai: loaiHang, donVi, hang: vt ? String(r.hang ?? "").trim() : "", tan: v, ngay, ghi_chu: String(r.ghi_chu ?? "").trim(), loi };
    });
    return { ds };
  }, [bang, tt, thang]);
  const hopLe = kq?.ds?.filter((x) => !x.loi.length) || [];
  const mau = vt && tt ? "Ngày\tHướng\tLoại xe\tĐơn vị\tLoại hàng\tSản lượng\n01/11/2026\tPhục vụ cảng\tXe ben\tHòa Phát\tQuặng\t1.250\n01/11/2026\tPhục vụ sản xuất\tXe đầu kéo\tThuê ngoài\tHRC\t800" : vt ? "Hướng\tLoại xe\tĐơn vị\tLoại hàng\tMục tiêu\nPhục vụ cảng\tXe ben\tHòa Phát\tQuặng\t90.000\nPhục vụ sản xuất\tXe đầu kéo\tThuê ngoài\tHRC\t60.000" : tt ? "Ngày\tHướng\tLoại hàng\tSản lượng\n05/11\tXuất\tHRC\t4.200\n05/11\tNhập\tQuặng\t12.500" : "Hướng\tLoại hàng\tMục tiêu\nXuất\tHRC\t70.000\nNhập\tQuặng\t400.000";
  return (
    <Dialog onOpenChange={(o) => !o && onClose()} className="max-w-[min(900px,calc(100vw-24px))]" title={tt ? "Dán nhanh / Excel · sản lượng thực tế" : "Dán nhanh / Excel · mục tiêu"}
      description={`Chép bảng từ Excel (Ctrl+C) rồi dán (Ctrl+V), hoặc chọn file Excel. Dòng đầu là tiêu đề: ${tt ? (vt ? "Ngày · Hướng · Loại xe · Đơn vị · Loại hàng · Sản lượng" : "Ngày · Hướng · Loại hàng · Sản lượng") : vt ? "Hướng · Loại xe · Đơn vị · Loại hàng · Mục tiêu · Ghi chú (Đơn vị: Hòa Phát hoặc Thuê ngoài; Loại hàng trống = mọi hàng)" : "Hướng · Loại hàng · Mục tiêu · Ghi chú"}. Số đưa vào bảng thay số đang có của đúng ô đó; chưa ghi cho tới khi bấm Lưu.`}
      footer={<>
        <span className="mr-auto text-sm text-muted-foreground">{kq?.ds ? `${hopLe.length} dòng hợp lệ · ${kq.ds.length - hopLe.length} dòng lỗi (bỏ qua)` : ""}</span>
        {bang && <Button variant="outline" onClick={() => setBang(null)}><RotateCcw />Dán lại</Button>}
        <Button disabled={!hopLe.length} onClick={async () => { const ok = await onApDung(hopLe); if (ok !== false) onClose(); }}><Check />{tt ? `Đưa ${hopLe.length} dòng vào bảng` : `Lưu ${hopLe.length} dòng`}</Button></>}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => { if (e.target.files[0]) docFile(e.target.files[0]); e.target.value = ""; }} />
        <Button variant="outline" onClick={() => fileRef.current.click()}><Upload />Chọn file Excel</Button>
      </div>
      {!bang ? (
        <div className="grid gap-2">
          <Textarea rows={9} className="font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} placeholder={mau}
            onPaste={(e) => { const t = e.clipboardData.getData("text"); setTimeout(() => docBang(tachBang(t)), 0); }} />
          <div><Button onClick={() => docBang(tachBang(text))} disabled={!text.trim()}><ClipboardPaste />Đọc bảng</Button></div>
        </div>
      ) : kq.loiCot ? <div className="flex gap-1.5 text-sm text-bad"><MucIcon muc="bad" className="mt-0.5" />{kq.loiCot}</div> : (
        <div className="scroll-x max-h-[50vh] rounded-md border">
          <table className="tbl text-xs">
            <thead><tr><th>Kết quả</th>{tt && <th>Ngày</th>}<th>Hướng</th><th>{vt ? "Loại xe" : "Loại hàng"}</th>{vt && <th>Đơn vị</th>}{vt && <th>Loại hàng</th>}<th className="num">{tt ? "Sản lượng (t)" : "Mục tiêu (t)"}</th>{!tt && <th>Ghi chú</th>}</tr></thead>
            <tbody>{kq.ds.map((x, i) => (
              <tr key={i}>
                <td className="min-w-[160px] align-top">{x.loi.length ? x.loi.map((l, j) => <div key={j} className="flex gap-1 text-bad"><MucIcon muc="bad" className="h-3 w-3" />{l}</div>) : <span className="text-ok">Hợp lệ</span>}</td>
                {tt && <td className="tabular-nums">{x.ngay ? `${x.ngay.slice(8)}/${x.ngay.slice(5, 7)}` : ""}</td>}
                <td>{vt ? (x.huong === "phuc_vu_cang" ? "Phục vụ cảng" : x.huong === "phuc_vu_san_xuat" ? "Phục vụ sản xuất" : "") : x.huong === "xuat" ? "Xuất" : x.huong === "nhap" ? "Nhập" : ""}</td><td>{x.loai}</td>{vt && <td>{x.donVi === "nha_thau" ? "Thuê ngoài" : x.donVi === "hoa_phat" ? "Hòa Phát" : ""}</td>}{vt && <td>{x.hang || "Mọi hàng"}</td>}<td className="num">{x.tan != null ? so(x.tan) : ""}</td>{!tt && <td>{x.ghi_chu}</td>}
              </tr>))}</tbody>
          </table>
        </div>
      )}
    </Dialog>
  );
}
