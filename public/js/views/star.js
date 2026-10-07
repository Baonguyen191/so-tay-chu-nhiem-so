// Màn hình "Ngôi sao": tặng/trừ sao theo tuần, bảng xếp hạng 3 em đứng đầu.
import { api } from "../api.js";
import { S, byId, ui } from "../store.js";
import { $$, esc, fmt, initials, short, toast } from "../util.js";
import { starTotal, weekStart } from "../shared/stats.js";
import { STAR_REASONS } from "../shared/constants.js";

let reason = STAR_REASONS[0];

export function render(view) {
  if (!S.students.length) {
    view.innerHTML = `<div class="panel pad"><p style="margin:0">Lớp chưa có học sinh. Hãy thêm học sinh ở màn hình Hôm nay.</p></div>`;
    return;
  }
  const d = S.curDate;
  const ws = weekStart(d);
  const ranked = S.students.map((s) => ({ s, n: starTotal(S.stars, s.id, ws, d) })).sort((a, b) => b.n - a.n);
  const top = ranked.filter((x) => x.n > 0).slice(0, 3);

  view.innerHTML = `<h2>Ngôi sao chăm ngoan – tuần từ ${fmt(ws)}</h2>
  ${top.length
    ? `<div class="podium">${top.map((x, i) => `<div class="p"><div class="rank">Hạng ${i + 1}</div><div class="name" style="margin-top:6px">${esc(x.s.fullName)}</div><div class="sub">★ ${x.n} sao</div></div>`).join("")}</div>`
    : `<p class="hint">Tuần này chưa có em nào được tặng sao.</p>`}
  <h2>Tặng sao</h2>
  <p class="hint">Chọn lý do, rồi bấm + hoặc − cạnh tên học sinh.</p>
  <div class="chips" style="margin-bottom:14px" role="radiogroup" aria-label="Lý do">${STAR_REASONS.map((r) => `<button class="chip" type="button" role="radio" aria-checked="${r === reason}" data-r="${esc(r)}">${esc(r)}</button>`).join("")}</div>
  <div class="star-grid">${S.students.map((s) => `<div class="star-card"><div class="avatar">${esc(initials(s.fullName))}</div><div class="grow name">${esc(short(s.fullName))}</div><button class="round" data-m="${s.id}" aria-label="Trừ một sao của ${esc(s.fullName)}">−</button><span class="star-count">★${starTotal(S.stars, s.id, ws, d)}</span><button class="round plus" data-p="${s.id}" aria-label="Tặng một sao cho ${esc(s.fullName)}">+</button></div>`).join("")}</div>`;

  $$("[data-r]", view).forEach((b) => (b.onclick = () => { reason = b.dataset.r; ui.render(); }));
  $$("[data-p],[data-m]", view).forEach((b) => (b.onclick = async () => {
    const plus = !!b.dataset.p;
    const sid = Number(b.dataset.p || b.dataset.m);
    b.disabled = true;
    try {
      const { star } = await api("POST", `/classes/${S.cls.id}/stars`, { studentId: sid, date: d, delta: plus ? 1 : -1, reason });
      S.stars.push(star);
      ui.render();
      toast(`${plus ? "+1" : "−1"} sao cho ${short(byId(sid).fullName)}`);
    } catch (e) {
      b.disabled = false;
      toast(e.message, { error: true });
    }
  }));
}
