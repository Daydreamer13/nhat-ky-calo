// Chạy (trong thư mục app): node --test
import test from "node:test";
import assert from "node:assert/strict";
import * as L from "../js/logic.js";

const meal = (kcal, extra = {}) => ({ id: L.uid(), t: "12:00", type: "trua", name: "Bữa thử", items: [{ n: "Món", q: "", k: kcal, p: 10, c: 20, f: 5, x: 1 }], ...extra });
const dayOf = (...kcals) => ({ meals: kcals.map((k) => meal(k)) });
const profile = { name: "Linh", sex: "f", birthYear: 1995, height: 158, activity: 1.375, pace: 0.5, goalWeight: 54, startWeight: 60, startDate: "2026-10-01", customTarget: null };

test("khoá ngày: cộng trừ qua tháng, năm, năm nhuận", () => {
  assert.equal(L.addDays("2026-11-30", 1), "2026-12-01");
  assert.equal(L.addDays("2026-01-01", -1), "2025-12-31");
  assert.equal(L.addDays("2028-02-28", 1), "2028-02-29");
  assert.equal(L.diffDays("2026-11-01", "2026-11-20"), 19);
  assert.equal(L.diffDays("2026-11-20", "2026-11-01"), -19);
  assert.equal(L.isKey("2026-02-30"), false);
  assert.equal(L.isKey("2026-11-20"), true);
  assert.equal(L.isKey("profile"), false);
});

test("tuần bắt đầu thứ Hai", () => {
  assert.equal(L.weekdayMon0("2026-11-20"), 4); // thứ Sáu
  assert.equal(L.weekStart("2026-11-20"), "2026-11-16");
  assert.deepEqual(L.weekKeys("2026-11-22").at(-1), "2026-11-22"); // Chủ nhật là ngày cuối
  assert.equal(L.weekStart("2026-11-16"), "2026-11-16");
  assert.equal(L.longDate("2026-11-20"), "Thứ Sáu, 20 tháng 11");
});

test("lưới tháng 11/2026: 30 ngày, ngày 1 là Chủ nhật", () => {
  const g = L.monthGrid(2026, 11);
  assert.equal(g[0][6], "2026-11-01");
  assert.equal(g[0][0], null);
  assert.equal(g.flat().filter(Boolean).length, 30);
  assert.ok(g.every((w) => w.length === 7));
  assert.equal(L.monthGrid(2028, 2).flat().filter(Boolean).length, 29);
});

test("định dạng số kiểu Việt", () => {
  assert.equal(L.fmtInt(1450), "1.450");
  assert.equal(L.fmtInt(16900.4), "16.900");
  assert.equal(L.fmtInt(999), "999");
  assert.equal(L.fmtInt(0), "0");
  assert.equal(L.fmt1(57.8), "57,8");
  assert.equal(L.fmt1(60), "60,0");
  assert.equal(L.fmt1(2.25), "2,3");
  assert.equal(L.parseNum("57,8"), 57.8);
  assert.equal(L.parseNum(" 60 "), 60);
  assert.equal(L.parseNum("abc"), null);
  assert.equal(L.parseNum(""), null);
  assert.equal(L.parseNum("1.2.3"), null);
});

test("Mifflin-St Jeor và mục tiêu", () => {
  // nữ 31 tuổi, 158 cm, 60 kg: 600 + 987.5 − 155 − 161 = 1271.5
  assert.equal(L.bmr("f", 60, 158, 31), 1271.5);
  assert.equal(L.bmr("m", 60, 158, 31), 1437.5);
  const t = L.targetOf(profile, 60, "2026-11-20");
  assert.equal(Math.round(t.tdee), Math.round(1271.5 * 1.375));
  assert.equal(t.mode, "lose");
  assert.equal(t.target, 1200); // 1748 − 550 = 1198 → chạm sàn 1200
  assert.equal(t.floored, true);
  const slow = L.targetOf({ ...profile, pace: 0.25 }, 60, "2026-11-20");
  assert.equal(slow.target, 1470); // 1748.3 − 275 = 1473 → làm tròn 10
  assert.equal(slow.floored, false);
});

test("mục tiêu: tự đặt và giữ cân khi đã về đích", () => {
  assert.equal(L.targetOf({ ...profile, customTarget: 1600 }, 60, "2026-11-20").target, 1600);
  const keep = L.targetOf(profile, 54, "2026-11-20");
  assert.equal(keep.mode, "maintain");
  assert.equal(keep.target, Math.round(keep.tdee / 10) * 10);
  assert.ok(keep.target >= 1200);
});

test("sàn kcal theo giới", () => {
  const tiny = { ...profile, height: 145, activity: 1.2, pace: 0.75 };
  assert.equal(L.targetOf(tiny, 40, "2026-11-20").target, 1200);
  assert.equal(L.targetOf({ ...tiny, sex: "m" }, 40, "2026-11-20").target, 1500);
});

test("số tuần ước tính tới đích", () => {
  assert.equal(L.etaWeeks(60, 54, 1750, 1200), 12); // 550 kcal/ngày = 0,5 kg/tuần
  assert.equal(L.etaWeeks(54, 54, 1750, 1200), 0);
  assert.equal(L.etaWeeks(60, 54, 1500, 1500), null);
});

test("kiểm tra hồ sơ", () => {
  const ok = L.validateProfile({ name: " Linh ", sex: "f", birthYear: "1995", height: "158", weight: "60,4", goalWeight: "54", activity: 1.375, pace: 0.5, customTarget: "" }, "2026-11-20");
  assert.equal(ok.ok, true);
  assert.equal(ok.value.weight, 60.4);
  assert.equal(ok.value.name, "Linh");
  assert.equal(ok.value.customTarget, null);
  const bad = L.validateProfile({ sex: "f", birthYear: "2020", height: "90", weight: "", goalWeight: "70", activity: 9, pace: 9 }, "2026-11-20");
  assert.equal(bad.ok, false);
  for (const f of ["birthYear", "height", "weight", "activity", "pace"]) assert.ok(bad.errors[f], f);
  const up = L.validateProfile({ sex: "f", birthYear: "1995", height: "158", weight: "55", goalWeight: "60", activity: 1.2, pace: 0.5 }, "2026-11-20");
  assert.ok(up.errors.goalWeight);
  const thin = L.validateProfile({ sex: "f", birthYear: "1995", height: "165", weight: "55", goalWeight: "45", activity: 1.2, pace: 0.5 }, "2026-11-20");
  assert.match(thin.errors.goalWeight, /50,4/); // 18,5 × 1,65² = 50,37 → 50,4
  const custom = L.validateProfile({ sex: "f", birthYear: "1995", height: "158", weight: "60", goalWeight: "54", activity: 1.2, pace: 0.5, customTarget: "500" }, "2026-11-20");
  assert.ok(custom.errors.customTarget);
});

test("kiểm tra hồ sơ: từ 18 tuổi trở lên", () => {
  const form = { sex: "f", height: "158", weight: "60", goalWeight: "54", activity: 1.375, pace: 0.5 };
  const at = (birthYear) => L.validateProfile({ ...form, birthYear }, "2026-11-20");
  assert.equal(at("2008").ok, true); // 18 tuổi
  assert.match(at("2009").errors.birthYear, /từ 18 tuổi/); // 17 tuổi
  assert.match(at("2012").errors.birthYear, /từ 18 tuổi/); // 14 tuổi: trước đây được nhận
  // ô trống, gõ sai, năm ở tương lai hay quá xa: vẫn là lời nhắc chung, không phải câu về tuổi
  for (const y of ["", "abc", "1995,5", "2030", "1900"]) assert.equal(at(y).errors.birthYear, "Nhập năm sinh, ví dụ 1995.", y);
});

test("kiểm tra hồ sơ: đã xuống dưới đích vẫn lưu được khi không đổi cân mong muốn (keepGoal)", () => {
  const form = { name: "Linh", sex: "f", birthYear: "1995", height: "158", weight: "53,8", goalWeight: "54,0", activity: 1.375, pace: 0.5, customTarget: "" };
  const kept = L.validateProfile(form, "2026-11-20", { keepGoal: 54 });
  assert.equal(kept.ok, true);
  assert.deepEqual([kept.value.weight, kept.value.goalWeight], [53.8, 54]);
  // không có keepGoal (lúc tạo hồ sơ, file sao lưu) thì vẫn chặt như cũ
  assert.match(L.validateProfile(form, "2026-11-20").errors.goalWeight, /thấp hơn cân hiện tại/);
  assert.ok(L.validateProfile(form, "2026-11-20", {}).errors.goalWeight);
  assert.ok(L.validateProfile(form, "2026-11-20", { keepGoal: null }).errors.goalWeight);
  // ĐỔI cân mong muốn lên trên cân hiện tại thì vẫn bị từ chối
  assert.ok(L.validateProfile({ ...form, goalWeight: "54,5" }, "2026-11-20", { keepGoal: 54 }).errors.goalWeight);
  assert.ok(L.validateProfile({ ...form, goalWeight: "55" }, "2026-11-20", { keepGoal: 54 }).errors.goalWeight);
  // so sánh sau khi làm tròn 0,1; keepGoal dạng chuỗi cũng được
  assert.equal(L.validateProfile({ ...form, goalWeight: "54.04" }, "2026-11-20", { keepGoal: "54,0" }).ok, true);
  // keepGoal chỉ bỏ qua điều kiện "mong muốn ≤ hiện tại": khoảng 30–250 và BMI ≥ 18,5 vẫn kiểm
  assert.match(L.validateProfile({ ...form, weight: "50", goalWeight: "40" }, "2026-11-20", { keepGoal: 40 }).errors.goalWeight, /hơi thấp so với chiều cao/);
  // …nhưng khi chính cân hiện tại cũng dưới ngưỡng thì "hãy chọn từ … kg trở lên" không làm theo được: chỉ một lời nhắc đúng lý do
  assert.match(L.validateProfile({ ...form, weight: "39", goalWeight: "40" }, "2026-11-20", { keepGoal: 40 }).errors.goalWeight, /^Cân hiện tại đã ở mức thấp so với chiều cao/);
  assert.match(L.validateProfile({ ...form, weight: "251", goalWeight: "260" }, "2026-11-20", { keepGoal: 260 }).errors.goalWeight, /30 đến 250/);
  // ở sát sàn BMI (158 cm → 46,2 kg) mà cân xuống dưới: giữ nguyên đích thì vẫn lưu được
  assert.equal(L.validateProfile({ ...form, weight: "45,9", goalWeight: "46,2" }, "2026-11-20", { keepGoal: 46.2 }).ok, true);
});

test("kiểm tra hồ sơ: cân lúc bắt đầu là ô không bắt buộc", () => {
  const form = { name: "Linh", sex: "f", birthYear: "1995", height: "158", weight: "56", goalWeight: "54", activity: 1.375, pace: 0.5, customTarget: "" };
  // không gửi hoặc bỏ trống: bỏ qua, và value KHÔNG có trường startWeight (để trộn vào hồ sơ không xoá mất số đang lưu)
  for (const blank of [undefined, null, "", "   "]) {
    const r = L.validateProfile({ ...form, startWeight: blank }, "2026-11-20");
    assert.equal(r.ok, true);
    assert.equal(r.value.startWeight, undefined);
    assert.equal("startWeight" in r.value, false);
  }
  assert.equal("startWeight" in L.validateProfile(form, "2026-11-20").value, false);
  assert.equal(L.validateProfile({ ...form, startWeight: "56,04" }, "2026-11-20").value.startWeight, 56);
  assert.equal(L.validateProfile({ ...form, startWeight: 65.26 }, "2026-11-20").value.startWeight, 65.3);
  for (const bad of ["29,9", "251", "abc", "5 6 kg"]) {
    const r = L.validateProfile({ ...form, startWeight: bad }, "2026-11-20");
    assert.equal(r.ok, false, bad);
    assert.equal(r.errors.startWeight, "Cân lúc bắt đầu từ 30 đến 250 kg.");
    assert.equal(r.value, null);
  }
  // không ràng buộc với cân mong muốn: đích nằm trên cân bắt đầu là hợp lệ (đặt lại đích sau khi tăng cân)
  const above = L.validateProfile({ ...form, weight: "62", goalWeight: "61", startWeight: "60" }, "2026-11-20");
  assert.equal(above.ok, true);
  assert.deepEqual([above.value.startWeight, above.value.goalWeight, above.value.weight], [60, 61, 62]);
});

test("tổng bữa ăn theo khẩu phần", () => {
  const m = { items: [{ n: "Cơm", k: 200, p: 4, c: 44, f: 0.5, x: 1.5 }, { n: "Thịt", k: 150, p: 20, c: 0, f: 8, x: 0.5 }] };
  assert.deepEqual(L.mealTotals(m), { kcal: 375, p: 16, c: 66, f: 5 });
  assert.equal(L.dayTotals({ meals: [m, m] }).kcal, 750);
  assert.equal(L.dayTotals(undefined).count, 0);
  assert.equal(L.mealTotals({ items: [{ n: "x", k: 100 }] }).kcal, 100); // thiếu x → 1
});

test("bước khẩu phần", () => {
  assert.equal(L.stepPortion(1, 1), 1.25);
  assert.equal(L.stepPortion(1, -1), 0.75);
  assert.equal(L.stepPortion(0.25, -1), 0.25);
  assert.equal(L.stepPortion(3, 1), 3);
  assert.equal(L.portionLabel(1.5), "1½");
});

test("trạng thái ngày", () => {
  assert.equal(L.dayStatus(undefined, 1450), "none");
  assert.equal(L.dayStatus(dayOf(300), 1450), "partial");
  assert.equal(L.dayStatus(dayOf(700, 700), 1450), "ok");
  assert.equal(L.dayStatus(dayOf(1500), 1450), "ok"); // vượt 3,4% vẫn trong dung sai
  assert.equal(L.dayStatus(dayOf(1600), 1450), "over");
  assert.equal(L.dayStatus(dayOf(650), 1200), "ok"); // ≥ max(600, 50%)
  assert.equal(L.dayStatus(dayOf(590), 1200), "partial");
});

test("đoán loại bữa theo giờ", () => {
  assert.equal(L.mealTypeAt("07:15"), "sang");
  assert.equal(L.mealTypeAt("12:20"), "trua");
  assert.equal(L.mealTypeAt("15:30"), "vat");
  assert.equal(L.mealTypeAt("19:00"), "toi");
  assert.equal(L.mealTypeAt("23:30"), "vat");
  assert.equal(L.mealTypeAt("12:20", "drink"), "vat");
  assert.equal(L.mealTypeAt("15:00", "meal"), "trua");
  assert.equal(L.mealTypeAt("16:00", "meal"), "toi");
  assert.equal(L.mealTypeAt("22:30", "meal"), "toi");
  assert.equal(L.mealTypeAt("08:00", "meal"), "sang");
});

