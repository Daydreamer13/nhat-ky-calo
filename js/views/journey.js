// journey.js — màn "Hành trình": cây hoa, cân nặng và chặng đường, quà hẹn, tuần này, chuỗi ngày, chum thâm hụt, huy hiệu.
// Hàm vẽ thuần: đọc S → journeyModel → trả về html``. Mọi con số hình học (toạ độ SVG, phần trăm) tính sẵn ở đây
// rồi ghi thẳng vào thuộc tính, không dựa vào calc() bên trong SVG (Safari trên iPhone).
import { S, ctx, stats } from "../state.js";
import { journeyModel } from "../models.js";
import { html, raw } from "../ui.js";
import { icon, plantInner, PLANT_VIEWBOX, badgeArt, giftArt, glowDef, glow, fireflies } from "../art.js";
import { cap } from "../words.js";
import * as L from "../logic.js";

let monthOffset = 0;
/** Tháng đang xem trong lịch: không đi quá tháng hiện tại, cũng không lùi quá tháng có ngày ghi đầu tiên. */
export function shiftMonth(n) {
  const first = Object.keys(S.days || {}).filter(L.isKey).sort()[0] || S.today;
  const months = (k) => +k.slice(0, 4) * 12 + +k.slice(5, 7);
  monthOffset = L.clamp(monthOffset + (Number(n) || 0), Math.min(0, months(first) - months(S.today)), 0);
}

/* ---------------- tiện ích nhỏ ---------------- */
const r1 = (v) => Math.round(v * 10) / 10;
const r4 = (v) => Math.round(v * 10000) / 10000;
/** "2" hoặc "1,5" — số kg của một mốc. */
const kgText = (kg) => (Number.isInteger(kg) ? String(kg) : L.fmt1(kg));
/** Ngày ghi gọn "20/11". Khi cả khoảng đang nói tới (spanDays) trải gần một năm mà ngày này thuộc năm khác, hoặc ngày này
    cách hôm nay quá xa, thì ghi tháng/năm ("5/2027") để không bị đọc nhầm sang năm nay. */
function dateText(k, todayKey, spanDays = 0, spoken = false) {
  const far = Math.abs(L.diffDays(todayKey, k)) > 300 || (spanDays > 300 && k.slice(0, 4) !== todayKey.slice(0, 4));
  if (!far) return L.shortDate(k);
  const d = L.parseKey(k);
  return `${spoken ? "tháng " : ""}${d.getMonth() + 1}/${d.getFullYear()}`;
}
const use = (id, cls = "icon") => html`<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><use href="#${id}"/></svg>`;
const sprout = (id) => html`<svg viewBox="0 0 32 30"><use href="#${id}"/></svg>`;

/* ---------------- đầu trang ---------------- */
function pageHead(j, todayKey) {
  const start = L.isKey(S.profile.startDate) ? S.profile.startDate : j.chart.firstKey;
  const days = L.diffDays(start, todayKey);
  const d = L.parseKey(start);
  const sub = days <= 0 ? "Hôm nay là ngày đầu tiên" : `Tuần thứ ${Math.floor(days / 7) + 1} · bắt đầu từ ${d.getDate()} tháng ${d.getMonth() + 1}`;
  return html`<header class="page-head">
    <h1 class="page-title">${j.name ? `Hành trình của ${j.name}` : "Hành trình"}</h1>
    <p class="page-sub">${sub}</p>
  </header>`;
}

/* ---------------- cây hoa ----------------
   Vòng lá quanh mặt trời: mỗi lá là một ngày đạt trên đường tới giai đoạn kế; bông hoa cuối vòng là đích của giai đoạn. */
