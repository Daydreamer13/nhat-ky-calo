// sheets.js — các tấm trượt: chi tiết bữa ăn (đang nhận diện / lỗi / kết quả), gõ tên món, ghi cân nặng, chúc mừng.

import { S, ctx, on, openGift, giftById, findMeal, dayAt, updateMeal, deleteMeal, retryMeal, stopJob, jobOf, togglePin, isPinned, addTextMeal, addReadyMeal, logWeight, removeWeight, addExercise, removeExercise, photoUrl, cachedPhoto, frequent } from "../state.js";
import * as L from "../logic.js";
import * as W from "../words.js";
import { EXERCISES } from "../exercises.js";
import { html, raw, $, $$, setHtml, openSheet, toast, dropToast, shareText, buzz, withFocus, sheetBusy } from "../ui.js";
import { icon, plantSvg, badgeArt, giftArt, scanArt } from "../art.js";
import { aiErrorText } from "../ai.js";
import { confetti } from "../confetti.js";
import { themeColors } from "./onboarding.js";

const P = (b) => (b ? "true" : "false");
const you = () => S.settings.pronoun || "bạn";

/* ================================================================== *
 * Tấm bữa ăn
 * ================================================================== */
let ms = null; // { sheet, key, id, mode, hintOpen, addOpen }
const modeOf = (m) => (m.pending ? "pending" : m.failed ? "failed" : "ready");

function photoBlock(m) {
  if (!m.ph) return html`<header class="sheet-head"><h2 class="sheet-title">${m.pending ? "Đang tính calo" : m.failed ? "Chưa tính được" : "Chi tiết bữa ăn"}</h2><button class="icon-btn" data-close-sheet aria-label="Đóng">${raw(icon("x"))}</button></header>`;
  const src = cachedPhoto(m.ph);
  return html`<div class="ms-photo ${m.pending ? "is-scanning" : ""}" data-photo-slot>
    <img data-ph="${m.ph}" ${src ? raw(`src="${src}"`) : ""} alt="Ảnh bữa ăn">
    ${m.pending ? raw(scanArt()) : ""}
    ${!m.pending && !m.failed && m.conf ? confChip(m.conf) : ""}
    <button class="icon-btn on-photo" data-close-sheet aria-label="Đóng">${raw(icon("x"))}</button>
  </div>`;
}
/** Độ chắc của ước tính: ba chiếc lá (khá chắc 3, tương đối 2, chưa chắc 1). */
function confChip(conf) {
  const n = conf === "high" ? 3 : conf === "low" ? 1 : 2;
  return html`<span class="ms-conf"><span class="conf-meter" aria-hidden="true">${[1, 2, 3].map((i) => html`<i class="${i <= n ? "is-on" : ""}"></i>`)}</span>${W.CONFIDENCE[conf]}</span>`;
}

function partialBlock(id) {
  const p = jobOf(id)?.partial || { name: "", items: [] };
  return html`<div data-part="partial">
    ${p.name ? html`<p class="ms-found">${p.name}</p>` : ""}
    ${p.items.length ? html`<div class="tags">${p.items.map((n) => html`<span class="tag found">${raw(icon("check"))}<span>${n}</span></span>`)}</div>` : ""}
  </div>`;
}
function pendingBody(m) {
  return html`<div class="ms-main">
    <div class="ms-wait" role="status" aria-atomic="false">
      ${m.ph ? html`<h2 class="ms-title">Đang nhìn món ăn…</h2>` : html`<p class="ms-quote">“${m.hint || m.name}”</p>`}
      ${partialBlock(m.id)}
      <p class="sub">Không cần chờ: ${you()} cứ đóng lại, app tự ghi vào nhật ký khi xong.</p>
    </div>
    <div class="ms-actions">
      <button class="btn primary block" data-close-sheet>Đóng, để app tự ghi</button>
      <button class="btn ghost block" data-ms="stop">Dừng lại</button>
    </div>
  </div>`;
}

const NEED_SETTINGS = ["no_key", "bad_key", "billing", "spend_cap", "model", "forbidden"];
const NEED_HINT = ["not_food", "refused", "photo", "too_large", "bad_request"];
function failedBody(m) {
  const code = m.failed;
  const needSet = NEED_SETTINGS.includes(code);
  const tech = aiErrorText(code, you(), !!m.ph);
  const detail = m.detail && !["no_key", "offline", "aborted", "not_food"].includes(code) ? m.detail : "";
  // Lỗi về khoá/tài khoản là việc của người cài app: người dùng hằng ngày chỉ cần biết nên nhờ ai và vẫn ghi tay được.
  // Câu kỹ thuật và chi tiết từ máy chủ không bỏ đi, chỉ gấp lại ở cuối tấm.
  // Chưa có khoá thì "Thử lại" chỉ có thể hỏng lần nữa: ẩn đi. Đã có khoá thì phải có nút — bữa hỏng vì "no_key" không được tự thử lại.
  const noKeyYet = code === "no_key" && !S.settings.apiKey;
  // Chưa kết nối / mất mạng: lối đi tiếp duy nhất lúc này là ghi tay, nên mở sẵn phần đó.
  const manualOpen = code === "no_key" || code === "offline";
  const plain = `App chưa tự tính calo được. ${cap(you())} nhờ ${S.settings.partner || "người cài app"} xem giúp phần Kết nối trong Cài đặt, hoặc nhập bữa này bằng tay.`;
  return html`<div class="ms-main">
    <div class="banner warn">
      <p>${needSet ? plain : tech}</p>
    </div>
    <div class="stack">
      ${NEED_SETTINGS.includes(code)
        ? html`<button class="btn primary block" data-ms="settings">Mở Cài đặt kết nối</button>${noKeyYet ? "" : html`<button class="btn soft block" data-ms="retry">Thử lại</button>`}`
        : NEED_HINT.includes(code)
          ? html`<label class="field"><span class="field-label">Gõ tên món để app tính theo mô tả</span>
              <input class="input" id="msHint" type="text" maxlength="300" value="${m.hint || ""}" placeholder="Ví dụ: 1 tô bún bò, tô vừa" autocomplete="off" enterkeyhint="go"></label>
            <button class="btn primary block" data-ms="rehint">Tính lại</button>`
          : html`<button class="btn primary block" data-ms="retry">Thử lại</button>`}
      <details class="fold" ${manualOpen ? raw("open") : ""}>
        <summary>Tự nhập số calo</summary>
        <div class="stack">
          <div class="grid2 wide-first">
            <label class="field"><span class="field-label">Món ăn</span><input class="input" id="msManName" type="text" maxlength="120" value="${m.src === "text" ? (m.hint || m.name).slice(0, 120) : ""}" placeholder="Tên món" autocomplete="off"></label>
            <label class="field"><span class="field-label">kcal</span><input class="input" id="msManKcal" type="text" inputmode="numeric" maxlength="5" placeholder="0" autocomplete="off" enterkeyhint="done"></label>
          </div>
          <button class="btn soft block" data-ms="manual">Ghi bằng tay</button>
        </div>
      </details>
      ${needSet || detail
        ? html`<details class="fold ms-tech">
            <summary>Thông tin cho người cài đặt</summary>
            <div class="stack">
              ${needSet ? html`<p class="fine">${tech}</p>` : ""}
              ${detail ? html`<p class="fine">Chi tiết: ${detail}</p>` : ""}
            </div>
          </details>`
        : ""}
      <button class="btn ghost block danger" data-ms="del">Xoá bữa này</button>
    </div>
  </div>`;
}

