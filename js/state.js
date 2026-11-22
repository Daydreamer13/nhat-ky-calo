// state.js — trạng thái của app và mọi thao tác thay đổi nó. Không đụng tới giao diện:
// phần vẽ (app.js) chỉ đọc S, gọi các hàm ở đây và lắng nghe sự kiện qua on().

import * as L from "./logic.js";
import { STREAK_MARKS } from "./words.js";
import { openStore, askPersist, isQuotaError, markDiary } from "./store.js";
import { prepareImage } from "./photo.js";
import { analyzeMeal, reviewDay as askReview, aiErrorText, AiError } from "./ai.js";

export const S = {
  ready: false,
  mode: "idb", // 'memory' nếu máy không cho lưu lâu dài
  profile: null,
  settings: { ...L.DEFAULT_SETTINGS },
  meta: { earned: {}, seen: {} },
  favs: [],
  days: {},
  today: L.dkey(),
  viewDay: L.dkey(),
};

let store = null;
const photoCache = new Map();

/* ---------------- sự kiện ---------------- */
const listeners = new Map();
export function on(evt, fn) {
  if (!listeners.has(evt)) listeners.set(evt, new Set());
  listeners.get(evt).add(fn);
  return () => listeners.get(evt).delete(fn);
}
function emit(evt, payload) {
  for (const fn of listeners.get(evt) || []) {
    try { fn(payload); } catch (e) { console.error(e); }
  }
}
const changed = () => { ctxCache = null; emit("change"); };
const toast = (text, action) => emit("toast", { text, action });
const RELOAD = { label: "Tải lại", fn: () => { if (typeof location !== "undefined") location.reload(); } };
/** Ghi xuống máy không được. Chỉ nói "bộ nhớ đầy" khi đúng là hết chỗ; còn lại là mất kết nối tới kho dữ liệu → cần mở lại app. */
function saveFailed(e) {
  if (isQuotaError(e)) toast("Chưa lưu được vào máy. Bộ nhớ có thể đã đầy.");
  else toast("Chưa lưu được. Hãy đóng hẳn app rồi mở lại.", RELOAD);
}

/* ---------------- khởi động ---------------- */
export async function boot() {
  store = await openStore();
  sawStore(); // nhớ dấu "kho vừa được ghi" TRƯỚC lần đọc đầu: bản khác ghi sau thời điểm này thì bản này biết mình đã cũ
  await load();
  replayUnsaved();
  noteDiary();
  S.ready = true;
  changed();
  gcPhotos();
}
/** Nhớ (ngoài kho chính) rằng máy này đã có nhật ký, để lần sau kho không mở được thì app báo lỗi chứ không hiện màn hình làm quen. */
const noteDiary = () => { if (S.mode === "idb") markDiary(!!S.profile); };
/** Coi như đã thấy mọi thứ đang có trong kho — gọi ngay TRƯỚC khi đọc lại toàn bộ (xem refresh). Trả về mốc cho store.revStale. */
const sawStore = () => (store && store.revSee ? store.revSee() : 0);
/**
 * reread: đọc lại giữa chừng (refresh) — chỉ thay số liệu, giữ nguyên ngày đang xem, ảnh đã nạp và lần cân vừa xoá.
 * mark: mốc store.revSee() lấy ngay trước lượt đọc lại này.
 * @returns {Promise<boolean>} false khi bản vừa đọc được bị bỏ và bộ nhớ giữ nguyên (chỉ có thể xảy ra với reread)
 */
async function load(reread = false, mark) {
  const { kv, days } = await store.loadAll();
  // Trong lúc đang đọc lại mà chính bản này ghi thêm (một cú chạm rơi đúng lúc đó), hoặc còn phần ghi chưa xuống được kho: thứ
  // vừa đọc được CŨ hơn bộ nhớ ở đúng phần ấy — đem thay vào là mất bữa vừa ghi. Bỏ nó đi, refresh() sẽ đọc thêm vòng nữa.
  if (reread && (hasUnsaved() || store.revStale(mark))) return false;
  S.mode = store.mode;
  S.profile = kv.profile && typeof kv.profile === "object" ? kv.profile : null;
  S.settings = L.cleanSettings(kv.settings || {});
  S.meta = { earned: { ...(kv.meta?.earned || {}) }, seen: { ...(kv.meta?.seen || {}) } };
  S.favs = Array.isArray(kv.favs) ? kv.favs : [];
  S.days = {};
  for (const k of Object.keys(days)) if (L.isKey(k) && days[k] && typeof days[k] === "object") S.days[k] = { ...days[k], meals: Array.isArray(days[k].meals) ? days[k].meals : [] };
  if (reread) return true;
  S.today = L.dkey();
  S.viewDay = S.today;
  photoCache.clear();
  removedWeight = null;
  return true;
}

/* ---------------- số liệu suy ra ---------------- */
let ctxCache = null;
/** Bối cảnh tính toán của hôm nay; null khi chưa có hồ sơ. */
export function ctx() {
  if (!S.profile) return null;
  if (ctxCache && ctxCache.todayKey === S.today) return ctxCache;
  const weight = L.currentWeight(S.days, S.profile);
  const t = L.targetOf(S.profile, weight, S.today);
  ctxCache = { todayKey: S.today, weight, target: t.target, tdee: t.tdee, mode: t.mode, floored: t.floored, waterGoal: S.settings.water ? S.settings.waterGoal : 0 };
  return ctxCache;
}
export function stats() {
  const c = ctx();
  // Cây không bao giờ nhỏ lại: giai đoạn cao nhất đã từng được mừng là mức sàn (ít nhất là 1).
  let plantFloor = 1;
  for (const id of Object.keys(S.meta.seen)) {
    const n = id.startsWith("plant:") ? Number(id.slice(6)) : 0;
    if (Number.isInteger(n) && n > plantFloor) plantFloor = n;
  }
  return { ...L.journeyStats(S.days, c), ...L.weightProgress(S.profile, c.weight, L.lowestWeight(S.days, S.profile)), waterOn: S.settings.water, plantFloor };
}
export const dayAt = (key) => S.days[key] || { meals: [] };
export function findMeal(key, id) {
  return (S.days[key]?.meals || []).find((m) => m.id === id) || null;
}
export const isToday = (key) => key === S.today;

/* ---------------- lưu ---------------- */
// Xin trình duyệt giữ dữ liệu lâu dài: mỗi lần mở app xin một lần, đúng lúc có dữ liệu cần ghi (không xin khi vừa tải trang).
// Lần đầu thường bị từ chối vì app chưa được cài lên màn hình chính; cài xong thì các lần mở sau sẽ được.
let askedPersist = false;
function wantPersist() {
  if (askedPersist || !S.profile) return;
  askedPersist = true;
  askPersist();
}