const HALO = "238 180";
// Quầng sáng của lá đã sáng (giao diện tối) và của đom đóm: vẽ bằng hình, không dùng filter (xem js/art.js).
const HALO_GLOW = [[0, 0.42], [0.38, 0.42], [0.5, 0.29], [0.62, 0.17], [0.74, 0.08], [0.86, 0.03], [1, 0]];
function garden(j) {
  const p = j.plant;
  const goalDays = p.next ? p.okDays + p.next.inDays : 0;
  // 12 hoặc 30 ngày: mỗi lá đúng một ngày. Ít hơn (1, 5) hoặc nhiều hơn (60): 30 lá chia theo tỉ lệ cho vòng luôn đầy đặn.
  const slots = goalDays >= 10 && goalDays <= 36 ? goalDays : 30;
  const lit = goalDays ? Math.min(slots - 1, Math.floor((p.okDays / goalDays) * slots)) : slots - 1;
  const turn = (i) => `rotate(${r1(-150 + (300 * i) / (slots - 1))} ${HALO})`;
  const mark = (i) => html`<use href="#halo-mark" transform="${turn(i)}"/>`;
  const idx = Array.from({ length: slots - 1 }, (_, i) => i);
  const owner = j.name ? `Cây hoa của ${j.name}` : "Cây hoa";
  const count = goalDays ? `${p.okDays} trên ${goalDays} ngày đạt mục tiêu để sang giai đoạn kế.` : `${p.okDays} ngày đạt mục tiêu.`;

  return html`<section class="garden" aria-label="${owner}">
    <div class="garden__scene">
      <svg class="garden__art" viewBox="0 0 358 330" role="img" aria-label="${owner}: ${p.name.toLowerCase()}, giai đoạn ${p.stage} trên ${p.stages}. ${count}">
        ${raw(glowDef("glow-garden"))}${raw(glowDef("glow-halo", HALO_GLOW))}
        <circle class="halo__disc" cx="238" cy="180" r="94" opacity=".55"/>
        <circle class="halo__disc" cx="238" cy="180" r="70" opacity=".8"/>
        <g class="only-light">
          <g class="f-cloud"><circle cx="296" cy="30" r="8"/><circle cx="310" cy="24" r="11.5"/><circle cx="325" cy="31" r="7.5"/><rect x="288" y="29" width="45" height="10" rx="5"/></g>
          <g class="f-cloud"><circle cx="34" cy="152" r="8"/><circle cx="47" cy="146" r="11.5"/><circle cx="61" cy="153" r="7.5"/><rect x="26" y="151" width="43" height="10" rx="5"/></g>
        </g>
        <g class="only-dark">
          <path class="f-moon" d="M329 14a14 14 0 1 0 10 22 12 12 0 0 1-10-22z"/>
          <g class="f-star"><circle cx="280" cy="26" r="1.2"/><circle cx="176" cy="22" r="1"/><circle cx="62" cy="146" r="1.2"/><circle cx="24" cy="170" r="1"/><circle cx="348" cy="104" r="1"/><circle cx="206" cy="44" r="1"/></g>
        </g>
        <path class="f-hill-back" d="M0 266C56 244 118 246 186 262 246 276 308 264 358 246V330H0z"/>
        <path class="f-hill" d="M0 298C70 282 150 286 222 300 272 308 322 303 358 293V330H0z"/>
        <g class="garden__grass"><path d="M112 320l-3-7M115 320v-9M118 320l3-6M330 316l-3-7M333 316v-9M336 316l3-6M20 314l-3-6M23 314v-8M26 314l3-6"/></g>
        <g class="only-light"><circle class="f-light" cx="76" cy="318" r="3"/><circle class="f-sun" cx="76" cy="318" r="1.3"/><circle class="f-light" cx="346" cy="322" r="3"/><circle class="f-sun" cx="346" cy="322" r="1.3"/><circle class="f-light" cx="150" cy="321" r="3"/><circle class="f-sun" cx="150" cy="321" r="1.3"/></g>

        <path class="halo__vine" d="M184 273.5A108 108 0 1 1 292 273.5"/>
        <g class="only-dark">${raw(idx.filter((i) => i < lit).map((i) => glow("glow-halo", 238, 72, 11.8, 8.6, `transform="${turn(i)}"`)).join(""))}</g>
        <g class="halo__lit">${idx.filter((i) => i < lit).map(mark)}</g>
        <g class="halo__todo">${idx.filter((i) => i >= lit).map(mark)}</g>
        <g transform="rotate(150 ${HALO})"><use href="#flower" transform="translate(238 72) rotate(-150) scale(.95)"/></g>

        <svg x="139.5" y="76" width="197" height="242" viewBox="${PLANT_VIEWBOX}">${raw(plantInner(p.stage))}</svg>

        ${p.stage < 6 ? html`<g class="only-light" transform="translate(306 136) rotate(-16)"><path class="f-bloom" d="M0 0C-3-9-13-11-14-4-14 2-6 3 0 0z"/><path class="f-bloom" d="M0 0C3-9 13-11 14-4 14 2 6 3 0 0z"/><path class="f-sun" d="M0 1C-4 2-10 5-8 9-5 11-1 7 0 1z"/><path class="f-sun" d="M0 1C4 2 10 5 8 9 5 11 1 7 0 1z"/><path class="garden__bug" d="M0-4v10"/></g>` : ""}
        <g class="only-dark">${raw(fireflies("glow-garden", [[262, 92, 2.2], [190, 134, 1.8], [40, 286, 1.6], [336, 282, 1.5]]))}</g>
      </svg>
      <div class="garden__head">
        <p class="eyebrow">${owner}</p>
        <h2 class="garden__title">${p.name}</h2>
        <p class="garden__stage">Giai đoạn ${p.stage}/${p.stages}</p>
      </div>
      <p class="garden__count" aria-hidden="true"><span><b>${p.okDays}</b>${goalDays ? html`<i>/${goalDays}</i>` : ""}</span>ngày đạt</p>
    </div>
    <p class="garden__line">${p.okDays > 0
      ? html`<b>${p.okDays} ngày</b> đạt mục tiêu. ${p.next ? html`Còn ${p.next.inDays}&nbsp;ngày nữa là ${p.next.name.toLowerCase()}.` : p.line}`
      : html`${p.line} Mỗi ngày ăn trong mục tiêu, cây lớn thêm một chút.`}</p>
    <ol class="stages" aria-label="Giai đoạn ${p.stage} trên ${p.stages}: ${p.name}">
      ${L.PLANT_STAGES.map((s, i) => {
        const n = i + 1;
        const state = n < p.stage ? "is-done" : n === p.stage ? "is-now" : "is-todo";
        const [a, ...rest] = s.name.split(" ");
        return html`<li class="stage ${state}" ${n === p.stage ? raw('aria-current="step"') : ""}><svg viewBox="0 0 30 30" aria-hidden="true"><use href="#stage-${n}"/></svg><span class="stage__name"><span>${a}</span> <span>${rest.join(" ")}</span></span></li>`;
      })}
    </ol>
  </section>`;
}

/* ---------------- cân nặng ---------------- */
function weightSum(w) {
  if (w.reached) return html`<b>Đã về đích!</b> Giờ là lúc giữ cân.`;
  if (w.gained) return html`Cân nặng lên xuống là chuyện thường. Cứ nhìn xu hướng cả tuần.`;
  const dot = w.etaWeeks ? " ·" : "";
  const eta = w.etaWeeks ? html` <span class="nowrap">khoảng ${w.etaWeeks}&nbsp;tuần nữa</span>` : "";
  if (w.lost < 0.05) return html`<span class="nowrap"><b>Còn ${L.fmt1(w.remaining)}&nbsp;kg</b> nữa là tới đích${dot}</span>${eta}`;
  return html`<span class="nowrap"><b>Đã giảm ${L.fmt1(w.lost)}&nbsp;kg</b> ·</span> <span class="nowrap">còn ${L.fmt1(w.remaining)}&nbsp;kg${dot}</span>${eta}`;
}

