// Cây hoa — linh vật của Nhật Ký Calo. Sáu giai đoạn của CÙNG một cây trong CÙNG một chậu đất nung:
//   1 Hạt giống · 2 Nảy mầm · 3 Ra lá · 4 Ra nụ · 5 Nở hoa · 6 Rực rỡ
// Giai đoạn 4 là nguyên bản <symbol id="plant"> của bản thiết kế (đã bung các <use> ra để không phụ thuộc sprite).
// Màu chỉ dùng các lớp tô trong css/app.css (.f-* / .ill-*) nên tự đổi theo giao diện sáng – tối.
// Phần phía trên miệng chậu luôn nằm trong <g class="plant__top"> (CSS của app cho nó đung đưa).

export const PLANT_VIEWBOX = "0 0 140 172";

/* ---------- các mảnh dùng chung (toạ độ gốc giống sprite của bản thiết kế) ---------- */

const LEAF_D = "M0 0C6-11 24-13 36 0 24 13 6 11 0 0z";

/** Lá có một đường gân sáng — tương đương <use href="#leaf-full" class=… transform=…>. */
const leaf = (cls, transform) =>
  `<g class="${cls}" transform="${transform}"><path d="${LEAF_D}"/><path class="ill-vein" d="M5 0H28"/></g>`;

/** Nụ khép, gốc nụ ở 0,0, mũi nụ hướng lên — tương đương <use href="#bud" transform=…>. */
const bud = (transform) =>
  `<g transform="${transform}">` +
  `<path class="f-bloom" d="M0 0C-9-5-9.5-18 0-28 9.5-18 9-5 0 0z"/>` +
  `<path class="f-bloom-light" d="M0-3C-3.2-9-3.2-17 0-25 3.2-17 3.2-9 0-3z"/>` +
  `<path class="f-leaf-deep" d="M0 2C-8 1-11-6-9-13-4-9-1-5 0 2z"/>` +
  `<path class="f-leaf" d="M0 2C8 1 11-6 9-13 4-9 1-5 0 2z"/>` +
  `</g>`;

const FIVE = [0, 72, 144, 216, 288];
const PETALS = FIVE.map((a) => `<circle cy="-6" r="4.6"${a ? ` transform="rotate(${a})"` : ""}/>`).join("");
const PETAL_LIGHTS = FIVE.map((a) => `<path d="M0-3.4C-1.7-5.2-1.7-8 0-9.4 1.7-8 1.7-5.2 0-3.4z"${a ? ` transform="rotate(${a})"` : ""}/>`).join("");

/**
 * Hoa năm cánh của bản thiết kế (tâm 0,0, r≈10,6) thêm một vệt sáng trên mỗi cánh như cánh trong của nụ.
 * sepals: góc (độ, 0 = phía trên) mà cuống đi tới — đài hoa ló ra ở phía đó; null = không vẽ đài.
 */
const flower = (x, y, s, { rot = 0, sepals = 180 } = {}) =>
  `<g transform="translate(${x} ${y})${rot ? ` rotate(${rot})` : ""} scale(${s})">` +
  (sepals == null
    ? ""
    : `<g transform="rotate(${sepals - rot})">` +
      `<path class="f-leaf-deep" d="M0-3C-6.5-6-9.5-10.5-8.5-14.5-3.5-13-.5-9 0-3z"/>` +
      `<path class="f-leaf" d="M0-3C6.5-6 9.5-10.5 8.5-14.5 3.5-13 .5-9 0-3z"/>` +
      `</g>`) +
  `<g class="f-bloom">${PETALS}</g>` +
  `<g class="f-bloom-light">${PETAL_LIGHTS}</g>` +
  `<circle class="f-sun" r="3.6"/><circle class="ill-gloss" cx="-1.1" cy="-1.2" r="1.3" style="opacity:.5"/>` +
  `</g>`;

/** Tia lấp lánh bốn cánh, tâm x,y, bán kính r. */
const spark = (x, y, r) => {
  const k = +(r * 0.16).toFixed(2);
  return `<path transform="translate(${x} ${y})" d="M0-${r}Q${k}-${k} ${r} 0 ${k} ${k} 0 ${r}-${k} ${k}-${r} 0-${k}-${k} 0-${r}z"/>`;
};