test("làm sạch món từ AI", () => {
  const items = L.cleanItems([
    { name: "Cơm tấm", portion: "1 dĩa", kcal: 412.6, protein: 8, carb: 80, fat: 3 },
    { name: "", kcal: 100 },
    null,
    { name: "Quá nhiều", kcal: 99999, protein: -5 },
    "rác",
  ]);
  assert.equal(items.length, 2);
  assert.deepEqual(items[0], { n: "Cơm tấm", q: "1 dĩa", k: 413, p: 8, c: 80, f: 3, x: 1 });
  assert.equal(items[1].k, 5000);
  assert.equal(items[1].p, 0);
  assert.deepEqual(L.cleanItems("không phải mảng"), []);
  assert.equal(L.cleanItems(Array.from({ length: 30 }, (_, i) => ({ name: "m" + i, kcal: 10 }))).length, 10);
});

test("chuỗi ngày hiện tại và kỷ lục", () => {
  const days = { "2026-11-17": dayOf(500), "2026-11-18": dayOf(500), "2026-11-19": dayOf(500) };
  assert.equal(L.currentStreak(days, "2026-11-20"), 3); // hôm nay chưa ghi, chuỗi vẫn sống
  assert.equal(L.currentStreak({ ...days, "2026-11-20": dayOf(100) }, "2026-11-20"), 4);
  assert.equal(L.currentStreak(days, "2026-11-21"), 0); // bỏ trọn một ngày thì đứt
  assert.equal(L.currentStreak({}, "2026-11-20"), 0);
  const gap = { ...days, "2026-11-10": dayOf(1), "2026-11-11": dayOf(1), "2026-11-12": dayOf(1), "2026-11-13": dayOf(1), "2026-11-14": { meals: [] } };
  assert.equal(L.bestStreak(gap), 4);
  assert.equal(L.bestStreak({ "2026-10-31": dayOf(1), "2026-11-01": dayOf(1) }), 2); // qua tháng
  assert.equal(L.bestStreak({ profile: {}, "2026-11-01": dayOf(1) }), 1); // khoá lạ bị bỏ qua
});

test("tổng hợp hành trình: hôm nay không tính, ngày ghi thiếu không cộng thâm hụt", () => {
  const days = {
    "2026-11-16": { ...dayOf(700, 700), td: 1900, tg: 1450 }, // đạt, thâm hụt 500
    "2026-11-17": { ...dayOf(1000, 700), td: 1900, tg: 1450 }, // vượt 1700 > 1522, thâm hụt 200
    "2026-11-18": { ...dayOf(300), td: 1900, tg: 1450 }, // ghi thiếu → bỏ
    "2026-11-19": { meals: [], water: 8 }, // không ghi, đủ nước
    "2026-11-20": { ...dayOf(500, 400, 300), water: 8 }, // hôm nay
  };
  const s = L.journeyStats(days, { todayKey: "2026-11-20", target: 1450, tdee: 1900, waterGoal: 8 });
  assert.equal(s.okDays, 1);
  assert.equal(s.overDays, 1);
  assert.equal(s.partialDays, 1);
  assert.equal(s.bank, 700);
  assert.equal(s.totalMeals, 8);
  assert.equal(s.loggedDays, 4);
  assert.equal(s.waterDays, 2);
  assert.equal(s.streak, 1); // 19 không ghi → chỉ còn hôm nay
  assert.equal(s.best, 3);
});

test("ngân hàng thâm hụt không âm", () => {
  const days = { "2026-11-18": { ...dayOf(2500), td: 1900 }, "2026-11-19": { ...dayOf(2600), td: 1900 } };
  assert.equal(L.journeyStats(days, { todayKey: "2026-11-20", target: 1450, tdee: 1900 }).bank, 0);
});

test("ngân hàng thâm hụt: ăn ít hẳn so với mục tiêu không được cộng nhiều hơn ngày ăn 80% mục tiêu", () => {
  assert.equal(L.LOW_SHARE, 0.8);
  const ctx = { todayKey: "2026-11-20", target: 1300, tdee: 1850 };
  const bankOf = (kcal, c = ctx) => L.journeyStats({ "2026-11-19": dayOf(kcal) }, c).bank;
  assert.equal(bankOf(1300), 550); // ăn đúng mục tiêu
  assert.equal(bankOf(1040), 810); // đúng 80%: trần
  assert.equal(bankOf(900), 810);
  assert.equal(bankOf(650), 810); // trước đây 1.200 — càng ăn ít chum càng đầy nhanh
  assert.equal(bankOf(1100), 750); // trên 80%: tính thật
  assert.equal(bankOf(640), 0); // ghi thiếu: không cộng (như cũ)
  assert.equal(L.journeyStats({ "2026-11-19": dayOf(650) }, ctx).okDays, 1); // vẫn là ngày đạt, cây vẫn lớn
  // ngày vượt không bị ảnh hưởng: 1.850 − 1.500 = 350
  assert.equal(bankOf(1500), 350);
  // trần tính theo mục tiêu và mức đốt ghi lại của chính ngày đó
  assert.equal(L.journeyStats({ "2026-11-19": { ...dayOf(800), tg: 1500, td: 2000 } }, ctx).bank, 800); // 2.000 − 0,8 × 1.500
  // mục tiêu tự đặt cao hơn hẳn mức đốt: trần âm → ngày ăn ít chỉ không được cộng, không bị trừ
  const high = { todayKey: "2026-11-20", target: 2500, tdee: 1850 };
  assert.equal(L.journeyStats({ "2026-11-18": dayOf(1350), "2026-11-19": dayOf(1300) }, high).bank, 0);
  assert.equal(L.journeyStats({ "2026-11-17": dayOf(1000), "2026-11-18": dayOf(1350), "2026-11-19": dayOf(2400) }, { ...high, target: 1300 }).bank, 810 + 500 - 550);
});

test("huy hiệu bữa ăn: chỉ đếm bữa đã có món; ảnh phải là ảnh chụp cho bữa đó", () => {
  const ctx = { todayKey: "2026-11-20", target: 1450, tdee: 1900, waterGoal: 8 };
  // bữa tính lỗi (chưa có khoá) và bữa đang chờ: chưa phải "bữa đầu tiên", nhưng ngày đó vẫn là ngày có ghi
  const failed = { "2026-11-20": { meals: [{ id: "a", t: "08:00", type: "sang", name: "Bữa ăn mới", items: [], ph: "p1", src: "photo", failed: "no_key" }, { id: "b", t: "12:00", type: "trua", name: "1 tô phở", items: [], src: "text", hint: "1 tô phở", pending: true }], water: 1 } };
  const s = L.journeyStats(failed, ctx);
  assert.deepEqual([s.totalMeals, s.photoMeals, s.loggedDays, s.streak], [0, 0, 1, 1]);
  assert.equal(L.badgeHolds("first", s), false);
  assert.equal(L.hasLog(failed["2026-11-20"]), true); // chuỗi ngày vẫn tính bữa đang chờ (chủ ý)
  // tính xong thì được đếm
  failed["2026-11-20"].meals[0] = { ...meal(450), ph: "p1", src: "photo" };
  const done = L.journeyStats(failed, ctx);
  assert.deepEqual([done.totalMeals, done.photoMeals], [1, 1]);
  assert.equal(L.badgeHolds("first", done), true);
  // 30 lần chạm một món hay ăn (dùng lại ảnh đã ghim) không phải 30 tấm ảnh
  const favs = { "2026-11-19": { meals: Array.from({ length: 30 }, () => meal(120, { ph: "pin1", src: "fav" })) } };
  const f = L.journeyStats(favs, ctx);
  assert.deepEqual([f.totalMeals, f.photoMeals], [30, 0]);
  assert.equal(L.badgeHolds("photo30", f), false);
  const photos = { "2026-11-19": { meals: Array.from({ length: 30 }, (_, i) => meal(120, { ph: "p" + i, src: "photo" })) } };
  assert.equal(L.badgeHolds("photo30", L.journeyStats(photos, ctx)), true);
});

test("tuần này", () => {
  const days = { "2026-11-16": dayOf(1380), "2026-11-17": dayOf(1420), "2026-11-18": dayOf(1610), "2026-11-19": dayOf(1400), "2026-11-20": dayOf(930) };
  const w = L.weekSummary(days, { todayKey: "2026-11-20", target: 1450 });
  assert.deepEqual(w.list.map((d) => d.status), ["ok", "ok", "over", "ok", "today", "future", "future"]);
  assert.equal(w.okCount, 3);
  assert.equal(w.closedCount, 4);
  assert.equal(w.avg, 1348);
  assert.equal(w.list[4].isToday, true);
  const over = L.weekSummary({ "2026-11-20": dayOf(1700) }, { todayKey: "2026-11-20", target: 1450 });
  assert.equal(over.list[4].status, "over");
});

test("cân nặng: chuỗi, hiện tại, tiến độ", () => {
  const days = { "2026-10-08": { meals: [], weight: 59.6 }, "2026-11-20": { meals: [], weight: 57.8 }, "2026-11-01": { meals: [] } };
  const s = L.weightSeries(days, profile);
  assert.deepEqual(s.map((p) => p.w), [60, 59.6, 57.8]);
  assert.equal(L.currentWeight(days, profile), 57.8);
  assert.equal(L.currentWeight({}, profile), 60);
  const p = L.weightProgress(profile, 57.8);
  assert.deepEqual([p.total, p.lost, p.remaining, p.reached], [6, 2.2, 3.8, false]);
  assert.ok(Math.abs(p.pct - 2.2 / 6) < 1e-9);
  assert.equal(L.weightProgress(profile, 61).pct, 0); // tăng cân: không âm
  assert.equal(L.weightProgress(profile, 53.5).pct, 1);
  assert.equal(L.weightProgress(profile, 53.5).reached, true);
  // đã cân đúng ngày bắt đầu thì không chèn thêm điểm đầu
  assert.equal(L.weightSeries({ "2026-10-01": { weight: 60.2 } }, profile).length, 1);
});

test("các mốc chặng đường", () => {
  const ms = L.milestones(profile, [{ kg: 2, text: "Một buổi spa" }, { kg: 4, text: "Váy mới" }, { kg: 6, text: "Chuyến đi Đà Lạt" }, { kg: 0, text: "bỏ" }, { kg: 3, text: "  " }]);
  assert.deepEqual(ms.map((m) => m.kg), [1, 2, 3, 4, 5, 6]);
  assert.equal(ms[1].reward, "Một buổi spa");
  assert.equal(ms.at(-1).isGoal, true);
  assert.equal(ms.at(-1).reward, "Chuyến đi Đà Lạt");
  // quãng đường dài: bước tự giãn
  const long = L.milestones({ ...profile, startWeight: 80, goalWeight: 62 }, []);
  assert.ok(long.length <= 6, String(long.length));
  assert.equal(long.at(-1).kg, 18);
  // quà vượt quá đích thì dồn về đích
  assert.equal(L.milestones(profile, [{ kg: 9, text: "Xa quá" }]).at(-1).reward, "Xa quá");
  // quãng lẻ 2,5 kg
  assert.deepEqual(L.milestones({ ...profile, startWeight: 56.5, goalWeight: 54 }, []).map((m) => m.kg), [1, 2, 2.5]);
  assert.deepEqual(L.milestones({ ...profile, startWeight: 54 }, []), []);
});

test("cây hoa", () => {
  assert.deepEqual([L.plantState(0).stage, L.plantState(0).name], [1, "Hạt giống"]);
  assert.equal(L.plantState(1).stage, 2);
  assert.equal(L.plantState(4).stage, 2);
  assert.equal(L.plantState(5).stage, 3);
  const p = L.plantState(21);
  assert.equal(p.stage, 4);
  assert.equal(p.name, "Ra nụ");
  assert.deepEqual(p.next, { name: "Nở hoa", inDays: 9 });
  assert.equal(L.plantState(30).stage, 5);
  assert.equal(L.plantState(999).stage, 6);
  assert.equal(L.plantState(999).next, null);
  assert.equal(L.plantState(-3).stage, 1);
});

test("cây hoa không nhỏ lại: giai đoạn đã chúc mừng là mức sàn", () => {
  // đang ở "Ra lá" (5 ngày đạt), thêm bữa quên ghi vào một ngày cũ → còn 4 ngày đạt: cây vẫn là "Ra lá"
  const p = L.plantState(4, 3);
  assert.deepEqual([p.stage, p.name, p.line], [3, "Ra lá", "Cây đang vươn lá."]);
  assert.deepEqual(p.next, { name: "Ra nụ", inDays: 8 }); // đếm tới giai đoạn KẾ của cây đang vẽ, không phải "còn 1 ngày nữa là ra lá"
  assert.equal(p.pct, 0); // không âm
  // sàn thấp hơn hoặc bằng giai đoạn tính được thì không đổi gì
  assert.deepEqual(L.plantState(21, 2), L.plantState(21));
  assert.deepEqual(L.plantState(21, 4), L.plantState(21));
  assert.deepEqual(L.plantState(5, 3), L.plantState(5));
  // thiếu sàn, sàn lạ: coi như 1
  for (const odd of [undefined, null, 0, -2, NaN, "x"]) assert.deepEqual(L.plantState(4, odd), L.plantState(4), String(odd));
  assert.equal(L.plantState(0, "3").stage, 3);
  // sàn vượt số giai đoạn thì dừng ở giai đoạn cuối
  const top = L.plantState(0, 99);
  assert.deepEqual([top.stage, top.name, top.next, top.pct], [6, "Rực rỡ", null, 1]);
  // mọi tổ hợp: giai đoạn không dưới sàn, còn ít nhất 1 ngày, thanh tiến độ trong 0..1
  for (let floor = 1; floor <= 6; floor++) for (let n = 0; n <= 70; n++) {
    const s = L.plantState(n, floor);
    assert.ok(s.stage >= floor && s.stage >= L.plantState(n).stage, `${n}/${floor}`);
    assert.ok(s.pct >= 0 && s.pct <= 1, `${n}/${floor}`);
    assert.ok(s.next === null || s.next.inDays >= 1, `${n}/${floor}`);
    assert.equal(s.name, L.PLANT_STAGES[s.stage - 1].name);
  }
});

