import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, describe, test } from 'node:test';

import { execute, planCommand } from './fault-control.mjs';
import {
  DEFAULT_MANIFEST,
  buildSchedule,
  peakAlignedStart,
  precheck,
  runSchedule,
  validateManifest,
} from './fault-schedule.mjs';
import { createLlmStub } from './llm-stub/server.mjs';

const manifest = JSON.parse(readFileSync(DEFAULT_MANIFEST, 'utf8'));

describe('fault manifest', () => {
  test('manifest v1 hợp lệ và có đủ bốn case MVP', () => {
    assert.deepEqual(validateManifest(manifest), []);
    assert.deepEqual(
      manifest.cases.map((item) => item.case_id),
      ['C2', 'C3', 'C4', 'C6'],
    );
  });

  test('báo lỗi khi thiếu trường, lệnh sai hoặc không đủ recovery', () => {
    const broken = structuredClone(manifest);
    delete broken.cases[0].root_cause_component;
    broken.cases[1].activate = [['latency', 'không-có-proxy']];
    broken.cases[2].fault_duration_s = 2000;
    broken.cases.push({ ...broken.cases[3] });
    const errors = validateManifest(broken);
    assert.ok(errors.some((text) => text.startsWith('C2: thiếu root_cause_component')));
    assert.ok(errors.some((text) => text.startsWith('C3: activate')));
    assert.ok(errors.some((text) => text.startsWith('C4: không đủ')));
    assert.ok(errors.some((text) => text.startsWith('C6: trùng case_id')));
  });

  test('lịch mặc định, lịch ghi đè và lịch trùng đỉnh tải', () => {
    const base = buildSchedule(manifest, 'C2');
    assert.deepEqual([base.activate_at_s, base.deactivate_at_s], [1080, 1680]);
    assert.equal(base.root_cause_component, 'course-postgres');
    const custom = buildSchedule(manifest, 'C6', { startS: 900, durationS: 120 });
    assert.deepEqual([custom.activate_at_s, custom.deactivate_at_s], [900, 1020]);
    assert.equal(custom.timeline_check, 'ok');
    assert.throws(() => buildSchedule(manifest, 'C2', { startS: 60 }), /warm-up/u);
    assert.throws(() => buildSchedule(manifest, 'C2', { startS: 2000 }), /recovery/u);
    const short = buildSchedule(manifest, 'C2', { startS: 60, durationS: 60, allowShort: true });
    assert.equal(short.timeline_check, 'skipped_allow_short');
    // Đỉnh tải quanh giây 1500–1700: cửa sổ 600 s phải phủ trọn đỉnh.
    const starts = [...Array(50).keys()].map((i) => 400 + i * 40).concat(Array(300).fill(1600));
    const aligned = buildSchedule(manifest, 'C2', { peakStarts: starts });
    assert.ok(aligned.activate_at_s <= 1600 && aligned.deactivate_at_s > 1600);
    assert.equal(aligned.alignment.mode, 'load_peak');
    assert.throws(() => buildSchedule(manifest, 'C9'), /Không có case C9/u);
  });

  test('peakAlignedStart tôn trọng warm-up và recovery', () => {
    const timeline = { run_seconds: 2880, warmup_s: 360, min_recovery_s: 600 };
    assert.equal(peakAlignedStart([10, 20, 30], timeline, 600).start, 360);
    // Đỉnh ở 2.200 s: cửa sổ phải phủ đỉnh nhưng không bắt đầu sau 2.880 − 600 − 600 = 1.680 s.
    const late = peakAlignedStart(Array(5).fill(2200), timeline, 600);
    assert.ok(late.start > 1600 && late.start <= 1680);
    assert.equal(late.count, 5);
    assert.throws(() => peakAlignedStart([], timeline, 2500), /quá ngắn/u);
  });
});

