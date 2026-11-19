#!/usr/bin/env node
/**
 * Báo cáo độ thực của traffic học viên: so từng nguồn tải với hold-out của log Moodle.
 *
 *   node aiops-platform/load/tools/validate-realism.mjs \
 *     --run level1=results/<run mức 1> --run assumed=results/<run mức 2 thuần> \
 *     --run moodle=results/<run bán thực> [--holdout data/sessions/moodle-holdout-v1.json] \
 *     [--profile normal-mixed --k 4 --think-cap-s 300 --run-seconds 2880] [--out report.json]
 *     [--build data/sessions/moodle-build-v1.json]
 *
 * Chấm theo hai phiên bản tiêu chí: v1 (ngưỡng cố định, `THRESHOLDS`) và v2 (dao động tự nhiên của
 * dữ liệu thật, `realism-v2.mjs`; cần file phiên của phần xây cho nhóm ngày tham chiếu).
 *
 * Hold-out (ngày 60–90) không dùng để chọn bất kỳ tham số nào (workload-design-v1 mục 10.4). Đại lượng
 * mức phiên (số thao tác, thời lượng, think time, tỉ lệ thao tác) lấy trên mọi phiên hold-out, kẹp
 * think time cùng trần với kế hoạch phát lại; đại lượng của quá trình đến (dáng theo giờ, đỉnh/trung
 * bình, index of dispersion, Hurst) lấy trên k ngày hold-out chọn đúng cách kế hoạch chọn ngày đoạn
 * xây, nén ×30.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { gunzipSync } from 'node:zlib';

import { median } from './lib/compare.mjs';
import {
  THRESHOLDS,
  compare,
  describe,
  sessionsFromActionLog,
  sessionsFromK6Points,
  sessionsFromSessionFile,
} from './realism.mjs';
import { CRITERIA_V2, compareV2, referenceDistribution, referenceGroups } from './realism-v2.mjs';
import { buildPlan, selectDays } from './replay-plan.mjs';
import { sessionsPerDay } from './session-stats.mjs';

const LOAD_DIR = fileURLToPath(new URL('..', import.meta.url));

function readLines(path) {
  const raw = readFileSync(path);
  const text = path.endsWith('.gz') ? gunzipSync(raw).toString('utf8') : raw.toString('utf8');
  return text
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

export function loadRun(dir, options = {}) {
  const summary = JSON.parse(readFileSync(join(dir, 'k6-summary.json'), 'utf8'));
  const runStartMs = Date.parse(summary.started_at);
  if (existsSync(join(dir, 'actions.jsonl'))) {
    return {
      summary,
      sessions: sessionsFromActionLog(readLines(join(dir, 'actions.jsonl')), runStartMs, options),
    };
  }
  const points = ['k6-points.json.gz', 'k6-points.json']
    .map((name) => join(dir, name))
    .find(existsSync);
  if (!points) throw new Error(`${dir}: không có actions.jsonl hay k6-points.json(.gz)`);
  return {
    summary,
    sessions: sessionsFromK6Points(readLines(points), runStartMs, undefined, options),
  };
}

export function holdoutReference(holdout, { profile, k, thinkCapS, runSeconds }) {
  const { days } = selectDays(sessionsPerDay(holdout.sessions), profile, k);
  const { plan } = buildPlan(holdout.sessions, {
    planId: 'holdout',
    source: 'holdout',
    profile,
    days,
    k,
    runSeconds,
    thinkCapS,
    prelude: [],
  });
  const compression = 86400 / runSeconds;
  return {
    days,
    sessionLevel: sessionsFromSessionFile(
      holdout.sessions,
      (s) => s.start_offset_s / compression,
      thinkCapS,
    ),
    arrival: plan.sessions.map((session) => ({ ...session, duration_s: 0 })),
  };
}

const fmt = (value, digits = 3) =>
  value === null || value === undefined ? 'n/a' : Number(value).toFixed(digits);

function main() {
  const { values } = parseArgs({
    options: {
      run: { type: 'string', multiple: true, default: [] },
      holdout: { type: 'string', default: join(LOAD_DIR, 'data/sessions/moodle-holdout-v1.json') },
      profile: { type: 'string', default: 'normal-mixed' },
      k: { type: 'string', default: '4' },
      'think-cap-s': { type: 'string', default: '300' },
      'run-seconds': { type: 'string', default: '2880' },
      build: { type: 'string', default: join(LOAD_DIR, 'data/sessions/moodle-build-v1.json') },
      out: { type: 'string' },
    },
  });
  const runSeconds = Number(values['run-seconds']);
  const holdout = JSON.parse(readFileSync(values.holdout, 'utf8'));
  const ref = holdoutReference(holdout, {
    profile: values.profile,
    k: Number(values.k),
    thinkCapS: Number(values['think-cap-s']),
    runSeconds,
  });
  const sessionRef = describe(ref.sessionLevel, runSeconds);
  const arrivalRef = describe(ref.arrival, runSeconds);
  const reference = { ...sessionRef, ...pick(arrivalRef) };

  const build = JSON.parse(readFileSync(values.build, 'utf8'));
  const { pool, groups } = referenceGroups(build.sessions, sessionsPerDay(build.sessions), reference, {
    profile: values.profile,
    k: Number(values.k),
    runSeconds,
    thinkCapS: Number(values['think-cap-s']),
  });
  const distributions = new Map();

  const report = {
    thresholds: THRESHOLDS,
    criteria_v2: {
      ...CRITERIA_V2,
      build_sessions: build.sessions.length,
      pool_q1: pool.q1,
      pool_q3: pool.q3,
      pool_days: pool.days,
    },
    holdout: {
      sessions: holdout.sessions.length,
      arrival_days: ref.days,
      arrival_sessions: ref.arrival.length,
    },
    sources: {},
  };
  for (const entry of values.run) {
    const [name, dir] = entry.split('=');
    const { summary, sessions } = loadRun(dir);
    const observed = describe(sessions, runSeconds);
    const result = compare(observed, reference);
    // V2: mốc thời gian theo giây như log Moodle; phân phối tham chiếu theo đúng số phiên của nguồn.
    const snapped = describe(
      loadRun(dir, { timeResolutionMs: CRITERIA_V2.timeResolutionMs }).sessions,
      runSeconds,
    );
    if (!distributions.has(snapped.sessions)) {
      distributions.set(
        snapped.sessions,
        referenceDistribution(groups, reference, snapped.sessions, { runSeconds }),
      );
    }
    const v2 = compareV2(
      compare(snapped, reference).rows,
      distributions.get(snapped.sessions),
      groups,
    );
    report.sources[name] = {
      run_id: summary.run_id,
      sessions: observed.sessions,
      medians: {
        actions_per_session: median(observed.actions_per_session),
        duration_s: median(observed.duration_s),
        think_s: median(observed.think_s),
      },
      ...result,
      v2,
    };
  }
  report.reference_medians = {
    actions_per_session: median(reference.actions_per_session),
    duration_s: median(reference.duration_s),
    think_s: median(reference.think_s),
  };
  if (values.out) writeFileSync(values.out, `${JSON.stringify(report, null, 2)}\n`);

  const names = Object.keys(report.sources);
  const line = (label, get) =>
    `| ${label} | ${names.map((n) => get(report.sources[n])).join(' | ')} |`;
  console.log(
    [
      `| Đại lượng | ${names.join(' | ')} |`,
      `| --- | ${names.map(() => '---').join(' | ')} |`,
      line('Phiên', (s) => s.sessions),
      line(
        'KS D thao tác/phiên',
        (s) => `${fmt(s.rows.actions_per_session_ks_d)} (${s.checks.actions_per_session_ks_d})`,
      ),
      line('KS D thời lượng', (s) => `${fmt(s.rows.duration_ks_d)} (${s.checks.duration_ks_d})`),
      line('KS D think time', (s) => `${fmt(s.rows.think_ks_d)} (${s.checks.think_ks_d})`),
      line('Lệch trung vị thao tác/phiên', (s) => fmt(s.rows.actions_per_session_median_rel)),
      line('Lệch trung vị thời lượng', (s) => fmt(s.rows.duration_median_rel)),
      line('Lệch trung vị think', (s) => fmt(s.rows.think_median_rel)),
      line(
        'JSD tỉ lệ thao tác',
        (s) => `${fmt(s.rows.action_mix_jsd)} (${s.checks.action_mix_jsd})`,
      ),
      line('Pearson dáng theo giờ', (s) => fmt(s.rows.hourly_shape_pearson)),
      line(
        'Đỉnh/trung bình (nguồn | hold-out)',
        (s) => `${fmt(s.rows.peak_to_mean.source, 2)} | ${fmt(s.rows.peak_to_mean.reference, 2)}`,
      ),
      line(
        'Index of dispersion',
        (s) =>
          `${fmt(s.rows.dispersion_index.source, 2)} | ${fmt(s.rows.dispersion_index.reference, 2)}`,
      ),
      line('Hurst', (s) => `${fmt(s.rows.hurst.source, 2)} | ${fmt(s.rows.hurst.reference, 2)}`),
      line('Đạt mọi ngưỡng v1', (s) => (s.passed ? 'có' : 'không')),
      ...CRITERIA_V2.metrics.map((metric) =>
        line(`v2 thứ hạng ${metric}`, (s) => `${fmt(s.v2.ranks[metric], 2)} (${fmt(s.v2.distances[metric])})`),
      ),
      line('v2 điểm (thứ hạng lớn nhất) | tau', (s) => `${fmt(s.v2.score, 3)} | ${fmt(s.v2.tau, 3)}`),
      line('Đạt v2', (s) => (s.v2.passed ? 'có' : 'không')),
    ].join('\n'),
  );
}

function pick(arrival) {
  return {
    starts_per_hour: arrival.starts_per_hour,
    starts_per_bin: arrival.starts_per_bin,
    peak_to_mean: arrival.peak_to_mean,
    dispersion_index: arrival.dispersion_index,
    hurst: arrival.hurst,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
