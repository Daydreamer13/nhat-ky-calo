// ui.js — dụng cụ giao diện dùng chung: khuôn HTML an toàn, tấm trượt (sheet), thông báo nhỏ, chia sẻ, cài app.

/* ---------------- HTML an toàn ---------------- */
const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
/** Đánh dấu một chuỗi là HTML đã an toàn (SVG tự vẽ, khuôn con…). */
export const raw = (s) => new Raw(String(s ?? ""));
function show(v) {
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(show).join("");
  if (v === null || v === undefined || v === false || v === true) return "";
  return esc(v);
}
/**
 * Khuôn HTML: mọi giá trị chèn vào đều được thoát ký tự, trừ khi bọc bằng raw() hoặc là khuôn html`` khác.
 * Tên món, lời nhắn, kết quả từ Claude… đi qua đây nên không thể chèn mã vào trang.
 */
export function html(strings, ...vals) {
  let out = strings[0];
  for (let i = 0; i < vals.length; i++) out += show(vals[i]) + strings[i + 1];
  return new Raw(out);
}
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export function setHtml(el, tpl) { el.innerHTML = tpl instanceof Raw ? tpl.s : esc(tpl); }

/* ---------------- giữ tiêu điểm khi vẽ lại ----------------
   Vẽ lại bằng innerHTML/outerHTML làm biến mất phần tử đang được chọn: bàn phím, TalkBack/VoiceOver bị ném về đầu trang,
   phím Escape của tấm trượt hết tác dụng. Bọc thao tác vẽ lại trong withFocus để tiêu điểm trở về đúng nút tương ứng. */
const FOCUS_KEYS = ["data-act", "data-ms", "data-set", "data-set-check", "data-pf", "data-ob", "data-f", "data-tx", "data-ws", "data-cele", "data-kcal", "data-part", "data-close-sheet"];
function focusMark(el, container) {
  if (!el || el === document.body || !container.contains(el) || el === container) return null;
  if (el.id) return { sel: `#${CSS.escape(el.id)}`, i: 0 };
  for (const k of FOCUS_KEYS) {
    const v = el.getAttribute(k);
    if (v === null) continue;
    const sel = `[${k}="${CSS.escape(v)}"]`;
    return { sel, i: Math.max(0, $$(sel, container).indexOf(el)) };
  }
  return null;
}
/**
 * Chạy fn() (thường là vẽ lại một phần của container) rồi trả tiêu điểm về phần tử tương ứng nếu nó vừa bị thay thế.
 * Nhận diện phần tử theo id, hoặc theo thuộc tính data-* quen dùng (data-act, data-ms, data-set…) và thứ tự của nó.
 * Không tìm lại được thì đặt tiêu điểm vào chính container (nếu container nhận tiêu điểm được), để Escape/Tab vẫn chạy.
 * @param {HTMLElement} container  vùng được vẽ lại (tấm trượt, #app…)
 * @param {() => any} fn
 */
export function withFocus(container, fn) {
  const before = container ? document.activeElement : null;
  const mark = container ? focusMark(before, container) : null;
  const had = !!container && !!before && container.contains(before);
  const out = fn();
  if (!had) return out;
  const now = document.activeElement;
  if (now && now !== document.body && now.isConnected && container.contains(now)) return out; // vẫn còn nguyên
  let target = null;
  if (mark) { const list = $$(mark.sel, container); target = list[mark.i] || list[0] || null; }
  if (target && typeof target.focus === "function" && !target.disabled) target.focus({ preventScroll: true });
  else if (container.isConnected && container.tabIndex >= -1 && container.hasAttribute("tabindex")) container.focus({ preventScroll: true });
  return out;
}
export const buzz = (ms = 8) => { try { navigator.vibrate && navigator.vibrate(ms); } catch {} };

/* ---------------- tấm trượt (sheet) ----------------
   Mỗi tấm thêm một bước vào lịch sử trình duyệt, nên nút Back của Android đóng tấm thay vì thoát app. */
