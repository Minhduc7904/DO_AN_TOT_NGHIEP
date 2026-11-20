/**
 * Tiêu chí "khỏe" của workload-design-v1 mục 8.4, tính trên một khoảng thời gian (cả run hoặc một bậc
 * của run tìm điểm gãy). Chỉ có hàm thuần; đọc file, Prometheus và docker nằm ở `health-check.mjs`.
 *
 * | Tiêu chí | Ngưỡng |
 * | p95 thời gian phản hồi tại Gateway, mỗi cửa sổ 60 s | < 1 s (normal), < 2 s (deadline/spike) |
 * | Tỉ lệ phản hồi ngoài danh sách mong đợi | < 0,5% |
 * | Phiên bỏ ngang (impatient, too_many_errors, auth_failed) | < 1% |
 * | `dropped_iterations` của k6 | 0 |
 * | CPU từng container (theo giới hạn CPU của nó, không giới hạn thì theo 1 core) | < 80% kéo dài quá 1 phút |
 * | Bộ nhớ từng container | < 85% giới hạn; không restart, không OOM |
 *
 * Bộ nhớ so bằng `mem_anon_perc` (bộ nhớ không thu hồi được, phần quyết định OOM) khi bộ lấy mẫu đọc
 * được cgroup; mẫu cũ không có trường này thì dùng `mem_perc` của `docker stats` (gồm page cache).
 * | Dòng `unexpected_status` | 0 |
 *
 * Container k6 (bộ sinh tải) không đặt giới hạn CPU và được dùng nhiều core: CPU của nó so với số core
 * của máy (`hostCpus`), chỉ dùng để xếp nguyên nhân.
 */

export const HEALTH_LIMITS = Object.freeze({
  p95_s: Object.freeze({ normal: 1, deadline: 2 }),
  unexpected_rate: 0.005,
  abandoned_share: 0.01,
  cpu_perc: 80,
  cpu_sustain_s: 60,
  mem_perc: 85,
});

export const ABANDON_REASONS = Object.freeze(['impatient', 'too_many_errors', 'auth_failed']);
/** Mỗi dòng của actions.jsonl là một request; các outcome này là phản hồi ngoài danh sách mong đợi. */
export const UNEXPECTED_OUTCOMES = Object.freeze(['retried', 'failed', 'unexpected_status']);
/** Container của bộ sinh tải (`docker run` của run-k6.sh không đặt tên, nên nhận theo image). */
export const isClientContainer = (name, stats) => (stats.image ?? '').startsWith('grafana/k6') || /k6/u.test(name);
/** Container thuộc hệ thống được đo: theo tiền tố tên project Compose. */
export const DEFAULT_SYSTEM_PREFIX = 'aiops-lms-';

const inWindow = (ms, from, to) => ms >= from && ms < to;

/** Request, phản hồi ngoài mong đợi, phiên bắt đầu trong `[from, to)` (mili giây). */
export function trafficStats({ actions, sessions, from, to }) {
  let requests = 0;
  let unexpected = 0;
  let unexpectedStatus = 0;
  const byOutcome = {};
  for (const action of actions) {
    if (action.method === 'WAIT') continue;
    if (!inWindow(Date.parse(action.ts), from, to)) continue;
    requests += 1;
    if (UNEXPECTED_OUTCOMES.includes(action.outcome)) {
      unexpected += 1;
      const key = `${action.outcome} ${action.status ?? ''} ${action.endpoint}`;
      byOutcome[key] = (byOutcome[key] ?? 0) + 1;
    }
    if (action.outcome === 'unexpected_status') unexpectedStatus += 1;
  }
  let started = 0;
  let abandoned = 0;
  for (const session of sessions) {
    if (!inWindow(Date.parse(session.start), from, to)) continue;
    started += 1;
    if (ABANDON_REASONS.includes(session.end_reason)) abandoned += 1;
  }
  return {
    requests,
    unexpected,
    unexpected_rate: requests === 0 ? null : unexpected / requests,
    unexpected_status: unexpectedStatus,
    sessions_started: started,
    abandoned,
    abandoned_share: started === 0 ? null : abandoned / started,
    unexpected_top: Object.entries(byOutcome)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5),
  };
}

