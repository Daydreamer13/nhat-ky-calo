// logic.js — phần tính toán thuần của Nhật Ký Calo (không đụng DOM, không đụng bộ nhớ).
// Mọi hàm ở đây đều kiểm thử được bằng Node: `node --test` (chạy trong thư mục app).

export const KCAL_PER_KG = 7700; // năng lượng ước tính của 1 kg mỡ cơ thể

/* ------------------------------------------------------------------ *
 * Ngày tháng — mỗi ngày là một khoá 'YYYY-MM-DD' theo giờ máy người dùng
 * ------------------------------------------------------------------ */
export const pad2 = (n) => String(n).padStart(2, "0");

export function dkey(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
/** Giữa trưa giờ địa phương: cộng trừ ngày không bao giờ trượt vì đổi giờ. */
export function parseKey(k) {
  const [y, m, d] = String(k).split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}
export function isKey(k) {
  return typeof k === "string" && /^\d{4}-\d{2}-\d{2}$/.test(k) && dkey(parseKey(k)) === k;
}
export function addDays(k, n) {
  const d = parseKey(k);
  d.setDate(d.getDate() + n);
  return dkey(d);
}
/** Số ngày từ a đến b (b sau a thì dương). */
export function diffDays(a, b) {
  return Math.round((parseKey(b) - parseKey(a)) / 86400000);
}
/** Thứ trong tuần, thứ Hai = 0 … Chủ nhật = 6. */
export function weekdayMon0(k) {
  return (parseKey(k).getDay() + 6) % 7;
}
export function weekStart(k) {
  return addDays(k, -weekdayMon0(k));
}
export function weekKeys(k) {
  const s = weekStart(k);
  return Array.from({ length: 7 }, (_, i) => addDays(s, i));
}
/** Lưới tháng (tuần bắt đầu thứ Hai); ô ngoài tháng là null. month: 1–12. */
export function monthGrid(year, month) {
  const first = `${year}-${pad2(month)}-01`;
  const lead = weekdayMon0(first);
  const daysIn = new Date(year, month, 0).getDate();
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysIn; d++) cells.push(`${year}-${pad2(month)}-${pad2(d)}`);
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
export const WEEKDAY_SHORT = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
export const WEEKDAY_LONG = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ nhật"];
export function longDate(k) {
  const d = parseKey(k);
  return `${WEEKDAY_LONG[weekdayMon0(k)]}, ${d.getDate()} tháng ${d.getMonth() + 1}`;
}
export function shortDate(k) {
  const d = parseKey(k);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

/* ------------------------------------------------------------------ *
 * Định dạng số kiểu Việt Nam (1.450 · 57,8) — tự làm để mọi máy giống nhau
 * ------------------------------------------------------------------ */
export function fmtInt(n) {
  const v = Math.round(Number(n) || 0);
  const s = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (v < 0 ? "−" : "") + s;
}
export function fmt1(n) {
  const v = Math.round((Number(n) || 0) * 10) / 10;
  const neg = v < 0;
  const [i, f = "0"] = Math.abs(v).toFixed(1).split(".");
  return (neg ? "−" : "") + i.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "," + f;
}
/** "57,8" hoặc "57.8" → 57.8; không hợp lệ → null. */
export function parseNum(s) {
  if (typeof s === "number") return Number.isFinite(s) ? s : null;
  const t = String(s ?? "").trim().replace(/\s/g, "").replace(",", ".");
  if (!t || !/^-?\d+(\.\d+)?$/.test(t)) return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}
/**
 * Số kcal người dùng gõ: số nguyên không âm, có thể kèm dấu ngăn hàng nghìn kiểu Việt ("1.200") hay kiểu Anh ("1,200") —
 * đúng cách chính app hiển thị. Khác parseNum: ở đây dấu chấm/phẩy KHÔNG BAO GIỜ là dấu thập phân ("1.200" là một nghìn hai,
 * không phải 1,2). Mọi thứ khác ("1.5", "12,5", "1.20", chữ, số âm, để trống) → null. Không xét khoảng giá trị: nơi gọi tự xét.
 */
export function parseKcal(s) {
  if (typeof s === "number") return Number.isInteger(s) && s >= 0 ? s : null;
  const t = String(s ?? "").trim().replace(/\s/g, "");
  if (/^\d{1,6}$/.test(t)) return Number(t);
  if (/^\d{1,3}([.,]\d{3})+$/.test(t)) return Number(t.replace(/[.,]/g, ""));
  return null;
}
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

/* ------------------------------------------------------------------ *
 * Mức năng lượng — Mifflin-St Jeor
 * ------------------------------------------------------------------ */
export const ACTIVITY_LEVELS = [
  { v: 1.2, label: "Ít vận động", hint: "Ngồi nhiều, hầu như không tập" },
  { v: 1.375, label: "Vận động nhẹ", hint: "Đi bộ hoặc tập nhẹ 1–3 buổi mỗi tuần" },
  { v: 1.55, label: "Vận động vừa", hint: "Tập 3–5 buổi mỗi tuần" },
  { v: 1.725, label: "Vận động nhiều", hint: "Tập nặng 6–7 buổi mỗi tuần" },
];
export const PACES = [
  { v: 0.25, label: "Thong thả", hint: "khoảng 0,25 kg mỗi tuần" },
  { v: 0.5, label: "Vừa phải", hint: "khoảng 0,5 kg mỗi tuần" },
  { v: 0.75, label: "Nhanh hơn", hint: "khoảng 0,75 kg mỗi tuần" },
];
export function ageOn(birthYear, todayKey) {
  return parseKey(todayKey).getFullYear() - birthYear;
}
export function bmr(sex, weightKg, heightCm, age) {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "m" ? 5 : -161);
}
export function tdeeOf(profile, weightKg, todayKey) {
  return bmr(profile.sex, weightKg, profile.height, ageOn(profile.birthYear, todayKey)) * profile.activity;
}
/** Mức ăn tối thiểu mà app không bao giờ đề xuất thấp hơn. */
export function kcalFloor(sex) {
  return sex === "m" ? 1500 : 1200;
}
export function bmi(weightKg, heightCm) {
  const m = heightCm / 100;
  return weightKg / (m * m);
}
/**
 * Mức kcal mỗi ngày.
 * - Đã về đích (cân hiện tại ≤ cân mong muốn): ăn bằng mức cơ thể đốt để giữ cân.
 * - customTarget: người dùng tự đặt.
 * - Còn lại: TDEE trừ mức thâm hụt theo tốc độ giảm, không thấp hơn mức sàn.
 */
export function targetOf(profile, weightKg, todayKey) {
  const tdee = tdeeOf(profile, weightKg, todayKey);
  const floor = kcalFloor(profile.sex);
  if (profile.customTarget) {
    return { target: Math.round(profile.customTarget), tdee, mode: "custom", floored: false };
  }
  if (weightKg <= profile.goalWeight) {
    return { target: Math.max(floor, Math.round(tdee / 10) * 10), tdee, mode: "maintain", floored: false };
  }
  const raw = tdee - (profile.pace * KCAL_PER_KG) / 7;
  return { target: Math.max(floor, Math.round(raw / 10) * 10), tdee, mode: "lose", floored: raw < floor };
}
/** Số tuần ước tính để tới đích với mức ăn hiện tại; null nếu không có thâm hụt. */
export function etaWeeks(currentKg, goalKg, tdee, target) {
  const left = currentKg - goalKg;
  if (left <= 0) return 0;
  const deficit = tdee - target;
  if (deficit <= 20) return null;
  return Math.ceil(left / ((deficit * 7) / KCAL_PER_KG));
}

/**
 * Kiểm tra hồ sơ nhập vào. Trả về { ok, errors: {trường: thông báo}, value }.
 * Các số nhận cả "57,8" lẫn "57.8".
 * opts.keepGoal: cân mong muốn đang lưu. Khi ô cân mong muốn KHÔNG đổi so với số này thì bỏ qua riêng điều kiện
 *   "mong muốn ≤ hiện tại" (người đã xuống dưới đích vẫn sửa được tên, mức vận động…); khoảng 30–250 và BMI vẫn kiểm.
 *   Cân HIỆN TẠI dưới BMI 18,5: chỉ một lời nhắc "không đặt mục tiêu giảm cân", trừ khi cân mong muốn đang giữ vẫn hợp lệ.
 * raw.startWeight (không bắt buộc): cân lúc bắt đầu, sửa trong Cài đặt khi lúc đầu nhập nhầm. Bỏ trống thì bỏ qua,
 *   và value không có trường startWeight.
 */
export function validateProfile(raw, todayKey, opts = {}) {
  const errors = {};
  const year = parseKey(todayKey).getFullYear();
  const name = String(raw.name ?? "").trim().slice(0, 30);
  const sex = raw.sex === "m" ? "m" : "f";
  const birthYear = parseNum(raw.birthYear);
  const height = parseNum(raw.height);
  const weight = parseNum(raw.weight);
  const goalWeight = parseNum(raw.goalWeight);
  const activity = Number(raw.activity);
  const pace = Number(raw.pace);
  const customRaw = String(raw.customTarget ?? "").trim();
  // kcal là số nguyên: "1.500" là một nghìn rưỡi (dấu ngăn hàng nghìn, đúng cách app hiển thị), còn "1.5" là gõ nhầm
  const customTarget = customRaw ? parseKcal(customRaw) : null;
  const hasStart = String(raw.startWeight ?? "").trim() !== "";
  const startWeight = hasStart ? parseNum(raw.startWeight) : null;
  const keepGoal = opts && opts.keepGoal != null ? parseNum(opts.keepGoal) : null;

  if (birthYear === null || !Number.isInteger(birthYear) || year - birthYear < 0 || year - birthYear > 90)
    errors.birthYear = "Nhập năm sinh, ví dụ 1995.";
  else if (year - birthYear < 18)
    errors.birthYear = "App này dành cho người từ 18 tuổi. Dưới 18 tuổi nên hỏi bác sĩ trước khi ăn kiêng.";
  if (height === null || height < 120 || height > 220) errors.height = "Chiều cao từ 120 đến 220 cm.";
  if (weight === null || weight < 30 || weight > 250) errors.weight = "Cân nặng từ 30 đến 250 kg.";
  if (goalWeight === null || goalWeight < 30 || goalWeight > 250) errors.goalWeight = "Cân mong muốn từ 30 đến 250 kg.";
  if (!ACTIVITY_LEVELS.some((a) => a.v === activity)) errors.activity = "Chọn mức vận động.";
  if (!PACES.some((p) => p.v === pace)) errors.pace = "Chọn tốc độ giảm.";
  if (customRaw && (customTarget === null || customTarget < 1000 || customTarget > 5000))
    errors.customTarget = "Mức tự đặt từ 1.000 đến 5.000 kcal, hoặc để trống.";
  if (hasStart && (startWeight === null || startWeight < 30 || startWeight > 250)) errors.startWeight = "Cân lúc bắt đầu từ 30 đến 250 kg.";
  const goalKept = keepGoal !== null && goalWeight !== null && round1(goalWeight) === round1(keepGoal);
  // Cân HIỆN TẠI đã dưới BMI 18,5: không có cân mong muốn nào qua được cả hai điều kiện bên dưới (phải ≤ cân hiện tại
  // mà lại ≥ mức BMI 18,5), nên chỉ nói một câu đúng lý do thay vì hai lời nhắc chỉ ngược nhau. Dùng đúng phép so của
  // điều kiện BMI bên dưới (không so với số đã làm tròn lên 0,1 kg) để không từ chối thêm trường hợp nào đang hợp lệ.
  const under = !errors.height && !errors.weight && bmi(weight, height) < 18.5;
  // Cả khi ô cân mong muốn không đổi (goalKept): nếu chính số đang giữ cũng dưới ngưỡng BMI (vừa sửa chiều cao chẳng hạn) thì
  // lời nhắc "hãy chọn từ … kg trở lên" chỉ tới một con số cao hơn cân hiện tại, không làm theo được — nói luôn câu đúng lý do.
  if (under && (!goalKept || bmi(goalWeight, height) < 18.5)) {
    errors.goalWeight = "Cân hiện tại đã ở mức thấp so với chiều cao, nên app không đặt mục tiêu giảm cân. Hãy hỏi bác sĩ hoặc chuyên gia dinh dưỡng.";
  } else {
    if (!errors.weight && !errors.goalWeight && goalWeight > weight && !goalKept)
      errors.goalWeight = "Cân mong muốn cần bằng hoặc thấp hơn cân hiện tại.";
    if (!errors.height && !errors.goalWeight && bmi(goalWeight, height) < 18.5) {
      const min = Math.ceil(18.5 * (height / 100) ** 2 * 10) / 10;
      errors.goalWeight = `Mức này hơi thấp so với chiều cao. Hãy chọn từ ${fmt1(min)} kg trở lên.`;
    }
  }
  const ok = Object.keys(errors).length === 0;
  const value = ok
    ? { name, sex, birthYear, height, activity, pace, goalWeight: round1(goalWeight), customTarget: customTarget ? Math.round(customTarget) : null, weight: round1(weight) }
    : null;
  // chỉ thêm trường khi có nhập: nơi gọi trộn value vào hồ sơ đang lưu, một trường undefined sẽ xoá mất cân bắt đầu
  if (ok && hasStart) value.startWeight = round1(startWeight);
  return { ok, errors, value };
}
export const round1 = (x) => Math.round(x * 10) / 10;

/* ------------------------------------------------------------------ *
 * Bữa ăn và ngày
 *   meal: { id, t:'HH:MM' (hoặc '' với bữa ghi bù vào ngày đã qua), type:'sang'|'trua'|'toi'|'vat', name, items:[{n,q,k,p,c,f,x}], ph?, src }
 *   day:  { meals:[], weight?, water?, tg? (mục tiêu lúc ghi), td? (TDEE lúc ghi) }
 * ------------------------------------------------------------------ */
export const MEAL_TYPES = [
  { id: "sang", label: "Bữa sáng", short: "Sáng" },
  { id: "trua", label: "Bữa trưa", short: "Trưa" },
  { id: "toi", label: "Bữa tối", short: "Tối" },
  { id: "vat", label: "Ăn vặt", short: "Ăn vặt" },
];
export const PORTION_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];
export function portionLabel(x) {
  const map = { 0.25: "¼", 0.5: "½", 0.75: "¾", 1: "1", 1.25: "1¼", 1.5: "1½", 2: "2", 2.5: "2½", 3: "3" };
  return map[x] ?? String(x).replace(".", ",");
}
export function stepPortion(x, dir) {
  const cur = PORTION_STEPS.reduce((best, s, i) => (Math.abs(s - x) < Math.abs(PORTION_STEPS[best] - x) ? i : best), 0);
  return PORTION_STEPS[clamp(cur + (dir > 0 ? 1 : -1), 0, PORTION_STEPS.length - 1)];
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
export function itemTotals(it) {
  const x = it.x == null ? 1 : num(it.x);
  return { kcal: Math.round(num(it.k) * x), p: num(it.p) * x, c: num(it.c) * x, f: num(it.f) * x };
}
export function mealTotals(meal) {
  const t = { kcal: 0, p: 0, c: 0, f: 0 };
  for (const it of meal?.items || []) {
    const a = itemTotals(it);
    t.kcal += a.kcal; t.p += a.p; t.c += a.c; t.f += a.f;
  }
  return { kcal: t.kcal, p: Math.round(t.p), c: Math.round(t.c), f: Math.round(t.f) };
}
export function dayTotals(day) {
  const t = { kcal: 0, p: 0, c: 0, f: 0, count: 0 };
  for (const m of day?.meals || []) {
    const a = mealTotals(m);
    t.kcal += a.kcal; t.p += a.p; t.c += a.c; t.f += a.f; t.count++;
  }
  return t;
}
export const hasLog = (day) => !!(day && day.meals && day.meals.length);

/** Khoảng dung sai: ảnh chụp chỉ ước tính được, nên vượt dưới 5% vẫn tính là đạt. */
export const OVER_TOLERANCE = 1.05;
/**
 * Ăn dưới 80% mục tiêu là "ít hẳn so với mức": lời động viên chuyển sang nhắc ăn đủ (words.js), và một ngày
 * như thế cũng không được cộng vào "chum" nhiều hơn một ngày ăn đúng 80% mục tiêu (journeyStats).
 */
export const LOW_SHARE = 0.8;
/**
 * Trạng thái của một ngày ĐÃ QUA so với mục tiêu:
 *  'none' chưa ghi gì · 'partial' ghi quá ít để kết luận · 'ok' đạt · 'over' vượt
 */
export function dayStatus(day, target) {
  const { kcal, count } = dayTotals(day);
  if (!count) return "none";
  if (kcal > target * OVER_TOLERANCE) return "over";
  if (kcal < Math.max(600, target * 0.5)) return "partial";
  return "ok";
}
export const targetForDay = (day, fallback) => (day && day.tg ? day.tg : fallback);
export const tdeeForDay = (day, fallback) => (day && day.td ? day.td : fallback);

/** Loại bữa đoán theo giờ; kind: 'meal' | 'snack' | 'drink' | undefined. */
export function mealTypeAt(hhmm, kind) {
  if (kind === "snack" || kind === "drink") return "vat";
  const [h, m] = String(hhmm).split(":").map(Number);
  const t = (h || 0) + (m || 0) / 60;
  if (t >= 4 && t < 10.5) return "sang";
  if (kind === "meal") return t >= 10.5 && t < 15.5 ? "trua" : "toi";
  if (t >= 10.5 && t < 14.5) return "trua";
  if (t >= 17 && t < 21.5) return "toi";
  return "vat";
}
export function nowHHMM(d = new Date()) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Làm sạch danh sách món (từ AI, từ file sao lưu) về đúng khuôn. */
export function cleanItems(raw, max = 10) {
  const out = [];
  for (const r of Array.isArray(raw) ? raw : []) {
    if (!r || typeof r !== "object") continue;
    const n = String(r.n ?? r.name ?? "").trim().slice(0, 80);
    const k = clamp(Math.round(num(r.k ?? r.kcal)), 0, 5000);
    if (!n) continue;
    const g = (v) => clamp(Math.round(num(v) * 10) / 10, 0, 500);
    const x = PORTION_STEPS.includes(Number(r.x)) ? Number(r.x) : 1;
    out.push({ n, q: String(r.q ?? r.portion ?? "").trim().slice(0, 80), k, p: g(r.p ?? r.protein), c: g(r.c ?? r.carb), f: g(r.f ?? r.fat), x });
    if (out.length >= max) break;
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Chuỗi ngày, ngày đạt, "ngân hàng" thâm hụt
 * ------------------------------------------------------------------ */
export function currentStreak(days, todayKey) {
  let k = hasLog(days[todayKey]) ? todayKey : addDays(todayKey, -1);
  let n = 0;
  while (hasLog(days[k])) { n++; k = addDays(k, -1); }
  return n;
}
export function bestStreak(days) {
  let best = 0, run = 0, prev = null;
  for (const k of Object.keys(days).filter((k) => isKey(k) && hasLog(days[k])).sort()) {
    run = prev && addDays(prev, 1) === k ? run + 1 : 1;
    if (run > best) best = run;
    prev = k;
  }
  return best;
}

/**
 * Tổng hợp hành trình. Hôm nay chưa kết thúc nên KHÔNG tính vào ngày đạt hay thâm hụt.
 * ctx: { todayKey, target, tdee, waterGoal }
 */
export function journeyStats(days, ctx) {
  const s = { totalMeals: 0, photoMeals: 0, loggedDays: 0, okDays: 0, overDays: 0, partialDays: 0, waterDays: 0, bank: 0 };
  for (const k of Object.keys(days)) {
    if (!isKey(k)) continue;
    const day = days[k];
    const meals = day?.meals || [];
    // Huy hiệu "Bữa đầu tiên" / "30 tấm ảnh" chỉ đếm bữa đã có món (bữa đang chờ hoặc tính lỗi chưa phải một bữa đã ghi xong),
    // và ảnh phải là ảnh chính mình chụp cho bữa đó: món hay ăn ghi lại kèm ảnh cũ (src 'fav') không tính.
    const real = meals.filter((m) => m && m.items && m.items.length);
    s.totalMeals += real.length;
    s.photoMeals += real.filter((m) => m.src === "photo").length;
    if (meals.length) s.loggedDays++; // chuỗi ngày và "ngày có ghi" vẫn tính mọi bữa, kể cả bữa đang chờ (xem hasLog)
    if (ctx.waterGoal && num(day?.water) >= ctx.waterGoal) s.waterDays++;
    if (k >= ctx.todayKey) continue; // hôm nay và tương lai: chưa chốt
    const tg = targetForDay(day, ctx.target);
    const st = dayStatus(day, tg);
    if (st === "ok") s.okDays++;
    else if (st === "over") s.overDays++;
    else if (st === "partial") s.partialDays++;
    if (st === "ok" || st === "over") {
      // ăn ít hẳn so với mục tiêu không làm chum đầy nhanh hơn: phần cộng của một ngày dừng ở mức "ăn 80% mục tiêu"
      // (max 0: mục tiêu tự đặt cao hơn hẳn mức đốt thì trần này âm; khi đó ngày ăn ít chỉ là không được cộng, không bị trừ)
      const td = tdeeForDay(day, ctx.tdee);
      s.bank += Math.min(td - dayTotals(day).kcal, Math.max(0, td - LOW_SHARE * tg));
    }
  }
  s.bank = Math.max(0, Math.round(s.bank));
  s.bankKg = s.bank / KCAL_PER_KG;
  s.streak = currentStreak(days, ctx.todayKey);
  s.best = Math.max(bestStreak(days), s.streak);
  return s;
}

/** Bảy ngày của tuần chứa todayKey, kèm số liệu để vẽ biểu đồ. */
export function weekSummary(days, ctx) {
  const list = weekKeys(ctx.todayKey).map((k, i) => {
    const day = days[k];
    const target = k === ctx.todayKey ? ctx.target : targetForDay(day, ctx.target);
    const kcal = dayTotals(day).kcal;
    const isToday = k === ctx.todayKey, isFuture = k > ctx.todayKey;
    const status = isFuture ? "future" : isToday ? (hasLog(day) ? (kcal > target * OVER_TOLERANCE ? "over" : "today") : "today") : dayStatus(day, target);
    return { k, label: WEEKDAY_SHORT[i], kcal, target, status, isToday, isFuture, logged: hasLog(day) };
  });
  const past = list.filter((d) => !d.isFuture && !d.isToday);
  const closed = past.filter((d) => d.status === "ok" || d.status === "over");
  const logged = list.filter((d) => !d.isFuture && d.kcal > 0);
  return {
    list,
    okCount: past.filter((d) => d.status === "ok").length,
    closedCount: closed.length,
    avg: logged.length ? Math.round(logged.reduce((a, d) => a + d.kcal, 0) / logged.length) : 0,
  };
}

/* ------------------------------------------------------------------ *
 * Cân nặng và chặng đường
 * ------------------------------------------------------------------ */
export function weightSeries(days, profile) {
  const pts = Object.keys(days)
    .filter((k) => isKey(k) && days[k] && days[k].weight != null && Number.isFinite(Number(days[k].weight)))
    .sort()
    .map((k) => ({ k, w: Number(days[k].weight) }));
  if (profile && profile.startDate && profile.startWeight != null && !pts.some((p) => p.k <= profile.startDate)) {
    pts.unshift({ k: profile.startDate, w: profile.startWeight });
  }
  return pts;
}
export function currentWeight(days, profile) {
  const s = weightSeries(days, profile);
  return s.length ? s[s.length - 1].w : profile?.startWeight ?? null;
}
/** Số cân thấp nhất từng ghi (kể cả cân lúc bắt đầu). */
export function lowestWeight(days, profile) {
  const s = weightSeries(days, profile);
  let low = profile?.startWeight ?? null;
  for (const p of s) if (low === null || p.w < low) low = p.w;
  return low;
}
/**
 * Tiến độ cân nặng.
 *  - lost / pct / reached: theo lần cân GẦN NHẤT (vị trí "đang ở đây", số kg đã giảm).
 *  - bestLost / bestPct / everReached: theo lần cân THẤP NHẤT từng ghi. Những gì "đã đạt thì giữ" (mở quà ở mốc,
 *    huy hiệu cân nặng) dựa vào đây: cân nhích lên lại thì không bị lấy lại, còn lỡ gõ nhầm rồi sửa thì tự đúng lại.
 */
export function weightProgress(profile, current, lowest = current) {
  const total = round1(profile.startWeight - profile.goalWeight);
  const lost = round1(profile.startWeight - current);
  const remaining = round1(Math.max(0, current - profile.goalWeight));
  const pct = total > 0 ? clamp(lost / total, 0, 1) : current <= profile.goalWeight ? 1 : 0;
  const low = Math.min(Number.isFinite(lowest) ? lowest : current, current);
  const bestLost = Math.max(0, round1(profile.startWeight - low));
  const bestPct = total > 0 ? clamp(bestLost / total, 0, 1) : low <= profile.goalWeight ? 1 : 0;
  return { total, lost, remaining, pct, reached: current <= profile.goalWeight, bestLost, bestPct, everReached: low <= profile.goalWeight };
}
/**
 * Các mốc trên chặng đường: mỗi "bước" kg (tự giãn để không quá 6 mốc), các mốc có quà, và đích.
 * rewards: [{ kg, text }]
 */
export function milestones(profile, rewards = []) {
  const total = round1(profile.startWeight - profile.goalWeight);
  if (!(total > 0)) return [];
  const step = [1, 2, 5, 10, 20].find((s) => total / s <= 6) || 20;
  const map = new Map();
  for (let kg = step; kg < total - 1e-9; kg += step) map.set(round1(kg), { kg: round1(kg), reward: null, isGoal: false });
  for (const r of rewards || []) {
    const kg = round1(num(r.kg));
    const text = String(r.text ?? "").trim();
    if (!text || !(kg > 0)) continue;
    const at = Math.min(kg, total);
    const cur = map.get(at) || { kg: at, reward: null, isGoal: false };
    cur.reward = cur.reward ? `${cur.reward} · ${text}` : text;
    map.set(at, cur);
  }
  const goal = map.get(total) || { kg: total, reward: null, isGoal: true };
  goal.isGoal = true;
  map.set(total, goal);
  return [...map.values()].sort((a, b) => a.kg - b.kg);
}

/* ------------------------------------------------------------------ *
 * Cây hoa — lớn theo số ngày đạt mục tiêu, không bao giờ héo
 * ------------------------------------------------------------------ */
export const PLANT_STAGES = [
  { min: 0, name: "Hạt giống", line: "Một hạt giống đang chờ ngày đạt mục tiêu đầu tiên." },
  { min: 1, name: "Nảy mầm", line: "Mầm xanh đã nhú lên rồi." },
  { min: 5, name: "Ra lá", line: "Cây đang vươn lá." },
  { min: 12, name: "Ra nụ", line: "Cây đã có nụ." },
  { min: 30, name: "Nở hoa", line: "Hoa đã nở." },
  { min: 60, name: "Rực rỡ", line: "Cả chậu hoa rực rỡ." },
];
/**
 * floorStage: giai đoạn cao nhất cây đã từng tới (đã chúc mừng). Số ngày đạt có thể tụt lại khi một ngày cũ được
 * sửa (thêm bữa quên ghi), nhưng cây thì không nhỏ lại: giai đoạn, tên, câu mô tả, "còn mấy ngày" và thanh tiến độ
 * đều tính theo giai đoạn đã giữ.
 */
export function plantState(okDays, floorStage = 1) {
  const n = Math.max(0, Math.floor(okDays || 0));
  let idx = 0;
  PLANT_STAGES.forEach((s, i) => { if (n >= s.min) idx = i; });
  idx = clamp(Math.max(idx, Math.floor(Number(floorStage) || 1) - 1), 0, PLANT_STAGES.length - 1);
  const next = PLANT_STAGES[idx + 1] || null;
  return {
    stage: idx + 1,
    stages: PLANT_STAGES.length,
    name: PLANT_STAGES[idx].name,
    line: PLANT_STAGES[idx].line,
    next: next ? { name: next.name, inDays: Math.max(1, next.min - n) } : null,
    // phần trăm tiến tới giai đoạn kế (để vẽ thanh nhỏ)
    pct: next ? clamp((n - PLANT_STAGES[idx].min) / (next.min - PLANT_STAGES[idx].min), 0, 1) : 1,
  };
}

/* ------------------------------------------------------------------ *
 * Huy hiệu
 * ------------------------------------------------------------------ */
export const BADGES = [
  { id: "first", title: "Bữa đầu tiên", desc: "Ghi bữa ăn đầu tiên", cur: (s) => s.totalMeals, max: 1 },
  { id: "streak3", title: "3 ngày liền", desc: "Ghi nhật ký 3 ngày liên tiếp", cur: (s) => s.best, max: 3 },
  { id: "streak7", title: "7 ngày liền", desc: "Ghi nhật ký trọn một tuần", cur: (s) => s.best, max: 7 },
  { id: "streak30", title: "30 ngày liền", desc: "Ghi nhật ký 30 ngày liên tiếp", cur: (s) => s.best, max: 30 },
  { id: "ok5", title: "5 ngày đạt", desc: "5 ngày ăn trong mục tiêu", cur: (s) => s.okDays, max: 5 },
  { id: "ok10", title: "10 ngày đạt", desc: "10 ngày ăn trong mục tiêu", cur: (s) => s.okDays, max: 10 },
  { id: "ok30", title: "Hoa nở", desc: "30 ngày ăn trong mục tiêu", cur: (s) => s.okDays, max: 30 },
  { id: "photo30", title: "30 tấm ảnh", desc: "Chụp 30 bữa ăn", cur: (s) => s.photoMeals, max: 30 },
  { id: "water7", title: "Đủ nước", desc: "7 ngày uống đủ nước", cur: (s) => s.waterDays, max: 7 },
  // Huy hiệu cân nặng tính theo lần cân thấp nhất từng ghi (bestLost…), nên cân nhích lên lại vẫn giữ.
  { id: "lost1", title: "Giảm 1 kg", desc: "Nhẹ hơn 1 kg so với lúc bắt đầu", cur: (s) => s.bestLost ?? s.lost, max: 1 },
  { id: "lost2", title: "Giảm 2 kg", desc: "Nhẹ hơn 2 kg so với lúc bắt đầu", cur: (s) => s.bestLost ?? s.lost, max: 2 },
  { id: "half", title: "Nửa chặng đường", desc: "Đi được một nửa quãng đường tới đích", cur: (s) => s.bestPct ?? s.pct, max: 0.5 },
  { id: "goal", title: "Về đích", desc: "Chạm cân nặng mong muốn", cur: (s) => ((s.everReached ?? s.reached) ? 1 : 0), max: 1 },
];
/** Các huy hiệu phụ thuộc số cân: nếu một lần cân gõ nhầm được sửa lại thì phải xét lại (xem state.checkMoments). */
export const WEIGHT_BADGES = ["lost1", "lost2", "half", "goal"];
/** Một huy hiệu có đang thật sự đủ điều kiện theo số liệu hiện có không (không tính "đã nhận từ trước"). */
export function badgeHolds(id, stats) {
  const b = BADGES.find((x) => x.id === id);
  return !!b && (Number(b.cur(stats)) || 0) >= b.max - 1e-9;
}
/**
 * stats = journeyStats(...) trộn với weightProgress(...).
 * earned: { id: 'YYYY-MM-DD' } — huy hiệu đã nhận thì giữ mãi, kể cả khi cân nhích lên lại.
 */
export function badgeStates(stats, earned = {}) {
  return BADGES.filter((b) => b.id !== "water7" || stats.waterOn !== false)
    .filter((b) => !(b.id === "lost2" && stats.total < 2) && !(b.id === "lost1" && stats.total < 1) && !((b.id === "half" || b.id === "goal") && !(stats.total > 0)))
    .map((b) => {
      const cur = Math.max(0, Number(b.cur(stats)) || 0);
      const on = !!earned[b.id] || cur >= b.max - 1e-9;
      return { id: b.id, title: b.title, desc: b.desc, on, cur: Math.min(cur, b.max), max: b.max, at: earned[b.id] || null };
    });
}

/* ------------------------------------------------------------------ *
 * Món hay ăn — ghim tay + tự rút ra từ lịch sử
 * ------------------------------------------------------------------ */
export const normName = (s) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
/* ------------------------------------------------------------------ *
 * Thói quen ăn uống và bản tóm tắt gửi Claude
 * ------------------------------------------------------------------ */
/** Dấu vết của các bữa trong ngày: đổi khi thêm, bớt hay sửa bữa — để biết lời nhận xét đã cũ. */
export const reviewSig = (day) => { const t = dayTotals(day); return t.count + ":" + t.kcal; };

/**
 * Thói quen rút từ nhật ký mấy tuần gần đây (không tính ngày đang xét): ăn bao nhiêu, bữa nào nặng, món nào hay lặp lại.
 * Nhật ký vốn đã lưu mọi bữa; hàm này chỉ đọc lại để lời nhận xét và gợi ý sát với người dùng hơn.
 */
export function eatingHabits(days, uptoKey, target, windowDays = 28) {
  const from = addDays(uptoKey, -windowDays);
  const keys = Object.keys(days || {}).filter((k) => isKey(k) && k >= from && k < uptoKey && hasLog(days[k])).sort();
  const byType = {};
  for (const t of MEAL_TYPES) byType[t.id] = { kcal: 0, days: 0 };
  const dishes = new Map();
  let kcal = 0, p = 0, c = 0, f = 0, over = 0, low = 0, counted = 0;
  for (const k of keys) {
    const day = days[k];
    const done = (day.meals || []).filter((m) => m.items && m.items.length);
    if (!done.length) continue;
    counted++;
    const t = dayTotals({ meals: done });
    const tg = targetForDay(day, target);
    kcal += t.kcal; p += t.p; c += t.c; f += t.f;
    if (tg && t.kcal > tg * OVER_TOLERANCE) over++;
    if (tg && t.kcal < tg * LOW_SHARE) low++;
    const seenType = new Set();
    for (const m of done) {
      const mk = mealTotals(m).kcal;
      if (byType[m.type]) { byType[m.type].kcal += mk; seenType.add(m.type); }
      const id = normName(m.name);
      if (!id) continue;
      const d = dishes.get(id) || { name: m.name, count: 0, kcal: 0, type: m.type };
      d.count++; d.kcal += mk; d.name = m.name; d.type = m.type;
      dishes.set(id, d);
    }
    for (const id of seenType) byType[id].days++;
  }
  if (!counted) return null;
  const energy = p * 4 + c * 4 + f * 9;
  const pct = (x) => (energy ? Math.round((x / energy) * 100) : 0);
  return {
    days: counted,
    avgKcal: Math.round(kcal / counted),
    over, low,
    share: { p: pct(p * 4), c: pct(c * 4), f: pct(f * 9) },
    byType: Object.fromEntries(MEAL_TYPES.map((t) => [t.id, { avg: byType[t.id].days ? Math.round(byType[t.id].kcal / byType[t.id].days) : 0, days: byType[t.id].days }])),
    top: [...dishes.values()].filter((d) => d.count >= 2).sort((a, b) => b.count - a.count).slice(0, 8).map((d) => ({ name: d.name.slice(0, 60), count: d.count, kcal: Math.round(d.kcal / d.count), type: d.type })),
  };
}

const TYPE_LABEL = Object.fromEntries(MEAL_TYPES.map((t) => [t.id, t.label]));
/** Một dòng bối cảnh gửi kèm ảnh, để lời nhận xét từng bữa biết hôm nay đã ăn tới đâu. */
export function mealContext({ target, eatenBefore, type, hasTime = true }) {
  const parts = [`mục tiêu cả ngày khoảng ${Math.round(target)} kcal`, eatenBefore > 0 ? `trước bữa này đã ghi ${Math.round(eatenBefore)} kcal` : "đây là bữa đầu tiên được ghi trong ngày"];
  if (hasTime && TYPE_LABEL[type]) parts.push(`đây là ${TYPE_LABEL[type].toLowerCase()}`);
  return parts.join("; ") + ".";
}

/**
 * Bản tóm tắt bằng chữ của một ngày, để nhờ Claude nhận xét. Không có tên người dùng, không có ảnh.
 * @param {{days:object, key:string, todayKey:string, target:number, you:string, hour?:number, waterGoal?:number}} o
 */
export function daySummary({ days, key, todayKey, target, you = "bạn", hour = null, waterGoal = 0 }) {
  const day = days[key] || { meals: [] };
  const done = (day.meals || []).filter((m) => m.items && m.items.length);
  const t = dayTotals({ meals: done });
  const lines = [];
  lines.push(`Xưng hô: ${you}`);
  lines.push(key === todayKey
    ? `Ngày: ${longDate(key)} (hôm nay${hour != null ? `, bây giờ khoảng ${hour} giờ` : ""}; ngày có thể chưa kết thúc, các bữa chưa ghi là chưa ăn hoặc chưa ghi)`
    : `Ngày: ${longDate(key)} (đã qua)`);
  lines.push(`Mục tiêu trong ngày: ${Math.round(target)} kcal. Đã ghi: ${t.kcal} kcal (${Math.round((t.kcal / Math.max(1, target)) * 100)}% mục tiêu); đạm ${Math.round(t.p)} g, bột ${Math.round(t.c)} g, béo ${Math.round(t.f)} g.`);
  if (waterGoal) lines.push(`Nước: ${day.water || 0}/${waterGoal} ly.`);
  lines.push("Các bữa đã ghi:");
  for (const type of MEAL_TYPES) {
    for (const m of done.filter((x) => x.type === type.id)) {
      const items = m.items.slice(0, 8).map((it) => { const a = itemTotals(it); return `${String(it.n).slice(0, 50)}${it.q ? " (" + String(it.q).slice(0, 30) + ")" : ""} ${a.kcal} kcal`; }).join("; ");
      lines.push(`- ${type.label}${m.t ? " " + m.t : ""}: ${String(m.name).slice(0, 80)} — ${mealTotals(m).kcal} kcal [${items}]`);
    }
  }
  const missing = MEAL_TYPES.filter((x) => x.id !== "vat" && !done.some((m) => m.type === x.id)).map((x) => x.label.toLowerCase());
  if (missing.length) lines.push(`Chưa ghi: ${missing.join(", ")}.`);
  const h = eatingHabits(days, key, target);
  if (h && h.days >= 3) {
    lines.push("");
    lines.push(`Thói quen ${h.days} ngày có ghi gần đây: trung bình ${h.avgKcal} kcal mỗi ngày; ${h.over} ngày vượt mục tiêu, ${h.low} ngày ăn dưới 80% mục tiêu; năng lượng từ đạm ${h.share.p}%, bột ${h.share.c}%, béo ${h.share.f}%.`);
    lines.push("Trung bình theo bữa: " + MEAL_TYPES.map((x) => `${x.label.toLowerCase()} ${h.byType[x.id].avg} kcal (${h.byType[x.id].days}/${h.days} ngày có ghi)`).join("; ") + ".");
    if (h.top.length) lines.push("Món hay lặp lại: " + h.top.map((d) => `${d.name} (${d.count} lần, khoảng ${d.kcal} kcal, ${(TYPE_LABEL[d.type] || "").toLowerCase()})`).join("; ") + ".");
  } else {
    lines.push("");
    lines.push("Chưa đủ dữ liệu các ngày trước để nói về thói quen.");
  }
  return lines.join("\n");
}

/* ------------------------------------------------------------------ *
 * Gợi ý bữa ăn theo số kcal còn lại
 * ------------------------------------------------------------------ */
const SLOT_SHARE = { sang: 0.3, trua: 0.4, toi: 0.3 }; // phần năng lượng trong ngày của ba bữa chính
const hash01 = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 100000) / 100000; };
/**
 * Chọn vài món vừa với số kcal còn lại. Hàm thuần: cùng đầu vào thì cùng kết quả (seed đổi theo ngày, offset đổi khi bấm "Đổi món").
 * @param {object} o
 * @param {{n:string,q:string,k:number,p:number,c:number,f:number,slots:string[]}[]} o.dishes  danh sách món (js/dishes.js)
 * @param {string|null} o.slot        bữa chính sắp tới ('sang' | 'trua' | 'toi'), null nếu không còn bữa chính nào
 * @param {string[]} [o.openSlots]    các bữa chính còn chưa ăn tính từ bây giờ (gồm cả slot) — để chia phần kcal còn lại
 * @param {number} o.left             kcal còn lại hôm nay
 * @param {{name:string,kcal:number,items:object[]}[]} [o.own]  món hay ăn của chính người dùng (ưu tiên một món vừa tầm)
 * @param {string[]} [o.eaten]        tên các món đã ăn hôm nay (không gợi ý lại)
 * @param {boolean} [o.lowProtein]    hôm nay đang thiếu đạm so với bột: nghiêng về món nhiều đạm
 * @returns {null | {slot:string, budget:number, more:boolean, items:{name:string,q:string,kcal:number,own:boolean,items:object[]}[]}}
 */
export function suggestMeals({ dishes, slot, openSlots = [], left, own = [], eaten = [], lowProtein = false, seed = "", offset = 0, limit = 3 }) {
  left = Math.round(num(left));
  if (!(left >= 40) || !Array.isArray(dishes)) return null; // gần chạm mục tiêu rồi: không mời ăn thêm
  const skip = new Set(eaten.map(normName));
  const pick = (kind, lo, hi) => {
    const ok = (d) => !skip.has(normName(d.n)) && d.k <= hi;
    const pool = dishes.filter((d) => d.slots.includes(kind) && ok(d));
    const fit = pool.filter((d) => d.k >= lo);
    // Ít món vừa tầm (phần kcal của bữa nhỏ) thì nới xuống: lấy những món nặng nhất mà vẫn nằm trong mức cho phép, thiếu nữa
    // thì thêm món nhẹ — để luôn có đủ món cho một lượt gợi ý và còn món khác khi bấm "Đổi món".
    if (!pool.length) return []; // không món nào của bữa này vừa: để nơi gọi chuyển sang gợi ý món nhẹ
    let list = fit;
    if (fit.length < 5) {
      list = pool.sort((a, b) => b.k - a.k).slice(0, 6);
      if (list.length < 5 && kind !== "vat") list = [...list, ...dishes.filter((d) => d.slots.includes("vat") && !d.slots.includes(kind) && ok(d)).sort((a, b) => b.k - a.k).slice(0, 6 - list.length)];
    }
    const rank = (d) => hash01(seed + "|" + d.n) - (lowProtein ? 0.6 * ((d.p * 4) / Math.max(1, d.k)) : 0);
    return list.map((d) => ({ d, r: rank(d) })).sort((a, b) => a.r - b.r).map((x) => x.d);
  };
  let kind = SLOT_SHARE[slot] ? slot : "vat";
  let budget, lo, list = [];
  if (kind !== "vat") {
    const open = openSlots.filter((s) => SLOT_SHARE[s]);
    const sum = open.reduce((a, s) => a + SLOT_SHARE[s], 0) || SLOT_SHARE[kind];
    // Phần của bữa này trong số kcal còn lại, nhưng không quá 700: còn dư nhiều cũng không gợi ý dồn hết vào một bữa.
    budget = Math.min(700, Math.round((left * SLOT_SHARE[kind]) / Math.max(sum, SLOT_SHARE[kind])));
    lo = budget * 0.55;
    list = pick(kind, lo, budget * 1.08);
    if (!list.length) kind = "vat"; // còn quá ít cho một bữa chính: gợi ý món nhẹ
  }
  if (kind === "vat") {
    budget = Math.min(left, 300);
    lo = 0;
    list = pick("vat", 0, budget * 1.05);
  }
  if (!list.length) return null;
  const mine = own
    .filter((f) => f && f.items && f.items.length && !skip.has(normName(f.name)) && f.kcal >= Math.max(lo, 30) && f.kcal <= budget * 1.08)
    .sort((a, b) => Math.abs(a.kcal - budget * 0.85) - Math.abs(b.kcal - budget * 0.85))
    .slice(0, 2)
    .map((f) => ({ name: f.name, q: "", kcal: f.kcal, own: true, items: f.items.map((it) => ({ ...it })) }));
  const taken = new Set(mine.map((x) => normName(x.name)));
  const all = [...mine, ...list.filter((d) => !taken.has(normName(d.n))).map((d) => ({ name: d.n, q: d.q, kcal: d.k, own: false, items: [{ n: d.n, q: d.q, k: d.k, p: d.p, c: d.c, f: d.f }] }))];
  const n = Math.min(limit, all.length);
  const start = all.length > n ? (Math.max(0, offset) * n) % all.length : 0;
  const items = [];
  for (let i = 0; i < n; i++) items.push(all[(start + i) % all.length]);
  return { slot: kind, budget, more: all.length > n, items };
}

export function frequentMeals(days, todayKey, pinned = [], limit = 8, windowDays = 45) {
  const from = addDays(todayKey, -windowDays);
  const groups = new Map();
  for (const k of Object.keys(days).filter((k) => isKey(k) && k >= from && k <= todayKey).sort()) {
    for (const m of days[k]?.meals || []) {
      const key = normName(m.name);
      if (!key || !m.items || !m.items.length) continue; // bữa đang chờ phân tích chưa có món
      const g = groups.get(key) || { count: 0, last: null, lastKey: "" };
      g.count++;
      g.last = m; g.lastKey = k + (m.t || "~"); // bữa không có giờ (ghi bù vào ngày đã qua) xếp sau các bữa có giờ của ngày đó
      groups.set(key, g);
    }
  }
  const out = [];
  const seen = new Set();
  for (const p of pinned || []) {
    const key = normName(p.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ name: p.name, items: p.items || [], ph: p.ph || null, kcal: mealTotals(p).kcal, pinned: true, count: groups.get(key)?.count || 0 });
  }
  const auto = [...groups.entries()]
    .filter(([key, g]) => !seen.has(key) && g.count >= 2)
    .sort((a, b) => b[1].count - a[1].count || (a[1].lastKey < b[1].lastKey ? 1 : a[1].lastKey > b[1].lastKey ? -1 : 0));
  for (const [, g] of auto) {
    out.push({ name: g.last.name, items: g.last.items || [], ph: g.last.ph || null, kcal: mealTotals(g.last).kcal, pinned: false, count: g.count });
  }
  return out.slice(0, limit);
}

