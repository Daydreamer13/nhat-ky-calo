// check-shell.mjs — đối chiếu danh sách lưu sẵn trong sw.js với những file app thật sự nạp.
// Kiểm thêm: gói SDK trong vendor/ không chứa cú pháp regex mà iPhone Safari 15.4–16.3 không hiểu.
// Chạy:  node tests/check-shell.mjs   (thoát mã 1 nếu thiếu hoặc thừa)
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join, normalize, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = normalize(join(dirname(fileURLToPath(import.meta.url)), ".."));
const rel = (p) => relative(root, p).replace(/\\/g, "/");
const read = (p) => readFileSync(join(root, p), "utf8");

// 1) file được nạp từ index.html
const html = read("index.html");
const needed = new Set(["index.html"]);
for (const m of html.matchAll(/(?:href|src)="([^"#?]+)"/g)) {
  const u = m[1];
  if (/^(https?:)?\/\//.test(u) || u.startsWith("data:")) continue;
  needed.add(u);
}
// 1b) file mà các stylesheet của app trỏ tới bằng url(...) — phông chữ nằm trong fonts/, ảnh nền nếu có
for (const cssFile of [...needed].filter((f) => f.endsWith(".css"))) {
  for (const m of read(cssFile).matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
    const u = m[1].split(/[?#]/)[0];
    if (!u || /^(https?:)?\/\//.test(u) || u.startsWith("data:")) continue;
    needed.add(rel(normalize(join(root, dirname(cssFile), u))));
  }
}
// 2) đồ thị import của js/app.js (import tĩnh và import() động với đường dẫn chuỗi)
const seen = new Set();
(function walk(file) {
  if (seen.has(file)) return;
  seen.add(file);
  needed.add(file);
  if (file.startsWith("vendor/")) return; // gói SDK đã đóng thành một file
  const src = read(file);
  for (const m of src.matchAll(/(?:import|export)\s[^"'`;]*?from\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g)) {
    const spec = m[1] || m[2];
    if (!spec.startsWith(".")) continue;
    walk(rel(normalize(join(root, dirname(file), spec))));
  }
})("js/app.js");
// 3) biểu tượng trong manifest
const manifest = JSON.parse(read("manifest.webmanifest"));
for (const i of manifest.icons || []) needed.add(i.src);
needed.add("manifest.webmanifest");

// danh sách trong sw.js
const sw = read("sw.js");
const list = (name) => {
  const m = new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`).exec(sw);
  return m ? [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]) : [];
};
const shell = new Set([...list("SHELL"), ...list("LATER")]);

let bad = 0;
for (const f of [...needed].sort()) if (!shell.has(f)) { console.log("THIẾU trong sw.js:", f); bad++; }
for (const f of [...shell].sort()) {
  if (f === "./") continue;
  if (!existsSync(join(root, f))) { console.log("KHÔNG CÓ trên đĩa:", f); bad++; }
  else if (!needed.has(f)) console.log("thừa (không ai nạp):", f);
}

// 4) gói trong vendor/ không được chứa regex "nhìn lùi" (?<= hoặc (?<! : iPhone Safari trước 16.4 không hiểu,
//    cả file sẽ không nạp được (mọi lần nhờ Claude tính calo đều hỏng). Đóng gói lại SDK thì phải vá lại chỗ đó.
const vendorDir = join(root, "vendor");
if (existsSync(vendorDir)) {
  for (const f of readdirSync(vendorDir).filter((n) => /\.m?js$/.test(n)).sort()) {
    const src = read("vendor/" + f);
    for (const mark of ["(?<=", "(?<!"]) {
      const at = src.indexOf(mark);
      if (at < 0) continue;
      console.log(`REGEX NHÌN LÙI ${mark} trong vendor/${f} (iPhone cũ không chạy được): …${src.slice(Math.max(0, at - 20), at + 50).replace(/\s+/g, " ")}…`);
      bad++;
    }
  }
}

console.log(bad ? `✗ ${bad} lỗi` : `✓ sw.js khớp với ${needed.size} file app cần`);
process.exit(bad ? 1 : 0);
