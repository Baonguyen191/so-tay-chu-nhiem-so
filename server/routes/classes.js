// API lớp học: danh sách lớp, quản trị lớp, toàn bộ dữ liệu của một lớp.
import { Router } from "express";
import { getAccessibleClass, requireAdmin, requireAuth } from "../auth.js";
import { HttpError, badRequest, ensureValid, idParam, notFound } from "../http.js";
import { validateClass } from "../../public/js/shared/validate.js";
import { sortByVietnameseName } from "../../public/js/shared/vnsort.js";

const CLASS_SELECT = `
  SELECT c.*, u.full_name AS teacher_name, u.title AS teacher_title,
         (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id) AS student_count
  FROM classes c LEFT JOIN users u ON u.id = c.teacher_id`;
const CLASS_ORDER = "ORDER BY c.school_year DESC, c.grade, c.name";

export function classDto(row) {
  return {
    id: row.id,
    name: row.name,
    grade: row.grade,
    schoolYear: row.school_year,
    schoolName: row.school_name,
    teacherId: row.teacher_id,
    teacher: row.teacher_id ? { fullName: row.teacher_name, title: row.teacher_title } : null,
    studentCount: row.student_count,
  };
}

export function studentDto(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    dob: row.dob,
    gender: row.gender,
    parentName: row.parent_name,
    parentPhone: row.parent_phone,
    healthNote: row.health_note,
    parent2Name: row.parent2_name,
    parent2Phone: row.parent2_phone,
  };
}

function readClassBody(db, body = {}) {
  const value = ensureValid(validateClass(body));
  let teacherId = null;
  if (body.teacherId !== null && body.teacherId !== undefined && body.teacherId !== "") {
    teacherId = Number(body.teacherId);
    if (!Number.isSafeInteger(teacherId) || !db.prepare("SELECT 1 FROM users WHERE id = ?").get(teacherId)) {
      throw badRequest("Giáo viên được phân công không tồn tại");
    }
  }
  return { ...value, teacherId };
}

function saveClass(db, sql, params) {
  try {
    return db.prepare(sql).run(...params);
  } catch (e) {
    if (String(e.code).startsWith("SQLITE_CONSTRAINT_UNIQUE")) throw new HttpError(409, "Trường đã có lớp này trong năm học đó");
    throw e;
  }
}

export function classRoutes() {
  const r = Router();

  r.get("/classes", requireAuth, (req, res) => {
    const { db } = req.app.locals;
    const rows = req.user.role === "admin"
      ? db.prepare(`${CLASS_SELECT} ${CLASS_ORDER}`).all()
      : db.prepare(`${CLASS_SELECT} WHERE c.teacher_id = ? ${CLASS_ORDER}`).all(req.user.id);
    res.json({ classes: rows.map(classDto) });
  });

  r.get("/classes/:cid/data", requireAuth, (req, res) => {
    const { db } = req.app.locals;
    const cls = getAccessibleClass(db, req.user, idParam(req.params.cid));
    const row = db.prepare(`${CLASS_SELECT} WHERE c.id = ?`).get(cls.id);
    const students = sortByVietnameseName(
      db.prepare("SELECT * FROM students WHERE class_id = ?").all(cls.id).map(studentDto),
    );
    const days = db.prepare("SELECT date FROM attendance_days WHERE class_id = ? ORDER BY date").pluck().all(cls.id);
    const absences = db.prepare(`
      SELECT a.student_id AS studentId, a.date, a.status FROM absences a
      JOIN students s ON s.id = a.student_id WHERE s.class_id = ?`).all(cls.id);
    const comments = db.prepare(`
      SELECT c.id, c.student_id AS studentId, c.date, c.subject, c.level, c.text FROM comments c
      JOIN students s ON s.id = c.student_id WHERE s.class_id = ? ORDER BY c.date, c.id`).all(cls.id);
    const stars = db.prepare(`
      SELECT x.id, x.student_id AS studentId, x.date, x.delta, x.reason FROM stars x
      JOIN students s ON s.id = x.student_id WHERE s.class_id = ? ORDER BY x.date, x.id`).all(cls.id);
    res.json({ class: classDto(row), students, days, absences, comments, stars });
  });

  r.post("/admin/classes", requireAdmin, (req, res) => {
    const { db } = req.app.locals;
    const c = readClassBody(db, req.body);
    const info = saveClass(db,
      "INSERT INTO classes (name, grade, school_year, school_name, teacher_id) VALUES (?, ?, ?, ?, ?)",
      [c.name, c.grade, c.schoolYear, c.schoolName, c.teacherId]);
    res.status(201).json({ class: classDto(db.prepare(`${CLASS_SELECT} WHERE c.id = ?`).get(info.lastInsertRowid)) });
  });

  r.patch("/admin/classes/:id", requireAdmin, (req, res) => {
    const { db } = req.app.locals;
    const id = idParam(req.params.id);
    if (!db.prepare("SELECT 1 FROM classes WHERE id = ?").get(id)) throw notFound("Không tìm thấy lớp");
    const c = readClassBody(db, req.body);
    saveClass(db,
      "UPDATE classes SET name = ?, grade = ?, school_year = ?, school_name = ?, teacher_id = ? WHERE id = ?",
      [c.name, c.grade, c.schoolYear, c.schoolName, c.teacherId, id]);
    res.json({ class: classDto(db.prepare(`${CLASS_SELECT} WHERE c.id = ?`).get(id)) });
  });

  r.delete("/admin/classes/:id", requireAdmin, (req, res) => {
    const { db } = req.app.locals;
    const id = idParam(req.params.id);
    if (!db.prepare("SELECT 1 FROM classes WHERE id = ?").get(id)) throw notFound("Không tìm thấy lớp");
    if (db.prepare("SELECT 1 FROM students WHERE class_id = ? LIMIT 1").get(id)) {
      throw badRequest("Lớp vẫn còn học sinh. Hãy xóa hết học sinh trước khi xóa lớp.");
    }
    db.prepare("DELETE FROM classes WHERE id = ?").run(id);
    res.json({ ok: true });
  });

  return r;
}
