#!/usr/bin/env node
// Máy chủ tĩnh tí hon để mở app trên máy tính khi phát triển (không cần cài gì thêm).
//
//   node tests/serve.mjs            → http://localhost:8790
//   node tests/serve.mjs 9000       → cổng khác
//   node tests/serve.mjs --lan      → cho điện thoại cùng Wi-Fi mở thử qua http://<IP-máy-tính>:8790
//
// Lưu ý: qua http thường (không phải https) điện thoại chỉ XEM THỬ được giao diện; muốn cài lên màn hình chính
// và chạy offline thì app phải nằm ở địa chỉ https (xem HUONG-DAN.md, mục "Đưa app lên mạng").
import http from "node:http";
import os from "node:os";
import { readFile, stat } from "node:fs/promises";
import { join, extname, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url)).replace(/[\\/]+$/, "");
const args = process.argv.slice(2);
const lan = args.includes("--lan");
const port = Number(args.find((a) => /^\d+$/.test(a)) || 8790);
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".txt": "text/plain; charset=utf-8", ".md": "text/plain; charset=utf-8",
};

http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    const file = normalize(join(root, p));
    if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    const s = await stat(file).catch(() => null);
    if (!s || !s.isFile()) { res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("Không có file này"); return; }
    res.writeHead(200, { "content-type": MIME[extname(file).toLowerCase()] || "application/octet-stream", "cache-control": "no-store" });
    res.end(await readFile(file));
  } catch (e) {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" }).end(String(e));
  }
}).listen(port, lan ? "0.0.0.0" : "127.0.0.1", () => {
  console.log(`Nhật Ký Calo đang chạy ở http://localhost:${port}`);
  if (lan) {
    for (const list of Object.values(os.networkInterfaces())) {
      for (const a of list || []) if (a.family === "IPv4" && !a.internal) console.log(`Điện thoại cùng Wi-Fi mở: http://${a.address}:${port}`);
    }
  }
  console.log("Nhấn Ctrl+C để dừng.");
});
