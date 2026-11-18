import { check, sleep } from 'k6';
import http from 'k6/http';

import { config } from './config.js';

/**
 * Lớp gọi Gateway dùng chung cho mọi hành trình.
 *
 * - Mỗi request gắn tag `journey` và `name` (METHOD + route mẫu, không chứa ID) để metric của k6
 *   không nổ số chuỗi theo ID.
 * - `expected` là các mã HTTP coi là bình thường cho thao tác đó (ví dụ ghi danh lại trả 409). Mã nằm
 *   ngoài danh sách được k6 tính vào `http_req_failed`; ngưỡng của run yêu cầu tỉ lệ này bằng 0 trên
 *   stack khỏe.
 */

const callbacks = new Map();

function expectedCallback(statuses) {
  const key = statuses.join(',');
  if (!callbacks.has(key)) callbacks.set(key, http.expectedStatuses(...statuses));
  return callbacks.get(key);
}

export class UnexpectedStatusError extends Error {
  constructor(name, status, body) {
    super(`${name} trả ${status}: ${String(body).slice(0, 200)}`);
    this.status = status;
  }
}

/**
 * Gọi Gateway. Trả `{ status, data, meta, body }`; ném `UnexpectedStatusError` khi mã không nằm trong
 * `expected` để hành trình dừng lượt hiện tại (phản ứng của mức 1: bỏ lượt, lượt sau làm lại).
 */
export function api(method, path, { journey, name, token, body, expected = [200], headers } = {}) {
  const label = name ?? `${method} ${path}`;
  const response = http.request(
    method,
    `${config.baseUrl}${path}`,
    body === undefined ? null : JSON.stringify(body),
    {
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      tags: { journey, name: label },
      responseCallback: expectedCallback(expected),
    },
  );
  if (!expected.includes(response.status)) {
    throw new UnexpectedStatusError(label, response.status, response.body);
  }
  let parsed = null;
  const contentType = response.headers['Content-Type'] ?? '';
  if (contentType.includes('application/json') && response.body) {
    parsed = JSON.parse(response.body);
  }
  return { status: response.status, data: parsed?.data, meta: parsed?.meta, body: response.body };
}

/** Gọi URL tuyệt đối không qua Gateway (presigned POST lên MinIO). */
export function rawPost(url, body, contentType, { journey, name, expected = [201, 204] } = {}) {
  const response = http.post(url, body, {
    headers: { 'content-type': contentType },
    tags: { journey, name },
    responseCallback: expectedCallback(expected),
  });
  if (!expected.includes(response.status)) {
    throw new UnexpectedStatusError(name, response.status, response.body);
  }
  return response;
}

export function login(journey, door, email, password) {
  const result = api('POST', `/api/v1/auth/${door}/login`, {
    journey,
    name: `POST /api/v1/auth/${door}/login`,
    body: { email, password },
  });
  return {
    token: result.data.access_token,
    refreshToken: result.data.refresh_token,
    id: result.data.principal.id,
    email,
  };
}

/**
 * Chờ điều kiện của việc bất đồng bộ: gọi `probe` mỗi `intervalSeconds` tới khi trả giá trị khác null.
 * Hết giờ thì ghi check thất bại và trả null (không ném, để lượt sau vẫn chạy).
 */
export function waitFor(journey, description, probe, intervalSeconds = 1) {
  const deadline = Date.now() + config.asyncTimeoutSeconds * 1000;
  for (;;) {
    const value = probe();
    if (value !== null && value !== undefined) {
      check(value, { [`${description}`]: () => true }, { journey });
      return value;
    }
    if (Date.now() > deadline) {
      check(null, { [`${description}`]: () => false }, { journey });
      return null;
    }
    sleep(intervalSeconds);
  }
}

/** Id của mọi khóa học đã xuất bản, đọc hết các trang của `GET /api/v1/courses`. */
export function catalogueIds(token, journey = 'setup') {
  const ids = [];
  for (let page = 1; ; page += 1) {
    const result = api('GET', `/api/v1/courses?page=${page}&page_size=100`, {
      journey,
      name: 'GET /api/v1/courses',
      token,
    });
    for (const course of result.data ?? []) ids.push(course.id);
    const totalPages = result.meta?.pagination?.total_pages ?? 1;
    if (page >= totalPages || (result.data ?? []).length === 0) return ids;
  }
}
