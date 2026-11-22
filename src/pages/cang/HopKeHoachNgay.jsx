import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Download, Eraser, Rows4, Save, Wand2 } from "lucide-react";
import { xuatExcel, ngayVN } from "@/lib/xuatExcel";
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
import { ngayCuaChuyen, chiaDeuTheoGio, thucTeNgay, ngayDia, dichKeHoach, dauMocKH } from "@/lib/keHoachNgay";
import { cn } from "@/lib/utils";
import { useNhomHang } from "./useNhomHang";
import { tenBen, noiHaiBen } from "./BangTauBen";

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
const LABEL = 118; // bề rộng cột tên cụm bến

// Khung nhập theo ngày (hộp nhỏ): các tàu đang làm hàng trong một ngày, mỗi tàu một ô nhập số tấn. Số gõ vào ghi thẳng vào bảng nháp của hộp lớn (chưa lưu).
// Khung nằm CẠNH line tàu (bên phải), không nổi lên trên: không bao giờ che line hay các dòng cộng, nên vừa gõ vừa thấy số tổng đổi.
function KhungNgay({ ngay, huong, ds, dsTruoc = [], hienTruoc = false, vid, giaTri, hienThi, datO, goiY, chiaDeu, xoaTau, onDong, nhap, now, tongTau, onTiep }) {
  const khung = useRef();
  useEffect(() => { // mở khung là gõ được ngay: tàu vừa bấm (hoặc tàu đầu tiên)
    const h = setTimeout(() => {
      const els = [...(khung.current?.querySelectorAll("input[data-tau]") || [])];
      (els.find((e) => e.dataset.tau === String(vid)) || els[0])?.focus();
    }, 60);
    return () => clearTimeout(h);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const tong = [...ds, ...dsTruoc].reduce((s, x) => s + giaTri(x.v, ngay), 0);
  const dd = ngay.slice(8) + "/" + ngay.slice(5, 7);
  const dienGoiY = () => { for (const x of ds) { const g = goiY(x.v, ngay); if (g > 0 && !giaTri(x.v, ngay)) datO(x.v, ngay, soGon(g)); } };
  const phim = (e, i) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const els = [...khung.current.querySelectorAll("input[data-tau]")];
      if (els[i + 1]) { els[i + 1].focus(); els[i + 1].select(); } else e.target.blur();
    }
  };
  // Một dòng tàu của khung; truoc = tàu xuất sắp cập (ngày này là ngày xuất kho TRƯỚC khi tàu cập: không có gợi ý chia theo giờ, không có đũa phép)
  const dong1 = (x, i, truoc) => {
    const { v } = x, st = TRANG_THAI[trangThai(v, now)], kl = klCanLam(v), tt = tongTau(v), g = truoc ? 0 : goiY(v, ngay);
    return (
      <div key={v.id} className={cn("group flex items-center gap-2 border-b px-3 py-2 last:border-b-0", String(v.id) === String(vid) && "bg-primary/5")}>
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: st.mau }} title={st.ten} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5"><b className="truncate">{v.ten_tau}</b><Badge tone={v.huong === "xuat" ? "warn" : "info"} className="shrink-0">{v.huong === "xuat" ? "Xuất" : "Nhập"}</Badge></div>
          <div className="truncate text-[0.6875rem] text-muted-foreground">{[...new Set(x.dong.map((h) => h.loai))].join(", ") || v.ten_hang || "—"} · {truoc ? `cập ${x.ben[0].slice(8)}/${x.ben[0].slice(5, 7)}` : v.ben_ma ? tenBen(v.ben_ma) : "chưa bến"}</div>
          <div className="text-[0.6875rem] tabular-nums text-muted-foreground">KL tàu {so(kl, 0)} t · đã KH <b className={cn(kl > 0 && tt > kl + 1 ? "text-bad" : "text-foreground")}>{so(tt, 0)}</b> t{kl > 0 ? ` · còn ${so(Math.max(0, kl - tt), 0)}` : ""}</div>
        </div>
        {nhap && <div className="flex shrink-0 flex-col items-end gap-0.5">
          <div className="flex items-center gap-1">
            <input data-tau={v.id} className="h-8 w-24 rounded-md border border-input bg-background px-2 text-right tabular-nums focus:border-ring focus:outline-none" inputMode="decimal" placeholder={g > 0 ? soGon(g) : "0"} value={hienThi(v, ngay)}
              onChange={(e) => datO(v, ngay, e.target.value)} onKeyDown={(e) => phim(e, i)} onFocus={(e) => e.target.select()} aria-label={`${v.ten_tau} ngày ${dd}${truoc ? " (xuất trước khi cập)" : ""}`} />
            <span className="text-xs text-muted-foreground">t</span>
          </div>
          <div className="flex items-center gap-0.5">
            {!truoc && <button type="button" onClick={() => chiaDeu(v)} className="rounded p-1 text-muted-foreground hover:text-primary" title="Chia khối lượng tàu cho các ngày theo tỉ lệ giờ làm hàng trong từng ngày (từ lúc làm hàng tới ETD)" aria-label={`Chia đều ${v.ten_tau}`}><Wand2 className="h-3.5 w-3.5" /></button>}
            <button type="button" onClick={() => xoaTau(v)} className="rounded p-1 text-muted-foreground hover:text-bad" title="Xóa kế hoạch của tàu trong tháng" aria-label={`Xóa kế hoạch ${v.ten_tau}`}><Eraser className="h-3.5 w-3.5" /></button>
          </div>
        </div>}
        {!nhap && <b className="tabular-nums">{fmt(giaTri(v, ngay)) || "—"}</b>}
        {/* Mũi tên hiện khi trỏ vào dòng tàu: mở hộp tiếp theo bên cạnh (Kế hoạch tổng hợp: phân xe, xuất / nhập kho) */}
        {onTiep && <button type="button" onClick={(e) => onTiep(v, e.currentTarget)} className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-primary focus:opacity-100 group-hover:opacity-100" title="Phân xe và xuất / nhập kho của tàu trong ngày" aria-label={`Phân xe và kho: ${v.ten_tau}`}><ChevronRight className="h-5 w-5" /></button>}
      </div>);
  };
  return (
    <div className="flex max-h-[68vh] w-full shrink-0 flex-col rounded-lg border bg-card text-sm shadow-sm lg:sticky lg:top-0 lg:w-[380px]">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <div className="min-w-0 flex-1"><b>Ngày {dd}</b><span className="ml-1.5 text-xs text-muted-foreground">{huong ? (huong === "nhap" ? "tàu hàng nhập" : "tàu hàng xuất") : "mọi tàu đang làm hàng"} · {ds.length} tàu</span></div>
        <button type="button" onClick={onDong} className="rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground" title="Đóng khung nhập theo ngày">Đóng</button>
      </div>
      <div ref={khung} className="min-h-0 flex-1 overflow-auto">
        {ds.map((x, i) => dong1(x, i, false))}
        {hienTruoc && (
          <>
            <div className="sticky top-0 z-10 border-y bg-muted/60 px-3 py-1.5 text-xs font-semibold" title="Ngày này tàu chưa cập: số tấn nhập ở đây là xuất kho TRƯỚC khi tàu cập (kho → tàu), tính vào kế hoạch xuất của ngày này">
              Xuất kho trước khi tàu cập <span className="font-normal text-muted-foreground">· {dsTruoc.length} tàu xuất sắp cập</span>
            </div>
            {dsTruoc.map((x, j) => dong1(x, ds.length + j, true))}
            {!dsTruoc.length && <div className="px-3 py-3 text-center text-xs text-muted-foreground">Không có tàu xuất nào cập trong 31 ngày tới (theo bộ lọc).</div>}
          </>)}
        {!ds.length && !hienTruoc && <div className="px-3 py-6 text-center text-xs text-muted-foreground">Không có tàu nào đang làm hàng ngày này (theo bộ lọc).</div>}
      </div>
      <div className="flex items-center gap-2 border-t px-3 py-2">
        <span className="text-xs text-muted-foreground">Tổng ngày {dd}</span><b className="tabular-nums">{so(tong, 0)} t</b>
        {nhap && ds.length > 0 && <Button size="xs" variant="outline" className="ml-auto" onClick={dienGoiY} title="Điền số gợi ý (chia theo giờ làm hàng dự kiến) vào các tàu còn trống">Điền gợi ý</Button>}
      </div>
    </div>
  );
}

