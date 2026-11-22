import * as Dlg from "@radix-ui/react-dialog";
import { Anchor, PanelLeftClose, PanelLeftOpen, X, Sun, Moon } from "lucide-react";
import { cn } from "../lib/utils";
import { PHAN_HE } from "./menu";

// Thanh điều hướng bên trái, nền xanh navy theo màu ảnh trang đăng nhập. Nhóm theo phân hệ.
// Máy tính: thu gọn thành dải biểu tượng (nhớ lựa chọn) · điện thoại: ngăn kéo mở từ thanh dưới.
export function Brand({ gon }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="sb-logo"><Anchor className="h-[19px] w-[19px]" strokeWidth={2.3} aria-hidden="true" /></div>
      <div className={cn("sb-chu min-w-0 leading-tight", gon && "sb-an")}>
        <div className="truncate text-[0.9375rem] font-bold tracking-tight">Quản trị Logistics</div>
        <div className="truncate text-[0.6875rem] text-white/70">Hòa Phát · Điều hành</div>
      </div>
    </div>
  );
}

function Muc({ n, dang, gon, chon }) {
  return (
    <button type="button" onClick={() => chon(n.id)} data-tip={gon ? n.ten : undefined} data-tip-side="right" aria-label={gon ? n.ten : undefined} aria-current={dang ? "page" : undefined} className={cn("sb-muc", dang && "sb-dang")}>
      <n.icon className="h-[1.15rem] w-[1.15rem] shrink-0" aria-hidden="true" />
      <span className={cn("sb-chu truncate", gon && "sb-an")}>{n.ten}</span>
    </button>
  );
}

// Nội dung dùng chung cho thanh bên máy tính và ngăn kéo điện thoại
export function NoiDungMenu({ nav, trangId, chon, gon, doiGon, dd, dong, theme, doiTheme, demo }) {
  return (
    <>
      <div className="sb-dau">
        <Brand gon={gon} />
        {dd && <button type="button" className="sb-icon" onClick={dong} aria-label="Đóng menu"><X className="h-5 w-5" /></button>}
      </div>
      <nav className="sb-nav" aria-label="Điều hướng chính">
        {PHAN_HE.map((ph) => {
          const ds = nav.filter((n) => n.ph === ph.id);
          if (!ds.length) return null;
          return (
            <div key={ph.id} className="sb-nhom" role="group" aria-label={ph.ten}>
              {!ph.don && (gon ? <div className="sb-vach" aria-hidden="true" /> : <div className="sb-tieude">{ph.ten}</div>)}
              {ds.map((n) => <Muc key={n.id} n={n} dang={n.id === trangId} gon={gon} chon={chon} />)}
            </div>
          );
        })}
      </nav>
      <div className="sb-chan">
        {demo && <div className={cn("sb-demo", gon && "sb-an")}>{demo}</div>}
        {dd && <button type="button" className="sb-muc" onClick={doiTheme}>{theme === "dark" ? <Sun className="h-[1.15rem] w-[1.15rem]" /> : <Moon className="h-[1.15rem] w-[1.15rem]" />}<span>{theme === "dark" ? "Giao diện sáng" : "Giao diện tối"}</span></button>}
        {!dd && (
          <button type="button" className="sb-muc" onClick={doiGon} aria-label={gon ? "Mở rộng menu" : "Thu gọn menu"} aria-expanded={!gon} data-tip={gon ? "Mở rộng menu" : undefined} data-tip-side="right">
            {gon ? <PanelLeftOpen className="h-[1.15rem] w-[1.15rem]" /> : <PanelLeftClose className="h-[1.15rem] w-[1.15rem]" />}
            <span className={cn("sb-chu", gon && "sb-an")}>Thu gọn menu</span>
          </button>
        )}
      </div>
    </>
  );
}

export function ThanhBenMayTinh(p) {
  return <aside className={cn("sb fixed inset-y-0 left-0 z-40 hidden flex-col lg:flex", p.gon ? "sb-gon" : "sb-rong")}><NoiDungMenu {...p} /></aside>;
}

// Ngăn kéo điện thoại (Radix Dialog: có bẫy phím Tab, Esc đóng, trả tiêu điểm khi đóng)
export function NganKeoMenu({ mo, dong, ...p }) {
  return (
    <Dlg.Root open={mo} onOpenChange={(o) => !o && dong()}>
      <Dlg.Portal>
        <Dlg.Overlay className="fixed inset-0 z-50 bg-black/55 data-[state=open]:animate-in data-[state=open]:fade-in-0 lg:hidden" />
        <Dlg.Content aria-describedby={undefined} className="sb sb-rong fixed inset-y-0 left-0 z-50 flex w-[min(300px,86vw)] flex-col shadow-2xl focus:outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-left lg:hidden">
          <Dlg.Title className="sr-only">Menu</Dlg.Title>
          <NoiDungMenu {...p} dd dong={dong} gon={false} />
        </Dlg.Content>
      </Dlg.Portal>
    </Dlg.Root>
  );
}
