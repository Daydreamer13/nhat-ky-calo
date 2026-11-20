// Huy hiệu "Hoa đã hái" — mỗi huy hiệu là một bông hoa ép, và hộp quà ở mỗi chặng.
// Dựng lại đúng cấu trúc của bản thiết kế (ô 84×84, tâm 42·42, đĩa r=19, vòng chấm r=15,5),
// nhưng tự chứa: không <use>, không id, màu lấy từ lớp .f-* và biến CSS của css/app.css
// nên chạy được ở cả nền sáng lẫn nền tối, trong danh sách lẫn trong cửa sổ chúc mừng.

export const BADGE_IDS = [
  "first", "streak3", "streak7", "streak30", "ok5", "ok10", "ok30", "photo30", "water7",
  "lost1", "lost2", "half", "goal", "streak", "lost",
];

/* ---------------------------------------------------------------- hình cơ bản */

const VB = 84;
const FONT = "var(--font-display, system-ui), system-ui, -apple-system, 'Segoe UI', sans-serif";

const n2 = (v) => String(Math.round(v * 100) / 100);
const turn = (a) => (a ? ` transform="rotate(${n2(a)} 42 42)"` : "");
const around = (count, off, one) =>
  Array.from({ length: count }, (_, i) => one(turn(off + (i * 360) / count))).join("");
const dots = (count, cy, r, off = 0) => around(count, off, (t) => `<circle cx="42" cy="${cy}" r="${r}"${t}/>`);
const blades = (d, count, off = 0) => around(count, off, (t) => `<path d="${d}"${t}/>`);

// Ba họ cánh hoa của bản thiết kế + hai họ mở rộng (máy ảnh, nước).
const PETAL_6 = "M42 42C29 31 33 13 42 4c9 9 13 27 0 38z";
const PETAL_6_IN = "M42 42C33.5 34 35.5 21 42 14c6.5 7 8.5 20 0 28z";
const SEPAL = "M42 31C36.2 24.5 36 10.5 42 1.6c6 8.9 5.8 22.9 0 29.4z";
const S = {
  rosetteOut: (o) => dots(8, 16, 12, o),
  rosetteIn: (o) => dots(8, 22, 9.5, o),
  petals5: (o) => dots(5, 20, 14.5, o),
  petals5Mid: (o) => dots(5, 22.2, 13.05, o),      // = petals-5 thu về 0,9 quanh tâm
  petals5In: (o) => dots(5, 25, 10, o),
  petals6: (o) => blades(PETAL_6, 6, o),
  petals6In: (o) => blades(PETAL_6_IN, 6, o),
  sunflower: (o) => dots(12, 14.2, 9.4, o),        // bông hướng dương của nút Chụp món
  sunflowerIn: (o) => dots(12, 21, 7, o),
  water6: (o) => dots(6, 19.5, 13.5, o),
  water6In: (o) => dots(6, 24.5, 9.6, o),
  sepals: (o) => blades(SEPAL, 5, o),               // lá đài ló ra sau cánh hoa
};

const layer = (token, shape, opacity) =>
  `<g style="fill:var(--${token})${opacity == null ? "" : `;opacity:${opacity}`}">${shape}</g>`;
const ghost = (token, shape) => layer(token, shape, 0.25);

/* ---------------------------------------------------------------- bông hoa nền */

