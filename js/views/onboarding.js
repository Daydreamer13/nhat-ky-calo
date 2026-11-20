// onboarding.js — bốn bước làm quen lần đầu: chào → cơ thể → mục tiêu → kết nối Claude.

import { S, saveProfile, setSettings, importData } from "../state.js";
import * as L from "../logic.js";
import { html, raw, $, setHtml, withFocus, toast, readTextFile, isIOS, isStandalone } from "../ui.js";
import { icon, plantSvg } from "../art.js";
import { MODELS, testKey, aiErrorText } from "../ai.js";
import { confetti } from "../confetti.js";
import { MEDICAL_NOTE, KEY_SHAPE_NOTE, iosInstallSteps } from "./settings.js";

const blankAnswers = () => ({ name: "", sex: "f", birthYear: "", height: "", weight: "", goalWeight: "", activity: 1.375, pace: 0.5, customTarget: "" });
const ob = {
  step: 0,
  v: blankAnswers(),
  key: "",
  errors: {},
  test: null, // null | 'busy' | 'ok' | { error }
  warn: false, // chuỗi trong ô khoá không giống khoá Claude (chỉ nhắc nhẹ)
};
const STEP_FIELDS = [[], ["birthYear", "height"], ["weight", "goalWeight", "activity", "pace"], []];
const LAST = 3;
const P = (b) => (b ? "true" : "false");
let testRun = 0; // tăng mỗi khi khoá đổi: kết quả của lượt kiểm tra cũ về muộn sẽ bị bỏ qua

/* Nút Back của Android: mỗi lần sang bước mới, app thêm một bước vào lịch sử trình duyệt, nên Back lùi về bước trước
   thay vì thoát app. SID phân biệt các bước của lần mở trang này với những bước còn sót từ lần trước (sau khi tải lại trang). */
const SID = Math.random().toString(36).slice(2);
const mine = (s) => !!s && s.nkcSid === SID && typeof s.nkcOb === "number";
// Trang vừa được tải lại giữa lúc làm quen (ví dụ Android nạp lại trang đã bị dọn khi người dùng sang app khác chép khoá): mục lịch sử
// đang đứng là bước thứ nkcOb của LẦN TRƯỚC, phía dưới còn nkcOb − 1 bước cũ nữa. Lùi hết về mục gốc ngay, kẻo mấy lần bấm
// Back đầu tiên không làm gì. (onPop coi mục không phải của lần mở này là màn chào, đúng với màn đang hiện, nên không vẽ lại.)
try {
  const s0 = history.state;
  if (s0 && typeof s0.nkcOb === "number" && s0.nkcOb > 0 && s0.nkcSid !== SID) history.go(-s0.nkcOb);
} catch {}
let done = false;    // đã bấm Hoàn tất: các bước lịch sử đang được trả lại, không vẽ lại màn làm quen nữa
let backing = false; // đã gọi history.back(), đang chờ trình duyệt báo lại (chặn chạm hai lần liền)

function preview() {
  const r = L.validateProfile(ob.v, S.today);
  if (!r.ok) return null;
  const p = { ...r.value, startWeight: r.value.weight };
  const t = L.targetOf(p, r.value.weight, S.today);
  return { ...t, weeks: L.etaWeeks(r.value.weight, r.value.goalWeight, t.tdee, t.target), goal: r.value.goalWeight, maintain: t.mode === "maintain" };
}

function field(name, label, attrs, hint) {
  const err = ob.errors[name];
  const id = `ob-${name}`;
  return html`<div class="field ${err ? "has-err" : ""}">
    <label class="field-label" for="${id}">${label}</label>
    <input class="input" id="${id}" data-f="${name}" value="${ob.v[name]}" ${raw(attrs)} autocomplete="off" ${err ? raw('aria-invalid="true"') : ""} ${err || hint ? raw(`aria-describedby="${id}-note"`) : ""}>
    ${err ? html`<span class="field-err" id="${id}-note">${err}</span>` : hint ? html`<span class="field-hint" id="${id}-note">${hint}</span>` : ""}
  </div>`;
}

