import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import "@fontsource/be-vietnam-pro/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/700.css";
import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")).render(<StrictMode><App /></StrictMode>);

// ---- Ứng dụng cài được (PWA) ----
// Chỉ đăng ký service worker ở bản build (web thật), không dùng khi chạy thử npm run dev.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => { /* trình duyệt không hỗ trợ: web vẫn chạy bình thường */ }));
}
// Giữ lời mời cài đặt của trình duyệt để nút "Cài ứng dụng" trong menu dùng lại
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); window.__qltbCaiDat = e; window.dispatchEvent(new Event("qltb-cai-dat")); });
window.addEventListener("appinstalled", () => { window.__qltbCaiDat = null; window.dispatchEvent(new Event("qltb-cai-dat")); });
