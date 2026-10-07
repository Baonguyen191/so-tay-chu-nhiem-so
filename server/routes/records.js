// API điểm danh, nhận xét, ngôi sao.
import { Router } from "express";
import { getAccessibleClass, getAccessibleStudent, requireAuth } from "../auth.js";
import { badRequest, idParam, notFound } from "../http.js";
import { cleanText, isISODate } from "../../public/js/shared/validate.js";
import { LEVELS, STAR_REASONS, SUBJECTS } from "../../public/js/shared/constants.js";

function dateParam(value) {
  if (!isISODate(value)) throw badRequest("Ngày không hợp lệ");
  return value;
}

/** Học sinh phải thuộc đúng lớp đang thao tác. */
function studentInClass(db, classId, studentId) {
  const id = Number(studentId);
  if (!Number.isSafeInteger(id) || !db.prepare("SELECT 1 FROM students WHERE id = ? AND class_id = ?").get(id, classId)) {
    throw notFound("Không tìm thấy học sinh trong lớp này");
  }
  return id;
}

export function recordRoutes() {
  const r = Router();
  r.use(["/classes/:cid/attendance", "/classes/:cid/comments", "/classes/:cid/stars", "/comments"], requireAuth);

  const loadClass = (req) => getAccessibleClass(req.app.locals.db, req.user, idParam(req.params.cid));

  // Ghi nhận ngày đã điểm danh và đặt lại toàn bộ trạng thái vắng của ngày đó.
  // body.absences: { [studentId]: "P" | "K" } — để trống nghĩa là cả lớp có mặt.
  r.put("/classes/:cid/attendance/:date", (req, res) => {
    const { db } = req.app.locals;
    const cls = loadClass(req);
    const date = dateParam(req.params.date);
    const absences = req.body?.absences ?? {};
    if (typeof absences !== "object" || Array.isArray(absences)) throw badRequest("Dữ liệu điểm danh không hợp lệ");
    const entries = Object.entries(absences).map(([sid, status]) => {
      if (status !== "P" && status !== "K") throw badRequest("Trạng thái điểm danh không hợp lệ");
      return [studentInClass(db, cls.id, sid), status];
    });
    db.transaction(() => {
      db.prepare("INSERT OR IGNORE INTO attendance_days (class_id, date) VALUES (?, ?)").run(cls.id, date);
      db.prepare("DELETE FROM absences WHERE date = ? AND student_id IN (SELECT id FROM students WHERE class_id = ?)").run(date, cls.id);
      const ins = db.prepare("INSERT INTO absences (student_id, date, status) VALUES (?, ?, ?)");
      for (const [sid, status] of entries) ins.run(sid, date, status);
    })();
    res.json({ ok: true });
  });

  // Đổi trạng thái một em: "" (có mặt), "P" (vắng có phép), "K" (vắng không phép).
  r.put("/classes/:cid/attendance/:date/students/:sid", (req, res) => {
    const { db } = req.app.locals;
    const cls = loadClass(req);
    const date = dateParam(req.params.date);
    const sid = studentInClass(db, cls.id, req.params.sid);
    const status = req.body?.status ?? "";
    if (!["", "P", "K"].includes(status)) throw badRequest("Trạng thái điểm danh không hợp lệ");
    db.transaction(() => {
      db.prepare("INSERT OR IGNORE INTO attendance_days (class_id, date) VALUES (?, ?)").run(cls.id, date);
      if (status) {
        db.prepare("INSERT INTO absences (student_id, date, status) VALUES (?, ?, ?) ON CONFLICT (student_id, date) DO UPDATE SET status = excluded.status")
          .run(sid, date, status);
      } else {
        db.prepare("DELETE FROM absences WHERE student_id = ? AND date = ?").run(sid, date);
      }
    })();
    res.json({ ok: true });
  });

  // Hủy điểm danh một ngày (ví dụ chọn nhầm ngày nghỉ).
  r.delete("/classes/:cid/attendance/:date", (req, res) => {
    const { db } = req.app.locals;
    const cls = loadClass(req);
    const date = dateParam(req.params.date);
    db.transaction(() => {
      db.prepare("DELETE FROM attendance_days WHERE class_id = ? AND date = ?").run(cls.id, date);
      db.prepare("DELETE FROM absences WHERE date = ? AND student_id IN (SELECT id FROM students WHERE class_id = ?)").run(date, cls.id);
    })();
    res.json({ ok: true });
  });

  r.post("/classes/:cid/comments", (req, res) => {
    const { db } = req.app.locals;
    const cls = loadClass(req);
    const b = req.body || {};
    const sid = studentInClass(db, cls.id, b.studentId);
    const date = dateParam(b.date);
    if (!SUBJECTS.includes(b.subject)) throw badRequest("Môn học không hợp lệ");
    if (!Object.hasOwn(LEVELS, b.level)) throw badRequest("Mức đánh giá không hợp lệ");
    const text = cleanText(b.text);
    if (!text) throw badRequest("Hãy nhập nội dung nhận xét");
    if (text.length > 1000) throw badRequest("Nhận xét dài quá 1000 ký tự");
    const info = db.prepare("INSERT INTO comments (student_id, date, subject, level, text, created_by) VALUES (?, ?, ?, ?, ?, ?)")
      .run(sid, date, b.subject, b.level, text, req.user.id);
    res.status(201).json({ comment: { id: Number(info.lastInsertRowid), studentId: sid, date, subject: b.subject, level: b.level, text } });
  });

  r.delete("/comments/:id", (req, res) => {
    const { db } = req.app.locals;
    const c = db.prepare("SELECT * FROM comments WHERE id = ?").get(idParam(req.params.id));
    if (!c) throw notFound("Không tìm thấy nhận xét");
    getAccessibleStudent(db, req.user, c.student_id);
    db.prepare("DELETE FROM comments WHERE id = ?").run(c.id);
    res.json({ ok: true });
  });

  r.post("/classes/:cid/stars", (req, res) => {
    const { db } = req.app.locals;
    const cls = loadClass(req);
    const b = req.body || {};
    const sid = studentInClass(db, cls.id, b.studentId);
    const date = dateParam(b.date);
    if (b.delta !== 1 && b.delta !== -1) throw badRequest("Số sao không hợp lệ");
    if (!STAR_REASONS.includes(b.reason)) throw badRequest("Lý do không hợp lệ");
    const info = db.prepare("INSERT INTO stars (student_id, date, delta, reason, created_by) VALUES (?, ?, ?, ?, ?)")
      .run(sid, date, b.delta, b.reason, req.user.id);
    res.status(201).json({ star: { id: Number(info.lastInsertRowid), studentId: sid, date, delta: b.delta, reason: b.reason } });
  });

  return r;
}
