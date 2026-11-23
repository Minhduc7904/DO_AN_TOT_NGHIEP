import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { createRng, hash32 } from '../lib/rng.js';
import {
  quantileSorted,
  quantileTable,
  sampleQuantileTable,
  transitionMatrix,
} from './lib/stats.mjs';
import {
  evenStartOffsets,
  generateAssumedSessions,
  generateLearnedSessions,
  walkAssumedSession,
} from './markov.mjs';
import {
  buildSessions,
  coverage,
  parseMoodleCsv,
  splitBuildHoldout,
  toActions,
} from './moodle/sessionize.mjs';
import { assignDaySplits, buildPlan, DAY_SPLIT, selectDays } from './replay-plan.mjs';
import { hourlyStarts, sessionsPerDay } from './session-stats.mjs';

const params = JSON.parse(
  readFileSync(new URL('../params/student-assumed-v1.json', import.meta.url), 'utf8'),
);
const DAY = 86400;

/** Dựng CSV từ `[user, action, course, t]`. */
const csv = (rows) =>
  ['userId,moodleAction,course,dateTime', ...rows.map((row) => row.join(','))].join('\n');
const events = (list) =>
  list.map(([action, t], row) => ({ user: 'u', action, course: 'A', t, row }));

test('parseMoodleCsv từ chối header lạ và dòng hỏng', () => {
  assert.throws(() => parseMoodleCsv('a,b,c,d\nx,y,z,1'), /Header CSV lạ/u);
  assert.throws(() => parseMoodleCsv(csv([['u1', 'course_viewed', 'A', 'abc']])), /không hợp lệ/u);
  assert.equal(parseMoodleCsv(`${csv([['u1', 'course_viewed', 'A', 5]])}\n`).length, 1);
});

test('toActions: ánh xạ, sự kiện phụ, trùng lặp, bỏ sự kiện ngoài bảng', () => {
  const counts = new Map();
  const actions = toActions(
    events([
      ['course_viewed', 100],
      ['course_viewed', 101], // trùng trong ≤ 1 s
      ['role_assigned', 101], // sự kiện phụ
      ['access_prevented', 105], // bỏ
      ['course_module_viewed', 120],
      ['course_module_completion_updated', 121], // tự sinh ≤ 2 s sau khi xem bài
      ['course_module_viewed', 200], // trang quiz vì kế tiếp là attempt_started
      ['attempt_started', 210],
      ['attempt_updated', 300],
      ['user_graded', 400],
      ['attempt_submitted', 401], // cùng lần nộp
      ['course_module_viewed', 402], // trang kết quả ngay sau khi nộp
    ]),
    counts,
  );
  assert.deepEqual(
    actions.map((action) => action.state),
    ['OPEN_COURSE', 'READ_LESSON', 'LIST_QUIZ', 'START_QUIZ', 'ANSWER', 'SUBMIT'],
  );
  assert.equal(actions[0].t1, 101);
  assert.equal(actions[5].t1, 402);
  const summary = coverage(counts, 12);
  assert.deepEqual(summary.by_kind, { map: 6, aux: 4, dup: 1, drop: 1 });
  assert.deepEqual(summary.dropped_events, { access_prevented: 1 });
});

