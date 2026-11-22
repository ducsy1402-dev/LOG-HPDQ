import { useEffect, useLayoutEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import { RefreshCw, KeyRound, LogOut, ShieldAlert, Download, Anchor, FileSpreadsheet, FileText, BookOpen, MonitorDown } from "lucide-react";
import { AppProvider, useApp, useHash } from "./store";
import { Toasts } from "./components/common";
import { Dialog } from "./components/ui/dialog";
import { Button } from "./components/ui/button";
import { Input, Field } from "./components/ui/input";
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from "./components/ui/menu";
import { APP_NAME, VAI_TRO, DEMO } from "./config";
import { cn } from "./lib/utils";
import { TEN_SUA, tenDangNhap } from "./lib/quyen";
import { saoLuuExcel } from "./lib/backup";
import { ThietBiProvider, useThietBi, TB, TBCho, TBToanCuc } from "./thietbi/Host";
import KhaiBao from "./thietbi/tabs/KhaiBao";
import DieuDo from "./thietbi/tabs/DieuDo";
import LookupDialog from "./thietbi/components/LookupDialog";
import { exportExcel } from "./thietbi/lib/excel";
import TongQuan from "./pages/TongQuan";
import Linetime from "./pages/cang/Linetime";
import TuGhiATD from "./pages/cang/TuGhiATD";
import TuDoiKeHoach from "./pages/cang/TuDoiKeHoach";
import PhieuChuyen from "./pages/cang/PhieuChuyen";
import DangNhap from "./pages/DangNhap";
import { TRANG, PHAN_HE, CHUYEN_MO_HOP, tachRoute, duocDung } from "./khung/menu";
import { ThanhBenMayTinh, NganKeoMenu } from "./khung/ThanhBen";
import ThanhTren, { ThanhDuoi } from "./khung/ThanhTren";
import TimNhanh from "./khung/TimNhanh";
import ChuThich from "./khung/ChuThich";
import { TrangSkeleton } from "./khung/Skeleton";
import AppBackground from "./khung/AppBackground";
import "./khung/khung.css";

const DanhMuc = lazy(() => import("./pages/DanhMuc"));
const PhanQuyen = lazy(() => import("./pages/PhanQuyen"));
const MucTieu = lazy(() => import("./pages/cang/MucTieu"));
const Kho = lazy(() => import("./pages/kho/Kho"));

// ?xem-dang-nhap: xem thử trang đăng nhập (kể cả khi đang chạy ?demo, vốn bỏ qua đăng nhập); không đăng nhập thật
const XEM_DANG_NHAP = typeof location !== "undefined" && new URLSearchParams(location.search).has("xem-dang-nhap");

export default function App() {
  return <AppProvider><Shell /><Toasts /></AppProvider>;
}

function Shell() {
  const { phase } = useApp();
  if (phase === "loading") return <div role="status" className="fixed inset-0 grid place-items-center text-white" style={{ background: "linear-gradient(180deg,#0d3274,#071b42)" }}><div className="grid justify-items-center gap-3"><div className="sb-logo sk" style={{ width: 52, height: 52, borderRadius: 15 }}><Anchor className="h-6 w-6" strokeWidth={2.3} /></div><div className="text-sm text-white/80">Đang khởi động…</div></div></div>;
  if (phase === "login" || XEM_DANG_NHAP) return <DangNhap xemThu={XEM_DANG_NHAP} />;
  if (phase === "norole") return <ThongBao />;
  // Phần Thiết bị cơ giới (mã từ web cũ) tải dữ liệu riêng sau khi đã đăng nhập
  return <ThietBiProvider><Main /><TBToanCuc /></ThietBiProvider>;
}

// nhan: lớp cho phần chữ (ẩn dần khi menu thu thành dải biểu tượng)
function Brand({ nhan }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Anchor className="h-[18px] w-[18px]" strokeWidth={2.4} /></div>
      <div className={cn("min-w-0 leading-tight", nhan)}><div className="truncate text-[0.9375rem] font-semibold">{APP_NAME}</div><div className="text-[0.6875rem] text-muted-foreground">Thiết bị · Cảng · Kho bãi</div></div>
    </div>
  );
}


