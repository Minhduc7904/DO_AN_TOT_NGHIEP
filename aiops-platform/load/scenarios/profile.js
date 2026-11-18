import { fail } from 'k6';
import crypto from 'k6/crypto';
import exec from 'k6/execution';

import { api, login, rawPost, waitFor } from '../lib/api.js';
import { buildMultipart, PNG_1X1, utf8 } from '../lib/bytes.js';
import { config, seedInstructorEmail } from '../lib/config.js';
import { createRng, hash32 } from '../lib/rng.js';
import {
  adminPlan,
  hourlyArrivalStages,
  instructorPlan,
  scheduledStarts,
  sessionsPerHour,
} from '../lib/staff-plan.js';
import {
  playAdminAdhoc,
  playAdminBatch,
  playAdminCleanup,
  playInstructorSession,
} from '../model/staff.js';
import {
  arrival,
  courseMapSetup,
  GRACE_S,
  meta,
  PHASE,
  PLAN_PATH,
  reactionParams,
  RUN_SECONDS,
  runStudentIteration,
  sessions,
  studentScenario,
  studentSummary,
  WINDOW_START_S,
  WORKLOAD_SEED,
} from '../model/student-scenario.js';

/**
 * Profile healthy (workload-design-v1 mục 8.1–8.2; ADR-007 mục 1): học viên phát lại phiên thật
 * (mức 2+) + giảng viên, admin, job lịch (mức 2), chạy song song trên một ngày nén 48 phút.
 *
 *   PROFILE=normal-mixed  aiops-platform/load/run-k6.sh profile   # ngày gần trung vị
 *   PROFILE=healthy-spike aiops-platform/load/run-k6.sh profile   # ngày cao điểm trước hạn quiz
 *
 * Kế hoạch học viên mặc định `data/plans/moodle-<PROFILE>-k4-v1.json` (PLAN để đổi). WINDOW_START_S,
 * WINDOW_S cắt một đoạn của ngày để chạy thử; lịch của giảng viên/admin cắt theo cùng cửa sổ.
 * Ghi `k6-summary.json` và `workload-manifest.json` (mục 11.2) vào thư mục kết quả của run.
 */

const PROFILE_VERSION = 'v1';
const STAFF_TEXT = open('../params/staff-assumed-v1.json');
const REACTION_TEXT = open('../params/reaction-v1.json');
const staff = JSON.parse(STAFF_TEXT);
const DAY_SECONDS = meta.run_seconds;
const deadline = () => exec.scenario.startTime + (RUN_SECONDS + GRACE_S - 5) * 1000;

function staffScenarios() {
  const scenarios = {};
  const instructorRate = hourlyArrivalStages(
    sessionsPerHour(staff.instructor.sessions_per_day, staff.instructor.hourly_weight),
    DAY_SECONDS,
    WINDOW_START_S,
    RUN_SECONDS,
  );
  scenarios.instructors = {
    executor: 'ramping-arrival-rate',
    exec: 'instructors',
    startRate: instructorRate.startRate,
    timeUnit: instructorRate.timeUnit,
    stages: instructorRate.stages,
    preAllocatedVUs: Number(__ENV.INSTRUCTOR_PRE_VUS || 15),
    maxVUs: Number(__ENV.INSTRUCTOR_MAX_VUS || 40),
    gracefulStop: `${GRACE_S}s`,
  };
  const adhocPerHour = Array.from({ length: 24 }, (_, hour) =>
    staff.admin.adhoc_hours.includes(hour) ? 1 : 0,
  );
  const adhoc = hourlyArrivalStages(adhocPerHour, DAY_SECONDS, WINDOW_START_S, RUN_SECONDS);
  scenarios.admin_adhoc = {
    executor: 'ramping-arrival-rate',
    exec: 'adminAdhoc',
    startRate: adhoc.startRate,
    timeUnit: adhoc.timeUnit,
    stages: adhoc.stages,
    preAllocatedVUs: 2,
    maxVUs: 4,
    gracefulStop: `${GRACE_S}s`,
  };
  const oneShot = (fn, start, name) => {
    scenarios[name] = {
      executor: 'per-vu-iterations',
      exec: fn,
      vus: 1,
      iterations: 1,
      startTime: `${Math.round(start)}s`,
      maxDuration: `${Math.max(60, Math.round(RUN_SECONDS - start + GRACE_S))}s`,
    };
  };
  scheduledStarts(staff.admin.batch_hours, DAY_SECONDS, WINDOW_START_S, RUN_SECONDS).forEach(
    (start, index) => oneShot('adminBatch', start, `admin_batch_${index}`),
  );
  scheduledStarts(staff.admin.cleanup_hours, DAY_SECONDS, WINDOW_START_S, RUN_SECONDS).forEach(
    (start, index) => oneShot('adminCleanup', start, `admin_cleanup_${index}`),
  );
  return {
    scenarios,
    expected: { instructors: instructorRate.expected, admin_adhoc: adhoc.expected },
  };
}

