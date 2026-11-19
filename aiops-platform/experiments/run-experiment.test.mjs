import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { readLedger } from './lib/ledger.mjs';
import { normalizeSpec, validateSpec } from './lib/spec.mjs';
import { defaultPaths, executionGate, parseWorkloadStart, runExperiment } from './run-experiment.mjs';

const T0 = new Date('2026-11-19T08:00:00.000Z');

function spec(overrides = {}) {
  return {
    schema: 'run-spec.v1',
    run_id: 'pilot-c2-test-001',
    split: 'pilot',
    repeat_index: 0,
    workload: { profile: 'normal-mixed', seed: 7 },
    fault: { case: 'C2' },
    ...overrides,
  };
}

/**
 * Ngữ cảnh giả: ghi lại mọi lời gọi ra ngoài; process k6/export/quality/ground-truth được mô phỏng
 * bằng cách ghi các file mà công cụ thật sẽ ghi. Không giả logic của runner.
 */
function fakeContext({ k6Exit = 0, k6WritesPhase = true, faultExit = 0, ttl = 60, onK6 } = {}) {
  const calls = [];
  const state = { stopped: false, faultKilled: null };
  let clock = T0.getTime();
  const resolved = (code) => Promise.resolve({ code, stdout: '' });
  return {
    calls,
    state,
    pid: 4242,
    now: () => new Date((clock += 1000)),
    isAlive: () => false,
    memAvailableMb: () => 8000,
    diskFreeMb: () => 50_000,
    runningK6: async () => [],
    stopK6: async () => {
      state.stopped = true;
    },
    gitProvenance: async () => ({ commit: 'abc123', branch: 'test', dirty: false, diff_sha256: null }),
    inspectIdentity: async () => ({ ttl, paused: false }),
    verifyStack: async () => ({ sha256: 'f'.repeat(64), health: [], fingerprint: {} }),
    exec: (name, cmd, args, opts) => {
      calls.push({ kind: 'exec', name, cmd, args, env: opts.env ?? {} });
      if (name === 'export') {
        const out = args[args.indexOf('--out') + 1];
        const runId = JSON.parse(readFileSync(args[args.indexOf('--k6-summary') + 1], 'utf8')).run_id;
        mkdirSync(join(out, runId), { recursive: true });
        writeFileSync(join(out, runId, 'manifest.json'), '{}');
      }
      if (name === 'quality') writeFileSync(join(args[3], 'quality-report.json'), '{"overall_status":"pass"}');
      if (name === 'ground-truth') {
        writeFileSync(args[args.indexOf('--out') + 1], '{"run_status":"valid","verification_result":"passed"}');
      }
      return resolved(0);
    },
    start: (name, cmd, args, opts) => {
      calls.push({ kind: 'start', name, cmd, args, env: opts.env ?? {} });
      if (name === 'k6') {
        const dir = join(opts.env.RESULTS_HOST_DIR, opts.env.RUN_ID);
        mkdirSync(dir, { recursive: true });
        if (k6WritesPhase) {
          const msg = JSON.stringify({ kind: 'phase', phase: 'workload_start', ts: '2026-11-19T08:02:00.000Z' });
          writeFileSync(join(dir, 'k6-log.jsonl'), `${JSON.stringify({ level: 'info', msg })}\n`);
        }
        let finish;
        const promise = new Promise((resolvePromise) => (finish = resolvePromise));
        const complete = () => {
          if (k6Exit === 0 || k6Exit === 99) {
            writeFileSync(
              join(dir, 'k6-summary.json'),
              JSON.stringify({
                run_id: opts.env.RUN_ID,
                workload_profile: 'normal-mixed@v1',
                workload_seed: 7,
                workload_parameters: { plan_sha256: 'p'.repeat(64) },
                workload_start: '2026-11-19T08:02:00.000Z',
                workload_end: '2026-11-19T08:50:00.000Z',
                dropped_iterations: 0,
              }),
            );
          }
          finish({ code: k6Exit });
        };
        if (onK6) onK6(complete);
        else setImmediate(complete);
        return { promise, kill: () => {} };
      }
      let finish;
      const promise = new Promise((resolvePromise) => (finish = resolvePromise));
      setImmediate(() => finish({ code: faultExit }));
      return {
        promise,
        kill: (signal) => {
          state.faultKilled = signal;
          finish({ code: 130 });
        },
      };
    },
    waitForLine: async (file, parse) => {
      if (!existsSync(file)) return null;
      for (const line of readFileSync(file, 'utf8').split('\n')) {
        const value = parse(line);
        if (value) return value;
      }
      return null;
    },
    raceTimeout: async (promise) => {
      await promise;
      return true;
    },
  };
}

