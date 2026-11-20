// icons.js — biểu tượng nét 24 px, lớp phủ "đang nhận diện" và tranh thế chỗ cho bữa không có ảnh.
// Phong cách "Vườn nhỏ": nét 1.9, đầu và khớp bo tròn (lớp .icon trong css/app.css lo phần nét);
// minh hoạ phẳng, không viền, mỗi hình một chi tiết bóng/gân, bóng mềm dưới chân.
//
// Xuất ra:
//   icon(name, cls)      → '<svg class="icon …" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">…</svg>'
//   ICON_NAMES           → mọi tên icon() hiểu
//   scanArt()            → lớp phủ đặt lên ảnh bữa ăn trong lúc đang tính calo
//   mealStandIn(type)    → tranh vuông 64×64 cho bữa 'sang' | 'trua' | 'toi' | 'vat' không có ảnh
//
// ---------------------------------------------------------------------------------------------
// CSS CHO scanArt() — dán nguyên khối giữa hai dòng đánh dấu vào stylesheet của app.
// Khung chứa ảnh cần position: relative (và overflow: hidden nếu muốn bo góc theo ảnh).
// Trạng thái nghỉ (không có animation) vẫn đẹp: vệt sáng nằm giữa ảnh, ba đốm sáng hiện rõ —
// nên khi prefers-reduced-motion tắt animation thì lớp phủ đứng yên chứ không biến mất.
// ---------------------------------------------------------------------------------------------
/* scan-css:start
.scan-art { position: absolute; inset: 0; overflow: hidden; border-radius: inherit; pointer-events: none; }
.scan-veil { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(18, 44, 34, .06), rgba(18, 44, 34, .26)); }
.scan-beam { position: absolute; left: -15%; right: -15%; top: 0; height: 100%; transform: rotate(-5deg); background: linear-gradient(180deg, rgba(255, 255, 255, 0) 24%, rgba(255, 241, 184, .12) 36%, rgba(255, 246, 214, .4) 48.6%, rgba(255, 255, 255, .88) 49.6%, rgba(255, 255, 255, .88) 50.6%, rgba(255, 246, 214, .22) 52%, rgba(255, 255, 255, 0) 57%); animation: scan-sweep 2.6s cubic-bezier(.45, 0, .55, 1) infinite; will-change: transform; }
.scan-spark { position: absolute; width: 22px; height: 22px; margin: -11px 0 0 -11px; filter: drop-shadow(0 0 4px rgba(255, 228, 140, .95)); animation: scan-twinkle 2.6s ease-in-out infinite; }
.scan-spark--b { width: 16px; height: 16px; margin: -8px 0 0 -8px; animation-delay: -.9s; }
.scan-spark--c { width: 12px; height: 12px; margin: -6px 0 0 -6px; animation-delay: -1.7s; }
@keyframes scan-sweep { 0% { transform: translateY(-62%) rotate(-5deg); opacity: 0; } 14% { opacity: 1; } 86% { opacity: 1; } 100% { transform: translateY(62%) rotate(-5deg); opacity: 0; } }
@keyframes scan-twinkle { 0%, 100% { transform: scale(.25) rotate(-20deg); opacity: 0; } 45%, 60% { transform: scale(1) rotate(0deg); opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .scan-beam, .scan-spark { animation: none; }
  .scan-beam { opacity: .7; }
}
scan-css:end */

