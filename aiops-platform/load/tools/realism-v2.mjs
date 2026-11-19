/**
 * Tiêu chí độ thực v2: "nằm trong dao động tự nhiên của dữ liệu thật"
 * (docs/processed/architecture/workload-realism-criteria-v2.md).
 *
 * Tiêu chí v1 dùng ngưỡng cố định (KS D < 0,1; trung vị lệch < ±10%; JSD < 0,05). Chính hai đoạn của
 * log Moodle thật cũng trượt ngưỡng trung vị thời lượng (−37%), nên v1 đánh trượt cả dữ liệu thật.
 * V2 lấy mốc từ dữ liệu: rút nhiều nhóm `k` ngày thật trong phần xây của log, đo khoảng cách từng nhóm
 * tới hold-out bằng đúng bộ đo của v1, rồi hỏi nguồn tải có lệch hold-out nhiều hơn mức các nhóm ngày
 * thật thường lệch hay không.
 *
 * Cách chấm (mọi hằng số nằm trong `CRITERIA_V2`, đăng ký trước khi chấm run mới):
 *  1. Nhóm ngày tham chiếu: `draws` nhóm, mỗi nhóm `k` ngày khác nhau rút đều từ "pool" của profile
 *     (`referencePool`), bộ sinh số có seed cố định.
 *  2. Mỗi nhóm được dựng thành kế hoạch như kế hoạch phát lại (`buildPlan`, kẹp think time), rồi rút
 *     có hoàn lại đúng `n` phiên, với `n` là số phiên quan sát được của nguồn đang chấm, để nhiễu lấy mẫu
 *     của KS ngang nhau.
 *  3. Bảy khoảng cách có ngưỡng của v1 (lệch trung vị lấy trị tuyệt đối) đổi thành thứ hạng giữa
 *     (mid-rank) trong phân phối tham chiếu; điểm của một mẫu là thứ hạng lớn nhất trong bảy đại lượng.
 *  4. Ngưỡng `tau` = phân vị `quantile` của điểm các nhóm tham chiếu (mỗi nhóm xếp hạng với các nhóm
 *     còn lại). Nguồn đạt khi điểm ≤ `tau`: lệch không hơn 95% nhóm ngày thật, xét cả bảy đại lượng
 *     cùng lúc (không phải 95% cho từng đại lượng, vốn làm dữ liệu thật trượt nhiều hơn 5%).
 *
 * Đại lượng của quá trình đến (dáng theo giờ, đỉnh/trung bình, dispersion, Hurst) chỉ báo cáo: in
 * khoảng 2,5–97,5% của nhóm tham chiếu, không có ngưỡng (như v1).
 */
import { createRng } from '../lib/rng.js';
import { compare, describe, PRELUDE_STATES } from './realism.mjs';
import { buildPlan } from './replay-plan.mjs';
import { quantileSorted, sortedNumbers } from './lib/stats.mjs';

export const CRITERIA_V2 = Object.freeze({
  version: 'realism-criteria.v2',
  metrics: Object.freeze([
    'actions_per_session_ks_d',
    'actions_per_session_median_rel',
    'duration_ks_d',
    'duration_median_rel',
    'think_ks_d',
    'think_median_rel',
    'action_mix_jsd',
  ]),
  arrivalMetrics: Object.freeze(['hourly_shape_pearson', 'peak_to_mean', 'dispersion_index', 'hurst']),
  draws: 1000,
  seed: 20261119,
  quantile: 0.95,
  /** Mốc thời gian của run làm tròn xuống theo giây như log Moodle trước khi tính khoảng nghỉ. */
  timeResolutionMs: 1000,
});

/**
 * Pool ngày của nhóm tham chiếu. `perDay` là `[{ day, sessions }]` của phần xây.
 * - `normal-mixed`: ngày có số phiên trong khoảng tứ phân vị [Q1, Q3] (ngày học thường).
 * - `healthy-spike`: ngày có số phiên ≥ Q3 (ngày đông).
 */
export function referencePool(perDay, profile) {
  const counts = sortedNumbers(perDay.map((item) => item.sessions));
  const q1 = quantileSorted(counts, 0.25);
  const q3 = quantileSorted(counts, 0.75);
  let days;
  if (profile === 'normal-mixed') {
    days = perDay.filter((item) => item.sessions >= q1 && item.sessions <= q3);
  } else if (profile === 'healthy-spike') {
    days = perDay.filter((item) => item.sessions >= q3);
  } else {
    throw new Error(`Profile lạ: ${profile}`);
  }
  return { q1, q3, days: days.map((item) => item.day) };
}

/** Bảy khoảng cách không âm của v2 từ `rows` của `compare` (v1). */
export function distances(rows) {
  const out = {};
  for (const metric of CRITERIA_V2.metrics) {
    const value = rows[metric];
    out[metric] = value === null || value === undefined ? null : Math.abs(value);
  }
  return out;
}

/** Thứ hạng giữa của `x` trong mảng đã sắp: (số < x + 0,5 × số = x) / n. */
export function midRank(sorted, x, { excludeSelf = false } = {}) {
  let less = 0;
  let equal = 0;
  for (const value of sorted) {
    if (value < x) less += 1;
    else if (value === x) equal += 1;
    else break;
  }
  const n = sorted.length - (excludeSelf ? 1 : 0);
  if (excludeSelf) equal -= 1;
  return n <= 0 ? null : (less + 0.5 * equal) / n;
}