/** iPhone, đang mở trong Safari: nhắc cài lên Màn hình chính TRƯỚC khi nhập gì, vì app đã cài có kho dữ liệu riêng. */
function iosNotice() {
  if (!isIOS() || isStandalone()) return "";
  return html`<div class="banner ob-ios">
    <p><b>Đang dùng iPhone?</b> Hãy thêm app vào Màn hình chính trước, rồi mở từ biểu tượng đó để thiết lập. Dữ liệu nhập trong Safari không tự chuyển sang app đã cài.</p>
    <details class="fold"><summary>Xem cách cài</summary><ol class="steps">${iosInstallSteps()}</ol></details>
  </div>`;
}

function stepWelcome() {
  return html`
    <div class="ob-hero">${raw(plantSvg(5, { size: 168 }))}</div>
    <h1 class="ob-title" tabindex="-1" aria-describedby="obPos">Nhật Ký Calo</h1>
    <p class="ob-lead">Chụp bữa ăn là biết ngay bao nhiêu calo. Nhẹ nhàng mỗi ngày, đến đích lúc nào không hay.</p>
    ${iosNotice()}
    <ul class="ob-points">
      <li>${raw(icon("camera"))}<span>Chụp món ăn, app tự nhận diện từng món và tính calo.</span></li>
      <li>${raw(icon("ring"))}<span>Luôn biết hôm nay còn ăn được bao nhiêu.</span></li>
      <li>${raw(icon("sprout"))}<span>Mỗi ngày đạt mục tiêu, cây hoa của bạn lớn thêm một chút.</span></li>
    </ul>
    <div class="ob-actions">
      <button class="btn primary block" data-ob="next">Bắt đầu</button>
      <button class="btn ghost block" data-ob="restore">Đã có file sao lưu hoặc file thiết lập</button>
    </div>`;
}

function stepBody() {
  return html`
    <h1 class="ob-title" tabindex="-1" aria-describedby="obPos">Làm quen nhé</h1>
    <p class="ob-lead">Vài thông tin để tính mức calo phù hợp với cơ thể bạn.</p>
    <div class="stack">
      ${field("name", "Tên gọi", 'type="text" maxlength="30" placeholder="Ví dụ: Linh" enterkeyhint="next"', "Để app chào đúng tên.")}
      <div class="field">
        <span class="field-label">Giới tính</span>
        <div class="seg" role="group" aria-label="Giới tính">
          <button type="button" class="seg-btn" data-ob="sex:f" aria-pressed="${P(ob.v.sex === "f")}">Nữ</button>
          <button type="button" class="seg-btn" data-ob="sex:m" aria-pressed="${P(ob.v.sex === "m")}">Nam</button>
        </div>
      </div>
      <div class="grid2">
        ${field("birthYear", "Năm sinh", 'type="text" inputmode="numeric" maxlength="4" placeholder="1995" enterkeyhint="next"')}
        ${field("height", "Chiều cao (cm)", 'type="text" inputmode="decimal" maxlength="5" placeholder="158" enterkeyhint="done"')}
      </div>
    </div>
    <div class="ob-actions">
      <button class="btn primary block" data-ob="next">Tiếp tục</button>
    </div>`;
}

function previewCard() {
  const p = preview();
  if (!p) return html`<div class="banner" data-part="preview"><p>Điền cân nặng hiện tại và cân mong muốn để xem mức calo mỗi ngày.</p></div>`;
  return html`<div class="banner good" data-part="preview">
    <p class="banner-big"><span class="num">${L.fmtInt(p.target)}</span> kcal mỗi ngày</p>
    <p>Cơ thể bạn đốt khoảng ${L.fmtInt(p.tdee)} kcal mỗi ngày.
      ${p.maintain ? "Bạn đang ở đúng cân mong muốn, nên đây là mức để giữ cân."
        : p.weeks ? `Ăn ở mức này, bạn tới ${L.fmt1(p.goal)} kg sau khoảng ${p.weeks} tuần.` : ""}
      ${p.floored ? "App không đặt mức thấp hơn thế này để bạn vẫn đủ chất." : ""}</p>
  </div>`;
}

