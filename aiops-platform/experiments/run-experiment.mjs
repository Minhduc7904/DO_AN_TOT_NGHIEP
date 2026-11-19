#!/usr/bin/env node
/**
 * Experiment runner: chạy trọn một run thí nghiệm từ một run spec (plan v0.4 tuần 15).
 *
 *   node aiops-platform/experiments/run-experiment.mjs <run-spec.json> \
 *     --compose-env-file docker-compose/.env --confirm-reset aiops-lms
 *     [--project aiops-lms] [--runs-dir aiops-platform/experiments/runs]
 *     [--ledger aiops-platform/experiments/ledger.jsonl] [--no-reset] [--min-available-mb 4000]
 *
 * Các bước (mỗi bước ghi vào run-manifest.json, run nào cũng có dòng ledger):
 *   preflight → reset-and-seed (down --volumes, up --build --wait, health, fingerprint) → kiểm môi
 *   trường → workload k6 (profile) + lịch fault song song, bật theo mốc `workload_start` → gỡ fault
 *   (luôn chạy) → export telemetry → quality report → RunGroundTruth → feature.
 *
 * Runner chỉ ghép công cụ đã có (load/, faults/, training/, lms/scripts/reset-and-seed.mjs); không
 * chứa logic workload hay fault. Hướng dẫn chạy: README.md cùng thư mục.
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statfsSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { appendLedger, readLedger } from './lib/ledger.mjs';
import { normalizeSpec, planPath } from './lib/spec.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, '..', '..');
export const MANIFEST_SCHEMA = 'run-manifest.v1';
const K6_IMAGE = 'grafana/k6:1.3.0';

export function defaultPaths(repoRoot = REPO_ROOT) {
  return {
    repoRoot,
    loadDir: join(repoRoot, 'aiops-platform/load'),
    trainingDir: join(repoRoot, 'aiops-platform/training'),
    runK6: join(repoRoot, 'aiops-platform/load/run-k6.sh'),
    faultControl: join(repoRoot, 'aiops-platform/faults/fault-control.mjs'),
    faultSchedule: join(repoRoot, 'aiops-platform/faults/fault-schedule.mjs'),
    faultManifest: join(repoRoot, 'aiops-platform/faults/manifests/fault-manifest-v1.json'),
    composeFiles: [
      join(repoRoot, 'docker-compose/compose.full.yaml'),
      join(repoRoot, 'aiops-platform/faults/compose.faults.yaml'),
    ],
    runsDir: join(repoRoot, 'aiops-platform/experiments/runs'),
    ledger: join(repoRoot, 'aiops-platform/experiments/ledger.jsonl'),
  };
}

export function sha256File(path) {
  return existsSync(path) ? createHash('sha256').update(readFileSync(path)).digest('hex') : null;
}

function readJson(path) {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
}

/** Dòng log k6 (JSON, trường `msg`) → mốc `workload_start` nếu là dòng phase do profile.js in ra. */
export function parseWorkloadStart(line) {
  try {
    const entry = JSON.parse(line);
    const message = typeof entry.msg === 'string' ? JSON.parse(entry.msg) : null;
    return message?.kind === 'phase' && message.phase === 'workload_start' ? message.ts : null;
  } catch {
    return null;
  }
}

/** Execution gate (evaluation-protocol-v1 mục 8.1) từ kết quả các bước. */
export function executionGate({ resetResult, envOk, k6Exit, summary, faultExpected, faultExit, aborted }) {
  const reasons = [];
  if (aborted) reasons.push('aborted');
  if (!['succeeded', 'skipped'].includes(resetResult)) reasons.push(`reset_${resetResult}`);
  if (!envOk) reasons.push('environment_mismatch');
  // k6 thoát 99 khi threshold của profile không đạt — chuyện bình thường ở fault run, không phải lỗi thực thi.
  if (![0, 99].includes(k6Exit)) reasons.push(`k6_exit_${k6Exit}`);
  if (!summary) reasons.push('k6_summary_missing');
  else {
    if (summary.dropped_iterations !== 0) reasons.push(`dropped_iterations_${summary.dropped_iterations}`);
    if (!summary.workload_start || !summary.workload_end) reasons.push('workload_window_missing');
  }
  if (faultExpected && faultExit !== 0) reasons.push(`fault_schedule_exit_${faultExit}`);
  return { result: reasons.length === 0 ? 'pass' : 'fail', reasons };
}

