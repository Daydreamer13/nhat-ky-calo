// today.js — màn "Hôm nay" theo thiết kế "Vườn nhỏ".
// Hàm thuần: đọc S → todayModel → trả về html``. Mọi thao tác đi qua data-act (app.js xử lý).
// Các con số hình học của SVG (vòng lá, góc xoay, độ mờ) đều tính sẵn ở đây rồi ghi thành
// thuộc tính thường, không dựa vào calc()/biến CSS bên trong SVG (Safari trên iPhone).

import { S, ctx, stats, isReviewing } from "../state.js";
import { todayModel } from "../models.js";
import { html, raw, isStandalone, isIOS, canPromptInstall } from "../ui.js";
import { plantSvg, mealStandIn, glowDef, fireflies } from "../art.js";
import * as L from "../logic.js";

/* ---------------- dải tuần: tuần đang hiện ---------------- */
let weekAnchor = null;
export function shiftWeek(n) {
  const next = L.addDays(weekAnchor || S.viewDay, n * 7);
  if (L.weekStart(next) <= L.weekStart(S.today)) weekAnchor = next;
}
export function resetWeek() { weekAnchor = null; }

/* ---------------- gợi ý bữa ăn: lượt đang hiện ---------------- */
let sugOffset = 0; // bấm "Đổi món" thì sang lượt gợi ý kế tiếp
let sugShown = { slot: null, items: [] }; // đúng những món đang hiện trên màn (app.js ghi theo số thứ tự)
export function moreSuggestions() { sugOffset++; }
export const suggestionAt = (i) => (sugShown.items[i] ? { slot: sugShown.slot, ...sugShown.items[i] } : null);

