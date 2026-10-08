// Màn hình "Phụ huynh": mẫu tin nhắn tự điền dữ liệu học sinh, tên lớp, tên giáo viên.
import { S, byId, pronoun, teacherName, ui } from "../store.js";
import { $, copy, esc, fmt, short, weekday } from "../util.js";
import { absencesBetween, starTotal, weekStart } from "../shared/stats.js";
import { LEVELS } from "../shared/constants.js";

const TPL = {
  absent: { label: "Báo vắng học", need: "absent" },
  praise: { label: "Khen ngợi", need: "one" },
  remind: { label: "Nhắc nhở học tập", need: "one" },
  weekly: { label: "Tổng kết tuần", need: "one" },
  notice: { label: "Thông báo chung", need: "none" },
};

let sid = null;
const status = (id, d) => (S.att[d] || {})[id] || "";

function signature() {
  const name = teacherName();
  return name ? `${name} – GVCN lớp ${S.cls.name}` : `GVCN lớp ${S.cls.name}`;
}

export function buildMsg(tpl, s) {
  const d = S.curDate;
  const ws = weekStart(d);
  const n = s ? short(s.fullName) : "";
  const co = pronoun();
  const Co = pronoun({ capital: true });
  const sign = signature();
  if (tpl === "absent") {
    const v = status(s.id, d);
    return `Kính gửi phụ huynh em ${s.fullName},\nHôm nay (${weekday(d)}, ${fmt(d)}) cháu ${n} ${v === "P" ? "nghỉ học có phép" : "vắng mặt tại lớp mà chưa có thông tin xin phép"}.${v === "K" ? ` Gia đình vui lòng phản hồi để ${co} nắm tình hình của cháu.` : ` ${Co} chúc cháu sớm khỏe và đi học trở lại.`}\n${Co} sẽ gửi lại nội dung bài học hôm nay để cháu theo kịp các bạn.\n${sign}`;
  }
  if (tpl === "praise") {
    const st = S.stars.filter((x) => x.studentId === s.id && x.date >= ws && x.date <= d && x.delta > 0);
    const reasons = [...new Set(st.map((x) => x.reason))];
    const c = S.comments.filter((x) => x.studentId === s.id && x.level === "T").slice(-1)[0];
    return `Kính gửi phụ huynh em ${s.fullName},\nTuần này cháu ${n} đạt ${starTotal(S.stars, s.id, ws, d)} ngôi sao chăm ngoan${reasons.length ? " nhờ: " + reasons.join(", ").toLowerCase() : ""}.${c ? `\nNhận xét môn ${c.subject}: ${c.text}` : ""}\n${Co} rất vui và mong gia đình tiếp tục động viên cháu.\n${sign}`;
  }
  if (tpl === "remind") {
    const c = S.comments.filter((x) => x.studentId === s.id && x.level !== "T").sort((a, b) => b.date.localeCompare(a.date))[0];
    return `Kính gửi phụ huynh em ${s.fullName},\n${Co} xin trao đổi với gia đình về việc học của cháu ${n}.${c ? `\nMôn ${c.subject} (${fmt(c.date)}): ${c.text}` : "\nThời gian gần đây cháu cần tập trung hơn trong giờ học."}\nMong gia đình dành thêm 15–20 phút mỗi tối cùng cháu ôn bài. ${Co} cảm ơn gia đình.\n${sign}`;
  }
  if (tpl === "weekly") {
    const { P, K } = absencesBetween(S.att, s.id, ws, d);
    const cs = S.comments.filter((x) => x.studentId === s.id && x.date >= ws && x.date <= d);
    return `Kính gửi phụ huynh em ${s.fullName},\nTổng kết tuần từ ${fmt(ws)}:\n• Chuyên cần: ${P + K ? `vắng ${P + K} buổi (${P} có phép, ${K} không phép)` : "đi học đầy đủ"}\n• Ngôi sao chăm ngoan: ${starTotal(S.stars, s.id, ws, d)} sao\n${cs.length ? cs.map((c) => `• ${c.subject}: ${LEVELS[c.level]} – ${c.text}`).join("\n") : "• Cháu hoàn thành các nội dung học tập trong tuần."}\n${sign}`;
  }
  return `Kính gửi quý phụ huynh lớp ${S.cls.name},\n[Nội dung thông báo]\nTrân trọng,\n${sign}`;
}

export function render(view) {
  const tpl = TPL[S.msgTemplate] ? S.msgTemplate : (S.msgTemplate = "absent");
  const need = TPL[tpl].need;
  const absent = S.students.filter((s) => status(s.id, S.curDate));
  const pool = need === "absent" ? absent : S.students;
  if (need !== "none" && !pool.find((s) => s.id === sid)) sid = pool[0]?.id ?? null;
  const s = need === "none" ? null : byId(sid);
  const text = need === "none" || s ? buildMsg(tpl, s) : "";

  view.innerHTML = `<h2>Liên lạc phụ huynh</h2>
  <div class="two"><div class="panel pad">
   <label class="field">Mẫu tin nhắn<select id="mt">${Object.entries(TPL).map(([k, v]) => `<option value="${k}" ${k === tpl ? "selected" : ""}>${v.label}</option>`).join("")}</select></label>
   ${need === "none" ? "" : pool.length
     ? `<label class="field">Học sinh${need === "absent" ? " vắng ngày " + fmt(S.curDate) : ""}<select id="ms">${pool.map((x) => `<option value="${x.id}" ${x.id === sid ? "selected" : ""}>${esc(x.fullName)}</option>`).join("")}</select></label>`
     : `<p class="empty" style="padding:6px 0">${S.students.length ? "Lớp đi học đầy đủ, không có tin báo vắng cần gửi." : "Lớp chưa có học sinh."}</p>`}
   ${s ? `<div class="sub">Gửi tới: <b>${esc(s.parentName || "(chưa có tên phụ huynh)")}</b>${s.parentPhone ? " · " + esc(s.parentPhone) : ""}${s.parent2Name || s.parent2Phone ? `<br>hoặc: <b>${esc(s.parent2Name || "phụ huynh thứ hai")}</b>${s.parent2Phone ? " · " + esc(s.parent2Phone) : ""}` : ""}</div>` : ""}
  </div>
  <div>${text ? `<label class="sr" for="mo">Nội dung tin nhắn</label><textarea id="mo" class="msg-out">${esc(text)}</textarea>
   <div class="row" style="margin-top:12px"><button class="btn primary" id="mc">Sao chép tin nhắn</button>${s?.parentPhone ? `<a class="btn" href="sms:${esc(s.parentPhone)}">Mở tin nhắn SMS</a>` : ""}</div>
   <p class="hint" style="margin-top:10px">Sao chép rồi dán vào Zalo hoặc tin nhắn riêng của phụ huynh. Mỗi tin chỉ chứa thông tin của một em.</p>` : ""}</div></div>`;

  $("#mt").onchange = (e) => { S.msgTemplate = e.target.value; ui.render(); };
  const ms = $("#ms");
  if (ms) ms.onchange = (e) => { sid = Number(e.target.value); ui.render(); };
  const mc = $("#mc");
  if (mc) mc.onclick = () => copy($("#mo").value, "Đã sao chép tin nhắn");
}