test("mô hình Hành trình: cây theo mức sàn plantFloor của stats", () => {
  const today = "2026-11-20";
  const S = { profile, settings: L.cleanSettings({}), meta: { earned: {}, seen: {} }, favs: [], days: {}, today, viewDay: today, mode: "idb" };
  const c = { todayKey: today, weight: 60, target: 1470, tdee: 1750, mode: "lose", floored: false, waterGoal: 8 };
  for (let i = 1; i <= 5; i++) S.days[L.addDays(today, -i)] = { ...dayOf(700, 700), tg: 1470, td: 1750 };
  const statsOf = (extra = {}) => ({ ...L.journeyStats(S.days, c), ...L.weightProgress(S.profile, 60), waterOn: true, ...extra });
  assert.equal(M.journeyModel(S, c, statsOf(), {}).plant.stage, 3);
  // thêm 300 kcal vào hôm qua → ngày đó thành "vượt", còn 4 ngày đạt
  S.days[L.addDays(today, -1)].meals.push(meal(300));
  const st = statsOf();
  assert.equal(st.okDays, 4);
  assert.equal(M.journeyModel(S, c, st, {}).plant.stage, 2); // stats chưa có plantFloor (state.js cũ): như trước
  const j = M.journeyModel(S, c, { ...st, plantFloor: 3 }, {});
  assert.deepEqual([j.plant.stage, j.plant.name, j.plant.okDays], [3, "Ra lá", 4]);
  assert.deepEqual(j.plant.next, { name: "Ra nụ", inDays: 8 });
});

test("huy hiệu: đạt, tiến độ, và giữ lại khi đã nhận", () => {
  const stats = { totalMeals: 12, best: 6, okDays: 4, photoMeals: 9, waterDays: 2, lost: 1.2, pct: 0.2, reached: false, total: 6, waterOn: true };
  const b = Object.fromEntries(L.badgeStates(stats).map((x) => [x.id, x]));
  assert.equal(b.first.on, true);
  assert.equal(b.streak3.on, true);
  assert.equal(b.streak7.on, false);
  assert.deepEqual([b.streak7.cur, b.streak7.max], [6, 7]);
  assert.equal(b.lost1.on, true);
  assert.equal(b.lost2.on, false);
  assert.equal(b.half.on, false);
  // từng đạt "Giảm 2 kg" rồi tăng lại: vẫn giữ
  const kept = Object.fromEntries(L.badgeStates(stats, { lost2: "2026-11-01" }).map((x) => [x.id, x]));
  assert.equal(kept.lost2.on, true);
  // tắt theo dõi nước thì không hiện huy hiệu nước
  assert.equal(L.badgeStates({ ...stats, waterOn: false }).some((x) => x.id === "water7"), false);
  // quãng đường dưới 2 kg thì không có "Giảm 2 kg"
  assert.equal(L.badgeStates({ ...stats, total: 1.5 }).some((x) => x.id === "lost2"), false);
});

test("món hay ăn: ghim trước, rồi theo số lần", () => {
  const m = (name, kcal, t = "08:00") => ({ ...meal(kcal), name, t });
  const days = {
    "2026-11-15": { meals: [m("Cà phê sữa đá", 120), m("Phở bò", 450)] },
    "2026-11-17": { meals: [m("cà phê sữa đá", 125), m("Chuối", 90)] },
    "2026-11-19": { meals: [m("Cà phê  sữa đá", 130), m("Phở bò", 460), m("Chuối", 95)] },
    "2026-08-01": { meals: [m("Bún cũ", 400), m("Bún cũ", 400)] }, // ngoài cửa sổ 45 ngày
  };
  const f = L.frequentMeals(days, "2026-11-20", [{ name: "Sữa chua không đường", items: [{ n: "Sữa chua", k: 70, x: 1 }] }]);
  assert.deepEqual(f.map((x) => x.name), ["Sữa chua không đường", "Cà phê  sữa đá", "Phở bò", "Chuối"]);
  assert.equal(f[0].pinned, true);
  assert.equal(f[0].kcal, 70);
  assert.equal(f[1].count, 3);
  assert.equal(f[1].kcal, 130); // lấy lần gần nhất
  assert.equal(f[2].kcal, 460);
  // món ghim trùng tên lịch sử không lặp
  const g = L.frequentMeals(days, "2026-11-20", [{ name: "Phở bò", items: [{ n: "Phở", k: 440, x: 1 }] }]);
  assert.equal(g.filter((x) => L.normName(x.name) === "phở bò").length, 1);
  assert.equal(g[0].count, 2);
});

test("ảnh còn dùng", () => {
  const days = { "2026-11-20": { meals: [{ ...meal(1), ph: "a" }, meal(2)] } };
  assert.deepEqual([...L.usedPhotoIds(days, [{ name: "x", ph: "b" }])].sort(), ["a", "b"]);
});

test("tên món hiện dần khi kết quả đang về", () => {
  assert.deepEqual(L.partialNames(""), { name: "", items: [] });
  assert.deepEqual(L.partialNames('{"is_food":true,"name":"Bún ch'), { name: "", items: [] });
  assert.deepEqual(L.partialNames('{"is_food":true,"name":"Bún chả Hà Nội","kind":"meal","items":[{"name":"Bún tươi","portion":"1 đĩa","kcal":180,"protein":4,"carb":40,"fat":0},{"name":"Chả vi'), { name: "Bún chả Hà Nội", items: ["Bún tươi"] });
  assert.deepEqual(L.partialNames('{"name":"Trà \\"đặc biệt\\"","items":[{"name":"Tr\u00e0 s\u1eefa"}]}'), { name: 'Trà "đặc biệt"', items: ["Trà sữa"] });
});

test("cài đặt: làm sạch và giá trị mặc định", () => {
  const s = L.cleanSettings({ pronoun: "em", theme: "neon", accent: "a3", waterGoal: 99, model: "gpt", apiKey: "  sk-ant-x  ", notes: [" Cố lên ", "", 5], rewards: [{ kg: "4", text: "Váy mới" }, { kg: 2, text: " Spa " }, { kg: -1, text: "x" }, { kg: 3, text: "" }] });
  assert.equal(s.pronoun, "em");
  assert.equal(s.theme, "auto");
  assert.equal(s.accent, "a3");
  assert.equal(s.waterGoal, 8);
  assert.equal(s.model, "claude-opus-5-5");
  assert.equal(s.apiKey, "sk-ant-x");
  assert.deepEqual(s.notes, ["Cố lên", "5"]);
  assert.deepEqual(s.rewards, [{ kg: 2, text: "Spa" }, { kg: 4, text: "Váy mới" }]);
  assert.deepEqual(L.cleanSettings(), L.DEFAULT_SETTINGS);
});

test("sao lưu: nhận file đúng, loại rác, khoá API chỉ nhận qua trường riêng", () => {
  assert.equal(L.cleanBackup({ app: "khác" }, "2026-11-20").ok, false);
  assert.equal(L.cleanBackup(null, "2026-11-20").ok, false);
  const r = L.cleanBackup({
    app: "nhat-ky-calo",
    profile: { name: "Linh", sex: "f", birthYear: 1995, height: 158, activity: 1.375, pace: 0.5, goalWeight: 54, startWeight: 60, startDate: "2026-10-01", customTarget: null },
    settings: { pronoun: "em", apiKey: "sk-ant-secret", notes: ["Cố lên"] },
    meta: { earned: { first: "2026-10-02", fake: "2026-10-02", streak3: "hôm qua" }, seen: { "plant:2": "2026-10-03", "<script>": "x" } },
    favs: [{ name: "Chuối", items: [{ n: "Chuối", k: 90 }], ph: "p1" }, { name: "", items: [] }],
    days: {
      "2026-11-19": { meals: [{ id: "m1", t: "07:15", type: "sang", name: "Bánh mì", items: [{ n: "Bánh mì", k: 380 }], ph: "p2", conf: "high" }, { name: "rỗng", items: [] }], weight: "57,8", water: 5, tg: 1450, td: 1900 },
      "không-phải-ngày": { meals: [] },
      "2026-11-18": { meals: [], weight: 999 },
    },
    photos: { p1: "data:image/jpeg;base64,AAAA", p2: "data:image/jpeg;base64,BBBB", lạc: "data:image/jpeg;base64,CCCC", p3: "javascript:alert(1)" },
  }, "2026-11-20");
  assert.equal(r.ok, true);
  const d = r.data;
  assert.equal(d.profile.startWeight, 60);
  assert.equal(d.settings.pronoun, "em");
  assert.equal("apiKey" in d.settings, false);
  assert.equal(d.apiKey, ""); // khoá nằm trong settings của file bị bỏ qua
  assert.deepEqual(d.meta.earned, { first: "2026-10-02" });
  assert.deepEqual(Object.keys(d.meta.seen), ["plant:2"]);
  assert.equal(d.favs.length, 1);
  assert.deepEqual(Object.keys(d.days), ["2026-11-19"]);
  assert.equal(d.days["2026-11-19"].meals.length, 1);
  assert.equal(d.days["2026-11-19"].weight, 57.8);
  assert.equal(d.days["2026-11-19"].meals[0].conf, "high");
  assert.deepEqual(Object.keys(d.photos).sort(), ["p1", "p2"]);
});

test("làm sạch bữa ăn", () => {
  assert.equal(L.cleanMeal({ name: "x", items: [] }), null);
  const m = L.cleanMeal({ t: "sai", type: "lạ", name: "  ", items: [{ name: "Phở", kcal: 450, x: 1.5 }], src: "hack", ph: "../../etc" });
  assert.equal(m.t, "12:00");
  assert.equal(m.type, "trua");
  assert.equal(m.name, "Phở");
  assert.equal(m.items[0].x, 1.5);
  assert.equal(m.src, "manual");
  assert.equal("ph" in m, false);
});

test("làm sạch bữa ăn: mã bữa và giờ", () => {
  const ID = /^[\w-]{1,40}$/;
  const it = [{ n: "Phở", k: 450 }];
  assert.equal(L.cleanMeal({ id: "m1", items: it }).id, "m1");
  assert.equal(L.cleanMeal({ id: "abc-DEF_9", items: it }).id, "abc-DEF_9");
  // mã số trong file sửa tay: giữ, nhưng thành CHUỖI (data-act và findMeal so sánh chuỗi)
  assert.equal(L.cleanMeal({ id: 123, items: it }).id, "123");
  // mã có ':' (làm hỏng data-act="meal:<ngày>:<mã>"), mã quá dài, mã không phải chuỗi/số: cấp mã mới
  for (const bad of ["a:b", "x".repeat(41), "", "có dấu", "a b", "<b>", {}, ["abc"], null, undefined, true]) {
    const id = L.cleanMeal({ id: bad, items: it }).id;
    assert.equal(typeof id, "string");
    assert.match(id, ID);
    assert.notEqual(id, String(bad));
  }
  for (const good of ["00:00", "07:15", "19:59", "23:59"]) assert.equal(L.cleanMeal({ t: good, items: it }).t, good);
  for (const bad of ["99:99", "24:00", "12:60", "7:15", "07:15:00", " 07:15", 715, null, undefined]) assert.equal(L.cleanMeal({ t: bad, items: it }).t, "12:00", String(bad));
  assert.equal(L.cleanMeal({ t: "99:99", items: it }).type, "trua"); // loại bữa đoán theo giờ đã sửa
});

test("làm sạch ngày: mã bữa không trùng nhau trong một ngày", () => {
  const it = [{ n: "Món", k: 100 }];
  const day = L.cleanDay({ meals: [{ id: "dup", name: "Sáng A", items: it }, { id: "dup", name: "Trưa B", items: it }, { id: "a:b", name: "Tối C", items: it }, { id: 123, name: "D", items: it }, { id: {}, name: "E", items: it }, { id: {}, name: "F", items: it }, { id: "123", name: "G", items: it }] });
  const ids = day.meals.map((m) => m.id);
  assert.equal(ids.length, 7);
  assert.equal(new Set(ids).size, 7);
  for (const id of ids) { assert.equal(typeof id, "string"); assert.match(id, /^[\w-]{1,40}$/); }
  assert.equal(ids[0], "dup"); // bữa đầu giữ mã, bữa trùng sau nhận mã mới
  assert.equal(ids[3], "123");
  assert.deepEqual(day.meals.map((m) => m.name), ["Sáng A", "Trưa B", "Tối C", "D", "E", "F", "G"]); // không mất bữa nào
});

test("làm sạch bữa ăn: bữa chưa tính được calo vẫn giữ nếu còn ảnh hoặc lời mô tả", () => {
  // ảnh chụp khi chưa có khoá
  const photo = L.cleanMeal({ id: "p1", t: "07:30", type: "sang", name: "Bữa ăn mới", items: [], ph: "ph-1", src: "photo", failed: "no_key" });
  assert.deepEqual(photo, { id: "p1", t: "07:30", type: "sang", name: "Bữa ăn mới", items: [], src: "photo", ph: "ph-1", failed: "no_key" });
  // gõ mô tả, đang chờ lúc xuất file → thành "đã dừng" để bấm tính lại
  const typed = L.cleanMeal({ id: "t1", t: "12:10", type: "trua", name: "1 tô phở bò tái", items: [], src: "text", hint: "  1 tô phở bò tái  ", pending: true });
  assert.deepEqual(typed, { id: "t1", t: "12:10", type: "trua", name: "1 tô phở bò tái", items: [], src: "text", hint: "1 tô phở bò tái", failed: "aborted" });
  assert.equal("pending" in typed, false);
  // mã lỗi lạ → "aborted"; mã lỗi hợp lệ giữ nguyên; cờ "đã tự sửa tên/loại" đi theo
  for (const junk of ["<script>", "NO KEY", "x".repeat(21), 5, true, {}]) assert.equal(L.cleanMeal({ items: [], ph: "ph-1", failed: junk }).failed, "aborted", String(junk));
  assert.equal(L.cleanMeal({ items: [], hint: "bún bò", failed: "billing" }).failed, "billing");
  const edited = L.cleanMeal({ items: [], ph: "ph-1", failed: "rate", name: "Cơm mẹ nấu", nameEdited: true, typeEdited: true, type: "toi", conf: "high", note: "x" });
  assert.deepEqual([edited.name, edited.nameEdited, edited.typeEdited, edited.type], ["Cơm mẹ nấu", true, true, "toi"]);
  assert.equal("conf" in edited || "note" in edited, false);
  // thiếu tên, tên rỗng: không vấp vì items rỗng
  assert.equal(L.cleanMeal({ items: [], ph: "ph-1", pending: true }).name, "Bữa ăn mới");
  assert.equal(L.cleanMeal({ items: [], ph: "ph-1", pending: true, name: "   " }).name, "Bữa ăn mới");
  assert.equal(L.cleanMeal({ items: [], ph: "ph-1", pending: true, name: null }).name, "Bữa ăn mới");
  assert.equal(L.cleanMeal({ items: [], hint: "x".repeat(500), pending: true }).hint.length, 300);
  // bữa rỗng không có gì để làm tiếp thì vẫn bỏ
  assert.equal(L.cleanMeal({ name: "x", items: [] }), null);
  assert.equal(L.cleanMeal({ name: "x", items: [], ph: "ph-1" }), null); // không chờ, không lỗi
  assert.equal(L.cleanMeal({ name: "x", items: [], pending: true }), null); // không ảnh, không mô tả
  assert.equal(L.cleanMeal({ name: "x", items: [], failed: "no_key", ph: "../../etc", hint: "   " }), null);
  assert.equal(L.cleanMeal({ name: "x", items: [], failed: "no_key", hint: 5 }), null);
  // bữa đã có món: lời mô tả thêm đi theo, không bị gắn "lỗi"
  const ready = L.cleanMeal({ items: [{ n: "Phở", k: 450 }], hint: "tô lớn", failed: "network", pending: true, nameEdited: 1 });
  assert.equal(ready.hint, "tô lớn");
  assert.equal("failed" in ready || "pending" in ready || "nameEdited" in ready, false);
});