const staffPlan = staffScenarios();
const scenarios = { students: studentScenario(), ...staffPlan.scenarios };
const thresholds = { dropped_iterations: ['count==0'], http_req_failed: ['rate<0.005'] };
for (const name of Object.keys(scenarios)) {
  thresholds[`iterations{scenario:${name}}`] = ['count>=0'];
  thresholds[`http_reqs{scenario:${name}}`] = ['count>=0'];
}

export const options = {
  scenarios,
  thresholds,
  tags: { run_id: config.runId },
  setupTimeout: '300s',
  summaryTrendStats: ['avg', 'med', 'p(95)', 'max'],
};

const J = 'setup';

function configureAi(admin) {
  const provider = api('POST', '/api/v1/ai/providers', {
    journey: J,
    token: admin.token,
    expected: [201],
    body: {
      name: `LLM stub ${config.runId}`,
      provider_type: 'CUSTOM',
      base_url: config.llmProviderUrl,
      api_key: `sk-k6-${config.runId}`,
    },
  }).data;
  const model = api('POST', '/api/v1/ai/models', {
    journey: J,
    token: admin.token,
    expected: [201],
    body: {
      provider_id: provider.id,
      model_name: `llm-stub-${config.runId}`,
      display_name: 'LLM stub',
    },
  }).data;
  for (const task of ['document-extraction', 'lesson-synthesis', 'quiz-authoring']) {
    api('PUT', `/api/v1/ai/service-bindings/${task}`, {
      journey: J,
      name: 'PUT /api/v1/ai/service-bindings/:task',
      token: admin.token,
      expected: [200, 201],
      body: { model_id: model.id },
    });
  }
  const health = api('POST', `/api/v1/ai/providers/${provider.id}/health-check`, {
    journey: J,
    name: 'POST /api/v1/ai/providers/:provider_id/health-check',
    token: admin.token,
  }).data;
  if (health.health_status !== 'ONLINE') fail(`Provider ${config.llmProviderUrl} không ONLINE`);
  return provider.id;
}

function setupUpload(token, content, fileName, mimeType) {
  const intent = api('POST', '/api/v1/media/upload-intents', {
    journey: J,
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
    },
  }).data;
  const multipart = buildMultipart(
    intent.upload.fields,
    { name: fileName, type: mimeType, content },
    `----k6-setup-${Date.now()}`,
  );
  rawPost(intent.upload.url, multipart.body, multipart.contentType, {
    journey: J,
    name: 'POST minio presigned upload',
  });
  api('POST', `/api/v1/media/${intent.media_id}/upload-complete`, {
    journey: J,
    name: 'POST /api/v1/media/:media_id/upload-complete',
    token,
  });
  return intent.media_id;
}

/**
 * Kho media của run (mục 12.2): một giảng viên seed tạo khóa "kho media", upload ảnh và tệp TXT, gắn
 * usage cho mọi tệp (để job dọn không coi là "không dùng"), chờ thumbnail. Học viên chỉ đọc media này.
 */
