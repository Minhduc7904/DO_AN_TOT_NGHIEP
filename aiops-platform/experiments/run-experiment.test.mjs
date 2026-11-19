import assert from 'node:assert/strict';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { appendLedger, readLedger } from './lib/ledger.mjs';
import { normalizeSpec, validateSpec } from './lib/spec.mjs';
import {
  checkReplacement,
  defaultPaths,
  executionGate,
  k6Environment,
  parseWorkloadStart,
  raceTimeout,
  runExperiment,
  waitForLine,
} from './run-experiment.mjs';

const T0 = new Date('2026-11-19T08:00:00.000Z');
const PHASE = JSON.stringify({ kind: 'phase', phase: 'workload_start', ts: '2026-11-19T08:02:00.000Z' });

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
 * Ngữ cảnh giả cho các tác động ra ngoài (docker, k6, uv, đồng hồ). Tiến trình k6/export/quality/
 * ground-truth được mô phỏng bằng cách ghi đúng các file mà công cụ thật ghi; k6 lỗi ở setup vẫn ghi
 * k6-summary.json nhưng không có cửa sổ workload (như đã thấy ở run thật).
 */
function fakeContext({ k6Exit = 0, k6WritesPhase = true, faultExit = 0, ttl = 60, k6Manual = false, faultManual = false } = {}) {
  const calls = [];
  const state = { stopCalls: 0, faultKilled: null, paused: false, completeK6: null, exitOverrides: {} };
  let clock = T0.getTime();
  return {
    calls,
    state,
    pid: 4242,
    now: () => new Date((clock += 1000)),
    isAlive: (pid) => pid === 9999,
    memAvailableMb: () => 8000,
    diskFreeMb: () => 50_000,
    runningK6: async () => [],
    stopK6: async () => {
      state.stopCalls += 1;
      state.completeK6?.();
    },
    gitProvenance: async () => ({ commit: 'abc123', branch: 'test', dirty: false, diff_sha256: null }),
    inspectIdentity: async () => ({ ttl, paused: state.paused }),
    verifyStack: async () => ({ sha256: 'f'.repeat(64), health: [], fingerprint: {} }),
    exec: async (name, cmd, args, opts) => {
      calls.push({ kind: 'exec', name, cmd, args, env: opts.env ?? {} });
      if (name in state.exitOverrides) return { code: state.exitOverrides[name] };
      if (name === 'export') {
        const out = args[args.indexOf('--out') + 1];
        const runId = JSON.parse(readFileSync(args[args.indexOf('--k6-summary') + 1], 'utf8')).run_id;
        mkdirSync(join(out, runId), { recursive: true });
        writeFileSync(join(out, runId, 'manifest.json'), '{}');
      }
      if (name === 'quality') writeFileSync(join(args[3], 'quality-report.json'), '{"overall_status":"partial"}');
      if (name === 'ground-truth') writeFileSync(args[args.indexOf('--out') + 1], '{"run_status":"invalid"}');
      return { code: 0 };
    },
    start: (name, cmd, args, opts) => {
      calls.push({ kind: 'start', name, cmd, args, env: opts.env ?? {}, inheritEnv: opts.inheritEnv });
      let finish;
      const promise = new Promise((resolvePromise) => (finish = resolvePromise));
      if (name === 'k6') {
        const dir = join(opts.env.RESULTS_HOST_DIR, opts.env.RUN_ID);
        mkdirSync(dir, { recursive: true });
        if (k6WritesPhase) writeFileSync(join(dir, 'k6-log.jsonl'), `${JSON.stringify({ level: 'info', msg: PHASE })}\n`);
        let completed = false;
        const complete = () => {
          if (completed) return;
          completed = true;
          const ok = k6Exit === 0 || k6Exit === 99;
          writeFileSync(
            join(dir, 'k6-summary.json'),
            JSON.stringify({
              run_id: opts.env.RUN_ID,
              workload_profile: 'normal-mixed@v1',
              workload_seed: 7,
              workload_parameters: { plan_sha256: 'p'.repeat(64) },
              workload_start: ok ? '2026-11-19T08:02:00.000Z' : null,
              workload_end: '2026-11-19T08:50:00.000Z',
              started_at: ok ? '2026-11-19T08:02:00.000Z' : null,
              finished_at: '2026-11-19T08:50:00.000Z',
              dropped_iterations: 0,
            }),
          );
          finish({ code: state.stopCalls > 0 ? 0 : k6Exit });
        };
        state.completeK6 = complete;
        if (!k6Manual) setImmediate(complete);
        return { promise, kill: () => {} };
      }
      if (!faultManual) setImmediate(() => finish({ code: faultExit }));
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
    raceTimeout: (promise, ms) => raceTimeout(promise, Math.min(ms, 20)),
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
    stopRetryMs: 5,
    ...extra,
  };
}

const tmp = () => mkdtempSync(join(tmpdir(), 'runner-'));
const names = (ctx) => ctx.calls.map((call) => call.name);

test('spec: khoảng seed theo split, fault validation cần repeat_index ≥ 1, mặc định run_id và dữ liệu seed', () => {
  assert.deepEqual(validateSpec(spec()), []);
  assert.match(validateSpec(spec({ split: 'train' })).join(), /ngoài khoảng 1000–1999/u);
  assert.match(
    validateSpec(spec({ split: 'validation', workload: { profile: 'normal-mixed', seed: 2001 } })).join(),
    /repeat_index ≥ 1/u,
  );
  assert.match(validateSpec(spec({ fault: { case: 'C9' } })).join(), /fault.case lạ/u);
  assert.match(validateSpec(spec({ fault: { case: 'C2', align_peak: true, start_s: 900 } })).join(), /loại trừ/u);
  assert.match(validateSpec(spec({ data_seed: { profile: 'small' } })).join(), /data_seed/u);
  const normalized = normalizeSpec({ ...spec(), run_id: undefined }, T0);
  assert.equal(normalized.run_id, 'pilot-c2-normal-mixed-s7-20261119t080000z');
  assert.equal(normalized.environment.service_token_ttl_s, 60);
  assert.deepEqual(normalized.data_seed, { profile: 'small', seed: 42 });
});

test('mốc workload_start đọc từ dòng phase; môi trường k6 bỏ biến pass-through của shell', () => {
  assert.equal(parseWorkloadStart(JSON.stringify({ msg: PHASE })), '2026-11-19T08:02:00.000Z');
  assert.equal(parseWorkloadStart(JSON.stringify({ msg: '{"kind":"action"}' })), null);
  assert.equal(parseWorkloadStart('không phải json'), null);
  const env = k6Environment({ PATH: '/bin', PLAN: 'data/plans/khac.json', VUS: '9' }, { PROFILE: 'normal-mixed' });
  assert.deepEqual(env, { PATH: '/bin', PROFILE: 'normal-mixed' });
});

test('execution gate: k6 thoát 99 vẫn đạt; không reset, dropped, fault không gỡ được thì không', () => {
  const base = {
    resetResult: 'succeeded',
    seedResult: 'succeeded',
    envOk: true,
    k6Exit: 99,
    summary: { dropped_iterations: 0, workload_start: 'a', workload_end: 'b' },
    faultExpected: true,
    faultExit: 0,
    cleanupOk: true,
    aborted: false,
  };
  assert.equal(executionGate(base).result, 'pass');
  assert.deepEqual(executionGate({ ...base, resetResult: 'skipped', seedResult: 'skipped' }).reasons, ['reset_skipped']);
  assert.deepEqual(executionGate({ ...base, summary: { ...base.summary, dropped_iterations: 3 } }).reasons, [
    'dropped_iterations_3',
  ]);
  assert.deepEqual(executionGate({ ...base, faultExit: null }).reasons, ['fault_not_started']);
  assert.deepEqual(executionGate({ ...base, cleanupOk: false }).reasons, ['fault_cleanup_failed']);
});

test('fault run trọn vẹn: reset + seed + TTL, lịch fault theo mốc workload_start, đủ artifact và gate', async () => {
  const dir = tmp();
  const ctx = fakeContext();
  process.env.PLAN = 'data/plans/tu-shell.json';
  let manifest;
  try {
    manifest = await runExperiment(spec({ fault: { case: 'C2', align_peak: true } }), options(dir), ctx);
  } finally {
    delete process.env.PLAN;
  }
  assert.equal(manifest.status, 'completed');
  assert.equal(manifest.gates.execution.result, 'pass');
  // Gate lấy đúng giá trị từ file của công cụ (bản giả ghi giá trị khác mặc định để thấy được ánh xạ).
  assert.equal(manifest.gates.data_quality, 'partial');
  assert.equal(manifest.gates.ground_truth, 'invalid');

  const order = names(ctx);
  assert.deepEqual(order.slice(0, 3), ['compose-down', 'compose-up', 'seed-data']);
  const up = ctx.calls[1];
  assert.ok(up.args.includes('/repo/aiops-platform/faults/compose.faults.yaml'));
  assert.equal(up.env.FAULTS_SERVICE_TOKEN_TTL_SECONDS, '60');
  const seed = ctx.calls[2];
  assert.deepEqual(seed.args.slice(seed.args.indexOf('--profile'), seed.args.indexOf('--profile') + 4), [
    '--profile',
    'small',
    '--seed',
    '42',
  ]);
  const k6 = ctx.calls.find((call) => call.name === 'k6');
  assert.equal(k6.inheritEnv, false);
  assert.ok(!('PLAN' in k6.env), 'PLAN của shell không được lọt vào k6');
  assert.ok(order.indexOf('k6') < order.indexOf('fault-schedule'));
  const fault = ctx.calls.find((call) => call.name === 'fault-schedule');
  assert.equal(fault.args[fault.args.indexOf('--run-start') + 1], '2026-11-19T08:02:00.000Z');
  assert.equal(
    fault.args[fault.args.indexOf('--align-peak') + 1],
    '/repo/aiops-platform/load/data/plans/moodle-normal-mixed-k4-v1.json',
  );
  assert.equal(fault.env.COMPOSE_PROJECT_NAME, 'aiops-lms');
  assert.ok(order.indexOf('cleanup-clear') > order.indexOf('fault-schedule'));
  assert.deepEqual(order.slice(-4), ['export', 'quality', 'ground-truth', 'features']);
  const truth = ctx.calls.find((call) => call.name === 'ground-truth');
  assert.equal(truth.args[truth.args.indexOf('--case') + 1], 'C2');
  assert.ok(truth.args.includes('--artifact'));

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
  const dir = tmp();
  const ctx = fakeContext();
  const manifest = await runExperiment(spec({ fault: null, run_id: 'pilot-healthy-001' }), options(dir), ctx);
  assert.equal(manifest.status, 'completed');
  assert.ok(!names(ctx).includes('fault-schedule'));
  const truth = ctx.calls.find((call) => call.name === 'ground-truth');
  assert.ok(!truth.args.includes('--case'));
  await assert.rejects(
    runExperiment(spec({ fault: null, run_id: 'pilot-healthy-001' }), options(dir), fakeContext()),
    /đã dùng/u,
  );
  assert.equal(readLedger(join(dir, 'ledger.jsonl')).length, 2);
});

test('k6 lỗi ở setup: không bật fault, không export, vẫn gỡ fault và vẫn ghi RunGroundTruth', async () => {
  const dir = tmp();
  const ctx = fakeContext({ k6Exit: 107, k6WritesPhase: false });
  const manifest = await runExperiment(spec(), options(dir), ctx);
  assert.equal(manifest.status, 'failed');
  assert.match(manifest.error, /workload_start/u);
  const order = names(ctx);
  assert.ok(!order.includes('fault-schedule') && !order.includes('export'));
  assert.ok(order.includes('cleanup-clear') && order.includes('cleanup-llm-reset'));
  const truth = ctx.calls.find((call) => call.name === 'ground-truth');
  assert.ok(truth && !truth.args.includes('--artifact'));
  const finished = readLedger(join(dir, 'ledger.jsonl')).at(-1);
  assert.equal(finished.status, 'failed');
  assert.ok(finished.execution_reasons.includes('k6_exit_107'));
  assert.ok(finished.execution_reasons.includes('fault_not_started'));
  assert.ok(finished.execution_reasons.includes('workload_window_missing'));
});

test('bị ngắt giữa workload: dừng k6, ngắt lịch fault, dọn fault, ghi aborted, không export, giữ artifact', async () => {
  const dir = tmp();
  const controller = new AbortController();
  const ctx = fakeContext({ k6Manual: true, faultManual: true });
  const running = runExperiment(spec(), options(dir, { signal: controller.signal }), ctx);
  while (!names(ctx).includes('fault-schedule')) await new Promise((resolvePromise) => setTimeout(resolvePromise, 2));
  controller.abort();
  const manifest = await running;
  assert.equal(manifest.status, 'aborted');
  assert.ok(ctx.state.stopCalls >= 1);
  assert.equal(ctx.state.faultKilled, 'SIGTERM');
  const order = names(ctx);
  assert.ok(order.includes('cleanup-clear'));
  assert.ok(!order.includes('export') && !order.includes('features'));
  assert.ok(order.includes('ground-truth'));
  assert.ok(existsSync(join(dir, 'runs', 'pilot-c2-test-001', 'workload', 'k6-summary.json')));
  assert.equal(readLedger(join(dir, 'ledger.jsonl')).at(-1).status, 'aborted');
  assert.ok(!existsSync(join(dir, 'runs', '.runner.lock')));
});

test('bị ngắt trước khi bắt đầu: không reset, không chạy k6, ledger vẫn có dòng kết thúc', async () => {
  const dir = tmp();
  const controller = new AbortController();
  const ctx = fakeContext();
  const original = ctx.gitProvenance;
  ctx.gitProvenance = async () => {
    const result = await original();
    controller.abort(); // tín hiệu đến trong lúc preflight
    return result;
  };
  await assert.rejects(runExperiment(spec(), options(dir, { signal: controller.signal }), ctx), /aborted/u);
  assert.ok(!names(ctx).includes('compose-down'));
  assert.ok(!existsSync(join(dir, 'ledger.jsonl')));

  const later = new AbortController();
  const ctx2 = fakeContext();
  const verify = ctx2.verifyStack;
  ctx2.verifyStack = async (...args) => {
    later.abort(); // tín hiệu đến trong lúc lấy fingerprint
    return verify(...args);
  };
  const manifest = await runExperiment(spec({ run_id: 'pilot-c2-test-002' }), options(dir, { signal: later.signal }), ctx2);
  assert.equal(manifest.status, 'aborted');
  assert.ok(!names(ctx2).includes('seed-data') && !names(ctx2).includes('k6'));
  assert.ok(names(ctx2).includes('cleanup-clear'));
  assert.equal(readLedger(join(dir, 'ledger.jsonl')).at(-1).status, 'aborted');
});

test('gỡ fault thất bại: run failed, gate ghi fault_cleanup_failed', async () => {
  const dir = tmp();
  const ctx = fakeContext();
  ctx.state.exitOverrides['cleanup-clear'] = 1;
  const manifest = await runExperiment(spec(), options(dir), ctx);
  assert.equal(manifest.status, 'failed');
  assert.ok(manifest.gates.execution.reasons.includes('fault_cleanup_failed'));
});

test('k6-summary.json hỏng (k6 bị kill khi đang ghi): vẫn có dòng run.finished và lock được gỡ', async () => {
  const dir = tmp();
  const ctx = fakeContext({ k6Manual: true });
  const start = ctx.start;
  ctx.start = (name, cmd, args, opts) => {
    const handle = start(name, cmd, args, opts);
    if (name === 'k6') {
      const complete = ctx.state.completeK6;
      setImmediate(() => {
        complete();
        appendFileSync(join(opts.env.RESULTS_HOST_DIR, opts.env.RUN_ID, 'k6-summary.json'), '{dở');
      });
    }
    return handle;
  };
  const manifest = await runExperiment(spec({ fault: null }), options(dir), ctx);
  assert.equal(manifest.status, 'failed');
  assert.match(manifest.error, /k6-summary.json/u);
  assert.equal(readLedger(join(dir, 'ledger.jsonl')).at(-1).event, 'run.finished');
  assert.ok(!existsSync(join(dir, 'runs', '.runner.lock')));
});

test('lock: runner còn sống thì từ chối; lock của tiến trình đã chết thì thay', async () => {
  const dir = tmp();
  mkdirSync(join(dir, 'runs'), { recursive: true });
  writeFileSync(join(dir, 'runs', '.runner.lock'), JSON.stringify({ pid: 9999, run_id: 'khac' }));
  await assert.rejects(runExperiment(spec(), options(dir), fakeContext()), /Runner khác đang chạy/u);
  writeFileSync(join(dir, 'runs', '.runner.lock'), JSON.stringify({ pid: 1234, run_id: 'cu' }));
  const manifest = await runExperiment(spec(), options(dir), fakeContext());
  assert.equal(manifest.status, 'completed');
});

test('run thay thế: run bị thay phải có trong ledger, fail gate và cùng slot', () => {
  const dir = tmp();
  const ledgerPath = join(dir, 'ledger.jsonl');
  appendLedger(ledgerPath, 'run.started', {
    run_id: 'validation-c2-001',
    split: 'validation',
    case_id: 'C2',
    repeat_index: 1,
    workload_profile: 'normal-mixed',
  });
  appendLedger(ledgerPath, 'run.finished', { run_id: 'validation-c2-001', status: 'completed', execution_gate: 'fail' });
  const replacement = spec({
    split: 'validation',
    repeat_index: 1,
    workload: { profile: 'normal-mixed', seed: 2001 },
    replacement_for_run_id: 'validation-c2-001',
  });
  const ledger = readLedger(ledgerPath);
  assert.doesNotThrow(() => checkReplacement(replacement, ledger));
  assert.throws(() => checkReplacement({ ...replacement, replacement_for_run_id: 'khong-co' }, ledger), /không có/u);
  assert.throws(() => checkReplacement({ ...replacement, fault: { case: 'C3' } }, ledger), /cùng split/u);
  const passed = [...ledger.slice(0, 1), { ...ledger[1], execution_gate: 'pass', data_quality: 'pass' }];
  assert.throws(() => checkReplacement(replacement, passed), /đã qua/u);
});

test('seeder lỗi hoặc TTL sai: dừng trước workload; reset cần --confirm-reset khớp project', async () => {
  const dir = tmp();
  const ctx = fakeContext();
  ctx.state.exitOverrides['seed-data'] = 1;
  const failedSeed = await runExperiment(spec(), options(dir), ctx);
  assert.equal(failedSeed.status, 'failed');
  assert.ok(!names(ctx).includes('k6'));
  assert.ok(failedSeed.gates.execution.reasons.includes('seed_data_failed'));

  const ctxTtl = fakeContext({ ttl: 600 });
  const wrongTtl = await runExperiment(spec({ run_id: 'pilot-c2-test-003' }), options(dir), ctxTtl);
  assert.equal(wrongTtl.status, 'failed');
  assert.ok(!names(ctxTtl).includes('k6'));
  assert.ok(wrongTtl.gates.execution.reasons.includes('environment_mismatch'));

  await assert.rejects(
    runExperiment(spec({ run_id: 'pilot-c2-test-004' }), options(dir, { confirmReset: 'khac' }), fakeContext()),
    /confirm-reset/u,
  );
});

test('waitForLine thật: đọc dòng mới ghi sau, bỏ dòng chưa xong, dừng khi tiến trình kết thúc', async () => {
  const dir = tmp();
  const file = join(dir, 'k6-log.jsonl');
  let finish;
  const done = new Promise((resolvePromise) => (finish = resolvePromise));
  setTimeout(() => appendFileSync(file, '{"msg":"khác"}\n{"msg":'), 5);
  setTimeout(() => appendFileSync(file, `${JSON.stringify(PHASE)}}\n`), 15);
  const value = await waitForLine(file, parseWorkloadStart, { timeoutMs: 2000, done, pollMs: 3 });
  assert.equal(value, '2026-11-19T08:02:00.000Z');
  finish();
  const none = await waitForLine(join(dir, 'khong-co.jsonl'), parseWorkloadStart, { timeoutMs: 2000, done, pollMs: 3 });
  assert.equal(none, null);
});

test('raceTimeout thật: true khi promise xong trước, false khi hết giờ', async () => {
  assert.equal(await raceTimeout(Promise.resolve(), 50), true);
  assert.equal(await raceTimeout(new Promise(() => {}), 5), false);
});
