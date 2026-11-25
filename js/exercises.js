// exercises.js — các hoạt động vận động thường gặp và mức tiêu hao (MET) của chúng.
// kcal đốt ≈ MET × cân nặng (kg) × số giờ. Đây là ước tính phổ thông, thường lệch 20–30% tuỳ người và cường độ thật,
// nên app chỉ hiện riêng con số này, KHÔNG cộng vào phần được ăn trong ngày.
// Mã (id) được lưu trong nhật ký: đừng đổi mã của hoạt động đã có.

export const EXERCISES = [
  ["di-bo", "Đi bộ thong thả", 3.0],
  ["di-bo-nhanh", "Đi bộ nhanh", 4.3],
  ["chay-cham", "Chạy bộ chậm", 7.0],
  ["chay", "Chạy bộ nhanh", 9.8],
  ["dap-xe", "Đạp xe thong thả", 4.0],
  ["dap-xe-nhanh", "Đạp xe nhanh", 6.8],
  ["yoga", "Yoga", 2.5],
  ["pilates", "Pilates", 3.0],
  ["aerobic", "Aerobic, zumba", 6.5],
  ["nhay", "Nhảy, khiêu vũ", 5.0],
  ["nhay-day", "Nhảy dây", 10.0],
  ["boi", "Bơi", 6.0],
  ["gym", "Tập tạ, gym", 3.5],
  ["tai-nha", "Tập tại nhà (squat, plank…)", 3.8],
  ["hiit", "HIIT, cardio mạnh", 8.0],
  ["cau-long", "Cầu lông", 5.5],
  ["cau-thang", "Leo cầu thang", 4.0],
  ["viec-nha", "Việc nhà, lau dọn", 3.3],
  ["khac", "Vận động khác (vừa sức)", 4.0],
].map(([id, n, met]) => ({ id, n, met }));
