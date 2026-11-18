import { sleep } from 'k6';
import http from 'k6/http';

import { config } from './config.js';
import { backoffMs, classifyResponse, createSessionCounters, navigationThink } from './reaction.js';

/**
 * Client HTTP của người dùng ảo mức 2/2+ (workload-design-v1 mục 6, 11.2, 12.2): gắn token, timeout
 * 15 s, tag `name` dạng mẫu, phản ứng theo phản hồi (thử lại có backoff, làm mới token/đăng nhập lại
 * khi 401, đếm chậm/lỗi, bỏ ngang) và ghi một dòng nhật ký `action` cho mỗi request.
 *
 * Nhật ký đi qua `console.log` (một JSON mỗi dòng, có `kind`); `run-k6.sh` chuyển log của k6 ra file
 * JSON và `tools/split-workload-log.mjs` tách thành `actions.jsonl`, `sessions.jsonl`.
 */

/** Lỗi dùng để dừng phiên với `end_reason` (bỏ ngang, hết giờ run…). */
export class SessionEnd extends Error {
  constructor(reason, detail = '') {
    super(`${reason}${detail ? `: ${detail}` : ''}`);
    this.reason = reason;
  }
}

const callbacks = new Map();
function expectedCallback(statuses) {
  const key = statuses.join(',');
  if (!callbacks.has(key)) callbacks.set(key, http.expectedStatuses(...statuses));
  return callbacks.get(key);
}

function errorCode(body) {
  if (!body || typeof body !== 'string' || body[0] !== '{') return null;
  try {
    return JSON.parse(body)?.error?.code ?? null;
  } catch {
    return null;
  }
}

export function logRecord(record) {
  console.log(JSON.stringify(record));
}

export class UserSession {
  /**
   * @param {object} options
   * @param {string} options.role student | instructor | admin
   * @param {string} options.door cửa đăng nhập (`student`, `instructor`, `admin`)
   * @param {object} options.plan kế hoạch phiên (profile, goal, patience_s, slow_limit, ...)
   * @param {object} options.params `params/reaction-v1.json`
   * @param {object} options.rng luồng hành vi của phiên
   * @param {number} options.deadlineMs mốc phải kết thúc phiên (hết run)
   */
  constructor({
    scenario,
    sessionKey,
    role,
    door,
    email,
    password,
    plan,
    params,
    rng,
    deadlineMs,
  }) {
    Object.assign(this, { scenario, sessionKey, role, door, email, password, plan, params, rng });
    this.deadlineMs = deadlineMs;
    this.token = null;
    this.refreshToken = null;
    this.principalId = null;
    this.state = null;
    this.thinkBeforeMs = 0;
    this.returnToDash = false;
    this.requests = 0;
    this.actions = 0;
    this.startedAt = Date.now();
    this.tracker = createSessionCounters({
      slowLimit: plan.slow_limit,
      errorLimit: params.error_limit,
    });
  }

  /** Bắt đầu thao tác mới: ghi trạng thái và think time đã nghỉ trước đó. */
  begin(state) {
    this.state = state;
    this.actions += 1;
  }

  /** Nghỉ `seconds` trước thao tác kế tiếp; dừng phiên nếu nghỉ xong đã quá hạn run. */
  think(seconds) {
    if (Date.now() + seconds * 1000 >= this.deadlineMs) throw new SessionEnd('run_end');
    if (seconds > 0) sleep(seconds);
    this.thinkBeforeMs = Math.round(seconds * 1000);
  }

  log(fields) {
    logRecord({
      kind: 'action',
      ts: new Date().toISOString(),
      scenario: this.scenario,
      session_key: this.sessionKey,
      role: this.role,
      profile: this.plan.profile,
      goal: this.plan.goal,
      state: this.state,
      action_index: this.actions,
      think_before_ms: this.thinkBeforeMs,
      ...fields,
    });
    this.thinkBeforeMs = 0;
  }

  send(method, path, name, body, expected, withToken, raw) {
    const url = raw ? path : `${config.baseUrl}${path}`;
    let payload = null;
    const headers = {};
    if (raw) {
      payload = body;
      headers['content-type'] = raw.contentType;
    } else if (body !== undefined) {
      payload = JSON.stringify(body);
      headers['content-type'] = 'application/json';
    }
    if (withToken && this.token) headers.authorization = `Bearer ${this.token}`;
    const response = http.request(method, url, payload, {
      headers,
      tags: { name, scenario_role: this.role },
      timeout: `${this.params.request_timeout_s}s`,
      responseCallback: expectedCallback(expected),
    });
    this.requests += 1;
    return response;
  }