/* ---------------- mảnh dùng lại ---------------- */
const ico = (id, cls = "") => html`<svg class="icon ${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;
const num1 = (n) => String(Math.round(n * 10) / 10);
const TYPE_ICON = { sang: "i-sunrise", trua: "i-sun", toi: "i-moon", vat: "i-apple" };

function timeOfDay(hour) {
  return hour >= 5 && hour < 10 ? "morning" : hour >= 10 && hour < 16 ? "noon" : hour >= 16 && hour < 19 ? "evening" : "night";
}

/* ---------------- đầu trang ---------------- */
const SUN = raw('<svg class="greeting__sun" viewBox="0 0 28 28" aria-hidden="true"><g stroke="var(--sun)" stroke-width="2.6" stroke-linecap="round"><path d="M14 2.5v3M14 22.5v3M2.5 14h3M22.5 14h3M5.9 5.9L8 8M20 20l2.1 2.1M5.9 22.1L8 20M20 8l2.1-2.1"/></g><circle class="f-sun" cx="14" cy="14" r="6.5"/></svg>');
const MOON = raw('<svg class="greeting__sun greeting__moon" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-moon"/></svg>');

function header(m, hour) {
  const night = hour >= 18 || hour < 5;
  return html`<header class="topbar">
    <h1 class="greeting">${m.isToday ? html`<span class="greeting__text">${m.greeting}${raw("&nbsp;")}${night ? MOON : SUN}</span>` : html`<span class="greeting__text">Nhật ký ${m.dayTitle}</span>`}</h1>
    <button class="icon-btn" data-act="settings" aria-label="Cài đặt">${ico("i-gear")}</button>
    ${m.isToday ? html`<div class="topbar__meta">
      <p class="topbar__date">${m.dateLabel}</p>
      ${m.streak > 0 ? html`<p class="streak-chip"><svg viewBox="0 0 32 30" aria-hidden="true"><use href="#sprout-ok"/></svg>${L.fmtInt(m.streak)} ngày liên tiếp</p>` : ""}
    </div>` : ""}
  </header>
  ${m.isToday ? "" : html`<div class="dayback" role="status">
    <p class="dayback__text"><span>Đang xem lại</span><b>${m.dateLabel}</b></p>
    <button class="dayback__btn" data-act="today">Về hôm nay</button>
  </div>`}`;
}

/* ---------------- dải tuần ---------------- */
const STATUS_WORD = { ok: "đạt mục tiêu", over: "vượt mức", partial: "ghi chưa đủ bữa", none: "chưa ghi", today: "hôm nay", future: "chưa tới" };
const SPROUT = { ok: "sprout-ok", over: "sprout-over", partial: "sprout-ok", none: "sprout-seed", today: "sprout-today", future: "sprout-seed" };

function dayCell(d) {
  const words = [L.longDate(d.k)];
  if (d.isToday && d.status !== "today") words.push("hôm nay");
  words.push(STATUS_WORD[d.status] || "");
  if (d.selected) words.push("đang xem");
  const cls = ["day", `is-${d.status}`, d.isToday ? "is-today" : "", d.selected ? "is-selected" : ""].filter(Boolean).join(" ");
  const badge = d.status === "ok" ? html`<i class="day__badge day__badge--ok">${ico("i-check")}</i>`
    : d.status === "over" ? html`<i class="day__badge day__badge--over">${ico("i-chevron")}</i>` : "";
  return html`<button class="${cls}" data-act="day:${d.k}" aria-label="${words.filter(Boolean).join(", ")}" aria-pressed="${d.selected ? "true" : "false"}" ${d.isToday ? raw('aria-current="date"') : ""} ${d.isFuture ? raw("disabled") : ""}>
    <span class="day__name">${d.label}</span>
    <span class="day__num">${d.dnum}</span>
    ${d.isToday ? html`<span class="day__bar" aria-hidden="true"><i style="width:${Math.round(d.pct * 100)}%"></i></span>` : ""}
    <span class="day__sprout" aria-hidden="true"><svg class="day__plant"><use href="#${SPROUT[d.status] || "sprout-seed"}"/></svg>${badge}</span>
  </button>`;
}

function weekStrip(m) {
  const nav = m.canPrevWeek || m.canNextWeek;
  return html`<div class="weekbar ${nav ? "has-nav" : ""}">
    ${nav ? html`<button class="week-nav week-nav--prev" data-act="week:-1" aria-label="Tuần trước" ${m.canPrevWeek ? "" : raw("disabled")}>${ico("i-chevron", "icon--md")}</button>` : ""}
    <nav class="week" aria-label="${m.weekHasToday ? "Tuần này" : "Tuần " + m.weekLabel}">
      ${m.week.map((d) => dayCell(d))}
      <span class="week__bed" aria-hidden="true"></span>
    </nav>
    ${nav ? html`<button class="week-nav week-nav--next" data-act="week:1" aria-label="Tuần sau" ${m.canNextWeek ? "" : raw("disabled")}>${ico("i-chevron", "icon--md")}</button>` : ""}
    ${m.weekHasToday ? "" : html`<p class="week__label"><span>Tuần ${m.weekLabel}</span>${m.isToday ? html`<button class="week__back" data-act="today">Về tuần này</button>` : ""}</p>`}
  </div>`;
}

/* ---------------- vòng lá ---------------- */
const LEAF_OUT = [10, 46, 82, 118, 154, 190, 226, 262, 298, 334];
const LEAF_IN = [28, 136, 208, 316];
// Chu vi vòng r=80. Nét đứt tính bằng đơn vị thật của hình (không dùng pathLength) để máy nào cũng vẽ giống nhau.
const RING = 2 * Math.PI * 80;
const dash = (pct) => `${num1((pct / 100) * RING)} ${num1(RING)}`;
const DOTS = `0.5 ${Math.round((RING / 20 - 0.5) * 100) / 100}`;      // 20 chấm quanh vòng

// Bóng mềm dưới vòng: ba vòng rộng dần, nhạt dần, lệch xuống 1 đơn vị — vẽ bằng hình thay cho filter drop-shadow
// (Safari trên iPhone không áp filter của CSS lên phần tử nằm trong <svg>).
const SHADE = raw(`<g class="wreath__shade">${[[14.4, 0.09], [11.8, 0.24], [9.4, 0.28]].map(([w, o]) => `<circle cx="100" cy="101" r="80" stroke-width="${w}" stroke-opacity="${o}"/>`).join("")}</g>`);

function wreath(k) {
  const pct = k.over || k.hit ? 100 : Math.round(k.pct * 1000) / 10;      // 0–100
  const deg = pct * 3.6;
  const overPct = k.over ? L.clamp(((k.eaten - k.target) / k.target) * 100, 0, 25) : 0;
  // một chiếc lá mở ra khi dây leo đã đi qua nó
  const leaf = (href) => (a) => {
    const o = L.clamp((deg - a - 12) / 4, 0, 1);
    return o > 0 ? html`<use href="#${href}" transform="rotate(${a} 100 100)" opacity="${num1(o)}"/>` : "";
  };
  const shown = L.fmtInt(k.abs);
  const label = k.over ? "Vượt mức" : k.hit ? "Vừa đủ" : "Còn lại";
  const text = k.hit && k.abs > 0 ? "+" + shown : shown;
  // "1.470" và "+115" đều rộng quá cỡ chữ lớn: dùng cỡ nhỏ hơn để không chạm vòng lá
  const long = text.length >= 5 || (text.length >= 4 && text[0] === "+");
  return html`<div class="wreath ${k.over ? "is-over" : ""}">
    <svg class="wreath__svg" viewBox="0 0 200 200" aria-hidden="true">
      ${SHADE}
      <circle class="wreath__track" cx="100" cy="100" r="80"/>
      ${pct < 100 ? html`<circle class="wreath__dots" cx="100" cy="100" r="80" stroke-dasharray="${DOTS}" style="stroke-dasharray:${DOTS}"/>` : ""}
      <g class="f-leaf-deep">${LEAF_OUT.map(leaf("wreath-out"))}</g>
      <g class="f-leaf-light">${LEAF_IN.map(leaf("wreath-in"))}</g>
      ${pct > 0 ? html`<circle class="wreath__arc" cx="100" cy="100" r="80" transform="rotate(-90 100 100)" stroke-dasharray="${dash(pct)}" style="stroke-dasharray:${dash(pct)}"/>` : ""}
      ${k.over ? html`<circle class="wreath__over" cx="100" cy="100" r="80" transform="rotate(-90 100 100)" stroke-dasharray="${dash(overPct)}" style="display:inline;stroke-dasharray:${dash(overPct)}"/>
        <g transform="rotate(${num1(overPct * 3.6)} 100 100)"><use href="#wreath-out" class="f-over"/><use href="#wreath-in" class="f-sun"/></g>`
        : html`<g transform="rotate(${num1(deg)} 100 100)"><use href="#flower" transform="translate(100 20) scale(1.2)"/></g>`}
    </svg>
    <div class="wreath__center">
      <span class="wreath__label">${label}</span>
      <strong class="wreath__num ${long ? "is-long" : ""}">${text}</strong>
      <span class="wreath__unit">kcal</span>
    </div>
  </div>`;
}

/** In đậm con số kcal đầu tiên trong câu động viên (câu chữ vẫn đi qua khuôn an toàn). */
function tipText(s) {
  const hit = /\d[\d.]*\skcal/.exec(s || "");
  if (!hit) return s;
  return html`${s.slice(0, hit.index)}<b class="nowrap">${hit[0]}</b>${s.slice(hit.index + hit[0].length)}`;
}

const MACRO_CLASS = { p: "macro--protein", c: "macro--carb", f: "macro--fat" };

function hero(m, hour) {
  const k = m.kcal;
  // cây không bao giờ nhỏ lại: giai đoạn đã được chúc mừng (plantFloor) là mức sàn; thiếu thì coi như 1
  const st = stats();
  const stage = L.plantState(st.okDays, st.plantFloor || 1).stage;
  const say = k.over ? `vượt mức ${L.fmtInt(k.abs)} kcal` : k.hit ? "vừa đủ mục tiêu" : `còn lại ${L.fmtInt(k.abs)} kcal`;
  return html`<section class="hero ${k.over ? "is-over" : ""}" data-time="${m.isToday ? timeOfDay(hour) : "noon"}" aria-label="Calo ${m.dayTitle}: ${say}, đã ăn ${L.fmtInt(k.eaten)} trên mục tiêu ${L.fmtInt(k.target)} kcal">
    <svg class="hero__fireflies only-dark" viewBox="0 0 358 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${raw(glowDef("glow-hero"))}${raw(fireflies("glow-hero", [[204, 16, 1.5], [20, 206, 1.7], [340, 214, 1.5], [176, 212, 1.3]]))}</svg>
    <div class="hero__main">
      ${wreath(k)}
      <div class="hero__stats">
        <dl class="tally">
          <div class="tally__row"><dt>Đã ăn</dt><dd>${L.fmtInt(k.eaten)}</dd></div>
          <div class="tally__row tally__row--goal"><dt>Mục tiêu</dt><dd>${L.fmtInt(k.target)}</dd></div>
        </dl>
        <ul class="macros" aria-label="Đạm, bột, béo so với mức nên ăn">
          ${m.macros.map((x) => html`<li class="macro ${MACRO_CLASS[x.id]}" style="--fill:${Math.round(x.pct * 100)}%"><span class="macro__name">${x.label}</span><span class="macro__val"><b>${L.fmtInt(x.g)}</b> / ${L.fmtInt(x.ref)}${raw("&nbsp;")}g</span><span class="macro__bar"></span></li>`)}
        </ul>
      </div>
    </div>
    <div class="hero__ground">
      ${raw(plantSvg(stage, { size: 70, cls: "hero__plant" }))}
      <div class="hero__tip">
        <p id="coach">${tipText(m.coach)}</p>
        ${m.pendingCount > 0 ? html`<p class="hero__pending"><i aria-hidden="true"></i>Đang tính calo cho ${m.pendingCount} bữa…</p>` : ""}
      </div>
    </div>
  </section>`;
}

/* ---------------- lời nhắc về hôm qua ---------------- */
function recap(m) {
  if (!m.recap) return "";
  const good = m.recap.tone === "good";
  return html`<section class="recap recap--${good ? "good" : "calm"}" aria-label="Về hôm qua">
    <span class="recap__ico" aria-hidden="true">${good ? html`<svg viewBox="0 0 32 30"><use href="#sprout-ok"/></svg>` : ico("i-sunrise")}</span>
    <p class="recap__text">${m.recap.text}</p>
    <button class="x-btn" data-act="recap-x:${m.recap.key}" aria-label="Ẩn lời nhắc về hôm qua">${ico("i-close", "icon--sm")}</button>
  </section>`;
}

/* ---------------- lời nhắn ---------------- */
const TILTS = [-1.3, -0.6, 0.8, -1, 0.5, 1, -0.3];

function note(m) {
  if (!m.note) return "";
  const d = L.parseKey(m.key);
  const partner = String(S.settings.partner || "").trim();
  const len = m.note.text.length;
  const size = len > 110 ? "is-xlong" : len > 56 ? "is-long" : "";
  return html`<div class="note-stack">
    <section class="note ${partner ? "" : "note--unsigned"}" style="--tilt:${TILTS[d.getDate() % TILTS.length]}deg" aria-label="${m.note.label}">
      <svg class="note__grain" aria-hidden="true"><rect width="100%" height="100%" filter="url(#paper-grain)"/></svg>
      <svg class="note__tie" viewBox="0 0 56 64" aria-hidden="true">
        <circle class="note__hole" cx="38" cy="32" r="6"/>
        <path class="note__twine" d="M39 30.5C31 27.5 22 28.5 14 32M39 33.5C31 36.5 22 35.5 14 32"/>
        <path class="note__twine" d="M14 32C8 22 5 12 10 10c6-2 6 11 4 22zM14 32C8 42 5 52 10 54c6 2 6-11 4-22z"/>
        <path class="note__twine" d="M14 32C8 30 4 33 0 29M14 32C8 35 5 39 1 41"/>
        <circle class="f-clay" cx="14" cy="32" r="3.2"/>
      </svg>
      <p class="note__label"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-heart"/></svg><span>${m.note.label}</span></p>
      <p class="note__stamp" aria-label="ngày ${d.getDate()} tháng ${d.getMonth() + 1}">${d.getDate()}.${d.getMonth() + 1}</p>
      <p class="note__text ${size}" id="note">${m.note.text}</p>
      <svg class="note__sprig" viewBox="0 0 46 52" aria-hidden="true">
        <path class="ill-stem ill-stem--thin" d="M24 52C24 38 22 28 25 16"/>
        <use href="#leaf-shape" class="f-leaf" transform="translate(24 42) rotate(-150) scale(.46)"/>
        <use href="#leaf-shape" class="f-leaf-light" transform="translate(24 36) rotate(-30) scale(.46)"/>
        <use href="#flower" transform="translate(25 13) scale(1.15)"/>
      </svg>
      ${partner ? html`<p class="note__sign"><span>— ${partner}</span><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-heart"/></svg></p>` : ""}
    </section>
  </div>`;
}

/* ---------------- gợi ý một lần ---------------- */
function hints(m) {
  const list = [];
  if (m.hints.memory) list.push(html`<div class="hint hint--warn" role="status">
    <p class="hint__text">Trình duyệt đang không cho lưu lâu dài (có thể là chế độ riêng tư). Hãy mở app bằng trình duyệt thường để dữ liệu không mất.</p>
  </div>`);
  // hai gợi ý dưới đây chỉ hiện ở hôm nay: khi đang xem lại ngày cũ thì không chen vào
  if (m.isToday && m.hints.noKey) list.push(html`<div class="hint">
    <p class="hint__text">Chưa kết nối Claude nên app chưa tự tính calo từ ảnh.</p>
    <button class="hint__go" data-act="settings:ai">Kết nối</button>
    <button class="x-btn" data-act="hint-x:nokey" aria-label="Ẩn gợi ý kết nối Claude">${ico("i-close", "icon--sm")}</button>
  </div>`);
  if (m.isToday && !isStandalone() && !S.meta.seen["hint:install"]) {
    // iPhone/iPad: app trên màn hình chính lưu dữ liệu riêng và được giữ lâu dài, còn Safari có thể tự dọn dữ liệu của trang
    // lâu không mở. Nói đúng lý do, và nút luôn dẫn tới phần hướng dẫn trong Cài đặt (nơi có các bước mang dữ liệu sang).
    const ios = isIOS();
    const ask = !ios && canPromptInstall();
    list.push(html`<div class="hint">
      <p class="hint__text">${ios ? "Cài app lên màn hình chính để dữ liệu được giữ lâu dài." : "Cài app lên màn hình chính để mở bằng một chạm."}</p>
      <button class="hint__go" data-act="${ask ? "install" : "settings:install"}">${ask ? "Cài app" : "Xem cách cài"}</button>
      <button class="x-btn" data-act="hint-x:install" aria-label="Ẩn gợi ý cài app">${ico("i-close", "icon--sm")}</button>
    </div>`);
  }
  return list.length ? html`<div class="hints">${list}</div>` : "";
}

/* ---------------- bữa ăn ---------------- */
function mealRow(m, g, x) {
  const state = x.pending ? "is-pending" : x.failed ? "is-failed" : "";
  return html`<button class="meal meal--logged ${state}" data-act="meal:${m.key}:${x.id}">
    <span class="meal__photo" ${x.ph ? raw("data-photo-slot") : ""}>
      ${raw(mealStandIn(x.type))}
      ${x.ph ? html`<img data-ph="${x.ph}" alt="">` : ""}
      ${x.pending ? html`<i class="meal__scan" aria-hidden="true"></i>` : ""}
    </span>
    <span class="meal__body">
      <span class="meal__when">${ico(TYPE_ICON[g.id] || "i-apple", "icon--sm")}${g.label}${x.t ? " · " + x.t : ""}</span>
      <span class="meal__name">${x.name}</span>
      ${x.pending ? html`<span class="meal__state">${x.ph ? "Đang nhận diện…" : "Đang tính calo…"}</span>` : x.failed ? html`<span class="meal__state meal__state--failed">Chưa tính được · chạm để xử lý</span>` : ""}
    </span>
    ${x.pending ? html`<span class="meal__wait" aria-hidden="true"></span>`
      : x.failed ? html`<span class="meal__alert" aria-hidden="true">!</span>`
      : html`<span class="meal__kcal"><b>${L.fmtInt(x.kcal)}</b>kcal</span>`}
  </button>`;
}

function emptyGroup(m, g) {
  if (g.id === "vat") {
    return html`<button class="meal meal--quiet" data-act="text:vat">
      <span class="meal__mark">${ico("i-apple")}</span>
      <span class="meal__body"><span class="meal__name">${g.label}</span><span class="meal__none">chưa có gì</span></span>
      <span class="meal__add">${ico("i-plus", "icon--sm")}Thêm</span>
    </button>`;
  }
  const what = g.label.toLowerCase();
  if (m.isToday && g.id === m.nextSlot) {
    return html`<button class="meal meal--empty" data-act="camera:${g.id}">
      <span class="meal__slot">${ico("i-camera")}</span>
      <span class="meal__body">
        <span class="meal__when">${ico(TYPE_ICON[g.id], "icon--sm")}${g.label}</span>
        <span class="meal__name">Chụp ${what}</span>
        ${m.kcal.left > 0 ? html`<span class="meal__hint">${g.id === "toi" ? `Còn ${L.fmtInt(m.kcal.left)} kcal cho bữa này` : `Hôm nay còn ${L.fmtInt(m.kcal.left)} kcal`}</span>` : ""}
      </span>
      <span class="meal__go" aria-hidden="true">${ico("i-chevron", "icon--md")}</span>
    </button>`;
  }
  return html`<button class="meal meal--quiet" data-act="camera:${g.id}" aria-label="${g.label}, chưa ghi. Chụp ${what}">
    <span class="meal__mark">${ico(TYPE_ICON[g.id])}</span>
    <span class="meal__body"><span class="meal__name">${g.label}</span><span class="meal__none">chưa ghi</span></span>
    <span class="meal__add">${ico("i-camera", "icon--sm")}Chụp</span>
  </button>`;
}

function meals(m) {
  return html`<section class="meals" aria-label="Bữa ăn ${m.dayTitle}">
    <header class="section-head">
      <h2 class="section-title">Bữa ăn ${m.dayTitle}</h2>
      <p class="section-meta">${m.mealCount ? html`${m.mealCount} bữa · <b class="nowrap">${L.fmtInt(m.kcal.eaten)} kcal</b>` : "Chưa ghi bữa nào"}</p>
    </header>
    ${m.groups.map((g) => (g.meals.length ? g.meals.map((x) => mealRow(m, g, x)) : emptyGroup(m, g)))}
    <div class="meal-actions">
      <button class="btn btn--ghost" data-act="pick">${ico("i-image", "icon--md")}Chọn ảnh có sẵn</button>
      <button class="btn btn--ghost" data-act="text">${ico("i-pencil", "icon--md")}Gõ tên món</button>
    </div>
  </section>`;
}

/* ---------------- gợi ý ăn gì ---------------- */
const SLOT_NAME = { sang: "bữa sáng", trua: "bữa trưa", toi: "bữa tối" };
function suggest(m) {
  const s = m.suggest;
  if (!s) return "";
  const main = SLOT_NAME[s.slot];
  return html`<section class="usual suggest" aria-label="Gợi ý món ăn">
    <header class="section-head">
      <h2 class="section-title">${main ? "Gợi ý cho " + main : "Ăn nhẹ gì nhỉ?"}</h2>
      <p class="section-meta">${main ? html`khoảng <b class="nowrap">${L.fmtInt(s.budget)} kcal</b>` : html`còn <b class="nowrap">${L.fmtInt(m.kcal.left)} kcal</b>`}</p>
    </header>
    <div class="sugs">
      ${s.items.map((x, i) => html`<button class="fav sug" data-act="sug:${i}" aria-label="Ghi ${x.name}, ${L.fmtInt(x.kcal)} kcal">
        <span class="chip__plus">${ico("i-plus", "icon--sm")}</span>
        <span class="fav__body"><span class="fav__name">${x.name}</span><span class="sug__q">${x.own ? "Món " + m.you + " hay ăn" : x.q}</span></span>
        <span class="sug__kcal"><b>${L.fmtInt(x.kcal)}</b>kcal</span>
      </button>`)}
    </div>
    <div class="sug-foot">
      <p class="fine">Chạm để ghi luôn. Số kcal là ước tính cho một suất thường gặp.</p>
      ${s.more ? html`<button class="sug-more" data-act="sug-more">Đổi món</button>` : ""}
    </div>
  </section>`;
}

/* ---------------- nhận xét cuối ngày ---------------- */
function review(m) {
  const r = m.review;
  if (!r.canAsk && !r.has) return "";
  const busy = isReviewing(m.key);
  const next = m.isToday ? "Ngày mai thử" : "Ngày kế tiếp thử";
  if (!r.has) {
    return html`<section class="review" aria-label="Nhận xét của Claude">
      <div class="review__ask">
        <p class="review__lead">${busy ? "Claude đang nhìn lại các bữa của " + m.dayTitle + "…" : "Nhờ Claude nhìn lại các bữa của " + m.dayTitle + " và gợi ý cho ngày mai."}</p>
        <button class="btn btn--ghost" data-act="review" ${busy ? raw('disabled aria-busy="true"') : ""}>${ico("i-sprout", "icon--md")}${busy ? "Đang nhận xét…" : "Nhận xét " + m.dayTitle}</button>
      </div>
      <p class="fine">Chỉ gửi tên món và số calo, không gửi ảnh.</p>
    </section>`;
  }
  const rv = r.rv;
  return html`<section class="review" aria-label="Nhận xét của Claude">
    <header class="section-head">
      <h2 class="section-title">Nhìn lại ${m.dayTitle}</h2>
      <p class="section-meta">Claude nhận xét</p>
    </header>
    <div class="review__card">
      <p class="review__text">${rv.c}</p>
      ${rv.a ? html`<p class="review__adjust"><b>Thêm bớt:</b> ${rv.a}</p>` : ""}
      ${rv.t && rv.t.length ? html`<div class="review__next">
        <h3 class="review__sub">${next}</h3>
        <ul class="review__list">${rv.t.map((x) => html`<li>
          <span class="review__slot">${SLOT_SHORT[x.m] || ""}</span>
          <span class="review__dish">${x.d}${x.w ? html`<small>${x.w}</small>` : ""}</span>
          ${x.k ? html`<span class="review__kcal"><b>${L.fmtInt(x.k)}</b>kcal</span>` : ""}
        </li>`)}</ul>
      </div>` : ""}
    </div>
    <div class="sug-foot">
      <p class="fine">${r.stale ? "Bữa ăn đã đổi sau lần nhận xét này. " : ""}Gợi ý ăn uống thông thường, không thay lời khuyên của bác sĩ.</p>
      ${r.canAsk ? html`<button class="sug-more" data-act="review" ${busy ? raw('disabled aria-busy="true"') : ""}>${busy ? "Đang xem…" : "Nhận xét lại"}</button>` : ""}
    </div>
  </section>`;
}
const SLOT_SHORT = { sang: "Sáng", trua: "Trưa", toi: "Tối" };

/* ---------------- món hay ăn ---------------- */
function usual(m) {
  if (!m.favs.length) return "";
  return html`<section class="usual" aria-label="Món hay ăn">
    <header class="section-head">
      <h2 class="section-title">Món hay ăn</h2>
      <p class="section-meta">${m.isToday ? "Chạm để ghi ngay" : "Chạm để ghi vào " + m.dayTitle}</p>
    </header>
    <div class="favs" id="favs">
      ${m.favs.map((f) => html`<button class="fav ${f.pinned ? "is-pinned" : ""}" data-act="fav:${f.i}" aria-label="Ghi ${f.name}, ${L.fmtInt(f.kcal)} kcal${f.pinned ? ", món đã ghim" : ""}">
        <span class="chip__plus">${ico("i-plus", "icon--sm")}</span>
        <span class="fav__body"><span class="fav__name">${f.name}</span><span class="fav__kcal">${L.fmtInt(f.kcal)} kcal</span></span>
        ${f.pinned ? html`<svg class="fav__pin" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-heart"/></svg>` : ""}
      </button>`)}
    </div>
  </section>`;
}

/* ---------------- nước ---------------- */
const WAVE = "M0 9V5c16-7 33-7 49 0s33 7 49 0 33-7 49 0 33 7 49 0 33-7 49 0 33 7 49 0 33-7 49 0 33 7 47 0V9z";
const DROP = raw('<svg viewBox="0 0 28 34" aria-hidden="true"><path class="drop__shape" d="M14 3c5 6.2 9.5 11 9.5 17a9.5 9.5 0 0 1-19 0c0-6 4.5-10.8 9.5-17z"/><path class="drop__shine" d="M9 20.5a5.2 5.2 0 0 0 3.2 4.6"/><path class="drop__plus" d="M14 16.5v7M10.5 20h7"/></svg>');

function water(m) {
  const w = m.water;
  if (!w.on) return "";
  const goal = Math.max(1, w.goal || 8);
  const count = L.clamp(w.count, 0, goal);
  const cols = goal <= 8 ? goal : Math.ceil(goal / 2);
  return html`<section class="water ${count >= goal ? "is-done" : ""}" id="water" aria-label="Nước ${m.dayTitle}">
    <svg class="water__edge" viewBox="0 0 390 9" preserveAspectRatio="none" aria-hidden="true"><path d="${WAVE}"/></svg>
    <div class="water__head">
      <svg class="water__can" viewBox="0 0 50 38" aria-hidden="true">
        <path d="M15 15C15 5 29 5 29 15" fill="none" stroke="var(--water)" stroke-width="2.6" stroke-linecap="round" opacity=".6"/>
        <path d="M12 19C4 19 4 31 12 31" fill="none" stroke="var(--water)" stroke-width="3" stroke-linecap="round"/>
        <path class="f-water" d="M31 22l8.6-9.4 4 3.6L33 29.5z"/>
        <path class="f-water" d="M12 15h20v16a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4z"/>
        <path class="ill-gloss" d="M12 15h5.5v20H16a4 4 0 0 1-4-4z"/>
        <rect class="f-sun" x="12" y="21" width="20" height="3.4"/>
        <ellipse class="f-sun" cx="42.4" cy="13.6" rx="2.5" ry="6" transform="rotate(-42 42.4 13.6)"/>
        <g class="f-water"><path d="M46.5 20.5c1.1 1.5 1.9 2.5 1.9 3.6a1.9 1.9 0 0 1-3.8 0c0-1.1.8-2.1 1.9-3.6z"/><circle cx="42.6" cy="27.5" r="1.7"/><circle cx="47.8" cy="31.5" r="1.5"/></g>
      </svg>
      <h2 class="water__title">${count >= goal ? "Đủ nước rồi, tuyệt quá" : "Tưới nước cho mình"}</h2>
      <p class="water__count"><b>${count}</b>/${goal} ly nước</p>
    </div>
    <div class="water__drops" style="grid-template-columns:repeat(${cols}, 1fr)">
      ${Array.from({ length: goal }, (_, i) => {
        const full = i < count, next = i === count;
        return html`<button class="drop ${full ? "is-full" : next ? "is-next" : ""}" data-act="water:${i + 1}" aria-pressed="${full ? "true" : "false"}" aria-label="${full ? `Ly ${i + 1}, đã uống` : next ? `Thêm ly ${i + 1}` : `Ly ${i + 1}`}">${DROP}</button>`;
      })}
    </div>
    <svg class="water__edge water__edge--end" viewBox="0 0 390 9" preserveAspectRatio="none" aria-hidden="true"><path d="${WAVE}"/></svg>
  </section>`;
}

/* ---------------- cả màn ---------------- */
export function viewToday() {
  const now = new Date();
  const hour = now.getHours();
  const m = todayModel(S, ctx(), { hour, minute: now.getMinutes(), weekAnchor, sugOffset });
  sugShown = m.suggest ? { slot: m.suggest.slot, items: m.suggest.items } : { slot: null, items: [] };
  return html`
    ${header(m, hour)}
    ${weekStrip(m)}
    ${hero(m, hour)}
    ${recap(m)}
    ${note(m)}
    ${hints(m)}
    ${suggest(m)}
    ${meals(m)}
    ${review(m)}
    ${usual(m)}
    ${water(m)}`;
}