/* ---------- chậu: giữ nguyên từng nét của #plant ---------- */

const POT =
  `<ellipse class="ill-shadow" cx="70" cy="167.5" rx="36" ry="4.5"/>` +
  `<path class="f-clay-deep" d="M43 130H97L91.5 161Q90.5 167 84.5 167H55.5Q49.5 167 48.5 161Z"/>` +
  `<path class="ill-gloss" d="M47 130h9l3 37h-3.5q-6 0-7-6z"/>` +
  `<rect class="f-clay" x="37" y="118" width="66" height="15" rx="7.5"/>` +
  `<rect class="ill-gloss" x="43" y="127" width="54" height="3" rx="1.5"/>` +
  `<ellipse class="f-soil" cx="70" cy="121.5" rx="27" ry="3.5"/>`;

const top = (inner) => `<g class="plant__top">${inner}</g>`;
const stems = (...d) => `<g class="ill-stem">${d.map((p) => `<path d="${p}"/>`).join("")}</g>`;
/** Cuống phụ mảnh hơn thân chính (4.2) một chút, vẫn đủ dày để đọc được ở 56 px. */
const sideStems = (...d) => `<g class="ill-stem" style="stroke-width:3.2">${d.map((p) => `<path d="${p}"/>`).join("")}</g>`;

/* ---------- thân và lá của cây trưởng thành (giai đoạn 4 – 6 dùng chung bộ khung) ---------- */

const STEM_MAIN = "M70 121C70 100 64 84 68 62 70 52 70 44 69 34";
const STEM_LEFT = "M67.5 88C58 82 50 73 46 58";
const STEM_RIGHT = "M68.6 71C78 67 88 59 92 46";

const LEAVES_GROWN =
  leaf("f-leaf-deep", "translate(68 113) rotate(-160) scale(1.08)") +
  leaf("f-leaf", "translate(71 107) rotate(-24) scale(1.18)") +
  leaf("f-leaf", "translate(56 79) rotate(-176) scale(.62)") +
  leaf("f-leaf-deep", "translate(81 65) rotate(-4) scale(.62)") +
  leaf("f-leaf-light", "translate(69 52) rotate(-36) scale(.5)") +
  leaf("f-leaf-light", "translate(68 61) rotate(-148) scale(.46)");

/* ---------- sáu giai đoạn ---------- */