// Những phần ghi chưa xuống được máy (mất kết nối tới kho dữ liệu — hay gặp trên iPhone sau khi app nằm nền lâu).
// Giữ danh sách để ghi lại ngay khi kết nối sống lại, và chép tạm sang localStorage để lỡ phải tải lại app cũng không mất.
const UNSAVED_LS = "nhat-ky-calo.unsaved.v1";
const KV_KEYS = ["profile", "settings", "meta", "favs"]; // tên khoá trong kho = tên trường trong S
const unsaved = { days: new Set(), kv: new Set() };
const hasUnsaved = () => unsaved.days.size > 0 || unsaved.kv.size > 0;
function stash() {
  try {
    if (!hasUnsaved()) { localStorage.removeItem(UNSAVED_LS); return; }
    const out = { days: {}, kv: {} };
    for (const k of unsaved.days) out.days[k] = S.days[k] || null;
    // khoá Claude không chép ra ngoài kho chính
    for (const k of unsaved.kv) out.kv[k] = k === "settings" ? { ...S.settings, apiKey: "" } : S[k];
    localStorage.setItem(UNSAVED_LS, JSON.stringify(out));
  } catch {}
}
function clearUnsaved() {
  unsaved.days.clear();
  unsaved.kv.clear();
  stash();
}
let flushing = false;
/** Ghi lại những phần còn nợ, theo số liệu đang có trong bộ nhớ. Chưa được thì giữ nguyên, lần sau thử tiếp. */
async function flushUnsaved() {
  if (flushing || !hasUnsaved()) return;
  flushing = true;
  try {
    for (const k of [...unsaved.days]) { await store.putDay(k, S.days[k] || null); unsaved.days.delete(k); }
    for (const k of [...unsaved.kv]) { await store.setKV(k, S[k]); unsaved.kv.delete(k); }
  } catch (e) { console.error(e); }
  flushing = false;
  stash();
  refresh(); // còn nợ ghi thì chưa đọc lại kho được (sẽ mất phần nợ); trả nợ xong mới đọc lại nếu bản khác của app đã ghi
}
/** Mở app: nếu lần trước còn phần chưa ghi được (đã chép tạm) thì đưa lại vào nhật ký và ghi xuống máy. */
function replayUnsaved() {
  if (store.mode !== "idb") return; // đang chạy tạm trong bộ nhớ: để dành cho lần mở được kho chính
  let j = null;
  try { j = JSON.parse(localStorage.getItem(UNSAVED_LS) || "null"); } catch {}
  if (!j || typeof j !== "object") return;
  const days = j.days && typeof j.days === "object" ? j.days : {};
  for (const k of Object.keys(days)) {
    if (!L.isKey(k)) continue;
    const d = days[k];
    if (d && typeof d === "object") S.days[k] = { ...d, meals: Array.isArray(d.meals) ? d.meals : [] };
    else delete S.days[k];
    unsaved.days.add(k);
  }
  const kv = j.kv && typeof j.kv === "object" ? j.kv : {};
  if (kv.profile && typeof kv.profile === "object") { S.profile = kv.profile; unsaved.kv.add("profile"); }
  if (kv.settings && typeof kv.settings === "object") { S.settings = L.cleanSettings({ ...kv.settings, apiKey: S.settings.apiKey }); unsaved.kv.add("settings"); }
  if (kv.meta && typeof kv.meta === "object") { S.meta = { earned: { ...(kv.meta.earned || {}) }, seen: { ...(kv.meta.seen || {}) } }; unsaved.kv.add("meta"); }
  if (Array.isArray(kv.favs)) { S.favs = kv.favs; unsaved.kv.add("favs"); }
  flushUnsaved();
}
/** Theo dõi một lần ghi: xong thì xoá nợ (và nhân lúc kết nối sống, ghi nốt các phần nợ khác); hỏng thì ghi nợ và báo người dùng. */
function keep(kind, key, p) {
  return Promise.resolve(p).then(
    () => { if (unsaved[kind].delete(key)) stash(); flushUnsaved(); },
    (e) => { console.error(e); if (kind !== "kv" || KV_KEYS.includes(key)) { unsaved[kind].add(key); stash(); } saveFailed(e); },
  );
}
let probing = false;
/**
 * Thử xem kho dữ liệu còn dùng được không (gọi mỗi khi app được mở lại lên màn hình). Kết nối chết mà mở lại được thì
 * tự lành, ghi nốt phần còn nợ; không mở lại được thì phát sự kiện "storelost" ngay, trước khi người dùng kịp ghi thêm bữa nào
 * (app.js tự tải lại trang nếu lúc đó không làm mất gì, không thì mời bấm "Tải lại").
 */
export async function checkStore() {
  if (!store || !store.ping || probing) return true;
  probing = true;
  let ok = true;
  try { await store.ping(); flushUnsaved(); } catch (e) {
    ok = false;
    console.error(e);
    emit("storelost");
  }
  probing = false;
  return ok;
}

function persistDay(key) {
  wantPersist();
  const day = S.days[key];
  const c = ctx();
  if (day && !day.meals.length && day.weight == null && !day.water) {
    delete S.days[key];
    return keep("days", key, store.putDay(key, null));
  }
  if (!day) return keep("days", key, store.putDay(key, null));
  // Chụp lại mục tiêu của ngày để về sau đổi cân nặng/hồ sơ không làm đổi kết quả ngày cũ.
  if (c && (key === S.today || !day.tg)) { day.tg = c.target; day.td = Math.round(c.tdee); }
  return keep("days", key, store.putDay(key, day));
}
/** Hôm nay luôn mang mức kcal đang áp dụng: đổi hồ sơ hay sửa một lần cân cũ làm mức đổi thì chụp lại cho hôm nay (ngày cũ giữ nguyên). */
function syncTodayTarget() {
  const d = S.days[S.today], c = ctx();
  if (d && c && (d.tg !== c.target || d.td !== Math.round(c.tdee))) persistDay(S.today);
}
/**
 * Một số cân gõ nhầm (lần cân của ngày fromKey, hoặc cân lúc bắt đầu) vừa được sửa/xoá: các ngày ĐÃ QUA kể từ fromKey cho tới
 * lần cân thật kế tiếp đang mang ĐÚNG mức kcal mà con số nhầm sinh ra thì được chụp lại theo số cân thật sự áp dụng ngày đó.
 * Ngày nào mang mức khác (ghi dưới hồ sơ cũ: tốc độ giảm, mức tự đặt… khác) thì để nguyên — không viết lại lịch sử.
 * Gọi SAU khi số liệu cân đã được sửa. prof: hồ sơ dùng để tính (lúc sửa hồ sơ thì truyền hồ sơ TRƯỚC lần lưu).
 * @returns {object} các mức đã bị thay ({ ngày: { tg, td } }) để "Hoàn tác" trả lại y nguyên
 */
function restamp(fromKey, wrongW, prof = S.profile) {
  const undo = {};
  const wrong = Number(wrongW);
  if (!S.profile || !prof || wrongW == null || !Number.isFinite(wrong)) return undo;
  const series = L.weightSeries(S.days, S.profile); // đã sửa
  const next = series.find((p) => p.k > fromKey);
  for (const k of Object.keys(S.days).sort()) {
    if (!L.isKey(k) || k < fromKey || k >= S.today || (next && k >= next.k)) continue;
    const day = S.days[k];
    if (!day || !day.tg) continue;
    const was = L.targetOf(prof, wrong, k);
    if (day.tg !== was.target || day.td !== Math.round(was.tdee)) continue; // không phải mức do con số nhầm sinh ra: để nguyên
    const prior = series.filter((p) => p.k <= k).pop();
    const t = L.targetOf(prof, prior ? prior.w : S.profile.startWeight, k);
    if (day.tg === t.target && day.td === Math.round(t.tdee)) continue;
    undo[k] = { tg: day.tg, td: day.td };
    day.tg = t.target; day.td = Math.round(t.tdee);
    persistDay(k);
  }
  return undo;
}
const ensureDay = (key) => (S.days[key] ||= { meals: [] });
const saveKV = (key, value) => { wantPersist(); return keep("kv", key, store.setKV(key, value)); };
const saveMeta = () => saveKV("meta", S.meta);

