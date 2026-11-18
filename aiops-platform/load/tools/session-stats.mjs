/**
 * Mô tả một tập phiên (định dạng `sessions.v1`): độ dài, thời lượng, think time, tỉ lệ thao tác,
 * đường cong theo giờ và theo ngày, ma trận chuyển, bảng phân vị think time theo trạng thái.
 * Dùng cho báo cáo chuyển đổi (task-01) và làm tham số cho bộ sinh Markov học từ log (mục 13.8).
 */
import { DAY_S } from './moodle/sessionize.mjs';
import {
  lognormalFit,
  quantileSorted,
  quantileTable,
  shares,
  sortedNumbers,
  summarize,
  transitionMatrix,
} from './lib/stats.mjs';

export function hourlyStarts(sessions) {
  const counts = Array.from({ length: 24 }, () => 0);
  for (const session of sessions) counts[Math.floor((session.start_offset_s % DAY_S) / 3600)] += 1;
  return counts;
}

export function normalizeToPeak(values) {
  const peak = Math.max(...values);
  return values.map((value) => (peak === 0 ? 0 : value / peak));
}

/** Số phiên theo `day_index`, kể cả ngày không có phiên nào trong khoảng [min, max]. */
export function sessionsPerDay(sessions) {
  const counts = new Map();
  let min = Infinity;
  let max = -Infinity;
  for (const session of sessions) {
    counts.set(session.day_index, (counts.get(session.day_index) ?? 0) + 1);
    min = Math.min(min, session.day_index);
    max = Math.max(max, session.day_index);
  }
  const days = [];
  for (let day = min; day <= max; day += 1) days.push({ day, sessions: counts.get(day) ?? 0 });
  return days;
}

export function thinkTimes(sessions) {
  const all = [];
  const byState = {};
  for (const session of sessions) {
    session.actions.forEach((action, index) => {
      if (index === 0) return;
      all.push(action.think_s);
      (byState[action.state] ??= []).push(action.think_s);
    });
  }
  return { all, byState };
}

export function describeSessions(sessions) {
  const { all, byState } = thinkTimes(sessions);
  const perDay = sessionsPerDay(sessions);
  const daySorted = sortedNumbers(perDay.map((day) => day.sessions));
  const actions = sessions.flatMap((session) => session.actions);
  const starts = hourlyStarts(sessions);
  return {
    sessions: sessions.length,
    actions_per_session: summarize(sessions.map((session) => session.actions.length)),
    session_duration_s: summarize(sessions.map((session) => session.duration_s)),
    think_s: summarize(all),
    think_share_gt_300s: all.filter((value) => value > 300).length / Math.max(all.length, 1),
    think_lognormal_fit_ge_1s: all.length > 1 ? lognormalFit(all) : null,
    action_mix: shares(actions, (action) => action.state),
    hourly_starts: starts,
    hourly_shape: normalizeToPeak(starts),
    days: perDay.length,
    sessions_per_day: {
      mean: perDay.reduce((sum, day) => sum + day.sessions, 0) / Math.max(perDay.length, 1),
      p10: quantileSorted(daySorted, 0.1),
      p50: quantileSorted(daySorted, 0.5),
      p90: quantileSorted(daySorted, 0.9),
      max: daySorted[daySorted.length - 1],
    },
    per_day: perDay,
    transitions: transitionMatrix(sessions),
    think_quantiles_by_state: Object.fromEntries(
      Object.entries(byState)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([state, values]) => [state, quantileTable(values)]),
    ),
  };
}