function ThongBao() {
  const { signOut, user } = useApp();
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="grid w-full max-w-md gap-3 rounded-xl border bg-card p-6 shadow-lg">
        <Brand />
        <h1 className="flex items-center gap-2 text-lg font-semibold"><ShieldAlert className="h-5 w-5 text-warn" />Chưa được cấp quyền</h1>
        <p className="text-sm text-muted-foreground">Tài khoản <b>{user?.email}</b> đã đăng nhập nhưng chưa có vai trò. Nhờ quản trị cấp quyền.</p>
        <div><Button variant="ghost" onClick={signOut}><LogOut />Đăng xuất</Button></div>
      </div>
    </div>
  );
}

// Nút "Cài ứng dụng" (PWA): hiện khi trình duyệt cho phép cài và trang chưa chạy dạng ứng dụng
function useCaiDat() {
  const [co, setCo] = useState(() => !!window.__qltbCaiDat);
  useEffect(() => { const h = () => setCo(!!window.__qltbCaiDat); window.addEventListener("qltb-cai-dat", h); return () => window.removeEventListener("qltb-cai-dat", h); }, []);
  const caiDat = async () => {
    const e = window.__qltbCaiDat; if (!e) return;
    e.prompt();
    await e.userChoice;
    window.__qltbCaiDat = null; setCo(false);
  };
  return [co, caiDat];
}

// Tab / trang đã xem gần nhất: bấm lại một trang ở menu thì mở đúng tab đang xem dở
const docJson = (k) => { try { return JSON.parse(localStorage.getItem(k) || "{}"); } catch { return {}; } };
const luuJson = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* bỏ qua */ } };

