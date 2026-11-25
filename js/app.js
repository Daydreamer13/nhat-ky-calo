// app.js — khởi động, vòng vẽ lại, điều hướng hai tab và mọi thao tác chạm ở màn chính.

import * as St from "./state.js";
import { S } from "./state.js";
import * as L from "./logic.js";
import { html, raw, $, $$, setHtml, toast, sheetOpen, canPromptInstall, promptInstall, onInstallChange, buzz } from "./ui.js";
import { renderOnboarding, leaveOnboarding, restoreFromFile } from "./views/onboarding.js";
import { viewToday, shiftWeek, resetWeek, moreSuggestions, suggestionAt } from "./views/today.js";
import { viewJourney, shiftMonth } from "./views/journey.js";
import { tabBar } from "./views/chrome.js";
import { openSettings, importFromFile } from "./views/settings.js";
import { openMeal, openTextAdd, openWeight, mealSheetFor, openGiftBox, openExercise } from "./views/sheets.js";

const root = $("#app");
let tab = "today";
const scrollPos = { today: 0, journey: 0 };

/* ---------------- sáng / tối / màu ---------------- */
const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
function applyLook() {
  const el = document.documentElement;
  const theme = S.settings.theme === "auto" ? (darkQuery.matches ? "dark" : "light") : S.settings.theme;
  if (el.dataset.theme !== theme) el.dataset.theme = theme;
  if (el.dataset.accent !== S.settings.accent) el.dataset.accent = S.settings.accent;
  try { localStorage.setItem("nkc-look", JSON.stringify({ theme: S.settings.theme, accent: S.settings.accent })); } catch {}
  const meta = $('meta[name="theme-color"]');
  if (meta) { const bg = getComputedStyle(el).getPropertyValue("--chrome").trim(); if (bg) meta.setAttribute("content", bg); }
}
darkQuery.addEventListener("change", () => { if (S.ready) applyLook(); });

/* ---------------- vẽ ---------------- */
let frame = 0;
function schedule() {
  if (!frame) frame = requestAnimationFrame(() => { frame = 0; render(); });
}
function hydratePhotos(scope) {
  for (const img of $$("img[data-ph]", scope)) {
    if (img.getAttribute("src")) continue;
    const cached = St.cachedPhoto(img.dataset.ph);
    if (cached) { img.src = cached; continue; }
    St.photoUrl(img.dataset.ph).then((url) => {
      if (!img.isConnected) return;
      if (url) img.src = url;
      else img.closest("[data-photo-slot]")?.classList.add("no-photo");
    });
  }
}
function render() {
  if (!S.ready) return;
  applyLook();
  if (!S.profile) {
    document.body.dataset.screen = "onboarding";
    renderOnboarding(root);
    return;
  }
  if (document.body.dataset.screen === "onboarding") { leaveOnboarding(); window.scrollTo(0, 0); }
  document.body.dataset.screen = tab;
  // Vẽ lại thay toàn bộ #app nên nút vừa bấm biến mất: nhớ nó (theo data-act và thứ tự) để trả tiêu điểm về nút tương ứng,
  // nếu không bàn phím / TalkBack / VoiceOver bị ném về đầu trang sau mỗi lần chạm. Chỉ làm khi tiêu điểm đang nằm trong #app.
  const active = document.activeElement;
  const had = !!active && active !== root && root.contains(active);
  const keep = had ? active.closest("[data-act]") : null;
  const keepAct = keep ? keep.dataset.act : null;
  const keepAt = keep ? $$("[data-act]", root).filter((n) => n.dataset.act === keepAct).indexOf(keep) : -1;
  setHtml(root, html`<main class="screen" id="screen" tabindex="-1" style="outline:0" data-tab="${tab}">${tab === "today" ? viewToday() : viewJourney()}</main>${tabBar(tab)}`);
  if (had && !sheetOpen()) {
    const same = keepAct === null ? [] : $$("[data-act]", root).filter((n) => n.dataset.act === keepAct);
    const t = same[keepAt] || same[0];
    // nút đã biến mất hoặc đang bị khoá: tiêu điểm về khung màn hình (không vẽ viền), để phím Tab đi tiếp từ đầu màn này
    (t && !t.disabled ? t : $("#screen")).focus({ preventScroll: true });
  }
  hydratePhotos(root);
  playFx();
}
/* Khu vườn "đáp lời": cây vươn mình khi vừa ghi một bữa, bình tưới nghiêng khi thêm ly nước.
   Màn hình được vẽ lại sau mỗi thay đổi, nên hiệu ứng được xếp hàng ở đây rồi bật ngay sau khi vẽ. */