  /**
   * Gửi request và phản ứng theo mục 6.2. Trả `{ status, data, meta }` khi thành công (mã trong
   * `expected`), `null` khi nội dung không còn (404) hoặc lỗi 500 được bỏ qua; ném `SessionEnd` khi
   * phải bỏ ngang.
   *
   * @param {object} options
   * @param {boolean} options.idempotent an toàn để tự thử lại (mục 6.5)
   * @param {boolean} options.auth gửi kèm token người dùng (mặc định có)
   */
  call(
    method,
    path,
    { name, body, expected = [200], idempotent = method === 'GET', auth = true, raw = null },
  ) {
    const label = name ?? `${method} ${path}`;
    const patienceMs = this.plan.patience_s * 1000;
    let reauthenticated = false;
    let retapped = false;
    for (let retry = 0; ; retry += 1) {
      const response = this.send(method, path, label, body, expected, auth && !raw, raw);
      const durationMs = Math.round(response.timings.duration);
      const status = response.status;
      const kind = classifyResponse({ status, durationMs, expected, patienceMs });
      const entry = {
        method,
        endpoint: label,
        status,
        error_code: status >= 400 ? errorCode(response.body) : null,
        duration_ms: durationMs,
        retry_index: retry,
      };

      if (kind === 'ok' || kind === 'slow' || kind === 'too_slow') {
        this.log({ ...entry, outcome: kind === 'ok' ? 'ok' : 'slow' });
        if (kind === 'too_slow') throw new SessionEnd('impatient', `${label} ${durationMs} ms`);
        if (kind === 'slow') {
          const reason = this.tracker.onSlow();
          if (reason) throw new SessionEnd(reason, label);
        }
        let parsed = null;
        if (
          response.body &&
          (response.headers['Content-Type'] ?? '').includes('application/json')
        ) {
          parsed = JSON.parse(response.body);
        }
        return { status, data: parsed?.data, meta: parsed?.meta };
      }

      if (kind === 'retryable') {
        if (idempotent && retry < this.params.retry.max_retries) {
          this.log({ ...entry, outcome: 'retried' });
          this.tracker.onRetry();
          sleep(backoffMs(this.rng, retry + 1, this.params.retry) / 1000);
          continue;
        }
        if (!idempotent && !retapped && this.rng.chance(this.params.retap_probability)) {
          // Người dùng tự bấm lại một lần sau một khoảng nghỉ ngắn (mục 6.2).
          this.log({ ...entry, outcome: 'retried' });
          retapped = true;
          this.tracker.onRetry();
          sleep(navigationThink(this.rng, this.params.retap_think));
          continue;
        }
        // Hết lượt thử: thao tác thất bại, error_count + 1; chỉ bỏ ngang khi đủ ngưỡng (mục 6.2).
        this.log({ ...entry, outcome: 'failed' });
        const reason = this.tracker.onError();
        if (reason) throw new SessionEnd(reason, `${label} ${status}`);
        return null;
      }

      if (kind === 'auth' && auth && !reauthenticated && this.token) {
        this.log({ ...entry, outcome: 'retried' });
        reauthenticated = true;
        this.reauthenticate();
        continue;
      }

      if (kind === 'server_error') {
        this.log({ ...entry, outcome: 'failed' });
        const reason = this.tracker.onError();
        if (reason) throw new SessionEnd(reason, label);
        if (this.rng.chance(this.params.skip_after_500_probability)) return null;
        throw new SessionEnd('exit', `${label} 500`);
      }

      if (kind === 'not_found') {
        this.log({ ...entry, outcome: 'not_found' });
        return null;
      }

      if (kind === 'auth') {
        this.log({ ...entry, outcome: 'failed' });
        throw new SessionEnd('auth_failed', `${label} ${status}`);
      }
      // 4xx ngoài danh sách mong đợi là lỗi của workload: ghi unexpected_status, bỏ thao tác, về DASH
      // (mục 6.2). Riêng bước đăng nhập đầu phiên thì kết thúc phiên (mục 6.4 điểm 4).
      this.log({ ...entry, outcome: 'unexpected_status' });
      if (!this.token) throw new SessionEnd('unexpected_status', `${label} ${status}`);
      this.returnToDash = true;
      return null;
    }
  }

  login() {
    const result = this.call('POST', `/api/v1/auth/${this.door}/login`, {
      name: `POST /api/v1/auth/${this.door}/login`,
      body: { email: this.email, password: this.password },
      idempotent: true,
      auth: false,
    });
    if (!result) throw new SessionEnd('auth_failed', 'login');
    this.token = result.data.access_token;
    this.refreshToken = result.data.refresh_token;
    this.principalId = result.data.principal.id;
  }

  refresh() {
    const result = this.call('POST', '/api/v1/auth/refresh', {
      body: { refresh_token: this.refreshToken },
      idempotent: true,
      auth: false,
    });
    if (!result) throw new SessionEnd('auth_failed', 'refresh');
    this.token = result.data.access_token;
    this.refreshToken = result.data.refresh_token ?? this.refreshToken;
  }

  /** 401 giữa phiên: refresh một lần, hỏng thì đăng nhập lại một lần, hỏng nữa thì `auth_failed`. */
  reauthenticate() {
    try {
      this.refresh();
      return;
    } catch (error) {
      if (!(error instanceof SessionEnd)) throw error;
    }
    try {
      this.login();
    } catch (error) {
      if (error instanceof SessionEnd) throw new SessionEnd('auth_failed', error.message);
      throw error;
    }
  }

  /** Dòng `session` của `sessions.jsonl` (mục 11.2). */
  finish(endReason, extra = {}) {
    logRecord({
      kind: 'session',
      scenario: this.scenario,
      session_key: this.sessionKey,
      role: this.role,
      profile: this.plan.profile,
      goal: this.plan.goal,
      phase: this.plan.phase,
      account_index: this.plan.account_index ?? null,
      start: new Date(this.startedAt).toISOString(),
      end: new Date().toISOString(),
      actions: this.actions,
      requests: this.requests,
      patience_s: this.plan.patience_s,
      slow_limit: this.plan.slow_limit,
      end_reason: endReason,
      ...this.tracker.counters,
      plan_hash: this.plan.plan_hash ?? null,
      ...extra,
    });
  }
}
