// Khởi động giao diện: tạo quản trị lần đầu, đăng nhập, khung ứng dụng, chọn lớp, tài khoản.
import { api, setCsrf, setUnauthorizedHandler } from "./api.js";
import { S, loadClassData, loadClasses, teacherName, ui } from "./store.js";
import { $, $$, closeDialog, esc, isDark, openDialog, storageGet, storageSet, toast, toggleTheme, withBusy, yearLabel } from "./util.js";
import { TITLES } from "./shared/constants.js";
import { openStudent } from "./views/student.js";
import * as home from "./views/home.js";
import * as att from "./views/att.js";
import * as cmt from "./views/cmt.js";
import * as star from "./views/star.js";
import * as msg from "./views/msg.js";
import * as admin from "./views/admin.js";

const VIEWS = { home, att, cmt, star, msg, admin };

function show(screen) {
  for (const id of ["screen-loading", "screen-auth", "screen-app"]) $("#" + id).hidden = id !== screen;
}

async function boot(message = "") {
  show("screen-loading");
  let st;
  try {
    st = await api("GET", "/state");
  } catch (e) {
    $("#screen-loading").textContent = e.message;
    return;
  }
  setCsrf(st.csrf);
  if (st.needsSetup) renderSetup();
  else if (!st.user) renderLogin(message);
  else await startApp(st.user);
}

/* ---------- Lần chạy đầu: tạo quản trị ---------- */
function renderSetup() {
  show("screen-auth");
  $("#screen-auth").innerHTML = `<div class="auth-card">
    <p class="hand">Chào mừng!</p>
    <h1>Tạo tài khoản quản trị</h1>
    <p class="lead">Đây là lần chạy đầu tiên. Tài khoản này dành cho Ban giám hiệu, dùng để tạo tài khoản giáo viên và lớp học.</p>
    <form class="form" id="setupForm" novalidate>
      <label class="field">Họ và tên<input name="fullName" autocomplete="name" required></label>
      <label class="field">Danh xưng<select name="title">${TITLES.map((t) => `<option>${t}</option>`).join("")}</select></label>
      <label class="field">Tên đăng nhập<input name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required>
        <span class="hint">Chữ không dấu, viết liền, ví dụ: hieutruong</span></label>
      <label class="field">Mật khẩu<input type="password" name="password" autocomplete="new-password" required>
        <span class="hint">Ít nhất 8 ký tự</span></label>
      <label class="field">Nhập lại mật khẩu<input type="password" name="password2" autocomplete="new-password" required></label>
      <p class="err" id="authErr" role="alert"></p>
      <button class="btn primary">Tạo tài khoản và bắt đầu</button>
    </form></div>`;
  const f = $("#setupForm");
  f.onsubmit = (e) => {
    e.preventDefault();
    const err = $("#authErr");
    if (f.password.value !== f.password2.value) {
      err.textContent = "Hai lần nhập mật khẩu không khớp";
      return;
    }
    withBusy(f.querySelector("button"), async () => {
      const res = await api("POST", "/setup", {
        fullName: f.fullName.value, title: f.title.value, username: f.username.value, password: f.password.value,
      });
      setCsrf(res.csrf);
      await startApp(res.user);
    }, err);
  };
  f.fullName.focus();
}

/* ---------- Đăng nhập ---------- */
function renderLogin(message = "") {
  show("screen-auth");
  $("#screen-auth").innerHTML = `<div class="auth-card">
    <p class="hand">Sổ tay Chủ nhiệm số</p>
    <h1>Đăng nhập</h1>
    <p class="lead">Dành cho giáo viên chủ nhiệm và Ban giám hiệu.</p>
    <form class="form" id="loginForm" novalidate>
      <label class="field">Tên đăng nhập<input name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required></label>
      <label class="field">Mật khẩu<input type="password" name="password" autocomplete="current-password" required></label>
      <p class="err" id="authErr" role="alert">${esc(message)}</p>
      <button class="btn primary">Đăng nhập</button>
      <p class="hint" style="margin:0">Quên mật khẩu? Hãy nhờ Ban giám hiệu đặt lại.</p>
    </form></div>`;
  const f = $("#loginForm");
  f.onsubmit = (e) => {
    e.preventDefault();
    withBusy(f.querySelector("button"), async () => {
      const res = await api("POST", "/login", { username: f.username.value, password: f.password.value });
      setCsrf(res.csrf);
      await startApp(res.user);
    }, $("#authErr"));
  };
  f.username.focus();
}

