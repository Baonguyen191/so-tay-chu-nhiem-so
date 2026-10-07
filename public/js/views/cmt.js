// Màn hình "Nhận xét": ghi nhận xét theo 3 mức của Thông tư 27/2020/TT-BGDĐT.
import { api } from "../api.js";
import { S, byId, ui } from "../store.js";
import { $, $$, esc, fmt, short, toast, withBusy } from "../util.js";
import { LEVELS, QUICK, SUBJECTS } from "../shared/constants.js";

const st = { sid: null, level: "T", subject: SUBJECTS[0], draft: "" };

export function render(view) {
  if (!S.students.length) {
    view.innerHTML = `<div class="panel pad"><p style="margin:0">Lớp chưa có học sinh. Hãy thêm học sinh ở màn hình Hôm nay.</p></div>`;
    return;
  }
  if (!byId(st.sid)) st.sid = S.students[0].id;
  const hist = S.comments.filter((c) => c.studentId === st.sid).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  const cnt = { T: 0, H: 0, C: 0 };
  hist.forEach((c) => cnt[c.level]++);

  view.innerHTML = `<div class="two">
  <div><h2>Ghi nhận xét</h2>
   <div class="panel pad">
    <label class="field">Học sinh<select id="cs">${S.students.map((s) => `<option value="${s.id}" ${s.id === st.sid ? "selected" : ""}>${esc(s.fullName)}</option>`).join("")}</select></label>
    <label class="field">Môn học / Hoạt động<select id="csub">${SUBJECTS.map((x) => `<option ${x === st.subject ? "selected" : ""}>${esc(x)}</option>`).join("")}</select></label>
    <fieldset style="border:0;padding:0;margin:0"><legend class="field" style="margin-bottom:6px">Mức đánh giá (TT 27/2020)</legend>
     <div class="levels">${Object.entries(LEVELS).map(([k, v]) => `<label><input type="radio" name="lv" value="${k}" ${k === st.level ? "checked" : ""}><span>${esc(v)}</span></label>`).join("")}</div></fieldset>
    <label class="field">Nhận xét ngày ${fmt(S.curDate)}<textarea id="ctext" maxlength="1000" placeholder="Viết nhận xét hoặc chọn câu gợi ý bên dưới">${esc(st.draft)}</textarea></label>
    <div class="chips">${QUICK[st.level].map((q) => `<button class="chip" type="button" data-q="${esc(q)}">${esc(q)}</button>`).join("")}</div>
    <div><button class="btn primary" id="csave">Lưu nhận xét</button></div>
   </div></div>
  <div><h2>Lịch sử – ${esc(short(byId(st.sid).fullName))}</h2>
   <div class="row" style="margin-bottom:12px"><span class="tag green">HTT ${cnt.T}</span><span class="tag ink">HT ${cnt.H}</span><span class="tag red">CHT ${cnt.C}</span></div>
   <div class="panel"><ul class="list">${hist.map((c) => `<li style="align-items:flex-start"><div class="grow"><div class="sub">${fmt(c.date)} · ${esc(c.subject)} · <b style="color:${c.level === "C" ? "var(--red)" : c.level === "T" ? "var(--green)" : "var(--ink)"}">${esc(LEVELS[c.level])}</b></div><div class="remark">${esc(c.text)}</div></div><button class="btn ghost small" data-del="${c.id}" aria-label="Xóa nhận xét ngày ${fmt(c.date)}">Xóa</button></li>`).join("") || `<li class="empty">Chưa có nhận xét nào cho em này.</li>`}</ul></div>
  </div></div>`;

  const keepDraft = () => (st.draft = $("#ctext").value);
  $("#cs").onchange = (e) => { st.sid = Number(e.target.value); keepDraft(); ui.render(); };
  $("#csub").onchange = (e) => (st.subject = e.target.value);
  $$('input[name="lv"]', view).forEach((r) => (r.onchange = () => { st.level = r.value; keepDraft(); ui.render(); }));
  $$(".chip", view).forEach((c) => (c.onclick = () => {
    const t = $("#ctext");
    t.value = (t.value ? t.value.trim() + " " : "") + c.dataset.q;
    t.focus();
  }));
  $("#csave").onclick = (e) => {
    const text = $("#ctext").value.trim();
    if (!text) {
      toast("Hãy nhập nội dung nhận xét", { error: true });
      return;
    }
    withBusy(e.currentTarget, async () => {
      const { comment } = await api("POST", `/classes/${S.cls.id}/comments`, {
        studentId: st.sid, date: S.curDate, subject: st.subject, level: st.level, text,
      });
      S.comments.push(comment);
      st.draft = "";
      ui.render();
      toast("Đã lưu nhận xét");
    });
  };
  $$("[data-del]", view).forEach((b) => (b.onclick = () => {
    if (!confirm("Xóa nhận xét này?")) return;
    withBusy(b, async () => {
      await api("DELETE", `/comments/${b.dataset.del}`);
      S.comments = S.comments.filter((c) => c.id !== Number(b.dataset.del));
      keepDraft();
      ui.render();
      toast("Đã xóa nhận xét");
    });
  }));
}