// ---------------------------------------------------------------------------------------------
// Biểu tượng. Mỗi mục là phần ruột của một <svg viewBox="0 0 24 24">.
// Nhóm đầu chép nguyên nét từ sprite của bản mẫu; phần còn lại vẽ cùng một tay.
// ---------------------------------------------------------------------------------------------
const CHEVRON = '<path d="M9.5 6l6 6-6 6"/>';
const SPROUT = '<path d="M12 21v-9"/><path d="M12 15c-4.2 0-6.8-2.3-6.8-6.2 4.2 0 6.8 2.3 6.8 6.2z"/><path d="M12 12c0-3.8 2.5-6.4 6.8-6.4 0 4-2.6 6.4-6.8 6.4z"/>';
const POT = '<path d="M7.4 15h9.2l-1.1 5.5h-7z"/><path d="M12 15V9.4"/><path d="M12 9.4c-1.8 0-3-1.6-3-4.6l1.6 1.3L12 3.6l1.4 2.5L15 4.8c0 3-1.2 4.6-3 4.6z"/><path d="M12 13.2c-2 0-3.3-.9-3.6-2.6M12 12c1.9 0 3.2-.8 3.6-2.2"/>';
const HEART = "M12 20.5s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.8a4.2 4.2 0 0 1 7.5 2.5c0 5.6-7.5 10.2-7.5 10.2z";
const STAR = "M12 3.7l2.56 5.38 5.9.77-4.32 4.09 1.09 5.86L12 16.95 6.77 19.8l1.09-5.86-4.32-4.09 5.9-.77z";
const DROP = "M12 3.2c3.7 4.7 6.8 8 6.8 12a6.8 6.8 0 0 1-13.6 0c0-4 3.1-7.3 6.8-12z";
const TRAY = '<path d="M4.5 16.2v1.7a2.6 2.6 0 0 0 2.6 2.6h9.8a2.6 2.6 0 0 0 2.6-2.6v-1.7"/>';
const turn = (deg, inner) => `<g transform="rotate(${deg} 12 12)">${inner}</g>`;