function options(dir, extra = {}) {
  const paths = { ...defaultPaths('/repo'), runsDir: join(dir, 'runs'), ledger: join(dir, 'ledger.jsonl') };
  return {
    paths,
    project: 'aiops-lms',
    composeEnvFile: '/repo/docker-compose/.env',
    confirmReset: 'aiops-lms',
    noReset: false,
    minAvailableMb: 4000,
    minDiskMb: 5000,
    setupTimeoutMs: 1000,
    faultGraceMs: 1000,
    ...extra,
  };
}

test('spec: khoảng seed theo split, fault validation cần repeat_index ≥ 1, run_id sinh tự động', () => {
  assert.deepEqual(validateSpec(spec()), []);
  assert.match(validateSpec(spec({ split: 'train' })).join(), /ngoài khoảng 1000–1999/u);
  assert.match(
    validateSpec(spec({ split: 'validation', workload: { profile: 'normal-mixed', seed: 2001 } })).join(),
    /repeat_index ≥ 1/u,
  );
  assert.match(validateSpec(spec({ fault: { case: 'C9' } })).join(), /fault.case lạ/u);
  assert.match(validateSpec(spec({ fault: { case: 'C2', align_peak: true, start_s: 900 } })).join(), /loại trừ/u);
  const normalized = normalizeSpec({ ...spec(), run_id: undefined }, T0);
  assert.equal(normalized.run_id, 'pilot-c2-normal-mixed-s7-20261119t080000z');
  assert.equal(normalized.environment.service_token_ttl_s, 60);
});

test('mốc workload_start đọc từ dòng phase của log k6', () => {
  const msg = JSON.stringify({ kind: 'phase', phase: 'workload_start', ts: '2026-11-19T08:02:00.000Z' });
  assert.equal(parseWorkloadStart(JSON.stringify({ msg })), '2026-11-19T08:02:00.000Z');
  assert.equal(parseWorkloadStart(JSON.stringify({ msg: '{"kind":"action"}' })), null);
  assert.equal(parseWorkloadStart('không phải json'), null);
});

test('execution gate: k6 thoát 99 (threshold) vẫn đạt; dropped > 0 hoặc fault không gỡ được thì không', () => {
  const base = {
    resetResult: 'succeeded',
    envOk: true,
    k6Exit: 99,
    summary: { dropped_iterations: 0, workload_start: 'a', workload_end: 'b' },
    faultExpected: true,
    faultExit: 0,
    aborted: false,
  };
  assert.equal(executionGate(base).result, 'pass');
  assert.deepEqual(executionGate({ ...base, summary: { ...base.summary, dropped_iterations: 3 } }).reasons, [
    'dropped_iterations_3',
  ]);
  assert.deepEqual(executionGate({ ...base, faultExit: 1 }).reasons, ['fault_schedule_exit_1']);
});

test('fault run trọn vẹn: reset có cả lớp fault và TTL, lịch fault bật theo mốc workload_start, đủ artifact', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'runner-'));
  const ctx = fakeContext();
  const manifest = await runExperiment(spec({ fault: { case: 'C2', align_peak: true } }), options(dir), ctx);
  assert.equal(manifest.status, 'completed');
  assert.equal(manifest.gates.execution.result, 'pass');
  assert.equal(manifest.gates.data_quality, 'pass');
  assert.equal(manifest.gates.ground_truth, 'valid');

  const names = ctx.calls.map((call) => call.name);
  assert.deepEqual(names.slice(0, 2), ['compose-down', 'compose-up']);
  const up = ctx.calls[1];
  assert.ok(up.args.includes('/repo/aiops-platform/faults/compose.faults.yaml'));
  assert.equal(up.env.FAULTS_SERVICE_TOKEN_TTL_SECONDS, '60');
  assert.ok(names.indexOf('k6') < names.indexOf('fault-schedule'));
  const fault = ctx.calls.find((call) => call.name === 'fault-schedule');
  assert.equal(fault.args[fault.args.indexOf('--run-start') + 1], '2026-11-19T08:02:00.000Z');
  assert.equal(
    fault.args[fault.args.indexOf('--align-peak') + 1],
    '/repo/aiops-platform/load/data/plans/moodle-normal-mixed-k4-v1.json',
  );
  assert.ok(names.indexOf('cleanup-clear') > names.indexOf('fault-schedule'));
  assert.deepEqual(names.slice(-4), ['export', 'quality', 'ground-truth', 'features']);
  const truth = ctx.calls.find((call) => call.name === 'ground-truth');
  assert.equal(truth.args[truth.args.indexOf('--case') + 1], 'C2');

  const runDir = join(dir, 'runs', 'pilot-c2-test-001');
  assert.ok(existsSync(join(runDir, 'workload', 'k6-summary.json')));
  assert.ok(existsSync(join(runDir, 'telemetry', 'manifest.json')));
  assert.ok(!existsSync(join(runDir, '.k6')) && !existsSync(join(runDir, '.telemetry')));
  const ledger = readLedger(join(dir, 'ledger.jsonl'));
  assert.deepEqual(
    ledger.map((entry) => entry.event),
    ['run.started', 'run.finished'],
  );
  assert.equal(ledger[1].status, 'completed');
  assert.ok(!existsSync(join(dir, 'runs', '.runner.lock')));
});