describe('lệnh container (C6)', () => {
  test('chỉ cho phép service runtime của LMS', () => {
    assert.deepEqual(planCommand(['container', 'pause', 'identity']), {
      action: 'container',
      operation: 'pause',
      service: 'identity',
    });
    assert.throws(() => planCommand(['container', 'pause', 'postgres']), /không được phép/u);
    assert.throws(() => planCommand(['container', 'stop', 'identity']), /pause hoặc unpause/u);
  });

  test('gọi docker với tên container theo project Compose', async () => {
    const calls = [];
    const execImpl = async (file, args) => {
      calls.push([file, ...args]);
      return { stdout: 'paused\n' };
    };
    const result = await execute(planCommand(['container', 'pause', 'identity']), {
      env: { COMPOSE_PROJECT_NAME: 'demo' },
      execImpl,
    });
    assert.deepEqual(calls[0], ['docker', 'pause', 'demo-identity-1']);
    assert.deepEqual(calls[1].slice(0, 2), ['docker', 'inspect']);
    assert.equal(result.container, 'demo-identity-1');
  });

  test('precheck so biến môi trường thật của container với yêu cầu của case', async () => {
    const schedule = buildSchedule(manifest, 'C6');
    const envText = (value) => async () => ({
      stdout: `PATH=/bin\nIDENTITY_SERVICE_TOKEN_TTL_SECONDS=${value}\n`,
    });
    assert.equal((await precheck(schedule, { execImpl: envText('60'), env: {} })).ok, true);
    const failed = await precheck(schedule, { execImpl: envText('600'), env: {} });
    assert.equal(failed.ok, false);
    assert.equal(failed.results[0].actual, '600');
    assert.equal((await precheck(buildSchedule(manifest, 'C2'), { env: {} })).ok, true);
  });
});

describe('runSchedule trên LLM stub thật, đồng hồ giả', () => {
  let stub;
  let executeOptions;

  before(async () => {
    stub = createLlmStub({ seed: 1, log: () => {} });
    const address = await stub.listen(0, '127.0.0.1');
    executeOptions = { env: { LLM_STUB_CONTROL_URL: `http://127.0.0.1:${address.port}` } };
  });

  after(async () => {
    await stub.close();
  });

  function fakeClock(startMs) {
    let current = startMs;
    return { now: () => current, wait: async (ms) => (current += ms) };
  }

  test('bật đúng mốc, gỡ đúng mốc, nhật ký có drift', async () => {
    const schedule = buildSchedule(manifest, 'C3', { startS: 60, durationS: 30, allowShort: true });
    const clock = fakeClock(1_000_000);
    const records = [];
    const observed = {};
    const result = await runSchedule(schedule, {
      runStartMs: 1_000_000,
      log: (record) => {
        records.push(record);
        if (record.event === 'fault.activate') observed.latency = stub.control.latency_ms;
      },
      executeOptions,
      ...clock,
    });
    assert.deepEqual(result, { activated: true, aborted: false, ok: true });
    assert.deepEqual(
      records.map((record) => record.event),
      ['fault.scheduled', 'fault.activate', 'fault.deactivate'],
    );
    assert.equal(observed.latency, 30000);
    assert.equal(stub.control.latency_ms, 0);
    assert.equal(records[1].ts, new Date(1_060_000).toISOString());
    assert.equal(records[1].drift_ms, 0);
    assert.equal(records[2].reason, 'scheduled');
  });

  test('bị ngắt khi fault đang bật: vẫn gỡ fault và ghi lý do', async () => {
    const schedule = buildSchedule(manifest, 'C3', {
      startS: 10,
      durationS: 600,
      allowShort: true,
    });
    const clock = fakeClock(0);
    const controller = new AbortController();
    const records = [];
    const result = await runSchedule(schedule, {
      runStartMs: 0,
      log: (record) => {
        records.push(record);
        if (record.event === 'fault.activate') controller.abort();
      },
      signal: controller.signal,
      executeOptions,
      ...clock,
    });
    assert.equal(result.aborted, true);
    assert.equal(records.at(-1).event, 'fault.deactivate');
    assert.equal(records.at(-1).reason, 'aborted');
    assert.equal(stub.control.latency_ms, 0);
  });

  test('bật lỗi thì gỡ ngay và báo thất bại', async () => {
    const schedule = {
      ...buildSchedule(manifest, 'C3', { startS: 0, durationS: 10, allowShort: true }),
      activate: [['llm', 'set', '--error-rate', '3']],
    };
    const records = [];
    const result = await runSchedule(schedule, {
      runStartMs: 0,
      log: (record) => records.push(record),
      executeOptions,
      ...fakeClock(0),
    });
    assert.equal(result.ok, false);
    assert.equal(records[1].ok, false);
    assert.equal(records[2].reason, 'activate_failed');
  });
});
