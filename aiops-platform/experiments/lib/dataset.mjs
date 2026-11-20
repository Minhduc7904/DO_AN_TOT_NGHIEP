/**
 * Dataset manifest (`dataset-manifest.v0`) và kiểm tra của nó (task-04 tuần 15; evaluation-protocol-v1
 * mục 5, 6.1, 8.1–8.6; workload-design-v1 mục 11.4).
 *
 * Manifest khai báo trước khi chạy: luật chia ngày log Moodle theo split, kế hoạch phiên của từng
 * split (đường dẫn, sha256, ngày), và các **slot** run (split, profile, case, `repeat_index`, seed,
 * `align_peak`). Khi run xong, slot được gắn `run_id` (và `replaced_run_ids` nếu có run bị thay theo
 * mục 8.6). Kiểm tra đối chiếu manifest với ledger của runner và với file kế hoạch:
 *
 * - không trùng `run_id`, seed hay ngày log giữa các split; ngày nằm ngoài hold-out;
 * - seed trong khoảng của split; fault run các case cùng split và `repeat_index` dùng cùng seed;
 * - run của slot có trong ledger, đúng split/case/`repeat_index`/profile/seed/kế hoạch, đã đạt gate
 *   thực thi, `RunGroundTruth` hợp lệ, chất lượng `pass`/`partial`; chuỗi thay thế khớp ledger;
 * - test chỉ khai báo, chưa chạy (dataset v0);
 * - độ phủ tối thiểu (khi `requireComplete`): mỗi profile có run train; mỗi case có run validation
 *   `repeat_index` 1; healthy validation cho hai profile; ít nhất một run validation trùng cao điểm.
 */
import { CASES, PROFILES, SEED_RANGES } from './spec.mjs';

export const DATASET_SCHEMA = 'dataset-manifest.v0';
export const SPLITS = Object.freeze(['train', 'validation', 'test']);

function sameSet(a, b) {
  return a.length === b.length && [...a].sort().join() === [...b].sort().join();
}

/** Dòng `run.started` và dòng cuối của mỗi run trong ledger. */
function indexLedger(entries) {
  const runs = new Map();
  for (const entry of entries) {
    const item = runs.get(entry.run_id) ?? { started: null, finished: null };
    if (entry.event === 'run.started') item.started = entry;
    if (entry.event === 'run.finished') item.finished = entry;
    runs.set(entry.run_id, item);
  }
  return runs;
}

function checkDays(manifest, errors) {
  const split = manifest.day_split ?? {};
  const days = split.days ?? {};
  const [holdoutStart] = split.holdout_days ?? [];
  if (!Number.isInteger(holdoutStart)) errors.push('day_split.holdout_days cần [ngày đầu, ngày cuối]');
  const owner = new Map();
  for (const name of SPLITS) {
    if (!Array.isArray(days[name]) || days[name].length === 0) {
      errors.push(`day_split.days.${name} rỗng`);
      continue;
    }
    for (const day of days[name]) {
      if (!Number.isInteger(day) || day < 0) errors.push(`ngày lạ ${day} ở ${name}`);
      if (Number.isInteger(holdoutStart) && day >= holdoutStart) {
        errors.push(`ngày ${day} của ${name} thuộc hold-out`);
      }
      if (owner.has(day)) errors.push(`ngày log ${day} ở cả ${owner.get(day)} và ${name}`);
      owner.set(day, name);
    }
  }
  return days;
}

/**
 * `plans` là `{ <split>: { <profile>: { path, sha256, days } } }`. `readPlan(path)` trả `{ text, json }`
 * hoặc `null` khi không có file (kế hoạch không commit); `sha256(text)` băm nội dung.
 */
function checkPlans(manifest, splitDays, { readPlan, sha256 }, errors, warnings) {
  const plans = manifest.plans ?? {};
  const usedDays = new Map();
  for (const split of SPLITS) {
    for (const profile of PROFILES) {
      const plan = plans[split]?.[profile];
      const where = `plans.${split}.${profile}`;
      if (!plan) {
        errors.push(`thiếu ${where}`);
        continue;
      }
      if (!/^[0-9a-f]{64}$/u.test(plan.sha256 ?? '')) errors.push(`${where}.sha256 không hợp lệ`);
      for (const day of plan.days ?? []) {
        if (!(splitDays[split] ?? []).includes(day)) {
          errors.push(`${where} dùng ngày ${day} không thuộc nhóm ngày của ${split}`);
        }
        const other = usedDays.get(day);
        if (other && other !== split) errors.push(`ngày log ${day} ở kế hoạch của ${other} và ${split}`);
        usedDays.set(day, split);
      }
      const file = readPlan ? readPlan(plan.path) : null;
      if (!file) {
        warnings.push(`không đọc được ${plan.path}; bỏ qua kiểm sha256 và ngày trong file`);
        continue;
      }
      if (sha256(file.text) !== plan.sha256) errors.push(`${where}: sha256 của ${plan.path} khác manifest`);
      if (!sameSet(file.json.days ?? [], plan.days ?? [])) {
        errors.push(`${where}: ngày trong ${plan.path} khác manifest`);
      }
      if (file.json.split?.name !== split || file.json.profile !== profile) {
        errors.push(`${where}: ${plan.path} không phải kế hoạch ${profile} của ${split}`);
      }
    }
  }
}