/**
 * CPU/bộ nhớ theo container trong `[from, to)` từ mẫu của `sample-docker-stats.mjs`
 * (`{ ts, name, cpu_perc, cpu_limit, mem_perc }`; dòng `name = "HOST"` có `mem_available_mb`, `cpu_perc`).
 * CPU quy theo giới hạn: `cpu_perc / cpu_limit` (Docker báo % của một core).
 */
export function resourceStats(samples, from, to, { sampleS = 15, hostCpus = 1 } = {}) {
  const byName = new Map();
  let hostMinAvailableMb = null;
  let hostCpuMax = null;
  for (const sample of samples) {
    if (!inWindow(Date.parse(sample.ts), from, to)) continue;
    if (sample.name === 'HOST') {
      if (sample.mem_available_mb !== undefined) {
        hostMinAvailableMb = Math.min(hostMinAvailableMb ?? Infinity, sample.mem_available_mb);
      }
      if (sample.cpu_perc !== undefined) hostCpuMax = Math.max(hostCpuMax ?? 0, sample.cpu_perc);
      continue;
    }
    if (!byName.has(sample.name)) byName.set(sample.name, []);
    byName.get(sample.name).push(sample);
  }
  const containers = {};
  for (const [name, list] of byName) {
    list.sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
    let run = 0;
    let longest = 0;
    let cpuMax = 0;
    let memMax = 0;
    for (const sample of list) {
      const cpu = sample.cpu_perc / (sample.cpu_limit || (isClientContainer(name, sample) ? hostCpus : 1));
      cpuMax = Math.max(cpuMax, cpu);
      memMax = Math.max(memMax, sample.mem_anon_perc ?? sample.mem_perc ?? 0);
      run = cpu > HEALTH_LIMITS.cpu_perc ? run + 1 : 0;
      longest = Math.max(longest, run);
    }
    containers[name] = {
      image: list[0].image ?? null,
      cpu_max_perc_of_limit: cpuMax,
      // n mẫu liên tiếp trên ngưỡng phủ khoảng n × chu kỳ lấy mẫu.
      cpu_over_limit_longest_s: longest * sampleS,
      mem_max_perc: memMax,
      mem_basis: list.some((sample) => sample.mem_anon_perc != null) ? 'anon' : 'working_set',
      samples: list.length,
    };
  }
  return { containers, host_min_available_mb: hostMinAvailableMb, host_cpu_max_perc: hostCpuMax };
}

/**
 * Chấm một khoảng. `p95` là `[[epoch_s, giá trị_s], …]` của p95 Gateway theo cửa sổ 60 s; chỉ tính cửa
 * sổ kết thúc trong `(from, to]`. `restarts` là danh sách container restart/OOM trong khoảng.
 */
export function evaluateHealth({
  p95,
  actions,
  sessions,
  samples,
  from,
  to,
  phase,
  dropped,
  restarts = [],
  systemPrefix = DEFAULT_SYSTEM_PREFIX,
  sampleS = 15,
  hostCpus = 1,
}) {
  const p95Limit = HEALTH_LIMITS.p95_s[phase === 'deadline' ? 'deadline' : 'normal'];
  const windows = p95.filter(([t]) => t * 1000 > from && t * 1000 <= to).map(([, v]) => v);
  const traffic = trafficStats({ actions, sessions, from, to });
  const resources = resourceStats(samples, from, to, { sampleS, hostCpus });
  const systemContainers = Object.entries(resources.containers).filter(([name]) => name.startsWith(systemPrefix));
  const cpuOffenders = systemContainers
    .filter(([, s]) => s.cpu_over_limit_longest_s > HEALTH_LIMITS.cpu_sustain_s)
    .map(([name, s]) => `${name} ${s.cpu_over_limit_longest_s}s`);
  const memOffenders = systemContainers
    .filter(([, s]) => s.mem_max_perc >= HEALTH_LIMITS.mem_perc)
    .map(([name, s]) => `${name} ${s.mem_max_perc.toFixed(1)}%`);
  const p95Max = windows.length === 0 ? null : Math.max(...windows);
  const criteria = {
    gateway_p95: { value: p95Max, windows: windows.length, limit: p95Limit, pass: windows.length > 0 && p95Max < p95Limit },
    unexpected_rate: {
      value: traffic.unexpected_rate,
      limit: HEALTH_LIMITS.unexpected_rate,
      pass: traffic.unexpected_rate !== null && traffic.unexpected_rate < HEALTH_LIMITS.unexpected_rate,
    },
    abandoned_share: {
      value: traffic.abandoned_share,
      limit: HEALTH_LIMITS.abandoned_share,
      pass: traffic.abandoned_share === null || traffic.abandoned_share < HEALTH_LIMITS.abandoned_share,
    },
    dropped_iterations: { value: dropped, limit: 0, pass: dropped === 0 },
    cpu_sustained: { value: cpuOffenders, pass: cpuOffenders.length === 0 },
    memory: { value: memOffenders, restarts, pass: memOffenders.length === 0 && restarts.length === 0 },
    unexpected_status: { value: traffic.unexpected_status, limit: 0, pass: traffic.unexpected_status === 0 },
  };
  const failed = Object.entries(criteria)
    .filter(([, c]) => !c.pass)
    .map(([name]) => name);
  return { pass: failed.length === 0, failed, criteria, traffic, resources };
}

