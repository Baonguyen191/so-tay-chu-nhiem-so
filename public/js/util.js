// Tiện ích giao diện dùng chung.

export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => [...root.querySelectorAll(s)];

/** Chống XSS: mọi dữ liệu đưa vào HTML đều phải đi qua hàm này. */
export const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function iso(d) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}
export const todayISO = () => iso(new Date());
export const fmt = (d) => (d ? d.split("-").reverse().join("/") : "");
export const weekday = (d) => ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"][new Date(d + "T00:00").getDay()];
export const yearLabel = (y) => String(y || "").replace("-", "–");
export const genderLabel = (g) => (g === "M" ? "Nam" : g === "F" ? "Nữ" : "");

export const initials = (n) => {
  const p = String(n).trim().split(/\s+/);
  return (p[p.length - 1][0] || "").toUpperCase();
};
export const short = (n) => String(n).trim().split(/\s+/).slice(-2).join(" ");

export function toast(text, { error = false } = {}) {
  const el = $("#toast");
  el.textContent = text;
  el.classList.toggle("error", error);
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), error ? 4000 : 1800);
}

export function copy(text, msg) {
  const done = () => toast(msg);
  const fallback = () => {
    const t = document.createElement("textarea");
    t.value = text;
    t.style.position = "fixed";
    t.style.opacity = "0";
    document.body.appendChild(t);
    t.select();
    try {
      document.execCommand("copy");
      done();
    } catch {
      toast("Không sao chép được – hãy chọn và sao chép thủ công", { error: true });
    }
    t.remove();
  };
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback);
  else fallback();
}

/** Mở hộp thoại chung với nội dung HTML (đã escape). */
export function openDialog(html, { wide = false } = {}) {
  const dlg = $("#dlg");
  dlg.className = wide ? "wide" : "";
  dlg.innerHTML = html;
  if (!dlg.open) dlg.showModal();
  return dlg;
}

export function closeDialog() {
  const dlg = $("#dlg");
  if (dlg.open) dlg.close();
}

/** Khóa nút trong lúc chờ máy chủ, hiện lỗi nếu có. Trả về kết quả của fn, hoặc undefined nếu lỗi. */
export async function withBusy(button, fn, errorEl) {
  if (button) button.disabled = true;
  if (errorEl) errorEl.textContent = "";
  try {
    return await fn();
  } catch (e) {
    if (errorEl) errorEl.textContent = e.message;
    else toast(e.message, { error: true });
    return undefined;
  } finally {
    if (button) button.disabled = false;
  }
}

/** Mật khẩu ngẫu nhiên dễ đọc (bỏ các ký tự dễ nhầm như l, 1, O, 0). */
export function randomPassword(length = 10) {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export function toggleTheme() {
  const root = document.documentElement;
  root.dataset.theme = isDark() ? "light" : "dark";
  try { localStorage.setItem("sotay-theme", root.dataset.theme); } catch { /* bỏ qua */ }
}

export function isDark() {
  const t = document.documentElement.dataset.theme;
  return t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
}

export function storageGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
export function storageSet(key, value) {
  try { localStorage.setItem(key, value); } catch { /* bỏ qua */ }
}
