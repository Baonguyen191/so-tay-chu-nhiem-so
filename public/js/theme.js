// Áp chế độ sáng/tối đã chọn trước khi trang hiển thị (tránh nháy màn hình).
(function () {
  try {
    var t = localStorage.getItem("sotay-theme");
    if (t === "dark" || t === "light") document.documentElement.dataset.theme = t;
  } catch (e) { /* trình duyệt chặn bộ nhớ: dùng theo hệ thống */ }
})();