function checkSlotShape(slot, errors) {
  const where = `slot ${slot.slot_id}`;
  if (!SPLITS.includes(slot.split)) errors.push(`${where}: split lạ ${slot.split}`);
  if (!PROFILES.includes(slot.profile)) errors.push(`${where}: profile lạ ${slot.profile}`);
  if (slot.case !== null && !CASES.includes(slot.case)) errors.push(`${where}: case lạ ${slot.case}`);
  const range = SEED_RANGES[slot.split];
  if (!Number.isInteger(slot.workload_seed)) {
    errors.push(`${where}: workload_seed phải là số nguyên`);
  } else if (range && (slot.workload_seed < range[0] || slot.workload_seed > range[1])) {
    errors.push(`${where}: seed ${slot.workload_seed} ngoài khoảng ${range[0]}–${range[1]} của ${slot.split}`);
  }
  if (slot.case === null && slot.repeat_index !== 0) errors.push(`${where}: run healthy có repeat_index 0`);
  if (slot.case !== null && slot.split !== 'train' && !(slot.repeat_index >= 1)) {
    errors.push(`${where}: fault run của ${slot.split} cần repeat_index ≥ 1`);
  }
  if (slot.case !== null && slot.split === 'train') {
    errors.push(`${where}: fault run không vào train (mục 5.3)`);
  }
  if (slot.split === 'validation' && slot.case !== null && slot.repeat_index !== 1) {
    errors.push(`${where}: validation dùng repeat_index 1 (mục 5.3)`);
  }
  if (slot.split === 'test' && slot.case !== null && slot.repeat_index < 2) {
    errors.push(`${where}: test dùng repeat_index 2..R (mục 5.3)`);
  }
  if (slot.split === 'test' && (slot.run_id || (slot.replaced_run_ids ?? []).length > 0)) {
    errors.push(`${where}: dataset v0 chỉ khai báo slot test, không chạy`);
  }
  if (slot.align_peak !== null && typeof slot.align_peak !== 'boolean') {
    errors.push(`${where}: align_peak là true, false hoặc null (chưa chốt)`);
  }
  if (slot.case === null && slot.align_peak === true) errors.push(`${where}: run healthy không có cửa sổ fault`);
}

/** Kiểm một run của slot với ledger; trả seed thật của run (hoặc null). */
function checkRun(runId, slot, ledger, plans, role, errors) {
  const where = `slot ${slot.slot_id} (${runId})`;
  const item = ledger.get(runId);
  if (!item?.started) {
    errors.push(`${where}: không có run.started trong ledger`);
    return null;
  }
  const { started, finished } = item;
  const mismatched = [
    ['split', started.split, slot.split],
    ['case', started.case_id, slot.case],
    ['repeat_index', started.repeat_index, slot.repeat_index],
    ['profile', started.workload_profile, slot.profile],
  ].filter(([, actual, expected]) => actual !== expected);
  for (const [field, actual, expected] of mismatched) {
    errors.push(`${where}: ${field} trong ledger là ${actual}, slot là ${expected}`);
  }
  if (role === 'selected') {
    if (!finished) {
      errors.push(`${where}: chưa có run.finished`);
    } else {
      if (finished.status !== 'completed') errors.push(`${where}: status ${finished.status}`);
      if (finished.execution_gate !== 'pass') errors.push(`${where}: gate thực thi ${finished.execution_gate}`);
      if (finished.ground_truth !== 'valid') errors.push(`${where}: RunGroundTruth ${finished.ground_truth}`);
      if (!['pass', 'partial'].includes(finished.data_quality)) {
        errors.push(`${where}: chất lượng ${finished.data_quality}`);
      }
      const expected = plans[slot.split]?.[slot.profile]?.sha256;
      if (expected && finished.plan_sha256 !== expected) {
        errors.push(`${where}: kế hoạch đã chạy (${finished.plan_sha256}) khác kế hoạch của split`);
      }
    }
    if (started.workload_seed !== slot.workload_seed) {
      errors.push(`${where}: seed trong ledger ${started.workload_seed}, slot ${slot.workload_seed}`);
    }
  }
  return started.workload_seed;
}