const fx = new Set();
const FX = { fed: [".hero", "is-fed"], pour: [".water", "is-pouring"] };
function playFx() {
  for (const name of fx) {
    const [sel, cls] = FX[name];
    const el = $(sel, root);
    if (el) { el.classList.add(cls); setTimeout(() => el.classList.remove(cls), 900); }
  }
  fx.clear();
}
function go(next) {
  if (next === tab) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
  scrollPos[tab] = window.scrollY;
  tab = next;
  render();
  window.scrollTo(0, scrollPos[tab] || 0);
}

/* ---------------- chụp ảnh ---------------- */
let busyPhoto = false;
let nextType = null; // loại bữa người dùng vừa chạm (ô "Chụp bữa tối"…)
async function onPhoto(file) {
  const type = nextType;
  nextType = null;
  if (!file || busyPhoto) return;
  busyPhoto = true;
  document.body.classList.add("is-reading-photo");
  try {
    // Chụp từ tab Hành trình: luôn ghi vào hôm nay, không ghi nhầm vào ngày cũ đang xem dở.
    if (tab !== "today") { resetWeek(); St.viewDay(S.today); go("today"); }
    const r = await St.addPhotoMeal(file, type);
    if (r) { buzz(10); openMeal(r.key, r.meal.id); }
  } finally {
    busyPhoto = false;
    document.body.classList.remove("is-reading-photo");
  }
}
for (const id of ["camInput", "pickInput"]) {
  $("#" + id).addEventListener("change", (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; onPhoto(f); });
}
/* Một khi máy ảnh / thư viện ảnh / ô chọn file sao lưu đã được mở trong lần tải trang này, app không tự tải lại để cập nhật
   nữa (tải lại lúc đó làm mất tấm ảnh đang chụp dở) — chỉ hiện lời mời "Tải lại". Gắn vào chính các ô chọn file nên mọi nơi
   gọi .click() (màn chính, Cài đặt, màn chào) đều được tính, không cần ai báo. */
let chooserUsed = false;
for (const id of ["camInput", "pickInput", "importInput"]) $("#" + id).addEventListener("click", () => { chooserUsed = true; });

/* Dấu "đang mở máy ảnh": trên Android, máy thiếu bộ nhớ có thể tắt hẳn trình duyệt khi máy ảnh đang mở; lúc quay lại app
   được mở mới từ đầu và tấm ảnh không bao giờ tới nơi. Để lại dấu trước khi mở máy ảnh, xoá khi trang còn sống
   (ảnh về, bấm huỷ, chạm bất cứ đâu, hoặc vài giây sau khi trang hiện lại); lúc khởi động mà dấu còn mới thì nói cho người dùng biết. */
const CAM_MARK = "nkc-cam";
let camMarkTimer = 0;
function markCamera() {
  clearTimeout(camMarkTimer);
  try { localStorage.setItem(CAM_MARK, String(Date.now())); } catch {}
}
function unmarkCamera() {
  clearTimeout(camMarkTimer);
  try { localStorage.removeItem(CAM_MARK); } catch {}
}
for (const ev of ["change", "cancel"]) $("#camInput").addEventListener(ev, unmarkCamera);
document.addEventListener("visibilitychange", () => {
  clearTimeout(camMarkTimer);
  if (!document.hidden) camMarkTimer = setTimeout(unmarkCamera, 4000);
});
/* Android: trình duyệt chưa được cấp quyền Máy ảnh thì ô chụp ảnh tự đóng ngay, không hiện gì — nút "Chụp món" thành nút chết.
   Dấu hiệu nhận ra: ô chụp báo "cancel" mà từ lúc bấm trang chưa hề bị che (máy ảnh mở thật thì trang bị che trước đã).
   Chỉ xét trên Android: ở iPhone máy ảnh không che trang nên phép thử này sẽ báo nhầm mỗi lần bấm Huỷ. */