/* ---------------- hồ sơ và cài đặt ---------------- */
/** @returns {{ok:boolean, errors:object}} */
export function saveProfile(input) {
  // keepGoal: đã xuống dưới cân mong muốn mà không đổi mục tiêu thì vẫn lưu được các ô khác (tên, vận động…).
  const v = L.validateProfile(input, S.today, { keepGoal: S.profile ? S.profile.goalWeight : null });
  if (!v.ok) return v;
  const { weight, startWeight, ...rest } = v.value;
  const first = !S.profile;
  const oldStart = first ? null : S.profile.startWeight;
  const oldProfile = S.profile; // hồ sơ trước lần lưu này (restamp cần nó: đổi tốc độ giảm trong cùng lần lưu không được viết lại ngày cũ)
  if (first) S.profile = { ...rest, startWeight: weight, startDate: S.today };
  else S.profile = { ...S.profile, ...rest };
  ctxCache = null;
  // Số liệu ngay TRƯỚC khi số cân nào đổi (cân mong muốn mới đã áp dụng): checkMoments chỉ trả lại huy hiệu mà chính lần sửa cân này làm mất.
  const before = first ? null : stats();
  if (first || L.currentWeight(S.days, S.profile) !== weight) {
    ensureDay(S.today).weight = weight;
    ctxCache = null; // stats() ở trên vừa tính theo số cân cũ
    persistDay(S.today);
    // Sửa cân ngay trong ngày bắt đầu là sửa con số gõ nhầm lúc đầu, không phải đã giảm cân: dời luôn điểm xuất phát.
    if (!first && S.today === S.profile.startDate) S.profile.startWeight = weight;
  }
  if (!first && startWeight != null && startWeight !== oldStart) {
    // Sửa "cân lúc bắt đầu": nếu ngày bắt đầu còn giữ đúng con số cũ (lần cân app tự ghi lúc tạo hồ sơ) thì sửa theo,
    // để biểu đồ và số kg đã giảm khớp nhau.
    const d0 = S.days[S.profile.startDate];
    // Con số cũ có thật là số cân áp dụng cho những ngày đầu không: ngày bắt đầu không có lần cân nào, hoặc lần cân ấy đúng bằng con số cũ.
    const inForce = !d0 || d0.weight == null || L.round1(Number(d0.weight)) === L.round1(Number(oldStart));
    if (d0 && d0.weight != null && L.round1(Number(d0.weight)) === L.round1(Number(oldStart))) { d0.weight = startWeight; persistDay(S.profile.startDate); }
    S.profile.startWeight = startWeight;
    ctxCache = null;
    // Những ngày đã ghi lúc con số nhầm còn hiệu lực đang mang mức kcal tính từ nó: chụp lại theo số đã sửa.
    if (inForce) restamp(S.profile.startDate, oldStart, oldProfile);
  }
  syncTodayTarget();
  saveKV("profile", S.profile);
  if (first) { wantPersist(); noteDiary(); } // hồ sơ đầu tiên: xin trình duyệt giữ dữ liệu lâu dài (thường đã xin ở lần ghi ngay phía trên)
  changed();
  // Lần đầu: chỉ đánh dấu. Các lần sau: đổi cân hay cân lúc bắt đầu có thể vừa chạm một mốc (mừng ngay) hoặc làm một mốc không còn đúng (trả lại).
  if (first) checkMoments({ silent: true }); else checkMoments({ before });
  return v;
}
export function setSettings(patch) {
  S.settings = L.cleanSettings({ ...S.settings, ...patch });
  saveKV("settings", S.settings);
  changed();
}

/* ---------------- bữa ăn ---------------- */
/** Xếp bữa theo giờ; bữa không có giờ (ghi bù vào một ngày đã qua) nằm SAU các bữa có giờ, giữ thứ tự lúc ghi. */
const byTime = (a, b) => (!a.t !== !b.t ? (a.t ? -1 : 1) : a.t < b.t ? -1 : a.t > b.t ? 1 : 0);
function insertMeal(key, meal) {
  const day = ensureDay(key);
  day.meals.push(meal);
  day.meals.sort(byTime);
  persistDay(key);
}
/**
 * Giờ và loại bữa cho một bữa mới ghi vào ngày `key`. Hôm nay: theo đồng hồ. Ngày đã qua: giờ lúc này không thuộc về ngày đó
 * nên để trống, và xếp vào bữa chính đầu tiên (sáng, trưa, tối) mà ngày ấy chưa có, đủ cả rồi thì là ăn vặt.
 */
function slotFor(key) {
  if (key === S.today) { const t = L.nowHHMM(); return { t, type: L.mealTypeAt(t) }; }
  const have = (S.days[key]?.meals || []).map((m) => m.type);
  return { t: "", type: ["sang", "trua", "toi"].find((id) => !have.includes(id)) || "vat" };
}
/**
 * Loại bữa của lần gần đây nhất món này được ghi mà loại bữa đáng tin: bữa có giờ thật (loại theo đồng hồ / theo Claude) hoặc
 * do người dùng tự chọn. Bữa ghi bù không giờ thì không tính (loại của nó chỉ là "ô còn trống"). Chưa có lần nào: null.
 */
function usualType(name) {
  const n = L.normName(name);
  for (const k of Object.keys(S.days).sort().reverse()) {
    const hit = (S.days[k].meals || []).find((m) => (m.t || m.typeEdited) && TYPE_IDS.includes(m.type) && L.normName(m.name) === n);
    if (hit) return hit.type;
  }
  return null;
}
/** Ghi nhanh một bữa đã biết kcal (nhập tay hoặc từ "món hay ăn"). */
export function addReadyMeal({ name, items, ph = null, src = "manual", type }) {
  const clean = L.cleanItems(items, 12);
  if (!clean.length) return null;
  const key = S.viewDay;
  const meal = withType({ id: L.uid(), ...slotFor(key), name: String(name || clean[0].n).trim().slice(0, 120) || clean[0].n, items: clean, src }, type);
  // "Món hay ăn" ghi bù vào một ngày đã qua: không có giờ, cũng không có Claude để nhận ra đồ ăn vặt — xếp theo loại bữa mà món
  // này vẫn thường được ghi (hũ sữa chua là "ăn vặt", không chiếm mất ô "Bữa trưa" của ngày ấy). Chưa rõ thì giữ như slotFor.
  if (src === "fav" && key !== S.today && !meal.typeEdited) meal.type = usualType(meal.name) || meal.type;
  if (ph) meal.ph = ph;
  insertMeal(key, meal);
  changed();
  checkMoments();
  return { key, meal };
}
export function updateMeal(key, id, mutate) {
  const m = findMeal(key, id);
  if (!m) return;
  const had = !!(m.items && m.items.length);
  mutate(m);
  S.days[key].meals.sort(byTime);
  persistDay(key);
  changed();
  // Bữa vừa có món lần đầu nhờ nhập tay ("Tự nhập số calo" khi chưa kết nối Claude): xét điều đáng mừng ngay, như khi Claude tính xong.
  if (!had && m.items && m.items.length) checkMoments();
}
/** Xoá và trả về hàm hoàn tác. Ảnh được dọn ở lần mở app sau, nên hoàn tác luôn còn ảnh. */
export function deleteMeal(key, id) {
  const day = S.days[key];
  const m = findMeal(key, id);
  if (!day || !m) return null;
  stopJob(id, true);
  const { tg, td } = day; // xoá bữa cuối cùng của một ngày thì cả ngày bị gỡ: nhớ mức kcal đã chụp để hoàn tác trả lại y nguyên
  const at = day.meals.indexOf(m); // chỗ của bữa trong danh sách, để hoàn tác trả về đúng chỗ ấy
  day.meals = day.meals.filter((x) => x.id !== id);
  persistDay(key);
  changed();
  return () => {
    if (findMeal(key, id)) return;
    const copy = { ...m };
    if (copy.pending) { delete copy.pending; if (!(copy.items && copy.items.length)) copy.failed = "aborted"; }
    if (key !== S.today && tg) { const d = ensureDay(key); if (!d.tg) { d.tg = tg; if (td) d.td = td; } }
    // Trả về đúng chỗ cũ rồi mới xếp theo giờ (phép xếp giữ nguyên thứ tự các bữa cùng giờ / không có giờ): các bữa ghi bù cho
    // ngày cũ đều không có giờ, chèn vào cuối như bữa mới thì "Hoàn tác" lại làm đổi thứ tự danh sách.
    const d = ensureDay(key);
    d.meals.splice(Math.max(0, Math.min(at, d.meals.length)), 0, copy);
    d.meals.sort(byTime);
    persistDay(key);
    changed();
  };
}
export function setWater(key, n) {
  const day = ensureDay(key);
  day.water = L.clamp(Math.round(n), 0, 30);
  if (!day.water) delete day.water;
  persistDay(key);
  changed();
  checkMoments();
}
let removedWeight = null; // lần cân vừa xoá gần nhất: { key, weight, tg, td, stamps } — để "Hoàn tác" trả lại y nguyên
/** @returns {{ok:boolean, error?:string, prev?:number|null}} */
export function logWeight(key, raw) {
  const w = L.parseNum(raw);
  if (w === null || w < 30 || w > 250) return { ok: false, error: "Nhập cân nặng từ 30 đến 250 kg." };
  if (key > S.today) return { ok: false, error: "Chưa tới ngày này." };
  const series = L.weightSeries(S.days, S.profile).filter((p) => p.k < key);
  const prev = series.length ? series[series.length - 1].w : null;
  // Ghi lại ĐÚNG số vừa xoá của đúng ngày đó là "Hoàn tác" (xem removeWeight): trả ngày ấy về nguyên trạng — kể cả mức kcal
  // đã chụp — và không mừng lại những điều đã mừng cho chính con số này.
  const r = removedWeight;
  const back = r && r.key === key && L.round1(Number(r.weight)) === L.round1(w) && !(S.days[key] && S.days[key].weight != null) ? r : null;
  if (r && r.key === key) removedWeight = null;
  const before = S.profile ? stats() : null; // số liệu ngay trước khi số cân đổi — xem checkMoments
  const day = ensureDay(key);
  day.weight = L.round1(w);
  if (back && key !== S.today && back.tg) { day.tg = back.tg; if (back.td) day.td = back.td; }
  // Hoàn tác: những ngày kế đó đã được chụp lại mức kcal lúc xoá (restamp) cũng trở về mức cũ.
  if (back) for (const k of Object.keys(back.stamps || {})) {
    const d = S.days[k];
    if (d && k !== S.today && k !== key) { d.tg = back.stamps[k].tg; d.td = back.stamps[k].td; persistDay(k); }
  }
  // Cân lại ngay trong ngày bắt đầu là sửa con số gõ nhầm lúc đầu, không phải đã giảm cân: dời luôn điểm xuất phát.
  if (!back && S.profile && key === S.profile.startDate && S.profile.startWeight !== L.round1(w)) {
    S.profile = { ...S.profile, startWeight: L.round1(w) };
    saveKV("profile", S.profile);
  }
  ctxCache = null;
  persistDay(key);
  if (key !== S.today) syncTodayTarget(); // lần cân của ngày cũ có thể làm đổi mức kcal đang áp dụng
  changed();
  checkMoments({ silent: !!back, before }); // hoàn tác: chỉ đánh dấu lại, không bật lời chúc mừng lần nữa
  return { ok: true, prev };
}
/** Xoá một lần cân và trả về hàm hoàn tác (null nếu ngày đó không có lần cân nào). */
export function removeWeight(key) {
  const day = S.days[key];
  if (!day || day.weight == null) return null;
  const rec = { key, weight: day.weight, tg: day.tg, td: day.td };
  removedWeight = rec;
  const before = S.profile ? stats() : null; // số liệu ngay trước khi số cân đổi — xem checkMoments
  delete day.weight;
  ctxCache = null;
  persistDay(key);
  // Ngày cũ: mức kcal đã chụp lúc số cân gõ nhầm còn hiệu lực (của chính ngày đó và những ngày kế tiếp cho tới lần cân sau)
  // được chụp lại theo số cân thật sự áp dụng NGÀY ĐÓ — không phải theo mức của hôm nay.
  rec.stamps = restamp(key, rec.weight);
  if (key !== S.today) syncTodayTarget();
  changed();
  checkMoments({ before }); // xoá một lần cân gõ nhầm: mốc/huy hiệu chưa thật sự đạt được trả về "chưa đạt"
  return () => {
    if (S.days[key] && S.days[key].weight != null) return; // ngày đó đã được cân lại: không ghi đè
    removedWeight = rec;
    logWeight(key, rec.weight);
  };
}