test("sao lưu: bữa chưa tính xong và ảnh của nó sống sót qua khôi phục", () => {
  const prof = { name: "Linh", sex: "f", birthYear: 1995, height: 158, activity: 1.375, pace: 0.5, goalWeight: 54, startWeight: 60, startDate: "2026-10-01", customTarget: null };
  const r = L.cleanBackup({
    app: "nhat-ky-calo", profile: prof,
    days: {
      "2026-11-20": { meals: [
        { id: "a", t: "07:30", type: "sang", name: "Bữa ăn mới", items: [], ph: "ph-a", src: "photo", failed: "no_key" },
        { id: "b", t: "12:10", type: "trua", name: "1 tô phở bò tái", items: [], src: "text", hint: "1 tô phở bò tái", failed: "billing" },
        { id: "c", t: "15:00", type: "vat", name: "Chuối", items: [{ n: "Chuối", k: 90 }], src: "manual" },
      ] },
      "2026-11-18": { meals: [{ id: "d", t: "19:00", type: "toi", name: "Bữa ăn mới", items: [], ph: "ph-d", src: "photo", pending: true }] }, // ngày chỉ có bữa dang dở
    },
    photos: { "ph-a": "data:image/jpeg;base64,AAAA", "ph-d": "data:image/jpeg;base64,DDDD", "ph-x": "data:image/jpeg;base64,XXXX" },
  }, "2026-11-20").data;
  assert.deepEqual(r.days["2026-11-20"].meals.map((m) => [m.id, m.failed || "", m.items.length]), [["a", "no_key", 0], ["b", "billing", 0], ["c", "", 1]]);
  assert.equal(r.days["2026-11-20"].meals[1].hint, "1 tô phở bò tái");
  assert.deepEqual(r.days["2026-11-18"].meals.map((m) => [m.id, m.failed, m.ph]), [["d", "aborted", "ph-d"]]);
  assert.deepEqual(Object.keys(r.photos).sort(), ["ph-a", "ph-d"]); // ảnh của bữa dang dở còn nguyên; ảnh mồ côi vẫn bị bỏ
  // ngày chỉ có bữa dang dở vẫn là "có ghi" (giữ chuỗi ngày), chưa tính vào ngày đạt
  const s = L.journeyStats(r.days, { todayKey: "2026-11-20", target: 1200, tdee: 1750, waterGoal: 8 });
  assert.deepEqual([s.loggedDays, s.partialDays, s.okDays, s.totalMeals], [2, 1, 0, 1]);
});

test("sao lưu: cân mong muốn nằm trên cân lúc bắt đầu vẫn khôi phục được", () => {
  const prof = { name: "Linh", sex: "f", birthYear: 1995, height: 158, activity: 1.375, pace: 0.5, customTarget: null, startDate: "2026-10-01" };
  const restore = (extra) => L.cleanBackup({ app: "nhat-ky-calo", profile: { ...prof, ...extra }, days: { "2026-11-19": dayOf(500) } }, "2026-11-20");
  // chồng đoán 55 kg lúc cài, vợ sửa cân thật 62 và đặt đích 56: app đang chạy bình thường với hồ sơ này
  const a = restore({ startWeight: 55, goalWeight: 56 });
  assert.equal(a.ok, true);
  assert.deepEqual([a.data.profile.startWeight, a.data.profile.goalWeight, a.data.profile.startDate], [55, 56, "2026-10-01"]);
  assert.equal(Object.keys(a.data.days).length, 1);
  assert.deepEqual([restore({ startWeight: 60, goalWeight: 61 }).data.profile.startWeight, restore({ startWeight: 60, goalWeight: 60.1 }).data.profile.goalWeight], [60, 60.1]);
  assert.deepEqual(L.milestones(a.data.profile, [{ kg: 2, text: "Spa" }]), []); // hồ sơ như vậy không có mốc, không vấp
  // số thập phân dấu phẩy (file sửa tay), làm tròn 0,1
  const c = restore({ startWeight: "57,84", goalWeight: "54,0" }).data.profile;
  assert.deepEqual([c.startWeight, c.goalWeight], [57.8, 54]);
  assert.deepEqual(restore({ startWeight: "55,4", goalWeight: "56,2" }).data.profile.startWeight, 55.4);
  // trường hợp thường: như cũ
  assert.equal(restore({ startWeight: 60, goalWeight: 54 }).data.profile.startWeight, 60);
  // cân bắt đầu ngoài khoảng 30–250 hoặc không phải số: không nhận hồ sơ (dù đích hợp lệ)
  for (const bad of [10, 20, 29.9, 250.1, 300, null, undefined, "abc", "", {}, true]) assert.equal(restore({ startWeight: bad, goalWeight: 54 }).data.profile, null, String(bad));
  // đích vẫn phải hợp lệ: ngoài khoảng, không phải số, dưới BMI 18,5 (158 cm → 46,2 kg)
  for (const bad of [300, "abc", null, 40]) assert.equal(restore({ startWeight: 60, goalWeight: bad }).data.profile, null, String(bad));
});

test("sao lưu: bỏ ngày ở tương lai, ngày bắt đầu không sau hôm nay", () => {
  const prof = { name: "Linh", sex: "f", birthYear: 1995, height: 158, activity: 1.375, pace: 0.5, goalWeight: 54, startWeight: 60, customTarget: null };
  const restore = (startDate, days) => L.cleanBackup({ app: "nhat-ky-calo", profile: { ...prof, startDate }, days }, "2026-11-20").data;
  const d = restore("2026-10-01", {
    "2026-11-19": { meals: [], weight: 59.5 },
    "2026-11-20": { meals: [], weight: 59 },
    "2026-11-21": { meals: [], weight: 58.9 }, // chừa đúng một ngày (đổi múi giờ)
    "2026-11-22": { meals: [], weight: 45 },
    "2099-01-01": { meals: [], weight: 31 },
    "9999-12-31": { meals: [], weight: 120 },
  });
  assert.deepEqual(Object.keys(d.days).sort(), ["2026-11-19", "2026-11-20", "2026-11-21"]);
  assert.equal(L.currentWeight({ "2026-11-19": d.days["2026-11-19"], "2026-11-20": d.days["2026-11-20"] }, d.profile), 59);
  // qua tháng, qua năm
  assert.deepEqual(Object.keys(L.cleanBackup({ app: "nhat-ky-calo", days: { "2027-01-01": { water: 3 }, "2027-01-02": { water: 3 } } }, "2026-12-31").data.days), ["2027-01-01"]);
  assert.equal(d.profile.startDate, "2026-10-01");
  assert.equal(restore("2026-11-20", {}).profile.startDate, "2026-11-20");
  for (const bad of ["2026-11-21", "9999-12-31", "2026-02-30", "hôm qua", null, undefined, 20261001]) assert.equal(restore(bad, {}).profile.startDate, "2026-11-20", String(bad));
});

test("sao lưu kèm khoá: chỉ nhận khoá đúng hình thức ở trường apiKey", () => {
  const base = { app: "nhat-ky-calo", profile: { sex: "f", birthYear: 1995, height: 158, activity: 1.375, pace: 0.5, goalWeight: 54, startWeight: 60, startDate: "2026-10-01" } };
  assert.equal(L.cleanBackup({ ...base, apiKey: "sk-ant-api03-AbC_dEf-0123456789xyz" }, "2026-11-20").data.apiKey, "sk-ant-api03-AbC_dEf-0123456789xyz");
  assert.equal(L.cleanBackup({ ...base, apiKey: "  sk-ant-api03-AbC_dEf-0123456789xyz  " }, "2026-11-20").data.apiKey, "sk-ant-api03-AbC_dEf-0123456789xyz");
  for (const bad of ["hello", "sk-ant-<script>alert(1)</script>", 12345, null, "sk-ant-short"]) assert.equal(L.cleanBackup({ ...base, apiKey: bad }, "2026-11-20").data.apiKey, "", String(bad));
  assert.equal(L.looksLikeApiKey("sk-ant-api03-" + "a".repeat(90)), true);
  assert.equal(L.looksLikeApiKey("sk-proj-abc"), false);
});

/* ------------------------------------------------------------------ *
 * models.js — mô hình hiển thị, thử bằng bộ dữ liệu mẫu 6 tuần
 * ------------------------------------------------------------------ */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as M from "../js/models.js";

function seededState(today, viewDay = today) {
  const json = execFileSync(process.execPath, [fileURLToPath(new URL("./make-seed.mjs", import.meta.url)), today], { encoding: "utf8", maxBuffer: 16 << 20 });
  const r = L.cleanBackup(JSON.parse(json), today);
  assert.equal(r.ok, true);
  const d = r.data;
  const S = { profile: d.profile, settings: L.cleanSettings(d.settings), meta: d.meta, favs: d.favs, days: d.days, today, viewDay, mode: "idb" };
  const weight = L.currentWeight(S.days, S.profile);
  const t = L.targetOf(S.profile, weight, today);
  const c = { todayKey: today, weight, target: t.target, tdee: t.tdee, mode: t.mode, floored: t.floored, waterGoal: 8 };
  const stats = { ...L.journeyStats(S.days, c), ...L.weightProgress(S.profile, weight), waterOn: true };
  return { S, c, stats };
}

test("mô hình Hôm nay: số liệu khớp nhau", () => {
  const { S, c } = seededState("2026-11-20");
  const m = M.todayModel(S, c, { hour: 13, minute: 0 });
  assert.equal(m.isToday, true);
  assert.equal(m.greeting, "Chào buổi chiều, Linh");
  assert.equal(m.dateLabel, "Thứ Sáu, 20 tháng 11");
  assert.equal(m.kcal.eaten, 930);
  assert.equal(m.kcal.left, c.target - 930);
  assert.equal(m.kcal.over, false);
  assert.equal(m.groups.length, 4);
  assert.deepEqual(m.groups.map((g) => g.meals.length), [1, 1, 0, 0]);
  assert.equal(m.nextSlot, "toi"); // 13h, đã có bữa trưa → mời chụp bữa tối
  assert.equal(m.week.length, 7);
  assert.equal(m.week[4].isToday && m.week[4].selected, true);
  assert.equal(m.week[5].status, "future");
  assert.equal(m.canNextWeek, false);
  assert.equal(m.canPrevWeek, true);
  assert.match(m.coach, /cho bữa tối/);
  assert.ok(m.note && m.note.label === "Lời nhắn từ anh");
  assert.equal(m.water.count, 5);
  assert.ok(m.favs.length > 0 && m.favs[0].pinned);
  assert.ok(m.recap && m.recap.key === "2026-11-19");
  assert.equal(m.macros.length, 3);
  assert.equal(m.hints.noKey, true);
});

test("mô hình Hôm nay: ô mời chụp theo giờ", () => {
  const { S, c } = seededState("2026-11-20");
  assert.equal(M.todayModel(S, c, { hour: 8 }).nextSlot, "toi"); // sáng và trưa đã có → còn bữa tối
  S.days["2026-11-20"].meals = [];
  assert.equal(M.todayModel(S, c, { hour: 8 }).nextSlot, "sang");
  assert.equal(M.todayModel(S, c, { hour: 12 }).nextSlot, "trua");
  assert.equal(M.todayModel(S, c, { hour: 19 }).nextSlot, "toi");
  assert.equal(M.todayModel(S, c, { hour: 23 }).nextSlot, null);
  assert.match(M.todayModel(S, c, { hour: 8 }).coach, /Chuỗi \d+ ngày đang chờ em/);
});

test("mô hình Hôm nay: xem lại ngày cũ và lùi tuần", () => {
  const { S, c } = seededState("2026-11-20", "2026-11-16");
  const m = M.todayModel(S, c, { hour: 13 });
  assert.equal(m.isToday, false);
  assert.equal(m.nextSlot, null);
  assert.equal(m.recap, null);
  assert.equal(m.note, null);
  assert.ok(["ok", "over", "partial", "none"].includes(m.pastStatus));
  assert.equal(m.week.find((d) => d.selected).k, "2026-11-16");
  const back = M.todayModel(S, c, { hour: 13, weekAnchor: "2026-11-10" });
  assert.equal(back.week[0].k, "2026-11-09");
  assert.equal(back.canNextWeek, true);
  assert.equal(back.week.some((d) => d.selected), false);
  assert.equal(M.todayModel({ ...S, viewDay: "2026-11-19" }, c, { hour: 9 }).dayTitle, "hôm qua");
});

test("mô hình Hành trình", () => {
  const { S, c, stats } = seededState("2026-11-20");
  const j = M.journeyModel(S, c, stats, {});
  assert.equal(j.weight.current, 57.8);
  assert.equal(j.weight.lost, 2.2);
  assert.equal(j.weight.remaining, 3.8);
  assert.ok(j.weight.etaWeeks > 0);
  assert.deepEqual(j.trail.map((t) => t.kind), ["start", "mark", "mark", "now", "mark", "mark", "mark", "goal"]);
  assert.equal(j.trail[2].reward, "Một buổi spa");
  assert.equal(j.trail[2].reached, true);
  assert.equal(j.trail[4].reached, false);
  assert.equal(j.trail.at(-1).reward, "Chuyến đi Đà Lạt");
  assert.equal(j.chart.points.length, 7);
  assert.equal(j.chart.min, 54);
  assert.equal(j.chart.max, 60);
  assert.equal(j.month.label, "Tháng 11");
  assert.equal(j.month.weeks.flat().filter(Boolean).length, 30);
  assert.equal(j.month.canNext, false);
  assert.equal(j.month.canPrev, true);
  assert.equal(M.journeyModel(S, c, stats, { monthOffset: -1 }).month.label, "Tháng 10");
  assert.equal(M.journeyModel(S, c, stats, { monthOffset: -1 }).month.canNext, true);
  assert.equal(M.journeyModel(S, c, stats, { monthOffset: -1 }).month.canPrev, false);
  assert.equal(j.plant.stage, 5);
  assert.equal(j.bank.nextKg, Math.floor(stats.bankKg) + 1);
  assert.ok(j.bank.toNext > 0 && j.bank.toNext <= 7700);
  assert.ok(j.badges.length >= 10);
  assert.ok(j.earnedCount >= 5);
  assert.equal(j.week.list.length, 7);
});

