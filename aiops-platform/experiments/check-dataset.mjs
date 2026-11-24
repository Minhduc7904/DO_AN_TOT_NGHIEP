#!/usr/bin/env node
/**
 * Kiểm dataset manifest với ledger và kế hoạch phiên (lib/dataset.mjs).
 *
 *   node aiops-platform/experiments/check-dataset.mjs aiops-platform/experiments/datasets/dataset-v0.json \
 *     [--ledger aiops-platform/experiments/ledger.jsonl] [--load-dir aiops-platform/load] [--require-complete]
 *     [--runs-dir aiops-platform/experiments/runs]
 *
 * Với run của slot có artifact trong `--runs-dir`, kiểm thêm điều kiện nhận cho primary evaluation
 * (`lib/eligibility.mjs`, evaluation-protocol-v1 mục 6.1.1 bảng F): không nhận thì là lỗi; chỉ loại
 * variant có trace thì là cảnh báo. Run không có artifact trên máy (thư mục `runs/` không commit) chỉ
 * được cảnh báo.
 *
 * Mã thoát: 0 khi không có lỗi (và, với `--require-complete`, đã đủ độ phủ); 1 khi có lỗi hoặc thiếu.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { checkDataset } from './lib/dataset.mjs';
import { primaryEligibility } from './lib/eligibility.mjs';
import { readLedger } from './lib/ledger.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      ledger: { type: 'string', default: join(HERE, 'ledger.jsonl') },
      'load-dir': { type: 'string', default: resolve(HERE, '../load') },
      'require-complete': { type: 'boolean', default: false },
      'runs-dir': { type: 'string', default: join(HERE, 'runs') },
    },
  });
  if (positionals.length !== 1) throw new Error('Cần đúng một đường dẫn dataset manifest');
  const manifest = JSON.parse(readFileSync(positionals[0], 'utf8'));
  const readPlan = (path) => {
    const full = join(values['load-dir'], path);
    if (!existsSync(full)) return null;
    const text = readFileSync(full, 'utf8');
    return { text, json: JSON.parse(text) };
  };
  const sha256 = (text) => createHash('sha256').update(text).digest('hex');
  const result = checkDataset(manifest, readLedger(values.ledger), { readPlan, sha256 });
  const slots = manifest.slots ?? [];
  const readRunJson = (runId, path) => {
    const full = join(values['runs-dir'], runId, path);
    return existsSync(full) ? JSON.parse(readFileSync(full, 'utf8')) : null;
  };
  const eligibility = [];
  for (const slot of slots.filter((item) => item.run_id)) {
    if (!existsSync(join(values['runs-dir'], slot.run_id))) {
      result.warnings.push(`${slot.run_id}: không có artifact trong ${values['runs-dir']}, bỏ qua kiểm nhận`);
      continue;
    }
    const verdict = primaryEligibility({
      caseId: slot.case,
      groundTruth: readRunJson(slot.run_id, 'ground-truth.json'),
      quality: readRunJson(slot.run_id, 'telemetry/quality-report.json'),
      telemetryManifest: readRunJson(slot.run_id, 'telemetry/manifest.json'),
      workloadManifest: readRunJson(slot.run_id, 'workload/workload-manifest.json'),
    });
    eligibility.push({ slot_id: slot.slot_id, run_id: slot.run_id, ...verdict });
    for (const violation of verdict.violations) {
      result.errors.push(`slot ${slot.slot_id} (${slot.run_id}): không nhận cho primary evaluation: ${violation}`);
    }
    for (const why of verdict.trace_exclusions) {
      result.warnings.push(`slot ${slot.slot_id} (${slot.run_id}): loại variant có trace: ${why}`);
    }
  }
  const summary = {
    dataset_id: manifest.dataset_id,
    slots: slots.length,
    slots_with_run: slots.filter((slot) => slot.run_id).length,
    ...result,
    eligibility,
  };
  console.log(JSON.stringify(summary, null, 2));
  const incomplete = values['require-complete'] && result.pending.length > 0;
  process.exitCode = result.errors.length > 0 || incomplete ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