const stack = [];
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
/** Các phần tử Tab tới được trong một tấm: đang hiện, và không nằm trong nhóm <details> đang gập (trừ chính dòng tiêu đề nhóm). */
const tabbable = (root) => $$(FOCUSABLE, root).filter((n) => n.offsetParent !== null && !n.closest("details:not([open]) > :not(summary)"));
/** Các phần tử khớp sel ở màn hình phía sau (không nằm trong tấm trượt nào). */
const behind = (sel) => $$(sel).filter((n) => !n.closest(".sheet-wrap"));

/* Lịch sử trình duyệt và chồng tấm phải luôn khớp nhau: mỗi tấm đang mở giữ đúng một bước lịch sử (handle._depth).
   depthNow() = số bước "tấm" mà lịch sử đang đứng; flying = số bước lùi app đã yêu cầu nhưng popstate chưa tới. */
const depthNow = () => (history.state && history.state.nkcSheet) || 0;
let flying = 0;
let flyTimer = null;
let lastDepth = depthNow();
let bootBack = false;
function goBack(n) {
  flying += n;
  clearTimeout(flyTimer);
  // Phòng khi trình duyệt không báo popstate: không để app "bận" mãi, và tấm đã bấm đóng thì vẫn phải đóng được.
  flyTimer = setTimeout(() => {
    flying = 0; bootBack = false;
    for (const h of stack.filter((x) => x._closing)) h._destroy();
  }, 1500);
  history.go(-n);
}
/** Trả lại những bước lịch sử không còn tấm nào đứng sau, để nút Back không phải bấm "hụt". */
function settle() {
  const want = stack.length ? stack[stack.length - 1]._depth : 0;
  const extra = depthNow() - want - flying;
  if (extra > 0) goBack(extra);
}
// Trang nền tự khôi phục vị trí cuộn (xem lockScroll); không để trình duyệt cuộn hộ mỗi lần lùi lịch sử.
try { history.scrollRestoration = "manual"; } catch {}
// Tải lại trang khi đang mở tấm: bước lịch sử của tấm còn đó nhưng tấm thì không. Lùi về cho hết, kẻo lần bấm Back đầu tiên không làm gì.
if (lastDepth > 0) { bootBack = true; goBack(lastDepth); }

/* Khoá cuộn trang nền khi có tấm trượt. iPhone (iOS 15) vẫn cho kéo trang dù body đã overflow: hidden,
   nên ghim hẳn <body> lại (position: fixed) ở đúng vị trí đang cuộn, và trả về chỗ cũ khi tấm cuối cùng đóng. */
let lockY = 0;
function lockScroll() {
  const b = document.body.style;
  lockY = Math.max(0, window.scrollY || 0);
  // <body> đã ghim thì <html> cao 0: nền chuyển màu mượn từ body sẽ không còn vẽ đúng chỗ.
  // Cho <html> một màu nền riêng để body tự vẽ nền trên chính nó, trông y như lúc chưa khoá.
  document.documentElement.style.backgroundColor = getComputedStyle(document.body).backgroundColor;
  b.position = "fixed"; b.top = `${-lockY}px`; b.left = "0"; b.right = "0"; b.width = "100%";
}
function unlockScroll() {
  const b = document.body.style;
  b.position = ""; b.top = ""; b.left = ""; b.right = ""; b.width = "";
  document.documentElement.style.backgroundColor = "";
  window.scrollTo(0, lockY);
}

