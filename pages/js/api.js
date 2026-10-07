// Bản giáo viên chạy trên GitHub Pages: không có máy chủ.
// File này thay cho public/js/api.js khi build: các màn hình vẫn gọi api(method, path, body) như cũ,
// nhưng dữ liệu được đọc/ghi ngay trong bộ nhớ của trình duyệt trên máy giáo viên.
import { InputError, checkRows, parseFileWith, parsePastedText } from "./shared/import-core.js";
import { cleanText, isISODate, localToday, validateClass, validateStudent, validateUserProfile } from "./shared/validate.js";
import { sortByVietnameseName } from "./shared/vnsort.js";
import { LEVELS, STAR_REASONS, SUBJECTS } from "./shared/constants.js";

const KEY = "sotay-gv-v1";
const EXCELJS_URL = "https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js";

export class ApiError extends Error {
  constructor(status, message, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

// Giữ cùng giao diện với bản có máy chủ (bản này không dùng đăng nhập).
export function setCsrf() {}
export function setUnauthorizedHandler() {}

const fail = (msg, status = 400) => { throw new ApiError(status, msg); };
const notFound = (msg = "Không tìm thấy dữ liệu") => fail(msg, 404);
function ensure(result) {
  if (result.errors?.length) fail(result.errors.join(". "));
  return result.value;
}

/* ---------- Lưu trữ ---------- */
function emptyData() {
  return { version: 1, profile: null, nextId: 1, classes: [], students: [], days: [], absences: [], comments: [], stars: [], lastBackup: null };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && d.version === 1) return { ...emptyData(), ...d };
    }
  } catch { /* bộ nhớ bị chặn hoặc hỏng: bắt đầu trống */ }
  return emptyData();
}

let D = load();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(D));
  } catch {
    fail("Không lưu được vào bộ nhớ trình duyệt (đầy hoặc bị chặn). Hãy tải file sao lưu ngay ở mục Lớp & dữ liệu.", 507);
  }
}

export function storageWorks() {
  try {
    localStorage.setItem(KEY + "-thu", "1");
    localStorage.removeItem(KEY + "-thu");
    return true;
  } catch {
    return false;
  }
}

/** Xin trình duyệt giữ dữ liệu lâu dài (không tự xóa khi máy thiếu dung lượng). */
export async function requestPersistence() {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

let onExternalChange = () => {};
export function setExternalChangeHandler(fn) {
  onExternalChange = fn;
}
// Mở ứng dụng ở hai thẻ cùng lúc: thẻ này cập nhật theo thẻ kia.
window.addEventListener("storage", (e) => {
  if (e.key === KEY) {
    D = load();
    onExternalChange();
  }
});

const newId = () => D.nextId++;
const clone = (x) => JSON.parse(JSON.stringify(x));

/* ---------- Đổi dữ liệu thành dạng các màn hình dùng ---------- */
function classDto(c) {
  return {
    id: c.id, name: c.name, grade: c.grade, schoolYear: c.schoolYear, schoolName: c.schoolName,
    teacherId: null,
    teacher: D.profile ? { fullName: D.profile.fullName, title: D.profile.title } : null,
    studentCount: D.students.filter((s) => s.classId === c.id).length,
  };
}

function getClass(id) {
  return D.classes.find((c) => c.id === Number(id)) || notFound("Không tìm thấy lớp");
}
function getStudent(id) {
  return D.students.find((s) => s.id === Number(id)) || notFound("Không tìm thấy học sinh");
}
function studentInClass(classId, studentId) {
  const s = D.students.find((x) => x.id === Number(studentId) && x.classId === classId);
  return s ? s.id : notFound("Không tìm thấy học sinh trong lớp này");
}
function dateParam(d) {
  return isISODate(d) ? d : fail("Ngày không hợp lệ");
}
const studentFields = ({ id, fullName, dob, gender, parentName, parentPhone, healthNote }) =>
  ({ id, fullName, dob, gender, parentName, parentPhone, healthNote });

function readClass(body, exceptId) {
  const c = ensure(validateClass(body));
  const dup = D.classes.some((x) => x.id !== exceptId && x.name.toLowerCase() === c.name.toLowerCase()
    && x.schoolYear === c.schoolYear && x.schoolName === c.schoolName);
  if (dup) fail("Đã có lớp này trong năm học đó", 409);
  return c;
}

let excelPromise = null;
function loadExcelJS() {
  if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
  excelPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = EXCELJS_URL;
    s.onload = () => resolve(window.ExcelJS);
    s.onerror = () => {
      excelPromise = null;
      reject(new InputError("Không tải được bộ đọc file Excel (cần mạng Internet). Hãy thử lại, hoặc dùng cách dán từ Excel."));
    };
    document.head.appendChild(s);
  });
  return excelPromise;
}