test('buildSessions cắt phiên khi nghỉ > 30 phút; think time và ngày tính đúng', () => {
  const rows = parseMoodleCsv(
    csv([
      ['u1', 'course_viewed', 'A', 10 * DAY + 3600],
      ['u1', 'course_module_viewed', 'A', 10 * DAY + 3615],
      ['u1', 'course_viewed', 'A', 10 * DAY + 3615 + 1801], // nghỉ 1.801 s → phiên mới
      ['u2', 'access_prevented', 'B', 11 * DAY], // phiên không còn thao tác
      ['u3', 'course_viewed', 'C', 12 * DAY + 60],
    ]),
  );
  const result = buildSessions(rows);
  assert.equal(result.rawSessions, 4);
  assert.equal(result.emptySessions, 1);
  assert.equal(result.firstDay, 10);
  const [first, second, third] = result.sessions;
  assert.deepEqual(first.actions, [
    { state: 'OPEN_COURSE', think_s: 0 },
    { state: 'READ_LESSON', think_s: 15 },
  ]);
  assert.equal(first.day_index, 0);
  assert.equal(first.start_offset_s, 3600);
  assert.equal(first.duration_s, 15);
  assert.equal(second.session_id, 'u1#1');
  assert.equal(third.course_key, 'C');
  assert.equal(third.day_index, 2);
  const { build, holdout } = splitBuildHoldout(result.sessions, 2);
  assert.deepEqual([build.length, holdout.length, holdout[0].user_key], [2, 1, 'u3']);
  assert.deepEqual(
    sessionsPerDay(result.sessions).map((day) => day.sessions),
    [2, 0, 1],
  );
  assert.equal(hourlyStarts(result.sessions)[1], 2);
});

test('thống kê: phân vị nội suy, lấy mẫu từ bảng phân vị, ma trận chuyển có START/EXIT', () => {
  assert.equal(quantileSorted([1, 2, 3, 4], 0.5), 2.5);
  const table = quantileTable([0, 10], 3);
  assert.deepEqual(table, [0, 5, 10]);
  assert.equal(sampleQuantileTable(table, 0.25), 2.5);
  const matrix = transitionMatrix([
    { actions: [{ state: 'A' }, { state: 'B' }] },
    { actions: [{ state: 'A' }] },
  ]);
  assert.deepEqual(matrix.START, { A: 1, _n: 2 });
  assert.deepEqual(matrix.A, { B: 0.5, EXIT: 0.5, _n: 2 });
});

test('rng: normal có trung bình ~0, weighted theo tỉ lệ, hash32 ổn định', () => {
  const rng = createRng(7);
  let sum = 0;
  const hits = { a: 0, b: 0 };
  for (let index = 0; index < 20000; index += 1) {
    sum += rng.normal();
    hits[rng.weighted({ a: 0.25, b: 0.75, c: 0 })] += 1;
  }
  assert.ok(Math.abs(sum / 20000) < 0.03);
  assert.ok(Math.abs(hits.a / 20000 - 0.25) < 0.02);
  assert.equal(hash32('a', 1), hash32('a', 1));
  assert.notEqual(hash32('a', 1), hash32('a', 2));
  assert.throws(() => rng.weighted({ x: 0 }), RangeError);
});

test('evenStartOffsets: đủ số lượng, chia theo trọng số, cách đều trong giờ', () => {
  const weights = Array.from({ length: 24 }, (_, hour) => (hour === 10 ? 3 : hour === 11 ? 1 : 0));
  const offsets = evenStartOffsets(8, weights);
  assert.equal(offsets.length, 8);
  assert.equal(offsets.filter((value) => Math.floor(value / 3600) === 10).length, 6);
  assert.equal(offsets[0], 10 * 3600 + 300);
});

test('máy trạng thái giả định: tái lập theo seed, tôn trọng giới hạn và bảng chuyển', () => {
  const first = generateAssumedSessions(params, { count: 300, seed: 5, phase: 'normal' });
  const again = generateAssumedSessions(params, { count: 300, seed: 5, phase: 'normal' });
  const other = generateAssumedSessions(params, { count: 300, seed: 6, phase: 'normal' });
  assert.deepEqual(first, again);
  assert.notDeepEqual(first, other);
  for (const session of first) {
    assert.ok(session.actions.length <= session.max_actions);
    assert.ok(session.duration_s <= session.time_available_s + 1);
    const table = params.goal_tables[session.goal];
    let state = 'LOGIN';
    for (const action of session.actions) {
      assert.ok(table[state][action.state] > 0, `${session.goal}: ${state} → ${action.state}`);
      state = action.state;
    }
  }
  const walk = walkAssumedSession(params, 'deadline', createRng(1));
  assert.ok(['P1', 'P2', 'P3'].includes(walk.profile));
});

