// Tổng hợp theo tuần / tháng. Dùng chung cho giao diện, máy chủ và kiểm thử.
import { weekStart } from "./stats.js";

const pad = (n) => String(n).padStart(2, "0");
const toISO = (dt) => `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
const fromISO = (d) => {
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dd));
};
const vn = (d) => d.split("-").reverse().join("/");

export function addDays(d, n) {
  const x = fromISO(d);
  x.setUTCDate(x.getUTCDate() + n);
  return toISO(x);
}

/** Cộng/trừ tháng, giữ ngày trong khoảng hợp lệ của tháng mới. */
export function addMonths(d, n) {
  const x = fromISO(d);
  const day = x.getUTCDate();
  x.setUTCDate(1);
  x.setUTCMonth(x.getUTCMonth() + n);
  const last = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).getUTCDate();
  x.setUTCDate(Math.min(day, last));
  return toISO(x);
}

/**
 * Khoảng ngày của tuần (thứ Hai → Chủ nhật) hoặc tháng chứa ngày date.
 * @param {"week"|"month"} kind
 * @returns {{ kind: string, from: string, to: string, label: string, key: string }}
 */
export function periodRange(kind, date) {
  if (kind === "week") {
    const from = weekStart(date);
    const to = addDays(from, 6);
    return { kind, from, to, label: `Tuần ${vn(from)} – ${vn(to)}`, key: `tuan-${from}` };
  }
  const [y, m] = date.split("-").map(Number);
  const from = `${y}-${pad(m)}-01`;
  const to = toISO(new Date(Date.UTC(y, m, 0)));
  return { kind: "month", from, to, label: `Tháng ${m}/${y}`, key: `thang-${y}-${pad(m)}` };
}

export function shiftPeriod(kind, date, step) {
  return kind === "week" ? addDays(date, 7 * step) : addMonths(date, step);
}

const rate = (present, total) => (total ? Math.round((present / total) * 1000) / 10 : null);

/** Em cần quan tâm trong kỳ: vắng không phép từ 2 buổi, vắng tổng từ 3 buổi, hoặc có nhận xét "Chưa hoàn thành". */
export const needsCare = (r) => r.K >= 2 || r.P + r.K >= 3 || r.C > 0;

/**
 * Báo cáo một lớp trong khoảng [from, to].
 * @param {{ students: Array<{id:number, fullName:string}>, att: Record<string, Record<number,string>>,
 *           comments: Array<{studentId:number,date:string,level:string}>, stars: Array<{studentId:number,date:string,delta:number}> }} data
 */
export function classReport({ students, att, comments, stars }, from, to) {
  const days = Object.keys(att).filter((d) => d >= from && d <= to).sort();
  const rows = students.map((s) => {
    let P = 0;
    let K = 0;
    for (const d of days) {
      const v = att[d][s.id];
      if (v === "P") P++;
      else if (v === "K") K++;
    }
    const lv = { T: 0, H: 0, C: 0 };
    for (const c of comments) if (c.studentId === s.id && c.date >= from && c.date <= to && c.level in lv) lv[c.level]++;
    let starSum = 0;
    for (const x of stars) if (x.studentId === s.id && x.date >= from && x.date <= to) starSum += x.delta;
    const present = days.length - P - K;
    const row = { id: s.id, fullName: s.fullName, days: days.length, present, P, K, rate: rate(present, days.length), ...lv, stars: starSum };
    row.care = needsCare(row);
    return row;
  });
  const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
  const totals = {
    students: rows.length,
    days: days.length,
    present: sum("present"),
    P: sum("P"),
    K: sum("K"),
    rate: rate(sum("present"), days.length * rows.length),
    T: sum("T"),
    H: sum("H"),
    C: sum("C"),
    stars: sum("stars"),
    care: rows.filter((r) => r.care).length,
  };
  return { from, to, days, rows, totals };
}
