import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ExcelJS from "exceljs";
import { addMonths, classReport, periodRange, shiftPeriod } from "../public/js/shared/report.js";
import { buildAttendance } from "../public/js/shared/stats.js";
import { runAutoBackup } from "../server/lib/autobackup.js";
import { createClass, createStudent, createUser, loggedIn, makeApp } from "./helpers.js";

test("kỳ báo cáo: tuần từ thứ Hai đến Chủ nhật, tháng đủ ngày (kể cả năm nhuận)", () => {
  assert.deepEqual(periodRange("week", "2026-10-11"), { kind: "week", from: "2026-10-05", to: "2026-10-11", label: "Tuần 05/10/2026 – 11/10/2026", key: "tuan-2026-10-05" });
  assert.equal(periodRange("week", "2026-12-30").to, "2027-01-03");
  assert.deepEqual(periodRange("month", "2028-02-10"), { kind: "month", from: "2028-02-01", to: "2028-02-29", label: "Tháng 2/2028", key: "thang-2028-02" });
  assert.equal(addMonths("2028-01-31", 1), "2028-02-29");
  assert.equal(shiftPeriod("week", "2026-10-05", -1), "2026-09-28");
  assert.equal(shiftPeriod("month", "2026-01-01", -1), "2025-12-01");
});

test("báo cáo lớp: số liệu từng em, cả lớp, em cần quan tâm", () => {
  const students = [{ id: 1, fullName: "An" }, { id: 2, fullName: "Bình" }, { id: 3, fullName: "Chi" }];
  const att = buildAttendance(["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-12"], [
    { studentId: 1, date: "2026-10-05", status: "K" },
    { studentId: 1, date: "2026-10-06", status: "K" },
    { studentId: 2, date: "2026-10-07", status: "P" },
    { studentId: 3, date: "2026-10-12", status: "K" }, // tuần sau, không tính
  ]);
  const comments = [
    { studentId: 3, date: "2026-10-06", level: "C" },
    { studentId: 2, date: "2026-10-06", level: "T" },
    { studentId: 2, date: "2026-09-30", level: "T" }, // tuần trước, không tính
  ];
  const stars = [{ studentId: 2, date: "2026-10-07", delta: 1 }, { studentId: 2, date: "2026-10-08", delta: 1 }, { studentId: 1, date: "2026-10-08", delta: -1 }];
  const { from, to } = periodRange("week", "2026-10-07");
  const r = classReport({ students, att, comments, stars }, from, to);

  assert.deepEqual(r.days, ["2026-10-05", "2026-10-06", "2026-10-07"]);
  assert.deepEqual(r.rows.map((x) => [x.present, x.P, x.K, x.rate, x.T, x.C, x.stars, x.care]), [
    [1, 0, 2, 33.3, 0, 0, -1, true],  // vắng không phép 2 buổi
    [2, 1, 0, 66.7, 1, 0, 2, false],
    [3, 0, 0, 100, 0, 1, 0, true],     // có nhận xét "Chưa hoàn thành"
  ]);
  // 3 buổi × 3 em = 9 lượt, có mặt 6 → 66,7%
  assert.deepEqual(r.totals, { students: 3, days: 3, present: 6, P: 1, K: 2, rate: 66.7, T: 1, H: 0, C: 1, stars: 1, care: 2 });

  const empty = classReport({ students, att: {}, comments: [], stars: [] }, from, to);
  assert.equal(empty.totals.rate, null);
});

async function setup() {
  const ctx = makeApp();
  const { db, app } = ctx;
  createUser(db, { username: "bgh", fullName: "Trần Văn Minh", title: "Thầy", role: "admin" });
  const a = createUser(db, { username: "cohanh" });
  const b = createUser(db, { username: "thaynam", fullName: "Lê Văn Nam", title: "Thầy" });
  ctx.classA = createClass(db, { name: "3A", teacherId: a });
  ctx.classB = createClass(db, { name: "4B", grade: 4, teacherId: b });
  ctx.emptyClass = createClass(db, { name: "5C", grade: 5 });
  ctx.sA = createStudent(db, ctx.classA, "Nguyễn Minh Anh");
  createStudent(db, ctx.classB, "Trần Gia Bảo");
  ctx.teacher = await loggedIn(app, "cohanh");
  ctx.admin = await loggedIn(app, "bgh");
  return ctx;
}

