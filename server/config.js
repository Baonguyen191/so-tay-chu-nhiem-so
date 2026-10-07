// Cấu hình đọc từ biến môi trường, có giá trị mặc định hợp lý cho máy tính của trường.
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function loadConfig(env = process.env) {
  const dataDir = path.resolve(ROOT, env.DATA_DIR || "data");
  return {
    port: Number(env.PORT) || 3000,
    host: env.HOST || "0.0.0.0",
    dataDir,
    dbFile: env.DB_FILE ? path.resolve(ROOT, env.DB_FILE) : path.join(dataDir, "sotay.sqlite"),
    // Đặt TRUST_PROXY=1 khi chạy sau máy chủ trung gian HTTPS (Render, Railway, Nginx...).
    trustProxy: env.TRUST_PROXY === "1",
    bcryptRounds: Number(env.BCRYPT_ROUNDS) || 10,
  };
}