/* ---------------- món hay ăn ---------------- */
export const isPinned = (name) => S.favs.some((f) => L.normName(f.name) === L.normName(name));
export function togglePin(meal) {
  const key = L.normName(meal.name);
  if (!key || !meal.items?.length) return false;
  const had = isPinned(meal.name);
  S.favs = S.favs.filter((f) => L.normName(f.name) !== key);
  if (!had) {
    const fav = { name: meal.name, items: meal.items.map((it) => ({ ...it })) };
    if (meal.ph) fav.ph = meal.ph;
    S.favs.unshift(fav);
    S.favs = S.favs.slice(0, 30);
  }
  saveKV("favs", S.favs);
  changed();
  return !had;
}
export const frequent = (limit = 8) => L.frequentMeals(S.days, S.today, S.favs, limit);

/* ---------------- ảnh ---------------- */
export async function photoUrl(id) {
  if (!id) return null;
  if (photoCache.has(id)) return photoCache.get(id);
  let url = null;
  try { url = await store.getPhoto(id); } catch {}
  if (url) photoCache.set(id, url);
  return url;
}
export const cachedPhoto = (id) => photoCache.get(id) || null;
async function gcPhotos() {
  try {
    const used = L.usedPhotoIds(S.days, S.favs);
    const waiting = new Set();
    for (const k of Object.keys(S.days)) for (const m of S.days[k].meals) if (m.ph && (m.pending || m.failed)) waiting.add(m.ph);
    for (const id of await store.photoIds()) {
      const isTmp = String(id).startsWith("tmp-");
      const base = isTmp ? String(id).slice(4) : id;
      if (photoCache.has(base)) continue; // ảnh đang dùng trong phiên này
      if (!used.has(base) || (isTmp && !waiting.has(base))) await store.delPhoto(id);
    }
  } catch {}
}

/* ---------------- chụp ảnh / gõ mô tả → Claude ---------------- */
const jobs = new Map(); // mealId → { ctl, partial, key, quiet }
const tries = new Map(); // mealId → số lần tự thử lại vì mạng
export const jobOf = (id) => jobs.get(id) || null;
const NETWORKISH = ["network", "timeout", "offline", "server", "rate", "sdk"];

const TYPE_IDS = L.MEAL_TYPES.map((t) => t.id);
/** Người dùng tự chọn loại bữa (chạm vào ô "Bữa tối"…): giữ đúng lựa chọn đó, không để giờ giấc hay Claude đổi lại. */
function withType(meal, type) {
  if (TYPE_IDS.includes(type)) { meal.type = type; meal.typeEdited = true; }
  return meal;
}

