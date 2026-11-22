// settings.js — tấm Cài đặt: hồ sơ, kết nối Claude, lời nhắn và quà, giao diện, dữ liệu, cài app.

import { S, ctx, saveProfile, setSettings, exportData, importData, wipeAll } from "../state.js";
import * as L from "../logic.js";
import { NOTE_IDEAS, REWARD_IDEAS, noteLabel } from "../words.js";
import { html, raw, $, setHtml, withFocus, openSheet, closeAllSheets, toast, dropToast, saveFile, readTextFile, canPromptInstall, promptInstall, isStandalone, isIOS } from "../ui.js";
import { icon } from "../art.js";
import { MODELS, testKey, aiErrorText } from "../ai.js";

export const APP_VERSION = "1.2.0";
/** Lời dặn sức khoẻ: hiện ở màn làm quen, cuối nhóm Hồ sơ và trong Giới thiệu. */
export const MEDICAL_NOTE = "Nếu đang mang thai, cho con bú hoặc có bệnh cần ăn theo chỉ dẫn, hãy hỏi bác sĩ trước khi ăn kiêng.";
/** Nhắc nhẹ khi chuỗi trong ô khoá không giống khoá Claude (vẫn cho lưu và kiểm tra). */
export const KEY_SHAPE_NOTE = "Khoá Claude thường bắt đầu bằng sk-ant- và không có dấu cách.";
const P = (b) => (b ? "true" : "false");
/** "Màu hoa": chỉ đổi màu hoa và nắng của khu vườn (css/accents.css); lá vẫn xanh. */
const ACCENT_NAMES = { a1: "Hướng dương", a2: "Hoa đào", a3: "Oải hương", a4: "Hoa giấy" };
/** Mã lỗi cho biết chính khoá (hoặc tài khoản của khoá) chưa dùng được; lỗi mạng, máy chủ bận… không nằm ở đây. */
const KEY_FAULTS = ["bad_key", "forbidden", "billing", "model", "spend_cap"];

let sheet = null;
let quietClose = false; // đang đóng tấm vì vừa khôi phục / xoá hết dữ liệu: không nhắc "Hồ sơ chưa được lưu"
const UNSAVED_TAG = "pf-unsaved"; // nhãn của lời nhắc "Thay đổi ở Hồ sơ chưa được lưu", để gỡ nó khi Cài đặt mở lại
let unsavedWas = null; // hồ sơ đang lưu (dạng chuỗi) lúc lời nhắc "chưa lưu" hiện ra; null: không có phần sửa dở nào đang chờ mở lại
let testRun = 0; // tăng mỗi khi khoá hoặc mức nhận diện đổi: kết quả của lượt kiểm tra cũ về muộn sẽ bị bỏ qua
// test: null | 'busy' | 'ok' | { code, error } · pend: file sao lưu đang chờ lượt chạm thứ hai trên iPhone, mỗi nút một file: { [act]: { name, text } }
// pf: biểu mẫu Hồ sơ đang sửa · pf0: biểu mẫu đúng như lúc nạp từ hồ sơ (để biết CÔ ẤY đã sửa ô nào)
const st = { pf: null, pf0: null, pfErrors: {}, test: null, showKey: false, wipeArmed: false, restoreArmed: false, expPhotos: false, expKey: false, pend: {}, exporting: false };

/** Biểu mẫu Hồ sơ đúng như hồ sơ đang lưu (không đụng tới st): dùng để nạp biểu mẫu và để biết biểu mẫu đã bị sửa hay chưa. */
function profileForm() {
  const p = S.profile, c = ctx();
  return {
    name: p.name || "", sex: p.sex, birthYear: String(p.birthYear), height: String(p.height).replace(".", ","),
    weight: L.fmt1(c.weight), goalWeight: L.fmt1(p.goalWeight), startWeight: p.startWeight != null ? L.fmt1(p.startWeight) : "",
    activity: p.activity, pace: p.pace,
    customTarget: p.customTarget ? String(p.customTarget) : "",
  };
}
function loadProfileForm() {
  st.pf = profileForm();
  st.pf0 = { ...st.pf };
  st.pfErrors = {};
  unsavedWas = null;
}
/**
 * Nhóm Hồ sơ đang có thay đổi chưa bấm "Lưu hồ sơ"? (Các nhóm khác lưu ngay khi đổi; riêng Hồ sơ phải bấm nút.)
 * So với biểu mẫu lúc nạp chứ không so với hồ sơ đang lưu: hồ sơ có thể vừa đổi ở phía sau (bản kia của app ghi một lần cân),
 * đó không phải là thay đổi của cô ấy.
 */
function profileDirty() {
  if (!S.profile || !st.pf || !st.pf0) return false;
  // so theo giá trị số, để gõ lại đúng con số cũ theo cách viết khác ("54" thay cho "54,0", "1.500" thay cho "1500") không bị coi là đã sửa
  const norm = (f) => JSON.stringify(Object.keys(f).map((k) => { const n = k === "name" ? null : k === "customTarget" ? L.parseKcal(f[k]) : L.parseNum(f[k]); return n === null ? f[k] : n; }));
  return norm(st.pf) !== norm(st.pf0);
}
/**
 * Những ô cô ấy chưa đụng tới đi theo hồ sơ đang lưu LÚC NÀY. Tấm Cài đặt mở lâu thì biểu mẫu có thể cũ hơn hồ sơ
 * (bản kia của app vừa ghi một lần cân, vừa lưu hồ sơ): "Lưu hồ sơ" chỉ được ghi những gì cô ấy sửa, không ghi đè số mới bằng số cũ.
 */
function followStored() {
  if (!S.profile || !st.pf || !st.pf0) return;
  const now = profileForm();
  for (const k of Object.keys(now)) if (st.pf[k] === st.pf0[k]) st.pf[k] = now[k];
  st.pf0 = now;
}
/** Tuỳ chọn kiểm tra hồ sơ, giống hệt lúc lưu: cân mong muốn không đổi thì không bị bắt phải thấp hơn cân hiện tại. */
const pfOpts = () => ({ keepGoal: S.profile ? S.profile.goalWeight : null });

