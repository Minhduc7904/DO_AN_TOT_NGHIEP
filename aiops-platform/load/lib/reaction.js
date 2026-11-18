/**
 * Logic thuần (không import k6) cho phản ứng của người dùng ảo mức 2/2+ với phản hồi của hệ thống,
 * theo workload-design-v1 mục 3.5 và 6.2–6.5. Tham số ở `params/reaction-v1.json`.
 */
import { createRng, hash32 } from './rng.js';

/** Mã coi là lỗi tạm thời: thử lại có backoff nếu thao tác an toàn để lặp (mục 6.2, 6.3). */
export const RETRYABLE_STATUSES = Object.freeze([0, 429, 502, 503, 504]);

/**
 * Phân loại một phản hồi.
 * - `ok` / `slow` (chậm hơn kiên nhẫn) / `too_slow` (chậm hơn 2 × kiên nhẫn: bỏ ngang ngay);
 * - `retryable` (0 = lỗi mạng/timeout của k6, 429, 502, 503, 504); `auth` (401);
 * - `server_error` (500); `not_found` (404 ngoài danh sách mong đợi);
 * - `unexpected_status` (mã khác ngoài danh sách mong đợi: lỗi của workload).
 */
export function classifyResponse({ status, durationMs, expected, patienceMs }) {
  if (expected.includes(status)) {
    if (durationMs > 2 * patienceMs) return 'too_slow';
    return durationMs > patienceMs ? 'slow' : 'ok';
  }
  if (RETRYABLE_STATUSES.includes(status)) return 'retryable';
  if (status === 401) return 'auth';
  if (status === 500) return 'server_error';
  if (status === 404) return 'not_found';
  return 'unexpected_status';
}

/** Full Jitter (Brooker 2015): lần thử lại thứ k chờ đều trong [0, min(cap, base × 2^k)]. */
export function backoffMs(rng, retryIndex, { base_ms: base, cap_ms: cap }) {
  return rng.uniform(0, Math.min(cap, base * 2 ** retryIndex));
}

function clamp(value, [low, high]) {
  return Math.min(Math.max(value, low), high);
}

/** Kiên nhẫn của phiên: median × e^(σ·Z), kẹp [2; 15] s (mục 3.5). */
export function drawPatience(rng, params, profile, phase) {
  const config = params.patience.by_profile[profile]?.[phase];
  if (!config) throw new Error(`Không có kiên nhẫn cho ${profile}/${phase}`);
  const patienceS = clamp(
    config.median_s * Math.exp(params.patience.sigma * rng.normal()),
    params.patience.clamp_s,
  );
  return { patience_s: Math.round(patienceS * 100) / 100, slow_limit: config.slow_limit };
}

/** Tài khoản seed cố định cho một người dùng của log (mục 13.4): 1 + hash % n. */
export function seedAccountIndex(seed, userKey, accounts) {
  return 1 + (hash32(seed, 'account', userKey) % accounts);
}

/**
 * Kế hoạch của một phiên học viên phát lại — chỉ phụ thuộc `workload_seed`, vị trí phiên trong kế
 * hoạch và nội dung phiên, nên hai run cùng seed có kế hoạch trùng 100% (mục 10.3).
 * `rng` là luồng kế hoạch của phiên (tách khỏi luồng hành vi, mục 11.1).
 */
export function studentSessionPlan({ session, phase, params, rng, seed, accounts, accountIndex }) {
  const profile = session.profile ?? rng.weighted(params.student_profile_mix[phase]);
  const patience = drawPatience(rng, params, profile, phase);
  const refreshAtAction =
    session.actions.length > 1 && rng.chance(params.refresh_share)
      ? 1 + Math.floor(rng.next() * (session.actions.length - 1))
      : null;
  const plan = {
    source_session_id: session.session_id,
    account_index: accountIndex ?? seedAccountIndex(seed, session.user_key, accounts),
    profile,
    goal: session.goal ?? null,
    phase,
    ...patience,
    refresh_at_action: refreshAtAction,
    states: session.actions.map((action) => action.state).join(','),
  };
  return { ...plan, plan_hash: hash32(JSON.stringify(plan)).toString(16) };
}

/**
 * Bộ đếm của phiên và quyết định bỏ ngang. Trả `end_reason` khi phiên phải dừng, ngược lại null.
 */
export function createSessionCounters({ slowLimit, errorLimit }) {
  const counters = { slow_count: 0, error_count: 0, retries_used: 0 };
  return {
    counters,
    onSlow() {
      counters.slow_count += 1;
      return counters.slow_count >= slowLimit ? 'impatient' : null;
    },
    onError() {
      counters.error_count += 1;
      return counters.error_count >= errorLimit ? 'too_many_errors' : null;
    },
    onRetry() {
      counters.retries_used += 1;
    },
  };
}