function itemsBlock(m) {
  const steps = L.PORTION_STEPS;
  return html`<ul class="ms-items" data-part="items" aria-label="Các món trong bữa">
    ${m.items.map((it, i) => {
      const tot = L.itemTotals(it);
      const x = it.x ?? 1;
      const at = steps.indexOf(steps.reduce((best, s) => (Math.abs(s - x) < Math.abs(best - x) ? s : best), steps[0]));
      const prev = at > 0 ? L.portionLabel(steps[at - 1]) : "";
      const next = at < steps.length - 1 ? L.portionLabel(steps[at + 1]) : "";
      return html`<li class="ms-item">
        <div class="ms-item-head">
          <div class="ms-item-title"><b>${it.n}</b>${it.q ? html`<small>${it.q}</small>` : ""}</div>
          <label class="ms-kcal"><input class="num" type="text" inputmode="numeric" maxlength="5" value="${tot.kcal}" data-kcal="${i}" aria-label="Số kcal của ${it.n}"><span>kcal</span></label>
        </div>
        <div class="ms-item-foot">
          <div class="stepper" role="group" aria-label="Khẩu phần ${it.n}">
            <button type="button" class="stepper__btn" data-ms="step:${i}:-1" aria-label="Bớt khẩu phần" ${prev ? "" : raw("disabled")}>${raw(icon("minus"))}</button>
            <button type="button" class="stepper__val" data-ms="step:${i}:-1" tabindex="-1" aria-hidden="true">${prev}</button>
            <span class="stepper__val is-on" aria-label="Khẩu phần hiện tại ${L.portionLabel(x)}">${L.portionLabel(x)}</span>
            <button type="button" class="stepper__val" data-ms="step:${i}:1" tabindex="-1" aria-hidden="true">${next}</button>
            <button type="button" class="stepper__btn" data-ms="step:${i}:1" aria-label="Thêm khẩu phần" ${next ? "" : raw("disabled")}>${raw(icon("plus"))}</button>
          </div>
          <button type="button" class="btn ghost sm ms-rm" data-ms="rm:${i}" aria-label="Bỏ món ${it.n}">Bỏ món</button>
        </div>
      </li>`;
    })}
  </ul>`;
}
function totalBlock(m) {
  const t = L.mealTotals(m);
  return html`<div class="ms-detail" data-part="total">
    ${t.p || t.c || t.f ? html`<ul class="macro-dots" aria-label="Đạm, bột, béo của bữa này">
      <li style="--macro:var(--macro-p)">Đạm <b>${t.p} g</b></li>
      <li style="--macro:var(--macro-c)">Bột <b>${t.c} g</b></li>
      <li style="--macro:var(--macro-f)">Béo <b>${t.f} g</b></li>
    </ul>` : ""}
    ${m.note ? html`<p class="ms-note">${m.note}</p>` : ""}
    ${m.advice ? html`<p class="ms-advice"><b>Nhận xét</b>${m.advice}</p>` : ""}
    ${!m.ph && W.CONFIDENCE[m.conf] ? html`<p class="ms-note"><span class="pill conf-${m.conf}">Ước tính: ${W.CONFIDENCE[m.conf].toLowerCase()}</span></p>` : ""}
  </div>`;
}
function sumBlock(m, key) {
  const t = L.mealTotals(m);
  const c = ctx();
  const day = dayAt(key);
  const target = key === S.today ? c.target : L.targetForDay(day, c.target);
  const eaten = L.dayTotals(day).kcal;
  const left = target - eaten;
  const over = eaten > target * L.OVER_TOLERANCE;
  const pct = L.clamp((eaten / target) * 100, 0, 100).toFixed(1);
  const where = key === S.today ? "Hôm nay" : "Ngày này";
  return html`<p class="sum ${over ? "is-over" : ""}" data-part="sum">
    <span class="sum__total">Tổng cộng<span><b class="num">${L.fmtInt(t.kcal)}</b> kcal</span></span>
    <span class="sum__after">
      <svg viewBox="0 0 28 28" aria-hidden="true"><circle class="sum__ring" cx="14" cy="14" r="10"/><circle class="sum__ring sum__ring--fill" cx="14" cy="14" r="10" pathLength="100" stroke-dasharray="${pct} 100" transform="rotate(-90 14 14)"/></svg>
      <span>${left > 0 ? html`${where} còn <b>${L.fmtInt(left)} kcal</b>.` : over ? html`${where} vượt <b>${L.fmtInt(-left)} kcal</b>. Không sao cả.` : html`${where} vừa chạm mục tiêu.`}</span>
    </span>
  </p>`;
}
function typeBlock(m) {
  return html`<div class="seg four" role="group" aria-label="Bữa" data-part="type">
    ${L.MEAL_TYPES.map((t) => html`<button type="button" class="seg-btn" data-ms="type:${t.id}" aria-pressed="${P(m.type === t.id)}">${t.short}</button>`)}
  </div>`;
}
function pinBlock(m) {
  const pinned = isPinned(m.name);
  return html`<button type="button" class="btn ghost grow" data-ms="pin" data-part="pin" aria-pressed="${P(pinned)}">${raw(icon(pinned ? "star-fill" : "star"))}<span>${pinned ? "Đã ghim vào món hay ăn" : "Ghim vào món hay ăn"}</span></button>`;
}
function readyBody(m, key) {
  // bữa ghi bù vào ngày cũ không có giờ (t rỗng): dòng này không được mở đầu bằng dấu chấm ngăn cách
  const when = [m.t, key !== S.today ? L.longDate(key) : ""].filter(Boolean).join(" · ");
  return html`<div class="ms-main">
    <div class="ms-namebox">
      <textarea class="ms-name" id="msName" rows="1" maxlength="120" aria-label="Tên bữa ăn" autocomplete="off" enterkeyhint="done">${m.name}</textarea>
      <button type="button" class="ms-edit" data-ms="rename" aria-label="Sửa tên bữa ăn">${raw(icon("pencil"))}</button>
    </div>
    ${when ? html`<p class="sub ms-when">${when}</p>` : ""}
    ${typeBlock(m)}
    <p class="ms-head2">${m.ph ? "Món trong ảnh" : "Các món"} <span data-part="count">${m.items.length} món</span></p>
    ${itemsBlock(m)}
    ${ms && ms.addOpen
      ? html`<div class="ms-add">
          <input class="input" id="msAddName" type="text" maxlength="80" placeholder="Tên món" autocomplete="off" aria-label="Tên món thêm">
          <input class="input kg" id="msAddKcal" type="text" inputmode="numeric" maxlength="5" placeholder="kcal" autocomplete="off" aria-label="Số kcal của món thêm" enterkeyhint="done">
          <button type="button" class="btn soft sm" data-ms="additem">Thêm</button>
        </div>`
      : html`<button type="button" class="tag add" data-ms="openadd">${raw(icon("plus"))}<span>Thêm một món</span></button>`}
    ${totalBlock(m)}
    ${m.ph || m.src === "text"
      ? html`<details class="fold" ${ms && ms.hintOpen ? raw("open") : ""}>
          <summary>Chưa đúng? Mô tả thêm để tính lại</summary>
          <div class="stack">
            <input class="input" id="msHint" type="text" maxlength="300" value="${m.hint || ""}" placeholder="Ví dụ: tô lớn, thêm 1 trứng ốp la" autocomplete="off" enterkeyhint="go" aria-label="Mô tả thêm">
            <button type="button" class="btn soft block" data-ms="rehint">Tính lại</button>
          </div>
        </details>`
      : ""}
    <div class="ms-foot">
      ${sumBlock(m, key)}
      <button class="btn primary block" data-close-sheet>${raw(icon("check"))}<span>Xong</span></button>
    </div>
    <div class="row ms-more">
      ${pinBlock(m)}
      <button type="button" class="btn ghost danger" data-ms="del" aria-label="Xoá bữa này">${raw(icon("trash"))}<span>Xoá</span></button>
    </div>
  </div>`;
}

function mealView(m, key) {
  const mode = modeOf(m);
  return html`${photoBlock(m)}${mode === "pending" ? pendingBody(m) : mode === "failed" ? failedBody(m) : readyBody(m, key)}`;
}
/* Vẽ lại từng khối của tấm "kết quả" mà không gỡ phần tử nào đang nằm dưới ngón tay.
   Sửa xong một ô (kcal, tên) rồi chạm ngay vào nút khác: ô mất tiêu điểm → "change" → vẽ lại, tất cả xảy ra GIỮA mousedown
   và click của cú chạm đó. Nếu nút bị thay bằng outerHTML thì trình duyệt không còn nơi để gửi click, cú chạm bị nuốt mất.
   Vì vậy: (1) nhớ HTML đã vẽ của từng khối, khối nào không đổi thì không đụng tới; (2) khối có đổi thì chỉnh ngay tại chỗ
   (thuộc tính, chữ), chỉ dựng lại nhánh con nào khác hẳn khung. */