function stepGoal() {
  return html`
    <h1 class="ob-title" tabindex="-1" aria-describedby="obPos">Mục tiêu của bạn</h1>
    <p class="ob-lead">Giảm chậm mà đều thì giữ được lâu.</p>
    <div class="stack">
      <div class="grid2">
        ${field("weight", "Cân hiện tại (kg)", 'type="text" inputmode="decimal" maxlength="6" placeholder="60" enterkeyhint="next"')}
        ${field("goalWeight", "Cân mong muốn (kg)", 'type="text" inputmode="decimal" maxlength="6" placeholder="54" enterkeyhint="done"')}
      </div>
      <div class="field">
        <span class="field-label">Mức vận động thường ngày</span>
        <div class="opts" role="group" aria-label="Mức vận động thường ngày">
          ${L.ACTIVITY_LEVELS.map((a) => html`<button type="button" class="opt" data-ob="act:${a.v}" aria-pressed="${P(ob.v.activity === a.v)}"><b>${a.label}</b><span>${a.hint}</span></button>`)}
        </div>
      </div>
      <div class="field">
        <span class="field-label">Tốc độ giảm</span>
        <div class="seg three" role="group" aria-label="Tốc độ giảm">
          ${L.PACES.map((p) => html`<button type="button" class="seg-btn" data-ob="pace:${p.v}" aria-pressed="${P(ob.v.pace === p.v)}"><b>${p.label}</b><small>${p.hint}</small></button>`)}
        </div>
      </div>
      ${previewCard()}
      <p class="fine">${MEDICAL_NOTE}</p>
    </div>
    <div class="ob-actions">
      <button class="btn primary block" data-ob="next">Tiếp tục</button>
    </div>`;
}

function testLine() {
  if (ob.test === "busy") return html`<p class="field-hint">Đang kiểm tra…</p>`;
  if (ob.test === "ok") return html`<p class="field-ok">${raw(icon("check"))} Kết nối tốt.</p>`;
  if (ob.test && ob.test.error) return html`<p class="field-err">${ob.test.error}</p>`;
  if (ob.warn) return html`<p class="field-warn">${KEY_SHAPE_NOTE}</p>`;
  return html`<p class="field-hint">Khoá bắt đầu bằng “sk-ant-”. Khoá chỉ lưu trên máy này.</p>`;
}
const finishLabel = () => (L.tidyApiKey(ob.key) ? "Hoàn tất" : "Để sau, vào app");

function stepAi() {
  return html`
    <h1 class="ob-title" tabindex="-1" aria-describedby="obPos">Kết nối Claude</h1>
    <p class="ob-lead">Claude là “đôi mắt” nhìn ảnh và tính calo. App cần một khoá API của Anthropic để gọi Claude; mỗi tấm ảnh tốn khoảng 1.000 đồng (có mức rẻ hơn trong Cài đặt), trừ vào tài khoản của khoá đó.</p>
    <div class="stack">
      <div class="field">
        <label class="field-label" for="obKey">Khoá Claude</label>
        <span class="input-row">
          <input class="input" id="obKey" type="password" value="${ob.key}" placeholder="sk-ant-…" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="obKeyNote">
          <button type="button" class="btn soft sm" data-ob="paste">Dán</button>
        </span>
        <div data-part="test" id="obKeyNote" role="status">${testLine()}</div>
      </div>
      <button type="button" class="btn soft block" data-ob="test" aria-disabled="${P(ob.test === "busy")}">Kiểm tra khoá</button>
      <div class="banner">
        <p>Chưa có khoá? Bỏ qua bước này cũng được: bạn vẫn chụp ảnh, nhập calo bằng tay và theo dõi đầy đủ. Khoá thêm sau trong Cài đặt.</p>
      </div>
    </div>
    <div class="ob-actions">
      <button class="btn primary block" data-ob="finish">${finishLabel()}</button>
    </div>`;
}