/* ---------- từng nhóm ---------- */
function pfField(name, label, attrs, hint) {
  const err = st.pfErrors[name];
  const id = `pf-${name}`;
  return html`<div class="field ${err ? "has-err" : ""}">
    <label class="field-label" for="${id}">${label}</label>
    <input class="input" id="${id}" data-pf="${name}" value="${st.pf[name]}" ${raw(attrs)} autocomplete="off" ${hint ? html`data-hint="${hint}"` : ""} ${err ? raw('aria-invalid="true"') : ""} ${err || hint ? raw(`aria-describedby="${id}-note"`) : ""}>
    ${err ? html`<span class="field-err" id="${id}-note">${err}</span>` : hint ? html`<span class="field-hint" id="${id}-note">${hint}</span>` : ""}
  </div>`;
}
function pfPreview() {
  const r = L.validateProfile(st.pf, S.today, pfOpts());
  if (!r.ok) return html`<p class="field-hint" data-part="pfprev">Điền đủ các ô để xem mức calo mới.</p>`;
  const t = L.targetOf({ ...r.value }, r.value.weight, S.today);
  const weeks = L.etaWeeks(r.value.weight, r.value.goalWeight, t.tdee, t.target);
  // mức tự đặt thấp hơn mức sàn của app: nhắc nhẹ, và không khoe "về đích nhanh hơn"
  const floor = L.kcalFloor(r.value.sex);
  const low = t.mode === "custom" && t.target < floor;
  return html`<p class="field-hint" data-part="pfprev">Mức mỗi ngày: <b class="num">${L.fmtInt(t.target)} kcal</b>${t.mode === "custom" ? " (tự đặt)" : t.mode === "maintain" ? " (giữ cân)" : ""}. Cơ thể đốt khoảng ${L.fmtInt(t.tdee)} kcal${weeks && !low ? `, về đích sau khoảng ${weeks} tuần` : ""}.${t.floored ? " Đây là mức thấp nhất app cho phép." : ""}${low ? ` Mức này thấp hơn mức ${L.fmtInt(floor)} kcal mà app thường giữ; chỉ nên dùng khi có chuyên gia theo dõi.` : ""}</p>`;
}
function gProfile() {
  return html`<div class="stack">
    ${pfField("name", "Tên gọi", 'type="text" maxlength="30"')}
    <div class="field"><span class="field-label">Giới tính</span>
      <div class="seg" role="group" aria-label="Giới tính">
        <button type="button" class="seg-btn" data-set="sex:f" aria-pressed="${P(st.pf.sex === "f")}">Nữ</button>
        <button type="button" class="seg-btn" data-set="sex:m" aria-pressed="${P(st.pf.sex === "m")}">Nam</button>
      </div></div>
    <div class="grid2">
      ${pfField("birthYear", "Năm sinh", 'type="text" inputmode="numeric" maxlength="4"')}
      ${pfField("height", "Chiều cao (cm)", 'type="text" inputmode="decimal" maxlength="5"')}
    </div>
    <div class="grid2">
      ${pfField("weight", "Cân hiện tại (kg)", 'type="text" inputmode="decimal" maxlength="6"')}
      ${pfField("goalWeight", "Cân mong muốn (kg)", 'type="text" inputmode="decimal" maxlength="6"')}
    </div>
    ${pfField("startWeight", "Cân lúc bắt đầu (kg)", 'type="text" inputmode="decimal" maxlength="6"', "Sửa khi lúc đầu nhập nhầm. Số kg đã giảm tính từ mức này.")}
    <div class="field"><span class="field-label">Mức vận động thường ngày</span>
      <div class="opts" role="group" aria-label="Mức vận động thường ngày">${L.ACTIVITY_LEVELS.map((a) => html`<button type="button" class="opt" data-set="act:${a.v}" aria-pressed="${P(st.pf.activity === a.v)}"><b>${a.label}</b><span>${a.hint}</span></button>`)}</div></div>
    <div class="field"><span class="field-label">Tốc độ giảm</span>
      <div class="seg three" role="group" aria-label="Tốc độ giảm">${L.PACES.map((p) => html`<button type="button" class="seg-btn" data-set="pace:${p.v}" aria-pressed="${P(st.pf.pace === p.v)}"><b>${p.label}</b><small>${p.hint}</small></button>`)}</div></div>
    ${pfField("customTarget", "Tự đặt mức kcal mỗi ngày", 'type="text" inputmode="numeric" maxlength="5" placeholder="Để trống: app tự tính"', "Chỉ điền khi đã có con số riêng, ví dụ từ chuyên gia dinh dưỡng.")}
    ${pfPreview()}
    <button type="button" class="btn primary block" data-set="savepf">Lưu hồ sơ</button>
    <p class="fine">${MEDICAL_NOTE}</p>
  </div>`;
}

