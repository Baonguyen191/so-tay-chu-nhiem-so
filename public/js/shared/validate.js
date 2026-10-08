// Kiểm tra và chuẩn hóa dữ liệu nhập vào. Dùng chung cho máy chủ và giao diện.
import { TITLES } from "./constants.js";

/** Bỏ khoảng trắng thừa, chuẩn hóa Unicode tiếng Việt (dữ liệu dán từ Excel/Word đôi khi ở dạng tổ hợp). */
export function cleanText(value) {
  return String(value ?? "").normalize("NFC").replace(/\s+/g, " ").trim();
}

export function stripDiacritics(s) {
  return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
}

const PERSON_NAME = /^[\p{L}\p{M}][\p{L}\p{M} '.-]*$/u;

function personName(value, label, { required }) {
  const v = cleanText(value);
  if (!v) return required ? { error: `Thiếu ${label}` } : { value: "" };
  if (v.length < 2 || v.length > 80) return { error: `${capitalize(label)} phải dài 2–80 ký tự` };
  if (!PERSON_NAME.test(v)) return { error: `${capitalize(label)} chỉ được chứa chữ cái và khoảng trắng` };
  return { value: v };
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function isISODate(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function toISO(y, m, d) {
  const s = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return isISODate(s) ? s : null;
}

export function localToday() {
  const d = new Date();
  return toISO(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/**
 * Đọc ngày từ nhiều dạng: 05/09/2018, 5-9-2018, 2018-09-05, ô ngày của Excel (Date hoặc số).
 * Trả về "YYYY-MM-DD", hoặc null nếu không đọc được.
 */
export function parseDate(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return toISO(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  }
  if (typeof value === "number") {
    // Số thứ tự ngày của Excel (tính từ 30/12/1899).
    if (value < 20000 || value > 80000) return null;
    const dt = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86400000);
    return toISO(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  }
  const s = cleanText(value);
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) return toISO(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return toISO(y, +m[2], +m[1]);
  }
  if (/^\d{5}(\.\d+)?$/.test(s)) return parseDate(Number(s));
  return null;
}

export function parseDob(value, today = localToday()) {
  if (value === null || value === undefined || cleanText(value) === "") return { value: null };
  const iso = parseDate(value);
  if (!iso) return { error: "Ngày sinh không hợp lệ (ghi theo dạng ngày/tháng/năm, ví dụ 05/09/2018)" };
  if (iso < "2000-01-01" || iso > today) return { error: "Ngày sinh không hợp lý" };
  return { value: iso };
}

/** Chuẩn hóa số điện thoại Việt Nam về dạng 0xxxxxxxxx. Rỗng được chấp nhận. */
export function parsePhone(value) {
  let s = cleanText(value).replace(/[\s.\-()]/g, "");
  if (!s) return { value: "" };
  if (s.startsWith("+84")) s = "0" + s.slice(3);
  else if (/^84\d{9}$/.test(s)) s = "0" + s.slice(2);
  // Excel thường làm mất số 0 ở đầu khi ô được định dạng là số.
  else if (/^[1-9]\d{8}$/.test(s)) s = "0" + s;
  if (/^0[35789]\d{8}$/.test(s) || /^02\d{9}$/.test(s)) return { value: s };
  return { error: "Số điện thoại không hợp lệ (cần 10 chữ số, bắt đầu bằng 0)" };
}

export function parseGender(value) {
  const s = stripDiacritics(cleanText(value)).toLowerCase();
  if (!s) return { value: null };
  if (["nam", "m", "male", "trai", "be trai"].includes(s)) return { value: "M" };
  if (["nu", "f", "female", "gai", "be gai"].includes(s)) return { value: "F" };
  return { error: "Giới tính phải là Nam hoặc Nữ" };
}

/** Đổi phần đầu thông báo lỗi "Số điện thoại…" để biết lỗi ở ô nào. */
function withLabel(result, label) {
  return result.error ? { error: result.error.replace(/^Số điện thoại/, label) } : result;
}

function optionalText(value, label, max) {
  const v = cleanText(value);
  if (v.length > max) return { error: `${capitalize(label)} dài quá ${max} ký tự` };
  return { value: v };
}

/** Gộp kết quả từng trường: { value: {...}, errors: [...] } */
function collect(fields) {
  const value = {};
  const errors = [];
  for (const [key, r] of Object.entries(fields)) {
    if (r.error) errors.push(r.error);
    else value[key] = r.value;
  }
  return { value, errors };
}

export function validateStudent(input = {}, { today } = {}) {
  return collect({
    fullName: personName(input.fullName, "họ và tên", { required: true }),
    dob: parseDob(input.dob, today),
    gender: parseGender(input.gender),
    parentName: personName(input.parentName, "họ tên phụ huynh", { required: false }),
    parentPhone: parsePhone(input.parentPhone),
    healthNote: optionalText(input.healthNote, "ghi chú sức khỏe", 300),
    parent2Name: personName(input.parent2Name, "họ tên phụ huynh thứ hai", { required: false }),
    parent2Phone: withLabel(parsePhone(input.parent2Phone), "Số điện thoại phụ huynh thứ hai"),
  });
}

export function parseSchoolYear(value) {
  const m = cleanText(value).match(/^(\d{4})\s*[-–—/]\s*(\d{4})$/);
  if (!m || +m[2] !== +m[1] + 1 || +m[1] < 2000 || +m[1] > 2100) {
    return { error: "Năm học phải có dạng 2026–2027" };
  }
  return { value: `${m[1]}-${m[2]}` };
}

export function validateClass(input = {}) {
  const name = cleanText(input.name).replace(/^lớp\s*/i, "");
  const grade = Number(input.grade);
  const school = cleanText(input.schoolName);
  return collect({
    name: !name ? { error: "Thiếu tên lớp" }
      : name.length > 20 || !/^[\p{L}\p{N} ]+$/u.test(name) ? { error: "Tên lớp chỉ gồm chữ và số, tối đa 20 ký tự (ví dụ 3A)" }
      : { value: name },
    grade: Number.isInteger(grade) && grade >= 1 && grade <= 5 ? { value: grade } : { error: "Khối phải từ 1 đến 5" },
    schoolYear: parseSchoolYear(input.schoolYear),
    schoolName: school.length < 2 || school.length > 120 ? { error: "Tên trường phải dài 2–120 ký tự" } : { value: school },
  });
}

export function validateUsername(value) {
  const v = cleanText(value).toLowerCase();
  if (!/^[a-z0-9._-]{3,32}$/.test(v)) {
    return { error: "Tên đăng nhập dài 3–32 ký tự, chỉ gồm chữ không dấu, số, dấu chấm, gạch dưới, gạch ngang" };
  }
  return { value: v };
}

export function validatePassword(value) {
  const v = typeof value === "string" ? value : "";
  if (v.length < 8) return { error: "Mật khẩu phải có ít nhất 8 ký tự" };
  // bcrypt chỉ dùng 72 byte đầu tiên.
  if (new TextEncoder().encode(v).length > 72) return { error: "Mật khẩu quá dài" };
  return { value: v };
}

export function validateUserProfile(input = {}) {
  return collect({
    fullName: personName(input.fullName, "họ và tên", { required: true }),
    title: TITLES.includes(input.title) ? { value: input.title } : { error: "Danh xưng phải là Cô hoặc Thầy" },
  });
}
