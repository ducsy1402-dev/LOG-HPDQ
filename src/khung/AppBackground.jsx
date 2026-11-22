import { useEffect, useState } from "react";
import { cn } from "../lib/utils";
import "./nen.css";

// Nền dùng chung cho toàn bộ khu vực quản trị. Gắn MỘT lần ở khung chính (App.jsx › Main), nên chuyển trang / tab không tải lại ảnh.
// Ảnh tải nền (không chặn lần vẽ đầu), tải xong thì hiện dần; chưa tải được thì giữ nền dự phòng (--nen-du-phong).
// Màu, độ đậm lớp phủ, vị trí ảnh: chỉnh bằng biến CSS ở nen.css. Ảnh ở public/images/logistics-admin.webp (trình duyệt và service worker lưu lại).
export const ANH_NEN = "/images/logistics-admin.webp";

export default function AppBackground() {
  const [san, setSan] = useState(false);
  useEffect(() => {
    const a = new Image();
    a.onload = () => setSan(true);
    a.src = ANH_NEN;
    return () => { a.onload = null; };
  }, []);
  return <div className={cn("nen-app", san && "nen-san")} aria-hidden="true" />;
}
