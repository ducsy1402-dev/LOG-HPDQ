import { useState } from "react";
import { Plus, Save, Settings2, X } from "lucide-react";
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
import { NGUON_GD, LOAI_GD, ngayStr, goiYBai, khuNhan } from "@/lib/kho";
import { trangThai } from "@/lib/linetime";

const TEN_GD = Object.fromEntries(LOAI_GD);
// Ca đang chạy theo quy ước CA 1 = 08h–20h, CA 2 = 20h–08h (0h–8h vẫn là CA 2 của ngày hôm trước)
export const caHienTai = () => { const d = new Date(), h = d.getHours(); return h < 8 ? { ngay: ngayStr(d.getTime() - 864e5), so: "2" } : { ngay: ngayStr(d.getTime()), so: h < 20 ? "1" : "2" }; };
// Ca của một ngày như mục Nhân sự & quân số: CA 1 / CA 2 kèm kíp (kíp chọn tay hoặc theo lịch luân phiên), CA HC trừ ngày nghỉ.
// Chưa tải được dữ liệu Thiết bị cơ giới thì chỉ ghi CA 1 / CA 2 / CA HC. Trả [[số ca, tên lưu, giờ]]
export function dsCa(tbD, ngay) {
  if (!tbD?.caDef?.length || !ngay) return [["1", "CA 1", ""], ["2", "CA 2", ""], ["HC", "CA HC", ""]];
  const thu = new Date(ngay + "T00:00").getDay();
  return tbD.caDef.filter((c) => !(c.boNgay ?? (c.hc ? [0] : [])).includes(thu))
    .map((c) => [String(c.so), c.hc ? "CA HC" : `CA ${c.so}${tbD.shiftKip({ ngay, ca: c.ten, so: c.so, hc: false })}`, c.ten.replace(/^CA \S+\s*/, "")]);
}
export const tenCa = (tbD, ngay, so) => dsCa(tbD, ngay).find((c) => c[0] === so)?.[1] || (so === "HC" ? "CA HC" : `CA ${so}`);
// Số lô gợi ý: LO-yymmdd-xx
const loMoi = (ds) => { const d = new Date(), p = `LO-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-`; let i = 1; while (ds.includes(p + String(i).padStart(2, "0"))) i++; return p + String(i).padStart(2, "0"); };
// Mở Danh mục › Kho bãi để khai báo bãi chứa
const moDanhMucKho = (onClose) => { try { localStorage.setItem("lg-danh-muc-tab", "kho"); } catch { /* bỏ qua */ } onClose(); location.hash = "#/danh-muc"; };