/* ---------- Các "đường dẫn" giống bản có máy chủ ---------- */
const routes = [
  ["GET", /^\/state$/, () => ({ needsSetup: !D.profile, user: D.profile ? { id: 0, username: "", role: "teacher", ...D.profile } : null, csrf: null })],

  ["POST", /^\/setup$/, (_m, body) => {
    D.profile = ensure(validateUserProfile(body));
    save();
    return { user: { id: 0, username: "", role: "teacher", ...D.profile }, csrf: null };
  }],
  ["PUT", /^\/profile$/, (_m, body) => {
    D.profile = ensure(validateUserProfile(body));
    save();
    return { user: { id: 0, username: "", role: "teacher", ...D.profile } };
  }],

  ["GET", /^\/classes$/, () => ({
    classes: [...D.classes]
      .sort((a, b) => b.schoolYear.localeCompare(a.schoolYear) || a.grade - b.grade || a.name.localeCompare(b.name, "vi"))
      .map(classDto),
  })],
  ["POST", /^\/my\/classes$/, (_m, body) => {
    const c = { id: newId(), ...readClass(body) };
    D.classes.push(c);
    save();
    return { class: classDto(c) };
  }],
  ["PATCH", /^\/my\/classes\/(\d+)$/, ([id], body) => {
    const c = getClass(id);
    Object.assign(c, readClass(body, c.id));
    save();
    return { class: classDto(c) };
  }],
  ["DELETE", /^\/my\/classes\/(\d+)$/, ([id]) => {
    const c = getClass(id);
    if (D.students.some((s) => s.classId === c.id)) fail("Lớp vẫn còn học sinh. Hãy xóa hết học sinh trước khi xóa lớp.");
    D.classes = D.classes.filter((x) => x.id !== c.id);
    D.days = D.days.filter((x) => x.classId !== c.id);
    save();
    return { ok: true };
  }],

  ["GET", /^\/classes\/(\d+)\/data$/, ([cid]) => {
    const c = getClass(cid);
    const ids = new Set(D.students.filter((s) => s.classId === c.id).map((s) => s.id));
    return clone({
      class: classDto(c),
      students: sortByVietnameseName(D.students.filter((s) => s.classId === c.id).map(studentFields)),
      days: D.days.filter((d) => d.classId === c.id).map((d) => d.date).sort(),
      absences: D.absences.filter((a) => ids.has(a.studentId)),
      comments: D.comments.filter((x) => ids.has(x.studentId)),
      stars: D.stars.filter((x) => ids.has(x.studentId)),
    });
  }],

  ["POST", /^\/classes\/(\d+)\/students$/, ([cid], body) => {
    const c = getClass(cid);
    const s = { id: newId(), classId: c.id, ...ensure(validateStudent(body, { today: localToday() })) };
    D.students.push(s);
    save();
    return { student: studentFields(s) };
  }],
  ["PUT", /^\/students\/(\d+)$/, ([id], body) => {
    const s = getStudent(id);
    Object.assign(s, ensure(validateStudent(body, { today: localToday() })));
    save();
    return { student: studentFields(s) };
  }],
  ["DELETE", /^\/students\/(\d+)$/, ([id]) => {
    const s = getStudent(id);
    D.students = D.students.filter((x) => x.id !== s.id);
    D.absences = D.absences.filter((x) => x.studentId !== s.id);
    D.comments = D.comments.filter((x) => x.studentId !== s.id);
    D.stars = D.stars.filter((x) => x.studentId !== s.id);
    save();
    return { ok: true };
  }],

  ["POST", /^\/classes\/(\d+)\/students\/import\/preview$/, async ([cid], body, query) => {
    const c = getClass(cid);
    let rows;
    if (body instanceof ArrayBuffer) rows = await parseFileWith(loadExcelJS, body, query.get("name"));
    else if (typeof body?.text === "string") rows = parsePastedText(body.text);
    else fail("Thiếu dữ liệu cần nhập");
    const existing = D.students.filter((s) => s.classId === c.id).map((s) => ({ full_name: s.fullName, dob: s.dob }));
    return checkRows(rows, { existing, today: localToday() });
  }],
  ["POST", /^\/classes\/(\d+)\/students\/import$/, ([cid], body) => {
    const c = getClass(cid);
    if (!Array.isArray(body?.rows) || !body.rows.length) fail("Không có học sinh nào để lưu");
    const existing = D.students.filter((s) => s.classId === c.id).map((s) => ({ full_name: s.fullName, dob: s.dob }));
    const cells = body.rows.map((s) => ["fullName", "dob", "gender", "parentName", "parentPhone", "healthNote"].map((f) => (typeof s?.[f] === "string" ? s[f] : "")));
    const checked = checkRows(cells, { existing, today: localToday(), hasHeader: false, skipBlank: false });
    if (checked.errorCount) fail("Danh sách còn dòng lỗi, chưa lưu học sinh nào");
    for (const r of checked.rows) D.students.push({ id: newId(), classId: c.id, ...r.value });
    save();
    return { inserted: checked.rows.length };
  }],

  ["PUT", /^\/classes\/(\d+)\/attendance\/([\d-]+)$/, ([cid, date], body) => {
    const c = getClass(cid);
    dateParam(date);
    const entries = Object.entries(body?.absences ?? {}).map(([sid, st]) => {
      if (st !== "P" && st !== "K") fail("Trạng thái điểm danh không hợp lệ");
      return [studentInClass(c.id, sid), st];
    });
    const ids = new Set(D.students.filter((s) => s.classId === c.id).map((s) => s.id));
    if (!D.days.some((d) => d.classId === c.id && d.date === date)) D.days.push({ classId: c.id, date });
    D.absences = D.absences.filter((a) => !(a.date === date && ids.has(a.studentId)));
    for (const [studentId, status] of entries) D.absences.push({ studentId, date, status });
    save();
    return { ok: true };
  }],
  ["PUT", /^\/classes\/(\d+)\/attendance\/([\d-]+)\/students\/(\d+)$/, ([cid, date, sid], body) => {
    const c = getClass(cid);
    dateParam(date);
    const studentId = studentInClass(c.id, sid);
    const status = body?.status ?? "";
    if (!["", "P", "K"].includes(status)) fail("Trạng thái điểm danh không hợp lệ");
    if (!D.days.some((d) => d.classId === c.id && d.date === date)) D.days.push({ classId: c.id, date });
    D.absences = D.absences.filter((a) => !(a.studentId === studentId && a.date === date));
    if (status) D.absences.push({ studentId, date, status });
    save();
    return { ok: true };
  }],
  ["DELETE", /^\/classes\/(\d+)\/attendance\/([\d-]+)$/, ([cid, date]) => {
    const c = getClass(cid);
    dateParam(date);
    const ids = new Set(D.students.filter((s) => s.classId === c.id).map((s) => s.id));
    D.days = D.days.filter((d) => !(d.classId === c.id && d.date === date));
    D.absences = D.absences.filter((a) => !(a.date === date && ids.has(a.studentId)));
    save();
    return { ok: true };
  }],

  ["POST", /^\/classes\/(\d+)\/comments$/, ([cid], b = {}) => {
    const c = getClass(cid);
    const studentId = studentInClass(c.id, b.studentId);
    const date = dateParam(b.date);
    if (!SUBJECTS.includes(b.subject)) fail("Môn học không hợp lệ");
    if (!Object.hasOwn(LEVELS, b.level)) fail("Mức đánh giá không hợp lệ");
    const text = cleanText(b.text);
    if (!text) fail("Hãy nhập nội dung nhận xét");
    if (text.length > 1000) fail("Nhận xét dài quá 1000 ký tự");
    const comment = { id: newId(), studentId, date, subject: b.subject, level: b.level, text };
    D.comments.push(comment);
    save();
    return { comment: clone(comment) };
  }],
  ["DELETE", /^\/comments\/(\d+)$/, ([id]) => {
    if (!D.comments.some((c) => c.id === Number(id))) notFound("Không tìm thấy nhận xét");
    D.comments = D.comments.filter((c) => c.id !== Number(id));
    save();
    return { ok: true };
  }],
  ["POST", /^\/classes\/(\d+)\/stars$/, ([cid], b = {}) => {
    const c = getClass(cid);
    const studentId = studentInClass(c.id, b.studentId);
    const date = dateParam(b.date);
    if (b.delta !== 1 && b.delta !== -1) fail("Số sao không hợp lệ");
    if (!STAR_REASONS.includes(b.reason)) fail("Lý do không hợp lệ");
    const star = { id: newId(), studentId, date, delta: b.delta, reason: b.reason };
    D.stars.push(star);
    save();
    return { star: clone(star) };
  }],
];

