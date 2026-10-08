// API học sinh: thêm, sửa, xóa, nhập hàng loạt.
import express, { Router } from "express";
import { getAccessibleClass, getAccessibleStudent, requireAuth } from "../auth.js";
import { badRequest, ensureValid, idParam } from "../http.js";
import { localToday, validateStudent } from "../../public/js/shared/validate.js";
import { FIELDS, checkRows, readImportSource } from "../lib/import.js";
import { studentDto } from "./classes.js";

const rawFile = express.raw({ type: "application/octet-stream", limit: "2mb" });

const INSERT_STUDENT = `
  INSERT INTO students (class_id, full_name, dob, gender, parent_name, parent_phone, health_note, parent2_name, parent2_phone)
  VALUES (@classId, @fullName, @dob, @gender, @parentName, @parentPhone, @healthNote, @parent2Name, @parent2Phone)`;

export function studentRoutes() {
  const r = Router();
  r.use(["/classes/:cid/students", "/students"], requireAuth);

  r.post("/classes/:cid/students", (req, res) => {
    const { db } = req.app.locals;
    const cls = getAccessibleClass(db, req.user, idParam(req.params.cid));
    const s = ensureValid(validateStudent(req.body, { today: localToday() }));
    const info = db.prepare(INSERT_STUDENT).run({ ...s, classId: cls.id });
    res.status(201).json({ student: studentDto(db.prepare("SELECT * FROM students WHERE id = ?").get(info.lastInsertRowid)) });
  });

  r.put("/students/:id", (req, res) => {
    const { db } = req.app.locals;
    const st = getAccessibleStudent(db, req.user, idParam(req.params.id));
    const s = ensureValid(validateStudent(req.body, { today: localToday() }));
    db.prepare(`
      UPDATE students SET full_name = @fullName, dob = @dob, gender = @gender, parent_name = @parentName,
        parent_phone = @parentPhone, health_note = @healthNote, parent2_name = @parent2Name,
        parent2_phone = @parent2Phone, updated_at = datetime('now')
      WHERE id = @id`).run({ ...s, id: st.id });
    res.json({ student: studentDto(db.prepare("SELECT * FROM students WHERE id = ?").get(st.id)) });
  });

  r.delete("/students/:id", (req, res) => {
    const { db } = req.app.locals;
    const st = getAccessibleStudent(db, req.user, idParam(req.params.id));
    db.prepare("DELETE FROM students WHERE id = ?").run(st.id);
    res.json({ ok: true });
  });

  // Bước 1: đọc dữ liệu dán/tải lên, trả về bản xem trước kèm lỗi từng dòng. Chưa lưu gì.
  r.post("/classes/:cid/students/import/preview", rawFile, async (req, res) => {
    const { db } = req.app.locals;
    const cls = getAccessibleClass(db, req.user, idParam(req.params.cid));
    const rows = await readImportSource(req);
    const existing = db.prepare("SELECT full_name, dob FROM students WHERE class_id = ?").all(cls.id);
    res.json(checkRows(rows, { existing, today: localToday() }));
  });

  // Bước 2: lưu các dòng giáo viên đã xem trước. Máy chủ kiểm tra lại toàn bộ; có lỗi thì không lưu dòng nào.
  r.post("/classes/:cid/students/import", (req, res) => {
    const { db } = req.app.locals;
    const cls = getAccessibleClass(db, req.user, idParam(req.params.cid));
    const input = req.body?.rows;
    if (!Array.isArray(input) || !input.length) throw badRequest("Không có học sinh nào để lưu");
    const existing = db.prepare("SELECT full_name, dob FROM students WHERE class_id = ?").all(cls.id);
    const cells = input.map((s) => FIELDS.map((f) => (s && typeof s[f] === "string" ? s[f] : "")));
    const checked = checkRows(cells, { existing, today: localToday(), hasHeader: false, skipBlank: false });
    if (checked.errorCount) {
      throw badRequest("Danh sách còn dòng lỗi, chưa lưu học sinh nào", { rows: checked.rows });
    }
    const insert = db.prepare(INSERT_STUDENT);
    db.transaction(() => {
      for (const row of checked.rows) insert.run({ ...row.value, classId: cls.id });
    })();
    res.status(201).json({ inserted: checked.rows.length });
  });

  return r;
}
