#!/usr/bin/env node
/**
 * Bật/tắt fault theo lịch của fault manifest, ghi nhật ký JSON có thời điểm UTC thật của từng lệnh.
 *
 *   node aiops-platform/faults/fault-schedule.mjs validate [--manifest <file>]
 *   node aiops-platform/faults/fault-schedule.mjs plan --case C2 [--start-s N] [--duration-s N]
 *        [--align-peak <replay-plan.json>]
 *   node aiops-platform/faults/fault-schedule.mjs run --case C2 [--run-start <ISO>|now] [--log <file>]
 *        [--start-s N] [--duration-s N] [--align-peak <replay-plan.json>] [--skip-precheck]
 *        [--allow-short]   (bỏ kiểm warm-up/recovery, chỉ cho chạy thử; lịch ghi timeline_check)
 *
 * Nhật ký (một dòng JSON mỗi sự kiện) là dấu vết thời điểm fault thật để dựng `RunGroundTruth`
 * (telemetry-and-ground-truth-schema-v1 mục 8): `fault.scheduled`, `fault.precheck`, `fault.activate`,
 * `fault.deactivate`, `fault.aborted`. Khi bị ngắt (SIGINT/SIGTERM) luôn chạy bước gỡ fault trước khi thoát.
 */
import { execFile } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs, promisify } from 'node:util';

import { execute, planCommand } from './fault-control.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_MANIFEST = join(HERE, 'manifests/fault-manifest-v1.json');
const REQUIRED_CASE_FIELDS = [
  'case_id',
  'fault_type',
  'root_cause_service',
  'root_cause_component',
  'injector',
  'activate',
  'deactivate',
  'fault_duration_s',
];

/** Kiểm manifest: trường bắt buộc, lệnh bật/tắt hợp lệ với `fault-control`, lịch nằm trong run. */
export function validateManifest(manifest) {
  const errors = [];
  if (manifest.schema !== 'fault-manifest.v1') errors.push(`schema lạ: ${manifest.schema}`);
  const { timeline } = manifest;
  if (!timeline || !(timeline.run_seconds > 0)) errors.push('thiếu timeline.run_seconds');
  const seen = new Set();
  for (const item of manifest.cases ?? []) {
    const label = item.case_id ?? '(không tên)';
    for (const field of REQUIRED_CASE_FIELDS) {
      if (item[field] === undefined) errors.push(`${label}: thiếu ${field}`);
    }
    if (seen.has(item.case_id)) errors.push(`${label}: trùng case_id`);
    seen.add(item.case_id);
    for (const phase of ['activate', 'deactivate']) {
      if (!Array.isArray(item[phase]) || item[phase].length === 0) {
        errors.push(`${label}: ${phase} rỗng`);
        continue;
      }
      for (const argv of item[phase]) {
        try {
          planCommand(argv);
        } catch (error) {
          errors.push(`${label}: ${phase} ${JSON.stringify(argv)}: ${error.message}`);
        }
      }
    }
    if (timeline && item.fault_duration_s > 0) {
      const end = timeline.default_start_s + item.fault_duration_s;
      if (timeline.default_start_s < timeline.warmup_s)
        errors.push(`${label}: bắt đầu trong warm-up`);
      if (end + timeline.min_recovery_s > timeline.run_seconds) {
        errors.push(
          `${label}: không đủ ${timeline.min_recovery_s} s recovery trước khi run kết thúc`,
        );
      }
    }
  }
  if (seen.size === 0) errors.push('manifest không có case nào');
  return errors;
}

/**
 * Cửa sổ fault có nhiều lần bắt đầu phiên nhất (đỉnh tải) trong kế hoạch phát lại, giới hạn trong
 * `[warmup_s, run_seconds − min_recovery_s − duration]`, quét theo bước `stepS`.
 */
export function peakAlignedStart(sessionStarts, timeline, durationS, stepS = 30) {
  const sorted = [...sessionStarts].sort((a, b) => a - b);
  const latest = timeline.run_seconds - timeline.min_recovery_s - durationS;
  if (latest < timeline.warmup_s) throw new Error('Run quá ngắn cho thời lượng fault này');
  let best = { start: timeline.warmup_s, count: -1 };
  for (let start = timeline.warmup_s; start <= latest; start += stepS) {
    let count = 0;
    for (const value of sorted) {
      if (value >= start + durationS) break;
      if (value >= start) count += 1;
    }
    if (count > best.count) best = { start, count };
  }
  return best;
}

