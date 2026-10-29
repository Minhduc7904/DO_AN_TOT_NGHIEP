import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

import * as contracts from '../../contracts/dist/index.js';

const COLLECTOR_CONFIG = resolve(
  import.meta.dirname,
  '..',
  '..',
  '..',
  'aiops-platform',
  'observability',
  'otel-collector.yaml',
);

/** Mọi queue canonical khai báo trong `contracts` (các hằng `*_COMMANDS`). */
function canonicalQueues() {
  return Object.entries(contracts)
    .filter(([name]) => name.endsWith('_COMMANDS'))
    .flatMap(([, commands]) => Object.values(commands).map((command) => command.queue));
}

/** Regex `keep` theo nhãn `queue` của pipeline `metrics/rabbitmq` trong cấu hình collector. */
function queueKeepPattern() {
  const text = readFileSync(COLLECTOR_CONFIG, 'utf8');
  const match = /source_labels: \[queue\]\n\s+regex: "([^"]+)"\n\s+action: keep/u.exec(text);
  assert.ok(match, 'Không tìm thấy luật keep theo nhãn queue trong otel-collector.yaml');
  return new RegExp(`^(?:${match[1]})$`, 'u');
}

test('collector scrape đủ queue canonical của contracts và queue .error', () => {
  const queues = canonicalQueues();
  assert.ok(queues.length >= 12, `Chỉ tìm thấy ${queues.length} queue trong contracts`);
  const keep = queueKeepPattern();
  for (const queue of queues) {
    assert.ok(keep.test(queue), `Collector bỏ sót queue ${queue}`);
    assert.ok(keep.test(`${queue}.error`), `Collector bỏ sót queue ${queue}.error`);
  }
});

test('collector không nhận queue ngoài quy ước <worker>--<command>-v<n>', () => {
  const keep = queueKeepPattern();
  for (const queue of ['amq.gen-abc', 'scheduler-worker', 'other-worker--x-v1', 'media--x-v1']) {
    assert.ok(!keep.test(queue), `Collector nhận nhầm queue ${queue}`);
  }
});

test('tiền tố queue là service.name canonical của worker', () => {
  for (const queue of canonicalQueues()) {
    assert.match(queue, /^(media|notification|ai)-worker--[a-z-]+-v\d+$/u);
  }
});