function checkReplacementChain(slot, ledger, errors) {
  const chain = [...(slot.replaced_run_ids ?? []), slot.run_id].filter(Boolean);
  for (let index = 1; index < chain.length; index += 1) {
    const started = ledger.get(chain[index])?.started;
    if (started && started.replacement_for_run_id !== chain[index - 1]) {
      errors.push(
        `slot ${slot.slot_id}: ${chain[index]} phải ghi replacement_for_run_id = ${chain[index - 1]}`,
      );
    }
  }
}

function coverage(slots) {
  const done = (slot) => Boolean(slot.run_id);
  const pending = [];
  for (const profile of PROFILES) {
    if (!slots.some((s) => s.split === 'train' && s.case === null && s.profile === profile && done(s))) {
      pending.push(`train chưa có run healthy ${profile}`);
    }
    if (!slots.some((s) => s.split === 'validation' && s.case === null && s.profile === profile && done(s))) {
      pending.push(`validation chưa có run healthy ${profile}`);
    }
  }
  for (const caseId of CASES) {
    if (!slots.some((s) => s.split === 'validation' && s.case === caseId && done(s))) {
      pending.push(`validation chưa có fault run ${caseId} repeat_index 1`);
    }
  }
  if (!slots.some((s) => s.split === 'validation' && s.case !== null && s.align_peak === true && done(s))) {
    pending.push('validation chưa có fault run trùng cao điểm');
  }
  for (const slot of slots.filter((s) => s.split !== 'test' && s.align_peak === null)) {
    pending.push(`slot ${slot.slot_id}: align_peak chưa chốt`);
  }
  return pending;
}

/**
 * Kiểm manifest. `ledgerEntries` là các dòng ledger; `io` = `{ readPlan, sha256 }` (tùy chọn).
 * Trả `{ errors, warnings, pending }`: `errors` là vi phạm; `pending` là phần chưa đủ độ phủ.
 */
export function checkDataset(manifest, ledgerEntries, io = {}) {
  const errors = [];
  const warnings = [];
  if (manifest?.schema !== DATASET_SCHEMA) errors.push(`schema phải là ${DATASET_SCHEMA}`);
  const splitDays = checkDays(manifest ?? {}, errors);
  checkPlans(manifest ?? {}, splitDays, io, errors, warnings);
  const slots = manifest?.slots ?? [];
  const ledger = indexLedger(ledgerEntries);
  const slotIds = new Set();
  const runOwner = new Map();
  const seedOwner = new Map();
  const claimSeed = (seed, split, where) => {
    if (!Number.isInteger(seed)) return;
    const other = seedOwner.get(seed);
    if (other && other !== split) errors.push(`seed ${seed} dùng ở cả ${other} và ${split} (${where})`);
    seedOwner.set(seed, split);
  };
  const faultSeed = new Map();
  for (const slot of slots) {
    if (!slot.slot_id || slotIds.has(slot.slot_id)) errors.push(`slot_id trùng hoặc rỗng: ${slot.slot_id}`);
    slotIds.add(slot.slot_id);
    checkSlotShape(slot, errors);
    claimSeed(slot.workload_seed, slot.split, `slot ${slot.slot_id}`);
    if (slot.case !== null && !(slot.replaced_run_ids ?? []).length) {
      // Quy tắc seed (workload-design-v1 mục 11.4, chốt ở task-04 tuần 15): fault run các case cùng
      // split và repeat_index dùng cùng seed. Slot có run bị thay được dùng seed mới (mục 8.6).
      const key = `${slot.split}#${slot.repeat_index}`;
      const seed = faultSeed.get(key);
      if (seed !== undefined && seed !== slot.workload_seed) {
        errors.push(`slot ${slot.slot_id}: fault run cùng ${key} phải dùng seed ${seed}`);
      }
      faultSeed.set(key, slot.workload_seed);
    }
    const runs = [
      ...(slot.replaced_run_ids ?? []).map((id) => [id, 'replaced']),
      ...(slot.run_id ? [[slot.run_id, 'selected']] : []),
    ];
    for (const [runId, role] of runs) {
      const owner = runOwner.get(runId);
      if (owner) errors.push(`run_id ${runId} ở cả slot ${owner} và ${slot.slot_id}`);
      runOwner.set(runId, slot.slot_id);
      claimSeed(checkRun(runId, slot, ledger, manifest.plans ?? {}, role, errors), slot.split, runId);
    }
    checkReplacementChain(slot, ledger, errors);
  }
  const pending = coverage(slots);
  if (!manifest?.fault_manifest?.path) pending.push('fault_manifest chưa chốt');
  for (const item of manifest?.pending_decisions ?? []) pending.push(`chờ quyết định: ${item}`);
  return { errors, warnings, pending };
}
