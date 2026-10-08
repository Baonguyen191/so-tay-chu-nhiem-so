import { test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { SCHEMA_VERSION, migrate } from "../server/db.js";

test("CSDL phiên bản cũ tự nâng cấp, giữ nguyên học sinh, có thêm phụ huynh thứ hai", () => {
  const db = new Database(":memory:");
  // Dựng CSDL phiên bản 1 (chưa có cột phụ huynh thứ hai).
  db.exec(`
    CREATE TABLE classes (id INTEGER PRIMARY KEY, name TEXT);
    CREATE TABLE students (id INTEGER PRIMARY KEY, class_id INTEGER, full_name TEXT NOT NULL,
      parent_name TEXT NOT NULL DEFAULT '', parent_phone TEXT NOT NULL DEFAULT '');
    INSERT INTO classes VALUES (1, '1A');
    INSERT INTO students (class_id, full_name, parent_name) VALUES (1, 'Lê Bảo An', 'Phạm Thị Hoa');
  `);
  db.pragma("user_version = 1");

  migrate(db);
  assert.equal(db.pragma("user_version", { simple: true }), SCHEMA_VERSION);
  const row = db.prepare("SELECT * FROM students").get();
  assert.equal(row.full_name, "Lê Bảo An");
  assert.equal(row.parent_name, "Phạm Thị Hoa");
  assert.equal(row.parent2_name, "");
  assert.equal(row.parent2_phone, "");

  migrate(db); // chạy lại không lỗi
  db.close();
});
