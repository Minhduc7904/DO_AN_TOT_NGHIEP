import assert from 'node:assert/strict';
import { test } from 'node:test';

import { kneeAccounts, kneeSession, kneeStart, kneeSteps, stepName } from './knee.js';

test('bậc tải: 0,2 phiên/s mỗi 3 phút tới 3 phiên/s là 15 bậc, số phiên và offset cộng dồn', () => {
  const steps = kneeSteps({ rateStep: 0.2, maxRate: 3, stepS: 180 });
  assert.equal(steps.length, 15);
  assert.deepEqual(
    steps.slice(0, 3).map((s) => [s.index, s.rate_per_min, s.start_s, s.planned, s.offset]),
    [
      [1, 12, 0, 36, 0],
      [2, 24, 180, 72, 36],
      [3, 36, 360, 108, 108],
    ],
  );
  assert.equal(steps.at(-1).rate_per_s, 3);
  assert.equal(steps.at(-1).offset, 36 * (14 * 15) / 2); // 36 × (1 + … + 14)
  assert.equal(stepName(7), 'step_07');
  assert.throws(() => kneeSteps({ stepS: 90 }));
  assert.throws(() => kneeSteps({ rateStep: 0 }));
});

test('phiên dùng vòng: chỉ số vượt kế hoạch quay lại đầu và tăng số vòng', () => {
  const plan = [{ user_key: 'a' }, { user_key: 'b' }, { user_key: 'c' }];
  assert.deepEqual(kneeSession(plan, 1), { session: plan[1], cycle: 0 });
  assert.deepEqual(kneeSession(plan, 7), { session: plan[1], cycle: 2 });
  const [step] = kneeSteps({ rateStep: 0.5, maxRate: 0.5, stepS: 60 });
  assert.equal(kneeStart(step, 3), 6);
});

test('gán tài khoản theo lịch bậc: đủ tài khoản thì không trùng; thiếu thì báo trùng; đỉnh đồng thời đúng', () => {
  // Mỗi phiên 1 thao tác, overhead 2 s × (1 + 2 bước chèn) = 6 s bận.
  const plan = Array.from({ length: 5 }, (_, i) => ({ user_key: `u${i}`, start_s: 0, actions: [{ think_s: 0 }] }));
  const steps = kneeSteps({ rateStep: 0.5, maxRate: 1, stepS: 60 }); // 30 phiên rồi 60 phiên
  const enough = kneeAccounts(1, plan, steps, 100);
  assert.equal(enough.bySession.length, 90);
  assert.equal(enough.overlapping, 0);
  // Bậc 2: 1 phiên/s, mỗi phiên bận 6 s → 6 phiên đồng thời (biên đóng–mở không cộng).
  assert.equal(enough.peak, 6);
  const scarce = kneeAccounts(1, plan, steps, 2);
  assert.ok(scarce.overlapping > 0);
});

test('đỉnh tốc độ bắt đầu phiên của kế hoạch theo ô 60 s và kiểm theo λ_knee', async () => {
  const { planPeakRate, checkProfileLoad } = await import('./knee.js');
  const plan = [0, 10, 59, 60, 61, 62, 63, 64, 125].map((start_s) => ({ start_s }));
  assert.equal(planPeakRate(plan), 5 / 60);
  assert.deepEqual(checkProfileLoad(0.5, 2, 0.35), { peak_per_s: 0.5, limit_per_s: 0.7, ratio_of_knee: 0.25, pass: true });
  assert.equal(checkProfileLoad(1.8, 2, 0.8).pass, false);
});

test('bậc bắt đầu từ startRate; đếm phiên dùng chung tài khoản theo bậc', async () => {
  const { kneeSteps: steps, kneeAccounts: assign } = await import('./knee.js');
  const s = steps({ rateStep: 0.2, maxRate: 1.4, stepS: 180, startRate: 1 });
  assert.deepEqual(s.map((x) => x.rate_per_min), [60, 72, 84]);
  const plan = Array.from({ length: 5 }, (_, i) => ({ user_key: `u${i}`, start_s: 0, actions: [{ think_s: 0 }] }));
  const few = assign(1, plan, steps({ rateStep: 0.5, maxRate: 1, stepS: 60 }), 2);
  const total = Object.values(few.overlapByStep).reduce((a, b) => a + b, 0);
  assert.ok(total > 0 && few.overlapByStep[2] > 0);
});

test('một scenario cho mọi bậc: stage 0 s để nhảy bậc, giữ tốc độ trong bậc; tìm bậc theo chỉ số phiên', async () => {
  const { kneeStages, kneeStepOf } = await import('./knee.js');
  const s = kneeSteps({ rateStep: 0.2, maxRate: 0.6, stepS: 180 });
  assert.deepEqual(kneeStages(s), {
    startRate: 12,
    timeUnit: '1m',
    stages: [
      { target: 12, duration: '180s' },
      { target: 24, duration: '0s' },
      { target: 24, duration: '180s' },
      { target: 36, duration: '0s' },
      { target: 36, duration: '180s' },
    ],
  });
  // Bậc 1: phiên 0–35, bậc 2: 36–107, bậc 3: 108–215.
  assert.deepEqual([0, 35, 36, 107, 108, 215].map((i) => kneeStepOf(s, i).index), [1, 1, 2, 2, 3, 3]);
  assert.equal(kneeStepOf(s, 216), null);
});