let camHidden = false;
$("#camInput").addEventListener("click", () => { camHidden = false; });
document.addEventListener("visibilitychange", () => { if (document.hidden) camHidden = true; });
$("#camInput").addEventListener("cancel", () => {
  if (!/Android/i.test(navigator.userAgent) || camHidden) return;
  toast("Chưa mở được máy ảnh. Có thể trình duyệt chưa được cấp quyền Máy ảnh: vào Cài đặt điện thoại › Ứng dụng › trình duyệt đang dùng (Chrome, Samsung Internet…) › Quyền › Máy ảnh. Hoặc bấm “Chọn ảnh có sẵn”.", null, 9000);
});
/** Gọi lúc khởi động: lần trước máy ảnh mở mà ảnh không về (trang bị tắt giữa chừng)? */
function cameraWasLost() {
  let at = 0;
  try { at = Number(localStorage.getItem(CAM_MARK)) || 0; localStorage.removeItem(CAM_MARK); } catch {}
  return at > 0 && Date.now() - at < 15 * 60 * 1000;
}
$("#importInput").addEventListener("change", async (e) => {
  const f = e.target.files && e.target.files[0];
  e.target.value = "";
  if (!f) return;
  if (S.profile) await importFromFile(f); else await restoreFromFile(f);
});

/* ---------------- chạm ---------------- */
document.addEventListener("click", async (e) => {
  // Còn chạm được vào trang nghĩa là trang vẫn sống sau lần mở máy ảnh trước (trừ cú "bấm" do chính app gửi vào ô chọn file).
  if (!(e.target instanceof HTMLInputElement && e.target.type === "file")) unmarkCamera();
  const b = e.target.closest("[data-act]");
  if (!b || !S.profile) return;
  const parts = b.dataset.act.split(":");
  const act = parts[0];
  switch (act) {
    case "tab": go(parts[1]); break;
    case "camera": nextType = parts[1] || null; markCamera(); $("#camInput").click(); break;
    case "pick": nextType = parts[1] || null; $("#pickInput").click(); break;
    case "text": openTextAdd(parts[1] || null); break;
    case "settings": openSettings(parts[1] || ""); break;
    case "meal": openMeal(parts[1], parts[2]); break;
    case "fav": {
      const f = St.frequent(8)[Number(parts[1])];
      if (!f) break;
      const r = St.addReadyMeal({ name: f.name, items: f.items.map((it) => ({ ...it })), ph: f.ph, src: "fav" });
      if (r) { fx.add("fed"); buzz(10); toast(`Đã ghi ${f.name} · ${L.fmtInt(L.mealTotals(r.meal).kcal)} kcal.`, { label: "Hoàn tác", fn: () => St.deleteMeal(r.key, r.meal.id) }); }
      break;
    }
    case "sug": {
      // Món gợi ý: ghi ngay vào đúng bữa đang được gợi ý, như một món hay ăn (có Hoàn tác).
      const s = suggestionAt(Number(parts[1]));
      if (!s) break;
      const r = St.addReadyMeal({ name: s.name, items: s.items.map((it) => ({ ...it })), src: "manual", type: s.slot });
      if (r) { fx.add("fed"); buzz(10); toast(`Đã ghi ${s.name} · ${L.fmtInt(L.mealTotals(r.meal).kcal)} kcal.`, { label: "Hoàn tác", fn: () => St.deleteMeal(r.key, r.meal.id) }); }
      break;
    }
    case "sug-more": moreSuggestions(); schedule(); break;
    case "review": St.reviewDay(S.viewDay); break;
    case "gift": openGiftBox(parts.slice(1).join(":")); break;
    case "ex-add": openExercise(parts[1] || "", Number(parts[2]) || 0); break;
    case "ex-del": {
      const undo = St.removeExercise(S.viewDay, parts[1]);
      if (undo) toast("Đã xoá buổi tập.", { label: "Hoàn tác", fn: undo });
      break;
    }
    case "water": {
      const n = Number(parts[1]);
      const cur = St.dayAt(S.viewDay).water || 0;
      if (n > cur) fx.add("pour");
      St.setWater(S.viewDay, n === cur ? n - 1 : n); // chạm lại ly cuối cùng để bớt một ly
      buzz(6);
      if (n !== cur && n === S.settings.waterGoal && S.viewDay === S.today) toast("Đủ nước hôm nay rồi!");
      break;
    }
    case "day": {
      const key = parts.slice(1).join("-");
      if (tab === "today") { St.viewDay(key); break; }
      // Chạm một ngày trên lịch ở tab Hành trình: sang Hôm nay, mở đúng ngày đó, cuộn về đầu để thấy tên ngày.
      resetWeek(); St.viewDay(key); go("today"); window.scrollTo(0, 0);
      break;
    }
    case "week": shiftWeek(Number(parts[1])); schedule(); break;
    case "today": resetWeek(); St.viewDay(S.today); window.scrollTo({ top: 0, behavior: "smooth" }); break;
    case "month": shiftMonth(Number(parts[1])); schedule(); break;
    case "weight": openWeight(); break;
    case "recap-x": St.dismissRecap(parts.slice(1).join("-")); break;
    case "hint-x": St.markSeen(`hint:${parts[1]}`); break;
    case "install": { const ok = await promptInstall(); if (ok) toast("Đã cài lên màn hình chính."); schedule(); break; }
  }
});
document.addEventListener("nkc:settings", (e) => openSettings(e.detail || ""));