function testLine() {
  if (st.test === "busy") return html`<p class="field-hint">Đang kiểm tra…</p>`;
  if (st.test === "ok") return html`<p class="field-ok">${raw(icon("check"))} Kết nối tốt. Chụp ảnh là tính được calo.</p>`;
  if (st.test && st.test.error) return html`<p class="field-err">${st.test.error}</p>`;
  const key = S.settings.apiKey;
  if (key && !L.looksLikeApiKey(key)) return html`<p class="field-warn">${KEY_SHAPE_NOTE}</p>`;
  return key ? html`<p class="field-hint">Đã có khoá. Khoá chỉ lưu trên máy này và chỉ gửi tới Anthropic.</p>` : html`<p class="field-hint">Khoá Claude là khoá API của Anthropic, bắt đầu bằng “sk-ant-”, tạo ở platform.claude.com.</p>`;
}
function gAi() {
  return html`<div class="stack">
    <div class="field">
      <label class="field-label" for="setKey">Khoá Claude</label>
      <span class="input-row">
        <input class="input" id="setKey" type="${st.showKey ? "text" : "password"}" value="${S.settings.apiKey}" placeholder="sk-ant-…" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="setKeyNote">
        <button type="button" class="btn soft sm" data-set="showkey" aria-label="${st.showKey ? "Ẩn khoá" : "Hiện khoá"}">${raw(icon(st.showKey ? "eye-off" : "eye"))}</button>
        <button type="button" class="btn soft sm" data-set="pastekey">Dán</button>
      </span>
      <div data-part="test" id="setKeyNote" role="status">${testLine()}</div>
    </div>
    <div class="row wrap">
      <button type="button" class="btn soft grow" data-set="testkey" aria-disabled="${P(st.test === "busy")}">Lưu và kiểm tra</button>
      <button type="button" class="btn ghost" data-set="clearkey" ${S.settings.apiKey ? "" : raw("hidden")}>Xoá khoá</button>
    </div>
    <div class="field"><span class="field-label">Mức nhận diện</span>
      <div class="opts" role="group" aria-label="Mức nhận diện">${MODELS.map((m) => html`<button type="button" class="opt" data-set="model:${m.id}" aria-pressed="${P(S.settings.model === m.id)}"><b>${m.name}</b><span>${m.model} · ${m.cost}</span></button>`)}</div>
      <span class="field-hint">Chi phí là ước tính và trừ vào tài khoản Anthropic của khoá. Mức “Chính xác nhất” nhìn món Việt kỹ hơn; hai mức còn lại rẻ hơn nhiều.</span>
    </div>
    <p class="fine">Ảnh bữa ăn và lời mô tả món được gửi tới Claude (Anthropic) để phân tích. Khi bấm “Nhận xét”, tên món và số calo của ngày đó cùng thói quen ăn mấy tuần gần đây cũng được gửi đi (không kèm ảnh, không kèm tên). Mọi dữ liệu khác ở lại trên máy này.</p>
  </div>`;
}

/** Dòng dưới ô chữ ký: nhãn lấy từ đúng hàm mà thẻ lời nhắn ở màn Hôm nay dùng, nên hai nơi không thể nói khác nhau. */
const partnerHint = () => {
  const label = noteLabel(S.settings.partner, S.settings.pronoun || "bạn");
  return S.settings.partner ? `Sẽ hiện thành “${label}”.` : `Để trống thì hiện “${label}”.`;
};
function gGift() {
  const s = S.settings;
  return html`<div class="stack">
    <div class="field"><span class="field-label">App gọi người dùng là</span>
      <div class="seg four" role="group" aria-label="Cách xưng hô">${["bạn", "em", "chị", "mình"].map((y) => html`<button type="button" class="seg-btn" data-set="pronoun:${y}" aria-pressed="${P(s.pronoun === y)}">${y}</button>`)}</div>
      <span class="field-hint">Ví dụ: “Chuỗi 5 ngày đang chờ ${s.pronoun}.”</span>
    </div>
    <div class="field"><label class="field-label" for="setPartner">Lời nhắn ký tên là</label>
      <input class="input" id="setPartner" type="text" maxlength="20" value="${s.partner}" placeholder="Ví dụ: anh" autocomplete="off" aria-describedby="setPartnerNote">
      <span class="field-hint" id="setPartnerNote" data-part="partner">${partnerHint()}</span></div>

    <div class="field"><span class="field-label">Lời nhắn yêu thương</span>
      <span class="field-hint">Mỗi ngày app hiện một lời ở màn Hôm nay, lần lượt theo danh sách.</span>
      <ul class="list">${s.notes.map((n, i) => html`<li class="list-row"><span class="grow">${n}</span><button type="button" class="icon-btn sm" data-set="delnote:${i}" aria-label="Xoá lời nhắn: ${n}">${raw(icon("x"))}</button></li>`)}</ul>
      <span class="input-row">
        <input class="input" id="noteDraft" type="text" maxlength="160" placeholder="Viết một lời nhắn…" aria-label="Lời nhắn mới" autocomplete="off" enterkeyhint="done">
        <button type="button" class="btn soft sm" data-set="addnote">Thêm</button>
      </span>
      <div class="tags">${NOTE_IDEAS.filter((n) => !s.notes.includes(n)).slice(0, 4).map((n) => html`<button type="button" class="tag add" data-set="idea" data-text="${n}">${raw(icon("plus"))}<span>${n}</span></button>`)}</div>
    </div>

    <div class="field"><span class="field-label">Quà theo mốc giảm cân</span>
      <span class="field-hint">Khi giảm được số kg này so với lúc bắt đầu, app báo tin vui kèm món quà.</span>
      <ul class="list">${s.rewards.map((r, i) => { const kg = L.fmt1(r.kg).replace(",0", ""); return html`<li class="list-row"><b class="num">−${kg} kg</b><span class="grow">${r.text}</span><button type="button" class="icon-btn sm" data-set="delreward:${i}" aria-label="Xoá quà −${kg} kg: ${r.text}">${raw(icon("x"))}</button></li>`; })}</ul>
      <span class="input-row">
        <input class="input kg" id="rewardKg" type="text" inputmode="decimal" maxlength="5" placeholder="kg" aria-label="Số kg giảm" autocomplete="off">
        <input class="input" id="rewardText" type="text" maxlength="60" placeholder="Món quà…" aria-label="Món quà" autocomplete="off" enterkeyhint="done">
        <button type="button" class="btn soft sm" data-set="addreward">Thêm</button>
      </span>
      <div class="tags">${REWARD_IDEAS.map((n) => html`<button type="button" class="tag add" data-set="rewardidea" data-text="${n}">${raw(icon("plus"))}<span>${n}</span></button>`)}</div>
    </div>
  </div>`;
}

