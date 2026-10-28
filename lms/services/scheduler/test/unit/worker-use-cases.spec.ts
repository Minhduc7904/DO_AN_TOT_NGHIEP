import { AppError } from '@aiops-lms/common/errors';

import type {
  JobHandler,
  JobHandlerResult,
  JobHandlers,
} from '../../src/application/ports/job-handler.js';
import { CreateJobUseCase } from '../../src/application/use-cases/jobs/create-job.use-case.js';
import { TriggerJobRunUseCase } from '../../src/application/use-cases/jobs/trigger-job-run.use-case.js';
import { UpdateJobStatusUseCase } from '../../src/application/use-cases/jobs/update-job-status.use-case.js';
import { ExecuteNextRunUseCase } from '../../src/application/use-cases/worker/execute-next-run.use-case.js';
import { TickCronJobsUseCase } from '../../src/application/use-cases/worker/tick-cron-jobs.use-case.js';
import { cronIdempotencyKey, type JsonObject } from '../../src/domain/job.js';
import { FakeClock, InMemoryUnitOfWork, SequenceIds } from './fakes.js';

const ADMIN = '99999999-9999-4999-8999-999999999999';

class ScriptedHandler implements JobHandler {
  readonly payloads: JsonObject[] = [];
  next: () => Promise<JobHandlerResult> = () => Promise.resolve({ output: { deleted: 1 } });

  handle(payload: JsonObject): Promise<JobHandlerResult> {
    this.payloads.push(payload);
    return this.next();
  }
}

function setup(): {
  uow: InMemoryUnitOfWork;
  clock: FakeClock;
  handler: ScriptedHandler;
  create: CreateJobUseCase;
  update: UpdateJobStatusUseCase;
  trigger: TriggerJobRunUseCase;
  tick: TickCronJobsUseCase;
  worker: (instance?: string) => ExecuteNextRunUseCase;
} {
  const clock = new FakeClock(new Date('2026-10-28T08:00:30.000Z'));
  const uow = new InMemoryUnitOfWork(clock);
  const ids = new SequenceIds();
  const handler = new ScriptedHandler();
  const handlers: JobHandlers = { MEDIA_UNUSED_CLEANUP: handler };
  return {
    uow,
    clock,
    handler,
    create: new CreateJobUseCase(uow, ids, clock),
    update: new UpdateJobStatusUseCase(uow, clock),
    trigger: new TriggerJobRunUseCase(uow, ids, clock),
    tick: new TickCronJobsUseCase(uow, ids, clock, 10),
    worker: (instance = 'scheduler-worker@a') =>
      new ExecuteNextRunUseCase(uow, handlers, ids, clock, {
        leaseMs: 60_000,
        maxAttempts: 3,
        workerInstance: instance,
      }),
  };
}

type JobInput = Parameters<CreateJobUseCase['execute']>[1];

const job = (overrides: Partial<JobInput> = {}): JobInput =>
  ({
    name: 'cleanup',
    type: 'MEDIA_UNUSED_CLEANUP' as const,
    scheduleType: 'MANUAL' as const,
    cronExpression: null,
    payload: { retention_hours: 48 },
    allowConcurrent: false,
    ...overrides,
  }) satisfies JobInput;

