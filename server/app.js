// Tạo ứng dụng Express: bảo mật, API, giao diện tĩnh.
import express from "express";
import helmet from "helmet";
import bcrypt from "bcryptjs";
import path from "node:path";
import { ROOT } from "./config.js";
import { csrfProtection, loadSession } from "./auth.js";
import { errorHandler, notFound } from "./http.js";
import { authRoutes } from "./routes/auth.js";

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
  api.use(() => { throw notFound("Không có chức năng này"); });
  app.use("/api", api);

  app.use(express.static(path.join(ROOT, "public"), {
    setHeaders: (res) => res.set("Cache-Control", "no-cache"),
  }));

  app.use(errorHandler);
  return app;
}