test('run healthy không bật lịch fault; run_id đã dùng thì bị từ chối mà không ghi ledger', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'runner-'));
  const ctx = fakeContext();
  const manifest = await runExperiment(spec({ fault: null, run_id: 'pilot-healthy-001' }), options(dir), ctx);
  assert.equal(manifest.status, 'completed');
  assert.ok(!ctx.calls.some((call) => call.name === 'fault-schedule'));
  const truth = ctx.calls.find((call) => call.name === 'ground-truth');
  assert.ok(!truth.args.includes('--case'));
  await assert.rejects(
    runExperiment(spec({ fault: null, run_id: 'pilot-healthy-001' }), options(dir), fakeContext()),
    /đã dùng/u,
  );
  assert.equal(readLedger(join(dir, 'ledger.jsonl')).length, 2);
});

test('k6 lỗi ở setup: không bật fault, vẫn gỡ fault, ledger ghi run failed, không export', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'runner-'));
  const ctx = fakeContext({ k6Exit: 107, k6WritesPhase: false });
  const manifest = await runExperiment(spec(), options(dir), ctx);
  assert.equal(manifest.status, 'failed');
  assert.match(manifest.error, /workload_start/u);
  const names = ctx.calls.map((call) => call.name);
  assert.ok(!names.includes('fault-schedule'));
  assert.ok(names.includes('cleanup-clear') && names.includes('cleanup-llm-reset'));
  assert.ok(!names.includes('export'));
  const finished = readLedger(join(dir, 'ledger.jsonl')).at(-1);
  assert.equal(finished.status, 'failed');
  assert.equal(finished.execution_gate, 'fail');
  assert.ok(finished.execution_reasons.includes('k6_exit_107'));
});

test('bị ngắt giữa workload: dừng k6, ngắt lịch fault (tự gỡ), dọn fault, ledger ghi aborted, giữ artifact', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'runner-'));
  const controller = new AbortController();
  let completeK6;
  const ctx = fakeContext({ onK6: (complete) => (completeK6 = complete) });
  // Lịch fault không tự xong: chỉ dừng khi bị kill.
  const start = ctx.start;
  ctx.start = (name, cmd, args, opts) => {
    if (name !== 'fault-schedule') return start(name, cmd, args, opts);
    ctx.calls.push({ kind: 'start', name, cmd, args });
    let finish;
    const promise = new Promise((resolvePromise) => (finish = resolvePromise));
    return {
      promise,
      kill: (signal) => {
        ctx.state.faultKilled = signal;
        finish({ code: 130 });
      },
    };
  };
  const running = runExperiment(spec(), options(dir, { signal: controller.signal }), ctx);
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 20));
  controller.abort();
  completeK6(); // docker stop làm k6 thoát
  const manifest = await running;
  assert.equal(manifest.status, 'aborted');
  assert.equal(ctx.state.stopped, true);
  assert.equal(ctx.state.faultKilled, 'SIGTERM');
  const names = ctx.calls.map((call) => call.name);
  assert.ok(names.includes('cleanup-clear'));
  assert.ok(!names.includes('export'));
  assert.ok(existsSync(join(dir, 'runs', 'pilot-c2-test-001', 'workload', 'k6-summary.json')));
  assert.equal(readLedger(join(dir, 'ledger.jsonl')).at(-1).status, 'aborted');
});

test('TTL của identity khác spec: dừng trước workload, ghi run failed', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'runner-'));
  const ctx = fakeContext({ ttl: 600 });
  const manifest = await runExperiment(spec(), options(dir), ctx);
  assert.equal(manifest.status, 'failed');
  assert.ok(!ctx.calls.some((call) => call.name === 'k6'));
  assert.ok(manifest.gates.execution.reasons.includes('environment_mismatch'));
});

test('reset cần --confirm-reset khớp project', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'runner-'));
  await assert.rejects(
    runExperiment(spec(), options(dir, { confirmReset: 'khác' }), fakeContext()),
    /confirm-reset/u,
  );
  assert.ok(!existsSync(join(dir, 'ledger.jsonl')));
});