/**
 * Chạy một run. `ctx` cung cấp mọi tác động ra ngoài (process, docker, đồng hồ, tài nguyên máy) để
 * test thay được bằng bản ghi lại lời gọi.
 */
export async function runExperiment(rawSpec, options, ctx) {
  const paths = options.paths;
  const spec = normalizeSpec(rawSpec, ctx.now());
  const runId = spec.run_id;
  const runDir = join(paths.runsDir, runId);
  const lock = join(paths.runsDir, '.runner.lock');
  const iso = () => ctx.now().toISOString();

  // --- preflight (chưa tạo gì nếu không qua) ---
  mkdirSync(paths.runsDir, { recursive: true });
  const ledger = readLedger(paths.ledger);
  if (ledger.some((entry) => entry.run_id === runId) || existsSync(runDir)) {
    throw new Error(`run_id ${runId} đã dùng (ledger hoặc ${runDir}); run_id không dùng lại`);
  }
  if (existsSync(lock)) {
    const holder = readJson(lock);
    if (holder && ctx.isAlive(holder.pid)) throw new Error(`Runner khác đang chạy (${holder.run_id}, pid ${holder.pid})`);
  }
  if ((await ctx.runningK6()).length > 0) throw new Error('Có container k6 đang chạy; mỗi lúc chỉ một run');
  const availableMb = ctx.memAvailableMb();
  if (availableMb < options.minAvailableMb) {
    throw new Error(`RAM trống ${availableMb} MB < ${options.minAvailableMb} MB`);
  }
  const diskMb = ctx.diskFreeMb(paths.runsDir);
  if (diskMb < options.minDiskMb) throw new Error(`Đĩa trống ${diskMb} MB < ${options.minDiskMb} MB`);
  if (!options.noReset && options.confirmReset !== options.project) {
    throw new Error('--confirm-reset phải khớp --project (reset xóa volume của project)');
  }

  writeFileSync(lock, JSON.stringify({ pid: ctx.pid, run_id: runId, since: iso() }));
  mkdirSync(runDir);
  const logFile = join(runDir, 'runner.log');
  writeFileSync(join(runDir, 'run-spec.json'), `${JSON.stringify(spec, null, 2)}\n`);
  const code = await ctx.gitProvenance();
  const manifest = {
    run_manifest_schema: MANIFEST_SCHEMA,
    run_id: runId,
    status: 'running',
    started_at: iso(),
    finished_at: null,
    spec,
    code,
    environment: {
      compose_project: options.project,
      compose_files: paths.composeFiles.map((file) => file.replace(`${paths.repoRoot}/`, '')),
      service_token_ttl_s_expected: spec.environment.service_token_ttl_s,
      host_mem_available_mb_at_start: availableMb,
    },
    steps: {},
    gates: {},
    artifacts: {},
  };
  const save = () => writeFileSync(join(runDir, 'run-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  appendLedger(paths.ledger, 'run.started', {
    run_id: runId,
    split: spec.split,
    case_id: spec.fault?.case ?? null,
    repeat_index: spec.repeat_index,
    workload_profile: spec.workload.profile,
    workload_seed: spec.workload.seed,
    replacement_for_run_id: spec.replacement_for_run_id ?? null,
    code_commit: code.commit,
    code_dirty: code.dirty,
    run_dir: runDir.replace(`${paths.repoRoot}/`, ''),
  });
  save();

  const exec = (name, cmd, args, opts = {}) => ctx.exec(name, cmd, args, { logFile, ...opts });
  async function step(name, fn) {
    const entry = { started_at: iso() };
    manifest.steps[name] = entry;
    save();
    try {
      const result = (await fn()) ?? {};
      Object.assign(entry, { result: 'ok', ...result });
      return entry;
    } catch (error) {
      Object.assign(entry, { result: 'error', error: error instanceof Error ? error.message : String(error) });
      throw error;
    } finally {
      entry.finished_at = iso();
      save();
    }
  }

  let aborted = false;
  let k6Handle = null;
  let faultHandle = null;
  const onAbort = () => {
    aborted = true;
    ctx.stopK6().catch(() => {});
    faultHandle?.kill('SIGTERM');
  };
  options.signal?.addEventListener('abort', onAbort, { once: true });

  let resetResult = 'skipped';
  let envOk = false;
  let k6Exit = null;
  let faultExit = null;
  let failure = null;
  const k6Root = join(runDir, '.k6');
  const workloadDir = join(runDir, 'workload');
  const telemetryDir = join(runDir, 'telemetry');
  const faultsLog = join(runDir, 'faults.jsonl');
  const ttlEnv = { FAULTS_SERVICE_TOKEN_TTL_SECONDS: String(spec.environment.service_token_ttl_s) };

  try {
    // --- reset-and-seed ---
    if (!options.noReset) {
      await step('reset', async () => {
        resetResult = 'failed';
        const compose = ['compose', '-p', options.project, '--env-file', options.composeEnvFile];
        for (const file of paths.composeFiles) compose.push('-f', file);
        for (const [name, args] of [
          ['compose-down', [...compose, 'down', '--volumes', '--remove-orphans']],
          ['compose-up', [...compose, 'up', '--build', '-d', '--wait']],
        ]) {
          const { code: exit } = await exec(name, 'docker', args, { env: ttlEnv, timeoutMs: 30 * 60_000 });
          if (exit !== 0) throw new Error(`${name} thoát ${exit}`);
          if (aborted) throw new Error('aborted');
        }
        const fingerprint = await ctx.verifyStack(options);
        writeFileSync(join(runDir, 'reset.json'), `${JSON.stringify(fingerprint, null, 2)}\n`);
        resetResult = 'succeeded';
        return { reset_result: resetResult, fingerprint_sha256: fingerprint.sha256 };
      });
    } else {
      await step('reset', async () => ({ reset_result: 'skipped', health: await ctx.verifyStack(options, { healthOnly: true }) }));
    }

    // --- môi trường: TTL token, identity không bị pause, không còn fault sót ---
    await step('environment', async () => {
      const identity = await ctx.inspectIdentity(options.project);
      manifest.environment.service_token_ttl_s_actual = identity.ttl;
      manifest.environment.identity_paused = identity.paused;
      const cleared = await exec('fault-clear', 'node', [paths.faultControl, 'clear']);
      const llm = await exec('llm-reset', 'node', [paths.faultControl, 'llm', 'reset']);
      envOk =
        identity.ttl === spec.environment.service_token_ttl_s &&
        !identity.paused &&
        cleared.code === 0 &&
        llm.code === 0;
      if (!envOk) throw new Error(`Môi trường không khớp: TTL ${identity.ttl}, paused ${identity.paused}`);
      return { ttl: identity.ttl };
    });

    // --- workload + lịch fault ---
    await step('workload', async () => {
      const env = {
        RUN_ID: runId,
        PROFILE: spec.workload.profile,
        WORKLOAD_SEED: String(spec.workload.seed),
        RESULTS_HOST_DIR: k6Root,
        ...(spec.workload.plan ? { PLAN: spec.workload.plan } : {}),
      };
      k6Handle = ctx.start('k6', 'bash', [paths.runK6, 'profile', '--quiet'], { logFile, env, cwd: paths.repoRoot });
      const k6Log = join(k6Root, runId, 'k6-log.jsonl');
      const workloadStart = await ctx.waitForLine(k6Log, parseWorkloadStart, {
        timeoutMs: options.setupTimeoutMs,
        done: k6Handle.promise,
        signal: options.signal,
      });
      manifest.workload_start_observed = workloadStart;
      if (spec.fault && workloadStart) {
        const args = [paths.faultSchedule, 'run', '--case', spec.fault.case, '--run-start', workloadStart, '--log', faultsLog];
        if (spec.fault.manifest) args.push('--manifest', resolve(paths.repoRoot, spec.fault.manifest));
        if (spec.fault.align_peak) args.push('--align-peak', join(paths.loadDir, planPath(spec)));
        if (spec.fault.start_s !== undefined) args.push('--start-s', String(spec.fault.start_s));
        if (spec.fault.duration_s !== undefined) args.push('--duration-s', String(spec.fault.duration_s));
        faultHandle = ctx.start('fault-schedule', 'node', args, { logFile, cwd: paths.repoRoot });
      }
      ({ code: k6Exit } = await k6Handle.promise);
      if (faultHandle) {
        // Lịch fault luôn xong trước khi workload hết (recovery ≥ 10 phút); còn chạy là bất thường.
        const settled = await ctx.raceTimeout(faultHandle.promise, k6Exit === 0 || k6Exit === 99 ? options.faultGraceMs : 0);
        if (!settled) faultHandle.kill('SIGTERM');
        ({ code: faultExit } = await faultHandle.promise);
      }
      if (existsSync(join(k6Root, runId))) renameSync(join(k6Root, runId), workloadDir);
      rmSync(k6Root, { recursive: true, force: true });
      if (spec.fault && !workloadStart) throw new Error('Không thấy mốc workload_start trong log k6; không bật fault');
      return { k6_exit: k6Exit, fault_schedule_exit: faultExit, workload_start: workloadStart };
    });
  } catch (error) {
    failure = error;
  } finally {
    // Gỡ fault luôn chạy, kể cả khi lỗi hoặc bị ngắt (fault-schedule cũng tự gỡ khi nhận SIGTERM).
    await step('fault-cleanup', async () => {
      const outputs = [];
      for (const args of [['clear'], ['llm', 'reset']]) {
        outputs.push((await exec(`cleanup-${args.join('-')}`, 'node', [paths.faultControl, ...args])).code);
      }
      const identity = await ctx.inspectIdentity(options.project).catch(() => null);
      if (identity?.paused) {
        outputs.push((await exec('cleanup-unpause', 'node', [paths.faultControl, 'container', 'unpause', 'identity'])).code);
      }
      return { exit_codes: outputs };
    }).catch(() => {});
  }

  const summaryPath = join(workloadDir, 'k6-summary.json');
  const summary = readJson(summaryPath);
  manifest.workload = summary
    ? {
        profile: summary.workload_profile,
        seed: summary.workload_seed,
        plan_path: summary.workload_parameters?.plan_path,
        plan_sha256: summary.workload_parameters?.plan_sha256,
        workload_start: summary.workload_start,
        workload_end: summary.workload_end,
        dropped_iterations: summary.dropped_iterations,
        summary_sha256: sha256File(summaryPath),
      }
    : null;
  manifest.gates.execution = executionGate({
    resetResult,
    envOk,
    k6Exit,
    summary,
    faultExpected: Boolean(spec.fault),
    faultExit,
    aborted,
  });
  save();

  if (!aborted && summary) {
    try {
      await step('export', async () => {
        const telRoot = join(runDir, '.telemetry');
        const { code: exit } = await exec('export', 'uv', ['run', 'aiops-training', 'export', '--k6-summary', summaryPath, '--out', telRoot], {
          cwd: paths.trainingDir,
          timeoutMs: 3 * 60 * 60_000,
        });
        if (existsSync(join(telRoot, runId))) renameSync(join(telRoot, runId), telemetryDir);
        rmSync(telRoot, { recursive: true, force: true });
        manifest.artifacts.telemetry_manifest_sha256 = sha256File(join(telemetryDir, 'manifest.json'));
        if (!existsSync(join(telemetryDir, 'manifest.json'))) throw new Error(`export thoát ${exit}, không có manifest`);
        return { exit, modality_errors: exit !== 0 };
      });
      await step('quality', async () => {
        const { code: exit } = await exec('quality', 'uv', ['run', 'aiops-training', 'quality', telemetryDir], { cwd: paths.trainingDir });
        const report = readJson(join(telemetryDir, 'quality-report.json'));
        manifest.gates.data_quality = report?.overall_status ?? 'missing';
        return { exit, overall_status: manifest.gates.data_quality };
      });
      await step('ground-truth', async () => {
        const args = ['run', 'aiops-training', 'ground-truth', '--k6-summary', summaryPath, '--repeat-index', String(spec.repeat_index), '--artifact', telemetryDir, '--out', join(runDir, 'ground-truth.json')];
        if (code.commit) args.push('--code-commit', code.commit);
        if (spec.fault) {
          args.push('--case', spec.fault.case, '--fault-log', faultsLog, '--fault-manifest', spec.fault.manifest ? resolve(paths.repoRoot, spec.fault.manifest) : paths.faultManifest);
        }
        const { code: exit } = await exec('ground-truth', 'uv', args, { cwd: paths.trainingDir });
        const truth = readJson(join(runDir, 'ground-truth.json'));
        manifest.gates.ground_truth = truth?.run_status ?? 'missing';
        return { exit, run_status: manifest.gates.ground_truth, verification_result: truth?.verification_result ?? null };
      });
      await step('features', async () => {
        const { code: exit } = await exec('features', 'uv', ['run', 'aiops-training', 'features', telemetryDir], { cwd: paths.trainingDir });
        if (exit !== 0) throw new Error(`features thoát ${exit}`);
        return { exit };
      });
    } catch (error) {
      failure ??= error;
    }
  }

  options.signal?.removeEventListener('abort', onAbort);
  manifest.status = aborted ? 'aborted' : failure ? 'failed' : 'completed';
  if (failure) manifest.error = failure instanceof Error ? failure.message : String(failure);
  manifest.finished_at = iso();
  save();
  appendLedger(paths.ledger, 'run.finished', {
    run_id: runId,
    status: manifest.status,
    execution_gate: manifest.gates.execution.result,
    execution_reasons: manifest.gates.execution.reasons,
    data_quality: manifest.gates.data_quality ?? null,
    ground_truth: manifest.gates.ground_truth ?? null,
    workload_start: manifest.workload?.workload_start ?? null,
    workload_end: manifest.workload?.workload_end ?? null,
    plan_sha256: manifest.workload?.plan_sha256 ?? null,
    run_manifest_sha256: sha256File(join(runDir, 'run-manifest.json')),
    error: manifest.error ?? null,
  });
  rmSync(lock, { force: true });
  appendFileSync(logFile, `[runner] ${runId} ${manifest.status}\n`);
  return manifest;
}

