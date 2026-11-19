/**
 * Lịch tìm điểm gãy `λ_knee` (workload-design-v1 mục 8.4): chỉ học viên pha `normal`, tốc độ bắt đầu
 * phiên không đổi trong mỗi bậc, tăng `rateStep` phiên/s sau mỗi `stepS` giây. Không import module k6
 * nên test được bằng Node.
 *
 * Phiên lấy lần lượt từ kế hoạch phát lại (phiên thật của log Moodle). Bậc cao cần nhiều phiên hơn kế
 * hoạch có, nên phiên được dùng vòng; lần dùng thứ `cycle` đổi khóa người dùng thành `user#c<cycle>` để
 * việc gán tài khoản coi đó là người khác.
 */
import { accountAssignment, sessionSpan } from './reaction.js';

/**
 * Các bậc tải `{ index, rate_per_s, rate_per_min, start_s, duration_s, planned, offset }`: bậc 1 có tốc độ
 * `startRate` (mặc định bằng `rateStep`), mỗi bậc sau cộng `rateStep`, tới `maxRate`.
 */
export function kneeSteps({ rateStep = 0.2, maxRate = 6, stepS = 180, startRate = rateStep } = {}) {
  if (!(rateStep > 0) || !(startRate > 0) || !(maxRate >= startRate) || !(stepS >= 60) || stepS % 60 !== 0) {
    throw new RangeError('Cần rateStep > 0, 0 < startRate ≤ maxRate, stepS là bội của 60 và ≥ 60');
  }
  const steps = [];
  let offset = 0;
  for (let index = 1; startRate + (index - 1) * rateStep <= maxRate + 1e-9; index += 1) {
    // constant-arrival-rate cần số nguyên phiên mỗi timeUnit: dùng phút.
    const ratePerMin = Math.round((startRate + (index - 1) * rateStep) * 60);
    const planned = (ratePerMin * stepS) / 60;
    steps.push({
      index,
      rate_per_s: ratePerMin / 60,
      rate_per_min: ratePerMin,
      start_s: (index - 1) * stepS,
      duration_s: stepS,
      planned,
      offset,
    });
    offset += planned;
  }
  return steps;
}

/**
 * Lịch của một scenario `ramping-arrival-rate` duy nhất cho mọi bậc: tốc độ giữ nguyên trong bậc, nhảy
 * ngay sang bậc sau bằng stage dài 0 s. Một scenario dùng chung một bể VU: nếu mỗi bậc là một scenario
 * riêng có `gracefulStop` tới cuối run thì k6 coi mọi bậc chạy đồng thời và dựng sẵn tổng VU của 30 bậc
 * (`k6 inspect --execution-requirements` báo khoảng 12.000 VU).
 */
export function kneeStages(steps) {
  const stages = [];
  for (const [i, step] of steps.entries()) {
    if (i > 0) stages.push({ target: step.rate_per_min, duration: '0s' });
    stages.push({ target: step.rate_per_min, duration: `${step.duration_s}s` });
  }
  return { startRate: steps[0].rate_per_min, timeUnit: '1m', stages };
}

/** Bậc chứa phiên thứ `globalIndex` của lịch (theo số phiên dự kiến cộng dồn). */
export function kneeStepOf(steps, globalIndex) {
  return steps.find((step) => globalIndex >= step.offset && globalIndex < step.offset + step.planned) ?? null;
}

/** Tên scenario k6 của một bậc (`step_01`, `step_02`, …). */
export function stepName(index) {
  return `step_${String(index).padStart(2, '0')}`;
}

/** Phiên thứ `globalIndex` của lịch: phiên kế hoạch dùng vòng, kèm số vòng. */
export function kneeSession(planSessions, globalIndex) {
  const cycle = Math.floor(globalIndex / planSessions.length);
  return { session: planSessions[globalIndex % planSessions.length], cycle };
}

