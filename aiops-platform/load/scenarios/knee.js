import { SharedArray } from 'k6/data';
import exec from 'k6/execution';

import { config } from '../lib/config.js';
import { kneeAccounts, kneeSession, kneeSteps, stepName } from '../lib/knee.js';
import { sessionSpan, vuSizing } from '../lib/reaction.js';
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
 * mỗi KNEE_STEP_S giây tới KNEE_MAX_RATE (mặc định 0,2 → 6 phiên/s, 30 bậc, 90 phút). Mỗi bậc là một scenario `constant-arrival-rate` riêng (`step_01`, `step_02`, …) để tóm
 * tắt có số iteration và `dropped_iterations` theo từng bậc. Phiên lấy lần lượt từ kế hoạch phát lại
 * (PLAN, mặc định kế hoạch `normal-mixed`), dùng vòng khi hết; tài khoản gán theo lịch của bậc.
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
const accounts = new SharedArray('knee-accounts', () => [
  kneeAccounts(WORKLOAD_SEED, sessions, steps, config.seedStudents, { preludeActions }),
])[0];

/** VU dựng sẵn của một bậc theo số phiên đồng thời ước tính của riêng bậc đó. */
function stepPeak(step) {
  const events = [];
  for (let k = 0; k < step.planned; k += 1) {
    const { session } = kneeSession(sessions, step.offset + k);
    const start = step.start_s + k / step.rate_per_s;
    const [, end] = sessionSpan({ ...session, start_s: start }, { preludeActions });
    events.push([start, 1], [end, -1]);
  }
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let current = 0;
  let peak = 0;
  for (const [, delta] of events) {
    current += delta;
    peak = Math.max(peak, current);
  }
  return peak;
}

const scenarios = {};
const thresholds = {};
for (const step of steps) {
  const name = stepName(step.index);
  const sizing = vuSizing(stepPeak(step));
  scenarios[name] = {
    executor: 'constant-arrival-rate',
    exec: 'knee',
    rate: step.rate_per_min,
    timeUnit: '1m',
    duration: `${STEP_S}s`,
    startTime: `${step.start_s}s`,
    preAllocatedVUs: sizing.preAllocated,
    maxVUs: sizing.max,
    gracefulStop: `${TOTAL_S - step.start_s - STEP_S + TAIL_S}s`,
  };
  thresholds[`iterations{scenario:${name}}`] = ['count>=0'];
  thresholds[`dropped_iterations{scenario:${name}}`] = ['count>=0'];
  thresholds[`http_reqs{scenario:${name}}`] = ['count>=0'];
}
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

export function knee(setupData) {
  const step = steps[Number(exec.scenario.name.slice('step_'.length)) - 1];
  const k = exec.scenario.iterationInTest;
  if (k >= step.planned) return;
  const index = step.offset + k;
  const { session } = kneeSession(sessions, index);
  playPlanSession(setupData, {
    session,
    index,
    accountIndex: accounts.bySession[index],
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
    steps: steps.map((step) => {
      const name = stepName(step.index);
      return {
        ...step,
        scenario: name,
        iterations: metricValue(data, `iterations{scenario:${name}}`, 'count') ?? 0,
        dropped_iterations: metricValue(data, `dropped_iterations{scenario:${name}}`, 'count') ?? 0,
        http_reqs: metricValue(data, `http_reqs{scenario:${name}}`, 'count') ?? 0,
        accounts_overlapping: accounts.overlapByStep[step.index] ?? 0,
      };
    }),
    planned_peak_concurrency: accounts.peak,
    accounts_overlapping: accounts.overlapping,
    workload_start: data.setup_data?.startedAt ?? null,
    workload_end: finishedAt,
    started_at: data.setup_data?.startedAt ?? null,
    finished_at: finishedAt,
    course_map: data.setup_data?.courseMap ?? null,
    vus_max: metricValue(data, 'vus_max', 'max'),
    dropped_iterations: metricValue(data, 'dropped_iterations', 'count') ?? 0,
    http_reqs: metricValue(data, 'http_reqs', 'count'),
    http_req_failed_rate: metricValue(data, 'http_req_failed', 'rate'),
    http_req_duration_p95_ms: metricValue(data, 'http_req_duration', 'p(95)'),
  };
  return {
    stdout: `${JSON.stringify({ run_id: config.runId, steps: summary.steps.map((s) => [s.rate_per_s, s.iterations, s.dropped_iterations]) })}\n`,
    [`${config.resultsDir}/${config.runId}/k6-summary.json`]: JSON.stringify(summary, null, 2),
  };
}