function gLook() {
  const s = S.settings;
  return html`<div class="stack">
    <div class="field"><span class="field-label">Sáng tối</span>
      <div class="seg three" role="group" aria-label="Sáng tối">${[["auto", "Theo máy"], ["light", "Sáng"], ["dark", "Tối"]].map(([v, t]) => html`<button type="button" class="seg-btn" data-set="theme:${v}" aria-pressed="${P(s.theme === v)}">${t}</button>`)}</div></div>
    <div class="field"><span class="field-label">Màu hoa</span>
      <div class="swatches" role="group" aria-label="Màu hoa">${L.ACCENTS.map((a) => html`<button type="button" class="swatch-opt" data-set="accent:${a}" aria-pressed="${P(s.accent === a)}"><span class="swatch" data-accent-swatch="${a}"></span><small>${ACCENT_NAMES[a]}</small></button>`)}</div>
      <span class="field-hint">Đổi màu hoa và nắng trong khu vườn. Lá thì lúc nào cũng xanh.</span></div>
    <div class="row between">
      <span><b>Theo dõi uống nước</b><br><span class="field-hint">Hiện hàng ly nước ở màn Hôm nay.</span></span>
      <button type="button" class="switch" role="switch" data-set="water" aria-checked="${P(s.water)}" aria-label="Theo dõi uống nước"><i></i></button>
    </div>
    ${s.water ? html`<div class="row between">
      <span><b>Số ly mỗi ngày</b></span>
      <span class="stepper"><button type="button" class="stepper__btn" data-set="wgoal:-1" aria-label="Bớt một ly">${raw(icon("minus"))}</button><b class="stepper__val is-on">${s.waterGoal}</b><button type="button" class="stepper__btn" data-set="wgoal:1" aria-label="Thêm một ly">${raw(icon("plus"))}</button></span>
    </div>` : ""}
  </div>`;
}

const KEY_FILE_WARNING = "Ai có file này sẽ dùng được khoá. Chỉ gửi cho chính mình và xoá file sau khi nhập xong.";
/** Chữ trên nút sao lưu: trên iPhone, khi bảng chia sẻ không mở được ở lượt chạm đầu, file được giữ lại chờ lượt chạm thứ hai. */
const exportLabel = (act, normal) => (st.pend[act] ? "Chạm lần nữa để lưu file" : normal);
function gData() {
  return html`<div class="stack">
    ${S.mode === "memory" ? html`<div class="banner warn"><p>Trình duyệt đang không cho lưu lâu dài (có thể là chế độ riêng tư). Hãy mở app bằng trình duyệt thường để dữ liệu không mất.</p></div>` : ""}
    <div class="field"><span class="field-label">Sao lưu</span>
      <span class="field-hint">Lưu toàn bộ nhật ký ra một file. Nên làm thỉnh thoảng, và trước khi đổi điện thoại.</span>
      <label class="check"><input type="checkbox" id="expPhotos" data-set-check="expPhotos" ${st.expPhotos ? raw("checked") : ""}><span>Kèm ảnh bữa ăn (file nặng hơn)</span></label>
      <label class="check"><input type="checkbox" id="expKey" data-set-check="expKey" ${st.expKey ? raw("checked") : ""}><span>Kèm khoá Claude, để chuyển nguyên thiết lập sang máy khác</span></label>
      ${st.expKey ? html`<span class="field-err">${KEY_FILE_WARNING}</span>` : ""}
      <button type="button" class="btn soft block" data-set="export">${raw(icon("download"))}<span>${exportLabel("export", "Sao lưu ra file")}</span></button>
    </div>
    <div class="field"><span class="field-label">Khôi phục</span>
      <span class="field-hint">Nhập file sao lưu hoặc file thiết lập. Dữ liệu đang có trên máy này sẽ được thay bằng dữ liệu trong file.</span>
      <button type="button" class="btn soft block ${st.restoreArmed ? "danger" : ""}" data-set="restore">${raw(icon("upload"))}<span>${st.restoreArmed ? "Bấm lần nữa để chọn file và thay dữ liệu" : "Khôi phục từ file"}</span></button>
    </div>
    <div class="field"><span class="field-label">Xoá hết</span>
      <button type="button" class="btn ghost block danger" data-set="wipe">${st.wipeArmed ? "Bấm lần nữa để xoá toàn bộ, không lấy lại được" : "Xoá toàn bộ dữ liệu trên máy này"}</button>
    </div>
  </div>`;
}

/**
 * Ba bước thêm app vào Màn hình chính trên iPhone/iPad (dùng ở Cài đặt và ở màn chào).
 * Từ iOS 26 nút Chia sẻ có thể nằm trong nút ••• và hộp thoại có thêm công tắc "ứng dụng web".
 */
