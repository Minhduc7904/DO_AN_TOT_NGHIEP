import crypto from 'k6/crypto';
import { SharedArray } from 'k6/data';
import exec from 'k6/execution';

import { api, login } from '../lib/api.js';
import { config, seedStudentEmail } from '../lib/config.js';
import { buildArrivalStages, studentSessionPlan, windowSessions } from '../lib/reaction.js';
import { createRng, hash32 } from '../lib/rng.js';
import { playStudentSession } from './student-replay.js';

/**
 * Phần học viên dùng chung cho `scenarios/student-replay.js` (chỉ học viên) và `scenarios/profile.js`
 * (profile healthy đầy đủ): nạp kế hoạch phát lại, lịch arrival-rate, chạy một phiên.
 *
 * Biến môi trường: PLAN (đường dẫn trong `aiops-platform/load/`; mặc định theo PROFILE), WORKLOAD_SEED,
 * WINDOW_START_S và WINDOW_S (chạy thử một đoạn của ngày nén), STUDENT_PRE_VUS, STUDENT_MAX_VUS.
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

export function studentScenario() {
  return {
    executor: 'ramping-arrival-rate',
    exec: 'students',
    startRate: arrival.startRate,
    timeUnit: arrival.timeUnit,
    stages: arrival.stages,
    preAllocatedVUs: Number(__ENV.STUDENT_PRE_VUS || 120),
    maxVUs: Number(__ENV.STUDENT_MAX_VUS || 300),
    gracefulStop: `${GRACE_S}s`,
  };
}

/** Ánh xạ khóa Moodle A–D → bốn khóa học seed đầu tiên của danh mục (sắp theo id, cố định). */
export function courseMapSetup() {
  const probe = login('setup', 'student', seedStudentEmail(1), config.seedPassword);
  const catalogue = api('GET', '/api/v1/courses?page=1&page_size=20', {
    journey: 'setup',
    name: 'GET /api/v1/courses',
    token: probe.token,
  }).data;
  const ids = catalogue.map((course) => course.id).sort();
  if (ids.length < 4) throw new Error(`Cần ít nhất 4 khóa học đã xuất bản, có ${ids.length}`);
  return Object.fromEntries(['A', 'B', 'C', 'D'].map((key, index) => [key, ids[index]]));
}

export function runStudentIteration(setupData) {
  const index = exec.scenario.iterationInTest;
  if (index >= sessions.length) return;
  const session = sessions[index];
  const plan = studentSessionPlan({
    session,
    phase: PHASE,
    params: reactionParams,
    rng: createRng(hash32(WORKLOAD_SEED, 'students-plan', index)),
    seed: WORKLOAD_SEED,
    accounts: config.seedStudents,
  });
  playStudentSession({
    session,
    prelude: session.prelude ?? meta.prelude,
    plan,
    params: reactionParams,
    setupData,
    rng: createRng(hash32(WORKLOAD_SEED, 'students-behavior', index)),
    sessionKey: `students-${index}`,
    deadlineMs: exec.scenario.startTime + (RUN_SECONDS + GRACE_S - 5) * 1000,
  });
}