/* ---------- Ứng dụng ---------- */
async function startApp(user) {
  S.user = user;
  show("screen-app");
  $('.nav [data-v="admin"]').hidden = user.role !== "admin";
  $("#who").innerHTML = `<b>${esc(user.title + " " + user.fullName)}</b>${user.role === "admin" ? "Quản trị" : "Giáo viên"}`;
  $("#view").innerHTML = `<p class="loading">Đang tải dữ liệu…</p>`;
  try {
    await loadClasses();
    const saved = Number(storageGet(`sotay-class-${user.id}`));
    const pick = S.classes.find((c) => c.id === saved) || S.classes[0];
    await loadClassData(pick?.id);
  } catch (e) {
    toast(e.message, { error: true });
  }
  if (!S.cls && user.role === "admin") S.view = "admin";
  if (S.view === "admin" && user.role !== "admin") S.view = "home";
  render();
}

/** Đổi lớp đang làm việc. */
async function switchClass(id) {
  try {
    await loadClassData(id);
    storageSet(`sotay-class-${S.user.id}`, String(id));
  } catch (e) {
    toast(e.message, { error: true });
  }
  render();
}

/** Tải lại danh sách lớp (sau khi quản trị tạo/sửa lớp). */
async function refreshClasses() {
  await loadClasses();
  const still = S.cls && S.classes.find((c) => c.id === S.cls.id);
  await loadClassData(still ? S.cls.id : S.classes[0]?.id);
}

function header() {
  const c = S.cls;
  $("#title").textContent = c ? `Lớp ${c.name}` : "Sổ tay Chủ nhiệm số";
  $("#teacher").textContent = c
    ? [c.teacher ? `GVCN: ${teacherName()}` : "Chưa phân công GVCN", `Năm học ${yearLabel(c.schoolYear)}`, `Sĩ số ${S.students.length}`].join(" · ")
    : "";
  $("#schoolName").textContent = c?.schoolName || "";
  $("#dateInput").value = S.curDate;
  document.title = c ? `Lớp ${c.name} – Sổ tay Chủ nhiệm số` : "Sổ tay Chủ nhiệm số";

  const sel = $("#classSel");
  sel.hidden = S.classes.length < 2;
  sel.innerHTML = S.classes.map((x) => {
    const who = S.user.role === "admin" && x.teacher ? ` – ${x.teacher.title} ${x.teacher.fullName}` : "";
    return `<option value="${x.id}" ${x.id === c?.id ? "selected" : ""}>Lớp ${esc(x.name)} (${esc(yearLabel(x.schoolYear))})${esc(who)}</option>`;
  }).join("");
}

function noClass() {
  return S.user.role === "admin"
    ? `<div class="panel pad"><p style="margin:0">Chưa có lớp nào. Hãy vào <b>Quản trị → Lớp học</b> để tạo lớp và phân công giáo viên chủ nhiệm.</p>
       <div><button class="btn primary" id="goAdmin">Mở Quản trị</button></div></div>`
    : `<div class="panel pad"><p style="margin:0">Thầy/cô chưa được phân công chủ nhiệm lớp nào. Hãy liên hệ Ban giám hiệu để được phân công.</p></div>`;
}

