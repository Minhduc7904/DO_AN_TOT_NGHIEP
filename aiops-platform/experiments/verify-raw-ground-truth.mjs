#!/usr/bin/env node
/**
 * Đối chiếu `RunGroundTruth` của một fault run với nhật ký fault và telemetry thô, **không qua code
 * ground truth** (Gate M3, card task-08 tuần 15). Truy vấn thẳng Prometheus, Tempo, Loki của stack
 * vừa chạy run, nên phải chạy **ngay sau run, trước khi run sau reset stack** (reset xóa volume).
 *
 *   node aiops-platform/experiments/verify-raw-ground-truth.mjs <thư mục run> \
 *     [--prometheus-url http://127.0.0.1:9090] [--tempo-url http://127.0.0.1:3200] \
 *     [--loki-url http://127.0.0.1:3100] [--out <run>/raw-verification.json]
 *
 * Kiểm (mỗi kiểm ghi truy vấn và số đo):
 * 1. `fault_start`/`fault_end` của ground truth trùng `ts` của `fault.activate`/`fault.deactivate`
 *    thành công trong `faults.jsonl`; thành phần gốc trùng `fault.scheduled` và fault manifest.
 * 2. Prometheus: thành phần gốc đổi hành vi trong cửa sổ fault so với 300 s trước fault (latency trung
 *    bình ≥ 2 lần với C2/C3/C4, bỏ `ping` của probe; C6: CPU `identity` đứng yên, lỗi token tăng), và
 *    thời điểm lệch đầu tiên nằm trong cửa sổ fault.
 * 3. Tempo (TraceQL): span của thành phần gốc trong cửa sổ fault chậm hoặc lỗi so với trước fault.
 * 4. Loki (C6): log `dependency.failure` của gateway với `gateway-identity-token` trong cửa sổ fault.
 *
 * Mã thoát 0 khi mọi kiểm đạt, 1 khi có kiểm không đạt, 2 khi lỗi.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

export const BASELINE_S = 300;
/** Bỏ đầu cửa sổ fault (như `verification_checks`): độ trễ thu thập và lời gọi đang dở. */
export const SETTLE_S = 15;
export const LATENCY_RATIO = 2;

/** Thành phần gốc và tín hiệu thô của từng case (độc lập với `ground_truth/cases.py`). */
export const CASE_RAW = Object.freeze({
  C2: { component: 'course-postgres', kind: 'latency' },
  C3: { component: 'ai-llm-provider', kind: 'latency' },
  C4: { component: 'media-minio', kind: 'latency' },
  C6: { component: 'identity', kind: 'unavailable', tokenDependency: 'gateway-identity-token' },
});

const iso = (ms) => new Date(ms).toISOString();

/** `faults.jsonl` → mốc bật/tắt thành công và lịch. */
export function readFaultLog(text) {
  const events = text
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
  const pick = (name) => events.find((event) => event.event === name && event.ok !== false) ?? null;
  return {
    scheduled: events.find((event) => event.event === 'fault.scheduled') ?? null,
    activate: pick('fault.activate'),
    deactivate: pick('fault.deactivate'),
  };
}

function check(name, pass, observed, expected, query = null) {
  return { check: name, pass: Boolean(pass), observed, expected, ...(query ? { query } : {}) };
}

/** Kiểm 1: mốc và thành phần gốc so với nhật ký fault và manifest. */
export function compareWithFaultLog(groundTruth, log, manifestCase) {
  const caseId = groundTruth.fault_parameters?.case_id;
  const delta = (a, b) => (a && b ? Math.abs(Date.parse(a) - Date.parse(b)) : null);
  const startDelta = delta(groundTruth.fault_start, log.activate?.ts);
  const endDelta = delta(groundTruth.fault_end, log.deactivate?.ts);
  return [
    check('fault_start_matches_log', startDelta !== null && startDelta <= 1, groundTruth.fault_start, log.activate?.ts ?? null),
    check('fault_end_matches_log', endDelta !== null && endDelta <= 1, groundTruth.fault_end, log.deactivate?.ts ?? null),
    check(
      'root_cause_matches_schedule_and_manifest',
      groundTruth.root_cause_component === log.scheduled?.root_cause_component &&
        groundTruth.root_cause_component === manifestCase?.root_cause_component &&
        groundTruth.root_cause_component === CASE_RAW[caseId]?.component &&
        groundTruth.root_cause_service === manifestCase?.root_cause_service,
      { service: groundTruth.root_cause_service, component: groundTruth.root_cause_component },
      {
        scheduled: log.scheduled?.root_cause_component ?? null,
        manifest: manifestCase ? `${manifestCase.root_cause_service}/${manifestCase.root_cause_component}` : null,
      },
    ),
  ];
}

