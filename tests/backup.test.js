import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { openDb } from "../server/db.js";
import { createApp } from "../server/app.js";
import { Client, createClass, createStudent, createUser, loggedIn, makeApp } from "./helpers.js";

const binary = (res, cb) => {
  const chunks = [];
  res.on("data", (c) => chunks.push(c));
  res.on("end", () => cb(null, Buffer.concat(chunks)));
};

function download(client) {
  return client.agent.get("/api/admin/backup").buffer(true).parse(binary);
}

function upload(client, buf) {
  return client.agent.post("/api/admin/restore").set("X-CSRF-Token", client.csrf)
    .set("Content-Type", "application/octet-stream").send(buf);
}

test("sao lưu: chỉ quản trị tải được; file là CSDL hợp lệ, không chứa phiên đăng nhập", async () => {
  const { app, db } = makeApp();
  createUser(db, { username: "bgh", role: "admin" });
  createUser(db, { username: "cohanh" });
  const teacher = await loggedIn(app, "cohanh");
  assert.equal((await teacher.get("/api/admin/backup")).status, 403);
  assert.equal((await new Client(app).get("/api/admin/backup")).status, 401);

  const admin = await loggedIn(app, "bgh");
  const res = await download(admin);
  assert.equal(res.status, 200);
  assert.match(res.headers["content-disposition"], /sotay-sao-luu-\d{8}-\d{6}\.sqlite/);
  const copy = new Database(res.body);
  assert.equal(copy.prepare("SELECT COUNT(*) n FROM users").get().n, 2);
  assert.equal(copy.prepare("SELECT COUNT(*) n FROM sessions").get().n, 0);
  copy.close();
});

test("khôi phục: dữ liệu trở về như lúc sao lưu, mọi người phải đăng nhập lại", async () => {
  const { app, db } = makeApp();
  createUser(db, { username: "bgh", role: "admin" });
  const cid = createClass(db);
  createStudent(db, cid, "Nguyễn Minh Anh");
  const admin = await loggedIn(app, "bgh");
  const backup = (await download(admin)).body;

  createStudent(db, cid, "Học Sinh Thêm Sau");
  assert.equal((await upload(admin, backup)).status, 200);

  const names = app.locals.db.prepare("SELECT full_name FROM students").pluck().all();
  assert.deepEqual(names, ["Nguyễn Minh Anh"]);
  assert.equal((await admin.get("/api/state")).body.user, null);
  assert.equal((await new Client(app).login("bgh")).status, 200);
});

test("khôi phục: từ chối file không phải bản sao lưu; giáo viên không được khôi phục", async () => {
  const { app, db } = makeApp();
  createUser(db, { username: "bgh", role: "admin" });
  createUser(db, { username: "cohanh" });
  const admin = await loggedIn(app, "bgh");

  assert.equal((await upload(admin, Buffer.from("không phải sqlite".repeat(100)))).status, 400);

  const other = new Database(":memory:");
  other.exec("CREATE TABLE x (a)");
  const res = await upload(admin, other.serialize());
  assert.equal(res.status, 400);
  assert.match(res.body.error, /không phải bản sao lưu/);

  const teacher = await loggedIn(app, "cohanh");
  assert.equal((await upload(teacher, (await download(admin)).body)).status, 403);
  assert.equal(app.locals.db.prepare("SELECT COUNT(*) n FROM users").get().n, 2, "dữ liệu không đổi");
});

test("khôi phục trên file thật: giữ lại bản trước khi khôi phục trong data/sao-luu", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sotay-"));
  const dbFile = path.join(dir, "sotay.sqlite");
  try {
    const db = openDb(dbFile);
    const app = createApp({ db, dbFile, bcryptRounds: 4 });
    createUser(db, { username: "bgh", role: "admin" });
    const cid = createClass(db);
    createStudent(db, cid, "Trước Sao Lưu");
    const admin = await loggedIn(app, "bgh");
    const backup = (await download(admin)).body;
    createStudent(db, cid, "Sau Sao Lưu");

    assert.equal((await upload(admin, backup)).status, 200);
    assert.equal(app.locals.db.prepare("SELECT COUNT(*) n FROM students").get().n, 1);

    const kept = fs.readdirSync(path.join(dir, "sao-luu"));
    assert.equal(kept.length, 1);
    const old = new Database(path.join(dir, "sao-luu", kept[0]), { readonly: true });
    assert.equal(old.prepare("SELECT COUNT(*) n FROM students").get().n, 2);
    old.close();

    // Mở lại file từ đầu vẫn thấy dữ liệu đã khôi phục.
    app.locals.db.close();
    const again = openDb(dbFile);
    assert.equal(again.prepare("SELECT COUNT(*) n FROM students").get().n, 1);
    again.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
