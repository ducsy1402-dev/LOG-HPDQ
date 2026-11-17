import { useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Eraser, ExternalLink, Pencil, Plus, Rows4, Trash2 } from "lucide-react";
import { useApp } from "../../store";
import { useApp as useLogistics } from "@/store";
import { cn } from "@/lib/utils";
import { plain } from "@/lib/format";
import { trangThai, TRANG_THAI, TRANG_THAI_HIEN, doanBen } from "@/lib/linetime";
import { xepHangBen } from "@/pages/cang/Gantt";
import { tenBen } from "@/pages/cang/BangTauBen";
import { dongSoXeTau, dongSoXeBai, DAU_SO_XE_TAU, DAU_SO_XE_BAI } from "@/lib/tauDaiHan";
import { MultiSelect, Select } from "../../components/ui";
import { fmtD, fmtDT, BAI_COLOR, doiCuaViec } from "../../lib/plan";
import { pad } from "../../lib/utils";

// Timeline theo ca (Kế hoạch dài hạn › Linetime năng lực đáp ứng), vẽ GIỐNG Kế hoạch sản lượng theo ngày (Mục tiêu sản lượng › Kế hoạch ngày), anh Sỹ chốt 15/11/2026:
//   • CẢNG: mỗi bến một dòng như Linetime › Lịch cầu bến, thanh tàu đặt theo GIỜ thật, màu theo trạng thái tàu. Thanh hai dòng: tên tàu, % khối lượng còn lại, nút "+bãi"
//     (thêm tàu vào việc bãi: chỉ lấy "tên tàu - loại hàng - khối lượng" và mốc thời gian, không lấy số xe) và ô SỐ XE của tàu (nhập tay, không lấy từ phiếu chuyến / phương án).
//   • BÃI: mỗi việc bãi một dòng, CÙNG cách nhập số xe như cảng: ô SỐ XE trên thanh (cả ngày lẫn đêm) và ô số xe từng ca; nút "Thêm việc bãi" bên dưới.
//   • Số xe từng ca TỰ CHẠY theo số xe của việc (và hệ số ca với tàu), hoặc SỬA TAY ca đó (xóa số / gõ lại đúng số tự tính thì ca chạy tự động lại).
//   • Cột tiêu đề của việc cảng / bãi nhập tay có biểu tượng Sửa / Xóa; việc lấy từ Linetime có biểu tượng mở phiếu chuyến và "xóa số đã nhập".
//   • Khối dòng tổng (tổng cầu, xe có, cân bằng cảng / bãi, kết luận) cố định ở đáy khung, tô màu theo nhóm, có nút ẩn cả khối. Lọc loại hàng chỉ lọc tàu / việc đang hiện, các dòng cộng luôn tính đủ.
const DAY = 864e5;
const MAU_CANG = "#0ea5e9", MAU_BAI = "#f59e0b", MAU_CHUNG = "#8b5cf6";
const hhmm = (t) => (t ? fmtDT(new Date(t)) : "");
const doc = (k, mac) => { try { return localStorage.getItem(k) ?? mac; } catch { return mac; } };
const luu = (k, v) => { try { localStorage.setItem(k, v); } catch { /* bỏ qua */ } };
const p2 = (n) => String(n).padStart(2, "0");
const ngayStr = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const ld = (x) => { if (!x) return null; const [y, m, d] = String(x).slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d); };
// Ca s có nằm trong khoảng thời gian của việc bãi f không (việc từ Linetime: theo giờ chính xác; việc nhập tay: theo ngày)
const trongCa = (f, s) => {
  const tu = f.job.tu ? new Date(f.job.tu).getTime() : null, den = f.job.den ? new Date(f.job.den).getTime() : null;
  if (tu != null || den != null) return !((tu != null && +s.en <= tu) || (den != null && +s.st >= den));
  const from = ld(f.from), to = ld(f.to);
  return !((from && s.day < from) || (to && s.day > to));
};
const RE_COT = /\b(tu|den)\b|schema cache|column/i; // lỗi do CSDL chưa có cột tu / den (SQL 15)
const IN_O = "h-full w-full min-w-0 bg-transparent px-1 text-right font-semibold tabular-nums text-white focus:bg-black/40 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none";