/* ---------------- sự kiện từ trạng thái ---------------- */
St.on("change", schedule);
St.on("toast", ({ text, action }) => toast(text, action));
St.on("analyzed", ({ key, id }) => {
  fx.add("fed");
  const open = mealSheetFor();
  if (open && open.id === id) return;
  const m = St.findMeal(key, id);
  if (m) toast(`Đã ghi ${m.name} · ${L.fmtInt(L.mealTotals(m).kcal)} kcal.`, { label: "Xem", fn: () => openMeal(key, id) }, 0, `meal:${id}`);
});
St.on("failed", ({ key, id, code }) => {
  if (code === "aborted") return;
  // Lỗi có thể được báo trước cả khi tấm của chính bữa đó kịp mở (chưa có khoá, mất mạng: báo ngay trong lúc ghi bữa;
  // bữa gõ tay còn phải chờ tấm "Gõ tên món" đóng xong). Chờ việc chuyển tấm xong rồi mới xét: tấm của bữa đang mở
  // thì nó đã nói rõ lỗi, không cần thêm thông báo đè lên.
  setTimeout(() => {
    const open = mealSheetFor();
    const m = St.findMeal(key, id);
    if ((open && open.id === id) || !m || !m.failed) return;
    toast("Có một bữa chưa tính được calo.", { label: "Xem", fn: () => openMeal(key, id) }, 0, `meal:${id}`);
  }, 400);
});
onInstallChange(schedule);
/* Kho dữ liệu mất kết nối và không mở lại được trong trang này (lỗi của iPhone sau khi app nằm nền lâu): chỉ tải lại trang
   mới chữa được. Tải lại NGAY khi lúc này chắc chắn không làm mất gì — trang đang hiện, không tấm nào mở, không đang đọc ảnh,
   không đang gõ dở, không bữa nào đang nhờ Claude tính, đã có hồ sơ (màn làm quen còn giữ các câu trả lời vừa gõ) — và nhiều
   nhất một lần mỗi phút (kẻo tải lại mãi nếu tải lại không chữa được). Không thì hiện lời mời để người dùng tự bấm. */
const STORE_RELOAD = "nkc-store-reload";
St.on("storelost", () => {
  const a = document.activeElement;
  const typing = !!a && /^(INPUT|TEXTAREA)$/.test(a.tagName || "");
  const analysing = Object.keys(S.days).some((k) => (S.days[k].meals || []).some((m) => St.jobOf(m.id)));
  let safe = !!S.profile && !document.hidden && !sheetOpen() && !busyPhoto && !typing && !analysing;
  if (safe) {
    try {
      const last = Number(sessionStorage.getItem(STORE_RELOAD)) || 0;
      if (Date.now() - last < 60 * 1000) safe = false;
      else sessionStorage.setItem(STORE_RELOAD, String(Date.now()));
    } catch { safe = false; } // không ghi nhớ được lần tải lại thì không tự tải lại
  }
  if (safe) { location.reload(); return; }
  toast("App cần tải lại để lưu tiếp. Hãy đóng hẳn app rồi mở lại.", { label: "Tải lại", fn: () => location.reload() });
});