export function iosInstallSteps() {
  return html`<li>Mở trang này bằng <b>Safari</b>.</li>
    <li>Chạm nút <b>Chia sẻ</b> (ô vuông có mũi tên lên). Nếu không thấy, chạm nút <b>•••</b> cạnh ô địa chỉ rồi chọn <b>Chia sẻ</b>.</li>
    <li>Kéo xuống, chọn <b>Thêm vào Màn hình chính</b> (không thấy thì vào <b>Sửa tác vụ</b> để thêm). Nếu có công tắc mở dưới dạng ứng dụng web thì giữ bật, rồi chạm <b>Thêm</b>.</li>`;
}
function gInstall() {
  if (isStandalone()) return html`<p>App đang chạy từ màn hình chính. Không cần làm gì thêm.</p>`;
  if (canPromptInstall()) return html`<div class="stack"><p>Cài lên màn hình chính để mở app bằng một chạm, toàn màn hình, như app thường.</p><button type="button" class="btn primary block" data-set="install">Cài lên màn hình chính</button></div>`;
  if (isIOS()) {
    // Trên iPhone, app ở Màn hình chính có kho dữ liệu riêng, tách khỏi Safari: phải mang nhật ký sang bằng file sao lưu.
    const hasKey = !!S.settings.apiKey;
    return html`<div class="stack">
      <div class="banner"><p>Trên iPhone, app ở Màn hình chính lưu dữ liệu riêng, không dùng chung với Safari. Nhật ký đã ghi ở đây không tự chuyển sang, nên hãy làm lần lượt các bước sau.</p></div>
      <ol class="steps">
        <li><b>Sao lưu trước.</b> Lưu ${hasKey ? "nhật ký, ảnh bữa ăn và khoá Claude" : "nhật ký và ảnh bữa ăn"} ra một file. Chạm nút dưới đây, rồi trong bảng chia sẻ chọn <b>Lưu vào Tệp</b>:
          <button type="button" class="btn soft block" data-set="movefile">${raw(icon("download"))}<span>${exportLabel("movefile", hasKey ? "Sao lưu kèm ảnh và khoá" : "Sao lưu kèm ảnh")}</span></button>
          ${hasKey ? html`<span class="field-err">${KEY_FILE_WARNING}</span>` : ""}</li>
        ${iosInstallSteps()}
        <li>Mở app từ biểu tượng vừa có trên Màn hình chính, chọn <b>Đã có file sao lưu hoặc file thiết lập</b> rồi tìm file vừa lưu trong <b>Tệp</b>.</li>
      </ol>
      <p class="fine">Nên chuyển sớm: nếu khoảng một tuần không mở app trong Safari, Safari có thể tự xoá dữ liệu đang lưu ở đây.</p>
    </div>`;
  }
  return html`<ol class="steps"><li>Mở trang này bằng <b>Chrome</b>.</li><li>Chạm nút <b>⋮</b> ở góc trên bên phải.</li><li>Chọn <b>Thêm vào màn hình chính</b> hoặc <b>Cài đặt ứng dụng</b>.</li></ol>`;
}

function gAbout() {
  return html`<div class="stack">
    <p>Nhật Ký Calo · phiên bản ${APP_VERSION}</p>
    <p class="fine">Số calo từ ảnh là ước tính, có thể lệch 20–30% tuỳ góc chụp và cách nấu; từng món đều chỉnh lại được. Mức calo mỗi ngày tính theo công thức Mifflin-St Jeor. App không thay cho lời khuyên của bác sĩ hay chuyên gia dinh dưỡng.</p>
    <p class="fine">${MEDICAL_NOTE}</p>
    <p class="fine">Dreamer làm, với thật nhiều yêu thương.</p>
  </div>`;
}

/** Dòng phụ của nhóm Kết nối Claude: chỉ nói "Đã kết nối" khi vừa kiểm tra thành công. */
function aiSub() {
  if (!S.settings.apiKey) return "Chưa có khoá: chụp ảnh chưa tự tính calo";
  // Chuỗi đang lưu không có dáng của một khoá Claude (dán nhầm chữ khác, dính thêm chữ): nói cùng một ý với lời nhắc dưới ô khoá.
  if (!L.looksLikeApiKey(S.settings.apiKey)) return "Khoá có vẻ chưa đúng";
  if (st.test && st.test !== "busy" && st.test !== "ok" && KEY_FAULTS.includes(st.test.code)) return "Khoá chưa dùng được";
  const level = MODELS.find((m) => m.id === S.settings.model)?.name || "";
  return `${st.test === "ok" ? "Đã kết nối" : "Đã có khoá"} · ${level}`;
}
const GROUPS = [
  { id: "profile", title: "Hồ sơ và mục tiêu", ico: "user", sub: () => { const c = ctx(); return `${L.fmtInt(c.target)} kcal mỗi ngày · đích ${L.fmt1(S.profile.goalWeight)} kg`; }, body: gProfile },
  { id: "ai", title: "Kết nối Claude", ico: "key", sub: aiSub, body: gAi },
  { id: "gift", title: "Lời nhắn và quà", ico: "heart", sub: () => `${S.settings.notes.length} lời nhắn · ${S.settings.rewards.length} món quà`, body: gGift },
  { id: "look", title: "Giao diện", ico: "palette", sub: () => (S.settings.theme === "auto" ? "Sáng tối theo máy" : S.settings.theme === "dark" ? "Nền tối" : "Nền sáng"), body: gLook },
  { id: "data", title: "Sao lưu và khôi phục", ico: "download", sub: () => `${Object.keys(S.days).length} ngày nhật ký trên máy này`, body: gData },
  { id: "install", title: "Cài lên màn hình chính", ico: "phone", sub: () => (isStandalone() ? "Đã cài" : "Mở app bằng một chạm"), body: gInstall },
  { id: "about", title: "Giới thiệu", ico: "info", sub: () => `Phiên bản ${APP_VERSION}`, body: gAbout },
];

function view(openId) {
  return html`
    <header class="sheet-head">
      <h2 class="sheet-title">Cài đặt</h2>
      <button class="icon-btn" data-close-sheet aria-label="Đóng">${raw(icon("x"))}</button>
    </header>
    <div class="sheet-body settings">
      ${GROUPS.map((g) => html`<details class="group" data-g="${g.id}" ${g.id === openId ? raw("open") : ""}>
        <summary><span class="group-ico">${raw(icon(g.ico))}</span><span class="group-txt"><b>${g.title}</b><small data-sub="${g.id}">${g.sub()}</small></span><span class="group-chev">${raw(icon("chev-down"))}</span></summary>
        <div class="group-body" data-body="${g.id}">${g.body()}</div>
      </details>`)}
    </div>`;
}
/** Cập nhật dòng phụ dưới tên từng nhóm. */
function subs() {
  if (!sheet) return;
  for (const x of GROUPS) { const s = $(`[data-sub="${x.id}"]`, sheet.el); if (s) s.textContent = x.sub(); }
}
/** Vẽ lại một nhóm. Tiêu điểm được trả về đúng nút vừa bấm (hoặc về tấm Cài đặt), không rơi ra ngoài tấm. */
function refresh(id) {
  if (!sheet) return;
  const el = sheet.el;
  const before = document.activeElement;
  const inside = !!before && el.contains(before);
  withFocus(el, () => {
    const g = GROUPS.find((x) => x.id === id);
    const body = $(`[data-body="${id}"]`, el);
    if (g && body) setHtml(body, g.body());
    subs();
  });
  if (!inside) return;
  const now = document.activeElement;
  if (!now || !el.contains(now)) { el.focus({ preventScroll: true }); return; }
  // ô nhập vừa được vẽ lại: đưa con trỏ về cuối chữ như lúc đang gõ
  if (now !== before && now.tagName === "INPUT" && (now.type === "text" || now.type === "password")) { try { now.setSelectionRange(now.value.length, now.value.length); } catch {} }
}
/**
 * Cập nhật tại chỗ dòng trạng thái khoá, nút kiểm tra, nút xoá và dòng phụ của nhóm — không vẽ lại cả nhóm,
 * để lượt chạm kế tiếp không bị mất (sự kiện "change" của ô khoá đến ngay giữa lượt chạm đó) và để trình đọc màn hình
 * đọc được kết quả kiểm tra (vùng role="status" phải còn nguyên thì mới được đọc).
 */
