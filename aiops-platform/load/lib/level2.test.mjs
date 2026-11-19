import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { classifyLogLine } from '../tools/split-workload-log.mjs';
import {
  accountAssignment,
  peakConcurrency,
  vuSizing,
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
  const result = accountAssignment(7, keys, 1000);
  assert.equal(result.users, 600);
  assert.equal(result.people, 600);
  assert.equal(result.overlapping, 0);
  // Không có khoảng bận: mọi phiên của một người dùng chung một tài khoản.
  keys.forEach((key, i) => assert.equal(result.bySession[i], result.bySession[keys.indexOf(key)]));
  assert.equal(new Set(result.bySession).size, 600);
  assert.ok(result.bySession.every((value) => value >= 1 && value <= 1000));
  assert.deepEqual(accountAssignment(7, keys, 1000), result);
  assert.notDeepEqual(accountAssignment(8, keys, 1000).bySession, result.bySession);
  // Vượt số tài khoản, không có khoảng bận: vòng lại, vẫn trong miền.
  const many = accountAssignment(
    1,
    Array.from({ length: 12 }, (_, i) => `x${i}`),
    10,
  );
  assert.equal(new Set(many.bySession).size, 10);
});

/** Hai phiên có chồng nhau (tính cả khoảng đệm) không? */
const clash = ([a0, a1], [b0, b1], gapS) => a0 < b1 + gapS && b0 < a1 + gapS;

test('phiên chồng nhau của cùng người dùng nhận tài khoản khác', () => {
  // u1: [0,100) và [130,200) cách 30 s < gap 60 → hai tài khoản; [300,400) giữ tài khoản phiên trước.
  const keys = ['u1', 'u1', 'u1', 'u2'];
  const spans = [[0, 100], [130, 200], [300, 400], [0, 50]];
  const result = accountAssignment(3, keys, 10, { spans, gapS: 60 });
  assert.equal(result.users, 2);
  assert.equal(result.people, 3);
  assert.notEqual(result.bySession[0], result.bySession[1]);
  assert.equal(result.bySession[2], result.bySession[1]);
  assert.equal(new Set(result.bySession).size, 3);
});

test('dùng lại tài khoản chỉ khi tài khoản đã rảnh; đủ tài khoản thì không trùng', () => {
  // 3 tài khoản: x0–x2 bận [0, 100); x3 bận [50, 150) chồng tất cả → buộc trùng (overlapping 1);
  // x4 [400, 500) và x5 [1000, 1100) dùng lại được.
  const keys = ['x0', 'x1', 'x2', 'x3', 'x4', 'x5'];
  const spans = [[0, 100], [0, 100], [0, 100], [50, 150], [400, 500], [1000, 1100]];
  const { bySession, overlapping } = accountAssignment(5, keys, 3, { spans, gapS: 60 });
  assert.equal(overlapping, 1);
  for (const i of [4, 5]) {
    for (let j = 0; j < keys.length; j += 1) {
      if (j !== i && bySession[j] === bySession[i]) assert.ok(!clash(spans[i], spans[j], 60));
    }
  }
  // Ngẫu nhiên 400 phiên, 50 người dùng: tham lam theo giờ bắt đầu dùng đúng số tài khoản bằng đỉnh
  // đồng thời (tính cả gap) mà không phiên nào trùng.
  const rng = createRng(9);
  const many = Array.from({ length: 400 }, () => {
    const start = Math.floor(rng.next() * 5000);
    return [start, start + 20 + Math.floor(rng.next() * 400)];
  });
  const users = many.map((_, i) => `u${i % 50}`);
  const events = many.flatMap(([a, b]) => [[a, 1], [b + 60, -1]]).sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  let current = 0;
  let peak = 0;
  for (const [, delta] of events) peak = Math.max(peak, (current += delta));
  const fit = accountAssignment(2, users, peak, { spans: many, gapS: 60 });
  assert.equal(fit.overlapping, 0);
  for (let i = 0; i < many.length; i += 1) {
    for (let j = i + 1; j < many.length; j += 1) {
      if (fit.bySession[i] === fit.bySession[j]) assert.ok(!clash(many[i], many[j], 60));
    }
  }
});

test('think "tự bấm lại" theo loại điều hướng, kẹp [1; 300] s', () => {
  const rng = createRng(3);
  const values = Array.from({ length: 2000 }, () => navigationThink(rng, params.retap_think));
  assert.ok(values.every((value) => value >= 1 && value <= 300));
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted[1000];
  assert.ok(median > 5 && median < 10, `trung vị ${median}`); // lý thuyết e^1,966 ≈ 7,1 s
});

test('đỉnh phiên đồng thời của kế hoạch và số VU suy ra', () => {
  const session = (start, thinks) => ({
    start_s: start,
    actions: [{ think_s: 0 }, ...thinks.map((think) => ({ think_s: think }))],
  });
  // overhead 0: phiên A [0, 30), B [10, 15), C [20, 50), D [30, 30) — đỉnh 2 (A với B, rồi A với C).
  const plan = [session(0, [10, 20]), session(10, [5]), session(20, [30]), session(30, [])];
  assert.equal(peakConcurrency(plan, { actionOverheadS: 0, preludeActions: 0 }), 2);
  // Kết thúc trước khi phiên khác bắt đầu cùng thời điểm thì không tính chồng.
  assert.equal(peakConcurrency([session(0, [5]), session(5, [5])], { actionOverheadS: 0 }), 1);
  // Overhead 2 s/thao tác (kể cả 2 bước chèn đầu phiên) làm B kéo dài tới 10 + 2·4 + 5 = 23 > 20.
  assert.equal(peakConcurrency(plan), 3);
  assert.deepEqual(vuSizing(176), { preAllocated: 213, max: 266 });
  assert.deepEqual(vuSizing(0), { preAllocated: 10, max: 60 });
});

test('ánh xạ khóa Moodle → bốn khóa seed nhỏ nhất, bỏ khóa do run trước tạo', () => {
  const seed = (n) => `5eed0010-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const ids = ['ffff0000-x', seed(3), '0000aaaa-y', seed(1), seed(5), seed(2), seed(4)];
  assert.deepEqual(seedCourseMap(ids), { A: seed(1), B: seed(2), C: seed(3), D: seed(4) });
  assert.throws(() => seedCourseMap([seed(1), seed(2), seed(3), 'abc']), /có 3/);
});
