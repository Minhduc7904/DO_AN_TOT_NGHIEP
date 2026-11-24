import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';

import { checkDataset } from './lib/dataset.mjs';

const sha = (text) => createHash('sha256').update(text).digest('hex');
const SPLIT_DAYS = { train: [0, 3, 4, 7], validation: [1, 5, 8, 10], test: [2, 6, 9, 11] };
const PLAN_DAYS = {
  train: { 'normal-mixed': [0, 3], 'healthy-spike': [4, 7] },
  validation: { 'normal-mixed': [1, 5], 'healthy-spike': [8, 10] },
  test: { 'normal-mixed': [2, 6], 'healthy-spike': [9, 11] },
};

/** Nội dung file kế hoạch giả cho từng split/profile (để kiểm sha256 và ngày). */
function planFile(split, profile, days = PLAN_DAYS[split][profile]) {
  return JSON.stringify({ profile, days, split: { name: split } });
}

function slot(split, profile, kase, repeat, seed, extra = {}) {
  return {
    slot_id: `${split}-${kase ?? 'healthy'}-${profile}-${repeat}-${seed}`,
    split,
    profile,
    case: kase,
    repeat_index: repeat,
    workload_seed: seed,
    align_peak: kase ? false : false,
    run_id: null,
    replaced_run_ids: [],
    ...extra,
  };
}

function manifest(slots) {
  const plans = {};
  for (const [split, profiles] of Object.entries(PLAN_DAYS)) {
    for (const [profile, days] of Object.entries(profiles)) {
      (plans[split] ??= {})[profile] = {
        path: `${split}-${profile}.json`,
        sha256: sha(planFile(split, profile)),
        days,
      };
    }
  }
  return {
    schema: 'dataset-manifest.v0',
    dataset_id: 'dataset-test',
    fault_manifest: { path: 'faults/manifests/fault-manifest-v2.json' },
    day_split: { rule: 'day-split-v1', holdout_days: [60, 90], days: SPLIT_DAYS },
    plans,
    slots,
  };
}

/** Một run đã xong và đạt mọi gate, đúng kế hoạch của split. */
function ledgerRun(runId, s, overrides = {}) {
  return [
    {
      event: 'run.started',
      run_id: runId,
      split: s.split,
      case_id: s.case,
      repeat_index: s.repeat_index,
      workload_profile: s.profile,
      workload_seed: s.workload_seed,
      replacement_for_run_id: null,
      ...overrides.started,
    },
    {
      event: 'run.finished',
      run_id: runId,
      status: 'completed',
      execution_gate: 'pass',
      data_quality: 'partial',
      ground_truth: 'valid',
      plan_sha256: sha(planFile(s.split, s.profile)),
      ...overrides.finished,
    },
  ];
}

const io = {
  readPlan: (path) => {
    const [split, ...rest] = path.replace(/\.json$/u, '').split('-');
    const text = planFile(split, rest.join('-'));
    return { text, json: JSON.parse(text) };
  },
  sha256: sha,
};

/** Manifest đủ độ phủ: 2 run train, 2 healthy validation, 4 fault validation (một trùng cao điểm). */
function complete() {
  const slots = [
    slot('train', 'normal-mixed', null, 0, 1001),
    slot('train', 'healthy-spike', null, 0, 1002),
    slot('validation', 'normal-mixed', null, 0, 2002),
    slot('validation', 'healthy-spike', null, 0, 2003),
    ...['C2', 'C3', 'C4', 'C6'].map((c) =>
      slot('validation', 'normal-mixed', c, 1, 2001, { align_peak: c === 'C2' }),
    ),
    slot('test', 'normal-mixed', 'C2', 2, 3001),
  ];
  const ledger = [];
  for (const s of slots.filter((item) => item.split !== 'test')) {
    s.run_id = `run-${s.slot_id}`;
    ledger.push(...ledgerRun(s.run_id, s));
  }
  return { m: manifest(slots), ledger };
}

test('manifest đủ độ phủ, đúng ledger và kế hoạch: không lỗi, không thiếu', () => {
  const { m, ledger } = complete();
  const result = checkDataset(m, ledger, io);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.pending, []);
  assert.deepEqual(result.warnings, []);
});

test('ngày log trùng giữa split, thuộc hold-out, hoặc kế hoạch dùng ngày của split khác', () => {
  const { m, ledger } = complete();
  m.day_split.days = { ...SPLIT_DAYS, test: [...SPLIT_DAYS.test, 3, 70] };
  m.plans.validation['normal-mixed'].days = [1, 2];
  const { errors } = checkDataset(m, ledger);
  assert.ok(errors.some((e) => /ngày log 3 ở cả train và test/u.test(e)));
  assert.ok(errors.some((e) => /ngày 70 của test thuộc hold-out/u.test(e)));
  assert.ok(errors.some((e) => /ngày 2 không thuộc nhóm ngày của validation/u.test(e)));
  assert.ok(errors.some((e) => /ngày log 2 ở kế hoạch của validation và test/u.test(e)));
});

test('sha256 hoặc ngày của file kế hoạch khác manifest; thiếu file chỉ là cảnh báo', () => {
  const { m, ledger } = complete();
  m.plans.train['normal-mixed'].sha256 = 'a'.repeat(64);
  const changedDays = {
    readPlan: (path) =>
      path.startsWith('test-healthy')
        ? { text: planFile('test', 'healthy-spike', [9]), json: { profile: 'healthy-spike', days: [9], split: { name: 'test' } } }
        : io.readPlan(path),
    sha256: sha,
  };
  const { errors } = checkDataset(m, ledger, changedDays);
  assert.ok(errors.some((e) => /plans.train.normal-mixed: sha256/u.test(e)));
  assert.ok(errors.some((e) => /plans.test.healthy-spike: ngày trong/u.test(e)));
  const missing = checkDataset(m, ledger, { readPlan: () => null, sha256: sha });
  assert.equal(missing.warnings.length, 6);
});

