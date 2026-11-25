/**
 * Đưa ba nguồn tải và hold-out Moodle về cùng một dạng quan sát rồi so sánh (ADR-007 mục 2,
 * workload-design-v1 mục 10.4).
 *
 * Dạng quan sát chung: danh sách phiên `{ start_s, actions: [{ state, think_s }], duration_s }`,
 * `start_s` tính theo giây của run (hold-out được nén ×30 như kế hoạch phát lại). Các bước chèn đầu
 * phiên của workload (`LOGIN`, `DASH`, `REGISTER`) và `REFRESH` bị loại vì log Moodle không có
 * chúng; nhờ vậy cả bốn nguồn được đo trên cùng tập trạng thái.
 *
 * Nguồn đo: traffic **thật sự gửi đi** của run — nhật ký `actions.jsonl` (mức 2/2+) hoặc điểm
 * `http_req_duration` của output JSON k6 (mức 1). Log Gateway không mang định danh người dùng nên
 * không cắt phiên được ở phía server.
 */
import {
  binCounts,
  dispersionIndex,
  hurstAggregatedVariance,
  jensenShannon,
  ksTwoSample,
  medianRelativeDiff,
  pearson,
  peakToMean,
} from './lib/compare.mjs';

export const PRELUDE_STATES = new Set(['LOGIN', 'DASH', 'REGISTER', 'REFRESH']);

/** Ngưỡng chốt trước khi chạy (ADR-007 mục 2); không đổi sau khi xem kết quả. */
export const THRESHOLDS = Object.freeze({ jsd: 0.05, ks_d: 0.1, median_rel: 0.1 });

/** Route mẫu của k6 mức 1 → trạng thái của máy trạng thái học viên (workload-design-v1 mục 5.2). */
export const LEVEL1_ROUTE_STATE = Object.freeze({
  'POST /api/v1/auth/student/login': 'LOGIN',
  'GET /api/v1/auth/me': 'LOGIN',
  'POST /api/v1/auth/register': 'REGISTER',
  'POST /api/v1/auth/refresh': 'REFRESH',
  'GET /api/v1/students/me': 'PROFILE',
  'GET /api/v1/courses': 'BROWSE',
  'GET /api/v1/courses/:course_id': 'VIEW_COURSE',
  'POST /api/v1/student/courses/:course_id/enrollments': 'ENROLL',
  'GET /api/v1/courses/:course_id/lessons': 'OPEN_COURSE',
  'GET /api/v1/student/courses/:course_id/progress': 'OPEN_COURSE',
  'PUT /api/v1/student/lessons/:lesson_id/progress': 'READ_LESSON',
  'GET /api/v1/student/lessons/:lesson_id/quizzes': 'LIST_QUIZ',
  'GET /api/v1/student/quizzes/:quiz_id': 'START_QUIZ',
  'POST /api/v1/student/quizzes/:quiz_id/attempts': 'START_QUIZ',
  'PUT /api/v1/student/attempts/:attempt_id/answers': 'ANSWER',
  'POST /api/v1/student/attempts/:attempt_id/submit': 'SUBMIT',
  'GET /api/v1/notifications/me': 'NOTIF',
  'PATCH /api/v1/notifications/:notification_id/read': 'NOTIF',
  'POST /api/v1/notifications/read-all': 'NOTIF',
});

/**
 * Gom request thành thao tác và phiên. `requests` là `{ sessionKey, actionKey, state, startMs, endMs }`;
 * một thao tác = các request cùng `actionKey` (mức 2) hoặc các request liên tiếp cùng trạng thái (mức 1).
 *
 * `timeResolutionMs` > 0 làm tròn xuống mốc thời gian của request theo độ phân giải đó trước khi tính
 * khoảng nghỉ, giống log Moodle ghi thời điểm sự kiện theo giây (tiêu chí v2, realism-v2.mjs). Mặc
 * định 0: giữ mili giây như tiêu chí v1.
 */
export function sessionsFromRequests(requests, runStartMs, { timeResolutionMs = 0 } = {}) {
  const snap = (ms) => (timeResolutionMs > 0 ? Math.floor(ms / timeResolutionMs) * timeResolutionMs : ms);
  const bySession = new Map();
  for (const raw of requests) {
    if (PRELUDE_STATES.has(raw.state)) continue;
    const request = { ...raw, startMs: snap(raw.startMs), endMs: snap(raw.endMs) };
    if (!bySession.has(request.sessionKey)) bySession.set(request.sessionKey, []);
    bySession.get(request.sessionKey).push(request);
  }
  const sessions = [];
  for (const list of bySession.values()) {
    list.sort((a, b) => a.startMs - b.startMs);
    const actions = [];
    for (const request of list) {
      const last = actions[actions.length - 1];
      const sameAction =
        last &&
        (request.actionKey === undefined
          ? last.state === request.state && request.startMs - last.endMs < 1000
          : last.actionKey === request.actionKey);
      if (sameAction) {
        last.endMs = Math.max(last.endMs, request.endMs);
      } else {
        actions.push({ ...request });
      }
    }
    const observed = actions.map((action, index) => ({
      state: action.state,
      think_s: index === 0 ? 0 : (action.startMs - actions[index - 1].endMs) / 1000,
    }));
    sessions.push({
      start_s: (actions[0].startMs - runStartMs) / 1000,
      // Cùng định nghĩa với log Moodle (sự kiện tức thời): thời lượng = tổng khoảng nghỉ giữa các
      // thao tác, không cộng thời gian server xử lý. Nếu cộng, phiên một thao tác (≈ 18%) ra > 0
      // thay vì đúng 0 như hold-out và riêng điều đó đã đẩy KS D thời lượng lên ~0,17.
      duration_s: observed.reduce((sum, action) => sum + action.think_s, 0),
      actions: observed,
    });
  }
  return sessions.sort((a, b) => a.start_s - b.start_s);
}