const STAGES = {
  // 1 · Hạt giống — hạt nằm trong ụ đất mới vun, vừa nứt một chồi non, có giọt nước vừa tưới.
  1:
    `<path class="f-water" d="M84 84C87.4 89 89.6 92 89.6 95A5.6 5.6 0 0 1 78.4 95C78.4 92 80.6 89 84 84z"/>` +
    `<path class="ill-gloss" d="M81.4 94.5a2.8 2.8 0 0 0 2 3" style="fill:none;stroke:var(--ill-light);stroke-width:1.5;stroke-linecap:round;opacity:.7"/>` +
    `<path class="f-soil" d="M47 121.5C52 113 60 109.5 70 109.5S88 113 93 121.5z"/>` +
    top(
      `<path class="f-leaf-light" d="M70.5 104C69 98 71 93.5 76.5 92 78 97.5 75.5 102 70.5 104z"/>` +
      `<g transform="translate(68 110) rotate(-14)">` +
      `<ellipse class="f-clay" rx="11" ry="7.6"/>` +
      `<path class="ill-gloss" d="M-7.5-1.5C-6-5 -1-6.2 3-5.2" style="fill:none;stroke:var(--ill-light);stroke-width:2;stroke-linecap:round;opacity:.45"/>` +
      `</g>`
    ) +
    `<path class="f-soil" d="M50 121.5C57 112.5 83 112.5 90 121.5 82 124.6 58 124.6 50 121.5z"/>`,

  // 2 · Nảy mầm — một mầm nhỏ với hai lá mầm tròn trịa.
  2:
    `<path class="f-soil" d="M56 121.5C59 116.5 64 114.5 70 114.5S81 116.5 84 121.5z"/>` +
    top(
      stems("M70 121C70 113 68.6 107 69.6 101") +
      leaf("f-leaf", "translate(70 101.5) rotate(-158) scale(.7 .9)") +
      leaf("f-leaf-light", "translate(69.3 101.5) rotate(-48) scale(.84 .96)")
    ),

  // 3 · Ra lá — thân vươn cao, hai lá gốc lớn, hai nhánh con và chùm lá non trên ngọn.
  3:
    top(
      stems("M70 121C70 104 65 92 67 78 68 70 69 64 69 55", "M67 91C62 88 58.5 84 56 79", "M67.8 77C73 75 77.5 72 80 67") +
      leaf("f-leaf-deep", "translate(68 113) rotate(-160) scale(.94)") +
      leaf("f-leaf", "translate(71 108) rotate(-24) scale(1.02)") +
      leaf("f-leaf", "translate(56.5 80) rotate(-150) scale(.58)") +
      leaf("f-leaf-deep", "translate(79.5 68) rotate(-30) scale(.58)") +
      leaf("f-leaf-light", "translate(69 58) rotate(-128) scale(.46)") +
      leaf("f-leaf-light", "translate(69 57) rotate(-50) scale(.52)")
    ),

  // 4 · Ra nụ — NGUYÊN BẢN #plant của bản thiết kế.
  4:
    top(
      stems(STEM_MAIN, STEM_LEFT, STEM_RIGHT) +
      LEAVES_GROWN +
      bud("translate(69 36)") +
      bud("translate(46 60) rotate(-20) scale(.8)") +
      bud("translate(92 48) rotate(22) scale(.8)")
    ),

  // 5 · Nở hoa — nụ trên ngọn đã nở; hai nụ bên mẩy hơn, sắp nở theo.
  5:
    top(
      stems(STEM_MAIN, STEM_LEFT, STEM_RIGHT) +
      LEAVES_GROWN +
      bud("translate(46 60) rotate(-20) scale(.9)") +
      bud("translate(92 48) rotate(22) scale(.9)") +
      flower(69, 31, 2.05, { rot: -6, sepals: 180 })
    ),

  // 6 · Rực rỡ — cả ba nụ đã nở, hai bông nhỏ trên hai cuống phụ vươn qua mép tán lá gốc, thêm lá non và vài tia lấp lánh.
  6:
    `<g class="plant__spark f-sun">${spark(121, 15, 7)}${spark(17, 30, 5.5)}${spark(134, 57, 4)}${spark(9, 68, 3.5)}<circle cx="104" cy="6" r="1.8"/><circle cx="34" cy="13" r="1.6"/><circle cx="131" cy="100" r="1.6"/><circle cx="11" cy="106" r="1.4"/></g>` +
    top(
      sideStems("M68.3 97C61 96.8 52 95 44 91", "M68.7 92C76 91.5 88 86 103 81") +
      flower(35, 92, 1.12, { rot: 20, sepals: 115 }) +
      flower(112, 80, 1.12, { rot: -14, sepals: 250 }) +
      stems(STEM_MAIN, "M67.5 88C58 82 49 73 44 58", "M68.6 71C78 67 92 60 99 47") +
      LEAVES_GROWN +
      leaf("f-leaf-light", "translate(68.5 86) rotate(-20) scale(.5)") +
      leaf("f-leaf-light", "translate(51 69) rotate(-72) scale(.38)") +
      flower(43, 55, 1.4, { rot: 12, sepals: 160 }) +
      flower(102, 44, 1.4, { rot: -8, sepals: 200 }) +
      flower(69, 29, 1.95, { rot: -6 })
    ),
};

const clampStage = (stage) => {
  const n = Math.round(Number(stage));
  return Number.isFinite(n) ? Math.min(6, Math.max(1, n)) : 1;
};

/** Phần ruột SVG của cây (hệ toạ độ PLANT_VIEWBOX) — để lồng vào một cảnh SVG lớn hơn. */
export function plantInner(stage) {
  return POT + STAGES[clampStage(stage)];
}

export function plantSvg(stage, { size = 160, cls = "" } = {}) {
  const h = Math.round((size * 172) / 140);
  return `<svg class="plant ${cls}" viewBox="${PLANT_VIEWBOX}" width="${size}" height="${h}" aria-hidden="true">${plantInner(stage)}</svg>`;
}
