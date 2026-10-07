// Công cụ dùng chung cho kiểm thử: ứng dụng với CSDL trong bộ nhớ và đồng hồ giả.
import request from "supertest";
import bcrypt from "bcryptjs";
import { openDb } from "../server/db.js";
import { createApp } from "../server/app.js";

export const PASSWORD = "matkhau123";

export function makeApp() {
  const db = openDb(":memory:");
  const clock = { t: Date.parse("2026-10-07T01:00:00Z") };
  const app = createApp({ db, now: () => clock.t, bcryptRounds: 4 });
  return { app, db, clock };
}

/** Tạo tài khoản thẳng trong CSDL. */
export function createUser(db, { username, fullName = "Nguyễn Thị Hạnh", title = "Cô", role = "teacher", password = PASSWORD }) {
  const info = db.prepare("INSERT INTO users (username, full_name, title, role, password_hash) VALUES (?, ?, ?, ?, ?)")
    .run(username, fullName, title, role, bcrypt.hashSync(password, 4));
  return Number(info.lastInsertRowid);
}

export function createClass(db, { name = "3A", grade = 3, schoolYear = "2026-2027", schoolName = "Trường Tiểu học Tân Minh", teacherId = null } = {}) {
  const info = db.prepare("INSERT INTO classes (name, grade, school_year, school_name, teacher_id) VALUES (?, ?, ?, ?, ?)")
    .run(name, grade, schoolYear, schoolName, teacherId);
  return Number(info.lastInsertRowid);
}

export function createStudent(db, classId, fullName = "Nguyễn Minh Anh") {
  const info = db.prepare("INSERT INTO students (class_id, full_name) VALUES (?, ?)").run(classId, fullName);
  return Number(info.lastInsertRowid);
}

/** Trình duyệt giả: giữ cookie và tự gửi mã CSRF. */
export class Client {
  constructor(app) {
    this.agent = request.agent(app);
    this.csrf = null;
  }
  #send(req) {
    return this.csrf ? req.set("X-CSRF-Token", this.csrf) : req;
  }
  get(path) { return this.agent.get(path); }
  post(path, body = {}) { return this.#send(this.agent.post(path)).send(body); }
  put(path, body = {}) { return this.#send(this.agent.put(path)).send(body); }
  patch(path, body = {}) { return this.#send(this.agent.patch(path)).send(body); }
  delete(path) { return this.#send(this.agent.delete(path)); }

  async login(username, password = PASSWORD) {
    const res = await this.agent.post("/api/login").send({ username, password });
    if (res.status === 200) this.csrf = res.body.csrf;
    return res;
  }
}

export async function loggedIn(app, username, password = PASSWORD) {
  const c = new Client(app);
  const res = await c.login(username, password);
  if (res.status !== 200) throw new Error(`Đăng nhập ${username} thất bại: ${res.status} ${JSON.stringify(res.body)}`);
  return c;
}