// nhung: dùng làm NỘI DUNG của một tab (không bọc hộp thoại riêng). tiepTheo({ v, ngay, neo, tong, onDong }): hiện mũi tên ở mỗi dòng tàu của khung nhập theo ngày, bấm thì dựng hộp tiếp theo bên cạnh.
export default function HopKeHoachNgay({ thang0, onClose, onLuu, nhung, tiepTheo }) {
  const { D, api, quyen, run, toast, fail } = useApp();
  const nhomHang = useNhomHang(), nhap = quyen.keHoachNgay;
  const [thang, setThang] = useState(thang0 || thangCua(D.now));
  const [loc, setLoc] = useState({ nhom: "", huong: "" });
  const [raw, setRaw] = useState(undefined); // kế hoạch đã lưu trong CSDL (rộng hơn tháng ±60 ngày, để dời theo lịch tàu); undefined: đang tải · null: chưa chạy SQL 13
  const [thucTe, setThucTe] = useState([]);
  const [lan, setLan] = useState(0);
  const [sua, setSua] = useState({}); // ô đã gõ: "mã chuyến|ngày" -> chữ
  const [cua, setCua] = useState({ co: 14, bat: 0 }); // cửa sổ ngày: số ngày (31 = cả tháng) và vị trí ngày đầu
  const [pop, setPop] = useState(null); // hộp nhỏ đang mở: { ngay, huong, vid }
  const [tiep, setTiep] = useState(null); // hộp tiếp theo của một tàu: { v, ngay, neo }
  useEffect(() => { if (!pop) setTiep(null); }, [pop]);
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
    let huy = false; setRaw(undefined); setSua({}); setPop(null);
    const moc = (n, k) => ngayDia(new Date(n + "T00:00:00").getTime() + k * DAY);
    Promise.all([api.docKeHoachNgay(moc(ngays[0], -60), moc(ngays[ngays.length - 1], 60)), api.docSanLuongThang("cang", thang).catch(() => null)])
      .then(([r, sl]) => { if (!huy) { setRaw(r); setThucTe(sl?.thucTe || []); } }).catch(() => { if (!huy) setRaw(null); });
    return () => { huy = true; };
  }, [api, ngays, thang, lan]);
  // Kế hoạch đã dời theo lịch tàu hiện tại (lịch tàu đổi thì khối lượng các ngày chia lại theo tỉ lệ thời gian); rows: các ngày của tháng đang xem
  const dich = useMemo(() => (raw ? dichKeHoach(raw, new Map(D.voyages.map((v) => [v.id, v])), D.now) : null), [raw, D.voyages, D.now]);
  const rows = useMemo(() => (raw === undefined ? undefined : raw === null ? null : dich.rows.filter((r) => r.ngay >= ngays[0] && r.ngay <= ngays[ngays.length - 1])), [raw, dich, ngays]);

  // Các ngày tàu CÓ MẶT ở bến: ngày giao với các đoạn chiếm bến (cùng đoạn bến mà Lịch cầu bến vẽ); rời đúng 0:00 thì ngày đó không tính
  const ngayCuaDoan = (v) => {
    const out = new Set();
    for (const d of doanBen(v, D.stopsOf(v.id), D.now)) { const t0 = new Date(d.a); t0.setHours(0, 0, 0, 0); for (let t = t0.getTime(); t < Math.max(d.b, d.a + 1); t += DAY) out.add(ngayDia(t)); }
    return [...out];
  };
  const goc = useMemo(() => { const m = {}; for (const r of rows || []) m[`${r.voyage_id}|${String(r.ngay).slice(0, 10)}`] = +r.khoi_luong || 0; return m; }, [rows]);
  // Line tàu: chuyến chiếm bến trong tháng, theo giờ cập; lọc theo loại hàng (nhóm hàng) và hướng
  // Tàu đã gõ số (chưa lưu) trong tháng cũng nằm trong danh sách, để số xuất trước khi cập hiện ngay ra thanh tàu và dòng cộng
  const suaSig = Object.entries(sua).filter(([, t]) => (t || "").trim()).map(([k]) => k.split("|")[0]).sort().join(",");
  const suaIds = useMemo(() => new Set(suaSig ? suaSig.split(",") : []), [suaSig]);
  const tatCa = useMemo(() => {
    const t = new Set(ngays);
    return D.voyages.filter((v) => !v.huy).map((v) => ({ v, ben: ngayCuaDoan(v), dong: dongHang(v, nhomHang) }))
      .filter((x) => x.ben.some((n) => t.has(n)) || ngays.some((n) => `${x.v.id}|${n}` in goc) || suaIds.has(String(x.v.id)))
      .sort((a, b) => (new Date(a.v.atb || a.v.etb || a.v.eta).getTime() || 0) - (new Date(b.v.atb || b.v.etb || b.v.eta).getTime() || 0));
  }, [D.voyages, nhomHang, ngays, goc, suaIds]);
  const tatMap = useMemo(() => new Map(tatCa.map((x) => [x.v.id, x])), [tatCa]);
  // Danh sách loại hàng của bộ lọc: đang lọc hướng thì chỉ các loại hàng của tàu hướng đó (anh Sỹ 21/11/2026)
  const nhomCuaHuong = (h) => [...new Set(tatCa.filter((x) => !h || hDua(x.v) === h).flatMap((x) => x.dong.map((d) => d.loai)))].sort((a, b) => a.localeCompare(b, "vi"));
  const dsNhom = useMemo(() => nhomCuaHuong(loc.huong), [tatCa, loc.huong]); // eslint-disable-line react-hooks/exhaustive-deps
  const loc2 = useMemo(() => tatCa.filter((x) => (!loc.huong || hDua(x.v) === loc.huong) && (!loc.nhom || x.dong.some((h) => plain(h.loai) === plain(loc.nhom)))), [tatCa, loc]);
  const size = Math.min(cua.co, ngays.length), bat = Math.max(0, Math.min(cua.bat, ngays.length - size)), hien = ngays.slice(bat, bat + size);
  const tapHien = useMemo(() => new Set(hien), [hien]);
  const CW = size <= 7 ? 150 : size <= 14 ? 100 : 82; // bề rộng một cột ngày
  // Chỉ hiện tàu có mặt trong cửa sổ (ở bến hoặc đã có kế hoạch trong các ngày đang xem)

  const key = (v, n) => `${v.id}|${n}`;
  const giaTri = (v, n) => { const k = key(v, n); return k in sua ? docSo(sua[k]) || 0 : goc[k] || 0; };
  const hienThi = (v, n) => { const k = key(v, n); return k in sua ? sua[k] : fmt(goc[k]); };
  const datO = (v, n, txt) => setSua((o) => ({ ...o, [key(v, n)]: txt }));
  const kDirty = Object.keys(sua).filter((k) => (sua[k] || "").trim() !== fmt(goc[k]));
  const tongTau = (v) => ngays.reduce((s, n) => s + giaTri(v, n), 0);
  // XUẤT KHO TRƯỚC KHI TÀU CẬP (anh Sỹ 21/11/2026): tàu xuất có thể được xuất kho ra những ngày TRƯỚC ngày cập. Các ngày này lưu chung bảng kế hoạch ngày (chuyến + ngày, không cần SQL mới).
  // truocNgay: tàu xuất -> các ngày liền nhau từ ngày sớm nhất đã có số kế hoạch tới ngày liền trước ngày đầu tiên ở bến (trong tháng đang xem); thanh tàu vẽ một dải nét đứt cho các ngày này.
  const coSo = (v, n) => { const k = key(v, n); return k in sua ? (sua[k] || "").trim() !== "" : goc[k] > 0; };
  const truocNgay = useMemo(() => {
    const m = new Map();
    for (const x of tatCa) {
      if (x.v.huong !== "xuat" || !x.ben.length) continue;
      const dau = x.ben[0], co = ngays.filter((n) => n < dau && coSo(x.v, n));
      if (co.length) m.set(x.v.id, ngays.filter((n) => n >= co[0] && n < dau));
    }
    return m;
  }, [tatCa, ngays, goc, sua]); // eslint-disable-line react-hooks/exhaustive-deps
  const somSig = [...truocNgay].map(([id, ds]) => id + ":" + ds[0]).join(",");
  const tau = useMemo(() => loc2.filter((x) => x.ben.some((n) => tapHien.has(n)) || hien.some((n) => `${x.v.id}|${n}` in goc) || (truocNgay.get(x.v.id) || []).some((n) => tapHien.has(n))), [loc2, tapHien, hien, goc, somSig]); // eslint-disable-line react-hooks/exhaustive-deps
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
  // Hàng bến ghép (B03/05…) giống Lịch cầu bến: cùng cài đặt nút "Bến ghép" ở Linetime (lg-gantt-ghep, mặc định bật)
  const ghep = D.coSql28 && (() => { try { return localStorage.getItem("lg-gantt-ghep") !== "0"; } catch { return true; } })();
  const hangTat = useMemo(() => xepHangBen(D, loc2.map((x) => x.v), tuMs, denMs, "ben", { row: 30, lan: LH, top: 4 }, { ghep, som: (v) => { const ds = truocNgay.get(v.id); return ds ? new Date(ds[0] + "T00:00:00").getTime() : null; } }), [D.voyages, D.berths, D.now, loc2, tuMs, denMs, LH, ghep, somSig]); // eslint-disable-line react-hooks/exhaustive-deps
  // Đang lọc (hướng hoặc loại hàng) thì ẩn bến không có tàu nào thuộc bộ lọc trong các ngày đang xem (anh Sỹ 19/11/2026)
  const dangLoc = !!(loc.huong || loc.nhom);
  const hang = useMemo(() => (dangLoc ? hangTat.filter((r) => r.ds.length) : hangTat), [hangTat, dangLoc]);
  const xOf = (t) => ((t - tuMs) / DAY) * CW;
  const thuTu = useMemo(() => new Map(hang.flatMap((r) => r.ds).reverse().map((x, i, a) => [x.v.id, a.length - i])), [hang]);

  const chiaDeu = (v) => {
    const m = chiaDeuTheoGio(v), moi = {};
    for (const n of ngays) { const k = key(v, n), tan = m.get(n) || 0; if (tan > 0 || goc[k]) moi[k] = tan > 0 ? soGon(tan) : ""; }
    setSua((o) => ({ ...o, ...moi }));
  };
  const xoaTau = (v) => setSua((o) => { const n = { ...o }; for (const d of ngays) if (goc[key(v, d)] || key(v, d) in o) n[key(v, d)] = ""; return n; });
  const luu = async () => {
    const suaChuyen = new Map(); // mã chuyến -> Map ngày -> tấn | null (số vừa gõ)
    for (const k of kDirty) {
      const [vid, ngay] = k.split("|"), txt = (sua[k] || "").trim(), tan = txt ? docSo(txt) : null;
      if (txt && !(tan >= 0)) return toast(`Ngày ${ngay.slice(8)}/${ngay.slice(5, 7)}: "${txt}" không phải số tấn`, "bad");
      if (tan == null && !(k in goc)) continue;
      if (!suaChuyen.has(+vid)) suaChuyen.set(+vid, new Map());
      suaChuyen.get(+vid).set(ngay, tan);
    }
    if (!suaChuyen.size) { setSua({}); return; }
    // Mỗi chuyến có số vừa sửa số được GHI LẠI TOÀN BỘ các dòng (đã dời theo lịch tàu hiện tại, kèm dấu mốc lịch tàu), dòng cũ ở ngày không còn thì xóa;
    // không ghi lẻ từng ô để khỏi lẫn dòng chưa dời với dòng đã dời
    const out = [];
    for (const [vid, sm] of suaChuyen) {
      const v = D.voyages.find((x) => x.id === vid), dau = v ? dauMocKH(v) : null;
      const moi = new Map(dich.rows.filter((r) => r.voyage_id === vid).map((r) => [r.ngay, +r.khoi_luong || 0]));
      for (const [ngay, tan] of sm) { if (tan > 0) moi.set(ngay, tan); else moi.delete(ngay); }
      for (const [ngay, tan] of moi) if (tan > 0) out.push({ voyage_id: vid, ngay, khoi_luong: tan, ghi_chu: dau });
      for (const r of raw.filter((x) => x.voyage_id === vid)) { const n = String(r.ngay).slice(0, 10); if (!(moi.get(n) > 0)) out.push({ voyage_id: vid, ngay: n, khoi_luong: null }); }
    }
    if (await run(() => api.saveKeHoachNgay(out), `Đã lưu kế hoạch ngày (${kDirty.length} ô)`)) { setLan((x) => x + 1); onLuu?.(); }
  };

  const moHop = (e, o) => setPop(o); // bấm một ô (của tàu hoặc dòng cộng): mở khung nhập theo ngày bên phải
  const dichCua = (so_) => { setPop(null); setCua((o) => ({ ...o, bat: Math.max(0, Math.min(o.bat + so_, ngays.length - Math.min(o.co, ngays.length))) })); };
  const veHomNay = () => { const i = ngays.indexOf(homNay); if (i >= 0) { setPop(null); setCua((o) => ({ ...o, bat: Math.max(0, Math.min(i - 2, ngays.length - Math.min(o.co, ngays.length))) })); } };
  const doiCo = (co) => { setPop(null); setCua((o) => ({ co, bat: co >= 31 ? 0 : Math.max(0, Math.min(o.bat, ngays.length - co)) })); };
  // Tàu của hộp nhỏ: đang làm hàng ngày đó (theo hướng nếu mở từ ô Kế hoạch nhập / xuất), xếp theo thứ tự trên line
  // Tàu xuất sắp cập (ngày đầu tiên ở bến SAU ngày của hộp): ngày này là xuất kho TRƯỚC khi tàu cập. Gồm tàu cập trong 31 ngày tới (xuất trước nhiều ngày) và tàu đã có số xuất trước ở ngày này.
  const truocCap = (x, n) => x.v.huong === "xuat" && x.ben.length > 0 && n < x.ben[0];
  const dsHop = pop ? loc2.filter((x) => oMo(x, pop.ngay) && !truocCap(x, pop.ngay) && (!pop.huong || hDua(x.v) === pop.huong)).sort((a, b) => (thuTu.get(a.v.id) ?? 999) - (thuTu.get(b.v.id) ?? 999)) : [];
  const dsTruocHop = useMemo(() => {
    if (!pop || pop.huong === "nhap" || loc.huong === "nhap") return [];
    const toi = ngayDia(new Date(pop.ngay + "T00:00:00").getTime() + 31 * DAY);
    return D.voyages.filter((v) => v.huong === "xuat" && !v.huy).map((v) => tatMap.get(v.id) || { v, ben: ngayCuaDoan(v), dong: dongHang(v, nhomHang) })
      .filter((x) => x.ben.length && x.ben[0] > pop.ngay && (x.ben[0] <= toi || coSo(x.v, pop.ngay)) && (!loc.nhom || x.dong.some((h) => plain(h.loai) === plain(loc.nhom))))
      .sort((a, b) => (a.ben[0] < b.ben[0] ? -1 : a.ben[0] > b.ben[0] ? 1 : String(a.v.ten_tau).localeCompare(String(b.v.ten_tau), "vi"))).slice(0, 40);
  }, [pop, loc, D.voyages, tatMap, nhomHang, goc, sua]); // eslint-disable-line react-hooks/exhaustive-deps
  // Nút "xuất trước" trên thanh tàu: mở hộp nhập của NGÀY LIỀN TRƯỚC ngày cập (kéo cửa sổ ngày tới đó nếu đang ngoài tầm nhìn)
  const moXuatTruoc = (v, dau) => {
    const i = ngays.indexOf(dau);
    if (i <= 0) return toast("Tàu cập từ đầu tháng: chọn tháng trước để lập kế hoạch xuất trước khi cập", "warn");
    const n = ngays[i - 1];
    if (!tapHien.has(n)) setCua((o) => ({ ...o, bat: Math.max(0, Math.min(i - 2, ngays.length - Math.min(o.co, ngays.length))) }));
    setPop({ ngay: n, huong: "xuat", vid: v.id });
  };

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
    // Dải XUẤT TRƯỚC KHI CẬP (nét đứt) bên trái thanh tàu xuất, ở đoạn bến đầu tiên của chuyến: mỗi ngày một ô số tấn như ngày tàu ở bến
    const x0 = tatMap.get(v.id), dsTr = truocNgay.get(v.id), laDau = !!(x0 && x0.ben[0] && ngayDia(a) === x0.ben[0]);
    let dai = null;
    if (dsTr && laDau) {
      const sx = Math.max(0, xOf(new Date(dsTr[0] + "T00:00:00").getTime())), se = Math.min(W, xOf(new Date(x0.ben[0] + "T00:00:00").getTime()));
      if (se - sx > 1) dai = (
        <div key={kk + "p"} className="absolute overflow-hidden rounded-md border-2 border-dashed text-white" style={{ left: sx + 1, width: se - sx - 2, top, height: h, borderColor: stt.mau, background: stt.mau + "40" }}
          title={`${v.ten_tau}: xuất kho TRƯỚC khi tàu cập (${dsTr.length} ngày, trước ngày ${x0.ben[0].slice(8)}/${x0.ben[0].slice(5, 7)})`}>
          {haiDong && <div className="flex h-[19px] items-center gap-1.5 px-1.5 text-[0.6875rem] font-semibold leading-none"><span className="truncate">{se - sx > 190 ? `⏪ Xuất trước khi cập · ${v.ten_tau}` : "⏪ xuất trước"}</span>
            {nhap && ngays.indexOf(dsTr[0]) > 0 && se - sx > 90 && <button type="button" onClick={() => moXuatTruoc(v, dsTr[0])} className="ml-auto shrink-0 rounded bg-black/25 px-1 py-0.5 text-[0.625rem] font-normal hover:bg-black/45" title="Thêm một ngày xuất trước nữa (ngày liền trước ngày đầu của dải này)">{se - sx > 190 ? "+ ngày trước" : "+1"}</button>}</div>}
          {hien.map((n, i) => {
            if (!dsTr.includes(n)) return null;
            const cL = Math.max(sx, i * CW), cR = Math.min(se, (i + 1) * CW);
            if (cR - cL < 0.5) return null;
            const k = key(v, n), co = k in sua && sua[k].trim() !== fmt(goc[k]), val = giaTri(v, n);
            return (
              <button key={n} type="button" disabled={!nhap} onClick={(e) => moHop(e, { ngay: n, huong: "xuat", vid: v.id })} aria-label={`${v.ten_tau} ngày ${n.slice(8)} (xuất trước khi cập)`}
                className={cn("absolute flex items-center border-l border-white/15 bg-black/20", nhap && "cursor-pointer hover:bg-black/40", co && "ring-2 ring-inset ring-amber-300", pop?.ngay === n && pop?.vid === v.id && "bg-black/50")}
                style={{ left: cL - sx - 3, width: cR - cL, top: haiDong ? 19 : 0, height: haiDong ? 25 : h }}>
                <span className={cn("block w-full truncate px-1 text-right tabular-nums", val ? "font-semibold" : "opacity-50")}>{val ? soGon(val) : nhap && cR - cL > 14 ? "+" : ""}</span>
              </button>);
          })}
        </div>);
    }
    const thanhTrong = xOf(b) > 0 && xOf(a) < W; // tàu cập sau cửa sổ ngày thì chỉ vẽ dải xuất trước
    return (
      <Fragment key={kk}>
        {dai}
        {thanhTrong && (
      <div className="absolute overflow-hidden rounded-md text-white shadow-sm" style={{ left: left + 1, width: w - 2, top, height: h, background: stt.mau }}
        title={`${v.ten_tau} · ${v.huong === "xuat" ? "Xuất" : "Nhập"} · ${stt.ten}\nBến ${v.ben_ma ? tenBen(v.ben_ma) : "chưa xếp"} · cập ${gio(a)} → rời ${gio(b)}\nKL tàu ${so(kl, 0)} t · KH tháng ${so(tong, 0)} t`}>
        {haiDong && (
          <div className="flex h-[19px] items-center gap-1.5 px-1.5 text-[0.6875rem] font-semibold leading-none">
            <span className="truncate">{v.uu_tien ? "★ " : ""}{v.ten_tau}</span>
            <span className="shrink-0 rounded bg-black/25 px-1 py-0.5 font-normal">{v.huong === "xuat" ? "Xuất" : "Nhập"}</span>
            {nhap && v.huong === "xuat" && laDau && w > 120 && <button type="button" onClick={() => moXuatTruoc(v, x0.ben[0])} className="shrink-0 rounded bg-black/25 px-1 py-0.5 text-[0.625rem] font-normal hover:bg-black/45" title="Xuất kho cho tàu TRƯỚC ngày cập: bấm để nhập số tấn cho ngày liền trước ngày cập" aria-label={`Xuất trước khi cập: ${v.ten_tau}`}>{w > 250 ? "⏪ xuất trước" : "⏪"}</button>}
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
      </div>)}
      </Fragment>);
  };

  // Xuất Excel kế hoạch theo ngày: mỗi chuyến một dòng (các chuyến đang lọc), các cột là ngày của tháng; số đang hiện, kể cả số đã gõ chưa lưu
  const xuatKH = () => {
    const hang = [["Tàu", "Hướng", "Hàng", "Khối lượng (t)", ...ngays.map(ngayVN), "Tổng kế hoạch (t)"]], tongNgay = ngays.map(() => 0);
    for (const x of loc2) {
      const v = x.v, gt = ngays.map((n) => giaTri(v, n)), tong = gt.reduce((s, q) => s + q, 0); gt.forEach((q, i) => { tongNgay[i] += q; });
      hang.push([v.ten_tau, hDua(v) === "xuat" ? "Xuất" : "Nhập", x.dong.map((d) => d.loai).join(", "), klCanLam(v), ...gt.map((q) => q || ""), tong || ""]);
    }
    hang.push(["Cộng", "", "", "", ...tongNgay.map((q) => q || ""), tongNgay.reduce((s, q) => s + q, 0)]);
    return xuatExcel(`Ke-hoach-cang-${thang}`, [{ ten: `Kế hoạch Cảng ${thang}`, hang }], { toast, fail });
  };

  const noiDung = (
    <>
      {rows === null ? <div className="rounded-md border border-warn/40 bg-warn/5 px-3 py-2 text-sm">Chưa có bảng kế hoạch ngày: quản trị cần chạy <b>sql/13_ke_hoach_san_luong_ngay.sql</b> trong Supabase.</div> : (
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <NativeSelect className="h-7 w-44 text-xs" value={thang} onChange={(e) => { if (kDirty.length && !confirm("Có số chưa lưu. Bỏ thay đổi để chuyển tháng?")) return; setThang(e.target.value); }} aria-label="Tháng"
              options={Array.from({ length: 13 }, (_, i) => congThang(thangCua(D.now), i - 6)).map((x) => [x, tenThang(x) + (x === thangCua(D.now) ? " (này)" : "")])} />
            <NativeSelect className="h-7 w-40 text-xs" value={loc.nhom} onChange={(e) => { setPop(null); setLoc({ ...loc, nhom: e.target.value }); }} placeholder="Tất cả loại hàng" options={dsNhom} aria-label="Lọc theo loại hàng" />
            <NativeSelect className="h-7 w-32 text-xs" value={loc.huong} onChange={(e) => { setPop(null); const h = e.target.value; setLoc({ huong: h, nhom: loc.nhom && nhomCuaHuong(h).some((n) => plain(n) === plain(loc.nhom)) ? loc.nhom : "" }); }} placeholder="Nhập + xuất" options={[["nhap", "Hàng nhập"], ["xuat", "Hàng xuất"]]} aria-label="Lọc theo hướng" />
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
              <Button size="sm" variant="outline" onClick={xuatKH} title="Xuất bảng ra file Excel"><Download />Xuất Excel</Button>
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

                {hang.map((r) => (
                  <div key={r.ma || "_"} className={cn("flex border-b", r.cap && "bg-primary/[0.05]")}>
                    <div className={cn("sticky left-0 z-10 flex shrink-0 flex-col justify-center border-r bg-card px-2", r.cap && "border-l-2 border-l-primary/60")} style={{ width: LABEL }}>
                      <span className={cn("font-mono text-[0.8125rem] font-semibold leading-tight", r.cap && "text-primary")}>{r.cap ? `⇕ ${noiHaiBen(r.cap[0], r.cap[1])}` : r.b ? tenBen(r.ma) : "Chưa xếp bến"}</span>
                      {r.ds.length > 0 && <span className="text-[0.6875rem] text-muted-foreground">{new Set(r.ds.map((x) => x.v.id)).size} tàu</span>}
                    </div>
                    <div className="relative shrink-0" style={{ width: W, height: r.h }}>
                      {luoi}
                      {r.ds.map((x) => thanh(`${x.v.id}:${x.a}`, x.v, x.a, x.b, x.st, x.top, LH - 6))}
                    </div>
                  </div>
                ))}
                {!hang.some((r) => r.ds.length) && <div className="py-6 text-center text-muted-foreground">Không có chuyến nào trong các ngày này. Bấm ▶ để xem các ngày sau.</div>}

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
          {pop && <KhungNgay key={`${pop.ngay}|${pop.huong}|${pop.vid}`} ngay={pop.ngay} huong={pop.huong} vid={pop.vid} ds={dsHop} dsTruoc={dsTruocHop} hienTruoc={pop.huong !== "nhap" && loc.huong !== "nhap"} nhap={nhap} now={D.now}
            giaTri={giaTri} hienThi={hienThi} datO={datO} goiY={goiY} chiaDeu={chiaDeu} xoaTau={xoaTau} tongTau={tongTau} onDong={() => setPop(null)}
            onTiep={tiepTheo ? (v, neo) => setTiep({ v, ngay: pop.ngay, neo }) : undefined} />}
          {pop && tiep && tiepTheo({ ...tiep, tong: giaTri(tiep.v, tiep.ngay), onDong: () => setTiep(null) })}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.6875rem] text-muted-foreground">
            {TRANG_THAI_HIEN.map(([k, t]) => <span key={k} className="flex items-center gap-1"><i className="inline-block h-2.5 w-4 rounded-sm" style={{ background: t.mau }} />{t.ten}</span>)}
            <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-4 rounded-sm ring-2 ring-amber-400" />Ô đã gõ, chưa lưu</span>
            <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-4 rounded-sm border-2 border-dashed border-slate-400" />Xuất kho trước khi tàu cập (nét đứt, bên trái thanh tàu xuất)</span>
          </div>
          <p className="text-[0.6875rem] text-muted-foreground">{nhap ? "Bấm ô ngày của một tàu (hoặc ô Kế hoạch nhập / xuất ở dưới cùng) để mở khung nhập theo ngày bên phải: mỗi tàu đang làm hàng ngày đó có một ô nhập số tấn (Enter sang tàu kế tiếp); số tổng hiện ra các ô bên ngoài. Cây đũa phép chia đều khối lượng tàu theo giờ làm hàng dự kiến, cục tẩy xóa kế hoạch của tàu trong tháng, \"Điền gợi ý\" điền số chia theo giờ cho các tàu còn trống. Bấm Lưu kế hoạch để ghi. Muốn xuất kho cho tàu xuất TRƯỚC ngày cập: bấm nút \"⏪ xuất trước\" trên thanh tàu (hoặc mở khung của ngày đó, mục \"Xuất kho trước khi tàu cập\") rồi nhập số tấn; các ngày này hiện thành dải nét đứt bên trái thanh tàu và tính vào kế hoạch xuất của ngày đó. Thực nhập / thực xuất lấy từ bảng Sản lượng thực tế." : "Vai trò Xem chỉ xem kế hoạch."}</p>

        </div>)}
    </>
  );
  if (nhung) return noiDung;
  return (
    <Dialog onOpenChange={(o) => !o && onClose()} className="max-w-[min(1500px,calc(100vw-24px))]" title="Kế hoạch Cảng"
      description="Line tàu cập trong tháng, xếp giống Linetime › Lịch cầu bến (mỗi bến một dòng): bấm một ô ngày để mở khung nhập bên phải, nhập số tấn kế hoạch cho từng tàu đang làm hàng ngày đó.">
      {noiDung}
    </Dialog>
  );
}
