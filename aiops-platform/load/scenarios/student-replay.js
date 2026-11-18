import { config } from '../lib/config.js';
import {
  arrival,
  courseMapSetup,
  meta,
  PHASE,
  PLAN_PATH,
  RUN_SECONDS,
  runStudentIteration,
  sessions,
  studentScenario,
  WINDOW_START_S,
  WORKLOAD_SEED,
} from '../model/student-scenario.js';

/**
 * Scenario chỉ có học viên mức 2+ (hoặc "mức 2 thuần" khi kế hoạch có nguồn `assumed`): phát lại từng
 * phiên của một kế hoạch `replay-plan.v1` (tạo bằng `tools/build-replay-plan.mjs`). Dùng cho kiểm
 * chứng độ thực (task-04 tuần 14); run thí nghiệm dùng `scenarios/profile.js`.
 *
 * - Mỗi iteration là một phiên; iteration thứ i phát phiên thứ i của kế hoạch (đã sắp theo giờ bắt
 *   đầu), nên kế hoạch phiên chỉ phụ thuộc `WORKLOAD_SEED` (workload-design-v1 mục 10.3, 11.1).
 * - Lịch bắt đầu phiên: executor `ramping-arrival-rate` (mô hình mở), tốc độ không đổi trong mỗi ô
 *   30 s và bằng đúng số phiên bắt đầu trong ô (giờ thật của log ở độ phân giải 30 s = 15 phút của
 *   ngày thật sau nén ×30).
 * - Think time lấy từ phiên, không nén; phiên chưa xong khi hết run kết thúc với `run_end`.
 */

export const options = {
  scenarios: { students: studentScenario() },
  tags: { run_id: config.runId },
  setupTimeout: '120s',
  summaryTrendStats: ['avg', 'med', 'p(95)', 'max'],
};

export function setup() {
  return { startedAt: new Date().toISOString(), courseMap: courseMapSetup(), mediaIds: [] };
}

export const students = runStudentIteration;

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
