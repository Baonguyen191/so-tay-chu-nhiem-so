// Mở cơ sở dữ liệu SQLite và tạo/cập nhật các bảng.
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export const SCHEMA_VERSION = 1;

const SCHEMA_V1 = `
CREATE TABLE users (
  id            INTEGER PRIMARY KEY,
  username      TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  full_name     TEXT    NOT NULL,
  title         TEXT    NOT NULL DEFAULT 'Cô' CHECK (title IN ('Cô','Thầy')),
  role          TEXT    NOT NULL CHECK (role IN ('admin','teacher')),
  password_hash TEXT    NOT NULL,
  is_locked     INTEGER NOT NULL DEFAULT 0,
  failed_count  INTEGER NOT NULL DEFAULT 0,
  lock_until    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  token_hash TEXT    PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf       TEXT    NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

CREATE TABLE classes (
  id          INTEGER PRIMARY KEY,
  name        TEXT    NOT NULL,
  grade       INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 5),
  school_year TEXT    NOT NULL,
  school_name TEXT    NOT NULL,
  teacher_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (school_name, school_year, name)
);
CREATE INDEX classes_teacher ON classes(teacher_id);

CREATE TABLE students (
  id           INTEGER PRIMARY KEY,
  class_id     INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  full_name    TEXT    NOT NULL,
  dob          TEXT,
  gender       TEXT    CHECK (gender IN ('M','F')),
  parent_name  TEXT    NOT NULL DEFAULT '',
  parent_phone TEXT    NOT NULL DEFAULT '',
  health_note  TEXT    NOT NULL DEFAULT '',
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX students_class ON students(class_id);

-- Những ngày lớp đã được điểm danh (tỉ lệ chuyên cần chỉ tính trên các ngày này).
CREATE TABLE attendance_days (
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  date     TEXT    NOT NULL,
  PRIMARY KEY (class_id, date)
);

-- Chỉ lưu học sinh vắng; không có dòng nghĩa là có mặt.
CREATE TABLE absences (
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  date       TEXT    NOT NULL,
  status     TEXT    NOT NULL CHECK (status IN ('P','K')),
  PRIMARY KEY (student_id, date)
);

CREATE TABLE comments (
  id         INTEGER PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  date       TEXT    NOT NULL,
  subject    TEXT    NOT NULL,
  level      TEXT    NOT NULL CHECK (level IN ('T','H','C')),
  text       TEXT    NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX comments_student ON comments(student_id);

CREATE TABLE stars (
  id         INTEGER PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  date       TEXT    NOT NULL,
  delta      INTEGER NOT NULL CHECK (delta IN (-1, 1)),
  reason     TEXT    NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX stars_student ON stars(student_id);
`;

export const REQUIRED_TABLES = ["users", "sessions", "classes", "students", "attendance_days", "absences", "comments", "stars"];

export function migrate(db) {
  const version = db.pragma("user_version", { simple: true });
  if (version > SCHEMA_VERSION) {
    throw new Error(`Cơ sở dữ liệu thuộc phiên bản mới hơn (${version}). Hãy cập nhật ứng dụng.`);
  }
  if (version < 1) {
    db.transaction(() => {
      db.exec(SCHEMA_V1);
      db.pragma("user_version = 1");
    })();
  }
}

/** Mở cơ sở dữ liệu từ đường dẫn file, ":memory:", hoặc Buffer (nội dung file .sqlite). */
export function openDb(source) {
  const isFile = typeof source === "string" && source !== ":memory:";
  if (isFile) fs.mkdirSync(path.dirname(source), { recursive: true });
  const db = new Database(source);
  if (isFile) db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  migrate(db);
  return db;
}
