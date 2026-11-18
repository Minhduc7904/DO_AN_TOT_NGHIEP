/**
 * Chuyển log Moodle Unistudium 2022 thành phiên của máy trạng thái học viên.
 *
 * Quy tắc theo workload-design-v1 mục 13.2–13.3 và Phụ lục B (tính lại số liệu mục 2.3):
 * - cắt phiên khi một người dùng nghỉ quá 30 phút;
 * - ánh xạ sự kiện Moodle → trạng thái (mục 13.2); sự kiện phụ gộp vào thao tác trước; sự kiện
 *   ngoài bảng bị bỏ (chủ yếu `access_prevented`);
 * - `course_module_viewed` ngay trước `attempt_started` là `LIST_QUIZ`; ngay sau `attempt_submitted`
 *   (≤ 2 s) là trang kết quả, gộp vào lần nộp;
 * - `course_module_completion_updated` tự sinh ≤ 2 s sau khi xem bài gộp vào lần xem;
 * - `attempt_submitted` ≤ 2 s sau `user_graded` là cùng một lần nộp;
 * - cùng trạng thái lặp lại trong ≤ 1 s là trùng.
 *
 * Nguồn dữ liệu: Milani, Biondi, Franzoni, "Unistudium 2022: students groups logs on moodle",
 * Zenodo, DOI 10.5281/zenodo.13763175, CC BY 4.0 ([L-Unistudium]).
 */

export const GAP_S = 1800;
export const AUX_WINDOW_S = 2;
export const DUPLICATE_WINDOW_S = 1;
export const DAY_S = 86400;

export const STATE_OF_EVENT = Object.freeze({
  course_viewed: 'OPEN_COURSE',
  course_module_instance_list_viewed: 'OPEN_COURSE',
  course_resources_list_viewed: 'OPEN_COURSE',
  recent_activity_viewed: 'OPEN_COURSE',
  grade_report_viewed: 'OPEN_COURSE',
  course_user_report_viewed: 'OPEN_COURSE',
  course_module_viewed: 'READ_LESSON',
  course_module_completion_updated: 'READ_LESSON',
  all_files_downloaded: 'VIEW_MEDIA',
  attempt_started: 'START_QUIZ',
  attempt_updated: 'ANSWER',
  user_graded: 'SUBMIT',
  attempt_submitted: 'SUBMIT',
  user_enrolment_created: 'ENROLL',
  course_searched: 'BROWSE',
  user_profile_viewed: 'PROFILE',
  discussion_viewed: 'NOTIF',
});

export const AUX_EVENTS = Object.freeze(
  new Set([
    'role_assigned',
    'attempt_viewed',
    'attempt_summary_viewed',
    'submission_status_viewed',
    'feedback_viewed',
  ]),
);

const HEADER = ['userId', 'moodleAction', 'course', 'dateTime'];

/** Đọc CSV 4 cột của bộ dữ liệu (không có trường chứa dấu phẩy hay ngoặc kép). */
export function parseMoodleCsv(text) {
  const lines = text.split(/\r?\n/u);
  const header = lines[0].split(',');
  if (header.join(',') !== HEADER.join(',')) {
    throw new Error(`Header CSV lạ: ${lines[0]} (cần ${HEADER.join(',')})`);
  }
  const rows = [];
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === '') continue;
    const [user, action, course, dateTime] = line.split(',');
    const t = Number(dateTime);
    if (!user || !action || !course || !Number.isInteger(t)) {
      throw new Error(`Dòng ${index + 1} không hợp lệ: ${line}`);
    }
    rows.push({ user, action, course, t, row: index - 1 });
  }
  return rows;
}

/** Nhóm theo người dùng, sắp theo thời gian rồi thứ tự dòng (giữ thứ tự gốc khi cùng giây). */
export function groupByUser(rows) {
  const users = new Map();
  const courseOf = new Map();
  for (const row of rows) {
    if (!users.has(row.user)) users.set(row.user, []);
    users.get(row.user).push(row);
    courseOf.set(row.user, row.course);
  }
  for (const events of users.values()) events.sort((a, b) => a.t - b.t || a.row - b.row);
  return { users, courseOf };
}

export function splitSessions(events, gapSeconds = GAP_S) {
  const sessions = [];
  let current = [events[0]];
  for (let index = 1; index < events.length; index += 1) {
    const event = events[index];
    if (event.t - current[current.length - 1].t > gapSeconds) {
      sessions.push(current);
      current = [event];
    } else {
      current.push(event);
    }
  }
  sessions.push(current);
  return sessions;
}