/* ---------------- nhịp sống của app ---------------- */
/** Một bản khác của app đã ghi vào kho thì đọc lại (state.js tự xét có cần không). Không bao giờ ném lỗi ra ngoài. */
// Cố ý KHÔNG đặt giới hạn thời gian cho lượt đọc lại này. Bản này chỉ phải đọc lại khi một bản khác của app vừa ghi; nếu chưa đọc xong
// mà đã đi tiếp thì tick()/resumePending() ghi bằng số liệu cũ, xoá mất bữa bản kia vừa lưu (đã thử: kho trả lời chậm quá 5 giây là
// mất bữa). Đổi lại, trong trường hợp hiếm hơn nữa — có bản khác vừa ghi VÀ kho không bao giờ trả lời — nhịp sống của app đứng
// chờ cho tới khi app được mở lại; lúc đó kho đã hỏng, có đi tiếp cũng không lưu được gì.
const rereadStore = () => St.refresh().catch((e) => { console.error(e); return false; });
async function wake() {
  if (!S.ready) return;
  // Một bản khác của app (tab Chrome và app trên màn hình chính của Android dùng chung kho dữ liệu) có thể đã ghi trong lúc
  // bản này nằm nền: đọc lại kho TRƯỚC mọi việc có thể ghi (tick() ghi dấu mừng, resumePending() ghi bữa), kẻo ghi đè bằng số liệu cũ.
  await rereadStore();
  const newDay = St.tick();
  if (newDay) resetWeek();
  St.resumePending();
  if (!sheetOpen()) schedule(); // lời chào, lời động viên đổi theo giờ
  checkForUpdate();
}
document.addEventListener("visibilitychange", () => { if (!document.hidden) wake(); });
// Hai bản app cùng hiện một lúc (chia đôi màn hình, hai cửa sổ): bản kia vừa ghi thì bản này đọc lại ngay. (Sự kiện chỉ tới các bản KHÁC.)
window.addEventListener("storage", (e) => { if (S.ready && e.key === "nhat-ky-calo.rev") rereadStore(); });
window.addEventListener("online", () => { if (S.ready) rereadStore().then(() => St.resumePending()); });
setInterval(() => { if (!document.hidden) wake(); }, 5 * 60 * 1000);
/* Sang ngày mới đúng lúc nửa đêm: app để mở qua 0 giờ thì bữa ăn, ly nước, cân nặng ghi sau đó phải vào ngày mới,
   không chờ tới nhịp 5 phút. (Máy ngủ làm lỡ hẹn giờ cũng không sao: lúc màn hình sáng lại wake() đã chạy.) */
function armMidnight() {
  const n = new Date();
  const ms = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 0, 0, 1).getTime() - n.getTime();
  setTimeout(() => { wake(); armMidnight(); }, Math.max(1000, ms));
}
armMidnight();
// iPhone chỉ bật trạng thái :active (nút lún nhẹ khi chạm) nếu trang có lắng nghe sự kiện chạm; ở máy khác dòng này không làm gì.
document.addEventListener("touchstart", () => {}, { passive: true });

