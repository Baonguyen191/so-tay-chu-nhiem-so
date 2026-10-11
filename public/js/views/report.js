// Màn hình "Báo cáo": tổng hợp tuần/tháng của lớp (tải Excel) và bảng toàn trường cho Ban giám hiệu.
// Giáo viên: báo cáo lớp mình, tính từ dữ liệu lớp đã tải.
// Ban giám hiệu: toàn trường, và báo cáo từng lớp ở chế độ chỉ xem (lấy số liệu tổng hợp từ máy chủ).
import { api } from "../api.js";
import { S, teacherName, ui } from "../store.js";
import { $, $$, esc, fmt, todayISO, toast, withBusy, yearLabel } from "../util.js";
import { classReport, periodRange, shiftPeriod } from "../shared/report.js";
import { reportFileName } from "../shared/report-xlsx.js";

const st = { tab: "school", classId: null, kind: "week", date: null, year: "", grade: "" };

const pct = (r) => (r === null || r === undefined ? "—" : String(r).replace(".", ",") + "%");
const isAdmin = () => S.user.role === "admin";

/** Ban giám hiệu mở báo cáo chỉ xem của một lớp. */
export function openClassReport(classId) {
  st.tab = "class";
  st.classId = classId;
  ui.go("report");
}

function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

function periodBar(period, withExcel) {
  return `<div class="row" style="margin-bottom:16px">
    <div class="seg" role="group" aria-label="Kỳ báo cáo">
      <button type="button" data-kind="week" aria-pressed="${st.kind === "week"}">Tuần</button>
      <button type="button" data-kind="month" aria-pressed="${st.kind === "month"}">Tháng</button>
    </div>
    <span class="row" style="gap:6px">
      <button class="btn" type="button" id="prevP" aria-label="Kỳ trước">‹</button>
      <b style="min-width:12ch;text-align:center">${esc(period.label)}</b>
      <button class="btn" type="button" id="nextP" aria-label="Kỳ sau">›</button>
    </span>
    <button class="btn ghost" type="button" id="nowP">Kỳ hiện tại</button>
    ${withExcel ? `<button class="btn primary" type="button" id="xlsx" style="margin-left:auto">Tải Excel</button>` : ""}
  </div>`;
}

function bindPeriod(view, period) {
  $$("[data-kind]", view).forEach((b) => (b.onclick = () => { st.kind = b.dataset.kind; ui.render(); }));
  $("#prevP").onclick = () => { st.date = shiftPeriod(st.kind, period.from, -1); ui.render(); };
  $("#nextP").onclick = () => { st.date = shiftPeriod(st.kind, period.from, 1); ui.render(); };
  $("#nowP").onclick = () => { st.date = null; ui.render(); };
}

/* ---------- Bảng báo cáo một lớp (dùng chung cho giáo viên và Ban giám hiệu) ---------- */
function classReportHtml(rep, period, { clickable }) {
  const t = rep.totals;
  const name = (r) => (clickable ? `<button class="btn link" data-open="${r.id}">${esc(r.fullName)}</button>` : esc(r.fullName));
  return `${!t.days ? `<p class="notice">Chưa có buổi nào được điểm danh trong ${period.kind === "week" ? "tuần" : "tháng"} này.</p>` : ""}
  <div class="stats">
    <div class="stat"><div class="n">${t.days}</div><div class="l">Buổi đã điểm danh</div></div>
    <div class="stat good"><div class="n">${pct(t.rate)}</div><div class="l">Tỉ lệ chuyên cần</div></div>
    <div class="stat ${t.K ? "alert" : ""}"><div class="n">${t.P} / ${t.K}</div><div class="l">Lượt vắng có phép / không phép</div></div>
    <div class="stat ${t.care ? "alert" : ""}"><div class="n">${t.care}</div><div class="l">Em cần quan tâm</div></div>
  </div>
  <p class="hint" style="margin-top:12px">Nhận xét trong kỳ: Hoàn thành tốt ${t.T} · Hoàn thành ${t.H} · Chưa hoàn thành ${t.C} · Ngôi sao ${t.stars}.
    "Cần quan tâm": vắng không phép từ 2 buổi, vắng tổng từ 3 buổi, hoặc có nhận xét "Chưa hoàn thành" trong kỳ.</p>
  ${rep.rows.length ? `<div class="tbl-wrap"><table class="tbl">
    <thead><tr><th class="num">STT</th><th>Họ và tên</th><th class="num">Có mặt</th><th class="num">Vắng CP</th><th class="num">Vắng KP</th><th class="num">Tỉ lệ</th>
      <th class="num">HTT</th><th class="num">HT</th><th class="num">CHT</th><th class="num">Sao</th></tr></thead>
    <tbody>${rep.rows.map((r, i) => `<tr>
      <td class="num">${i + 1}</td>
      <td>${name(r)}${r.care ? ` <span class="tag red">Cần quan tâm</span>` : ""}</td>
      <td class="num">${r.present}/${r.days}</td><td class="num">${r.P}</td><td class="num">${r.K}</td><td class="num">${pct(r.rate)}</td>
      <td class="num">${r.T}</td><td class="num">${r.H}</td><td class="num">${r.C}</td><td class="num">${r.stars}</td></tr>`).join("")}
      <tr class="total"><td></td><td><b>Cả lớp</b></td><td class="num">${t.present}/${t.days * t.students}</td><td class="num">${t.P}</td><td class="num">${t.K}</td>
        <td class="num">${pct(t.rate)}</td><td class="num">${t.T}</td><td class="num">${t.H}</td><td class="num">${t.C}</td><td class="num">${t.stars}</td></tr>
    </tbody></table></div>` : `<p class="empty panel">Lớp chưa có học sinh.</p>`}`;
}

