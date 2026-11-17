import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { main, planCommand } from './fault-control.mjs';
import { createLlmStub } from './llm-stub/server.mjs';

describe('planCommand', () => {
  test('latency có jitter tùy chọn', () => {
    assert.deepEqual(planCommand(['latency', 'course-to-postgres', '200', '--jitter', '20']), {
      action: 'latency',
      proxy: 'course-to-postgres',
      latency: 200,
      jitter: 20,
    });
    assert.equal(planCommand(['latency', 'media-to-minio', '50']).jitter, 0);
  });

  test('disconnect/reconnect/clear', () => {
    assert.deepEqual(planCommand(['disconnect', 'media-to-minio']), {
      action: 'set-enabled',
      proxy: 'media-to-minio',
      enabled: false,
    });
    assert.equal(planCommand(['reconnect', 'media-to-minio']).enabled, true);
    assert.deepEqual(planCommand(['clear']), { action: 'clear', proxy: null });
  });

  test('llm set đổi tên cờ sang trường cấu hình của stub', () => {
    assert.deepEqual(
      planCommand([
        'llm',
        'set',
        '--latency-ms',
        '3000',
        '--error-rate',
        '0.2',
        '--affect-models',
        'false',
      ]),
      { action: 'llm-set', patch: { latency_ms: 3000, error_rate: 0.2, affect_models: false } },
    );
  });

  test('dòng lệnh sai trả mã 2 kèm hướng dẫn, không gọi mạng', async () => {
    const errors = [];
    for (const argv of [
      [],
      ['latency', 'course-to-postgres'],
      ['latency', 'course-to-postgres', '-5'],
      ['llm', 'set'],
      ['llm', 'set', '--latency', '5'],
      ['disconnect'],
    ]) {
      const code = await main(argv, {
        fetchImpl: () => assert.fail('không được gọi mạng'),
        err: (text) => errors.push(text),
        out: () => {},
      });
      assert.equal(code, 2, `argv ${argv.join(' ')}`);
    }
    assert.ok(errors.every((text) => text.includes('Dùng:')));
  });
});

describe('lệnh llm trên LLM stub thật', () => {
  let stub;
  let env;

  before(async () => {
    stub = createLlmStub({ seed: 3, log: () => {} });
    const address = await stub.listen(0, '127.0.0.1');
    env = { LLM_STUB_CONTROL_URL: `http://127.0.0.1:${address.port}` };
  });

  after(async () => {
    await stub.close();
  });

  test('llm set rồi llm reset; mỗi lệnh in một dòng JSON có ts', async () => {
    const lines = [];
    const out = (line) => lines.push(JSON.parse(line));

    assert.equal(
      await main(['llm', 'set', '--latency-ms', '2500', '--error-rate', '0.5'], { env, out }),
      0,
    );
    assert.equal(stub.control.latency_ms, 2500);
    assert.equal(stub.control.error_rate, 0.5);
    assert.equal(lines[0].ok, true);
    assert.match(lines[0].ts, /^\d{4}-\d{2}-\d{2}T/u);

    assert.equal(await main(['llm', 'reset'], { env, out }), 0);
    assert.equal(stub.control.latency_ms, 0);
  });

  test('stub từ chối cấu hình sai: mã 1, dòng JSON ok=false', async () => {
    const lines = [];
    const code = await main(['llm', 'set', '--error-rate', '3'], {
      env,
      out: (line) => lines.push(JSON.parse(line)),
    });
    assert.equal(code, 1);
    assert.equal(lines[0].ok, false);
    assert.match(lines[0].error, /HTTP 400/u);
  });
});