/** Chọn mốc nào được ghi nhãn dưới đường mòn để chữ không đè nhau: mốc kế tiếp trước, rồi mốc có quà, rồi các mốc còn lại.
    Tính theo bề ngang thật của chữ trên đường mòn hẹp nhất (máy 360px), nên máy rộng hơn chỉ thoáng thêm. */
function labelledStops(marks, goalKg) {
  const TRACK = 296, CH = 6.7, PAD = 6;                 // px: bề ngang đường mòn, một ký tự, khoảng hở tối thiểu
  const text = (m) => `−${kgText(m.kg)} kg`;
  const half = (m) => (text(m).length * CH) / 2;
  const goalLeft = TRACK - Math.max(`−${kgText(goalKg)} kg`.length * CH, 42); // nhãn đích: "−6 kg" trên, "Về đích" dưới
  const placed = [];
  const next = marks.find((m) => !m.reached);
  const order = [...marks].sort((a, b) => (b === next) - (a === next) || !!b.reward - !!a.reward || a.at - b.at);
  for (const m of order) {
    const x = m.at * TRACK;
    if (x - half(m) < -6 || x + half(m) + PAD > goalLeft) continue;
    if (placed.some((q) => Math.abs(q.at * TRACK - x) < half(m) + half(q) + PAD)) continue;
    placed.push(m);
  }
  return new Set(placed);
}

function trail(j) {
  const w = j.weight;
  const total = L.round1(w.start - w.goal);
  const goal = j.trail.find((t) => t.kind === "goal");
  if (!(total > 0) || !goal) return "";
  const p = L.clamp(w.pct, 0, 1);
  const here = w.reached ? 0.97 : L.clamp(p, 0.06, 0.9);  // mầm "đang ở đây" không chồng lên bông hoa đích
  const marks = j.trail.filter((t) => t.kind === "mark").map((t) => ({ ...t, at: r4(L.clamp(t.kg / total, 0, 1)) }));
  const shown = labelledStops(marks, goal.kg);
  const stones = marks.filter((m) => m.at <= 0.87);        // mốc sát đích sẽ nằm dưới bông hoa: chỉ còn trong danh sách đọc
  const where = w.reached ? `${cap(j.you)} đã về đích` : `${cap(j.you)} đang ở đây`;

  return html`<div class="trail ${marks.length > 6 ? "trail--dense" : ""} ${w.reached ? "is-home" : ""}" style="--p:${r4(p)};--here:${r4(here)}">
    <p class="trail__here"><span>${where} ·</span> <b>${L.fmt1(w.current)}&nbsp;kg</b></p>
    <div class="trail__track">
      <span class="trail__fill"></span>
      ${stones.map((m) => html`<span class="trail__stone ${m.reached ? "is-done" : ""} ${m.reward ? "has-gift" : ""}" style="--at:${m.at}">${m.reached ? use("i-check") : m.reward ? use("i-heart", "trail__heart") : ""}</span>`)}
      <span class="trail__stone trail__stone--goal"><svg viewBox="-13 -13 26 26" aria-hidden="true"><use href="#flower" transform="scale(1.2)"/></svg></span>
      <svg class="trail__you" viewBox="0 0 32 30" aria-hidden="true"><use href="#sprout-ok"/></svg>
    </div>
    <ol class="trail__stops" aria-label="Các mốc trên chặng đường">
      ${marks.map((m) => html`<li class="trail__stop ${m.reached ? "is-done" : ""} ${shown.has(m) ? "" : "j-sr"}" style="--at:${m.at}"><b>−${kgText(m.kg)}&nbsp;kg</b>${L.fmt1(m.weight)}<span class="j-sr">${m.reached ? " kg, đã qua" : " kg"}</span></li>`)}
      <li class="trail__stop trail__stop--goal ${goal.reached ? "is-done" : ""}"><b>−${kgText(goal.kg)}&nbsp;kg</b>Về đích</li>
    </ol>
  </div>`;
}