const PARTS = { items: itemsBlock, total: totalBlock, sum: sumBlock, type: typeBlock, pin: pinBlock };
function remember(m) {
  ms.last = {};
  if (modeOf(m) === "ready") for (const part in PARTS) ms.last[part] = PARTS[part](m, ms.key).s;
}
/** Đưa phần tử a (đang trên trang) về giống b (vừa dựng từ HTML mới, cùng loại thẻ) mà vẫn giữ nguyên chính a. */
function syncNode(a, b) {
  const isInput = a.tagName === "INPUT";
  const untouched = isInput && a.value === (a.getAttribute("value") || ""); // người dùng chưa gõ gì khác so với lần vẽ trước
  for (const at of [...a.attributes]) if (!b.hasAttribute(at.name)) a.removeAttribute(at.name);
  for (const at of [...b.attributes]) if (a.getAttribute(at.name) !== at.value) a.setAttribute(at.name, at.value);
  if (isInput) {
    // ô đang gõ dở thì để yên; các ô khác hiện đúng số trong dữ liệu
    const v = b.getAttribute("value") || "";
    if ((a !== document.activeElement || untouched) && a.value !== v) a.value = v;
    return;
  }
  const ac = a.childNodes, bc = b.childNodes;
  let same = ac.length === bc.length;
  for (let i = 0; same && i < ac.length; i++) same = ac[i].nodeType === bc[i].nodeType && (ac[i].nodeType !== 1 || ac[i].tagName === bc[i].tagName);
  if (!same) { a.innerHTML = b.innerHTML; return; }
  for (let i = 0; i < ac.length; i++) {
    if (ac[i].nodeType === 1) syncNode(ac[i], bc[i]);
    else if (ac[i].nodeValue !== bc[i].nodeValue) ac[i].nodeValue = bc[i].nodeValue;
  }
}
function morph(node, s) {
  const t = document.createElement("template");
  t.innerHTML = s;
  const next = t.content.firstElementChild;
  if (!next || next.tagName !== node.tagName) { node.outerHTML = s; return; }
  syncNode(node, next);
}
/** Tên bữa ăn dài thì xuống dòng (tối đa 3 dòng) thay vì bị cắt bằng dấu ba chấm. */
function fitName(root) {
  const n = root && $("#msName", root);
  if (!n) return;
  const cs = getComputedStyle(n);
  const line = parseFloat(cs.lineHeight) || (parseFloat(cs.fontSize) || 25) * 1.3;
  const pad = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
  const max = Math.ceil(line * 3 + pad);
  // Đo với height: auto làm ô co về một dòng trong chốc lát: tấm ngắn lại, trình duyệt kéo vị trí cuộn lên theo, và nút đang
  // nằm dưới ngón tay (Ghim, Xoá, Xong ở cuối tấm) trượt đi mất → cú chạm bị nuốt. Nhớ vị trí cuộn rồi trả lại ngay trong lượt này.
  const sc = n.closest(".sheet");
  const y = sc ? sc.scrollTop : 0;
  n.style.height = "auto";
  const h = n.scrollHeight;
  n.style.height = Math.min(h, max) + "px";
  n.style.overflowY = h > max + 1 ? "auto" : "hidden";
  if (sc && sc.scrollTop !== y) sc.scrollTop = y;
}
function paintMeal(full) {
  if (!ms || !ms.sheet) return;
  // withFocus: vẽ lại xong, tiêu điểm trở về đúng nút cũ (hoặc về tấm), không rơi ra <body> làm Escape/Tab hết tác dụng
  withFocus(ms.sheet.el, () => paintMealNow(full));
}
function paintMealNow(full) {
  const el = ms.sheet.el;
  const m = findMeal(ms.key, ms.id);
  if (!m) { ms.sheet.close(); return; }
  const mode = modeOf(m);
  if (full || mode !== ms.mode) {
    ms.mode = mode;
    setHtml(el, mealView(m, ms.key));
    remember(m);
    hydrate(el);
    fitName(el);
    return;
  }
  if (mode === "pending") { const p = $('[data-part="partial"]', el); if (p) p.outerHTML = partialBlock(m.id).s; return; }
  if (mode === "ready") {
    const swap = (part) => {
      const s = PARTS[part](m, ms.key).s;
      if (ms.last[part] === s) return;
      const n = $(`[data-part="${part}"]`, el);
      if (!n) return;
      morph(n, s);
      ms.last[part] = s;
    };
    swap("items");
    swap("total");
    swap("sum");
    swap("type");
    const cnt = $('[data-part="count"]', el);
    if (cnt && cnt.textContent !== `${m.items.length} món`) cnt.textContent = `${m.items.length} món`;
    swap("pin");
    // nút vừa bị khoá (ví dụ đã tới khẩu phần lớn nhất) không giữ tiêu điểm được: đưa về tấm
    const a = document.activeElement;
    if (a && a.disabled && el.contains(a)) el.focus({ preventScroll: true });
  }
}
function hydrate(root) {
  for (const img of $$("img[data-ph]", root)) {
    if (img.getAttribute("src")) continue;
    photoUrl(img.dataset.ph).then((url) => { if (url && img.isConnected) img.src = url; });
  }
}

function manualSave(m) {
  const name = $("#msManName", ms.sheet.el).value.trim();
  const kcal = L.parseKcal($("#msManKcal", ms.sheet.el).value);
  if (!name) { toast("Nhập tên món."); $("#msManName", ms.sheet.el).focus(); return; }
  if (kcal === null || kcal < 1 || kcal > 5000) { toast("Nhập số kcal từ 1 đến 5.000."); $("#msManKcal", ms.sheet.el).focus(); return; }
  updateMeal(ms.key, ms.id, (x) => {
    x.name = name; x.nameEdited = true;
    x.items = [{ n: name, q: "", k: Math.round(kcal), p: 0, c: 0, f: 0, x: 1 }];
    delete x.failed; delete x.detail; delete x.pending; delete x.conf; delete x.note; delete x.advice;
  });
  toast(`Đã ghi ${L.fmtInt(kcal)} kcal.`);
}

/** Đọc hàng "Thêm một món". state: "none" (không có hàng hoặc chưa gõ gì), "name" (thiếu tên), "kcal" (thiếu hoặc sai số kcal), "ok". */
function readAddRow(el) {
  const n = $("#msAddName", el), k = $("#msAddKcal", el);
  if (!n || !k) return { state: "none" };
  const name = n.value.trim();
  const typed = k.value.trim();
  if (!name) return { state: typed ? "name" : "none" };
  const kcal = L.parseKcal(typed);
  if (kcal === null || kcal > 5000) return { state: "kcal" };
  return { state: "ok", name: name.slice(0, 80), kcal };
}
const rowItem = (r) => ({ n: r.name, q: "", k: r.kcal, p: 0, c: 0, f: 0, x: 1 });
/**
 * Ghi món đang gõ ở hàng "Thêm một món" vào bữa đang mở. Trả về true khi đã thêm; còn thiếu/sai thì nhắc, đưa tiêu điểm
 * vào ô cần sửa và trả về false.
 * @param {boolean} [sayName] nhắc cả khi thiếu tên (nút "Xong"); nút "Thêm" nhỏ chỉ lặng lẽ đưa tiêu điểm về ô tên như trước
 */
function addFromRow(sayName) {
  const el = ms.sheet.el;
  const { key, id } = ms;
  const m = findMeal(key, id);
  if (!m) return false;
  const r = readAddRow(el);
  if (r.state === "none" || r.state === "name") { if (sayName && r.state === "name") toast("Nhập tên món."); $("#msAddName", el)?.focus(); return false; }
  if (r.state === "kcal") { toast("Nhập số kcal của món."); $("#msAddKcal", el)?.focus(); return false; }
  if (m.items.length >= 12) { toast("Mỗi bữa ghi được nhiều nhất 12 món."); return false; }
  ms.addOpen = false;
  updateMeal(key, id, (x) => { x.items.push(rowItem(r)); });
  paintMeal(true);
  return true;
}