export default function TimelineCa({ R, doi, onJob }) {
  const { api, run, canWrite, isAdmin, D, toast } = useApp();
  const LD = useLogistics()?.D;
  const { shifts, ves, fixed, capCang, capBai } = R;
  const nCa = shifts.length;
  const caMs = nCa ? shifts[0].en.getTime() - shifts[0].st.getTime() : 1;
  const perDay = Math.max(1, Math.round(DAY / caMs)), tongNgay = Math.max(1, Math.ceil(nCa / perDay));

  // Bộ lọc loại hàng (chọn nhiều), số ngày hiển thị, thu gọn Cảng / Bãi / khối tổng (nhớ trên máy)
  const [hangF, setHangF] = useState([]);
  // Xem gọn (như Linetime › Gọn): dòng thấp, chữ nhỏ, cột hẹp để xem được nhiều tàu một lúc; nhớ trên máy
  const [gon, setGon] = useState(() => doc("qltb-tl-gon", "0") === "1");
  const LABEL = gon ? 138 : 168, LH = gon ? 36 : 50, TOP = gon ? 17 : 22;
  const [soNgay, setSoNgay] = useState(() => (["7", "14", "21", "99"].includes(doc("qltb-tl-ngay", "99")) ? +doc("qltb-tl-ngay", "99") : 99));
  const [batRaw, setBat] = useState(0);
  const [thu, setThu] = useState(() => ({ cang: doc("qltb-tl-thu-cang", "0") === "1", bai: doc("qltb-tl-thu-bai", "0") === "1", tong: doc("qltb-tl-thu-tong", "0") === "1" }));
  const doiThu = (k) => setThu((o) => { luu("qltb-tl-thu-" + k, o[k] ? "0" : "1"); return { ...o, [k]: !o[k] }; });
  const size = Math.min(soNgay, tongNgay), bat = Math.max(0, Math.min(batRaw, tongNgay - size));
  const i0 = bat * perDay, ca = shifts.slice(i0, i0 + size * perDay), nHien = ca.length;
  const CWC = (size <= 7 ? 72 : size <= 14 ? 54 : 46) - (gon ? 8 : 0);
  const tuMs = nHien ? ca[0].st.getTime() : 0, denMs = tuMs + nHien * caMs, W = nHien * CWC;
  const xOf = (t) => ((t - tuMs) / caMs) * CWC;
  const coHang = (h) => !hangF.length || hangF.some((x) => plain(x) === plain(h));
  const dsHang = useMemo(() => [...new Set([...ves.map((r) => r.hang), ...fixed.map((f) => f.hang)].map((x) => String(x || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "vi")), [ves, fixed]);

  // Tàu của Linetime (có mã chuyến) và việc cảng nhập tay (không có mã chuyến); lọc theo loại hàng
  const tauLT = useMemo(() => new Map(ves.filter((r) => r.job.lt != null && coHang(r.hang)).map((r) => [String(r.job.lt), r])), [ves, hangF]); // eslint-disable-line react-hooks/exhaustive-deps
  const cangTay = ves.filter((r) => r.job.lt == null && coHang(r.hang));
  const hang = useMemo(() => (LD?.berths && nHien ? xepHangBen(LD, (LD.voyages || []).filter((v) => tauLT.has(String(v.id))), tuMs, denMs, "ben", { row: 30, lan: LH, top: gon ? 3 : 4 }).filter((r) => r.ds.length) : []), [LD, tauLT, tuMs, denMs, nHien, LH, gon]);
  const baiHien = fixed.filter((f) => (!f.job.lt || f.cnt.some((c) => c > 0) || dongSoXeBai(D.plan.jobs, f.job.lt, doi)) && coHang(f.hang));
  const nTau = tauLT.size + cangTay.length;

  // ---- Lưu số xe: 4 loại dòng dùng chung một cách nhập ----
  //  "tauLT": tàu Linetime (dòng "xe_lt:") · "cangTay": việc cảng nhập tay · "baiLT": việc bãi từ Linetime (dòng "xe_bai_lt:") · "baiTay": việc bãi nhập tay
  const dongGhi = (it) => (it.kind === "tauLT" ? dongSoXeTau(D.plan.jobs, it.job.lt, doi) : it.kind === "baiLT" ? dongSoXeBai(D.plan.jobs, it.job.lt, doi) : null);
  const caHienCo = (it) => (dongGhi(it)?.so_xe_doi || it.job.so_xe_doi || {}).ca || {};
  const ghi = (it, patch, msg) => {
    if (it.kind === "tauLT" || it.kind === "baiLT") {
      const ov = dongGhi(it), tau = it.kind === "tauLT";
      return run(() => (ov ? api.updatePlanJob(ov.id, patch) : api.insertPlanJob({ loai: tau ? "tau" : "bai", ten: it.ten, hang: "", vi_tri: "", doi, so_xe_tay: null, so_xe_doi: null, ...(tau ? {} : { xe_ngay: 0, xe_dem: 0 }), ghi_chu: (tau ? DAU_SO_XE_TAU : DAU_SO_XE_BAI) + it.job.lt, ...patch })), msg);
    }
    return run(() => api.updatePlanJob(it.job.id, patch), msg);
  };
  const soNen = (it) => (it.kind === "tauLT" || it.kind === "cangTay" ? it.dung ?? null : it.n === it.d ? it.n : null); // số xe cả việc (bãi: nếu CA1 / CA2 khác nhau thì để trống)
  const luuNen = (it, txt) => {
    const t = String(txt).trim(), n = t === "" ? null : Math.max(0, Math.round(+t));
    if (t !== "" && !Number.isFinite(n)) return;
    if (n === soNen(it)) return;
    if (it.kind === "baiTay") return ghi(it, { xe_ngay: n ?? 0, xe_dem: n ?? 0 }, `Đã lưu số xe ${it.ten}: ${n ?? 0}`);
    if (n === null && (it.kind === "tauLT" || it.kind === "baiLT") && dongGhi(it)?.so_xe_tay == null) return;
    return ghi(it, { so_xe_tay: n }, n === null ? `Đã bỏ số xe nhập tay của ${it.ten}` : `Đã lưu số xe ${it.ten}: ${n}`);
  };
  // Sửa tay số xe của MỘT ca. Gõ đúng số tự tính hoặc xóa trống = ca đó chạy tự động lại
  const luuCa = (it, g, txt) => {
    const t = String(txt).trim(), n = t === "" ? null : Math.max(0, Math.round(+t)), key = shifts[g].st.toISOString(), auto = it.cntAuto?.[g] ?? 0;
    if (t !== "" && !Number.isFinite(n)) return;
    const cu = caHienCo(it), moi = { ...cu };
    if (n === null || n === auto) delete moi[key]; else moi[key] = n;
    if (JSON.stringify(moi) === JSON.stringify(cu)) return;
    return ghi(it, { so_xe_doi: Object.keys(moi).length ? { ca: moi } : null }, n === null || n === auto ? `Ca ${fmtD(shifts[g].st)} ${shifts[g].lab}: ${it.ten} chạy tự động` : `Đã sửa tay ca ${fmtD(shifts[g].st)} ${shifts[g].lab}: ${it.ten} ${n} xe`);
  };
  const xoaSoDaNhap = (it) => { const ov = dongGhi(it); if (ov) run(() => api.updatePlanJob(ov.id, { so_xe_tay: null, so_xe_doi: null }), `Đã xóa số xe nhập tay của ${it.ten}`); };
  const xoaViec = (it) => { if (window.confirm(`Xóa hẳn việc "${it.ten}"?`)) run(() => api.deletePlanJob(it.job.id), `Đã xóa ${it.ten}`); };
  // Thêm tàu vào việc bãi: chỉ lấy "tên tàu - loại hàng - khối lượng" và mốc thời gian (không lấy số xe); sau đó nhập số xe ngay trên thanh việc bãi
  const themBai = (r) => {
    const klTxt = r.kl ? ` - ${Number(r.kl).toLocaleString("vi-VN", { maximumFractionDigits: 0 })} t` : "";
    const ten = `${r.ten}${r.hang ? " - " + r.hang : ""}${klTxt}`;
    if (D.plan.jobs.some((j) => j.loai === "bai" && j.ten === ten && doiCuaViec(j) === doi)) return toast(`Đã có việc bãi "${ten}"`, "warn");
    // Mốc thời gian = đúng thanh tàu ở bến trên Linetime (cập → rời, gộp các đoạn nếu tàu chuyển bến), không dùng giờ làm hàng tính theo năng suất
    const v = (LD?.voyages || []).find((x) => String(x.id) === String(r.job.lt));
    const doan = v ? doanBen(v, LD.stopsOf?.(v.id) || [], LD.now) : [];
    const a = doan.length ? Math.min(...doan.map((d) => d.a)) : r.bd?.getTime() ?? null, b = doan.length ? Math.max(...doan.map((d) => d.b)) : r.kt?.getTime() ?? null;
    if (a == null) return toast(`Tàu ${r.ten} chưa có mốc thời gian ở bến`, "warn");
    const base = { loai: "bai", ten, hang: r.hang || "", vi_tri: "", tu_ngay: ngayStr(new Date(a)), den_ngay: b != null ? ngayStr(new Date(b)) : null, xe_ngay: 0, xe_dem: 0, doi, khoi_luong: r.kl ?? null, con_lai: null };
    const full = { ...base, tu: new Date(a).toISOString(), den: b != null ? new Date(b).toISOString() : null };
    // Chưa chạy SQL 15 (chưa có cột tu / den): ghi theo ngày
    run(async () => {
      try { await api.insertPlanJob(full); }
      catch (e) { if (!RE_COT.test(String(e?.message || e))) throw e; await api.insertPlanJob(base); toast("CSDL chưa có cột giờ của việc bãi (SQL 15): đã lưu theo ngày", "warn"); }
    }, `Đã thêm việc bãi: ${ten} (${hhmm(a)} → ${hhmm(b)}). Nhập số xe ngay trên thanh việc bãi`);
  };

  const ngay = []; // nhóm ca theo ngày cho hàng tiêu đề
  ca.forEach((s) => { const d = fmtD(s.st), l = ngay[ngay.length - 1]; if (l && l.d === d) l.n++; else ngay.push({ d, n: 1, cn: s.st.getDay() === 0 }); });
  const luoi = ca.map((s, i) => <div key={i} className={cn("absolute inset-y-0 border-l", s.lab === "N" ? "border-border" : "border-border/40", s.now && "bg-primary/10", !s.now && s.st.getDay() === 0 && "bg-muted/50")} style={{ left: i * CWC, width: CWC }} />);

  // Một thanh: a..b (ms) đặt theo giờ thật; cnt[g] = số xe của ca g trong ô; tren = phần chữ hàng trên; oCa(i, g, v) vẽ ô số xe của ca nếu là ô nhập
  const thanh = ({ kk, a, b, mau, top, h, cnt, tren, title, oCa }) => {
    if (b <= tuMs || a >= denMs) return null;
    const left = Math.max(0, xOf(a)), right = Math.min(W, xOf(b)), w = Math.max(10, right - left);
    return (
      <div key={kk} className="absolute overflow-hidden rounded-md text-white shadow-sm" style={{ left: left + 1, width: w - 2, top, height: h, background: mau }} title={title}>
        <div className="flex items-center gap-1 px-1.5 text-[0.6875rem] font-semibold leading-none" style={{ height: TOP }}>{typeof tren === "function" ? tren(w) : tren}</div>
        {ca.map((s, i) => {
          const cL = Math.max(left, i * CWC), cR = Math.min(right, (i + 1) * CWC);
          if (cR - cL < 0.5) return null;
          const g = i0 + i, v = cnt?.[g];
          return <div key={i} className="absolute flex items-center justify-end border-l border-white/15 bg-black/20 tabular-nums" style={{ left: cL - left - 1, width: cR - cL, top: TOP, height: h - TOP }}>{oCa ? oCa(i, g, v) : <span className={cn("px-1", v ? "font-semibold" : "opacity-40")}>{v || ""}</span>}</div>;
        })}
      </div>
    );
  };
  // Ô số xe của cả việc (trên thanh) và ô số xe từng ca (dưới thanh): dùng chung cho tàu và việc bãi
  const oNen = (it, tay, ph = "xe") => canWrite
    ? <input key={it.id + ":" + (soNen(it) ?? "")} type="number" min="0" inputMode="numeric" defaultValue={soNen(it) ?? ""} placeholder={ph} aria-label={`Số xe ${it.ten}`} title="Số xe của việc (nhập tay); các ca tự chạy theo số này"
        onClick={(e) => e.stopPropagation()} onFocus={(e) => e.target.select()} onBlur={(e) => luuNen(it, e.target.value)} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className={cn(gon ? "h-[14px] w-9 text-[0.625rem]" : "h-[18px] w-10", "rounded border bg-black/30 px-1 text-center font-semibold tabular-nums text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/70 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none", "border-white/30")} />
    : <b className="rounded bg-black/25 px-1 py-0.5 tabular-nums">{soNen(it) ?? "–"} xe</b>;
  const oCaFn = (it) => (canWrite ? (i, g, v) => {
    const daSua = caHienCo(it)[shifts[g].st.toISOString()] != null;
    return <input key={`${it.id}:${g}:${v}`} type="number" min="0" inputMode="numeric" defaultValue={v || ""} aria-label={`${it.ten} ca ${fmtD(shifts[g].st)} ${shifts[g].lab}`} title={daSua ? "Ca sửa tay (xóa số để chạy tự động lại)" : "Số xe tự chạy; gõ số khác để sửa tay ca này"}
      onClick={(e) => e.stopPropagation()} onFocus={(e) => e.target.select()} onBlur={(e) => luuCa(it, g, e.target.value)} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      className={IN_O} />;
  } : undefined);

  // Biểu tượng ở cột tiêu đề của một việc: Sửa / Xóa (việc nhập tay), mở phiếu chuyến / xóa số đã nhập (việc từ Linetime)
  const nutTD = (it) => {
    const manual = it.kind === "cangTay" || it.kind === "baiTay";
    const ov = !manual ? dongGhi(it) : null, coSoNhap = !!ov && (ov.so_xe_tay != null || ov.so_xe_doi?.ca);
    const B = "rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground";
    return (
      <span className="ml-auto flex shrink-0 items-center">
        {manual && canWrite && <button type="button" className={B} title="Sửa nội dung việc" aria-label={`Sửa ${it.ten}`} onClick={() => onJob({ loai: it.kind === "cangTay" ? "tau" : "bai", job: it.job })}><Pencil className="h-3.5 w-3.5" /></button>}
        {manual && isAdmin && <button type="button" className={cn(B, "hover:text-bad")} title="Xóa việc" aria-label={`Xóa ${it.ten}`} onClick={() => xoaViec(it)}><Trash2 className="h-3.5 w-3.5" /></button>}
        {!manual && <button type="button" className={B} title="Mở phiếu chuyến (sửa ở Linetime)" aria-label={`Phiếu chuyến ${it.ten}`} onClick={() => onJob({ phieu: it.job.lt })}><ExternalLink className="h-3.5 w-3.5" /></button>}
        {!manual && canWrite && coSoNhap && <button type="button" className={cn(B, "hover:text-bad")} title="Xóa số xe đã nhập tay (trả về như ban đầu)" aria-label={`Xóa số đã nhập ${it.ten}`} onClick={() => xoaSoDaNhap(it)}><Eraser className="h-3.5 w-3.5" /></button>}
      </span>
    );
  };

  // Dòng tổng: nhãn tô màu theo nhóm (cảng xanh dương, bãi cam, kết luận tím); dau = dòng đầu nhóm (kẻ đậm ngăn nhóm)
  const dongCong = (nhan, fn, mau, { cls = () => "", dau = false, dam = false } = {}) => (
    <div className={cn("flex border-b", dau && "border-t-2")}>
      <div className={cn("sticky left-0 z-10 flex shrink-0 items-center border-r bg-card px-2 py-0.5", dam ? "font-bold" : "font-semibold")} style={{ width: LABEL, borderLeft: `4px solid ${mau}`, backgroundImage: `linear-gradient(${mau}26, ${mau}26)` }}>{nhan}</div>
      {ca.map((s, i) => <div key={i} className={cn("shrink-0 border-l px-1 py-0.5 text-right tabular-nums", s.now && "bg-primary/10", dam && "font-bold", cls(s))} style={{ width: CWC }}>{fn(s)}</div>)}
    </div>
  );
  const phan = (t, k, dem) => (
    <button type="button" onClick={() => doiThu(k)} aria-expanded={!thu[k]} title={thu[k] ? "Mở rộng" : "Thu gọn"} className="sticky left-0 z-10 flex items-center gap-1 border-b bg-muted px-2 py-1 text-left text-[0.6875rem] font-semibold tracking-wide text-primary hover:bg-accent" style={{ width: LABEL + W }}>
      {thu[k] ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}{t}<span className="ml-2 font-normal text-muted-foreground">{dem}</span>
    </button>
  );
  const veHomNay = () => { const i = shifts.findIndex((s) => s.now); if (i >= 0) setBat(Math.max(0, Math.floor(i / perDay) - 1)); };
  const am = (b) => cn(b < 0 ? "bg-bad/15 text-bad" : "text-ok");

  if (!LD?.berths) return <div className="rounded-md border border-warn/40 bg-warn/5 px-3 py-2 text-sm">Timeline lấy tàu từ Linetime: tài khoản cần quyền Khai thác Cảng.</div>;

  return (
    <div className="grid gap-2">
      <div className="row" style={{ gap: 8 }}>
        <MultiSelect prefix="Loại hàng" value={hangF} onChange={setHangF} options={dsHang} className="sm" style={{ width: 150 }} />
        <button type="button" className={"btn sm" + (gon ? " on-pin" : "")} aria-pressed={gon} title="Dòng thấp, chữ nhỏ: xem được nhiều tàu hơn" onClick={() => { setGon(!gon); luu("qltb-tl-gon", gon ? "0" : "1"); }}><Rows4 size={14} />Gọn</button>
        <Select className="inp sm" value={String(soNgay)} onChange={(v) => { setSoNgay(+v); luu("qltb-tl-ngay", v); }} options={[["7", "7 ngày"], ["14", "14 ngày"], ["21", "21 ngày"], ["99", `Cả lưới (${tongNgay} ngày)`]]} style={{ width: 150 }} aria-label="Số ngày hiển thị" />
        {size < tongNgay && (
          <span className="row" style={{ gap: 4 }}>
            <button type="button" className="btn sm icon" onClick={() => setBat(Math.max(0, bat - size))} disabled={bat === 0} aria-label="Các ngày trước"><ChevronLeft size={14} /></button>
            <span className="small mute" style={{ minWidth: 92, textAlign: "center" }}>{fmtD(ca[0].st)} – {fmtD(ca[nHien - 1].st)}</span>
            <button type="button" className="btn sm icon" onClick={() => setBat(Math.min(tongNgay - size, bat + size))} disabled={bat + size >= tongNgay} aria-label="Các ngày sau"><ChevronRight size={14} /></button>
            {shifts.some((s) => s.now) && <button type="button" className="btn sm ghost" onClick={veHomNay}>Hôm nay</button>}
          </span>
        )}
        <span className="small mute" style={{ marginLeft: "auto" }}>{nTau} tàu · {baiHien.length} việc bãi{hangF.length ? " (đang lọc loại hàng; các dòng cộng vẫn tính đủ)" : ""}</span>
      </div>

      <div className="khong-ttb grid gap-2">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.6875rem] text-muted-foreground">
          {TRANG_THAI_HIEN.map(([k, t]) => <span key={k} className="flex items-center gap-1"><i className="inline-block h-2.5 w-4 rounded-sm" style={{ background: t.mau }} />{t.ten}</span>)}
          <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-4 rounded-sm" style={{ background: BAI_COLOR }} />việc bãi</span>
        </div>
        <div className="scroll-x max-h-[74vh] rounded-md border">
          <div style={{ width: LABEL + W }} className={cn("relative select-none", gon ? "text-[0.6875rem]" : "text-xs")}>
            {/* Tiêu đề ngày / ca */}
            <div className="sticky top-0 z-20 border-b bg-card">
              <div className="flex">
                <div className="sticky left-0 z-30 flex shrink-0 items-end border-r bg-card px-2 pb-1 font-semibold text-muted-foreground" style={{ width: LABEL }} />
                {ngay.map((g, i) => <div key={i} className={cn("shrink-0 border-l py-0.5 text-center font-semibold tabular-nums", g.cn && "text-bad")} style={{ width: g.n * CWC }}>{g.d}</div>)}
              </div>
              <div className="flex">
                <div className="sticky left-0 z-30 flex shrink-0 items-center border-r bg-card px-2 font-semibold text-muted-foreground" style={{ width: LABEL }}>Ca</div>
                {ca.map((s, i) => <div key={i} className={cn("shrink-0 border-l py-0.5 text-center text-[0.6875rem] tabular-nums", s.now ? "bg-primary/20 font-semibold text-primary" : "text-muted-foreground")} style={{ width: CWC }}>{s.lab} {pad(s.st.getHours())}h</div>)}
              </div>
            </div>

            {phan(`CẢNG · tàu theo bến · số xe ${doi}`, "cang", `${nTau} tàu`)}
            {!thu.cang && <>
              {hang.map((r) => (
                <div key={r.ma || "_"} className="flex border-b">
                  <div className="sticky left-0 z-10 flex shrink-0 flex-col justify-center border-r bg-card px-2" style={{ width: LABEL }}>
                    <span className="font-mono text-[0.8125rem] font-semibold leading-tight">{r.b ? tenBen(r.ma) : "Chưa xếp bến"}</span>
                    <span className="text-[0.6875rem] text-muted-foreground">{new Set(r.ds.map((x) => x.v.id)).size} tàu</span>
                  </div>
                  <div className="relative shrink-0" style={{ width: W, height: r.h }}>
                    {luoi}
                    {r.ds.map((x) => {
                      const rr = tauLT.get(String(x.v.id)); if (!rr) return null;
                      const it = { ...rr, kind: "tauLT" }, ov = dongSoXeTau(D.plan.jobs, x.v.id, doi), tay = ov?.so_xe_tay != null;
                      const pc = rr.kl > 0 ? Math.max(0, Math.min(100, Math.round(((rr.conlai ?? rr.kl) / rr.kl) * 100))) : null;
                      return thanh({
                        kk: `${x.v.id}:${x.a}`, a: x.a, b: x.b, mau: TRANG_THAI[x.st].mau, top: x.top, h: LH - 6, cnt: rr.cnt,
                        title: `${x.v.ten_tau} · ${x.v.huong === "xuat" ? "Xuất" : "Nhập"} · ${TRANG_THAI[x.st].ten}\nBến ${x.v.ben_ma ? tenBen(x.v.ben_ma) : "chưa xếp"} · ${hhmm(x.a)} → ${hhmm(x.b)}\nKhối lượng còn lại ${pc == null ? "?" : pc + "%"} · số xe ${rr.dung ?? "chưa nhập"}`,
                        // Thanh ngắn: ưu tiên +bãi và ô số xe (luôn hiện), rồi đến "còn %", rồi nhãn Nhập / Xuất; tên tàu co lại tới hết chỗ
                        tren: (w) => <>
                          <span className="min-w-0 flex-1 truncate">{x.v.uu_tien ? "★ " : ""}{x.v.ten_tau}</span>
                          {w >= 270 && <span className="shrink-0 rounded bg-black/25 px-1 py-0.5 font-normal">{x.v.huong === "xuat" ? "Xuất" : "Nhập"}</span>}
                          {pc != null && w >= 200 && <span className="shrink-0 rounded bg-black/25 px-1 py-0.5 font-normal tabular-nums" title="Phần trăm khối lượng còn lại">còn {pc}%</span>}
                          <span className="flex shrink-0 items-center gap-1">
                            {canWrite && <button type="button" onClick={(e) => { e.stopPropagation(); themBai(rr); }} className="rounded bg-black/30 px-1 py-0.5 text-[0.625rem] font-normal hover:bg-black/50" title="Thêm vào việc bãi: lấy tên tàu - loại hàng - khối lượng và mốc thời gian, không lấy số xe">+bãi</button>}
                            {oNen(it, tay)}
                          </span>
                        </>,
                        oCa: oCaFn(it),
                      });
                    })}
                  </div>
                </div>
              ))}
              {!hang.length && <div className="border-b px-2 py-3 text-muted-foreground">{hangF.length ? "Không có tàu nào ứng với loại hàng đã chọn" : `Đội ${doi} chưa có tàu nào trong lưới`} ({size} ngày đang xem).</div>}

              {cangTay.map((r) => {
                const it = { ...r, kind: "cangTay" };
                return (
                  <div key={r.id} className="flex border-b">
                    <div className="sticky left-0 z-10 flex shrink-0 items-center gap-1 border-r bg-card px-2" style={{ width: LABEL }}>
                      <span className="flex min-w-0 flex-col"><span className="truncate font-semibold">{r.ten}</span><span className="text-[0.6875rem] text-muted-foreground">việc cảng nhập tay</span></span>{nutTD(it)}
                    </div>
                    <div className="relative shrink-0" style={{ width: W, height: LH }}>
                      {luoi}
                      {r.bd && r.kt && thanh({
                        kk: r.id, a: r.bd.getTime(), b: r.kt.getTime(), mau: "#64748b", top: 3, h: LH - 6, cnt: r.cnt, title: `${r.ten} · ${hhmm(r.bd)} → ${hhmm(r.kt)}`,
                        tren: <><span className="min-w-0 flex-1 truncate">{r.ten}</span><span className="shrink-0">{oNen(it, r.job.so_xe_tay != null)}</span></>, oCa: oCaFn(it),
                      })}
                    </div>
                  </div>
                );
              })}
              {canWrite && <div className="sticky left-0 z-10 border-b bg-card px-2 py-1" style={{ width: LABEL + W }}><button type="button" onClick={() => onJob({ loai: "tau" })} className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[0.6875rem] hover:bg-accent"><Plus className="h-3 w-3" />Thêm việc cảng</button></div>}
            </>}

            {phan("BÃI · việc bãi", "bai", `${baiHien.length} việc`)}
            {!thu.bai && <>
              {baiHien.map((f) => {
                const manual = !f.job.lt, it = { ...f, kind: manual ? "baiTay" : "baiLT", ten: f.cv };
                // Thanh việc bãi vẽ theo GIỜ chính xác của việc (tu / den) nếu có; chưa có thì theo ranh giới các ca có việc
                const idx = shifts.map((s, g) => (trongCa(f, s) ? g : -1)).filter((g) => g >= 0), tuJ = f.job.tu ? +new Date(f.job.tu) : null, denJ = f.job.den ? +new Date(f.job.den) : null;
                const a = idx.length ? (tuJ ?? shifts[idx[0]].st.getTime()) : null, b = idx.length ? (denJ ?? shifts[idx[idx.length - 1]].en.getTime()) : null;
                const trongKhung = a != null && b > tuMs && a < denMs;
                const tay = !manual && dongSoXeBai(D.plan.jobs, f.job.lt, doi)?.so_xe_tay != null;
                return (
                  <div key={f.id} className="flex border-b">
                    <div className="sticky left-0 z-10 flex shrink-0 items-center gap-1 border-r bg-card px-2" style={{ width: LABEL }} title={f.cv}>
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-semibold">{f.cv}</span>
                        <span className="truncate text-[0.6875rem] text-muted-foreground">{[f.hang, f.ben].filter(Boolean).join(" · ") || (manual ? "nhập tay" : "theo Linetime")}</span>
                      </span>{nutTD(it)}
                    </div>
                    <div className="relative shrink-0" style={{ width: W, height: LH }}>
                      {luoi}
                      {trongKhung && thanh({
                        kk: f.id, a, b, mau: BAI_COLOR, top: 3, h: LH - 6, cnt: f.cnt,
                        title: `${f.cv}${f.hang ? " · " + f.hang : ""}\nSố xe ${f.n === f.d ? f.n : `${f.n} (ngày) / ${f.d} (đêm)`}`,
                        tren: <><span className="min-w-0 flex-1 truncate">{f.cv}</span><span className="shrink-0">{oNen(it, tay, f.n === f.d ? "xe" : `${f.n}/${f.d}`)}</span></>,
                        oCa: oCaFn(it),
                      })}
                      {!trongKhung && <div className="absolute inset-y-0 left-2 flex items-center text-[0.6875rem] text-muted-foreground">{a == null ? "Chưa có mốc thời gian" : "Ngoài khoảng đang xem"}</div>}
                    </div>
                  </div>
                );
              })}
              {!baiHien.length && <div className="border-b px-2 py-3 text-muted-foreground">{hangF.length ? "Không có việc bãi nào ứng với loại hàng đã chọn." : `Chưa có việc bãi nào của đội ${doi}.`} Bấm +bãi trên thanh tàu hoặc nút Thêm việc bãi.</div>}
              {canWrite && <div className="sticky left-0 z-10 border-b bg-card px-2 py-1" style={{ width: LABEL + W }}><button type="button" onClick={() => onJob({ loai: "bai" })} className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[0.6875rem] hover:bg-accent"><Plus className="h-3 w-3" />Thêm việc bãi</button></div>}
            </>}

            {/* Khối dòng tổng cố định ở đáy khung (luôn tính đủ, không theo lọc loại hàng); nút ở tiêu đề khối để ẩn / hiện cả khối */}
            <div className="sticky bottom-0 z-20 border-t-4 bg-card shadow-[0_-6px_14px_rgba(0,0,0,0.3)]" style={{ borderTopColor: MAU_CHUNG }}>
              <button type="button" onClick={() => doiThu("tong")} aria-expanded={!thu.tong} title={thu.tong ? "Hiện các dòng tổng" : "Ẩn các dòng tổng"} className="sticky left-0 z-10 flex items-center gap-1.5 border-b bg-card px-2 py-1 text-left text-[0.6875rem] font-bold tracking-wide hover:bg-accent" style={{ width: LABEL + W, color: MAU_CHUNG, backgroundImage: `linear-gradient(${MAU_CHUNG}1f, ${MAU_CHUNG}1f)` }}>
                {thu.tong ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}TỔNG HỢP CÁC CA
                {thu.tong && <span className="ml-3 font-normal text-muted-foreground">{ca.filter((s) => s.tt === "THIẾU").length ? `${ca.filter((s) => s.tt === "THIẾU").length} ca thiếu xe` : "đủ xe"} · bấm để hiện</span>}
              </button>
              {!thu.tong && <>
                {dongCong("Tổng cầu cảng", (s) => s.cang, MAU_CANG, { dau: false, dam: true })}
                {dongCong("Xe cảng có", () => capCang, MAU_CANG, { cls: () => "text-muted-foreground" })}
                {dongCong("Cân bằng cảng", (s) => s.balCang, MAU_CANG, { cls: (s) => cn("font-semibold", am(s.balCang)) })}
                {dongCong("Tổng cầu bãi", (s) => s.bai, MAU_BAI, { dau: true, dam: true })}
                {dongCong("Xe bãi có", () => capBai, MAU_BAI, { cls: () => "text-muted-foreground" })}
                {dongCong("Cân bằng bãi", (s) => s.balBai, MAU_BAI, { cls: (s) => cn("font-semibold", am(s.balBai)) })}
                {dongCong("Cân bằng chung", (s) => s.balChung, MAU_CHUNG, { dau: true, dam: true, cls: (s) => am(s.balChung) })}
                {dongCong("Tình trạng", (s) => s.tt, MAU_CHUNG, { cls: (s) => cn("text-center text-[0.625rem] font-bold", s.tt === "OK" ? "bg-ok/10 text-ok" : s.tt === "THIẾU" ? "bg-bad/15 text-bad" : "bg-warn/10 text-warn") })}
              </>}
            </div>
          </div>
        </div>
        <p className="text-[0.6875rem] text-muted-foreground">Thanh tàu đặt theo giờ thật như Linetime. Ô SỐ XE trên thanh (tàu và việc bãi) do anh / chị nhập, các ca TỰ CHẠY theo số này (tàu: theo hệ số ca); muốn sửa ca nào thì gõ thẳng vào ô ca đó, xóa số để ca đó chạy tự động lại. Biểu tượng ở cột tên việc: Sửa, Xóa (việc nhập tay), mở phiếu chuyến và xóa số đã nhập (việc từ Linetime). +bãi thêm tàu vào việc bãi (tên tàu - loại hàng - khối lượng và mốc thời gian, không lấy số xe).</p>
      </div>
    </div>
  );
}
