import { test } from "node:test";
import assert from "node:assert/strict";
import { Client, createClass, createStudent, createUser, loggedIn, makeApp } from "./helpers.js";

/** Hai giáo viên, mỗi người một lớp, cộng một quản trị. */
async function setup() {
  const ctx = makeApp();
  const { db, app } = ctx;
  ctx.adminId = createUser(db, { username: "bgh", fullName: "Trần Văn Minh", title: "Thầy", role: "admin" });
  ctx.aId = createUser(db, { username: "cohanh", fullName: "Nguyễn Thị Hạnh" });
  ctx.bId = createUser(db, { username: "thaynam", fullName: "Lê Văn Nam", title: "Thầy" });
  ctx.classA = createClass(db, { name: "3A", teacherId: ctx.aId });
  ctx.classB = createClass(db, { name: "4B", grade: 4, teacherId: ctx.bId });
  ctx.studentA = createStudent(db, ctx.classA, "Nguyễn Minh Anh");
  ctx.studentB = createStudent(db, ctx.classB, "Trần Gia Bảo");
  ctx.commentB = Number(db.prepare("INSERT INTO comments (student_id, date, subject, level, text) VALUES (?, '2026-10-05', 'Toán', 'T', 'Giỏi')").run(ctx.studentB).lastInsertRowid);
  ctx.a = await loggedIn(app, "cohanh");
  ctx.admin = await loggedIn(app, "bgh");
  return ctx;
}

test("giáo viên chỉ thấy lớp mình chủ nhiệm", async () => {
  const { a, admin, classA } = await setup();
  const mine = await a.get("/api/classes");
  assert.deepEqual(mine.body.classes.map((c) => c.id), [classA]);
  assert.equal(mine.body.classes[0].teacher.fullName, "Nguyễn Thị Hạnh");
  assert.equal((await admin.get("/api/classes")).body.classes.length, 2);
});

test("giáo viên không đọc được lớp khác dù sửa đường dẫn", async () => {
  const { a, classA, classB } = await setup();
  assert.equal((await a.get(`/api/classes/${classA}/data`)).status, 200);
  assert.equal((await a.get(`/api/classes/${classB}/data`)).status, 404);
  // Dò lần lượt các mã lớp: chỉ đúng lớp mình là đọc được.
  for (let id = 1; id <= 10; id++) {
    const res = await a.get(`/api/classes/${id}/data`);
    assert.equal(res.status, id === classA ? 200 : 404, `lớp ${id}`);
  }
  assert.equal((await a.get("/api/classes/abc/data")).status, 404);
});

test("giáo viên không sửa được dữ liệu lớp khác", async () => {
  const { a, db, classA, classB, studentB, commentB } = await setup();
  const before = db.prepare("SELECT * FROM students WHERE id = ?").get(studentB);

  const attempts = [
    () => a.put(`/api/students/${studentB}`, { fullName: "Bị sửa" }),
    () => a.delete(`/api/students/${studentB}`),
    () => a.post(`/api/classes/${classB}/students`, { fullName: "Học Sinh Lạ" }),
    () => a.post(`/api/classes/${classB}/students/import/preview`, { text: "Học Sinh Lạ" }),
    () => a.post(`/api/classes/${classB}/students/import`, { rows: [{ fullName: "Học Sinh Lạ" }] }),
    () => a.put(`/api/classes/${classB}/attendance/2026-10-06`, { absences: {} }),
    () => a.put(`/api/classes/${classB}/attendance/2026-10-06/students/${studentB}`, { status: "K" }),
    () => a.delete(`/api/classes/${classB}/attendance/2026-10-06`),
    () => a.post(`/api/classes/${classB}/comments`, { studentId: studentB, date: "2026-10-06", subject: "Toán", level: "C", text: "x" }),
    () => a.post(`/api/classes/${classB}/stars`, { studentId: studentB, date: "2026-10-06", delta: -1, reason: "Nói chuyện riêng" }),
    () => a.delete(`/api/comments/${commentB}`),
    // Gửi qua đường dẫn lớp mình nhưng mã học sinh của lớp khác.
    () => a.post(`/api/classes/${classA}/comments`, { studentId: studentB, date: "2026-10-06", subject: "Toán", level: "C", text: "x" }),
    () => a.post(`/api/classes/${classA}/stars`, { studentId: studentB, date: "2026-10-06", delta: 1, reason: "Tiến bộ" }),
    () => a.put(`/api/classes/${classA}/attendance/2026-10-06`, { absences: { [studentB]: "K" } }),
    () => a.put(`/api/classes/${classA}/attendance/2026-10-06/students/${studentB}`, { status: "K" }),
  ];
  for (const [i, attempt] of attempts.entries()) {
    const res = await attempt();
    assert.equal(res.status, 404, `thử ${i}: ${JSON.stringify(res.body)}`);
  }

  assert.deepEqual(db.prepare("SELECT * FROM students WHERE id = ?").get(studentB), before);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM students WHERE class_id = ?").get(classB).n, 1);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM absences").get().n, 0);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM stars").get().n, 0);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM comments").get().n, 1);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM attendance_days WHERE class_id = ?").get(classB).n, 0);
});

test("giáo viên làm việc bình thường với lớp mình", async () => {
  const { a, classA, studentA } = await setup();
  assert.equal((await a.put(`/api/classes/${classA}/attendance/2026-10-06/students/${studentA}`, { status: "P" })).status, 200);
  assert.equal((await a.post(`/api/classes/${classA}/comments`, { studentId: studentA, date: "2026-10-06", subject: "Toán", level: "T", text: "Tính nhanh." })).status, 201);
  assert.equal((await a.post(`/api/classes/${classA}/stars`, { studentId: studentA, date: "2026-10-06", delta: 1, reason: "Tiến bộ" })).status, 201);
  const data = (await a.get(`/api/classes/${classA}/data`)).body;
  assert.deepEqual(data.days, ["2026-10-06"]);
  assert.deepEqual(data.absences, [{ studentId: studentA, date: "2026-10-06", status: "P" }]);
  assert.equal(data.comments.length, 1);
  assert.equal(data.stars.length, 1);
});