test("mô hình Hành trình: đã về đích thì không còn điểm 'đang ở đây'", () => {
  const { S, c } = seededState("2026-11-20");
  S.days["2026-11-20"].weight = 53.9;
  const weight = L.currentWeight(S.days, S.profile);
  const t = L.targetOf(S.profile, weight, "2026-11-20");
  const c2 = { ...c, weight, target: t.target, tdee: t.tdee, mode: t.mode };
  const stats = { ...L.journeyStats(S.days, c2), ...L.weightProgress(S.profile, weight), waterOn: true };
  const j = M.journeyModel(S, c2, stats, {});
  assert.equal(j.weight.reached, true);
  assert.equal(j.weight.mode, "maintain");
  assert.equal(j.trail.some((x) => x.kind === "now"), false);
  assert.equal(j.trail.every((x) => x.reached), true);
});

test("file thiết lập (chưa có bữa nào): hành trình tính từ ngày nhận app", () => {
  const base = () => ({ profile: { ...profile, startWeight: 65, startDate: "2026-11-10" }, favs: [], days: { "2026-11-10": { meals: [], weight: 65, tg: 1500, td: 1800 } } });
  // chồng chuẩn bị ngày 10/11 với số cân áng chừng, vợ nhận ngày 20/11
  const d = base();
  assert.equal(L.rebaseSetupFile(d, "2026-11-20"), true);
  assert.equal(d.profile.startDate, "2026-11-20");
  assert.deepEqual(d.days, { "2026-11-20": { meals: [], weight: 65 } });
  assert.deepEqual(L.weightSeries(d.days, d.profile).map((x) => [x.k, x.w]), [["2026-11-20", 65]]);
  // nhận ngay trong ngày: không có gì để dời
  const same = base();
  assert.equal(L.rebaseSetupFile(same, "2026-11-10"), false);
  assert.equal(same.days["2026-11-10"].tg, 1500);
  // file không có ngày nào cũng là file thiết lập
  const empty = { profile: { ...profile, startWeight: 65, startDate: "2026-11-10" }, favs: [], days: {} };
  assert.equal(L.rebaseSetupFile(empty, "2026-11-20"), true);
  assert.deepEqual(empty.days, { "2026-11-20": { meals: [], weight: 65 } });
  // nhật ký thật thì giữ nguyên: có bữa ăn, có lần cân hay ly nước ở ngày khác, có ly nước ngay ngày đầu, hoặc đã ghim món
  const withMeal = base(); withMeal.days["2026-11-10"].meals = [meal(400)];
  const otherWeigh = base(); otherWeigh.days["2026-11-15"] = { meals: [], weight: 64.2 };
  const otherWater = base(); otherWater.days["2026-11-12"] = { meals: [], water: 3 };
  const water = base(); water.days["2026-11-10"].water = 2;
  const pinned = base(); pinned.favs = [{ name: "Phở bò", items: [{ n: "Phở bò", k: 450 }] }];
  for (const x of [withMeal, otherWeigh, otherWater, water, pinned]) {
    const before = JSON.stringify(x);
    assert.equal(L.rebaseSetupFile(x, "2026-11-20"), false);
    assert.equal(JSON.stringify(x), before);
  }
  assert.equal(L.rebaseSetupFile({ profile: null, days: {} }, "2026-11-20"), false);
});

test("dọn khoá Claude khi dán: bỏ ngoặc, chữ thừa, xuống dòng", () => {
  const key = "sk-ant-api03-" + "Ab1_-".repeat(8);
  assert.equal(L.tidyApiKey(key), key);
  assert.equal(L.tidyApiKey(`  “${key}”  `), key);
  assert.equal(L.tidyApiKey(`Khoá của em: ${key}.`), key);
  assert.equal(L.tidyApiKey(key.slice(0, 20) + "\n" + key.slice(20)), key); // xuống dòng giữa khoá
  assert.equal(L.looksLikeApiKey(L.tidyApiKey(`"${key}"`)), true);
  // không có đoạn nào giống khoá: giữ lại (đã bỏ khoảng trắng, ngoặc) để người dùng thấy mình nhập gì
  assert.equal(L.tidyApiKey(' "mat khau 123" '), "matkhau123");
  assert.equal(L.tidyApiKey(null), "");
  assert.equal(L.tidyApiKey("x".repeat(500)).length, 300);
});

/* ------------------------------------------------------------------ *
 * "Đã đạt thì giữ" — quà và huy hiệu cân nặng tính theo lần cân thấp nhất từng ghi
 * ------------------------------------------------------------------ */
test("cân thấp nhất từng ghi và tiến độ 'tốt nhất'", () => {
  const days = { "2026-10-20": { meals: [], weight: 57.9 }, "2026-11-20": { meals: [], weight: 58.6 } };
  assert.equal(L.lowestWeight(days, profile), 57.9);
  assert.equal(L.lowestWeight({}, profile), 60);
  assert.equal(L.lowestWeight({ "2026-11-20": { meals: [], weight: 61 } }, profile), 60); // tăng cân: thấp nhất vẫn là lúc bắt đầu
  const p = L.weightProgress(profile, 58.6, 57.9);
  assert.deepEqual([p.lost, p.bestLost, p.reached, p.everReached], [1.4, 2.1, false, false]);
  assert.ok(Math.abs(p.bestPct - 2.1 / 6) < 1e-9);
  // không truyền "thấp nhất" thì bằng hiện tại; cân hiện tại thấp hơn "thấp nhất" (dữ liệu lệch) thì lấy cân hiện tại
  assert.equal(L.weightProgress(profile, 57.8).bestLost, 2.2);
  assert.equal(L.weightProgress(profile, 57.0, 58).bestLost, 3);
  assert.equal(L.weightProgress(profile, 61).bestLost, 0);
  // từng chạm đích rồi nhích lên
  const back = L.weightProgress(profile, 54.6, 53.9);
  assert.deepEqual([back.reached, back.everReached, back.bestPct], [false, true, 1]);
});

test("huy hiệu cân nặng: giữ khi cân nhích lên, trả lại khi lần cân gõ nhầm được sửa", () => {
  const base = { totalMeals: 3, best: 2, okDays: 1, photoMeals: 1, waterDays: 0, total: 6, waterOn: true };
  // cân từng xuống 57,9 (−2,1) rồi lên 58,6 (−1,4): "Giảm 2 kg" vẫn bật dù chưa có trong sổ "đã nhận"
  const up = { ...base, ...L.weightProgress(profile, 58.6, 57.9) };
  const b = Object.fromEntries(L.badgeStates(up).map((x) => [x.id, x]));
  assert.equal(b.lost1.on, true);
  assert.equal(b.lost2.on, true);
  assert.equal(b.half.on, false);
  assert.equal(L.badgeHolds("lost2", up), true);
  // gõ nhầm 47,8 rồi sửa thành 57,8: không lần cân nào còn chạm đích → "Về đích" không còn đủ điều kiện
  const fixed = { ...base, ...L.weightProgress(profile, 57.8, 57.8) };
  assert.equal(L.badgeHolds("goal", fixed), false);
  assert.equal(L.badgeHolds("half", fixed), false);
  assert.equal(L.badgeHolds("lost2", fixed), true);
  assert.equal(L.badgeHolds("khong-co", fixed), false);
  assert.deepEqual(L.WEIGHT_BADGES, ["lost1", "lost2", "half", "goal"]);
});

test("mô hình Hành trình: quà đã mở không bị khoá lại khi cân nhích lên", () => {
  const { S, c } = seededState("2026-11-20");
  // hôm qua 57,6 (qua mốc −2 kg có quà), hôm nay 58,4
  S.days["2026-11-19"].weight = 57.6;
  S.days["2026-11-20"].weight = 58.4;
  const weight = L.currentWeight(S.days, S.profile);
  const t = L.targetOf(S.profile, weight, "2026-11-20");
  const c2 = { ...c, weight, target: t.target, tdee: t.tdee, mode: t.mode };
  const stats = { ...L.journeyStats(S.days, c2), ...L.weightProgress(S.profile, weight, L.lowestWeight(S.days, S.profile)), waterOn: true };
  const j = M.journeyModel(S, c2, stats, {});
  const spa = j.trail.find((x) => x.reward === "Một buổi spa");
  assert.equal(weight, 58.4);
  assert.equal(spa.reached, false); // viên đá trên đường mòn theo cân hiện tại
  assert.equal(spa.opened, true);   // nhưng quà thì đã mở
  assert.equal(j.trail.find((x) => x.reward === "Váy mới").opened, false);
  assert.equal(j.badges.find((x) => x.id === "lost2").on, true);
  // tuần: mỗi ngày có cờ "đã ghi"
  assert.equal(j.week.list.find((d) => d.isToday).logged, true);
  assert.equal(j.week.list.at(-1).logged, false);
});

/* ------------------------------------------------------------------ *
 * words.js — câu chữ: không khen một ngày ăn ít hẳn so với mục tiêu
 * ------------------------------------------------------------------ */
import * as W from "../js/words.js";

test("lời nhắc về hôm qua: dưới 80% mục tiêu thì nhắc nhẹ thay vì khen", () => {
  // mục tiêu 1.300: 650 và 1.039 là "đạt" theo dayStatus nhưng ít hẳn so với mức
  for (const kcal of [650, 900, 1039]) {
    const r = W.recapYesterday("ok", kcal, 1300, "em");
    assert.equal(r.tone, "calm", String(kcal));
    assert.match(r.text, /hơi ít so với mức 1\.300/);
    assert.match(r.text, /nhớ ăn đủ bữa/);
    assert.doesNotMatch(r.text, /đạt mục tiêu|Cây hoa/);
  }
  assert.equal(W.recapYesterday("ok", 650, 1300, "em").text, "Hôm qua em ghi 650 kcal, hơi ít so với mức 1.300. Còn bữa nào chưa ghi thì ghi bù nhé, và hôm nay nhớ ăn đủ bữa.");
  // từ 80% trở lên: lời khen như cũ
  for (const kcal of [1040, 1100, 1300, 1360]) {
    const r = W.recapYesterday("ok", kcal, 1300, "em");
    assert.equal(r.tone, "good", String(kcal));
    assert.match(r.text, /đạt mục tiêu/);
  }
  // các trạng thái khác không đổi
  assert.equal(W.recapYesterday("over", 1700, 1300, "em").tone, "calm");
  assert.match(W.recapYesterday("partial", 300, 1300, "em").text, /ghi chưa đủ bữa/);
  assert.equal(W.recapYesterday("none", 0, 1300, "em"), null);
  // đúng với mọi cách xưng hô, không sót chữ "bạn" cứng
  for (const you of ["bạn", "em", "chị", "mình"]) {
    const t = W.recapYesterday("ok", 700, 1300, you).text;
    assert.ok(t.startsWith(`Hôm qua ${you} ghi 700 kcal`), t);
    if (you !== "bạn") assert.doesNotMatch(t, /bạn/);
  }
  assert.match(W.recapYesterday("ok", 700, 1300).text, /^Hôm qua bạn ghi/);
});

test("lời động viên buổi tối: dưới 80% mục tiêu thì nhắc ăn đủ, từ 80% mới khen — và khen không trịch thượng", () => {
  // 21 giờ, bữa tối ĐÃ ghi (chưa ghi bữa tối thì xem bài kiểm thử kế bên)
  const at = (eaten, extra = {}) => W.coachToday({ eaten, target: 1300, count: 2, hour: 21, streak: 3, hasLunch: true, hasDinner: true, you: "em", seed: "2026-11-20", ...extra });
  for (const eaten of [300, 650, 700, 900, 1039]) assert.match(at(eaten), /^Hôm nay em ăn hơi ít\..*nhớ ăn đủ\.$/, String(eaten));
  for (const eaten of [1040, 1100, 1169]) assert.equal(at(eaten), "Sắp hết ngày mà em vẫn trong mục tiêu. Tuyệt lắm.", String(eaten));
  assert.match(at(1200), /Vừa khít/); // còn ≤ 10%: như cũ
  assert.match(at(900, { hour: 19, hasDinner: false }), /^Còn 400 kcal cho bữa tối/); // trước 20h: như cũ
  assert.equal(at(900, { hour: 19 }), "Còn 400 kcal cho phần còn lại của ngày.");
  assert.match(at(900, { hour: 20 }), /ăn hơi ít/);
  // "Giỏi lắm" là lời khen người nhỏ hơn; với "chị" nghe trịch thượng → lời khen trung tính cho mọi cách xưng hô
  for (const you of ["bạn", "em", "chị", "mình"]) {
    assert.equal(at(1100, { you }), `Sắp hết ngày mà ${you} vẫn trong mục tiêu. Tuyệt lắm.`);
    assert.equal(at(700, { you }), `Hôm nay ${you} ăn hơi ít. Còn bữa nào chưa ghi thì ghi nốt nhé, và nhớ ăn đủ.`);
  }
  for (let hour = 0; hour < 24; hour++) for (let eaten = 0; eaten <= 2000; eaten += 50) for (const hasDinner of [true, false]) assert.doesNotMatch(at(eaten, { hour, hasDinner, count: eaten ? 2 : 0 }), /Giỏi lắm/);
});

