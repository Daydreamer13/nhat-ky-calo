// early.js — chạy ngay trong <head>, trước khi trang được vẽ (file thường, không phải module).
// Đặt sáng/tối và màu chủ đạo trước khi vẽ để màn hình không chớp sai màu.
// Nằm ở file riêng (không viết thẳng trong index.html) để Content-Security-Policy của trang cấm được mọi mã viết thẳng.
(function () {
  try {
    var look = JSON.parse(localStorage.getItem("nkc-look") || "{}");
    var dark = look.theme === "dark" || ((!look.theme || look.theme === "auto") && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.dataset.accent = look.accent || "a1";
    // Thanh trạng thái / thanh địa chỉ của máy theo đúng nền ngay từ đầu (bằng --bg-top của giao diện sáng và tối).
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = dark ? "#0C1D26" : "#DCEEF3";
  } catch (e) { document.documentElement.dataset.theme = "light"; }
})();
