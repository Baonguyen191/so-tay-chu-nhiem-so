// Khởi động máy chủ: npm start
import os from "node:os";
import { loadConfig } from "./config.js";
import { openDb } from "./db.js";
import { createApp } from "./app.js";

const config = loadConfig();
const db = openDb(config.dbFile);
const app = createApp({ db, dbFile: config.dbFile, bcryptRounds: config.bcryptRounds, trustProxy: config.trustProxy });

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
