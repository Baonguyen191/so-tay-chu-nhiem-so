import { test } from "node:test";
import assert from "node:assert/strict";
import { absencesBetween, buildAttendance, classRate, monthStats, starTotal, studentRate, weekStart } from "../public/js/shared/stats.js";
import { createClass, createStudent, createUser, loggedIn, makeApp } from "./helpers.js";

const students = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];

test("tỉ lệ chuyên cần lớp = lượt có mặt / (số buổi × sĩ số)", () => {
  const att = buildAttendance(["2026-10-05", "2026-10-06"], [
    { studentId: 1, date: "2026-10-05", status: "P" },
    { studentId: 2, date: "2026-10-06", status: "K" },
  ]);
  // 2 buổi × 4 em = 8 lượt, vắng 2 lượt → 6/8 = 75%.
  assert.equal(classRate(att, students, "2026-10-06"), 75);
  // Chỉ tính đến ngày đang xem.
  assert.equal(classRate(att, students, "2026-10-05"), 75);
  assert.equal(classRate(att, students.slice(1), "2026-10-05"), 100);
});

test("làm tròn một chữ số thập phân", () => {
  const att = buildAttendance(["2026-10-05", "2026-10-06", "2026-10-07"], [{ studentId: 1, date: "2026-10-05", status: "K" }]);
  // 11/12 = 91,666…%
  assert.equal(classRate(att, students, "2026-10-07"), 91.7);
});

test("chỉ tính các ngày đã điểm danh trong tháng đang xem", () => {
  const att = buildAttendance(["2026-09-30", "2026-10-01", "2026-10-20"], [
    { studentId: 1, date: "2026-09-30", status: "K" },
    { studentId: 1, date: "2026-10-20", status: "K" },
  ]);
  assert.equal(classRate(att, students, "2026-10-10"), 100);
  assert.deepEqual(monthStats(att, 1, "2026-10-10"), { days: 1, P: 0, K: 0, present: 1 });
  assert.deepEqual(monthStats(att, 1, "2026-10-31"), { days: 2, P: 0, K: 1, present: 1 });
  assert.deepEqual(monthStats(att, 1, "2026-09-30"), { days: 1, P: 0, K: 1, present: 0 });
});

test("chưa điểm danh buổi nào thì chưa có tỉ lệ", () => {
  assert.equal(classRate({}, students, "2026-10-07"), null);
  assert.equal(classRate(buildAttendance(["2026-10-01"], []), [], "2026-10-07"), null);
  assert.equal(studentRate({ days: 0, present: 0 }), null);
  assert.equal(studentRate({ days: 3, present: 2 }), 66.7);
});

test("thống kê vắng theo tuần, đầu tuần là thứ Hai", () => {
  assert.equal(weekStart("2026-10-07"), "2026-10-05"); // thứ Tư → thứ Hai
  assert.equal(weekStart("2026-10-11"), "2026-10-05"); // Chủ nhật → thứ Hai trước đó
  assert.equal(weekStart("2026-10-05"), "2026-10-05");
  assert.equal(weekStart("2026-03-01"), "2026-02-23"); // qua tháng
  const att = buildAttendance(["2026-10-02", "2026-10-05", "2026-10-06"], [
    { studentId: 1, date: "2026-10-02", status: "K" },
    { studentId: 1, date: "2026-10-05", status: "P" },
    { studentId: 1, date: "2026-10-06", status: "K" },
  ]);
  assert.deepEqual(absencesBetween(att, 1, "2026-10-05", "2026-10-07"), { P: 1, K: 1 });
});

test("cộng sao theo khoảng ngày", () => {
  const stars = [
    { studentId: 1, date: "2026-10-02", delta: 1 },
    { studentId: 1, date: "2026-10-05", delta: 1 },
    { studentId: 1, date: "2026-10-06", delta: -1 },
    { studentId: 1, date: "2026-10-08", delta: 1 },
    { studentId: 2, date: "2026-10-05", delta: 1 },
  ];
  assert.equal(starTotal(stars, 1, "2026-10-05", "2026-10-07"), 0);
  assert.equal(starTotal(stars, 1, null, "2026-10-07"), 1);
  assert.equal(starTotal(stars, 2, "2026-10-05", "2026-10-07"), 1);
});

test("điểm danh qua API rồi tính tỉ lệ từ dữ liệu máy chủ", async () => {
  const { db, app } = makeApp();
  const t = createUser(db, { username: "cohanh" });
  const cid = createClass(db, { teacherId: t });
  const ids = ["An", "Bình", "Chi", "Dung"].map((n) => createStudent(db, cid, "Nguyễn " + n));
  const c = await loggedIn(app, "cohanh");

  // Thứ Hai: cả lớp có mặt. Thứ Ba: 1 em vắng có phép, 1 em vắng không phép.
  assert.equal((await c.put(`/api/classes/${cid}/attendance/2026-10-05`, { absences: {} })).status, 200);
  await c.put(`/api/classes/${cid}/attendance/2026-10-06/students/${ids[0]}`, { status: "P" });
  await c.put(`/api/classes/${cid}/attendance/2026-10-06/students/${ids[1]}`, { status: "P" });
  await c.put(`/api/classes/${cid}/attendance/2026-10-06/students/${ids[1]}`, { status: "K" });
  // Đổi ý: em thứ ba vắng rồi lại có mặt.
  await c.put(`/api/classes/${cid}/attendance/2026-10-06/students/${ids[2]}`, { status: "K" });
  await c.put(`/api/classes/${cid}/attendance/2026-10-06/students/${ids[2]}`, { status: "" });
  // Ngày chọn nhầm rồi hủy điểm danh.
  await c.put(`/api/classes/${cid}/attendance/2026-10-04`, { absences: { [ids[0]]: "K" } });
  assert.equal((await c.delete(`/api/classes/${cid}/attendance/2026-10-04`)).status, 200);

  assert.equal((await c.put(`/api/classes/${cid}/attendance/2026-10-06/students/${ids[0]}`, { status: "X" })).status, 400);
  assert.equal((await c.put(`/api/classes/${cid}/attendance/2026-10-32`, { absences: {} })).status, 400);

  const data = (await c.get(`/api/classes/${cid}/data`)).body;
  assert.deepEqual(data.days, ["2026-10-05", "2026-10-06"]);
  const att = buildAttendance(data.days, data.absences);
  assert.equal(classRate(att, data.students, "2026-10-06"), 75);
  assert.deepEqual(monthStats(att, ids[1], "2026-10-06"), { days: 2, P: 0, K: 1, present: 1 });
  assert.deepEqual(monthStats(att, ids[2], "2026-10-06"), { days: 2, P: 0, K: 0, present: 2 });
});
