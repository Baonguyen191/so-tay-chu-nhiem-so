// Màn hình "Lớp & dữ liệu" (bản giáo viên): lớp của tôi, thông tin giáo viên, sao lưu / chuyển máy.
import { api, clearAll, exportBackup, getLastBackup, importBackup } from "../api.js";
import { S, ui } from "../store.js";
import { $, $$, closeDialog, esc, openDialog, toast, withBusy, yearLabel } from "../util.js";
import { TITLES } from "../shared/constants.js";

function currentSchoolYear() {
  const d = new Date();
  const y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1; // năm học mới từ tháng 8
  return `${y}–${y + 1}`;
}

function backupNotice() {
  const last = getLastBackup();
  if (!S.classes.length) return "";
  if (!last) return `<p class="notice">Thầy/cô <b>chưa sao lưu lần nào</b>. Dữ liệu chỉ nằm trong trình duyệt này: đổi máy, xóa lịch sử duyệt web hoặc mất máy là mất dữ liệu. Hãy bấm <b>Tải file sao lưu</b> bên dưới.</p>`;
  const days = Math.floor((Date.now() - Date.parse(last)) / 86400000);
  if (days >= 7) return `<p class="notice">Lần sao lưu gần nhất cách đây ${days} ngày. Nên sao lưu mỗi tuần.</p>`;
  return "";
}

