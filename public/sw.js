// Service worker của ứng dụng Quản trị Logistics (PWA).
// - Trang (index.html): lấy từ mạng trước để luôn có bản mới nhất; mất mạng thì dùng bản đã lưu.
// - File giao diện trong /assets/ (tên có mã băm, không đổi nội dung): lưu lại, lần sau mở ngay.
// - Dữ liệu (Supabase) và mọi địa chỉ khác máy chủ: KHÔNG lưu, luôn đi thẳng ra mạng.
const CACHE = "hpdq-v1"; // đổi tên khi cần xóa bộ nhớ đệm cũ
const VO = ["./", "./index.html", "./manifest.webmanifest", "./favicon.svg", "./icons/icon-192.png", "./icons/icon-512.png"];
const MAX_ASSETS = 80; // giữ tối đa chừng này file giao diện, xóa bớt bản cũ sau các lần cập nhật

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(VO)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

async function donAssets(c) {
  const ks = (await c.keys()).filter((r) => new URL(r.url).pathname.includes("/assets/"));
  for (const r of ks.slice(0, Math.max(0, ks.length - MAX_ASSETS))) await c.delete(r);
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase, CDN: đi mạng bình thường

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put("./index.html", copy)); return res; })
        .catch(() => caches.match("./index.html")),
    );
    return;
  }

  if (url.pathname.includes("/assets/")) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy).then(() => donAssets(c))); }
        return res;
      })),
    );
    return;
  }

  // Biểu tượng, manifest…: trả bản đã lưu ngay, đồng thời lấy bản mới
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; }).catch(() => hit);
      return hit || net;
    }),
  );
});
