#!/usr/bin/env node
/**
 * Chấm tiêu chí "khỏe" (workload-design-v1 mục 8.4) cho một run: cả run, hoặc từng bậc của run tìm điểm
 * gãy (`--steps`, in `λ_knee`).
 *
 *   node aiops-platform/load/tools/health-check.mjs <thư mục run k6> --stats <docker-stats.jsonl> \
 *     [--steps] [--phase normal|deadline] [--prometheus-url http://127.0.0.1:9090] \
 *     [--project aiops-lms] [--sample-s 15] [--host-cpus <số core>] [--out health.json]
 *
 * `--sample-s` phải bằng `--interval-s` của bộ lấy mẫu; `--host-cpus` (mặc định số core của máy chạy
 * lệnh) dùng để so CPU của container k6.
 *
 * Nguồn: `k6-summary.json`, `actions.jsonl`, `sessions.jsonl` của run; p95 Gateway theo cửa sổ 60 s từ
 * Prometheus (`http_server_request_duration_seconds_bucket{service_name="gateway"}`); mẫu CPU/bộ nhớ của
 * `sample-docker-stats.mjs`; restart/OOM từ `docker inspect` (chạy ngay sau run, telemetry giữ 24 giờ).
 */
import { execFile } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs, promisify } from 'node:util';

import { evaluateHealth, evaluateSteps, restartEvents } from './health.mjs';

const run = promisify(execFile);

export const GATEWAY_P95_QUERY =
  'histogram_quantile(0.95, sum by (le) (increase(http_server_request_duration_seconds_bucket{service_name="gateway"}[60s])))';

function readLines(path) {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function gatewayP95(prometheusUrl, fromMs, toMs) {
  const url = new URL('/api/v1/query_range', prometheusUrl);
  url.search = new URLSearchParams({
    query: GATEWAY_P95_QUERY,
    start: String(Math.floor(fromMs / 1000) + 60),
    end: String(Math.ceil(toMs / 1000)),
    step: '60',
  }).toString();
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Prometheus ${response.status}`);
  const body = await response.json();
  return (body.data?.result?.[0]?.values ?? [])
    .map(([t, v]) => [Number(t), Number(v)])
    .filter(([, v]) => Number.isFinite(v));
}

/** Restart/OOM của container trong project sau `sinceMs`, kèm thời điểm (`restartEvents`). */
async function restartedContainers(project, sinceMs) {
  const { stdout: ids } = await run('docker', ['ps', '-aq', '--filter', `label=com.docker.compose.project=${project}`]);
  if (!ids.trim()) return [];
  const { stdout } = await run('docker', [
    'inspect',
    '--format',
    '{{.Name}}\t{{.State.OOMKilled}}\t{{.State.StartedAt}}\t{{.State.FinishedAt}}',
    ...ids.trim().split('\n'),
  ]);
  const rows = stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [name, oom, startedAt, finishedAt] = line.split('\t');
      return { name: name.replace(/^\//u, ''), oom: oom === 'true', startedAt: Date.parse(startedAt), finishedAt: Date.parse(finishedAt) };
    });
  return restartEvents(rows, sinceMs);
}

async function main(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      stats: { type: 'string' },
      steps: { type: 'boolean', default: false },
      phase: { type: 'string' },
      'prometheus-url': { type: 'string', default: 'http://127.0.0.1:9090' },
      project: { type: 'string', default: 'aiops-lms' },
      out: { type: 'string' },
      'sample-s': { type: 'string', default: '15' },
      'host-cpus': { type: 'string', default: String(availableParallelism()) },
    },
  });
  const sampleS = Number(values['sample-s']);
  const hostCpus = Number(values['host-cpus']);
  if (!(sampleS > 0) || !(hostCpus > 0)) throw new Error('--sample-s và --host-cpus phải là số dương');
  const [dir] = positionals;
  if (!dir || !values.stats) throw new Error('Dùng: health-check.mjs <thư mục run> --stats <docker-stats.jsonl> [--steps]');
  const summary = JSON.parse(readFileSync(join(dir, 'k6-summary.json'), 'utf8'));
  const phase = values.phase ?? summary.phase ?? 'normal';
  const fromMs = Date.parse(summary.workload_start ?? summary.started_at);
  const toMs = Date.parse(summary.workload_end ?? summary.finished_at);
  const p95 = await gatewayP95(values['prometheus-url'], fromMs, toMs);
  const actions = readLines(join(dir, 'actions.jsonl'));
  const sessions = readLines(join(dir, 'sessions.jsonl'));
  const samples = readLines(values.stats).filter((s) => s.ts && s.name);
  // Docker chỉ giữ lần OOM/khởi động lại cuối; gán cho khoảng chứa thời điểm đó.
  const restarted = await restartedContainers(values.project, Date.parse(summary.setup_started_at ?? summary.started_at));
  const restartsInRange = (from, to) => restarted.filter((c) => c.at >= from && c.at < to).map((c) => c.name);

  let report;
  if (values.steps) {
    const overlapByStep = Object.fromEntries(summary.steps.map((s) => [s.index, s.accounts_overlapping ?? 0]));
    report = {
      run_id: summary.run_id,
      phase,
      ...evaluateSteps({ summary: { ...summary, phase }, p95, actions, sessions, samples, restartsInRange, overlapByStep, sampleS, hostCpus }),
    };
    const bound = report.lambda_knee_lower_bound ? '≥ ' : '';
    console.log(`λ_knee = ${bound}${report.lambda_knee_per_s ?? 'không xác định'} phiên/s; đã tới bậc tối đa: ${report.reached_max_rate}`);
    if (report.k6_dropped_unattributed > 0) {
      console.log(`cảnh báo: ${report.k6_dropped_unattributed} iteration bị bỏ không gán được cho bậc nào`);
    }
    for (const step of report.steps) {
      console.log(
        `bậc ${step.step} (${step.rate_per_s.toFixed(2)}/s): ${step.pass ? 'khỏe' : `KHÔNG (${step.failed.join(', ')}; ${step.cause.side} ${step.cause.reasons.join(' ')})`}` +
          ` p95 ${step.criteria.gateway_p95.value?.toFixed(3) ?? 'n/a'} s, lỗi ${(100 * (step.criteria.unexpected_rate.value ?? 0)).toFixed(2)}%`,
      );
    }
  } else {
    const result = evaluateHealth({
      p95,
      actions,
      sessions,
      samples,
      from: fromMs,
      to: toMs,
      phase,
      dropped: summary.dropped_iterations ?? 0,
      restarts: restartsInRange(fromMs, toMs + 1),
      sampleS,
      hostCpus,
    });
    report = { run_id: summary.run_id, phase, ...result };
    console.log(`${summary.run_id}: ${result.pass ? 'khỏe' : `không khỏe (${result.failed.join(', ')})`}`);
  }
  if (values.out) writeFileSync(values.out, `${JSON.stringify(report, null, 2)}\n`);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2)).then(
    (code) => (process.exitCode = code),
    (error) => {
      console.error(error.message);
      process.exitCode = 2;
    },
  );
}
