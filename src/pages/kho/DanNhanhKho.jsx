import { useMemo, useRef, useState } from "react";
import { ClipboardPaste, Save, RotateCcw, Upload, Settings2 } from "lucide-react";
import { useApp } from "@/store";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea, NativeSelect, Checkbox, Field } from "@/components/ui/input";
import { MucIcon } from "@/components/common";
import { tachBang, docSo, docNgayGio } from "@/lib/paste";
import { LOAI_GD, ngayStr, khuNhan, goiYBai, khuChoPhepHang } from "@/lib/kho";
import { so, plain } from "@/lib/format";

const TRUONG = [
  { k: "ngay", ten: "Ngày", bi: ["ngay", "ngay thang", "date", "ngay nhap", "ngay xuat"] },
  { k: "ca", ten: "Ca", bi: ["ca", "ca kip"] },
  { k: "loai", ten: "Loại (nhập / xuất…)", bi: ["loai", "loai giao dich", "nhap/xuat", "nhap xuat"] },
  { k: "ten_bai", ten: "Bãi", bi: ["bai", "ten bai", "kho", "tu bai", "bai di"] },
  { k: "ten_khu", ten: "Gian/lô", bi: ["gian/lo", "gian lo", "gian / lo", "gian", "bai nho", "khu", "tu bai nho", "bai nho di", "tu gian/lo"] },
  { k: "den_bai", ten: "Đến bãi", bi: ["den bai", "bai den"] },
  { k: "den_khu", ten: "Đến gian/lô", bi: ["den gian/lo", "den gian lo", "gian/lo den", "den bai nho", "bai nho den", "den gian"] },
  { k: "hang", ten: "Hàng", bi: ["hang", "ten hang", "hang hoa", "ten hang hoa", "loai hang"] },
  { k: "so_luong", ten: "Số lượng (t)", bi: ["so luong", "khoi luong", "kl", "tan", "so tan", "trong luong", "ton"] },
  { k: "so_lo", ten: "Số lô", bi: ["so lo", "lo", "ma lo"] },
  { k: "chung_tu", ten: "Chứng từ", bi: ["chung tu", "so phieu", "phieu", "so chung tu"] },
  { k: "ghi_chu", ten: "Ghi chú", bi: ["ghi chu", "note"] },
];
const doanCot = (c) => { const p = plain(c).replace(/[()]/g, " ").replace(/\s+/g, " ").trim(); if (!p) return ""; return TRUONG.find((t) => t.bi.includes(p))?.k || TRUONG.find((t) => t.bi.some((b) => b.length > 2 && p.startsWith(b)))?.k || ""; };
const docLoai = (x, md) => { const p = plain(x); if (!p) return md; if (/dau ky|ton dau/.test(p)) return "dau_ky"; if (/kiem/.test(p)) return "kiem_ke"; if (/chuyen/.test(p)) return "dieu_chuyen"; if (/xuat/.test(p)) return "xuat"; if (/nhap/.test(p)) return "nhap"; return null; };
const docNgay = (x) => { if (x == null || x === "") return ngayStr(Date.now()); const t = docNgayGio(x); return t ? ngayStr(new Date(t).getTime()) : null; };

