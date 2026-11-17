/**
 * Cấu hình workload lấy từ biến môi trường (`-e TÊN=giá-trị` của k6 hoặc env của container).
 * Mọi giá trị mặc định phục vụ stack đầy đủ + fault overlay chạy trên máy cá nhân.
 */

const env = __ENV;

function text(name, fallback) {
  const value = env[name];
  return value === undefined || value === '' ? fallback : value;
}

function int(name, fallback, min = 0) {
  const raw = text(name, String(fallback));
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min) {
    throw new Error(`${name} phải là số nguyên ≥ ${min}, nhận ${raw}`);
  }
  return value;
}

function float(name, fallback, min = 0) {
  const raw = text(name, String(fallback));
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min) {
    throw new Error(`${name} phải là số ≥ ${min}, nhận ${raw}`);
  }
  return value;
}

export const JOURNEY_IDS = ['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7'];

function journeys() {
  const selected = text('JOURNEYS', JOURNEY_IDS.join(','))
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  for (const id of selected) {
    if (!JOURNEY_IDS.includes(id)) throw new Error(`JOURNEYS có giá trị lạ: ${id}`);
  }
  return selected;
}

const defaultRunId = `k6-level1-${new Date().toISOString().replace(/[-:.]/gu, '').slice(0, 15)}z`;

export const config = {
  baseUrl: text('BASE_URL', 'http://127.0.0.1:3000').replace(/\/$/u, ''),
  runId: text('RUN_ID', defaultRunId),
  seed: int('SEED', 1),
  duration: text('DURATION', '2m'),
  journeys: journeys(),
  /** Số VU cho từng hành trình: VUS_W1..VUS_W7, mặc định VUS (1). */
  vus(journey) {
    return int(`VUS_${journey.toUpperCase()}`, int('VUS', 1, 1), 1);
  },
  /** Thời gian nghỉ đều giữa hai thao tác (mức 1); mức 2 thay bằng log-normal theo thiết kế. */
  thinkMinSeconds: float('THINK_MIN_S', 1),
  thinkMaxSeconds: float('THINK_MAX_S', 3),
  /** Nghỉ giữa hai lần admin kích hoạt job dọn media (W7 là việc định kỳ, thưa hơn). */
  w7PauseSeconds: float('W7_PAUSE_S', 30),
  w7RetentionHours: int('W7_RETENTION_HOURS', 168),
  /** Mỗi đợt gửi hàng loạt gửi tới MỌI student (seed small: ~1000 email), nên giới hạn theo run. */
  w5MaxBatchesPerVu: int('W5_MAX_BATCHES_PER_VU', 1),
  /** Đường dẫn provider mà `ai-worker` gọi được (trong network Compose); rỗng thì tắt W6. */
  llmProviderUrl: text('LLM_PROVIDER_URL', 'http://llm-stub:8080/v1'),
  seedStudents: int('SEED_STUDENTS', 1000, 1),
  seedInstructors: int('SEED_INSTRUCTORS', 10, 1),
  seedPassword: text('SEED_PASSWORD', 'seed-password'),
  admin: {
    email: text('ADMIN_EMAIL', 'admin@example.test'),
    password: text('ADMIN_PASSWORD', 'example-password'),
  },
  /** Thư mục ghi tóm tắt run (trong container k6). */
  resultsDir: text('RESULTS_DIR', '/results'),
  /** Thời gian tối đa chờ việc bất đồng bộ (thumbnail, tài liệu AI, job AI, run dọn media). */
  asyncTimeoutSeconds: int('ASYNC_TIMEOUT_S', 60, 1),
};

export const seedStudentEmail = (index) => `seed-student-${index}@seed.test`;
export const seedInstructorEmail = (index) => `seed-instructor-${index}@seed.test`;