/** PromQL: latency trung bình của một dependency trong `windowS` giây kết thúc tại thời điểm truy vấn. */
export function meanLatencyQuery(dependency, windowS) {
  const sel = `{dependency_identity="${dependency}",operation_name!="ping"}`;
  return (
    `sum(increase(lms_dependency_duration_seconds_sum${sel}[${windowS}s])) / ` +
    `sum(increase(lms_dependency_duration_seconds_count${sel}[${windowS}s]))`
  );
}

export function counterQuery(metric, labels, windowS) {
  const sel = Object.entries(labels)
    .map(([key, value]) => `${key}="${value}"`)
    .join(',');
  return `sum(increase(${metric}{${sel}}[${windowS}s]))`;
}

/** Điểm đầu tiên sau `fromMs` mà giá trị vượt ngưỡng ở hai điểm cách nhau ≥ `gapMs` liên tiếp. */
export function firstSustained(points, fromMs, exceeds, gapMs = 15_000) {
  const after = points.filter(([ts, value]) => ts > fromMs && value !== null);
  for (const [ts, value] of after) {
    if (!exceeds(value)) continue;
    const next = after.find(([other]) => other >= ts + gapMs);
    if (next && exceeds(next[1])) return ts;
  }
  return null;
}

/** Trung vị (ms) và số span lỗi của các span khớp trong kết quả search của Tempo. */
export function summarizeTempo(body) {
  const durations = [];
  let errors = 0;
  for (const trace of body?.traces ?? []) {
    for (const set of trace.spanSets ?? (trace.spanSet ? [trace.spanSet] : [])) {
      for (const span of set.spans ?? []) {
        durations.push(Number(span.durationNanos) / 1e6);
        const status = (span.attributes ?? []).find((attribute) => attribute.key === 'status');
        if (status?.value?.stringValue === 'error') errors += 1;
      }
    }
  }
  durations.sort((a, b) => a - b);
  const median = durations.length ? durations[Math.floor(durations.length / 2)] : null;
  return { spans: durations.length, median_ms: median, error_spans: errors };
}

async function getJson(url, timeoutMs = 60_000) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`${url.split('?')[0]}: HTTP ${response.status} ${(await response.text()).slice(0, 200)}`);
  return response.json();
}

function promClient(base) {
  const scalar = (body) => {
    const sample = body?.data?.result?.[0]?.value;
    return sample ? Number(sample[1]) : null;
  };
  return {
    async instant(query, atMs) {
      const url = `${base}/api/v1/query?${new URLSearchParams({ query, time: String(atMs / 1000) })}`;
      const value = scalar(await getJson(url));
      return Number.isNaN(value) ? null : value;
    },
    async range(query, startMs, endMs, stepS = 5) {
      const params = new URLSearchParams({ query, start: String(startMs / 1000), end: String(endMs / 1000), step: String(stepS) });
      const body = await getJson(`${base}/api/v1/query_range?${params}`);
      return (body?.data?.result?.[0]?.values ?? []).map(([ts, value]) => [ts * 1000, Number.isNaN(Number(value)) ? null : Number(value)]);
    },
  };
}

async function tempoSearch(base, traceql, startMs, endMs) {
  const params = new URLSearchParams({
    q: traceql,
    start: String(Math.floor(startMs / 1000)),
    end: String(Math.ceil(endMs / 1000)),
    limit: '500',
    spss: '50',
  });
  return summarizeTempo(await getJson(`${base}/api/search?${params}`));
}

