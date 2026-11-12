import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Anchor, Boxes, ChevronDown, Package, Ship, Truck, Wrench, Users, Hourglass, Gauge as IcGauge, ClipboardList } from "lucide-react";
import { useApp } from "@/store";
import { useThietBi } from "@/thietbi/Host";
import EChart from "@/components/EChart";
import { so, pct, r2, DAY, HOUR, ngayGio, ngayNam } from "@/lib/format";
import { cn } from "@/lib/utils";
import { tonTheoNgay, NGUONG_KHO } from "@/lib/kho";
import { NHOM } from "@/lib/sanLuongTT";
import { chuoiKy, tongTheoNhom, khoangKy, kyTruoc, kySau } from "@/lib/bieuDoSanLuong";
import { tuoiTon } from "@/lib/bieuDoKho";
import { tienDoSanLuong, doiSoVoi, chiSoCauBen, tauTheoNgay, chiSoThietBi, taoVanDe, tone, toneDat, toneNang, NGUONG } from "@/lib/chiSoTQ";
import GanttMet from "../cang/GanttMet";
import { tenBen } from "../cang/BangTauBen";
import { useKho } from "../kho/useKho";
import { MAU } from "./khung";
import { Khung, ChuaCo, nghin } from "./khungBD";
import { useSanLuongKy, khoaKyRieng } from "./KhoiSanLuong";
import BieuDoSanLuongTQ, { CAO } from "./BieuDoSanLuongTQ";
import BieuDoKhoTQ from "./BieuDoKhoTQ";
import { IcTau, IcCau, IcKho, IcXe, IcSanLuong, SoDoBai, BangDoiXe } from "./hinhVe";
import { TheChiSo, TheSucKhoe, ThanhKy, MangTQ, DaiVanDe } from "./TheChiSo";

// Tổng quan điều hành (thiết kế lại 10/11/2026): một trang cuộn cho người quản lý thấy bức tranh chung từ sản lượng, cầu bến, kho bãi đến thiết bị.
//   1. Thanh chọn kỳ (Tuần / Tháng / Quý / Năm, kỳ trước – kỳ sau) dùng chung toàn trang; mọi chỉ số so với kỳ liền trước.
//   2. Bốn đồng hồ sức khỏe + danh sách "Cần xử lý ngay" (đỏ trước vàng) để thấy vấn đề trong vài giây.
//   3. Bốn mảng, mỗi mảng: thẻ chỉ số chuẩn quản trị, hình minh họa (sơ đồ cầu bến, bãi chứa, bảng đội xe), biểu đồ, và phần phân tích chi tiết cũ.
// Công thức các chỉ số: src/lib/chiSoTQ.js.
const luuLs = (k, v) => { try { localStorage.setItem(k, v); } catch { /* bỏ qua */ } };
const docLs = (k, mac) => { try { return localStorage.getItem(k) || mac; } catch { return mac; } };
const KY = [["tuan", "Tuần"], ["thang", "Tháng"], ["quy", "Quý"], ["nam", "Năm"]];
const ngayStr = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const gio1 = (h) => (h == null ? "—" : h >= 48 ? `${so(h / 24)} ngày` : `${so(h)} giờ`);
const base = { grid: { left: 4, right: 10, top: 30, bottom: 0, containLabel: true }, legend: { top: 0, itemWidth: 12, itemHeight: 6, icon: "roundRect", textStyle: { fontSize: 10 } } };
const truc = { type: "value", axisLabel: { fontSize: 10, formatter: nghin } };
const trucPct = { type: "value", axisLabel: { fontSize: 10, formatter: (v) => pct(v) } };
const MAU_T = { ok: MAU.ok, warn: MAU.warn, bad: MAU.bad };
const MAU_HUONG = { nhap: MAU.info, xuat: MAU.tim, phuc_vu_cang: MAU.info, phuc_vu_san_xuat: "#ec4899" };

// Tổng thực tế của n ngày đầu của kỳ (so kỳ đang chạy với kỳ trước cùng số ngày)
// Sản lượng các ngày đã khép sổ của kỳ (trước hôm nay)
const ttKhepSo = (du, ky) => { const tap = new Set(ky.ngays.filter((d) => d < ky.homNay)); return (du?.thucTe || []).reduce((s, r) => s + (tap.has(String(r.ngay).slice(0, 10)) ? +r.tan || 0 : 0), 0); };
const ttNgayDau = (du, ky, n) => { const tap = new Set(ky.ngays.slice(0, n)); return (du?.thucTe || []).reduce((s, r) => s + (tap.has(String(r.ngay).slice(0, 10)) ? +r.tan || 0 : 0), 0); };

// Giao dịch kho trong khoảng ngày (tải riêng vì sổ trong bộ nhớ chỉ giữ 35 ngày)
function useGiaoDich(tu, den) {
  const { api, D } = useApp();
  const [gd, setGd] = useState(null);
  useEffect(() => {
    let huy = false;
    api.loadGiaoDichKhoang(tu, den).then((r) => { if (!huy) setGd(r || []); }).catch(() => { if (!huy) setGd([]); });
    return () => { huy = true; };
  }, [api, tu, den, D]);
  return gd;
}

