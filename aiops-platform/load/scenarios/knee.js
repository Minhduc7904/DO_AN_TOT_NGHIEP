import { SharedArray } from 'k6/data';
import exec from 'k6/execution';

import { config } from '../lib/config.js';
import { kneeAccounts, kneeSession, kneeStages, kneeSteps } from '../lib/knee.js';
import { vuSizing } from '../lib/reaction.js';
import {
  courseMapSetup,
  meta,
  PHASE,
  PLAN_PATH,
  playPlanSession,
  sessions,
  WORKLOAD_SEED,
} from '../model/student-scenario.js';

/**
 * Tìm điểm gãy `λ_knee` (workload-design-v1 mục 8.4, task-02 tuần 15): chỉ học viên pha `normal`, tốc
 * độ bắt đầu phiên không đổi trong mỗi bậc, bắt đầu từ KNEE_START_RATE, tăng KNEE_RATE_STEP phiên/s sau
 * mỗi KNEE_STEP_S giây tới KNEE_MAX_RATE (mặc định 0,2 → 6 phiên/s, 30 bậc, 90 phút). Cả lịch là một
 * scenario `ramping-arrival-rate` (`kneeStages`) để mọi bậc dùng chung một bể VU; VU dựng sẵn theo đỉnh
 * phiên đồng thời của cả lịch (ghi đè bằng STUDENT_PRE_VUS, STUDENT_MAX_VUS). Iteration bị bỏ theo bậc
 * suy từ số phiên bắt đầu trong bậc (`tools/health-check.mjs --steps`). Phiên lấy lần lượt từ kế hoạch
 * phát lại (PLAN, mặc định kế hoạch `normal-mixed`), dùng vòng khi hết; tài khoản gán theo lịch của bậc.
 *
 *   KNEE_MAX_RATE=6 RUN_ID=w15-t02-knee-r1 WORKLOAD_SEED=21 aiops-platform/load/run-k6.sh knee --quiet
 *
 * Chấm tiêu chí "khỏe" theo từng bậc bằng `tools/health-check.mjs --steps`.
 */

const RATE_STEP = Number(__ENV.KNEE_RATE_STEP || 0.2);
const MAX_RATE = Number(__ENV.KNEE_MAX_RATE || 6);
const START_RATE = Number(__ENV.KNEE_START_RATE || RATE_STEP);
const STEP_S = Number(__ENV.KNEE_STEP_S || 180);
/** Phiên còn dở khi bậc cuối hết được chạy tiếp tối đa chừng này rồi kết thúc `run_end`. */
const TAIL_S = 120;

const steps = kneeSteps({ rateStep: RATE_STEP, maxRate: MAX_RATE, stepS: STEP_S, startRate: START_RATE });
const TOTAL_S = steps.length * STEP_S;
const preludeActions = (meta.prelude ?? []).length;
// Tính một lần; số liệu tóm tắt và tài khoản theo phiên tách hai `SharedArray` để VU không giữ bản sao
// của cả mảng tài khoản (k6 giải tuần tự hóa phần tử mỗi lần đọc).
let computedAccounts = null;
const computeAccounts = () =>
  (computedAccounts ??= kneeAccounts(WORKLOAD_SEED, sessions, steps, config.seedStudents, { preludeActions }));
const accounts = new SharedArray('knee-accounts-meta', () => {
  const { bySession: _bySession, ...rest } = computeAccounts();
  return [rest];
})[0];
const accountOf = new SharedArray('knee-accounts-of', () => computeAccounts().bySession);

const sizing = vuSizing(accounts.peak);
const PRE_VUS = Number(__ENV.STUDENT_PRE_VUS || sizing.preAllocated);
const MAX_VUS = Number(__ENV.STUDENT_MAX_VUS || sizing.max);
const scenarios = {
  knee: {
    executor: 'ramping-arrival-rate',
    exec: 'knee',
    ...kneeStages(steps),
    preAllocatedVUs: PRE_VUS,
    maxVUs: MAX_VUS,
    gracefulStop: `${TAIL_S}s`,
  },
};
const thresholds = {};
// Lưới an toàn cho máy: lỗi tích lũy quá 30% thì dừng hẳn (đã qua điểm gãy từ lâu).
thresholds.http_req_failed = [{ threshold: 'rate<0.3', abortOnFail: true, delayAbortEval: '3m' }];

export const options = {
  scenarios,
  thresholds,
  tags: { run_id: config.runId },
  setupTimeout: '120s',
  summaryTrendStats: ['avg', 'med', 'p(95)', 'max'],
};

export function setup() {
  const courseMap = courseMapSetup();
  const startedAt = new Date().toISOString();
  console.log(JSON.stringify({ kind: 'phase', phase: 'workload_start', ts: startedAt, run_id: config.runId }));
  return { startedAt, courseMap, mediaIds: [] };
}

const TOTAL_PLANNED = steps.reduce((sum, step) => sum + step.planned, 0);

export function knee(setupData) {
  const index = exec.scenario.iterationInTest;
  if (index >= TOTAL_PLANNED) return;
  const { session } = kneeSession(sessions, index);
  playPlanSession(setupData, {
    session,
    index,
    accountIndex: accountOf[index],
    deadlineMs: Date.parse(setupData.startedAt) + (TOTAL_S + TAIL_S - 5) * 1000,
    stream: 'knee',
  });
}

function metricValue(data, name, field) {
  const metric = data.metrics[name];
  return metric ? (metric.values[field] ?? null) : null;
}

export function handleSummary(data) {
  const finishedAt = new Date().toISOString();
  const summary = {
    run_id: config.runId,
    workload_level: '2+',
    scenario: 'knee',
    plan_id: meta.plan_id,
    plan_path: PLAN_PATH,
    phase: PHASE,
    workload_seed: WORKLOAD_SEED,
    knee: { start_rate_per_s: START_RATE, rate_step_per_s: RATE_STEP, max_rate_per_s: MAX_RATE, step_s: STEP_S, tail_s: TAIL_S },
    seed_students: config.seedStudents,
    steps: steps.map((step) => ({ ...step, accounts_overlapping: accounts.overlapByStep[step.index] ?? 0 })),
    planned_peak_concurrency: accounts.peak,
    student_pre_vus: PRE_VUS,
    student_max_vus: MAX_VUS,
    accounts_overlapping: accounts.overlapping,
    accounts_within_gap: accounts.withinGap,
    workload_start: data.setup_data?.startedAt ?? null,
    workload_end: finishedAt,
    started_at: data.setup_data?.startedAt ?? null,
    finished_at: finishedAt,
    course_map: data.setup_data?.courseMap ?? null,
    vus_max: metricValue(data, 'vus_max', 'max'),
    iterations: metricValue(data, 'iterations', 'count') ?? 0,
    dropped_iterations: metricValue(data, 'dropped_iterations', 'count') ?? 0,
    http_reqs: metricValue(data, 'http_reqs', 'count'),
    http_req_failed_rate: metricValue(data, 'http_req_failed', 'rate'),
    http_req_duration_p95_ms: metricValue(data, 'http_req_duration', 'p(95)'),
  };
  return {
    stdout: `${JSON.stringify({ run_id: config.runId, iterations: metricValue(data, 'iterations', 'count'), dropped: summary.dropped_iterations, vus_max: summary.vus_max })}\n`,
    [`${config.resultsDir}/${config.runId}/k6-summary.json`]: JSON.stringify(summary, null, 2),
  };
}
