#!/usr/bin/env node
/**
 * Tạo kế hoạch phát lại cho scenario học viên của k6.
 *
 *   node aiops-platform/load/tools/build-replay-plan.mjs --source moodle --profile normal-mixed --k 4
 *   node aiops-platform/load/tools/build-replay-plan.mjs --source assumed --profile normal-mixed --k 4
 *   node aiops-platform/load/tools/build-replay-plan.mjs --source learned --profile normal-mixed --k 4
 *   node aiops-platform/load/tools/build-replay-plan.mjs --source moodle --profile normal-mixed --k 4 --split train
 *
 * `--split train|validation|test` (dataset, chỉ với `moodle`): chọn ngày trong nhóm ngày của split theo
 * luật `DAY_SPLIT` (replay-plan.mjs), kế hoạch tên `moodle-<profile>-k<k>-<split>-v1`.
 * - `moodle`  (mức 2+): phiên thật của k ngày trong đoạn xây (chọn theo profile), giờ bắt đầu thật.
 * - `assumed` (mức 2 thuần): phiên sinh từ bảng giả định, giờ bắt đầu chia đều theo `w(h)` giả định.
 * - `learned` (sinh thêm kiểu WESSBAS): phiên sinh từ ma trận học từ đoạn xây.
 * Với `assumed`/`learned`, số phiên mặc định bằng số phiên của kế hoạch `moodle` cùng profile và k,
 * để ba nguồn tải có cùng tổng số phiên học viên (workload-design-v1 mục 10.4).
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import {
  evenStartOffsets,
  generateAssumedSessions,
  generateLearnedSessions,
  phaseOfProfile,
} from './markov.mjs';
import { assignDaySplits, buildPlan, DAY_SPLIT, selectDays } from './replay-plan.mjs';
import { sessionsPerDay } from './session-stats.mjs';

const LOAD_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sha256 = (text) => createHash('sha256').update(text).digest('hex');

function readJson(path) {
  const text = readFileSync(path, 'utf8');
  return { json: JSON.parse(text), sha256: sha256(text) };
}

function main() {
  const { values } = parseArgs({
    options: {
      source: { type: 'string', default: 'moodle' },
      profile: { type: 'string', default: 'normal-mixed' },
      k: { type: 'string', default: '4' },
      seed: { type: 'string', default: '1' },
      sessions: { type: 'string' },
      'think-cap-s': { type: 'string', default: '300' },
      'run-seconds': { type: 'string', default: '2880' },
      build: { type: 'string', default: join(LOAD_DIR, 'data/sessions/moodle-build-v1.json') },
      stats: { type: 'string', default: join(LOAD_DIR, 'data/sessions/moodle-stats-v1.json') },
      params: { type: 'string', default: join(LOAD_DIR, 'params/student-assumed-v1.json') },
      split: { type: 'string' },
      out: { type: 'string' },
    },
  });
  const k = Number(values.k);
  const seed = Number(values.seed);
  const { profile, source, split } = values;
  const common = {
    profile,
    k,
    runSeconds: Number(values['run-seconds']),
    thinkCapS: Number(values['think-cap-s']),
  };

  const build = readJson(values.build);
  const allDays = sessionsPerDay(build.json.sessions);
  let perDay = allDays;
  let splitMeta = null;
  if (split !== undefined) {
    // Dataset: chỉ chọn ngày trong nhóm ngày của split (luật DAY_SPLIT, ghi trước khi sinh kế hoạch).
    if (source !== 'moodle') throw new Error('--split chỉ dùng với --source moodle');
    const splits = assignDaySplits(allDays);
    if (!(split in splits)) throw new Error(`--split lạ: ${split} (${Object.keys(splits).join(' | ')})`);
    perDay = allDays.filter((item) => splits[split].includes(item.day));
    splitMeta = { name: split, rule: DAY_SPLIT.rule, order: DAY_SPLIT.order, days: splits };
  }
  const { days, median } = selectDays(perDay, profile, k);
  const moodleCount = build.json.sessions.filter((s) => days.includes(s.day_index)).length;
  const count = values.sessions === undefined ? moodleCount : Number(values.sessions);
  const planId = `${source}-${profile}-k${k}${split ? `-${split}` : ''}-v1`;

  let result;
  if (source === 'moodle') {
    result = buildPlan(build.json.sessions, {
      ...common,
      planId,
      source: build.json.source,
      days,
      prelude: build.json.prelude,
      meta: {
        selection: { median_sessions_per_day: median },
        ...(splitMeta ? { split: splitMeta } : {}),
        input_sha256: build.sha256,
      },
    });
  } else if (source === 'assumed') {
    const params = readJson(values.params);
    const phase = phaseOfProfile(profile);
    const sessions = generateAssumedSessions(params.json, { count, seed, phase });
    result = buildPlan(sessions, {
      ...common,
      planId,
      source: { name: 'markov-assumed', params: params.json.schema },
      prelude: ['LOGIN'],
      meta: { seed, phase, matched_moodle_sessions: moodleCount, input_sha256: params.sha256 },
    });
  } else if (source === 'learned') {
    const stats = readJson(values.stats);
    const offsets = evenStartOffsets(count, stats.json.build.hourly_starts);
    const sessions = generateLearnedSessions(stats.json.build, {
      count,
      seed,
      startOffsets: offsets,
    });
    result = buildPlan(sessions, {
      ...common,
      planId,
      source: { name: 'markov-learned', from: 'moodle-build' },
      prelude: ['LOGIN', 'DASH'],
      meta: { seed, matched_moodle_sessions: moodleCount, input_sha256: stats.sha256 },
    });
  } else {
    throw new Error(`--source lạ: ${source} (moodle | assumed | learned)`);
  }

  const out = values.out ?? join(LOAD_DIR, 'data/plans', `${planId}.json`);
  mkdirSync(dirname(out), { recursive: true });
  const text = JSON.stringify(result.plan);
  writeFileSync(out, text);
  const { summary } = result.plan;
  console.log(
    `${planId}: ${summary.sessions} phiên, ${summary.actions} thao tác; ngày ${JSON.stringify(days)} (trung vị ${median} phiên/ngày); think kẹp ${result.clipped} (${(result.plan.think_clipped_share * 100).toFixed(1)}%); sha256 ${sha256(text)}\n→ ${out}`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