/**
 * Lịch bắt đầu phiên cho executor `ramping-arrival-rate` (timeUnit 1 phút): gom thời điểm bắt đầu
 * theo ô `binS` giây; mỗi ô giữ tốc độ không đổi (bước nhảy bằng stage 0 s), nên số iteration của
 * ô bằng đúng số phiên bắt đầu trong ô. Yêu cầu `60 / binS` nguyên để tốc độ là số nguyên.
 */
export function buildArrivalStages(starts, runSeconds, binS = 30) {
  if (!Number.isInteger(60 / binS)) throw new Error('binS phải chia hết 60');
  const bins = Math.ceil(runSeconds / binS);
  const counts = Array.from({ length: bins }, () => 0);
  for (const start of starts) {
    if (start < 0 || start >= runSeconds) continue;
    counts[Math.floor(start / binS)] += 1;
  }
  const perMinute = 60 / binS;
  const stages = [];
  counts.forEach((count, index) => {
    if (index > 0) stages.push({ target: count * perMinute, duration: '0s' });
    stages.push({ target: count * perMinute, duration: `${binS}s` });
  });
  return {
    startRate: counts[0] * perMinute,
    timeUnit: '1m',
    stages,
    total: counts.reduce((sum, value) => sum + value, 0),
    peakPerMinute: Math.max(...counts) * perMinute,
  };
}

/**
 * Cắt kế hoạch theo cửa sổ `[windowStartS, windowStartS + windowS)` rồi dời về 0 (để chạy thử ngắn
 * một đoạn của ngày nén). Trả danh sách phiên theo thứ tự bắt đầu.
 */
export function windowSessions(sessions, windowStartS, windowS) {
  return sessions
    .filter(
      (session) => session.start_s >= windowStartS && session.start_s < windowStartS + windowS,
    )
    .map((session) => ({ ...session, start_s: session.start_s - windowStartS }));
}

/**
 * Số phiên chạy đồng thời lớn nhất của kế hoạch — cận trên của số VU cần có. Một phiên chiếm VU từ
 * `start_s` tới hết tổng think time cộng `actionOverheadS` cho mỗi thao tác (kể cả `preludeActions`
 * bước chèn đầu phiên: thời gian phản hồi, nghỉ điều hướng ngắn). Think time không bị nén theo lịch,
 * nên ở giờ đỉnh nhiều phiên dài chồng lên nhau; VU dựng thêm giữa run chậm và làm k6 bỏ iteration
 * (`dropped_iterations`), vì vậy số VU dựng sẵn phải tính từ kế hoạch thay vì đặt tay.
 * Đối chiếu run `w14-t04-moodle-r1`: đo được 176 phiên đồng thời, hàm cho 191 với overhead 2 s.
 */
export function peakConcurrency(sessions, { actionOverheadS = 2, preludeActions = 2 } = {}) {
  const events = [];
  for (let index = 0; index < sessions.length; index += 1) {
    const session = sessions[index];
    let busy = actionOverheadS * (session.actions.length + preludeActions);
    for (let step = 1; step < session.actions.length; step += 1) {
      busy += session.actions[step].think_s;
    }
    events.push([session.start_s, 1], [session.start_s + busy, -1]);
  }
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let current = 0;
  let peak = 0;
  for (const [, delta] of events) {
    current += delta;
    peak = Math.max(peak, current);
  }
  return peak;
}

/** Số VU dựng sẵn và tối đa từ đỉnh đồng thời: dư 15% + 10, trần dư thêm 30% (ít nhất 50). */
export function vuSizing(peak) {
  const preAllocated = Math.ceil(peak * 1.15) + 10;
  return { preAllocated, max: preAllocated + Math.max(50, Math.ceil(peak * 0.3)) };
}

/** Think time loại "điều hướng" (μ = 2,659 + ln 0,5; σ = 1,325; kẹp [1; 300] s, mục 5.6). */
export function navigationThink(rng, { mu, sigma, clamp_s: [low, high] }) {
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const value = rng.lognormal(mu, sigma);
    if (value >= low && value <= high) return value;
  }
  return Math.min(Math.max(Math.exp(mu), low), high);
}

/**
 * Gán tài khoản seed không trùng: hoán vị Fisher–Yates có seed của các chỉ số 1..accounts, người dùng
 * thứ i (theo thứ tự xuất hiện trong kế hoạch) nhận phần tử thứ i. Chỉ dùng lại tài khoản khi số người
 * dùng vượt số tài khoản (vòng lại từ đầu hoán vị).
 */
export function accountAssignment(seed, userKeys, accounts) {
  const rng = createRng(hash32(seed, 'account-permutation'));
  const order = Array.from({ length: accounts }, (_, index) => index + 1);
  for (let index = order.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng.next() * (index + 1));
    [order[index], order[swap]] = [order[swap], order[index]];
  }
  const map = {};
  let next = 0;
  for (const key of userKeys) {
    if (map[key] !== undefined) continue;
    map[key] = order[next % accounts];
    next += 1;
  }
  return map;
}