/** Biểu đồ cân nặng: trục ngang theo ngày thật, đường chấm ước tính từ lần cân gần nhất tới đích. */
function weightChart(j, todayKey) {
  const c = j.chart, w = j.weight, pts = c.points, n = pts.length;
  const X0 = 36, X1 = 284, GX0 = 28, GX1 = 296, YT = 50, YB = 132, YL = 154, VW = 300;
  let lo = Math.min(c.min, c.goal), hi = Math.max(c.max, c.goal);
  if (hi - lo < 1) { const mid = (hi + lo) / 2; lo = mid - 0.5; hi = mid + 0.5; }
  const span = hi - lo;
  const y = (v) => r1(YB - ((v - lo) / span) * (YB - YT));

  // trục ngang. Ngày ước tính về đích đếm từ HÔM NAY (khớp với câu "khoảng N tuần nữa"), kể cả khi lần cân gần nhất đã cách vài ngày.
  const first = pts[0], last = pts[n - 1];
  const dataDays = L.diffDays(first.k, last.k);
  const projDays = !w.reached && c.etaWeeks > 0 ? c.etaWeeks * 7 : 0;
  const projKey = projDays ? L.addDays(todayKey, projDays) : null;
  const aheadDays = projKey ? Math.max(projDays, L.diffDays(last.k, projKey)) : 0;
  const projShare = !aheadDays ? 0 : dataDays <= 0 ? 1 : L.clamp(aheadDays / (dataDays + aheadDays), 0.25, 0.5);
  const dataW = (X1 - X0) * (1 - projShare);
  const xAt = (days) => r1(dataDays > 0 ? X0 + (dataW * days) / dataDays : aheadDays ? X0 : (X0 + X1) / 2);
  const P = pts.map((pt) => ({ x: xAt(L.diffDays(first.k, pt.k)), y: y(pt.w) }));
  const end = P[n - 1], yGoal = y(c.goal);

  // trục dọc: tối đa 5 vạch tròn số. Vạch nào rơi vào dải nhãn "Đích …" thì bỏ, thay bằng con số của chính vạch đích.
  const step = [0.5, 1, 2, 5, 10, 20, 50].find((s) => span / s <= 4) || 100;
  const ticks = [];
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + 1e-9; v += step) {
    const yv = y(r1(v));
    if (!(yv > yGoal - 16 && yv < yGoal + 11)) ticks.push(r1(v));
  }
  const tickText = (v) => (step < 1 ? L.fmt1(v) : L.fmtInt(v));
  const goalTick = step < 1 ? L.fmt1(c.goal) : Number.isInteger(c.goal) ? L.fmtInt(c.goal) : "";

  const line = P.map((q, i) => `${i ? "L" : "M"}${q.x} ${q.y}`).join("");
  // nhãn số cân mới nhất: nằm phía đường không đi qua.
  //  · đường đi xuống và còn chỗ bên dưới → nằm dưới điểm (lệch trái khi có đường chấm ước tính đi xuống bên phải);
  //  · không thì nằm trên điểm, nhấc cao thêm theo độ dốc để đoạn vừa tới không cắt ngang chữ.
  const nowW = L.fmt1(last.w), halfW = nowW.length * 4 + 2;
  const fromAbove = n > 1 && P[n - 2].y < end.y;
  const slope = fromAbove ? (end.y - P[n - 2].y) / Math.max(1, end.x - P[n - 2].x) : 0;
  const below = fromAbove && end.y + 24 < YB;
  const midX = L.clamp(end.x, GX0 + halfW, GX1 - halfW);
  const lastLabel = !below
    ? { x: midX, y: Math.max(36, end.y - 13 - Math.min(34, slope * halfW)), anchor: "middle" }
    : projKey && end.x - 5 - halfW * 2 > GX0
      ? { x: end.x - 5, y: end.y + 22, anchor: "end" }
      : { x: midX, y: end.y + 23, anchor: "middle" };
  // chữ rơi đúng lên vạch đích (cân đã xuống dưới đích): nhấc hẳn lên trên vạch
  if (!below && lastLabel.y - 13 < yGoal && lastLabel.y + 4 > yGoal && yGoal - 6 >= 36) lastLabel.y = yGoal - 6;

  // nhãn ngày: lần cân gần nhất và ngày ước tính luôn có; ngày đầu và các ngày giữa chỉ hiện khi không chạm nhãn khác
  const axisDays = L.diffDays(first.k, projKey || last.k);
  const dt = (k, spoken) => dateText(k, todayKey, axisDays, spoken);
  const CW = 6.4, nowDate = dt(last.k), projDate = projKey ? `≈ ${dt(projKey)}` : "";
  const nowX = L.clamp(end.x, (nowDate.length * CW) / 2, VW - (nowDate.length * CW) / 2);
  const taken = [[nowX - (nowDate.length * CW) / 2, nowX + (nowDate.length * CW) / 2]];
  if (projKey) taken.push([GX1 - projDate.length * CW, GX1]);
  const dates = [];
  const addDate = (x, text) => {
    const h = (text.length * CW) / 2;
    if (!taken.every(([a, b]) => x + h + 7 < a || x - h - 7 > b)) return;
    dates.push({ x, text });
    taken.push([x - h, x + h]);
  };
  addDate(P[0].x, dt(first.k));
  if (dataDays >= 14 && dataW >= 150) {
    for (const f of dataW >= 220 ? [1 / 3, 2 / 3] : [0.5]) {
      const d = Math.round(dataDays * f);
      addDate(xAt(d), dt(L.addDays(first.k, d)));
    }
  }
  const label = `Cân nặng từ ${L.fmt1(first.w)} kg (${dt(first.k, true)})${n > 1 ? ` đến ${L.fmt1(last.w)} kg (${dt(last.k, true)})` : ""}; đích ${L.fmt1(c.goal)} kg${projKey ? `, ước tính tới đích khoảng ${dt(projKey, true)}` : ""}.`;

  const spanText = n < 2 ? "1 lần cân" : dataDays < 14 ? `${dataDays} ngày` : `${Math.round(dataDays / 7)} tuần`;
  const delta = Math.abs(w.lost) >= 0.05 ? html` · <b>${w.lost > 0 ? "−" : "+"}${L.fmt1(Math.abs(w.lost))}&nbsp;kg</b>` : "";

  return html`<div class="weight__chart">
    <p class="sub-head">Diễn biến <span class="section-meta">${spanText}${delta}</span></p>
    <svg class="chart" viewBox="0 22 ${VW} 140" role="img" aria-label="${label}">
      <path class="chart__grid" d="${ticks.map((v) => `M${GX0} ${y(v)}H${GX1}`).join("")}"/>
      <path class="chart__goal" d="M${GX0} ${yGoal}H${GX1}"/>
      <g class="chart__axis" text-anchor="end">${ticks.map((v) => html`<text x="22" y="${r1(y(v) + 4)}">${tickText(v)}</text>`)}${goalTick ? html`<text x="22" y="${r1(yGoal + 4)}">${goalTick}</text>` : ""}</g>
      ${n > 1 ? html`<path class="chart__area" d="${line}V${YB}H${P[0].x}z"/>` : ""}
      ${projKey ? html`<path class="chart__proj" d="M${end.x} ${end.y}L${X1} ${yGoal}"/><use href="#flower" transform="translate(${X1} ${yGoal}) scale(.78)"/>` : ""}
      ${n > 1 ? html`<path class="chart__line" d="${line}"/>` : ""}
      ${n > 1 && n <= 14 ? html`<g class="chart__dot">${P.slice(0, -1).map((q) => html`<circle cx="${q.x}" cy="${q.y}" r="4"/>`)}</g>` : ""}
      <circle class="chart__dot chart__dot--now" cx="${end.x}" cy="${end.y}" r="7"/>
      <text class="chart__goal-label" x="${GX0 + 6}" y="${r1(yGoal - 7)}">Đích ${L.fmt1(c.goal)}</text>
      <text class="chart__now-label" x="${r1(lastLabel.x)}" y="${r1(lastLabel.y)}" text-anchor="${lastLabel.anchor}">${nowW}</text>
      <g class="chart__axis" text-anchor="middle">${dates.map((d) => html`<text x="${d.x}" y="${YL}">${d.text}</text>`)}</g>
      <text class="chart__axis chart__axis--now" x="${r1(nowX)}" y="${YL}" text-anchor="middle">${nowDate}</text>
      ${projKey ? html`<text class="chart__axis chart__axis--proj" x="${GX1}" y="${YL}" text-anchor="end">${projDate}</text>` : ""}
    </svg>
    ${projKey ? html`<p class="chart__note"><i aria-hidden="true"></i>Đường chấm: ước tính theo nhịp ăn hiện tại.</p>` : ""}
  </div>`;
}

