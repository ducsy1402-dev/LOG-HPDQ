import { useEffect, useState, lazy, Suspense } from "react";
import { LayoutDashboard, Ship, Warehouse, Boxes, Database, ShieldCheck, Bell, Sun, Moon, LogOut, LogIn, Menu, X, ShieldAlert, Download, UserRound, Anchor, RefreshCw, Wrench, Users, CalendarRange, FileSpreadsheet, FileText, BookOpen, MonitorDown, Target } from "lucide-react";
import { AppProvider, useApp, useHash } from "./store";
import { Toasts, MucIcon } from "./components/common";
import { Dialog } from "./components/ui/dialog";
import { Button } from "./components/ui/button";
import { Input, Field } from "./components/ui/input";
import { Badge } from "./components/ui/badge";
import { Popover, PopoverTrigger, PopoverContent, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from "./components/ui/menu";
import { APP_NAME, VAI_TRO, DEMO } from "./config";
import { cn } from "./lib/utils";
import { saoLuuExcel } from "./lib/backup";
import { ThietBiProvider, useThietBi, TB, TBCho, TBToanCuc } from "./thietbi/Host";
import Events from "./thietbi/tabs/Events";
import Staffing from "./thietbi/tabs/Staffing";
import Plan from "./thietbi/tabs/Plan";
import LookupDialog from "./thietbi/components/LookupDialog";
import { exportExcel } from "./thietbi/lib/excel";
import TongQuan from "./pages/TongQuan";
import TuXepTuDong from "@/pages/cang/TuXepTuDong";
import Linetime from "./pages/cang/Linetime";
import PhieuChuyen from "./pages/cang/PhieuChuyen";
import SapCo from "./pages/SapCo";
import { tenBenChuyen } from "./lib/tenBen";

const DanhMuc = lazy(() => import("./pages/DanhMuc"));
const PhanQuyen = lazy(() => import("./pages/PhanQuyen"));
const Kho = lazy(() => import("./pages/kho/Kho"));
const MucTieu = lazy(() => import("./pages/cang/MucTieu"));

// cang: cần quyền phần Cảng; kho: quyền Kho bãi (hoặc Cảng); tb: cần quyền phần Thiết bị cơ giới
const NAV = [
  { id: "tong-quan", ten: "Tổng quan", icon: LayoutDashboard },
  { nhom: "Thiết bị cơ giới", tb: true },
  { id: "thiet-bi/su-kien", ten: "Tình trạng & sự kiện", icon: Wrench, tb: true },
  { id: "thiet-bi/nhan-su", ten: "Nhân sự & quân số", icon: Users, tb: true },
  { id: "thiet-bi/ke-hoach", ten: "Kế hoạch & phân bổ", icon: CalendarRange, tb: true },
  { nhom: "Khai thác Cảng", cang: true },
  { id: "cang/linetime", ten: "Linetime tàu cập bến", icon: Ship, cang: true },
  { id: "cang/muc-tieu", ten: "Mục tiêu sản lượng", icon: Target, cang: true },
  { nhom: "Khai thác kho bãi", kho: true },
  { id: "kho/thanh-pham", ten: "Kho thành phẩm", icon: Warehouse, kho: true },
  { id: "kho/nguyen-lieu", ten: "Kho nguyên liệu", icon: Boxes, kho: true },
  { nhom: "Hệ thống" },
  { id: "danh-muc", ten: "Danh mục", icon: Database },
  { id: "phan-quyen", ten: "Phân quyền", icon: ShieldCheck, quanTri: true },
];

export default function App() {
  return <AppProvider><Shell /><Toasts /></AppProvider>;
}

function Shell() {
  const { phase } = useApp();
  if (phase === "loading") return <div className="flex min-h-screen items-center justify-center gap-3 text-muted-foreground"><RefreshCw className="h-5 w-5 animate-spin" />Đang khởi động…</div>;
  if (phase === "login") return <Login />;
  if (phase === "norole") return <ThongBao />;
  // Phần Thiết bị cơ giới (mã từ web cũ) tải dữ liệu riêng sau khi đã đăng nhập
  return <ThietBiProvider><Main /><TBToanCuc /></ThietBiProvider>;
}

// nhan: lớp cho phần chữ (ẩn dần khi menu thu thành dải biểu tượng)
function Brand({ nhan }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Anchor className="h-[18px] w-[18px]" strokeWidth={2.4} /></div>
      <div className={cn("min-w-0 leading-tight", nhan)}><div className="truncate text-[15px] font-semibold">{APP_NAME}</div><div className="text-[11px] text-muted-foreground">Thiết bị · Cảng · Kho bãi</div></div>
    </div>
  );
}

