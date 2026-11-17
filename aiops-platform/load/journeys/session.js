import { sleep } from 'k6';
import crypto from 'k6/crypto';
import exec from 'k6/execution';

import { UnexpectedStatusError, api, login, rawPost } from '../lib/api.js';
import { buildMultipart } from '../lib/bytes.js';
import { config, seedInstructorEmail, seedStudentEmail } from '../lib/config.js';
import { createRng, vuSeed } from '../lib/rng.js';

/**
 * Trạng thái của một VU giữ qua các lượt: bộ sinh số có seed và phiên đăng nhập theo vai trò.
 * Mức 1 chỉ có phản ứng tối thiểu: 401 thì bỏ phiên để lượt sau đăng nhập lại; mã lạ khác thì bỏ lượt.
 */
let state = null;

export function vuState() {
  if (!state) {
    state = { rng: createRng(vuSeed(config.seed, exec.vu.idInTest)), sessions: {}, counters: {} };
  }
  return state;
}

export function think(rng) {
  sleep(rng.uniform(config.thinkMinSeconds, config.thinkMaxSeconds));
}

export function uniqueName(prefix) {
  return `${prefix}-${config.runId}-${exec.vu.idInTest}-${exec.vu.iterationInScenario}`;
}

/** Phiên đăng nhập lưu theo khóa; tạo mới khi chưa có. */
export function session(journey, key, open) {
  const current = vuState();
  if (!current.sessions[key]) current.sessions[key] = open();
  return current.sessions[key];
}

export function seedStudentSession(journey) {
  const { rng } = vuState();
  return session(journey, 'student', () =>
    login(
      journey,
      'student',
      seedStudentEmail(rng.int(1, config.seedStudents)),
      config.seedPassword,
    ),
  );
}

export function seedInstructorSession(journey) {
  const { rng } = vuState();
  return session(journey, 'instructor', () =>
    login(
      journey,
      'instructor',
      seedInstructorEmail(rng.int(1, config.seedInstructors)),
      config.seedPassword,
    ),
  );
}

export function adminSession(journey) {
  return session(journey, 'admin', () =>
    login(journey, 'admin', config.admin.email, config.admin.password),
  );
}

/**
 * Chạy một lượt của hành trình. Lỗi mã HTTP lạ: ghi log ngắn, 401 thì xóa phiên, rồi kết thúc lượt.
 * Lỗi khác (bug script) ném tiếp để k6 báo rõ.
 */
export function runIteration(journey, body) {
  try {
    body(vuState());
  } catch (error) {
    if (!(error instanceof UnexpectedStatusError)) throw error;
    if (error.status === 401) vuState().sessions = {};
    console.warn(`[${journey}] bỏ lượt: ${error.message}`);
  }
}

/** upload-intent → POST thẳng MinIO (file đứng cuối) → upload-complete. Trả `{ mediaId, media }`. */
export function uploadMedia(journey, token, { content, fileName, mimeType, extractText = false }) {
  const intent = api('POST', '/api/v1/media/upload-intents', {
    journey,
    token,
    expected: [201],
    body: {
      file_name: fileName,
      mime_type: mimeType,
      size_bytes: content.length,
      checksum_sha256: crypto.sha256(
        content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength),
        'hex',
      ),
      ...(extractText ? { extract_text: true } : {}),
    },
  }).data;
  const multipart = buildMultipart(
    intent.upload.fields,
    { name: fileName, type: mimeType, content },
    `----k6-${config.runId}-${exec.vu.idInTest}-${Date.now()}`,
  );
  rawPost(intent.upload.url, multipart.body, multipart.contentType, {
    journey,
    name: 'POST minio presigned upload',
  });
  const complete = api('POST', `/api/v1/media/${intent.media_id}/upload-complete`, {
    journey,
    token,
    name: 'POST /api/v1/media/:media_id/upload-complete',
  });
  return { mediaId: intent.media_id, media: complete.data };
}