/**
 * Nguyên nhân khi một bậc không khỏe: phía máy/bộ sinh tải (`client`: k6 bỏ iteration, container k6 hết
 * CPU, CPU hoặc RAM của máy cạn, hết tài khoản seed), phía hệ thống được đo (`system`), hay cả hai
 * (`mixed`: có lý do phía máy nhưng còn tiêu chí khác của hệ thống bị vi phạm, không tách được).
 */
export function classifyCause(result, { hostMinMb = 1500, hostCpuMaxPerc = 90, accountsOverlapping = 0 } = {}) {
  // Không có request hoặc không có cửa sổ p95 trong khoảng chấm: không kết luận được bên nào.
  if (result.criteria.gateway_p95.windows === 0 || result.criteria.unexpected_rate.value === null) {
    return { side: 'unknown', reasons: ['no_data'] };
  }
  const reasons = [];
  // Hết tài khoản seed: hai phiên chạy cùng lúc trên một tài khoản sinh 409 do workload, không do stack.
  if (accountsOverlapping > 0 && result.criteria.unexpected_status.value > 0) reasons.push('seed_accounts_exhausted');
  if (result.criteria.dropped_iterations.value > 0) reasons.push('k6_dropped_iterations');
  for (const [name, s] of Object.entries(result.resources.containers)) {
    if (isClientContainer(name, s) && s.cpu_over_limit_longest_s > HEALTH_LIMITS.cpu_sustain_s) {
      reasons.push(`k6_cpu ${name}`);
    }
  }
  const host = result.resources.host_min_available_mb;
  if (host !== null && host < hostMinMb) reasons.push(`host_ram ${host} MB`);
  const hostCpu = result.resources.host_cpu_max_perc;
  if (hostCpu !== null && hostCpu >= hostCpuMaxPerc) reasons.push(`host_cpu ${hostCpu.toFixed(0)}%`);
  if (reasons.length === 0) return { side: 'system', reasons };
  // Tiêu chí mà lý do phía máy đã giải thích: iteration bị bỏ, và 409 do dùng chung tài khoản.
  const explained = new Set(['dropped_iterations']);
  if (reasons.includes('seed_accounts_exhausted')) explained.add('unexpected_status');
  const systemFailed = result.failed.filter((name) => !explained.has(name));
  return { side: systemFailed.length > 0 ? 'mixed' : 'client', reasons, ...(systemFailed.length > 0 ? { system_failed: systemFailed } : {}) };
}

/**
 * Restart/OOM của container trong project, kèm thời điểm: OOM theo lúc container chết (`FinishedAt`),
 * restart theo lúc khởi động lại (`StartedAt`). Bỏ sự kiện trước `sinceMs` (container hỏng từ run trước
 * không bị tính cho run này). `rows`: `{ name, oom, startedAt, finishedAt }` (mili giây).
 */
export function restartEvents(rows, sinceMs) {
  const events = [];
  for (const row of rows) {
    const times = [];
    if (row.oom && row.finishedAt >= sinceMs) times.push(row.finishedAt);
    if (row.startedAt > sinceMs) times.push(row.startedAt);
    if (times.length > 0) events.push({ name: row.name, at: Math.min(...times), oom: row.oom });
  }
  return events;
}

/**
 * Iteration bị bỏ theo bậc. k6 chỉ báo tổng (một scenario cho mọi bậc) và không tăng chỉ số iteration
 * khi bỏ, nên suy từ số phiên bắt đầu trong khoảng thời gian của bậc so với số dự kiến. Lệch ±`tolerance`
 * phiên ở biên bậc là do pha của lịch, không tính. Tổng của k6 bằng 0 thì mọi bậc bằng 0.
 */