/** Từ `actions.jsonl` của k6 mức 2/2+ (chỉ vai trò học viên). */
export function sessionsFromActionLog(records, runStartMs, options = {}) {
  const requests = records
    .filter((record) => record.role === 'student' && record.method !== 'WAIT')
    .map((record) => {
      const endMs = Date.parse(record.ts);
      return {
        sessionKey: record.session_key,
        actionKey: `${record.session_key}#${record.action_index}`,
        state: record.state,
        startMs: endMs - (record.duration_ms ?? 0),
        endMs,
      };
    });
  return sessionsFromRequests(requests, runStartMs, options);
}

/**
 * Từ output JSON của k6 (`--out json`) mức 1: điểm `http_req_duration` có tag `journey`, `name` và
 * metadata `vu`, `iter`. Một phiên = một lượt (VU, iteration) của hành trình học viên (W1, W3).
 */
export function sessionsFromK6Points(points, runStartMs, journeys = ['w1', 'w3'], options = {}) {
  const requests = [];
  for (const point of points) {
    if (point.type !== 'Point' || point.metric !== 'http_req_duration') continue;
    const tags = point.data.tags ?? {};
    // k6 ≥ 0.41 ghi `vu`, `iter` vào `metadata` (không còn là tag); giữ đọc tag cho output cũ.
    const meta = point.data.metadata ?? {};
    if (!journeys.includes(tags.journey)) continue;
    const state = LEVEL1_ROUTE_STATE[tags.name];
    if (!state) continue;
    const endMs = Date.parse(point.data.time);
    requests.push({
      sessionKey: `${tags.journey}-${meta.vu ?? tags.vu}-${meta.iter ?? tags.iter}`,
      state,
      startMs: endMs - point.data.value,
      endMs,
    });
  }
  return sessionsFromRequests(requests, runStartMs, options);
}

/** Phiên của file `sessions.v1` (hold-out) → dạng quan sát, nén lịch theo `startOf(session)`. */
export function sessionsFromSessionFile(sessions, startOf, thinkCapS = Infinity) {
  return sessions.map((session) => {
    const actions = session.actions.map((action, index) => ({
      state: action.state,
      think_s: index === 0 ? 0 : Math.min(action.think_s, thinkCapS),
    }));
    return {
      start_s: startOf(session),
      duration_s: actions.reduce((sum, action) => sum + action.think_s, 0),
      actions,
    };
  });
}

/** Đại lượng mô tả của một nguồn. `runSeconds` là độ dài trục thời gian của run. */
export function describe(sessions, runSeconds, binS = 30) {
  const mix = {};
  const thinks = [];
  for (const session of sessions) {
    session.actions.forEach((action, index) => {
      mix[action.state] = (mix[action.state] ?? 0) + 1;
      if (index > 0) thinks.push(action.think_s);
    });
  }
  const starts = sessions.map((session) => session.start_s);
  const perBin = binCounts(starts, runSeconds, binS);
  const perHour = binCounts(starts, runSeconds, runSeconds / 24);
  return {
    sessions: sessions.length,
    actions_per_session: sessions.map((session) => session.actions.length),
    duration_s: sessions.map((session) => session.duration_s),
    think_s: thinks,
    mix,
    starts_per_hour: perHour,
    starts_per_bin: perBin,
    peak_to_mean: peakToMean(perBin),
    dispersion_index: dispersionIndex(perBin),
    hurst: hurstAggregatedVariance(perBin),
  };
}

function verdict(value, limit, absolute = true) {
  if (value === null || value === undefined) return 'n/a';
  return (absolute ? Math.abs(value) : value) < limit ? 'đạt' : 'không đạt';
}

/** So một nguồn với hold-out theo bộ ngưỡng chốt trước. */
export function compare(source, reference) {
  const rows = {
    actions_per_session_ks_d: ksTwoSample(
      source.actions_per_session,
      reference.actions_per_session,
    ),
    actions_per_session_median_rel: medianRelativeDiff(
      source.actions_per_session,
      reference.actions_per_session,
    ),
    duration_ks_d: ksTwoSample(source.duration_s, reference.duration_s),
    duration_median_rel: medianRelativeDiff(source.duration_s, reference.duration_s),
    think_ks_d: ksTwoSample(source.think_s, reference.think_s),
    think_median_rel: medianRelativeDiff(source.think_s, reference.think_s),
    action_mix_jsd: jensenShannon(source.mix, reference.mix),
    hourly_shape_pearson: pearson(source.starts_per_hour, reference.starts_per_hour),
    peak_to_mean: { source: source.peak_to_mean, reference: reference.peak_to_mean },
    dispersion_index: { source: source.dispersion_index, reference: reference.dispersion_index },
    hurst: { source: source.hurst, reference: reference.hurst },
  };
  const checks = {
    actions_per_session_ks_d: verdict(rows.actions_per_session_ks_d, THRESHOLDS.ks_d),
    duration_ks_d: verdict(rows.duration_ks_d, THRESHOLDS.ks_d),
    think_ks_d: verdict(rows.think_ks_d, THRESHOLDS.ks_d),
    actions_per_session_median_rel: verdict(
      rows.actions_per_session_median_rel,
      THRESHOLDS.median_rel,
    ),
    duration_median_rel: verdict(rows.duration_median_rel, THRESHOLDS.median_rel),
    think_median_rel: verdict(rows.think_median_rel, THRESHOLDS.median_rel),
    action_mix_jsd: verdict(rows.action_mix_jsd, THRESHOLDS.jsd),
  };
  return { rows, checks, passed: Object.values(checks).every((value) => value === 'đạt') };
}