function Main() {
  const { D, role, quyen, user, signOut, theme, setTheme, voyageMo, setVoyageMo, fail, toast, api, busy } = useApp();
  const tb = useThietBi();
  const [route, go, thay] = useHash();
  const [moDD, setMoDD] = useState(false);
  const [moTim, setMoTim] = useState(false);
  const [traCuu, setTraCuu] = useState(false);
  const [doiMK, setDoiMK] = useState(false);
  const [hdCai, setHdCai] = useState(null); // null = đóng; "da_cai" | "chua" = hộp hướng dẫn
  const [coCaiDat, caiDat] = useCaiDat();

  // ---- Menu: ẩn hẳn những gì vai trò hiện tại không được dùng ----
  const nav = useMemo(() => TRANG.filter((n) => duocDung(n, quyen)), [quyen]);
  const [gon, setGon] = useState(() => { try { const v = localStorage.getItem("lg-sb-gon"); if (v != null) return v === "1"; } catch { /* bỏ qua */ } return window.innerWidth < 1360; });
  const doiGon = () => setGon((g) => { try { localStorage.setItem("lg-sb-gon", g ? "0" : "1"); } catch { /* bỏ qua */ } return !g; });

  // ---- Đường dẫn: #/<trang>/<tab>. Đường dẫn cũ / thiếu tab được đổi sang dạng chuẩn ----
  const t0 = tachRoute(route);
  const duoc = !t0.la404 && (nav.some((n) => n.id === t0.trang.id) || (t0.trang.cang && !quyen.coCang));
  const { trang, tab, canonical } = duoc ? t0 : tachRoute(nav[0]?.id || "tong-quan"); // không được vào trang này: về trang đầu tiên được xem
  useEffect(() => { const h = CHUYEN_MO_HOP[route]; if (h) { try { sessionStorage.setItem("lg-mo-hop", h); } catch { /* bỏ qua */ } window.dispatchEvent(new Event("lg-mo-hop")); } }, [route]);
  useEffect(() => { if (route !== canonical) thay(canonical); }); // eslint-disable-line react-hooks/exhaustive-deps
  const nho = useRef({ tab: docJson("lg-tab-cuoi"), ph: docJson("lg-ph-cuoi") });
  useEffect(() => {
    if (tab && nho.current.tab[trang.id] !== tab) { nho.current.tab[trang.id] = tab; luuJson("lg-tab-cuoi", nho.current.tab); }
    if (nho.current.ph[trang.ph] !== trang.id) { nho.current.ph[trang.ph] = trang.id; luuJson("lg-ph-cuoi", nho.current.ph); }
  }, [trang.id, trang.ph, tab]);
  const moTrang = (id) => {
    const n = TRANG.find((x) => x.id === id), t = nho.current.tab[id];
    setMoDD(false);
    go(n?.tabs ? `${id}/${n.tabs.some((x) => x[0] === t) ? t : n.tabs[0][0]}` : id);
  };

  // ---- Giữ các trang đã xem còn nguyên (ẩn / hiện, không dựng lại): giữ bộ lọc, dữ liệu đang nhập, biểu đồ không vẽ lại; nhớ vị trí cuộn từng trang ----
  const [daXem, setDaXem] = useState(() => [trang.id]);
  useEffect(() => { setDaXem((a) => (a.includes(trang.id) ? a : [...a, trang.id])); }, [trang.id]);
  const dsTrang = daXem.includes(trang.id) ? daXem : [...daXem, trang.id];
  const gan = useRef({}); // đường dẫn / tab gần nhất của từng trang (trang đang ẩn giữ nguyên)
  gan.current[trang.id] = { tab, route: canonical };
  const cuon = useRef({}), hienTai = useRef(trang.id);
  useEffect(() => { const f = () => { cuon.current[hienTai.current] = window.scrollY; }; window.addEventListener("scroll", f, { passive: true }); return () => window.removeEventListener("scroll", f); }, []);
  useLayoutEffect(() => { hienTai.current = trang.id; window.scrollTo({ top: cuon.current[trang.id] || 0 }); tb?.closeVehicle?.(); }, [trang.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Phím tắt: Ctrl+K mở ô tìm nhanh ----
  useEffect(() => {
    const h = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setMoTim((o) => !o); } };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, []);

  const chuaCaiCang = (
    <div className="rounded-md border border-warn/40 bg-warn/5 px-3 py-2 text-sm">
      Phần Khai thác Cảng chưa sẵn sàng: quản trị cần chạy <b>sql/dung_lai/phan_1_cau_truc.sql</b> rồi <b>phan_2_danh_muc.sql</b> trong Supabase, hoặc tài khoản chưa được cấp quyền Cảng.
    </div>
  );
  const noiDung = (id, g) => {
    switch (id) {
      case "thiet-bi/khai-bao": return <TBCho><KhaiBao tab={g.tab} onTab={(v) => go(`${id}/${v}`)} /></TBCho>;
      case "thiet-bi/dieu-do": return <TBCho><DieuDo /></TBCho>;
      case "cang/linetime": return quyen.coCang ? <Linetime /> : chuaCaiCang;
      case "cang/muc-tieu": return quyen.coCang ? <MucTieu /> : chuaCaiCang;
      case "kho": return <Kho route={g.route} onTab={(v) => go(`kho/${v}`)} />;
      case "danh-muc": return <DanhMuc tab={g.tab} onTab={(v) => go(`danh-muc/${v}`)} />;
      case "phan-quyen": return quyen.quanTri ? <PhanQuyen /> : null;
      default: return <TongQuan go={go} />;
    }
  };

  const saoLuu = async () => { try { await saoLuuExcel(api, D, quyen); toast("Đã xuất file sao lưu Excel"); } catch (e) { fail(e); } };
  const tbExcel = () => tb.D && exportExcel(tb.D).then(() => toast("Đã xuất dữ liệu thiết bị ra Excel")).catch(fail);
  const tbPdf = async () => { if (!tb.D) return; try { const { exportPdf } = await import("./thietbi/lib/pdf"); await exportPdf(tb.D, role?.ho_ten); toast("Đã xuất báo cáo PDF thiết bị"); } catch (e) { fail(e); } };
  // Cài bằng PWA: trình duyệt sẵn sàng thì mở thẳng hộp Cài đặt; máy ĐÃ CÀI (kể cả bản cũ tên khác) hoặc đã từ chối gần đây thì hướng dẫn gỡ bản cũ rồi cài lại.
  const caiPhanMem = async () => {
    if (coCaiDat) return caiDat();
    if (window.matchMedia?.("(display-mode: standalone)").matches) return toast("Đang mở dạng phần mềm đã cài. Muốn đổi tên hoặc biểu tượng: gỡ phần mềm (menu ⋮ của cửa sổ) rồi mở web trên trình duyệt để cài lại.");
    let daCai = false;
    try { daCai = ((await navigator.getInstalledRelatedApps?.()) || []).length > 0; } catch { /* trình duyệt không hỗ trợ: coi như chưa biết */ }
    setHdCai(daCai ? "da_cai" : "chua");
  };

  // ---- Thông tin người dùng + vai trò ----
  const ten = role?.ho_ten || tenDangNhap(user?.email);
  const vaiTro = quyen.admin ? "Quản trị" : quyen.nhom?.length ? `Chỉnh sửa ${quyen.nhom.length} mục` : "Chỉ xem";
  const menuTaiKhoan = (
    <DropdownMenuContent side="bottom" align="end" className="w-72">
      <DropdownMenuLabel>{ten}<div className="text-[0.6875rem]">{quyen.admin ? "Quản trị: xem và sửa tất cả" : quyen.nhom?.length ? "Chỉ sửa ở các mục được cấp" : "Chỉ xem"}</div>{!quyen.admin && quyen.nhom?.length > 0 && <div className="text-[0.6875rem] font-normal">{quyen.nhom.map(TEN_SUA).join(", ")}</div>}</DropdownMenuLabel>
      {tb.D && <>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Thiết bị cơ giới</DropdownMenuLabel>
        <DropdownMenuItem onSelect={tbExcel}><FileSpreadsheet />Xuất dữ liệu ra Excel</DropdownMenuItem>
        <DropdownMenuItem onSelect={tbPdf}><FileText />Xuất báo cáo PDF</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setTraCuu(true)}><BookOpen />Thông số model xe</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => tb.reload(false)}><RefreshCw />Tải lại dữ liệu thiết bị</DropdownMenuItem>
      </>}
      <DropdownMenuSeparator />
      {quyen.coCang && <DropdownMenuItem onSelect={saoLuu}><Download />Sao lưu dữ liệu Cảng (Excel)</DropdownMenuItem>}
      <DropdownMenuItem onSelect={() => setDoiMK(true)}><KeyRound />Đổi mật khẩu</DropdownMenuItem>
      <DropdownMenuItem onSelect={caiPhanMem}><MonitorDown />Cài phần mềm</DropdownMenuItem>
      <DropdownMenuItem onSelect={signOut}><LogOut />Đăng xuất</DropdownMenuItem>
    </DropdownMenuContent>
  );

  // ---- Thanh dưới điện thoại: Tổng quan + các phân hệ được dùng; bấm phân hệ thì vào trang đã xem gần nhất của phân hệ đó ----
  const mucDuoi = PHAN_HE.filter((p) => ["tong-quan", "tb", "cang", "kho"].includes(p.id) && nav.some((n) => n.ph === p.id)).map((p) => {
    const ds = nav.filter((n) => n.ph === p.id), cuoi = ds.find((n) => n.id === nho.current.ph[p.id]) || ds[0];
    return { id: p.id, ten: p.ngan || p.ten, icon: p.icon, dang: trang.ph === p.id, chay: () => moTrang(cuoi.id) };
  });
  const phanHe = trang.ph === "tong-quan" ? null : PHAN_HE.find((p) => p.id === trang.ph)?.ten;
  const tabTen = tab ? trang.tabs.find((t) => t[0] === tab)?.[1] : null;
  const demo = DEMO ? `DEMO · ${VAI_TRO[role?.cang] || "Xem"}` : null;
  const doiTheme = () => setTheme(theme === "dark" ? "light" : "dark");
  const menuP = { nav, trangId: trang.id, chon: moTrang, gon, doiGon, theme, doiTheme, demo };

  return (
    <div className="khung-noi min-h-screen lg:pl-[var(--sb-w)]" style={{ "--sb-w": gon ? "68px" : "248px" }}>
      <AppBackground />
      {quyen.coCang && quyen.nhap && <TuGhiATD />}
      {quyen.coCang && quyen.keHoachNgay && <TuDoiKeHoach />}
      <a href="#noi-dung-chinh" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground" onClick={(e) => { e.preventDefault(); document.getElementById("noi-dung-chinh")?.focus(); }}>Bỏ qua menu, tới nội dung</a>

      <ThanhBenMayTinh {...menuP} />
      <NganKeoMenu mo={moDD} dong={() => setMoDD(false)} {...menuP} />
      <ThanhTren phanHe={phanHe} trang={trang.ten} tabTen={tabTen} onTim={() => setMoTim(true)} onMoChuyen={(id) => setVoyageMo(id)} theme={theme} doiTheme={doiTheme}
        dangTai={busy || tb.busy} ten={ten} vaiTro={vaiTro} menuTaiKhoan={menuTaiKhoan} coCang={quyen.coCang} />

      <main id="noi-dung-chinh" tabIndex={-1} className="mx-auto max-w-[1600px] p-3 pb-[calc(4.75rem+env(safe-area-inset-bottom))] outline-none sm:p-4 lg:pb-4">
        {!nav.length ? <div className="mx-auto mt-10 max-w-md rounded-md border border-warn/40 bg-warn/5 px-4 py-3 text-sm">Tài khoản chưa được cấp quyền xem trang nào. Nhờ quản trị cấp ở màn hình Phân quyền.</div> : D ? dsTrang.map((id) => (
          <div key={id} hidden={id !== trang.id} className={id === trang.id ? "pg-vao" : undefined} data-trang={id}>
            <Suspense fallback={<TrangSkeleton />}>{noiDung(id, gan.current[id] || { tab: null, route: id })}</Suspense>
          </div>
        )) : <TrangSkeleton />}
      </main>

      <ChuThich />
      <ThanhDuoi muc={mucDuoi} mo={() => setMoDD(true)} />
      <TimNhanh mo={moTim} doi={setMoTim} nav={nav} go={go} D={D} coCang={quyen.coCang} moChuyen={(id) => setVoyageMo(id)} />
      {voyageMo != null && D?.vmap.get(voyageMo) && <PhieuChuyen id={voyageMo} onClose={() => setVoyageMo(null)} />}
      {traCuu && tb.D && <TB><LookupDialog initial="specs" onClose={() => setTraCuu(false)} /></TB>}
      {doiMK && <DoiMatKhau onClose={() => setDoiMK(false)} />}
      {hdCai && <HuongDanCai daCai={hdCai === "da_cai"} onClose={() => setHdCai(null)} />}
    </div>
  );
}