function onMealClick(e) {
  if (!ms) return;
  // Nút "Xong" lớn nằm ngay dưới hàng "Thêm một món" nên trông như nút xác nhận cho hàng đó: món đang gõ không được lặng lẽ
  // biến mất. Gõ đủ tên và kcal → thêm món rồi tấm đóng như thường; còn thiếu → giữ tấm lại và nhắc (tấm được đóng bởi bộ nghe
  // ở lớp bọc ngoài trong ui.js, chạy sau bộ nghe này). Hàng còn trống thì đóng như trước.
  if (ms.addOpen && e.target.closest(".ms-foot [data-close-sheet]")) {
    if (readAddRow(ms.sheet.el).state !== "none" && !addFromRow(true)) e.stopPropagation();
    return;
  }
  const b = e.target.closest("[data-ms]");
  if (!b) return;
  const m = findMeal(ms.key, ms.id);
  if (!m) return;
  const [act, a1, a2] = b.dataset.ms.split(":");
  const { key, id } = ms;
  switch (act) {
    case "stop": stopJob(id); break;
    case "rename": { const n = $("#msName", ms.sheet.el); if (n) { n.focus(); n.select(); } break; }
    case "retry": {
      retryMeal(key, id);
      // Chưa có mạng / chưa kết nối thì lần thử lại hỏng ngay tức thì, tấm trông y như cũ: nói rõ để nút không có vẻ "chết".
      const still = findMeal(key, id)?.failed;
      if (still === "offline") toast("Máy vẫn chưa có mạng. Bật Wi-Fi hoặc 4G rồi thử lại nhé.");
      else if (still === "no_key") toast("App vẫn chưa được kết nối với Claude nên chưa tự tính được.");
      break;
    }
    case "rehint": {
      const hint = ($("#msHint", ms.sheet.el)?.value || "").trim();
      if (!hint && !m.ph) { toast("Gõ tên món để app tính."); return; }
      ms.hintOpen = false;
      retryMeal(key, id, hint);
      break;
    }
    case "settings": ms.sheet.close(() => document.dispatchEvent(new CustomEvent("nkc:settings", { detail: "ai" }))); break;
    case "manual": manualSave(m); break;
    case "del": {
      const undo = deleteMeal(key, id);
      ms.sheet.close();
      toast("Đã xoá bữa ăn.", undo ? { label: "Hoàn tác", fn: undo } : undefined);
      break;
    }
    case "type": updateMeal(key, id, (x) => { x.type = a1; x.typeEdited = true; }); break;
    case "step": buzz(); updateMeal(key, id, (x) => { const it = x.items[Number(a1)]; if (it) it.x = L.stepPortion(it.x ?? 1, Number(a2)); }); break;
    case "rm":
      if (m.items.length <= 1) { toast("Bữa ăn cần ít nhất một món. Muốn bỏ cả bữa thì bấm Xoá."); return; }
      updateMeal(key, id, (x) => { x.items.splice(Number(a1), 1); });
      break;
    case "openadd": ms.addOpen = true; paintMeal(true); $("#msAddName", ms.sheet.el)?.focus(); break;
    case "additem": addFromRow(false); break;
    case "pin": {
      const nowPinned = togglePin(m);
      toast(nowPinned ? "Đã ghim. Lần sau chỉ cần một chạm ở “Món hay ăn”." : "Đã bỏ ghim.");
      break;
    }
  }
}
function onMealChange(e) {
  if (!ms) return;
  const t = e.target;
  const { key, id } = ms;
  if (t.id === "msName") {
    const v = t.value.replace(/\s+/g, " ").trim(); // chữ dán vào có thể kèm dấu xuống dòng
    if (v) { t.value = v.slice(0, 120); updateMeal(key, id, (x) => { x.name = v.slice(0, 120); x.nameEdited = true; }); }
    else t.value = findMeal(key, id)?.name || "";
    fitName(ms.sheet.el);
    t.scrollTop = 0; // tên dài hơn 3 dòng: gõ xong thì hiện lại từ dòng đầu
  } else if (t.dataset.kcal !== undefined) {
    const i = Number(t.dataset.kcal);
    const v = L.parseKcal(t.value);
    const cur = findMeal(key, id)?.items[i];
    if (!cur) { paintMeal(true); return; }
    // Không vẽ lại cả tấm ở đây (xem paintMeal): cú chạm vừa làm ô này mất tiêu điểm có thể đang rơi vào "Xong", +/−, "Bỏ món"…
    // Số trong ô đúng bằng số đang hiện thì không có gì để ghi: (iPhone) ô còn giữ tiêu điểm sau khi bấm +/− mang con số do
    // chính app viết vào, coi nó là "vừa gõ" sẽ gộp khẩu phần vào kcal trước mỗi lần +/− tiếp theo.
    if (v !== null && v >= 0 && v <= 5000 && Math.round(v) !== L.itemTotals(cur).kcal) {
      updateMeal(key, id, (x) => {
        // Số vừa gõ là tổng của món này: ghi đúng số đó. Khẩu phần đang nhân (½, 1½, 2…) được gộp luôn vào kcal và đạm/bột/béo
        // rồi trả về 1, nên không còn chuyện gõ 100 mà hiện 101, và các lần +/− sau tính từ chính số vừa gõ.
        const it = x.items[i];
        const mult = it.x ?? 1;
        if (mult !== 1) {
          const g = (n) => Math.round((Number(n) || 0) * mult * 10) / 10;
          it.p = g(it.p); it.c = g(it.c); it.f = g(it.f);
        }
        it.k = Math.round(v);
        it.x = 1;
      });
    }
    const now = findMeal(key, id)?.items[i];
    if (now) t.value = String(L.itemTotals(now).kcal); // số không hợp lệ thì trả về số đang có
  }
}
function onMealKey(e) {
  if (e.key !== "Enter" || !ms) return;
  const tag = e.target.tagName;
  if (tag !== "INPUT" && !(tag === "TEXTAREA" && e.target.id === "msName")) return; // tên bữa ăn là textarea: Enter để xong, không xuống dòng
  e.preventDefault();
  const id = e.target.id;
  if (id === "msHint") $('[data-ms="rehint"]', ms.sheet.el)?.click();
  else if (id === "msAddKcal") $('[data-ms="additem"]', ms.sheet.el)?.click();
  else if (id === "msAddName") $("#msAddKcal", ms.sheet.el)?.focus();
  else if (id === "msManKcal") $('[data-ms="manual"]', ms.sheet.el)?.click();
  else if (id === "msManName") $("#msManKcal", ms.sheet.el)?.focus();
  else ms.sheet.el.focus({ preventScroll: true }); // rời ô (ghi nhận số/tên vừa gõ) nhưng tiêu điểm vẫn ở trong tấm, không rơi ra <body>
}

