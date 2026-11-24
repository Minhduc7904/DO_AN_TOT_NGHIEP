/**
 * Ledger thí nghiệm: file JSON Lines chỉ ghi thêm. Mỗi run có dòng `run.started` khi bắt đầu và dòng
 * `run.finished` khi kết thúc (kể cả lỗi hoặc bị ngắt), nên run chết giữa chừng vẫn để lại dấu vết
 * (evaluation-protocol-v1 mục 8.6; telemetry-and-ground-truth-schema-v1: không âm thầm bỏ run).
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs';

export const LEDGER_SCHEMA = 'experiment-ledger.v1';

export function readLedger(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch {
        throw new Error(`${path}: dòng ${index + 1} không phải JSON`);
      }
    });
}

export function appendLedger(path, event, record) {
  const line = JSON.stringify({ ledger_schema: LEDGER_SCHEMA, event, ts: new Date().toISOString(), ...record });
  appendFileSync(path, `${line}\n`);
  return line;
}

/** Trạng thái mới nhất của từng run: `{ run_id → dòng cuối } `. */
export function latestByRun(entries) {
  const latest = new Map();
  for (const entry of entries) latest.set(entry.run_id, entry);
  return latest;
}
