// make-seed.mjs — tạo một file sao lưu mẫu (6 tuần dùng app) để chạy thử giao diện với dữ liệu thật.
// Dùng:  node tests/make-seed.mjs > _preview/seed.json   (thư mục _preview không đưa lên mạng) rồi Cài đặt → Khôi phục từ file.
// Ngày tháng tính lùi từ hôm nay; có thể truyền ngày khác: node tests/make-seed.mjs 2026-11-20
import zlib from "node:zlib";
import * as L from "../js/logic.js";

const today = process.argv[2] && L.isKey(process.argv[2]) ? process.argv[2] : L.dkey();

/* ---- ảnh mẫu: PNG nhỏ vẽ một "dĩa thức ăn" nhìn từ trên xuống ---- */
function crc32(buf) {
  let c, crc = ~0;
  for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; }
  return ~crc >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function platePng(size, table, plate, foods) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  const c = size / 2;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c) / c;
      let col = table.map((v, i) => v - ((x * 7 + y * 3) % 9) + (i === 0 ? (y % 14 < 2 ? -10 : 0) : 0));
      if (d < 0.86) col = plate.map((v) => v - 14);
      if (d < 0.8) col = plate;
      for (const f of foods) { if (Math.hypot(x - c - f.x * c, y - c - f.y * c) / c < f.r) col = f.c.map((v) => v + (((x + y) % 6) - 3) * 3); }
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = Math.max(0, Math.min(255, col[0])); raw[o + 1] = Math.max(0, Math.min(255, col[1])); raw[o + 2] = Math.max(0, Math.min(255, col[2]));
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
  return "data:image/png;base64," + png.toString("base64");
}
const PHOTOS = {
  "ph-banhmi": platePng(160, [196, 164, 126], [250, 248, 240], [{ x: 0.2, y: -0.1, r: 0.42, c: [222, 168, 84] }, { x: -0.3, y: 0.2, r: 0.26, c: [255, 250, 235] }, { x: -0.3, y: 0.2, r: 0.11, c: [247, 178, 44] }, { x: 0.25, y: 0.42, r: 0.14, c: [120, 180, 90] }]),
  "ph-comtam": platePng(160, [92, 122, 132], [252, 252, 248], [{ x: -0.25, y: -0.15, r: 0.36, c: [248, 244, 232] }, { x: 0.3, y: 0.15, r: 0.3, c: [142, 82, 48] }, { x: 0.05, y: 0.5, r: 0.13, c: [226, 72, 60] }, { x: -0.4, y: 0.4, r: 0.13, c: [128, 190, 96] }]),
  "ph-buncha": platePng(160, [150, 108, 78], [246, 240, 226], [{ x: -0.2, y: 0, r: 0.4, c: [252, 250, 244] }, { x: 0.35, y: -0.2, r: 0.22, c: [150, 86, 50] }, { x: 0.3, y: 0.35, r: 0.2, c: [112, 172, 84] }]),
  "ph-pho": platePng(160, [120, 96, 84], [248, 246, 240], [{ x: 0, y: 0, r: 0.66, c: [214, 168, 110] }, { x: -0.15, y: -0.1, r: 0.26, c: [250, 246, 236] }, { x: 0.25, y: 0.15, r: 0.2, c: [164, 92, 80] }, { x: 0.1, y: -0.35, r: 0.12, c: [110, 176, 86] }]),
  "ph-salad": platePng(160, [226, 214, 196], [255, 255, 252], [{ x: 0, y: 0, r: 0.6, c: [132, 190, 96] }, { x: 0.2, y: -0.2, r: 0.14, c: [232, 80, 66] }, { x: -0.25, y: 0.2, r: 0.14, c: [250, 214, 90] }, { x: 0.1, y: 0.3, r: 0.12, c: [244, 244, 238] }]),
};