function Login() {
  const { signIn } = useApp();
  const [email, setEmail] = useState(""), [pw, setPw] = useState(""), [msg, setMsg] = useState(""), [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setMsg("");
    try { await signIn(email.trim(), pw); } catch (err) { setMsg(/Invalid login/i.test(err.message) ? "Sai email hoặc mật khẩu." : err.message); setBusy(false); }
  };
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="grid w-full max-w-sm gap-4 rounded-xl border bg-card p-6 shadow-lg">
        <Brand />
        <div><h1 className="text-lg font-semibold">Đăng nhập</h1><p className="text-xs text-muted-foreground">Dùng tài khoản do quản trị cấp. Hệ thống không cho tự đăng ký.</p></div>
        <Field label="Email"><Input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Mật khẩu"><Input type="password" required autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
        <Button disabled={busy}><LogIn />{busy ? "Đang đăng nhập…" : "Đăng nhập"}</Button>
        {msg && <div className="text-sm text-bad">{msg}</div>}
      </form>
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

function Main() {
  const { D, role, quyen, user, signOut, theme, setTheme, voyageMo, setVoyageMo, fail, toast, api, busy } = useApp();
  const tb = useThietBi();
  const [route, go] = useHash();
  const [moMenu, setMoMenu] = useState(false);
  const [traCuu, setTraCuu] = useState(false);
  const [coCaiDat, caiDat] = useCaiDat();
  const duoc = (n) => (!n.quanTri || quyen.quanTri) && (!n.cang || quyen.coCang || quyen.chuaSql) && (!n.tb || quyen.coThietBi) && (!n.kho || quyen.kho?.co || quyen.coCang || quyen.chuaSql);
  const nav = NAV.filter(duoc);
  // Chuyển trang: lên đầu trang, đóng ngăn chi tiết xe của phần Thiết bị cơ giới nếu đang mở
  useEffect(() => { window.scrollTo({ top: 0 }); tb?.closeVehicle?.(); }, [route]); // eslint-disable-line react-hooks/exhaustive-deps
  const chuaCaiCang = (
    <div className="rounded-md border border-warn/40 bg-warn/5 px-3 py-2 text-sm">
      Phần Khai thác Cảng chưa sẵn sàng: quản trị cần chạy <b>sql/13_logistics_nen_tang.sql</b> và <b>sql/14_nap_danh_muc.sql</b> trong Supabase, hoặc tài khoản chưa được cấp quyền Cảng.
    </div>
  );
  const trang = () => {
    if (route === "thiet-bi/su-kien") return <TBCho><Events /></TBCho>;
    if (route === "thiet-bi/nhan-su") return <TBCho><Staffing /></TBCho>;
    if (route === "thiet-bi/ke-hoach") return <TBCho><Plan /></TBCho>;
    if (route.startsWith("cang/") && !quyen.coCang) return chuaCaiCang;
    if (route === "cang/linetime") return <Linetime />;
    if (route === "cang/muc-tieu") return <MucTieu />;
    if (route === "kho/thanh-pham") return <Kho key="tp" loai="thanh_pham" />;
    if (route === "kho/nguyen-lieu") return <Kho key="nl" loai="nguyen_lieu" />;
    if (route === "danh-muc") return <DanhMuc />;
    if (route === "phan-quyen" && quyen.quanTri) return <PhanQuyen />;
    const n = NAV.find((x) => x.id === route);
    if (n?.sau) return <SapCo muc={n} />;
    return <TongQuan go={go} />;
  };
  const saoLuu = async () => { try { await saoLuuExcel(api, D, quyen); toast("Đã xuất file sao lưu Excel"); } catch (e) { fail(e); } };
  const tbExcel = () => tb.D && exportExcel(tb.D).then(() => toast("Đã xuất dữ liệu thiết bị ra Excel")).catch(fail);
  const tbPdf = async () => { if (!tb.D) return; try { const { exportPdf } = await import("./thietbi/lib/pdf"); await exportPdf(tb.D, role?.ho_ten); toast("Đã xuất báo cáo PDF thiết bị"); } catch (e) { fail(e); } };

  // Menu bên trái: máy tính thu thành dải biểu tượng, rê chuột vào thì mở rộng, rời chuột thì tự thu
  // (giữ mở khi đang mở hộp chuông / tài khoản); điện thoại bấm ☰ để mở, chọn mục xong tự đóng.
  const [reChuot, setReChuot] = useState(false);
  const [giu, setGiu] = useState(0); // số hộp nổi (chuông, tài khoản) đang mở từ menu
  const giuMo = (o) => setGiu((n) => Math.max(0, n + (o ? 1 : -1)));
  const rong = moMenu || reChuot || giu > 0;
  const chon = (id) => { go(id); setMoMenu(false); setReChuot(false); };
  const [hdCai, setHdCai] = useState(null); // null = đóng; "da_cai" | "chua" = hộp hướng dẫn
  // Cài bằng PWA: trình duyệt đã sẵn sàng thì mở thẳng hộp Cài đặt của trình duyệt (tạo biểu tượng như một phần mềm).
  // Trình duyệt không mở được hộp đó khi máy ĐÃ CÀI phần mềm này (kể cả bản cũ tên khác) hoặc đã từ chối cài gần đây: lúc đó hướng dẫn gỡ bản cũ rồi cài lại.
  const caiPhanMem = async () => {
    if (coCaiDat) return caiDat();
    if (window.matchMedia?.("(display-mode: standalone)").matches) return toast("Đang mở dạng phần mềm đã cài. Muốn đổi tên hoặc biểu tượng: gỡ phần mềm (menu ⋮ của cửa sổ) rồi mở web trên trình duyệt để cài lại.");
    let daCai = false;
    try { daCai = ((await navigator.getInstalledRelatedApps?.()) || []).length > 0; } catch { /* trình duyệt không hỗ trợ: coi như chưa biết */ }
    setHdCai(daCai ? "da_cai" : "chua");
  };
  const nhan = cn("whitespace-nowrap transition-opacity duration-150", rong ? "opacity-100" : "lg:pointer-events-none lg:opacity-0");
  const dongMenu = "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-muted-foreground hover:bg-accent hover:text-foreground";

  return (
    <div className="min-h-screen lg:pl-[60px]">
      {quyen.coCang && quyen.nhap && <TuXepTuDong />}
      {/* Thanh bên */}
      <aside onMouseEnter={() => setReChuot(true)} onMouseLeave={() => setReChuot(false)}
        className={cn("fixed inset-y-0 left-0 z-40 flex w-60 flex-col overflow-hidden border-r bg-card transition-[width,transform] duration-200",
          moMenu ? "translate-x-0 shadow-xl" : "-translate-x-full lg:translate-x-0", rong ? "lg:w-60 lg:shadow-xl" : "lg:w-[60px]")}>
        <div className="flex h-14 shrink-0 items-center justify-between border-b px-3"><Brand nhan={nhan} /><Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMoMenu(false)} aria-label="Đóng menu"><X /></Button></div>
        <nav className="flex-1 overflow-y-auto overflow-x-hidden p-2">
          {nav.map((n, i) => n.nhom
            ? (rong ? <div key={i} className="whitespace-nowrap px-2.5 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{n.nhom}</div>
              : <div key={i} className="mx-2.5 my-3 h-px bg-border" />)
            : (
              <div key={i} className="relative flex items-center">
                <button onClick={() => chon(n.id)} title={rong ? undefined : n.ten}
                  className={cn("flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors", route === n.id ? "bg-primary/15 font-medium text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
                  <n.icon className="h-4 w-4 shrink-0" /><span className={cn(nhan, "truncate")}>{n.ten}</span>{n.sau && <Badge tone="outline" className="ml-auto font-normal">{n.sau}</Badge>}
                </button>
                {/* Chuông cảnh báo đặt cạnh mục Tổng quan */}
                {n.id === "tong-quan" && quyen.coCang && <Chuong onMo={(id) => setVoyageMo(id)} gon={!rong} onOpenChange={giuMo} />}
              </div>))}
        </nav>
        {/* Thao tác chung (trước ở góc phải trên cùng): giao diện sáng / tối, tài khoản */}
        <div className="shrink-0 border-t p-2">
          {DEMO && <div className={cn("mb-1 px-1", !rong && "lg:hidden")}><Badge tone="warn">DEMO · {VAI_TRO[role?.cang] || "Xem"}</Badge></div>}
          <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} title={rong ? undefined : "Đổi giao diện sáng / tối"} className={dongMenu} aria-label="Đổi giao diện sáng / tối">
            {theme === "dark" ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}<span className={nhan}>{theme === "dark" ? "Giao diện sáng" : "Giao diện tối"}</span>
            {(busy || tb.busy) && <RefreshCw className="ml-auto h-4 w-4 shrink-0 animate-spin" />}
          </button>
          <DropdownMenu onOpenChange={giuMo}>
            <DropdownMenuTrigger asChild>
              <button className={dongMenu} aria-label="Tài khoản và thao tác" title={rong ? undefined : "Tài khoản và thao tác"}>
                <UserRound className="h-4 w-4 shrink-0" /><span className={cn(nhan, "min-w-0 truncate")}>{role?.ho_ten || user?.email}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" className="w-64">
              <DropdownMenuLabel>{role?.ho_ten || user?.email}<div className="text-[11px]">Thiết bị: {VAI_TRO[role?.thietBi] || "—"} · Cảng: {VAI_TRO[role?.cang] || "—"}</div></DropdownMenuLabel>
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
              <DropdownMenuItem onSelect={caiPhanMem}><MonitorDown />Cài phần mềm</DropdownMenuItem>
              <DropdownMenuItem onSelect={signOut}><LogOut />Đăng xuất</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className={cn("px-2.5 pt-1 text-[11px] text-muted-foreground", nhan)}>Thiết bị · Cảng · Kho bãi{DEMO && " · Demo"}</div>
        </div>
      </aside>
      {moMenu && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setMoMenu(false)} />}

      {/* Điện thoại: thanh trên cùng chỉ có nút mở menu (tiêu đề trang nằm trong trang) */}
      <header className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b bg-background/85 px-2 backdrop-blur lg:hidden">
        <Button variant="ghost" size="icon" onClick={() => setMoMenu(true)} aria-label="Mở menu"><Menu /></Button>
        <span className="truncate text-sm font-semibold">{APP_NAME}</span>
        {(busy || tb.busy) && <RefreshCw className="ml-auto h-4 w-4 animate-spin text-muted-foreground" />}
      </header>

      <main className="mx-auto max-w-[1600px] p-3 sm:p-4">
        {D && <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Đang tải…</div>}>{trang()}</Suspense>}
      </main>
      {voyageMo != null && D?.vmap.get(voyageMo) && <PhieuChuyen id={voyageMo} onClose={() => setVoyageMo(null)} />}
      {traCuu && tb.D && <TB><LookupDialog initial="specs" onClose={() => setTraCuu(false)} /></TB>}
      {hdCai && <HuongDanCai daCai={hdCai === "da_cai"} onClose={() => setHdCai(null)} />}
    </div>
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
        <p className="text-[11px] text-muted-foreground">Tên phần mềm là "Quản trị Logistics". Bản cài cũ vẫn giữ tên cũ cho đến khi gỡ rồi cài lại.</p>
      </div>
    </Dialog>
  );
}