test('Markov học từ log: chỉ đi theo cạnh có trong ma trận, think time lấy từ bảng', () => {
  const model = {
    transitions: { START: { A: 1, _n: 1 }, A: { B: 0.5, EXIT: 0.5, _n: 2 }, B: { EXIT: 1, _n: 1 } },
    think_quantiles_by_state: { B: [10, 10, 10] },
  };
  const sessions = generateLearnedSessions(model, {
    count: 50,
    seed: 3,
    startOffsets: Array(50).fill(0),
  });
  for (const session of sessions) {
    assert.equal(session.actions[0].state, 'A');
    assert.equal(session.actions[0].think_s, 0);
    if (session.actions[1]) assert.deepEqual(session.actions[1], { state: 'B', think_s: 10 });
    assert.ok(session.actions.length <= 2);
  }
});

test('selectDays và buildPlan: chọn ngày theo profile, nén lịch, kẹp think, đổi id theo ngày', () => {
  const perDay = [5, 9, 7, 20, 6].map((sessions, day) => ({ day, sessions }));
  assert.deepEqual(selectDays(perDay, 'normal-mixed', 2).days, [2, 4]);
  assert.deepEqual(selectDays(perDay, 'healthy-spike', 2).days, [3, 1]);
  assert.throws(() => selectDays(perDay, 'normal-mixed', 9), /k phải/u);
  const sessions = [
    {
      session_id: 's1',
      user_key: 'u1',
      course_key: 'A',
      day_index: 2,
      start_offset_s: 43200,
      actions: [
        { state: 'X', think_s: 0 },
        { state: 'Y', think_s: 900 },
      ],
    },
    {
      session_id: 's2',
      user_key: 'u1',
      course_key: 'A',
      day_index: 4,
      start_offset_s: 3000,
      actions: [{ state: 'X', think_s: 0 }],
    },
    {
      session_id: 's3',
      user_key: 'u2',
      course_key: 'B',
      day_index: 1,
      start_offset_s: 0,
      actions: [{ state: 'X', think_s: 0 }],
    },
  ];
  const { plan, clipped } = buildPlan(sessions, {
    planId: 'p',
    source: 'test',
    profile: 'normal-mixed',
    days: [2, 4],
    k: 2,
    prelude: ['LOGIN'],
  });
  assert.equal(clipped, 1);
  assert.equal(plan.compression, 30);
  assert.deepEqual(
    plan.sessions.map((s) => [s.user_key, s.start_s]),
    [
      ['u1@d4', 100],
      ['u1@d2', 1440],
    ],
  );
  assert.equal(plan.sessions[1].actions[1].think_s, 300);
  assert.equal(plan.summary.sessions, 2);
});

test('assignDaySplits: phân tầng rắn bò theo tải, mỗi ngày đúng một split, tái lập', () => {
  // Số phiên theo ngày 0..8; xếp giảm dần: ngày 1, 3, 5, 7, 8, 6, 4, 2, 0.
  const counts = [10, 90, 20, 80, 30, 70, 40, 60, 50];
  const perDay = counts.map((sessions, day) => ({ day, sessions }));
  const splits = assignDaySplits(perDay);
  // Lượt 1 (ngày 1, 3, 5) → test, validation, train; lượt 2 đảo chiều (ngày 7, 8, 6) → train,
  // validation, test; lượt 3 (ngày 4, 2, 0) → test, validation, train.
  assert.deepEqual(splits, { test: [1, 4, 6], validation: [2, 3, 8], train: [0, 5, 7] });
  assert.equal(DAY_SPLIT.rule, 'day-split-v1');
  const all = Object.values(splits).flat().sort((a, b) => a - b);
  assert.deepEqual(all, perDay.map((item) => item.day));
  assert.deepEqual(assignDaySplits([...perDay].reverse()), splits);
  // Bằng phiên: ngày nhỏ trước.
  const tie = assignDaySplits([0, 1, 2].map((day) => ({ day, sessions: 5 })));
  assert.deepEqual(tie, { test: [0], validation: [1], train: [2] });
  assert.throws(() => assignDaySplits(perDay, ['a', 'a']), /khác nhau/u);
});
