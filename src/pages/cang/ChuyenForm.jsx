import { useState } from "react";
import { Save, Plus, X } from "lucide-react";
import { useApp } from "@/store";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Field, Textarea, Checkbox } from "@/components/ui/input";
import { ChonGo } from "@/components/ui/combobox";
import { NgayGio } from "@/components/ui/ngaygio";
import { MucIcon } from "@/components/common";
import { maChuyenMoi, khoangBen, rangBuocEtb, etbGoiY } from "@/lib/linetime";
import { tuXepBenGiuMoc, canXepBen } from "@/lib/tuXep";
import { uocThongSo } from "@/lib/xepBen";
import { useCtxXep } from "./useXepBen";
import { kiemTraXepBen, nhanCho, benLienKe, laBenLienKe, tuyenCuaBen, benTheoViTri, tenTuyen } from "@/lib/capBen";
import { kiemTraBen } from "@/lib/checks";
import { toLocalInput, fromLocalInput, ms, plain, so, ngayGio } from "@/lib/format";
import { tenBen, noiHaiBen } from "./BangTauBen";
import { useThietBi } from "@/thietbi/Host";

const soHoacNull = (x) => (x === "" || x == null ? null : Number(String(x).replace(",", ".")));

const SO = ["khoi_luong", "da_lam", "draft", "loa", "dwt", "cam_ket"];
const NGAY = ["eta", "etb", "etd"];

// Lưu kèm danh mục tàu (nhập một lần, dùng lại). Lỗi danh mục không chặn việc lưu chuyến.
export async function ghiDanhMuc(api, D, v) {
  try {
    if (v.ten_tau && v.ten_tau !== "TBA") await api.upsertRows("vessels", [{ ten: v.ten_tau, dwt: v.dwt ?? null, loa: v.loa ?? null, draft: v.draft ?? null }], "ten");
  } catch { /* bỏ qua */ }
}

