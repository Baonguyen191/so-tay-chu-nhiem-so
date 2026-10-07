// Sao lưu và khôi phục toàn bộ cơ sở dữ liệu (chỉ quản trị).
import express, { Router } from "express";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { clearSessionCookie, requireAdmin } from "../auth.js";
import { badRequest } from "../http.js";
import { REQUIRED_TABLES, SCHEMA_VERSION, migrate, openDb } from "../db.js";

const SQLITE_HEADER = Buffer.from("SQLite format 3\0", "latin1");

function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/**
 * Mở nội dung file .sqlite trong bộ nhớ. CSDL chạy ở chế độ WAL đánh dấu điều đó ở byte 18–19 của tiêu đề;
 * bản trong bộ nhớ không dùng được WAL nên đổi về chế độ thường (1) trước khi mở.
 */
function openBuffer(buffer) {
  const buf = Buffer.from(buffer);
  if (buf.length > 19 && buf[18] === 2 && buf[19] === 2) {
    buf[18] = 1;
    buf[19] = 1;
  }
  return new Database(buf);
}

/** Bản chụp CSDL hiện tại, đã bỏ các phiên đăng nhập. */
export function snapshot(db) {
  const copy = openBuffer(db.serialize());
  try {
    copy.prepare("DELETE FROM sessions").run();
    return copy.serialize();
  } finally {
    copy.close();
  }
}

/** Kiểm tra file tải lên có đúng là bản sao lưu của ứng dụng; trả về nội dung đã chuẩn hóa. */
export function validateBackup(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 512 || !buffer.subarray(0, 16).equals(SQLITE_HEADER)) {
    throw badRequest("File không phải bản sao lưu của Sổ tay Chủ nhiệm số");
  }
  let db;
  try {
    db = openBuffer(buffer);
  } catch {
    throw badRequest("File sao lưu bị hỏng, không mở được");
  }
  try {
    if (db.pragma("integrity_check", { simple: true }) !== "ok") throw badRequest("File sao lưu bị hỏng");
    const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").pluck().all());
    if (!REQUIRED_TABLES.every((t) => tables.has(t))) throw badRequest("File không phải bản sao lưu của Sổ tay Chủ nhiệm số");
    if (db.pragma("user_version", { simple: true }) > SCHEMA_VERSION) {
      throw badRequest("Bản sao lưu được tạo từ phiên bản ứng dụng mới hơn. Hãy cập nhật ứng dụng trước.");
    }
    migrate(db);
    if (!db.prepare("SELECT 1 FROM users WHERE role = 'admin' AND is_locked = 0").get()) {
      throw badRequest("Bản sao lưu không có tài khoản quản trị nào đang hoạt động");
    }
    db.prepare("DELETE FROM sessions").run();
    return db.serialize();
  } finally {
    db.close();
  }
}

export function backupRoutes() {
  const r = Router();
  r.use("/admin/backup", requireAdmin);
  r.use("/admin/restore", requireAdmin);

  r.get("/admin/backup", (req, res) => {
    const data = snapshot(req.app.locals.db);
    res.attachment(`sotay-sao-luu-${stamp()}.sqlite`).type("application/octet-stream").send(data);
  });

  r.post("/admin/restore", express.raw({ type: "application/octet-stream", limit: "100mb" }), (req, res) => {
    const { app } = req;
    const data = validateBackup(req.body);
    const { dbFile } = app.locals;

    if (!dbFile) {
      // CSDL trong bộ nhớ (kiểm thử).
      app.locals.db.close();
      app.locals.db = openDb(data);
    } else {
      // Giữ lại bản hiện tại trước khi thay.
      const dir = path.join(path.dirname(dbFile), "sao-luu");
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `truoc-khoi-phuc-${stamp()}.sqlite`), snapshot(app.locals.db));

      const tmp = dbFile + ".khoi-phuc";
      fs.writeFileSync(tmp, data);
      app.locals.db.close();
      try {
        for (const ext of ["-wal", "-shm"]) fs.rmSync(dbFile + ext, { force: true });
        fs.renameSync(tmp, dbFile);
      } finally {
        fs.rmSync(tmp, { force: true });
        app.locals.db = openDb(dbFile);
      }
    }
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  return r;
}
