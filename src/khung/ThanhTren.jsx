import { ChevronRight, Search, Sun, Moon, RefreshCw, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger } from "../components/ui/menu";
import { cn } from "../lib/utils";
import Chuong from "./Chuong";

const chuCai = (ten) => { const p = String(ten || "?").trim().split(/\s+/); return (p[p.length - 1][0] || "?").toUpperCase(); };

// Thanh trên cùng cố định: đường dẫn (Phân hệ › Trang › Tab), tìm nhanh Ctrl+K, chuông cảnh báo, giao diện sáng / tối, người dùng + vai trò.
// Bộ lọc ngày / bến dùng chung chưa đặt ở đây: mỗi trang đang có bộ lọc riêng theo ngữ cảnh (kỳ Tháng / Quý / Năm, bến, loại hàng…).
export default function ThanhTren({ phanHe, trang, tabTen, onTim, onMoChuyen, theme, doiTheme, dangTai, ten, vaiTro, menuTaiKhoan, coCang }) {
  return (
    <header className="tb sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card/90 px-3 backdrop-blur sm:px-4">
      <nav aria-label="Vị trí hiện tại" className="min-w-0 flex-1">
        <ol className="tb-bc">
          {phanHe && <li className="tb-bc-ph"><span>{phanHe}</span><ChevronRight aria-hidden="true" /></li>}
          <li aria-current={tabTen ? undefined : "page"} className={cn(!tabTen && "tb-bc-cuoi")}><span>{trang}</span>{tabTen && <ChevronRight aria-hidden="true" />}</li>
          {tabTen && <li aria-current="page" className="tb-bc-cuoi"><span>{tabTen}</span></li>}
        </ol>
      </nav>

      {dangTai && <RefreshCw className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-label="Đang tải dữ liệu" role="status" />}

      <button type="button" onClick={onTim} className="tb-tim" data-tip="Tìm nhanh (Ctrl+K)" aria-label="Tìm nhanh (Ctrl+K)" aria-keyshortcuts="Control+K">
        <Search className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="tb-tim-chu">Tìm trang, tab, tàu, bến…</span><kbd>Ctrl K</kbd>
      </button>

      {coCang && <Chuong onMo={onMoChuyen} />}
      <button type="button" onClick={doiTheme} className="tb-nut" aria-label={theme === "dark" ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"} data-tip="Đổi giao diện sáng / tối">
        {theme === "dark" ? <Sun className="h-[1.15rem] w-[1.15rem]" /> : <Moon className="h-[1.15rem] w-[1.15rem]" />}
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="tb-nd" aria-label={`Tài khoản ${ten}, ${vaiTro}`}>
            <span className="tb-av" aria-hidden="true">{chuCai(ten)}</span>
            <span className="tb-nd-chu"><b>{ten}</b><small>{vaiTro}</small></span>
            <ChevronDown className="hidden h-4 w-4 text-muted-foreground md:block" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        {menuTaiKhoan}
      </DropdownMenu>
    </header>
  );
}

// Thanh dưới cho điện thoại: 3 phân hệ + Tổng quan + Menu (mở ngăn kéo đầy đủ). Mỗi nút cao 56 px.
export function ThanhDuoi({ muc, mo }) {
  return (
    <nav className="td fixed inset-x-0 bottom-0 z-30 grid border-t bg-card/95 backdrop-blur lg:hidden" style={{ gridTemplateColumns: `repeat(${muc.length + 1}, minmax(0, 1fr))` }} aria-label="Phân hệ">
      {muc.map((m) => (
        <button key={m.id} type="button" onClick={m.chay} aria-current={m.dang ? "page" : undefined} className={cn("td-nut", m.dang && "td-dang")}>
          <m.icon className="h-5 w-5" aria-hidden="true" /><span>{m.ten}</span>
        </button>
      ))}
      <button type="button" onClick={mo} className="td-nut" aria-haspopup="dialog"><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg><span>Menu</span></button>
    </nav>
  );
}