test("lời động viên buổi tối: chưa ghi bữa tối thì trước 22 giờ không nói 'ăn hơi ít' — vẫn là phần còn lại cho bữa tối", () => {
  // sáng + trưa thường mới được 55–70% mục tiêu; ô mời "Chụp bữa tối" còn mở tới 22 giờ (models.js), câu chữ phải đi cùng
  const at = (eaten, extra = {}) => W.coachToday({ eaten, target: 1300, count: 2, hour: 20, streak: 3, hasLunch: true, hasDinner: false, you: "em", seed: "2026-11-20", ...extra });
  for (const hour of [20, 21]) {
    assert.equal(at(900, { hour }), "Còn 400 kcal cho bữa tối. Một bữa vừa phải là đẹp.", String(hour)); // 20:30, đã ghi bữa trưa, chưa ghi bữa tối
    assert.match(at(300, { hour }), /^Còn 1\.000 kcal cho bữa tối\. Thoải mái/, String(hour));
    assert.match(at(900, { hour, hasLunch: false }), /^Còn \d+ kcal cho bữa tối/, String(hour)); // chưa ghi cả bữa trưa: vẫn câu về bữa tối
    for (const eaten of [300, 650, 900, 1039]) assert.doesNotMatch(at(eaten, { hour }), /ăn hơi ít/, `${hour}h ${eaten}`);
    // từ 80% trở lên: lời khen như cũ, có hay chưa có bữa tối
    assert.equal(at(1100, { hour }), "Sắp hết ngày mà em vẫn trong mục tiêu. Tuyệt lắm.");
    assert.match(at(1200, { hour }), /Vừa khít/);
    assert.match(at(1500, { hour }), /vượt 200 kcal/i);
  }
  // từ 22 giờ (ô mời chụp bữa tối đã đóng), hoặc bữa tối đã ghi: nhắc nhẹ như trước
  for (const hour of [22, 23]) assert.match(at(900, { hour }), /^Hôm nay em ăn hơi ít\./, String(hour));
  for (const hour of [20, 21, 22, 23]) assert.match(at(900, { hour, hasDinner: true }), /^Hôm nay em ăn hơi ít\./, String(hour));
  // câu "còn … cho bữa tối" không gọi tên ai nên đúng với mọi cách xưng hô
  for (const you of ["bạn", "em", "chị", "mình"]) assert.equal(at(900, { you }), "Còn 400 kcal cho bữa tối. Một bữa vừa phải là đẹp.");
});

test("mô hình Hôm nay lúc 20:30, chưa ghi bữa tối: câu động viên và ô mời chụp bữa tối nói cùng một ý", () => {
  const { S, c } = seededState("2026-11-20"); // dữ liệu mẫu: hôm nay đã ghi sáng + trưa, 930 kcal (63% mục tiêu)
  for (const [hour, minute] of [[20, 0], [20, 30], [21, 59]]) {
    const m = M.todayModel(S, c, { hour, minute });
    assert.equal(m.nextSlot, "toi", `${hour}:${minute}`);
    assert.equal(m.coach, `Còn ${L.fmtInt(c.target - 930)} kcal cho bữa tối. Một bữa vừa phải là đẹp.`, `${hour}:${minute}`);
  }
  const late = M.todayModel(S, c, { hour: 22, minute: 0 });
  assert.equal(late.nextSlot, null);
  assert.match(late.coach, /^Hôm nay em ăn hơi ít\./);
});

test("mô hình Hôm nay: hôm qua ăn ít hẳn → thẻ nhắc nhẹ, không phải thẻ khen", () => {
  const { S, c } = seededState("2026-11-20");
  const y = S.days["2026-11-19"];
  const tg = L.targetForDay(y, c.target);
  y.meals = [meal(Math.round(tg * 0.6))];
  assert.equal(L.dayStatus(y, tg), "ok");
  const m = M.todayModel(S, c, { hour: 8 });
  assert.equal(m.recap.tone, "calm");
  assert.match(m.recap.text, /^Hôm qua em ghi .* hơi ít so với mức/);
  y.meals = [meal(Math.round(tg * 0.9))];
  assert.equal(M.todayModel(S, c, { hour: 8 }).recap.tone, "good");
});

test("parseKcal: số nguyên, có thể kèm dấu ngăn hàng nghìn; dấu chấm/phẩy không bao giờ là dấu thập phân", () => {
  for (const [input, want] of [["0", 0], ["350", 350], [" 1200 ", 1200], ["1.200", 1200], ["1,200", 1200], ["12.000", 12000], ["1.234.567", 1234567], [480, 480]]) assert.equal(L.parseKcal(input), want, String(input));
  for (const bad of ["", " ", "1.5", "12,5", "1.20", "1,20", "1.2000", "abc", "-5", "1.200,5", "1 200.5", 1.5, -3, null, undefined, NaN]) assert.equal(L.parseKcal(bad), null, String(bad));
});

/* ------------------------------------------------------------------ *
 * Vòng sửa 2
 * ------------------------------------------------------------------ */
test("kiểm tra hồ sơ: mức kcal tự đặt đọc như số kcal — '1.500' là 1.500, '1.5' là gõ nhầm", () => {
  const form = { name: "Linh", sex: "f", birthYear: "1995", height: "158", weight: "60", goalWeight: "54", activity: 1.375, pace: 0.5 };
  const at = (customTarget) => L.validateProfile({ ...form, customTarget }, "2026-11-20");
  for (const [input, want] of [["1.500", 1500], ["1,500", 1500], ["1500", 1500], [" 1600 ", 1600], ["1000", 1000], ["1.000", 1000], ["5.000", 5000], ["5000", 5000], [1450, 1450], ["", null], ["   ", null], [null, null], [undefined, null]]) {
    const r = at(input);
    assert.equal(r.ok, true, String(input));
    assert.equal(r.value.customTarget, want, String(input));
  }
  for (const bad of ["1.5", "1,5", "1.50", "15.00", "1500,5", "1.500,5", "999", "5001", "5.001", "12.000", "abc", "-1500", "1500 kcal", 1450.5]) {
    const r = at(bad);
    assert.equal(r.ok, false, String(bad));
    assert.equal(r.errors.customTarget, "Mức tự đặt từ 1.000 đến 5.000 kcal, hoặc để trống.", String(bad));
  }
  // file sao lưu: mức tự đặt là một con số; chuỗi có dấu ngăn hàng nghìn (file sửa tay) cũng đọc được; số lẻ thì làm tròn như trước
  const restore = (customTarget) => L.cleanBackup({ app: "nhat-ky-calo", profile: { ...profile, customTarget } }, "2026-11-20").data.profile;
  assert.equal(restore(1600).customTarget, 1600);
  assert.equal(restore("1.600").customTarget, 1600);
  assert.equal(restore(1600.4).customTarget, 1600);
  assert.equal(restore(null).customTarget, null);
  assert.equal(restore(undefined).customTarget, null);
  assert.equal(restore(500), null); // ngoài khoảng 1.000–5.000: như trước, không nhận hồ sơ
});

test("kiểm tra hồ sơ: cân hiện tại đã dưới BMI 18,5 → một lời nhắc duy nhất, nói đúng lý do", () => {
  const UNDER = "Cân hiện tại đã ở mức thấp so với chiều cao, nên app không đặt mục tiêu giảm cân. Hãy hỏi bác sĩ hoặc chuyên gia dinh dưỡng.";
  const form = { name: "An", sex: "f", birthYear: "1995", height: "165", activity: 1.375, pace: 0.5, customTarget: "" };
  const at = (weight, goalWeight, opts) => L.validateProfile({ ...form, weight, goalWeight }, "2026-11-20", opts);
  // 165 cm: BMI 18,5 ≈ 50,37 kg. Trước đây 48/48 bị bảo "chọn từ 50,4 kg trở lên", rồi 48/50,4 lại bị bảo "phải thấp hơn cân hiện tại"
  for (const goal of ["48", "50,4", "47", "55", "", "abc", "20"]) {
    const r = at("48", goal);
    assert.equal(r.ok, false, goal);
    assert.deepEqual(r.errors, { goalWeight: UNDER }, goal);
  }
  assert.deepEqual(at("50", "50").errors, { goalWeight: UNDER });
  assert.deepEqual(at("50", "50,4").errors, { goalWeight: UNDER });
  // không có cân mong muốn nào lọt được khi cân hiện tại dưới ngưỡng — và luôn là cùng một câu
  for (let g = 30; g <= 250; g += 0.5) assert.equal(at("48", String(g).replace(".", ",")).errors.goalWeight, UNDER, String(g));
  // sát ngưỡng: so bằng BMI thật chứ không phải số đã làm tròn lên 0,1 kg → 50,37/50,37 (BMI 18,50) vẫn hợp lệ như trước
  assert.equal(at("50,4", "50,4").ok, true);
  assert.equal(at("50,37", "50,37").ok, true);
  assert.equal(at("50,36", "50,36").errors.goalWeight, UNDER);
  // cân hiện tại đủ: hai lời nhắc cũ về cân mong muốn không đổi
  assert.match(at("55", "45").errors.goalWeight, /^Mức này hơi thấp so với chiều cao\. Hãy chọn từ 50,4 kg trở lên\.$/);
  assert.equal(at("55", "60").errors.goalWeight, "Cân mong muốn cần bằng hoặc thấp hơn cân hiện tại.");
  assert.equal(at("55", "").errors.goalWeight, "Cân mong muốn từ 30 đến 250 kg.");
  // Cài đặt, KHÔNG đổi cân mong muốn (keepGoal): người đã xuống dưới ngưỡng vẫn lưu được hồ sơ; đổi đích thì gặp lời nhắc mới
  assert.equal(at("48", "52", { keepGoal: 52 }).ok, true);
  assert.equal(at("48", "51", { keepGoal: 52 }).errors.goalWeight, UNDER);
  // đích đang giữ tự nó cũng dưới ngưỡng (vừa sửa chiều cao…): vẫn một lời nhắc ấy, không chỉ tới con số cao hơn cân hiện tại
  assert.equal(at("48", "49", { keepGoal: 49 }).errors.goalWeight, UNDER);
  assert.equal(at("48", "45", { keepGoal: 45 }).errors.goalWeight, UNDER);
  // cân hiện tại đủ mà đích đang giữ dưới ngưỡng: lời nhắc cũ, kèm con số chọn được
  assert.match(at("55", "45", { keepGoal: 45 }).errors.goalWeight, /^Mức này hơi thấp so với chiều cao. Hãy chọn từ 50,4 kg trở lên.$/);
  // chiều cao hoặc cân hiện tại còn sai thì chưa kết luận gì về BMI của cân hiện tại
  assert.equal(L.validateProfile({ ...form, height: "", weight: "48", goalWeight: "48" }, "2026-11-20").errors.goalWeight, undefined);
  assert.notEqual(at("", "48").errors.goalWeight, UNDER);
  // file sao lưu: hồ sơ có đích dưới ngưỡng vẫn bị từ chối như trước, không nhận nhầm
  assert.equal(L.cleanBackup({ app: "nhat-ky-calo", profile: { ...profile, height: 165, startWeight: 48, goalWeight: 48 } }, "2026-11-20").data.profile, null);
  assert.equal(L.cleanBackup({ app: "nhat-ky-calo", profile: { ...profile, height: 165, startWeight: 48, goalWeight: 52 } }, "2026-11-20").data.profile.goalWeight, 52);
});

test("dọn khoá Claude: chữ đứng sau khoá không bị ghép vào khoá; chỉ nối lại khoá bị ngắt dòng", () => {
  const real = "sk-ant-api03-" + "Zq7_-x".repeat(15) + "wQAA"; // dài như khoá thật
  const short = "sk-ant-api03-" + "Ab1_-".repeat(8);
  assert.deepEqual([real.length, short.length], [107, 53]);
  const show = (text, k) => JSON.stringify(text.split(k).join("<K>"));
  for (const k of [real, short]) {
    // chữ nhắn đi kèm (cùng dòng hoặc dòng dưới), có dấu hay không dấu: chỉ lấy khoá
    for (const text of [`${k} nhé`, `${k} nha`, `${k} em`, `${k} ok`, `${k}\nCảm ơn anh`, `${k}\nThanks`, `${k}\r\nnha`, `${k}\n\nnha em`, `Khoá đây: ${k} nhé em`, `Khoá: ${k}`, `“${k}” nha`, `${k}, nha`, `${k}.\nThanks`, `${k}\n`, `\n ${k} \n`]) {
      assert.equal(L.tidyApiKey(text), k, show(text, k));
    }
    // khoá bị ngắt dòng ở ký tự thứ 20 hoặc 60 (LF, CRLF), kể cả khi quanh nó còn chữ và ngoặc
    for (const cut of [20, 60]) for (const br of ["\n", "\r\n", "\n  "]) {
      const wrapped = k.slice(0, cut) + br + k.slice(cut);
      assert.equal(L.tidyApiKey(wrapped), k, `cut ${cut} ${JSON.stringify(br)}`);
      assert.equal(L.tidyApiKey(`Khoá của em:\n"${wrapped}"\nnha`), k, `cut ${cut} ${JSON.stringify(br)} + chữ`);
      // dán bằng tay vào ô một dòng: Chrome đổi dấu xuống dòng thành dấu cách
      assert.equal(L.tidyApiKey(k.slice(0, cut) + " " + k.slice(cut)), k, `cut ${cut} dấu cách`);
      assert.equal(L.tidyApiKey(`Khoá: ${k.slice(0, cut)} ${k.slice(cut)} nha em`), k, `cut ${cut} dấu cách + chữ`);
    }
    // ký tự vô hình (zero-width) dính theo khi chép từ trang web
    const zw = String.fromCharCode(0x200b);
    assert.equal(L.tidyApiKey(k + zw), k);
    assert.equal(L.tidyApiKey(zw + k.slice(0, 30) + zw + k.slice(30) + zw + " nha"), k);
    // chữ có dấu dính LIỀN sau khoá (không còn khoảng trắng để tách): không đoán — kết quả không mang hình thức khoá, để ô khoá hiện lời nhắc
    assert.equal(L.looksLikeApiKey(L.tidyApiKey(k + "Cảm ơn anh")), false);
  }
  // khoá đã đủ dài thì không nối thêm gì, dù dòng dưới trông giống ký tự của khoá
  for (const tail of ["\nclaude-opus-5-5", "\nThankyouverymuch", " password123", "\n" + short, " " + real]) assert.equal(L.tidyApiKey(real + tail), real, JSON.stringify(tail));
  // hai mảnh đầu chưa đủ hình thức khoá thì mảnh ngắn ở dòng dưới vẫn được nối (khoá ngắt dòng rất sớm)
  assert.equal(L.tidyApiKey("sk-ant-\napi03-\n" + real.slice(13)), real);
});

