// Hộp thoại hồ sơ học sinh: xem nhanh chuyên cần, thêm/sửa/xóa.
import { api } from "../api.js";
import { S, byId, reloadClass, ui } from "../store.js";
import { $, closeDialog, esc, fmt, initials, openDialog, toast, todayISO, withBusy } from "../util.js";
import { monthStats, starTotal, studentRate } from "../shared/stats.js";
import { LEVELS } from "../shared/constants.js";
import { validateStudent } from "../shared/validate.js";

export function openStudent(id) {
  const s = id ? byId(id) : { fullName: "", dob: null, gender: null, parentName: "", parentPhone: "", parent2Name: "", parent2Phone: "", healthNote: "" };
  if (!s) return;
  const m = id ? monthStats(S.att, id, S.curDate) : null;
  const rate = m ? studentRate(m) : null;
  const recent = id ? S.comments.filter((c) => c.studentId === id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3) : [];

  const dlg = openDialog(`<form id="sf" novalidate>
   <div class="dlg-h"><div class="avatar">${s.fullName ? esc(initials(s.fullName)) : "+"}</div>
    <div class="grow"><div class="name">${s.fullName ? esc(s.fullName) : "Thêm học sinh"}</div>
    ${m ? `<div class="sub">Tháng ${+S.curDate.slice(5, 7)}: ${m.days} buổi · vắng ${m.P} có phép, ${m.K} không phép · ★ ${starTotal(S.stars, id, S.curDate.slice(0, 7) + "-01", S.curDate)}</div>` : ""}</div>
    <button class="btn ghost" type="button" data-close>Đóng</button></div>
   <div class="dlg-b">
    ${rate !== null ? `<div class="bar" role="img" aria-label="Tỉ lệ chuyên cần ${rate}%"><i style="width:${rate}%"></i></div>` : ""}
    <label class="field">Họ và tên<input name="fullName" required maxlength="80" value="${esc(s.fullName)}" autocomplete="off"></label>
    <div class="grid2">
     <label class="field">Ngày sinh<input type="date" name="dob" value="${esc(s.dob || "")}" max="${todayISO()}"></label>
     <label class="field">Giới tính<select name="gender">
      <option value="" ${!s.gender ? "selected" : ""}>—</option>
      <option value="F" ${s.gender === "F" ? "selected" : ""}>Nữ</option>
      <option value="M" ${s.gender === "M" ? "selected" : ""}>Nam</option></select></label>
    </div>
    <div class="grid2">
     <label class="field">Họ tên phụ huynh<input name="parentName" maxlength="80" value="${esc(s.parentName)}" autocomplete="off"></label>
     <label class="field">Số điện thoại<input name="parentPhone" inputmode="tel" maxlength="20" value="${esc(s.parentPhone)}" autocomplete="off" placeholder="0912345678"></label>
    </div>
    <div class="grid2">
     <label class="field">Phụ huynh thứ hai<input name="parent2Name" maxlength="80" value="${esc(s.parent2Name || "")}" autocomplete="off" placeholder="ví dụ: họ tên bố"></label>
     <label class="field">Số điện thoại<input name="parent2Phone" inputmode="tel" maxlength="20" value="${esc(s.parent2Phone || "")}" autocomplete="off"></label>
    </div>
    <label class="field">Ghi chú sức khỏe<input name="healthNote" maxlength="300" value="${esc(s.healthNote)}" placeholder="Dị ứng, bệnh mãn tính, người đón…"></label>
    <p class="hint" style="margin:0">Chỉ ghi thông tin cần cho công tác chủ nhiệm. Không ghi số định danh cá nhân hay số căn cước.</p>
    ${recent.length ? `<div><div class="field" style="margin-bottom:6px">Nhận xét gần đây</div>${recent.map((c) => `<div class="sub">${fmt(c.date)} · ${esc(c.subject)} · ${esc(LEVELS[c.level])}</div><div class="remark" style="margin-bottom:8px">${esc(c.text)}</div>`).join("")}</div>` : ""}
    <p class="err" id="sErr" role="alert"></p>
   </div>
   <div class="dlg-f">${id ? `<button class="btn ghost" type="button" id="sdel" style="margin-right:auto;color:var(--red)">Xóa học sinh</button>` : ""}
    <button class="btn" type="button" data-close>Hủy</button><button class="btn primary" id="sok">${id ? "Lưu" : "Thêm"}</button></div>
  </form>`);

  dlg.querySelectorAll("[data-close]").forEach((b) => (b.onclick = closeDialog));
  const f = $("#sf", dlg);
  const err = $("#sErr", dlg);
  if (!id) f.fullName.focus();

  f.onsubmit = (e) => {
    e.preventDefault();
    const input = {
      fullName: f.fullName.value, dob: f.dob.value, gender: f.gender.value,
      parentName: f.parentName.value, parentPhone: f.parentPhone.value, healthNote: f.healthNote.value,
      parent2Name: f.parent2Name.value, parent2Phone: f.parent2Phone.value,
    };
    const check = validateStudent(input, { today: todayISO() });
    if (check.errors.length) {
      err.textContent = check.errors.join(". ");
      return;
    }
    withBusy($("#sok", dlg), async () => {
      if (id) await api("PUT", `/students/${id}`, input);
      else await api("POST", `/classes/${S.cls.id}/students`, input);
      await reloadClass();
      closeDialog();
      ui.render();
      toast(id ? "Đã lưu hồ sơ" : "Đã thêm học sinh");
    }, err);
  };

  const del = $("#sdel", dlg);
  if (del) del.onclick = () => {
    if (!confirm(`Xóa học sinh ${s.fullName} khỏi lớp?\n\nToàn bộ điểm danh, nhận xét và ngôi sao của em cũng sẽ bị xóa. Không thể hoàn tác.`)) return;
    withBusy(del, async () => {
      await api("DELETE", `/students/${id}`);
      await reloadClass();
      closeDialog();
      ui.render();
      toast("Đã xóa học sinh");
    }, err);
  };
}
