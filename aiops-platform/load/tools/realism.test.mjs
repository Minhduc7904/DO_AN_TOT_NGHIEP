import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createRng } from '../lib/rng.js';
import {
  binCounts,
  dispersionIndex,
  hurstAggregatedVariance,
  jensenShannon,
  ksTwoSample,
  medianRelativeDiff,
  pearson,
  peakToMean,
} from './lib/compare.mjs';
import {
  compare,
  describe,
  sessionsFromActionLog,
  sessionsFromK6Points,
  sessionsFromSessionFile,
} from './realism.mjs';

test('KS: mẫu trùng D = 0, tách rời D = 1, ví dụ tay', () => {
  assert.equal(ksTwoSample([1, 2, 3], [1, 2, 3]), 0);
  assert.equal(ksTwoSample([1, 2], [5, 6]), 1);
  // F1 = {1,2,3,4}, F2 = {3,4,5,6}: tại x = 2 → |0,5 − 0| = 0,5.
  assert.equal(ksTwoSample([1, 2, 3, 4], [3, 4, 5, 6]), 0.5);
});

test('JSD: trùng = 0, rời nhau = 1, đối xứng', () => {
  assert.equal(jensenShannon({ a: 2, b: 2 }, { a: 5, b: 5 }), 0);
  assert.equal(jensenShannon({ a: 1 }, { b: 1 }), 1);
  const p = { a: 3, b: 1 };
  const q = { a: 1, b: 3 };
  assert.ok(Math.abs(jensenShannon(p, q) - jensenShannon(q, p)) < 1e-12);
});

test('Pearson, đỉnh/trung bình, dispersion, lệch trung vị', () => {
  assert.equal(pearson([1, 2, 3], [2, 4, 6]), 1);
  assert.equal(pearson([1, 2, 3], [3, 2, 1]), -1);
  assert.equal(peakToMean([1, 1, 4]), 2);
  assert.equal(dispersionIndex([2, 2, 2, 2]), 0);
  assert.equal(medianRelativeDiff([11, 11], [10, 10]), 0.1);
  assert.deepEqual(binCounts([0, 5, 29, 30, 99, -1], 60, 30), [3, 1]);
});

test('Hurst: chuỗi Poisson độc lập ≈ 0,5; chuỗi có xu hướng dài > 0,8', () => {
  const rng = createRng(4);
  const poisson = Array.from({ length: 4096 }, () => {
    // Poisson(10) bằng cách đếm mũ: đủ cho kiểm tra.
    let count = 0;
    let t = -Math.log(1 - rng.next());
    while (t < 1) {
      count += 1;
      t += -Math.log(1 - rng.next()) / 10;
    }
    return count;
  });
  const hp = hurstAggregatedVariance(poisson);
  assert.ok(Math.abs(hp - 0.5) < 0.1, `H Poisson ${hp}`);
  const trend = Array.from({ length: 4096 }, (_, i) => Math.sin(i / 600) * 10 + 20 + rng.next());
  assert.ok(hurstAggregatedVariance(trend) > 0.8);
  assert.equal(hurstAggregatedVariance([1, 2, 3]), null);
});

test('phiên từ nhật ký mức 2: bỏ bước chèn đầu phiên, gom theo action_index, think = khoảng nghỉ', () => {
  const base = Date.parse('2026-11-18T06:00:00Z');
  const rec = (key, index, state, endS, durationMs = 100) => ({
    role: 'student',
    method: 'GET',
    session_key: key,
    action_index: index,
    state,
    duration_ms: durationMs,
    ts: new Date(base + endS * 1000).toISOString(),
  });
  const sessions = sessionsFromActionLog(
    [
      rec('s1', 1, 'LOGIN', 1),
      rec('s1', 2, 'DASH', 2),
      rec('s1', 3, 'OPEN_COURSE', 10),
      rec('s1', 3, 'OPEN_COURSE', 10.2),
      rec('s1', 4, 'READ_LESSON', 30.1),
      rec('s2', 3, 'READ_LESSON', 40, 250),
      { ...rec('s9', 1, 'I_COURSES', 5), role: 'instructor' },
    ],
    base,
  );
  assert.equal(sessions.length, 2);
  // Thời lượng = tổng khoảng nghỉ (như log Moodle), không cộng thời gian xử lý của request.
  assert.ok(Math.abs(sessions[0].duration_s - 19.8) < 1e-9);
  assert.equal(sessions[1].duration_s, 0);
  assert.deepEqual(
    sessions[0].actions.map((action) => action.state),
    ['OPEN_COURSE', 'READ_LESSON'],
  );
  assert.ok(Math.abs(sessions[0].actions[1].think_s - 19.8) < 1e-9);
  assert.ok(Math.abs(sessions[0].start_s - 9.9) < 1e-9);
});

test('phiên từ điểm k6 mức 1: route → trạng thái, request liên tiếp cùng trạng thái gộp', () => {
  const base = Date.parse('2026-11-18T06:00:00Z');
  // Dạng thật của k6 `--out json`: `vu`, `iter` nằm trong `metadata`, không phải tag.
  const point = (name, endS, vu = '1', iter = '0', journey = 'w3') => ({
    type: 'Point',
    metric: 'http_req_duration',
    data: {
      time: new Date(base + endS * 1000).toISOString(),
      value: 50,
      tags: { name, journey },
      metadata: { vu, iter },
    },
  });
  const sessions = sessionsFromK6Points(
    [
      point('POST /api/v1/auth/student/login', 1),
      point('GET /api/v1/courses', 3),
      point('GET /api/v1/courses/:course_id/lessons', 6),
      point('GET /api/v1/student/courses/:course_id/progress', 6.3),
      point('GET /api/v1/courses', 3, '2', '0', 'w2'),
      point('GET /api/v1/courses', 4, '2', '0'),
      point('GET /api/v1/courses', 5, '1', '1'),
    ],
    base,
  );
  assert.equal(sessions.length, 3); // (vu 1, iter 0), (vu 2, iter 0), (vu 1, iter 1)
  assert.deepEqual(
    sessions[0].actions.map((action) => action.state),
    ['BROWSE', 'OPEN_COURSE'],
  );
  assert.deepEqual(
    sessions.slice(1).map((session) => session.actions.length),
    [1, 1],
  );
});

test('so sánh: nguồn giống hệt hold-out đạt mọi ngưỡng; nguồn lệch thì không', () => {
  const file = Array.from({ length: 200 }, (_, i) => ({
    start_offset_s: (i * 431) % 86400,
    actions: [
      { state: 'OPEN_COURSE', think_s: 0 },
      { state: 'READ_LESSON', think_s: 10 + (i % 7) },
    ],
  }));
  const reference = describe(
    sessionsFromSessionFile(file, (s) => s.start_offset_s / 30),
    2880,
  );
  assert.equal(compare(reference, reference).passed, true);
  const other = describe(
    sessionsFromSessionFile(
      file.map((s) => ({ ...s, actions: [{ state: 'BROWSE', think_s: 0 }, ...s.actions] })),
      (s) => s.start_offset_s / 30,
    ),
    2880,
  );
  const result = compare(other, reference);
  assert.equal(result.passed, false);
  assert.equal(result.checks.action_mix_jsd, 'không đạt');
});