function chooseDays(rng, pool, k) {
  const copy = [...pool];
  for (let i = 0; i < k; i += 1) {
    const j = i + Math.floor(rng.next() * (copy.length - i));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, k).sort((a, b) => a - b);
}

function observed(planSessions) {
  return planSessions
    .map((session) => {
      const actions = session.actions
        .filter((action) => !PRELUDE_STATES.has(action.state))
        .map((action, index) => ({ state: action.state, think_s: index === 0 ? 0 : action.think_s }));
      return {
        start_s: session.start_s,
        actions,
        duration_s: actions.reduce((sum, action) => sum + action.think_s, 0),
      };
    })
    .filter((session) => session.actions.length > 0);
}

/**
 * Các nhóm ngày tham chiếu, dựng một lần cho mọi nguồn (cùng seed thì cùng nhóm). Trả
 * `{ pool, groups: [{ days, sessions, arrival }] }`; `arrival` là các đại lượng của quá trình đến
 * của cả nhóm (không rút mẫu).
 */
export function referenceGroups(buildSessions, perDay, reference, options) {
  const { profile, k, runSeconds, thinkCapS, draws = CRITERIA_V2.draws, seed = CRITERIA_V2.seed } =
    options;
  const pool = referencePool(perDay, profile);
  if (pool.days.length < k) throw new Error(`Pool ${profile} chỉ có ${pool.days.length} ngày < k = ${k}`);
  const rng = createRng(seed);
  const byDay = new Map();
  for (const session of buildSessions) {
    if (!byDay.has(session.day_index)) byDay.set(session.day_index, []);
    byDay.get(session.day_index).push(session);
  }
  const groups = [];
  for (let draw = 0; draw < draws; draw += 1) {
    const days = chooseDays(rng, pool.days, k);
    const { plan } = buildPlan(
      days.flatMap((day) => byDay.get(day) ?? []),
      { planId: `ref-${draw}`, source: 'reference', profile, days, k, runSeconds, thinkCapS, prelude: [] },
    );
    const sessions = observed(plan.sessions);
    const full = compare(describe(sessions, runSeconds), reference);
    groups.push({
      days,
      sessions,
      arrival: {
        hourly_shape_pearson: full.rows.hourly_shape_pearson,
        peak_to_mean: full.rows.peak_to_mean.source,
        dispersion_index: full.rows.dispersion_index.source,
        hurst: full.rows.hurst.source,
      },
    });
  }
  return { pool, groups };
}

/**
 * Phân phối tham chiếu cho một cỡ mẫu `n`: mỗi nhóm rút có hoàn lại `n` phiên rồi đo khoảng cách tới
 * hold-out. Trả thứ hạng đã sắp theo đại lượng và ngưỡng `tau`.
 */
export function referenceDistribution(groups, reference, n, { runSeconds, seed = CRITERIA_V2.seed }) {
  const rng = createRng((seed ^ (n * 2654435761)) >>> 0);
  const perGroup = groups.map((group) => {
    const sample = Array.from({ length: n }, () => group.sessions[Math.floor(rng.next() * group.sessions.length)]);
    return distances(compare(describe(sample, runSeconds), reference).rows);
  });
  const sorted = {};
  for (const metric of CRITERIA_V2.metrics) {
    sorted[metric] = sortedNumbers(perGroup.map((d) => d[metric]).filter((v) => v !== null));
  }
  const scores = perGroup.map((d) =>
    Math.max(...CRITERIA_V2.metrics.map((metric) => midRank(sorted[metric], d[metric], { excludeSelf: true }))),
  );
  const sortedScores = sortedNumbers(scores);
  return {
    n,
    sorted,
    tau: quantileSorted(sortedScores, CRITERIA_V2.quantile),
    limits: Object.fromEntries(
      CRITERIA_V2.metrics.map((metric) => [metric, quantileSorted(sorted[metric], CRITERIA_V2.quantile)]),
    ),
  };
}

/** Chấm một nguồn theo v2. `rows` là `compare(source, reference).rows`. */
export function compareV2(rows, distribution, groups) {
  const d = distances(rows);
  const ranks = {};
  for (const metric of CRITERIA_V2.metrics) {
    ranks[metric] = d[metric] === null ? null : midRank(distribution.sorted[metric], d[metric]);
  }
  const known = Object.values(ranks).filter((rank) => rank !== null);
  const score = known.length === CRITERIA_V2.metrics.length ? Math.max(...known) : null;
  const arrival = {};
  for (const metric of CRITERIA_V2.arrivalMetrics) {
    const values = sortedNumbers(groups.map((group) => group.arrival[metric]).filter((v) => v !== null && v !== undefined));
    const source =
      metric === 'hourly_shape_pearson' ? rows.hourly_shape_pearson : rows[metric]?.source ?? null;
    arrival[metric] = {
      source,
      reference_p025: quantileSorted(values, 0.025),
      reference_p975: quantileSorted(values, 0.975),
    };
  }
  return {
    criteria: CRITERIA_V2.version,
    distances: d,
    ranks,
    score,
    tau: distribution.tau,
    limits: distribution.limits,
    passed: score !== null && score <= distribution.tau,
    arrival,
  };
}