/** @param {boolean} enter  vừa sang bước này: nội dung trượt nhẹ lên (vẽ lại tại chỗ thì không, để màn hình không nháy) */
function view(enter) {
  const body = [stepWelcome, stepBody, stepGoal, stepAi][ob.step]();
  return html`<div class="ob ${enter ? "is-enter" : ""}" data-step="${ob.step}">
    <div class="ob-top">
      ${ob.step > 0 ? html`<button class="icon-btn" data-ob="back" aria-label="Quay lại">${raw(icon("chev-left"))}</button>` : html`<span class="icon-btn ghosted"></span>`}
      <div class="ob-dots" aria-hidden="true">${[0, 1, 2, 3].map((i) => html`<i class="${i === ob.step ? "on" : i < ob.step ? "done" : ""}"></i>`)}</div>
      <p class="ob-vh" id="obPos">Bước ${ob.step + 1} trên ${LAST + 1}</p>
      <span class="icon-btn ghosted"></span>
    </div>
    <div class="ob-body">${body}</div>
  </div>`;
}

let rootEl = null;
let paintedStep = -1; // bước đang hiện trên màn hình (−1: chưa vẽ lần nào)
function paint() {
  if (!rootEl) return;
  const first = paintedStep < 0;
  if (paintedStep === ob.step) {
    // vẽ lại tại chỗ (chọn giới tính, mức vận động, báo lỗi…): giữ nguyên vị trí cuộn và trả tiêu điểm về đúng nút vừa bấm
    const before = document.activeElement;
    const opened = !!$(".ob-ios details[open]", rootEl); // phần "Xem cách cài" đang mở thì vẫn mở
    withFocus(rootEl, () => setHtml(rootEl, view(false)));
    if (opened) { const d = $(".ob-ios details", rootEl); if (d) d.open = true; }
    const now = document.activeElement;
    if (now && now !== before && now.tagName === "INPUT" && rootEl.contains(now)) { try { now.setSelectionRange(now.value.length, now.value.length); } catch {} }
    return;
  }
  paintedStep = ob.step;
  setHtml(rootEl, view(true));
  window.scrollTo(0, 0);
  // sang bước khác: đưa tiêu điểm tới tiêu đề của bước mới để trình đọc màn hình đọc "Bước N trên 4" (lần vẽ đầu tiên thì để yên)
  if (!first) { const t = $(".ob-title", rootEl); if (t) t.focus({ preventScroll: true }); }
}
/** Cập nhật tại chỗ dòng trạng thái của ô khoá, nút kiểm tra và chữ trên nút cuối (không vẽ lại cả bước). */
function paintKey() {
  if (!rootEl) return;
  const box = $('[data-part="test"]', rootEl);
  const line = testLine();
  if (box && box.innerHTML !== line.s && box._nkc !== line.s) { setHtml(box, line); box._nkc = line.s; } // chỉ đổi khi nội dung đổi, để trình đọc màn hình không đọc lặp
  const tb = $('[data-ob="test"]', rootEl);
  if (tb) tb.setAttribute("aria-disabled", P(ob.test === "busy"));
  const fin = $('[data-ob="finish"]', rootEl);
  if (fin) fin.textContent = finishLabel();
}
/** Dọn chuỗi trong ô khoá (bỏ ngoặc kép, chữ thừa, dấu xuống dòng dính theo lúc dán) rồi hiện lại đúng chuỗi sẽ được lưu. */
function tidyKey() {
  ob.key = L.tidyApiKey(ob.key);
  ob.warn = !!ob.key && !L.looksLikeApiKey(ob.key);
  const i = rootEl ? $("#obKey", rootEl) : null;
  if (i && i.value !== ob.key) i.value = ob.key;
  return ob.key;
}

function validateStep() {
  const r = L.validateProfile(ob.v, S.today);
  ob.errors = {};
  for (const f of STEP_FIELDS[ob.step]) if (r.errors[f]) ob.errors[f] = r.errors[f];
  return Object.keys(ob.errors).length === 0;
}