/** Tạo ngay một bữa "đang nhận diện" kèm ảnh rồi phân tích ở nền. */
export async function addPhotoMeal(file, type) {
  let prepared;
  try { prepared = await prepareImage(file); } catch { emit("toast", { text: "Máy không đọc được ảnh này. Thử chụp lại hoặc chọn ảnh JPG, PNG." }); return null; }
  const ph = L.uid();
  photoCache.set(ph, prepared.keep); // đặt trước khi ghi: bộ dọn ảnh sẽ không đụng tới ảnh vừa chụp
  try {
    await store.putPhoto(ph, prepared.keep);
    await store.putPhoto("tmp-" + ph, "data:image/jpeg;base64," + prepared.ai.b64);
  } catch (e) { console.error(e); photoCache.delete(ph); saveFailed(e); return null; }
  const key = S.viewDay;
  const meal = withType({ id: L.uid(), ...slotFor(key), name: "Bữa ăn mới", items: [], ph, src: "photo", pending: true }, type);
  insertMeal(key, meal);
  changed();
  startJob(key, meal.id);
  return { key, meal };
}
/** Tạo một bữa từ lời mô tả và nhờ Claude ước tính. */
export function addTextMeal(text, type) {
  const hint = String(text || "").trim().slice(0, 300);
  if (!hint) return null;
  const key = S.viewDay;
  // Tên hiện trong danh sách lúc chưa tính xong: mô tả dài thì cắt ở ranh giới từ và thêm dấu "…" (lời mô tả đầy đủ vẫn nằm ở hint).
  const name = hint.length > 60 ? hint.slice(0, 58).replace(/\s+\S*$/, "").replace(/[\s,.;:]+$/, "") + "…" : hint;
  const meal = withType({ id: L.uid(), ...slotFor(key), name, items: [], src: "text", hint, pending: true }, type);
  insertMeal(key, meal);
  changed();
  startJob(key, meal.id);
  return { key, meal };
}
/** Tính lại (có thể kèm mô tả thêm). */
export function retryMeal(key, id, hint) {
  const m = findMeal(key, id);
  if (!m || jobs.has(id)) return;
  if (hint !== undefined) m.hint = String(hint || "").trim().slice(0, 300);
  delete m.failed; delete m.detail;
  m.pending = true;
  tries.delete(id);
  persistDay(key);
  changed();
  startJob(key, id);
}
export function stopJob(id, quiet = false) {
  const j = jobs.get(id);
  if (j) { j.quiet = quiet; j.ctl.abort(); return; }
  if (quiet) return; // gọi từ deleteMeal: không có gì để dừng
  // Bữa còn ghi "đang tính" nhưng không có việc nào đang chạy (app bị đóng giữa chừng, rồi mở lại lúc mất mạng hoặc chưa có khoá):
  // "Dừng lại" vẫn phải có tác dụng — chuyển sang "đã dừng" để hiện Thử lại / Tự nhập / Xoá.
  for (const key of Object.keys(S.days)) {
    const m = findMeal(key, id);
    if (m && m.pending) {
      delete m.pending;
      if (!(m.items && m.items.length)) m.failed = "aborted"; // đang "tính lại" một bữa đã có kết quả: giữ kết quả cũ
      persistDay(key);
      changed();
      return;
    }
  }
}
/** Bỏ hết các việc đang chạy (trước khi khôi phục/xoá toàn bộ dữ liệu): kết quả về muộn không được ghi vào đâu nữa. */
function dropJobs() {
  epoch++; // lời nhận xét cuối ngày đang chờ về cũng thuộc dữ liệu cũ: bỏ
  for (const j of jobs.values()) { j.dropped = true; j.quiet = true; j.ctl.abort(); }
  jobs.clear();
  waiting.clear();
  busyMeals.clear();
}
let resumeTimer = null;
const waiting = new Map(); // mealId → { key, failure }: bữa vừa hỏng vì mạng, đang giữ ở "đang tính" chờ lần tự thử lại
/**
 * Một bữa vừa hỏng vì mạng trong lúc app đang mở (hay gặp khi vừa quay lại app: kết nối cũ chết sau lúc app bị tạm dừng):
 * hẹn chạy resumePending() sau ít giây thay vì chờ tới nhịp 5 phút. Vẫn tối đa 2 lần tự thử như cũ.
 * @returns {boolean} true nếu sắp tự thử lại
 */
function retrySoon(key, id, code) {
  if (!NETWORKISH.includes(code) || (tries.get(id) || 0) >= 2) return false;
  if (typeof document === "undefined" || document.hidden) return false;
  if (key !== S.today && key !== L.addDays(S.today, -1)) return false; // resumePending chỉ tự thử lại bữa hỏng của hôm nay/hôm qua
  if (!S.settings.apiKey || (typeof navigator !== "undefined" && navigator.onLine === false)) return false;
  if (!resumeTimer) resumeTimer = setTimeout(() => {
    resumeTimer = null;
    const held = [...waiting];
    waiting.clear();
    resumePending(true);
    // Lần thử lại không chạy được (vừa mất mạng, khoá vừa bị gỡ…): không để bữa treo mãi ở "đang tính" — báo "chưa tính được" như thường.
    for (const [mid, w] of held) {
      const m = findMeal(w.key, mid);
      if (m && m.pending && !jobs.has(mid)) { failMeal(w.key, m, w.failure); emit("job", { id: mid }); }
    }
  }, 3000);
  return true;
}
/** Đang có một tấm (bữa ăn, cài đặt…) mở trên màn hình — ui.js gắn lớp "has-sheet" lên <html> suốt lúc đó. */
const sheetUp = () => typeof document !== "undefined" && document.documentElement.classList.contains("has-sheet");
/** Ghi nhận một bữa chưa tính được và báo cho giao diện. (Bữa sắp được tự thử lại thì không qua đây: nó vẫn là "đang tính".) */
function failMeal(key, m, failure) {
  delete m.pending;
  m.failed = failure.code;
  if (failure.detail) m.detail = failure.detail; else delete m.detail;
  persistDay(key);
  changed();
  emit("failed", { key, id: m.id, code: failure.code });
}

const BUSY = Symbol("busy"); // một bản khác của app đang tính đúng bữa này
const busyMeals = new Map(); // mealId → key: bữa mà bản khác đang tính, bản này chờ
let busyTimer = null;
/**
 * Bữa đang do bản khác tính: ít giây sau xem lại. Bản kia tính xong thì kết quả đã vào kho (refresh đọc lại, bữa hết "đang tính");
 * bản kia bị tắt giữa chừng (hoặc khoá chỉ kẹt lại chốc lát sau khi trang tải lại) thì bản này nhận việc, không phải chờ tới
 * lần mở app sau.
 */
function recheckBusy(key, id) {
  busyMeals.set(id, key);
  if (busyTimer) return;
  busyTimer = setTimeout(async () => {
    busyTimer = null;
    const list = [...busyMeals];
    busyMeals.clear();
    await refresh();
    // Như resumePending: lúc này không tính được (chưa có khoá, mất mạng) thì để nguyên, lần mở app / có mạng lại sẽ chạy.
    if (!S.profile || !S.settings.apiKey || (typeof navigator !== "undefined" && navigator.onLine === false)) return;
    for (const [mid, k] of list) { const m = findMeal(k, mid); if (m && m.pending) startJob(k, mid); }
  }, 10000);
}
/**
 * Mỗi bữa chỉ một bản của app được nhờ Claude tính tại một thời điểm (tab Chrome và app trên màn hình chính của Android cùng
 * thấy một bữa "đang tính"): giữ khoá "nkc-job-<mã bữa>" suốt lúc chờ Claude. Bản khác đang giữ → trả về BUSY, không gọi Claude.
 * Trình duyệt không có navigator.locks thì chạy thẳng như trước. Việc xin khoá báo lỗi, hoặc 2 giây không thấy trả lời (trên
 * iPhone, kho dữ liệu từng "chết" theo kiểu đó sau khi app nằm nền), thì cũng tính luôn không cần khoá: thà có lúc hai bản
 * cùng tính một bữa còn hơn để bữa treo mãi ở "đang tính".
 */
function withJobLock(id, run) {
  const locks = typeof navigator !== "undefined" && navigator.locks;
  if (!locks || typeof locks.request !== "function") return run();
  return new Promise((resolve, reject) => {
    let started = false;
    /** Bắt đầu tính (đúng một lần); trả về lời hứa không bao giờ hỏng, xong khi việc tính xong — khoá được giữ tới lúc đó. */
    const start = () => {
      if (started) return undefined;
      started = true;
      let p;
      try { p = Promise.resolve(run()); } catch (e) { p = Promise.reject(e); }
      p.then(resolve, reject);
      return p.then(() => {}, () => {});
    };
    const timer = setTimeout(start, 2000);
    let asked;
    try {
      asked = locks.request("nkc-job-" + id, { ifAvailable: true }, (lock) => {
        clearTimeout(timer);
        if (started) return undefined; // đã tính không khoá (trả lời quá muộn): nhả khoá ngay
        if (!lock) { started = true; resolve(BUSY); return undefined; }
        return start();
      });
    } catch (e) { asked = Promise.reject(e); }
    Promise.resolve(asked).catch(() => { clearTimeout(timer); start(); });
  });
}

