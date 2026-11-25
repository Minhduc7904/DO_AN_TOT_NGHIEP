/**
 * Kế hoạch phát lại (replay plan) cho k6: chọn ngày, chồng phiên, nén lịch bắt đầu phiên.
 *
 * workload-design-v1 mục 7.2, 7.7, 13.5: một ngày (86.400 s) nén còn `runSeconds` (mặc định 2.880 s,
 * hệ số 30); chỉ nén lịch bắt đầu phiên, think time giữ như log và chỉ kẹp trần `thinkCapS`
 * (mặc định 300 s, P12). Chồng `k` ngày khác nhau trong cùng một run để đủ tải; id người dùng đổi
 * theo ngày để hai ngày khác nhau không dùng chung một tài khoản.
 */
import { DAY_S } from './moodle/sessionize.mjs';

export const PLAN_SCHEMA = 'replay-plan.v1';

/**
 * Luật chia ngày của đoạn xây cho dataset (task-04 tuần 15, evaluation-protocol-v1 mục 5.4): mỗi ngày
 * thuộc đúng một split, nên phiên của train, validation, test đến từ các đoạn log tách rời; hold-out
 * (ngày 60–90) không nằm trong đoạn xây nên không bao giờ vào split nào.
 *
 * Phân tầng theo tải: xếp ngày theo số phiên giảm dần (bằng nhau thì ngày nhỏ trước) rồi chia kiểu
 * rắn bò theo `order` (test, validation, train, train, validation, test, …). Số phiên tăng dần theo
 * học kỳ (ngày 0–19 cao nhất 832, ngày 40 là 1.376), nên cắt thành ba khối liền nhau sẽ cho ba split
 * tải rất khác nhau; chia phân tầng giữ phân bố tải ngày giống nhau giữa các split. Ngày đông nhất
 * vào test để E1 (báo động giả khi tải cao hợp lệ) được đo ở tải thật cao nhất, còn train/validation
 * thấy tải thấp hơn một chút: lệch về phía bất lợi cho phương pháp, không phải có lợi.
 */
export const DAY_SPLIT = Object.freeze({
  rule: 'day-split-v1',
  order: Object.freeze(['test', 'validation', 'train']),
});

/** `perDay` là `[{ day, sessions }]`; trả `{ <split>: [ngày tăng dần] }` theo `order`. */
export function assignDaySplits(perDay, order = DAY_SPLIT.order) {
  if (order.length === 0 || new Set(order).size !== order.length) {
    throw new Error('order phải là danh sách split khác nhau, không rỗng');
  }
  const ranked = [...perDay].sort((a, b) => b.sessions - a.sessions || a.day - b.day);
  const splits = Object.fromEntries(order.map((name) => [name, []]));
  ranked.forEach((item, rank) => {
    const round = Math.floor(rank / order.length);
    const position = rank % order.length;
    splits[order[round % 2 === 0 ? position : order.length - 1 - position]].push(item.day);
  });
  for (const days of Object.values(splits)) days.sort((a, b) => a - b);
  return splits;
}

/**
 * Chọn `k` ngày trong đoạn xây.
 * - `normal-mixed`: k ngày có số phiên gần trung vị nhất (một ngày học thường).
 * - `healthy-spike`: ngày cao điểm và k − 1 ngày đông kế tiếp (đỉnh trước hạn quiz).
 * `perDay` là `[{ day, sessions }]`.
 */
export function selectDays(perDay, profile, k) {
  if (!Number.isInteger(k) || k < 1 || k > perDay.length) {
    throw new Error(`k phải là số nguyên trong [1, ${perDay.length}], nhận ${k}`);
  }
  const counts = perDay.map((item) => item.sessions).sort((a, b) => a - b);
  const median =
    counts.length % 2 === 1
      ? counts[(counts.length - 1) / 2]
      : (counts[counts.length / 2 - 1] + counts[counts.length / 2]) / 2;
  let ranked;
  if (profile === 'normal-mixed') {
    ranked = [...perDay].sort(
      (a, b) => Math.abs(a.sessions - median) - Math.abs(b.sessions - median) || a.day - b.day,
    );
  } else if (profile === 'healthy-spike') {
    ranked = [...perDay].sort((a, b) => b.sessions - a.sessions || a.day - b.day);
  } else {
    throw new Error(`Profile lạ: ${profile}`);
  }
  return { median, days: ranked.slice(0, k).map((item) => item.day) };
}

/**
 * Ghép phiên của các ngày đã chọn thành kế hoạch run. Trả `{ plan, clipped }`; `clipped` là số khoảng
 * nghỉ bị kẹp trần.
 */
export function buildPlan(
  sessions,
  {
    planId,
    source,
    profile,
    days = null,
    k = 1,
    runSeconds = 2880,
    thinkCapS = 300,
    prelude,
    meta = {},
  },
) {
  const compression = DAY_S / runSeconds;
  const selected = days === null ? sessions : sessions.filter((s) => days.includes(s.day_index));
  let clipped = 0;
  let thinkCount = 0;
  const planned = selected.map((session) => {
    const actions = session.actions.map((action, index) => {
      if (index > 0) thinkCount += 1;
      if (action.think_s > thinkCapS) {
        clipped += 1;
        return { state: action.state, think_s: thinkCapS };
      }
      return { state: action.state, think_s: action.think_s };
    });
    const entry = {
      session_id:
        days === null ? session.session_id : `${session.session_id}@d${session.day_index}`,
      user_key: days === null ? session.user_key : `${session.user_key}@d${session.day_index}`,
      course_key: session.course_key,
      start_s: Math.round((session.start_offset_s / compression) * 1000) / 1000,
      actions,
    };
    for (const field of ['profile', 'goal', 'prelude', 'max_actions', 'time_available_s']) {
      if (session[field] !== undefined) entry[field] = session[field];
    }
    return entry;
  });
  planned.sort((a, b) => a.start_s - b.start_s || a.session_id.localeCompare(b.session_id));
  const actionCount = planned.reduce((sum, session) => sum + session.actions.length, 0);
  return {
    clipped,
    plan: {
      schema: PLAN_SCHEMA,
      plan_id: planId,
      source,
      profile,
      days,
      k,
      run_seconds: runSeconds,
      compression,
      think_cap_s: thinkCapS,
      think_clipped: clipped,
      think_clipped_share: thinkCount === 0 ? 0 : clipped / thinkCount,
      prelude,
      ...meta,
      summary: { sessions: planned.length, actions: actionCount },
      sessions: planned,
    },
  };
}
