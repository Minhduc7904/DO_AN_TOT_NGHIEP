import crypto from 'k6/crypto';
import { SharedArray } from 'k6/data';
import exec from 'k6/execution';

import { catalogueIds, login } from '../lib/api.js';
import { config, seedStudentEmail } from '../lib/config.js';
import {
  accountAssignment,
  buildArrivalStages,
  peakConcurrency,
  seedCourseMap,
  sessionSpan,
  studentSessionPlan,
  vuSizing,
  windowSessions,
} from '../lib/reaction.js';
import { createRng, hash32 } from '../lib/rng.js';
import { playStudentSession } from './student-replay.js';

/**
 * Phần học viên dùng chung cho `scenarios/student-replay.js` (chỉ học viên) và `scenarios/profile.js`
 * (profile healthy đầy đủ): nạp kế hoạch phát lại, lịch arrival-rate, chạy một phiên.
 *
 * Biến môi trường: PLAN (đường dẫn trong `aiops-platform/load/`; mặc định theo PROFILE), WORKLOAD_SEED,
 * WINDOW_START_S và WINDOW_S (chạy thử một đoạn của ngày nén), STUDENT_PRE_VUS, STUDENT_MAX_VUS (mặc
 * định tính từ đỉnh đồng thời của kế hoạch, xem `peakConcurrency`).
 */

export const PLAN_PATH =
  __ENV.PLAN || `data/plans/moodle-${__ENV.PROFILE || 'normal-mixed'}-k4-v1.json`;
export const WINDOW_START_S = Number(__ENV.WINDOW_START_S || 0);
export const WORKLOAD_SEED = Number(__ENV.WORKLOAD_SEED || config.seed);
export const GRACE_S = 60;

export const meta = new SharedArray('plan-meta', () => {
  const text = open(`../${PLAN_PATH}`);
  const plan = JSON.parse(text);
  delete plan.sessions;
  plan.plan_sha256 = crypto.sha256(text, 'hex');
  return [plan];
})[0];
export const RUN_SECONDS = __ENV.WINDOW_S
  ? Number(__ENV.WINDOW_S)
  : meta.run_seconds - WINDOW_START_S;
export const sessions = new SharedArray('plan-sessions', () =>
  windowSessions(JSON.parse(open(`../${PLAN_PATH}`)).sessions, WINDOW_START_S, RUN_SECONDS),
);
export const reactionParams = JSON.parse(open('../params/reaction-v1.json'));
export const PHASE = meta.phase ?? (meta.profile === 'healthy-spike' ? 'deadline' : 'normal');

function startTimes() {
  const starts = [];
  for (let index = 0; index < sessions.length; index += 1) starts.push(sessions[index].start_s);
  return starts;
}

export const arrival = buildArrivalStages(startTimes(), RUN_SECONDS);

export const plannedPeakConcurrency = peakConcurrency(sessions, {
  preludeActions: (meta.prelude ?? []).length,
});
const sizing = vuSizing(plannedPeakConcurrency);

/**
 * Tài khoản seed của từng phiên trong kế hoạch (mục 13.4, `accountAssignment`): không có hai phiên chạy
 * cùng lúc trên một tài khoản. Tính một lần trong `SharedArray` thay vì ở init của từng VU.
 */
const assignment = new SharedArray('plan-accounts', () => {
  const keys = [];
  const spans = [];
  const options = { preludeActions: (meta.prelude ?? []).length };
  for (let index = 0; index < sessions.length; index += 1) {
    keys.push(sessions[index].user_key);
    spans.push(sessionSpan(sessions[index], options));
  }
  return [accountAssignment(WORKLOAD_SEED, keys, config.seedStudents, { spans })];
})[0];

/** Trường tóm tắt phần học viên dùng chung cho `k6-summary.json` của hai scenario. */
export function studentSummary(droppedIterations, vusMax) {
  return {
    planned_peak_concurrency: plannedPeakConcurrency,
    student_pre_vus: studentScenario().preAllocatedVUs,
    vus_max: vusMax,
    dropped_iterations: droppedIterations,
    // Iteration bị bỏ làm lệch ánh xạ iteration → phiên: run như vậy không tái lập được, không dùng
    // làm dữ liệu thí nghiệm (README mục mức 2+).
    plan_reproducible: droppedIterations === 0,
    distinct_users: assignment.users,
    // Người ảo: phiên chồng nhau của cùng người dùng Moodle tách sang người ảo khác (`accountAssignment`).
    virtual_people: assignment.people,
    accounts_reused: Math.max(0, assignment.people - config.seedStudents),
    // Người ảo buộc phải chung tài khoản với người ảo khác đang chạy cùng lúc (phải là 0).
    accounts_overlapping: assignment.overlapping,
  };
}

export function studentScenario() {
  return {
    executor: 'ramping-arrival-rate',
    exec: 'students',
    startRate: arrival.startRate,
    timeUnit: arrival.timeUnit,
    stages: arrival.stages,
    preAllocatedVUs: Number(__ENV.STUDENT_PRE_VUS || sizing.preAllocated),
    maxVUs: Number(__ENV.STUDENT_MAX_VUS || sizing.max),
    gracefulStop: `${GRACE_S}s`,
  };
}

/** Ánh xạ khóa Moodle A–D → bốn khóa học seed (`seedCourseMap`), đọc toàn bộ danh mục. */
export function courseMapSetup() {
  const probe = login('setup', 'student', seedStudentEmail(1), config.seedPassword);
  return seedCourseMap(catalogueIds(probe.token));
}

/**
 * Phát một phiên của kế hoạch với tài khoản đã gán. `stream` đặt tên bộ sinh số và khóa phiên
 * (`students` cho kế hoạch phát lại, giữ nguyên để run cũ tái lập được; `knee` cho run tìm điểm gãy).
 */
export function playPlanSession(
  setupData,
  { session, index, accountIndex, deadlineMs, stream = 'students' },
) {
  const plan = studentSessionPlan({
    session,
    phase: PHASE,
    params: reactionParams,
    rng: createRng(hash32(WORKLOAD_SEED, `${stream}-plan`, index)),
    seed: WORKLOAD_SEED,
    accounts: config.seedStudents,
    accountIndex,
  });
  playStudentSession({
    session,
    prelude: session.prelude ?? meta.prelude,
    plan,
    params: reactionParams,
    setupData,
    rng: createRng(hash32(WORKLOAD_SEED, `${stream}-behavior`, index)),
    sessionKey: `${stream}-${index}`,
    deadlineMs,
  });
}

export function runStudentIteration(setupData) {
  const index = exec.scenario.iterationInTest;
  if (index >= sessions.length) return;
  playPlanSession(setupData, {
    session: sessions[index],
    index,
    accountIndex: assignment.bySession[index],
    deadlineMs: exec.scenario.startTime + (RUN_SECONDS + GRACE_S - 5) * 1000,
  });
}
