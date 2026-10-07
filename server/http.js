// Tiện ích nhỏ cho xử lý yêu cầu HTTP.

export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export const badRequest = (msg, extra) => new HttpError(400, msg, extra);
export const notFound = (msg = "Không tìm thấy dữ liệu") => new HttpError(404, msg);
export const forbidden = (msg = "Bạn không có quyền thực hiện thao tác này") => new HttpError(403, msg);

/** Ném lỗi 400 nếu kết quả kiểm tra có lỗi; trả về giá trị đã chuẩn hóa. */
export function ensureValid(result) {
  if (result.errors?.length) throw badRequest(result.errors.join(". "), { errors: result.errors });
  if (result.error) throw badRequest(result.error);
  return result.value;
}

export function idParam(value) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) throw notFound();
  return n;
}

export function parseCookies(header) {
  const out = {};
  for (const part of String(header || "").split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (!k || k in out) continue;
    try {
      out[k] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      out[k] = part.slice(i + 1).trim();
    }
  }
  return out;
}

export function errorHandler(err, req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, ...err.extra });
  }
  if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "Dữ liệu gửi lên không đúng định dạng" });
  if (err?.type === "entity.too.large") return res.status(413).json({ error: "Dữ liệu gửi lên quá lớn" });
  console.error(err);
  res.status(500).json({ error: "Máy chủ gặp lỗi, vui lòng thử lại" });
}
