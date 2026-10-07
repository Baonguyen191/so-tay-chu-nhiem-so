// Tính chuyên cần và ngôi sao. Dùng chung cho giao diện và kiểm thử.
//
// att: { "2026-10-05": { 12: "P", 15: "K" }, "2026-10-06": {} }
//   Mỗi khóa là một ngày lớp đã điểm danh; bên trong chỉ ghi học sinh vắng (P = có phép, K = không phép).

/** Dựng bảng điểm danh từ danh sách ngày đã điểm danh và danh sách vắng. */
export function buildAttendance(days, absences) {
  const att = {};
  for (const d of days) att[d] = {};
  for (const a of absences) {
    if (!att[a.date]) att[a.date] = {};
    att[a.date][a.studentId] = a.status;
  }
  return att;
}

function daysInRange(att, from, to) {
  return Object.keys(att).filter((d) => d >= from && d <= to);
}

/** Số buổi đã điểm danh, số buổi vắng có phép (P), không phép (K) của một em từ đầu tháng đến ngày đang xem. */
export function monthStats(att, studentId, curDate) {
  const days = daysInRange(att, curDate.slice(0, 7) + "-01", curDate);
  let P = 0;
  let K = 0;
  for (const d of days) {
    const v = att[d][studentId];
    if (v === "P") P++;
    else if (v === "K") K++;
  }
  return { days: days.length, P, K, present: days.length - P - K };
}

/** Tỉ lệ có mặt (%) của một em; null nếu chưa có buổi nào. */
export function studentRate(stats) {
  return stats.days ? Math.round((stats.present / stats.days) * 1000) / 10 : null;
}

/**
 * Tỉ lệ chuyên cần của cả lớp trong tháng (%), làm tròn 1 chữ số thập phân.
 * = tổng lượt có mặt / (số buổi đã điểm danh × sĩ số). Trả về null nếu tháng chưa điểm danh buổi nào.
 */
export function classRate(att, students, curDate) {
  const days = daysInRange(att, curDate.slice(0, 7) + "-01", curDate);
  if (!days.length || !students.length) return null;
  let total = 0;
  let present = 0;
  for (const d of days) {
    for (const s of students) {
      total++;
      if (!att[d][s.id]) present++;
    }
  }
  return Math.round((present / total) * 1000) / 10;
}

/** Ngày thứ Hai đầu tuần chứa ngày d (YYYY-MM-DD). */
export function weekStart(d) {
  const [y, m, dd] = d.split("-").map(Number);
  const x = new Date(Date.UTC(y, m - 1, dd));
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  return x.toISOString().slice(0, 10);
}

/** Tổng số sao của một em từ ngày from (nếu có) đến ngày to. */
export function starTotal(stars, studentId, from, to) {
  let n = 0;
  for (const x of stars) {
    if (x.studentId === studentId && (!from || x.date >= from) && x.date <= to) n += x.delta;
  }
  return n;
}

/** Số buổi vắng trong khoảng ngày [from, to]. */
export function absencesBetween(att, studentId, from, to) {
  let P = 0;
  let K = 0;
  for (const d of daysInRange(att, from, to)) {
    const v = att[d][studentId];
    if (v === "P") P++;
    else if (v === "K") K++;
  }
  return { P, K };
}