function weightPanel(j, todayKey) {
  const w = j.weight;
  const ago = L.diffDays(w.lastKey, todayKey);
  return html`<section class="panel weight" aria-label="Cân nặng">
    <header class="weight__top">
      <h2 class="section-title">Cân nặng</h2>
      <button class="btn btn--primary" data-act="weight">${use("i-scale", "icon icon--md")}Ghi cân nặng</button>
    </header>
    <ol class="weight__path">
      <li class="weight__pt">Bắt đầu<span class="weight__val"><b>${L.fmt1(w.start)}</b>&nbsp;kg</span></li>
      <li class="weight__to" aria-hidden="true"></li>
      <li class="weight__pt weight__pt--now">${ago >= 2 ? `Hiện tại · cân ${dateText(w.lastKey, todayKey)}` : "Hiện tại"}<span class="weight__val"><b>${L.fmt1(w.current)}</b>&nbsp;kg</span></li>
      <li class="weight__to" aria-hidden="true"></li>
      <li class="weight__pt weight__pt--goal">Đích<span class="weight__val"><b>${L.fmt1(w.goal)}</b>&nbsp;kg</span></li>
    </ol>
    <p class="weight__sum">${weightSum(w)}</p>
    ${trail(j)}
    ${weightChart(j, todayKey)}
  </section>`;
}

/* ---------------- quà hẹn ở các mốc ---------------- */
function gifts(j) {
  const list = j.gifts;
  const title = j.partner ? `Hộp quà ${j.partner} hẹn` : "Hộp quà ở mỗi chặng";
  if (!list.length) {
    return html`<section class="plain" aria-label="${title}">
      <header class="section-head"><h2 class="section-title">${use("i-heart", "")}<span>${title}</span></h2></header>
      <div class="gift-empty">
        <p>Hẹn một phần thưởng nhỏ ở mỗi mốc để chặng đường vui hơn.</p>
        <button class="btn btn--ghost sm" data-act="settings:gift">${use("i-plus", "icon icon--sm")}Thêm quà</button>
      </div>
    </section>`;
  }
  // Ba trạng thái: chưa tới mốc (hộp khoá, chưa biết bên trong là gì) · đã tới mốc, chờ bấm mở · đã mở (hiện món quà).
  // Mốc kg tính theo số cân thấp nhất từng ghi nên quà đã tới tay thì không bị khoá lại khi cân nhích lên.
  const open = list.filter((g) => g.opened).length;
  const flap = (g) => (g.kind === "days" ? html`${g.days}&nbsp;ngày đạt mục tiêu` : html`${g.isGoal ? "Về đích" : "Mốc"} −${kgText(g.kg)}&nbsp;kg · ${L.fmt1(g.weight)}&nbsp;kg`);
  const away = (g) => (g.kind === "days" ? html`Còn ${g.left}&nbsp;ngày đạt` : html`Còn ${L.fmt1(Math.max(0, j.weight.current - g.weight))}&nbsp;kg`);
  return html`<section class="plain" aria-label="${title}">
    <header class="section-head">
      <h2 class="section-title">${use("i-heart", "")}<span>${title}</span></h2>
      <p class="section-meta nowrap"><b>${open}</b>/${list.length} đã mở</p>
    </header>
    <ul class="gifts">
      ${list.map((g) => html`<li class="gift ${g.opened ? "is-open" : g.reached ? "is-ready" : "is-locked"}">
        <span class="gift__art">${raw(giftArt(g.opened, 56))}</span>
        <div class="gift__body">
          <span class="gift__flap">${flap(g)}</span>
          <span class="gift__name">${g.opened ? g.text : g.reached ? "Quà đang chờ mở" : "Hộp quà bí mật"}</span>
          ${g.opened ? html`<span class="gift__state">${use("i-check")}Đã mở quà</span>`
            : g.reached ? "" : html`<span class="gift__state">${use("i-lock")}${away(g)}</span>`}
        </div>
        ${g.reached && !g.opened ? html`<button class="btn primary sm gift__open" data-act="gift:${g.id}">Mở quà</button>` : ""}
      </li>`)}
    </ul>
  </section>`;
}