test("dọn khoá Claude: lời nhắn nhắc tới tiền tố sk-ant-, ký hiệu dính quanh khoá, khoá chuẩn bị ngắt dòng ở cột bất kỳ", () => {
  const std = "sk-ant-api03-" + "Zq7_-x".repeat(15) + "wQ9AA"; // đúng chuẩn hiện nay: 13 + 93 + "AA"
  const real = "sk-ant-api03-" + "Zq7_-x".repeat(15) + "wQAA"; // 107 ký tự: không chuẩn
  const short = "sk-ant-api03-" + "Ab1_-".repeat(8);
  assert.deepEqual([std.length, real.length, short.length], [108, 107, 53]);
  const show = (text, k) => JSON.stringify(text.split(k).join("<K>"));
  for (const k of [std, real, short]) {
    // lời nhắn nhắc tới tiền tố "sk-ant-" trước khi tới khoá thật: không được ghép tiền tố đó với khoá
    for (const text of [`Khoá Claude (bắt đầu bằng sk-ant-): ${k}`, `Khoá của em, bắt đầu bằng sk-ant-\n${k}`, `Khoá của em, bắt đầu bằng sk-ant- ${k}`, `sk-ant- là đầu khoá nhé: ${k}`, `Khoá dạng sk-ant-api03-… đây: ${k} nha`, `sk-ant-: "${k}"`, `sk-ant-\n\n${k}\nnha`]) {
      assert.equal(L.tidyApiKey(text), k, show(text, k));
    }
    // ký hiệu dính liền quanh khoá (chữ đậm của markdown, ngoặc nhọn, JSON, dấu ba chấm…): vẫn lấy được khoá
    for (const text of [`**${k}**`, `{${k}}`, `${k}/`, `${k}…`, `${k}*`, `{"apiKey":"${k}"}`, `<${k}>`, `=${k}`, `~~${k}~~ nha`, `Khoá: *${k}*.`, `“${k}”…`, `${k}。`]) {
      assert.equal(L.tidyApiKey(text), k, show(text, k));
    }
    // ký hiệu rồi chữ dính LIỀN sau khoá, không có khoảng trắng: không đoán — kết quả không mang hình thức khoá, ô khoá hiện lời nhắc
    for (const text of [`${k}","model":"x"`, `${k}.Cảm ơn`, `${k}**nhé`]) assert.equal(L.looksLikeApiKey(L.tidyApiKey(text)), false, show(text, k));
  }
  // hai khoá trong một lời nhắn: lấy khoá đầu, không dính khoá sau vào
  assert.equal(L.tidyApiKey(short + " " + std), short);
  assert.equal(L.tidyApiKey(short + "\n" + real), short);
  assert.equal(L.tidyApiKey(`cũ: ${std}\nmới: ${real}`), std);
  // khoá chuẩn bị ngắt dòng cứng ở cột bất kỳ (xuống dòng, hoặc dấu cách sau khi dán vào ô một dòng): ghép lại trọn vẹn,
  // kể cả khi mảnh cuối rất ngắn hoặc bắt đầu sau ký tự thứ 90
  for (let w = 8; w < std.length; w++) {
    const pieces = [];
    for (let i = 0; i < std.length; i += w) pieces.push(std.slice(i, i + w));
    for (const br of ["\n", "\r\n", " ", "\n  "]) {
      assert.equal(L.tidyApiKey(pieces.join(br)), std, `cột ${w} ${JSON.stringify(br)}`);
      assert.equal(L.tidyApiKey(`Khoá của em: “${pieces.join(br)}”${br}nha em`), std, `cột ${w} ${JSON.stringify(br)} + chữ`);
    }
  }
  // khoá chuẩn đã trọn vẹn: không nối thêm gì nữa
  for (const tail of ["\nAA", " A", " nha", "\nclaude-opus-5-5", " abcdefgh", "\n" + std]) assert.equal(L.tidyApiKey(std + tail), std, JSON.stringify(tail));
  // khoá không chuẩn, chỉ thiếu một ký tự là đủ 108: chữ, ký hiệu đứng sau vẫn không bị ghép vào
  for (const tail of [" - anh gui", " <3", " 3", "\nx", " a", " :)", "\n-"]) assert.equal(L.tidyApiKey(real + tail), real, JSON.stringify(tail));
  // giới hạn đã biết: khoá KHÔNG chuẩn bị ngắt sau ký tự thứ 90 thì thiếu đuôi (không biết khoá dài bao nhiêu) — nhưng không bao giờ sai ký tự
  assert.equal(L.tidyApiKey(real.slice(0, 100) + "\n" + real.slice(100)), real.slice(0, 100));
  // chuỗi dán vào rất dài, đầy chữ "sk-ant-": vẫn trả lời ngay
  const t0 = Date.now();
  assert.equal(L.tidyApiKey("sk-ant- ".repeat(50000)).length, 300);
  assert.ok(Date.now() - t0 < 2000);
});

test("làm sạch bữa ăn: mã lỗi đi theo file sao lưu chỉ là các mã dứt khoát — không mã nào khiến app tự gọi Claude lại", () => {
  const failedOf = (failed) => L.cleanMeal({ id: "x", t: "12:10", items: [], hint: "1 tô phở", src: "text", pending: true, failed }).failed;
  // mã kiểu mạng: state.resumePending sẽ tự tính lại những bữa này ở hôm nay/hôm qua → sau khi khôi phục phải là "đã dừng"
  for (const code of ["network", "timeout", "offline", "server", "rate", "sdk"]) assert.equal(failedOf(code), "aborted", code);
  // chuỗi lạ, kể cả tên thuộc tính có sẵn của mọi object (bảng tra câu báo lỗi là object thường)
  for (const junk of ["constructor", "__proto__", "toString", "hasOwnProperty", "valueOf", "prototype", "xyz", "NOT_FOOD", " not_food", "not_food ", "", 0, 1, null, undefined, true, {}, ["not_food"]]) assert.equal(failedOf(junk), "aborted", String(junk));
  // các mã dứt khoát của app: giữ nguyên, để bữa hiện đúng lý do
  const kept = ["not_food", "refused", "photo", "too_large", "bad_request", "bad_output", "truncated", "bad_key", "billing", "spend_cap", "model", "forbidden", "no_key", "api", "unknown", "aborted"];
  for (const code of kept) assert.equal(failedOf(code), code, code);
  // bữa đang chờ lúc xuất file vẫn thành "đã dừng"
  const pend = L.cleanMeal({ id: "p", t: "07:30", items: [], ph: "ph-1", src: "photo", pending: true });
  assert.equal(pend.failed, "aborted");
  assert.equal("pending" in pend, false);
  // qua cleanBackup: sau khi khôi phục không còn bữa nào mang mã kiểu mạng hay mã lạ
  const days = { "2026-11-20": { meals: ["network", "timeout", "constructor", "not_food", "bad_key"].map((failed, i) => ({ id: "m" + i, t: "08:0" + i, type: "sang", name: "Bữa " + i, items: [], hint: "món " + i, src: "text", failed })) } };
  const back = L.cleanBackup({ app: "nhat-ky-calo", profile, days }, "2026-11-20").data;
  assert.deepEqual(back.days["2026-11-20"].meals.map((m) => m.failed), ["aborted", "aborted", "aborted", "not_food", "bad_key"]);
  assert.deepEqual(back.days["2026-11-20"].meals.map((m) => m.hint), ["món 0", "món 1", "món 2", "món 3", "món 4"]); // lời mô tả còn nguyên để bấm "Thử lại"
});

test("bữa ghi bù vào ngày đã qua không mang giờ: giờ rỗng sống sót qua sao lưu rồi khôi phục", () => {
  const it = [{ n: "Chè đậu đen", k: 250 }];
  const m = L.cleanMeal({ id: "a1", t: "", type: "toi", name: "Chè đậu đen", items: it, src: "manual" });
  assert.deepEqual([m.t, m.type, m.name], ["", "toi", "Chè đậu đen"]);
  // chỉ đúng chuỗi rỗng mới là "không có giờ"; thiếu giờ hoặc giờ sai vẫn về 12:00 như cũ
  for (const bad of [undefined, null, " ", "  ", 0, false, [], "99:99"]) assert.equal(L.cleanMeal({ t: bad, items: it }).t, "12:00", JSON.stringify(bad));
  assert.equal(L.cleanMeal({ items: it }).t, "12:00");
  // không có loại bữa: bữa không giờ là "ăn vặt", không đoán theo đồng hồ
  assert.equal(L.cleanMeal({ t: "", items: it }).type, "vat");
  // bữa chưa tính xong cũng giữ giờ rỗng
  const pend = L.cleanMeal({ id: "p", t: "", type: "trua", items: [], hint: "1 tô phở", src: "text", pending: true });
  assert.deepEqual([pend.t, pend.type, pend.failed], ["", "trua", "aborted"]);

  // sao lưu → khôi phục → sao lưu → khôi phục: giờ rỗng và thứ tự trong ngày (bữa không giờ đứng sau) không đổi
  const day = { meals: [meal(400, { id: "s", t: "07:15", type: "sang" }), meal(500, { id: "t", t: "19:05", type: "toi" }), meal(250, { id: "u", t: "", type: "trua", name: "Chè đậu đen" }), meal(90, { id: "v", t: "", type: "vat", name: "Chuối" })] };
  const file = JSON.stringify({ app: "nhat-ky-calo", profile, days: { "2026-11-19": day } });
  const once = L.cleanBackup(JSON.parse(file), "2026-11-20").data;
  assert.deepEqual(once.days["2026-11-19"].meals.map((x) => [x.id, x.t, x.type]), [["s", "07:15", "sang"], ["t", "19:05", "toi"], ["u", "", "trua"], ["v", "", "vat"]]);
  const twice = L.cleanBackup(JSON.parse(JSON.stringify({ app: "nhat-ky-calo", profile, days: once.days })), "2026-11-20").data;
  assert.deepEqual(twice.days, once.days);

  // các phép tính và mô hình hiển thị không vấp vì giờ rỗng
  const days = once.days;
  assert.equal(L.dayTotals(days["2026-11-19"]).kcal, 1240);
  assert.equal(L.dayStatus(days["2026-11-19"], 1470), "ok");
  assert.equal(L.journeyStats(days, { todayKey: "2026-11-20", target: 1470, tdee: 1750, waterGoal: 8 }).totalMeals, 4);
  const S = { profile, settings: L.cleanSettings({}), meta: { earned: {}, seen: {} }, favs: [], days, today: "2026-11-20", viewDay: "2026-11-19", mode: "idb" };
  const c = { todayKey: "2026-11-20", weight: 60, target: 1470, tdee: 1750, mode: "lose", floored: false, waterGoal: 8 };
  const tm = M.todayModel(S, c, { hour: 8 });
  assert.deepEqual(tm.groups.find((g) => g.id === "trua").meals.map((x) => [x.name, x.t, x.kcal]), [["Chè đậu đen", "", 250]]);
  assert.deepEqual(tm.groups.find((g) => g.id === "vat").meals.map((x) => [x.name, x.t]), [["Chuối", ""]]);
  assert.equal(tm.kcal.eaten, 1240);
  assert.equal(M.todayModel({ ...S, viewDay: "2026-11-20" }, c, { hour: 8 }).recap.key, "2026-11-19");
  assert.equal(L.mealTypeAt("", "snack"), "vat");
});

test("món hay ăn: bữa không có giờ tính là bữa sau cùng của ngày đó", () => {
  const m = (name, kcal, t) => ({ ...meal(kcal), name, t });
  // hai món cùng 2 lần, lần gần nhất cùng ngày: "Chè" ghi bù (không giờ) đứng sau "Phở bò" 19:00 trong ngày → là món gần đây hơn
  const days = {
    "2026-11-18": { meals: [m("Phở bò", 450, "07:00"), m("Chè", 240, "08:00")] },
    "2026-11-19": { meals: [m("Phở bò", 460, "19:00"), m("Chè", 250, "")] },
  };
  const f = L.frequentMeals(days, "2026-11-20");
  assert.deepEqual(f.map((x) => [x.name, x.kcal, x.count]), [["Chè", 250, 2], ["Phở bò", 460, 2]]);
});

test("gợi ý bữa ăn: vừa với số kcal còn lại, đúng bữa, không lặp món đã ăn, đổi món thì ra món khác", async () => {
  const { DISHES } = await import("../js/dishes.js");
  // danh sách món: đủ trường, số hợp lý, năng lượng từ đạm/bột/béo khớp kcal trong khoảng 20%
  for (const d of DISHES) {
    assert.ok(d.n && d.q && d.slots.length, d.n);
    assert.ok(d.k >= 30 && d.k <= 800, d.n);
    const fromMacros = d.p * 4 + d.c * 4 + d.f * 9;
    assert.ok(Math.abs(fromMacros - d.k) <= Math.max(25, d.k * 0.2), `${d.n}: ${fromMacros} so với ${d.k}`);
  }
  assert.equal(new Set(DISHES.map((d) => L.normName(d.n))).size, DISHES.length);
  const ask = (o) => L.suggestMeals({ dishes: DISHES, seed: "2026-11-21", ...o });
  // buổi trưa, còn 1.000 kcal cho trưa + tối: phần của bữa trưa là 4/7
  const lunch = ask({ slot: "trua", openSlots: ["trua", "toi"], left: 1000 });
  assert.equal(lunch.slot, "trua");
  assert.equal(lunch.budget, 571);
  assert.equal(lunch.items.length, 3);
  for (const x of lunch.items) { assert.ok(x.kcal <= 571 * 1.08 && x.kcal >= 571 * 0.55, x.name); assert.ok(DISHES.find((d) => d.n === x.name).slots.includes("trua")); }
  // chỉ còn bữa tối: được dùng hết phần còn lại, không món nào vượt
  const dinner = ask({ slot: "toi", openSlots: ["toi"], left: 380 });
  assert.equal(dinner.budget, 380);
  for (const x of dinner.items) assert.ok(x.kcal <= 380 * 1.08, x.name);
  // còn quá ít cho một bữa chính → chuyển sang món nhẹ; gần chạm mục tiêu → không mời ăn thêm
  const tiny = ask({ slot: "toi", openSlots: ["toi"], left: 120 });
  assert.equal(tiny.slot, "vat");
  for (const x of tiny.items) assert.ok(x.kcal <= 126, x.name);
  assert.equal(ask({ slot: "toi", openSlots: ["toi"], left: 30 }), null);
  assert.equal(ask({ slot: null, left: -200 }), null);
  // hết bữa chính: món nhẹ, tối đa 300 kcal
  const snack = ask({ slot: null, left: 900 });
  assert.equal(snack.slot, "vat");
  assert.equal(snack.budget, 300);
  // không gợi ý lại món đã ăn hôm nay; cùng đầu vào thì cùng kết quả; "Đổi món" ra món khác
  const first = lunch.items[0].name;
  assert.ok(!ask({ slot: "trua", openSlots: ["trua", "toi"], left: 1000, eaten: [first.toUpperCase()] }).items.some((x) => x.name === first));
  assert.deepEqual(ask({ slot: "trua", openSlots: ["trua", "toi"], left: 1000 }), lunch);
  const next = ask({ slot: "trua", openSlots: ["trua", "toi"], left: 1000, offset: 1 });
  assert.ok(lunch.more && next.items.every((x) => !lunch.items.some((y) => y.name === x.name)));
  // món hay ăn của chính người dùng mà vừa tầm thì đứng đầu, ghi lại đúng các món của nó
  const own = [{ name: "Cơm nhà", kcal: 520, items: [{ n: "Cơm", k: 260 }, { n: "Cá kho", k: 260 }] }, { name: "Trà sữa", kcal: 900, items: [{ n: "Trà sữa", k: 900 }] }];
  const mine = ask({ slot: "trua", openSlots: ["trua", "toi"], left: 1000, own });
  assert.equal(mine.items[0].name, "Cơm nhà");
  assert.equal(mine.items[0].own, true);
  assert.equal(mine.items[0].items.length, 2);
  assert.ok(!mine.items.some((x) => x.name === "Trà sữa"));
  // thiếu đạm: lượt gợi ý nhiều đạm hơn lượt thường
  const share = (r) => r.items.reduce((a, x) => a + (x.items[0].p * 4) / x.kcal, 0);
  assert.ok(share(ask({ slot: "toi", openSlots: ["toi"], left: 450, lowProtein: true })) >= share(ask({ slot: "toi", openSlots: ["toi"], left: 450 })));
});

