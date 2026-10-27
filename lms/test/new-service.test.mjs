import assert from 'node:assert/strict';
import test from 'node:test';

import { describeService, renderTemplate } from '../scripts/new-service.mjs';

test('describeService suy ra tên biến môi trường từ tên kebab-case', () => {
  assert.deepEqual(describeService('media-worker', 3105), {
    name: 'media-worker',
    port: 3105,
    upper: 'MEDIA_WORKER',
  });
});

test('describeService từ chối tên và cổng không hợp lệ', () => {
  assert.throws(() => describeService('Media', 3100), /kebab-case/u);
  assert.throws(() => describeService('media_x', 3100), /kebab-case/u);
  assert.throws(() => describeService('media', 80), /không hợp lệ/u);
});

test('renderTemplate thay mọi placeholder', () => {
  const values = describeService('scheduler', 3007);

  assert.equal(
    renderTemplate(
      '__NAME__ __UPPER___DATABASE_URL __CONST___SERVICE_NAME __PORT__ __NAME__',
      values,
    ),
    'scheduler SCHEDULER_DATABASE_URL SCHEDULER_SERVICE_NAME 3007 scheduler',
  );
});