/** Hàng "Thêm một món" của tấm, nếu đang mở (đọc TRƯỚC khi tấm rời bữa đang hiện): xem readAddRow. */
const addRowOf = (state) => (state.addOpen && state.sheet ? readAddRow(state.sheet.el) : null);
/** Hàng ấy đã gõ đủ tên và số kcal: ghi món vào bữa (key, id) và báo một câu. Thiếu một trong hai, hay bữa đã đủ 12 món, thì bỏ. */
function saveAddRow(key, id, row) {
  if (!row || row.state !== "ok") return;
  const cur = findMeal(key, id);
  if (!cur || modeOf(cur) !== "ready" || cur.items.length >= 12) return;
  updateMeal(key, id, (x) => { x.items.push(rowItem(row)); });
  toast(`Đã thêm ${row.name} · ${L.fmtInt(row.kcal)} kcal.`);
}
export function openMeal(key, id) {
  const m = findMeal(key, id);
  if (!m) return;
  dropToast("meal:" + id); // thông báo "… · Xem" về chính bữa này đã xong việc
  if (ms) {
    // Đang mở một bữa khác: đổi nội dung ngay trong tấm hiện có, không đóng/mở lại.
    if (ms.key !== key || ms.id !== id) {
      // Ô đang sửa dở trong tấm (số kcal, tên bữa) phải được ghi cho bữa ĐANG hiện trước khi tấm chuyển sang bữa khác: rút tiêu điểm
      // khỏi ô để trình duyệt báo "change" ngay lúc này — để ô tự mất khi tấm vẽ lại thì thay đổi ấy rơi nhầm vào bữa mới.
      const el = ms.sheet && ms.sheet.el;
      const a = document.activeElement;
      if (el && a && a !== el && el.contains(a)) el.focus({ preventScroll: true });
      // Hàng "Thêm một món" đã gõ đủ: ghi món đó cho bữa đang hiện, như khi đóng tấm.
      const row = addRowOf(ms);
      const from = { key: ms.key, id: ms.id };
      ms.addOpen = false;
      saveAddRow(from.key, from.id, row);
      Object.assign(ms, { key, id, hintOpen: false, addOpen: false });
      paintMeal(true);
    }
    return;
  }
  const state = { key, id, mode: modeOf(m), hintOpen: false, addOpen: false, sheet: null, last: {} };
  ms = state;
  remember(m);
  state.sheet = openSheet({
    label: "Bữa ăn",
    kind: "mealsheet", // không dùng tên "meal": lớp .meal của thẻ bữa ăn ở màn Hôm nay (co lại khi nhấn) sẽ dính vào cả tấm
    body: mealView(m, key),
    onMount(el) {
      el.addEventListener("click", onMealClick);
      el.addEventListener("change", onMealChange);
      el.addEventListener("keydown", onMealKey);
      el.addEventListener("input", (ev) => { if (ev.target.id === "msName") fitName(el); });
      el.addEventListener("toggle", (ev) => { if (ms === state && ev.target.matches && ev.target.matches("details.fold") && ev.target.querySelector("#msHint")) state.hintOpen = ev.target.open; }, true);
      hydrate(el);
      fitName(el);
    },
    onClose() {
      // Đóng bằng ✕, nút Back, phím Escape hay chạm nền mờ khi hàng "Thêm một món" đã gõ đủ tên và số kcal: ghi món đó rồi mới
      // đóng (nội dung tấm còn nguyên cho tới khi tấm trượt đi hẳn). Thiếu một trong hai thì bỏ như trước.
      const row = ms === state ? addRowOf(state) : null;
      if (ms === state) ms = null;
      saveAddRow(state.key, state.id, row);
      setTimeout(nextMoment, 350); // lời chúc mừng đã chờ trong lúc tấm bữa ăn còn mở
    },
  });
}
export const mealSheetFor = () => (ms ? { key: ms.key, id: ms.id } : null);
on("change", () => paintMeal(false));
on("job", ({ id }) => { if (ms && ms.id === id) paintMeal(false); });
// Kết quả về trong lúc tấm của chính bữa đó đang mở: cả tấm được thay nội dung, nên báo một câu (vùng thông báo là aria-live)
// để người dùng trình đọc màn hình không bị bỏ lỡ. Chỉ đọc lên chứ không hiện: kết quả đã ở ngay trước mắt, mà thông báo hiện ra
// lại đè lên nút đóng của tấm. Nghe đúng sự kiện "đã tính xong" chứ không suy từ việc tấm hết "đang tính": bấm Dừng lại lúc đang
// tính lại (app giữ kết quả cũ) thì không có gì vừa được tính cả.
on("analyzed", ({ key, id }) => {
  if (!ms || ms.key !== key || ms.id !== id) return;
  const m = findMeal(key, id);
  if (m) toast(`Đã tính xong: ${m.name} · ${L.fmtInt(L.mealTotals(m).kcal)} kcal.`, null, 0, "", { hidden: true });
});
addEventListener("resize", () => { if (ms && ms.sheet) fitName(ms.sheet.el); });

/* ================================================================== *
 * Gõ tên món
 * ================================================================== */
let tx = null;
function textView() {
  const hasKey = !!S.settings.apiKey;
  const ideas = frequent(6).map((f) => f.name);
  return html`
    <header class="sheet-head"><h2 class="sheet-title">${cap(you())} ăn gì thế?</h2><button class="icon-btn" data-close-sheet aria-label="Đóng">${raw(icon("x"))}</button></header>
    <div class="sheet-body stack">
      <label class="field"><span class="field-label">Món ăn và lượng ăn</span>
        <textarea class="input area" id="txText" rows="2" maxlength="300" placeholder="Ví dụ: 1 tô phở bò tái, 1 ly trà đá" autocomplete="off" enterkeyhint="go"></textarea></label>
      ${ideas.length ? html`<div class="tags">${ideas.map((n) => html`<button type="button" class="tag" data-tx="idea" data-text="${n}">${n}</button>`)}</div>` : ""}
      ${hasKey
        ? html`<button class="btn primary block" data-tx="ai">Tính calo giúp ${you()}</button>
            <details class="fold"><summary>Đã biết số calo? Nhập thẳng</summary>
              <div class="input-row"><input class="input" id="txKcal" type="text" inputmode="numeric" maxlength="5" placeholder="kcal" autocomplete="off" aria-label="Số kcal" enterkeyhint="done"><button class="btn soft" data-tx="manual">Ghi</button></div>
            </details>`
        : html`<label class="field"><span class="field-label">Số kcal</span>
              <input class="input" id="txKcal" type="text" inputmode="numeric" maxlength="5" placeholder="Ví dụ: 450" autocomplete="off" enterkeyhint="done"></label>
            <button class="btn primary block" data-tx="manual">Ghi vào nhật ký</button>
            <p class="fine">Kết nối Claude trong Cài đặt để app tự tính calo từ tên món hoặc từ ảnh.</p>`}
    </div>`;
}
const cap = W.cap;
/** @param {string|null} [type] loại bữa chọn sẵn (ví dụ 'vat' khi chạm "Thêm" ở Ăn vặt) */
export function openTextAdd(type = null) {
  if (tx) return;
  tx = openSheet({
    label: "Gõ tên món",
    body: textView(),
    onMount(el) {
      el.addEventListener("click", (e) => {
        const b = e.target.closest("[data-tx]");
        if (!b) return;
        const text = $("#txText", el).value.trim();
        if (b.dataset.tx === "idea") { const t = $("#txText", el); t.value = (t.value.trim() ? t.value.trim() + ", " : "") + b.dataset.text; t.focus(); return; }
        if (!text) { toast("Gõ tên món trước đã."); $("#txText", el).focus(); return; }
        if (b.dataset.tx === "ai") {
          const r = addTextMeal(text, type);
          tx.close(() => { if (r) openMeal(r.key, r.meal.id); });
        } else if (b.dataset.tx === "manual") {
          const kcal = L.parseKcal($("#txKcal", el).value);
          if (kcal === null || kcal < 1 || kcal > 5000) { toast("Nhập số kcal từ 1 đến 5.000."); $("#txKcal", el).focus(); return; }
          const r = addReadyMeal({ name: text.slice(0, 120), items: [{ n: text.slice(0, 80), k: Math.round(kcal) }], src: "manual", type });
          tx.close();
          if (r) toast(`Đã ghi ${L.fmtInt(kcal)} kcal.`);
        }
      });
      el.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        if (e.target.id === "txKcal") { e.preventDefault(); $('[data-tx="manual"]', el)?.click(); return; }
        if (e.target.id !== "txText") return;
        // iPhone: bàn phím che mất nút "Tính calo giúp…", nên phím Enter (hiện là "Đi") đi tiếp luôn thay vì xuống dòng.
        // Shift+Enter và Enter lúc bộ gõ còn đang ghép chữ (keyCode 229 trên Safari) thì để yên.
        if (e.shiftKey || e.isComposing || e.keyCode === 229) return;
        e.preventDefault();
        const go = $('[data-tx="ai"]', el);
        if (go) go.click(); else $("#txKcal", el)?.focus(); // chưa kết nối Claude: sang ô số kcal
      });
      setTimeout(() => $("#txText", el)?.focus(), 280);
    },
    onClose() {
      tx = null;
      setTimeout(nextMoment, 350); // lời chúc mừng không chen ngang lúc đang gõ; nếu tấm bữa ăn mở tiếp (Tính calo) thì nó chờ tiếp tấm đó
    },
  });
}