test("mô hình Hôm nay: có gợi ý khi còn kcal, không có khi xem ngày cũ hoặc đã vượt mục tiêu", () => {
  const { S, c } = seededState("2026-11-20");
  const m = M.todayModel(S, c, { hour: 12 });
  assert.ok(m.suggest && m.suggest.items.length > 0);
  const names = (S.days[S.today]?.meals || []).map((x) => L.normName(x.name));
  assert.ok(m.suggest.items.every((x) => !names.includes(L.normName(x.name))));
  S.days[S.today] = { meals: [meal(c.target + 600)] };
  assert.equal(M.todayModel(S, c, { hour: 12 }).suggest, null);
  S.viewDay = "2026-11-19";
  assert.equal(M.todayModel(S, c, { hour: 12 }).suggest, null);
});

test("thói quen và bản tóm tắt gửi Claude: đúng số, không lộ tên, lời nhận xét đi theo sao lưu", () => {
  const { S, c } = seededState("2026-11-20");
  const h = L.eatingHabits(S.days, S.today, c.target);
  assert.ok(h.days >= 20 && h.avgKcal > 800 && h.avgKcal < 2500);
  assert.equal(h.share.p + h.share.c + h.share.f >= 98 && h.share.p + h.share.c + h.share.f <= 102, true);
  assert.ok(h.top.length > 0 && h.top.every((d) => d.count >= 2 && d.kcal > 0));
  assert.ok(h.top[0].count >= h.top[h.top.length - 1].count);
  // ngày đang xét không tính vào thói quen; nhật ký trống thì không có thói quen
  assert.equal(L.eatingHabits({ [S.today]: S.days[S.today] }, S.today, c.target), null);
  assert.equal(L.eatingHabits({}, S.today, c.target), null);

  const text = L.daySummary({ days: S.days, key: S.today, todayKey: S.today, target: c.target, you: "em", hour: 20, waterGoal: 8 });
  assert.match(text, /^Xưng hô: em\n/);
  assert.match(text, new RegExp(`Mục tiêu trong ngày: ${c.target} kcal`));
  assert.match(text, /hôm nay, bây giờ khoảng 20 giờ/);
  assert.match(text, /Thói quen \d+ ngày có ghi gần đây/);
  assert.match(text, /Món hay lặp lại: /);
  for (const m of S.days[S.today].meals) assert.ok(text.includes(m.name), m.name);
  assert.ok(!text.includes(S.profile.name), "không gửi tên người dùng");
  assert.ok(text.length < 6000);
  assert.match(L.daySummary({ days: S.days, key: "2026-11-19", todayKey: S.today, target: c.target }), /\(đã qua\)/);
  assert.match(L.daySummary({ days: { [S.today]: S.days[S.today] }, key: S.today, todayKey: S.today, target: c.target }), /Chưa đủ dữ liệu các ngày trước/);

  assert.equal(L.mealContext({ target: 1440, eatenBefore: 380, type: "trua" }), "mục tiêu cả ngày khoảng 1440 kcal; trước bữa này đã ghi 380 kcal; đây là bữa trưa.");
  assert.match(L.mealContext({ target: 1440, eatenBefore: 0, type: "toi", hasTime: false }), /bữa đầu tiên được ghi trong ngày\.$/);

  // dấu vết của ngày đổi khi bữa đổi; lời nhận xét và lời khuyên từng bữa qua được bộ lọc sao lưu, rác thì bị bỏ
  const day = { meals: [{ ...meal(400), advice: "  Thêm một đĩa rau luộc là đẹp.  " }], rv: { c: "Ngày ổn.", a: "Thêm rau.", t: [{ m: "sang", d: "Phở gà", k: 400, w: "nhẹ bụng" }, { m: "khuya", d: "x", k: 1 }, { m: "toi", d: "", k: 300 }], sig: "1:400", on: "2026-11-20", junk: 1 } };
  const clean = L.cleanDay(day);
  assert.equal(clean.meals[0].advice, "Thêm một đĩa rau luộc là đẹp.");
  assert.deepEqual(clean.rv, { c: "Ngày ổn.", a: "Thêm rau.", t: [{ m: "sang", d: "Phở gà", k: 400, w: "nhẹ bụng" }], sig: "1:400", on: "2026-11-20" });
  assert.equal(L.reviewSig(clean), "1:400");
  assert.equal(L.cleanDay({ meals: [meal(400)], rv: { c: {} } }).rv, undefined);
  assert.equal(L.cleanDay({ meals: [meal(400)], rv: "x" }).rv, undefined);
  const m = M.todayModel(S, c, { hour: 12 });
  assert.equal(m.review.has, false);
  S.days[S.today].rv = { c: "Ổn.", a: "", t: [], sig: L.reviewSig(S.days[S.today]), on: S.today };
  assert.equal(M.todayModel(S, c, { hour: 12 }).review.stale, false);
  S.days[S.today].meals.push(meal(100));
  assert.equal(M.todayModel(S, c, { hour: 12 }).review.stale, true);
});

test("gợi ý bữa ăn: phần kcal của bữa nhỏ vẫn có đủ món và còn món khác để đổi", async () => {
  const { DISHES } = await import("../js/dishes.js");
  const cases = [["sang", ["sang", "trua", "toi"]], ["trua", ["trua", "toi"]], ["toi", ["toi"]], [null, []]];
  for (const [slot, openSlots] of cases) {
    for (let left = 80; left <= 1600; left += 20) {
      const r = L.suggestMeals({ dishes: DISHES, slot, openSlots, left, seed: "2026-11-22" });
      assert.ok(r && r.items.length === 3 && r.more, `${slot} còn ${left} kcal: ${r ? r.items.length + " món, more=" + r.more : "không có gợi ý"}`);
      for (const x of r.items) assert.ok(x.kcal <= Math.max(r.budget * 1.08, 1), `${slot} ${left}: ${x.name} ${x.kcal} > ${r.budget}`);
    }
  }
});

test("hộp quà: quà theo kg và theo ngày đạt, chỉ mở khi đã tới mốc và đã bấm mở", () => {
  const profile = { startWeight: 60, goalWeight: 54 };
  const rewards = L.cleanSettings({ rewards: [{ days: 7, text: "Xem phim" }, { kg: 2, text: "Spa" }, { kg: 6, text: "Du lịch" }, { days: "30", text: "Váy mới" }, { days: 7, text: "Trà sữa" }, { days: 400, text: "x" }, { kg: 0, text: "y" }, { days: 3, text: "" }] }).rewards;
  assert.deepEqual(rewards.map((r) => (r.days ? "d" + r.days : "kg" + r.kg)), ["kg2", "kg6", "d7", "d7", "d30"]);
  // quà theo ngày không làm đổi các mốc cân nặng
  assert.deepEqual(L.milestones(profile, rewards).filter((m) => m.reward).map((m) => m.kg), [2, 6]);
  const list = (prog, seen) => L.giftList(profile, rewards, prog, seen);
  let g = list({ bestLost: 0, okDays: 0 }, {});
  assert.deepEqual(g.map((x) => x.id), ["kg:2", "kg:6", "d:7", "d:30"]);
  assert.ok(g.every((x) => !x.reached && !x.opened));
  assert.equal(g[2].text, "Xem phim · Trà sữa");
  assert.equal(g[2].left, 7);
  assert.equal(g[1].isGoal, true);
  // tới mốc: chờ mở; chưa bấm thì chưa mở
  g = list({ bestLost: 2.4, okDays: 9 }, {});
  assert.deepEqual(g.map((x) => [x.reached, x.opened]), [[true, false], [false, false], [true, false], [false, false]]);
  assert.equal(g[3].left, 21);
  // đã bấm mở
  g = list({ bestLost: 2.4, okDays: 9 }, { "gift:kg:2": "2026-11-20", "gift:d:30": "2026-11-20" });
  assert.equal(g[0].opened, true);
  assert.equal(g[2].opened, false);
  assert.equal(g[3].opened, false, "dấu đã mở không có nghĩa khi chưa tới mốc");
  assert.deepEqual(L.giftList(profile, [], { bestLost: 9, okDays: 99 }, {}), []);
});

/* ---------------- vận động ---------------- */
const EX = [{ id: "di-bo-nhanh", n: "Đi bộ nhanh", met: 4.3 }, { id: "dap-xe", n: "Đạp xe thong thả", met: 4 }, { id: "nhay", n: "Nhảy", met: 5 }, { id: "yoga", n: "Yoga", met: 2.5 }, { id: "tai-nha", n: "Tập tại nhà", met: 3.8 }, { id: "viec-nha", n: "Việc nhà", met: 3.3 }];
test("vận động: kcal đốt = MET × kg × giờ", () => {
  assert.equal(L.burnKcal(4.3, 60, 30), 129);
  assert.equal(L.burnKcal(4.3, 60, 0), 0);
  assert.equal(L.burnKcal("x", 60, 30), 0);
});
test("vận động: ngày chỉ có buổi tập vẫn được giữ, nhưng không tính là ngày có ghi bữa", () => {
  const d = L.cleanDay({ meals: [], ex: [{ id: "a1", a: "yoga", n: "Yoga", min: 30, k: 75 }, { id: "a1", a: "<x>", n: "Lạ", min: 20, k: 99999 }, { n: "", min: 5 }, { n: "Quá dài", min: 9000 }] });
  assert.equal(d.ex.length, 2);
  assert.notEqual(d.ex[0].id, d.ex[1].id);
  assert.equal(d.ex[1].a, "khac");
  assert.equal(d.ex[1].k, 5000);
  assert.equal(L.hasLog(d), false);
  assert.deepEqual(L.dayBurn(d), { count: 2, min: 50, kcal: 5075 });
  assert.equal(L.cleanDay({ meals: [], ex: [{ n: "", min: 5 }] }), null);
  assert.equal(L.dayStatus(d, 1500), "none");
});
test("vận động: không làm đổi số kcal đã ăn, mục tiêu hay ngày đạt", () => {
  const plain = dayOf(700, 700), withEx = { ...dayOf(700, 700), ex: [{ id: "e", a: "chay", n: "Chạy", min: 60, k: 600 }] };
  assert.deepEqual(L.dayTotals(withEx), L.dayTotals(plain));
  assert.equal(L.dayStatus(withEx, 1500), L.dayStatus(plain, 1500));
  const ctx = { todayKey: "2026-11-10", target: 1500, tdee: 1900, waterGoal: 0 };
  const a = L.journeyStats({ "2026-11-09": plain }, ctx), b = L.journeyStats({ "2026-11-09": withEx }, ctx);
  assert.equal(a.bank, b.bank);
  assert.equal(a.okDays, b.okDays);
});
test("vận động: gợi ý bù phần vượt, và gợi ý vừa sức khi không vượt", () => {
  const burn = L.moveIdeas({ exercises: EX, kg: 60, over: 200, burned: 0, seed: "2026-11-10" });
  assert.equal(burn.mode, "burn");
  assert.equal(burn.need, 200);
  assert.equal(burn.items.length, 3);
  for (const x of burn.items) { assert.ok(x.min % 5 === 0 && x.min >= 10 && x.min <= 60); assert.ok(x.kcal >= 200 || burn.partial); }
  const big = L.moveIdeas({ exercises: EX, kg: 60, over: 900, burned: 0, seed: "s" });
  assert.equal(big.partial, true);
  assert.ok(big.items.every((x) => x.min === 60));
  const done = L.moveIdeas({ exercises: EX, kg: 60, over: 200, burned: 190, seed: "s" });
  assert.equal(done.mode, "move");
  assert.deepEqual(L.moveIdeas({ exercises: EX, kg: 60, seed: "a" }), L.moveIdeas({ exercises: EX, kg: 60, seed: "a" }));
  assert.equal(L.moveIdeas({ exercises: [], kg: 60 }), null);
});
test("vận động: tuần này, tổng cộng, dấu nhận xét và bản tóm tắt gửi Claude", () => {
  const days = {
    "2026-11-09": { ...dayOf(500), ex: [{ id: "a", a: "yoga", n: "Yoga", min: 30, k: 75 }] },
    "2026-11-11": { meals: [], ex: [{ id: "b", a: "nhay", n: "Nhảy", min: 20, k: 100 }, { id: "c", a: "nhay", n: "Nhảy", min: 10, k: 50 }] },
    "2026-11-01": { meals: [], ex: [{ id: "d", a: "yoga", n: "Yoga", min: 40, k: 100 }] },
  };
  const w = L.exerciseWeek(days, "2026-11-11");
  assert.equal(w.sessions, 3);
  assert.equal(w.min, 60);
  assert.equal(w.kcal, 225);
  assert.equal(w.activeDays, 2);
  assert.deepEqual(L.exerciseTotals(days), { sessions: 4, min: 100, kcal: 325, days: 3 });
  assert.equal(L.reviewSig(dayOf(500)), "1:500");
  assert.equal(L.reviewSig(days["2026-11-09"]), "1:500:1x75");
  const s = L.daySummary({ days, key: "2026-11-09", todayKey: "2026-11-11", target: 1500 });
  assert.match(s, /Vận động: Yoga 30 phút \(khoảng 75 kcal\)/);
  assert.match(s, /không cộng vào mục tiêu ăn/);
  assert.match(L.daySummary({ days: { "2026-11-12": dayOf(500), ...days }, key: "2026-11-12", todayKey: "2026-11-12", target: 1500 }), /Vận động: chưa ghi buổi nào\.\nBảy ngày trước đó: 2 ngày có vận động, tổng 60 phút\./);
});
