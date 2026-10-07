// Đặt lại mật khẩu ngay trên máy chủ (khi quản trị quên mật khẩu và không còn quản trị nào khác).
// Cách dùng: npm run dat-lai-mat-khau -- <tên đăng nhập> <mật khẩu mới>
import bcrypt from "bcryptjs";
import { loadConfig } from "../server/config.js";
import { openDb } from "../server/db.js";
import { validatePassword } from "../public/js/shared/validate.js";

const [username, password] = process.argv.slice(2);
if (!username || !password) {
  console.log("Cách dùng: npm run dat-lai-mat-khau -- <tên đăng nhập> <mật khẩu mới>");
  process.exit(1);
}
const check = validatePassword(password);
if (check.error) {
  console.log(check.error);
  process.exit(1);
}

const config = loadConfig();
const db = openDb(config.dbFile);
const user = db.prepare("SELECT id, full_name FROM users WHERE username = ?").get(username.toLowerCase());
if (!user) {
  console.log(`Không có tài khoản "${username}" trong ${config.dbFile}`);
  process.exit(1);
}
db.transaction(() => {
  db.prepare("UPDATE users SET password_hash = ?, is_locked = 0, failed_count = 0, lock_until = 0 WHERE id = ?")
    .run(bcrypt.hashSync(password, config.bcryptRounds), user.id);
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(user.id);
})();
db.close();
console.log(`Đã đặt lại mật khẩu và mở khóa tài khoản "${username}" (${user.full_name}).`);
