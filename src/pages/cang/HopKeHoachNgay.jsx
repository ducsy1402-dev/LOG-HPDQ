import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Eraser, Rows4, Ruler, Save, Wand2 } from "lucide-react";
import { useApp } from "@/store";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Empty } from "@/components/common";
import { so, soGon, plain, thangCua, tenThang, congThang, DAY } from "@/lib/format";
import { docSo } from "@/lib/paste";
import { ngayCuaThang } from "@/lib/sanLuongTT";
import { dongHang } from "@/lib/sanLuong";
import { klCanLam, trangThai, TRANG_THAI, TRANG_THAI_HIEN, doanBen } from "@/lib/linetime";
import { xepHangBen } from "./Gantt";
import { cacTuyen, viTriTrenLich } from "@/lib/capBen";
import { ngayCuaChuyen, chiaDeuTheoGio, thucTeNgay, ngayDia } from "@/lib/keHoachNgay";
import { cn } from "@/lib/utils";
import { useNhomHang } from "./useNhomHang";
import { tenBen } from "./BangTauBen";

// Kế hoạch ngày (nút "Kế hoạch ngày" của Mục tiêu sản lượng › Khai thác cảng, SQL 13) — thiết kế lại 14/11/2026 theo ý anh Sỹ (từ 15/11: xếp tàu GIỐNG Linetime › Lịch cầu bến theo bến, không còn theo cụm bến):
// VỪA XEM LINE TÀU VỪA LẬP KẾ HOẠCH CHI TIẾT TỪNG TÀU.
//   • Line tàu cập của tháng như Linetime: mỗi CỤM BẾN (tuyến bến B03 – B05 – B10…) một khối, tàu nằm trong khối theo ngày ở bến (tàu trùng ngày xếp thành nhiều làn),
//     màu thanh theo trạng thái tàu; mỗi ngày tàu ở bến là một ô hiện số tấn kế hoạch của tàu trong ngày đó.
//   • Bấm một ô của tàu, hoặc ô Kế hoạch nhập / Kế hoạch xuất ở dưới cùng, thì hiện HỘP NHỎ liệt kê các tàu đang làm hàng ngày đó (ô Kế hoạch nhập / xuất: chỉ tàu hướng đó)
//     với ô nhập số tấn cho từng tàu; gõ xong số tổng hiện ngay ra các ô bên ngoài (dòng Kế hoạch nhập / xuất cộng theo ngày).
//   • Nhập liệu trở lên sửa được; bấm Lưu kế hoạch mới ghi. Lọc hướng / loại hàng áp cho cả dòng cộng; thực nhập / xuất lấy từ bảng Sản lượng thực tế.
const THU = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const fmt = (n) => (n ? soGon(n) : "");
const gio = (t) => (t ? new Date(t).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");
const hDua = (v) => (v.huong === "xuat" ? "xuat" : "nhap");
const LABEL = 118, MPX = 0.6, PAD_MET = 6; // MPX: pixel cho mỗi mét ở chế độ theo mét // bề rộng cột tên cụm bến, chiều cao một làn tàu

// Khung nhập theo ngày (hộp nhỏ): các tàu đang làm hàng trong một ngày, mỗi tàu một ô nhập số tấn. Số gõ vào ghi thẳng vào bảng nháp của hộp lớn (chưa lưu).
// Khung nằm CẠNH line tàu (bên phải), không nổi lên trên: không bao giờ che line hay các dòng cộng, nên vừa gõ vừa thấy số tổng đổi.
function KhungNgay({ ngay, huong, ds, vid, giaTri, hienThi, datO, goiY, chiaDeu, xoaTau, onDong, nhap, now, tongTau }) {
  const khung = useRef();
  useEffect(() => { // mở khung là gõ được ngay: tàu vừa bấm (hoặc tàu đầu tiên)
    const h = setTimeout(() => {
      const els = [...(khung.current?.querySelectorAll("input[data-tau]") || [])];
      (els.find((e) => e.dataset.tau === String(vid)) || els[0])?.focus();
    }, 60);
    return () => clearTimeout(h);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const tong = ds.reduce((s, x) => s + giaTri(x.v, ngay), 0);
  const dd = ngay.slice(8) + "/" + ngay.slice(5, 7);
  const dienGoiY = () => { for (const x of ds) { const g = goiY(x.v, ngay); if (g > 0 && !giaTri(x.v, ngay)) datO(x.v, ngay, soGon(g)); } };
  const phim = (e, i) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const els = [...khung.current.querySelectorAll("input[data-tau]")];
      if (els[i + 1]) { els[i + 1].focus(); els[i + 1].select(); } else e.target.blur();
    }
  };
  return (
    <div className="flex max-h-[68vh] w-full shrink-0 flex-col rounded-lg border bg-card text-sm shadow-sm lg:sticky lg:top-0 lg:w-[380px]">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <div className="min-w-0 flex-1"><b>Ngày {dd}</b><span className="ml-1.5 text-xs text-muted-foreground">{huong ? (huong === "nhap" ? "tàu hàng nhập" : "tàu hàng xuất") : "mọi tàu đang làm hàng"} · {ds.length} tàu</span></div>
        <button type="button" onClick={onDong} className="rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground" title="Đóng khung nhập theo ngày">Đóng</button>
      </div>
      <div ref={khung} className="min-h-0 flex-1 overflow-auto">
        {ds.length ? ds.map((x, i) => {
          const { v } = x, st = TRANG_THAI[trangThai(v, now)], kl = klCanLam(v), tt = tongTau(v), g = goiY(v, ngay);
          return (
            <div key={v.id} className={cn("flex items-center gap-2 border-b px-3 py-2 last:border-b-0", String(v.id) === String(vid) && "bg-primary/5")}>
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: st.mau }} title={st.ten} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5"><b className="truncate">{v.ten_tau}</b><Badge tone={v.huong === "xuat" ? "warn" : "info"} className="shrink-0">{v.huong === "xuat" ? "Xuất" : "Nhập"}</Badge></div>
                <div className="truncate text-[0.6875rem] text-muted-foreground">{[...new Set(x.dong.map((h) => h.loai))].join(", ") || v.ten_hang || "—"} · {v.ben_ma ? tenBen(v.ben_ma) : "chưa bến"}</div>
                <div className="text-[0.6875rem] tabular-nums text-muted-foreground">KL tàu {so(kl, 0)} t · đã KH <b className={cn(kl > 0 && tt > kl + 1 ? "text-bad" : "text-foreground")}>{so(tt, 0)}</b> t{kl > 0 ? ` · còn ${so(Math.max(0, kl - tt), 0)}` : ""}</div>
              </div>
              {nhap && <div className="flex shrink-0 flex-col items-end gap-0.5">
                <div className="flex items-center gap-1">
                  <input data-tau={v.id} className="h-8 w-24 rounded-md border border-input bg-background px-2 text-right tabular-nums focus:border-ring focus:outline-none" inputMode="decimal" placeholder={g > 0 ? soGon(g) : "0"} value={hienThi(v, ngay)}
                    onChange={(e) => datO(v, ngay, e.target.value)} onKeyDown={(e) => phim(e, i)} onFocus={(e) => e.target.select()} aria-label={`${v.ten_tau} ngày ${dd}`} />
                  <span className="text-xs text-muted-foreground">t</span>
                </div>
                <div className="flex items-center gap-0.5">
                  <button type="button" onClick={() => chiaDeu(v)} className="rounded p-1 text-muted-foreground hover:text-primary" title="Chia đều khối lượng tàu cho các ngày làm hàng theo giờ dự kiến" aria-label={`Chia đều ${v.ten_tau}`}><Wand2 className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => xoaTau(v)} className="rounded p-1 text-muted-foreground hover:text-bad" title="Xóa kế hoạch của tàu trong tháng" aria-label={`Xóa kế hoạch ${v.ten_tau}`}><Eraser className="h-3.5 w-3.5" /></button>
                </div>
              </div>}
              {!nhap && <b className="tabular-nums">{fmt(giaTri(v, ngay)) || "—"}</b>}
            </div>);
        }) : <div className="px-3 py-6 text-center text-xs text-muted-foreground">Không có tàu nào đang làm hàng ngày này (theo bộ lọc).</div>}
      </div>
      <div className="flex items-center gap-2 border-t px-3 py-2">
        <span className="text-xs text-muted-foreground">Tổng ngày {dd}</span><b className="tabular-nums">{so(tong, 0)} t</b>
        {nhap && ds.length > 0 && <Button size="xs" variant="outline" className="ml-auto" onClick={dienGoiY} title="Điền số gợi ý (chia theo giờ làm hàng dự kiến) vào các tàu còn trống">Điền gợi ý</Button>}
      </div>
    </div>
  );
}