async function startJob(key, id) {
  if (jobs.has(id)) return;
  const meal = findMeal(key, id);
  if (!meal) return;
  const job = { ctl: new AbortController(), partial: { name: "", items: [] }, key, quiet: false, dropped: false };
  jobs.set(id, job);
  emit("job", { id });
  let failure = null, result = null;
  let waited = false; // đã có lúc phải chờ (đọc ảnh, gọi Claude): trong lúc đó bản khác của app có thể đã ghi vào kho
  try {
    if (!S.settings.apiKey) throw new AiError("no_key");
    if (typeof navigator !== "undefined" && navigator.onLine === false) throw new AiError("offline");
    let image = null;
    if (meal.ph) {
      waited = true;
      let url = null;
      try { url = (await store.getPhoto("tmp-" + meal.ph)) || (await store.getPhoto(meal.ph)); } catch (e) {
        // Kho dữ liệu không đọc được (iPhone làm rớt kết nối sau khi app nằm nền): đây không phải là "tính hỏng". Bữa vẫn là
        // "đang tính", không tính vào số lần tự thử; app tải lại xong (xem checkStore) thì lần mở sau tự chạy tiếp.
        console.error(e);
        if (jobs.get(id) === job) jobs.delete(id);
        tries.delete(id);
        emit("job", { id });
        checkStore();
        return;
      }
      if (url) {
        // Ảnh do app tự lưu luôn là JPEG; ảnh đến từ một file sao lưu có thể là PNG/WebP — báo đúng loại cho Claude.
        const mt = /^data:(image\/(?:jpeg|png|webp));base64,/.exec(url);
        image = { b64: url.slice(url.indexOf(",") + 1), mediaType: mt ? mt[1] : "image/jpeg" };
      }
    }
    if (!image && !meal.hint) throw new AiError("photo");
    waited = true;
    // Bối cảnh trong ngày cho lời nhận xét bữa này: mục tiêu của ngày và số kcal đã ghi ở các bữa khác.
    const c0 = ctx(), d0 = S.days[key];
    const context = c0 && d0 ? L.mealContext({
      target: key === S.today ? c0.target : L.targetForDay(d0, c0.target),
      eatenBefore: L.dayTotals({ meals: d0.meals.filter((x) => x.id !== id) }).kcal, type: meal.type, hasTime: !!meal.t || !!meal.typeEdited,
    }) : "";
    result = await withJobLock(id, () => analyzeMeal({
      apiKey: S.settings.apiKey, model: S.settings.model, image, hint: meal.hint || "", context, signal: job.ctl.signal,
      onPartial: (p) => { job.partial = p; emit("job", { id }); },
    }));
  } catch (e) {
    failure = e instanceof AiError ? e : new AiError("unknown", String(e?.message || ""));
  }
  if (result === BUSY) {
    // Một bản khác của app đang tính bữa này: không gọi Claude lần hai, không tính là một lần thử. Bữa vẫn "đang tính";
    // kết quả của bản kia tới đây qua refresh(). Nếu bản kia bị tắt giữa chừng thì lần resumePending() sau sẽ nhận việc.
    if (jobs.get(id) === job) jobs.delete(id);
    const n = tries.get(id) || 0;
    if (n > 0) tries.set(id, n - 1); // resumePending đã đếm trước một lần
    emit("job", { id });
    recheckBusy(key, id);
    return;
  }
  // Kết quả về lúc bản này đã cũ (bản khác của app vừa ghi thêm bữa, ly nước…): đọc lại kho trước, để kết quả được ghi vào
  // ngày mới nhất chứ không ghi cả ngày cũ đè lên. Lỗi báo ngay tức thì (chưa có khoá, mất mạng) thì không chờ gì cả.
  if (waited) await refresh();
  if (jobs.get(id) === job) jobs.delete(id);
  if (job.dropped) { emit("job", { id }); return; } // dữ liệu đã được thay (khôi phục/xoá hết): bỏ kết quả, kể cả khi nó vẫn về
  const m = findMeal(key, id);
  if (!m) { emit("job", { id }); return; } // đã bị xoá trong lúc chờ
  if (result) {
    m.items = result.items;
    if (!m.nameEdited) m.name = result.name;
    // Bữa không có giờ (ghi bù vào ngày đã qua): không đoán loại bữa theo đồng hồ; chỉ đồ ăn vặt / đồ uống mới đổi sang "ăn vặt".
    if (!m.typeEdited) m.type = m.t ? L.mealTypeAt(m.t, result.kind) : (result.kind === "snack" || result.kind === "drink") ? "vat" : m.type;
    m.conf = result.confidence;
    if (result.note) m.note = result.note; else delete m.note;
    if (result.advice) m.advice = result.advice; else delete m.advice;
    delete m.pending; delete m.failed; delete m.detail;
    tries.delete(id);
    if (m.ph) store.delPhoto("tmp-" + m.ph).catch(() => {});
    persistDay(key);
    changed();
    emit("analyzed", { key, id });
    checkMoments();
  } else {
    if (failure.code === "aborted" && job.quiet) { emit("job", { id }); return; }
    delete m.pending;
    if (m.items && m.items.length) {
      // "Tính lại" một bữa đã có kết quả mà không thành (hoặc bị dừng): giữ kết quả cũ, không biến bữa đã ghi thành "chưa tính được".
      delete m.failed; delete m.detail;
      persistDay(key);
      changed();
      if (failure.code !== "aborted") {
        toast(failure.code === "offline" ? "Máy đang không có mạng nên chưa tính lại được. App giữ kết quả cũ."
          : failure.code === "no_key" ? "App chưa được kết nối với Claude nên chưa tính lại được. App giữ kết quả cũ."
          : "Chưa tính lại được, app giữ kết quả cũ.");
      }
    } else if (retrySoon(key, id, failure.code)) {
      // Sắp tự thử lại: bữa vẫn là "đang tính" — dù có tấm nào đang mở hay không — lần thử cuối vẫn hỏng mới hiện (và báo)
      // "chưa tính được". Nếu hiện "chưa tính được" rồi vài giây sau lại tự đổi về "đang tính" thì dòng ở màn chính mời chạm
      // vào một bữa sắp tự chạy lại, còn tấm đang mở thì bị vẽ lại ngay dưới tay người dùng, mất luôn những gì đang gõ.
      // Hẹn giờ trong retrySoon chạy lại các bữa đang giữ ở đây, và báo hỏng như thường nếu lần thử lại không chạy được.
      m.pending = true;
      waiting.set(id, { key, failure });
    } else {
      failMeal(key, m, failure);
    }
  }
  emit("job", { id });
}

/** Chạy lại các bữa còn dang dở (app bị đóng giữa chừng) hoặc hỏng vì mạng. Gọi khi mở app, khi có mạng lại. */
export function resumePending(quick = false) {
  if (!S.profile || !S.settings.apiKey) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  // Bữa còn "đang tính" (app bị đóng giữa chừng) thì chạy lại dù ở ngày nào; bữa hỏng vì mạng chỉ tự thử lại trong hôm nay/hôm qua.
  const recent = [S.today, L.addDays(S.today, -1)];
  // Đang gõ dở trong một ô (thường là "Tự nhập số calo" của chính bữa vừa hỏng): chưa tự thử lại bữa ĐÃ BÁO HỎNG, vì thử lại sẽ vẽ lại
  // tấm bữa ăn và xoá mất chữ đang gõ. Lần có mạng lại / mở lại app kế tiếp sẽ thử. Lần thử "sau ít giây" (quick) còn nhường cả khi
  // đang có tấm mở: người dùng đang đọc "chưa tính được", không tự đổi tấm dưới tay họ.
  const a = typeof document !== "undefined" ? document.activeElement : null;
  const busy = (!!a && /^(INPUT|TEXTAREA)$/.test(a.tagName || "")) || (quick === true && sheetUp());
  for (const key of Object.keys(S.days)) {
    const isRecent = recent.includes(key);
    for (const m of S.days[key]?.meals || []) {
      if (jobs.has(m.id)) continue;
      const again = m.pending || (!busy && isRecent && m.failed && NETWORKISH.includes(m.failed));
      if (!again) continue;
      const n = tries.get(m.id) || 0;
      if (n >= 2) { if (m.pending) { delete m.pending; if (!(m.items && m.items.length)) m.failed = "network"; persistDay(key); changed(); } continue; }
      tries.set(m.id, n + 1);
      if (!m.pending) { delete m.failed; delete m.detail; m.pending = true; persistDay(key); changed(); }
      startJob(key, m.id);
    }
  }
}