/* Ghi nhận ô đang gõ dở. Các tấm lưu thay đổi khi ô nhập báo "change", tức là khi ô MẤT tiêu điểm. Trên iPhone, chạm vào
   một nút (hay vào nền mờ, hay vuốt Back) không làm ô đang gõ mất tiêu điểm, nên "change" chưa tới mà tấm đã xử lý cú chạm
   hoặc đã đóng: số kcal/tên vừa sửa sẽ mất. Vì vậy trước mỗi cú chạm trong tấm và trước khi tấm đóng, tự báo "change" cho ô
   đang có tiêu điểm nếu nội dung của nó đã đổi. Trên máy khác ô đã mất tiêu điểm từ trước nên hàm này không làm gì. */
const typed = new WeakMap(); // ô nhập → nội dung lúc nhận tiêu điểm, hoặc lúc được ghi nhận gần nhất
const isField = (n) => !!n && (n.tagName === "TEXTAREA" || (n.tagName === "INPUT" && !/^(checkbox|radio|button|submit|file|range)$/.test(n.type)));
function commitField(sheetEl, except) {
  const a = document.activeElement;
  if (!isField(a) || a === except || !sheetEl.contains(a)) return;
  if (typed.get(a) === a.value) return;
  typed.set(a, a.value);
  a.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * @param {object} o
 * @param {string} o.label      tên cho trình đọc màn hình
 * @param {Raw|string} o.body   nội dung
 * @param {string} [o.kind]     lớp CSS phụ: 'full' (toàn màn hình), 'center' (hộp giữa màn hình)
 * @param {(el:HTMLElement)=>void} [o.onMount]
 * @param {()=>void} [o.onClose]
 * @param {boolean} [o.dismissable=true]  chạm nền mờ để đóng
 */
export function openSheet({ label, body, kind = "", onMount, onClose, dismissable = true }) {
  const wrap = document.createElement("div");
  wrap.className = `sheet-wrap ${kind}`.trim();
  wrap.innerHTML = `<div class="scrim" data-close-sheet></div><section class="sheet" role="dialog" aria-modal="true" tabindex="-1"></section>`;
  const el = wrap.lastElementChild;
  el.setAttribute("aria-label", label);
  setHtml(el, body);
  const opener = document.activeElement;
  // Trong lúc tấm đang mở, màn hình phía sau có thể được vẽ lại (sửa bữa ăn, ghi cân, đổi giao diện…): nút đã mở tấm bị thay
  // bằng một nút mới giống hệt. Nhớ "dấu" của nó (id hoặc data-* + thứ tự) để lúc đóng trả tiêu điểm về đúng nút tương ứng.
  const openerSheet = opener && opener.closest ? opener.closest(".sheet") : null; // tấm này mở chồng lên một tấm khác
  const openerMark = focusMark(opener, openerSheet || document.body);
  if (openerMark && !openerSheet) openerMark.i = Math.max(0, behind(openerMark.sel).indexOf(opener));
  let closed = false, closing = false, afterClose = null;

  const handle = {
    el,
    wrap,
    /**
     * Đóng tấm (đi qua lịch sử để nút Back và nút đóng luôn nhất quán). Gọi nhiều lần cũng chỉ lùi một bước.
     * then: việc cần làm SAU khi tấm đã đóng hẳn — mở tấm kế tiếp phải đi qua đây, nếu không bước lùi
     * đang chờ sẽ đóng nhầm tấm mới.
     */
    close(then) {
      if (typeof then === "function") afterClose = then;
      if (closed || closing) return;
      commitField(el); // ô đang gõ dở (iPhone): ghi nhận trước khi đóng
      closing = true;
      if (stack[stack.length - 1] === handle) goBack(1);
      else handle._destroy(); // tấm nằm dưới: đóng ngay; bước lịch sử của nó được trả lại khi các tấm phía trên đóng (settle)
    },
    /** Đã bấm đóng nhưng chưa đóng xong (đang chờ popstate). */
    get _closing() { return closing && !closed; },
    _destroy() {
      if (closed) return;
      if (!closing) commitField(el); // đóng bằng nút Back / vuốt: chưa qua close(), ghi nhận ô đang gõ dở ở đây
      closed = true;
      const i = stack.indexOf(handle);
      if (i >= 0) stack.splice(i, 1);
      document.removeEventListener("keydown", onKey);
      if (handle._cw) { try { handle._cw.destroy(); } catch {} handle._cw = null; }
      wrap.classList.remove("is-open");
      wrap.classList.add("is-closing");
      if (!stack.length) { document.documentElement.classList.remove("has-sheet"); unlockScroll(); }
      placeToasts();
      setTimeout(() => wrap.remove(), 260);
      try { onClose && onClose(); } catch (e) { console.error(e); }
      let back = opener;
      if (back && !back.isConnected) {
        // Nút cũ đã bị vẽ lại: tìm nút tương ứng. Không còn nữa (vd. bữa ăn vừa xoá) hoặc đang bị khoá thì về khung màn hình
        // (như app.js vẫn làm sau mỗi lần vẽ lại), hoặc về tấm phía dưới — đừng để tiêu điểm rơi ra <body>.
        const list = !openerMark ? [] : openerSheet ? $$(openerMark.sel, openerSheet) : behind(openerMark.sel);
        let hit = openerMark ? list[openerMark.i] || list[0] || null : null;
        if (hit && hit.disabled) hit = null;
        back = openerSheet ? (openerSheet.isConnected ? hit || openerSheet : null) : hit || $("main[tabindex]");
      }
      if (back && typeof back.focus === "function" && !back.disabled) back.focus({ preventScroll: true });
      if (afterClose) { const fn = afterClose; afterClose = null; setTimeout(fn, 0); }
    },
  };
  // Nhớ nội dung của ô lúc bắt đầu gõ, và ghi nhận ô đang gõ dở trước khi cú chạm nào trong tấm được xử lý (xem commitField).
  // Nghe ở pha "capture" để chạy trước các bộ xử lý chạm của chính tấm.
  wrap.addEventListener("focusin", (e) => { if (isField(e.target)) typed.set(e.target, e.target.value); });
  wrap.addEventListener("change", (e) => { if (isField(e.target)) typed.set(e.target, e.target.value); });
  wrap.addEventListener("click", (e) => { if (!closed) commitField(el, e.target); }, true);
  wrap.addEventListener("click", (e) => {
    const t = e.target.closest("[data-close-sheet]");
    if (!t) return;
    if (t.classList.contains("scrim") && !dismissable) return;
    handle.close();
  });
  // Phím bấm nghe ở document chứ không ở tấm: sau khi nội dung tấm được vẽ lại, tiêu điểm có thể rơi ra <body>
  // và phím Escape/Tab sẽ không còn đi qua tấm nữa. Chỉ tấm trên cùng mới phản ứng; gỡ bỏ trong _destroy().
  function onKey(e) {
    if (stack[stack.length - 1] !== handle) return;
    if (e.key === "Escape") { if (dismissable) handle.close(); else e.preventDefault(); return; }
    if (e.key !== "Tab") return;
    const items = tabbable(el);
    if (!items.length) { e.preventDefault(); el.focus({ preventScroll: true }); return; }
    const first = items[0], last = items[items.length - 1];
    const a = document.activeElement;
    const inside = el.contains(a);
    // Shift+Tab từ nút đầu, từ chính khung tấm hoặc từ ngoài tấm → nút cuối; Tab từ nút cuối hoặc từ ngoài tấm → nút đầu.
    if (e.shiftKey ? (!inside || a === el || a === first) : (!inside || a === last)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
  }
  document.addEventListener("keydown", onKey);
  // Chrome Android 126+: nút Back báo qua CloseWatcher, kể cả với tấm tự mở khi chưa có lần chạm nào
  // (lúc đó trình duyệt bỏ qua bước lịch sử của tấm và Back sẽ thoát luôn app). Bước lịch sử vẫn giữ cho các trình duyệt khác.
  function watch() {
    if (closed || typeof CloseWatcher !== "function") return;
    try {
      const cw = new CloseWatcher();
      cw.onclose = () => {
        if (closed || handle._cw !== cw) return;
        handle._cw = null;
        if (stack[stack.length - 1] === handle) handle.close();
        else setTimeout(watch, 0); // bị gộp chung một lần Back với tấm nằm trên: chỉ tấm trên cùng đóng, tấm này canh tiếp
      };
      handle._cw = cw;
    } catch {}
  }

  document.body.appendChild(wrap);
  if (!stack.length) lockScroll();
  document.documentElement.classList.add("has-sheet");
  stack.push(handle);
  placeToasts();
  handle._depth = depthNow() + 1;
  history.pushState({ nkcSheet: handle._depth }, "");
  lastDepth = handle._depth;
  watch();
  requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add("is-open")));
  try { onMount && onMount(el); } catch (e) { console.error(e); }
  // onMount có thể đã đặt tiêu điểm vào một ô nhập (để bàn phím hiện lên): đừng giật lại.
  if (!el.contains(document.activeElement)) el.focus({ preventScroll: true });
  return handle;
}
window.addEventListener("popstate", () => {
  const depth = depthNow();
  if (bootBack) {
    // Bước lùi dọn dẹp lúc mở app vừa tới. Tấm nào kịp mở trong lúc chờ thì giữ nguyên, chỉ cấp lại bước lịch sử cho nó.
    bootBack = false; flying = 0; clearTimeout(flyTimer);
    let d = depth;
    for (const h of stack) { h._depth = ++d; history.pushState({ nkcSheet: d }, ""); }
    lastDepth = d;
    return;
  }
  flying = Math.max(0, flying - Math.max(0, lastDepth - depth));
  lastDepth = depth;
  // Đi theo độ sâu của lịch sử chứ không phải "tấm trên cùng": tấm nào không còn bước lịch sử thì đóng,
  // và tấm nào đã bấm đóng mà còn sót lại cũng đóng nốt (nếu không nó sẽ kẹt, không đóng được nữa).
  const doomed = stack.filter((h) => h._depth > depth || h._closing);
  for (let i = doomed.length - 1; i >= 0; i--) doomed[i]._destroy();
  settle();
});
export const sheetOpen = () => stack.length > 0;
/** Có tấm nào đang đóng dở (đã gọi history.back() nhưng popstate chưa tới) không. Lúc đó chưa nên mở tấm mới. */
export const sheetBusy = () => flying > 0;
export function closeAllSheets() {
  while (stack.length) stack[stack.length - 1]._destroy();
  // trả lại các bước lịch sử mà những tấm vừa đóng đã thêm vào, để nút Back không phải bấm "hụt"
  settle();
}