export async function api(method, path, body) {
  const [pathname, qs = ""] = path.split("?");
  const query = new URLSearchParams(qs);
  for (const [m, re, handler] of routes) {
    const match = m === method && re.exec(pathname);
    if (!match) continue;
    try {
      return await handler(match.slice(1), body, query);
    } catch (e) {
      if (e instanceof ApiError) throw e;
      if (e instanceof InputError) throw new ApiError(400, e.message);
      console.error(e);
      throw new ApiError(500, "Có lỗi khi xử lý dữ liệu. Hãy tải lại trang rồi thử lại.");
    }
  }
  throw new ApiError(404, "Không có chức năng này");
}

/* ---------- Sao lưu ra file / khôi phục / xóa ---------- */
export function getLastBackup() {
  return D.lastBackup;
}

export function exportBackup() {
  D.lastBackup = new Date().toISOString();
  save();
  const { lastBackup, ...data } = D;
  return JSON.stringify({ app: "so-tay-chu-nhiem-so", exportedAt: lastBackup, ...data }, null, 1);
}

const isStr = (v, max = 1000) => typeof v === "string" && v.length <= max;
const isId = (v) => Number.isSafeInteger(v) && v > 0;

/** Kiểm tra file sao lưu rồi thay toàn bộ dữ liệu trên máy này. */
export function importBackup(text) {
  let d;
  try {
    d = JSON.parse(text);
  } catch {
    fail("File không phải bản sao lưu của Sổ tay Chủ nhiệm số");
  }
  if (d?.app !== "so-tay-chu-nhiem-so" || d.version !== 1) fail("File không phải bản sao lưu của Sổ tay Chủ nhiệm số");
  for (const k of ["classes", "students", "days", "absences", "comments", "stars"]) {
    if (!Array.isArray(d[k])) fail("File sao lưu bị thiếu dữ liệu");
  }
  const profile = d.profile ? validateUserProfile(d.profile) : null;
  const next = {
    ...emptyData(),
    profile: profile && !profile.errors.length ? profile.value : null,
    classes: d.classes.filter((c) => isId(c?.id) && !validateClass(c).errors.length)
      .map((c) => ({ id: c.id, ...validateClass(c).value })),
    days: d.days.filter((x) => isId(x?.classId) && isISODate(x.date)).map(({ classId, date }) => ({ classId, date })),
    absences: d.absences.filter((x) => isId(x?.studentId) && isISODate(x.date) && (x.status === "P" || x.status === "K"))
      .map(({ studentId, date, status }) => ({ studentId, date, status })),
    comments: d.comments.filter((x) => isId(x?.id) && isId(x.studentId) && isISODate(x.date) && SUBJECTS.includes(x.subject) && Object.hasOwn(LEVELS, x.level) && isStr(x.text))
      .map(({ id, studentId, date, subject, level, text }) => ({ id, studentId, date, subject, level, text })),
    stars: d.stars.filter((x) => isId(x?.id) && isId(x.studentId) && isISODate(x.date) && (x.delta === 1 || x.delta === -1) && STAR_REASONS.includes(x.reason))
      .map(({ id, studentId, date, delta, reason }) => ({ id, studentId, date, delta, reason })),
  };
  const classIds = new Set(next.classes.map((c) => c.id));
  next.students = d.students.filter((s) => isId(s?.id) && classIds.has(s.classId))
    .map((s) => ({ s, v: validateStudent(s) }))
    .filter(({ v }) => !v.errors.length)
    .map(({ s, v }) => ({ id: s.id, classId: s.classId, ...v.value }));
  const allIds = [...next.classes, ...next.students, ...next.comments, ...next.stars].map((x) => x.id);
  next.nextId = Math.max(0, ...allIds) + 1;
  D = next;
  save();
  return { classes: next.classes.length, students: next.students.length };
}

export function clearAll() {
  D = emptyData();
  try { localStorage.removeItem(KEY); } catch { /* bỏ qua */ }
}