export function droppedByStep(summary, sessions, { tolerance = 1, prefix = 'knee-' } = {}) {
  const result = {};
  const startMs = Date.parse(summary.workload_start);
  for (const step of summary.steps) {
    if (!(summary.dropped_iterations > 0)) {
      result[step.index] = 0;
      continue;
    }
    const from = startMs + step.start_s * 1000;
    const to = from + step.duration_s * 1000;
    const started = sessions.filter((s) => {
      if (!s.session_key?.startsWith(prefix)) return false;
      const t = Date.parse(s.start);
      return t >= from && t < to;
    }).length;
    const missing = step.planned - started;
    result[step.index] = missing > tolerance ? missing : 0;
  }
  return result;
}

/**
 * Chấm từng bậc của run tìm điểm gãy. `λ_knee` là tốc độ của bậc khỏe cuối cùng trước bậc đầu tiên
 * không khỏe (bậc 1 đã hỏng thì không xác định); `lambda_knee_lower_bound` cho biết đó chỉ là cận dưới
 * (stack chưa gãy). Cửa sổ của bậc lùi 60 s đầu để bỏ phần chuyển tiếp.
 */
export function evaluateSteps({
  summary,
  p95,
  actions,
  sessions,
  samples,
  restartsInRange = () => [],
  settleS = 60,
  overlapByStep = {},
  sampleS = 15,
  hostCpus = 1,
}) {
  if (summary.steps.some((step) => settleS >= step.duration_s)) {
    throw new RangeError(`settleS (${settleS} s) phải nhỏ hơn thời lượng bậc`);
  }
  const startMs = Date.parse(summary.workload_start);
  const endMs = summary.workload_end ? Date.parse(summary.workload_end) : Infinity;
  const dropped = droppedByStep(summary, sessions);
  // Bậc chưa chạy hết (k6 dừng sớm: lỗi quá ngưỡng an toàn, RAM máy cạn) không được chấm.
  const complete = summary.steps.filter((step) => startMs + (step.start_s + step.duration_s) * 1000 <= endMs);
  const results = complete.map((step) => {
    const from = startMs + (step.start_s + settleS) * 1000;
    const to = startMs + (step.start_s + step.duration_s) * 1000;
    const result = evaluateHealth({
      p95,
      actions,
      sessions,
      samples,
      from,
      to,
      phase: summary.phase,
      dropped: step.dropped_iterations ?? dropped[step.index],
      restarts: restartsInRange(from, to),
      sampleS,
      hostCpus,
    });
    const cause = result.pass ? null : classifyCause(result, { accountsOverlapping: overlapByStep[step.index] ?? 0 });
    return { step: step.index, rate_per_s: step.rate_per_s, ...result, cause };
  });
  const firstFail = results.findIndex((r) => !r.pass);
  const lastHealthy = firstFail === -1 ? (results.at(-1) ?? null) : firstFail === 0 ? null : results[firstFail - 1];
  const lambda = lastHealthy?.rate_per_s ?? null;
  // Iteration bị bỏ mà không gán được cho bậc nào (lệch biên trong dung sai): phải bằng 0.
  const attributed = complete.reduce((sum, step) => sum + (step.dropped_iterations ?? dropped[step.index] ?? 0), 0);
  return {
    lambda_knee_per_s: lambda,
    // Cận dưới khi stack chưa gãy trong các bậc đã đo: mọi bậc khỏe, hoặc bậc hỏng đầu tiên do máy/không rõ.
    lambda_knee_lower_bound: lambda !== null && (firstFail === -1 || results[firstFail].cause.side !== 'system'),
    reached_max_rate: firstFail === -1 && complete.length === summary.steps.length,
    steps_not_run: summary.steps.length - complete.length,
    k6_dropped_iterations: summary.dropped_iterations ?? null,
    k6_dropped_unattributed: summary.dropped_iterations > 0 ? Math.max(0, summary.dropped_iterations - attributed) : 0,
    first_unhealthy: firstFail === -1 ? null : { step: results[firstFail].step, rate_per_s: results[firstFail].rate_per_s, failed: results[firstFail].failed, cause: results[firstFail].cause },
    steps: results,
  };
}
