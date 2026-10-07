// Màn hình "Quản trị" (Ban giám hiệu): tài khoản giáo viên, lớp học, sao lưu/khôi phục.
import { api } from "../api.js";
import { S, ui } from "../store.js";
import { $, $$, closeDialog, copy, esc, openDialog, randomPassword, toast, withBusy, yearLabel } from "../util.js";
import { TITLES } from "../shared/constants.js";

let tab = "users";
let users = [];

const TABS = { users: "Giáo viên", classes: "Lớp học", backup: "Sao lưu" };

export function render(view) {
  view.innerHTML = `<h2>Quản trị</h2>
    <div class="tabs" role="tablist">${Object.entries(TABS).map(([k, v]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${k === tab}">${v}</button>`).join("")}</div>
    <div id="adminPane"><p class="loading">Đang tải…</p></div>`;
  $$("[data-tab]", view).forEach((b) => (b.onclick = () => { tab = b.dataset.tab; render(view); }));
  load().then(paint, (e) => {
    const pane = $("#adminPane");
    if (pane) pane.innerHTML = `<p class="notice red">${esc(e.message)}</p>`;
  });
}

async function load() {
  const [u] = await Promise.all([api("GET", "/admin/users"), ui.refreshClasses()]);
  users = u.users;
}

function paint() {
  const pane = $("#adminPane");
  if (!pane) return; // đã chuyển màn hình khác
  ui.header();
  if (tab === "users") paintUsers(pane);
  else if (tab === "classes") paintClasses(pane);
  else paintBackup(pane);
}

async function refresh() {
  await load();
  paint();
}

/* ---------- Giáo viên ---------- */
function statusOf(u) {
  if (u.isLocked) return `<span class="tag red">Đã khóa</span>`;
  if (u.tempLockedUntil) {
    const t = new Date(u.tempLockedUntil).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    return `<span class="tag amber">Tạm khóa đến ${t}</span>`;
  }
  return `<span class="tag green">Hoạt động</span>`;
}

function paintUsers(pane) {
  pane.innerHTML = `<div class="row" style="margin-bottom:12px"><button class="btn primary" id="addUser">Thêm tài khoản</button>
    <span class="hint" style="margin:0">Tạo tài khoản cho từng giáo viên chủ nhiệm, rồi phân công lớp ở mục Lớp học.</span></div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Họ và tên</th><th>Tên đăng nhập</th><th>Vai trò</th><th>Lớp chủ nhiệm</th><th>Trạng thái</th><th><span class="sr">Thao tác</span></th></tr></thead>
      <tbody>${users.map((u) => `<tr>
        <td><b>${esc(u.title + " " + u.fullName)}</b></td><td>${esc(u.username)}</td>
        <td>${u.role === "admin" ? "Quản trị" : "Giáo viên"}</td>
        <td>${u.classes.length ? esc(u.classes.map(yearLabel).join(", ")) : `<span class="muted">—</span>`}</td>
        <td>${statusOf(u)}</td>
        <td class="acts"><button class="btn" data-edit="${u.id}">Sửa</button>
          <button class="btn" data-reset="${u.id}">Đặt lại mật khẩu</button>
          ${u.id === S.user.id ? "" : `<button class="btn ${u.isLocked ? "" : "danger"}" data-lock="${u.id}">${u.isLocked ? "Mở khóa" : "Khóa"}</button>`}</td>
      </tr>`).join("")}</tbody></table></div>`;

  $("#addUser").onclick = () => userDialog(null);
  $$("[data-edit]", pane).forEach((b) => (b.onclick = () => userDialog(users.find((u) => u.id === Number(b.dataset.edit)))));
  $$("[data-reset]", pane).forEach((b) => (b.onclick = () => resetDialog(users.find((u) => u.id === Number(b.dataset.reset)))));
  $$("[data-lock]", pane).forEach((b) => (b.onclick = () => {
    const u = users.find((x) => x.id === Number(b.dataset.lock));
    const lock = !u.isLocked;
    if (lock && !confirm(`Khóa tài khoản ${u.title} ${u.fullName}?\nNgười này sẽ bị đăng xuất ngay và không đăng nhập được cho đến khi mở khóa. Dữ liệu lớp vẫn được giữ nguyên.`)) return;
    withBusy(b, async () => {
      await api("PATCH", `/admin/users/${u.id}`, { isLocked: lock });
      toast(lock ? "Đã khóa tài khoản" : "Đã mở khóa tài khoản");
      await refresh();
    });
  }));
}

function userDialog(u) {
  const isNew = !u;
  const dlg = openDialog(`<form id="uf" novalidate>
    <div class="dlg-h"><div class="grow"><div class="name">${isNew ? "Thêm tài khoản" : "Sửa tài khoản " + esc(u.username)}</div></div>
      <button class="btn ghost" type="button" data-close>Đóng</button></div>
    <div class="dlg-b">
      <div class="grid2">
        <label class="field">Họ và tên<input name="fullName" maxlength="80" value="${esc(u?.fullName || "")}"></label>
        <label class="field">Danh xưng<select name="title">${TITLES.map((t) => `<option ${t === (u?.title || "Cô") ? "selected" : ""}>${t}</option>`).join("")}</select></label>
      </div>
      ${isNew ? `<label class="field">Tên đăng nhập<input name="username" autocapitalize="none" spellcheck="false" autocomplete="off" placeholder="ví dụ: cohanh">
          <span class="hint">Chữ không dấu, viết liền, có thể có dấu chấm. Không đổi được sau khi tạo.</span></label>
        <label class="field">Mật khẩu ban đầu<span class="row"><input name="password" autocomplete="off" style="flex:1" value="${randomPassword()}"><button class="btn" type="button" id="gen">Tạo mật khẩu khác</button></span>
          <span class="hint">Ít nhất 8 ký tự. Giáo viên nên tự đổi mật khẩu sau lần đăng nhập đầu tiên.</span></label>` : ""}
      <label class="field">Vai trò<select name="role" ${u?.id === S.user.id ? "disabled" : ""}>
        <option value="teacher" ${u?.role !== "admin" ? "selected" : ""}>Giáo viên – chỉ xem và sửa lớp mình chủ nhiệm</option>
        <option value="admin" ${u?.role === "admin" ? "selected" : ""}>Quản trị – Ban giám hiệu, xem và sửa mọi lớp</option></select></label>
      <p class="err" id="uErr" role="alert"></p>
    </div>
    <div class="dlg-f"><button class="btn" type="button" data-close>Hủy</button><button class="btn primary" id="uSave">${isNew ? "Tạo tài khoản" : "Lưu"}</button></div>
  </form>`);
  $$("[data-close]", dlg).forEach((b) => (b.onclick = closeDialog));
  const f = $("#uf", dlg);
  const gen = $("#gen", dlg);
  if (gen) gen.onclick = () => (f.password.value = randomPassword());
  f.fullName.focus();
  f.onsubmit = (e) => {
    e.preventDefault();
    withBusy($("#uSave", dlg), async () => {
      const body = { fullName: f.fullName.value, title: f.title.value };
      if (u?.id !== S.user.id) body.role = f.role.value;
      if (isNew) {
        Object.assign(body, { username: f.username.value, password: f.password.value });
        const res = await api("POST", "/admin/users", body);
        await refresh();
        showCredentials(res.user, body.password, "Đã tạo tài khoản");
      } else {
        await api("PATCH", `/admin/users/${u.id}`, body);
        closeDialog();
        toast("Đã lưu tài khoản");
        await refresh();
      }
    }, $("#uErr", dlg));
  };
}

function showCredentials(u, password, heading) {
  const text = `Sổ tay Chủ nhiệm số\nĐịa chỉ: ${location.origin}\nTên đăng nhập: ${u.username}\nMật khẩu: ${password}`;
  const dlg = openDialog(`<div class="dlg-h"><div class="grow"><div class="name">${esc(heading)}</div></div></div>
    <div class="dlg-b">
      <p style="margin:0">Hãy báo thông tin đăng nhập cho <b>${esc(u.title + " " + u.fullName)}</b>. Mật khẩu chỉ hiện một lần này.</p>
      <div>Tên đăng nhập: <span class="code">${esc(u.username)}</span></div>
      <div>Mật khẩu: <span class="code">${esc(password)}</span></div>
    </div>
    <div class="dlg-f"><button class="btn" type="button" id="cpy">Sao chép</button><button class="btn primary" type="button" data-close>Xong</button></div>`);
  $("#cpy", dlg).onclick = () => copy(text, "Đã sao chép thông tin đăng nhập");
  $("[data-close]", dlg).onclick = closeDialog;
}

function resetDialog(u) {
  const dlg = openDialog(`<form id="rf" novalidate>
    <div class="dlg-h"><div class="grow"><div class="name">Đặt lại mật khẩu</div><div class="sub">${esc(u.title + " " + u.fullName)} · ${esc(u.username)}</div></div>
      <button class="btn ghost" type="button" data-close>Đóng</button></div>
    <div class="dlg-b">
      <label class="field">Mật khẩu mới<span class="row"><input name="password" autocomplete="off" style="flex:1" value="${randomPassword()}"><button class="btn" type="button" id="gen">Tạo mật khẩu khác</button></span></label>
      <p class="hint" style="margin:0">Tài khoản sẽ được mở khóa tạm (nếu đang bị khóa do nhập sai) và bị đăng xuất khỏi mọi thiết bị.</p>
      <p class="err" id="rErr" role="alert"></p>
    </div>
    <div class="dlg-f"><button class="btn" type="button" data-close>Hủy</button><button class="btn primary" id="rSave">Đặt lại</button></div>
  </form>`);
  $$("[data-close]", dlg).forEach((b) => (b.onclick = closeDialog));
  const f = $("#rf", dlg);
  $("#gen", dlg).onclick = () => (f.password.value = randomPassword());
  f.onsubmit = (e) => {
    e.preventDefault();
    withBusy($("#rSave", dlg), async () => {
      await api("POST", `/admin/users/${u.id}/password`, { password: f.password.value });
      await refresh();
      showCredentials(u, f.password.value, "Đã đặt lại mật khẩu");
    }, $("#rErr", dlg));
  };
}

/* ---------- Lớp học ---------- */
function currentSchoolYear() {
  const d = new Date();
  const y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1; // năm học mới từ tháng 8
  return `${y}–${y + 1}`;
}

function paintClasses(pane) {
  pane.innerHTML = `<div class="row" style="margin-bottom:12px"><button class="btn primary" id="addClass">Tạo lớp</button>
    <span class="hint" style="margin:0">Mỗi năm học tạo lớp mới; dữ liệu các năm trước vẫn được giữ để tra cứu.</span></div>
    ${S.classes.length ? `<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Lớp</th><th>Năm học</th><th>Trường</th><th>GVCN</th><th>Sĩ số</th><th><span class="sr">Thao tác</span></th></tr></thead>
      <tbody>${S.classes.map((c) => `<tr>
        <td><b>${esc(c.name)}</b> <span class="muted">(khối ${c.grade})</span></td><td>${esc(yearLabel(c.schoolYear))}</td><td>${esc(c.schoolName)}</td>
        <td>${c.teacher ? esc(c.teacher.title + " " + c.teacher.fullName) : `<span class="tag amber">Chưa phân công</span>`}</td>
        <td>${c.studentCount}</td>
        <td class="acts"><button class="btn" data-open-class="${c.id}">Mở lớp</button>
          <button class="btn" data-edit-class="${c.id}">Sửa</button>
          ${c.studentCount ? "" : `<button class="btn danger" data-del-class="${c.id}">Xóa</button>`}</td>
      </tr>`).join("")}</tbody></table></div>` : `<p class="empty panel">Chưa có lớp nào.</p>`}`;

  $("#addClass").onclick = () => classDialog(null);
  $$("[data-edit-class]", pane).forEach((b) => (b.onclick = () => classDialog(S.classes.find((c) => c.id === Number(b.dataset.editClass)))));
  $$("[data-open-class]", pane).forEach((b) => (b.onclick = async () => {
    await ui.switchClass(Number(b.dataset.openClass));
    ui.go("home");
  }));
  $$("[data-del-class]", pane).forEach((b) => (b.onclick = () => {
    const c = S.classes.find((x) => x.id === Number(b.dataset.delClass));
    if (!confirm(`Xóa lớp ${c.name} (${yearLabel(c.schoolYear)})?`)) return;
    withBusy(b, async () => {
      await api("DELETE", `/admin/classes/${c.id}`);
      toast("Đã xóa lớp");
      await refresh();
    });
  }));
}

function classDialog(c) {
  const lastSchool = S.classes[0]?.schoolName || "";
  const dlg = openDialog(`<form id="cf" novalidate>
    <div class="dlg-h"><div class="grow"><div class="name">${c ? "Sửa lớp " + esc(c.name) : "Tạo lớp mới"}</div></div>
      <button class="btn ghost" type="button" data-close>Đóng</button></div>
    <div class="dlg-b">
      <div class="grid2">
        <label class="field">Tên lớp<input name="name" maxlength="20" placeholder="ví dụ: 3A" value="${esc(c?.name || "")}"></label>
        <label class="field">Khối<select name="grade">${[1, 2, 3, 4, 5].map((g) => `<option value="${g}" ${g === (c?.grade || 1) ? "selected" : ""}>Khối ${g}</option>`).join("")}</select></label>
      </div>
      <div class="grid2">
        <label class="field">Năm học<input name="schoolYear" placeholder="2026–2027" value="${esc(c ? yearLabel(c.schoolYear) : currentSchoolYear())}"></label>
        <label class="field">Giáo viên chủ nhiệm<select name="teacherId"><option value="">— Chưa phân công —</option>
          ${users.map((u) => `<option value="${u.id}" ${u.id === c?.teacherId ? "selected" : ""}>${esc(u.title + " " + u.fullName)}${u.isLocked ? " (đã khóa)" : ""}</option>`).join("")}</select></label>
      </div>
      <label class="field">Tên trường<input name="schoolName" maxlength="120" placeholder="Trường Tiểu học …" value="${esc(c?.schoolName || lastSchool)}"></label>
      <p class="err" id="cErr" role="alert"></p>
    </div>
    <div class="dlg-f"><button class="btn" type="button" data-close>Hủy</button><button class="btn primary" id="cSave">${c ? "Lưu" : "Tạo lớp"}</button></div>
  </form>`);
  $$("[data-close]", dlg).forEach((b) => (b.onclick = closeDialog));
  const f = $("#cf", dlg);
  f.name.oninput = () => {
    const g = f.name.value.replace(/^lớp\s*/i, "").match(/^[1-5]/);
    if (g) f.grade.value = g[0];
  };
  f.name.focus();
  f.onsubmit = (e) => {
    e.preventDefault();
    withBusy($("#cSave", dlg), async () => {
      const body = {
        name: f.name.value, grade: Number(f.grade.value), schoolYear: f.schoolYear.value,
        schoolName: f.schoolName.value, teacherId: f.teacherId.value ? Number(f.teacherId.value) : null,
      };
      if (c) await api("PATCH", `/admin/classes/${c.id}`, body);
      else await api("POST", "/admin/classes", body);
      closeDialog();
      toast(c ? "Đã lưu lớp" : "Đã tạo lớp");
      await refresh();
    }, $("#cErr", dlg));
  };
}

/* ---------- Sao lưu / khôi phục ---------- */
function paintBackup(pane) {
  pane.innerHTML = `<div class="two">
    <div class="panel pad">
      <h2 style="margin:0;font-size:18px">Sao lưu dữ liệu</h2>
      <p style="margin:0">Tải về một file chứa toàn bộ dữ liệu: tài khoản, lớp, học sinh, điểm danh, nhận xét, ngôi sao.
        Nên sao lưu <b>mỗi tuần</b> và cất ở nơi an toàn (USB, ổ mạng hoặc Google Drive của trường).</p>
      <p class="hint" style="margin:0">File sao lưu chứa thông tin cá nhân của học sinh – không gửi qua nhóm chat hay đăng công khai.</p>
      <div><button class="btn primary" id="bkBtn">Tải file sao lưu</button></div>
    </div>
    <div class="panel pad">
      <h2 style="margin:0;font-size:18px">Khôi phục từ file sao lưu</h2>
      <p class="notice red" style="margin:0">Khôi phục sẽ <b>thay toàn bộ dữ liệu hiện tại</b> bằng dữ liệu trong file.
        Dữ liệu hiện tại được tự động giữ lại một bản trong thư mục <b>data/sao-luu</b> trên máy chủ. Mọi người sẽ phải đăng nhập lại.</p>
      <label class="field">Chọn file sao lưu (.sqlite)<input type="file" id="rsFile" accept=".sqlite,.db,application/octet-stream"></label>
      <p class="err" id="rsErr" role="alert"></p>
      <div><button class="btn danger" id="rsBtn">Khôi phục</button></div>
    </div></div>`;

  $("#bkBtn").onclick = (e) => withBusy(e.currentTarget, async () => {
    const res = await api("GET", "/admin/backup", undefined, { raw: true });
    const blob = await res.blob();
    const name = /filename="?([^";]+)"?/.exec(res.headers.get("Content-Disposition") || "")?.[1] || "sotay-sao-luu.sqlite";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    toast("Đã tải file sao lưu");
  });

  $("#rsBtn").onclick = (e) => {
    const file = $("#rsFile").files[0];
    const err = $("#rsErr");
    if (!file) {
      err.textContent = "Hãy chọn file sao lưu";
      return;
    }
    const typed = prompt(`Khôi phục từ file "${file.name}" sẽ thay toàn bộ dữ liệu hiện tại.\nGõ chữ KHÔI PHỤC (viết hoa) để xác nhận:`);
    if (typed === null) return;
    if (typed.trim().normalize("NFC").toUpperCase() !== "KHÔI PHỤC") {
      err.textContent = "Chưa khôi phục: chữ xác nhận không đúng.";
      return;
    }
    withBusy(e.currentTarget, async () => {
      await api("POST", "/admin/restore", await file.arrayBuffer());
      toast("Đã khôi phục dữ liệu. Vui lòng đăng nhập lại.");
      setTimeout(() => location.reload(), 1500);
    }, err);
  };
}
