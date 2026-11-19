import assert from 'node:assert/strict';
import { test } from 'node:test';

import { classifyCause, droppedByStep, evaluateHealth, evaluateSteps, resourceStats, trafficStats } from './health.mjs';
import { parseSize, parseStatsLine } from './sample-docker-stats.mjs';

const T0 = Date.parse('2026-11-19T10:00:00Z');
const at = (s) => new Date(T0 + s * 1000).toISOString();
const action = (s, outcome = 'ok', extra = {}) => ({ ts: at(s), method: 'GET', endpoint: 'GET /x', status: 200, outcome, ...extra });
const session = (s, end_reason = 'exit') => ({ start: at(s), end_reason });
const sample = (s, name, cpu, extra = {}) => ({ ts: at(s), name, cpu_perc: cpu, cpu_limit: 0, mem_perc: 10, ...extra });

test('traffic: chỉ tính trong cửa sổ, bỏ WAIT, đếm phản hồi ngoài mong đợi và phiên bỏ ngang', () => {
  const actions = [
    action(1),
    action(2, 'retried', { status: 503 }),
    action(3, 'unexpected_status', { status: 409 }),
    action(4, 'background_wait_timeout', { method: 'WAIT' }),
    action(70, 'failed'), // ngoài cửa sổ
  ];
  const sessions = [session(0), session(10, 'impatient'), session(20, 'run_end'), session(65, 'auth_failed')];
  const stats = trafficStats({ actions, sessions, from: T0, to: T0 + 60_000 });
  assert.equal(stats.requests, 3);
  assert.equal(stats.unexpected, 2);
  assert.equal(stats.unexpected_status, 1);
  assert.equal(stats.sessions_started, 3);
  assert.equal(stats.abandoned, 1);
  assert.equal(stats.unexpected_top[0][1], 1);
});

test('tài nguyên: CPU quy theo giới hạn, chuỗi vượt ngưỡng dài nhất, RAM trống thấp nhất của máy', () => {
  const samples = [
    // 0,5 core: 45% của một core = 90% giới hạn; 4 mẫu liên tiếp = 60 s.
    ...[0, 15, 30, 45].map((s) => sample(s, 'aiops-lms-tempo-1', 45, { cpu_limit: 0.5 })),
    sample(60, 'aiops-lms-tempo-1', 10, { cpu_limit: 0.5 }),
    sample(0, 'aiops-lms-course-1', 120, { mem_perc: 86 }),
    { ts: at(0), name: 'HOST', mem_available_mb: 5000, cpu_perc: 40 },
    { ts: at(15), name: 'HOST', mem_available_mb: 3000, cpu_perc: 70 },
  ];
  const stats = resourceStats(samples, T0, T0 + 120_000);
  assert.equal(stats.containers['aiops-lms-tempo-1'].cpu_max_perc_of_limit, 90);
  assert.equal(stats.containers['aiops-lms-tempo-1'].cpu_over_limit_longest_s, 60);
  assert.equal(stats.containers['aiops-lms-course-1'].mem_max_perc, 86);
  assert.equal(stats.host_min_available_mb, 3000);
  assert.equal(stats.host_cpu_max_perc, 70);
});

function healthyInput(overrides = {}) {
  return {
    p95: [
      [T0 / 1000 + 60, 0.05],
      [T0 / 1000 + 120, 0.06],
    ],
    actions: Array.from({ length: 400 }, (_, i) => action(i % 120)),
    sessions: Array.from({ length: 200 }, (_, i) => session(i % 120)),
    samples: [sample(0, 'aiops-lms-gateway-1', 20)],
    from: T0,
    to: T0 + 120_000,
    phase: 'normal',
    dropped: 0,
    ...overrides,
  };
}

test('chấm một khoảng: khỏe; p95 1,2 s trượt ở normal nhưng đạt ở deadline; CPU k6 không tính cho hệ thống', () => {
  const ok = evaluateHealth(healthyInput());
  assert.equal(ok.pass, true, ok.failed.join());
  const slow = { p95: [[T0 / 1000 + 60, 1.2]] };
  assert.deepEqual(evaluateHealth(healthyInput(slow)).failed, ['gateway_p95']);
  assert.equal(evaluateHealth(healthyInput({ ...slow, phase: 'deadline' })).pass, true);
  const k6Busy = [0, 15, 30, 45, 60, 75].map((s) => sample(s, 'brave_wing', 300, { image: 'grafana/k6:1.3.0' }));
  const withK6 = evaluateHealth(healthyInput({ samples: k6Busy }));
  assert.equal(withK6.criteria.cpu_sustained.pass, true);
  assert.deepEqual(classifyCause(withK6).reasons, ['k6_cpu brave_wing']);
  const failures = Array.from({ length: 3 }, (_, i) => action(i, 'failed'));
  const errors = evaluateHealth(healthyInput({ actions: [...healthyInput().actions, ...failures] }));
  assert.deepEqual(errors.failed, ['unexpected_rate']); // 3/403 ≈ 0,74% ≥ 0,5%
  assert.deepEqual(evaluateHealth(healthyInput({ restarts: ['aiops-lms-tempo-1'] })).failed, ['memory']);
});