/* ---------------- nhận xét cuối ngày ---------------- */
let epoch = 0; // tăng mỗi lần toàn bộ dữ liệu bị thay (khôi phục, xoá hết)
const reviewing = new Set(); // các ngày đang chờ Claude nhận xét
export const isReviewing = (key) => reviewing.has(key);
// Lỗi nói được nguyên nhân rõ ràng thì báo đúng nguyên nhân; còn lại chỉ nói "chưa nhận xét được".
const REVIEW_SAY = ["no_key", "offline", "network", "timeout", "sdk", "bad_key", "billing", "spend_cap", "model", "forbidden", "rate", "server"];
/**
 * Nhờ Claude nhìn lại một ngày (các bữa đã ghi + thói quen mấy tuần gần đây) và gợi ý cho ngày kế tiếp. Chỉ chạy khi người dùng
 * bấm nút; kết quả lưu vào chính ngày đó (day.rv) nên mở lại vẫn còn, và đi theo file sao lưu.
 */
export async function reviewDay(key) {
  const day = S.days[key], c = ctx();
  if (!c || !day || reviewing.has(key)) return;
  if (!day.meals.some((m) => m.items && m.items.length)) { toast("Chưa có bữa nào đã tính xong để nhận xét."); return; }
  const you = S.settings.pronoun || "bạn";
  let code = null;
  if (!S.settings.apiKey) code = "no_key";
  else if (typeof navigator !== "undefined" && navigator.onLine === false) code = "offline";
  if (code) { toast(aiErrorText(code, you, false)); return; }
  const mine = epoch;
  reviewing.add(key);
  changed();
  try {
    const summary = L.daySummary({
      days: S.days, key, todayKey: S.today, target: key === S.today ? c.target : L.targetForDay(day, c.target), you,
      hour: key === S.today ? new Date().getHours() : null, waterGoal: c.waterGoal,
    });
    const r = await askReview({ apiKey: S.settings.apiKey, model: S.settings.model, summary });
    await refresh();
    const d = S.days[key];
    if (mine === epoch && d && L.hasLog(d)) {
      d.rv = { c: r.comment, a: r.adjust, t: r.tomorrow.map((x) => ({ m: x.meal, d: x.dish, k: x.kcal, w: x.why })), sig: L.reviewSig(d), on: S.today };
      persistDay(key);
    }
  } catch (e) {
    console.error(e);
    const ec = e instanceof AiError ? e.code : "unknown";
    if (mine === epoch) toast(REVIEW_SAY.includes(ec) ? aiErrorText(ec, you, false) : "Chưa nhận xét được lúc này. Thử lại sau một lát nhé.");
  } finally {
    reviewing.delete(key);
    changed();
  }
}

/* ---------------- những khoảnh khắc đáng mừng ---------------- */
/**
 * So trạng thái hiện tại với những gì đã chúc mừng; phát sự kiện 'moments' cho tối đa 2 điều mới.
 * silent: chỉ đánh dấu đã thấy (dùng sau khi khôi phục sao lưu hoặc vừa tạo hồ sơ).
 * before: stats() chụp ngay TRƯỚC một lần sửa/xoá số cân (logWeight, removeWeight, saveProfile truyền vào). Chỉ khi có nó
 *   mới xét trả lại huy hiệu cân nặng, và chỉ trả cái nào vừa đúng trước lần sửa mà sau lần sửa không còn đúng. Đổi cân mong
 *   muốn, ghi bữa, sang ngày mới… không bao giờ lấy lại huy hiệu đã nhận.
 */
export function checkMoments({ silent = false, before = null } = {}) {
  if (!S.profile) return [];
  const st = stats();
  const seen = S.meta.seen;
  const found = [];
  let dirty = false;
  const mark = (id) => { if (!seen[id]) { seen[id] = S.today; dirty = true; return true; } return false; };

  // Mốc cân nặng tính theo lần cân thấp nhất từng ghi: đã mở quà thì không bị lấy lại khi cân nhích lên.
  // Ngược lại, nếu lần cân ấy là gõ nhầm và đã được sửa/xoá thì bỏ dấu "đã mừng" — để khi đạt thật, app mừng lại đàng hoàng.
  const allMs = L.milestones(S.profile, S.settings.rewards);
  const ms = allMs.filter((m) => st.bestLost >= m.kg - 1e-9);
  // Xét MỌI dấu "ms:<kg>" đang có, không chỉ các mốc của danh sách hiện tại: sửa cân lúc bắt đầu làm danh sách mốc đổi theo.
  for (const id of Object.keys(seen)) {
    if (!id.startsWith("ms:")) continue;
    const kg = Number(id.slice(3));
    if (!(kg <= st.bestLost + 1e-9)) { delete seen[id]; dirty = true; }
  }
  if (before) for (const id of L.WEIGHT_BADGES) if (S.meta.earned[id] && L.badgeHolds(id, before) && !L.badgeHolds(id, st)) { delete S.meta.earned[id]; dirty = true; }
  const freshMs = ms.filter((m) => mark(`ms:${m.kg}`));
  for (const m of freshMs) if (m.isGoal) found.push({ rank: 0, type: "goal", kg: m.kg, reward: m.reward });
  for (const m of freshMs) if (!m.isGoal && m.reward) found.push({ rank: 1, type: "reward", kg: m.kg, reward: m.reward });
  const plain = freshMs.filter((m) => !m.isGoal && !m.reward).pop();
  if (plain) found.push({ rank: 4, type: "milestone", kg: plain.kg });

  const plant = L.plantState(st.okDays, st.plantFloor);
  let grew = false;
  for (let i = 2; i <= plant.stage; i++) if (mark(`plant:${i}`)) grew = true;
  if (grew) found.push({ rank: 2, type: "plant", stage: plant.stage, name: plant.name, line: plant.line });

  const sameAsMilestone = { lost1: 1, lost2: 2 };
  for (const b of L.badgeStates(st, S.meta.earned)) {
    if (b.on && !S.meta.earned[b.id]) {
      S.meta.earned[b.id] = S.today; dirty = true;
      // "Giảm 1 kg", "Giảm 2 kg", "Về đích" vừa được mừng theo mốc cân nặng ở trên thì không mừng lặp.
      const dup = (b.id === "goal" && freshMs.some((m) => m.isGoal)) || (sameAsMilestone[b.id] && freshMs.some((m) => m.kg === sameAsMilestone[b.id]));
      if (!dup) found.push({ rank: 3, type: "badge", id: b.id, title: b.title, desc: b.desc });
    }
  }
  let streakTop = 0;
  for (const n of STREAK_MARKS) if (st.streak >= n && mark(`streak:${n}`)) streakTop = n;
  if (streakTop && ![3, 7, 30].includes(streakTop)) found.push({ rank: 5, type: "streak", n: streakTop });

  if (dirty) saveMeta();
  if (silent || !found.length) return [];
  const top = found.sort((a, b) => a.rank - b.rank).slice(0, 2);
  emit("moments", top);
  return top;
}

/** Lời nhắc sáng về hôm qua (nếu hôm qua có ghi và chưa bấm tắt). */
export function recapInfo() {
  const c = ctx();
  if (!c) return null;
  const y = L.addDays(S.today, -1);
  if (S.meta.seen[`recap:${y}`] || !L.hasLog(S.days[y])) return null;
  const day = S.days[y];
  const target = L.targetForDay(day, c.target);
  return { key: y, status: L.dayStatus(day, target), kcal: L.dayTotals(day).kcal, target };
}
export function dismissRecap(key) {
  S.meta.seen[`recap:${key}`] = S.today;
  // dọn các dấu "recap" cũ để meta không phình mãi
  for (const id of Object.keys(S.meta.seen)) if (id.startsWith("recap:") && id.slice(6) < L.addDays(S.today, -14)) delete S.meta.seen[id];
  saveMeta();
  changed();
}

/** Các gợi ý chỉ hiện một lần (mời cài app, nhắc kết nối Claude…). */
export const seen = (id) => !!S.meta.seen[id];
export function markSeen(id) {
  if (S.meta.seen[id]) return;
  S.meta.seen[id] = S.today;
  saveMeta();
  changed();
}