describe('TickCronJobsUseCase', () => {
  it('tạo run CRON đúng mốc lịch, khóa lũy đẳng theo (job, scheduled_at), rồi dời next_run_at', async () => {
    const { create, tick, uow, clock } = setup();
    const created = await create.execute(
      ADMIN,
      job({ scheduleType: 'CRON', cronExpression: '*/5 * * * *' }),
    );
    expect(created.nextRunAt?.toISOString()).toBe('2026-10-28T08:05:00.000Z');

    expect(await tick.execute()).toBe(0); // chưa đến hạn

    clock.advance(4 * 60_000 + 45_000); // 08:05:15
    expect(await tick.execute()).toBe(1);

    const [run] = [...uow.runs.rows.values()];
    expect(run).toMatchObject({
      triggerType: 'CRON',
      status: 'PENDING',
      createdBy: null,
      payloadSnapshot: { retention_hours: 48 },
      idempotencyKey: cronIdempotencyKey(created.id, new Date('2026-10-28T08:05:00.000Z')),
      scheduledAt: new Date('2026-10-28T08:05:00.000Z'),
    });
    expect(uow.jobs.rows.get(created.id)?.nextRunAt?.toISOString()).toBe(
      '2026-10-28T08:10:00.000Z',
    );
    // Gọi lại ngay (lặp/instance khác) không tạo thêm.
    expect(await tick.execute()).toBe(0);
    expect(uow.runs.rows.size).toBe(1);
  });

  it('next_run_at bị đặt lại về mốc cũ vẫn không tạo run trùng nhờ khóa lũy đẳng', async () => {
    const { create, tick, uow, clock } = setup();
    const created = await create.execute(
      ADMIN,
      job({ scheduleType: 'CRON', cronExpression: '*/5 * * * *' }),
    );
    clock.advance(5 * 60_000);
    await tick.execute();

    await uow.jobs.setNextRunAt(created.id, new Date('2026-10-28T08:05:00.000Z'));
    expect(await tick.execute()).toBe(0);
    expect(uow.runs.rows.size).toBe(1);
  });

  it('worker ngừng lâu chỉ chạy bù một lần rồi nhảy tới mốc kế tiếp sau bây giờ', async () => {
    const { create, tick, uow, clock } = setup();
    const created = await create.execute(
      ADMIN,
      job({ scheduleType: 'CRON', cronExpression: '0 * * * *' }),
    );
    clock.advance(5 * 3_600_000 + 10 * 60_000); // 13:10:30, lỡ 09,10,11,12,13

    expect(await tick.execute()).toBe(1);

    expect(uow.runs.rows.size).toBe(1);
    expect(uow.jobs.rows.get(created.id)?.nextRunAt?.toISOString()).toBe(
      '2026-10-28T14:00:00.000Z',
    );
  });

  it('job PAUSED/DISABLED và job MANUAL không sinh run', async () => {
    const { create, update, tick, uow, clock } = setup();
    const cronJob = await create.execute(
      ADMIN,
      job({ name: 'c', scheduleType: 'CRON', cronExpression: '* * * * *' }),
    );
    await create.execute(ADMIN, job({ name: 'm' }));
    await update.execute(cronJob.id, 'PAUSED');
    clock.advance(10 * 60_000);

    expect(await tick.execute()).toBe(0);
    expect(uow.runs.rows.size).toBe(0);
  });
});