// Mỗi kiểu: tone = màu vòng chấm / màu hoa mờ khi khoá; on = các lớp cánh khi đã hái;
// off = bóng mờ khi còn khoá (một lớp cho mốc nhỏ, hai lớp cho mốc lớn); rim = viền vàng quanh đĩa.
const FLOWERS = {
  sun1: { tone: "sun", on: () => layer("sun", S.rosetteOut(0)), off: () => ghost("sun", S.rosetteOut(0)) },
  sun2: { tone: "sun", on: () => layer("sun", S.rosetteOut(0)) + layer("sun-soft", S.rosetteIn(22.5)), off: () => ghost("sun", S.rosetteOut(0)) },
  sun3: {
    tone: "sun", rim: "over",
    on: () => layer("over", S.rosetteOut(22.5)) + layer("sun", S.rosetteOut(0)) + layer("sun-soft", S.rosetteIn(22.5)),
    off: () => ghost("sun", S.rosetteOut(0)) + ghost("sun", S.rosetteOut(22.5)),
  },
  leaf1: { tone: "leaf", on: () => layer("leaf-light", S.petals6(0)) + layer("leaf", S.petals6In(30)), off: () => ghost("leaf", S.petals6(0)) },
  leaf2: {
    tone: "leaf",
    on: () => layer("leaf-strong", S.petals6(0)) + layer("leaf", S.petals6(30)) + layer("leaf-light", S.petals6In(30)),
    off: () => ghost("leaf", S.petals6(0)) + ghost("leaf", S.petals6(30)),
  },
  leaf3: {
    tone: "leaf", rim: "sun",
    on: () => layer("leaf-strong", S.petals6(0)) + layer("leaf", S.petals6(30)) + layer("leaf-light", S.petals6In(30)) + layer("sun", S.petals6In(0)),
    off: () => ghost("leaf", S.petals6(0)) + ghost("leaf", S.petals6(30)),
  },
  bloom1: { tone: "bloom", on: () => layer("bloom-light", S.petals5(0)) + layer("bloom", S.petals5In(36)), off: () => ghost("bloom", S.petals5(0)) },
  bloom2: { tone: "bloom", on: () => layer("bloom", S.petals5(0)) + layer("bloom-light", S.petals5Mid(36)), off: () => ghost("bloom", S.petals5(0)) },
  bloom3: {
    tone: "bloom",
    on: () => layer("bloom", S.petals5(0)) + layer("bloom-light", S.petals5Mid(36)) + layer("bloom", S.petals5In(0)),
    off: () => ghost("bloom", S.petals5(0)),
  },
  bloom4: {
    tone: "bloom", rim: "sun",
    on: () => layer("leaf-strong", S.sepals(27)) + layer("leaf", S.sepals(45)) + layer("bloom", S.petals5(0)) + layer("bloom-light", S.petals5Mid(36)) + layer("sun", S.petals5In(0)),
    off: () => ghost("bloom", S.petals5(0)) + ghost("bloom", S.petals5(36)),
  },
  camera: { tone: "sun", on: () => layer("sun", S.sunflower(0)) + layer("sun-soft", S.sunflowerIn(15)), off: () => ghost("sun", S.sunflower(0)) },
  water: { tone: "water", on: () => layer("water", S.water6(0)) + layer("water-soft", S.water6In(30)), off: () => ghost("water", S.water6(0)) },
};

/* ---------------------------------------------------------------- hình ở giữa */