const ICONS = {
  /* --- từ sprite của bản mẫu (giữ nguyên nét) --- */
  gear: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  camera: '<path d="M3.5 9A2.5 2.5 0 0 1 6 6.5h1.3l1.3-2a1.6 1.6 0 0 1 1.3-.7h4.2a1.6 1.6 0 0 1 1.3.7l1.3 2H18A2.5 2.5 0 0 1 20.5 9v8A2.5 2.5 0 0 1 18 19.5H6A2.5 2.5 0 0 1 3.5 17z"/><circle cx="12" cy="12.8" r="3.5"/>',
  sprout: SPROUT,
  "tab-today": SPROUT,
  "tab-journey": POT,
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  "chev-right": CHEVRON,
  "chev-left": turn(180, CHEVRON),
  "chev-down": turn(90, CHEVRON),
  "chev-up": turn(-90, CHEVRON),
  image: '<rect x="3.5" y="5" width="17" height="14" rx="3.2"/><circle cx="9" cy="10" r="1.6"/><path d="M4.5 17l4.8-4.3 3.3 2.9 2.9-2.4 4 3.6"/>',
  pencil: '<path d="M4.5 19.5l1-4.2L16.3 4.5a2.1 2.1 0 0 1 3 3L8.5 18.3z"/><path d="M14.3 6.5l3 3"/>',
  lock: '<rect x="5.5" y="10.5" width="13" height="9.5" rx="2.6"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
  sunrise: '<path d="M3.5 18.5h17"/><path d="M7 18.5a5 5 0 0 1 10 0"/><path d="M12 6.5v3M5.3 10.3l2 2M18.7 10.3l-2 2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6L18 18M6 18l1.4-1.4M16.6 7.4L18 6"/>',
  moon: '<path d="M19.5 14.2A7.8 7.8 0 1 1 9.8 4.5a6.2 6.2 0 0 0 9.7 9.7z"/>',
  apple: '<path d="M12 8.2c-1.6-1.7-5.8-1.5-5.8 3.2 0 3.8 2.4 7.6 4.2 7.6.7 0 1.1-.4 1.6-.4s.9.4 1.6.4c1.8 0 4.2-3.8 4.2-7.6 0-4.7-4.2-4.9-5.8-3.2z"/><path d="M12 8.2c0-2.2 1-3.7 2.6-4.2"/>',
  heart: `<path d="${HEART}"/>`,
  scale: '<rect x="4" y="4" width="16" height="16" rx="4.5"/><path d="M8.3 9.8a5.2 5.2 0 0 1 7.4 0"/><path d="M12 9.8l1.2 2.6"/>',
  chat: '<path d="M5 6.8A2.8 2.8 0 0 1 7.8 4h8.4A2.8 2.8 0 0 1 19 6.8v6.4a2.8 2.8 0 0 1-2.8 2.8H11l-4 3.5V16A2.8 2.8 0 0 1 5 13.2z"/>',

  /* --- vẽ thêm, cùng nét --- */
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11.3v4.9"/><path d="M12 7.9h.01"/>',
  alert: '<path d="M10.6 4.7L3.4 17.2a1.6 1.6 0 0 0 1.4 2.4h14.4a1.6 1.6 0 0 0 1.4-2.4L13.4 4.7a1.6 1.6 0 0 0-2.8 0z"/><path d="M12 9.7v4.2"/><path d="M12 16.7h.01"/>',
  eye: '<path d="M2.8 12c2-3.9 5.3-6.2 9.2-6.2s7.2 2.3 9.2 6.2c-2 3.9-5.3 6.2-9.2 6.2S4.8 15.9 2.8 12z"/><circle cx="12" cy="12" r="2.9"/>',
  "eye-off": '<path d="M8.98 6.29C9.93 5.97 10.94 5.8 12 5.8c3.9 0 7.2 2.3 9.2 6.2-.76 1.48-1.71 2.73-2.8 3.71"/><path d="M15.02 17.71c-.95.32-1.96.49-3.02.49-3.9 0-7.2-2.3-9.2-6.2.76-1.48 1.71-2.73 2.8-3.71"/><path d="M9.5 10.5a2.9 2.9 0 0 0 4 4"/><path d="M4.5 4.5l15 15"/>',
  key: '<circle cx="8" cy="16" r="4.2"/><path d="M11 13l8.8-8.8"/><path d="M15.8 8.2l2.6 2.6M18.4 5.6l1.9 1.9"/>',
  user: '<circle cx="12" cy="8.2" r="3.7"/><path d="M4.8 20c.5-3.8 3.4-6.1 7.2-6.1s6.7 2.3 7.2 6.1"/>',
  "heart-fill": `<path fill="currentColor" d="${HEART}"/>`,
  palette: '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.3 0 2.1-.9 2.1-1.9 0-.6-.3-1-.6-1.4-.3-.4-.5-.8-.5-1.3 0-1 .8-1.8 1.9-1.8H17a3.5 3.5 0 0 0 3.5-3.5c0-3.9-3.8-7.1-8.5-7.1z"/><circle cx="7.8" cy="12" r=".5"/><circle cx="9.9" cy="8.1" r=".5"/><circle cx="14.2" cy="7.7" r=".5"/>',
  download: `<path d="M12 4.2v11"/><path d="M7.6 10.8l4.4 4.4 4.4-4.4"/>${TRAY}`,
  upload: `<path d="M12 15.2v-11"/><path d="M7.6 8.6L12 4.2l4.4 4.4"/>${TRAY}`,
  phone: '<rect x="6.5" y="2.8" width="11" height="18.4" rx="2.8"/><path d="M10.8 17.9h2.4"/>',
  share: '<circle cx="17.5" cy="5.9" r="2.6"/><circle cx="6.5" cy="12" r="2.6"/><circle cx="17.5" cy="18.1" r="2.6"/><path d="M8.8 10.7l6.4-3.5M8.8 13.3l6.4 3.5"/>',
  trash: '<path d="M4.5 6.8h15"/><path d="M9.2 6.8V5.4a1.6 1.6 0 0 1 1.6-1.6h2.4a1.6 1.6 0 0 1 1.6 1.6v1.4"/><path d="M6.4 6.8l.8 11.5a2.2 2.2 0 0 0 2.2 2.1h5.2a2.2 2.2 0 0 0 2.2-2.1l.8-11.5"/><path d="M10.2 11v5.2M13.8 11v5.2"/>',
  star: `<path d="${STAR}"/>`,
  "star-fill": `<path fill="currentColor" d="${STAR}"/>`,
  flame: '<path d="M12 21a6.3 6.3 0 0 0 6.3-6.3c0-2.3-1-4-2.4-5.6-.4 1.3-1 2.1-2 2.6.2-3.3-1.1-6.3-4.2-8.2.3 2.7-.8 4.4-2.1 6.1-1.2 1.6-1.9 3-1.9 5.1A6.3 6.3 0 0 0 12 21z"/>',
  drop: `<path d="${DROP}"/><path d="M8.7 15.5a3.4 3.4 0 0 0 2.1 3"/>`,
  "drop-fill": `<path fill="currentColor" d="${DROP}"/>`,
  "drop-plus": `<path d="${DROP}"/><path d="M12 12.4v5.2M9.4 15h5.2"/>`,
  cup: '<path d="M6.6 4.5h10.8l-1.1 13.9a2.3 2.3 0 0 1-2.3 2.1H10a2.3 2.3 0 0 1-2.3-2.1z"/><path d="M7.2 10.6c1.6-1 3.2 1 4.8 0s3.2 1 4.8 0"/>',
  gift: '<rect x="3.5" y="8" width="17" height="4.2" rx="1.5"/><path d="M5.3 12.2v6a2.3 2.3 0 0 0 2.3 2.3h8.8a2.3 2.3 0 0 0 2.3-2.3v-6"/><path d="M12 8v12.5"/><path d="M12 8c-.9-2.6-2.4-4.3-4.2-4.3a2.15 2.15 0 0 0 0 4.3zM12 8c.9-2.6 2.4-4.3 4.2-4.3a2.15 2.15 0 0 1 0 4.3z"/>',
  calendar: '<rect x="4" y="5.5" width="16" height="15" rx="3.2"/><path d="M4 10.3h16"/><path d="M8.5 3.5v3.6M15.5 3.5v3.6"/><path d="M8.5 14.2h.01M12 14.2h.01M15.5 14.2h.01M8.5 17.3h.01M12 17.3h.01"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.3V12l3.1 1.9"/>',
  sparkle: '<path d="M10.5 5.5c.5 4.2 2.6 6.4 7 7.5-4.4 1.1-6.5 3.3-7 7.5-.5-4.2-2.6-6.4-7-7.5 4.4-1.1 6.5-3.3 7-7.5z"/><path d="M18.5 3.3v4M16.5 5.3h4"/>',
  ring: '<circle cx="12" cy="12" r="8.2" stroke-opacity=".3"/><path d="M12 3.8a8.2 8.2 0 1 1-7.71 11"/>',
  leaf: '<path d="M5 19C4 11.5 9 5.4 19.3 4.7 19.9 14.6 13.6 20.1 5 19z"/><path d="M4.6 19.4c2.9-4 6-7 9.9-9.6"/>',
  flower: '<path d="M9.41 8.44a3.3 3.3 0 1 1 5.18 0 3.3 3.3 0 1 1 1.59 4.92A3.3 3.3 0 1 1 12 16.4a3.3 3.3 0 1 1-4.18-3.04 3.3 3.3 0 1 1 1.59-4.92z"/><circle cx="12" cy="12" r="1.7"/>',
  can: '<path d="M6 10.5h9v7.1a2.4 2.4 0 0 1-2.4 2.4H8.4A2.4 2.4 0 0 1 6 17.6z"/><path d="M10.8 10.5c0-6.8-7.8-5.9-7.8.5 0 2.7 1.2 4.4 3 4.8"/><path d="M15 16.5l5-7.7"/><path d="M18.55 7.85l2.9 1.9"/>',
  "wifi-off": '<path d="M12 18.6h.01"/><path d="M7.76 14.36a6 6 0 0 1 3.06-1.64"/><path d="M3.8 10.4a11.6 11.6 0 0 1 2.7-2.01"/><path d="M10.95 7.05a11.6 11.6 0 0 1 9.25 3.35"/><path d="M5 4l14.6 14.6"/>',
  undo: '<path d="M8.5 5l-4 4 4 4"/><path d="M4.5 9h9.3a5.5 5.5 0 0 1 0 11H9.5"/>',
  bowl: '<path d="M3.8 11.5h16.4c0 3.7-2.5 6.8-6 7.8v1.2H9.8v-1.2c-3.5-1-6-4.1-6-7.8z"/><path d="M9.6 3.5c-1 1.3 1 2.5 0 3.9M14.4 3.5c-1 1.3 1 2.5 0 3.9"/>',
  cookie: '<path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5 3.4 3.4 0 0 1-4.25-4.25A3.4 3.4 0 0 1 12 3.5z"/><path d="M8.6 9.8h.01M8.3 14.6h.01M12.6 12.6h.01M13.4 16.7h.01"/>',
  note: '<path d="M4.5 7.1a2.6 2.6 0 0 1 2.6-2.6h9.8a2.6 2.6 0 0 1 2.6 2.6v7.4l-5 5H7.1a2.6 2.6 0 0 1-2.6-2.6z"/><path d="M19.5 14.5h-2.4a2.6 2.6 0 0 0-2.6 2.6v2.4"/><path d="M8.5 9.2h7M8.5 12.7h4"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><path d="M12 12h.01"/>',
  trophy: '<path d="M7.5 4h9v5.5a4.5 4.5 0 0 1-9 0z"/><path d="M7.5 5.8H5.6A1.6 1.6 0 0 0 4 7.4c0 2 1.5 3.4 3.8 3.6M16.5 5.8h1.9A1.6 1.6 0 0 1 20 7.4c0 2-1.5 3.4-3.8 3.6"/><path d="M12 14v3.2"/><path d="M8.3 20.5h7.4M9.5 20.5c0-1.9 1-3.3 2.5-3.3s2.5 1.4 2.5 3.3"/>',
  bank: '<path d="M14.8 4.2c.4.5.6.8.6 1.1a.6.6 0 0 1-1.2 0c0-.3.2-.6.6-1.1z"/><path d="M7.5 8.5h9"/><path d="M9.6 8.5v.7c-3.2.8-5.1 2.5-5.1 4.9 0 2.3 1.3 4.4 3.3 5.8.5.4 1 .6 1.6.6h5.2c.6 0 1.1-.2 1.6-.6 2-1.4 3.3-3.5 3.3-5.8 0-2.4-1.9-4.1-5.1-4.9v-.7"/><path d="M5.2 16c2.3-1 4.5 1 6.8 0s4.5 1 6.8 0"/>',
};