function bindExcel(classId, className, period) {
  $("#xlsx").onclick = (e) => withBusy(e.currentTarget, async () => {
    const res = await api("GET", `/classes/${classId}/report.xlsx?kind=${period.kind}&date=${period.from}`, undefined, { raw: true });
    download(await res.blob(), reportFileName(className, period));
    toast("Đã tải file Excel");
  });
}

/** Giáo viên: báo cáo lớp mình, tính ngay trên máy từ dữ liệu lớp. */
function renderTeacher(view, period) {
  if (!S.cls) {
    view.insertAdjacentHTML("beforeend", `<p class="empty panel">Chưa có lớp nào.</p>`);
    return;
  }
  const rep = classReport({ students: S.students, att: S.att, comments: S.comments, stars: S.stars }, period.from, period.to);
  view.insertAdjacentHTML("beforeend", `<p class="hint">Lớp ${esc(S.cls.name)} · ${esc(teacherName() ? "GVCN: " + teacherName() : "Chưa phân công GVCN")} · Năm học ${esc(yearLabel(S.cls.schoolYear))}</p>
    ${periodBar(period, true)}${classReportHtml(rep, period, { clickable: true })}`);
  bindPeriod(view, period);
  bindExcel(S.cls.id, S.cls.name, period);
}

/** Ban giám hiệu: báo cáo chỉ xem của một lớp, lấy từ máy chủ. */
function renderAdminClass(view, period) {
  view.insertAdjacentHTML("beforeend", `<div class="row" style="margin-bottom:10px"><button class="btn ghost" type="button" id="backSchool">‹ Toàn trường</button></div>
    <div id="classPane"><p class="loading">Đang tải…</p></div>`);
  $("#backSchool").onclick = () => { st.tab = "school"; ui.render(); };
  api("GET", `/classes/${st.classId}/report?kind=${period.kind}&date=${period.from}`).then(({ class: c, report }) => {
    const pane = $("#classPane");
    if (!pane) return;
    const t = c.teacher ? `GVCN: ${c.teacher.title} ${c.teacher.fullName}` : "Chưa phân công GVCN";
    pane.innerHTML = `<h2 style="margin-top:0">Lớp ${esc(c.name)}</h2>
      <p class="hint">${esc(t)} · Năm học ${esc(yearLabel(c.schoolYear))} · Chế độ chỉ xem: dữ liệu lớp do giáo viên chủ nhiệm cập nhật.</p>
      ${periodBar(period, true)}${classReportHtml(report, period, { clickable: false })}`;
    bindPeriod(pane, period);
    bindExcel(c.id, c.name, period);
  }, (e) => {
    const pane = $("#classPane");
    if (pane) pane.innerHTML = `<p class="notice red">${esc(e.message)}</p>`;
  });
}