function mediaPool() {
  const instructor = login(J, 'instructor', seedInstructorEmail(1), config.seedPassword);
  const course = api('POST', '/api/v1/courses', {
    journey: J,
    token: instructor.token,
    expected: [201],
    body: { name: `Kho media ${config.runId}`, description_markdown: 'Kho media của run' },
  }).data;
  const lesson = api('POST', `/api/v1/courses/${course.id}/lessons`, {
    journey: J,
    name: 'POST /api/v1/courses/:course_id/lessons',
    token: instructor.token,
    expected: [201],
    body: { title: 'Tài liệu', content_markdown: 'Kho media' },
  }).data;
  const ids = [];
  const count = Number(__ENV.MEDIA_POOL_SIZE || 12);
  for (let index = 0; index < count; index += 1) {
    const text = index % 4 === 3;
    const id = text
      ? setupUpload(
          instructor.token,
          utf8(`Tài liệu kho ${index}`),
          `kho-${index}.txt`,
          'text/plain',
        )
      : setupUpload(instructor.token, PNG_1X1, `kho-${index}.png`, 'image/png');
    api('POST', '/api/v1/media/usages', {
      journey: J,
      token: instructor.token,
      expected: [201],
      body: {
        media_id: id,
        owner_kind: 'COURSE',
        owner_id: lesson.id,
        usage_type: 'LESSON_ATTACHMENT',
      },
    });
    ids.push({ id, text });
  }
  waitFor(J, 'thumbnail kho media READY', () => {
    const library = api('GET', '/api/v1/media/library?page_size=50', {
      journey: J,
      name: 'GET /api/v1/media/library',
      token: instructor.token,
    }).data;
    const pending = ids.filter(
      (item) =>
        !item.text &&
        !library.some((entry) => entry.id === item.id && entry.thumbnail_status === 'READY'),
    );
    return pending.length === 0 ? true : null;
  });
  return ids.filter((item) => !item.text).map((item) => item.id);
}

export function setup() {
  const setupStartedAt = new Date().toISOString();
  const admin = login(J, 'admin', config.admin.email, config.admin.password);
  const providerId = configureAi(admin);
  const cleanupJobId = api('POST', '/api/v1/scheduler/jobs', {
    journey: J,
    token: admin.token,
    expected: [201],
    body: {
      name: `Dọn media ${config.runId}`,
      type: 'MEDIA_UNUSED_CLEANUP',
      schedule_type: 'MANUAL',
      payload: { retention_hours: staff.admin.cleanup_retention_hours },
    },
  }).data.id;
  const mediaIds = mediaPool();
  return {
    setupStartedAt,
    startedAt: new Date().toISOString(),
    courseMap: courseMapSetup(),
    mediaIds,
    providerId,
    cleanupJobId,
  };
}

export const students = runStudentIteration;

export function instructors(setupData) {
  const index = exec.scenario.iterationInTest;
  const plan = instructorPlan({
    seed: WORKLOAD_SEED,
    index,
    staff,
    reaction: reactionParams,
    phase: PHASE,
    rng: createRng(hash32(WORKLOAD_SEED, 'instructors-plan', index)),
  });
  playInstructorSession({
    plan,
    staff,
    reaction: reactionParams,
    rng: createRng(hash32(WORKLOAD_SEED, 'instructors-behavior', index)),
    sessionKey: `instructors-${index}`,
    deadlineMs: deadline(),
    setupData,
  });
}

function adminCommon(kind, goal) {
  const index = exec.scenario.iterationInTest;
  const key = `${exec.scenario.name}-${index}`;
  const plan = adminPlan({
    staff,
    reaction: reactionParams,
    phase: PHASE,
    goal,
    rng: createRng(hash32(WORKLOAD_SEED, `${kind}-plan`, key)),
  });
  return {
    plan,
    staff,
    reaction: reactionParams,
    rng: createRng(hash32(WORKLOAD_SEED, `${kind}-behavior`, key)),
    sessionKey: key,
    deadlineMs: deadline(),
  };
}