/* ---------------- tuần này ---------------- */
const STATUS_WORD = { ok: "đạt mục tiêu", over: "vượt mức", partial: "ghi chưa đủ bữa", none: "chưa ghi", today: "hôm nay", future: "chưa tới" };
function weekBars(j, todayKey) {
  const wk = j.week, list = wk.list, target = j.target;
  const anyLog = list.some((d) => L.hasLog(S.days[d.k]));
  const waiting = ((S.days[todayKey] || {}).meals || []).some((m) => m.pending);
  // Mỗi ngày có thể có mục tiêu riêng (mục tiêu đổi theo cân nặng): cột được quy về mục tiêu hôm nay,
  // nên "chạm vạch" luôn có nghĩa là "đúng mục tiêu của ngày đó". Số ghi dưới cột vẫn là kcal thật.
  const scaled = (d) => (d.target > 0 ? (d.kcal / d.target) * target : d.kcal);
  const max = Math.max(target, ...list.map(scaled)) * 1.2;
  const pct = (v) => r1((v / max) * 100);
  const kind = (d) => (d.kcal <= 0 ? "is-empty" : d.status === "over" ? "is-over" : d.isToday ? "is-today" : d.status === "partial" ? "is-partial" : "");
  // nhãn "Mục tiêu" nằm trên vạch: né bên nào có cột cao chạm vạch
  const tall = (d) => scaled(d) > target * 0.8;
  const side = !list.slice(4).some(tall) ? "" : !list.slice(0, 3).some(tall) ? "is-left" : "is-off";
  const hasPartial = list.some((d) => d.kcal > 0 && d.status === "partial" && !d.isToday);
  const sum = wk.closedCount
    ? html`<b>${wk.okCount}/${wk.closedCount} ngày đạt</b>${wk.avg ? html` · trung bình ${L.fmtInt(wk.avg)}&nbsp;kcal` : ""}`
    : wk.avg ? html`trung bình ${L.fmtInt(wk.avg)}&nbsp;kcal` : anyLog ? "Đã bắt đầu ghi" : list[0].isToday ? "Tuần mới bắt đầu" : "Chưa ghi ngày nào";
  // chưa có cột nào: nói rõ vì sao (chưa ghi · đang tính calo · bữa đã ghi chưa có calo)
  const hint = list.some((d) => d.kcal > 0) ? ""
    : !anyLog ? "Ghi bữa đầu tiên của tuần, cột của hôm nay sẽ mọc lên ở đây."
    : waiting ? "Đang tính calo cho bữa vừa ghi…"
    : "Bữa đã ghi chưa có calo nên cột chưa mọc lên.";
  const spoken = list.map((d) => `${d.label}: ${d.kcal > 0 ? `${L.fmtInt(d.kcal)} kcal, ` : ""}${d.isToday && d.status !== "over" ? "hôm nay" : STATUS_WORD[d.status]}`).join("; ");

  return html`<section class="plain" aria-label="Tuần này">
    <header class="section-head">
      <h2 class="section-title">Tuần này</h2>
      <p class="section-meta">${sum}</p>
    </header>
    <div class="week-chart" role="img" aria-label="Calo từng ngày, mục tiêu ${L.fmtInt(target)} kcal. ${spoken}.">
      <div class="bars">
        <span class="bars__target ${side}" style="bottom:${pct(target)}%"><b>Mục tiêu ${L.fmtInt(target)}</b></span>
        ${hint ? html`<p class="bars__hint">${hint}</p>` : ""}
        ${list.map((d) => html`<div class="bar ${kind(d)}"><span class="bar__fill" ${d.kcal > 0 ? raw(`style="height:${pct(scaled(d))}%"`) : ""}>${d.kcal > 0 && d.status === "over" ? use("i-chevron", "icon bar__up") : ""}</span></div>`)}
      </div>
      <span class="bars__bed"></span>
      <div class="bars__names">${list.map((d) => html`<span class="${kind(d) === "is-over" ? "is-over" : d.isToday ? "is-today" : kind(d)}"><b>${d.label}</b>${d.kcal > 0 ? L.fmtInt(d.kcal) : "—"}</span>`)}</div>
    </div>
    <ul class="legend">
      <li style="--dot:var(--leaf)"><i></i>Đạt</li>
      <li class="legend__over" style="--dot:var(--over)"><i></i>Vượt mức</li>
      <li style="--dot:var(--leaf-soft);--ring:inset 0 0 0 2px var(--leaf)"><i></i>Hôm nay</li>
      ${hasPartial ? html`<li class="legend__part"><i></i>Ghi chưa đủ</li>` : ""}
      ${side === "is-off" ? html`<li class="legend__line"><i></i>Mục tiêu ${L.fmtInt(target)}&nbsp;kcal</li>` : ""}
    </ul>
  </section>`;
}