// ---------- Biểu đồ ----------
// ---------- Trang ----------
export default function TongQuanMoi({ onMo, go, tongCanhBao }) {
  const { D, quyen, setVoyageMo } = useApp();
  const tbCtx = useThietBi(), tb = tbCtx?.D;
  const kho = useKho();
  const homNay = ngayStr(D.now);
  const coCang = quyen.coCang, coTB = quyen.coThietBi && !!tb, coKho = (quyen.kho?.co || quyen.coCang) && !!kho;
  const [kyLoai, setKyLoai] = useState("thang"), [ngayTC, setNgayTC] = useState(homNay);
  const [thu, setThu] = useState({}), [ct, setCt] = useState({});
  const kyInfo = useMemo(() => khoangKy(kyLoai, ngayTC, homNay), [kyLoai, ngayTC, homNay]);
  const kyT = useMemo(() => kyTruoc(kyInfo), [kyInfo]);
  const laNay = kyInfo.ngays.includes(homNay), qua = kyInfo.ngays.filter((d) => d < homNay).length; // qua: số ngày đã khép sổ (trước hôm nay)
  const doiKy = (k) => setKyLoai(k);

  // ===== Sản lượng =====
  const kk = khoaKyRieng(kyInfo);
  const cang = useSanLuongKy("cang", kyInfo.thangs, kk, !coCang), vt = useSanLuongKy("van_tai", kyInfo.thangs, kk, !coCang);
  const cC = useMemo(() => (cang ? chuoiKy(kyInfo, cang, "cang", { chia: (x) => x.huong }) : null), [kyInfo, cang]);
  const cV = useMemo(() => (vt ? chuoiKy(kyInfo, vt, "van_tai", { chia: (x) => x.huong }) : null), [kyInfo, vt]);
  const tdC = cC ? tienDoSanLuong(cC, kyInfo, ttKhepSo(cang, kyInfo)) : null, tdV = cV ? tienDoSanLuong(cV, kyInfo, ttKhepSo(vt, kyInfo)) : null;
  const coSL = !!(cC && cV && tdC && tdV);

  // ===== Cầu bến =====
  const cb = useMemo(() => (coCang ? chiSoCauBen({ voyages: D.voyages, berths: D.berths, stopsOf: D.stopsOf, tu: kyInfo.tu, den: kyInfo.den, now: D.now }) : null), [coCang, D.voyages, D.berths, D.stopsOf, kyInfo, D.now]);
  // Kỳ trước chỉ lấy đúng khoảng thời gian đã trôi của kỳ này (cùng độ dài) để so sánh công bằng
  const cbT = useMemo(() => (coCang ? chiSoCauBen({ voyages: D.voyages, berths: D.berths, stopsOf: D.stopsOf, tu: kyT.tu, den: kyT.tu + Math.min(Math.max(D.now - kyInfo.tu, 0), kyInfo.den - kyInfo.tu), now: D.now }) : null), [coCang, D.voyages, D.berths, D.stopsOf, kyT, kyInfo, D.now]);
  const tauNgay = useMemo(() => (coCang ? tauTheoNgay({ voyages: D.voyages, stopsOf: D.stopsOf, ngays: kyInfo.ngays, now: D.now }) : []), [coCang, D.voyages, D.stopsOf, kyInfo, D.now]);
  const khungLich = useRef(), [rongLich, setRongLich] = useState(900);
  useLayoutEffect(() => {
    const el = khungLich.current; if (!el) return undefined;
    setRongLich(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setRongLich(e.contentRect.width)); ro.observe(el);
    return () => ro.disconnect();
  }, [coCang, thu["mang-cb"]]);
  // Linetime theo mét: chế độ (chiếm bến / toàn thời gian) và số ngày do người xem chọn, nhớ lại ở máy; bắt đầu từ 2 ngày trước hôm nay (kỳ này) hoặc đầu kỳ đang xem
  const [cheLich, setCheLich] = useState(() => (docLs("lg-tq-che", "toan") === "ben" ? "ben" : "toan"));
  const [soNgayLich, setSoNgayLich] = useState(() => { const n = +docLs("lg-tq-ngay", 10); return [5, 7, 10, 14, 21, 30].includes(n) ? n : 10; });
  const pxNgay = Math.max(24, Math.floor((rongLich - 84) / soNgayLich));
  const tuLich = useMemo(() => { if (!laNay) return kyInfo.tu; const d = new Date(D.now); d.setHours(0, 0, 0, 0); return d.getTime() - 2 * DAY; }, [D.now, laNay, kyInfo.tu]);
  const tauLich = useMemo(() => D.voyages.filter((v) => !v.huy), [D.voyages]);

  // ===== Kho bãi =====
  const gd = useGiaoDich(useMemo(() => ngayStr(Math.min(new Date(kyT.ngays[0] + "T00:00:00").getTime(), D.now - 120 * DAY)), [kyT, D.now]), homNay);
  const khoK = useMemo(() => {
    if (!kho || !gd) return null;
    const dem = (ky, n) => { const tap = new Set(ky.ngays.slice(0, n)); const r = { nhap: 0, xuat: 0 }; for (const g of gd) if ((g.loai === "nhap" || g.loai === "xuat") && tap.has(String(g.ngay).slice(0, 10))) r[g.loai] += +g.so_luong || 0; return r; };
    const hienTai = dem(kyInfo, kyInfo.ngays.length), dauKy = dem(kyInfo, qua), truoc = dem(kyT, qua); // hienTai: cả kỳ; dauKy / truoc: cùng số ngày đã khép sổ để so sánh
    const ton = kho.dong.reduce((s, d) => s + d.ton, 0), suc = kho.bai.reduce((s, b) => s + (b.sucChua || 0), 0);
    const tuoi = tuoiTon({ kho, khoTon: D.khoTon || [], giaoDich: gd, now: D.now });
    const tonLau = tuoi.filter((r) => r.tuoi > NGUONG.tonLauNgay).reduce((s, r) => s + r.ton, 0);
    const capHang = new Map(); for (const d of kho.dong) if (d.loai === "nguyen_lieu" && d.ngayCap != null) capHang.set(d.hang, Math.min(capHang.get(d.hang) ?? Infinity, d.ngayCap));
    const ngayCapThap = [...capHang.values()].filter((x) => x < NGUONG.ngayCapVang).length, ngayCapDo = [...capHang.values()].filter((x) => x < NGUONG.ngayCapDo).length;
    const xuatNgay = qua > 0 ? dauKy.xuat / qua : 0;
    const tongTon = ton, lap = suc > 0 ? ton / suc : null;
    const chuoi = (loai) => { const dong = kho.dong.filter((d) => d.loai === loai), ten = new Set(dong.map((d) => d.ten_bai)), sc = kho.bai.filter((b) => ten.has(b.ten_bai)).reduce((s, b) => s + (b.sucChua || 0), 0); return { sc, ds: tonTheoNgay(dong.reduce((s, d) => s + d.ton, 0), D.giaoDich || [], (b) => ten.has(b), 30, D.now) }; };
    return {
      ton: tongTon, suc, lap, ...hienTai, truoc, tonLau, tuoi, ngayCapThap, ngayCapDo, baiVuot: kho.bai.filter((b) => b.lapDay > 1).length,
      ngayTon: xuatNgay > 0 ? ton / xuatNgay : null, vong: ton > 0 ? dauKy.xuat / ton : null, dauKy, tp: chuoi("thanh_pham"), nl: chuoi("nguyen_lieu"),
    };
  }, [kho, gd, kyInfo, kyT, qua, D.khoTon, D.giaoDich, D.now]);

  // ===== Thiết bị =====
  const tbm = useMemo(() => {
    if (!coTB) return null;
    const xe = tb.vehicles.filter((v) => v.doi !== "Cẩu"), cau = tb.vehicles.filter((v) => v.doi === "Cẩu");
    const loaiDung = tb.meta?.loaiDung;
    const mk = (vs, ky) => chiSoThietBi({ vehicles: vs, events: tb.events, ngays: ky.ngays, homNay, ...(loaiDung ? { loaiDung } : {}) });
    // Kỳ trước lấy đúng số ngày đã trôi của kỳ này
    const nDen = kyInfo.ngays.filter((d) => d <= homNay).length, kyTc = { ...kyT, ngays: kyT.ngays.slice(0, nDen) };
    const nhom = tb.doiList.map((doi) => ({ ten: doi, xe: tb.vehicles.filter((v) => v.doi === doi).map((v) => ({ ma: v.ma, s: tb.stateOf(v.ma) })) })).filter((g) => g.xe.length);
    const hongLau = tb.open.filter((e) => e.loai === "Hỏng").map((e) => ({ ...e, ngay: Math.max(0, Math.round((new Date(homNay) - new Date(e.ngay_vao)) / DAY)) })).sort((a, b) => b.ngay - a.ngay);
    const ca = tb.upcomingShifts(new Date(D.now))[0], rows = ca ? tb.shiftRows(ca) : [], nhapDu = rows.filter((r) => r.chenh != null);
    const hong = tb.summarize(xe).hong + tb.summarize(cau).hong;
    const hongTheoDoi = {}; for (const e of tb.events) if (e.loai === "Hỏng" && e.ngay_vao >= kyInfo.ngays[0] && e.ngay_vao <= kyInfo.ngays[kyInfo.ngays.length - 1]) { const d = tb.vmap[e.ma_xe]?.doi || "(khác)"; hongTheoDoi[d] = (hongTheoDoi[d] || 0) + 1; }
    return {
      xe: mk(xe, kyInfo), cau: cau.length ? mk(cau, kyInfo) : null, xeT: mk(xe, kyTc), cauT: cau.length ? mk(cau, kyTc) : null, sx: tb.summarize(xe), sc: tb.summarize(cau),
      nhom, hongLau, ca: ca ? { ten: tb.shiftLabel(ca), thieu: nhapDu.reduce((s, r) => s + Math.max(0, -r.chenh), 0), thua: nhapDu.reduce((s, r) => s + Math.max(0, r.chenh), 0), nhap: nhapDu.length, tong: rows.length } : null,
      hong, hongTheoDoi, quaHan: tb.open.filter((e) => tb.flags(e).some((f) => f.k === "qh")).length, ss: tb.T?.ss ?? NGUONG.ssVang, red: tb.T?.red ?? NGUONG.ssDo,
    };
  }, [coTB, tb, kyInfo, kyT, homNay, D.now]);

  // ===== Vấn đề cần xử lý =====
  const vanDe = useMemo(() => {
    const ds = taoVanDe({
      sl: [{ ten: "Sản lượng cảng", td: tdC }, { ten: "Sản lượng vận tải", td: tdV }], cb,
      kho: khoK ? { lap: khoK.lap, baiVuot: khoK.baiVuot, ngayCapThap: khoK.ngayCapThap, ngayCapDo: khoK.ngayCapDo, tonLau: khoK.tonLau, tong: khoK.ton } : null,
      tbi: tbm ? [{ ten: "Xe di động", m: tbm.xe, ngVang: tbm.ss, ngDo: tbm.red }, ...(tbm.cau ? [{ ten: "Cẩu cảng", m: tbm.cau, ngVang: tbm.ss, ngDo: tbm.red }] : [])] : [],
    });
    const them = [];
    if (coCang) for (const a of D.alerts.filter((x) => x.muc === "bad" && x.voyage).slice(0, 4)) them.push({ muc: "bad", mang: "cauben", nd: `${a.voyage.ten_tau}: ${a.nd}`, dich: { voyage: a.voyage.id } });
    if (coKho) for (const a of (kho?.canh || []).filter((x) => x.muc === "bad").slice(0, 3)) them.push({ muc: "bad", mang: "kho", nd: a.nd, dich: "kho/thanh-pham" });
    if (coTB) for (const e of tb.open.slice(0, 40)) { const f = tb.flags(e).find((x) => x.tone === "bad"); if (f && them.filter((x) => x.mang === "thietbi").length < 3) them.push({ muc: "bad", mang: "thietbi", nd: `${e.ma_xe} (${tb.vmap[e.ma_xe]?.doi || ""}): ${f.label}`, dich: "thiet-bi/su-kien" }); }
    return [...ds, ...them].sort((a, b) => (a.muc === "bad" ? 0 : 1) - (b.muc === "bad" ? 0 : 1));
  }, [tdC, tdV, cb, khoK, tbm, D.alerts, kho, tb, coCang, coKho, coTB]);
  const moVanDe = (d) => { if (!d) return; if (d.voyage) setVoyageMo(d.voyage); else go(d); };
  const cuon = (id) => { setThu((o) => ({ ...o, [id]: false })); setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 30); };
  const doiThu = (id) => setThu((o) => ({ ...o, [id]: !o[id] }));
  const bat = (id) => setCt((o) => ({ ...o, [id]: !o[id] }));
  const ChiTiet = ({ id, ten, children }) => (
    <div>
      <button type="button" onClick={() => bat(id)} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"><ChevronDown className={`h-4 w-4 transition-transform ${ct[id] ? "" : "-rotate-90"}`} />{ten}</button>
      {ct[id] && <div className="mt-2">{children}</div>}
    </div>
  );

  // ===== Tone từng mảng =====
  const toneSL = toneNang(tdC?.tone, tdV?.tone), toneCB = cb ? toneNang(tone(cb.bor, NGUONG.borVang, NGUONG.borDo, false), tone(cb.choTB, NGUONG.choVang, NGUONG.choDo, false)) : null;
  const toneKho = khoK ? toneNang(tone(khoK.lap, NGUONG.khoVang, NGUONG.khoDo, false), khoK.baiVuot > 0 ? "bad" : khoK.ngayCapDo > 0 ? "bad" : khoK.ngayCapThap > 0 ? "warn" : null) : null;
  const toneTB = tbm ? toneNang(tone(tbm.xe.rateHT, tbm.ss, tbm.red), tbm.cau ? tone(tbm.cau.rateHT, tbm.ss, tbm.red) : null) : null;
  const gTB = tbm ? tbm.xe : null;
  const sucKhoe = [];
  if (coCang) sucKhoe.push(<TheSucKhoe key="sl" icon={IcSanLuong} ten="Sản lượng" giaTri={tdC?.dat != null ? pct(tdC.dat) : "—"} nhan={tdC?.mt ? "đạt mục tiêu kỳ" : "chưa đặt mục tiêu"} tone={toneSL} onClick={() => cuon("mang-sl")}
    gauge={{ v: tdC?.dat, max: 1.2, mau: MAU_T[toneSL], vung: [[0, 0.9, MAU.bad], [0.9, 1, MAU.warn], [1, 1.2, MAU.ok]] }}
    dong={tdC ? (tdC.duBaoDat != null && !tdC.xong ? `Dự báo cuối kỳ ${pct(tdC.duBaoDat)} · ${tdC.lech >= 0 ? "vượt" : "thiếu"} ${nghin(Math.abs(tdC.lech))} t so kế hoạch đến nay` : "") : "Đang tải…"} />);
  if (coCang) sucKhoe.push(<TheSucKhoe key="cb" icon={IcCau} ten="Cầu bến" giaTri={cb?.bor != null ? pct(cb.bor) : "—"} nhan="chiếm bến (BOR)" tone={toneCB} onClick={() => cuon("mang-cb")}
    gauge={{ v: cb?.bor, max: 1, mau: MAU_T[toneCB], vung: [[0, NGUONG.borThap, MAU.xam], [NGUONG.borThap, NGUONG.borVang, MAU.ok], [NGUONG.borVang, NGUONG.borDo, MAU.warn], [NGUONG.borDo, 1, MAU.bad]] }}
    dong={cb ? `${cb.dangCho} tàu chờ · ${cb.dangO} tàu ở bến${cb.choTB != null ? ` · chờ TB ${gio1(cb.choTB)}` : ""}` : ""} />);
  if (coKho) sucKhoe.push(<TheSucKhoe key="kho" icon={IcKho} ten="Kho bãi" giaTri={khoK?.lap != null ? pct(khoK.lap) : "—"} nhan="lấp đầy" tone={toneKho} onClick={() => cuon("mang-kho")}
    gauge={{ v: khoK?.lap, max: 1, mau: MAU_T[toneKho], vung: [[0, NGUONG.khoVang, MAU.ok], [NGUONG.khoVang, NGUONG.khoDo, MAU.warn], [NGUONG.khoDo, 1, MAU.bad]] }}
    dong={khoK ? `Tồn ${nghin(khoK.ton)} t${khoK.baiVuot ? ` · ${khoK.baiVuot} bãi vượt sức chứa` : ""}${khoK.tonLau ? ` · ${nghin(khoK.tonLau)} t tồn lâu` : ""}` : "Đang tải…"} />);
  if (coTB) sucKhoe.push(<TheSucKhoe key="tb" icon={IcXe} ten="Thiết bị" giaTri={gTB?.rateHT != null ? pct(gTB.rateHT) : "—"} nhan="xe sẵn sàng" tone={toneTB} onClick={() => cuon("mang-tb")}
    gauge={{ v: gTB?.rateHT, max: 1, mau: MAU_T[toneTB], vung: [[0, tbm.red, MAU.bad], [tbm.red, tbm.ss, MAU.warn], [tbm.ss, 1, MAU.ok]] }}
    dong={tbm ? `${tbm.sx.ready}/${tbm.sx.tong} xe${tbm.cau ? ` · cẩu ${tbm.sc.ready}/${tbm.sc.tong}` : ""} · ${tbm.sx.hong + tbm.sc.hong} hỏng` : ""} />);

  return (
    <div className="tq-sang grid gap-3">
      {/* Thanh chọn kỳ dùng chung */}
      <div className="sticky top-12 z-30 -mx-1 lg:top-0 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border bg-background/90 px-3 py-2 backdrop-blur">
        <ThanhKy ky={kyLoai} dat={doiKy} ds={KY} nhan={kyInfo.nhan} laNay={laNay} truoc={() => setNgayTC(kyT.ngays[0])} sau={() => setNgayTC(kySau(kyInfo).ngays[0])} veNay={() => setNgayTC(homNay)} />
        <span className="hidden text-[0.6875rem] text-muted-foreground sm:inline">Mọi chỉ số so với {kyT.nhan.toLowerCase()}{laNay ? ` (cùng ${Math.max(1, qua)} ngày đầu)` : ""} · mục tiêu chia đều theo ngày, quý / năm có mục tiêu riêng thì dùng số đó</span>
      </div>

      {/* Bức tranh chung: bốn đồng hồ + vấn đề */}
      <div className="grid gap-3 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">{sucKhoe}</div>
        <DaiVanDe ds={vanDe} onMo={moVanDe} tongCanhBao={tongCanhBao} onXemCanhBao={() => onMo("canh-bao")} />
      </div>

      {/* ===== SẢN LƯỢNG: 6 biểu đồ, khung cố định có thanh cuộn ===== */}
      {coCang && (
        <MangTQ id="mang-sl" icon={IcSanLuong} ten="Sản lượng" mota={`${kyInfo.nhan} · cơ cấu và lũy kế so với kế hoạch`} loai="sanluong" tone={toneSL} thu={thu["mang-sl"]} onThu={() => doiThu("mang-sl")}>
          {coSL ? <BieuDoSanLuongTQ kyInfo={kyInfo} cang={cang} vt={vt} tdC={tdC} tdV={tdV} />
            : <ChuaCo>{cang === null || vt === null ? "Chưa có bảng sản lượng thực tế (chạy sql/06)." : "Đang tải sản lượng…"}</ChuaCo>}
        </MangTQ>)}

      {/* ===== CẦU BẾN ===== */}
      {coCang && cb && (
        <MangTQ id="mang-cb" icon={IcCau} ten="Cầu bến" mota={`${kyInfo.nhan} · lịch cầu bến, chiếm bến, chờ bến`} loai="cauben" tone={toneCB} thu={thu["mang-cb"]} onThu={() => doiThu("mang-cb")}
          kpi={<>
            <TheChiSo icon={IcCau} ten="Chiếm bến (BOR)" giaTri={cb.bor != null ? pct(cb.bor, 1) : pct(cb.borCaKy, 1)} tone={cb.bor != null ? tone(cb.bor, NGUONG.borVang, NGUONG.borDo, false) : null}
              doi={cb.bor != null && cbT?.bor != null ? doiSoVoi(cb.bor, cbT.bor) : undefined} tot="thap" spark={tauNgay.map((x) => x.oBen)}
              phu={cb.bor != null ? `${cb.soBen} bến · cả kỳ theo kế hoạch ${pct(cb.borCaKy, 1)}` : `Kỳ chưa bắt đầu · theo kế hoạch (${cb.soBen} bến)`} />
            <TheChiSo icon={Hourglass} ten="Chờ bến trung bình" giaTri={cb.choTB != null ? gio1(cb.choTB) : "—"} tone={tone(cb.choTB, NGUONG.choVang, NGUONG.choDo, false)}
              doi={cb.choTB != null && cbT?.choTB != null ? doiSoVoi(cb.choTB, cbT.choTB) : undefined} tot="thap"
              phu={cb.choTB != null ? `Lâu nhất ${gio1(cb.choMax)} · ${cb.soTauCho} tàu cập trong kỳ` : "Chưa có tàu cập thật (ATB) trong kỳ"} />
            <TheChiSo icon={IcTau} ten="Thời gian tàu ở bến" giaTri={cb.oBenTB != null ? gio1(cb.oBenTB) : "—"} doi={cb.oBenTB != null && cbT?.oBenTB != null ? doiSoVoi(cb.oBenTB, cbT.oBenTB) : undefined} tot="thap"
              phu={cb.oBenTB != null ? `Trung bình ${cb.soTauRoi} tàu đã rời trong kỳ` : "Chưa có tàu rời (ATD) trong kỳ"} />
            <TheChiSo icon={Ship} ten="Tàu hiện tại" giaTri={`${cb.dangLam}`} donVi="đang làm hàng" tone={cb.dangCho > 2 ? "warn" : null}
              phu={`${cb.dangCho} đang chờ bến · ${cb.dangO} ở bến · ${cb.sapDen} sắp đến (7 ngày)`} />
            <TheChiSo icon={Package} ten="Tàu cập / rời đến nay" giaTri={`${cb.capDen} / ${cb.roiDen}`} doi={cbT ? doiSoVoi(cb.capDen, cbT.capDen) : undefined}
              phu={`Cùng thời gian kỳ trước: ${cbT?.capDen ?? "—"} cập / ${cbT?.roiDen ?? "—"} rời · cả kỳ theo kế hoạch ${cb.capTrongKy} / ${cb.roiTrongKy}`} />
          </>}>
          <Khung ten="Linetime tàu cập bến theo mét" phu={`${soNgayLich} ngày từ ${ngayGio(tuLich).slice(0, 5)} · ${cheLich === "toan" ? "toàn thời gian (gồm chờ bến)" : "chiếm bến"}`} onChiTiet={() => onMo("tau")}
            bo={<div className="flex flex-wrap items-center gap-1.5">
              <div className="inline-flex overflow-hidden rounded border border-border/70 text-[0.6875rem]" role="group" aria-label="Chế độ xem">
                {[["ben", "Chiếm bến"], ["toan", "Toàn thời gian"]].map(([k, t]) => <button key={k} type="button" aria-pressed={cheLich === k} onClick={() => { setCheLich(k); luuLs("lg-tq-che", k); }} className={cn("px-1.5 py-0.5", cheLich === k ? "bg-primary/20 font-semibold text-primary" : "text-muted-foreground hover:bg-accent")}>{t}</button>)}
              </div>
              <select value={soNgayLich} onChange={(e) => { setSoNgayLich(+e.target.value); luuLs("lg-tq-ngay", e.target.value); }} className="rounded border border-border/70 bg-transparent px-1 py-0.5 text-[0.6875rem] text-muted-foreground" aria-label="Số ngày hiển thị">
                {[5, 7, 10, 14, 21, 30].map((n) => <option key={n} value={n}>{n} ngày</option>)}
              </select>
            </div>}>
            <div ref={khungLich} className="min-w-0"><GanttMet voyages={tauLich} tu={tuLich} soNgay={soNgayLich} pxNgay={pxNgay} che={cheLich} gon maxH="520px" /></div>
          </Khung>
          <div className="grid gap-2.5 lg:grid-cols-2">
            <Khung cao={CAO} ten="Chiếm bến từng bến" phu="cao nhất ở trên · vạch vàng 85%">
              <EChart height={Math.max(220, 40 + cb.theoBen.length * 20)} option={{
                grid: { left: 4, right: 40, top: 4, bottom: 0, containLabel: true }, tooltip: { axisPointer: { type: "shadow" }, valueFormatter: (v) => pct(v, 1) },
                xAxis: { ...trucPct, max: (v) => Math.max(1, v.max) }, yAxis: { type: "category", inverse: true, data: [...cb.theoBen].sort((a, b) => (b.bor ?? b.borCaKy) - (a.bor ?? a.borCaKy)).map((b) => tenBen(b.ma)), axisLabel: { fontSize: 10 } },
                series: [{ type: "bar", barMaxWidth: 12, data: [...cb.theoBen].sort((a, b) => (b.bor ?? b.borCaKy) - (a.bor ?? a.borCaKy)).map((b) => { const v = b.bor ?? b.borCaKy; return { value: r2(v), itemStyle: { color: MAU_T[tone(v, NGUONG.borVang, NGUONG.borDo, false)] || MAU.xam } }; }),
                  label: { show: true, position: "right", fontSize: 10, formatter: (p) => pct(p.value) }, markLine: { symbol: "none", silent: true, lineStyle: { type: "dashed", color: MAU.warn }, label: { show: false }, data: [{ xAxis: NGUONG.borVang }] } }],
              }} />
            </Khung>
            <Khung cao={CAO} ten="Tàu ở bến và tàu chờ theo ngày" phu={kyInfo.nhan}>
              <EChart height={CAO - 50} option={{
                ...base, tooltip: { trigger: "axis", valueFormatter: (v) => `${v} tàu` }, xAxis: { type: "category", data: tauNgay.map((x) => x.ngay.slice(8) + "/" + x.ngay.slice(5, 7)), axisLabel: { fontSize: 10, hideOverlap: true } }, yAxis: { type: "value", minInterval: 1, axisLabel: { fontSize: 10 } },
                series: [{ name: "Tàu ở bến", type: "bar", stack: "t", barMaxWidth: 16, itemStyle: { color: MAU.ok, opacity: 0.85 }, data: tauNgay.map((x) => x.oBen) }, { name: "Tàu chờ bến", type: "bar", stack: "t", barMaxWidth: 16, itemStyle: { color: MAU.bad, opacity: 0.85 }, data: tauNgay.map((x) => x.cho) }],
              }} />
            </Khung>
          </div>
        </MangTQ>)}

      {/* ===== KHO BÃI: biểu đồ, khung cố định có thanh cuộn ===== */}
      {coKho && (
        <MangTQ id="mang-kho" icon={IcKho} ten="Kho bãi" mota={`${kyInfo.nhan} · tồn, tuổi tồn, lấp đầy, xuất nhập tồn`} loai="kho" tone={toneKho} thu={thu["mang-kho"]} onThu={() => doiThu("mang-kho")}>
          {khoK ? <BieuDoKhoTQ kyInfo={kyInfo} kho={kho} gd={gd} tuoi={khoK.tuoi} /> : <ChuaCo>Đang tải số liệu kho…</ChuaCo>}
        </MangTQ>)}

      {/* ===== THIẾT BỊ ===== */}
      {coTB && tbm && (
        <MangTQ id="mang-tb" icon={IcXe} ten="Thiết bị cơ giới" mota={`${kyInfo.nhan} · sẵn sàng, hỏng, sửa chữa, quân số`} loai="thietbi" tone={toneTB} thu={thu["mang-tb"]} onThu={() => doiThu("mang-tb")}
          kpi={<>
            <TheChiSo icon={IcXe} ten="Xe sẵn sàng (TB kỳ)" giaTri={tbm.xe.rateTB != null ? pct(tbm.xe.rateTB, 1) : "—"} tone={tone(tbm.xe.rateTB, tbm.ss, tbm.red)} doi={tbm.xeT.rateTB != null && tbm.xe.rateTB != null ? tbm.xe.rateTB - tbm.xeT.rateTB : undefined}
              diem spark={tbm.xe.theoNgay.map((x) => x.rate)} phu={`Hiện tại ${tbm.xe.rateHT != null ? pct(tbm.xe.rateHT, 1) : "—"} · ${tbm.sx.ready}/${tbm.sx.tong} xe · ngưỡng ${pct(tbm.ss)}`} />
            <TheChiSo icon={IcCau} ten="Cẩu cảng sẵn sàng" giaTri={tbm.cau?.rateTB != null ? pct(tbm.cau.rateTB, 1) : "—"} tone={tbm.cau ? tone(tbm.cau.rateTB, tbm.ss, tbm.red) : null} doi={tbm.cauT?.rateTB != null && tbm.cau?.rateTB != null ? tbm.cau.rateTB - tbm.cauT.rateTB : undefined}
              diem spark={tbm.cau?.theoNgay.map((x) => x.rate)} phu={tbm.cau ? `Hiện tại ${tbm.sc.ready}/${tbm.sc.tong} cẩu sẵn sàng` : "Chưa có cẩu trong danh mục"} />
            <TheChiSo icon={Wrench} ten="Số lần hỏng trong kỳ" giaTri={`${tbm.xe.soLanHong + (tbm.cau?.soLanHong || 0)}`} donVi="lần" tone={(tbm.xe.soLanHong + (tbm.cau?.soLanHong || 0)) > (tbm.xeT.soLanHong + (tbm.cauT?.soLanHong || 0)) * 1.3 + 1 ? "warn" : null}
              doi={(tbm.xeT.soLanHong + (tbm.cauT?.soLanHong || 0)) > 0 ? doiSoVoi(tbm.xe.soLanHong + (tbm.cau?.soLanHong || 0), tbm.xeT.soLanHong + (tbm.cauT?.soLanHong || 0)) : undefined} tot="thap"
              phu={tbm.xe.mttr != null ? `Sửa xong TB ${so(tbm.xe.mttr, 1)} ngày/lần (MTTR xe)` : "Chưa có lần sửa xong trong kỳ"} />
            <TheChiSo icon={Hourglass} ten="Xe-ngày dừng trong kỳ" giaTri={nghin(tbm.xe.dungXeNgay + (tbm.cau?.dungXeNgay || 0))} donVi="xe-ngày" doi={(tbm.xeT.dungXeNgay + (tbm.cauT?.dungXeNgay || 0)) > 0 ? doiSoVoi(tbm.xe.dungXeNgay + (tbm.cau?.dungXeNgay || 0), tbm.xeT.dungXeNgay + (tbm.cauT?.dungXeNgay || 0)) : undefined} tot="thap"
              phu={`${tbm.hong} đang hỏng · ${tbm.quaHan} quá hạn sửa`} tone={tbm.quaHan > 0 ? "bad" : tbm.hong > 0 ? "warn" : "ok"} />
            <TheChiSo icon={Users} ten="Quân số ca hiện tại" giaTri={tbm.ca ? (tbm.ca.nhap ? (tbm.ca.thieu ? `Thiếu ${tbm.ca.thieu}` : tbm.ca.thua ? `Thừa ${tbm.ca.thua}` : "Đủ") : "Chưa nhập") : "—"} tone={tbm.ca?.nhap ? (tbm.ca.thieu ? "bad" : "ok") : null}
              phu={tbm.ca ? `${tbm.ca.ten} · đã nhập ${tbm.ca.nhap}/${tbm.ca.tong} đội` : "Chưa có lịch ca"} onClick={() => go("thiet-bi/nhan-su")} />
          </>}>
          <div className="grid gap-2.5 lg:grid-cols-3">
            <Khung cao={CAO} ten="Tỉ lệ sẵn sàng theo ngày" phu={`${kyInfo.nhan} · vạch vàng = ngưỡng ${pct(tbm.ss)}`}>
              <EChart height={230} option={{
                ...base, tooltip: { trigger: "axis", valueFormatter: (v) => (v == null ? "—" : pct(v, 1)) }, xAxis: { type: "category", data: tbm.xe.theoNgay.map((x) => x.d.slice(8) + "/" + x.d.slice(5, 7)), axisLabel: { fontSize: 10, hideOverlap: true } },
                yAxis: { ...trucPct, min: (v) => Math.max(0, Math.floor(v.min * 10) / 10 - 0.05), max: 1 },
                series: [{ name: "Xe di động", type: "line", smooth: true, showSymbol: false, areaStyle: { opacity: 0.1 }, data: tbm.xe.theoNgay.map((x) => r2(x.rate)), itemStyle: { color: MAU.ok }, markLine: { symbol: "none", silent: true, lineStyle: { type: "dashed", color: MAU.warn }, label: { show: false }, data: [{ yAxis: tbm.ss }] } },
                  ...(tbm.cau ? [{ name: "Cẩu cảng", type: "line", smooth: true, showSymbol: false, data: tbm.cau.theoNgay.map((x) => r2(x.rate)), itemStyle: { color: MAU.info } }] : [])],
              }} />
            </Khung>
            <Khung cao={CAO} ten="Số lần hỏng theo đội" phu="trong kỳ">
              {Object.keys(tbm.hongTheoDoi).length ? (
                <EChart height={230} option={{ grid: { left: 4, right: 30, top: 6, bottom: 0, containLabel: true }, tooltip: { axisPointer: { type: "shadow" } }, xAxis: { type: "value", minInterval: 1, axisLabel: { fontSize: 10 } },
                  yAxis: { type: "category", inverse: true, data: Object.entries(tbm.hongTheoDoi).sort((a, b) => b[1] - a[1]).map(([k]) => k), axisLabel: { fontSize: 10 } },
                  series: [{ type: "bar", barMaxWidth: 14, itemStyle: { color: MAU.bad, opacity: 0.85 }, label: { show: true, position: "right", fontSize: 10 }, data: Object.entries(tbm.hongTheoDoi).sort((a, b) => b[1] - a[1]).map(([, v]) => v) }] }} />
              ) : <ChuaCo>Không có lần hỏng nào trong kỳ.</ChuaCo>}
            </Khung>
            <Khung cao={CAO} ten="Hỏng lâu nhất" phu="đang chờ sửa" onChiTiet={() => go("thiet-bi/su-kien")}>
              {tbm.hongLau.length ? (
                <ul className="grid gap-1 text-xs">
                  {tbm.hongLau.slice(0, 6).map((e, i) => (
                    <li key={i} className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/40 px-2 py-1.5">
                      <span className="h-6 w-1.5 rounded-full" style={{ background: e.ngay > (tb.T?.lau ?? 7) ? MAU.bad : MAU.warn }} />
                      <span className="min-w-0 flex-1"><b className="block truncate">{e.ma_xe}</b><span className="block truncate text-[0.6875rem] text-muted-foreground">{tb.vmap[e.ma_xe]?.doi || ""} · từ {ngayNam(e.ngay_vao)}{e.phu_tung === "Chờ phụ tùng" ? " · chờ phụ tùng" : ""}</span></span>
                      <b className="tabular-nums">{e.ngay} ngày</b>
                    </li>))}
                </ul>) : <ChuaCo>Không có thiết bị đang hỏng.</ChuaCo>}
            </Khung>
          </div>
          <ChiTiet id="doi" ten="Bảng đội xe (từng thiết bị, đỏ = hỏng)">
          <Khung ten="Bảng đội xe" phu="mỗi ô một thiết bị · đỏ hỏng · tím bảo dưỡng chiến lược" onChiTiet={() => onMo("thiet-bi")}>
            <BangDoiXe nhom={tbm.nhom} onXe={() => go("thiet-bi/su-kien")} />
          </Khung>
          </ChiTiet>
        </MangTQ>)}
    </div>
  );
}