// Chuông cảnh báo: số cảnh báo đang mở (đỏ, vàng) của các chuyến chưa rời bến.
// gon: menu đang thu thành dải biểu tượng (chỉ còn chấm số đè góc biểu tượng Tổng quan)
function Chuong({ onMo, gon, onOpenChange }) {
  const { D } = useApp();
  const ds = D?.alerts || [];
  const khan = ds.filter((a) => a.muc === "bad").length;
  return (
    <Popover onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button className={cn("flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground", gon ? "absolute left-6 top-0.5 h-5" : "relative ml-1 h-9 w-9 shrink-0 hover:bg-accent")} aria-label={`Cảnh báo (${ds.length})`} title="Cảnh báo đang mở">
          {!gon && <Bell className="h-4 w-4" />}
          {ds.length > 0 && <span className={cn("min-w-[16px] rounded-full px-1 text-[10px] font-bold leading-4 text-white", !gon && "absolute -right-0.5 top-0", khan ? "bg-bad" : "bg-warn")}>{ds.length}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-[min(420px,calc(100vw-24px))]">
        <div className="flex items-center justify-between border-b px-3 py-2"><span className="text-sm font-semibold">Cảnh báo đang mở</span><span className="text-xs text-muted-foreground">{khan} khẩn · {ds.length - khan} cảnh báo</span></div>
        <div className="max-h-[60vh] overflow-y-auto">
          {ds.length ? ds.map((a) => (
            <button key={a.id} onClick={() => onMo(a.voyage.id)} className="flex w-full items-start gap-2 border-b px-3 py-2 text-left text-sm last:border-0 hover:bg-accent">
              <MucIcon muc={a.muc} className="mt-0.5" />
              <span className="min-w-0"><span className="font-medium">{a.voyage.ten_tau}</span>{a.voyage.ben_ma && <span className="text-muted-foreground"> · Bến {tenBenChuyen(a.voyage)}</span>}<span className="block text-xs text-muted-foreground">{a.nd}</span></span>
            </button>
          )) : <div className="px-3 py-6 text-center text-sm text-muted-foreground">Không có cảnh báo.</div>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