// ---------------------------------------------------------------------------------------------
// Ngữ cảnh thật: process, docker, tài nguyên máy.

function spawnLogged(cmd, args, { logFile, env = {}, cwd = REPO_ROOT, capture = false, timeoutMs = 0 } = {}) {
  appendFileSync(logFile, `\n[runner] ${new Date().toISOString()} $ ${cmd} ${args.join(' ')}\n`);
  const child = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  const write = (chunk) => appendFileSync(logFile, chunk);
  child.stdout.on('data', (chunk) => {
    if (capture) stdout += chunk;
    write(chunk);
  });
  child.stderr.on('data', write);
  let timer = null;
  const promise = new Promise((resolvePromise) => {
    child.once('error', (error) => {
      write(`[runner] spawn lỗi: ${error.message}\n`);
      resolvePromise({ code: -1, stdout });
    });
    child.once('close', (code, signal) => {
      if (timer) clearTimeout(timer);
      write(`[runner] thoát ${code ?? signal}\n`);
      resolvePromise({ code: code ?? 128, stdout });
    });
  });
  if (timeoutMs > 0) timer = setTimeout(() => child.kill('SIGTERM'), timeoutMs);
  return { promise, kill: (signal) => child.kill(signal) };
}

function capture(cmd, args) {
  return new Promise((resolvePromise) => {
    const child = spawn(cmd, args, { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (chunk) => (out += chunk));
    child.once('error', () => resolvePromise({ code: -1, out }));
    child.once('close', (code) => resolvePromise({ code, out: out.trim() }));
  });
}

export function realContext(paths) {
  return {
    pid: process.pid,
    now: () => new Date(),
    isAlive: (pid) => {
      try {
        process.kill(pid, 0);
        return true;
      } catch {
        return false;
      }
    },
    memAvailableMb: () => {
      const match = readFileSync('/proc/meminfo', 'utf8').match(/^MemAvailable:\s+(\d+) kB/mu);
      return match ? Math.floor(Number(match[1]) / 1024) : 0;
    },
    diskFreeMb: (path) => {
      const stats = statfsSync(path);
      return Math.floor((stats.bavail * stats.bsize) / 1024 / 1024);
    },
    runningK6: async () => {
      const { out } = await capture('docker', ['ps', '-q', '--filter', `ancestor=${K6_IMAGE}`]);
      return out ? out.split('\n') : [];
    },
    stopK6: async () => {
      const { out } = await capture('docker', ['ps', '-q', '--filter', `ancestor=${K6_IMAGE}`]);
      if (out) await capture('docker', ['stop', ...out.split('\n')]);
    },
    gitProvenance: async () => {
      const commit = (await capture('git', ['-C', paths.repoRoot, 'rev-parse', 'HEAD'])).out || null;
      const branch = (await capture('git', ['-C', paths.repoRoot, 'rev-parse', '--abbrev-ref', 'HEAD'])).out || null;
      const status = (await capture('git', ['-C', paths.repoRoot, 'status', '--porcelain', '--untracked-files=no'])).out;
      const diff = (await capture('git', ['-C', paths.repoRoot, 'diff', 'HEAD'])).out;
      return {
        commit,
        branch,
        dirty: status.length > 0,
        diff_sha256: diff ? createHash('sha256').update(diff).digest('hex') : null,
      };
    },
    inspectIdentity: async (project) => {
      const name = `${project}-identity-1`;
      const { code, out } = await capture('docker', ['inspect', name, '--format', '{{json .Config.Env}} {{.State.Paused}}']);
      if (code !== 0) throw new Error(`Không inspect được ${name}`);
      const split = out.lastIndexOf(' ');
      const envList = JSON.parse(out.slice(0, split));
      const ttl = envList.find((item) => item.startsWith('IDENTITY_SERVICE_TOKEN_TTL_SECONDS='));
      return { ttl: ttl ? Number(ttl.split('=')[1]) : null, paused: out.slice(split + 1) === 'true' };
    },
    verifyStack: async (options, { healthOnly = false } = {}) => {
      const reset = await import(pathToFileURL(join(paths.repoRoot, 'lms/scripts/reset-and-seed.mjs')).href);
      const resetOptions = {
        project: options.project,
        envFile: resolve(options.composeEnvFile),
        composeFile: paths.composeFiles[0],
        repositoryRoot: paths.repoRoot,
      };
      const health = await reset.verifyHealth(resetOptions);
      if (healthOnly) return health;
      const result = await reset.collectFingerprint(resetOptions);
      return { sha256: result.sha256, health, fingerprint: result.fingerprint };
    },
    exec: (name, cmd, args, opts) => spawnLogged(cmd, args, opts).promise,
    start: (name, cmd, args, opts) => spawnLogged(cmd, args, opts),
    waitForLine: async (file, parse, { timeoutMs, done, signal }) => {
      let finished = false;
      done.then(() => (finished = true));
      const deadline = Date.now() + timeoutMs;
      let offset = 0;
      while (Date.now() < deadline && !signal?.aborted) {
        if (existsSync(file)) {
          const text = readFileSync(file, 'utf8');
          const lines = text.slice(offset).split('\n');
          for (const line of lines.slice(0, -1)) {
            const value = parse(line);
            if (value) return value;
          }
          offset = text.length - lines[lines.length - 1].length;
        }
        if (finished) return null;
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 2000));
      }
      return null;
    },
    raceTimeout: (promise, ms) =>
      Promise.race([
        promise.then(() => true),
        new Promise((resolvePromise) => setTimeout(() => resolvePromise(false), ms)),
      ]),
  };
}

