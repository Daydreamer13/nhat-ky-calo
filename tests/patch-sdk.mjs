#!/usr/bin/env node
// patch-sdk.mjs <đường-dẫn-tới-anthropic-sdk.js>
// Bước BẮT BUỘC sau mỗi lần đóng gói lại SDK (xem vendor/README.md).
// Trong gói có đúng một biểu thức chính quy dùng "nhìn lùi" (?<= … ); iPhone Safari trước 16.4 không hiểu cú pháp đó
// nên cả file không nạp được, và mọi lần nhờ Claude tính calo đều hỏng. Biểu thức thay thế bắt đúng các đoạn "." và ".."
// trong đường dẫn y như bản gốc, chỉ khác là phần khớp gồm cả dấu "/" đứng trước.
// Script dừng với mã lỗi nếu không tìm thấy đúng một chỗ cần sửa (SDK đổi mã thì phải xem lại bằng tay).
import { readFileSync, writeFileSync } from "node:fs";

const file = process.argv[2];
if (!file) { console.error("Dùng: node tests/patch-sdk.mjs vendor/anthropic-sdk.js"); process.exit(2); }
const src = readFileSync(file, "utf8");
const OLD = String.raw`/(?<=^|\/)(?:\.|%2e){1,2}(?:;[^/]*)?(?=\/|$)/gi`;
const NEW = String.raw`/(?:^|\/)(?:\.|%2e){1,2}(?:;[^/]*)?(?=\/|$)/gi`;
const found = src.split(OLD).length - 1;
if (found === 0 && !/\(\?<[=!]/.test(src)) { console.log("Gói đã sạch, không có gì để vá."); process.exit(0); }
if (found !== 1) { console.error(`Cần đúng 1 chỗ để vá nhưng thấy ${found}. SDK có thể đã đổi mã: kiểm tra lại bằng tay.`); process.exit(1); }
const out = src.replace(OLD, () => NEW);
if (/\(\?<[=!]/.test(out)) { console.error("Sau khi vá vẫn còn regex nhìn lùi khác trong gói: iPhone cũ sẽ không chạy được."); process.exit(1); }
writeFileSync(file, out);
console.log(`Đã vá ${file} (${src.length} → ${out.length} byte).`);
