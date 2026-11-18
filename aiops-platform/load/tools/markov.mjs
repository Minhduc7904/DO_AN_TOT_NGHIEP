/**
 * Sinh phiên học viên từ chuỗi Markov, cùng định dạng phiên với log Moodle (`sessions.v1`).
 *
 * - `generateAssumedSessions`: nguồn "mức 2 thuần" — profile, goal, bảng chuyển, think time,
 *   ngân sách thao tác và thời gian có sẵn đều là GIẢ ĐỊNH của workload-design-v1 (mục 3–5);
 *   giờ bắt đầu chia đều theo đường cong giả định `w(h)` (mục 7.3, 7.6).
 * - `generateLearnedSessions`: sinh thêm phiên kiểu WESSBAS — ma trận chuyển và think time theo
 *   trạng thái học từ đoạn xây của log (mục 13.8; Vögele et al. 2018, [L-WESSBAS],
 *   https://pmc.ncbi.nlm.nih.gov/articles/PMC5910480/).
 */
import { createRng, hash32 } from '../lib/rng.js';
import { sampleQuantileTable } from './lib/stats.mjs';

const MAX_WALK = 400; // chặn vòng lặp vô hạn nếu bảng chuyển lỗi

/** Chia `count` lần bắt đầu theo trọng số 24 giờ (phần dư lớn nhất), cách đều trong mỗi giờ. */
export function evenStartOffsets(count, hourlyWeights) {
  const total = hourlyWeights.reduce((sum, weight) => sum + weight, 0);
  const exact = hourlyWeights.map((weight) => (count * weight) / total);
  const perHour = exact.map(Math.floor);
  let remaining = count - perHour.reduce((sum, value) => sum + value, 0);
  const order = exact
    .map((value, hour) => ({ hour, rest: value - Math.floor(value) }))
    .sort((a, b) => b.rest - a.rest || a.hour - b.hour);
  for (const { hour } of order) {
    if (remaining === 0) break;
    perHour[hour] += 1;
    remaining -= 1;
  }
  const offsets = [];
  perHour.forEach((n, hour) => {
    for (let index = 0; index < n; index += 1)
      offsets.push(hour * 3600 + ((index + 0.5) * 3600) / n);
  });
  return offsets;
}

function clampedLognormal(rng, mu, sigma, [low, high]) {
  // Rút lại khi ra ngoài khoảng (mục 5.6); giới hạn số lần rút để không treo khi tham số lạ.
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const value = rng.lognormal(mu, sigma);
    if (value >= low && value <= high) return value;
  }
  return Math.min(Math.max(Math.exp(mu), low), high);
}

export function phaseOfProfile(profile) {
  return profile === 'healthy-spike' ? 'deadline' : 'normal';
}

export function assumedHourlyWeights(params, phase) {
  return params.hourly_weight.map(
    (weight, hour) =>
      weight * (phase === 'deadline' ? (params.deadline_evening_factor[String(hour)] ?? 1) : 1),
  );
}

/** Một phiên của máy trạng thái giả định. `rng` là bộ sinh riêng của phiên. */
export function walkAssumedSession(params, phase, rng) {
  const isNewUser = rng.chance(params.new_user_share);
  const profile = isNewUser ? 'P3' : rng.weighted(params.profile_mix[phase]);
  const goal = isNewUser ? 'G3' : rng.weighted(params.goal_mix[profile][phase]);
  const table = params.goal_tables[goal];
  const { think } = params;
  const maxActions = Math.round(
    clampedLognormal(rng, params.max_actions.mu, params.max_actions.sigma, [
      params.max_actions.clamp[0] - 0.5,
      params.max_actions.clamp[1] + 0.49,
    ]),
  );
  const ta = params.time_available;
  const timeAvailableS =
    60 * clampedLognormal(rng, Math.log(ta.median_min[profile][phase]), ta.sigma, ta.clamp_min);

  const actions = [];
  let elapsed = 0;
  let state = 'LOGIN';
  for (let step = 0; step < MAX_WALK && actions.length < maxActions; step += 1) {
    const row = table[state];
    if (!row) throw new Error(`Bảng ${goal} thiếu dòng cho ${state}`);
    const next = rng.weighted(row);
    if (next === 'EXIT') break;
    const factor = think.type_factor[think.type_of_state[next]];
    if (factor === undefined) throw new Error(`Không có loại think time cho ${next}`);
    const thinkS = clampedLognormal(rng, think.mu + Math.log(factor), think.sigma, think.clamp_s);
    if (elapsed + thinkS > timeAvailableS) break;
    elapsed += thinkS;
    actions.push({ state: next, think_s: Math.round(thinkS * 10) / 10 });
    state = next;
  }
  return {
    profile,
    goal,
    prelude: isNewUser ? ['REGISTER', 'LOGIN'] : ['LOGIN'],
    max_actions: maxActions,
    time_available_s: Math.round(timeAvailableS),
    actions,
  };
}

/**
 * `count` phiên giả định. Phiên rỗng (rời ngay sau đăng nhập) vẫn giữ vì đó là hành vi của mô hình.
 * Mỗi phiên có seed riêng `hash32(seed, 'assumed', i)` nên thêm/bớt phiên không làm đổi phiên khác.
 */
export function generateAssumedSessions(params, { count, seed, phase }) {
  const offsets = evenStartOffsets(count, assumedHourlyWeights(params, phase));
  return offsets.map((startOffset, index) => {
    const rng = createRng(hash32(seed, 'assumed', index));
    const walk = walkAssumedSession(params, phase, rng);
    return {
      session_id: `assumed-${index}`,
      user_key: `assumed-user-${index}`,
      course_key: null,
      day_index: 0,
      start_offset_s: Math.round(startOffset),
      duration_s: Math.round(walk.actions.reduce((sum, action) => sum + action.think_s, 0)),
      ...walk,
      actions: walk.actions.map((action, actionIndex) =>
        actionIndex === 0 ? { ...action, think_s: 0 } : action,
      ),
    };
  });
}

/**
 * `count` phiên sinh từ ma trận chuyển học từ log (`transitions` có hàng `START`, cột `EXIT`) và
 * bảng phân vị think time theo trạng thái. `startOffsets` cho giờ bắt đầu (độ dài = count).
 * `maxActions` chặn trên độ dài phiên (WESSBAS ghi nhận Markov bậc 1 sinh phiên quá dài).
 */
export function generateLearnedSessions(model, { count, seed, startOffsets, maxActions = 150 }) {
  if (startOffsets.length !== count) throw new Error('startOffsets phải có đúng count phần tử');
  const strip = (row) => Object.fromEntries(Object.entries(row).filter(([key]) => key !== '_n'));
  const rows = Object.fromEntries(
    Object.entries(model.transitions).map(([key, row]) => [key, strip(row)]),
  );
  return startOffsets.map((startOffset, index) => {
    const rng = createRng(hash32(seed, 'learned', index));
    const actions = [];
    let state = 'START';
    while (actions.length < maxActions) {
      const next = rng.weighted(rows[state]);
      if (next === 'EXIT') break;
      const table = model.think_quantiles_by_state[next];
      const thinkS = actions.length === 0 || !table ? 0 : sampleQuantileTable(table, rng.next());
      actions.push({ state: next, think_s: Math.round(thinkS * 10) / 10 });
      state = next;
    }
    return {
      session_id: `learned-${index}`,
      user_key: `learned-user-${index}`,
      course_key: null,
      day_index: 0,
      start_offset_s: Math.round(startOffset),
      duration_s: Math.round(actions.reduce((sum, action) => sum + action.think_s, 0)),
      actions,
    };
  });
}