async function onClick(e) {
  const b = e.target.closest("[data-ob]");
  if (!b || !rootEl || !rootEl.contains(b)) return;
  const [act, arg] = b.dataset.ob.split(":");
  if (act === "next") {
    if (!validateStep()) { paint(); const bad = $(".has-err .input", rootEl); if (bad) bad.focus(); return; }
    ob.step = Math.min(LAST, ob.step + 1);
    try { history.pushState({ nkcOb: ob.step, nkcSid: SID }, ""); } catch {}
    paint();
  } else if (act === "back") {
    if (backing) return;
    // lùi qua lịch sử, để mũi tên trên màn hình và nút Back của máy luôn đi cùng một đường (onPop vẽ lại)
    if (ob.step > 0 && mine(history.state)) { backing = true; history.back(); }
    else { ob.errors = {}; ob.step = Math.max(0, ob.step - 1); paint(); }
  } else if (act === "sex") {
    ob.v.sex = arg; paint();
  } else if (act === "act") {
    ob.v.activity = Number(arg); paint();
  } else if (act === "pace") {
    ob.v.pace = Number(arg); paint();
  } else if (act === "paste") {
    let t = null;
    try { t = L.tidyApiKey(await navigator.clipboard.readText()); } catch {}
    if (!rootEl) return;
    if (t === null) { const i = $("#obKey", rootEl); if (i) i.focus(); toast("Hãy nhấn giữ vào ô rồi chọn Dán."); return; }
    if (t) { testRun++; ob.key = t; ob.test = null; tidyKey(); paintKey(); }
  } else if (act === "test") {
    if (ob.test === "busy") return;
    const key = tidyKey();
    if (!key) { ob.test = { error: "Chưa có khoá để kiểm tra." }; paintKey(); return; }
    const run = ++testRun;
    ob.test = "busy"; paintKey();
    let res;
    try { await testKey({ apiKey: key, model: MODELS[0].id }); res = "ok"; }
    catch (err) { res = { error: aiErrorText(err && err.code) }; }
    if (run !== testRun) return; // khoá đã đổi (hoặc đã rời màn làm quen) trong lúc chờ
    ob.test = res; paintKey();
  } else if (act === "finish") {
    const r = saveProfile(ob.v);
    if (!r.ok) {
      ob.errors = r.errors;
      let to = STEP_FIELDS.findIndex((fs) => fs.some((f) => r.errors[f]));
      if (to < 0) to = 1;
      // lùi lịch sử về đúng bước có lỗi, để số bước Back còn lại vẫn khớp với màn hình (onPop thấy đã đúng bước nên không vẽ lại)
      if (to < ob.step && mine(history.state)) history.go(to - ob.step);
      ob.step = to;
      paint();
      const bad = $(".has-err .input", rootEl); if (bad) bad.focus();
      return;
    }
    const key = L.tidyApiKey(ob.key);
    if (key) setSettings({ apiKey: key });
    // trả lại các bước lịch sử đã thêm, để ở màn chính nút Back không phải bấm "hụt" mấy lần
    done = true;
    if (ob.step > 0 && mine(history.state)) history.go(-ob.step);
    confetti({ colors: themeColors() });
    toast(ob.v.name ? `Xong rồi, ${ob.v.name.trim()}! Chụp bữa đầu tiên nhé.` : "Xong rồi! Chụp bữa đầu tiên nhé.");
  } else if (act === "restore") {
    const input = $("#importInput");
    if (input) input.click();
  }
}
function onInput(e) {
  const t = e.target;
  if (!rootEl || !rootEl.contains(t)) return;
  if (t.dataset && t.dataset.f) {
    ob.v[t.dataset.f] = t.value;
    if (ob.errors[t.dataset.f]) {
      delete ob.errors[t.dataset.f];
      const f = t.closest(".field");
      if (f) { f.classList.remove("has-err"); f.querySelector(".field-err")?.remove(); }
      t.removeAttribute("aria-invalid"); t.removeAttribute("aria-describedby");
    }
    const pv = $('[data-part="preview"]', rootEl);
    if (pv) pv.outerHTML = previewCard().s;
  } else if (t.id === "obKey") {
    ob.key = t.value;
    if (ob.test || ob.warn) { testRun++; ob.test = null; ob.warn = false; }
    paintKey();
  }
}
/**
 * Rời ô khoá: dọn chuỗi vừa gõ/dán. Sự kiện này đến ngay giữa lượt chạm kế tiếp, nên ở đây không được làm gì khiến
 * các nút xê dịch: dòng nhắc (có thể dài thêm một dòng, đẩy nút "Kiểm tra khoá" xuống) chỉ đổi sau khi lượt chạm đó đã tới nơi.
 */