/** Lịch của một case: thời điểm bật/tắt tính theo giây từ đầu run. */
export function buildSchedule(
  manifest,
  caseId,
  { startS, durationS, peakStarts, allowShort = false } = {},
) {
  const item = manifest.cases.find((entry) => entry.case_id === caseId);
  if (!item) throw new Error(`Không có case ${caseId} trong manifest`);
  const duration = durationS ?? item.fault_duration_s;
  let start = startS ?? manifest.timeline.default_start_s;
  let alignment = null;
  if (peakStarts) {
    const best = peakAlignedStart(peakStarts, manifest.timeline, duration);
    start = best.start;
    alignment = { mode: 'load_peak', session_starts_in_window: best.count };
  }
  const end = start + duration;
  if (start < 0 || end > manifest.timeline.run_seconds) {
    throw new Error(`Cửa sổ fault [${start}, ${end}] s nằm ngoài run`);
  }
  const { warmup_s: warmup, min_recovery_s: recovery, run_seconds: runSeconds } = manifest.timeline;
  const tight = start < warmup || end + recovery > runSeconds;
  if (tight && !allowShort) {
    throw new Error(
      `Cửa sổ fault [${start}, ${end}] s vi phạm warm-up ${warmup} s hoặc recovery ${recovery} s ` +
        '(dùng --allow-short cho chạy thử)',
    );
  }
  return {
    case_id: item.case_id,
    manifest_version: manifest.manifest_version,
    fault_type: item.fault_type,
    root_cause_service: item.root_cause_service,
    root_cause_component: item.root_cause_component,
    activate_at_s: start,
    deactivate_at_s: end,
    fault_duration_s: duration,
    alignment,
    timeline_check: tight ? 'skipped_allow_short' : 'ok',
    activate: item.activate,
    deactivate: item.deactivate,
    requires: item.requires ?? [],
  };
}

const execFileAsync = promisify(execFile);

/** Kiểm điều kiện tiên quyết (biến môi trường của container) trước khi bật fault. */
export async function precheck(schedule, { execImpl = execFileAsync, env = process.env } = {}) {
  const results = [];
  for (const requirement of schedule.requires) {
    if (!requirement.container_env) continue;
    const container = `${env.COMPOSE_PROJECT_NAME ?? 'aiops-lms'}-${requirement.container_env}-1`;
    const { stdout } = await execImpl('docker', [
      'inspect',
      '--format',
      '{{range .Config.Env}}{{println .}}{{end}}',
      container,
    ]);
    const line = stdout.split('\n').find((entry) => entry.startsWith(`${requirement.name}=`));
    const actual = line === undefined ? null : line.slice(requirement.name.length + 1);
    results.push({ container, name: requirement.name, expected: requirement.value, actual });
  }
  return { ok: results.every((item) => item.actual === item.expected), results };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));

