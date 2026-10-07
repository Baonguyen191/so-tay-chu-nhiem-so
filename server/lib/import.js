// Đọc danh sách học sinh gửi lên máy chủ. Phần đọc/kiểm tra dùng chung nằm ở public/js/shared/import-core.js.
import ExcelJS from "exceljs";
import { badRequest } from "../http.js";
import { parseFileWith, parsePastedText, parseXlsxWith } from "../../public/js/shared/import-core.js";

export { FIELDS, MAX_IMPORT_ROWS, checkRows, decodeText, parseCsv, parsePastedText } from "../../public/js/shared/import-core.js";

export const parseXlsx = (buffer) => parseXlsxWith(ExcelJS, buffer);
export const parseFile = (buffer, fileName) => parseFileWith(async () => ExcelJS, buffer, fileName);

/** Đọc dữ liệu gửi lên (văn bản dán hoặc file) thành bảng ô. */
export async function readImportSource(req) {
  if (req.is("application/octet-stream")) {
    if (!Buffer.isBuffer(req.body) || !req.body.length) throw badRequest("File trống");
    return parseFile(req.body, req.query.name);
  }
  if (typeof req.body?.text !== "string") throw badRequest("Thiếu dữ liệu cần nhập");
  return parsePastedText(req.body.text);
}