/* ---------------- thông báo nhỏ (toast) ---------------- */
let toastTimer = null;
let toastNow = null; // thông báo đang hiện (đồng hồ ẩn chỉ thuộc về nó)
let toastHide = null; // hàm ẩn của thông báo đang hiện
/**
 * Gỡ thông báo đang hiện nếu nó mang đúng nhãn này. Ví dụ: thông báo "Có một bữa chưa tính được calo · Xem"
 * không còn cần nữa khi người dùng đã mở chính bữa đó ra — để nó nằm đè lên tấm vừa mở chỉ thêm rối.
 */
export function dropToast(tag) {
  if (tag && toastNow && toastNow.dataset.tag === tag && toastHide) toastHide();
}
/** Vùng đọc thông báo cho trình đọc màn hình. Phải có sẵn TRƯỚC khi chèn lời đầu tiên thì lời đó mới được đọc lên. */
function toastHost() {
  let host = $("#toasts");
  if (!host) { host = document.createElement("div"); host.id = "toasts"; host.setAttribute("role", "status"); host.setAttribute("aria-live", "polite"); document.body.appendChild(host); placeToasts(); }
  return host;
}
/* Khi có tấm trượt, thông báo hiện cách mép trên 72px (parts.css). Hộp chúc mừng (tấm 'center') lại nằm giữa màn hình và trên
   máy nhỏ mép trên của nó ở ngay tầm đó, nên thông báo che mất hình trong hộp suốt 10 giây. Khi tấm trên cùng là hộp giữa
   màn hình thì đưa thông báo lên sát mép trên, vào khoảng trống phía trên hộp; thời gian hiện (và nút "Hoàn tác") giữ nguyên. */
