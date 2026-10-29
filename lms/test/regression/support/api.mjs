import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';

import {
  apiErrorSchema,
  apiListResponseSchema,
  apiResponseSchema,
} from '../../../contracts/dist/index.js';

/** Cấu hình lấy từ môi trường; `run-regression.mjs` đặt đủ các biến này cho stack Compose. */
export const config = {
  gatewayUrl: process.env.REGRESSION_GATEWAY_URL ?? 'http://127.0.0.1:3000',
  mailpitUrl: process.env.REGRESSION_MAILPIT_URL ?? 'http://127.0.0.1:8025',
  /** Base URL provider AI giả mà container `ai` gọi tới được; thiếu thì workflow `ai-lesson` bị bỏ qua. */
  aiProviderUrl: process.env.REGRESSION_AI_PROVIDER_URL ?? '',
  admin: {
    email: process.env.REGRESSION_ADMIN_EMAIL ?? 'admin@example.test',
    password: process.env.REGRESSION_ADMIN_PASSWORD ?? 'example-password',
  },
  instructor: {
    email: process.env.REGRESSION_INSTRUCTOR_EMAIL ?? 'instructor@example.test',
    password: process.env.REGRESSION_INSTRUCTOR_PASSWORD ?? 'example-password',
  },
  student: {
    email: process.env.REGRESSION_STUDENT_EMAIL ?? 'student@example.test',
    password: process.env.REGRESSION_STUDENT_PASSWORD ?? 'example-password',
  },
};

/** PNG 1x1 hợp lệ, đủ để `media-worker` sinh thumbnail WebP. */
export const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

export function unique(prefix) {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

/**
 * Gọi Gateway. `body` là object (gửi JSON). `raw: true` trả `bytes` thay vì parse JSON.
 * Trả `{ status, headers, body, bytes }`.
 */
export async function call(method, path, { token, body, headers = {}, raw = false } = {}) {
  const response = await fetch(`${config.gatewayUrl}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  let parsed = null;
  if (!raw && bytes.length > 0) {
    try {
      parsed = JSON.parse(bytes.toString('utf8'));
    } catch {
      parsed = null;
    }
  }
  return { status: response.status, headers: response.headers, body: parsed, bytes };
}

function describe(method, path, response) {
  const detail = response.body ? JSON.stringify(response.body).slice(0, 400) : '(không có JSON)';
  return `${method} ${path} → ${response.status} ${detail}`;
}

/** Kiểm status và (nếu có `schema`) parse envelope thành công theo contract; trả `data`. */
export function expectData(response, status, schema, label = '') {
  assert.equal(
    response.status,
    status,
    `${label} trạng thái ${response.status}: ${describe('', '', response)}`,
  );
  if (!schema) return response.body?.data;
  const parsed = apiResponseSchema(schema).parse(response.body);
  assert.equal(parsed.success, true);
  return parsed.data;
}

export function expectList(response, itemSchema) {
  assert.equal(response.status, 200, describe('GET', 'list', response));
  const parsed = apiListResponseSchema(itemSchema).parse(response.body);
  assert.equal(parsed.success, true);
  assert.ok(parsed.meta.pagination, 'response danh sách phải có meta.pagination');
  return { items: parsed.data, pagination: parsed.meta.pagination };
}

/** Kiểm envelope lỗi; có `code` thì kiểm thêm mã nghiệp vụ ổn định. */
export function expectError(response, status, code) {
  assert.equal(response.status, status, describe('', '', response));
  const parsed = apiErrorSchema.parse(response.body);
  if (code) assert.equal(parsed.error.code, code, `mã lỗi ${parsed.error.code}, mong ${code}`);
  return parsed.error;
}

export async function waitUntil(description, probe, { timeoutMs = 60_000, intervalMs = 500 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let last;
  for (;;) {
    last = await probe();
    if (last) return last;
    if (Date.now() > deadline) throw new Error(`Hết ${timeoutMs} ms chờ: ${description}`);
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

/** Đăng nhập qua đúng cửa của role; trả `{ token, id, refreshToken }`. */
export async function login(door, { email, password }) {
  const response = await call('POST', `/api/v1/auth/${door}/login`, {
    body: { email, password },
  });
  assert.equal(response.status, 200, `đăng nhập ${door} ${email}: ${describe('', '', response)}`);
  const data = response.body.data;
  return { token: data.access_token, id: data.principal.id, refreshToken: data.refresh_token };
}

export const loginAdmin = () => login('admin', config.admin);
export const loginInstructor = () => login('instructor', config.instructor);

/** Đăng ký student mới và đăng nhập; mỗi workflow dùng học viên riêng để không dẫm lên nhau. */
export async function registerStudent(prefix = 'student') {
  const email = `${unique(prefix)}@example.test`;
  const password = 'student-password-1';
  const registered = await call('POST', '/api/v1/auth/register', {
    body: { email, password, full_name: `Học viên ${prefix}` },
  });
  assert.equal(registered.status, 201, describe('POST', '/auth/register', registered));
  const session = await login('student', { email, password });
  return { ...session, email, password };
}

/** upload-intent → POST thẳng lên MinIO → upload-complete. Trả `{ mediaId, complete }`. */
export async function uploadMedia(token, content, fileName, mimeType, extra = {}) {
  const checksum = extra.checksum ?? createHash('sha256').update(content).digest('hex');
  const intent = await call('POST', '/api/v1/media/upload-intents', {
    token,
    body: {
      file_name: fileName,
      mime_type: mimeType,
      size_bytes: content.length,
      checksum_sha256: checksum,
      ...(extra.extractText ? { extract_text: true } : {}),
    },
  });
  const { media_id: mediaId, upload } = expectData(intent, 201, undefined, 'upload-intents');
  const form = new FormData();
  for (const [key, value] of Object.entries(upload.fields)) form.append(key, value);
  form.append('file', new Blob([new Uint8Array(content)], { type: mimeType }), fileName);
  const stored = await fetch(upload.url, { method: 'POST', body: form });
  assert.ok(stored.status < 300, `MinIO từ chối upload trực tiếp: ${stored.status}`);
  const complete = await call('POST', `/api/v1/media/${mediaId}/upload-complete`, { token });
  return { mediaId, complete };
}

/** Một khóa học đã xuất bản có `lessonCount` bài học; trả id để workflow khác dùng. */
export async function createPublishedCourse(instructorToken, { lessonCount = 1 } = {}) {
  const course = await call('POST', '/api/v1/courses', {
    token: instructorToken,
    body: { name: unique('Khóa học'), description_markdown: 'Mô tả khóa học' },
  });
  const courseId = expectData(course, 201, undefined, 'tạo khóa học').id;
  const lessons = [];
  for (let index = 1; index <= lessonCount; index += 1) {
    const lesson = await call('POST', `/api/v1/courses/${courseId}/lessons`, {
      token: instructorToken,
      body: { title: `Bài ${index}`, content_markdown: `Nội dung bài ${index}` },
    });
    lessons.push(expectData(lesson, 201, undefined, 'tạo bài học'));
  }
  const published = await call('PATCH', `/api/v1/courses/${courseId}`, {
    token: instructorToken,
    body: { status: 'PUBLISHED' },
  });
  expectData(published, 200, undefined, 'xuất bản khóa học');
  return { courseId, lessons };
}

export async function mailpitMessagesTo(address) {
  const response = await fetch(
    `${config.mailpitUrl}/api/v1/search?query=${encodeURIComponent(`to:${address}`)}`,
  );
  assert.equal(response.status, 200, `Mailpit search ${response.status}`);
  const body = await response.json();
  return body.messages ?? [];
}
