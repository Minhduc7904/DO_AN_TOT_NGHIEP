/**
 * Logic thuần (không import k6) cho giảng viên, admin và job lịch ở mức 2 (workload-design-v1 mục
 * 4.2–4.3, 5.6–5.8, 7.3–7.5). Tham số ở `params/staff-assumed-v1.json`.
 */
import { drawPatience } from './reaction.js';
import { hash32 } from './rng.js';

/** Think time theo loại thao tác: log-normal (μ + ln hệ số, σ), rút lại khi ngoài [1; 300] s (mục 5.6). */
export function drawThink(rng, think, state) {
  const factor = think.type_factor[think.type_of_state[state]];
  if (factor === undefined) throw new Error(`Không có loại think time cho ${state}`);
  const [low, high] = think.clamp_s;
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const value = rng.lognormal(think.mu + Math.log(factor), think.sigma);
    if (value >= low && value <= high) return value;
  }
  return Math.min(Math.max(Math.exp(think.mu + Math.log(factor)), low), high);
}

/** Kế hoạch phiên giảng viên: goal, tài khoản seed, kiên nhẫn (profile PI). */
export function instructorPlan({ seed, index, staff, reaction, phase, rng }) {
  const plan = {
    goal: rng.weighted(staff.instructor.goal_mix),
    account_index: 1 + (hash32(seed, 'instructor-account', index) % staff.instructor.accounts),
    profile: 'PI',
    phase,
    ...drawPatience(rng, reaction, 'PI', phase),
  };
  return { ...plan, plan_hash: hash32(JSON.stringify(plan)).toString(16) };
}

/** Kế hoạch phiên admin rải rác: goal A1/A2, kiên nhẫn (profile PA). */
export function adminPlan({ staff, reaction, phase, rng, goal }) {
  const plan = {
    goal: goal ?? rng.weighted(staff.admin.adhoc_goal_mix),
    profile: 'PA',
    phase,
    ...drawPatience(rng, reaction, 'PA', phase),
  };
  return { ...plan, plan_hash: hash32(JSON.stringify(plan)).toString(16) };
}

/**
 * Bước kế tiếp của giảng viên. I1, I2, I4 đi theo bảng chuyển; I3 là chuỗi tuần tự, mỗi bước có xác
 * suất bỏ ngang, sau job AI thì `EXIT` / job loại còn lại / xuất bản quiz (mục 5.7).
 */
export function nextInstructorState(staff, goal, state, rng, stepInSequence = 0) {
  const config = staff.instructor;
  if (goal === 'I3') {
    if (state === 'I_AI_JOB' || state === 'I_PUBLISH_QUIZ') {
      return state === 'I_PUBLISH_QUIZ' ? 'EXIT' : rng.weighted(config.i3_after_job);
    }
    if (rng.chance(config.i3_abort_per_step)) return 'EXIT';
    return config.i3_sequence[stepInSequence] ?? 'EXIT';
  }
  const row = config.goal_tables[goal]?.[state];
  if (!row) throw new Error(`Bảng ${goal} thiếu dòng cho ${state}`);
  return rng.weighted(row);
}

/**
 * Lịch `ramping-arrival-rate` (timeUnit 1h) từ số phiên theo 24 giờ của ngày: mỗi giờ của ngày nén
 * thành `runSeconds / 24` giây chạy thật, tốc độ không đổi trong giờ. Có thể cắt cửa sổ
 * `[windowStartS, windowStartS + windowS)` để chạy thử.
 */
export function hourlyArrivalStages(perHour, runSeconds, windowStartS = 0, windowS = runSeconds) {
  const hourS = runSeconds / 24;
  const stages = [];
  let total = 0;
  let startRate = null;
  for (let hour = 0; hour < 24; hour += 1) {
    const from = Math.max(hour * hourS, windowStartS);
    const to = Math.min((hour + 1) * hourS, windowStartS + windowS);
    if (to <= from) continue;
    const rate = Math.round((perHour[hour] / hourS) * 3600);
    if (startRate === null) startRate = rate;
    else stages.push({ target: rate, duration: '0s' });
    stages.push({ target: rate, duration: `${Math.round(to - from)}s` });
    total += (rate / 3600) * (to - from);
  }
  return { startRate: startRate ?? 0, timeUnit: '1h', stages, expected: total };
}

/** Số phiên theo giờ: `total × weight(h) / Σ weight`. */
export function sessionsPerHour(total, weights) {
  const sum = weights.reduce((acc, value) => acc + value, 0);
  return weights.map((value) => (total * value) / sum);
}

/** Thời điểm chạy (giây của run, sau khi cắt cửa sổ) của sự kiện đặt theo giờ trong ngày. */
export function scheduledStarts(hours, runSeconds, windowStartS = 0, windowS = runSeconds) {
  const hourS = runSeconds / 24;
  return hours
    .map((hour) => hour * hourS - windowStartS)
    .filter((start) => start >= 0 && start < windowS);
}
