/**
 * Run có được nhận cho primary evaluation không (evaluation-protocol-v1 mục 6.1.1 bảng F, mục 8.3).
 *
 * Đọc artifact của run, không chỉ danh sách `reasons` của quality report: lỗi tải trace lẻ tẻ không
 * `aborted` không sinh lý do nào nên phải đọc `stats.traces` của manifest export.
 *
 * - Điều kiện chung: metric và log không `empty`.
 * - Điều kiện của trace (không đạt thì chỉ loại variant có trace, variant chỉ metric vẫn dùng được, mục
 *   8.3): trace không `empty`; `stats.traces` không `aborted`, `fetch_errors`, `not_found`,
 *   `parse_errors` bằng 0; độ phủ ứng viên (trace ứng viên không nhiễu ÷ request k6) ≥
 *   `MIN_CANDIDATE_COVERAGE`.
 * - Lý do `partial` được nhận: `truncated_modality:traces` với `dropped_by_budget` = 0, hoặc > 0 chỉ ở
 *   run healthy (trace là mẫu đều, ghi tỉ lệ giữ); `duplicates` khi metric và span không trùng, log trùng
 *   ≤ 0,1%; `telemetry_silent:identity` ở run C6 khi mọi khoảng im lặng nằm trong cửa sổ fault.
 * - Không nhận cho variant có trace: `partial_modality:traces` (export trace bị ngắt) và fault run có
 *   `dropped_by_budget` > 0. Variant chỉ metric vẫn dùng được.
 * - Lý do khác: run không được nhận.
 */

export const ELIGIBILITY_VERSION = 'eligibility.v1';
export const MIN_CANDIDATE_COVERAGE = 0.98;
export const MAX_DUPLICATE_LOG_SHARE = 0.001;
/** Khoảng im lặng có thể bắt đầu trước `fault_start` tối đa một chu kỳ scrape (mẫu cuối trước pause). */
export const SILENT_START_SLACK_MS = 5_000;
export const SILENT_END_SLACK_MS = 30_000;

const ms = (iso) => Date.parse(iso);

/**
 * `run` = `{ caseId, groundTruth, quality, telemetryManifest, workloadManifest }` (JSON đã đọc; thiếu
 * thì null). Trả `{ version, eligible, trace_variants, retention, coverage, accepted, trace_exclusions,
 * violations }`: `eligible` = dùng được cho variant chỉ metric; `trace_exclusions` = lý do loại variant
 * có trace.
 * `trace_variants`: `full` | `sampled` (mẫu do ngân sách, chỉ run healthy) | `excluded`.
 */
export function primaryEligibility({ caseId, groundTruth, quality, telemetryManifest, workloadManifest }) {
  const violations = [];
  const accepted = [];
  const traceExclusions = [];
  let traceVariants = 'full';
  const exclude = (why) => {
    traceVariants = 'excluded';
    traceExclusions.push(why);
  };
  if (!quality || !telemetryManifest) {
    return {
      version: ELIGIBILITY_VERSION,
      eligible: false,
      trace_variants: 'excluded',
      retention: null,
      coverage: null,
      accepted,
      trace_exclusions: traceExclusions,
      violations: ['thiếu quality-report.json hoặc manifest export'],
    };
  }
  if (quality.overall_status === 'fail') violations.push('chất lượng fail');

  for (const [modality, state] of Object.entries(telemetryManifest.modality_availability ?? {})) {
    if (state !== 'empty') continue;
    if (modality === 'traces') exclude('trace empty');
    else violations.push(`modality ${modality} empty`);
  }
  const traces = telemetryManifest.stats?.traces ?? {};
  if (traces.aborted) exclude('export trace aborted');
  for (const field of ['fetch_errors', 'not_found', 'parse_errors']) {
    if ((traces[field] ?? 0) !== 0) exclude(`stats.traces.${field} = ${traces[field]}`);
  }
  const candidates = (traces.candidates ?? 0) - (traces.noise_excluded ?? 0);
  const requests = workloadManifest?.http_reqs ?? null;
  const coverage = requests ? candidates / requests : null;
  if (coverage === null) exclude('không có http_reqs của k6 để tính độ phủ ứng viên');
  else if (coverage < MIN_CANDIDATE_COVERAGE) {
    exclude(`độ phủ ứng viên ${coverage.toFixed(3)} < ${MIN_CANDIDATE_COVERAGE}`);
  }
  const dropped = traces.dropped_by_budget ?? 0;
  const retention = candidates > 0 ? (candidates - dropped) / candidates : null;

  for (const reason of quality.reasons ?? []) {
    if (reason === 'truncated_modality:traces') {
      if (dropped === 0) accepted.push(reason);
      else if (caseId === null) {
        traceVariants = traceVariants === 'excluded' ? 'excluded' : 'sampled';
        accepted.push(`${reason} (mẫu do ngân sách, giữ ${(retention * 100).toFixed(1)}%)`);
      } else exclude(`fault run bỏ ${dropped} trace vì ngân sách`);
    } else if (reason === 'partial_modality:traces') {
      exclude('export trace bị ngắt (source outage)');
    } else if (reason === 'duplicates') {
      const dup = quality.duplicate_quality ?? {};
      const logs = quality.logs_quality?.log_count ?? 0;
      const logShare = logs > 0 ? (dup.duplicate_log_record_count ?? 0) / logs : 0;
      if ((dup.duplicate_metric_record_count ?? 0) > 0) violations.push('metric trùng');
      else if ((dup.duplicate_span_id_count ?? 0) > 0) violations.push('span_id trùng');
      else if (logShare > MAX_DUPLICATE_LOG_SHARE)
        violations.push(`log trùng ${(logShare * 100).toFixed(2)}%`);
      else accepted.push(reason);
    } else if (reason === 'telemetry_silent:identity' && caseId === 'C6') {
      const intervals = quality.runtimes?.identity?.silent_intervals ?? [];
      const lo = ms(groundTruth?.fault_start) - SILENT_START_SLACK_MS;
      const hi = ms(groundTruth?.fault_end) + SILENT_END_SLACK_MS;
      const outside = intervals.filter((item) => !(ms(item.start) >= lo && ms(item.end) <= hi));
      if (!groundTruth?.fault_start || outside.length > 0) {
        violations.push('telemetry_silent:identity ngoài cửa sổ fault');
      } else accepted.push(reason);
    } else {
      violations.push(`lý do partial không được nhận: ${reason}`);
    }
  }
  return {
    version: ELIGIBILITY_VERSION,
    eligible: violations.length === 0,
    trace_variants: violations.length === 0 ? traceVariants : 'excluded',
    retention,
    coverage,
    accepted,
    trace_exclusions: traceExclusions,
    violations,
  };
}