async function runSteps(phase, steps, context) {
  const outcomes = [];
  for (const argv of steps) {
    const plan = planCommand(argv);
    try {
      const result = await context.executeImpl(plan, context.executeOptions);
      outcomes.push({ argv, ok: true, result });
    } catch (error) {
      outcomes.push({
        argv,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return { phase, ok: outcomes.every((item) => item.ok), steps: outcomes };
}

/**
 * Chạy lịch: chờ tới `runStart + activate_at_s`, bật, chờ tới `runStart + deactivate_at_s`, gỡ.
 * `log(record)` nhận từng sự kiện. `signal` (AbortSignal) ngắt sớm: luôn gỡ fault nếu đã bật.
 */
export async function runSchedule(
  schedule,
  {
    runStartMs,
    log,
    signal,
    now = () => Date.now(),
    wait = sleep,
    executeImpl = execute,
    executeOptions = {},
  },
) {
  const context = { executeImpl, executeOptions };
  const stamp = (event, extra) => log({ ts: new Date(now()).toISOString(), event, ...extra });
  const plannedActivate = runStartMs + schedule.activate_at_s * 1000;
  const plannedDeactivate = runStartMs + schedule.deactivate_at_s * 1000;
  stamp('fault.scheduled', {
    ...schedule,
    run_start: new Date(runStartMs).toISOString(),
    planned_activate: new Date(plannedActivate).toISOString(),
    planned_deactivate: new Date(plannedDeactivate).toISOString(),
  });

  const waitUntil = async (target) => {
    while (!signal?.aborted && now() < target) await wait(Math.min(target - now(), 1000));
  };

  await waitUntil(plannedActivate);
  if (signal?.aborted) {
    stamp('fault.aborted', { case_id: schedule.case_id, activated: false });
    return { activated: false, aborted: true };
  }
  const activateStarted = now();
  const activation = await runSteps('activate', schedule.activate, context);
  stamp('fault.activate', {
    case_id: schedule.case_id,
    drift_ms: activateStarted - plannedActivate,
    ...activation,
  });
  if (!activation.ok) {
    // Bật lỗi một phần: gỡ ngay để không để stack ở trạng thái nửa vời.
    const rollback = await runSteps('deactivate', schedule.deactivate, context);
    stamp('fault.deactivate', {
      case_id: schedule.case_id,
      reason: 'activate_failed',
      ...rollback,
    });
    return { activated: false, aborted: false, ok: false };
  }

  await waitUntil(plannedDeactivate);
  const deactivateStarted = now();
  const deactivation = await runSteps('deactivate', schedule.deactivate, context);
  stamp('fault.deactivate', {
    case_id: schedule.case_id,
    reason: signal?.aborted ? 'aborted' : 'scheduled',
    drift_ms: signal?.aborted ? null : deactivateStarted - plannedDeactivate,
    ...deactivation,
  });
  return { activated: true, aborted: Boolean(signal?.aborted), ok: deactivation.ok };
}

function readPeakStarts(path) {
  if (!path) return undefined;
  const plan = JSON.parse(readFileSync(path, 'utf8'));
  return plan.sessions.map((session) => session.start_s);
}

async function main(argv) {
  const [command, ...rest] = argv;
  const { values } = parseArgs({
    args: rest,
    options: {
      manifest: { type: 'string', default: DEFAULT_MANIFEST },
      case: { type: 'string' },
      'start-s': { type: 'string' },
      'duration-s': { type: 'string' },
      'align-peak': { type: 'string' },
      'run-start': { type: 'string', default: 'now' },
      log: { type: 'string' },
      'skip-precheck': { type: 'boolean', default: false },
      'allow-short': { type: 'boolean', default: false },
    },
  });
  const manifest = JSON.parse(readFileSync(values.manifest, 'utf8'));
  const errors = validateManifest(manifest);
  if (command === 'validate') {
    console.log(JSON.stringify({ ok: errors.length === 0, errors }));
    return errors.length === 0 ? 0 : 1;
  }
  if (errors.length > 0) throw new Error(`Manifest không hợp lệ: ${errors.join('; ')}`);
  const optionalNumber = (raw) => (raw === undefined ? undefined : Number(raw));
  const schedule = buildSchedule(manifest, values.case, {
    startS: optionalNumber(values['start-s']),
    allowShort: values['allow-short'],
    durationS: optionalNumber(values['duration-s']),
    peakStarts: readPeakStarts(values['align-peak']),
  });
  if (command === 'plan') {
    console.log(JSON.stringify(schedule, null, 2));
    return 0;
  }
  if (command !== 'run') throw new Error('Lệnh: validate | plan | run');

  const log = (record) => {
    const line = JSON.stringify(record);
    console.log(line);
    if (values.log) appendFileSync(values.log, `${line}\n`);
  };
  if (!values['skip-precheck']) {
    let check;
    try {
      check = await precheck(schedule);
    } catch (error) {
      // Ví dụ sai tên container: vẫn ghi một dòng JSON để nhật ký run biết vì sao không bật fault.
      check = {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        results: [],
      };
    }
    log({
      ts: new Date().toISOString(),
      event: 'fault.precheck',
      case_id: schedule.case_id,
      ...check,
    });
    if (!check.ok) return 1;
  }
  const controller = new AbortController();
  // Dùng `on` (không phải `once`): tín hiệu lần hai trong lúc đang gỡ fault không được giết process
  // trước khi gỡ xong; chỉ ghi nhận và tiếp tục gỡ.
  for (const name of ['SIGINT', 'SIGTERM']) process.on(name, () => controller.abort());
  const runStartMs = values['run-start'] === 'now' ? Date.now() : Date.parse(values['run-start']);
  if (Number.isNaN(runStartMs)) throw new Error(`--run-start không hợp lệ: ${values['run-start']}`);
  const result = await runSchedule(schedule, { runStartMs, log, signal: controller.signal });
  if (result.aborted) return 130;
  return result.ok === false ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = await main(process.argv.slice(2));
}
