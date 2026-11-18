import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { createRng } from './rng.js';
import {
  adminPlan,
  drawThink,
  hourlyArrivalStages,
  instructorPlan,
  nextInstructorState,
  scheduledStarts,
  sessionsPerHour,
} from './staff-plan.js';

const read = (name) =>
  JSON.parse(readFileSync(new URL(`../params/${name}`, import.meta.url), 'utf8'));
const staff = read('staff-assumed-v1.json');
const reaction = read('reaction-v1.json');

test('bảng chuyển giảng viên: mỗi dòng cộng bằng 1, mọi đích có handler hoặc EXIT', () => {
  const known = new Set(Object.keys(staff.think.type_of_state));
  for (const [goal, table] of Object.entries(staff.instructor.goal_tables)) {
    for (const [from, row] of Object.entries(table)) {
      const sum = Object.values(row).reduce((acc, value) => acc + value, 0);
      assert.ok(Math.abs(sum - 1) < 1e-9, `${goal}/${from} cộng ${sum}`);
      for (const to of Object.keys(row))
        assert.ok(to === 'EXIT' || known.has(to), `${goal}: ${to}`);
    }
  }
});

test('đi theo bảng: chỉ dùng cạnh có xác suất > 0; I3 theo chuỗi cố định', () => {
  const rng = createRng(5);
  for (let run = 0; run < 300; run += 1) {
    const goal = ['I1', 'I2', 'I4'][run % 3];
    let state = 'I_LOGIN';
    for (let step = 0; step < 40; step += 1) {
      const next = nextInstructorState(staff, goal, state, rng, step);
      assert.ok(staff.instructor.goal_tables[goal][state][next] > 0);
      if (next === 'EXIT') break;
      state = next;
    }
  }
  const noAbort = { ...staff, instructor: { ...staff.instructor, i3_abort_per_step: 0 } };
  const seq = [];
  let state = 'I_LOGIN';
  for (let step = 0; step < staff.instructor.i3_sequence.length; step += 1) {
    state = nextInstructorState(noAbort, 'I3', state, rng, step);
    seq.push(state);
  }
  assert.deepEqual(seq, staff.instructor.i3_sequence);
  assert.ok(
    ['EXIT', 'I_AI_JOB', 'I_PUBLISH_QUIZ'].includes(
      nextInstructorState(noAbort, 'I3', 'I_AI_JOB', rng),
    ),
  );
  assert.equal(nextInstructorState(noAbort, 'I3', 'I_PUBLISH_QUIZ', rng), 'EXIT');
});

test('think time theo loại nằm trong [1; 300] s; loại lạ bị từ chối', () => {
  const rng = createRng(2);
  for (let index = 0; index < 500; index += 1) {
    const value = drawThink(rng, staff.think, 'I_EDIT_LESSON');
    assert.ok(value >= 1 && value <= 300);
  }
  assert.throws(() => drawThink(rng, staff.think, 'X'), /Không có loại/u);
});

test('kế hoạch giảng viên/admin tái lập và trong miền', () => {
  const make = (seed) =>
    instructorPlan({ seed, index: 3, staff, reaction, phase: 'normal', rng: createRng(seed) });
  assert.deepEqual(make(9), make(9));
  const plan = make(9);
  assert.ok(plan.account_index >= 1 && plan.account_index <= 10);
  assert.ok(['I1', 'I2', 'I3', 'I4'].includes(plan.goal));
  assert.equal(
    adminPlan({ staff, reaction, phase: 'normal', rng: createRng(1), goal: 'A3' }).goal,
    'A3',
  );
});

test('lịch theo giờ: tổng số phiên giảng viên ≈ 90; cửa sổ cắt đúng giờ', () => {
  const perHour = sessionsPerHour(90, staff.instructor.hourly_weight);
  const full = hourlyArrivalStages(perHour, 2880);
  assert.ok(Math.abs(full.expected - 90) < 2, `kỳ vọng ${full.expected}`);
  assert.equal(full.stages.filter((stage) => stage.duration !== '0s').length, 24);
  const part = hourlyArrivalStages(perHour, 2880, 900, 420);
  const seconds = part.stages.reduce((sum, stage) => sum + Number.parseInt(stage.duration, 10), 0);
  assert.equal(seconds, 420);
  assert.deepEqual(scheduledStarts([2, 8, 19], 2880), [240, 960, 2280]);
  assert.deepEqual(scheduledStarts([2, 8, 19], 2880, 900, 420), [60]);
});