/** Mọi tên biểu tượng đang có. */
export const ICON_NAMES = Object.keys(ICONS);

const FALLBACK = '<circle cx="12" cy="12" r="3"/>';
const cleanCls = (cls) => String(cls ?? "").replace(/[^\w\- ]+/g, " ").trim();

/**
 * Một biểu tượng nét 24×24 tự chứa (không dùng <use>, nên chạy được cả trong pop-up).
 * Màu theo currentColor; cỡ và độ dày nét do lớp .icon / .icon--sm / .icon--md quyết định.
 * Tên lạ trả về một chấm tròn nhỏ, không bao giờ ném lỗi.
 */
export function icon(name, cls = "") {
  const inner = (typeof name === "string" && Object.prototype.hasOwnProperty.call(ICONS, name) && ICONS[name]) || FALLBACK;
  const extra = cleanCls(cls);
  return `<svg class="icon${extra ? " " + extra : ""}" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">${inner}</svg>`;
}

// ---------------------------------------------------------------------------------------------
// Lớp phủ "đang nhận diện": một vệt nắng lướt chậm qua ảnh và ba đốm sáng lấp lánh.
// Màu cố định (trắng ấm) vì nó nằm trên ảnh chụp, giống các chip trên ảnh — không đổi theo giao diện.
// Vài thuộc tính bố cục được ghi thẳng vào thẻ để lớp phủ vẫn nằm đúng chỗ khi CSS chưa kịp dán.
// ---------------------------------------------------------------------------------------------
const SPARK = "M12 1.5c.7 5.9 3.6 8.8 10.5 10.5-6.9 1.7-9.8 4.6-10.5 10.5-.7-5.9-3.6-8.8-10.5-10.5C8.4 10.3 11.3 7.4 12 1.5z";
const spark = (mod, left, top) =>
  `<svg class="scan-spark${mod ? " scan-spark--" + mod : ""}" viewBox="0 0 24 24" width="22" height="22" style="position:absolute;left:${left}%;top:${top}%" aria-hidden="true"><path fill="#fff" d="${SPARK}"/></svg>`;