/* ---- món ăn mẫu ---- */
const I = (n, q, k, p, c, f) => ({ n, q, k, p, c, f, x: 1 });
const MENU = {
  sang: [
    { name: "Bánh mì ốp la", ph: "ph-banhmi", items: [I("Bánh mì", "1 ổ nhỏ (~70 g)", 190, 6, 38, 2), I("Trứng ốp la", "2 quả", 180, 12, 1, 14), I("Dưa leo", "vài lát", 10, 0, 2, 0)] },
    { name: "Phở bò tái", ph: "ph-pho", items: [I("Phở bò tái", "1 tô vừa", 450, 24, 60, 12)] },
    { name: "Xôi đậu xanh", items: [I("Xôi đậu xanh", "1 gói nhỏ (~180 g)", 360, 9, 68, 6)] },
    { name: "Yến mạch sữa chuối", items: [I("Yến mạch nấu sữa", "1 chén (~250 ml)", 230, 9, 36, 6), I("Chuối", "1 quả vừa", 90, 1, 23, 0)] },
  ],
  trua: [
    { name: "Cơm tấm sườn bì", ph: "ph-comtam", items: [I("Cơm tấm", "1 dĩa (~200 g)", 260, 5, 57, 1), I("Sườn nướng", "1 miếng (~90 g)", 220, 18, 4, 14), I("Bì", "1 nhúm", 50, 4, 2, 3), I("Nước mắm chua ngọt", "2 muỗng", 20, 0, 5, 0)] },
    { name: "Bún chả Hà Nội", ph: "ph-buncha", items: [I("Bún tươi", "1 đĩa nhỏ (~180 g)", 180, 3, 40, 0), I("Chả viên & thịt nướng", "~110 g", 240, 17, 5, 16), I("Nước chấm", "1 chén nhỏ", 45, 1, 10, 0), I("Rau sống", "1 đĩa", 15, 1, 3, 0)] },
    { name: "Cơm gà xối mỡ", items: [I("Cơm chiên", "1 dĩa (~220 g)", 380, 7, 62, 11), I("Đùi gà xối mỡ", "1 cái", 290, 24, 2, 20)] },
    { name: "Salad ức gà", ph: "ph-salad", items: [I("Ức gà áp chảo", "~120 g", 200, 36, 0, 5), I("Rau trộn dầu giấm", "1 tô", 110, 2, 8, 8)] },
  ],
  toi: [
    { name: "Cơm nhà: cá kho, canh rau", items: [I("Cơm trắng", "1 chén (~150 g)", 195, 4, 43, 0), I("Cá kho", "2 khúc (~100 g)", 180, 20, 4, 9), I("Canh rau ngót", "1 chén", 40, 3, 4, 1)] },
    { name: "Bún bò Huế", items: [I("Bún bò Huế", "1 tô vừa", 480, 26, 58, 16)] },
    { name: "Gỏi cuốn tôm thịt", items: [I("Gỏi cuốn", "3 cuốn", 240, 15, 33, 5), I("Tương chấm", "2 muỗng", 60, 2, 8, 2)] },
    { name: "Lẩu nấm (phần một người)", items: [I("Nấm và rau", "1 tô", 90, 5, 12, 2), I("Thịt bò nhúng", "~100 g", 200, 22, 0, 12), I("Mì", "1 vắt nhỏ", 180, 5, 36, 2)] },
  ],
  vat: [
    { name: "Cà phê sữa đá", items: [I("Cà phê sữa đá", "1 ly", 120, 2, 20, 4)] },
    { name: "Chuối", items: [I("Chuối", "1 quả vừa", 90, 1, 23, 0)] },
    { name: "Sữa chua không đường", items: [I("Sữa chua không đường", "1 hộp", 70, 5, 6, 3)] },
    { name: "Trà sữa trân châu", items: [I("Trà sữa trân châu", "1 ly 500 ml", 390, 4, 68, 11)] },
  ],
};
const TIMES = { sang: ["07:05", "07:15", "07:40", "08:10"], trua: ["11:50", "12:20", "12:35", "13:05"], toi: ["18:40", "19:05", "19:30", "20:10"], vat: ["09:30", "15:10", "15:45", "16:20"] };