// Đổi mật khẩu của chính mình (xác nhận mật khẩu hiện tại). Quản trị đặt lại mật khẩu cho người khác ở Supabase › Authentication › Users.
function DoiMatKhau({ onClose }) {
  const { api, user, toast } = useApp();
  const [cu, setCu] = useState(""), [moi, setMoi] = useState(""), [lai, setLai] = useState(""), [msg, setMsg] = useState(""), [busy, setBusy] = useState(false);
  const gui = async (e) => {
    e.preventDefault(); setMsg("");
    if (moi.length < 8) return setMsg("Mật khẩu mới cần ít nhất 8 ký tự.");
    if (moi !== lai) return setMsg("Hai ô mật khẩu mới chưa giống nhau.");
    if (moi === cu) return setMsg("Mật khẩu mới phải khác mật khẩu hiện tại.");
    setBusy(true);
    try { await api.doiMatKhau(user.email, cu, moi); toast("Đã đổi mật khẩu"); onClose(); } catch (err) { setMsg(err.message); setBusy(false); }
  };
  return (
    <Dialog onOpenChange={(o) => !o && onClose()} title="Đổi mật khẩu" description={`Tài khoản ${tenDangNhap(user?.email)}. Nhập mật khẩu hiện tại, rồi mật khẩu mới (ít nhất 8 ký tự).`}>
      <form onSubmit={gui} className="grid gap-3">
        <Field label="Mật khẩu hiện tại"><Input type="password" required autoComplete="current-password" value={cu} onChange={(e) => setCu(e.target.value)} /></Field>
        <Field label="Mật khẩu mới"><Input type="password" required minLength={8} autoComplete="new-password" value={moi} onChange={(e) => setMoi(e.target.value)} /></Field>
        <Field label="Nhập lại mật khẩu mới"><Input type="password" required autoComplete="new-password" value={lai} onChange={(e) => setLai(e.target.value)} /></Field>
        {msg && <div className="text-sm text-bad">{msg}</div>}
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Hủy</Button><Button disabled={busy}>{busy ? "Đang đổi…" : "Đổi mật khẩu"}</Button></div>
      </form>
    </Dialog>
  );
}