// Thêm / sửa chuyến tàu (nhân viên cầu bến): tàu, đại lý, bến, các dòng hàng (tên hàng · loại hàng · khối lượng), cam kết, số máng,
// ETA/ETB/ETD, tàu ưu tiên vào sớm. Bãi, cẩu, băng tải, phương tiện, vét / be hầm khai ở phiếu chuyến › Bãi & Thiết bị (người lập phương án).
// Mốc giờ thực tế sửa trong phiếu chuyến. Tên tàu, tên hàng gợi ý từ danh mục và chuyến cũ; đại lý tự lấy theo tàu và phải có trong danh mục.
// Tàu nhiều loại hàng: ten_hang = các tên nối "; ", loai_hang = các loại nối "; ", khoi_luong = tổng (các phép tính dùng tổng).
export default function ChuyenForm({ v, onClose, onSaved }) {
  const { D, api, run, toast } = useApp();
  const tbD = useThietBi()?.D;
  const hangHoa = tbD?.hanghoa || []; // danh mục hàng hóa dùng chung
  const c19 = !!D.coSql19, c28 = !!D.coSql28;
  const [f, setF] = useState(() => {
    const x = { ten_tau: "", ma_chuyen: "", huong: "nhap", ben_ma: "", cam_ket_ghi_chu: "", ghi_chu: "", ...(v || {}) };
    for (const k of SO) x[k] = v?.[k] ?? "";
    for (const k of NGAY) x[k] = toLocalInput(v?.[k]);
    for (const k of ["ten_tau", "ben_ma", "ben_phu", "cam_ket_ghi_chu", "ghi_chu"]) x[k] = x[k] ?? "";
    x.so_mang = v?.so_mang ?? "";
    x.vi_tri = v?.vi_tri ?? "";
    x.uu_tien = !!v?.uu_tien;
    const ds = (v?.hang_ds || []).filter((h) => h.ten_hang || h.loai_hang || h.khoi_luong != null);
    x.hang = (ds.length ? ds : [{ ten_hang: v?.ten_hang, loai_hang: v?.loai_hang, khoi_luong: v?.khoi_luong }])
      .map((h) => ({ ten: h.ten_hang ?? "", loai: h.loai_hang ?? "", kl: h.khoi_luong ?? "" }));
    return x;
  });
  const set = (k) => (e) => setF((o) => ({ ...o, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const chonTau = (val) => {
    const ten = String(val).toUpperCase(), t = D.vessels.find((x) => x.ten === ten);
    setF((o) => ({ ...o, ten_tau: ten, ...(t && !v ? { dwt: t.dwt ?? o.dwt, loa: t.loa ?? o.loa, draft: t.draft ?? o.draft } : {}) }));
  };
  // Tên hàng: danh mục hàng hóa + tên hàng của các chuyến cũ; chọn hàng có trong danh mục thì loại hàng = nhóm hàng
  //   (hàng chỉ có ở chuyến cũ: lấy loại hàng của chuyến đó)
  const nhomCua = (ten) => hangHoa.find((h) => plain(h.loai_hang) === plain(ten))?.nhom || D.voyages.find((x) => x.ten_hang && x.loai_hang && plain(x.ten_hang) === plain(ten))?.loai_hang;
  const mHang = new Map(hangHoa.map((h) => [plain(h.loai_hang), [h.loai_hang, h.loai_hang, h.nhom || ""]]));
  for (const x of D.voyages) for (const t of String(x.ten_hang || "").split(";").map((s) => s.trim()).filter(Boolean))
    if (!mHang.has(plain(t))) mHang.set(plain(t), [t, t, `chuyến cũ${x.loai_hang ? ` · ${x.loai_hang}` : ""}`]);
  const dsTenHang = [...mHang.values()];
  const dsNhom = [...new Set(hangHoa.map((h) => h.nhom).filter(Boolean))];
  const setHang = (i, h) => setF((o) => ({ ...o, hang: o.hang.map((x, j) => (j === i ? h : x)) }));
  const hangSach = f.hang.map((h) => ({ ten_hang: String(h.ten).trim() || null, loai_hang: String(h.loai).trim() || null, khoi_luong: soHoacNull(h.kl) })).filter((h) => h.ten_hang || h.loai_hang || h.khoi_luong != null);
  const tongKL = hangSach.reduce((s, h) => s + (h.khoi_luong || 0), 0);
  const noi = (ds) => [...new Set(ds.filter(Boolean))].join("; ") || null;
  const rec = () => {
    const r = {
      ten_tau: f.ten_tau.trim().toUpperCase() || "TBA", huong: f.huong,
      ten_hang: noi(hangSach.map((h) => h.ten_hang)), loai_hang: noi(hangSach.map((h) => h.loai_hang)),
      ben_ma: f.ben_ma || null, cam_ket_ghi_chu: f.cam_ket_ghi_chu.trim() || null, ghi_chu: f.ghi_chu.trim() || null,
    };
    for (const k of SO) r[k] = soHoacNull(f[k]);
    for (const k of NGAY) r[k] = fromLocalInput(f[k]);
    r.khoi_luong = hangSach.some((h) => h.khoi_luong != null) ? tongKL : null;
    if (c19) Object.assign(r, { hang_ds: hangSach, so_mang: soHoacNull(f.so_mang), uu_tien: !!f.uu_tien });
    if (c28) Object.assign(r, { ben_phu: f.ben_ma && laBenLienKe(D.berths, f.ben_ma, f.ben_phu) ? f.ben_phu : null, vi_tri: f.ben_ma ? soHoacNull(f.vi_tri) : null });
    return r;
  };
  const r0 = rec();
  const canh = kiemTraBen(r0, D.bmap[r0.ben_ma], r0.ben_phu ? D.bmap[r0.ben_phu] : null, D.berths);
  // Số mét cập bến: cùng lúc với các tàu khác ở bến này có đủ chỗ không (theo quy tắc cập cầu bến)
  const k0 = khoangBen({ ...(v || {}), ...r0 }, D.now);
  if (r0.ben_ma && k0) for (const t of kiemTraXepBen({ ...(v || {}), ...r0, id: v?.id ?? -1 }, r0.ben_ma, k0.a, k0.b, { voyages: D.voyages, berths: D.berths, stopsOf: D.stopsOf, now: D.now })) canh.push({ muc: "warn", ma: "cho", nd: nhanCho(t, r0) });
  // ETB luôn sau ETA: dựng chuyến tạm từ các ô đang nhập để tính ETB gợi ý (bến trống sớm nhất từ ETA)
  const ctxEtb = useCtxXep();
  const tam = (o) => ({ ...(v || {}), id: v?.id ?? -1, eta: fromLocalInput(o.eta), etb: fromLocalInput(o.etb), etd: fromLocalInput(o.etd), ben_ma: o.ben_ma || null, ben_phu: o.ben_phu || null,
    loa: soHoacNull(o.loa), khoi_luong: tongKL, cam_ket: soHoacNull(o.cam_ket) });
  // Chuyến mới chưa chọn bến: không tự điền ETB / ETD (để web tự xếp bến cùng ETB / ETD khi lưu)
  const xepEtb = (o) => { if (!v && !o.ben_ma) return o; const p = rangBuocEtb(tam(o), {}, ctxEtb); return p.etb ? { ...o, etb: toLocalInput(p.etb), ...(p.etd ? { etd: toLocalInput(p.etd) } : {}) } : o; };
  const goiYEtb = f.eta ? etbGoiY(tam(f), ctxEtb) : null;
  // Chuyến mới chưa có bến, ETB, ETD: web tự xếp bến phù hợp (mớn, chiều dài, DWT, loại hàng) và ETB / ETD theo nguyên tắc (xepBen.js)
  const tuXep = !v && canXepBen({ ...r0, atb: null }) ? tuXepBenGiuMoc({ ...r0, id: -1, etb: fromLocalInput(f.etb), etd: fromLocalInput(f.etd) }, ctxEtb) : null;
  const uoc = tuXep ? uocThongSo(r0) : null;
  const save = async () => {
    const r = { ...rec(), ...(tuXep ? { ben_ma: tuXep.ben_ma, etb: tuXep.etb, etd: tuXep.etd } : (() => { const p = rangBuocEtb(tam(f), {}, ctxEtb); return p.etb ? { etb: p.etb, ...(p.etd ? { etd: p.etd } : {}) } : {}; })()) };
    if ([...SO, "so_mang", "vi_tri"].some((k) => r[k] != null && !Number.isFinite(r[k])) || hangSach.some((h) => h.khoi_luong != null && !Number.isFinite(h.khoi_luong))) return toast("Có ô số không hợp lệ", "bad");
    if (r.etb && r.etd && ms(r.etd) <= ms(r.etb)) return toast("ETD phải sau ETB", "bad");
    if (v) {
      if (await run(() => api.updateVoyage(v.id, r), `Đã lưu ${r.ten_tau}`)) { ghiDanhMuc(api, D, r); onClose(); }
    } else {
      const nam = new Date(ms(r.etb || r.eta) || Date.now()).getFullYear();
      const ma = (f.ma_chuyen || "").trim().toUpperCase() || maChuyenMoi(r.ten_tau, nam, D.voyages);
      if (D.voyages.some((x) => x.ma_chuyen === ma)) return toast(`Mã chuyến ${ma} đã có`, "bad");
      const out = await run(() => api.insertVoyages([{ ...r, ma_chuyen: ma }]), tuXep ? `Đã thêm chuyến ${ma}: tự xếp bến ${tuXep.ben_ma}, ETB ${ngayGio(tuXep.etb)}` : `Đã thêm chuyến ${ma}`);
      if (out) { ghiDanhMuc(api, D, r); onClose(); onSaved?.(out[0]); }
    }
  };
  const nam = new Date(ms(fromLocalInput(f.etb) || fromLocalInput(f.eta)) || Date.now()).getFullYear();
  // Vị trí mét trên tuyến bến: gõ mét đầu tàu thì web tự chọn bến chính / bến phụ theo phần tàu chiếm (cần LOA)
  const tuyen = f.ben_ma ? tuyenCuaBen(D.berths, f.ben_ma) : null;
  const datViTri = (val) => setF((o) => {
    const x = soHoacNull(val), L = soHoacNull(o.loa), b = x != null && L > 0 ? benTheoViTri(D.berths, o.ben_ma, x, L) : null;
    return { ...o, vi_tri: val, ...(b ? { ben_ma: b.ben_ma, ben_phu: b.ben_phu || "" } : {}) };
  });
  const xVT = soHoacNull(f.vi_tri), lVT = soHoacNull(f.loa);
  const viTriGoiY = !tuyen ? null : xVT == null ? `Tuyến ${tenTuyen(tuyen, tenBen)}: mét ${so(tuyen.tu)}–${so(tuyen.den)}`
    : !(lVT > 0) ? "Nhập LOA để biết tàu chiếm bến nào"
    : benTheoViTri(D.berths, f.ben_ma, xVT, lVT) ? `Tàu nằm mét ${so(xVT)}–${so(xVT + lVT)}` : `Mét ${so(xVT)}–${so(xVT + lVT)} ra ngoài tuyến hoặc chiếm hơn hai bến (tuyến ${so(tuyen.tu)}–${so(tuyen.den)})`;

  return (
    <Dialog onOpenChange={(o) => !o && onClose()} className="max-w-3xl" title={v ? `Sửa thông tin chuyến ${v.ma_chuyen}` : "Thêm chuyến tàu"}
      description="Tàu & lịch cập (nhân viên cầu bến). Bãi, cẩu, băng tải, phương tiện khai ở phiếu chuyến › Bãi & Thiết bị; mốc giờ thực tế ở phiếu chuyến › Mốc giờ."
      footer={<><Button variant="outline" onClick={onClose}>Hủy</Button><Button onClick={save}><Save />Lưu</Button></>}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Tên tàu (TBA nếu chưa biết)" className="col-span-2"><ChonGo value={f.ten_tau} onChange={chonTau} options={D.vessels.map((x) => x.ten)} placeholder="Gõ hoặc chọn tàu" /></Field>
        {v ? <Field label="Mã chuyến" className="col-span-2"><Input value={v.ma_chuyen} disabled /></Field>
          : <Field label="Mã chuyến (để trống: tự sinh)" className="col-span-2"><Input value={f.ma_chuyen} onChange={set("ma_chuyen")} placeholder={maChuyenMoi(f.ten_tau || "TBA", nam, D.voyages)} /></Field>}
        <Field label="Hướng"><NativeSelect value={f.huong} onChange={set("huong")} options={[["nhap", "Nhập"], ["xuat", "Xuất"]]} /></Field>
        <Field label="Bến"><ChonGo tuDo={false} value={f.ben_ma} onChange={(x) => setF((o) => ({ ...o, ben_ma: x, ben_phu: laBenLienKe(D.berths, x, o.ben_phu) ? o.ben_phu : "", vi_tri: tuyenCuaBen(D.berths, x)?.ma === tuyenCuaBen(D.berths, o.ben_ma)?.ma ? o.vi_tri : "" }))} placeholder="Chưa xếp"
          options={[["", "Chưa xếp"], ...D.berths.map((b) => [b.ma, `${tenBen(b.ma)}${b.ma !== tenBen(b.ma) ? ` (${b.ma})` : ""}`, (b.ten_khac || []).filter((x) => x !== tenBen(b.ma)).slice(0, 3).join(", ")])]} /></Field>
        {c28 && <Field label="Bến phụ (tàu cập hai bến)">
          <NativeSelect value={f.ben_phu} disabled={!f.ben_ma} onChange={set("ben_phu")} options={[["", "Không (một bến)"], ...benLienKe(D.berths, f.ben_ma).map((b) => [b.ma, `${tenBen(b.ma)} → ${noiHaiBen(f.ben_ma, b.ma)}`])]} /></Field>}
        {c28 && <Field label="Vị trí (mét đầu tàu, trống = tự xếp)" hint={viTriGoiY}>
          <Input className="num" inputMode="decimal" value={f.vi_tri} disabled={!f.ben_ma} onChange={(e) => datViTri(e.target.value)} placeholder="VD 230" /></Field>}

        <div className="col-span-2 grid gap-1.5 sm:col-span-4">
          <div className="grid grid-cols-[minmax(0,1fr)_150px_110px_28px] gap-2 text-xs font-medium text-muted-foreground"><span>Tên hàng</span><span>Loại hàng (nhóm hàng)</span><span className="text-right">Khối lượng (t)</span><span /></div>
          {f.hang.map((h, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_150px_110px_28px] items-center gap-2">
              <ChonGo value={h.ten} onChange={(ten) => setHang(i, { ...h, ten, ...(nhomCua(ten) ? { loai: nhomCua(ten) } : {}) })} options={dsTenHang} placeholder="Gõ để gợi ý hàng trong danh mục / chuyến cũ" />
              <ChonGo value={h.loai} onChange={(loai) => setHang(i, { ...h, loai })} options={dsNhom} placeholder="Quặng, Than…" />
              <Input className="num" inputMode="decimal" value={h.kl} onChange={(e) => setHang(i, { ...h, kl: e.target.value })} aria-label="Khối lượng" />
              <button type="button" disabled={f.hang.length < 2} className="rounded p-1 text-muted-foreground hover:text-bad disabled:opacity-30" onClick={() => setF((o) => ({ ...o, hang: o.hang.filter((_, j) => j !== i) }))} aria-label="Bỏ dòng hàng"><X className="h-4 w-4" /></button>
            </div>))}
          <div className="flex flex-wrap items-center gap-2">
            {c19 && <Button size="sm" variant="outline" onClick={() => setF((o) => ({ ...o, hang: [...o.hang, { ten: "", loai: "", kl: "" }] }))}><Plus />Thêm tên hàng, loại hàng, khối lượng</Button>}
            {f.hang.length > 1 && <span className="text-xs text-muted-foreground">Tổng khối lượng <b className="text-foreground">{so(tongKL)} t</b></span>}
          </div>
        </div>

        <Field label="Cam kết xếp dỡ (t/ngày)"><Input className="num" inputMode="decimal" value={f.cam_ket} onChange={set("cam_ket")} /></Field>
        {c19 && <Field label="Số máng"><Input className="num" inputMode="numeric" value={f.so_mang} onChange={set("so_mang")} /></Field>}
        <Field label="DWT"><Input className="num" inputMode="decimal" value={f.dwt} onChange={set("dwt")} /></Field>
        <Field label="Mớn / DRAFT (m)"><Input className="num" inputMode="decimal" value={f.draft} onChange={set("draft")} /></Field>
        <Field label="LOA (m)"><Input className="num" inputMode="decimal" value={f.loa} onChange={set("loa")} /></Field>
        <Field label="ETA báo về" className="min-w-0"><NgayGio value={f.eta} onChange={(x) => setF((o) => xepEtb({ ...o, eta: x }))} /></Field>
        <Field label="Dự kiến cập (ETB)" className="min-w-0" hint={goiYEtb != null ? `Luôn sau ETA. Gợi ý: ${toLocalInput(goiYEtb).replace("T", " ")}` : "Luôn sau ETA"}><NgayGio value={f.etb} onChange={(x) => setF((o) => xepEtb({ ...o, etb: x }))} /></Field>
        <Field label="Dự kiến rời (ETD)" className="min-w-0"><NgayGio value={f.etd} onChange={(x) => setF((o) => ({ ...o, etd: x }))} /></Field>
        {c19 ? <label className="flex items-end gap-2 pb-2 text-sm"><Checkbox checked={f.uu_tien} onChange={set("uu_tien")} />Tàu ưu tiên vào sớm</label> : <div />}
        <Field label="Ghi chú" className="col-span-2 sm:col-span-4"><Textarea rows={2} className="min-h-0" value={f.ghi_chu} onChange={set("ghi_chu")} /></Field>
        {!c19 && <div className="col-span-2 text-xs text-muted-foreground sm:col-span-4">Nhiều loại hàng, số máng, tàu ưu tiên: cần chạy SQL 19 trong Supabase.</div>}
      </div>
      {!v && !f.ben_ma && (
        <div className="mt-3 rounded-md border border-info/40 bg-info/5 p-2.5 text-sm">
          {tuXep ? <>Chưa chọn bến: khi lưu web <b>tự xếp bến {tuXep.ben_ma}</b>, ETB <b>{ngayGio(tuXep.etb)}</b>, ETD <b>{ngayGio(tuXep.etd)}</b>.
            <div className="mt-0.5 text-xs text-muted-foreground">{tuXep.ly}.{uoc?.uoc.size ? ` Thông số ước tính: ${[uoc.uoc.has("dwt") && `DWT ≈ ${so(uoc.dwt)}`, uoc.uoc.has("loa") && `LOA ≈ ${so(uoc.loa)} m`, uoc.uoc.has("draft") && `mớn ≈ ${so(uoc.draft, 1)} m`, uoc.uoc.has("khoi_luong") && `khối lượng ≈ ${so(uoc.khoi_luong)} t`].filter(Boolean).join(", ")}.` : ""} ETB sau ETA và sau tàu trước rời 2 giờ (đã nhập ETB / ETD thì giữ nếu bến trống đúng giờ đó); ETD = ETB + 1 giờ + làm hàng + 2 giờ thủ tục + 30 phút.</div></>
            : <>Chưa chọn bến: nhập ETA và khối lượng hoặc DWT / LOA / mớn để web tự xếp bến. Không bến nào hợp thì chuyến lưu ở "chưa xếp bến".</>}
        </div>)}
      {canh.length > 0 && <div className="mt-3 grid gap-1.5 rounded-md border border-warn/40 bg-warn/5 p-2.5 text-sm">{canh.map((c, i) => <div key={i} className="flex gap-2"><MucIcon muc={c.muc} className="mt-0.5" />{c.nd}</div>)}</div>}
    </Dialog>
  );
}