/* ================================================================== *
 * Ghi buổi tập
 * ================================================================== */
let xs = null;
/** @param {string} [pre] mã hoạt động chọn sẵn (từ một gợi ý)  @param {number} [preMin] số phút điền sẵn */
export function openExercise(pre = "", preMin = 0) {
  if (xs) return;
  const key = S.viewDay; // ghi vào ngày đang xem (hôm nay hoặc một ngày cũ)
  const kg = ctx().weight;
  let a = EXERCISES.some((x) => x.id === pre) ? pre : "di-bo-nhanh";
  let min = preMin >= 1 && preMin <= 600 ? Math.round(preMin) : 30;
  const actOf = () => EXERCISES.find((x) => x.id === a);
  const estText = (m) => (m >= 1 && m <= 600 ? `Khoảng ${L.fmtInt(L.burnKcal(actOf().met, kg, m))} kcal` : "Nhập số phút từ 1 đến 600");
  const body = html`
    <header class="sheet-head"><h2 class="sheet-title">Ghi buổi tập</h2><button class="icon-btn" data-close-sheet aria-label="Đóng">${raw(icon("x"))}</button></header>
    <div class="sheet-body stack">
      <div class="field"><span class="field-label">${cap(you())} vừa vận động gì?</span>
        <div class="tags" role="group" aria-label="Hoạt động">${EXERCISES.map((x) => html`<button type="button" class="tag" data-xs="act:${x.id}" aria-pressed="${P(x.id === a)}">${x.n}</button>`)}</div>
      </div>
      <div class="ws-num">
        <button type="button" class="icon-btn" data-xs="-5" aria-label="Bớt 5 phút">${raw(icon("minus"))}</button>
        <label class="ws-val"><input id="xsMin" class="num" type="text" inputmode="numeric" maxlength="3" value="${min}" aria-label="Số phút" aria-describedby="xsEst" enterkeyhint="done"><span>phút</span></label>
        <button type="button" class="icon-btn" data-xs="5" aria-label="Thêm 5 phút">${raw(icon("plus"))}</button>
      </div>
      <p class="xs-est" id="xsEst" role="status">${estText(min)}</p>
      <button class="btn primary block" data-xs="save">Ghi buổi tập</button>
      <p class="fine center">Ước tính theo cân nặng ${L.fmt1(kg)} kg, có thể lệch 20–30%. Số này chỉ để theo dõi, không cộng vào phần được ăn.</p>
    </div>`;
  xs = openSheet({
    label: "Ghi buổi tập",
    body,
    onMount(el) {
      const input = $("#xsMin", el), est = $("#xsEst", el);
      const read = () => { const v = L.parseKcal(input.value); return v === null ? NaN : Math.round(v); };
      const paint = () => { est.textContent = estText(read()); };
      el.addEventListener("input", (e) => { if (e.target === input) paint(); });
      el.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target === input) { e.preventDefault(); $('[data-xs="save"]', el).click(); } });
      el.addEventListener("click", (e) => {
        const b = e.target.closest("[data-xs]");
        if (!b) return;
        const act = b.dataset.xs;
        if (act.startsWith("act:")) {
          a = act.slice(4);
          for (const t of $$("[data-xs^='act:']", el)) t.setAttribute("aria-pressed", P(t === b));
          paint(); buzz(4);
          return;
        }
        if (act === "save") {
          const m = read();
          if (!(m >= 1 && m <= 600)) { paint(); input.focus(); return; }
          const r = addExercise(key, { a, min: m });
          if (!r) return;
          xs.close();
          buzz(10);
          toast(`Đã ghi ${r.ex.n} ${L.fmtInt(r.ex.min)} phút · khoảng ${L.fmtInt(r.ex.k)} kcal.`, { label: "Hoàn tác", fn: () => removeExercise(r.key, r.ex.id) });
          return;
        }
        const d = Number(act);
        if (!Number.isFinite(d)) return;
        const cur = read();
        const next = L.clamp((Number.isFinite(cur) ? cur : min) + d, 5, 600);
        input.value = String(next);
        paint(); buzz(4);
      });
    },
    onClose() {
      xs = null;
      setTimeout(nextMoment, 350);
    },
  });
}

/* ================================================================== *
 * Ghi cân nặng
 * ================================================================== */