describe('ExecuteNextRunUseCase', () => {
  it('chạy run PENDING: handler nhận snapshot payload, ghi SUCCEEDED + output + worker', async () => {
    const { create, trigger, worker, handler, uow } = setup();
    const created = await create.execute(ADMIN, job());
    const { run } = await trigger.execute(ADMIN, created.id, 'k');
    handler.next = () => Promise.resolve({ output: { unused_deleted: 3 } });

    expect(await worker().execute()).toBe(true);

    expect(handler.payloads).toEqual([{ retention_hours: 48 }]);
    expect(uow.runs.rows.get(run.id)).toMatchObject({
      status: 'SUCCEEDED',
      attempts: 1,
      workerInstance: 'scheduler-worker@a',
      outputJson: { unused_deleted: 3 },
      errorCode: null,
      leaseToken: null,
    });
    expect(uow.runs.rows.get(run.id)?.finishedAt).not.toBeNull();
    // Hết việc.
    expect(await worker().execute()).toBe(false);
  });

  it('handler báo thất bại: FAILED với mã/thông báo an toàn và giữ output tóm tắt', async () => {
    const { create, trigger, worker, handler, uow } = setup();
    const created = await create.execute(ADMIN, job());
    const { run } = await trigger.execute(ADMIN, created.id, 'k');
    handler.next = () =>
      Promise.resolve({
        output: { failed: 2 },
        failure: { code: 'MEDIA_CLEANUP_INCOMPLETE', message: 'còn 2 media lỗi' },
      });

    await worker().execute();

    expect(uow.runs.rows.get(run.id)).toMatchObject({
      status: 'FAILED',
      errorCode: 'MEDIA_CLEANUP_INCOMPLETE',
      errorMessage: 'còn 2 media lỗi',
      outputJson: { failed: 2 },
    });
  });

  it('handler ném AppError: lấy mã của AppError; lỗi lạ: INTERNAL_ERROR không lộ chi tiết', async () => {
    const { create, trigger, worker, handler, uow } = setup();
    const created = await create.execute(ADMIN, job());
    const first = (await trigger.execute(ADMIN, created.id, 'a')).run;
    handler.next = () => Promise.reject(AppError.dependencyUnavailable('scheduler-worker-media'));
    await worker().execute();
    expect(uow.runs.rows.get(first.id)).toMatchObject({
      status: 'FAILED',
      errorCode: 'DEPENDENCY_UNAVAILABLE',
    });

    const second = (await trigger.execute(ADMIN, created.id, 'b')).run;
    handler.next = () => Promise.reject(new Error('secret=abc connect ECONNREFUSED 10.0.0.1'));
    await worker().execute();
    const failed = uow.runs.rows.get(second.id);
    expect(failed).toMatchObject({ status: 'FAILED', errorCode: 'INTERNAL_ERROR' });
    expect(failed?.errorMessage).not.toMatch(/secret|10\.0\.0\.1/u);
  });

  it('job PAUSED không được nhận; ACTIVE lại thì chạy; job DISABLED đã đóng run từ trước', async () => {
    const { create, update, trigger, worker, uow } = setup();
    const created = await create.execute(ADMIN, job());
    const { run } = await trigger.execute(ADMIN, created.id, 'k');
    await update.execute(created.id, 'PAUSED');

    expect(await worker().execute()).toBe(false);
    expect(uow.runs.rows.get(run.id)?.status).toBe('PENDING');

    await update.execute(created.id, 'ACTIVE');
    expect(await worker().execute()).toBe(true);
    expect(uow.runs.rows.get(run.id)?.status).toBe('SUCCEEDED');

    const second = (await trigger.execute(ADMIN, created.id, 'k2')).run;
    await update.execute(created.id, 'DISABLED');
    expect(await worker().execute()).toBe(false);
    expect(uow.runs.rows.get(second.id)).toMatchObject({
      status: 'FAILED',
      errorCode: 'JOB_DISABLED',
    });
  });

  it('hai instance không cùng nhận một run; job không allow_concurrent chỉ chạy một run một lúc', async () => {
    const { create, trigger, worker, handler, uow } = setup();
    const created = await create.execute(ADMIN, job());
    const a = (await trigger.execute(ADMIN, created.id, 'a')).run;
    const b = (await trigger.execute(ADMIN, created.id, 'b')).run;
    let release: () => void = () => undefined;
    handler.next = () =>
      new Promise<JobHandlerResult>((resolve) => {
        release = () => resolve({ output: {} });
      });

    const first = worker('scheduler-worker@a').execute();
    await Promise.resolve();
    await new Promise((resolve) => setImmediate(resolve));
    // Instance thứ hai không nhận run còn lại vì run đầu đang RUNNING (lease còn hạn).
    expect(await worker('scheduler-worker@b').execute()).toBe(false);
    expect(uow.runs.rows.get(a.id)?.status).toBe('RUNNING');
    expect(uow.runs.rows.get(b.id)?.status).toBe('PENDING');

    release();
    await first;
    handler.next = () => Promise.resolve({ output: {} });
    expect(await worker('scheduler-worker@b').execute()).toBe(true);
    expect(uow.runs.rows.get(b.id)).toMatchObject({
      status: 'SUCCEEDED',
      workerInstance: 'scheduler-worker@b',
    });
  });

  it('allow_concurrent cho phép instance thứ hai nhận run khác của cùng job', async () => {
    const { create, trigger, worker, handler, uow } = setup();
    const created = await create.execute(ADMIN, job({ allowConcurrent: true }));
    const a = (await trigger.execute(ADMIN, created.id, 'a')).run;
    const b = (await trigger.execute(ADMIN, created.id, 'b')).run;
    handler.next = () => new Promise<JobHandlerResult>(() => undefined);

    void worker('scheduler-worker@a').execute();
    await new Promise((resolve) => setImmediate(resolve));
    void worker('scheduler-worker@b').execute();
    await new Promise((resolve) => setImmediate(resolve));

    expect(uow.runs.rows.get(a.id)?.workerInstance).toBe('scheduler-worker@a');
    expect(uow.runs.rows.get(b.id)?.workerInstance).toBe('scheduler-worker@b');
  });

  it('worker chết: lease hết hạn thì run được nhận lại, tới khi hết lượt thì FAILED/RUN_LEASE_EXPIRED', async () => {
    const { create, trigger, worker, handler, uow, clock } = setup();
    const created = await create.execute(ADMIN, job());
    const { run } = await trigger.execute(ADMIN, created.id, 'k');
    handler.next = () => new Promise<JobHandlerResult>(() => undefined); // treo mãi = worker chết

    void worker('scheduler-worker@a').execute();
    await new Promise((resolve) => setImmediate(resolve));
    expect(uow.runs.rows.get(run.id)).toMatchObject({ status: 'RUNNING', attempts: 1 });

    // Lease chưa hết: không ai nhận lại.
    expect(await worker('scheduler-worker@b').execute()).toBe(false);

    // Lease hết: instance khác nhận lại (lần 2) và chạy xong.
    clock.advance(61_000);
    handler.next = () => Promise.resolve({ output: { ok: true } });
    expect(await worker('scheduler-worker@b').execute()).toBe(true);
    expect(uow.runs.rows.get(run.id)).toMatchObject({
      status: 'SUCCEEDED',
      attempts: 2,
      workerInstance: 'scheduler-worker@b',
    });

    // Một run khác bị nhận lại tới hết số lần rồi mới bị đóng.
    const stuck = (await trigger.execute(ADMIN, created.id, 'stuck')).run;
    handler.next = () => new Promise<JobHandlerResult>(() => undefined);
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      void worker(`scheduler-worker@${attempt}`).execute();
      await new Promise((resolve) => setImmediate(resolve));
      expect(uow.runs.rows.get(stuck.id)?.attempts).toBe(attempt);
      clock.advance(61_000);
    }
    expect(await worker().execute()).toBe(false);
    expect(uow.runs.rows.get(stuck.id)).toMatchObject({
      status: 'FAILED',
      errorCode: 'RUN_LEASE_EXPIRED',
      attempts: 3,
    });
  });

  it('mất lease giữa chừng: kết quả muộn không ghi đè run đã được instance khác nhận', async () => {
    const { create, trigger, worker, handler, uow, clock } = setup();
    const created = await create.execute(ADMIN, job());
    const { run } = await trigger.execute(ADMIN, created.id, 'k');
    let releaseSlow: () => void = () => undefined;
    handler.next = () =>
      new Promise<JobHandlerResult>((resolve) => {
        releaseSlow = () => resolve({ output: { who: 'cham' } });
      });
    const slow = worker('scheduler-worker@slow').execute();
    await new Promise((resolve) => setImmediate(resolve));

    clock.advance(61_000);
    handler.next = () => Promise.resolve({ output: { who: 'nhanh' } });
    await worker('scheduler-worker@fast').execute();
    releaseSlow();
    await slow;

    expect(uow.runs.rows.get(run.id)).toMatchObject({
      status: 'SUCCEEDED',
      outputJson: { who: 'nhanh' },
      workerInstance: 'scheduler-worker@fast',
    });
  });
});