/* ---------------- ngày mới ---------------- */
// Trang có bị che (khoá máy, sang app khác) kể từ lần tick() trước không. Dùng khi sang ngày mới — xem tick().
let wasHidden = false;
let hiddenAt = 0; // lúc trang bị che gần nhất
let leftBehind = false; // đồng hồ đã qua 0 giờ trong lúc đang xem một ngày cũ: màn hình còn ở lại ngày ấy
if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
  document.addEventListener("visibilitychange", () => { if (document.hidden) { wasHidden = true; hiddenAt = Date.now(); } });
}
export function tick() {
  checkStore(); // app vừa được mở lại lên màn hình: kiểm tra kho dữ liệu trước khi người dùng ghi thêm
  refresh(); // lần đọc lại kho bị hoãn vì còn nợ ghi (xem refresh) thì thử lại ở đây
  const away = wasHidden;
  wasHidden = false;
  const now = L.dkey();
  if (now === S.today) {
    // Đang xem một ngày cũ lúc qua 0 giờ (màn hình được để nguyên ở ngày ấy), rồi khoá máy đi ngủ: sáng mở ra phải là hôm nay.
    // Chỉ làm vậy sau một lần vắng mặt dài (từ 30 phút) — mở máy ảnh, chọn ảnh hay ghé app khác một lát thì không đổi ngày
    // đang ghi bù dưới tay người dùng.
    if (away && leftBehind && S.viewDay !== S.today && Date.now() - hiddenAt >= 30 * 60 * 1000) {
      leftBehind = false;
      S.viewDay = S.today;
      changed();
      return true;
    }
    return false;
  }
  // Sang ngày mới: màn hình theo sang hôm nay nếu đang xem hôm nay, hoặc nếu app vừa bị che từ lần xem trước (mở xem lại một
  // ngày cũ tối qua rồi khoá máy: sáng nay mở ra phải là hôm nay, kẻo bữa sáng bị ghi vào ngày cũ). Còn đang nhìn một ngày cũ
  // đúng lúc đồng hồ qua 0 giờ thì để nguyên ngày đang xem.
  const following = S.viewDay === S.today || away;
  leftBehind = !following;
  S.today = now;
  if (following) S.viewDay = now;
  changed();
  checkMoments();
  return true;
}
export function viewDay(key) {
  if (!L.isKey(key) || key > S.today) return;
  leftBehind = false; // ngày do chính người dùng chọn: không tự đưa về hôm nay nữa
  S.viewDay = key;
  emit("change");
}
let refreshing = null; // lượt đọc lại đang chạy (mọi lời gọi refresh() trong lúc đó nhận chung một kết quả)
/**
 * Một bản khác của app (tab Chrome và app trên màn hình chính của Android dùng chung kho dữ liệu) đã ghi sau lần bản này đọc?
 * Nếu có thì đọc lại toàn bộ từ kho, tại chỗ, trước khi bản này kịp ghi đè bằng số liệu cũ. Không bao giờ ném lỗi.
 * @returns {Promise<boolean>} true nếu vừa đọc lại dữ liệu
 */
export async function refresh() {
  if (!S.ready || !store || store.mode !== "idb" || !store.revStale) return false;
  if (refreshing) return refreshing;
  // Còn nợ ghi thì chưa đọc lại được (đọc lại sẽ xoá mất phần nợ đang nằm trong bộ nhớ): flushUnsaved() và tick() gọi lại sau.
  if (hasUnsaved() || !store.revStale()) return false;
  refreshing = (async () => {
    let did = false;
    try {
      // Mỗi vòng: nhớ dấu TRƯỚC khi đọc, rồi đọc. Trong lúc đọc mà kho lại được ghi (bản khác, hoặc chính bản này) thì đọc thêm
      // vòng nữa, để bộ nhớ khớp với kho. Việc đang nhờ Claude tính không bị bỏ: startJob tự tìm lại bữa của nó theo mã.
      let fresh = true; // vòng vừa rồi có được đưa vào bộ nhớ không (load bỏ bản đọc được khi chính bản này ghi chen vào giữa)
      for (let round = 0, mark; round < 5 && !hasUnsaved() && store.revStale(mark); round++) {
        mark = store.revSee();
        fresh = await load(true, mark);
        if (fresh) did = true;
      }
      if (!fresh) store.revMiss(); // dừng ở một vòng bị bỏ (còn nợ ghi, hoặc ghi chen vào liên tục): vẫn còn cũ, lần sau đọc lại
    } catch (e) {
      console.error(e);
      store.revMiss(); // đọc không được: vẫn còn cũ, lần sau thử lại
    }
    refreshing = null;
    if (did) changed();
    return did;
  })();
  return refreshing;
}

/* ---------------- sao lưu ---------------- */
/** withKey: kèm khoá Claude để chuyển nguyên thiết lập sang máy khác (người dùng phải chủ động chọn). */
export async function exportData({ withPhotos = false, withKey = false } = {}) {
  const { apiKey, ...settings } = S.settings;
  const out = { app: L.BACKUP_APP, version: 1, exportedAt: new Date().toISOString(), profile: S.profile, settings, meta: S.meta, favs: S.favs, days: S.days };
  if (withKey && apiKey) out.apiKey = apiKey;
  if (withPhotos) {
    const all = await store.allPhotos();
    out.photos = {};
    for (const [id, url] of Object.entries(all)) if (!String(id).startsWith("tmp-")) out.photos[id] = url;
  }
  return JSON.stringify(out);
}
/** @returns {Promise<{ok:boolean, error?:string, days?:number}>} */
export async function importData(text) {
  let obj;
  try { obj = JSON.parse(text); } catch { return { ok: false, error: "File này không đọc được." }; }
  // File bị sửa tay (một đối tượng nằm ở chỗ lẽ ra là chữ hoặc số) có thể làm bước làm sạch ném lỗi: báo như file hỏng, không im lặng.
  let r;
  try { r = L.cleanBackup(obj, S.today); } catch { return { ok: false, error: "File này không đọc được." }; }
  if (!r.ok) return r;
  if (!r.data.profile) return { ok: false, error: "File sao lưu thiếu hồ sơ nên không khôi phục được." };
  const d = r.data;
  // File thiết lập (chưa có bữa nào): hành trình tính từ hôm nay, ngày nhận app. Một file chưa có bữa ăn nào cũng được
  // coi là "thiết lập" khi báo kết quả, để lời báo không nói "khôi phục 1 ngày nhật ký" cho một app còn trống.
  L.rebaseSetupFile(d, S.today);
  const setup = !Object.keys(d.days).some((k) => (d.days[k].meals || []).length);
  const settings = L.cleanSettings({ ...d.settings, apiKey: d.apiKey || S.settings.apiKey });
  // Dừng mọi việc đang tính TRƯỚC khi ghi đè: nếu không, một bữa tính xong đúng lúc này sẽ ghi ngày cũ đè lên dữ liệu vừa khôi phục.
  dropJobs();
  try {
    await store.replaceAll({ kv: { profile: d.profile, settings, meta: d.meta, favs: d.favs }, days: d.days, photos: d.photos });
  } catch (e) {
    console.error(e);
    resumePending(); // dữ liệu cũ còn nguyên: cho các bữa vừa bị dừng chạy lại
    return { ok: false, error: isQuotaError(e) ? "Chưa ghi được vào máy. Bộ nhớ có thể đã đầy." : "Chưa ghi được vào máy. Hãy đóng hẳn app rồi mở lại." };
  }
  dropJobs(); // việc nào lỡ bắt đầu trong lúc chờ ghi cũng bỏ
  clearUnsaved();
  sawStore();
  await load();
  noteDiary();
  askedPersist = true;
  askPersist(); // tài khoản dựng từ file sao lưu không đi qua bước tạo hồ sơ: xin giữ dữ liệu lâu dài ở đây
  ctxCache = null;
  changed();
  checkMoments({ silent: true });
  return { ok: true, days: Object.keys(d.days).length, setup };
}
export async function wipeAll() {
  dropJobs();
  await store.replaceAll({ kv: {}, days: {}, photos: {} });
  clearUnsaved();
  sawStore();
  await load();
  noteDiary();
  ctxCache = null;
  changed();
}
