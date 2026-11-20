// words.js — mọi câu chữ "biết nói" của app: lời chào, lời động viên, lời chúc mừng.
// Giọng điệu: ấm áp, không trách móc. `you` là cách xưng hô chọn trong Cài đặt ("bạn", "em", "chị", "mình").

import { fmtInt, fmt1, OVER_TOLERANCE, LOW_SHARE } from "./logic.js";

export const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Chọn một phần tử ổn định theo "hạt giống" (ví dụ ngày) để câu chữ không nhảy lung tung mỗi lần vẽ lại. */
export function pick(list, seed) {
  let h = 2166136261;
  for (const ch of String(seed)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  return list[(h >>> 0) % list.length];
}

export function greeting(hour, name) {
  const part = hour >= 5 && hour < 10 ? "Chào buổi sáng" : hour >= 10 && hour < 13 ? "Chào buổi trưa" : hour >= 13 && hour < 18 ? "Chào buổi chiều" : hour >= 18 && hour < 22 ? "Chào buổi tối" : "Khuya rồi";
  return name ? `${part}, ${name}` : part;
}

/**
 * Câu động viên dưới vòng calo của HÔM NAY.
 * s: { eaten, target, count, hour, streak, hasLunch, hasDinner, you, seed }
 */
export function coachToday(s) {
  const you = s.you || "bạn";
  const left = s.target - s.eaten;
  if (!s.count) {
    if (s.streak > 0) return `Chuỗi ${s.streak} ngày đang chờ ${you}. Chụp bữa đầu tiên của hôm nay nhé.`;
    return "Chụp bữa đầu tiên của hôm nay để bắt đầu nhé.";
  }
  if (s.eaten > s.target * OVER_TOLERANCE) {
    const over = fmtInt(s.eaten - s.target);
    return pick([
      `Hôm nay vượt ${over} kcal. Không sao cả, một ngày không quyết định cả chặng đường.`,
      `Hôm nay vượt ${over} kcal. Ngày mai mình ghi tiếp là được.`,
      `Vượt ${over} kcal rồi. Ghi lại trung thực như thế này đã là giỏi.`,
    ], s.seed);
  }
  if (left <= 0) return "Vừa chạm mục tiêu. Dừng ở đây là đẹp rồi.";
  if (left <= s.target * 0.1) return `Còn ${fmtInt(left)} kcal. Vừa khít, một ngày rất đẹp.`;
  if (s.hour >= 20) {
    // dưới 80% mục tiêu thì không khen: hoặc còn bữa chưa ghi, hoặc ăn chưa đủ
    if (s.eaten >= s.target * LOW_SHARE) return `Sắp hết ngày mà ${you} vẫn trong mục tiêu. Tuyệt lắm.`;
    // "ăn hơi ít" chỉ nói khi bữa tối đã ghi, hoặc đã quá giờ ô mời chụp bữa tối còn mở (22 giờ, xem models.js).
    // Trước đó, sáng + trưa thường mới được 55–70% mục tiêu: chưa ghi bữa tối thì nói tiếp phần còn lại cho bữa tối như ban ngày.
    if (s.hasDinner || s.hour >= 22) return `Hôm nay ${you} ăn hơi ít. Còn bữa nào chưa ghi thì ghi nốt nhé, và nhớ ăn đủ.`;
  }
  const size = left >= 600 ? "Thoải mái cho một bữa đầy đủ." : left >= 350 ? "Một bữa vừa phải là đẹp." : "Một bữa nhẹ là vừa.";
  if (s.hasDinner) return `Còn ${fmtInt(left)} kcal cho phần còn lại của ngày.`;
  if (s.hasLunch || s.hour >= 14) return `Còn ${fmtInt(left)} kcal cho bữa tối. ${size}`;
  if (s.hour >= 10) return `Còn ${fmtInt(left)} kcal cho bữa trưa và bữa tối.`;
  return `Còn ${fmtInt(left)} kcal cho cả ngày hôm nay.`;
}

/** Câu tóm tắt khi xem lại một ngày đã qua. */
export function coachPast(status, kcal, target) {
  if (status === "ok") return "Ngày này đạt mục tiêu.";
  if (status === "over") return `Ngày này vượt ${fmtInt(kcal - target)} kcal.`;
  if (status === "partial") return "Ngày này ghi chưa đủ bữa nên chưa tính vào chặng đường.";
  return "Ngày này chưa ghi bữa nào.";
}

/** Lời nhắc buổi sáng về ngày hôm qua; null nếu không có gì để nói. */
export function recapYesterday(status, kcal, target, you = "bạn") {
  // "đạt" nhưng ít hẳn so với mức (dưới 80%): không khen, chỉ nhắc nhẹ — thường là còn bữa chưa ghi, hoặc ăn chưa đủ
  if (status === "ok" && kcal < target * LOW_SHARE)
    return { tone: "calm", text: `Hôm qua ${you} ghi ${fmtInt(kcal)} kcal, hơi ít so với mức ${fmtInt(target)}. Còn bữa nào chưa ghi thì ghi bù nhé, và hôm nay nhớ ăn đủ bữa.` };
  if (status === "ok") return { tone: "good", text: `Hôm qua ${you} ăn ${fmtInt(kcal)} kcal, đạt mục tiêu. Cây hoa được tưới thêm một ngày.` };
  if (status === "over") return { tone: "calm", text: `Hôm qua vượt ${fmtInt(kcal - target)} kcal. Hôm nay là một ngày mới.` };
  if (status === "partial") return { tone: "calm", text: "Hôm qua ghi chưa đủ bữa nên chưa tính vào chặng đường." };
  return null;
}

export const CONFIDENCE = { high: "Khá chắc", medium: "Tương đối", low: "Chưa chắc lắm" };

/** Dòng "sau bữa này…" trong màn kết quả. */
export function afterMeal(leftBefore, mealKcal, target) {
  const after = leftBefore - mealKcal;
  if (after >= 0) {
    if (after <= target * 0.1) return { tone: "good", text: `Sau bữa này còn ${fmtInt(after)} kcal, vừa đẹp.` };
    return { tone: "good", text: `Sau bữa này còn ${fmtInt(after)} kcal.` };
  }
  if (target - after <= target * OVER_TOLERANCE) return { tone: "good", text: "Sau bữa này là vừa chạm mục tiêu." };
  return { tone: "warn", text: `Sau bữa này sẽ vượt ${fmtInt(-after)} kcal.` };
}

export function weightToast(prev, now) {
  if (prev == null) return "Đã ghi cân nặng.";
  const d = Math.round((prev - now) * 10) / 10;
  if (d >= 0.1) return `Nhẹ hơn ${fmt1(d)} kg so với lần cân trước.`;
  if (d <= -0.1) return "Đã ghi. Cân nặng lên xuống mỗi ngày là chuyện thường, cứ nhìn xu hướng cả tuần.";
  return "Đã ghi cân nặng.";
}

export const STREAK_MARKS = [3, 7, 14, 30, 50, 100, 200, 365];
export function streakCheer(n) {
  const lines = {
    3: "Ba ngày liền rồi. Thói quen đang thành hình.",
    7: "Trọn một tuần không bỏ ngày nào.",
    14: "Hai tuần liền. Kiên trì thật đấy.",
    30: "Một tháng liền. Đây đã là nếp sống rồi.",
    50: "Năm mươi ngày liền. Quá nể.",
    100: "Một trăm ngày liền. Hiếm ai làm được.",
    200: "Hai trăm ngày liền.",
    365: "Tròn một năm ghi nhật ký.",
  };
  return lines[n] || `${n} ngày liền.`;
}

/** Gợi ý lời nhắn để người chồng thêm nhanh trong Cài đặt. */
export const NOTE_IDEAS = [
  "Anh tự hào về em lắm. Cố lên vợ yêu nhé!",
  "Dù cái cân nói gì, em vẫn đẹp nhất với anh.",
  "Mỗi ngày một chút thôi. Anh luôn ở bên em.",
  "Hôm nay em làm tốt lắm rồi.",
  "Em kiên trì thật đấy, anh phục em.",
  "Cuối tuần mình đi dạo cùng nhau nhé.",
];
export const REWARD_IDEAS = ["Một buổi spa", "Váy mới", "Bữa tối hẹn hò", "Một chuyến đi chơi"];

/** Lời nhắn của ngày: cùng một ngày luôn ra cùng một lời, hôm sau đổi lời khác. */
export function noteOfDay(notes, dayKey) {
  if (!notes || !notes.length) return null;
  const n = Math.floor(new Date(dayKey + "T12:00:00").getTime() / 86400000);
  return notes[((n % notes.length) + notes.length) % notes.length];
}
export function noteLabel(partner, you = "bạn") {
  return partner ? `Lời nhắn từ ${partner}` : `Lời nhắn dành cho ${you}`;
}