function syncAi() {
  if (!sheet) return;
  const box = $('[data-part="test"]', sheet.el);
  const line = testLine();
  if (box && box.innerHTML !== line.s && box._nkc !== line.s) { setHtml(box, line); box._nkc = line.s; } // chỉ đổi khi nội dung đổi, để trình đọc màn hình không đọc lặp
  const tb = $('[data-set="testkey"]', sheet.el);
  if (tb) tb.setAttribute("aria-disabled", P(st.test === "busy"));
  const cb = $('[data-set="clearkey"]', sheet.el);
  if (cb) cb.hidden = !S.settings.apiKey;
  subs();
}

/* ---------- thao tác ---------- */
function addNote(text) {
  const t = String(text || "").trim();
  if (!t) return;
  if (S.settings.notes.includes(t)) { toast("Lời nhắn này đã có rồi."); return; }
  if (S.settings.notes.length >= 20) { toast("Tối đa 20 lời nhắn."); return; }
  setSettings({ notes: [...S.settings.notes, t] });
  refresh("gift");
}
function addReward() {
  const kg = L.parseNum($("#rewardKg", sheet.el).value);
  const text = $("#rewardText", sheet.el).value.trim();
  if (kg === null || kg <= 0 || kg > 150) { toast("Nhập số kg giảm, ví dụ 2."); $("#rewardKg", sheet.el).focus(); return; }
  if (!text) { toast("Nhập món quà."); $("#rewardText", sheet.el).focus(); return; }
  if (S.settings.rewards.length >= 8) { toast("Tối đa 8 món quà."); return; }
  setSettings({ rewards: [...S.settings.rewards, { kg, text }] });
  refresh("gift");
}
/** Lưu khoá đang có trong ô, sau khi dọn (bỏ ngoặc kép, chữ thừa, dấu xuống dòng dính theo lúc dán); ô hiện lại đúng chuỗi đã lưu. */
function saveKeyFromInput() {
  const input = sheet ? $("#setKey", sheet.el) : null;
  if (!input) return S.settings.apiKey;
  const key = L.tidyApiKey(input.value);
  if (input.value !== key) input.value = key;
  if (key !== S.settings.apiKey) { testRun++; st.test = null; setSettings({ apiKey: key }); }
  return key;
}
/**
 * Tạo file sao lưu rồi đưa cho người dùng lưu (nút ở nhóm Sao lưu và nút ở nhóm Cài lên màn hình chính trên iPhone).
 * Trên iPhone, nếu bảng chia sẻ không mở được vì khâu tạo file quá lâu, saveFile trả về "retry": giữ file lại,
 * đổi chữ trên nút, và lượt chạm kế tiếp gọi chia sẻ NGAY (không chờ gì trước đó) nên chắc chắn mở được.
 * Mỗi nút giữ file chờ của riêng nó: sao lưu bằng nút này không làm mất file mà nút kia đang hứa "Chạm lần nữa để lưu file".
 */
async function runExport(b, act, opts) {
  if (st.exporting) return;
  st.exporting = true;
  b.setAttribute("aria-disabled", "true");
  let r = "";
  try {
    let job = st.pend[act];
    if (!job) job = { name: `nhat-ky-calo-${S.today}.json`, text: await exportData(opts) };
    r = await saveFile(job.name, job.text);
    if (r === "retry") st.pend[act] = job; else delete st.pend[act];
  } catch (err) { console.error(err); delete st.pend[act]; r = "fail"; }
  st.exporting = false;
  if (r === "fail") toast("Chưa tạo được file sao lưu.");
  else if (r === "retry") toast("File sao lưu đã sẵn sàng. Chạm nút lần nữa để lưu.");
  else if (r === "shared") toast("Đã gửi file sao lưu.");
  else if (r === "downloaded") toast(isIOS() ? "Đã tạo file sao lưu. Nếu máy mở file ra xem, hãy chạm Chia sẻ rồi chọn Lưu vào Tệp." : "Đã lưu file sao lưu vào thư mục Tải về.");
  refresh(act === "export" ? "data" : "install");
}