let ws = null;
let wsLast = "";
/** Mấy lần cân thật gần đây nhất (không tính điểm xuất phát lấy từ hồ sơ), mới nhất ở trên; mỗi dòng có nút xoá để sửa lần gõ nhầm. */
function weighList() {
  const rows = window.innerHeight < 700 ? 3 : 5; // màn hình thấp: ít dòng hơn để tấm không cao chạm mép trên (chỗ hiện thông báo "Hoàn tác")
  const keys = Object.keys(S.days).filter((k) => L.isKey(k) && S.days[k] && S.days[k].weight != null).sort().reverse().slice(0, rows);
  const when = (k) => (k === S.today ? "Hôm nay" : k === L.addDays(S.today, -1) ? "Hôm qua" : L.shortDate(k));
  // Lần cân của ngày bắt đầu chính là điểm xuất phát (cân lại trong ngày đó thì hồ sơ dời theo): xoá nó đi không đưa được số cũ
  // về, mọi con số vẫn y nguyên. Nên dòng này không có nút Xoá mà có nút Sửa, dẫn tới ô "Cân lúc bắt đầu" trong Cài đặt.
  const p = S.profile;
  const isStart = (k) => !!p && k === p.startDate && L.round1(Number(S.days[k].weight)) === L.round1(Number(p.startWeight));
  return html`<div class="ws-hist" data-part="wslist">
    ${keys.length
      ? html`<p class="field-label">Các lần cân gần đây</p>
        <ul class="list">${keys.map((k) => html`<li class="list-row"><span class="grow">${when(k)}${isStart(k) ? " · lúc bắt đầu" : ""}</span><b>${L.fmt1(S.days[k].weight)} kg</b>${isStart(k)
          ? html`<button type="button" class="btn ghost sm" data-ws="fix" aria-label="Sửa cân lúc bắt đầu trong Cài đặt">Sửa</button>`
          : html`<button type="button" class="btn ghost sm danger" data-ws="rm:${k}" aria-label="Xoá lần cân ngày ${L.shortDate(k)}">Xoá</button>`}</li>`)}</ul>`
      : ""}
  </div>`;
}
function paintWeighList() {
  if (!ws) return;
  const s = weighList().s;
  if (s === wsLast) return;
  const n = $('[data-part="wslist"]', ws.el);
  if (!n) return;
  withFocus(ws.el, () => { n.outerHTML = s; });
  wsLast = s;
}
on("change", paintWeighList);
export function openWeight() {
  if (ws) return;
  const c = ctx();
  let value = L.round1(c.weight);
  // Mốc để phát hiện gõ nhầm: lần cân gần nhất trước hôm nay (chưa có thì lấy cân nặng hiện tại).
  const refWeight = () => {
    const before = L.weightSeries(S.days, S.profile).filter((p) => p.k < S.today);
    return before.length ? before[before.length - 1].w : ctx().weight;
  };
  const list = weighList();
  wsLast = list.s;
  const body = html`
    <header class="sheet-head"><h2 class="sheet-title">Cân nặng hôm nay</h2><button class="icon-btn" data-close-sheet aria-label="Đóng">${raw(icon("x"))}</button></header>
    <div class="sheet-body stack">
      <div class="ws-num">
        <button type="button" class="icon-btn" data-ws="-0.1" aria-label="Bớt 0,1 kg">${raw(icon("minus"))}</button>
        <label class="ws-val"><input id="wsInput" class="num" type="text" inputmode="decimal" maxlength="6" value="${L.fmt1(value)}" aria-label="Cân nặng, kg" aria-describedby="wsMsg"><span>kg</span></label>
        <button type="button" class="icon-btn" data-ws="0.1" aria-label="Thêm 0,1 kg">${raw(icon("plus"))}</button>
      </div>
      <p class="ws-msg" id="wsMsg" role="alert"></p>
      <button class="btn primary block" data-ws="save">Ghi cân nặng</button>
      <p class="fine center">Mẹo nhỏ: cân vào buổi sáng, trước khi ăn, để các lần cân so được với nhau.</p>
      ${list}
    </div>`;
  // Lần cân vừa xoá, còn hoàn tác được: { key, text, fn, was, now }. Lời báo và nút "Hoàn tác" nằm NGAY TRONG tấm (ở #wsMsg) chứ không
  // phải một thông báo nổi: tấm là hộp thoại aria-modal, phím Tab và trình đọc màn hình không ra tới thông báo nằm ngoài tấm.
  // Tấm đóng mà còn hoàn tác được thì lời mời ấy theo ra thành thông báo nổi (xem onClose).
  let undo = null;
  ws = openSheet({
    label: "Ghi cân nặng",
    body,
    onMount(el) {
      const input = $("#wsInput", el);
      const msg = $("#wsMsg", el);
      let sure = null; // số (kg) đã được cảnh báo "chênh nhiều" một lần; chạm Ghi lần nữa với đúng số đó thì ghi
      let noted = false; // #wsMsg đang hiện một lời nhắc/lỗi (không phải lời "Đã xoá…")
      const say = (text, bad) => {
        noted = !!text;
        // Không còn gì để nhắc mà vừa xoá một lần cân: hiện (lại) lời "Đã xoá… · Hoàn tác" — lỗi và cảnh báo chỉ tạm che nó.
        const offer = !text && undo;
        if (offer) setHtml(msg, html`<span>${undo.text}</span><button type="button" class="btn sm" data-ws="undo">Hoàn tác</button>`);
        else msg.textContent = text;
        msg.classList.toggle("has-act", !!offer);
        msg.classList.toggle("is-err", !!bad);
        if (bad) input.setAttribute("aria-invalid", "true"); else input.removeAttribute("aria-invalid");
      };
      const calm = () => { sure = null; if (noted) say("", false); };
      const read = () => { const v = L.parseNum(input.value); if (v !== null) value = v; };
      const bump = (d) => { read(); value = L.clamp(L.round1(value + d), 30, 250); input.value = L.fmt1(value); calm(); buzz(4); };
      const stepOf = (t) => {
        const b = t && t.closest && t.closest("[data-ws]");
        const d = b ? Number(b.dataset.ws) : NaN; // "save", "undo", "fix" và "rm:<ngày>" không phải nút cộng trừ
        return Number.isFinite(d) ? d : null;
      };
      let hold = null, repeat = null;
      const stop = () => { clearTimeout(hold); clearInterval(repeat); hold = repeat = null; };
      el.addEventListener("pointerdown", (e) => {
        const d = stepOf(e.target);
        if (d === null) return;
        bump(d);
        hold = setTimeout(() => { repeat = setInterval(() => bump(d), 70); }, 420); // giữ để chạy nhanh
      });
      // touchend/touchcancel: phòng khi iPhone bỏ dở dòng sự kiện con trỏ (nhấn giữ bị coi là chọn chữ) mà không báo pointerup/pointercancel
      for (const ev of ["pointerup", "pointercancel", "pointerleave", "touchend", "touchcancel"]) el.addEventListener(ev, stop, { passive: true });
      el.addEventListener("input", (e) => { if (e.target === input) calm(); }); // sửa số thì bỏ cảnh báo cũ
      el.addEventListener("keydown", (e) => {
        const d = stepOf(e.target);
        if (d !== null && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); bump(d); }
        if (e.key === "Enter" && e.target === input) { e.preventDefault(); $('[data-ws="save"]', el).click(); }
      });
      el.addEventListener("click", (e) => {
        const b = e.target.closest("[data-ws]");
        if (!b) return;
        const act = b.dataset.ws;
        if (act === "fix") { ws.close(() => document.dispatchEvent(new CustomEvent("nkc:settings", { detail: "profile" }))); return; } // điểm xuất phát sửa ở Cài đặt › Hồ sơ
        if (act === "undo") {
          const u = undo;
          undo = null; // chỉ chạy một lần
          if (!u) return;
          u.fn();
          const back = !!S.days[u.key] && S.days[u.key].weight != null;
          // Lúc xoá ô số đã bị đổi sang số của lần cân trước: đặt lại đúng số vừa khôi phục (trừ khi cô ấy đã sửa sang số khác),
          // kẻo chạm "Ghi cân nặng" ngay sau đó lại ghi đè lần cân vừa lấy lại bằng số cũ.
          const cur = L.parseNum(input.value);
          if (back && u.was !== null && cur !== null && L.round1(cur) === u.now) { value = u.was; input.value = L.fmt1(value); sure = null; }
          // nút "Hoàn tác" biến mất cùng lời báo: withFocus đưa tiêu điểm về tấm, không để rơi ra <body>
          withFocus(el, () => { say(back ? `Đã đặt lại lần cân ngày ${L.shortDate(u.key)}.` : "", false); paintWeighList(); });
          return;
        }
        if (act.startsWith("rm:")) {
          // Xoá một lần cân gõ nhầm (kể cả của ngày cũ). Danh sách tự vẽ lại qua sự kiện "change".
          const key = act.slice(3);
          const old = S.days[key] ? S.days[key].weight : null;
          if (old == null) return;
          const shown = L.parseNum(input.value);
          const back = removeWeight(key); // trả về hàm hoàn tác: đặt lại đúng số cân, mục tiêu của ngày và các mốc đã mừng
          const swapped = shown !== null && L.round1(shown) === L.round1(old);
          if (swapped) { value = L.round1(ctx().weight); input.value = L.fmt1(value); } // ô số đang hiện đúng số vừa xoá
          // Xoá thêm một lần cân nữa: lời báo và hàm hoàn tác của lần trước được thay bằng của lần này.
          // was / now: số ô vừa bị đổi từ đâu sang đâu, để "Hoàn tác" trả cả ô số về như cũ.
          undo = { key, text: `Đã xoá lần cân ngày ${L.shortDate(key)}.`, fn: () => { if (back) back(); else logWeight(key, old); }, was: swapped ? L.round1(old) : null, now: swapped ? value : null };
          sure = null;
          withFocus(el, () => say("", false));
          return;
        }
        if (act !== "save") {
          // TalkBack, Switch Access, điều khiển bằng giọng nói bấm nút bằng một "click" không kèm pointerdown (detail = 0)
          const d = stepOf(b);
          if (d !== null && e.detail === 0) bump(d);
          return;
        }
        const v = L.parseNum(input.value);
        if (v === null || v < 30 || v > 250) { say("Nhập cân nặng từ 30 đến 250 kg.", true); input.focus(); return; }
        const now = L.round1(v);
        const ref = refWeight();
        const gap = ref == null ? 0 : L.round1(Math.abs(now - ref));
        if (gap >= 3 && sure !== now) {
          // Chênh nhiều so với lần trước thường là gõ nhầm (50,2 thay vì 59,2): hỏi lại một lần trước khi ghi.
          sure = now;
          say(`Chênh ${L.fmt1(gap)} kg so với lần cân trước (${L.fmt1(ref)} kg). Nếu đúng, chạm Ghi lần nữa.`, false);
          return;
        }
        const r = logWeight(S.today, input.value);
        if (!r.ok) { say(r.error, true); input.focus(); return; }
        undo = null; // đã ghi cân: tấm đóng, không còn gì để hoàn tác ở đây
        ws.close();
        toast(W.weightToast(r.prev, now));
      });
    },
    onClose() {
      ws = null; wsLast = "";
      // Vừa xoá một lần cân rồi đóng tấm (✕, Back, chạm nền, hay sang Cài đặt để sửa cân lúc bắt đầu): lần cân của ngày cũ không
      // nhập lại được ở đâu khác, nên lời mời "Hoàn tác" đi theo ra thành thông báo nổi — tấm đã đóng thì thông báo ấy ai cũng tới được.
      if (undo) {
        const u = undo;
        undo = null;
        toast(u.text, { label: "Hoàn tác", fn: () => {
          // Tấm cân nặng đã được mở lại trước khi bấm "Hoàn tác" ở thông báo: ô số của tấm ấy đang hiện cân nặng của lúc CHƯA hoàn tác.
          // Nếu cô ấy chưa gõ số khác thì đổi ô theo cân nặng vừa khôi phục, kẻo chạm "Ghi cân nặng" lại ghi đè lần cân vừa lấy lại.
          const input = ws && ws.el ? $("#wsInput", ws.el) : null;
          const shown = input ? L.parseNum(input.value) : null;
          const before = input ? L.round1(ctx().weight) : null;
          u.fn();
          if (input && shown !== null && L.round1(shown) === before) input.value = L.fmt1(L.round1(ctx().weight));
        } });
      }
      setTimeout(nextMoment, 350); // lời chúc mừng (nếu có) chờ tấm này đóng hẳn
    },
  });
}

