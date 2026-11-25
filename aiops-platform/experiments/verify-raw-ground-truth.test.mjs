import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  CASE_RAW,
  compareWithFaultLog,
  counterQuery,
  firstSustained,
  meanLatencyQuery,
  readFaultLog,
  summarizeTempo,
} from './verify-raw-ground-truth.mjs';

const MANIFEST = JSON.parse(
  readFileSync(new URL('../faults/manifests/fault-manifest-v2.json', import.meta.url), 'utf8'),
);

const LOG = [
  { ts: '2026-11-23T07:37:59.041Z', event: 'fault.precheck', case_id: 'C6', ok: true },
  {
    ts: '2026-11-23T07:37:59.042Z',
    event: 'fault.scheduled',
    case_id: 'C6',
    root_cause_service: 'identity',
    root_cause_component: 'identity',
  },
  { ts: '2026-11-23T08:04:27.120Z', event: 'fault.activate', case_id: 'C6', ok: true },
  { ts: '2026-11-23T08:09:27.107Z', event: 'fault.deactivate', case_id: 'C6', ok: true },
]
  .map((event) => JSON.stringify(event))
  .join('\n');

const GT = {
  run_id: 'r',
  fault_parameters: { case_id: 'C6' },
  fault_start: '2026-11-23T08:04:27.120Z',
  fault_end: '2026-11-23T08:09:27.107Z',
  root_cause_service: 'identity',
  root_cause_component: 'identity',
};

test('cấu hình kiểm thô khớp thành phần gốc của fault manifest v2', () => {
  for (const item of MANIFEST.cases) {
    assert.equal(CASE_RAW[item.case_id].component, item.root_cause_component, item.case_id);
  }
});

test('mốc và thành phần gốc khớp nhật ký fault; lệch thì không đạt', () => {
  const caseC6 = MANIFEST.cases.find((item) => item.case_id === 'C6');
  const log = readFaultLog(LOG);
  assert.ok(compareWithFaultLog(GT, log, caseC6).every((item) => item.pass));

  const shifted = compareWithFaultLog({ ...GT, fault_start: '2026-11-23T08:04:30.000Z' }, log, caseC6);
  assert.equal(shifted.find((item) => item.check === 'fault_start_matches_log').pass, false);
  const wrong = compareWithFaultLog({ ...GT, root_cause_component: 'gateway' }, log, caseC6);
  assert.equal(wrong.find((item) => item.check === 'root_cause_matches_schedule_and_manifest').pass, false);
  // Bật lỗi (ok: false) thì không có mốc bật.
  const failed = readFaultLog(LOG.replace('"event":"fault.activate","case_id":"C6","ok":true', '"event":"fault.activate","case_id":"C6","ok":false'));
  assert.equal(failed.activate, null);
  assert.equal(compareWithFaultLog(GT, failed, caseC6)[0].pass, false);
});

test('PromQL bỏ ping của probe và tính trung bình từ sum/count', () => {
  const query = meanLatencyQuery('media-minio', 300);
  assert.match(query, /operation_name!="ping"/u);
  assert.match(query, /lms_dependency_duration_seconds_sum\{[^}]*\}\[300s\].*\/.*_count/u);
  assert.equal(
    counterQuery('process_cpu_time_seconds_total', { service_name: 'identity' }, 270),
    'sum(increase(process_cpu_time_seconds_total{service_name="identity"}[270s]))',
  );
});

test('onset cần hai điểm cách nhau ≥ 15 s cùng vượt ngưỡng, chỉ xét sau fault_start', () => {
  const at = (s, value) => [1_000_000 + s * 1000, value];
  const points = [at(-10, 9), at(5, 9), at(10, 0.1), at(15, 0.1), at(20, 9), at(25, 9), at(35, 9)];
  // Điểm 5 s vượt nhưng 20 s sau (25 s) không có… 20 s có, nhưng 5 + 15 = 20 → điểm 20 vượt → onset 5.
  assert.equal(firstSustained(points, 1_000_000, (v) => v >= 1), 1_005_000);
  const single = [at(5, 9), at(20, 0.1), at(30, 0.1)];
  assert.equal(firstSustained(single, 1_000_000, (v) => v >= 1), null);
  assert.equal(firstSustained([at(-5, 9), at(10, 9)], 1_000_000, (v) => v >= 1), null);
});

test('tóm tắt kết quả search của Tempo: trung vị và số span', () => {
  const body = {
    traces: [
      { spanSets: [{ spans: [{ durationNanos: '300000000' }, { durationNanos: '100000000' }] }] },
      { spanSet: { spans: [{ durationNanos: '200000000' }] } },
    ],
  };
  assert.deepEqual(summarizeTempo(body), { spans: 3, median_ms: 200, error_spans: 0 });
  assert.deepEqual(summarizeTempo({}), { spans: 0, median_ms: null, error_spans: 0 });
});