async function onClick(e) {
  if (!sheet) return; // chạm vào tấm đang trượt xuống sau khi đã đóng: bỏ qua
  const chk = e.target.closest("[data-set-check]");
  if (chk) { st[chk.dataset.setCheck] = chk.checked; delete st.pend.export; refresh("data"); return; }
  const b = e.target.closest("[data-set]");
  if (!b) return;
  const raw0 = b.dataset.set;
  const i = raw0.indexOf(":");
  const act = i < 0 ? raw0 : raw0.slice(0, i), arg = i < 0 ? "" : raw0.slice(i + 1);
  switch (act) {
    case "sex": st.pf.sex = arg; refresh("profile"); break;
    case "act": st.pf.activity = Number(arg); refresh("profile"); break;
    case "pace": st.pf.pace = Number(arg); refresh("profile"); break;
    case "savepf": {
      followStored(); // ô chưa đụng tới lấy theo hồ sơ đang lưu, kẻo số cũ trong biểu mẫu đè lên lần cân mới ghi ở bản kia của app
      const r = saveProfile(st.pf);
      if (!r.ok) { st.pfErrors = r.errors; refresh("profile"); const bad = $(".has-err .input", sheet.el); if (bad) bad.focus(); return; }
      loadProfileForm(); refresh("profile");
      toast(`Đã lưu. Mức mỗi ngày: ${L.fmtInt(ctx().target)} kcal.`);
      break;
    }
    case "showkey": {
      // đổi tại chỗ: không vẽ lại nhóm nên chữ đang gõ dở trong ô và tiêu điểm đều còn nguyên
      st.showKey = !st.showKey;
      const input = $("#setKey", sheet.el);
      if (input) input.type = st.showKey ? "text" : "password";
      b.setAttribute("aria-label", st.showKey ? "Ẩn khoá" : "Hiện khoá");
      setHtml(b, raw(icon(st.showKey ? "eye-off" : "eye")));
      break;
    }
    case "pastekey": {
      let t = null;
      try { t = L.tidyApiKey(await navigator.clipboard.readText()); } catch {}
      if (!sheet) return;
      const input = $("#setKey", sheet.el);
      if (t === null) { if (input) input.focus(); toast("Hãy nhấn giữ vào ô rồi chọn Dán."); break; }
      if (t && input) { input.value = t; testRun++; st.test = null; saveKeyFromInput(); syncAi(); }
      break;
    }
    case "testkey": {
      if (st.test === "busy") return;
      const key = saveKeyFromInput();
      if (!key) { st.test = { error: "Chưa có khoá để kiểm tra." }; syncAi(); return; }
      const run = ++testRun;
      st.test = "busy"; syncAi();
      let res;
      try { await testKey({ apiKey: key, model: S.settings.model }); res = "ok"; }
      catch (err) { res = { code: err && err.code, error: aiErrorText(err && err.code, S.settings.pronoun) }; }
      if (run !== testRun) return; // khoá hoặc mức nhận diện đã đổi trong lúc chờ
      st.test = res; syncAi();
      break;
    }
    case "clearkey": testRun++; st.test = null; setSettings({ apiKey: "" }); refresh("ai"); toast("Đã xoá khoá khỏi máy này."); break;
    case "model": testRun++; st.test = null; setSettings({ model: arg }); refresh("ai"); break;
    case "pronoun": setSettings({ pronoun: arg }); refresh("gift"); break;
    case "addnote": { const d = $("#noteDraft", sheet.el); addNote(d.value); break; }
    case "idea": addNote(b.dataset.text); break;
    case "delnote": setSettings({ notes: S.settings.notes.filter((_, k) => k !== Number(arg)) }); refresh("gift"); break;
    case "addreward": addReward(); break;
    case "rewardidea": { const t = $("#rewardText", sheet.el); t.value = b.dataset.text; const k = $("#rewardKg", sheet.el); (k.value.trim() ? t : k).focus(); break; }
    case "delreward": setSettings({ rewards: S.settings.rewards.filter((_, k) => k !== Number(arg)) }); refresh("gift"); break;
    case "theme": setSettings({ theme: arg }); refresh("look"); break;
    case "accent": setSettings({ accent: arg }); refresh("look"); break;
    case "water": setSettings({ water: !S.settings.water }); refresh("look"); break;
    case "wgoal": setSettings({ waterGoal: L.clamp(S.settings.waterGoal + Number(arg), 4, 12) }); refresh("look"); break;
    case "export": await runExport(b, "export", { withPhotos: st.expPhotos, withKey: st.expKey }); break;
    // iPhone: file để mang nguyên nhật ký sang app ở Màn hình chính — luôn kèm ảnh và khoá (có lời dặn ngay dưới nút)
    case "movefile": await runExport(b, "movefile", { withPhotos: true, withKey: true }); break;
    case "restore":
      if (!st.restoreArmed) { st.restoreArmed = true; refresh("data"); setTimeout(() => { if (st.restoreArmed) { st.restoreArmed = false; refresh("data"); } }, 5000); return; }
      st.restoreArmed = false; refresh("data");
      $("#importInput").click();
      break;
    case "wipe":
      if (!st.wipeArmed) { st.wipeArmed = true; refresh("data"); setTimeout(() => { if (st.wipeArmed) { st.wipeArmed = false; refresh("data"); } }, 5000); return; }
      st.wipeArmed = false;
      closeQuietly();
      await wipeAll();
      toast("Đã xoá toàn bộ dữ liệu.");
      break;
    case "install": { const ok = await promptInstall(); refresh("install"); if (ok) toast("Đã cài lên màn hình chính."); break; }
  }
}
function onInput(e) {
  if (!sheet) return; // tấm đã đóng (đang trượt xuống): không còn gì để cập nhật
  const t = e.target;
  if (t.dataset.pf) {
    st.pf[t.dataset.pf] = t.value;
    if (st.pfErrors[t.dataset.pf]) {
      delete st.pfErrors[t.dataset.pf];
      const f = t.closest(".field");
      const note = f ? f.querySelector(".field-err") : null;
      const hint = t.dataset.hint || "";
      if (f) f.classList.remove("has-err");
      t.removeAttribute("aria-invalid");
      // ô có lời gợi ý (pfField ghi sẵn vào data-hint): lời báo lỗi nhường chỗ lại cho gợi ý, ô vẫn được mô tả bởi dòng đó
      if (note && hint) { note.className = "field-hint"; note.textContent = hint; }
      else { if (note) note.remove(); t.removeAttribute("aria-describedby"); }
    }
    const pv = $('[data-part="pfprev"]', sheet.el);
    if (pv) pv.outerHTML = pfPreview().s;
  } else if (t.id === "setKey" && st.test) {
    testRun++; st.test = null;
    syncAi();
  }
}
function onChange(e) {
  // Tấm đã đóng: trình duyệt còn bắn thêm một "change" khi ô mất tiêu điểm (sau "change" mà commitField đã báo lúc đóng) — đã lưu rồi, bỏ qua.
  if (!sheet) return;
  const t = e.target;
  if (t.id === "setPartner") {
    // chỉ sửa dòng gợi ý và dòng phụ: vẽ lại cả nhóm ở đây sẽ nuốt mất lượt chạm kế tiếp (sự kiện này đến giữa lượt chạm đó)
    setSettings({ partner: t.value });
    const h = $('[data-part="partner"]', sheet.el);
    if (h) h.textContent = partnerHint();
    subs();
  } else if (t.id === "setKey") {
    // Sự kiện này đến ngay giữa lượt chạm kế tiếp: lúc này không được làm các nút xê dịch (nút "Xoá khoá" hiện ra sẽ
    // chen vào đúng chỗ ngón tay vừa chạm "Lưu và kiểm tra"). Dòng phụ đổi ngay; dòng trạng thái và nút "Xoá khoá" đổi sau khi lượt chạm đã tới nơi.
    saveKeyFromInput();
    subs();
    setTimeout(syncAi, 300);
  }
}
function onKey(e) {
  if (!sheet || e.key !== "Enter" || e.target.tagName !== "INPUT") return;
  if (e.target.id === "noteDraft") { e.preventDefault(); addNote(e.target.value); const d = $("#noteDraft", sheet.el); if (d) d.focus(); }
  else if (e.target.id === "rewardText") { e.preventDefault(); addReward(); }
  else if (e.target.dataset.pf) { e.preventDefault(); e.target.blur(); }
}

