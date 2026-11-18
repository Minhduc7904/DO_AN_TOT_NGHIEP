import { SharedArray } from 'k6/data';
import exec from 'k6/execution';

import { catalogueIds, login } from '../lib/api.js';
import { config, seedStudentEmail } from '../lib/config.js';
import {
  accountAssignment,
  buildArrivalStages,
  seedCourseMap,
  studentSessionPlan,
  windowSessions,
} from '../lib/reaction.js';
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

/** Tài khoản seed của từng người dùng trong kế hoạch: hoán vị có seed, không trùng (mục 13.4). */
function userKeys() {
  const keys = [];
  for (let index = 0; index < sessions.length; index += 1) keys.push(sessions[index].user_key);
  return keys;
}
const accounts = accountAssignment(WORKLOAD_SEED, userKeys(), config.seedStudents);
const distinctUsers = Object.keys(accounts).length;

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

/** Ánh xạ khóa Moodle A–D → bốn khóa học seed (`seedCourseMap`), đọc toàn bộ danh mục. */
export function setup() {
  const startedAt = new Date().toISOString();
  const probe = login('setup', 'student', seedStudentEmail(1), config.seedPassword);
  const courseMap = seedCourseMap(catalogueIds(probe.token));
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
    accountIndex: accounts[session.user_key],
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
    // Iteration bị bỏ làm lệch ánh xạ iteration → phiên: run như vậy không tái lập được, không dùng
    // làm dữ liệu thí nghiệm (README mục mức 2+).
    plan_reproducible: (metricValue(data, 'dropped_iterations', 'count') ?? 0) === 0,
    distinct_users: distinctUsers,
    accounts_reused: Math.max(0, distinctUsers - config.seedStudents),
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
