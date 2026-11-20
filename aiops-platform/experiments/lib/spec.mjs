/**
 * Run spec (`run-spec.v1`): mô tả một run thí nghiệm, đủ để runner dựng lại từ đầu.
 *
 * Quy tắc theo evaluation-protocol-v1 mục 5.5, 8.6 và workload-design-v1 mục 11.3–11.4:
 * - `run_id` không bao giờ dùng lại; chạy lại là run mới, có thể ghi `replacement_for_run_id`.
 * - `workload_seed` phải nằm trong khoảng của split (pilot 1–999, train 1000–1999, validation
 *   2000–2999, test 3000–3999).
 * - Fault run của validation/test có `repeat_index` ≥ 1 (lần lặp 1 cho validation, 2..R cho test).
 */

export const SPEC_SCHEMA = 'run-spec.v1';

export const SEED_RANGES = Object.freeze({
  pilot: [1, 999],
  train: [1000, 1999],
  validation: [2000, 2999],
  test: [3000, 3999],
});

export const PROFILES = Object.freeze(['normal-mixed', 'healthy-spike']);
export const CASES = Object.freeze(['C2', 'C3', 'C4', 'C6']);
export const RUN_ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,95}$/u;
export const DEFAULT_SERVICE_TOKEN_TTL_S = 60;
/** Dữ liệu seed R-10 mặc định (aiops-platform/load/README.md mục chuẩn bị). */
export const DEFAULT_DATA_SEED = Object.freeze({ profile: 'small', seed: 42 });

function isInteger(value) {
  return Number.isInteger(value);
}

/** Trả danh sách lỗi (rỗng khi hợp lệ). */
export function validateSpec(spec) {
  const errors = [];
  if (!spec || typeof spec !== 'object') return ['spec phải là object'];
  if (spec.schema !== SPEC_SCHEMA) errors.push(`schema phải là ${SPEC_SCHEMA}`);
  if (!(spec.split in SEED_RANGES)) errors.push(`split lạ: ${spec.split}`);
  if (spec.run_id !== undefined && !RUN_ID_PATTERN.test(spec.run_id)) {
    errors.push(`run_id không hợp lệ: ${spec.run_id}`);
  }
  if (!isInteger(spec.repeat_index) || spec.repeat_index < 0) {
    errors.push('repeat_index phải là số nguyên ≥ 0');
  }
  const workload = spec.workload ?? {};
  if (!PROFILES.includes(workload.profile)) errors.push(`profile lạ: ${workload.profile}`);
  if (!isInteger(workload.seed)) {
    errors.push('workload.seed phải là số nguyên');
  } else if (spec.split in SEED_RANGES) {
    const [low, high] = SEED_RANGES[spec.split];
    if (workload.seed < low || workload.seed > high) {
      errors.push(`workload.seed ${workload.seed} ngoài khoảng ${low}–${high} của split ${spec.split}`);
    }
  }
  if (workload.plan !== undefined && (typeof workload.plan !== 'string' || workload.plan.includes('..'))) {
    errors.push('workload.plan phải là đường dẫn trong aiops-platform/load/ (không chứa "..")');
  }
  const fault = spec.fault ?? null;
  if (fault !== null) {
    if (!CASES.includes(fault.case)) errors.push(`fault.case lạ: ${fault.case}`);
    if (fault.align_peak !== undefined && typeof fault.align_peak !== 'boolean') {
      errors.push('fault.align_peak phải là boolean');
    }
    if (fault.align_peak && fault.start_s !== undefined) {
      errors.push('fault.align_peak và fault.start_s loại trừ nhau');
    }
    for (const key of ['start_s', 'duration_s']) {
      if (fault[key] !== undefined && (!isInteger(fault[key]) || fault[key] <= 0)) {
        errors.push(`fault.${key} phải là số nguyên dương`);
      }
    }
    if (['validation', 'test'].includes(spec.split) && spec.repeat_index < 1) {
      errors.push('fault run của validation/test cần repeat_index ≥ 1');
    }
  }
  const ttl = spec.environment?.service_token_ttl_s;
  if (ttl !== undefined && (!isInteger(ttl) || ttl <= 0)) {
    errors.push('environment.service_token_ttl_s phải là số nguyên dương');
  }
  const dataSeed = spec.data_seed;
  if (dataSeed !== undefined) {
    if (typeof dataSeed?.profile !== 'string' || !isInteger(dataSeed?.seed)) {
      errors.push('data_seed cần { profile: chuỗi, seed: số nguyên }');
    }
  }
  if (spec.replacement_for_run_id !== undefined && !RUN_ID_PATTERN.test(spec.replacement_for_run_id)) {
    errors.push('replacement_for_run_id không hợp lệ');
  }
  return errors;
}

/** Spec đã chuẩn hóa: điền giá trị mặc định và `run_id` khi chưa có. */
export function normalizeSpec(spec, now = new Date()) {
  const errors = validateSpec(spec);
  if (errors.length > 0) throw new Error(`Run spec không hợp lệ: ${errors.join('; ')}`);
  const stamp = now.toISOString().replace(/[-:]/gu, '').replace(/\.\d+Z$/u, 'Z').toLowerCase();
  const kind = spec.fault ? spec.fault.case.toLowerCase() : 'healthy';
  return {
    ...spec,
    run_id:
      spec.run_id ?? `${spec.split}-${kind}-${spec.workload.profile}-s${spec.workload.seed}-${stamp}`,
    fault: spec.fault ?? null,
    data_seed: { ...DEFAULT_DATA_SEED, ...(spec.data_seed ?? {}) },
    environment: {
      service_token_ttl_s: DEFAULT_SERVICE_TOKEN_TTL_S,
      ...(spec.environment ?? {}),
    },
  };
}

/** Kế hoạch phiên mà k6 sẽ đọc (cùng mặc định với model/student-scenario.js). */
export function planPath(spec) {
  return spec.workload.plan ?? `data/plans/moodle-${spec.workload.profile}-k4-v1.json`;
}