function placeToasts() {
  // Tấm toàn màn hình (Cài đặt) có hàng tiêu đề dính ở mép trên: parts.css đẩy thông báo xuống dưới hàng đó nhờ lớp này.
  document.documentElement.classList.toggle("has-full-sheet", stack.some((h) => h.wrap.classList.contains("full")));
  const top = stack[stack.length - 1];
  // Tấm trượt từ dưới lên (bữa ăn, gõ tên món, cân nặng) có nút đóng ở góc trên bên phải, đúng tầm thông báo hiện ra:
  // parts.css chừa cột bên phải nhờ lớp này, để thông báo (và nút "Xem"/"Hoàn tác" của nó) không đè lên nút đóng.
  document.documentElement.classList.toggle("has-bottom-sheet", !!top && !top.wrap.classList.contains("full") && !top.wrap.classList.contains("center"));
  const host = $("#toasts");
  if (!host) return;
  host.style.top = top && top.wrap.classList.contains("center") ? "calc(env(safe-area-inset-top, 0px) + 8px)" : "";
}
if (document.body) toastHost(); // index.html đã có sẵn #toasts thì dùng lại; chưa có thì tạo ngay lúc mở app
/**
 * @param {string} text
 * @param {{label:string, fn:()=>void}} [action]  nút bấm kèm theo (vd. "Hoàn tác")
 * @param {number} [ms]  thời gian hiện; mặc định có nút bấm thì 10 giây, không nút thì 3,2 giây và dài dần theo số chữ (tối đa 9 giây)
 * @param {string} [tag]  nhãn để nơi khác gỡ đúng thông báo này khi nó hết ý nghĩa (xem dropToast)
 * @param {{hidden?:boolean}} [opts]  hidden: chỉ đọc lên cho trình đọc màn hình, không hiện ra (dùng khi điều vừa xảy ra đã thấy ngay trên màn hình)
 */
