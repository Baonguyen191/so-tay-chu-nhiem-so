// Tạo ứng dụng Express: bảo mật, API, giao diện tĩnh.
import express from "express";
import helmet from "helmet";
import bcrypt from "bcryptjs";
import path from "node:path";
import { ROOT } from "./config.js";
import { csrfProtection, loadSession } from "./auth.js";
import { errorHandler, notFound } from "./http.js";
import { authRoutes } from "./routes/auth.js";
import { adminRoutes } from "./routes/admin.js";
import { classRoutes } from "./routes/classes.js";
import { studentRoutes } from "./routes/students.js";
import { recordRoutes } from "./routes/records.js";
import { backupRoutes } from "./routes/backup.js";
import { templateCsv, templateXlsx } from "./lib/template.js";

/**
 * @param {object} opts
 * @param {import("better-sqlite3").Database} opts.db
 * @param {string} [opts.dbFile]   đường dẫn file CSDL (dùng cho sao lưu/khôi phục)
 * @param {() => number} [opts.now] đồng hồ (thay được trong kiểm thử)
 */
export function createApp({ db, dbFile = null, now = Date.now, bcryptRounds = 10, trustProxy = false }) {
  const app = express();
  app.set("trust proxy", trustProxy ? 1 : false);
  Object.assign(app.locals, {
    db,
    dbFile,
    now,
    bcryptRounds,
    ipFails: new Map(),
    dummyHash: bcrypt.hashSync("khong-phai-mat-khau-that", bcryptRounds),
  });

  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
      },
    },
  }));

  const api = express.Router();
  api.use(express.json({ limit: "1mb" }));
  api.use(loadSession);
  api.use(csrfProtection);
  api.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  api.use(authRoutes());
  api.use(adminRoutes());
  api.use(classRoutes());
  api.use(studentRoutes());
  api.use(recordRoutes());
  api.use(backupRoutes());
  api.use(() => { throw notFound("Không có chức năng này"); });
  app.use("/api", api);

  // File mẫu nhập danh sách học sinh (không chứa dữ liệu, tải tự do).
  app.get("/mau/mau-nhap-hoc-sinh.xlsx", async (_req, res) => {
    res.attachment("mau-nhap-hoc-sinh.xlsx").type("xlsx").send(await templateXlsx());
  });
  app.get("/mau/mau-nhap-hoc-sinh.csv", (_req, res) => {
    res.attachment("mau-nhap-hoc-sinh.csv").type("text/csv; charset=utf-8").send(templateCsv());
  });

  app.use(express.static(path.join(ROOT, "public"), {
    setHeaders: (res) => res.set("Cache-Control", "no-cache"),
  }));

  app.use(errorHandler);
  return app;
}