export default function HopKeHoachNgay({ thang0, onClose, onLuu }) {
  const { D, api, quyen, run, toast } = useApp();
  const nhomHang = useNhomHang(), nhap = quyen.keHoachNgay;
  const [thang, setThang] = useState(thang0 || thangCua(D.now));
  const [loc, setLoc] = useState({ nhom: "", huong: "" });
  const [rows, setRows] = useState(undefined); // kế hoạch đã lưu; undefined: đang tải · null: chưa chạy SQL 13
  const [thucTe, setThucTe] = useState([]);
  const [lan, setLan] = useState(0);
  const [sua, setSua] = useState({}); // ô đã gõ: "mã chuyến|ngày" -> chữ
  const [cua, setCua] = useState({ co: 14, bat: 0 }); // cửa sổ ngày: số ngày (31 = cả tháng) và vị trí ngày đầu
  const [pop, setPop] = useState(null); // hộp nhỏ đang mở: { ngay, huong, vid }
  // Trục dọc như Linetime › Lịch cầu bến: "ben" mỗi bến một dòng · "met" theo mét dọc từng tuyến bến; nhớ ở máy, mặc định theo lựa chọn ở Linetime
  const [truc, setTruc] = useState(() => { try { return (localStorage.getItem("lg-khn-truc") ?? localStorage.getItem("lg-gantt-truc")) === "met" ? "met" : "ben"; } catch { return "ben"; } });
  const doiTruc = (k) => { setPop(null); setTruc(k); try { localStorage.setItem("lg-khn-truc", k); } catch { /* bỏ qua */ } };
  // Ẩn / hiện thanh khối lượng ở dưới cùng (Kế hoạch / Thực nhập, xuất); nhớ trên máy
  // Xem gọn (như Linetime › Gọn): thanh tàu thấp hơn (một dòng ô số), xem được nhiều tàu một lúc; nhớ trên máy
  const [gon, setGon] = useState(() => { try { return localStorage.getItem("lg-khn-gon") === "1"; } catch { return false; } });
  const LH = gon ? 34 : 50;
  const [anTong, setAnTong] = useState(() => { try { return localStorage.getItem("lg-khn-an-tong") === "1"; } catch { return false; } });
  const doiAnTong = () => setAnTong((v) => { try { localStorage.setItem("lg-khn-an-tong", v ? "0" : "1"); } catch { /* bỏ qua */ } return !v; });
  const ngays = useMemo(() => ngayCuaThang(thang), [thang]);
  const homNay = ngayDia(D.now);
  useEffect(() => { // đổi tháng: cửa sổ về đầu tháng, hoặc quanh hôm nay nếu là tháng này
    const i = ngays.indexOf(homNay);
    setCua((c) => ({ ...c, bat: i >= 0 && c.co < 31 ? Math.max(0, Math.min(i - 2, ngays.length - c.co)) : 0 }));
  }, [ngays]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    let huy = false; setRows(undefined); setSua({}); setPop(null);
    Promise.all([api.docKeHoachNgay(ngays[0], ngays[ngays.length - 1]), api.docSanLuongThang("cang", thang).catch(() => null)])
      .then(([r, sl]) => { if (!huy) { setRows(r); setThucTe(sl?.thucTe || []); } }).catch(() => { if (!huy) setRows(null); });
    return () => { huy = true; };
  }, [api, ngays, thang, lan]);

  // Các ngày tàu CÓ MẶT ở bến: ngày giao với các đoạn chiếm bến (cùng đoạn bến mà Lịch cầu bến vẽ); rời đúng 0:00 thì ngày đó không tính
  const ngayCuaDoan = (v) => {
    const out = new Set();
    for (const d of doanBen(v, D.stopsOf(v.id), D.now)) { const t0 = new Date(d.a); t0.setHours(0, 0, 0, 0); for (let t = t0.getTime(); t < Math.max(d.b, d.a + 1); t += DAY) out.add(ngayDia(t)); }
    return [...out];
  };
  const goc = useMemo(() => { const m = {}; for (const r of rows || []) m[`${r.voyage_id}|${String(r.ngay).slice(0, 10)}`] = +r.khoi_luong || 0; return m; }, [rows]);
  // Line tàu: chuyến chiếm bến trong tháng, theo giờ cập; lọc theo loại hàng (nhóm hàng) và hướng
  const tatCa = useMemo(() => {
    const t = new Set(ngays);
    return D.voyages.filter((v) => !v.huy).map((v) => ({ v, ben: ngayCuaDoan(v), dong: dongHang(v, nhomHang) }))
      .filter((x) => x.ben.some((n) => t.has(n)) || ngays.some((n) => `${x.v.id}|${n}` in goc))
      .sort((a, b) => (new Date(a.v.atb || a.v.etb || a.v.eta).getTime() || 0) - (new Date(b.v.atb || b.v.etb || b.v.eta).getTime() || 0));
  }, [D.voyages, nhomHang, ngays, goc]);
  const dsNhom = useMemo(() => [...new Set(tatCa.flatMap((x) => x.dong.map((h) => h.loai)))].sort((a, b) => a.localeCompare(b, "vi")), [tatCa]);
  const loc2 = useMemo(() => tatCa.filter((x) => (!loc.huong || hDua(x.v) === loc.huong) && (!loc.nhom || x.dong.some((h) => plain(h.loai) === plain(loc.nhom)))), [tatCa, loc]);
  const size = Math.min(cua.co, ngays.length), bat = Math.max(0, Math.min(cua.bat, ngays.length - size)), hien = ngays.slice(bat, bat + size);
  const tapHien = useMemo(() => new Set(hien), [hien]);
  const CW = size <= 7 ? 150 : size <= 14 ? 100 : 82; // bề rộng một cột ngày
  // Chỉ hiện tàu có mặt trong cửa sổ (ở bến hoặc đã có kế hoạch trong các ngày đang xem)
  const tau = useMemo(() => loc2.filter((x) => x.ben.some((n) => tapHien.has(n)) || hien.some((n) => `${x.v.id}|${n}` in goc)), [loc2, tapHien, hien, goc]);

  const key = (v, n) => `${v.id}|${n}`;
  const giaTri = (v, n) => { const k = key(v, n); return k in sua ? docSo(sua[k]) || 0 : goc[k] || 0; };
  const hienThi = (v, n) => { const k = key(v, n); return k in sua ? sua[k] : fmt(goc[k]); };
  const datO = (v, n, txt) => setSua((o) => ({ ...o, [key(v, n)]: txt }));
  const kDirty = Object.keys(sua).filter((k) => (sua[k] || "").trim() !== fmt(goc[k]));
  const tongTau = (v) => ngays.reduce((s, n) => s + giaTri(v, n), 0);
  // Phần của chuyến thuộc loại hàng đang lọc (chuyến nhiều dòng hàng chia theo khối lượng từng dòng); không lọc = cả chuyến
  const phan = (x) => {
    if (!loc.nhom) return 1;
    const tong = x.dong.reduce((s, h) => s + h.kl, 0), c = x.dong.filter((h) => plain(h.loai) === plain(loc.nhom));
    return tong > 0 ? c.reduce((s, h) => s + h.kl, 0) / tong : c.length ? 1 / x.dong.length : 0;
  };
  const khNgay = (n, h) => loc2.filter((x) => hDua(x.v) === h).reduce((s, x) => s + giaTri(x.v, n) * phan(x), 0);
  const thuc = useMemo(() => ({ nhap: thucTeNgay(thucTe, ngays, "nhap", loc.nhom), xuat: thucTeNgay(thucTe, ngays, "xuat", loc.nhom) }), [thucTe, ngays, loc.nhom]);
  const goiY = (v, n) => chiaDeuTheoGio(v).get(n) || 0;
  const oMo = (x, n) => x.ben.includes(n) || `${x.v.id}|${n}` in goc;

  // ---- Line tàu là BẢN SAO của Linetime › Lịch cầu bến (theo bến): dùng đúng hàm xếp tàu vào dòng bến của lịch (xepHangBen), thanh tàu đặt theo GIỜ thật; mỗi ngày tàu ở bến là một ô số tấn. ----
  const tuMs = new Date(hien[0] + "T00:00:00").getTime(), denMs = tuMs + hien.length * DAY;
  const hang = useMemo(() => xepHangBen(D, loc2.map((x) => x.v), tuMs, denMs, "ben", { row: 30, lan: LH, top: 4 }), [D.voyages, D.berths, D.now, loc2, tuMs, denMs, LH]); // eslint-disable-line react-hooks/exhaustive-deps
  const xOf = (t) => ((t - tuMs) / DAY) * CW;
  // Theo mét (như GanttMet): mỗi tuyến bến một dải, tàu nằm đúng vị trí mét (viTriTrenLich: không chồng, tàu một bến trong bến, tàu hai bến vắt qua ranh giới); chiều cao thanh theo LOA
  const dai = useMemo(() => {
    const thu = new Map(D.berths.map((b, i) => [String(b.ma), i]));
    const ds = [...cacTuyen(D.berths).values()].filter((t) => t.den > t.tu).sort((a, b) => Math.min(...a.bens.map((x) => thu.get(x.ma) ?? 99)) - Math.min(...b.bens.map((x) => thu.get(x.ma) ?? 99)));
    let y = 0;
    return ds.map((t) => { const h = (t.den - t.tu) * MPX + PAD_MET * 2, r = { t, y, h }; y += h; return r; });
  }, [D.berths]);
  const metTau = useMemo(() => (truc === "met" ? viTriTrenLich(loc2.map((x) => x.v), D.berths, D.stopsOf, tuMs, denMs, D.now) : []), [truc, D.voyages, D.berths, D.now, loc2, tuMs, denMs]); // eslint-disable-line react-hooks/exhaustive-deps
  const thuTu = useMemo(() => new Map(hang.flatMap((r) => r.ds).reverse().map((x, i, a) => [x.v.id, a.length - i])), [hang]);

  const chiaDeu = (v) => {
    const m = chiaDeuTheoGio(v), moi = {};
    for (const n of ngays) { const k = key(v, n), tan = m.get(n) || 0; if (tan > 0 || goc[k]) moi[k] = tan > 0 ? soGon(tan) : ""; }
    setSua((o) => ({ ...o, ...moi }));
  };
  const xoaTau = (v) => setSua((o) => { const n = { ...o }; for (const d of ngays) if (goc[key(v, d)] || key(v, d) in o) n[key(v, d)] = ""; return n; });
  const luu = async () => {
    const out = [];
    for (const k of kDirty) {
      const [vid, ngay] = k.split("|"), txt = (sua[k] || "").trim(), tan = txt ? docSo(txt) : null;
      if (txt && !(tan >= 0)) return toast(`Ngày ${ngay.slice(8)}/${ngay.slice(5, 7)}: "${txt}" không phải số tấn`, "bad");
      if (tan == null && !(k in goc)) continue;
      out.push({ voyage_id: +vid, ngay, khoi_luong: tan });
    }
    if (!out.length) { setSua({}); return; }
    if (await run(() => api.saveKeHoachNgay(out), `Đã lưu kế hoạch ngày (${out.length} ô)`)) { setLan((x) => x + 1); onLuu?.(); }
  };

  const moHop = (e, o) => setPop(o); // bấm một ô (của tàu hoặc dòng cộng): mở khung nhập theo ngày bên phải
  const dichCua = (so_) => { setPop(null); setCua((o) => ({ ...o, bat: Math.max(0, Math.min(o.bat + so_, ngays.length - Math.min(o.co, ngays.length))) })); };
  const veHomNay = () => { const i = ngays.indexOf(homNay); if (i >= 0) { setPop(null); setCua((o) => ({ ...o, bat: Math.max(0, Math.min(i - 2, ngays.length - Math.min(o.co, ngays.length))) })); } };
  const doiCo = (co) => { setPop(null); setCua((o) => ({ co, bat: co >= 31 ? 0 : Math.max(0, Math.min(o.bat, ngays.length - co)) })); };
  // Tàu của hộp nhỏ: đang làm hàng ngày đó (theo hướng nếu mở từ ô Kế hoạch nhập / xuất), xếp theo thứ tự trên line
  const dsHop = pop ? loc2.filter((x) => oMo(x, pop.ngay) && (!pop.huong || hDua(x.v) === pop.huong)).sort((a, b) => (thuTu.get(a.v.id) ?? 999) - (thuTu.get(b.v.id) ?? 999)) : [];

  // Lọc theo loại hàng: bên (nhập / xuất) không có tàu nào ứng với loại hàng đó thì ẩn dòng cộng của bên đó (anh Sỹ 17/11/2026)
  const coTauBen = (h) => loc2.some((x) => hDua(x.v) === h);
  const dongTong = [["nhap", "Kế hoạch nhập", "Thực nhập"], ["xuat", "Kế hoạch xuất", "Thực xuất"]].filter(([h]) => (!loc.huong || loc.huong === h) && (!loc.nhom || coTauBen(h)));
  const W = hien.length * CW;
  const cotNgay = (n) => { const d = new Date(n + "T00:00:00"); return { cn0: d.getDay() === 0, hn: n === homNay, d }; };
  // Nền lưới ngày dùng chung cho mọi khối (cột hôm nay tô xanh nhạt, chủ nhật tô xám)
  const luoi = hien.map((n, i) => { const { cn0, hn } = cotNgay(n); return <div key={n} className={cn("absolute inset-y-0 border-l", hn ? "bg-primary/10" : cn0 && "bg-muted/50")} style={{ left: i * CW, width: CW }} />; });

  // Một thanh tàu (dùng chung cho hai chế độ): đặt theo giờ thật từ a tới b; mỗi ngày tàu ở bến một ô số tấn. Thanh đủ cao (≥ 44 px) thì hai dòng (tên + ô số), thấp hơn thì chỉ một dòng ô số (tên xem ở ghi chú khi trỏ chuột)
  const thanh = (kk, v, a, b, st, top, h) => {
    const stt = TRANG_THAI[st], kl = klCanLam(v), tong = tongTau(v), vuot = kl > 0 && tong > kl + 1;
    const left = Math.max(0, xOf(a)), right = Math.min(W, xOf(b)), w = Math.max(6, right - left), haiDong = h >= 44;
    return (
      <div key={kk} className="absolute overflow-hidden rounded-md text-white shadow-sm" style={{ left: left + 1, width: w - 2, top, height: h, background: stt.mau }}
        title={`${v.ten_tau} · ${v.huong === "xuat" ? "Xuất" : "Nhập"} · ${stt.ten}\nBến ${v.ben_ma ? tenBen(v.ben_ma) : "chưa xếp"} · cập ${gio(a)} → rời ${gio(b)}\nKL tàu ${so(kl, 0)} t · KH tháng ${so(tong, 0)} t`}>
        {haiDong && (
          <div className="flex h-[19px] items-center gap-1.5 px-1.5 text-[0.6875rem] font-semibold leading-none">
            <span className="truncate">{v.uu_tien ? "★ " : ""}{v.ten_tau}</span>
            <span className="shrink-0 rounded bg-black/25 px-1 py-0.5 font-normal">{v.huong === "xuat" ? "Xuất" : "Nhập"}</span>
            <span className={cn("ml-auto shrink-0 font-normal tabular-nums", vuot && "rounded bg-bad px-1 py-0.5 font-semibold")} title={vuot ? "Kế hoạch trong tháng vượt khối lượng tàu" : "Kế hoạch tháng / khối lượng tàu"}>KH {so(tong, 0)}/{so(kl, 0)} t</span>
          </div>)}
        {/* Mỗi ngày tàu ở bến một ô: nằm đúng phần của ngày đó trên thanh (ngày chỉ ở bến một phần thì ô hẹp hơn) */}
        {hien.map((n, i) => {
          const cL = Math.max(left, i * CW), cR = Math.min(right, (i + 1) * CW);
          if (cR - cL < 0.5) return null;
          const k = key(v, n), co = k in sua && sua[k].trim() !== fmt(goc[k]), val = giaTri(v, n);
          return (
            <button key={n} type="button" disabled={!nhap} onClick={(e) => moHop(e, { ngay: n, huong: null, vid: v.id })} aria-label={`${v.ten_tau} ngày ${n.slice(8)}`}
              className={cn("absolute flex items-center border-l border-white/15 bg-black/20", nhap && "cursor-pointer hover:bg-black/40", co && "ring-2 ring-inset ring-amber-300", pop?.ngay === n && pop?.vid === v.id && "bg-black/50")}
              style={{ left: cL - left - 1, width: cR - cL, top: haiDong ? 19 : 0, height: haiDong ? 25 : h }}>
              <span className={cn("block w-full truncate px-1 text-right tabular-nums", val ? "font-semibold" : "opacity-50")}>{val ? soGon(val) : nhap && cR - cL > 14 ? "+" : ""}</span>
            </button>);
        })}
      </div>);
  };
  const chuaBen = loc2.filter((x) => !x.v.ben_ma).length;

  return (
    <Dialog onOpenChange={(o) => !o && onClose()} className="max-w-[min(1500px,calc(100vw-24px))]" title="Kế hoạch sản lượng theo ngày"
      description="Line tàu cập trong tháng, xếp giống Linetime › Lịch cầu bến (mỗi bến một dòng): bấm một ô ngày để mở khung nhập bên phải, nhập số tấn kế hoạch cho từng tàu đang làm hàng ngày đó.">
      {rows === null ? <div className="rounded-md border border-warn/40 bg-warn/5 px-3 py-2 text-sm">Chưa có bảng kế hoạch ngày: quản trị cần chạy <b>sql/13_ke_hoach_san_luong_ngay.sql</b> trong Supabase.</div> : (
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <NativeSelect className="h-7 w-44 text-xs" value={thang} onChange={(e) => { if (kDirty.length && !confirm("Có số chưa lưu. Bỏ thay đổi để chuyển tháng?")) return; setThang(e.target.value); }} aria-label="Tháng"
              options={Array.from({ length: 13 }, (_, i) => congThang(thangCua(D.now), i - 6)).map((x) => [x, tenThang(x) + (x === thangCua(D.now) ? " (này)" : "")])} />
            <NativeSelect className="h-7 w-40 text-xs" value={loc.nhom} onChange={(e) => { setPop(null); setLoc({ ...loc, nhom: e.target.value }); }} placeholder="Tất cả loại hàng" options={dsNhom} aria-label="Lọc theo loại hàng" />
            <NativeSelect className="h-7 w-32 text-xs" value={loc.huong} onChange={(e) => { setPop(null); setLoc({ ...loc, huong: e.target.value }); }} placeholder="Nhập + xuất" options={[["nhap", "Hàng nhập"], ["xuat", "Hàng xuất"]]} aria-label="Lọc theo hướng" />
            <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="Trục dọc" title="Cách xếp tàu giống Linetime › Lịch cầu bến">
              {[["ben", "Theo bến", "Mỗi bến một dòng"], ["met", "Theo mét", "Dọc theo mét từng tuyến bến: tàu nằm đúng vị trí mét"]].map(([k, t, mo]) => (
                <Button key={k} size="xs" variant={truc === k ? "secondary" : "ghost"} className={cn(truc === k && "text-primary")} title={mo} aria-pressed={truc === k} onClick={() => doiTruc(k)}>{k === "met" ? <Ruler /> : <Rows4 />}{t}</Button>))}
            </div>
            <Button size="xs" variant={gon ? "secondary" : "outline"} className={cn(gon && "text-primary")} aria-pressed={gon} title="Thanh tàu thấp, xem được nhiều tàu hơn"
              onClick={() => { setPop(null); setGon(!gon); try { localStorage.setItem("lg-khn-gon", gon ? "0" : "1"); } catch { /* bỏ qua */ } }}><Rows4 />Gọn</Button>
            <div className="inline-flex items-center gap-1 rounded-md border px-1" title="Số ngày hiển thị">
              {[[7, "7 ngày"], [14, "14 ngày"], [31, "Cả tháng"]].map(([co, ten]) => <button key={co} type="button" onClick={() => doiCo(co)} className={cn("rounded px-1.5 py-0.5 text-xs", cua.co === co ? "bg-primary/15 font-semibold text-primary" : "text-muted-foreground hover:text-foreground")}>{ten}</button>)}
            </div>
            {size < ngays.length && <div className="flex items-center gap-1">
              <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => dichCua(-size)} disabled={bat === 0} aria-label="Các ngày trước"><ChevronLeft /></Button>
              <span className="min-w-[6.5rem] text-center text-xs tabular-nums text-muted-foreground">{hien[0]?.slice(8)}/{hien[0]?.slice(5, 7)} – {hien[hien.length - 1]?.slice(8)}/{hien[hien.length - 1]?.slice(5, 7)}</span>
              <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => dichCua(size)} disabled={bat + size >= ngays.length} aria-label="Các ngày sau"><ChevronRight /></Button>
              {ngays.includes(homNay) && <Button size="xs" variant="ghost" onClick={veHomNay}>Hôm nay</Button>}
            </div>}
            <span className="text-xs text-muted-foreground">{rows === undefined ? "Đang tải…" : `${tau.length}/${loc2.length} chuyến`}</span>
            <div className="ml-auto flex items-center gap-2">
              {kDirty.length > 0 && <Button size="sm" variant="outline" onClick={() => setSua({})}>Bỏ thay đổi</Button>}
              {nhap && <Button size="sm" disabled={!kDirty.length} onClick={luu}><Save />Lưu kế hoạch{kDirty.length ? ` (${kDirty.length} ô)` : ""}</Button>}
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
          {tau.length || rows === undefined ? (
            <div className="scroll-x max-h-[68vh] rounded-md border">
              <div style={{ width: LABEL + W }} className="relative select-none text-xs">
                {/* Tiêu đề ngày */}
                <div className="sticky top-0 z-20 flex border-b bg-card">
                  <div className="sticky left-0 z-30 flex shrink-0 items-center border-r bg-card px-2 font-semibold text-muted-foreground" style={{ width: LABEL }}>Bến</div>
                  {hien.map((n) => { const { cn0, hn, d } = cotNgay(n);
                    return <div key={n} className={cn("shrink-0 border-l py-1 text-center leading-tight", hn && "bg-primary/10", cn0 && !hn && "bg-muted/60", pop?.ngay === n && "bg-primary/25 ring-1 ring-inset ring-primary")} style={{ width: CW }}>
                      <div className="font-semibold tabular-nums">{n.slice(8)}/{n.slice(5, 7)}</div><div className={cn("text-[0.6875rem]", cn0 ? "text-bad" : "text-muted-foreground")}>{THU[d.getDay()]}{hn ? " · nay" : ""}</div></div>; })}
                </div>

                {truc === "ben" ? hang.map((r) => (
                  <div key={r.ma || "_"} className="flex border-b">
                    <div className="sticky left-0 z-10 flex shrink-0 flex-col justify-center border-r bg-card px-2" style={{ width: LABEL }}>
                      <span className="font-mono text-[0.8125rem] font-semibold leading-tight">{r.b ? tenBen(r.ma) : "Chưa xếp bến"}</span>
                      {r.ds.length > 0 && <span className="text-[0.6875rem] text-muted-foreground">{new Set(r.ds.map((x) => x.v.id)).size} tàu</span>}
                    </div>
                    <div className="relative shrink-0" style={{ width: W, height: r.h }}>
                      {luoi}
                      {r.ds.map((x) => thanh(`${x.v.id}:${x.a}`, x.v, x.a, x.b, x.st, x.top, LH - 6))}
                    </div>
                  </div>
                )) : dai.map((d) => (
                  <div key={d.t.ma} className="flex border-b-2 border-muted-foreground/40">
                    <div className="sticky left-0 z-10 shrink-0 border-r bg-card" style={{ width: LABEL, height: d.h }}>
                      {d.t.bens.map((b) => (
                        <div key={b.ma} className="absolute inset-x-0 flex flex-col justify-center overflow-hidden px-2 leading-tight" style={{ top: PAD_MET + (b.tu - d.t.tu) * MPX, height: (b.den - b.tu) * MPX }} title={`Bến ${b.ma}: mét ${b.tu}–${b.den}`}>
                          <span className="font-mono text-[0.8125rem] font-semibold">{tenBen(b.ma)}</span>
                          {(b.den - b.tu) * MPX > 30 && <span className="truncate text-[0.6875rem] tabular-nums text-muted-foreground">{b.tu}–{b.den} m</span>}
                        </div>))}
                    </div>
                    <div className="relative shrink-0" style={{ width: W, height: d.h }}>
                      {luoi}
                      {d.t.bens.slice(1).map((b) => <div key={b.ma} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-muted-foreground/50" style={{ top: PAD_MET + (b.tu - d.t.tu) * MPX }} />)}
                      {metTau.filter((it) => it.tuyen.ma === d.t.ma).map((it) => thanh(`${it.v.id}:${it.seg.a}`, it.v, it.seg.a, it.seg.b, trangThai(it.v, D.now), PAD_MET + (it.x - d.t.tu) * MPX, Math.max(8, it.L * MPX)))}
                    </div>
                  </div>
                ))}
                {truc === "met" && chuaBen > 0 && <div className="px-2 py-1 text-[0.6875rem] text-muted-foreground">{chuaBen} chuyến chưa có bến (không vẽ trên lịch theo mét)</div>}
                {(truc === "ben" ? !hang.some((r) => r.ds.length) : !metTau.length) && <div className="py-6 text-center text-muted-foreground">Không có chuyến nào trong các ngày này. Bấm ▶ để xem các ngày sau.</div>}

                {/* Dòng cộng: kế hoạch (bấm để mở hộp nhỏ) và thực tế */}
                <div className="sticky bottom-0 z-20 border-t-2 bg-card">
                  <div className="flex h-6 border-b">
                    <button type="button" onClick={doiAnTong} className="sticky left-0 z-10 flex shrink-0 items-center gap-1 bg-card px-2 text-[0.6875rem] font-medium text-muted-foreground hover:text-foreground" title={anTong ? "Hiện lại thanh khối lượng kế hoạch / thực tế" : "Ẩn thanh khối lượng để xem line tàu rộng hơn"}>
                      {anTong ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}{anTong ? "Hiện thanh khối lượng" : "Ẩn thanh khối lượng"}
                    </button>
                  </div>
                  {!anTong && dongTong.flatMap(([h, tenKh, tenTt]) => [
                    <div key={h + "k"} className="flex border-b font-semibold">
                      <div className="sticky left-0 z-10 flex shrink-0 flex-col justify-center border-r bg-card px-2 py-1" style={{ width: LABEL }}>
                        <span>{tenKh}{loc.nhom ? ` · ${loc.nhom}` : ""}</span><span className="text-[0.6875rem] font-normal tabular-nums text-muted-foreground">tháng {so(ngays.reduce((s, n) => s + khNgay(n, h), 0), 0)} t</span></div>
                      {hien.map((n) => { const t = khNgay(n, h), { hn } = cotNgay(n); return (
                        <button key={n} type="button" disabled={!nhap} onClick={(e) => moHop(e, { ngay: n, huong: h, vid: null })} title={nhap ? "Bấm để nhập kế hoạch từng tàu trong ngày" : undefined}
                          className={cn("shrink-0 border-l bg-card px-1.5 text-right tabular-nums", hn && "bg-primary/10", nhap && "cursor-pointer hover:bg-accent", pop?.ngay === n && pop?.huong === h && "bg-accent")} style={{ width: CW }}>{t ? so(t, 0) : <span className="text-muted-foreground/50">{nhap ? "+" : ""}</span>}</button>); })}
                    </div>,
                    <div key={h + "t"} className="flex border-b font-semibold text-primary">
                      <div className="sticky left-0 z-10 flex shrink-0 flex-col justify-center border-r bg-card px-2 py-1" style={{ width: LABEL }}>
                        <span>{tenTt}{loc.nhom ? ` · ${loc.nhom}` : ""}</span><span className="text-[0.6875rem] font-normal tabular-nums text-muted-foreground">tháng {so(thuc[h].reduce((s, x) => s + x, 0), 0)} t</span></div>
                      {hien.map((n) => { const t = thuc[h][ngays.indexOf(n)], { hn } = cotNgay(n); return <div key={n} className={cn("shrink-0 border-l bg-card px-1.5 py-1 text-right tabular-nums", hn && "bg-primary/10")} style={{ width: CW }}>{t ? so(t, 0) : ""}</div>; })}
                    </div>,
                  ])}
                </div>
              </div>
            </div>
          ) : <Empty>Không có chuyến tàu nào trong {tenThang(thang).toLowerCase()}{loc.nhom || loc.huong ? " ứng với bộ lọc" : ""}. Thêm chuyến ở Khai thác Cảng › Linetime.</Empty>}
          </div>
          {pop && <KhungNgay key={`${pop.ngay}|${pop.huong}|${pop.vid}`} ngay={pop.ngay} huong={pop.huong} vid={pop.vid} ds={dsHop} nhap={nhap} now={D.now}
            giaTri={giaTri} hienThi={hienThi} datO={datO} goiY={goiY} chiaDeu={chiaDeu} xoaTau={xoaTau} tongTau={tongTau} onDong={() => setPop(null)} />}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.6875rem] text-muted-foreground">
            {TRANG_THAI_HIEN.map(([k, t]) => <span key={k} className="flex items-center gap-1"><i className="inline-block h-2.5 w-4 rounded-sm" style={{ background: t.mau }} />{t.ten}</span>)}
            <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-4 rounded-sm ring-2 ring-amber-400" />Ô đã gõ, chưa lưu</span>
          </div>
          <p className="text-[0.6875rem] text-muted-foreground">{nhap ? "Bấm ô ngày của một tàu (hoặc ô Kế hoạch nhập / xuất ở dưới cùng) để mở khung nhập theo ngày bên phải: mỗi tàu đang làm hàng ngày đó có một ô nhập số tấn (Enter sang tàu kế tiếp); số tổng hiện ra các ô bên ngoài. Cây đũa phép chia đều khối lượng tàu theo giờ làm hàng dự kiến, cục tẩy xóa kế hoạch của tàu trong tháng, \"Điền gợi ý\" điền số chia theo giờ cho các tàu còn trống. Bấm Lưu kế hoạch để ghi. Thực nhập / thực xuất lấy từ bảng Sản lượng thực tế." : "Vai trò Xem chỉ xem kế hoạch."}</p>

        </div>)}
    </Dialog>
  );
}
