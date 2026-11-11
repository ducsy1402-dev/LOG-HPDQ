import { createContext, useContext } from "react";
import { cn } from "@/lib/utils";
import { useToanManHinh, NutToanManHinh, useTrongHop } from "./toanManHinh";

// Thẻ có tiêu đề (CardHeader) tự có nút Toàn màn hình ở góc phải; thẻ nằm trong hộp thoại thì không (hộp thoại có nút riêng)
const ToanManHinhCtx = createContext(null);
export function Card({ className, ...p }) {
  const trongHop = useTrongHop();
  const [on, doi] = useToanManHinh();
  return (
    <ToanManHinhCtx.Provider value={trongHop ? null : { on, doi }}>
      <div data-tmh={on ? "" : undefined} className={cn("relative rounded-lg border bg-card text-card-foreground shadow-sm", className, on && "fixed inset-0 z-[45] m-0 h-[100dvh] max-h-none w-screen max-w-none !self-auto overflow-auto rounded-none border-0 p-2 shadow-none")} {...p} />
    </ToanManHinhCtx.Provider>
  );
}
export const CardHeader = ({ className, children, ...p }) => {
  const tm = useContext(ToanManHinhCtx);
  return (
    <div className={cn("flex flex-wrap items-center gap-2 px-4 pt-3.5 pb-2", className, tm && "pr-12")} {...p}>
      {children}
      {tm && <NutToanManHinh on={tm.on} onClick={tm.doi} className={cn("absolute right-2.5", tm.on ? "top-4" : "top-2.5")} />}
    </div>
  );
};
export const CardTitle = ({ className, ...p }) => <h3 className={cn("flex items-center gap-2 text-[0.9375rem] font-semibold leading-none tracking-tight [&_svg]:size-4 [&_svg]:text-primary", className)} {...p} />;
export const CardDescription = ({ className, ...p }) => <p className={cn("text-xs text-muted-foreground", className)} {...p} />;
export const CardContent = ({ className, ...p }) => <div className={cn("px-4 pb-4", className)} {...p} />;
