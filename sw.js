/* Service Worker — Nhật Ký Calo
   Vỏ app được lưu sẵn để mở tức thì và chạy cả khi mất mạng.
   Mỗi lần phát hành: tăng VERSION → máy tự tải bản mới ở lần mở kế tiếp. */
const VERSION = "1.2.0";
const CACHE = `nkc-${VERSION}`;

const SHELL = [
  "./",
  "index.html",
  "manifest.webmanifest",
  // Phông chữ nằm ngay trong app (css/fonts.css + fonts/): lưu sẵn cùng vỏ để lần mở đầu và lúc mất mạng vẫn đúng kiểu chữ.
  "css/fonts.css",
  "fonts/nunito-vietnamese.woff2",
  "fonts/nunito-latin-ext.woff2",
  "fonts/nunito-latin.woff2",
  "fonts/quicksand-vietnamese.woff2",
  "fonts/quicksand-latin-ext.woff2",
  "fonts/quicksand-latin.woff2",
  "fonts/patrick-hand-vietnamese.woff2",
  "fonts/patrick-hand-latin-ext.woff2",
  "fonts/patrick-hand-latin.woff2",
  "css/app.css",
  "css/parts.css",
  "css/forms.css",
  "css/today.css",
  "css/journey.css",
  "css/accents.css",
  "js/early.js",
  "js/app.js",
  "js/state.js",
  "js/logic.js",
  "js/models.js",
  "js/dishes.js",
  "js/words.js",
  "js/store.js",
  "js/photo.js",
  "js/ai.js",
  "js/ui.js",
  "js/art.js",
  "js/art/icons.js",
  "js/art/plant.js",
  "js/art/badges.js",
  "js/confetti.js",
  "js/views/chrome.js",
  "js/views/today.js",
  "js/views/journey.js",
  "js/views/onboarding.js",
  "js/views/settings.js",
  "js/views/sheets.js",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon.png",
  "icons/favicon.svg",
];
// Nặng và chỉ cần khi phân tích ảnh: lưu thêm sau, không được làm hỏng việc cài đặt.
const LATER = ["vendor/anthropic-sdk.js"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then(async (c) => {
      await c.addAll(SHELL.map((u) => new Request(u, { cache: "reload" })));
      c.addAll(LATER).catch(() => {});
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      // Chỉ dọn bộ nhớ đệm CŨ CỦA CHÍNH APP NÀY — cùng tên miền còn có app khác.
      // (Gồm cả "nkc-fonts-v1" của thời phông còn lấy từ Google Fonts: nay phông nằm trong vỏ app nên không cần nữa.)
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("nkc-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin || !url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;

  // Chỉ địa chỉ của chính app (thư mục gốc hoặc index.html, kèm tham số gì cũng được) mới nhận vỏ app đã lưu;
  // tài liệu khác trong thư mục (giấy phép, hướng dẫn…) đi theo nhánh thường để mở đúng nội dung của nó.
  const base = new URL(self.registration.scope).pathname;
  const isShell = req.mode === "navigate" && (url.pathname === base || url.pathname === base + "index.html");

  e.respondWith(
    caches.open(CACHE).then(async (c) => {
      const hit = isShell ? await c.match("index.html") : await c.match(req, { ignoreSearch: true });
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (isShell) {
          // Vỏ app biến mất khỏi bộ nhớ đệm (app khác cùng tên miền dọn nhầm, máy tự xoá khi đầy…): có mạng thì lưu lại
          // TOÀN BỘ vỏ dưới đúng tên file, để lần mở sau không có mạng vẫn chạy — kể cả khi mở bằng địa chỉ thư mục
          // hay địa chỉ có tham số. Không lưu trang dưới chính địa chỉ vừa mở: lúc tìm chỉ tìm "index.html".
          if (res && res.ok) e.waitUntil(refill(c));
        } else if (res && res.ok && res.type === "basic" && isAppFile(url.pathname, base)) c.put(req, res.clone());
        // (file không thuộc danh sách của app — tài liệu, file lạ trong thư mục — chỉ chuyển tiếp, không giữ lại trong bộ nhớ đệm)
        return res;
      } catch (err) {
        if (isShell) { const shell = await c.match("index.html"); if (shell) return shell; }
        throw err;
      }
    })
  );
});

/** Đường dẫn này có phải một file của app (trong SHELL hoặc LATER) không — chỉ những file đó mới được lưu thêm lúc chạy. */
let appFiles = null;
function isAppFile(pathname, base) {
  if (!appFiles) appFiles = new Set([...SHELL, ...LATER].map((u) => (u === "./" ? base : base + u)));
  return appFiles.has(pathname);
}

/** Lưu lại toàn bộ vỏ app (dùng khi phát hiện bộ nhớ đệm bị mất). Hỏng giữa chừng thì thôi, lần mở sau thử lại. */
function refill(c) {
  return c.addAll(SHELL.map((u) => new Request(u, { cache: "reload" })))
    .then(() => c.addAll(LATER))
    .catch(() => {});
}
