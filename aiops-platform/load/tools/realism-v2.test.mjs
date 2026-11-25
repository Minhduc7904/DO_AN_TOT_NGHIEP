import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createRng } from '../lib/rng.js';
import { compare, describe, sessionsFromActionLog, sessionsFromSessionFile } from './realism.mjs';
import {
  CRITERIA_V2,
  compareV2,
  midRank,
  referenceDistribution,
  referenceGroups,
  referencePool,
} from './realism-v2.mjs';
import { sessionsPerDay } from './session-stats.mjs';

test('mid-rank: giá trị trùng tính một nửa; bỏ chính nó khi xếp hạng nhóm tham chiếu', () => {
  const sorted = Float64Array.from([0, 0, 0, 1, 2]);
  assert.equal(midRank(sorted, 0), 0.3); // (0 + 0,5 × 3) / 5
  assert.equal(midRank(sorted, 1.5), 0.8);
  assert.equal(midRank(sorted, 5), 1);
  assert.equal(midRank(sorted, -1), 0);
  assert.equal(midRank(sorted, 0, { excludeSelf: true }), 0.25); // (0 + 0,5 × 2) / 4
});

test('pool: ngày thường trong [Q1, Q3], ngày đông từ Q3', () => {
  const perDay = [10, 20, 30, 40, 50, 60, 70, 80, 90].map((sessions, day) => ({ day, sessions }));
  // Q1 = 30, Q3 = 70 (nội suy tuyến tính trên 9 giá trị).
  assert.deepEqual(referencePool(perDay, 'normal-mixed').days, [2, 3, 4, 5, 6]);
  assert.deepEqual(referencePool(perDay, 'healthy-spike').days, [6, 7, 8]);
  assert.throws(() => referencePool(perDay, 'khác'));
});

test('độ phân giải 1 s: khoảng nghỉ tính trên mốc thời gian làm tròn xuống như log Moodle', () => {
  const base = Date.parse('2026-11-19T00:00:00Z');
  const rec = (index, state, endMs, durationMs) => ({
    role: 'student',
    method: 'GET',
    session_key: 's1',
    action_index: index,
    state,
    duration_ms: durationMs,
    ts: new Date(base + endMs).toISOString(),
  });
  const records = [rec(3, 'OPEN_COURSE', 10_900, 100), rec(4, 'READ_LESSON', 25_300, 200)];
  const exact = sessionsFromActionLog(records, base);
  const snapped = sessionsFromActionLog(records, base, { timeResolutionMs: 1000 });
  // Chính xác: bắt đầu 25,1 s − kết thúc 10,9 s = 14,2 s. Theo giây: 25 − 10 = 15.
  assert.ok(Math.abs(exact[0].actions[1].think_s - 14.2) < 1e-9);
  assert.equal(snapped[0].actions[1].think_s, 15);
  assert.equal(snapped[0].duration_s, 15);
});

/** Log giả: mỗi ngày 40–80 phiên, số thao tác và think time cùng một phân phối cho mọi ngày. */
function fakeLog(days, seed, { thinkScale = 1 } = {}) {
  const rng = createRng(seed);
  const sessions = [];
  for (let day = 0; day < days; day += 1) {
    const count = 40 + Math.floor(rng.next() * 40);
    for (let i = 0; i < count; i += 1) {
      const length = 1 + Math.floor(rng.next() * 5);
      const actions = Array.from({ length }, (_, index) => ({
        state: rng.pick(['OPEN_COURSE', 'READ_LESSON', 'LIST_QUIZ']),
        think_s: index === 0 ? 0 : Math.round((5 + rng.next() * 60) * thinkScale),
      }));
      sessions.push({
        session_id: `d${day}-${i}`,
        user_key: `u${i}`,
        course_key: 'A',
        day_index: day,
        start_offset_s: Math.floor(rng.next() * 86400),
        actions,
      });
    }
  }
  return sessions;
}

function holdoutReference(sessions) {
  return describe(
    sessionsFromSessionFile(sessions, (s) => s.start_offset_s / 30),
    2880,
  );
}

test('v2: nguồn rút từ cùng phân phối với dữ liệu thật đạt; nguồn có think time gấp đôi thì trượt', () => {
  const build = fakeLog(24, 1);
  const holdout = fakeLog(12, 2);
  const reference = holdoutReference(holdout);
  const options = { profile: 'normal-mixed', k: 4, runSeconds: 2880, thinkCapS: 300, draws: 80 };
  const { groups } = referenceGroups(build, sessionsPerDay(build), reference, options);
  assert.equal(groups.length, 80);
  assert.ok(groups.every((group) => group.days.length === 4 && new Set(group.days).size === 4));

  const same = describe(sessionsFromSessionFile(fakeLog(4, 3), (s) => s.start_offset_s / 30), 2880);
  const distribution = referenceDistribution(groups, reference, same.sessions, { runSeconds: 2880 });
  assert.ok(distribution.tau > 0 && distribution.tau <= 1);
  const pass = compareV2(compare(same, reference).rows, distribution, groups);
  assert.equal(pass.criteria, CRITERIA_V2.version);
  assert.equal(pass.passed, true, `điểm ${pass.score} > tau ${pass.tau}`);

  const slow = describe(
    sessionsFromSessionFile(fakeLog(4, 3, { thinkScale: 2 }), (s) => s.start_offset_s / 30),
    2880,
  );
  const slowDistribution = referenceDistribution(groups, reference, slow.sessions, { runSeconds: 2880 });
  const fail = compareV2(compare(slow, reference).rows, slowDistribution, groups);
  assert.equal(fail.passed, false);
  assert.equal(fail.ranks.think_ks_d, 1);
});

test('v2 tái lập: cùng seed cho cùng nhóm ngày và cùng tau', () => {
  const build = fakeLog(20, 5);
  const reference = holdoutReference(fakeLog(8, 6));
  const options = { profile: 'normal-mixed', k: 3, runSeconds: 2880, thinkCapS: 300, draws: 30 };
  const a = referenceGroups(build, sessionsPerDay(build), reference, options);
  const b = referenceGroups(build, sessionsPerDay(build), reference, options);
  assert.deepEqual(
    a.groups.map((group) => group.days),
    b.groups.map((group) => group.days),
  );
  const ta = referenceDistribution(a.groups, reference, 150, { runSeconds: 2880 }).tau;
  const tb = referenceDistribution(b.groups, reference, 150, { runSeconds: 2880 }).tau;
  assert.equal(ta, tb);
});