export function adminAdhoc() {
  playAdminAdhoc(adminCommon('admin-adhoc'));
}

export function adminBatch() {
  playAdminBatch(adminCommon('admin-batch', 'A3'));
}

export function adminCleanup(setupData) {
  playAdminCleanup({ ...adminCommon('admin-cleanup', 'A4'), jobId: setupData.cleanupJobId });
}

function metricValue(data, name, field) {
  const metric = data.metrics[name];
  return metric ? (metric.values[field] ?? null) : null;
}

export function handleSummary(data) {
  const finishedAt = new Date().toISOString();
  const byScenario = {};
  for (const name of Object.keys(scenarios)) {
    byScenario[name] = {
      iterations: metricValue(data, `iterations{scenario:${name}}`, 'count') ?? 0,
      http_reqs: metricValue(data, `http_reqs{scenario:${name}}`, 'count') ?? 0,
    };
  }
  const profile = meta.profile ?? __ENV.PROFILE;
  const manifest = {
    run_id: config.runId,
    workload_level: '2+ (học viên) / 2 (giảng viên, admin, job lịch)',
    scenario: 'profile',
    workload_profile: `${profile}@${PROFILE_VERSION}`,
    workload_seed: WORKLOAD_SEED,
    workload_parameters: {
      plan_id: meta.plan_id,
      plan_path: PLAN_PATH,
      plan_sha256: meta.plan_sha256,
      plan_source: meta.source,
      plan_days: meta.days,
      stacking_k: meta.k,
      compression: meta.compression,
      think_cap_s: meta.think_cap_s,
      staff_params_sha256: crypto.sha256(STAFF_TEXT, 'hex'),
      reaction_params_sha256: crypto.sha256(REACTION_TEXT, 'hex'),
      rng: 'mulberry32 + FNV-1a (lib/rng.js)',
      k6_image: 'grafana/k6:1.3.0',
      window_start_s: WINDOW_START_S,
      run_seconds: RUN_SECONDS,
      arrival_peak_students_per_minute: arrival.peakPerMinute,
      expected_staff_sessions: staffPlan.expected,
      media_pool_size: data.setup_data?.mediaIds?.length ?? 0,
    },
    phase: PHASE,
    setup_started_at: data.setup_data?.setupStartedAt ?? null,
    workload_start: data.setup_data?.startedAt ?? null,
    workload_end: finishedAt,
    sessions_planned: { students: sessions.length },
    scenarios: byScenario,
    http_reqs: metricValue(data, 'http_reqs', 'count'),
    http_req_failed_rate: metricValue(data, 'http_req_failed', 'rate'),
    http_req_duration_p95_ms: metricValue(data, 'http_req_duration', 'p(95)'),
    ...studentSummary(
      metricValue(data, 'dropped_iterations', 'count') ?? 0,
      metricValue(data, 'vus_max', 'max'),
    ),
  };
  // k6-summary.json giữ tên trường mà export/ground-truth đang đọc (started_at, finished_at, plan_id).
  const summary = {
    ...manifest,
    plan_id: meta.plan_id,
    started_at: manifest.workload_start,
    finished_at: finishedAt,
    course_map: data.setup_data?.courseMap ?? null,
  };
  const dir = `${config.resultsDir}/${config.runId}`;
  return {
    stdout: `${JSON.stringify({ run_id: config.runId, scenarios: byScenario, dropped: manifest.dropped_iterations, failed: manifest.http_req_failed_rate, p95: manifest.http_req_duration_p95_ms })}\n`,
    [`${dir}/k6-summary.json`]: JSON.stringify(summary, null, 2),
    [`${dir}/workload-manifest.json`]: JSON.stringify(manifest, null, 2),
  };
}