async function lokiCount(base, query, atMs) {
  const url = `${base}/loki/api/v1/query?${new URLSearchParams({ query, time: String(atMs * 1e6) })}`;
  const body = await getJson(url);
  const sample = body?.data?.result?.[0]?.value;
  return sample ? Number(sample[1]) : 0;
}

/** Kiểm 2–4 trên telemetry thô. */
export async function verifyRaw(groundTruth, urls) {
  const caseId = groundTruth.fault_parameters?.case_id;
  const spec = CASE_RAW[caseId];
  if (!spec) throw new Error(`Không có cấu hình kiểm thô cho case ${caseId}`);
  const fs = Date.parse(groundTruth.fault_start);
  const fe = Date.parse(groundTruth.fault_end);
  const activeS = Math.round((fe - fs) / 1000) - SETTLE_S;
  const prom = promClient(urls.prometheus);
  const checks = [];

  if (spec.kind === 'latency') {
    const baseQuery = meanLatencyQuery(spec.component, BASELINE_S);
    const faultQuery = meanLatencyQuery(spec.component, activeS);
    const before = await prom.instant(baseQuery, fs);
    const during = await prom.instant(faultQuery, fe);
    checks.push(
      check(
        'prometheus_root_cause_latency_increased',
        during !== null && (before === null ? during >= 0.1 : during >= LATENCY_RATIO * before),
        { baseline_mean_s: before, fault_mean_s: during },
        `≥ ${LATENCY_RATIO} × trước fault (hoặc ≥ 0,1 s khi trước fault không có lời gọi)`,
        { baseline: `${baseQuery} @ fault_start`, fault: `${faultQuery} @ fault_end` },
      ),
    );
    const onsetQuery = meanLatencyQuery(spec.component, 15);
    const points = await prom.range(onsetQuery, fs - BASELINE_S * 1000, fe, 5);
    const threshold = before === null ? 0.1 : LATENCY_RATIO * before;
    const onset = firstSustained(points, fs, (value) => value >= threshold);
    checks.push(
      check(
        'prometheus_onset_inside_fault_window',
        onset !== null && onset > fs && onset <= fe,
        { onset: onset === null ? null : iso(onset), lag_s: onset === null ? null : (onset - fs) / 1000 },
        `trong (${iso(fs)}, ${iso(fe)}]`,
        `${onsetQuery} (range, step 5s)`,
      ),
    );
    const traceql = `{ span.dependency_identity = "${spec.component}" && name !~ ".*ping.*" }`;
    const tBefore = await tempoSearch(urls.tempo, traceql, fs - BASELINE_S * 1000, fs);
    const tDuring = await tempoSearch(urls.tempo, traceql, fs + SETTLE_S * 1000, fe);
    checks.push(
      check(
        'tempo_root_cause_spans_slower',
        tDuring.spans > 0 &&
          (tBefore.median_ms === null ? tDuring.median_ms >= 100 : tDuring.median_ms >= LATENCY_RATIO * tBefore.median_ms),
        { before: tBefore, during: tDuring },
        `trung vị span trong fault ≥ ${LATENCY_RATIO} × trước fault`,
        `${traceql} (search, limit 500, spss 50)`,
      ),
    );
  } else {
    const cpuBase = counterQuery('process_cpu_time_seconds_total', { service_name: spec.component }, BASELINE_S);
    // Bỏ 30 s đầu: mẫu cuối trước khi pause còn nằm trong cửa sổ 5 s.
    const stalledS = activeS - SETTLE_S;
    const cpuFault = counterQuery('process_cpu_time_seconds_total', { service_name: spec.component }, stalledS);
    const cpuBefore = await prom.instant(cpuBase, fs);
    const cpuDuring = await prom.instant(cpuFault, fe);
    checks.push(
      check(
        'prometheus_identity_cpu_stalled',
        cpuBefore > 0 && (cpuDuring ?? 0) === 0,
        { cpu_s_before: cpuBefore, cpu_s_during: cpuDuring },
        'CPU tăng trước fault, đứng yên trong fault',
        { baseline: `${cpuBase} @ fault_start`, fault: `${cpuFault} @ fault_end` },
      ),
    );
    const tokenLabels = { service_name: 'gateway', dependency_identity: spec.tokenDependency };
    const errQuery = counterQuery('lms_dependency_error_count_total', tokenLabels, activeS + SETTLE_S);
    const errBaseQuery = counterQuery('lms_dependency_error_count_total', tokenLabels, BASELINE_S);
    const errors = await prom.instant(errQuery, fe);
    const errorsBefore = await prom.instant(errBaseQuery, fs);
    checks.push(
      check(
        'prometheus_gateway_token_errors_increased',
        (errors ?? 0) > (errorsBefore ?? 0),
        { errors_before: errorsBefore, errors_during: errors },
        'lỗi token của gateway tăng trong fault',
        { baseline: `${errBaseQuery} @ fault_start`, fault: `${errQuery} @ fault_end` },
      ),
    );
    const traceql = `{ span.dependency_identity = "${spec.tokenDependency}" && status = error }`;
    const tDuring = await tempoSearch(urls.tempo, traceql, fs, fe);
    const tBefore = await tempoSearch(urls.tempo, traceql, fs - BASELINE_S * 1000, fs);
    checks.push(
      check(
        'tempo_gateway_token_error_spans',
        tDuring.spans > 0 && tBefore.spans === 0,
        { before: tBefore, during: tDuring },
        'có span lỗi token trong fault, không có trước fault',
        `${traceql} (search, limit 500, spss 50)`,
      ),
    );
    const windowS = Math.round((fe - fs) / 1000);
    const logQuery = `sum(count_over_time({service_name="gateway"} | event="dependency.failure" | dependency_identity="${spec.tokenDependency}" [${windowS}s]))`;
    const logBaseQuery = logQuery.replace(`[${windowS}s]`, `[${BASELINE_S}s]`);
    const logs = await lokiCount(urls.loki, logQuery, fe);
    const logsBefore = await lokiCount(urls.loki, logBaseQuery, fs);
    checks.push(
      check(
        'loki_gateway_dependency_failure_logs',
        logs > 0 && logsBefore === 0,
        { logs_before: logsBefore, logs_during: logs },
        'có log dependency.failure của gateway-identity-token trong fault, không có trước fault',
        { baseline: `${logBaseQuery} @ fault_start`, fault: `${logQuery} @ fault_end` },
      ),
    );
  }
  return checks;
}