function bump(counts, kind, action) {
  const key = `${kind}:${action}`;
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

/**
 * Biến chuỗi sự kiện của một phiên thành thao tác `{ state, t0, t1, n }` (t1 là sự kiện cuối được gộp).
 * `counts` đếm theo `map|aux|dup|drop:<sự kiện>`.
 */
export function toActions(events, counts = new Map()) {
  const actions = [];
  let lastKept = null; // sự kiện được giữ (không bị bỏ) gần nhất: { t, action }
  const mergeIntoLast = (kind, label, event) => {
    bump(counts, kind, label);
    if (actions.length > 0) {
      actions[actions.length - 1].t1 = event.t;
      actions[actions.length - 1].n += 1;
    }
    lastKept = event;
  };

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const { action, t } = event;
    if (AUX_EVENTS.has(action)) {
      mergeIntoLast('aux', action, event);
      continue;
    }
    if (!(action in STATE_OF_EVENT)) {
      bump(counts, 'drop', action);
      continue;
    }
    let state = STATE_OF_EVENT[action];
    if (action === 'course_module_viewed') {
      if (
        lastKept?.action === 'attempt_submitted' &&
        t - lastKept.t <= AUX_WINDOW_S &&
        actions.length > 0
      ) {
        mergeIntoLast('aux', `${action}@after_submit`, event);
        continue;
      }
      const nextKept = events
        .slice(index + 1)
        .find((next) => next.action in STATE_OF_EVENT || AUX_EVENTS.has(next.action));
      if (nextKept?.action === 'attempt_started') state = 'LIST_QUIZ';
    }
    if (
      action === 'course_module_completion_updated' &&
      lastKept?.action === 'course_module_viewed' &&
      t - lastKept.t <= AUX_WINDOW_S &&
      actions.length > 0
    ) {
      mergeIntoLast('aux', `${action}@auto`, event);
      continue;
    }
    const last = actions[actions.length - 1];
    if (action === 'attempt_submitted' && last?.state === 'SUBMIT' && t - last.t1 <= AUX_WINDOW_S) {
      mergeIntoLast('aux', `${action}@after_graded`, event);
      continue;
    }
    if (last && last.state === state && t - last.t1 <= DUPLICATE_WINDOW_S) {
      mergeIntoLast('dup', action, event);
      continue;
    }
    bump(counts, 'map', action);
    actions.push({ state, t0: t, t1: t, n: 1 });
    lastKept = event;
  }
  return actions;
}

/**
 * Toàn bộ log → phiên. Phiên không còn thao tác nào sau ánh xạ bị loại khỏi danh sách nhưng được đếm.
 * `think_s` của thao tác là khoảng từ sự kiện cuối của thao tác trước tới sự kiện đầu của thao tác này
 * (thao tác đầu: 0). `day_index` đếm từ ngày đầu tiên của log; `start_offset_s` là giây trong ngày
 * (`dateTime mod 86400`, chỉ dùng hình dạng theo giờ vì mốc thời gian đã bị dịch — mục 2.3).
 */
export function buildSessions(rows, { gapSeconds = GAP_S } = {}) {
  const { users, courseOf } = groupByUser(rows);
  const firstDay = Math.floor(rows.reduce((min, row) => Math.min(min, row.t), Infinity) / DAY_S);
  const counts = new Map();
  const sessions = [];
  let rawSessions = 0;
  let emptySessions = 0;
  for (const [user, events] of users) {
    const chunks = splitSessions(events, gapSeconds);
    chunks.forEach((chunk, chunkIndex) => {
      rawSessions += 1;
      const actions = toActions(chunk, counts);
      if (actions.length === 0) {
        emptySessions += 1;
        return;
      }
      const t0 = chunk[0].t;
      sessions.push({
        session_id: `${user}#${chunkIndex}`,
        user_key: user,
        course_key: courseOf.get(user),
        day_index: Math.floor(t0 / DAY_S) - firstDay,
        start_offset_s: t0 % DAY_S,
        raw_events: chunk.length,
        actions: actions.map((item, index) => ({
          state: item.state,
          think_s: index === 0 ? 0 : item.t0 - actions[index - 1].t1,
        })),
        duration_s: actions[actions.length - 1].t1 - actions[0].t0,
      });
    });
  }
  sessions.sort(
    (a, b) =>
      a.day_index - b.day_index ||
      a.start_offset_s - b.start_offset_s ||
      a.session_id.localeCompare(b.session_id),
  );
  return { sessions, counts, rawSessions, emptySessions, firstDay };
}

/** Tổng hợp bộ đếm `kind:event` thành số dòng theo loại và tỉ lệ phủ. */
export function coverage(counts, totalRows) {
  const byKind = { map: 0, aux: 0, dup: 0, drop: 0 };
  const dropped = {};
  for (const [key, value] of counts) {
    const [kind, action] = key.split(':');
    byKind[kind] += value;
    if (kind === 'drop') dropped[action] = value;
  }
  const covered = byKind.map + byKind.aux + byKind.dup;
  return {
    rows: totalRows,
    covered,
    dropped: byKind.drop,
    coverage: totalRows === 0 ? 0 : covered / totalRows,
    by_kind: byKind,
    dropped_events: Object.fromEntries(Object.entries(dropped).sort((a, b) => b[1] - a[1])),
  };
}

/** Chia theo ngày bắt đầu phiên: đoạn xây `[0, buildDays)` và hold-out `[buildDays, ∞)`. */
export function splitBuildHoldout(sessions, buildDays) {
  return {
    build: sessions.filter((session) => session.day_index < buildDays),
    holdout: sessions.filter((session) => session.day_index >= buildDays),
  };
}