/* ================================================================== *
 * Chúc mừng
 * ================================================================== */
const queue = [];
let celeOpen = false;
// Cách CÔ ẤY tự xưng khi khoe với người thân. App gọi là "chị" không có nghĩa cô ấy xưng "chị" với chồng: chỉ "em" là đổi, còn lại xưng "mình".
const SELF = { em: "Em" };

function momentView(mo) {
  const name = S.profile?.name || "";
  const partner = S.settings.partner;
  let art, eyebrow, title, text, share;
  const self = SELF[you()] || "Mình";
  if (mo.type === "badge") {
    art = badgeArt(mo.id, true, 132); eyebrow = "Huy hiệu mới"; title = mo.title; text = mo.desc + ".";
    share = `${self} vừa nhận huy hiệu “${mo.title}” trên Nhật Ký Calo!`;
  } else if (mo.type === "plant") {
    art = plantSvg(mo.stage, { size: 126 }); eyebrow = "Cây hoa lớn thêm"; title = mo.name; text = mo.line;
    // các giai đoạn đầu là cụm động từ ("nảy mầm", "ra lá"…), riêng giai đoạn cuối "Rực rỡ" là tính từ nên cần thêm "nở"
    share = `Cây hoa của ${self.toLowerCase()} trên Nhật Ký Calo vừa ${mo.stage === 6 ? "nở rực rỡ" : mo.name.toLowerCase()}!`;
  } else if (mo.type === "streak") {
    art = badgeArt("streak", true, 132, mo.n); eyebrow = "Chuỗi ngày"; title = `${mo.n} ngày liên tiếp`; text = W.streakCheer(mo.n);
    share = `${self} đã ghi nhật ký ăn uống ${mo.n} ngày liên tiếp!`;
  } else if (mo.type === "goal") {
    art = badgeArt("goal", true, 132); eyebrow = "Về đích"; title = name ? `${name} làm được rồi!` : "Làm được rồi!";
    text = `Đã chạm ${L.fmt1(S.profile.goalWeight)} kg. Từ giờ app chuyển sang mức ăn để giữ cân.`;
    share = `${self} đã về đích ${L.fmt1(S.profile.goalWeight)} kg rồi!`;
  } else if (mo.type === "reward") {
    // Hộp quà bí mật: tới mốc thì hộp hiện ra còn đóng, cô ấy tự bấm mới thấy bên trong là gì.
    const g = giftById(mo.id);
    if (!g || !g.reached) return null; // quà đã bị xoá hoặc mốc không còn đạt (sửa lại số cân)
    const what = g.kind === "days" ? `${g.days} ngày đạt mục tiêu` : g.isGoal ? "Về đích" : `Giảm ${L.fmt1(g.kg).replace(",0", "")} kg`;
    eyebrow = what;
    if (!g.opened) {
      return {
        share: "", gift: g,
        inner: html`<div class="cele-art cele-art--box">${raw(giftArt(false, 148))}</div>
          <p class="cele-eyebrow">${eyebrow}</p>
          <h2 class="cele-title">Có quà đang chờ!</h2>
          <p class="cele-text">${partner ? W.cap(partner) + " đã để sẵn một hộp quà cho mốc này." : "Một hộp quà đã để sẵn cho mốc này."} Chạm để xem bên trong có gì nhé.</p>
          <div class="cele-actions">
            <button class="btn primary block" data-cele="open">Mở quà</button>
            <button class="btn ghost block" data-close-sheet>Để lát nữa mở</button>
          </div>`,
      };
    }
    art = giftArt(true, 148); title = "Mở quà thôi!";
    text = `Quà${partner ? " từ " + partner : ""}: ${g.text}.`;
    share = g.kind === "days"
      ? `${self} đã có ${g.days} ngày ăn đúng mục tiêu rồi, đến lúc nhận quà: ${g.text}!`
      : `${self} giảm được ${L.fmt1(g.kg).replace(",0", "")} kg rồi, đến lúc nhận quà: ${g.text}!`;
  } else {
    art = badgeArt("lost", true, 132, mo.kg); eyebrow = "Mốc mới"; title = `Giảm ${L.fmt1(mo.kg).replace(",0", "")} kg`; text = "Từng chút một mà thành quãng đường dài.";
    share = `${self} giảm được ${L.fmt1(mo.kg).replace(",0", "")} kg rồi!`;
  }
  const note = S.settings.notes.length ? W.pick(S.settings.notes, `${mo.type}${mo.id || mo.kg || mo.n || mo.stage}`) : null;
  return {
    share,
    inner: html`<div class="cele-art">${raw(art)}</div>
      <p class="cele-eyebrow">${eyebrow}</p>
      <h2 class="cele-title">${title}</h2>
      <p class="cele-text">${text}</p>
      ${note ? html`<blockquote class="cele-note"><p>${note}</p><cite>${W.noteLabel(partner, you())}</cite></blockquote>` : ""}
      <div class="cele-actions">
        <button class="btn primary block" data-close-sheet>Tuyệt quá</button>
        <button class="btn ghost block" data-cele="share">${raw(icon("share"))}<span>Khoe với ${partner || "người thân"}</span></button>
      </div>`,
  };
}
/** Mở tấm hộp quà từ danh sách ở màn Hành trình (quà đã tới mốc mà chưa mở, hoặc xem lại quà đã mở). */
export function openGiftBox(id) {
  queue.unshift({ type: "reward", id });
  nextMoment();
}
function nextMoment() {
  if (celeOpen || !queue.length) return;
  if (ms || ws || tx) return; // tấm bữa ăn (đang xem/sửa kết quả), tấm cân nặng hoặc tấm gõ tên món đang mở: chờ tấm đóng rồi mới chúc mừng — onClose của tấm gọi lại hàm này
  if (sheetBusy()) { setTimeout(nextMoment, 120); return; } // một tấm khác đang đóng dở: mở ngay sẽ bị bước lùi đang chờ đóng nhầm
  const mo = queue.shift();
  let v = momentView(mo);
  if (!v) { setTimeout(nextMoment, 0); return; }
  celeOpen = true;
  const sh = openSheet({
    label: v.gift ? "Hộp quà" : "Chúc mừng",
    kind: "center",
    body: html`<div class="cele">${v.inner}</div>`,
    onMount(el) {
      el.addEventListener("click", async (e) => {
        if (e.target.closest('[data-cele="open"]')) {
          // Bấm mở hộp: ghi nhận đã mở rồi thay nội dung tấm bằng món quà bên trong.
          if (!openGift(mo.id)) { sh.close(); return; }
          const opened = momentView(mo);
          if (!opened) { sh.close(); return; }
          v = opened;
          withFocus(el, () => setHtml($(".cele", el), v.inner));
          confetti({ colors: themeColors() }); buzz(18);
          return;
        }
        if (!e.target.closest('[data-cele="share"]')) return;
        const r = await shareText(v.share);
        if (r === "copied") toast("Đã chép lời khoe. Dán vào tin nhắn để gửi nhé.");
        else if (r === "fail") toast("Máy này chưa chia sẻ được.");
      });
      setTimeout(() => { confetti({ colors: themeColors() }); buzz(18); }, 180);
    },
    onClose() { celeOpen = false; setTimeout(nextMoment, 350); },
  });
  return sh;
}
on("moments", (list) => { queue.push(...list); setTimeout(nextMoment, 500); });
