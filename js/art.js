// art.js — cửa ngõ tới mọi hình vẽ của app (biểu tượng, cây hoa, huy hiệu).
// Các mảnh minh hoạ dùng chung (mầm cây, vòng lá, cánh hoa…) nằm trong sprite ở index.html.
export { icon, ICON_NAMES, scanArt, mealStandIn } from "./art/icons.js";
export { plantSvg, plantInner, PLANT_VIEWBOX } from "./art/plant.js";
export { badgeArt, giftArt, BADGE_IDS } from "./art/badges.js";

// Đom đóm và quầng sáng. Quầng sáng được VẼ bằng hình (một đĩa lớn tô chuyển sắc toả tròn nằm dưới chấm sáng)
// chứ không dùng filter của CSS: Safari trên iPhone bỏ qua filter đặt lên phần tử nằm bên trong <svg>.
// Dải chuyển sắc đo theo đúng quầng mờ mà filter cũ vẽ ra trên Chrome: [vị trí 0–1 từ tâm ra mép, độ đậm].
const GLOW_STOPS = [[0, 1], [0.12, 1], [0.27, 0.64], [0.42, 0.3], [0.58, 0.14], [0.75, 0.06], [1, 0]];
/** <defs> chứa dải chuyển sắc của quầng sáng (màu --sun, mờ dần ra mép). Mỗi hình vẽ dùng một id riêng. */
export function glowDef(id, stops = GLOW_STOPS) {
  return `<defs><radialGradient id="${id}">${stops.map(([at, o]) => `<stop offset="${at}" style="stop-color:var(--sun)" stop-opacity="${o}"/>`).join("")}</radialGradient></defs>`;
}
/** Một quầng sáng tròn/bầu dục tâm (cx, cy), tô bằng dải chuyển sắc có id đã khai ở glowDef(). */
export function glow(id, cx, cy, rx, ry = rx, attrs = "") {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#${id})"${attrs ? " " + attrs : ""}/>`;
}
/** Đom đóm: list = [[cx, cy, r], …]; mỗi con là một chấm sáng nằm trên quầng sáng của nó (chấm to thì quầng rộng và rõ hơn). */
export function fireflies(id, list) {
  const r2 = (n) => Math.round(n * 100) / 100;
  return list.map(([cx, cy, r]) => `${glow(id, cx, cy, r2(r * 4 + 7.5), undefined, `opacity="${r2(r * 0.1)}"`)}<circle class="ill-firefly" cx="${cx}" cy="${cy}" r="${r}"/>`).join("");
}
