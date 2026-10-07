// Màn hình "Điểm danh": chạm để đổi Có mặt → Vắng có phép → Vắng không phép. Mỗi lần chạm lưu ngay.
import { api } from "../api.js";
import { S, enqueue, reloadClass, ui } from "../store.js";
import { $, $$, esc, fmt, initials, short, toast, todayISO, weekday } from "../util.js";

const NEXT = { "": "P", P: "K", K: "" };
const LABEL = { "": "Có mặt", P: "Vắng CP", K: "Vắng KP" };
const SPOKEN = { "": "có mặt", P: "vắng có phép", K: "vắng không phép" };

/** Gửi thay đổi lên máy chủ theo thứ tự; lỗi thì tải lại dữ liệu thật. */
function save(request) {
  enqueue(request).catch(async (e) => {
    toast(e.message, { error: true });
    try { await reloadClass(); } catch { /* giữ nguyên */ }
    ui.render();
  });
}

export function render(view) {
  const d = S.curDate;
  if (!S.students.length) {
    view.innerHTML = `<div class="panel pad"><p style="margin:0">Lớp chưa có học sinh. Hãy thêm học sinh ở màn hình Hôm nay.</p></div>`;
    return;
  }
  const recorded = !!S.att[d];
  const a = S.att[d] || {};
  const P = Object.values(a).filter((v) => v === "P").length;
  const K = Object.values(a).filter((v) => v === "K").length;
  const wd = new Date(d + "T00:00").getDay();

  view.innerHTML = `<h2>Điểm danh ${weekday(d).toLowerCase()}, ${fmt(d)}</h2>
  ${wd === 0 || wd === 6 ? `<p class="notice">Ngày được chọn là cuối tuần.</p>` : ""}
  ${d > todayISO() ? `<p class="notice">Ngày được chọn ở tương lai.</p>` : ""}
  <p class="hint">Chạm vào tên học sinh để đổi trạng thái: Có mặt → Vắng có phép → Vắng không phép. Mỗi lần chạm được lưu ngay.</p>
  <div class="att-summary">
    ${recorded ? `<span class="tag green">Đã điểm danh</span>` : `<span class="tag amber">Chưa điểm danh ngày này</span>`}
    <span class="tag green">Có mặt ${S.students.length - P - K}</span><span class="tag amber">Vắng có phép ${P}</span><span class="tag red">Vắng không phép ${K}</span>
    <span style="margin-left:auto" class="row">
      ${recorded
        ? `${P + K ? `<button class="btn ghost small" id="allPresent">Đặt lại: tất cả có mặt</button>` : ""}<button class="btn ghost small" id="cancelDay">Hủy điểm danh ngày này</button>`
        : `<button class="btn primary small" id="allPresent">Lưu: cả lớp có mặt</button>`}
    </span>
  </div>
  <div class="att-grid ${recorded ? "" : "unsaved"}">${S.students.map((s) => {
    const v = a[s.id] || "";
    return `<button class="att" data-s="${v}" data-id="${s.id}" aria-label="${esc(s.fullName)}: ${SPOKEN[v]}"><div class="avatar">${esc(initials(s.fullName))}</div><div class="grow"><div class="name">${esc(short(s.fullName))}</div></div><span class="st">${LABEL[v]}</span></button>`;
  }).join("")}</div>
  ${P + K ? `<div class="row" style="margin-top:18px"><button class="btn primary" id="toMsg">Soạn tin báo phụ huynh (${P + K})</button></div>` : ""}`;

  $$(".att", view).forEach((b) => (b.onclick = () => {
    const id = Number(b.dataset.id);
    const day = (S.att[d] = S.att[d] || {});
    const next = NEXT[day[id] || ""];
    if (next) day[id] = next;
    else delete day[id];
    ui.render();
    $(`.att[data-id="${id}"]`)?.focus();
    save(() => api("PUT", `/classes/${S.cls.id}/attendance/${d}/students/${id}`, { status: next }));
  }));

  const all = $("#allPresent");
  if (all) all.onclick = () => {
    if (P + K && !confirm("Đặt lại cả lớp có mặt ngày " + fmt(d) + "?")) return;
    S.att[d] = {};
    ui.render();
    toast("Đã lưu: cả lớp có mặt");
    save(() => api("PUT", `/classes/${S.cls.id}/attendance/${d}`, { absences: {} }));
  };
  const cancel = $("#cancelDay");
  if (cancel) cancel.onclick = () => {
    if (!confirm(`Hủy điểm danh ngày ${fmt(d)}?\nNgày này sẽ không được tính vào tỉ lệ chuyên cần (dùng khi chọn nhầm ngày nghỉ).`)) return;
    delete S.att[d];
    ui.render();
    toast("Đã hủy điểm danh ngày " + fmt(d));
    save(() => api("DELETE", `/classes/${S.cls.id}/attendance/${d}`));
  };
  const tm = $("#toMsg");
  if (tm) tm.onclick = () => {
    S.msgTemplate = "absent";
    ui.go("msg");
  };
}