/* ---------------- chuỗi ngày + lịch tháng ---------------- */
function streakAndMonth(j, todayKey, todayLogged) {
  const st = j.streak, mo = j.month;
  // các ngày thuộc chuỗi hiện tại (kết thúc hôm nay nếu đã ghi, không thì hôm qua)
  const run = new Set();
  for (let i = 0, k = todayLogged ? todayKey : L.addDays(todayKey, -1); i < st.current; i++, k = L.addDays(k, -1)) run.add(k);
  const cells = mo.weeks.flat();
  const logged = (c) => !!c && (c.status === "ok" || c.status === "over" || c.status === "partial" || (c.isToday && todayLogged));
  const linked = (c, dir) => {
    if (!logged(c)) return false;
    const other = cells[cells.indexOf(c) + dir];
    if (other) return logged(other);
    return run.has(c.k) && run.has(L.addDays(c.k, dir)); // mép tháng: chỉ biết chắc với chuỗi hiện tại
  };
  const cls = (c) => {
    const out = [];
    if (c.status === "ok") out.push("is-ok");
    else if (c.status === "over") out.push("is-over");
    else if (c.status === "partial") out.push("is-part");
    else if (c.status === "future") out.push("is-future");
    if (c.isToday) out.push(c.status === "over" ? "is-now" : "is-today");
    if (run.has(c.k) && logged(c)) out.push("in-streak");
    if (linked(c, -1)) out.push("has-prev");
    if (linked(c, 1)) out.push("has-next");
    if (c.weighed) out.push("has-weight");
    return out.join(" ");
  };
  const said = (c) => {
    const dt = L.parseKey(c.k);
    const what = c.isToday ? (c.status === "over" ? "hôm nay, vượt mức" : todayLogged ? "hôm nay, đã ghi" : "hôm nay") : STATUS_WORD[c.status];
    return `${dt.getDate()} tháng ${dt.getMonth() + 1}: ${what}${c.weighed ? ", có ghi cân" : ""}`;
  };
  // Chạm vào một ngày để mở nhật ký ngày đó ở màn Hôm nay. Chỉ những ngày từ lúc bắt đầu tới hôm nay mới là nút
  // (cùng giới hạn với dải tuần ở Hôm nay); ngày chưa tới và ngày trước khi bắt đầu vẫn là ô thường.
  const firstKey = [S.profile.startDate, ...Object.keys(S.days || {})].filter(L.isKey).sort()[0] || todayKey;
  const canOpen = (c) => c.k >= firstKey && c.k <= todayKey;
  const face = (c) => html`<span>${c.d}</span>${c.isToday && todayLogged ? html`<svg class="cal__sprout" viewBox="0 0 32 30" aria-hidden="true"><use href="#sprout-ok"/></svg>` : ""}`;
  const cell = (c) => {
    if (!c) return html`<span class="cal__d" aria-hidden="true"></span>`;
    const now = c.isToday ? raw('aria-current="date"') : "";
    return canOpen(c)
      ? html`<button class="cal__d ${cls(c)}" data-act="day:${c.k}" aria-label="${said(c)}" ${now}>${face(c)}</button>`
      : html`<span class="cal__d ${cls(c)}" role="img" aria-label="${said(c)}" ${now}>${face(c)}</span>`;
  };
  const okInMonth = cells.filter((c) => c && c.status === "ok").length;
  const hasPart = cells.some((c) => c && c.status === "partial");
  const hasWeight = cells.some((c) => c && c.weighed);

  // luống 7 ngày gần nhất: mầm cho những ngày trong chuỗi, hạt cho ngày còn chờ
  const grown = Math.min(st.current, todayLogged ? 7 : 6);
  const bed = Array.from({ length: 7 }, (_, i) => {
    const fromEnd = 6 - i; // 0 = hôm nay
    if (fromEnd === 0) return todayLogged ? "sprout-today" : "sprout-seed";
    if (fromEnd > (todayLogged ? grown - 1 : grown)) return "sprout-seed";
    const day = S.days[L.addDays(todayKey, -fromEnd)];
    return L.dayStatus(day, L.targetForDay(day, j.target)) === "over" ? "sprout-over" : "sprout-ok";
  });
  const best = st.current > 0 && st.best <= st.current ? "Đang là chuỗi dài nhất" : st.best > 0 ? `Kỷ lục ${st.best} ngày` : `Ghi bữa đầu tiên để bắt đầu chuỗi`;

  return html`<section class="plain" aria-label="Chuỗi ngày ghi nhật ký">
    <header class="section-head">
      <h2 class="section-title">Chuỗi ngày ghi nhật ký</h2>
    </header>
    <div class="panel">
      <div class="streak">
        <div>
          <p class="streak__num"><b>${st.current}</b> ngày liên tiếp</p>
          <p class="streak__best">${best}</p>
        </div>
        <div class="streak__row" aria-hidden="true">${bed.map(sprout)}</div>
      </div>
      <div class="cal__month">
        <p class="cal__label">${mo.label} <span class="section-meta">${okInMonth} ngày đạt</span></p>
        <div class="cal__nav">
          <button class="icon-btn sm" data-act="month:-1" aria-label="Tháng trước" ${mo.canPrev ? "" : raw("disabled")}>${raw(icon("chev-left"))}</button>
          <button class="icon-btn sm" data-act="month:1" aria-label="Tháng sau" ${mo.canNext ? "" : raw("disabled")}>${raw(icon("chev-right"))}</button>
        </div>
      </div>
      <div class="cal__dow" aria-hidden="true">${L.WEEKDAY_SHORT.map((d) => html`<span>${d}</span>`)}</div>
      <div class="cal">
        ${cells.map(cell)}
      </div>
      <ul class="legend">
        <li style="--dot:var(--leaf-strong)"><i></i>Đạt mục tiêu</li>
        <li class="legend__over-ring" style="--dot:var(--over-soft);--ring:inset 0 0 0 2px var(--over)"><i></i>Vượt mức</li>
        ${hasPart ? html`<li class="legend__part"><i></i>Ghi chưa đủ</li>` : ""}
        ${hasWeight ? html`<li class="legend__weight"><i></i>Có ghi cân</li>` : ""}
        <li style="--dot:var(--leaf-soft)"><i class="is-band"></i>Chuỗi hiện tại</li>
      </ul>
    </div>
  </section>`;
}