/* ---------- Toàn trường (Ban giám hiệu) ---------- */
function renderSchool(view, period) {
  view.insertAdjacentHTML("beforeend", `${periodBar(period, false)}<div id="schoolPane"><p class="loading">Đang tổng hợp…</p></div>`);
  bindPeriod(view, period);
  const today = todayISO();
  api("GET", `/admin/overview?kind=${period.kind}&date=${period.from}&today=${today}`).then((data) => {
    const pane = $("#schoolPane");
    if (!pane) return;
    const years = [...new Set(data.classes.map((c) => c.schoolYear))];
    if (!years.includes(st.year)) st.year = years[0] || "";
    const list = data.classes.filter((c) => c.schoolYear === st.year && (!st.grade || String(c.grade) === st.grade));
    const sum = (k) => list.reduce((a, c) => a + c.report[k], 0);
    const slots = list.reduce((a, c) => a + c.report.days * c.report.students, 0);
    const rate = slots ? Math.round((sum("present") / slots) * 1000) / 10 : null;
    const wd = new Date(today + "T00:00").getDay();
    const weekend = wd === 0 || wd === 6;
    const notTaken = weekend ? null : list.filter((c) => c.studentCount > 0 && !c.takenToday).length;

    pane.innerHTML = `<div class="row" style="margin-bottom:14px">
        <label class="field" style="flex-direction:row;align-items:center;gap:8px">Năm học
          <select id="fYear" style="width:auto">${years.map((y) => `<option value="${esc(y)}" ${y === st.year ? "selected" : ""}>${esc(yearLabel(y))}</option>`).join("")}</select></label>
        <label class="field" style="flex-direction:row;align-items:center;gap:8px">Khối
          <select id="fGrade" style="width:auto"><option value="">Tất cả</option>${[1, 2, 3, 4, 5].map((g) => `<option value="${g}" ${String(g) === st.grade ? "selected" : ""}>Khối ${g}</option>`).join("")}</select></label>
      </div>
      <div class="stats">
        <div class="stat"><div class="n">${list.length}</div><div class="l">Lớp · ${sum("students")} học sinh</div></div>
        <div class="stat good"><div class="n">${pct(rate)}</div><div class="l">Chuyên cần chung</div></div>
        <div class="stat ${sum("K") ? "alert" : ""}"><div class="n">${sum("P")} / ${sum("K")}</div><div class="l">Lượt vắng có phép / không phép</div></div>
        <div class="stat ${notTaken ? "alert" : ""}"><div class="n">${weekend ? "—" : notTaken}</div><div class="l">${weekend ? `Hôm nay (${fmt(today)}) là ngày nghỉ cuối tuần` : `Lớp chưa điểm danh hôm nay (${fmt(today)})`}</div></div>
      </div>
      <h2>Các lớp</h2>
      ${list.length ? `<div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Lớp</th><th>GVCN</th><th class="num">Sĩ số</th><th class="num">Buổi</th><th class="num">Tỉ lệ</th>
          <th class="num">Vắng CP</th><th class="num">Vắng KP</th><th class="num">Cần quan tâm</th><th>Hôm nay</th><th><span class="sr">Thao tác</span></th></tr></thead>
        <tbody>${list.map((c) => `<tr>
          <td><b>${esc(c.name)}</b></td>
          <td>${c.teacher ? esc(c.teacher.title + " " + c.teacher.fullName) : `<span class="tag amber">Chưa phân công</span>`}</td>
          <td class="num">${c.studentCount}</td><td class="num">${c.report.days}</td><td class="num">${pct(c.report.rate)}</td>
          <td class="num">${c.report.P}</td><td class="num">${c.report.K}</td>
          <td class="num">${c.report.care ? `<span class="tag red">${c.report.care}</span>` : "0"}</td>
          <td>${c.takenToday ? `<span class="tag green">Đã điểm danh</span>` : !c.studentCount || weekend ? `<span class="muted">—</span>` : `<span class="tag amber">Chưa</span>`}</td>
          <td class="acts"><button class="btn" data-view-class="${c.id}">Xem lớp</button></td></tr>`).join("")}
        </tbody></table></div>` : `<p class="empty panel">Không có lớp nào phù hợp.</p>`}`;

    $("#fYear").onchange = (e) => { st.year = e.target.value; ui.render(); };
    $("#fGrade").onchange = (e) => { st.grade = e.target.value; ui.render(); };
    $$("[data-view-class]", pane).forEach((b) => (b.onclick = () => openClassReport(Number(b.dataset.viewClass))));
  }, (e) => {
    const pane = $("#schoolPane");
    if (pane) pane.innerHTML = `<p class="notice red">${esc(e.message)}</p>`;
  });
}

export function render(view) {
  const period = periodRange(st.kind, st.date || S.curDate);
  view.innerHTML = `<h2>${isAdmin() ? "Tổng hợp" : "Báo cáo"}</h2>`;
  if (!isAdmin()) renderTeacher(view, period);
  else if (st.tab === "class" && st.classId) renderAdminClass(view, period);
  else renderSchool(view, period);
}
