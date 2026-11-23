#!/usr/bin/env node
/**
 * Kiểm dataset manifest với ledger và kế hoạch phiên (lib/dataset.mjs).
 *
 *   node aiops-platform/experiments/check-dataset.mjs aiops-platform/experiments/datasets/dataset-v0.json \
 *     [--ledger aiops-platform/experiments/ledger.jsonl] [--load-dir aiops-platform/load] [--require-complete]
 *
 * Mã thoát: 0 khi không có lỗi (và, với `--require-complete`, đã đủ độ phủ); 1 khi có lỗi hoặc thiếu.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { checkDataset } from './lib/dataset.mjs';
import { readLedger } from './lib/ledger.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      ledger: { type: 'string', default: join(HERE, 'ledger.jsonl') },
      'load-dir': { type: 'string', default: resolve(HERE, '../load') },
      'require-complete': { type: 'boolean', default: false },
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
  const summary = {
    dataset_id: manifest.dataset_id,
    slots: slots.length,
    slots_with_run: slots.filter((slot) => slot.run_id).length,
    ...result,
  };
  console.log(JSON.stringify(summary, null, 2));
  const incomplete = values['require-complete'] && result.pending.length > 0;
  process.exitCode = result.errors.length > 0 || incomplete ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
