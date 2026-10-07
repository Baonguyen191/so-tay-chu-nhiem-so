// Trạng thái dùng chung của giao diện: người dùng, lớp đang chọn, dữ liệu lớp.
import { api } from "./api.js";
import { buildAttendance } from "./shared/stats.js";
import { todayISO } from "./util.js";

export const S = {
  user: null,
  classes: [],
  cls: null, // lớp đang làm việc
  students: [],
  att: {}, // { ngày: { mãHọcSinh: "P" | "K" } } – chỉ gồm các ngày đã điểm danh
  comments: [],
  stars: [],
  curDate: todayISO(),
  view: "home",
};

/** app.js gắn các hàm vẽ lại / chuyển màn hình vào đây để các màn hình con dùng. */
export const ui = { render: () => {}, go: () => {}, header: () => {}, switchClass: async () => {}, refreshClasses: async () => {} };

export async function loadClasses() {
  S.classes = (await api("GET", "/classes")).classes;
}

export async function loadClassData(id) {
  if (!id) {
    Object.assign(S, { cls: null, students: [], att: {}, comments: [], stars: [] });
    return;
  }
  const d = await api("GET", `/classes/${id}/data`);
  Object.assign(S, {
    cls: d.class,
    students: d.students,
    att: buildAttendance(d.days, d.absences),
    comments: d.comments,
    stars: d.stars,
  });
}

export const reloadClass = () => loadClassData(S.cls?.id);

export const byId = (id) => S.students.find((s) => s.id === Number(id));

/** "Cô Nguyễn Thị Hạnh" – hoặc rỗng nếu lớp chưa phân công. */
export function teacherName() {
  const t = S.cls?.teacher;
  return t ? `${t.title} ${t.fullName}` : "";
}

/** Cách giáo viên xưng hô trong tin nhắn: "cô" / "thầy". */
export function pronoun({ capital = false } = {}) {
  const w = (S.cls?.teacher?.title || "thầy/cô").toLowerCase();
  return capital ? w[0].toUpperCase() + w.slice(1) : w;
}

// Ghi lần lượt từng thao tác để máy chủ nhận đúng thứ tự (ví dụ chạm nhanh nhiều lần khi điểm danh).
let queue = Promise.resolve();
export function enqueue(fn) {
  const p = queue.then(fn);
  queue = p.catch(() => {});
  return p;
}