// Bảng màu của hình giữa đĩa: đã hái = mực + một màu nhấn; còn khoá = xám dịu.
function inks(on) {
  const mute = "var(--ink-3)";
  return {
    on,
    ink: on ? "var(--ink)" : mute,
    ink2: on ? "var(--ink-2)" : mute,
    paper: "var(--surface)",
    acc: (token) => (on ? `fill:var(--${token})` : `fill:${mute};fill-opacity:.42`),
  };
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// Số ở giữa: luôn canh giữa theo cả hai chiều, co chữ theo số ký tự (1–3 ký tự vừa vòng chấm).
function numeral(text, k, { y = 42.5, size, wide = 27 } = {}) {
  const s = String(text);
  const len = [...s].length;
  const fs = size ?? (len <= 2 ? 20 : len === 3 ? 15.5 : len === 4 ? 12.5 : 11.5);
  const fit = len > 3 ? ` textLength="${wide}" lengthAdjust="spacingAndGlyphs"` : "";
  return `<text x="42" y="${y}" dy=".355em" text-anchor="middle"${fit} style="font-family:${FONT};font-size:${fs}px;font-weight:700;letter-spacing:-.02em;fill:${k.ink}">${esc(s)}</text>`;
}

// Số ngày / số kg người gọi đưa vào → chuỗi gọn kiểu Việt ("2,5").
function tidy(num, fallback) {
  if (num == null || num === "" || (typeof num === "number" && !Number.isFinite(num))) return String(fallback);
  if (typeof num === "number") return String(Math.round(Math.abs(num) * 10) / 10).replace(".", ",");
  return String(num).trim().replace(/^[-−–+]\s*/, "").replace(".", ",") || String(fallback);
}

// Ngọn lửa nhỏ đậu trên mép đĩa — dấu hiệu của chuỗi ngày.
function flame(k) {
  const d = "M42.2 12.2c.5 4.3 5.6 6.1 5.6 11.1a5.8 5.8 0 0 1-11.6 0c0-2.2.9-3.9 2.3-5.2.2 1.5.8 2.5 1.8 3-.5-3.2.2-6.3 1.9-8.9z";
  return (k.on ? `<path d="${d}" style="fill:${k.paper};stroke:${k.paper};stroke-width:3.2;stroke-linejoin:round"/>` : "")
    + `<path d="${d}" style="${k.on ? "fill:var(--over)" : `fill:${k.ink};fill-opacity:.62`}"/>`
    + `<path d="M42.1 20.8c1.7 1.5 2.5 2.5 2.5 3.8a2.5 2.5 0 0 1-5 0c0-1.3.8-2.3 2.5-3.8z" style="${k.on ? "fill:var(--sun)" : `fill:${k.paper};fill-opacity:.7`}"/>`;
}

// Mầm hai lá mọc trên mép đĩa — dấu hiệu "ngày đạt" (cùng hình với dải tuần ở màn Hôm nay).
function sprout(k) {
  const stem = "M42 31V19.5";
  const left = "M42 25c-5.1 0-8.4-3-8.4-7.7 4.8 0 8.4 2.6 8.4 7.7z";
  const right = "M42 21.6c0-5.1 3-8.4 8.4-8.4 0 5.1-3 8.4-8.4 8.4z";
  const halo = `fill:${k.paper};stroke:${k.paper};stroke-width:3;stroke-linejoin:round;stroke-linecap:round`;
  if (!k.on) return `<g style="opacity:.62"><path d="${stem}" style="fill:none;stroke:${k.ink};stroke-width:2;stroke-linecap:round"/><path d="${left}${right}" style="fill:${k.ink}"/></g>`;
  return `<path d="${left}${right}" style="${halo}"/><path d="${stem}" style="fill:none;stroke:${k.paper};stroke-width:5;stroke-linecap:round"/>`
    + `<path d="${stem}" style="fill:none;stroke:var(--leaf-strong);stroke-width:2.2;stroke-linecap:round"/>`
    + `<path d="${left}" style="fill:var(--leaf)"/><path d="${right}" style="fill:var(--leaf-light)"/>`;
}

// Bông hoa năm cánh của cây trong chậu (tâm 0·0, bán kính ≈ 10,6).
function bloomFlower(cx, cy, scale, petal = "fill:var(--bloom)", heart = "fill:var(--sun)") {
  const petals = Array.from({ length: 5 }, (_, i) => `<circle cy="-6" r="4.6"${i ? ` transform="rotate(${i * 72})"` : ""}/>`).join("");
  return `<g transform="translate(${cx} ${cy}) scale(${scale})"><g style="${petal}">${petals}</g><circle r="3.6" style="${heart}"/></g>`;
}

const EMBLEMS = {
  // bát cơm và đôi đũa — đúng hình trong bản thiết kế
  bowl: (k) =>
    `<path d="M31.5 42h21a10.5 10.5 0 0 1-21 0z" style="fill:${k.ink}"/>`
    + `<rect x="38" y="52" width="8" height="2.6" rx="1.3" style="fill:${k.ink}"/>`
    + `<path d="M38 39l11-9M43 39l10-7" style="fill:none;stroke:${k.ink};stroke-width:2;stroke-linecap:round"/>`,

  streak: (k, text) => numeral(text, k) + flame(k),
  days: (k, text) => numeral(text, k) + sprout(k),

  // "−1" và chữ "kg" bên dưới
  // (chữ "kg" đủ lớn để đọc được ở cỡ 64 px; viền giấy quanh chữ để đuôi chữ g không dính vòng chấm)
  kg: (k, text) =>
    numeral(`−${text}`, k, { y: 38, wide: 25 })   // số nằm cao hơn tâm → dây cung hẹp hơn, bó chữ dài lại
    + `<text x="42" y="51" dy=".355em" text-anchor="middle" style="font-family:${FONT};font-size:10.5px;font-weight:700;letter-spacing:.02em;fill:${k.ink}${k.on ? `;stroke:${k.paper};stroke-width:2.6;stroke-linejoin:round;paint-order:stroke` : ""}">kg</text>`,

  // bông hoa đã nở của cây
  flower: (k) =>
    bloomFlower(42, 42.4, 1.36, k.acc("bloom"), k.on ? "fill:var(--sun)" : `fill:${k.paper}`),

  camera: (k) =>
    `<path d="M33.5 35.8h2.7l1.5-2.3a2.2 2.2 0 0 1 1.8-1h5a2.2 2.2 0 0 1 1.8 1l1.5 2.3h2.7a3 3 0 0 1 3 3V49a3 3 0 0 1-3 3h-17a3 3 0 0 1-3-3V38.8a3 3 0 0 1 3-3z" style="fill:${k.ink}"/>`
    + `<circle cx="42" cy="43.6" r="5" style="fill:${k.paper}"/>`
    + `<circle cx="42" cy="43.6" r="2.7" style="${k.on ? "fill:var(--sun)" : `fill:${k.ink};fill-opacity:.42`}"/>`,

  drop: (k) =>
    `<path d="M42 28.5c5.3 6.3 9 11 9 15.6a9 9 0 0 1-18 0c0-4.6 3.7-9.3 9-15.6z" style="${k.acc("water")}"/>`
    + `<path d="M37.3 45.2a4.8 4.8 0 0 0 3.3 4" style="fill:none;stroke:var(--ill-light);stroke-opacity:.7;stroke-width:1.7;stroke-linecap:round"/>`,

  // con đường đi được một nửa, cắm cờ ở giữa
  halfway: (k) =>
    // hai đầu đường nằm đúng trên vòng chấm của đĩa → lót giấy để vòng chấm không chạm vào
    (k.on ? `<g style="fill:${k.paper}"><circle cx="29" cy="49" r="4"/><circle cx="55" cy="49" r="4.2"/></g>` : "")
    // nửa đã đi: nét liền từ chấm xuất phát tới chân cờ
    + `<path d="M29 49H42" style="fill:none;stroke:${k.ink};stroke-width:2.6;stroke-linecap:round"/>`
    // nửa còn lại: chấm tròn dẫn tới vòng đích (đặt tay để không chấm nào dính cột cờ hay vòng đích)
    + `<path d="M45.7 49h.01M49.3 49h.01" style="fill:none;stroke:${k.ink2};stroke-width:2.4;stroke-linecap:round"/>`
    + `<circle cx="29" cy="49" r="2.7" style="fill:${k.ink}"/>`
    + `<circle cx="55" cy="49" r="2.7" style="fill:${k.paper};stroke:${k.ink2};stroke-width:1.6"/>`
    // cột cờ mảnh hơn con đường để mắt đọc "đường" trước, "cờ" sau
    + `<path d="M42 49V32" style="fill:none;stroke:${k.ink};stroke-width:1.8;stroke-linecap:round"/>`
    + `<path d="M43.1 31.1c3.8.3 7.3 1.9 10 4.7-2.7 2.8-6.2 4.4-10 4.7z" style="${k.on ? "fill:var(--clay)" : `fill:${k.ink};fill-opacity:.5`}"/>`,

  // cờ đích ca-rô trên một gò nhỏ
  finish: (k) =>
    `<path d="M33.5 53.5c2.3-3.4 6.3-3.4 8.6 0z" style="${k.acc("leaf")}"/>`
    + `<path d="M36.5 52.5V30.5" style="fill:none;stroke:${k.ink};stroke-width:2.2;stroke-linecap:round"/>`
    + `<rect x="37.6" y="30.3" width="15.9" height="11.4" rx="1.6" style="${k.on ? "fill:var(--sun)" : `fill:${k.paper}`}"/>`
    + `<path d="M37.6 31.9a1.6 1.6 0 0 1 1.6-1.6h3.7V36h-5.3zM42.9 36h5.3v5.7h-5.3zM48.2 30.3h3.7a1.6 1.6 0 0 1 1.6 1.6V36h-5.3z" style="fill:${k.on ? "var(--on-sun)" : k.ink}"/>`,
};

/* ---------------------------------------------------------------- bộ huy hiệu */

const streakFlower = (n) => (n >= 30 ? "leaf3" : n >= 7 ? "leaf2" : "leaf1");
const lostFlower = (n) => (n >= 2 ? "bloom2" : "bloom1");
const toNumber = (text) => parseFloat(String(text).replace(",", ".")) || 0;

const BADGES = {
  first: () => ({ flower: "sun2", emblem: "bowl" }),
  streak3: (num) => ({ flower: "leaf1", emblem: "streak", text: tidy(num, 3) }),
  streak7: (num) => ({ flower: "leaf2", emblem: "streak", text: tidy(num, 7) }),
  streak30: (num) => ({ flower: "leaf3", emblem: "streak", text: tidy(num, 30) }),
  ok5: (num) => ({ flower: "sun1", emblem: "days", text: tidy(num, 5) }),
  ok10: (num) => ({ flower: "sun2", emblem: "days", text: tidy(num, 10) }),
  ok30: () => ({ flower: "sun3", emblem: "flower", ring: false }),
  photo30: () => ({ flower: "camera", emblem: "camera" }),
  water7: () => ({ flower: "water", emblem: "drop" }),
  lost1: (num) => ({ flower: "bloom1", emblem: "kg", text: tidy(num, 1) }),
  lost2: (num) => ({ flower: "bloom2", emblem: "kg", text: tidy(num, 2) }),
  half: () => ({ flower: "bloom3", emblem: "halfway" }),
  goal: () => ({ flower: "bloom4", emblem: "finish" }),
  streak: (num) => { const text = tidy(num, 1); return { flower: streakFlower(toNumber(text)), emblem: "streak", text }; },
  lost: (num) => { const text = tidy(num, 1); return { flower: lostFlower(toNumber(text)), emblem: "kg", text }; },
};

const LOCK =
  '<circle cx="66" cy="66" r="11.5" style="fill:var(--surface);stroke:var(--leaf-soft);stroke-width:1.5"/>'
  + '<g transform="translate(58.2 57.6) scale(.65)" style="fill:none;stroke:var(--ink-2);stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round">'
  + '<rect x="5.5" y="10.5" width="13" height="9.5" rx="2.6"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/></g>';

const px = (size, fallback) => { const v = Number(size); return Number.isFinite(v) && v > 0 ? v : fallback; };

/**
 * Một huy hiệu hoa ép.
 * @param {string} id   một trong BADGE_IDS (id lạ → vẽ "first")
 * @param {boolean} on  true = đã hái (đủ màu); false = còn khoá (mờ, có ổ khoá nhỏ)
 * @param {number} size cạnh hình vuông, px
 * @param {number|string} [num] số hiển thị cho "streak" / "lost" (và ghi đè số mặc định của các mốc có số)
 * @returns {string} chuỗi <svg> tự chứa, viewBox vuông
 */
export function badgeArt(id, on = true, size = 96, num) {
  const make = Object.prototype.hasOwnProperty.call(BADGES, id) ? BADGES[id] : BADGES.first;
  const spec = make(num);
  const f = FLOWERS[spec.flower];
  const k = inks(!!on);
  const s = px(size, 96);
  const disc = on
    ? `<circle cx="42" cy="42" r="19" style="fill:var(--surface)"/>`
      + (f.rim ? `<circle cx="42" cy="42" r="19.6" style="fill:none;stroke:var(--${f.rim});stroke-width:1.8"/>` : "")
      + (spec.ring === false ? "" : `<circle cx="42" cy="42" r="15.5" style="fill:none;stroke:var(--${f.tone});stroke-width:1.5;stroke-dasharray:1 3.2;stroke-linecap:round;opacity:.6"/>`)
    : `<circle cx="42" cy="42" r="19" style="fill:var(--surface);opacity:.85"/>`;
  const body = (on ? f.on() : f.off()) + disc + EMBLEMS[spec.emblem](k, spec.text) + (on ? "" : LOCK);
  return `<svg class="badge-art${on ? "" : " is-locked"}" viewBox="0 0 ${VB} ${VB}" width="${s}" height="${s}" aria-hidden="true" focusable="false">${body}</svg>`;
}

/* ---------------------------------------------------------------- hộp quà */

const heart = (x, y, s, rot = 0) =>
  `<path transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" d="M0 6.4S-7.5 1.8-7.5-3.8A4.2 4.2 0 0 1 0-6.3 4.2 4.2 0 0 1 7.5-3.8C7.5 1.8 0 6.4 0 6.4z" class="f-bloom"/>`;
const spark = (x, y, s, cls = "f-sun") =>
  `<path transform="translate(${x} ${y}) scale(${s})" d="M0-6C.7-2 2-.7 6 0 2 .7.7 2 0 6-.7 2-2 .7-6 0-2-.7-.7-2 0-6z" class="${cls}"/>`;

// Nơ: hai vòng ruy băng + nút thắt, tâm nút ở 0·0.
const BOW =
  '<path class="f-sun" d="M0 0C-7-15-22-17-24-9.5-25.5-2-12 2 0 0zM0 0C7-15 22-17 24-9.5 25.5-2 12 2 0 0z"/>'
  + '<path class="f-over" d="M-3.5-2.5C-8-9.5-15.5-11.5-17-8.5-18-5.5-11-2.5-3.5-2.5zM3.5-2.5C8-9.5 15.5-11.5 17-8.5 18-5.5 11-2.5 3.5-2.5z"/>'
  + '<rect class="f-over" x="-5.5" y="-6.5" width="11" height="10" rx="4"/>';

/**
 * Hộp quà ở mỗi chặng.
 * @param {boolean} open false = còn gói kín; true = đã mở, hoa và tim bung ra
 * @param {number} size  cạnh hình vuông, px
 * @returns {string} chuỗi <svg> tự chứa, viewBox 0 0 120 120
 */
export function giftArt(open = false, size = 120) {
  const s = px(size, 120);
  let body;
  if (!open) {
    body =
      '<ellipse class="ill-shadow" cx="60" cy="107" rx="40" ry="4.5"/>'
      + '<rect class="f-bloom" x="27" y="56" width="66" height="50" rx="7"/>'
      + '<rect class="ill-gloss" x="32" y="66" width="6" height="35" rx="3"/>'
      + '<rect class="f-sun" x="53" y="56" width="14" height="50"/>'
      + '<rect x="27" y="62" width="66" height="5" style="fill:var(--clay-deep);opacity:.42"/>'
      + '<rect class="f-bloom-light" x="21" y="43" width="78" height="20" rx="7"/>'
      + '<rect class="f-sun" x="53" y="43" width="14" height="20"/>'
      + '<rect class="ill-gloss" x="27" y="47" width="20" height="3.5" rx="1.75"/>'
      + `<g transform="translate(60 43)">${BOW}</g>`;
  } else {
    body =
      '<circle cx="60" cy="52" r="46" style="fill:var(--halo)"/>'
      + '<ellipse class="ill-shadow" cx="60" cy="107" rx="38" ry="4.5"/>'
      // tia nắng bung ra
      + '<g style="fill:none;stroke:var(--sun);stroke-width:3;stroke-linecap:round"><path d="M36 34l-6.5-6.5M24 57h-9"/></g>'
      // hoa mọc lên từ hộp
      + '<path class="ill-stem" style="stroke-width:3.4" d="M60 68C60 56 57 50 58 41"/>'
      + '<path class="f-leaf" d="M59.5 60c-8.5 1-13.5-3-14.5-10 7.5-1 13.5 3 14.5 10z"/>'
      + '<path class="f-leaf-light" d="M59.5 56c0-7.5 4-12 11.5-12.5.5 7.5-4 12.5-11.5 12.5z"/>'
      + bloomFlower(58, 33, 1.5)
      + heart(33, 47, 0.78, -14) + heart(100, 60, 0.58, 14)
      + spark(22, 34, 0.85) + spark(46, 14, 0.6) + spark(103, 40, 0.7)
      + '<circle class="f-water" cx="27" cy="68" r="2.2"/><circle class="f-leaf-light" cx="80" cy="56" r="2.4"/><circle class="f-bloom-light" cx="74" cy="14" r="2.2"/>'
      // thân hộp
      + '<rect class="f-bloom" x="29" y="64" width="62" height="42" rx="7"/>'
      + '<path d="M29 71a7 7 0 0 1 7-7h48a7 7 0 0 1 7 7v1H29z" style="fill:var(--clay-deep);opacity:.5"/>'
      + '<rect class="ill-gloss" x="34" y="75" width="6" height="26" rx="3"/>'
      + '<rect class="f-sun" x="53" y="64" width="14" height="42"/>'
      // nắp bật sang phải
      + '<g transform="translate(89 37) rotate(24)">'
      + '<rect class="f-bloom-light" x="-27" y="-7" width="54" height="15" rx="6"/>'
      + '<rect class="f-sun" x="-5.5" y="-7" width="11" height="15"/>'
      + `<g transform="translate(0 -7) scale(.72)">${BOW}</g>`
      + "</g>";
  }
  return `<svg class="gift-art${open ? " is-open" : ""}" viewBox="0 0 120 120" width="${s}" height="${s}" aria-hidden="true" focusable="false">${body}</svg>`;
}
