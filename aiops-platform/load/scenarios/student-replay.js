import { SharedArray } from 'k6/data';
import exec from 'k6/execution';

import { api, login } from '../lib/api.js';
import { config, seedStudentEmail } from '../lib/config.js';
import { buildArrivalStages, studentSessionPlan, windowSessions } from '../lib/reaction.js';
import { createRng, hash32 } from '../lib/rng.js';
import { playStudentSession } from '../model/student-replay.js';

/**
 * Scenario học viên mức 2+ (hoặc "mức 2 thuần" khi kế hoạch có nguồn `assumed`): phát lại từng phiên
 * của một kế hoạch `replay-plan.v1` (tạo bằng `tools/build-replay-plan.mjs`).
 *
 * - Mỗi iteration là một phiên; iteration thứ i phát phiên thứ i của kế hoạch (đã sắp theo giờ bắt
 *   đầu), nên kế hoạch phiên chỉ phụ thuộc `WORKLOAD_SEED` (workload-design-v1 mục 10.3, 11.1).
 * - Lịch bắt đầu phiên: executor `ramping-arrival-rate` (mô hình mở), tốc độ không đổi trong mỗi ô
 *   30 s và bằng đúng số phiên bắt đầu trong ô (giờ thật của log ở độ phân giải 30 s = 15 phút của
 *   ngày thật sau nén ×30).
 * - Think time lấy từ phiên, không nén; phiên chưa xong khi hết run kết thúc với `run_end`.
 *
 * Biến môi trường: PLAN (đường dẫn trong `aiops-platform/load/`), WORKLOAD_SEED, WINDOW_START_S và
 * WINDOW_S (chạy thử một đoạn của ngày nén), STUDENT_PRE_VUS, STUDENT_MAX_VUS.
 */

const PLAN_PATH = __ENV.PLAN || 'data/plans/moodle-normal-mixed-k4-v1.json';
const WINDOW_START_S = Number(__ENV.WINDOW_START_S || 0);
const WORKLOAD_SEED = Number(__ENV.WORKLOAD_SEED || config.seed);
const GRACE_S = 60;

const meta = new SharedArray('plan-meta', () => {
  const plan = JSON.parse(open(`../${PLAN_PATH}`));
  delete plan.sessions;
  return [plan];
})[0];
const RUN_SECONDS = __ENV.WINDOW_S ? Number(__ENV.WINDOW_S) : meta.run_seconds - WINDOW_START_S;
const sessions = new SharedArray('plan-sessions', () =>
  windowSessions(JSON.parse(open(`../${PLAN_PATH}`)).sessions, WINDOW_START_S, RUN_SECONDS),
);
const params = JSON.parse(open('../params/reaction-v1.json'));
const PHASE = meta.phase ?? (meta.profile === 'healthy-spike' ? 'deadline' : 'normal');

function startTimes() {
  const starts = [];
  for (let index = 0; index < sessions.length; index += 1) starts.push(sessions[index].start_s);
  return starts;
}

const arrival = buildArrivalStages(startTimes(), RUN_SECONDS);

export const options = {
  scenarios: {
    students: {
      executor: 'ramping-arrival-rate',
      exec: 'students',
      startRate: arrival.startRate,
      timeUnit: arrival.timeUnit,
      stages: arrival.stages,
      preAllocatedVUs: Number(__ENV.STUDENT_PRE_VUS || 120),
      maxVUs: Number(__ENV.STUDENT_MAX_VUS || 300),
      gracefulStop: `${GRACE_S}s`,
    },
  },
  tags: { run_id: config.runId },
  setupTimeout: '120s',
  summaryTrendStats: ['avg', 'med', 'p(95)', 'max'],
};

/** Ánh xạ khóa Moodle A–D → bốn khóa học seed đầu tiên của danh mục (sắp theo id, cố định). */
export function setup() {
  const startedAt = new Date().toISOString();
  const probe = login('setup', 'student', seedStudentEmail(1), config.seedPassword);
  const catalogue = api('GET', '/api/v1/courses?page=1&page_size=20', {
    journey: 'setup',
    name: 'GET /api/v1/courses',
    token: probe.token,
  }).data;
  const ids = catalogue.map((course) => course.id).sort();
  if (ids.length < 4) throw new Error(`Cần ít nhất 4 khóa học đã xuất bản, có ${ids.length}`);
  const courseMap = Object.fromEntries(['A', 'B', 'C', 'D'].map((key, index) => [key, ids[index]]));
  return { startedAt, courseMap, mediaIds: [] };
}

export function students(setupData) {
  const index = exec.scenario.iterationInTest;
  if (index >= sessions.length) return;
  const session = sessions[index];
  const plan = studentSessionPlan({
    session,
    phase: PHASE,
    params,
    rng: createRng(hash32(WORKLOAD_SEED, 'students-plan', index)),
    seed: WORKLOAD_SEED,
    accounts: config.seedStudents,
  });
  playStudentSession({
    session,
    prelude: session.prelude ?? meta.prelude,
    plan,
    params,
    setupData,
    rng: createRng(hash32(WORKLOAD_SEED, 'students-behavior', index)),
    sessionKey: `students-${index}`,
    deadlineMs: exec.scenario.startTime + (RUN_SECONDS + GRACE_S - 5) * 1000,
  });
}

function metricValue(data, name, field) {
  const metric = data.metrics[name];
  return metric ? (metric.values[field] ?? null) : null;
}

export function handleSummary(data) {
  const summary = {
    run_id: config.runId,
    workload_level: '2+',
    scenario: 'student-replay',
    plan_id: meta.plan_id,
    plan_path: PLAN_PATH,
    plan_source: meta.source,
    plan_profile: meta.profile,
    phase: PHASE,
    workload_seed: WORKLOAD_SEED,
    window_start_s: WINDOW_START_S,
    run_seconds: RUN_SECONDS,
    sessions_planned: sessions.length,
    arrival_total: arrival.total,
    arrival_peak_per_minute: arrival.peakPerMinute,
    started_at: data.setup_data?.startedAt ?? null,
    finished_at: new Date().toISOString(),
    course_map: data.setup_data?.courseMap ?? null,
    iterations: metricValue(data, 'iterations', 'count'),
    dropped_iterations: metricValue(data, 'dropped_iterations', 'count') ?? 0,
    http_reqs: metricValue(data, 'http_reqs', 'count'),
    http_req_failed_rate: metricValue(data, 'http_req_failed', 'rate'),
    http_req_duration_p95_ms: metricValue(data, 'http_req_duration', 'p(95)'),
    vus_max: metricValue(data, 'vus_max', 'max'),
  };
  return {
    stdout: `${JSON.stringify(summary)}\n`,
    [`${config.resultsDir}/${config.runId}/k6-summary.json`]: JSON.stringify(summary, null, 2),
  };
}