// Hướng dẫn cài phần mềm (PWA) khi trình duyệt chưa tự mở hộp cài đặt: máy đã cài rồi (bản cũ), đã từ chối cài, hoặc trình duyệt khác (Safari trên iPhone)
function HuongDanCai({ onClose, daCai }) {
  const Muc = ({ ten, children }) => <div className="rounded-md border p-3"><div className="mb-1 text-sm font-semibold">{ten}</div><div className="text-sm text-muted-foreground">{children}</div></div>;
  return (
    <Dialog onOpenChange={(o) => !o && onClose()} title="Cài phần mềm Quản trị Logistics" description="Cài bằng chức năng của trình duyệt (PWA): có biểu tượng riêng, mở thành cửa sổ không có thanh địa chỉ.">
      <div className="grid gap-2">
        {daCai
          ? <div className="rounded-md border border-warn/40 bg-warn/5 p-3 text-sm">Máy này <b>đã cài</b> phần mềm (có thể là bản cũ tên khác). Trình duyệt không mở lại hộp cài đặt khi đã cài, nên cần <b>gỡ bản cũ rồi cài lại</b>:</div>
          : <div className="rounded-md border p-3 text-sm text-muted-foreground">Trình duyệt chưa mở hộp cài đặt tự động (máy đã cài từ trước, hoặc trước đó đã bấm Không cài). Làm theo các bước dưới đây:</div>}
        <Muc ten="1 · Gỡ bản đã cài (nếu có)">Mở phần mềm đã cài › bấm <b>⋮</b> ở góc trên bên phải cửa sổ › <b>Gỡ cài đặt…</b>. Hoặc Chrome: gõ <b>chrome://apps</b>, bấm chuột phải biểu tượng › <b>Xóa khỏi Chrome</b>. Edge: <b>edge://apps</b> › <b>Gỡ cài đặt</b>.</Muc>
        <Muc ten="2 · Cài lại trên Chrome / Edge (máy tính)">Mở web này trên trình duyệt, bấm F5, rồi bấm lại <b>Cài phần mềm</b> ở menu: trình duyệt sẽ hiện hộp <b>Cài đặt</b>. Nếu vẫn không hiện: bấm biểu tượng cài đặt (màn hình có mũi tên) ở cuối thanh địa chỉ, hoặc menu ⋮ › <b>Truyền, lưu và chia sẻ</b> › <b>Cài đặt trang này dưới dạng ứng dụng</b> (Edge: … › <b>Ứng dụng</b> › <b>Cài đặt trang web này dưới dạng ứng dụng</b>).</Muc>
        <Muc ten="3 · Biểu tượng trên màn hình nền (Desktop)">Hộp cài đặt có ô <b>Tạo lối tắt trên màn hình nền</b> thì tick. Chưa có biểu tượng: Chrome mở <b>chrome://apps</b>, bấm chuột phải vào phần mềm › <b>Tạo lối tắt</b> › <b>Màn hình nền</b>. Edge: <b>edge://apps</b> › … › <b>Ghim vào thanh tác vụ / Tạo lối tắt trên màn hình</b>.</Muc>
        <Muc ten="Điện thoại Android · Chrome">Menu ⋮ › <b>Thêm vào màn hình chính</b> › <b>Cài đặt</b>.</Muc>
        <Muc ten="iPhone / iPad · Safari">Bấm nút <b>Chia sẻ</b> (ô vuông có mũi tên lên) › <b>Thêm vào MH chính</b>.</Muc>
        <p className="text-[0.6875rem] text-muted-foreground">Tên phần mềm là "Quản trị Logistics". Bản cài cũ vẫn giữ tên cũ cho đến khi gỡ rồi cài lại.</p>
      </div>
    </Dialog>
  );
}
