// models.js — gom số liệu cho hai màn chính thành "mô hình hiển thị" thuần dữ liệu.
// Không đụng DOM hay bộ nhớ: nhận trạng thái S và bối cảnh c = ctx() rồi trả về mọi thứ khuôn HTML cần.

import * as L from "./logic.js";
import * as W from "./words.js";
import { DISHES } from "./dishes.js";
import { EXERCISES } from "./exercises.js";

/** Trạng thái một ô ngày trên dải tuần / lịch tháng. */
function cellStatus(days, k, c) {
  if (k > c.todayKey) return "future";
  const day = days[k];
  if (k === c.todayKey) {
    if (!L.hasLog(day)) return "today";
    return L.dayTotals(day).kcal > c.target * L.OVER_TOLERANCE ? "over" : "today";
  }
  return L.dayStatus(day, L.targetForDay(day, c.target));
}

/**
 * @param {object} S  trạng thái app
 * @param {object} c  ctx()
 * @param {{hour:number, minute?:number, weekAnchor?:string|null, favLimit?:number}} o
 */
export function todayModel(S, c, o) {
  const key = S.viewDay;
  const isToday = key === c.todayKey;
  const day = S.days[key] || { meals: [] };
  const totals = L.dayTotals(day);
  const target = isToday ? c.target : L.targetForDay(day, c.target);
  const left = target - totals.kcal;
  const over = totals.kcal > target * L.OVER_TOLERANCE;
  const you = S.settings.pronoun || "bạn";
  const streak = L.currentStreak(S.days, c.todayKey);
  const pastStatus = isToday ? null : L.dayStatus(day, target);

  // dải tuần: mặc định là tuần chứa ngày đang xem; mũi tên lùi/tới đổi weekAnchor mà chưa đổi ngày xem
  const weekOf = o.weekAnchor && L.isKey(o.weekAnchor) ? o.weekAnchor : key;
  const firstKey = [S.profile.startDate, ...Object.keys(S.days)].filter(L.isKey).sort()[0] || c.todayKey;
  const week = L.weekKeys(weekOf).map((k, i) => {
    const d = S.days[k];
    const t = k === c.todayKey ? c.target : L.targetForDay(d, c.target);
    return {
      k, label: L.WEEKDAY_SHORT[i], dnum: L.parseKey(k).getDate(),
      status: cellStatus(S.days, k, c), selected: k === key, isToday: k === c.todayKey, isFuture: k > c.todayKey,
      pct: L.clamp(L.dayTotals(d).kcal / t, 0, 1),
    };
  });

  // các bữa theo nhóm
  const meals = (day.meals || []).map((m) => ({
    id: m.id, type: m.type, name: m.name, t: m.t, ph: m.ph || null, src: m.src,
    pending: !!m.pending, failed: m.failed || null, kcal: L.mealTotals(m).kcal,
  }));
  const groups = L.MEAL_TYPES.map((t) => {
    const list = meals.filter((m) => m.type === t.id);
    return { id: t.id, label: t.label, short: t.short, meals: list, kcal: list.reduce((a, m) => a + m.kcal, 0) };
  });
  const has = (id) => groups.find((g) => g.id === id).meals.length > 0;

  // ô mời chụp bữa kế tiếp (chỉ hôm nay): bữa chính đầu tiên còn trống tính từ giờ hiện tại
  let nextSlot = null, openSlots = [];
  if (isToday) {
    const t = o.hour + (o.minute || 0) / 60;
    const order = t < 10.5 ? ["sang", "trua", "toi"] : t < 15.5 ? ["trua", "toi"] : t < 22 ? ["toi"] : [];
    openSlots = order.filter((id) => !has(id));
    nextSlot = openSlots[0] || null;
  }

  // đạm · bột · béo so với mức tham chiếu 25% · 45% · 30% năng lượng mục tiêu
  const ref = { p: Math.round((target * 0.25) / 4), c: Math.round((target * 0.45) / 4), f: Math.round((target * 0.3) / 9) };
  const macros = ["p", "c", "f"].map((id) => ({ id, label: { p: "Đạm", c: "Bột", f: "Béo" }[id], g: totals[id], ref: ref[id], pct: L.clamp(totals[id] / ref[id], 0, 1) }));

  const coach = isToday
    ? W.coachToday({ eaten: totals.kcal, target, count: totals.count, hour: o.hour, streak, hasLunch: has("trua"), hasDinner: has("toi"), you, seed: key })
    : W.coachPast(pastStatus, totals.kcal, target);

  // lời nhắc về hôm qua
  let recap = null;
  if (isToday) {
    const y = L.addDays(c.todayKey, -1);
    if (!S.meta.seen[`recap:${y}`] && L.hasLog(S.days[y])) {
      const yd = S.days[y], yt = L.targetForDay(yd, c.target);
      const r = W.recapYesterday(L.dayStatus(yd, yt), L.dayTotals(yd).kcal, yt, you);
      if (r) recap = { key: y, ...r };
    }
  }

  const noteText = isToday ? W.noteOfDay(S.settings.notes, key) : null;
  const freq = L.frequentMeals(S.days, c.todayKey, S.favs, o.favLimit || 8);
  const favs = freq.map((f, i) => ({ i, name: f.name, kcal: f.kcal, pinned: f.pinned, ph: f.ph }));

  // gợi ý ăn gì với số kcal còn lại (chỉ hôm nay, khi chưa vượt mục tiêu và không có bữa nào đang chờ tính)
  const suggest = isToday && !over && !meals.some((x) => x.pending)
    ? L.suggestMeals({
        dishes: DISHES, slot: nextSlot, openSlots, left, own: freq, eaten: meals.map((x) => x.name),
        lowProtein: totals.count > 0 && totals.p / ref.p < totals.c / ref.c - 0.1, seed: key, offset: o.sugOffset || 0,
      })
    : null;

  // vận động: các buổi đã ghi, và gợi ý (chỉ hôm nay; đã tập rồi mà không còn vượt mức thì thôi gợi ý)
  const burn = L.dayBurn(day);
  const overBy = over ? totals.kcal - target : 0;
  const move = {
    ...burn,
    list: (day.ex || []).map((x) => ({ id: x.id, n: x.n, min: x.min, k: x.k })),
    ideas: isToday && (burn.count === 0 || overBy - burn.kcal >= 20) ? L.moveIdeas({ exercises: EXERCISES, kg: c.weight, over: overBy, burned: burn.kcal, seed: key }) : null,
  };

  return {
    key, isToday, pastStatus, move,
    greeting: W.greeting(o.hour, S.profile.name),
    dateLabel: L.longDate(key),
    dayTitle: isToday ? "hôm nay" : L.diffDays(key, c.todayKey) === 1 ? "hôm qua" : L.shortDate(key),
    streak,
    week,
    weekHasToday: week.some((d) => d.isToday),
    canNextWeek: L.weekStart(weekOf) < L.weekStart(c.todayKey),
    canPrevWeek: L.weekStart(weekOf) > L.weekStart(firstKey),
    weekLabel: `${L.shortDate(week[0].k)} – ${L.shortDate(week[6].k)}`,
    kcal: { target, eaten: totals.kcal, left, abs: Math.abs(left), pct: L.clamp(totals.kcal / target, 0, 1), over, hit: !over && left <= 0 },
    macros,
    coach,
    recap,
    note: noteText ? { text: noteText, label: W.noteLabel(S.settings.partner, you) } : null,
    water: { on: !!S.settings.water, count: day.water || 0, goal: S.settings.waterGoal },
    groups,
    mealCount: meals.length,
    pendingCount: meals.filter((m) => m.pending).length,
    nextSlot,
    favs,
    suggest,
    // lời nhận xét cuối ngày của Claude (nếu đã xin); stale: các bữa đã đổi sau lần nhận xét đó
    review: { has: !!day.rv, rv: day.rv || null, stale: !!day.rv && day.rv.sig !== L.reviewSig(day), canAsk: !!S.settings.apiKey && meals.some((x) => !x.pending && !x.failed) },
    you,
    hints: {
      noKey: !S.settings.apiKey && !S.meta.seen["hint:nokey"],
      memory: S.mode === "memory",
    },
  };
}