// Nhập liệu kho: một lần mở hộp ghi được NHIỀU lượt (vừa nhập vừa xuất, điều chuyển): chọn nghiệp vụ, điền, bấm "Thêm dòng" để đưa vào danh sách chờ,
// đổi nghiệp vụ điền tiếp; bấm Lưu ghi cả danh sách (kèm dòng đang điền nếu đã có số lượng) một lần. Kiểm tra tồn có tính các dòng chờ (nhập trước rồi xuất cùng lúc được).
// Nhập từ chuyến tàu tự lấy bãi nhận và hàng; thành phẩm ghi số lô.
// Hàng chưa có bãi chứa (không bãi nhỏ nào nhận) thì không cho lưu: phải khai báo ở Danh mục › Kho bãi.
export default function GiaoDichForm({ loaiKho, loaiGD: loaiDau, kho, sua, onClose }) {
  const { D, api, run, toast } = useApp();
  const tbD = useThietBi()?.D;
  const tp = loaiKho === "thanh_pham";
  const dongKho = kho.dong.filter((d) => d.loai === loaiKho && !d.saiBai);
  const capKho = kho.cap.filter((c) => c.loai === loaiKho);
  const baiDs = [...new Set(dongKho.map((d) => d.ten_bai))];
  // Hộp Nhập liệu: chọn nghiệp vụ Nhập / Xuất / Điều chuyển ngay trong hộp (đổi nghiệp vụ giữ ngày, ca, bãi, số lượng, chứng từ, ghi chú)
  const [loaiGD, setLoaiGD] = useState(loaiDau);
  const vao = loaiGD === "nhap" || loaiGD === "dau_ky";
  const dc = loaiGD === "dieu_chuyen";
  const [ds, setDs] = useState([]); // các lượt chờ lưu: { rec, taoLo }
  const laVao = (lg) => lg === "nhap" || lg === "dau_ky";
  // Tồn thay đổi bởi các lượt chờ lưu (cộng nhập / điều chuyển đến, trừ xuất / điều chuyển đi)
  const doiTon = (bai, hang) => ds.reduce((t, { rec: r }) => t + (plain(r.hang) !== plain(hang) ? 0 : (r.ten_bai === bai ? (laVao(r.loai) ? r.so_luong : -r.so_luong) : 0) + (r.den_bai === bai ? r.so_luong : 0)), 0);
  // Sửa một lượt đã ghi: lượt đó đang tính trong tồn, nên khi kiểm tra tồn phải cộng lại số lượng cũ
  const hangTai = (bai) => [...new Set([...capKho.filter((c) => c.ten_bai === bai && (c.ton > 1e-6 || vao)).map((c) => c.hang), ...(sua && sua.ten_bai === bai && !vao ? [sua.hang] : []),
    ...ds.filter(({ rec: r }) => (laVao(r.loai) && r.ten_bai === bai) || r.den_bai === bai).map(({ rec: r }) => r.hang)])];
  const khoiTao = (lg, o = {}) => {
    const ca = caHienTai(), bai = o.ten_bai ?? (baiDs[0] || ""), vaoMoi = lg === "nhap" || lg === "dau_ky";
    return { ngay: o.ngay ?? ca.ngay, ca: o.ca ?? ca.so, ten_bai: bai, den_bai: "", hang: vaoMoi ? "" : hangTai(bai)[0] || "", so_luong: o.so_luong ?? "", so_lo: "", nguon: NGUON_GD[loaiKho][lg]?.[0]?.[0] || "khac", voyage_id: "", chung_tu: o.chung_tu ?? "", ghi_chu: o.ghi_chu ?? "" };
  };
  const [f, setF] = useState(() => sua ? {
    ngay: String(sua.ngay).slice(0, 10), ca: (/^CA\s*(HC|\d+)/i.exec(sua.ca || "")?.[1] || "1").toUpperCase(), ten_bai: sua.ten_bai, den_bai: sua.den_bai || "", hang: sua.hang,
    so_luong: String(sua.so_luong).replace(".", ","), so_lo: sua.so_lo || "", nguon: sua.nguon || "khac", voyage_id: sua.voyage_id ? String(sua.voyage_id) : "", chung_tu: sua.chung_tu || "", ghi_chu: sua.ghi_chu || "",
  } : khoiTao(loaiDau));
  const doiLoai = (lg) => { if (lg === loaiGD) return; setLoaiGD(lg); setF((o) => khoiTao(lg, o)); };
  const set = (k) => (e) => setF((o) => ({ ...o, [k]: e.target.value }));
  const caNgay = dsCa(tbD, f.ngay);
  const doiNgay = (ngay) => { if (!ngay) return; setF((o) => ({ ...o, ngay, ca: dsCa(tbD, ngay).some((c) => c[0] === o.ca) ? o.ca : dsCa(tbD, ngay)[0]?.[0] || o.ca })); };
  const doiBai = (bai) => setF((o) => ({ ...o, ten_bai: bai, hang: vao || hangTai(bai).some((h) => plain(h) === plain(o.hang)) ? o.hang : hangTai(bai)[0] || "", so_lo: "" }));
  const coBai = (b) => baiDs.find((x) => plain(x) === plain(b));
  const bai = coBai(f.ten_bai), denBai = coBai(f.den_bai);
  const hangCuaBai = bai ? hangTai(bai) : [];
  const hang = f.hang.trim();
  const hoanLai = sua && !vao && sua.ten_bai === bai && plain(sua.hang) === plain(hang) ? +sua.so_luong || 0 : 0;
  const tonBH = (capKho.find((c) => c.ten_bai === bai && plain(c.hang) === plain(hang))?.ton || 0) + hoanLai + (bai && hang ? doiTon(bai, hang) : 0);
  // Nhập: bãi nhỏ sẽ nhận hàng ở bãi đã chọn; điều chuyển: bãi nhỏ nhận ở bãi đến. Gợi ý các bãi nhận được hàng này
  const baiNhan = vao ? bai : dc ? denBai : null;
  const khu = baiNhan && hang ? khuNhan(kho, baiNhan, hang) : null;
  const goiY = (vao || dc) && hang ? goiYBai(kho, hang, loaiKho).filter((g) => !dc || g.ten_bai !== bai).slice(0, 5) : [];
  const dsHang = vao ? [...new Set([...hangCuaBai, ...(kho.hangHoa || []).map((h) => h.loai_hang)])].map((h) => [h, h, hangCuaBai.includes(h) ? "có ở bãi" : ""])
    : hangCuaBai.map((h) => [h, h, `tồn ${so(capKho.find((c) => c.ten_bai === bai && c.hang === h)?.ton || 0)} t`]);
  const loTon = kho.lo.filter((l) => l.ten_bai === bai && plain(l.hang) === plain(hang));
  const tonLo = f.so_lo ? (loTon.find((l) => l.so_lo === f.so_lo)?.ton || 0) + (hoanLai && sua.so_lo === f.so_lo ? hoanLai : 0) : null;
  // Lỗi chặn lưu về bãi / hàng (hiện ngay dưới ô, bấm Lưu cũng báo)
  const loiBai = !f.ten_bai.trim() ? "Chọn bãi"
    : !bai ? `Bãi "${f.ten_bai.trim()}" chưa có trong danh mục kho bãi ${tp ? "thành phẩm" : "nguyên liệu"}`
    : dc && !f.den_bai.trim() ? "Chọn bãi đến"
    : dc && !denBai ? `Bãi "${f.den_bai.trim()}" chưa có trong danh mục kho bãi ${tp ? "thành phẩm" : "nguyên liệu"}`
    : dc && denBai === bai ? "Bãi đến phải khác bãi đi"
    : !hang ? "Chọn hàng"
    : !vao && !hangCuaBai.some((h) => plain(h) === plain(hang)) ? `${bai} không có ${hang} (tồn 0 t)`
    : baiNhan && !khu ? `${baiNhan} chưa có bãi chứa ${hang}` : null;
  const hienLoi = !!loiBai && !loiBai.startsWith("Chọn"); // chưa chọn thì không báo đỏ, bấm Lưu mới nhắc
  const canKhaiBao = !!loiBai && (!bai || (dc && !!f.den_bai.trim() && !denBai) || (baiNhan && hang && !khu));
  // Chuyến tàu: nhập nguyên liệu từ tàu nhập; xuất thành phẩm theo tàu xuất (đang / sắp làm hàng)
  const huongTau = loaiGD === "nhap" ? "nhap" : "xuat";
  const tau = D.voyages.filter((v) => !v.huy && (v.huong || "nhap") === huongTau && !["da_roi"].includes(trangThai(v)));
  const chonTau = (e) => {
    const id = e.target.value, v = D.vmap.get(+id);
    setF((o) => {
      const n = { ...o, voyage_id: id };
      const baiTau = String(v?.bai_hang || "").split(";").map((x) => x.trim()).find((x) => baiDs.includes(x));
      if (baiTau) n.ten_bai = baiTau;
      const hs = vao ? [...new Set([...hangTai(n.ten_bai), ...(kho.hangHoa || []).map((h) => h.loai_hang)])] : hangTai(n.ten_bai);
      const khop = hs.find((h) => plain(h) === plain(v?.ten_hang) || plain(h) === plain(v?.loai_hang)) || hs.find((h) => plain(v?.ten_hang || "").includes(plain(h)) || plain(h).includes(plain(v?.loai_hang || "")));
      if (khop) n.hang = khop;
      else if (vao && v?.ten_hang) n.hang = v.ten_hang;
      if (v) n.chung_tu = o.chung_tu || `Tàu ${v.ten_tau}`;
      return n;
    });
  };
  // Kiểm tra dòng đang điền, trả { rec, taoLo, nhan } hoặc null (đã báo lỗi)
  const lapDong = () => {
    const sl = docSo(f.so_luong);
    if (loiBai) { toast(canKhaiBao ? `${loiBai}. Khai báo bãi chứa ở Danh mục › Kho bãi trước khi lưu.` : loiBai, "bad"); return null; }
    if (!(sl > 0)) { toast("Số lượng phải lớn hơn 0", "bad"); return null; }
    if ((loaiGD === "xuat" || dc) && sl > (tonLo ?? tonBH) + 1e-6) { toast(`Vượt tồn: ${f.so_lo ? "lô" : "bãi"} chỉ còn ${so(tonLo ?? tonBH)} t`, "bad"); return null; }
    if (tp && loaiGD === "nhap" && !f.so_lo.trim()) { toast("Thành phẩm cần số lô", "bad"); return null; }
    const tenHang = (vao ? hangCuaBai.find((h) => plain(h) === plain(hang)) || (kho.hangHoa || []).find((h) => plain(h.loai_hang) === plain(hang))?.loai_hang : hangCuaBai.find((h) => plain(h) === plain(hang))) || hang;
    const rec = { ngay: f.ngay, ca: tenCa(tbD, f.ngay, f.ca), loai: loaiGD, ten_bai: bai, den_bai: dc ? denBai : null, hang: tenHang, so_luong: sl,
      so_lo: f.so_lo.trim() || null, nguon: f.nguon || null, voyage_id: f.voyage_id ? +f.voyage_id : null, chung_tu: f.chung_tu.trim() || null, ghi_chu: f.ghi_chu.trim() || null };
    const taoLo = tp && loaiGD === "nhap" && !(D.khoLo || []).some((l) => l.so_lo === rec.so_lo) && !ds.some((x) => x.rec.so_lo === rec.so_lo);
    return { rec, taoLo, nhan: `${TEN_GD[loaiGD].toLowerCase()} ${so(sl)} t ${tenHang} · ${bai}${dc ? ` → ${denBai}` : ""}` };
  };
  const dangDien = String(f.so_luong).trim() !== "";
  const themDong = () => { const d = lapDong(); if (!d) return; setDs((o) => [...o, d]); setF((o) => ({ ...o, so_luong: "", so_lo: "" })); };
  const luu = async () => {
    if (sua) {
      const d = lapDong(); if (!d) return;
      const r = await run(async () => {
        await api.updateGiaoDich(sua.id, d.rec);
        if (d.taoLo) await api.saveLo([{ so_lo: d.rec.so_lo, hang: d.rec.hang, ngay_nhap: d.rec.ngay, trang_thai: "san_sang" }]);
      }, `Đã sửa ${d.nhan}`);
      if (r) onClose();
      return;
    }
    let dong = ds;
    if (dangDien || !ds.length) { const d = lapDong(); if (!d) return; dong = [...ds, d]; }
    const dem = (lg) => dong.filter((x) => x.rec.loai === lg).length;
    const r = await run(async () => {
      await api.addGiaoDich(dong.map((x) => x.rec));
      const lo = dong.filter((x) => x.taoLo).map((x) => ({ so_lo: x.rec.so_lo, hang: x.rec.hang, ngay_nhap: x.rec.ngay, trang_thai: "san_sang" }));
      if (lo.length) await api.saveLo(lo);
    }, dong.length === 1 ? `Đã ghi ${dong[0].nhan}` : `Đã ghi ${dong.length} lượt: ${[["nhap", "nhập"], ["xuat", "xuất"], ["dieu_chuyen", "điều chuyển"]].filter(([k]) => dem(k)).map(([k, t]) => `${dem(k)} ${t}`).join(", ")}`);
    if (r) onClose();
  };
  const nguon = NGUON_GD[loaiKho][loaiGD];
  const chonGoiY = (g) => setF((o) => (dc ? { ...o, den_bai: g.ten_bai } : { ...o, ten_bai: g.ten_bai, hang: hang || o.hang }));
  return (
    <Dialog onOpenChange={(o) => !o && onClose()} title={`${sua ? `Sửa ${TEN_GD[loaiGD].toLowerCase()}` : "Nhập liệu"} · ${tp ? "kho thành phẩm" : "kho nguyên liệu"}`} className="max-w-2xl"
      footer={<><Button variant="outline" onClick={onClose}>Hủy</Button>
        {!sua && <Button variant="outline" onClick={themDong} title="Đưa dòng đang điền vào danh sách chờ, điền tiếp lượt khác (nhập / xuất / điều chuyển)"><Plus />Thêm dòng</Button>}
        <Button onClick={luu}><Save />Lưu{ds.length ? ` ${ds.length + (dangDien ? 1 : 0)} lượt` : ""}</Button></>}>
      <div className="grid gap-3 sm:grid-cols-3">
        {!sua && ds.length > 0 && (
          <div className="grid gap-1 rounded-md border bg-muted/30 p-2 text-xs sm:col-span-3">
            <div className="font-semibold">Danh sách chờ lưu ({ds.length}) <span className="font-normal text-muted-foreground">· bấm Lưu để ghi tất cả một lần</span></div>
            {ds.map((x, i) => (
              <div key={i} className="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-accent">
                <span className={cn("w-20 shrink-0 rounded px-1.5 py-0.5 text-center font-semibold", laVao(x.rec.loai) ? "bg-ok/15 text-ok" : x.rec.loai === "xuat" ? "bg-bad/15 text-bad" : "bg-info/15 text-info")}>{TEN_GD[x.rec.loai]}</span>
                <span className="min-w-0 flex-1 truncate">{x.rec.ten_bai}{x.rec.den_bai ? ` → ${x.rec.den_bai}` : ""} · {x.rec.hang}{x.rec.so_lo ? ` · lô ${x.rec.so_lo}` : ""}<span className="text-muted-foreground"> · {x.rec.ngay.slice(8, 10)}/{x.rec.ngay.slice(5, 7)} {x.rec.ca}</span></span>
                <b className="shrink-0 tabular-nums">{so(x.rec.so_luong)} t</b>
                <button type="button" onClick={() => setDs((o) => o.filter((_, j) => j !== i))} className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-bad" aria-label="Bỏ dòng này"><X className="h-3.5 w-3.5" /></button>
              </div>))}
          </div>)}
        {!sua && <div className="flex gap-1 sm:col-span-3" role="tablist" aria-label="Nghiệp vụ">
          {[["nhap", "Nhập"], ["xuat", "Xuất"], ["dieu_chuyen", "Điều chuyển"]].map(([k, ten]) => (
            <button key={k} type="button" role="tab" aria-selected={loaiGD === k} onClick={() => doiLoai(k)}
              className={cn("flex-1 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors", loaiGD === k ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent")}>{ten}</button>))}
        </div>}
        {!sua && !ds.length && <p className="-mt-1 text-[0.6875rem] text-muted-foreground sm:col-span-3">Muốn ghi nhiều lượt một lần (vừa nhập vừa xuất): điền lượt này, bấm <b>Thêm dòng</b>, đổi nghiệp vụ rồi điền tiếp; cuối cùng bấm Lưu.</p>}
        <Field label="Ngày"><NgayGio chiNgay required value={f.ngay} onChange={doiNgay} /></Field>
        <Field label="Ca"><NativeSelect value={f.ca} onChange={set("ca")} options={caNgay.map(([v, t, gio]) => [v, gio ? `${t} ${gio}` : t])} /></Field>
        {nguon && <Field label="Nguồn / mục đích"><NativeSelect value={f.nguon} onChange={set("nguon")} options={nguon} /></Field>}
        {f.nguon === "tau" && <Field label={loaiGD === "nhap" ? "Từ chuyến tàu" : "Xuất cho chuyến tàu"} className="sm:col-span-3"><NativeSelect value={f.voyage_id} onChange={chonTau} placeholder="Chọn chuyến…" options={tau.map((v) => [v.id, `${v.ten_tau} · ${v.ten_hang || v.loai_hang || ""} · ${so(v.khoi_luong)} t${v.bai_hang ? ` · ${v.bai_hang}` : ""}`])} /></Field>}
        <Field label={dc ? "Từ bãi" : "Bãi"}><ChonGo value={f.ten_bai} onChange={doiBai} options={baiDs} placeholder="Chọn hoặc gõ tên bãi" /></Field>
        {dc && <Field label="Đến bãi"><ChonGo value={f.den_bai} onChange={(v) => setF((o) => ({ ...o, den_bai: v }))} options={baiDs.filter((b) => b !== bai)} placeholder="Chọn hoặc gõ tên bãi" /></Field>}
        <Field label="Hàng" hint={bai && hang ? `Tồn ở ${bai}: ${so(tonBH)} t` : undefined} className={dc ? "" : "sm:col-span-2"}>
          <ChonGo value={f.hang} onChange={(v) => setF((o) => ({ ...o, hang: v, so_lo: "" }))} options={dsHang} placeholder={vao ? "Chọn hoặc gõ tên hàng" : "Chọn hàng có ở bãi"} />
        </Field>
        {hienLoi || ((vao || dc) && khu) ? (
          <div className="grid gap-1.5 text-xs sm:col-span-3">
            {hienLoi ? (
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-bad/40 bg-bad/5 px-2.5 py-1.5 text-bad">
                <span className="flex-1">{loiBai}{canKhaiBao ? `. Không lưu được: khai báo bãi chứa ở Danh mục › Kho bãi${baiNhan && hang && !khu ? " (thêm dòng bãi nhỏ cho hàng này, hoặc khu cố định nhóm / tự do)" : ""}${goiY.length ? ", hoặc chọn bãi phù hợp bên dưới" : ""}.` : "."}</span>
                {canKhaiBao && <Button size="xs" variant="outline" onClick={() => moDanhMucKho(onClose)}><Settings2 />Khai báo bãi</Button>}
              </div>)
              : <div className="text-muted-foreground">{dc ? "Đến" : "Vào"} bãi nhỏ <b className="text-foreground">{khu.ten}</b>{khu.kieu === "tu_do" ? " (khu tự do)" : khu.kieu === "co_dinh_nhom" ? " (khu cố định nhóm)" : ""}{khu.sucChua > 0 ? ` · còn trống ~${so(Math.max(0, khu.sucChua - khu.ton))} t` : ""}</div>}
            {goiY.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5"><span className="text-muted-foreground">{dc ? "Bãi đến phù hợp:" : "Bãi phù hợp:"}</span>
                {goiY.map((g) => (
                  <button key={g.ten_bai} type="button" onClick={() => chonGoiY(g)}
                    className={cn("rounded-md border px-2 py-0.5 hover:bg-accent", g.ten_bai === (dc ? denBai : bai) && "border-primary bg-primary/10")}>
                    {g.ten_bai} › {g.khu.ten}<span className="text-muted-foreground">{g.muc === 2 ? " · tự do" : g.muc === 1 ? " · nhóm" : ""}{g.trong != null ? ` · trống ${so(g.trong)} t` : ""}</span>
                  </button>))}
              </div>)}
          </div>) : null}
        <Field label="Số lượng (tấn)"><Input className="num" inputMode="decimal" value={f.so_luong} onChange={set("so_luong")} /></Field>
        {tp && (loaiGD === "nhap"
          ? <Field label="Số lô" hint="Lô mới tự thêm vào danh sách lô (sẵn sàng xuất)"><div className="flex gap-1"><Input value={f.so_lo} onChange={set("so_lo")} /><Button size="sm" variant="outline" onClick={() => setF({ ...f, so_lo: loMoi((D.khoLo || []).map((l) => l.so_lo)) })}>Tạo</Button></div></Field>
          : <Field label="Lô" hint={tonLo != null ? `Tồn lô: ${so(tonLo)} t` : "Không chọn lô: trừ chung"}><NativeSelect value={f.so_lo} onChange={set("so_lo")} placeholder="—" options={[...(sua?.so_lo && !loTon.some((l) => l.so_lo === sua.so_lo) ? [[sua.so_lo, `${sua.so_lo} · đã xuất hết`]] : []), ...loTon.map((l) => [l.so_lo, `${l.so_lo} · ${so(l.ton)} t`])]} /></Field>)}
        <Field label="Chứng từ"><Input value={f.chung_tu} onChange={set("chung_tu")} placeholder="Số phiếu, biên bản…" /></Field>
        <Field label="Ghi chú" className="sm:col-span-3"><Input value={f.ghi_chu} onChange={set("ghi_chu")} /></Field>
      </div>
    </Dialog>
  );
}

// Kiểm kê: nhập số đo thực tế, web tính chênh lệch với sổ và ghi thành lượt điều chỉnh kiểm kê
export function KiemKeForm({ loaiKho, kho, onClose }) {
  const { api, run, toast } = useApp();
  const tbD = useThietBi()?.D;
  const dongKho = kho.cap.filter((c) => c.loai === loaiKho).sort((a, b) => a.ten_bai.localeCompare(b.ten_bai) || a.hang.localeCompare(b.hang));
  const [chon, setChon] = useState(0);
  const [doTT, setDoTT] = useState("");
  const [ghiChu, setGhiChu] = useState("");
  const d = dongKho[chon];
  const doSo = docSo(doTT), chenh = d && doSo != null ? doSo - d.ton : null;
  const luu = async () => {
    if (!d || doSo == null || doSo < 0) return toast("Nhập số đo thực tế", "bad");
    const hien = caHienTai();
    const r = await run(() => api.addGiaoDich([{ ngay: hien.ngay, ca: tenCa(tbD, hien.ngay, hien.so), loai: "kiem_ke", ten_bai: d.ten_bai, hang: d.hang, so_luong: chenh, do_thuc_te: doSo, so_sach: d.ton,
      ghi_chu: [`Kiểm kê: đo ${so(doSo)} t, sổ ${so(d.ton)} t`, ghiChu.trim()].filter(Boolean).join(". ") }]), `Đã ghi kiểm kê ${d.ten_bai} – ${d.hang}: chênh ${so(chenh)} t`);
    if (r) onClose();
  };
  return (
    <Dialog onOpenChange={(o) => !o && onClose()} title="Kiểm kê" description="Nhập số đo thực tế; web ghi phần chênh lệch so với sổ thành lượt điều chỉnh kiểm kê."
      footer={<><Button variant="outline" onClick={onClose}>Hủy</Button><Button onClick={luu}><Save />Ghi kiểm kê</Button></>}>
      <div className="grid gap-3">
        <Field label="Bãi – hàng" hint={d ? `Sổ: ${so(d.ton)} t` : undefined}><ChonGo tuDo={false} value={chon} onChange={setChon} placeholder="Gõ tên bãi hoặc hàng…" options={dongKho.map((x, i) => [i, `${x.ten_bai} · ${x.hang}`, `sổ ${so(x.ton)} t`])} /></Field>
        <Field label="Số đo thực tế (tấn)"><Input className="num" inputMode="decimal" value={doTT} onChange={(e) => setDoTT(e.target.value)} autoFocus /></Field>
        {chenh != null && <div className="text-sm">Chênh lệch: <b className={chenh < 0 ? "text-bad" : "text-ok"}>{chenh > 0 ? "+" : ""}{so(chenh, 2)} t</b>{d.ton > 0 && <span className="text-muted-foreground"> ({so((Math.abs(chenh) / d.ton) * 100, 1)}% so với sổ)</span>}</div>}
        <Field label="Ghi chú"><Input value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} placeholder="Phương pháp đo, người kiểm…" /></Field>
      </div>
    </Dialog>
  );
}

// Sửa một lượt kiểm kê đã ghi: ngày, ca, số đo thực tế (chênh lệch tính lại theo số sổ lúc kiểm), ghi chú
export function SuaKiemKe({ g, onClose }) {
  const { api, run, toast } = useApp();
  const tbD = useThietBi()?.D;
  const ghiChuGoc = String(g.ghi_chu || "").replace(/^Kiểm kê: đo [^,]*, sổ [^.]*?t\.?\s*/, "");
  const [f, setF] = useState({ ngay: String(g.ngay).slice(0, 10), ca: (/^CA\s*(HC|\d+)/i.exec(g.ca || "")?.[1] || "1").toUpperCase(), doTT: String(g.do_thuc_te ?? "").replace(".", ","), ghi_chu: ghiChuGoc });
  const doSo = docSo(f.doTT), sach = +g.so_sach || 0, chenh = doSo != null ? doSo - sach : null;
  const luu = async () => {
    if (doSo == null || doSo < 0) return toast("Nhập số đo thực tế", "bad");
    const r = await run(() => api.updateGiaoDich(g.id, { ngay: f.ngay, ca: tenCa(tbD, f.ngay, f.ca), do_thuc_te: doSo, so_luong: chenh,
      ghi_chu: [`Kiểm kê: đo ${so(doSo)} t, sổ ${so(sach)} t`, f.ghi_chu.trim()].filter(Boolean).join(". ") }), `Đã sửa kiểm kê ${g.ten_bai} – ${g.hang}: chênh ${so(chenh)} t`);
    if (r) onClose();
  };
  return (
    <Dialog onOpenChange={(o) => !o && onClose()} title={`Sửa kiểm kê · ${g.ten_bai} – ${g.hang}`} description={`Số sổ lúc kiểm: ${so(sach)} t. Chênh lệch tính lại theo số đo mới.`}
      footer={<><Button variant="outline" onClick={onClose}>Hủy</Button><Button onClick={luu}><Save />Lưu</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Ngày"><NgayGio chiNgay required value={f.ngay} onChange={(ngay) => ngay && setF((o) => ({ ...o, ngay }))} /></Field>
        <Field label="Ca"><NativeSelect value={f.ca} onChange={(e) => setF((o) => ({ ...o, ca: e.target.value }))} options={dsCa(tbD, f.ngay).map(([v, t, gio]) => [v, gio ? `${t} ${gio}` : t])} /></Field>
        <Field label="Số đo thực tế (tấn)"><Input className="num" inputMode="decimal" value={f.doTT} onChange={(e) => setF((o) => ({ ...o, doTT: e.target.value }))} autoFocus /></Field>
        <div className="self-end pb-2 text-sm">{chenh != null && <>Chênh lệch: <b className={chenh < 0 ? "text-bad" : "text-ok"}>{chenh > 0 ? "+" : ""}{so(chenh)} t</b></>}</div>
        <Field label="Ghi chú" className="sm:col-span-2"><Input value={f.ghi_chu} onChange={(e) => setF((o) => ({ ...o, ghi_chu: e.target.value }))} /></Field>
      </div>
    </Dialog>
  );
}
