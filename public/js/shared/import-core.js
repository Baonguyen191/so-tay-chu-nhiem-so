// Đọc danh sách học sinh (dán từ Excel, file .csv, file .xlsx) và kiểm tra từng dòng.
// Dùng chung cho máy chủ và bản chạy trong trình duyệt.
import { cleanText, parseDate, stripDiacritics, validateStudent } from "./validate.js";

export const MAX_IMPORT_ROWS = 300;
export const FIELDS = ["fullName", "dob", "gender", "parentName", "parentPhone", "healthNote"];

/** Lỗi do dữ liệu người dùng đưa vào (máy chủ trả mã 400 kèm thông báo này). */
export class InputError extends Error {}

/** Văn bản dán từ Excel: mỗi dòng một em, các cột cách nhau bằng phím Tab. */
export function parsePastedText(text) {
  return String(text ?? "").replace(/^﻿/, "").split(/\r?\n/).map((line) => line.split("\t"));
}

/** Đọc CSV (dấu phẩy hoặc chấm phẩy, có hỗ trợ ngoặc kép). */
export function parseCsv(text) {
  text = String(text).replace(/^﻿/, "");
  const firstLine = text.split(/\r?\n/, 1)[0];
  const sep = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ";" : ",";
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === sep) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/** Giải mã file chữ: ưu tiên UTF-8; nếu không phải thì thử bảng mã tiếng Việt Windows-1258 (Excel cũ). */
export function decodeText(buffer) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1258").decode(buffer).normalize("NFC");
  }
}

function cellValue(v) {
  if (v === null || v === undefined) return "";
  if (v instanceof Date || typeof v === "number" || typeof v === "string") return v;
  if (typeof v === "boolean") return String(v);
  if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join("");
  if ("result" in v) return cellValue(v.result);
  if ("text" in v) return cellValue(v.text);
  return "";
}

/** Đọc trang tính đầu tiên có dữ liệu bằng thư viện ExcelJS (truyền vào vì máy chủ và trình duyệt nạp khác nhau). */
export async function parseXlsxWith(ExcelJS, buffer) {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch {
    throw new InputError("Không đọc được file Excel. Hãy lưu file dưới dạng .xlsx rồi thử lại.");
  }
  const ws = wb.worksheets.find((w) => w.actualRowCount > 0);
  if (!ws) return [];
  const rows = [];
  ws.eachRow({ includeEmpty: true }, (row, n) => {
    const cells = [];
    for (let c = 1; c <= Math.max(row.cellCount, 6); c++) cells.push(cellValue(row.getCell(c).value));
    rows[n - 1] = cells;
  });
  return Array.from(rows, (r) => r || []);
}

/** @param {() => Promise<any>} loadExcelJS  hàm trả về thư viện ExcelJS (chỉ gọi khi là file .xlsx) */
export async function parseFileWith(loadExcelJS, buffer, fileName) {
  const name = String(fileName || "").toLowerCase();
  if (name.endsWith(".xlsx")) return parseXlsxWith(await loadExcelJS(), buffer);
  if (name.endsWith(".csv") || name.endsWith(".txt")) return parseCsv(decodeText(buffer));
  if (name.endsWith(".xls")) throw new InputError("File .xls (Excel đời cũ) chưa được hỗ trợ. Trong Excel, chọn Lưu thành → Excel Workbook (.xlsx).");
  throw new InputError("Chỉ nhận file .xlsx hoặc .csv");
}

const isBlank = (v) => !(v instanceof Date) && cleanText(v) === "";

/** Nhận ra cột từ dòng tiêu đề. Trả về null nếu dòng không phải tiêu đề. */
function detectHeader(cells) {
  const map = {};
  cells.forEach((c, i) => {
    if (typeof c !== "string") return;
    const h = stripDiacritics(c).toLowerCase().replace(/\s+/g, " ").trim();
    if (!h) return;
    let field = null;
    if (/phu huynh|cha me|bo me|nguoi giam ho/.test(h)) field = /dien thoai|sdt|so dt/.test(h) ? "parentPhone" : "parentName";
    else if (/dien thoai|sdt|so dt|phone/.test(h)) field = "parentPhone";
    else if (/ngay sinh|^ns$/.test(h)) field = "dob";
    else if (/gioi tinh|^gioi$|nam\/nu/.test(h)) field = "gender";
    else if (/suc khoe|ghi chu|luu y/.test(h)) field = "healthNote";
    else if (/^(stt|tt|so tt)$/.test(h)) field = "skip";
    else if (/ho va ten|ho ten|ten hoc sinh|^hoc sinh$|^ten$/.test(h)) field = "fullName";
    if (field && field !== "skip" && !(field in map)) map[field] = i;
  });
  return "fullName" in map ? map : null;
}

/**
 * Chuyển các dòng thô thành danh sách học sinh đã kiểm tra.
 * @param {Array<Array<any>>} rows  bảng ô (dòng đầu có thể là tiêu đề)
 * @param {{ existing?: Array<{full_name: string, dob: string|null}>, today?: string, hasHeader?: boolean, skipBlank?: boolean }} opts
 * @returns {{ rows: Array<{ line: number, value: object, errors: string[] }>, validCount: number, errorCount: number }}
 *   Dòng hợp lệ: value là dữ liệu đã chuẩn hóa. Dòng lỗi: value là dữ liệu gốc để hiển thị.
 */
export function checkRows(rows, { existing = [], today, hasHeader, skipBlank = true } = {}) {
  const lines = rows.map((cells, i) => ({ line: i + 1, cells })).filter((r) => !skipBlank || r.cells.some((c) => !isBlank(c)));
  if (!lines.length) throw new InputError("Không có dòng dữ liệu nào");

  let map = hasHeader === false ? null : detectHeader(lines[0].cells);
  if (map) lines.shift();
  else {
    // Không có tiêu đề: theo thứ tự cột của file mẫu. Bỏ cột STT nếu cột đầu toàn là số.
    const sttFirst = lines.every((r) => /^\d{1,3}$/.test(cleanText(r.cells[0])));
    map = Object.fromEntries(FIELDS.map((f, i) => [f, i + (sttFirst ? 1 : 0)]));
  }
  if (!lines.length) throw new InputError("Không có dòng dữ liệu nào");
  if (lines.length > MAX_IMPORT_ROWS) throw new InputError(`Mỗi lần chỉ nhập tối đa ${MAX_IMPORT_ROWS} học sinh`);

  const key = (name, dob) => `${cleanText(name).toLocaleLowerCase("vi")}|${dob || ""}`;
  const seen = new Map(existing.map((s) => [key(s.full_name, s.dob), 0]));

  const out = lines.map(({ line, cells }) => {
    const input = Object.fromEntries(FIELDS.map((f) => [f, map[f] === undefined ? "" : cells[map[f]] ?? ""]));
    const { value, errors } = validateStudent(input, { today });
    if (!errors.length) {
      const k = key(value.fullName, value.dob);
      if (seen.has(k)) errors.push(seen.get(k) === 0 ? "Đã có học sinh này trong lớp" : `Trùng với dòng ${seen.get(k)}`);
      else seen.set(k, line);
    }
    const display = Object.fromEntries(FIELDS.map((f) => [f, input[f] instanceof Date ? parseDate(input[f]) : cleanText(input[f])]));
    return { line, value: errors.length ? display : value, errors };
  });

  const errorCount = out.filter((r) => r.errors.length).length;
  return { rows: out, validCount: out.length - errorCount, errorCount };
}