/* ------------------------------------------------------------------ *
 * Kết quả đang chảy về từ Claude: rút tên bữa và tên món đã thấy để hiện dần
 * ------------------------------------------------------------------ */
export function partialNames(text) {
  const out = { name: "", items: [] };
  const s = String(text ?? "");
  const itemsAt = s.indexOf('"items"');
  const re = /"name"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = re.exec(s))) {
    let v;
    try { v = JSON.parse(`"${m[1]}"`); } catch { continue; }
    v = String(v).trim();
    if (!v) continue;
    if (itemsAt === -1 || m.index < itemsAt) out.name = out.name || v;
    else out.items.push(v);
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Sao lưu — làm sạch dữ liệu nhập vào (file có thể bị sửa tay hoặc hỏng)
 * ------------------------------------------------------------------ */
export const BACKUP_APP = "nhat-ky-calo";
const MEAL_TYPE_IDS = MEAL_TYPES.map((t) => t.id);
/** Các mã lỗi tính calo được phép đi theo file sao lưu (xem cleanMeal); mọi mã khác thành "aborted". */
const BACKUP_FAIL_CODES = ["not_food", "refused", "photo", "too_large", "bad_request", "bad_output", "truncated", "bad_key", "billing", "spend_cap", "model", "forbidden", "no_key", "api", "unknown", "aborted"];

export function cleanMeal(raw) {
  if (!raw || typeof raw !== "object") return null;
  const items = cleanItems(raw.items, 12);
  const ph = typeof raw.ph === "string" && /^[\w-]{1,40}$/.test(raw.ph) ? raw.ph : "";
  const hint = typeof raw.hint === "string" ? raw.hint.trim().slice(0, 300) : "";
  // Bữa chưa tính được calo (đang chờ, hoặc tính lỗi) chưa có món nào, nhưng tấm ảnh hay lời mô tả của nó là dữ liệu
  // của người dùng: giữ lại để còn tính lại hoặc nhập tay. Bữa rỗng không có gì để làm tiếp thì bỏ.
  const unfinished = !items.length && !!(raw.pending || raw.failed) && !!(ph || hint);
  if (!items.length && !unfinished) return null;
  // giờ rỗng ("") là chủ ý: bữa ghi bù vào một ngày đã qua không mang giờ đồng hồ. Mọi giờ sai khác vẫn về 12:00.
  const t = raw.t === "" ? "" : /^([01]\d|2[0-3]):[0-5]\d$/.test(String(raw.t)) ? String(raw.t) : "12:00";
  // mã bữa đi qua data-act="meal:<ngày>:<mã>" nên chỉ nhận chữ, số, gạch; mã lạ (hoặc không phải chuỗi/số) thì cấp mã mới
  const rid = typeof raw.id === "string" || typeof raw.id === "number" ? String(raw.id) : "";
  const fallbackName = items.length ? items[0].n : "Bữa ăn mới";
  const m = {
    id: /^[\w-]{1,40}$/.test(rid) ? rid : uid(),
    t,
    type: MEAL_TYPE_IDS.includes(raw.type) ? raw.type : mealTypeAt(t),
    name: String(raw.name ?? fallbackName).trim().slice(0, 120) || fallbackName,
    items,
    src: ["photo", "text", "manual", "fav"].includes(raw.src) ? raw.src : "manual",
  };
  if (ph) m.ph = ph;
  if (hint) m.hint = hint;
  if (raw.nameEdited === true) m.nameEdited = true;
  if (raw.typeEdited === true) m.typeEdited = true;
  if (unfinished) {
    // việc tính dở không đi theo file sao lưu: bữa đang chờ thành "đã dừng", người dùng bấm tính lại khi cần.
    // Mã lỗi chỉ giữ khi là một trong các mã "dứt khoát" của app. Mã kiểu mạng (network, timeout, offline, server, rate,
    // sdk) cũng thành "đã dừng": nếu giữ, app sẽ tự gọi Claude lại cho những bữa đó ngay sau khi khôi phục. Chuỗi lạ
    // ("constructor"…) cũng vậy.
    m.failed = BACKUP_FAIL_CODES.includes(raw.failed) ? raw.failed : "aborted";
    return m;
  }
  if (raw.conf === "high" || raw.conf === "medium" || raw.conf === "low") m.conf = raw.conf;
  if (typeof raw.note === "string" && raw.note.trim()) m.note = raw.note.trim().slice(0, 240);
  if (typeof raw.advice === "string" && raw.advice.trim()) m.advice = raw.advice.trim().slice(0, 400);
  return m;
}
/** Lời nhận xét cuối ngày của Claude đi theo ngày trong file sao lưu: { c, a, t:[{m,d,k,w}], sig, on }. */
function cleanReview(raw) {
  if (!raw || typeof raw !== "object" || typeof raw.c !== "string" || !raw.c.trim()) return null;
  const t = (Array.isArray(raw.t) ? raw.t : [])
    .filter((x) => x && typeof x === "object" && ["sang", "trua", "toi"].includes(x.m) && typeof x.d === "string" && x.d.trim())
    .slice(0, 3)
    .map((x) => ({ m: x.m, d: x.d.trim().slice(0, 120), k: clamp(Math.round(num(x.k)), 0, 2000), w: typeof x.w === "string" ? x.w.trim().slice(0, 120) : "" }));
  return { c: raw.c.trim().slice(0, 700), a: typeof raw.a === "string" ? raw.a.trim().slice(0, 500) : "", t, sig: typeof raw.sig === "string" ? raw.sig.slice(0, 24) : "", on: isKey(raw.on) ? raw.on : "" };
}
export function cleanDay(raw) {
  if (!raw || typeof raw !== "object") return null;
  const day = { meals: (Array.isArray(raw.meals) ? raw.meals : []).map(cleanMeal).filter(Boolean).slice(0, 40) };
  // mỗi bữa trong ngày một mã riêng: mở, xoá, hoàn tác đều tìm bữa theo mã
  const seen = new Set();
  for (const m of day.meals) { while (seen.has(m.id)) m.id = uid(); seen.add(m.id); }
  const w = parseNum(raw.weight);
  if (w !== null && w >= 30 && w <= 250) day.weight = round1(w);
  const water = Math.round(num(raw.water));
  if (water > 0) day.water = clamp(water, 0, 30);
  if (num(raw.tg) >= 800 && num(raw.tg) <= 6000) day.tg = Math.round(num(raw.tg));
  if (num(raw.td) >= 800 && num(raw.td) <= 8000) day.td = Math.round(num(raw.td));
  const rv = day.meals.length ? cleanReview(raw.rv) : null;
  if (rv) day.rv = rv;
  return day.meals.length || day.weight != null || day.water ? day : null;
}
/** Khoá Claude hợp lệ về hình thức ("sk-ant-…"); không kiểm tra được đúng sai ở đây. */
export const looksLikeApiKey = (s) => typeof s === "string" && /^sk-ant-[A-Za-z0-9_-]{16,280}$/.test(s.trim());
const KEY_FULL_LEN = 90; // khoá Claude hiện dài khoảng 108 ký tự; từ mức này trở lên coi như đã đủ, không nối thêm
// Khoá Claude đúng chuẩn hiện nay: "sk-ant-api03-" + 93 ký tự + "AA" (108 ký tự). Chỉ dùng để NHẬN RA một khoá đã trọn vẹn
// khi ghép các mảnh bị ngắt dòng; khoá có hình thức khác vẫn được nhận theo luật chung bên dưới.
const KEY_STD_LEN = 108;
const KEY_STD = /^sk-ant-api\d\d-[A-Za-z0-9_-]{93}AA$/;
const KEY_CHARS = /^[A-Za-z0-9_-]+$/;
// Bỏ mọi ký hiệu bao quanh một mảnh (ngoặc, nháy, dấu câu, **đậm**, {…}, "/", "…"): bất cứ gì không phải chữ, số, "_" hay "-".
// Chữ có dấu thì KHÔNG bỏ ("<khoá>Cảm" không đoán được khoá dừng ở đâu → để ô khoá hiện lời nhắc).
const stripKeyPiece = (t) => t.replace(/^[^\p{L}\p{N}_-]+|[^\p{L}\p{N}_-]+$/gu, "");
/**
 * Dọn chuỗi người dùng dán/gõ vào ô khoá: khoá hay bị dính ngoặc kép cong của app chat, chữ "Khoá: …" phía trước,
 * dấu xuống dòng ở giữa, vài chữ nhắn phía sau ("… nhé em")… Nếu tìm được một khoá đúng hình thức "sk-ant-…" thì chỉ giữ
 * khoá đó; nếu không thì trả về chuỗi đã bỏ khoảng trắng và ngoặc bao quanh (để người dùng còn thấy mình đã nhập gì).
 *
 * Khoá bắt đầu ở một chữ "sk-ant-" và dừng ở khoảng trắng đầu tiên: chữ đứng sau KHÔNG được ghép vào khoá
 * ("<khoá> nha" mà ghép thành "<khoá>nha" thì vẫn đúng hình thức, được lưu êm, rồi mọi ảnh đều báo sai khoá).
 * Thử lần lượt từng chữ "sk-ant-" trong chuỗi: lời nhắn có thể nhắc tới tiền tố trước khi tới khoá thật
 * ("Khoá Claude (bắt đầu bằng sk-ant-): <khoá>"), và một mảnh tự nó bắt đầu bằng "sk-ant-" là một khoá khác chứ không
 * bao giờ là phần còn lại của khoá đang ghép.
 * Ngoại lệ duy nhất của "dừng ở khoảng trắng" là khoá bị ngắt dòng ở giữa:
 *   1. Nếu ghép các mảnh liền nhau (chỉ gồm ký tự của khoá) cho ra ĐÚNG một khoá chuẩn 108 ký tự thì nhận khoá đó, dù
 *      ngắt ở cột nào và mảnh cuối ngắn đến đâu. Chữ nhắn phía sau không thể vô tình làm tròn đúng 108 ký tự kết thúc "AA".
 *   2. Còn lại (khoá có hình thức khác chuẩn trên) thì không biết khoá dài bao nhiêu, nên dè dặt: đoạn kế tiếp chỉ được nối
 *      khi mọi điều sau cùng đúng — và vì thế một khoá KHÔNG chuẩn bị ngắt sau ký tự thứ 90, hoặc có mảnh cuối ngắn dưới
 *      8 ký tự, sẽ thiếu đuôi (giới hạn đã biết; bước kiểm tra khoá sẽ báo):
 *   - đoạn đó (sau khi bỏ ngoặc, dấu câu) chỉ gồm ký tự của khoá;
 *   - khoá đang ghép còn ngắn hơn một khoá đầy đủ;
 *   - không phải trường hợp "khoá đã đủ hình thức mà đoạn sau ngắn dưới 8 ký tự" (đó là một chữ ở dòng dưới như "nha",
 *     "Thanks", không phải phần còn lại của khoá);
 *   - khoảng trắng ngăn cách có dấu xuống dòng; nếu chỉ là dấu cách thì đoạn sau phải dài từ 8 ký tự trở lên. (Dán vào
 *     ô một dòng, Chrome đổi dấu xuống dòng thành dấu cách, nên khoá bị ngắt dòng tới đây dưới dạng "<nửa đầu> <nửa sau>".
 *     Chữ nhắn kiểu "nha", "em", "ok" thì không bao giờ được ghép: tiếng Việt gõ không dấu không có chữ nào quá 7 ký tự.)
 */
export function tidyApiKey(raw) {
  // ký tự vô hình (zero-width) mà vài trang web, app chat chèn vào chuỗi dài: không bao giờ thuộc về khoá
  const s = String(raw ?? "").replace(/[\u200B-\u200D\u2060]/g, "");
  const fallback = () => s.replace(/\s+/g, "").replace(/^["'“”‘’«»`]+|["'“”‘’«»`.,;]+$/g, "").slice(0, 300);
  // (thử tối đa 20 chỗ: chuỗi dán vào có thể rất dài, không để ô khoá làm đứng máy)
  for (let at = s.indexOf("sk-ant-"), n = 0; at >= 0 && n < 20; at = s.indexOf("sk-ant-", at + 7), n++) {
    const parts = s.slice(at).split(/(\s+)/); // đoạn, khoảng trắng, đoạn, khoảng trắng…
    const first = stripKeyPiece(parts[0]);
    if (!/^sk-ant-[A-Za-z0-9_-]*$/.test(first)) continue;
    // mảnh nối được: chỉ gồm ký tự của khoá và không phải chỗ bắt đầu của một khoá khác
    const piece = (i) => { const t = stripKeyPiece(parts[i]); return KEY_CHARS.test(t) && !t.startsWith("sk-ant-") ? t : ""; };
    // 1. các mảnh liền nhau ghép lại vừa đúng một khoá chuẩn
    let key = first;
    for (let i = 2, next; i < parts.length && key.length < KEY_STD_LEN && (next = piece(i)); i += 2) key += next;
    if (KEY_STD.test(key)) return key;
    // 2. luật chung, dè dặt
    key = first;
    for (let i = 2, next; i < parts.length && key.length < KEY_FULL_LEN && (next = piece(i)); i += 2) {
      const wrapped = /[\r\n\u2028\u2029]/.test(parts[i - 1]);
      if (next.length < 8 && (!wrapped || looksLikeApiKey(key))) break;
      key += next;
    }
    if (looksLikeApiKey(key)) return key;
  }
  return fallback();
}

/**
 * Trả về { ok, error?, data? }. data: { profile, settings, meta, favs, days, photos, apiKey }.
 * Khoá API không nằm trong phần cài đặt của file; nó chỉ được nhận khi file có trường apiKey riêng
 * (người dùng chủ động chọn "kèm khoá" lúc xuất) và đúng hình thức.
 */
export function cleanBackup(obj, todayKey) {
  if (!obj || typeof obj !== "object" || obj.app !== BACKUP_APP) return { ok: false, error: "Đây không phải file sao lưu của Nhật Ký Calo." };
  let profile = null;
  if (obj.profile && typeof obj.profile === "object") {
    const p = obj.profile;
    const sw = parseNum(p.startWeight), gw = parseNum(p.goalWeight);
    // Cân mong muốn có thể nằm TRÊN cân lúc bắt đầu (đặt lại đích sau khi tăng cân, hoặc cân bắt đầu nhập nhầm rồi sửa
    // cân hiện tại trong Cài đặt): app chấp nhận trạng thái đó nên file sao lưu của nó cũng phải đọc lại được.
    // Vì vậy ở đây chỉ kiểm khoảng và kiểu dữ liệu, không kiểm "mong muốn ≤ hiện tại"; cân bắt đầu lấy nguyên từ file.
    // mức tự đặt trong file là một con số (app luôn lưu số nguyên); số lẻ từ file sửa tay thì làm tròn như trước, không vì thế mà bỏ cả hồ sơ
    const ct = typeof p.customTarget === "number" && Number.isFinite(p.customTarget) ? Math.round(p.customTarget) : p.customTarget ?? "";
    const v = validateProfile({ ...p, weight: sw === null ? null : Math.max(sw, gw ?? sw), customTarget: ct }, todayKey);
    if (v.ok && sw !== null && sw >= 30 && sw <= 250) {
      // ngày bắt đầu không thể nằm sau hôm nay
      profile = { name: v.value.name, sex: v.value.sex, birthYear: v.value.birthYear, height: v.value.height, activity: v.value.activity, pace: v.value.pace, goalWeight: v.value.goalWeight, customTarget: v.value.customTarget, startWeight: round1(sw), startDate: isKey(p.startDate) && p.startDate <= todayKey ? p.startDate : todayKey };
    }
  }
  const days = {};
  if (obj.days && typeof obj.days === "object") {
    // Ngày ở tương lai (file sửa tay, hoặc máy cũ đặt sai ngày) không mở ra sửa được trong app, mà một lần cân ở đó
    // sẽ thành "cân hiện tại" mãi mãi → bỏ. Chừa một ngày cho trường hợp sao lưu rồi khôi phục ở múi giờ khác.
    const lastKey = addDays(todayKey, 1);
    for (const k of Object.keys(obj.days)) {
      if (!isKey(k) || k > lastKey) continue;
      const d = cleanDay(obj.days[k]);
      if (d) days[k] = d;
    }
  }
  const favs = (Array.isArray(obj.favs) ? obj.favs : [])
    .map((f) => {
      const items = cleanItems(f?.items, 12);
      const name = String(f?.name ?? "").trim().slice(0, 120);
      if (!items.length || !name) return null;
      const out = { name, items };
      if (typeof f.ph === "string" && /^[\w-]{1,40}$/.test(f.ph)) out.ph = f.ph;
      return out;
    })
    .filter(Boolean)
    .slice(0, 30);
  const s = obj.settings && typeof obj.settings === "object" ? obj.settings : {};
  const settings = cleanSettings(s);
  delete settings.apiKey;
  const meta = { earned: {}, seen: {} };
  if (obj.meta && typeof obj.meta === "object") {
    for (const [id, at] of Object.entries(obj.meta.earned || {})) if (BADGES.some((b) => b.id === id) && isKey(at)) meta.earned[id] = at;
    for (const [id, at] of Object.entries(obj.meta.seen || {})) if (/^[\w.:-]{1,60}$/.test(id)) meta.seen[id] = isKey(at) ? at : todayKey;
  }
  const photos = {};
  if (obj.photos && typeof obj.photos === "object") {
    const used = usedPhotoIds(days, favs);
    for (const [id, url] of Object.entries(obj.photos)) {
      if (used.has(id) && typeof url === "string" && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(url) && url.length < 600000) photos[id] = url;
    }
  }
  const apiKey = looksLikeApiKey(obj.apiKey) ? obj.apiKey.trim() : "";
  return { ok: true, data: { profile, settings, meta, favs, days, photos, apiKey } };
}

/**
 * "File thiết lập": người cài chuẩn bị sẵn trên máy mình (tên, mục tiêu, lời nhắn, quà…) rồi gửi sang máy người dùng,
 * trong đó chưa có bữa ăn nào và chỉ có lần cân lúc tạo hồ sơ. Với file như thế, hành trình phải tính từ NGÀY NHẬN APP:
 * dời ngày bắt đầu (và lần cân đầu) sang hôm nay. Nhờ vậy khi người dùng sửa "Cân hiện tại" ngay hôm nhận app,
 * đó là sửa mốc bắt đầu (quy tắc "cùng ngày bắt đầu") chứ không bị tính thành số kg đã giảm và mở quà nhầm.
 * File có bữa ăn, hoặc có lần cân/ly nước ở ngày khác ngày bắt đầu, là nhật ký thật: giữ nguyên.
 * Sửa trực tiếp trên data (kết quả của cleanBackup) và trả về true nếu có dời.
 */
export function rebaseSetupFile(data, todayKey) {
  const p = data && data.profile;
  if (!p || !isKey(todayKey) || p.startDate === todayKey) return false;
  const keys = Object.keys(data.days || {});
  const onlyStart = keys.every((k) => k === p.startDate && !(data.days[k].meals || []).length && !data.days[k].water);
  if (!onlyStart || (data.favs || []).length) return false;
  p.startDate = todayKey;
  data.days = { [todayKey]: { meals: [], weight: p.startWeight } };
  return true;
}

export const ACCENTS = ["a1", "a2", "a3", "a4"];
export const MODEL_IDS = ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"];
export const DEFAULT_SETTINGS = { pronoun: "bạn", partner: "", theme: "auto", accent: "a1", water: true, waterGoal: 8, model: MODEL_IDS[0], apiKey: "", notes: [], rewards: [] };
export function cleanSettings(s = {}) {
  const out = { ...DEFAULT_SETTINGS };
  if (s.pronoun === "em" || s.pronoun === "bạn" || s.pronoun === "chị" || s.pronoun === "mình") out.pronoun = s.pronoun;
  if (typeof s.partner === "string") out.partner = s.partner.trim().slice(0, 20);
  if (["auto", "light", "dark"].includes(s.theme)) out.theme = s.theme;
  if (ACCENTS.includes(s.accent)) out.accent = s.accent;
  if (typeof s.water === "boolean") out.water = s.water;
  if (Number.isInteger(s.waterGoal) && s.waterGoal >= 4 && s.waterGoal <= 12) out.waterGoal = s.waterGoal;
  if (MODEL_IDS.includes(s.model)) out.model = s.model;
  if (typeof s.apiKey === "string") out.apiKey = s.apiKey.trim().slice(0, 300);
  out.notes = (Array.isArray(s.notes) ? s.notes : []).map((n) => String(n ?? "").trim().slice(0, 160)).filter(Boolean).slice(0, 20);
  out.rewards = (Array.isArray(s.rewards) ? s.rewards : [])
    .map((r) => ({ kg: round1(num(parseNum(r?.kg) ?? 0)), text: String(r?.text ?? "").trim().slice(0, 60) }))
    .filter((r) => r.kg > 0 && r.kg <= 150 && r.text)
    .sort((a, b) => a.kg - b.kg)
    .slice(0, 8);
  return out;
}

/* ------------------------------------------------------------------ *
 * Tiện ích nhỏ
 * ------------------------------------------------------------------ */
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
/** Mọi mã ảnh còn được dùng (bởi bữa ăn hoặc món ghim) — để dọn ảnh mồ côi. */
export function usedPhotoIds(days, pinned = []) {
  const ids = new Set();
  for (const k of Object.keys(days)) for (const m of days[k]?.meals || []) if (m.ph) ids.add(m.ph);
  for (const p of pinned || []) if (p.ph) ids.add(p.ph);
  return ids;
}