export function toast(text, action, ms, tag, opts) {
  const host = toastHost();
  const quiet = !!(opts && opts.hidden);
  // Lời chỉ-để-đọc không được xoá một thông báo đang hiện có nút bấm ("Hoàn tác", "Xem"…): chèn thêm rồi tự gỡ, không đụng tới đồng hồ của nó.
  if (quiet) {
    const q = document.createElement("div");
    q.className = "toast is-sr";
    q.textContent = String(text || "");
    host.appendChild(q);
    setTimeout(() => q.remove(), 4000);
    return;
  }
  host.innerHTML = "";
  const t = document.createElement("div");
  t.className = "toast";
  if (tag) t.dataset.tag = tag;
  const span = document.createElement("span");
  span.textContent = text;
  t.appendChild(span);
  if (action) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "toast-act"; b.textContent = action.label;
    b.addEventListener("click", () => {
      // Nút sắp biến mất cùng thông báo: đưa tiêu điểm về tấm đang mở (hoặc màn hình) trước, kẻo nó rơi ra <body>.
      if (document.activeElement === b) {
        const top = stack[stack.length - 1];
        const home = top ? top.el : $("main[tabindex]");
        if (home) home.focus({ preventScroll: true });
      }
      hide();
      try { action.fn(); } catch (e) { console.error(e); }
    });
    t.appendChild(b);
  }
  host.appendChild(t);
  requestAnimationFrame(() => t.classList.add("is-in"));
  clearTimeout(toastTimer);
  toastNow = t;
  toastHide = hide;
  function hide() {
    if (toastNow === t) { clearTimeout(toastTimer); toastNow = null; toastHide = null; }
    t.classList.remove("is-in");
    setTimeout(() => t.remove(), 220);
  }
  // Đồng hồ dừng khi ngón tay/chuột đang ở trên thông báo hoặc tiêu điểm đang ở nút của nó, để kịp bấm "Hoàn tác".
  // Không nút bấm: lời càng dài càng cần thêm thời gian đọc (khoảng 60 ms mỗi chữ cái), ngắn thì vẫn 3,2 giây.
  let left = ms || (action ? 10000 : Math.min(9000, Math.max(3200, 1800 + String(text || "").length * 60))), since = 0, over = false, inside = false, held = false;
  function sync() {
    if (toastNow !== t) return; // đã ẩn hoặc đã có thông báo khác thay thế
    const hold = over || inside;
    if (hold && !held) { held = true; clearTimeout(toastTimer); left = Math.max(1500, left - (Date.now() - since)); }
    else if (!hold && (held || !since)) { held = false; since = Date.now(); clearTimeout(toastTimer); toastTimer = setTimeout(hide, left); }
  }
  t.addEventListener("pointerenter", () => { over = true; sync(); });
  t.addEventListener("pointerleave", () => { over = false; sync(); });
  t.addEventListener("pointercancel", () => { over = false; sync(); });
  t.addEventListener("focusin", () => { inside = true; sync(); });
  t.addEventListener("focusout", () => { inside = false; sync(); });
  sync();
}

