import { LayoutDashboard, Ship, Warehouse, Database, ShieldCheck, ClipboardList, Gauge, Target, Truck, Settings } from "lucide-react";
import { TEN_KHO_KIEN, TEN_KHO_ROI } from "../lib/kho";

// Danh sách trang của web, gom theo phân hệ. Mỗi trang có thể có tab; tab nào cũng có đường dẫn riêng: #/<trang>/<tab>.
// Cờ quyền: xem = mục Quyền xem của tài khoản (SQL 27, ẩn / hiện trang); cang = cần quyền phần Cảng; kho = quyền Kho bãi (hoặc Cảng); tb = quyền Thiết bị cơ giới; quanTri = chỉ quản trị.
export const PHAN_HE = [
  { id: "tong-quan", ten: "Tổng quan", icon: LayoutDashboard, don: true },
  { id: "tb", ten: "Thiết bị cơ giới", ngan: "Thiết bị", icon: Truck, tb: true },
  { id: "cang", ten: "Khai thác Cảng", ngan: "Cảng", icon: Ship, cang: true },
  { id: "kho", ten: "Kho bãi", ngan: "Kho bãi", icon: Warehouse, kho: true },
  { id: "he-thong", ten: "Hệ thống", ngan: "Hệ thống", icon: Settings },
];

export const TRANG = [
  { id: "tong-quan", ten: "Tổng quan", icon: LayoutDashboard, ph: "tong-quan", xem: "tong_quan" },
  { id: "thiet-bi/khai-bao", ten: "Khai báo", icon: ClipboardList, ph: "tb", tb: true, xem: "khai_bao",
    tabs: [["su-kien", "Tình trạng & sự kiện"], ["quan-so", "Nhân sự & quân số"], ["dau-cuoi-ca", "Thông tin đầu/cuối ca"]] },
  { id: "thiet-bi/dieu-do", ten: "Điều độ", icon: Gauge, ph: "tb", tb: true, xem: "dieu_do" },
  { id: "cang/linetime", ten: "Linetime tàu cập bến", icon: Ship, ph: "cang", cang: true, xem: "linetime" },
  { id: "cang/muc-tieu", ten: "Kế hoạch tổng hợp", icon: Target, ph: "cang", cang: true, xem: "ke_hoach_th" },
  { id: "kho", ten: "Khai thác kho bãi", icon: Warehouse, ph: "kho", kho: true, xem: "kho",
    tabs: [["overview", "Overview"], ["hang-kien", TEN_KHO_KIEN], ["hang-roi", TEN_KHO_ROI]] },
  { id: "danh-muc", ten: "Danh mục", icon: Database, ph: "he-thong", xem: "danh_muc",
    tabs: [["thiet-bi", "Thiết bị cơ giới"], ["hang", "Hàng hóa"], ["kho", "Kho bãi"], ["ben", "Cầu bến"]] },
  { id: "phan-quyen", ten: "Phân quyền", icon: ShieldCheck, ph: "he-thong", quanTri: true },
];

// Đường dẫn cũ → đường dẫn mới (vẫn mở được link và dấu trang đã lưu)
export const CHUYEN_CU = {
  "thiet-bi/su-kien": "thiet-bi/khai-bao/su-kien",
  "thiet-bi/nhan-su": "thiet-bi/khai-bao/quan-so",
  "thiet-bi/ke-hoach": "cang/muc-tieu", "thiet-bi/ke-hoach/ngay": "cang/muc-tieu", "thiet-bi/ke-hoach/dai": "cang/muc-tieu", "thiet-bi/ke-hoach/chien-dich": "cang/muc-tieu",
  "kho/hrc": "kho/hang-kien", "kho/thanh-cuon": "kho/hang-kien", "kho/nguyen-lieu": "kho/hang-roi",
};

// Đường dẫn cũ của "Kế hoạch & báo cáo" không còn trang riêng mà mở hộp Kế hoạch vận tải của Kế hoạch tổng hợp (MucTieuCang đọc sessionStorage "lg-mo-hop")
export const CHUYEN_MO_HOP = { "thiet-bi/ke-hoach": "van-tai", "thiet-bi/ke-hoach/ngay": "van-tai", "thiet-bi/ke-hoach/dai": "van-tai", "thiet-bi/ke-hoach/chien-dich": "van-tai" };

// Tách đường dẫn thành trang + tab. Không có tab trong đường dẫn thì lấy tab đầu tiên.
export function tachRoute(route) {
  const r = CHUYEN_CU[route] || route;
  const t = TRANG.find((n) => r === n.id || r.startsWith(n.id + "/"));
  if (!t) return { trang: TRANG[0], tab: null, canonical: "tong-quan", la404: r !== "tong-quan" };
  const phan = r === t.id ? null : r.slice(t.id.length + 1).split("/")[0];
  const tab = t.tabs ? (t.tabs.some((x) => x[0] === phan) ? phan : t.tabs[0][0]) : null;
  return { trang: t, tab, canonical: tab ? `${t.id}/${tab}` : t.id, la404: false };
}

export const duongTab = (trang, tab) => `${trang.id}/${tab}`;

// Trang mà vai trò hiện tại được dùng (ẩn hẳn trang không được dùng)
export const duocDung = (n, quyen) => (!n.quanTri || quyen.quanTri) && (!n.xem || quyen.thay(n.xem)) && (!n.cang || quyen.coCang || quyen.chuaSql) && (!n.tb || quyen.coThietBi) && (!n.kho || quyen.kho?.co || quyen.coCang || quyen.chuaSql);

// Bỏ dấu, hạ chữ thường: để tìm nhanh gõ không dấu vẫn ra
export const khongDau = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
