// API đăng nhập, tạo quản trị lần đầu, đổi mật khẩu.
import { Router } from "express";
import {
  LOCK_MS, MAX_FAILED_LOGINS, clearSessionCookie, createSession, hashPassword,
  publicUser, requireAuth, setSessionCookie, verifyPassword,
} from "../auth.js";
import { HttpError, badRequest, ensureValid } from "../http.js";
import { cleanText, validatePassword, validateUserProfile, validateUsername } from "../../public/js/shared/validate.js";

// Giới hạn thêm theo địa chỉ IP để chặn dò mật khẩu hàng loạt tài khoản.
const IP_MAX_FAILS = 30;
const IP_WINDOW_MS = 15 * 60 * 1000;

function minutesLeft(ms) {
  return Math.max(1, Math.ceil(ms / 60000));
}

export function authRoutes() {
  const r = Router();

  r.get("/state", (req, res) => {
    const { db } = req.app.locals;
    const hasAdmin = !!db.prepare("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1").get();
    res.json({ needsSetup: !hasAdmin, user: req.user, csrf: req.session?.csrf ?? null });
  });

  r.post("/setup", async (req, res) => {
    const { db, now, bcryptRounds } = req.app.locals;
    const body = req.body || {};
    const username = ensureValid(validateUsername(body.username));
    const profile = ensureValid(validateUserProfile(body));
    const password = ensureValid(validatePassword(body.password));
    const hash = await hashPassword(password, bcryptRounds);
    const user = db.transaction(() => {
      if (db.prepare("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1").get()) {
        throw new HttpError(409, "Đã có tài khoản quản trị. Vui lòng đăng nhập.");
      }
      const info = db.prepare("INSERT INTO users (username, full_name, title, role, password_hash) VALUES (?, ?, ?, 'admin', ?)")
        .run(username, profile.fullName, profile.title, hash);
      return db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid);
    })();
    const s = createSession(db, user.id, now());
    setSessionCookie(req, res, s.token);
    res.status(201).json({ user: publicUser(user), csrf: s.csrf });
  });

  r.post("/login", async (req, res) => {
    const { db, now, dummyHash, ipFails } = req.app.locals;
    const body = req.body || {};
    const username = cleanText(body.username).toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";
    if (!username || !password) throw badRequest("Vui lòng nhập tên đăng nhập và mật khẩu");

    const ip = req.ip || "unknown";
    const ipEntry = ipFails.get(ip);
    if (ipEntry && ipEntry.resetAt > now() && ipEntry.count >= IP_MAX_FAILS) {
      throw new HttpError(429, `Có quá nhiều lần đăng nhập sai từ thiết bị này. Vui lòng thử lại sau ${minutesLeft(ipEntry.resetAt - now())} phút.`);
    }

    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
    if (user && user.lock_until > now()) {
      throw new HttpError(429, `Tài khoản tạm khóa do nhập sai mật khẩu ${MAX_FAILED_LOGINS} lần. Vui lòng thử lại sau ${minutesLeft(user.lock_until - now())} phút.`);
    }

    // Luôn so mật khẩu (kể cả khi tên đăng nhập không tồn tại) để thời gian phản hồi như nhau.
    const ok = await verifyPassword(password, user ? user.password_hash : dummyHash);

    if (!user || !ok) {
      const e = ipEntry && ipEntry.resetAt > now() ? ipEntry : { count: 0, resetAt: now() + IP_WINDOW_MS };
      e.count++;
      ipFails.set(ip, e);
      if (user) {
        const { failed_count: fails } = db.prepare("UPDATE users SET failed_count = failed_count + 1 WHERE id = ? RETURNING failed_count").get(user.id);
        if (fails >= MAX_FAILED_LOGINS) {
          db.prepare("UPDATE users SET failed_count = 0, lock_until = ? WHERE id = ?").run(now() + LOCK_MS, user.id);
          throw new HttpError(429, `Tài khoản tạm khóa do nhập sai mật khẩu ${MAX_FAILED_LOGINS} lần. Vui lòng thử lại sau ${minutesLeft(LOCK_MS)} phút.`);
        }
      }
      throw new HttpError(401, "Sai tên đăng nhập hoặc mật khẩu");
    }

    if (user.is_locked) throw new HttpError(403, "Tài khoản đã bị khóa. Vui lòng liên hệ Ban giám hiệu.");

    db.prepare("UPDATE users SET failed_count = 0, lock_until = 0 WHERE id = ?").run(user.id);
    if (req.session) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(req.session.tokenHash);
    const s = createSession(db, user.id, now());
    setSessionCookie(req, res, s.token);
    res.json({ user: publicUser(user), csrf: s.csrf });
  });

  r.post("/logout", (req, res) => {
    const { db } = req.app.locals;
    if (req.session) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(req.session.tokenHash);
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  r.post("/me/password", requireAuth, async (req, res) => {
    const { db, bcryptRounds } = req.app.locals;
    const body = req.body || {};
    const row = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(req.user.id);
    if (!(await verifyPassword(String(body.currentPassword || ""), row.password_hash))) {
      throw badRequest("Mật khẩu hiện tại không đúng");
    }
    const next = ensureValid(validatePassword(body.newPassword));
    const hash = await hashPassword(next, bcryptRounds);
    db.transaction(() => {
      db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, req.user.id);
      // Đăng xuất mọi thiết bị khác.
      db.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?").run(req.user.id, req.session.tokenHash);
    })();
    res.json({ ok: true });
  });

  return r;
}
