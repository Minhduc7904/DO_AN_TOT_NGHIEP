import assert from 'node:assert/strict';
import { test } from 'node:test';

import { primaryEligibility } from './lib/eligibility.mjs';

const traces = (extra = {}) => ({
  candidates: 30_000,
  noise_excluded: 15_000,
  selected: 15_000,
  dropped_by_budget: 0,
  search_limit_hit: 16,
  fetch_errors: 0,
  not_found: 0,
  parse_errors: 0,
  aborted: false,
  ...extra,
});

const run = ({
  caseId = null,
  reasons = ['truncated_modality:traces'],
  stats = {},
  quality = {},
  http = 15_100,
  availability,
} = {}) => ({
  caseId,
  groundTruth: { fault_start: '2026-11-20T07:13:41.198Z', fault_end: '2026-11-20T07:18:41.201Z' },
  quality: {
    overall_status: 'partial',
    reasons,
    duplicate_quality: {
      duplicate_metric_record_count: 0,
      duplicate_span_id_count: 0,
      duplicate_log_record_count: 1,
    },
    logs_quality: { log_count: 20_000 },
    runtimes: {},
    ...quality,
  },
  telemetryManifest: {
    modality_availability: availability ?? { metrics: 'available', traces: 'truncated', logs: 'available' },
    stats: { traces: traces(stats) },
  },
  workloadManifest: { http_reqs: http },
});

test('run normal-mixed chỉ chạm giới hạn tìm kiếm, log trùng 1 dòng: nhận, trace đủ', () => {
  const result = primaryEligibility(run({ reasons: ['truncated_modality:traces', 'duplicates'] }));
  assert.equal(result.eligible, true);
  assert.equal(result.trace_variants, 'full');
  assert.equal(result.retention, 1);
  assert.ok(Math.abs(result.coverage - 15_000 / 15_100) < 1e-9);
});

test('trace bỏ vì ngân sách: run healthy nhận dạng mẫu, fault run loại variant có trace', () => {
  const sampled = primaryEligibility(run({ stats: { dropped_by_budget: 7_000, selected: 8_000 } }));
  assert.equal(sampled.eligible, true);
  assert.equal(sampled.trace_variants, 'sampled');
  assert.ok(Math.abs(sampled.retention - 8 / 15) < 1e-9);
  const fault = primaryEligibility(run({ caseId: 'C2', stats: { dropped_by_budget: 7_000 } }));
  assert.equal(fault.eligible, true);
  assert.equal(fault.trace_variants, 'excluded');
});

test('lỗi tải trace không sinh lý do nào vẫn bị bắt khi đọc stats.traces; chỉ loại variant có trace', () => {
  const result = primaryEligibility(
    run({ reasons: [], quality: { overall_status: 'pass' }, stats: { fetch_errors: 3 } }),
  );
  assert.equal(result.eligible, true);
  assert.equal(result.trace_variants, 'excluded');
  assert.match(result.trace_exclusions.join(), /fetch_errors = 3/u);
  assert.equal(primaryEligibility(run({ stats: { aborted: true } })).trace_variants, 'excluded');
});

test('độ phủ ứng viên thấp, trace empty, thiếu http_reqs: loại variant có trace; log empty: không nhận', () => {
  const low = primaryEligibility(run({ http: 30_000 }));
  assert.equal(low.trace_variants, 'excluded');
  assert.match(low.trace_exclusions.join(), /độ phủ ứng viên 0.500/u);
  const noTraces = run({ availability: { metrics: 'available', traces: 'empty', logs: 'available' } });
  assert.equal(primaryEligibility(noTraces).trace_variants, 'excluded');
  assert.equal(primaryEligibility(run({ http: null })).trace_variants, 'excluded');
  const empty = run({ availability: { metrics: 'available', traces: 'truncated', logs: 'empty' } });
  assert.equal(primaryEligibility(empty).eligible, false);
  assert.match(primaryEligibility(empty).violations.join(), /logs empty/u);
});

test('Tempo OOM giữa export: loại variant có trace', () => {
  const result = primaryEligibility(run({ reasons: ['partial_modality:traces'] }));
  assert.equal(result.eligible, true);
  assert.equal(result.trace_variants, 'excluded');
});

test('duplicates chỉ nhận khi metric/span không trùng và log trùng ≤ 0,1%', () => {
  const spans = run({
    reasons: ['duplicates'],
    quality: {
      duplicate_quality: {
        duplicate_metric_record_count: 0,
        duplicate_span_id_count: 2,
        duplicate_log_record_count: 0,
      },
    },
  });
  assert.equal(primaryEligibility(spans).eligible, false);
  const logs = run({
    reasons: ['duplicates'],
    quality: {
      duplicate_quality: {
        duplicate_metric_record_count: 0,
        duplicate_span_id_count: 0,
        duplicate_log_record_count: 30,
      },
    },
  });
  assert.match(primaryEligibility(logs).violations.join(), /log trùng 0.15%/u);
});

test('telemetry_silent:identity chỉ nhận ở C6 khi khoảng im lặng nằm trong cửa sổ fault', () => {
  const silent = (start, end) => ({ runtimes: { identity: { silent_intervals: [{ start, end }] } } });
  // Số đo của pilot-c6-normal-mixed-s22: im lặng 07:13:46–07:18:51, fault 07:13:41–07:18:41.
  const inside = run({
    caseId: 'C6',
    reasons: ['telemetry_silent:identity'],
    quality: silent('2026-11-20T07:13:46.154Z', '2026-11-20T07:18:51.154Z'),
  });
  assert.equal(primaryEligibility(inside).eligible, true);
  const late = run({
    caseId: 'C6',
    reasons: ['telemetry_silent:identity'],
    quality: silent('2026-11-20T07:13:46Z', '2026-11-20T07:19:30Z'),
  });
  assert.equal(primaryEligibility(late).eligible, false);
  const healthy = run({
    reasons: ['telemetry_silent:identity'],
    quality: silent('2026-11-20T07:13:46Z', '2026-11-20T07:18:51Z'),
  });
  assert.equal(primaryEligibility(healthy).eligible, false);
});

test('lý do khác và thiếu artifact: không nhận', () => {
  assert.equal(primaryEligibility(run({ reasons: ['low_log_trace_correlation'] })).eligible, false);
  const missing = primaryEligibility({
    caseId: null,
    groundTruth: null,
    quality: null,
    telemetryManifest: null,
    workloadManifest: null,
  });
  assert.equal(missing.eligible, false);
});
