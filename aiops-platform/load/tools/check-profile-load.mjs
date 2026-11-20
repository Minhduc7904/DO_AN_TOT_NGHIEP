#!/usr/bin/env node
/**
 * So đỉnh tốc độ bắt đầu phiên của hai profile với `λ_knee` (workload-design-v1 mục 8.4 bước 2):
 * đỉnh `normal-mixed` ≤ 0,35 × λ_knee, đỉnh `healthy-spike` ≤ 0,8 × λ_knee.
 *
 *   node aiops-platform/load/tools/check-profile-load.mjs --knee <phiên/s> \
 *     [--normal data/plans/moodle-normal-mixed-k4-v1.json] [--spike data/plans/moodle-healthy-spike-k4-v1.json]
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { checkProfileLoad, planPeakRate } from '../lib/knee.js';

const LOAD_DIR = fileURLToPath(new URL('..', import.meta.url));
export const FACTORS = Object.freeze({ 'normal-mixed': 0.35, 'healthy-spike': 0.8 });

function main(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      knee: { type: 'string' },
      normal: { type: 'string', default: join(LOAD_DIR, 'data/plans/moodle-normal-mixed-k4-v1.json') },
      spike: { type: 'string', default: join(LOAD_DIR, 'data/plans/moodle-healthy-spike-k4-v1.json') },
      'bin-s': { type: 'string', default: '60' },
    },
  });
  const knee = Number(values.knee);
  if (!(knee > 0)) throw new Error('Cần --knee <phiên/s> > 0');
  const report = {};
  for (const [profile, path] of [['normal-mixed', values.normal], ['healthy-spike', values.spike]]) {
    const plan = JSON.parse(readFileSync(path, 'utf8'));
    const peak = planPeakRate(plan.sessions, Number(values['bin-s']));
    report[profile] = { plan_id: plan.plan_id, k: plan.k, factor: FACTORS[profile], ...checkProfileLoad(peak, knee, FACTORS[profile]) };
  }
  console.log(JSON.stringify({ lambda_knee_per_s: knee, bin_s: Number(values['bin-s']), profiles: report }, null, 2));
  return Object.values(report).every((r) => r.pass) ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
