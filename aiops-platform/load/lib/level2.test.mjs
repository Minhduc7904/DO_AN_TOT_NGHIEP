import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { classifyLogLine } from '../tools/split-workload-log.mjs';
import {
  accountAssignment,
  navigationThink,
  backoffMs,
  buildArrivalStages,
  classifyResponse,
  createSessionCounters,
  drawPatience,
  seedAccountIndex,
  seedCourseMap,
  studentSessionPlan,
  windowSessions,
} from './reaction.js';
import { createRng } from './rng.js';

const params = JSON.parse(
  readFileSync(new URL('../params/reaction-v1.json', import.meta.url), 'utf8'),
);

test('classifyResponse theo bảng phản ứng mục 6.2', () => {
  const base = { expected: [200, 409], patienceMs: 1000 };
  assert.equal(classifyResponse({ ...base, status: 200, durationMs: 500 }), 'ok');
  assert.equal(classifyResponse({ ...base, status: 409, durationMs: 1500 }), 'slow');
  assert.equal(classifyResponse({ ...base, status: 200, durationMs: 2500 }), 'too_slow');
  for (const status of [0, 429, 502, 503, 504]) {
    assert.equal(classifyResponse({ ...base, status, durationMs: 10 }), 'retryable');
  }
  assert.equal(classifyResponse({ ...base, status: 401, durationMs: 10 }), 'auth');
  assert.equal(classifyResponse({ ...base, status: 500, durationMs: 10 }), 'server_error');
  assert.equal(classifyResponse({ ...base, status: 404, durationMs: 10 }), 'not_found');
  assert.equal(classifyResponse({ ...base, status: 400, durationMs: 10 }), 'unexpected_status');
});

test('backoff Full Jitter nằm trong [0, min(cap, base·2^k)]', () => {
  const rng = createRng(1);
  for (let index = 0; index < 500; index += 1) {
    const first = backoffMs(rng, 1, params.retry);
    const second = backoffMs(rng, 2, params.retry);
    const fifth = backoffMs(rng, 5, params.retry);
    assert.ok(first >= 0 && first <= 2000);
    assert.ok(second >= 0 && second <= 4000);
    assert.ok(fifth <= 8000);
  }
});

test('kiên nhẫn kẹp [2; 15] s và slow_limit theo profile/pha', () => {
  const rng = createRng(3);
  for (let index = 0; index < 500; index += 1) {
    const value = drawPatience(rng, params, 'P3', 'normal');
    assert.ok(value.patience_s >= 2 && value.patience_s <= 15);
    assert.equal(value.slow_limit, 2);
  }
  assert.equal(drawPatience(rng, params, 'P2', 'deadline').slow_limit, 4);
  assert.throws(() => drawPatience(rng, params, 'P9', 'normal'), /Không có kiên nhẫn/u);
});

test('bộ đếm phiên: bỏ ngang khi đủ số lần chậm hoặc lỗi', () => {
  const tracker = createSessionCounters({ slowLimit: 2, errorLimit: 3 });
  assert.equal(tracker.onSlow(), null);
  assert.equal(tracker.onSlow(), 'impatient');
  assert.equal(tracker.onError(), null);
  assert.equal(tracker.onError(), null);
  assert.equal(tracker.onError(), 'too_many_errors');
  tracker.onRetry();
  assert.deepEqual(tracker.counters, { slow_count: 2, error_count: 3, retries_used: 1 });
});

test('kế hoạch phiên học viên tái lập theo seed; tài khoản cố định theo người dùng', () => {
  const session = {
    session_id: 'u1#0@d3',
    user_key: 'u1@d3',
    actions: [
      { state: 'OPEN_COURSE', think_s: 0 },
      { state: 'READ_LESSON', think_s: 12 },
    ],
  };
  const make = (seed) =>
    studentSessionPlan({
      session,
      phase: 'normal',
      params,
      rng: createRng(seed * 7 + 1),
      seed,
      accounts: 1000,
    });
  assert.deepEqual(make(11), make(11));
  assert.notEqual(make(11).plan_hash, make(12).plan_hash);
  const account = seedAccountIndex(11, 'u1@d3', 1000);
  assert.equal(make(11).account_index, account);
  assert.ok(account >= 1 && account <= 1000);
  // Phiên có sẵn profile (nguồn giả định) giữ nguyên profile đó.
  assert.equal(
    studentSessionPlan({
      session: { ...session, profile: 'P3' },
      phase: 'normal',
      params,
      rng: createRng(1),
      seed: 1,
      accounts: 10,
    }).profile,
    'P3',
  );
});