test("giáo viên không dùng được chức năng quản trị", async () => {
  const { a, aId, classA } = await setup();
  assert.equal((await a.get("/api/admin/users")).status, 403);
  assert.equal((await a.post("/api/admin/users", { username: "moi", fullName: "Người Mới", title: "Cô", password: "12345678", role: "admin" })).status, 403);
  assert.equal((await a.patch(`/api/admin/users/${aId}`, { role: "admin" })).status, 403);
  assert.equal((await a.post(`/api/admin/users/${aId}/password`, { password: "12345678" })).status, 403);
  assert.equal((await a.post("/api/admin/classes", { name: "5C", grade: 5, schoolYear: "2026-2027", schoolName: "X Y" })).status, 403);
  assert.equal((await a.patch(`/api/admin/classes/${classA}`, { teacherId: null })).status, 403);
});

test("quản trị xem và sửa được mọi lớp", async () => {
  const { admin, classB, studentB } = await setup();
  assert.equal((await admin.get(`/api/classes/${classB}/data`)).status, 200);
  const res = await admin.put(`/api/students/${studentB}`, { fullName: "Trần Gia Bảo", parentPhone: "0912 345 678" });
  assert.equal(res.status, 200);
  assert.equal(res.body.student.parentPhone, "0912345678");
});

test("đổi phân công: giáo viên cũ mất quyền, giáo viên mới có quyền", async () => {
  const { app, admin, a, classA, bId } = await setup();
  const res = await admin.patch(`/api/admin/classes/${classA}`, { name: "3A", grade: 3, schoolYear: "2026-2027", schoolName: "Trường Tiểu học Tân Minh", teacherId: bId });
  assert.equal(res.status, 200);
  assert.equal(res.body.class.teacher.fullName, "Lê Văn Nam");
  assert.equal((await a.get(`/api/classes/${classA}/data`)).status, 404);
  const b = await loggedIn(app, "thaynam");
  assert.equal((await b.get("/api/classes")).body.classes.length, 2);
});

test("quản trị: tạo, sửa, khóa tài khoản và đặt lại mật khẩu", async () => {
  const { app, admin, a, aId, adminId } = await setup();

  const created = await admin.post("/api/admin/users", { username: "CoLan", fullName: "Phạm Thị Lan", title: "Cô", password: "matkhau123" });
  assert.equal(created.status, 201);
  assert.equal(created.body.user.username, "colan");
  assert.equal(created.body.user.role, "teacher");
  assert.equal((await admin.post("/api/admin/users", { username: "colan", fullName: "Người Khác", title: "Cô", password: "matkhau123" })).status, 409);

  const edited = await admin.patch(`/api/admin/users/${aId}`, { fullName: "Nguyễn Thị Hồng Hạnh" });
  assert.equal(edited.body.user.fullName, "Nguyễn Thị Hồng Hạnh");

  // Khóa: phiên đang mở bị đóng ngay.
  assert.equal((await admin.patch(`/api/admin/users/${aId}`, { isLocked: true })).status, 200);
  assert.equal((await a.get("/api/state")).body.user, null);
  assert.equal((await new Client(app).login("cohanh")).status, 403);
  await admin.patch(`/api/admin/users/${aId}`, { isLocked: false });

  // Đặt lại mật khẩu.
  assert.equal((await admin.post(`/api/admin/users/${aId}/password`, { password: "ngan" })).status, 400);
  assert.equal((await admin.post(`/api/admin/users/${aId}/password`, { password: "matkhaumoi9" })).status, 200);
  assert.equal((await new Client(app).login("cohanh", "matkhaumoi9")).status, 200);

  // Không tự khóa hoặc tự bỏ quyền quản trị.
  assert.equal((await admin.patch(`/api/admin/users/${adminId}`, { isLocked: true })).status, 400);
  assert.equal((await admin.patch(`/api/admin/users/${adminId}`, { role: "teacher" })).status, 400);

  const list = (await admin.get("/api/admin/users")).body.users;
  assert.equal(list[0].role, "admin");
  assert.ok(list.every((u) => !("password_hash" in u) && !("passwordHash" in u)));
  assert.deepEqual(list.find((u) => u.id === aId).classes, ["3A (2026-2027)"]);
});

test("quản trị: tạo lớp, kiểm tra dữ liệu, không xóa lớp còn học sinh", async () => {
  const { admin, aId, classA } = await setup();
  const body = { name: "Lớp 2C", grade: 2, schoolYear: "2027 – 2028", schoolName: "Trường Tiểu học Tân Minh", teacherId: aId };
  const res = await admin.post("/api/admin/classes", body);
  assert.equal(res.status, 201);
  assert.equal(res.body.class.name, "2C");
  assert.equal(res.body.class.schoolYear, "2027-2028");
  assert.equal((await admin.post("/api/admin/classes", body)).status, 409);
  assert.equal((await admin.post("/api/admin/classes", { ...body, name: "2D", grade: 6 })).status, 400);
  assert.equal((await admin.post("/api/admin/classes", { ...body, name: "2D", schoolYear: "2027-2029" })).status, 400);
  assert.equal((await admin.post("/api/admin/classes", { ...body, name: "2D", teacherId: 999 })).status, 400);

  assert.equal((await admin.delete(`/api/admin/classes/${classA}`)).status, 400);
  assert.equal((await admin.delete(`/api/admin/classes/${res.body.class.id}`)).status, 200);
});
