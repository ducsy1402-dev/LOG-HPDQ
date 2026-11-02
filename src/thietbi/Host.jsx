// Phần Thiết bị cơ giới trong web chung: mã chuyển nguyên từ web Quản lý thiết bị cũ (app/src),
// chạy với bộ dữ liệu riêng (store.jsx của phần này) và CSS riêng chỉ áp dụng trong khung .ttb.
import { RefreshCw, ShieldAlert } from "lucide-react";
import "./scope.css";
import "./styles.css";
import { AppProvider, useApp } from "./store";
import { Toasts } from "./components/ui";
import VehicleDrawer from "./components/VehicleDrawer";

export { AppProvider as ThietBiProvider, useApp as useThietBi };

// Khung chứa giao diện cũ trong trang mới
export const TB = ({ children, className = "" }) => <div className={"ttb ttb-khung " + className}>{children}</div>;

// Chỉ hiện nội dung khi dữ liệu Thiết bị cơ giới đã tải; chưa có quyền thì báo
export function TBCho({ children, gon }) {
  const { phase, D } = useApp();
  if (phase === "norole" || phase === "login")
    return <div className="flex items-center gap-2 rounded-md border border-warn/40 bg-warn/5 px-3 py-2 text-sm"><ShieldAlert className="h-4 w-4 text-warn" />Tài khoản chưa có quyền ở phần Thiết bị cơ giới. Nhờ quản trị cấp quyền (bảng user_roles).</div>;
  if (!D) return <div className={"flex items-center gap-2 text-sm text-muted-foreground " + (gon ? "py-4" : "py-10")}><RefreshCw className="h-4 w-4 animate-spin" />Đang tải dữ liệu thiết bị cơ giới…</div>;
  return <TB>{children}</TB>;
}

// Thông báo và ngăn chi tiết xe của phần Thiết bị cơ giới (dùng chung cho mọi trang)
export function TBToanCuc() {
  const { D } = useApp();
  return <TB>{D && <VehicleDrawer />}<Toasts /></TB>;
}