test('lịch arrival-rate: số iteration mỗi ô 30 s bằng số phiên bắt đầu trong ô', () => {
  const starts = [0, 5, 29.9, 30, 95, 3000];
  const arrival = buildArrivalStages(starts, 120);
  assert.equal(arrival.total, 5); // 3000 s nằm ngoài run 120 s
  assert.equal(arrival.startRate, 6); // 3 phiên / 30 s = 6 phiên/phút
  assert.deepEqual(arrival.stages, [
    { target: 6, duration: '30s' },
    { target: 2, duration: '0s' },
    { target: 2, duration: '30s' },
    { target: 0, duration: '0s' },
    { target: 0, duration: '30s' },
    { target: 2, duration: '0s' },
    { target: 2, duration: '30s' },
  ]);
  // Số iteration = tích phân tốc độ theo thời gian.
  const iterations = arrival.stages
    .filter((stage) => stage.duration === '30s')
    .reduce((sum, stage) => sum + stage.target / 2, 0);
  assert.equal(iterations, arrival.total);
  assert.throws(() => buildArrivalStages([], 60, 7), /chia hết 60/u);
});

test('windowSessions cắt và dời mốc thời gian', () => {
  const sessions = [{ start_s: 10 }, { start_s: 100 }, { start_s: 250 }];
  assert.deepEqual(windowSessions(sessions, 100, 150), [{ start_s: 0 }]);
  assert.deepEqual(windowSessions(sessions, 0, 300).length, 3);
});

test('tách log k6: bản ghi workload, dòng khác, dòng hỏng', () => {
  const action = JSON.stringify({ kind: 'action', state: 'LOGIN', status: 200 });
  assert.deepEqual(classifyLogLine(JSON.stringify({ level: 'info', msg: action })), {
    kind: 'action',
    record: { state: 'LOGIN', status: 200 },
  });
  assert.equal(
    classifyLogLine(JSON.stringify({ level: 'warning', msg: 'Request Failed' })).kind,
    'other',
  );
  assert.equal(classifyLogLine('không phải JSON').kind, 'other');
  assert.equal(classifyLogLine('   '), null);
});

test('gán tài khoản bằng hoán vị có seed: không trùng khi số người ≤ số tài khoản', () => {
  const keys = Array.from({ length: 900 }, (_, i) => `u${i % 600}@d3`); // 600 người, có lặp
  const map = accountAssignment(7, keys, 1000);
  const values = Object.values(map);
  assert.equal(values.length, 600);
  assert.equal(new Set(values).size, 600);
  assert.ok(values.every((value) => value >= 1 && value <= 1000));
  assert.deepEqual(accountAssignment(7, keys, 1000), map);
  assert.notDeepEqual(accountAssignment(8, keys, 1000), map);
  // Vượt số tài khoản thì vòng lại, vẫn trong miền.
  const many = accountAssignment(
    1,
    Array.from({ length: 12 }, (_, i) => `x${i}`),
    10,
  );
  assert.equal(new Set(Object.values(many)).size, 10);
});

test('think "tự bấm lại" theo loại điều hướng, kẹp [1; 300] s', () => {
  const rng = createRng(3);
  const values = Array.from({ length: 2000 }, () => navigationThink(rng, params.retap_think));
  assert.ok(values.every((value) => value >= 1 && value <= 300));
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted[1000];
  assert.ok(median > 5 && median < 10, `trung vị ${median}`); // lý thuyết e^1,966 ≈ 7,1 s
});

test('ánh xạ khóa Moodle → bốn khóa seed nhỏ nhất, bỏ khóa do run trước tạo', () => {
  const seed = (n) => `5eed0010-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const ids = ['ffff0000-x', seed(3), '0000aaaa-y', seed(1), seed(5), seed(2), seed(4)];
  assert.deepEqual(seedCourseMap(ids), { A: seed(1), B: seed(2), C: seed(3), D: seed(4) });
  assert.throws(() => seedCourseMap([seed(1), seed(2), seed(3), 'abc']), /có 3/);
});