/* ---------------- chum thâm hụt ---------------- */
function bank(j) {
  const b = j.bank, empty = !(b.kcal > 0);
  // mực nước trong chum: lòng chum từ y=73 (đáy) lên y=31 (miệng)
  const level = empty ? 76 : r1(73 - L.clamp(b.pct, 0.06, 1) * 40);
  return html`<section class="bank ${empty ? "is-empty" : ""}" aria-label="Quỹ thâm hụt">
    <svg class="bank__art" viewBox="0 0 64 84" aria-hidden="true">
      <defs><clipPath id="chum-in"><path d="M22.5 31C13 37 13 55 20.5 73H43.5C51 55 51 37 41.5 31z"/></clipPath></defs>
      <ellipse class="ill-shadow" cx="32" cy="80.5" rx="22" ry="3.2"/>
      <path class="f-water" d="M32 5c2.3 2.9 4.1 5 4.1 7.4a4.1 4.1 0 0 1-8.2 0c0-2.4 1.8-4.5 4.1-7.4z"/>
      <path class="f-water" d="M41 0c1.5 1.9 2.7 3.3 2.7 4.9a2.7 2.7 0 0 1-5.4 0C38.3 3.3 39.5 1.9 41 0z" opacity=".7"/>
      <path class="f-clay" d="M20 25C5 32 6 56 16 76 17 79 19 80 22 80H42C45 80 47 79 48 76 58 56 59 32 44 25z"/>
      <path class="f-surface" d="M22.5 31C13 37 13 55 20.5 73H43.5C51 55 51 37 41.5 31z"/>
      <g clip-path="url(#chum-in)"><path class="f-water" d="M10 ${level}c4-2.5 8 2 12 0s8-2.5 12 0 8 2 12 0 6-1 8 0V84H10z"/></g>
      <path class="ill-gloss-line" d="M13.5 44c-1.5 9 0 19 4.5 29"/>
      <rect class="f-clay-deep" x="16" y="19" width="32" height="8" rx="4"/>
    </svg>
    <div class="bank__text">
      <p class="bank__label">Chum nước mưa của ${j.you}</p>
      ${empty
        ? html`<p class="bank__num bank__num--empty">Chum đang chờ những giọt đầu tiên</p>
          <p class="bank__eq">Mỗi ngày ăn ít hơn mức cơ thể đốt, chum lại đầy thêm một chút.</p>`
        : html`<p class="bank__num">Đã thâm hụt <span class="nowrap"><b>${L.fmtInt(b.kcal)}</b>&nbsp;kcal</span></p>
          <p class="bank__eq">≈ <b>${L.fmt1(b.kg)}&nbsp;kg mỡ</b> · ước tính</p>`}
    </div>
    <div class="bank__next" style="--fill:${empty ? 0 : r1(L.clamp(b.pct, 0, 1) * 100)}%">
      <span class="bank__bar"></span>
      <span>${empty
        ? html`Cứ ${L.fmtInt(L.KCAL_PER_KG)}&nbsp;kcal thâm hụt là khoảng 1&nbsp;kg mỡ (ước tính).`
        : html`Còn ${L.fmtInt(b.toNext)}&nbsp;kcal nữa là tròn ${b.nextKg}&nbsp;kg`}</span>
      ${empty ? "" : html`<span class="bank__why">Mỗi ngày ăn ít hơn mức cơ thể đốt, chum lại đầy thêm một chút.</span>`}
    </div>
  </section>`;
}

/* ---------------- huy hiệu ---------------- */
function badgeNeed(b, j) {
  if (b.id === "goal") return `Còn ${L.fmt1(j.weight.remaining)} kg`;
  if (b.id === "half") return `Đã đi ${Math.round(b.cur * 100)}%`;
  if (b.id === "first") return "Chưa ghi bữa nào";
  if (b.id.startsWith("lost")) return `${kgText(L.round1(b.cur))}/${kgText(b.max)} kg`;
  if (b.id.startsWith("photo")) return `${Math.round(b.cur)}/${b.max} ảnh`;
  if (!Number.isInteger(b.max)) return `${Math.round((b.cur / b.max) * 100)}%`;
  return `${Math.round(b.cur)}/${b.max} ngày`;
}
function badges(j) {
  return html`<section class="plain" aria-label="Huy hiệu">
    <header class="section-head">
      <h2 class="section-title">Hoa đã hái</h2>
      <p class="section-meta nowrap"><b>${j.earnedCount}</b>/${j.badges.length} huy hiệu</p>
    </header>
    <ul class="badges">
      ${j.badges.map((b) => {
        const need = b.on ? "" : badgeNeed(b, j);
        return html`<li class="badge ${b.on ? "" : "is-locked"}">
          ${raw(badgeArt(b.id, b.on, 72))}
          <span class="badge__name">${b.title}</span>
          ${b.on ? html`<span class="j-sr">đã đạt</span>` : html`<span class="badge__need">${need}</span><span class="j-sr">chưa đạt: ${b.desc}</span>`}
        </li>`;
      })}
    </ul>
  </section>`;
}

/* ---------------- cả màn ---------------- */
export function viewJourney() {
  const j = journeyModel(S, ctx(), stats(), { monthOffset });
  const today = j.week.list.find((d) => d.isToday);
  const todayKey = today ? today.k : S.today;
  const todayLogged = L.hasLog(S.days[todayKey]);   // có bữa là đã ghi (như cách tính chuỗi ngày), kể cả bữa 0 kcal hay đang chờ tính
  return html`
    ${pageHead(j, todayKey)}
    ${garden(j)}
    ${weightPanel(j, todayKey)}
    ${gifts(j)}
    ${weekBars(j, todayKey)}
    ${streakAndMonth(j, todayKey, todayLogged)}
    ${bank(j)}
    ${badges(j)}`;
}