/** Giờ bắt đầu dự kiến (giây từ đầu workload) của iteration thứ `k` trong một bậc. */
export function kneeStart(step, k) {
  return step.start_s + k / step.rate_per_s;
}

/**
 * Gán tài khoản theo lịch tìm điểm gãy (cùng thuật toán với kế hoạch phát lại, mục 13.4) và đỉnh đồng
 * thời ước tính. Trả `{ bySession, overlapping, withinGap, overlapByStep, peak }` theo chỉ số toàn cục:
 * `overlapping` là số phiên chạy cùng lúc với phiên khác trên một tài khoản (tổng `overlapByStep`);
 * `withinGap` là số phiên chỉ không giữ được khoảng đệm 30 s của `accountAssignment` mà không chồng
 * nhau. Khoảng đệm bù độ lệch giờ bắt đầu của lịch ô 30 s khi phát lại; knee chia đều giờ bắt đầu
 * trong bậc nên `withinGap` khác 0 vẫn không có hai phiên cùng lúc.
 */
export function kneeAccounts(seed, planSessions, steps, accounts, { preludeActions = 2 } = {}) {
  const keys = [];
  const spans = [];
  for (const step of steps) {
    for (let k = 0; k < step.planned; k += 1) {
      const { session, cycle } = kneeSession(planSessions, step.offset + k);
      const start = kneeStart(step, k);
      const [, end] = sessionSpan({ ...session, start_s: start }, { preludeActions });
      keys.push(`${session.user_key}#c${cycle}`);
      spans.push([start, end]);
    }
  }
  const events = [];
  for (const [start, end] of spans) events.push([start, 1], [end, -1]);
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let current = 0;
  let peak = 0;
  for (const [, delta] of events) {
    current += delta;
    peak = Math.max(peak, current);
  }
  const assignment = accountAssignment(seed, keys, accounts, { spans });
  // Số phiên mỗi bậc phải dùng chung tài khoản với phiên khác đang chạy (hết tài khoản seed).
  const overlapByStep = {};
  const lastEnd = new Map();
  const order = spans.map((_, i) => i).sort((a, b) => spans[a][0] - spans[b][0]);
  for (const i of order) {
    const account = assignment.bySession[i];
    if ((lastEnd.get(account) ?? -Infinity) > spans[i][0]) {
      const step = steps.find((s) => i >= s.offset && i < s.offset + s.planned);
      overlapByStep[step.index] = (overlapByStep[step.index] ?? 0) + 1;
    }
    lastEnd.set(account, Math.max(lastEnd.get(account) ?? -Infinity, spans[i][1]));
  }
  const overlapping = Object.values(overlapByStep).reduce((sum, n) => sum + n, 0);
  return { bySession: assignment.bySession, overlapping, withinGap: assignment.overlapping, overlapByStep, peak };
}

/**
 * Tốc độ bắt đầu phiên cao nhất của kế hoạch (phiên/s), tính trên ô `binS` giây — cùng đơn vị với
 * `λ_knee` để kiểm mục 8.4 bước 2 (đỉnh normal-mixed ≤ 0,35 × λ_knee, đỉnh spike ≤ 0,8 × λ_knee).
 */
export function planPeakRate(planSessions, binS = 60) {
  const counts = new Map();
  for (const session of planSessions) {
    const bin = Math.floor(session.start_s / binS);
    counts.set(bin, (counts.get(bin) ?? 0) + 1);
  }
  let peak = 0;
  for (const count of counts.values()) peak = Math.max(peak, count);
  return peak / binS;
}

/** Kiểm đỉnh của profile so với `λ_knee` theo hệ số của mục 8.4. */
export function checkProfileLoad(peakPerS, lambdaKnee, factor) {
  const limit = factor * lambdaKnee;
  return { peak_per_s: peakPerS, limit_per_s: limit, ratio_of_knee: peakPerS / lambdaKnee, pass: peakPerS <= limit };
}
