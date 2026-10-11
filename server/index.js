// Khởi động máy chủ: npm start
import os from "node:os";
import path from "node:path";
import { loadConfig } from "./config.js";
import { openDb } from "./db.js";
import { createApp } from "./app.js";
import { startAutoBackup } from "./lib/autobackup.js";

const config = loadConfig();
const db = openDb(config.dbFile);
const app = createApp({ db, dbFile: config.dbFile, bcryptRounds: config.bcryptRounds, trustProxy: config.trustProxy });
// Mỗi ngày một bản sao lưu tự động trong thư mục sao-luu cạnh file dữ liệu, giữ 14 bản gần nhất.
startAutoBackup(app, path.join(path.dirname(config.dbFile), "sao-luu"), { keep: Number(process.env.BACKUP_KEEP) || 14 });

const server = app.listen(config.port, config.host, () => {
  console.log("Sổ tay Chủ nhiệm số đang chạy.");
  console.log(`  Trên máy này:        http://localhost:${config.port}`);
  for (const list of Object.values(os.networkInterfaces())) {
    for (const ni of list || []) {
      if (ni.family === "IPv4" && !ni.internal) console.log(`  Điện thoại cùng Wi-Fi: http://${ni.address}:${config.port}`);
    }
  }
  console.log(`  Dữ liệu lưu tại:     ${config.dbFile}`);
  console.log("Nhấn Ctrl + C để tắt.");
});

function shutdown() {
  server.close();
  try { app.locals.db.close(); } catch { /* đã đóng */ }
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