/**
 * @param {string} [group] nhóm mở sẵn: profile | ai | gift | look | data | install | about
 * @param {{keepForm?: boolean}} [opts] keepForm: mở lại với những gì đang sửa dở ở nhóm Hồ sơ (nút "Mở lại" của lời nhắc chưa lưu)
 */
export function openSettings(group = "", opts) {
  if (sheet) return;
  // Lời nhắc "chưa lưu" còn đang hiện mà cô ấy mở lại Cài đặt bằng đường quen (nút bánh răng) thay vì nút "Mở lại": cũng giữ
  // phần đang sửa dở và mở sẵn nhóm Hồ sơ, miễn là hồ sơ đang lưu vẫn y như lúc đóng tấm. Lời nhắc đã tắt rồi thì nạp lại như thường.
  const pending = unsavedWas !== null && !!S.profile && !!document.querySelector(`#toasts .toast[data-tag="${UNSAVED_TAG}"]`) && JSON.stringify(profileForm()) === unsavedWas;
  dropToast(UNSAVED_TAG); // Cài đặt đã mở lại (bằng đường nào cũng vậy): lời nhắc "chưa lưu" hết ý nghĩa
  if ((pending || (opts && opts.keepForm)) && st.pf && S.profile) { followStored(); unsavedWas = null; if (pending && !group) group = "profile"; }
  else loadProfileForm();
  testRun++;
  Object.assign(st, { test: null, showKey: false, wipeArmed: false, restoreArmed: false, expPhotos: false, expKey: false, pend: {}, exporting: false });
  sheet = openSheet({
    label: "Cài đặt",
    kind: "full",
    body: view(group),
    onMount(el) {
      el.addEventListener("click", onClick);
      el.addEventListener("input", onInput);
      el.addEventListener("change", onChange);
      el.addEventListener("keydown", onKey);
      // mở một nhóm thì đóng các nhóm khác cho gọn
      el.addEventListener("toggle", (ev) => {
        const d = ev.target;
        if (d.tagName !== "DETAILS" || !d.open) return;
        for (const o of el.querySelectorAll("details.group[open]")) if (o !== d) o.open = false;
      }, true);
    },
    onClose() {
      sheet = null; st.pend = {};
      // Hồ sơ là nhóm duy nhất phải bấm nút mới lưu: đóng tấm khi còn sửa dở thì nhắc một câu và cho mở lại đúng những gì đang sửa.
      // Đóng vì vừa khôi phục / xoá hết dữ liệu (closeQuietly) thì thôi: biểu mẫu cũ lúc đó không còn ý nghĩa.
      if (!quietClose && profileDirty()) {
        const was = JSON.stringify(profileForm()); // hồ sơ đang lưu, lúc đóng tấm
        unsavedWas = was; // để openSettings() nhận ra phần sửa dở khi Cài đặt được mở lại bằng đường khác trong lúc lời nhắc còn hiện
        toast("Thay đổi ở Hồ sơ chưa được lưu.", {
          label: "Mở lại",
          // chỉ giữ phần đang sửa dở khi hồ sơ đang lưu vẫn y như lúc đóng tấm (ví dụ chưa có lần cân mới nào chen vào giữa)
          fn: () => { if (S.profile) openSettings("profile", { keepForm: JSON.stringify(profileForm()) === was }); },
        }, 0, UNSAVED_TAG);
      }
    },
  });
}
/** Đóng mọi tấm vì dữ liệu vừa được thay cả loạt (khôi phục, xoá hết): không nhắc "chưa lưu" cho biểu mẫu Hồ sơ cũ. */
function closeQuietly() {
  quietClose = true;
  try { closeAllSheets(); } finally { quietClose = false; }
}

/** Dùng cho ô chọn file chung của app (#importInput). */
export async function importFromFile(file) {
  let text;
  try { text = await readTextFile(file); } catch { toast("Không đọc được file này."); return false; }
  const r = await importData(text);
  if (!r.ok) { toast(r.error); return false; }
  closeQuietly();
  toast(r.setup ? "Đã nạp thiết lập từ file." : `Đã khôi phục ${r.days} ngày nhật ký.`);
  return true;
}