function onChange(e) {
  const t = e.target;
  if (!rootEl || !rootEl.contains(t) || t.id !== "obKey") return;
  ob.key = t.value;
  tidyKey();
  setTimeout(paintKey, 300);
}
function onKey(e) {
  if (e.key !== "Enter" || !rootEl || !rootEl.contains(e.target) || e.target.tagName !== "INPUT") return;
  e.preventDefault();
  const inputs = [...rootEl.querySelectorAll("input.input")];
  const i = inputs.indexOf(e.target);
  if (i >= 0 && i < inputs.length - 1) inputs[i + 1].focus();
  else e.target.blur();
}
/** Nút Back/Forward của trình duyệt: hiện đúng bước mà mục lịch sử hiện tại ghi; mục không phải của lần mở này thì coi là màn chào. */
function onPop() {
  backing = false;
  if (!rootEl || done) return;
  const s = history.state;
  const to = mine(s) ? L.clamp(s.nkcOb, 0, LAST) : 0;
  if (to === ob.step) return;
  ob.errors = {};
  ob.step = to;
  paint();
}

export function themeColors() {
  const cs = getComputedStyle(document.documentElement);
  const pickc = (n) => cs.getPropertyValue(n).trim();
  const list = ["--confetti-1", "--confetti-2", "--confetti-3", "--confetti-4", "--confetti-5"].map(pickc).filter(Boolean);
  return list.length ? list : undefined;
}

let bound = false;
export function renderOnboarding(root) {
  if (rootEl !== root) { rootEl = root; paintedStep = -1; done = false; backing = false; } // vừa vào màn làm quen
  if (!bound) {
    bound = true;
    document.addEventListener("click", onClick);
    document.addEventListener("input", onInput);
    document.addEventListener("change", onChange);
    document.addEventListener("keydown", onKey);
    window.addEventListener("popstate", onPop);
  }
  paint();
}
/**
 * Rời màn làm quen (vừa hoàn tất, hoặc vừa khôi phục từ file). Xoá sạch những gì đã gõ — kể cả khoá Claude — để nếu sau đó
 * người dùng "Xoá toàn bộ dữ liệu" thì màn làm quen mở lại từ đầu, không còn sót câu trả lời hay khoá cũ.
 */
export function leaveOnboarding() {
  // rời đi mà không qua nút Hoàn tất: cũng trả lại các bước lịch sử đã thêm
  if (!done && ob.step > 0 && mine(history.state)) history.go(-ob.step);
  rootEl = null;
  paintedStep = -1;
  done = false;
  backing = false;
  testRun++;
  Object.assign(ob, { step: 0, v: blankAnswers(), key: "", errors: {}, test: null, warn: false });
}

/** Khôi phục từ file ngay ở màn chào (dùng chung ô chọn file với Cài đặt). */
export async function restoreFromFile(file) {
  let text;
  try { text = await readTextFile(file); } catch { toast("Không đọc được file này."); return false; }
  const r = await importData(text);
  if (!r.ok) { toast(r.error); return false; }
  toast(r.setup ? "Đã nạp thiết lập. Bắt đầu từ hôm nay nhé." : `Đã khôi phục ${r.days} ngày nhật ký.`);
  return true;
}
