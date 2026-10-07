// Bản giáo viên (GitHub Pages): không đăng nhập, dữ liệu nằm trong trình duyệt của máy đang dùng.
import { api, requestPersistence, setExternalChangeHandler, storageWorks } from "./api.js";
import { S, loadClassData, loadClasses, teacherName, ui } from "./store.js";
import { $, $$, esc, isDark, storageGet, storageSet, toast, toggleTheme, withBusy, yearLabel } from "./util.js";
import { TITLES } from "./shared/constants.js";
import { openStudent } from "./views/student.js";
import * as home from "./views/home.js";
import * as att from "./views/att.js";
import * as cmt from "./views/cmt.js";
import * as star from "./views/star.js";
import * as msg from "./views/msg.js";
import * as lop from "./views/lop.js";

const VIEWS = { home, att, cmt, star, msg, lop };
const CLASS_KEY = "sotay-gv-lop";

function show(screen) {
  for (const id of ["screen-loading", "screen-auth", "screen-app"]) $("#" + id).hidden = id !== screen;
}

async function boot() {
  const st = await api("GET", "/state");
  if (st.needsSetup) renderWelcome();
  else await startApp(st.user);
}

/* ---------- Lần đầu mở trên máy này ---------- */
function renderWelcome() {
  show("screen-auth");
  const blocked = !storageWorks();
  $("#screen-auth").innerHTML = `<div class="auth-card">
    <p class="hand">Sổ tay Chủ nhiệm số</p>
    <h1>Chào thầy/cô!</h1>
    <p class="lead">Điểm danh, nhận xét theo Thông tư 27, ngôi sao chăm ngoan và tin nhắn phụ huynh cho lớp chủ nhiệm.
      Không cần tạo tài khoản. Dữ liệu học sinh chỉ lưu trên thiết bị này, không gửi đi đâu.</p>
    ${blocked ? `<p class="notice red">Trình duyệt đang chặn lưu dữ liệu (có thể do chế độ ẩn danh). Hãy mở trang bằng cửa sổ thường, nếu không dữ liệu sẽ mất khi đóng trang.</p>` : ""}
    <form class="form" id="welcomeForm" novalidate>
      <label class="field">Họ và tên của thầy/cô<input name="fullName" autocomplete="name" required>
        <span class="hint">Dùng để ký tên trong tin nhắn gửi phụ huynh.</span></label>
      <label class="field">Danh xưng<select name="title">${TITLES.map((t) => `<option>${t}</option>`).join("")}</select></label>
      <p class="err" id="welcomeErr" role="alert"></p>
      <button class="btn primary">Bắt đầu</button>
    </form></div>`;
  const f = $("#welcomeForm");
  f.onsubmit = (e) => {
    e.preventDefault();
    withBusy(f.querySelector("button"), async () => {
      const res = await api("POST", "/setup", { fullName: f.fullName.value, title: f.title.value });
      requestPersistence();
      await startApp(res.user);
    }, $("#welcomeErr"));
  };
  f.fullName.focus();
}

/* ---------- Ứng dụng ---------- */
async function startApp(user) {
  S.user = user;
  show("screen-app");
  showWho();
  await loadClasses();
  const saved = Number(storageGet(CLASS_KEY));
  const pick = S.classes.find((c) => c.id === saved) || S.classes[0];
  await loadClassData(pick?.id);
  if (!S.cls) S.view = "lop";
  render();
  if (!S.classes.length) lop.openClassDialog(null);
}

function showWho() {
  $("#who").innerHTML = `<b>${esc(S.user.title + " " + S.user.fullName)}</b>Dữ liệu lưu trên máy này`;
}

async function switchClass(id) {
  await loadClassData(id);
  storageSet(CLASS_KEY, String(id));
  render();
}

async function refreshClasses() {
  await loadClasses();
  const still = S.cls && S.classes.find((c) => c.id === S.cls.id);
  await loadClassData(still ? S.cls.id : S.classes[0]?.id);
  showWho();
}

function header() {
  const c = S.cls;
  $("#title").textContent = c ? `Lớp ${c.name}` : "Sổ tay Chủ nhiệm số";
  $("#teacher").textContent = c
    ? [`GVCN: ${teacherName()}`, `Năm học ${yearLabel(c.schoolYear)}`, `Sĩ số ${S.students.length}`].join(" · ")
    : "";
  $("#schoolName").textContent = c?.schoolName || "";
  $("#dateInput").value = S.curDate;
  document.title = c ? `Lớp ${c.name} – Sổ tay Chủ nhiệm số` : "Sổ tay Chủ nhiệm số";
  $("#themeBtn").textContent = isDark() ? "Giao diện sáng" : "Giao diện tối";

  const sel = $("#classSel");
  sel.hidden = S.classes.length < 2;
  sel.innerHTML = S.classes.map((x) => `<option value="${x.id}" ${x.id === c?.id ? "selected" : ""}>Lớp ${esc(x.name)} (${esc(yearLabel(x.schoolYear))})</option>`).join("");
}

function render() {
  header();
  $$(".nav [data-v]").forEach((b) => b.toggleAttribute("aria-current", false));
  $(`.nav [data-v="${S.view}"]`)?.setAttribute("aria-current", "page");
  const view = $("#view");
  if (S.view !== "lop" && !S.cls) {
    view.innerHTML = `<div class="panel pad"><p style="margin:0">Chưa có lớp nào. Hãy tạo lớp chủ nhiệm đầu tiên.</p>
      <div><button class="btn primary" id="firstClass">Tạo lớp</button></div></div>`;
    $("#firstClass").onclick = () => lop.openClassDialog(null);
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

$$(".nav [data-v]").forEach((b) => (b.onclick = () => go(b.dataset.v)));
$("#dateInput").onchange = (e) => {
  if (e.target.value) {
    S.curDate = e.target.value;
    render();
  }
};
$("#classSel").onchange = (e) => switchClass(Number(e.target.value));
$("#themeBtn").onclick = () => { toggleTheme(); header(); };

// Dữ liệu đổi ở thẻ khác: tải lại cho khớp.
setExternalChangeHandler(async () => {
  if (!S.user) return;
  try {
    await refreshClasses();
    render();
    toast("Đã cập nhật theo thay đổi ở thẻ khác");
  } catch { /* bỏ qua */ }
});

boot().catch((e) => {
  $("#screen-loading").textContent = "Không mở được ứng dụng: " + e.message;
});
