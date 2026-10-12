/**
 * Chuẩn bị dữ liệu sạch cho regression suite Testbed MVP.
 *
 * Tạm thời gọi tuần tự các script reset/seed riêng của từng service. Khi lệnh reset/seed thống nhất
 * của W9 task-03 merge, chỉ cần thay danh sách bước dưới đây bằng lệnh đó; regression suite không
 * phụ thuộc vào cách chuẩn bị dữ liệu bên trong.
 */
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Client Redis là dependency của Course nên resolve từ package đó, không thêm vào root workspace.
const { createClient } = createRequire(
  fileURLToPath(new URL('../../services/course/package.json', import.meta.url)),
)('redis');

const REQUIRED_ENV = [
  'W1_AUTH_DATABASE_URL',
  'COURSE_DATABASE_URL',
  'ENROLLMENT_DATABASE_URL',
  'SUBMISSION_DATABASE_URL',
  'GRADING_DATABASE_URL',
  'W2_REDIS_URL',
];

// Chỉ xóa key cache của Course để lần đọc đầu tiên đi qua cả Redis lẫn PostgreSQL.
const COURSE_CACHE_PATTERN = 'course:v1:*';

const STEPS = [
  { service: 'auth', script: '../../services/auth/test/reset-w1-postgres.mjs' },
  { service: 'course', script: '../../services/course/test/reset-w2-postgres.mjs' },
  { service: 'enrollment', script: '../../services/enrollment/test/reset-enrollment-postgres.mjs' },
  { service: 'submission', script: '../../services/submission/test/reset-submission-postgres.mjs' },
  { service: 'grading', script: '../../services/grading/test/reset-grading-postgres.mjs' },
];

const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`[regression] Thiếu biến môi trường: ${missing.join(', ')}`);
  process.exit(1);
}

const startedAt = Date.now();
for (const step of STEPS) {
  const stepStartedAt = Date.now();
  console.info(`[regression] reset/seed ${step.service}...`);
  try {
    execFileSync(process.execPath, [fileURLToPath(new URL(step.script, import.meta.url))], {
      env: process.env,
      stdio: 'inherit',
    });
  } catch {
    // Script con đã in lỗi chi tiết; chỉ nêu bước thất bại, không in connection string.
    console.error(`[regression] reset/seed ${step.service} thất bại`);
    process.exit(1);
  }
  console.info(`[regression] reset/seed ${step.service} xong (${Date.now() - stepStartedAt} ms)`);
}
const cacheStartedAt = Date.now();
console.info('[regression] dọn cache course trên Redis...');
const redis = createClient({ url: process.env.W2_REDIS_URL });
try {
  await redis.connect();
  let removed = 0;
  for await (const keys of redis.scanIterator({ MATCH: COURSE_CACHE_PATTERN, COUNT: 100 })) {
    if (keys.length > 0) removed += await redis.del(keys);
  }
  console.info(
    `[regression] dọn cache course xong: ${removed} key (${Date.now() - cacheStartedAt} ms)`,
  );
} catch {
  console.error('[regression] dọn cache course trên Redis thất bại');
  process.exit(1);
} finally {
  if (redis.isOpen) await redis.quit();
}

console.info(`[regression] Dữ liệu sạch sẵn sàng (${Date.now() - startedAt} ms)`);