let seed = 20261120;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const pickOne = (arr) => arr[Math.floor(rnd() * arr.length)];
let idc = 0;
const mk = (type, tpl) => { const m = { id: "s" + (++idc).toString(36), t: pickOne(TIMES[type]), type, name: tpl.name, items: tpl.items.map((x) => ({ ...x })), src: tpl.ph ? "photo" : "manual" }; if (tpl.ph) { m.ph = tpl.ph; m.conf = "high"; } return m; };

const DAYS = 42;
const startDate = L.addDays(today, -DAYS);
const profile = { name: "Linh", sex: "f", birthYear: 1995, height: 158, activity: 1.375, pace: 0.25, goalWeight: 54, customTarget: null, startWeight: 60, startDate };
const days = {};
for (let i = DAYS; i >= 1; i--) {
  const k = L.addDays(today, -i);
  const skip = i === 23 || i === 30 || i === 31; // vài ngày quên ghi
  if (skip) continue;
  const meals = [mk("sang", pickOne(MENU.sang)), mk("trua", pickOne(MENU.trua)), mk("toi", pickOne(MENU.toi))];
  const r = rnd();
  if (r < 0.55) meals.push(mk("vat", MENU.vat[Math.floor(rnd() * 3)]));
  if (i % 9 === 4) meals.push(mk("vat", MENU.vat[3])); // thỉnh thoảng trà sữa → vượt
  if (i === 12) meals.splice(1); // một ngày ghi thiếu
  meals.sort((a, b) => (a.t < b.t ? -1 : 1));
  days[k] = { meals, water: 4 + Math.floor(rnd() * 5), tg: 1470, td: 1750 };
}
// hôm qua: một ngày ăn đủ bữa và trong mục tiêu (1.345 kcal), để thẻ "Hôm qua…" của dữ liệu mẫu là lời khen
{
  const y = L.addDays(today, -1);
  const plan = [["sang", MENU.sang[0], "07:15"], ["trua", MENU.trua[1], "12:20"], ["vat", MENU.vat[2], "15:45"], ["toi", MENU.toi[0], "19:05"]];
  days[y] = { ...days[y], meals: plan.map(([type, tpl, t]) => ({ ...mk(type, tpl), t })) };
}
// hôm nay: sáng và trưa đã ghi
days[today] = { meals: [mk("sang", MENU.sang[0]), mk("trua", MENU.trua[0])].map((m, i) => ({ ...m, t: i ? "12:20" : "07:15" })), water: 5 };
// cân mỗi tuần, giảm dần 60,0 → 57,8
[60.0, 59.6, 59.4, 58.9, 58.7, 58.3, 57.8].forEach((w, i) => { const k = L.addDays(today, -DAYS + i * 7); (days[k] ||= { meals: [] }).weight = w; });

const out = {
  app: L.BACKUP_APP, version: 1, exportedAt: new Date().toISOString(),
  profile,
  settings: { pronoun: "em", partner: "anh", theme: "auto", accent: "a1", water: true, waterGoal: 8, model: "claude-opus-5-5", notes: ["Anh tự hào về em lắm. Cố lên vợ yêu nhé!", "Dù cái cân nói gì, em vẫn đẹp nhất với anh.", "Mỗi ngày một chút thôi. Anh luôn ở bên em."], rewards: [{ kg: 2, text: "Một buổi spa" }, { kg: 4, text: "Váy mới" }, { kg: 6, text: "Chuyến đi Đà Lạt" }] },
  meta: { earned: {}, seen: {} },
  favs: [{ name: "Sữa chua không đường", items: MENU.vat[2].items }],
  days,
  photos: PHOTOS,
};
process.stdout.write(JSON.stringify(out));