/* ---------------- chia sẻ, lưu file ---------------- */
/** @returns {Promise<'shared'|'copied'|'cancel'|'fail'>} */
export async function shareText(text) {
  if (navigator.share) {
    try { await navigator.share({ text }); return "shared"; }
    catch (e) { if (e && e.name === "AbortError") return "cancel"; }
  }
  try { await navigator.clipboard.writeText(text); return "copied"; } catch { return "fail"; }
}
/**
 * Trên điện thoại: mở bảng chia sẻ để lưu vào Tệp/Drive/Zalo. Trên máy tính: tải xuống.
 * Hàm gọi navigator.share() ngay trong lượt chạy đầu tiên (không chờ gì trước đó), nên hãy gọi nó thẳng từ cú chạm.
 * "retry": iPhone từ chối mở bảng chia sẻ (thường vì cú chạm đã "nguội" sau khi tạo file quá lâu). Ở iPhone liên kết
 * tải xuống chỉ mở bản xem trước chứ không lưu, nên KHÔNG dùng lối đó; nơi gọi giữ lại nội dung và mời chạm lần nữa.
 * @returns {Promise<'shared'|'cancel'|'retry'|'downloaded'>}
 */
export async function saveFile(name, text, mime = "application/json") {
  const file = new File([text], name, { type: mime });
  const touch = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  if (touch && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return "shared"; }
    catch (e) {
      if (e && e.name === "AbortError") return "cancel";
      if (isIOS()) return "retry";
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(file);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 15000);
  return "downloaded";
}
export function readTextFile(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result || "")); r.onerror = () => rej(r.error); r.readAsText(file); });
}

/* ---------------- cài lên màn hình chính ---------------- */
let installEvent = null;
const installWatchers = new Set();
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvent = e; installWatchers.forEach((fn) => fn()); });
window.addEventListener("appinstalled", () => { installEvent = null; installWatchers.forEach((fn) => fn()); });
export const onInstallChange = (fn) => installWatchers.add(fn);
export const canPromptInstall = () => !!installEvent;
export async function promptInstall() {
  if (!installEvent) return false;
  const e = installEvent;
  installEvent = null;
  e.prompt();
  try { const r = await e.userChoice; return r && r.outcome === "accepted"; } catch { return false; }
}
export const isStandalone = () => (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
