#!/usr/bin/env node
/**
 * Log Moodle Unistudium 2022 → file phiên (đoạn xây, hold-out) và thống kê.
 *
 *   node aiops-platform/load/tools/moodle-to-sessions.mjs [--csv <đường dẫn>] [--out <thư mục>]
 *        [--build-days 60] [--gap-s 1800]
 *
 * Mặc định đọc CSV do `fetch-moodle-log.sh` tải về `data/moodle/` và ghi vào `data/sessions/` (cả hai
 * thư mục bị gitignore: dữ liệu bên thứ ba, CC BY 4.0, không commit — workload-design-v1 mục 13.7).
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import {
  GAP_S,
  buildSessions,
  coverage,
  parseMoodleCsv,
  splitBuildHoldout,
} from './moodle/sessionize.mjs';
import { describeSessions } from './session-stats.mjs';

export const TOOL_VERSION = '1.0.0';
export const SOURCE = {
  name: 'moodle-unistudium-2022',
  citation:
    'Milani, Biondi, Franzoni, "Unistudium 2022: students groups logs on moodle", Zenodo, DOI 10.5281/zenodo.13763175',
  license: 'CC BY 4.0',
  url: 'https://zenodo.org/records/13763175',
};

const LOAD_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_CSV = join(
  LOAD_DIR,
  'data/moodle/Unistudium_students_groups_logs_2022/unistudium_students_group_moodle_logs_2022.csv',
);

function sessionFile(sessions, split, meta) {
  return {
    schema: 'sessions.v1',
    source: SOURCE,
    split,
    prelude: ['LOGIN', 'DASH'],
    ...meta,
    sessions,
  };
}

function main() {
  const { values } = parseArgs({
    options: {
      csv: { type: 'string', default: DEFAULT_CSV },
      out: { type: 'string', default: join(LOAD_DIR, 'data/sessions') },
      'build-days': { type: 'string', default: '60' },
      'gap-s': { type: 'string', default: String(GAP_S) },
    },
  });
  const buildDays = Number(values['build-days']);
  const gapSeconds = Number(values['gap-s']);
  const text = readFileSync(values.csv, 'utf8');
  const csvSha256 = createHash('sha256').update(text).digest('hex');
  const rows = parseMoodleCsv(text);
  const result = buildSessions(rows, { gapSeconds });
  const { build, holdout } = splitBuildHoldout(result.sessions, buildDays);
  const meta = {
    tool_version: TOOL_VERSION,
    csv_sha256: csvSha256,
    gap_s: gapSeconds,
    build_days: buildDays,
  };

  mkdirSync(values.out, { recursive: true });
  writeFileSync(
    join(values.out, 'moodle-build-v1.json'),
    JSON.stringify(sessionFile(build, 'build', meta)),
  );
  writeFileSync(
    join(values.out, 'moodle-holdout-v1.json'),
    JSON.stringify(sessionFile(holdout, 'holdout', meta)),
  );
  const stats = {
    schema: 'moodle-stats.v1',
    source: SOURCE,
    ...meta,
    coverage: coverage(result.counts, rows.length),
    raw_sessions: result.rawSessions,
    sessions_without_action: result.emptySessions,
    all: describeSessions(result.sessions),
    build: describeSessions(build),
    holdout: describeSessions(holdout),
  };
  writeFileSync(join(values.out, 'moodle-stats-v1.json'), JSON.stringify(stats, null, 1));

  const brief = (label, item) =>
    `${label}: ${item.sessions} phiên, ${item.days} ngày, thao tác/phiên p50 ${item.actions_per_session.p50} p90 ${item.actions_per_session.p90}, thời lượng p50 ${item.session_duration_s.p50} s p90 ${item.session_duration_s.p90} s, think p50 ${item.think_s.p50} s`;
  console.log(
    [
      `CSV sha256 ${csvSha256}`,
      `Dòng ${rows.length}; phủ ${(stats.coverage.coverage * 100).toFixed(2)}% (${stats.coverage.covered}); bỏ ${stats.coverage.dropped}; theo loại ${JSON.stringify(stats.coverage.by_kind)}`,
      `Phiên thô ${result.rawSessions}; không còn thao tác ${result.emptySessions}`,
      brief('Toàn bộ', stats.all),
      brief(`Đoạn xây (ngày 0–${buildDays - 1})`, stats.build),
      brief(`Hold-out (ngày ≥ ${buildDays})`, stats.holdout),
      `Ghi vào ${values.out}`,
    ].join('\n'),
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