/* ---------------- chạy offline + cập nhật ---------------- */
/** Service worker đang điều khiển trang có phải của chính app này không (cùng tên miền còn có thể có worker của app khác). */
const swUrl = () => new URL("sw.js", location.href).href;
const swScope = () => new URL("./", location.href).href;
const mine = (c) => !!c && c.scriptURL === swUrl();
function registerSW() {
  if (!("serviceWorker" in navigator)) return;
  const dev = ["localhost", "127.0.0.1"].includes(location.hostname) && !location.search.includes("sw=1");
  if (dev) {
    // Khi phát triển trên máy: không lưu đệm để luôn thấy mã mới. Nếu trước đó đã từng mở với ?sw=1 thì gỡ worker cũ ra,
    // và tải lại một lần nếu trang này vẫn do nó phục vụ (sau đó không còn gì để gỡ nên không lặp).
    const had = mine(navigator.serviceWorker.controller);
    navigator.serviceWorker.getRegistrations()
      .then((rs) => Promise.all(rs.filter((r) => r.scope === swScope()).map((r) => r.unregister())))
      .then((done) => { if (done.length && had) location.reload(); })
      .catch(() => {});
    return;
  }
  let hadController = mine(navigator.serviceWorker.controller);
  navigator.serviceWorker.register("sw.js").catch(() => {});
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!mine(navigator.serviceWorker.controller)) return; // worker của app khác đổi phiên bản: không liên quan
    // Lần cài đầu tiên: không có gì để tải lại. Từ đó trở đi, worker đổi nữa nghĩa là có bản mới.
    if (!hadController) { hadController = true; return; }
    let reloaded = false;
    try { reloaded = sessionStorage.getItem("nkc-reloaded") === "1"; sessionStorage.setItem("nkc-reloaded", "1"); } catch {}
    // Chỉ tự tải lại khi chắc chắn không làm mất gì: không có tấm nào mở, không đang đọc ảnh, và trong lần tải trang này
    // chưa từng mở máy ảnh / ô chọn file (trên Android trang "ẩn" đúng lúc máy ảnh đang mở). Cũng không tải lại khi còn
    // bữa đang nhờ Claude tính: tải lại sẽ cắt ngang yêu cầu đó và lúc mở lại phải gửi thêm lần nữa (tốn tiền hai lần).
    const analysing = Object.keys(S.days).some((k) => (S.days[k].meals || []).some((m) => m.pending));
    // Chưa có hồ sơ = đang ở màn làm quen (không phải một "tấm"): tải lại sẽ xoá hết những câu trả lời vừa gõ.
    const idle = !!S.profile && !sheetOpen() && !busyPhoto && !chooserUsed && !analysing;
    if (!reloaded && idle && (document.hidden || performance.now() < 8000)) { location.reload(); return; }
    const tell = () => toast("App vừa có bản mới.", { label: "Tải lại", fn: () => location.reload() }, 15000);
    if (!document.hidden) { tell(); return; }
    // Trang đang bị che (đang chụp ảnh, đang ở app khác): thông báo lúc này sẽ tắt trước khi kịp nhìn thấy — chờ trang hiện lại.
    document.addEventListener("visibilitychange", function shown() {
      if (document.hidden) return;
      document.removeEventListener("visibilitychange", shown);
      setTimeout(tell, 1500);
    });
  });
}
/* App mở sẵn nhiều ngày (nhất là app trên Màn hình chính của iPhone, được đánh thức chứ không tải lại) thì trình duyệt
   không tự hỏi bản mới. Mỗi lần thức dậy hỏi giúp, nhiều nhất một giờ một lần; có bản mới thì đi theo lối cập nhật ở trên. */
let updateAskedAt = Date.now(); // lúc tải trang trình duyệt đã tự hỏi rồi
function checkForUpdate() {
  if (!("serviceWorker" in navigator) || Date.now() - updateAskedAt < 60 * 60 * 1000) return;
  updateAskedAt = Date.now();
  navigator.serviceWorker.getRegistration()
    .then((r) => { if (r && r.scope === swScope()) return r.update(); })
    .catch(() => {});
}

/* ---------------- khởi động ---------------- */
(async function start() {
  try {
    await St.boot();
  } catch (e) {
    console.error(e);
    setHtml(root, html`<div class="boot-fail"><h1>Chưa mở được app</h1><p>Máy không đọc được dữ liệu đã lưu. Thử đóng hẳn app rồi mở lại.</p><button class="btn primary" id="bootReload">Tải lại</button></div>`);
    $("#bootReload").addEventListener("click", () => location.reload());
    return;
  }
  render();
  registerSW();
  St.checkMoments();
  St.resumePending();
  // Lối tắt từ biểu tượng app (giữ lâu trên màn hình chính): mở sẵn khung gõ món. Tham số chỉ dùng MỘT lần rồi gỡ khỏi
  // địa chỉ, nếu không mỗi lần trang tải lại (cập nhật, máy khôi phục app) khung gõ món lại tự bật lên.
  const query = new URLSearchParams(location.search);
  if (query.get("do") === "text") {
    query.delete("do");
    const rest = query.toString();
    try { history.replaceState(history.state, "", location.pathname + (rest ? "?" + rest : "") + location.hash); } catch {}
    if (S.profile) openTextAdd();
  }
  // Lần trước máy ảnh mở mà ảnh không về tới app: nói ra, kèm cách chụp khác. Hiện sau các thông báo lúc khởi động để không bị đè mất.
  if (cameraWasLost() && S.profile) {
    setTimeout(() => toast("Ảnh vừa chụp có vẻ chưa về được app (có thể do máy thiếu bộ nhớ). Nếu lặp lại, hãy chụp bằng máy ảnh của điện thoại rồi bấm “Chọn ảnh có sẵn”.", null, 9000), 900);
  }
})();