test('seed: ngoài khoảng, dùng ở hai split, fault cùng repeat_index khác seed', () => {
  const { m, ledger } = complete();
  m.slots.push(slot('train', 'normal-mixed', null, 0, 2002, { slot_id: 'dup-seed' }));
  m.slots.push(slot('validation', 'healthy-spike', null, 0, 1500, { slot_id: 'out-of-range' }));
  m.slots.find((s) => s.case === 'C4').workload_seed = 2004;
  const { errors } = checkDataset(m, ledger);
  assert.ok(errors.some((e) => /seed 2002 dùng ở cả validation và train/u.test(e)));
  assert.ok(errors.some((e) => /seed 1500 ngoài khoảng 2000–2999/u.test(e)));
  assert.ok(errors.some((e) => /phải dùng seed 2001/u.test(e)));
});

test('run của slot: không có trong ledger, sai gate, sai kế hoạch, sai slot, trùng run_id', () => {
  const { m, ledger } = complete();
  const [train, spike, , , c2, c3] = m.slots;
  train.run_id = 'missing-run';
  const bad = ledger.filter((e) => e.run_id !== spike.run_id);
  bad.push(
    ...ledgerRun(spike.run_id, spike, {
      finished: { execution_gate: 'fail', data_quality: 'fail', plan_sha256: 'b'.repeat(64) },
      started: { repeat_index: 3 },
    }),
  );
  c3.run_id = c2.run_id;
  const { errors } = checkDataset(m, bad);
  assert.ok(errors.some((e) => /missing-run.*không có run.started/u.test(e)));
  assert.ok(errors.some((e) => /gate thực thi fail/u.test(e)));
  assert.ok(errors.some((e) => /chất lượng fail/u.test(e)));
  assert.ok(errors.some((e) => /kế hoạch đã chạy/u.test(e)));
  assert.ok(errors.some((e) => /repeat_index trong ledger là 3/u.test(e)));
  assert.ok(errors.some((e) => /ở cả slot/u.test(e)));
});

test('test chỉ khai báo; fault run không vào train; repeat_index theo split', () => {
  const { m, ledger } = complete();
  m.slots.find((s) => s.split === 'test').run_id = 'test-run';
  m.slots.push(slot('train', 'normal-mixed', 'C2', 0, 1003, { slot_id: 'train-fault' }));
  m.slots.push(slot('validation', 'normal-mixed', 'C3', 2, 2001, { slot_id: 'val-r2' }));
  const { errors } = checkDataset(m, ledger);
  assert.ok(errors.some((e) => /chỉ khai báo slot test/u.test(e)));
  assert.ok(errors.some((e) => /fault run không vào train/u.test(e)));
  assert.ok(errors.some((e) => /validation dùng repeat_index 1/u.test(e)));
});

test('chuỗi thay thế phải khớp replacement_for_run_id; run thay giữ seed của slot', () => {
  const { m, ledger } = complete();
  const c6 = m.slots.find((s) => s.case === 'C6');
  const failed = 'run-c6-failed';
  ledger.push(...ledgerRun(failed, c6, { finished: { execution_gate: 'fail' } }));
  c6.replaced_run_ids = [failed];
  // Run thay đã chạy không ghi replacement_for_run_id.
  let { errors } = checkDataset(m, ledger);
  assert.ok(errors.some((e) => /phải ghi replacement_for_run_id = run-c6-failed/u.test(e)));

  const fixed = ledger.filter((e) => e.run_id !== c6.run_id);
  fixed.push(...ledgerRun(c6.run_id, c6, { started: { replacement_for_run_id: failed } }));
  ({ errors } = checkDataset(m, fixed));
  assert.deepEqual(errors, []);

  // Đổi seed khi thay run: trái mục 8.6 và phá quy tắc seed của fault run cùng repeat_index.
  const reseeded = fixed.filter((e) => e.run_id !== c6.run_id);
  c6.workload_seed = 2010;
  reseeded.push(...ledgerRun(c6.run_id, c6, { started: { replacement_for_run_id: failed } }));
  ({ errors } = checkDataset(m, reseeded));
  assert.ok(errors.some((e) => /phải dùng seed 2001/u.test(e)));
  assert.ok(errors.some((e) => /\(run-c6-failed\): seed trong ledger 2001, slot 2010/u.test(e)));
});

test('độ phủ còn thiếu và quyết định chưa chốt được liệt kê', () => {
  const m = manifest([slot('validation', 'normal-mixed', 'C2', 1, 2001, { align_peak: null })]);
  m.fault_manifest = { path: null };
  m.pending_decisions = ['profile đối chứng'];
  const { errors, pending } = checkDataset(m, []);
  assert.deepEqual(errors, []);
  assert.ok(pending.includes('train chưa có run healthy normal-mixed'));
  assert.ok(pending.includes('validation chưa có fault run C3 repeat_index 1'));
  assert.ok(pending.includes('validation chưa có fault run trùng cao điểm'));
  assert.ok(pending.some((p) => /align_peak chưa chốt/u.test(p)));
  assert.ok(pending.includes('fault_manifest chưa chốt'));
  assert.ok(pending.includes('chờ quyết định: profile đối chứng'));
});
