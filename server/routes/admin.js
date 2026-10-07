// API quản trị tài khoản (chỉ Ban giám hiệu).
import { Router } from "express";
import { hashPassword, requireAdmin } from "../auth.js";
import { HttpError, badRequest, ensureValid, idParam, notFound } from "../http.js";
import { validatePassword, validateUserProfile, validateUsername } from "../../public/js/shared/validate.js";
import { compareVietnameseNames } from "../../public/js/shared/vnsort.js";

function userDto(row, now) {
  return {
    id: row.id,
    username: row.username,
    fullName: row.full_name,
    title: row.title,
    role: row.role,
    isLocked: !!row.is_locked,
    tempLockedUntil: row.lock_until > now ? row.lock_until : null,
    classes: row.class_names ? row.class_names.split("\n") : [],
  };
}

export function adminRoutes() {
  const r = Router();
  r.use("/admin", requireAdmin);

  r.get("/admin/users", (req, res) => {
    const { db, now } = req.app.locals;
    const rows = db.prepare(`
      SELECT u.*, (SELECT group_concat(c.name || ' (' || c.school_year || ')', char(10))
                   FROM classes c WHERE c.teacher_id = u.id) AS class_names
      FROM users u`).all();
    rows.sort((a, b) => (a.role === b.role ? compareVietnameseNames(a.full_name, b.full_name) : a.role === "admin" ? -1 : 1));
    res.json({ users: rows.map((u) => userDto(u, now())) });
  });

  r.post("/admin/users", async (req, res) => {
    const { db, bcryptRounds, now } = req.app.locals;
    const body = req.body || {};
    const username = ensureValid(validateUsername(body.username));
    const profile = ensureValid(validateUserProfile(body));
    const password = ensureValid(validatePassword(body.password));
    const role = body.role === "admin" ? "admin" : "teacher";
    if (db.prepare("SELECT 1 FROM users WHERE username = ?").get(username)) {
      throw new HttpError(409, "Tên đăng nhập này đã có người dùng");
    }
    const hash = await hashPassword(password, bcryptRounds);
    const info = db.prepare("INSERT INTO users (username, full_name, title, role, password_hash) VALUES (?, ?, ?, ?, ?)")
      .run(username, profile.fullName, profile.title, role, hash);
    const row = db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid);
    res.status(201).json({ user: userDto(row, now()) });
  });

  r.patch("/admin/users/:id", (req, res) => {
    const { db, now } = req.app.locals;
    const id = idParam(req.params.id);
    const target = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
    if (!target) throw notFound("Không tìm thấy tài khoản");
    const body = req.body || {};

    const profile = ensureValid(validateUserProfile({
      fullName: body.fullName ?? target.full_name,
      title: body.title ?? target.title,
    }));
    const role = body.role === undefined ? target.role : body.role;
    if (!["admin", "teacher"].includes(role)) throw badRequest("Vai trò không hợp lệ");
    const isLocked = body.isLocked === undefined ? !!target.is_locked : body.isLocked === true;
    if (id === req.user.id && (role !== "admin" || isLocked)) {
      throw badRequest("Không thể tự khóa hoặc tự bỏ quyền quản trị của chính mình");
    }

    db.transaction(() => {
      db.prepare("UPDATE users SET full_name = ?, title = ?, role = ?, is_locked = ? WHERE id = ?")
        .run(profile.fullName, profile.title, role, isLocked ? 1 : 0, id);
      if (isLocked) db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
      else if (target.is_locked) db.prepare("UPDATE users SET failed_count = 0, lock_until = 0 WHERE id = ?").run(id);
      const admins = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND is_locked = 0").get().n;
      if (!admins) throw badRequest("Cần giữ lại ít nhất một tài khoản quản trị đang hoạt động");
    })();
    res.json({ user: userDto(db.prepare("SELECT * FROM users WHERE id = ?").get(id), now()) });
  });

  r.post("/admin/users/:id/password", async (req, res) => {
    const { db, bcryptRounds } = req.app.locals;
    const id = idParam(req.params.id);
    if (!db.prepare("SELECT 1 FROM users WHERE id = ?").get(id)) throw notFound("Không tìm thấy tài khoản");
    const password = ensureValid(validatePassword(req.body?.password));
    const hash = await hashPassword(password, bcryptRounds);
    db.transaction(() => {
      db.prepare("UPDATE users SET password_hash = ?, failed_count = 0, lock_until = 0 WHERE id = ?").run(hash, id);
      if (id !== req.user.id) db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
      else db.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?").run(id, req.session.tokenHash);
    })();
    res.json({ ok: true });
  });

  return r;
}