/**
 * @param {object} S
 * @param {object} c       ctx()
 * @param {object} stats   stats() = journeyStats + weightProgress
 * @param {{monthOffset?:number}} o
 */
export function journeyModel(S, c, stats, o = {}) {
  const p = S.profile;
  const you = S.settings.pronoun || "bạn";
  const series = L.weightSeries(S.days, p);
  const eta = L.etaWeeks(c.weight, p.goalWeight, c.tdee, c.target);

  // chặng đường: điểm đầu, các mốc, và vị trí hiện tại chen giữa
  // reached: theo cân hiện tại (viên đá trên đường mòn). opened: theo lần cân thấp nhất từng ghi — quà đã mở thì không bị lấy lại.
  const best = stats.bestLost ?? stats.lost;
  const ms = L.milestones(p, S.settings.rewards).map((m) => ({ ...m, weight: L.round1(p.startWeight - m.kg), reached: stats.lost >= m.kg - 1e-9, opened: best >= m.kg - 1e-9 }));
  const trail = [{ kind: "start", kg: 0, weight: p.startWeight, reached: true }];
  let placedNow = false;
  for (const m of ms) {
    if (!m.reached && !placedNow && !stats.reached) { trail.push({ kind: "now", kg: Math.max(0, stats.lost), weight: c.weight }); placedNow = true; }
    trail.push({ kind: m.isGoal ? "goal" : "mark", ...m });
  }
  if (!placedNow && !stats.reached && !ms.length) trail.push({ kind: "now", kg: Math.max(0, stats.lost), weight: c.weight });

  // biểu đồ cân nặng
  const ws = series.length ? series : [{ k: p.startDate, w: p.startWeight }];
  const lo = Math.min(p.goalWeight, ...ws.map((x) => x.w)), hi = Math.max(p.startWeight, ...ws.map((x) => x.w));
  const chart = { points: ws, goal: p.goalWeight, min: lo, max: hi, firstKey: ws[0].k, lastKey: ws[ws.length - 1].k, etaWeeks: eta };

  // lịch tháng
  const base = L.parseKey(c.todayKey);
  const mo = new Date(base.getFullYear(), base.getMonth() + (o.monthOffset || 0), 1, 12);
  const weeks = L.monthGrid(mo.getFullYear(), mo.getMonth() + 1).map((w) => w.map((k) => (k ? { k, d: L.parseKey(k).getDate(), status: cellStatus(S.days, k, c), isToday: k === c.todayKey, weighed: S.days[k]?.weight != null } : null)));
  const firstLog = Object.keys(S.days).filter(L.isKey).sort()[0] || c.todayKey;
  const month = {
    label: `Tháng ${mo.getMonth() + 1}${mo.getFullYear() !== base.getFullYear() ? " · " + mo.getFullYear() : ""}`,
    weeks,
    canNext: (o.monthOffset || 0) < 0,
    canPrev: L.dkey(mo) > firstLog.slice(0, 8) + "01",
  };

  // plantFloor: giai đoạn cao nhất đã chúc mừng (stats() của state.js); thiếu thì coi như 1 — cây không nhỏ lại
  const plant = { ...L.plantState(stats.okDays, stats.plantFloor), okDays: stats.okDays };
  const week = L.weekSummary(S.days, c);
  const nextKg = Math.floor(stats.bankKg) + 1;
  const badges = L.badgeStates(stats, S.meta.earned);

  return {
    name: p.name, you,
    weight: {
      current: c.weight, start: p.startWeight, goal: p.goalWeight,
      lost: stats.lost, remaining: stats.remaining, pct: stats.pct, reached: stats.reached, gained: stats.lost < -0.05,
      etaWeeks: eta, mode: c.mode,
      lastKey: ws[ws.length - 1].k, entries: ws.length,
    },
    trail,
    gifts: L.giftList(p, S.settings.rewards, { bestLost: best, okDays: stats.okDays }, S.meta.seen),
    chart,
    plant,
    week,
    move: { week: L.exerciseWeek(S.days, c.todayKey), total: L.exerciseTotals(S.days) },
    streak: { current: stats.streak, best: stats.best },
    month,
    bank: { kcal: stats.bank, kg: stats.bankKg, nextKg, toNext: Math.max(0, nextKg * L.KCAL_PER_KG - stats.bank), pct: stats.bankKg - Math.floor(stats.bankKg) },
    badges,
    earnedCount: badges.filter((b) => b.on).length,
    target: c.target,
    partner: S.settings.partner,
    totals: { meals: stats.totalMeals, days: stats.loggedDays, okDays: stats.okDays },
  };
}