const binary = (res, cb) => {
  const chunks = [];
  res.on("data", (c) => chunks.push(c));
  res.on("end", () => cb(null, Buffer.concat(chunks)));
};

test("API báo cáo Excel: giáo viên tải được lớp mình, không tải được lớp khác", async () => {
  const { teacher, classA, classB, sA } = await setup();
  await teacher.put(`/api/classes/${classA}/attendance/2026-10-05/students/${sA}`, { status: "K" });
  await teacher.put(`/api/classes/${classA}/attendance/2026-10-06`, { absences: {} });

  const res = await teacher.agent.get(`/api/classes/${classA}/report.xlsx?kind=week&date=2026-10-07`).buffer(true).parse(binary);
  assert.equal(res.status, 200);
  assert.match(res.headers["content-type"], /spreadsheetml/);
  assert.match(res.headers["content-disposition"], /bao-cao-lop-3A-tuan-2026-10-05\.xlsx/);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(res.body);
  const ws = wb.worksheets[0];
  assert.match(ws.getCell("A1").value, /BÁO CÁO LỚP 3A – TUẦN 05\/10\/2026/);
  assert.equal(ws.getRow(6).getCell(2).value, "Nguyễn Minh Anh");
  assert.deepEqual([3, 4, 5, 6, 7].map((c) => ws.getRow(6).getCell(c).value), [2, 1, 0, 1, 50]);

  assert.equal((await teacher.get(`/api/classes/${classB}/report.xlsx?kind=week&date=2026-10-07`)).status, 404);
  assert.equal((await teacher.get(`/api/classes/${classA}/report.xlsx?kind=nam&date=2026-10-07`)).status, 400);
  assert.equal((await teacher.get(`/api/classes/${classA}/report.xlsx?kind=week&date=2026-13-01`)).status, 400);
});

test("API tổng hợp toàn trường: chỉ quản trị; đánh dấu lớp chưa điểm danh hôm nay", async () => {
  const { teacher, admin, classA, classB, emptyClass, sA } = await setup();
  assert.equal((await teacher.get("/api/admin/overview?kind=month&date=2026-10-01&today=2026-10-07")).status, 403);

  await admin.put(`/api/classes/${classA}/attendance/2026-10-07/students/${sA}`, { status: "P" });
  const res = await admin.get("/api/admin/overview?kind=month&date=2026-10-01&today=2026-10-07");
  assert.equal(res.status, 200);
  const byId = Object.fromEntries(res.body.classes.map((c) => [c.id, c]));
  assert.equal(byId[classA].takenToday, true);
  assert.equal(byId[classB].takenToday, false);
  assert.equal(byId[classA].report.P, 1);
  assert.equal(byId[classA].report.rate, 0);
  assert.equal(byId[emptyClass].studentCount, 0);
  assert.equal(res.body.totals.classes, 3);
  assert.equal(res.body.totals.students, 2);
  assert.equal(res.body.totals.notTakenToday, 1, "lớp chưa có học sinh không bị tính là chưa điểm danh");
  assert.equal(res.body.period.label, "Tháng 10/2026");
});

test("tự sao lưu: mỗi ngày một bản, giữ 14 bản gần nhất, không xóa bản khác", async () => {
  const { db } = makeApp();
  createUser(db, { username: "bgh", role: "admin" });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sotay-tu-dong-"));
  try {
    for (let d = 1; d <= 16; d++) fs.writeFileSync(path.join(dir, `tu-dong-202609${String(d).padStart(2, "0")}.sqlite`), "cu");
    fs.writeFileSync(path.join(dir, "truoc-khoi-phuc-20260901-080000.sqlite"), "giu");

    const now = new Date(2026, 9, 11, 7, 0);
    const made = runAutoBackup(db, dir, { now, keep: 14 });
    assert.equal(path.basename(made), "tu-dong-20261011.sqlite");
    assert.equal(runAutoBackup(db, dir, { now, keep: 14 }), null, "đã có bản hôm nay thì không tạo nữa");

    const files = fs.readdirSync(dir);
    assert.equal(files.filter((f) => f.startsWith("tu-dong-")).length, 14);
    assert.ok(files.includes("tu-dong-20261011.sqlite"));
    assert.ok(!files.includes("tu-dong-20260903.sqlite"), "bản cũ nhất bị xóa");
    assert.ok(files.includes("truoc-khoi-phuc-20260901-080000.sqlite"));
    assert.equal(fs.readFileSync(made).subarray(0, 15).toString(), "SQLite format 3");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
