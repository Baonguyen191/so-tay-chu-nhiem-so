// Nạp dữ liệu demo (lớp 3A, 20 học sinh) vào file RIÊNG data/demo.sqlite rồi chạy ứng dụng.
// Dùng khi đi thi / trình diễn: npm run demo
// Chỉ nạp, không chạy:            npm run demo -- --chi-nap
// Dữ liệu thật (data/sotay.sqlite) không bị đụng tới.
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { ROOT, loadConfig } from "../server/config.js";
import { openDb } from "../server/db.js";
import { QUICK, STAR_REASONS, SUBJECTS } from "../public/js/shared/constants.js";

const DEMO_FILE = path.join(ROOT, "data", "demo.sqlite");
const DEMO_PASSWORD = "demo2026";

const NAMES = [["Nguyễn Minh Anh", "F"], ["Trần Gia Bảo", "M"], ["Lê Ngọc Châu", "F"], ["Phạm Đức Duy", "M"], ["Hoàng Thu Hà", "F"], ["Vũ Quang Huy", "M"], ["Đặng Khánh Linh", "F"], ["Bùi Tuấn Kiệt", "M"], ["Đỗ Phương Mai", "F"], ["Ngô Bảo Nam", "M"], ["Dương Thảo Nhi", "F"], ["Lý Hoàng Phúc", "M"], ["Trịnh Minh Quân", "M"], ["Mai Diệu Thảo", "F"], ["Phan Anh Thư", "F"], ["Hồ Đức Trí", "M"], ["Chu Bảo Trâm", "F"], ["Tạ Gia Vinh", "M"], ["Lương Hải Yến", "F"], ["Kiều Nhật Long", "M"]];
const PARENTS = ["Nguyễn Văn", "Trần Thị", "Lê Văn", "Phạm Thị", "Hoàng Văn", "Vũ Thị", "Đặng Văn", "Bùi Thị", "Đỗ Văn", "Ngô Thị"];
const PARENT_GIVEN = ["Hùng", "Lan", "Tuấn", "Hoa", "Dũng", "Hương", "Thắng", "Nga", "Sơn", "Thủy"];
const HEALTH = { 2: "Dị ứng hải sản", 6: "Hen phế quản nhẹ – mang theo thuốc xịt", 11: "Cận thị, ngồi bàn đầu", 16: "Dị ứng sữa bò" };

function iso(d) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}

// Số ngẫu nhiên lặp lại được, để lần nào nạp cũng ra cùng dữ liệu.
function rnd(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function seedDemo(db) {
  const r = rnd(42);
  const hash = bcrypt.hashSync(DEMO_PASSWORD, 10);
  db.transaction(() => {
    db.prepare("INSERT INTO users (username, full_name, title, role, password_hash) VALUES ('admin', 'Trần Văn Minh', 'Thầy', 'admin', ?)").run(hash);
    const teacherId = db.prepare("INSERT INTO users (username, full_name, title, role, password_hash) VALUES ('cohanh', 'Nguyễn Thị Hạnh', 'Cô', 'teacher', ?)").run(hash).lastInsertRowid;
    const classId = db.prepare("INSERT INTO classes (name, grade, school_year, school_name, teacher_id) VALUES ('3A', 3, '2026-2027', 'Trường Tiểu học xã Tân Minh', ?)").run(teacherId).lastInsertRowid;

    const addStudent = db.prepare(`INSERT INTO students (class_id, full_name, dob, gender, parent_name, parent_phone, health_note)
      VALUES (?, ?, ?, ?, ?, ?, ?)`);
    const ids = NAMES.map(([name, gender], i) => Number(addStudent.run(
      classId, name,
      `2018-${String(1 + ((i * 7) % 12)).padStart(2, "0")}-${String(3 + ((i * 5) % 25)).padStart(2, "0")}`,
      gender,
      `${PARENTS[i % PARENTS.length]} ${PARENT_GIVEN[i % 10]}`,
      `0900000${String(100 + i)}`, // số giả, không phải số thật của ai
      HEALTH[i] || "",
    ).lastInsertRowid));

    const addDay = db.prepare("INSERT INTO attendance_days (class_id, date) VALUES (?, ?)");
    const addAbs = db.prepare("INSERT INTO absences (student_id, date, status) VALUES (?, ?, ?)");
    const addCmt = db.prepare("INSERT INTO comments (student_id, date, subject, level, text, created_by) VALUES (?, ?, ?, ?, ?, ?)");
    const addStar = db.prepare("INSERT INTO stars (student_id, date, delta, reason, created_by) VALUES (?, ?, ?, ?, ?)");

    // 22 ngày học gần nhất (bỏ thứ Bảy, Chủ nhật), không gồm hôm nay để giáo viên tự điểm danh khi trình diễn.
    const d = new Date();
    let count = 0;
    while (count < 22) {
      d.setDate(d.getDate() - 1);
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      count++;
      const day = iso(d);
      addDay.run(classId, day);
      ids.forEach((sid, i) => {
        const x = r();
        const weak = i === 9 || i === 17; // hai em hay vắng để mục "Cần quan tâm" có dữ liệu
        if (x < (weak ? 0.12 : 0.02)) addAbs.run(sid, day, "K");
        else if (x < (weak ? 0.2 : 0.05)) addAbs.run(sid, day, "P");
      });
      if (count <= 8) {
        for (let j = 0; j < 3; j++) {
          const sid = ids[Math.floor(r() * ids.length)];
          const lv = r() < 0.55 ? "T" : r() < 0.8 ? "H" : "C";
          addCmt.run(sid, day, SUBJECTS[Math.floor(r() * 4)], lv, QUICK[lv][Math.floor(r() * QUICK[lv].length)], teacherId);
        }
      }
      if (count <= 5) {
        for (let j = 0; j < 6; j++) {
          const sid = ids[Math.floor(r() * ids.length)];
          const neg = r() < 0.12;
          addStar.run(sid, day, neg ? -1 : 1, neg ? "Nói chuyện riêng" : STAR_REASONS[Math.floor(r() * 5)], teacherId);
        }
      }
    }
    addCmt.run(ids[9], iso(new Date(Date.now() - 86400000 * 2)), "Toán", "C", "Cần luyện thêm bảng nhân 6, 7.", teacherId);
  })();
}

async function main() {
  for (const ext of ["", "-wal", "-shm"]) fs.rmSync(DEMO_FILE + ext, { force: true });
  const db = openDb(DEMO_FILE);
  seedDemo(db);
  db.close();
  console.log("Đã nạp dữ liệu demo vào", DEMO_FILE);
  console.log(`  Quản trị:  admin  / ${DEMO_PASSWORD}`);
  console.log(`  Giáo viên: cohanh / ${DEMO_PASSWORD}`);
  if (process.argv.includes("--chi-nap")) return;
  process.env.DB_FILE = DEMO_FILE;
  console.log(`Đang chạy ứng dụng với dữ liệu demo (cổng ${loadConfig().port})…\n`);
  await import("../server/index.js");
}

main();