test('chấm từng bậc: λ_knee là bậc khỏe cuối trước bậc đầu tiên hỏng; phân biệt nguyên nhân máy/hệ thống', () => {
  const summary = {
    workload_start: at(0),
    phase: 'normal',
    steps: [1, 2, 3].map((index) => ({
      index,
      rate_per_s: Number((0.2 * index).toFixed(1)),
      start_s: (index - 1) * 180,
      duration_s: 180,
      dropped_iterations: 0,
    })),
  };
  const p95 = [];
  for (let t = 60; t <= 540; t += 60) p95.push([T0 / 1000 + t, t > 420 ? 1.5 : 0.1]);
  const actions = Array.from({ length: 540 }, (_, i) => action(i));
  const sessions = Array.from({ length: 270 }, (_, i) => session(i * 2));
  const result = evaluateSteps({ summary, p95, actions, sessions, samples: [] });
  assert.equal(result.lambda_knee_per_s, 0.4);
  assert.equal(result.first_unhealthy.step, 3);
  assert.deepEqual(result.first_unhealthy.failed, ['gateway_p95']);
  assert.equal(result.first_unhealthy.cause.side, 'system');

  const dropped = structuredClone(summary);
  dropped.steps[1].dropped_iterations = 4;
  const client = evaluateSteps({ summary: dropped, p95, actions, sessions, samples: [] });
  assert.equal(client.lambda_knee_per_s, 0.2);
  assert.equal(client.first_unhealthy.cause.side, 'client');

  const allHealthy = evaluateSteps({ summary, p95: p95.map(([t]) => [t, 0.1]), actions, sessions, samples: [] });
  assert.equal(allHealthy.reached_max_rate, true);
  assert.equal(allHealthy.lambda_knee_per_s, 0.6);
});

test('iteration bị bỏ theo bậc: suy từ số phiên bắt đầu trong bậc, bỏ lệch biên; tổng k6 bằng 0 thì 0', () => {
  const steps = [1, 2].map((index) => ({ index, start_s: (index - 1) * 60, duration_s: 60, planned: 30 }));
  const knee = (s, i) => ({ session_key: `knee-${i}`, start: at(s) });
  // Bậc 1: đủ 30 phiên trừ 1 (lệch biên); bậc 2: chỉ 20 phiên bắt đầu. Phiên của scenario khác không tính.
  const sessions = [
    ...Array.from({ length: 29 }, (_, i) => knee(i * 2, i)),
    ...Array.from({ length: 20 }, (_, i) => knee(60 + i * 3, 29 + i)),
    { session_key: 'students-1', start: at(70) },
  ];
  const summary = { workload_start: at(0), steps, dropped_iterations: 10 };
  assert.deepEqual(droppedByStep(summary, sessions), { 1: 0, 2: 10 });
  assert.deepEqual(droppedByStep({ ...summary, dropped_iterations: 0 }, sessions), { 1: 0, 2: 0 });
});

test('chấm từng bậc: bậc chưa chạy hết thì không chấm; không bậc nào hỏng nhưng thiếu bậc thì chưa tới bậc tối đa', () => {
  const summary = {
    workload_start: at(0),
    workload_end: at(400), // dừng giữa bậc 3
    phase: 'normal',
    dropped_iterations: 0,
    steps: [1, 2, 3].map((index) => ({ index, rate_per_s: 0.2 * index, start_s: (index - 1) * 180, duration_s: 180, planned: 36 * index })),
  };
  const p95 = Array.from({ length: 9 }, (_, i) => [T0 / 1000 + 60 * (i + 1), 0.1]);
  const actions = Array.from({ length: 400 }, (_, i) => action(i));
  const sessions = Array.from({ length: 200 }, (_, i) => session(i * 2));
  const result = evaluateSteps({ summary, p95, actions, sessions, samples: [] });
  assert.equal(result.steps.length, 2);
  assert.equal(result.steps_not_run, 1);
  assert.equal(result.reached_max_rate, false);
  assert.equal(result.lambda_knee_per_s, 0.4);
});

test('đọc docker stats: đơn vị bộ nhớ và phần trăm', () => {
  assert.equal(parseSize('512MiB'), 512);
  assert.equal(parseSize('1.5GiB'), 1536);
  assert.equal(parseSize('abc'), null);
  const parsed = parseStatsLine(
    JSON.stringify({ Name: 'aiops-lms-tempo-1', CPUPerc: '12.50%', MemUsage: '256MiB / 1GiB', MemPerc: '25.00%' }),
    at(0),
  );
  assert.deepEqual(parsed, {
    ts: at(0),
    name: 'aiops-lms-tempo-1',
    cpu_perc: 12.5,
    mem_used_mib: 256,
    mem_limit_mib: 1024,
    mem_perc: 25,
  });
});
