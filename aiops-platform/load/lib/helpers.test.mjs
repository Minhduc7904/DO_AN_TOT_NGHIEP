import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PNG_1X1, buildMultipart, fromBase64, utf8 } from './bytes.js';
import { createRng, vuSeed } from './rng.js';

test('utf8 khớp TextEncoder của Node, kể cả tiếng Việt và ký tự ngoài BMP', () => {
  for (const text of ['abc', 'Học viên đăng ký', 'Quy hoạch động', '😀 emoji']) {
    assert.deepEqual(utf8(text), new TextEncoder().encode(text));
  }
});

test('fromBase64 khớp Buffer của Node; PNG mẫu có chữ ký PNG', () => {
  const sample = 'SGVsbG8sIGs2IQ==';
  assert.deepEqual(Buffer.from(fromBase64(sample)), Buffer.from(sample, 'base64'));
  assert.deepEqual([...PNG_1X1.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
});

test('multipart giữ thứ tự trường, tệp đứng cuối, byte nhị phân nguyên vẹn', async () => {
  const fields = { key: 'tmp/abc', policy: 'cG9saWN5', 'x-amz-signature': 'deadbeef' };
  const { body, contentType } = buildMultipart(
    fields,
    { name: 'anh.png', type: 'image/png', content: PNG_1X1 },
    'BOUNDARY',
  );
  assert.equal(contentType, 'multipart/form-data; boundary=BOUNDARY');

  // Parser multipart thật của Node (undici) đọc lại body.
  const parsed = await new Response(body, { headers: { 'content-type': contentType } }).formData();
  assert.deepEqual([...parsed.keys()], ['key', 'policy', 'x-amz-signature', 'file']);
  const file = parsed.get('file');
  assert.equal(file.name, 'anh.png');
  assert.equal(file.type, 'image/png');
  assert.deepEqual(new Uint8Array(await file.arrayBuffer()), PNG_1X1);
});

test('rng: cùng seed cùng chuỗi; int/pick nằm trong miền', () => {
  const a = createRng(vuSeed(1, 3));
  const b = createRng(vuSeed(1, 3));
  const values = Array.from({ length: 50 }, () => a.int(1, 6));
  assert.deepEqual(
    values,
    Array.from({ length: 50 }, () => b.int(1, 6)),
  );
  assert.ok(values.every((value) => value >= 1 && value <= 6));
  assert.notEqual(vuSeed(1, 3), vuSeed(2, 3));
  assert.throws(() => createRng(1).pick([]), /rỗng/u);
});
