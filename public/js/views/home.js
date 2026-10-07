// Màn hình "Hôm nay": số liệu nhanh, cần quan tâm, sức khỏe, danh sách học sinh.
import { S } from "../store.js";
import { $, $$, copy, esc, fmt, initials, todayISO } from "../util.js";
import { classRate, monthStats, starTotal, studentRate, weekStart } from "../shared/stats.js";
import { openStudent } from "./student.js";
import { openImport } from "./import.js";

let query = "";
const status = (sid, d) => (S.att[d] || {})[sid] || "";

function careList() {
  const month = S.curDate.slice(0, 7);
  return S.students.map((s) => {
    const m = monthStats(S.att, s.id, S.curDate);
    const c = S.comments.filter((x) => x.studentId === s.id && x.level === "C" && x.date.slice(0, 7) === month).length;
    const why = [];
    if (m.K >= 2) why.push(`Vắng không phép ${m.K} buổi`);
    else if (m.P + m.K >= 3) why.push(`Vắng ${m.P + m.K} buổi`);
    if (c) why.push(`${c} nhận xét “Chưa hoàn thành”`);
    return { s, why };
  }).filter((x) => x.why.length);
}

function emptyClass(view) {
  view.innerHTML = `<div class="panel pad">
    <h2 style="margin:0">Lớp chưa có học sinh</h2>
    <p style="margin:0">Thầy/cô có thể thêm từng em, hoặc dán/tải lên cả danh sách từ Excel.</p>
    <div class="row"><button class="btn primary" id="imp">Nhập danh sách từ Excel</button><button class="btn" id="add">Thêm một học sinh</button></div>
  </div>`;
  $("#imp").onclick = openImport;
  $("#add").onclick = () => openStudent(null);
}

export function render(view) {
  if (!S.students.length) return emptyClass(view);
  const d = S.curDate;
  const recorded = !!S.att[d];
  const absent = S.students.filter((s) => status(s.id, d));
  const rate = classRate(S.att, S.students, d);
  const ws = weekStart(d);
  const care = careList();
  const health = S.students.filter((s) => s.healthNote);
  const dayLabel = d === todayISO() ? "hôm nay" : fmt(d);

  view.innerHTML = `
  <div class="stats">
    <div class="stat"><div class="n">${S.students.length}</div><div class="l">Sĩ số lớp</div></div>
    <div class="stat good"><div class="n">${recorded ? S.students.length - absent.length : "—"}</div><div class="l">${recorded ? `Có mặt ${dayLabel}` : `Chưa điểm danh ${dayLabel}`}</div></div>
    <div class="stat ${absent.length ? "alert" : ""}"><div class="n">${recorded ? absent.length : "—"}</div><div class="l">Vắng</div></div>
    <div class="stat"><div class="n">${rate === null ? "—" : String(rate).replace(".", ",") + "%"}</div><div class="l">Chuyên cần tháng ${+d.slice(5, 7)}</div></div>
  </div>
  <div class="two">
    <div><h2>Cần quan tâm</h2><div class="panel"><ul class="list">${care.length ? care.map((x) => `<li><div class="avatar">${esc(initials(x.s.fullName))}</div><div class="grow"><button class="btn link" data-open="${x.s.id}"><span class="name">${esc(x.s.fullName)}</span></button><div class="sub">${esc(x.why.join(" · "))}</div></div><span class="tag red">Theo dõi</span></li>`).join("") : `<li class="empty">Chưa có học sinh nào cần lưu ý trong tháng.</li>`}</ul></div></div>
    <div><h2>Lưu ý sức khỏe</h2><div class="panel"><ul class="list">${health.map((s) => `<li><div class="avatar">${esc(initials(s.fullName))}</div><div class="grow"><div class="name">${esc(s.fullName)}</div><div class="sub">${esc(s.healthNote)}</div></div></li>`).join("") || `<li class="empty">Không có ghi chú.</li>`}</ul></div></div>
  </div>
  <h2>Danh sách học sinh</h2>
  <div class="row" style="margin-bottom:12px">
    <input class="search" style="margin:0;flex:1;min-width:200px" id="q" type="search" placeholder="Tìm theo tên…" value="${esc(query)}" aria-label="Tìm học sinh">
    <button class="btn" id="add">Thêm học sinh</button>
    <button class="btn" id="imp">Nhập danh sách</button>
    <button class="btn" id="copyAll">Sao chép bảng chuyên cần</button>
  </div>
  <div class="panel"><ul class="list" id="stList">${S.students.map((s) => {
    const st = status(s.id, d);
    return `<li data-q="${esc(s.fullName.toLocaleLowerCase("vi"))}"><div class="avatar">${esc(initials(s.fullName))}</div><div class="grow"><button class="btn link" data-open="${s.id}"><span class="name">${esc(s.fullName)}</span></button><div class="sub">${s.parentName || s.parentPhone ? `PH: ${esc([s.parentName, s.parentPhone].filter(Boolean).join(" · "))}` : "Chưa có thông tin phụ huynh"}</div></div><span class="tag ink">★ ${starTotal(S.stars, s.id, ws, d)}</span>${st ? `<span class="tag ${st === "K" ? "red" : "amber"}">${st === "K" ? "Vắng KP" : "Vắng CP"}</span>` : ""}</li>`;
  }).join("")}<li class="empty" id="noMatch" hidden>Không tìm thấy học sinh.</li></ul></div>`;

  const filter = () => {
    const q = query.trim().toLocaleLowerCase("vi");
    let shown = 0;
    $$("#stList li[data-q]").forEach((li) => {
      li.hidden = !!q && !li.dataset.q.includes(q);
      if (!li.hidden) shown++;
    });
    $("#noMatch").hidden = shown > 0;
  };
  $("#q").oninput = (e) => { query = e.target.value; filter(); };
  filter();
  $("#add").onclick = () => openStudent(null);
  $("#imp").onclick = openImport;
  $("#copyAll").onclick = () => {
    const monthStart = d.slice(0, 7) + "-01";
    const rows = [["STT", "Họ và tên", "Ngày sinh", "Số buổi", "Có mặt", "Vắng có phép", "Vắng không phép", "Tỉ lệ chuyên cần (%)", "Ngôi sao tháng"].join("\t")];
    S.students.forEach((s, i) => {
      const m = monthStats(S.att, s.id, d);
      const r = studentRate(m);
      rows.push([i + 1, s.fullName, fmt(s.dob), m.days, m.present, m.P, m.K, r === null ? "" : String(r).replace(".", ","), starTotal(S.stars, s.id, monthStart, d)].join("\t"));
    });
    copy(rows.join("\n"), "Đã sao chép – dán vào Excel");
  };
}
