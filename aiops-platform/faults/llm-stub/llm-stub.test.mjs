import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { createLlmStub } from './server.mjs';
import { DEFAULT_CONTROL, createRng, decideFault, mergeControl } from './stub-logic.mjs';

describe('stub-logic', () => {
  test('cùng seed cho cùng chuỗi số, khác seed cho chuỗi khác', () => {
    const a = createRng(42);
    const b = createRng(42);
    const c = createRng(43);
    const first = Array.from({ length: 5 }, () => a());
    assert.deepEqual(
      first,
      Array.from({ length: 5 }, () => b()),
    );
    assert.notDeepEqual(
      first,
      Array.from({ length: 5 }, () => c()),
    );
    assert.ok(first.every((value) => value >= 0 && value < 1));
  });

  test('tỉ lệ lỗi thực tế gần error_rate và chuỗi lỗi tái lập theo seed', () => {
    const control = mergeControl(DEFAULT_CONTROL, { error_rate: 0.3 });
    const run = (seed) => {
      const rng = createRng(seed);
      return Array.from({ length: 2000 }, () => decideFault(rng, control).error !== null);
    };
    const failures = run(7);
    const rate = failures.filter(Boolean).length / failures.length;
    assert.ok(Math.abs(rate - 0.3) < 0.04, `tỉ lệ lỗi ${rate}`);
    assert.deepEqual(failures, run(7));
  });

  test('trễ nằm trong [latency, latency + jitter]', () => {
    const control = mergeControl(DEFAULT_CONTROL, { latency_ms: 100, jitter_ms: 50 });
    const rng = createRng(1);
    for (let index = 0; index < 500; index += 1) {
      const { delayMs, error } = decideFault(rng, control);
      assert.ok(delayMs >= 100 && delayMs <= 150, `trễ ${delayMs}`);
      assert.equal(error, null);
    }
  });

  test('từ chối trường lạ và giá trị ngoài miền, không đổi cấu hình cũ', () => {
    assert.throws(() => mergeControl(DEFAULT_CONTROL, { latency: 100 }), /latency/u);
    assert.throws(() => mergeControl(DEFAULT_CONTROL, { error_rate: 1.5 }), /error_rate/u);
    assert.throws(() => mergeControl(DEFAULT_CONTROL, { error_mode: 'hang' }), /error_mode/u);
    assert.throws(() => mergeControl(DEFAULT_CONTROL, { error_status: 200 }), /error_status/u);
    assert.throws(() => mergeControl(DEFAULT_CONTROL, { latency_ms: -1 }), /latency_ms/u);
    assert.equal(DEFAULT_CONTROL.latency_ms, 0);
  });
});

describe('LLM stub qua HTTP', () => {
  const logs = [];
  let stub;
  let base;

  before(async () => {
    stub = createLlmStub({ seed: 5, log: (line) => logs.push(JSON.parse(line)) });
    const address = await stub.listen(0, '127.0.0.1');
    base = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await stub.close();
  });

  const json = async (method, path, body, headers = {}) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json() };
  };

  test('mặc định trả tool call save_lesson_content, rồi văn bản khi lượt cuối là kết quả công cụ', async () => {
    const tools = [{ type: 'function', function: { name: 'save_lesson_content' } }];
    const first = await json(
      'POST',
      '/v1/chat/completions',
      { model: 'm', tools, messages: [{ role: 'user', content: 'soạn bài' }] },
      { authorization: 'Bearer sk-test-1' },
    );
    assert.equal(first.status, 200);
    assert.equal(first.body.choices[0].finish_reason, 'tool_calls');
    assert.equal(first.body.choices[0].message.tool_calls[0].function.name, 'save_lesson_content');

    const second = await json('POST', '/v1/chat/completions', {
      tools,
      messages: [{ role: 'tool', content: 'ok' }],
    });
    assert.equal(second.body.choices[0].finish_reason, 'stop');

    const seen = await json('GET', '/__seen');
    assert.deepEqual(seen.body, { bearers: ['sk-test-1'], chat_calls: 2 });
  });

  test('PUT /__control gộp cấu hình, ghi dấu vết; trễ và lỗi áp vào chat, không áp vào models', async () => {
    const updated = await json('PUT', '/__control', {
      latency_ms: 150,
      error_rate: 1,
      error_status: 502,
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.control.latency_ms, 150);
    assert.equal(updated.body.control.error_mode, 'status');
    assert.equal(logs.at(-1).event, 'control.updated');

    const started = performance.now();
    const failed = await json('POST', '/v1/chat/completions', { messages: [] });
    assert.ok(performance.now() - started >= 140, 'phải trễ ít nhất ~150 ms');
    assert.equal(failed.status, 502);
    assert.equal(failed.body.error.code, 'llm_stub_injected');

    const models = await json('GET', '/v1/models');
    assert.equal(models.status, 200, 'mặc định không làm lỗi health check');

    const stats = await json('GET', '/__stats');
    assert.equal(stats.body.injected_errors, 1);
    assert.ok(stats.body.total_delay_ms >= 150);
  });

  test('error_mode disconnect cắt kết nối, client nhận lỗi mạng', async () => {
    await json('PUT', '/__control', { latency_ms: 0, error_rate: 1, error_mode: 'disconnect' });
    await assert.rejects(
      fetch(`${base}/v1/chat/completions`, { method: 'POST', body: '{}' }),
      /fetch failed/u,
    );
  });

  test('cấu hình sai trả 400 và giữ nguyên cấu hình cũ; reset về mặc định', async () => {
    const before = (await json('GET', '/__control')).body.control;
    const rejected = await json('PUT', '/__control', { error_rate: 2 });
    assert.equal(rejected.status, 400);
    assert.deepEqual((await json('GET', '/__control')).body.control, before);

    const reset = await json('POST', '/__control/reset');
    assert.deepEqual(reset.body, { seed: 5, control: DEFAULT_CONTROL });
    const ok = await json('POST', '/v1/chat/completions', { messages: [] });
    assert.equal(ok.status, 200);
  });
});
