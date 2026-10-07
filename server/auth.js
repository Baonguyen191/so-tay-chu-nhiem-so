// Mật khẩu, phiên đăng nhập, phân quyền và chống CSRF.
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { HttpError, forbidden, parseCookies } from "./http.js";

export const SESSION_COOKIE = "sotay_sid";
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export const MAX_FAILED_LOGINS = 5;
export const LOCK_MS = 5 * 60 * 1000;

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
const randomToken = () => crypto.randomBytes(32).toString("base64url");

export function hashPassword(password, rounds) {
  return bcrypt.hash(password, rounds);
}

export function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function publicUser(row) {
  return { id: row.id, username: row.username, fullName: row.full_name, title: row.title, role: row.role };
}

export function createSession(db, userId, now) {
  const token = randomToken();
  const csrf = randomToken();
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now);
  db.prepare("INSERT INTO sessions (token_hash, user_id, csrf, expires_at) VALUES (?, ?, ?, ?)")
    .run(sha256(token), userId, csrf, now + SESSION_TTL_MS);
  return { token, csrf, tokenHash: sha256(token) };
}

function cookieOptions(req) {
  return { httpOnly: true, sameSite: "lax", secure: req.secure, path: "/" };
}

export function setSessionCookie(req, res, token) {
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(req), maxAge: SESSION_TTL_MS });
}

export function clearSessionCookie(req, res) {
  res.clearCookie(SESSION_COOKIE, cookieOptions(req));
}

/** Đọc cookie phiên và gắn req.user, req.session nếu phiên còn hiệu lực. */
export function loadSession(req, _res, next) {
  const { db, now } = req.app.locals;
  req.user = null;
  req.session = null;
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (token) {
    const row = db.prepare(`
      SELECT s.token_hash, s.csrf, s.expires_at, u.id, u.username, u.full_name, u.title, u.role, u.is_locked
      FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?`).get(sha256(token));
    if (row && row.expires_at > now() && !row.is_locked) {
      req.session = { tokenHash: row.token_hash, csrf: row.csrf };
      req.user = publicUser(row);
    }
  }
  next();
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Chống CSRF:
 *  - từ chối yêu cầu ghi đến từ trang web khác (Sec-Fetch-Site / Origin);
 *  - khi đã đăng nhập: bắt buộc gửi kèm mã X-CSRF-Token đúng với phiên;
 *  - khi chưa đăng nhập (đăng nhập, tạo quản trị): chỉ nhận JSON, mà trình duyệt không cho trang khác gửi tự do.
 */
export function csrfProtection(req, _res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  const site = req.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") throw forbidden("Yêu cầu bị từ chối vì đến từ trang web khác");
  const origin = req.get("origin");
  if (origin) {
    let host = null;
    try { host = new URL(origin).host; } catch { /* Origin không hợp lệ */ }
    if (host !== req.host) throw forbidden("Yêu cầu bị từ chối vì đến từ trang web khác");
  }
  if (req.session) {
    if (!safeEqual(req.get("x-csrf-token") || "", req.session.csrf)) {
      throw forbidden("Phiên làm việc đã thay đổi, vui lòng tải lại trang");
    }
  } else if (!req.is("application/json")) {
    throw forbidden("Yêu cầu không hợp lệ");
  }
  next();
}

export function requireAuth(req, _res, next) {
  if (!req.user) throw new HttpError(401, "Vui lòng đăng nhập");
  next();
}

export function requireAdmin(req, _res, next) {
  if (!req.user) throw new HttpError(401, "Vui lòng đăng nhập");
  if (req.user.role !== "admin") throw forbidden("Chức năng này chỉ dành cho Ban giám hiệu");
  next();
}

/** Lấy lớp theo id và kiểm tra quyền: quản trị xem/sửa mọi lớp, giáo viên chỉ lớp mình chủ nhiệm. */
export function getAccessibleClass(db, user, classId) {
  const cls = db.prepare("SELECT * FROM classes WHERE id = ?").get(classId);
  if (!cls || (user.role !== "admin" && cls.teacher_id !== user.id)) {
    throw new HttpError(404, "Không tìm thấy lớp, hoặc bạn không chủ nhiệm lớp này");
  }
  return cls;
}

/** Lấy học sinh và kiểm tra quyền qua lớp của em đó. */
export function getAccessibleStudent(db, user, studentId) {
  const st = db.prepare("SELECT * FROM students WHERE id = ?").get(studentId);
  if (!st) throw new HttpError(404, "Không tìm thấy học sinh");
  try {
    getAccessibleClass(db, user, st.class_id);
  } catch {
    throw new HttpError(404, "Không tìm thấy học sinh");
  }
  return st;
}