async function main(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      'prometheus-url': { type: 'string', default: 'http://127.0.0.1:9090' },
      'tempo-url': { type: 'string', default: 'http://127.0.0.1:3200' },
      'loki-url': { type: 'string', default: 'http://127.0.0.1:3100' },
      manifest: { type: 'string' },
      out: { type: 'string' },
    },
  });
  const runDir = positionals[0];
  if (!runDir) throw new Error('Thiếu thư mục run');
  const groundTruth = JSON.parse(readFileSync(join(runDir, 'ground-truth.json'), 'utf8'));
  const log = readFaultLog(readFileSync(join(runDir, 'faults.jsonl'), 'utf8'));
  const manifestPath =
    values.manifest ?? new URL('../faults/manifests/fault-manifest-v2.json', import.meta.url).pathname;
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const caseId = groundTruth.fault_parameters?.case_id;
  const manifestCase = manifest.cases.find((item) => item.case_id === caseId);
  const checks = [
    ...compareWithFaultLog(groundTruth, log, manifestCase),
    ...(await verifyRaw(groundTruth, {
      prometheus: values['prometheus-url'],
      tempo: values['tempo-url'],
      loki: values['loki-url'],
    })),
  ];
  const report = {
    schema: 'raw-ground-truth-verification.v1',
    run_id: groundTruth.run_id,
    case_id: caseId,
    generated_at: new Date().toISOString(),
    fault_start: groundTruth.fault_start,
    fault_end: groundTruth.fault_end,
    pass: checks.every((item) => item.pass),
    checks,
  };
  const out = values.out ?? join(runDir, 'raw-verification.json');
  writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ run_id: report.run_id, case_id: caseId, pass: report.pass, failed: checks.filter((c) => !c.pass).map((c) => c.check) }));
  return report.pass ? 0 : 1;
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