// Dán nhanh / nhập Excel nhiều lượt nhập – xuất kho (cả tồn đầu kỳ). Mỗi dòng: ngày, ca, loại, bãi, gian/lô, hàng, số lượng, lô, chứng từ.
// Chỉ BẮT BUỘC hàng và số lượng. Thiếu ngày = hôm nay; thiếu ca = để trống; thiếu loại = loại chọn trong hộp;
// thiếu bãi: suy ra từ cột Gian/lô (gian / lô chỉ có ở một bãi), không có thì theo hàng (nhập: bãi gợi ý nhận hàng; xuất: bãi đang tồn nhiều hàng đó nhất).
export default function DanNhanhKho({ loaiKho, kho, onClose }) {
  const { D, api, run, toast, fail } = useApp();
  const [text, setText] = useState("");
  const [bang, setBang] = useState(null);
  const [cot, setCot] = useState([]);
  const [coTieuDe, setCoTieuDe] = useState(true);
  const [loaiMD, setLoaiMD] = useState("nhap");
  const fileRef = useRef();
  const docBang = (b) => {
    if (!b.length) return toast("Chưa có dữ liệu để đọc", "warn");
    const n = Math.max(...b.map((r) => r.length)), day = b.map((r) => [...r, ...Array(n - r.length).fill("")]);
    const c = day[0].map(doanCot), dung = new Set(), sach = c.map((k) => (k && !dung.has(k) ? (dung.add(k), k) : ""));
    const td = sach.filter(Boolean).length >= 2;
    setBang(day); setCot(td ? sach : Array(n).fill("")); setCoTieuDe(td);
  };
  const docFile = async (file) => {
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer());
      const aoa = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: "" }).filter((r) => r.some((c) => c !== "" && c != null));
      docBang(aoa.map((r) => r.map((c) => (typeof c === "number" ? c : String(c)))));
    } catch (e) { fail(e); }
  };
  // Bãi trong danh mục của loại kho này (khớp không dấu, lưu đúng tên danh mục)
  const dongKhoNay = kho.dong.filter((d) => d.loai === loaiKho && !d.saiBai);
  const baiDm = new Map(dongKhoNay.map((d) => [plain(d.ten_bai), d.ten_bai]));
  const dong = bang ? (coTieuDe ? bang.slice(1) : bang) : [];
  const kq = useMemo(() => dong.map((o) => {
    if (o.every((c) => c === "" || c == null)) return null;
    const r = {}; cot.forEach((k, i) => { if (k) r[k] = o[i]; });
    const loi = [], canh = [];
    const loai = docLoai(r.loai, loaiMD), ngay = docNgay(r.ngay), sl = typeof r.so_luong === "number" ? r.so_luong : docSo(r.so_luong);
    if (!loai) loi.push(`Không rõ loại "${r.loai}"`);
    if (!ngay) loi.push(`Ngày "${r.ngay}" không đọc được`);
    if (!String(r.hang ?? "").trim()) loi.push("Thiếu hàng");
    if (sl == null || (loai !== "kiem_ke" && !(sl > 0))) loi.push(`Số lượng "${r.so_luong ?? ""}" không hợp lệ`);
    // Chưa có bãi chứa: chặn cả lần lưu (khai báo ở Danh mục › Kho bãi rồi dán lại)
    const den = baiDm.get(plain(r.den_bai)), hang = String(r.hang ?? "").trim(), baiGhi = String(r.ten_bai ?? "").trim(), gianGhi = String(r.ten_khu ?? "").trim();
    let chuaBai = false, bai = baiDm.get(plain(baiGhi));
    const thieuBai = (m) => { loi.push(m); chuaBai = true; };
    if (baiGhi && !bai) thieuBai(`Bãi "${baiGhi}" chưa có trong danh mục kho bãi ${loaiKho === "thanh_pham" ? "thành phẩm" : "nguyên liệu"}`);
    if (!baiGhi) {
      // Không ghi bãi: suy ra từ Gian/lô, không có thì theo hàng
      const vao = loai === "nhap" || loai === "dau_ky";
      if (gianGhi) {
        const ds = dongKhoNay.filter((d) => plain(d.ten) === plain(gianGhi)), ok = hang ? ds.filter((d) => khuChoPhepHang(d, hang, kho.hangHoa)) : ds, bs = [...new Set((ok.length ? ok : ds).map((d) => d.ten_bai))];
        if (!ds.length) thieuBai(`Gian/lô "${gianGhi}" chưa có trong danh mục kho bãi ${loaiKho === "thanh_pham" ? "thành phẩm" : "nguyên liệu"}`);
        else if (bs.length === 1) bai = bs[0];
        else loi.push(`Gian/lô "${gianGhi}" có ở ${bs.length} bãi (${bs.join(", ")}): thêm cột Bãi`);
      } else if (hang) {
        const goiY = vao ? goiYBai(kho, hang, loaiKho)[0]?.ten_bai : kho.cap.filter((c) => c.loai === loaiKho && plain(c.hang) === plain(hang) && c.ton > 1e-6).sort((x, y) => y.ton - x.ton)[0]?.ten_bai;
        if (goiY) { bai = goiY; canh.push(`Không ghi bãi: web chọn ${goiY} theo hàng`); }
        else loi.push(vao ? `Không bãi nào nhận hàng ${hang}: thêm cột Bãi hoặc Gian/lô` : `Không bãi nào đang có tồn ${hang}: thêm cột Bãi hoặc Gian/lô`);
      } else loi.push("Thiếu bãi (hoặc gian/lô)");
    }
    if (bai && hang && (loai === "nhap" || loai === "dau_ky") && !khuNhan(kho, bai, hang)) thieuBai(`${bai} chưa có bãi chứa ${hang}`);
    if (loai === "dieu_chuyen" && !String(r.den_bai ?? "").trim()) loi.push("Điều chuyển thiếu bãi đến");
    else if (loai === "dieu_chuyen" && !den) thieuBai(`Bãi đến "${r.den_bai}" chưa có trong danh mục kho bãi`);
    else if (loai === "dieu_chuyen" && hang && !khuNhan(kho, den, hang)) thieuBai(`${den} chưa có bãi chứa ${hang}`);
    // Bãi nhỏ (SQL 12): cột Bãi nhỏ nếu có (phải thuộc bãi đó); không có thì nhập vào bãi nhỏ web xếp cho hàng, xuất từ bãi nhỏ đang có nhiều hàng đó nhất
    let tenKhu = null, denKhu = null;
    if (D.coSql12) {
      const khuCua = (b) => kho.dong.filter((d) => d.loai === loaiKho && !d.saiBai && b && plain(d.ten_bai) === plain(b));
      const tim = (b, ten, cot) => { const ds = khuCua(b), x = ds.find((d) => plain(d.ten) === plain(ten)); if (!x) loi.push(`Gian/lô "${ten}" không có trong ${b || cot}`); return x?.ten || null; };
      const tuDong = (b, h, vao) => { if (!b || !h) return null; const key = vao ? khuNhan(kho, b, h)?.key : kho.cap.filter((c) => c.ten_bai === b && plain(c.hang) === plain(h) && c.ton > 1e-6).sort((x, y) => y.ton - x.ton)[0]?.key || khuNhan(kho, b, h)?.key; return kho.dong.find((d) => d.key === key && !d.saiBai)?.ten || null; };
      tenKhu = String(r.ten_khu ?? "").trim() ? (bai ? tim(bai, r.ten_khu, "bãi") : null) : tuDong(bai, hang, loai === "nhap" || loai === "dau_ky");
      denKhu = loai !== "dieu_chuyen" ? null : String(r.den_khu ?? "").trim() ? (den ? tim(den, r.den_khu, "bãi đến") : null) : tuDong(den, hang, true);
    }
    const rec = { ngay, ca: String(r.ca ?? "").trim() || null, loai, ten_bai: bai || String(r.ten_bai ?? "").trim(), ...(D.coSql12 ? { ten_khu: tenKhu, den_khu: denKhu } : {}), den_bai: loai === "dieu_chuyen" ? den || String(r.den_bai ?? "").trim() : null, hang: String(r.hang ?? "").trim(),
      so_luong: sl, so_lo: String(r.so_lo ?? "").trim() || null, nguon: loai === "nhap" ? (loaiKho === "thanh_pham" ? "san_xuat" : "khac") : loai === "xuat" ? (loaiKho === "thanh_pham" ? "don_hang" : "cap_sx") : null,
      chung_tu: String(r.chung_tu ?? "").trim() || null, ghi_chu: String(r.ghi_chu ?? "").trim() || null };
    return { rec, loi, canh, chuaBai };
  }), [dong, cot, loaiMD]); // eslint-disable-line react-hooks/exhaustive-deps
  const hopLe = kq.filter((x) => x && !x.loi.length);
  const nChuaBai = kq.filter((x) => x?.chuaBai).length;
  const moDanhMuc = () => { try { localStorage.setItem("lg-danh-muc-tab", "kho"); } catch { /* bỏ qua */ } onClose(); location.hash = "#/danh-muc"; };
  const luu = async () => {
    if (nChuaBai) return toast(`${nChuaBai} dòng chưa có bãi chứa: khai báo ở Danh mục › Kho bãi rồi dán lại`, "bad");
    const rows = hopLe.map((x) => x.rec);
    const loMoi = [...new Map(rows.filter((r) => r.so_lo && (r.loai === "nhap" || r.loai === "dau_ky") && !(D.khoLo || []).some((l) => l.so_lo === r.so_lo)).map((r) => [r.so_lo, { so_lo: r.so_lo, hang: r.hang, ngay_nhap: r.ngay, trang_thai: "san_sang" }])).values()];
    const ok = await run(async () => { await api.addGiaoDich(rows); if (loMoi.length) await api.saveLo(loMoi); }, `Đã ghi ${rows.length} lượt${loMoi.length ? `, thêm ${loMoi.length} lô` : ""}`);
    if (ok) onClose();
  };
  const tenLoai = Object.fromEntries(LOAI_GD);
  return (
    <Dialog onOpenChange={(o) => !o && onClose()} className="max-w-[min(1200px,calc(100vw-24px))]" title="Dán nhanh / nhập Excel sổ kho"
      description="Chép bảng từ Excel (Ctrl+C) rồi dán (Ctrl+V), hoặc chọn file Excel. Cột nhận được: Ngày, Ca, Loại, Bãi, Gian/lô, Đến bãi, Đến gian/lô, Hàng, Số lượng, Số lô, Chứng từ, Ghi chú. Chỉ cần có Hàng và Số lượng: thiếu Ngày = hôm nay, thiếu Ca thì để trống, thiếu Loại thì dùng loại chọn bên dưới, thiếu Bãi thì web suy ra từ Gian/lô hoặc từ hàng."
      footer={bang && <>{nChuaBai
          ? <span className="mr-auto flex flex-wrap items-center gap-2 text-sm text-bad">{nChuaBai} dòng chưa có bãi chứa: không lưu được (kể cả các dòng đúng, để khỏi trùng khi dán lại). Khai báo bãi rồi dán lại.
              <Button size="xs" variant="outline" onClick={moDanhMuc}><Settings2 />Khai báo bãi</Button></span>
          : <span className="mr-auto text-sm text-muted-foreground">{hopLe.length} dòng hợp lệ · {kq.filter((x) => x?.loi.length).length} dòng lỗi (bỏ qua)</span>}
        <Button variant="outline" onClick={() => setBang(null)}><RotateCcw />Dán lại</Button><Button onClick={luu} disabled={!hopLe.length || nChuaBai > 0}><Save />Lưu {hopLe.length} lượt</Button></>}>
      <div className="mb-2 flex flex-wrap items-end gap-3">
        <Field label="Loại khi file không có cột Loại" className="w-56"><NativeSelect value={loaiMD} onChange={(e) => setLoaiMD(e.target.value)} options={LOAI_GD} /></Field>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => { if (e.target.files[0]) docFile(e.target.files[0]); e.target.value = ""; }} />
        <Button variant="outline" onClick={() => fileRef.current.click()}><Upload />Chọn file Excel</Button>
      </div>
      {!bang ? (
        <div className="grid gap-2">
          <Textarea rows={9} className="font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} placeholder={"Ngày\tCa\tLoại\tBãi\tGian/lô\tHàng\tSố lượng\tSố lô\tChứng từ\n24/10\tCA 1\tNhập\tBãi KTX\t\tĐá vôi <20mm\t1.250\t\tPN-0123"}
            onPaste={(e) => { const t = e.clipboardData.getData("text"); setTimeout(() => docBang(tachBang(t)), 0); }} />
          <div><Button onClick={() => docBang(tachBang(text))} disabled={!text.trim()}><ClipboardPaste />Đọc bảng</Button></div>
        </div>
      ) : (
        <div className="grid gap-2">
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={coTieuDe} onChange={(e) => setCoTieuDe(e.target.checked)} />Dòng đầu là tiêu đề (không lưu)</label>
          <div className="scroll-x max-h-[55vh] rounded-md border">
            <table className="tbl text-xs">
              <thead><tr><th>Kết quả</th>{cot.map((k, i) => (
                <th key={i} className="min-w-[110px] normal-case">{coTieuDe && <div className="mb-1 truncate font-normal">{String(bang[0][i] ?? "") || `Cột ${i + 1}`}</div>}
                  <NativeSelect className="h-7 text-xs" value={k} onChange={(e) => setCot((c) => c.map((x, j) => (j === i ? e.target.value : x === e.target.value ? "" : x)))} options={[["", "— Bỏ qua —"], ...TRUONG.map((t) => [t.k, t.ten])]} /></th>))}</tr></thead>
              <tbody>{dong.map((o, r) => { const x = kq[r]; return (
                <tr key={r}>
                  <td className="min-w-[180px] align-top">{!x ? <span className="text-muted-foreground">Dòng trống</span> : x.loi.length
                    ? x.loi.map((l, i) => <div key={i} className="flex gap-1"><MucIcon muc="bad" className="h-3 w-3" />{l}</div>)
                    : <><b>{tenLoai[x.rec.loai]}</b> {so(x.rec.so_luong, 2)} t<div className="text-muted-foreground">{x.rec.ngay} · {x.rec.ten_bai}{x.rec.ten_khu ? ` › ${x.rec.ten_khu}` : ""}</div>{x.canh.map((c, i) => <div key={i} className="flex gap-1"><MucIcon muc="warn" className="h-3 w-3" />{c}</div>)}</>}</td>
                  {o.map((c, i) => <td key={i} className="align-top">{String(c ?? "")}</td>)}
                </tr>); })}</tbody>
            </table>
          </div>
        </div>
      )}
    </Dialog>
  );
}
