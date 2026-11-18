#!/usr/bin/env node
/**
 * Tách log JSON của k6 (`k6-log.jsonl`, mỗi dòng có `msg`) thành nhật ký thao tác theo
 * workload-design-v1 mục 11.2: `actions.jsonl` (một request mỗi dòng) và `sessions.jsonl` (một phiên
 * mỗi dòng). Dòng log khác (cảnh báo của k6) giữ ở `k6-other.log`.
 *
 *   node aiops-platform/load/tools/split-workload-log.mjs aiops-platform/load/results/<RUN_ID>
 */
import { createReadStream, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

/** Một dòng log k6 → `{ kind, record }` (kind: action | session | other). */
export function classifyLogLine(line) {
  if (!line.trim()) return null;
  let entry;
  try {
    entry = JSON.parse(line);
  } catch {
    return { kind: 'other', record: line };
  }
  const message = entry.msg;
  if (typeof message === 'string' && message.startsWith('{')) {
    try {
      const record = JSON.parse(message);
      if (record.kind === 'action' || record.kind === 'session') {
        const { kind, ...rest } = record;
        return { kind, record: rest };
      }
    } catch {
      // không phải bản ghi của workload
    }
  }
  return { kind: 'other', record: line };
}

export async function splitWorkloadLog(dir) {
  const buckets = { action: [], session: [], other: [] };
  const reader = createInterface({ input: createReadStream(join(dir, 'k6-log.jsonl')) });
  for await (const line of reader) {
    const item = classifyLogLine(line);
    if (item) buckets[item.kind].push(item.record);
  }
  const toLines = (records) => records.map((record) => `${JSON.stringify(record)}\n`).join('');
  writeFileSync(join(dir, 'actions.jsonl'), toLines(buckets.action));
  writeFileSync(join(dir, 'sessions.jsonl'), toLines(buckets.session));
  writeFileSync(join(dir, 'k6-other.log'), buckets.other.map((line) => `${line}\n`).join(''));
  const endReasons = {};
  for (const session of buckets.session) {
    endReasons[session.end_reason] = (endReasons[session.end_reason] ?? 0) + 1;
  }
  const outcomes = {};
  for (const action of buckets.action)
    outcomes[action.outcome] = (outcomes[action.outcome] ?? 0) + 1;
  return {
    actions: buckets.action.length,
    sessions: buckets.session.length,
    other: buckets.other.length,
    end_reasons: endReasons,
    outcomes,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2];
  if (!dir) {
    console.error('Dùng: split-workload-log.mjs <thư mục kết quả của run>');
    process.exit(2);
  }
  console.log(JSON.stringify(await splitWorkloadLog(dir)));
}