function render() {
  header();
  $$(".nav [data-v]").forEach((b) => b.toggleAttribute("aria-current", false));
  $(`.nav [data-v="${S.view}"]`)?.setAttribute("aria-current", "page");
  const view = $("#view");
  if (S.view !== "admin" && !S.cls) {
    view.innerHTML = noClass();
    const g = $("#goAdmin");
    if (g) g.onclick = () => go("admin");
    return;
  }
  VIEWS[S.view].render(view);
  $$("[data-open]", view).forEach((b) => (b.onclick = () => openStudent(Number(b.dataset.open))));
}

function go(v) {
  S.view = v;
  render();
  window.scrollTo(0, 0);
}

Object.assign(ui, { render, go, header, switchClass, refreshClasses });

/* ---------- Tài khoản ---------- */
function openAccount() {
  const u = S.user;
  const dlg = openDialog(`<form id="pwForm" novalidate>
    <div class="dlg-h"><div class="avatar">${esc(u.fullName.trim().split(/\s+/).pop()[0] || "")}</div>
      <div class="grow"><div class="name">${esc(u.title + " " + u.fullName)}</div>
      <div class="sub">Tên đăng nhập: ${esc(u.username)} · ${u.role === "admin" ? "Quản trị" : "Giáo viên"}</div></div>
      <button class="btn ghost" type="button" data-close>Đóng</button></div>
    <div class="dlg-b">
      <div class="row"><button class="btn" type="button" id="themeBtn"></button>
        <button class="btn danger" type="button" id="logoutBtn">Đăng xuất</button></div>
      <h2 style="margin:8px 0 0;font-size:17px">Đổi mật khẩu</h2>
      <label class="field">Mật khẩu hiện tại<input type="password" name="current" autocomplete="current-password"></label>
      <div class="grid2">
        <label class="field">Mật khẩu mới<input type="password" name="next" autocomplete="new-password"></label>
        <label class="field">Nhập lại mật khẩu mới<input type="password" name="next2" autocomplete="new-password"></label>
      </div>
      <p class="hint" style="margin:0">Ít nhất 8 ký tự. Sau khi đổi, các thiết bị khác đang đăng nhập sẽ bị đăng xuất.</p>
      <p class="err" id="pwErr" role="alert"></p>
    </div>
    <div class="dlg-f"><button class="btn primary">Đổi mật khẩu</button></div>
  </form>`);
  const themeBtn = $("#themeBtn", dlg);
  const label = () => (themeBtn.textContent = isDark() ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối");
  label();
  themeBtn.onclick = () => { toggleTheme(); label(); };
  $("[data-close]", dlg).onclick = closeDialog;
  $("#logoutBtn", dlg).onclick = async () => {
    try { await api("POST", "/logout"); } catch { /* vẫn đăng xuất ở giao diện */ }
    closeDialog();
    setCsrf(null);
    S.user = null;
    renderLogin("Đã đăng xuất.");
  };
  const f = $("#pwForm", dlg);
  f.onsubmit = (e) => {
    e.preventDefault();
    const err = $("#pwErr", dlg);
    if (f.next.value !== f.next2.value) {
      err.textContent = "Hai lần nhập mật khẩu mới không khớp";
      return;
    }
    withBusy(f.querySelector(".btn.primary"), async () => {
      await api("POST", "/me/password", { currentPassword: f.current.value, newPassword: f.next.value });
      closeDialog();
      toast("Đã đổi mật khẩu");
    }, err);
  };
}

/* ---------- Gắn sự kiện ---------- */
$$(".nav [data-v]").forEach((b) => (b.onclick = () => go(b.dataset.v)));
$("#dateInput").onchange = (e) => {
  if (e.target.value) {
    S.curDate = e.target.value;
    render();
  }
};
$("#classSel").onchange = (e) => switchClass(Number(e.target.value));
$("#acctBtn").onclick = openAccount;

let expiredShown = false;
setUnauthorizedHandler(() => {
  if (expiredShown || !S.user) return;
  expiredShown = true;
  closeDialog();
  S.user = null;
  setCsrf(null);
  renderLogin("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
  setTimeout(() => (expiredShown = false), 1000);
});

boot();