export function scanArt() {
  return `<div class="scan-art" style="position:absolute;inset:0;overflow:hidden;pointer-events:none" aria-hidden="true"><span class="scan-veil"></span><span class="scan-beam"></span>${spark("", 24, 30)}${spark("b", 72, 58)}${spark("c", 58, 22)}</div>`;
}

// ---------------------------------------------------------------------------------------------
// Tranh thế chỗ cho bữa không có ảnh: một tĩnh vật nhỏ trên nền màu dịu, 64×64, lấp đầy khung.
// Mọi màu lấy từ token của app nên tự đổi theo giao diện sáng / tối.
// ---------------------------------------------------------------------------------------------
const v = (token) => `style="fill:var(--${token})"`;
const TABLE_D = "M0 43c10-2.6 21-3.8 32-3.8S54 40.4 64 43v21H0z";
const table = (ground, wash = 0.6) => `<path ${v(ground)} d="${TABLE_D}"/><path ${v("surface")} opacity="${wash}" d="${TABLE_D}"/>`;
const steam = (d) => `<path d="${d}" fill="none" style="stroke:var(--ill-light)" stroke-opacity=".75" stroke-width="2" stroke-linecap="round"/>`;

const MEALS = {
  // Bữa sáng: mặt trời vừa lên, đĩa trứng ốp la và ổ bánh mì.
  sang: `<rect width="64" height="64" ${v("sky-dawn")}/>
<circle class="f-sun" cx="19" cy="40" r="17" opacity=".18"/><circle class="f-sun" cx="19" cy="40" r="10.5"/>
${table("sky-dawn")}
<ellipse class="ill-shadow" cx="33" cy="55.5" rx="24" ry="4.5"/>
<ellipse class="f-leaf-light" cx="32" cy="51" rx="24" ry="7.5"/>
<ellipse class="ill-gloss" cx="32" cy="50.3" rx="18.5" ry="5.2"/>
<g transform="rotate(-14 44 43)"><rect class="f-over" x="28" y="36.5" width="31" height="12.5" rx="6.25"/><rect class="f-sun" opacity=".55" x="29.6" y="37.5" width="27.8" height="6.5" rx="3.25"/><path d="M36.5 38l2.5 5.2M43 38l2.5 5.2M49.5 38l2.5 5.2" fill="none" style="stroke:var(--ill-light)" stroke-opacity=".7" stroke-width="2" stroke-linecap="round"/></g>
<path ${v("photo-frame")} d="M11.5 51c0-2.7 4-4.6 9.2-4.6 3 0 4.7.9 7.2 1 2.7.1 4.6 1.3 4.6 3.2 0 2.4-3.7 4-9.5 4-6.4 0-11.5-1.2-11.5-3.6z"/>
<ellipse class="f-sun" cx="20.8" cy="50" rx="4.2" ry="2.6"/><ellipse class="f-light" opacity=".6" cx="19.4" cy="49.2" rx="1.4" ry=".65"/>`,

  // Bữa trưa: nắng đứng bóng, bát cơm đầy với rau và miếng sườn; đũa gác bên cạnh.
  trua: `<rect width="64" height="64" ${v("leaf-tint")}/>
<circle class="f-leaf-soft" cx="29.5" cy="35" r="18.5"/>
<circle class="f-sun" cx="51" cy="13" r="10.5" opacity=".22"/><circle class="f-sun" cx="51" cy="13" r="6"/>
${table("leaf-tint")}
<ellipse class="ill-shadow" cx="31" cy="57.5" rx="20" ry="3.6"/>
${steam("M22 19c-2 2.4 2 4.2 0 6.8")}${steam("M30 15.5c-2 2.4 2 4.2 0 6.8")}
<path ${v("photo-frame")} d="M13 40c0-9.2 7.3-15.5 16.5-15.5S46 30.8 46 40z"/>
<path d="M19.5 27.6l1.6-.9M26.5 26.4h1.8M41.5 34.5l1.4.9M24.5 30.2l1.5-.7M40 29l1.3.9" fill="none" style="stroke:var(--ink)" stroke-opacity=".16" stroke-width="1.2" stroke-linecap="round"/>
<path class="f-clay-deep" d="M29.5 31c2.6-2.4 8-1.8 9.8 1.8 1.2 2.6-.4 5.4-3.6 6.2-3.8.9-7.4-.8-8-3.6-.3-1.7.5-3.2 1.8-4.4z"/><path d="M31 33.5c2-1.4 5-1.3 6.6.2" fill="none" style="stroke:var(--ill-light)" stroke-opacity=".4" stroke-width="1.4" stroke-linecap="round"/>
<path class="f-leaf" d="M16.5 37c-.6-4.6 2-8 7.2-8.6.7 4.7-2 8.2-7.2 8.6z"/><path class="f-leaf-light" d="M21 39c0-3.8 2.4-6.3 6.4-6.3 0 3.9-2.4 6.3-6.4 6.3z"/>
<path class="f-bloom" d="M9 39.5h41c0 10-8.3 17-20.5 17S9 49.5 9 39.5z"/>
<path class="f-bloom-light" d="M9 39.5h41c0 1.4-.15 2.7-.45 3.9H9.45c-.3-1.2-.45-2.5-.45-3.9z"/>
<path class="ill-gloss" d="M13.5 46.5c1.4 3.3 4 5.8 7.6 7.3-2.3-1.9-3.9-4.3-4.8-7.3z"/>
<rect class="f-bloom" x="22.5" y="55" width="14" height="3.6" rx="1.3"/><rect class="ill-shadow" x="22.5" y="55" width="14" height="3.6" rx="1.3"/>
<path d="M44 58.5l16.5-5.5M46.5 61.2L62 56" fill="none" style="stroke:var(--clay-deep)" stroke-width="1.9" stroke-linecap="round"/>`,

  // Bữa tối: trăng non, vài ngôi sao và một tô bún nóng bốc khói.
  toi: `<rect width="64" height="64" ${v("sky-night")}/>
<path class="f-moon" d="M55.5 15.8A8.2 8.2 0 1 1 45.2 5.5a6.5 6.5 0 0 0 10.3 10.3z"/>
<g class="f-light"><circle cx="12" cy="11" r="1.3"/><circle cx="26" cy="6.5" r="1"/><circle cx="8" cy="26" r="1"/><circle cx="57" cy="29" r="1.1"/></g>
${table("sky-night", 0.42)}
<ellipse class="ill-shadow" cx="33" cy="57.5" rx="22" ry="3.8"/>
${steam("M25 21.5c-2.2 2.6 2.2 4.6 0 7.4")}${steam("M33.5 17.5c-2.2 2.6 2.2 4.6 0 7.4")}
<path ${v("photo-frame")} d="M9 40h46c0 9.6-9.2 16.5-23 16.5S9 49.6 9 40z"/>
<path d="M12.3 47.2c5.2 2.3 12 3.5 19.7 3.5s14.5-1.2 19.7-3.5" fill="none" style="stroke:var(--leaf)" stroke-width="2.2" stroke-linecap="round"/>
<ellipse ${v("photo-frame")} cx="32" cy="40" rx="23" ry="6.2"/>
<ellipse class="f-over" cx="32" cy="40.4" rx="19.8" ry="4.5"/>
<path d="M19 40.5c3-2.2 6 1.8 9-.2s5.5-2.2 8 .2M24 42.5c3-1.6 5.5 1 8.5-.3" fill="none" style="stroke:var(--ill-light)" stroke-opacity=".85" stroke-width="1.7" stroke-linecap="round"/>
<ellipse class="f-clay-deep" cx="41.5" cy="39.6" rx="4.2" ry="1.9"/>
<g class="f-leaf"><circle cx="34.5" cy="38" r="1.3"/><circle cx="46" cy="42" r="1.2"/><circle cx="22" cy="38.5" r="1.2"/></g>
<rect ${v("photo-frame")} x="24.5" y="55" width="15" height="3.6" rx="1.3"/><rect class="ill-shadow" x="24.5" y="55" width="15" height="3.6" rx="1.3"/>
<path class="ill-shadow" d="M55 40c0 9.6-9.2 16.5-23 16.5 9.5-1.5 16.5-7.5 18.5-16.5z"/>`,

  // Ăn vặt: một quả táo và chiếc bánh quy cắn dở.
  vat: `<rect width="64" height="64" ${v("sun-soft")}/>
<circle class="f-sun" cx="30" cy="33" r="21" opacity=".2"/>
${table("sun-soft")}
<ellipse class="ill-shadow" cx="24" cy="55.5" rx="14" ry="3.2"/><ellipse class="ill-shadow" cx="47.5" cy="57" rx="10" ry="2.6"/>
<path d="M24 31c0-4 1.6-6.6 4.6-7.8" fill="none" style="stroke:var(--clay-deep)" stroke-width="2.2" stroke-linecap="round"/>
<path class="f-leaf" d="M25.5 27.5c.6-4.6 4-7.2 9.2-6.8-.6 4.7-4 7.3-9.2 6.8z"/>
<path class="f-bloom" d="M24 31.5c-3.2-2.7-12.5-2.2-12.5 7.2 0 7.8 5 15.3 9 15.3 1.4 0 2.3-.7 3.5-.7s2.1.7 3.5.7c4 0 9-7.5 9-15.3 0-9.4-9.3-9.9-12.5-7.2z"/>
<path class="f-bloom-light" d="M15.2 37.5c.5-2.6 2.2-4.2 4.6-4.5-1.8 1.7-2.8 3.9-2.9 6.7-.9-.4-1.6-1.2-1.7-2.2z"/>
<path class="f-over" d="M47.5 37.5a9.5 9.5 0 1 0 9.5 9.5 4 4 0 0 1-4.7-4.8 4 4 0 0 1-4.8-4.7z"/>
<g class="f-soil"><circle cx="44" cy="44.5" r="1.4"/><circle cx="48.5" cy="50" r="1.5"/><circle cx="43" cy="51" r="1.2"/><circle cx="52" cy="53" r="1.1"/></g>
<path d="M40.5 47c0-2.8 1.5-5 3.8-6.2" fill="none" style="stroke:var(--ill-light)" stroke-opacity=".4" stroke-width="1.4" stroke-linecap="round"/>`,
};

/** Tranh thế chỗ cho bữa không có ảnh. type: 'sang' | 'trua' | 'toi' | 'vat' (loại lạ → bát cơm bữa trưa). */
export function mealStandIn(type) {
  const art = (typeof type === "string" && Object.prototype.hasOwnProperty.call(MEALS, type) && MEALS[type]) || MEALS.trua;
  return `<svg class="meal-standin" viewBox="0 0 64 64" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${art}</svg>`;
}
