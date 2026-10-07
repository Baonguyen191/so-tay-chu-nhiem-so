import { test } from "node:test";
import assert from "node:assert/strict";
import { Client, PASSWORD, createUser, loggedIn, makeApp } from "./helpers.js";

const ADMIN = { username: "hieutruong", fullName: "Trần Văn Minh", title: "Thầy", password: "quantri2026" };

test("lần chạy đầu: tạo tài khoản quản trị, chỉ được tạo một lần", async () => {
  const { app, db } = makeApp();
  const c = new Client(app);

  const s0 = await c.get("/api/state");
  assert.equal(s0.body.needsSetup, true);
  assert.equal(s0.body.user, null);

  const res = await c.agent.post("/api/setup").send(ADMIN);
  assert.equal(res.status, 201);
  assert.equal(res.body.user.role, "admin");
  const cookie = res.headers["set-cookie"].join(";");
  assert.match(cookie, /sotay_sid=/);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);

  const hash = db.prepare("SELECT password_hash FROM users WHERE username = ?").get("hieutruong").password_hash;
  assert.match(hash, /^\$2[aby]\$/, "mật khẩu phải được băm bằng bcrypt");
  assert.ok(!hash.includes(ADMIN.password));

  const s1 = await c.get("/api/state");
  assert.equal(s1.body.needsSetup, false);
  assert.equal(s1.body.user.username, "hieutruong");

  const again = await new Client(app).agent.post("/api/setup").send({ ...ADMIN, username: "khac" });
  assert.equal(again.status, 409);
});

test("tạo quản trị: kiểm tra dữ liệu đầu vào", async () => {
  const { app } = makeApp();
  const c = new Client(app);
  assert.equal((await c.agent.post("/api/setup").send({ ...ADMIN, password: "ngan" })).status, 400);
  assert.equal((await c.agent.post("/api/setup").send({ ...ADMIN, username: "có dấu" })).status, 400);
  assert.equal((await c.agent.post("/api/setup").send({ ...ADMIN, fullName: "<script>" })).status, 400);
});

test("đăng nhập đúng và sai mật khẩu", async () => {
  const { app, db } = makeApp();
  createUser(db, { username: "cohanh" });
  const c = new Client(app);

  const bad = await c.login("cohanh", "saimatkhau");
  assert.equal(bad.status, 401);
  assert.equal(bad.body.error, "Sai tên đăng nhập hoặc mật khẩu");

  const unknown = await c.login("khongco", "saimatkhau");
  assert.equal(unknown.status, 401);
  assert.equal(unknown.body.error, bad.body.error, "không tiết lộ tài khoản có tồn tại hay không");

  const ok = await c.login("CoHanh", PASSWORD);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.user.fullName, "Nguyễn Thị Hạnh");
  assert.ok(ok.body.csrf);
  assert.equal((await c.get("/api/state")).body.user.username, "cohanh");
});

test("khóa tạm 5 phút sau 5 lần sai mật khẩu", async () => {
  const { app, db, clock } = makeApp();
  createUser(db, { username: "cohanh" });
  const c = new Client(app);

  for (let i = 1; i <= 4; i++) assert.equal((await c.login("cohanh", "sai" + i + "xxxxx")).status, 401);
  const fifth = await c.login("cohanh", "sai5xxxxx");
  assert.equal(fifth.status, 429);
  assert.match(fifth.body.error, /5 phút/);

  // Đang bị khóa thì mật khẩu đúng cũng không vào được.
  assert.equal((await c.login("cohanh", PASSWORD)).status, 429);

  clock.t += 4 * 60 * 1000;
  const still = await c.login("cohanh", PASSWORD);
  assert.equal(still.status, 429);
  assert.match(still.body.error, /1 phút/);

  clock.t += 60 * 1000 + 1;
  assert.equal((await c.login("cohanh", PASSWORD)).status, 200);

  // Đăng nhập thành công thì đếm lại từ đầu.
  assert.equal(db.prepare("SELECT failed_count FROM users WHERE username = 'cohanh'").get().failed_count, 0);
});

test("tài khoản bị quản trị khóa không đăng nhập được và mất phiên đang mở", async () => {
  const { app, db } = makeApp();
  const id = createUser(db, { username: "cohanh" });
  const c = await loggedIn(app, "cohanh");
  db.prepare("UPDATE users SET is_locked = 1 WHERE id = ?").run(id);

  assert.equal((await c.get("/api/state")).body.user, null);
  const res = await new Client(app).login("cohanh");
  assert.equal(res.status, 403);
  assert.match(res.body.error, /bị khóa/);
});

test("phiên hết hạn sau 12 giờ", async () => {
  const { app, db, clock } = makeApp();
  createUser(db, { username: "cohanh" });
  const c = await loggedIn(app, "cohanh");
  clock.t += 11 * 3600 * 1000;
  assert.ok((await c.get("/api/state")).body.user);
  clock.t += 3600 * 1000 + 1;
  assert.equal((await c.get("/api/state")).body.user, null);
});

test("chống CSRF: thiếu mã, sai mã, hoặc gửi từ trang khác đều bị từ chối", async () => {
  const { app, db } = makeApp();
  createUser(db, { username: "cohanh" });
  const c = await loggedIn(app, "cohanh");

  assert.equal((await c.agent.post("/api/logout").send({})).status, 403);
  assert.equal((await c.agent.post("/api/logout").set("X-CSRF-Token", "sai").send({})).status, 403);
  assert.equal((await c.post("/api/logout").set("Origin", "https://trang-gia-mao.example")).status, 403);
  assert.equal((await c.post("/api/logout").set("Sec-Fetch-Site", "cross-site")).status, 403);

  // Biểu mẫu HTML từ trang khác không gửi được JSON, nên đăng nhập dạng biểu mẫu bị chặn.
  const form = await new Client(app).agent.post("/api/login").type("form").send({ username: "cohanh", password: PASSWORD });
  assert.equal(form.status, 403);

  assert.equal((await c.post("/api/logout")).status, 200);
  assert.equal((await c.get("/api/state")).body.user, null);
});

test("đổi mật khẩu của mình", async () => {
  const { app, db } = makeApp();
  createUser(db, { username: "cohanh" });
  const c = await loggedIn(app, "cohanh");
  const other = await loggedIn(app, "cohanh");

  const wrong = await c.post("/api/me/password", { currentPassword: "khongdung", newPassword: "matkhaumoi1" });
  assert.equal(wrong.status, 400);
  const weak = await c.post("/api/me/password", { currentPassword: PASSWORD, newPassword: "123" });
  assert.equal(weak.status, 400);

  assert.equal((await c.post("/api/me/password", { currentPassword: PASSWORD, newPassword: "matkhaumoi1" })).status, 200);
  assert.ok((await c.get("/api/state")).body.user, "thiết bị đang dùng vẫn đăng nhập");
  assert.equal((await other.get("/api/state")).body.user, null, "thiết bị khác bị đăng xuất");
  assert.equal((await new Client(app).login("cohanh", PASSWORD)).status, 401);
  assert.equal((await new Client(app).login("cohanh", "matkhaumoi1")).status, 200);
});

test("chưa đăng nhập thì không gọi được API cần đăng nhập", async () => {
  const { app } = makeApp();
  const res = await new Client(app).post("/api/me/password", { currentPassword: "x", newPassword: "yyyyyyyy" });
  assert.equal(res.status, 401);
});
