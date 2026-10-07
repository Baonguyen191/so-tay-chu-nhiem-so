// Gọi API máy chủ: tự gửi mã CSRF, đổi lỗi thành thông báo tiếng Việt.
let csrf = null;
let onUnauthorized = () => {};

export function setCsrf(token) {
  csrf = token;
}
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

export class ApiError extends Error {
  constructor(status, message, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

/**
 * @param {string} method
 * @param {string} path   đường dẫn sau /api
 * @param {object|ArrayBuffer|Blob} [body]
 * @param {{ raw?: boolean }} [opts]  raw: trả về Response (dùng để tải file)
 */
export async function api(method, path, body, { raw = false } = {}) {
  const headers = {};
  let payload;
  if (body instanceof ArrayBuffer || body instanceof Blob) {
    headers["Content-Type"] = "application/octet-stream";
    payload = body;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  if (csrf && method !== "GET") headers["X-CSRF-Token"] = csrf;

  let res;
  try {
    res = await fetch("/api" + path, { method, headers, body: payload, credentials: "same-origin" });
  } catch {
    throw new ApiError(0, "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.");
  }
  if (raw && res.ok) return res;
  let data = null;
  try {
    data = await res.json();
  } catch { /* không phải JSON */ }
  if (!res.ok) {
    if (res.status === 401 && path !== "/login") onUnauthorized();
    throw new ApiError(res.status, data?.error || `Máy chủ báo lỗi (${res.status})`, data);
  }
  return data;
}