export function render(view) {
  const last = getLastBackup();
  view.innerHTML = `<h2>Lớp &amp; dữ liệu</h2>
  ${backupNotice()}
  <h2>Lớp của tôi</h2>
  <div class="row" style="margin-bottom:12px"><button class="btn primary" id="addClass">Tạo lớp</button>
    <span class="hint" style="margin:0">Mỗi năm học tạo lớp mới; lớp các năm trước vẫn được giữ để xem lại.</span></div>
  ${S.classes.length ? `<div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Lớp</th><th>Năm học</th><th>Trường</th><th>Sĩ số</th><th><span class="sr">Thao tác</span></th></tr></thead>
    <tbody>${S.classes.map((c) => `<tr>
      <td><b>${esc(c.name)}</b> <span class="muted">(khối ${c.grade})</span>${c.id === S.cls?.id ? ` <span class="tag ink">Đang mở</span>` : ""}</td>
      <td>${esc(yearLabel(c.schoolYear))}</td><td>${esc(c.schoolName)}</td><td>${c.studentCount}</td>
      <td class="acts">${c.id === S.cls?.id ? "" : `<button class="btn" data-open-class="${c.id}">Mở lớp</button>`}
        <button class="btn" data-edit-class="${c.id}">Sửa</button>
        ${c.studentCount ? "" : `<button class="btn danger" data-del-class="${c.id}">Xóa</button>`}</td>
    </tr>`).join("")}</tbody></table></div>` : `<p class="empty panel">Chưa có lớp nào.</p>`}

  <div class="two" style="margin-top:28px">
    <form class="panel pad" id="profileForm" novalidate>
      <h2 style="margin:0;font-size:18px">Thông tin giáo viên</h2>
      <p class="hint" style="margin:0">Dùng ở đầu trang và để ký tên trong tin nhắn gửi phụ huynh.</p>
      <div class="grid2">
        <label class="field">Họ và tên<input name="fullName" maxlength="80" value="${esc(S.user.fullName)}"></label>
        <label class="field">Danh xưng<select name="title">${TITLES.map((t) => `<option ${t === S.user.title ? "selected" : ""}>${t}</option>`).join("")}</select></label>
      </div>
      <p class="err" id="pErr" role="alert"></p>
      <div><button class="btn primary">Lưu</button></div>
    </form>

    <div class="panel pad">
      <h2 style="margin:0;font-size:18px">Sao lưu và chuyển sang máy khác</h2>
      <p style="margin:0">Dữ liệu chỉ nằm trong trình duyệt của <b>thiết bị này</b>. Muốn dùng trên máy khác (ví dụ từ máy tính sang điện thoại):
        tải file sao lưu ở đây, gửi file sang máy kia, rồi mở trang này trên máy kia và bấm <b>Khôi phục từ file</b>.</p>
      <p class="hint" style="margin:0">${last ? `Lần sao lưu gần nhất: ${esc(new Date(last).toLocaleString("vi-VN"))}.` : "Chưa sao lưu lần nào."}
        File sao lưu chứa thông tin cá nhân của học sinh: không gửi vào nhóm chat chung.</p>
      <div><button class="btn primary" id="bkBtn" type="button">Tải file sao lưu</button></div>
      <label class="field">Khôi phục từ file sao lưu (.json)<input type="file" id="rsFile" accept=".json,application/json"></label>
      <p class="err" id="rsErr" role="alert"></p>
      <div><button class="btn danger" id="rsBtn" type="button">Khôi phục từ file</button></div>
    </div>
  </div>

  <div class="panel pad" style="margin-top:20px">
    <h2 style="margin:0;font-size:18px">Xóa dữ liệu trên máy này</h2>
    <p style="margin:0">Dùng khi trả lại máy dùng chung hoặc đổi máy. Hãy tải file sao lưu trước.</p>
    <div><button class="btn danger" id="wipeBtn" type="button">Xóa toàn bộ dữ liệu trên máy này</button></div>
  </div>
  <p class="hint" style="margin-top:16px">Trên iPhone/iPad: mở trang bằng Safari, bấm nút Chia sẻ → <b>Thêm vào MH chính</b>. Trang mở từ màn hình chính được giữ dữ liệu lâu hơn.</p>`;

  $("#addClass").onclick = () => openClassDialog(null);
  $$("[data-edit-class]", view).forEach((b) => (b.onclick = () => openClassDialog(S.classes.find((c) => c.id === Number(b.dataset.editClass)))));
  $$("[data-open-class]", view).forEach((b) => (b.onclick = async () => {
    await ui.switchClass(Number(b.dataset.openClass));
    ui.go("home");
  }));
  $$("[data-del-class]", view).forEach((b) => (b.onclick = () => {
    const c = S.classes.find((x) => x.id === Number(b.dataset.delClass));
    if (!confirm(`Xóa lớp ${c.name} (${yearLabel(c.schoolYear)})?`)) return;
    withBusy(b, async () => {
      await api("DELETE", `/my/classes/${c.id}`);
      await ui.refreshClasses();
      ui.render();
      toast("Đã xóa lớp");
    });
  }));

  const pf = $("#profileForm");
  pf.onsubmit = (e) => {
    e.preventDefault();
    withBusy(pf.querySelector("button"), async () => {
      const res = await api("PUT", "/profile", { fullName: pf.fullName.value, title: pf.title.value });
      S.user = res.user;
      await ui.refreshClasses();
      ui.render();
      toast("Đã lưu thông tin giáo viên");
    }, $("#pErr"));
  };

  $("#bkBtn").onclick = () => {
    const blob = new Blob([exportBackup()], { type: "application/json" });
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `so-tay-sao-luu-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    toast("Đã tải file sao lưu");
    ui.render();
  };

  $("#rsBtn").onclick = async () => {
    const file = $("#rsFile").files[0];
    const err = $("#rsErr");
    err.textContent = "";
    if (!file) {
      err.textContent = "Hãy chọn file sao lưu";
      return;
    }
    const typed = prompt(`Khôi phục từ "${file.name}" sẽ thay toàn bộ dữ liệu đang có trên máy này.\nGõ chữ KHÔI PHỤC (viết hoa) để xác nhận:`);
    if (typed === null) return;
    if (typed.trim().normalize("NFC").toUpperCase() !== "KHÔI PHỤC") {
      err.textContent = "Chưa khôi phục: chữ xác nhận không đúng.";
      return;
    }
    try {
      const r = importBackup(await file.text());
      toast(`Đã khôi phục ${r.classes} lớp, ${r.students} học sinh`);
      setTimeout(() => location.reload(), 1200);
    } catch (e) {
      err.textContent = e.message;
    }
  };

  $("#wipeBtn").onclick = () => {
    const typed = prompt("Toàn bộ lớp, học sinh, điểm danh, nhận xét trên máy này sẽ bị xóa và không lấy lại được (trừ khi có file sao lưu).\nGõ chữ XÓA (viết hoa) để xác nhận:");
    if (typed === null) return;
    if (typed.trim().normalize("NFC").toUpperCase() !== "XÓA") {
      toast("Chưa xóa: chữ xác nhận không đúng", { error: true });
      return;
    }
    clearAll();
    location.reload();
  };
}

export function openClassDialog(c) {
  const lastSchool = S.classes[0]?.schoolName || "";
  const dlg = openDialog(`<form id="cf" novalidate>
    <div class="dlg-h"><div class="grow"><div class="name">${c ? "Sửa lớp " + esc(c.name) : "Tạo lớp chủ nhiệm"}</div></div>
      <button class="btn ghost" type="button" data-close>Đóng</button></div>
    <div class="dlg-b">
      <div class="grid2">
        <label class="field">Tên lớp<input name="name" maxlength="20" placeholder="ví dụ: 3A" value="${esc(c?.name || "")}"></label>
        <label class="field">Khối<select name="grade">${[1, 2, 3, 4, 5].map((g) => `<option value="${g}" ${g === (c?.grade || 1) ? "selected" : ""}>Khối ${g}</option>`).join("")}</select></label>
      </div>
      <div class="grid2">
        <label class="field">Năm học<input name="schoolYear" placeholder="2026–2027" value="${esc(c ? yearLabel(c.schoolYear) : currentSchoolYear())}"></label>
        <label class="field">Tên trường<input name="schoolName" maxlength="120" placeholder="Trường Tiểu học …" value="${esc(c?.schoolName || lastSchool)}"></label>
      </div>
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
      const body = { name: f.name.value, grade: Number(f.grade.value), schoolYear: f.schoolYear.value, schoolName: f.schoolName.value };
      if (c) {
        await api("PATCH", `/my/classes/${c.id}`, body);
        await ui.refreshClasses();
      } else {
        const res = await api("POST", "/my/classes", body);
        await ui.refreshClasses();
        await ui.switchClass(res.class.id);
        S.view = "home";
      }
      closeDialog();
      ui.render();
      toast(c ? "Đã lưu lớp" : "Đã tạo lớp");
    }, $("#cErr", dlg));
  };
}