async function main(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      'compose-env-file': { type: 'string' },
      'confirm-reset': { type: 'string' },
      project: { type: 'string', default: 'aiops-lms' },
      'runs-dir': { type: 'string' },
      ledger: { type: 'string' },
      'no-reset': { type: 'boolean', default: false },
      'min-available-mb': { type: 'string', default: '4000' },
      'min-disk-mb': { type: 'string', default: '5000' },
      'setup-timeout-s': { type: 'string', default: '600' },
      'fault-grace-s': { type: 'string', default: '300' },
    },
  });
  if (positionals.length !== 1) throw new Error('Dùng: run-experiment.mjs <run-spec.json> --compose-env-file <file> --confirm-reset <project>');
  if (!values['compose-env-file']) throw new Error('Thiếu --compose-env-file');
  const paths = defaultPaths();
  if (values['runs-dir']) paths.runsDir = resolve(values['runs-dir']);
  if (values.ledger) paths.ledger = resolve(values.ledger);
  const spec = JSON.parse(readFileSync(positionals[0], 'utf8'));
  const controller = new AbortController();
  for (const name of ['SIGINT', 'SIGTERM']) process.on(name, () => controller.abort());
  const manifest = await runExperiment(
    spec,
    {
      paths,
      project: values.project,
      composeEnvFile: values['compose-env-file'],
      confirmReset: values['confirm-reset'],
      noReset: values['no-reset'],
      minAvailableMb: Number(values['min-available-mb']),
      minDiskMb: Number(values['min-disk-mb']),
      setupTimeoutMs: Number(values['setup-timeout-s']) * 1000,
      faultGraceMs: Number(values['fault-grace-s']) * 1000,
      signal: controller.signal,
    },
    realContext(paths),
  );
  console.log(
    JSON.stringify({
      run_id: manifest.run_id,
      status: manifest.status,
      gates: manifest.gates,
      error: manifest.error ?? null,
      run_dir: join(paths.runsDir, manifest.run_id),
    }),
  );
  return manifest.status === 'completed' ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2)).then(
    (code) => (process.exitCode = code),
    (error) => {
      console.error(`[runner] ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 2;
    },
  );
}
