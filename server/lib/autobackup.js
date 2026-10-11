// Tự sao lưu cơ sở dữ liệu mỗi ngày vào data/sao-luu/, giữ lại một số bản gần nhất.
import fs from "node:fs";
import path from "node:path";
import { snapshot } from "../routes/backup.js";

const PREFIX = "tu-dong-";

function dayStamp(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

/**
 * Tạo bản sao lưu của ngày hôm nay (nếu chưa có) rồi xóa các bản tự động cũ hơn `keep` bản gần nhất.
 * Bản sao lưu thủ công và bản "trước khi khôi phục" không bị xóa.
 * @returns {string|null} đường dẫn file vừa tạo, hoặc null nếu hôm nay đã sao lưu
 */
export function runAutoBackup(db, dir, { now = new Date(), keep = 14 } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${PREFIX}${dayStamp(now)}.sqlite`);
  let created = null;
  if (!fs.existsSync(file)) {
    const tmp = file + ".tam";
    fs.writeFileSync(tmp, snapshot(db));
    fs.renameSync(tmp, file);
    created = file;
  }
  const old = fs.readdirSync(dir).filter((f) => f.startsWith(PREFIX) && f.endsWith(".sqlite")).sort().reverse().slice(keep);
  for (const f of old) fs.rmSync(path.join(dir, f), { force: true });
  return created;
}

/** Chạy ngay khi khởi động, rồi kiểm tra lại mỗi giờ (chỉ tạo một bản mỗi ngày). */
export function startAutoBackup(app, dir, opts = {}) {
  const tick = () => {
    try {
      const f = runAutoBackup(app.locals.db, dir, opts);
      if (f) console.log("Đã tự sao lưu:", f);
    } catch (e) {
      console.error("Tự sao lưu thất bại:", e.message);
    }
  };
  tick();
  return setInterval(tick, 60 * 60 * 1000).unref();
}
