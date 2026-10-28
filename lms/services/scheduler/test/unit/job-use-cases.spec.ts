import { CreateJobUseCase } from '../../src/application/use-cases/jobs/create-job.use-case.js';
import {
  GetJobUseCase,
  ListJobRunsUseCase,
  ListJobsUseCase,
} from '../../src/application/use-cases/jobs/job-queries.use-cases.js';
import { TriggerJobRunUseCase } from '../../src/application/use-cases/jobs/trigger-job-run.use-case.js';
import { UpdateJobStatusUseCase } from '../../src/application/use-cases/jobs/update-job-status.use-case.js';
import type { CreateJobInput } from '../../src/application/use-cases/jobs/create-job.use-case.js';
import { FakeClock, InMemoryUnitOfWork, SequenceIds } from './fakes.js';

const ADMIN = '99999999-9999-4999-8999-999999999999';

function setup(): {
  uow: InMemoryUnitOfWork;
  clock: FakeClock;
  create: CreateJobUseCase;
  update: UpdateJobStatusUseCase;
  trigger: TriggerJobRunUseCase;
} {
  const clock = new FakeClock();
  const uow = new InMemoryUnitOfWork(clock);
  const ids = new SequenceIds();
  return {
    uow,
    clock,
    create: new CreateJobUseCase(uow, ids, clock),
    update: new UpdateJobStatusUseCase(uow, clock),
    trigger: new TriggerJobRunUseCase(uow, ids, clock),
  };
}

const manual = (name = 'cleanup-thu-cong'): CreateJobInput => ({
  name,
  type: 'MEDIA_UNUSED_CLEANUP',
  scheduleType: 'MANUAL',
  cronExpression: null,
  payload: { retention_hours: 24 },
  allowConcurrent: false,
});
const cron = (expression: string, name = 'cleanup-hang-dem'): CreateJobInput => ({
  ...manual(name),
  scheduleType: 'CRON',
  cronExpression: expression,
});

describe('CreateJobUseCase', () => {
  it('tạo job MANUAL: ACTIVE, không có next_run_at, ghi người tạo', async () => {
    const { create } = setup();

    const job = await create.execute(ADMIN, manual());

    expect(job).toMatchObject({
      status: 'ACTIVE',
      scheduleType: 'MANUAL',
      cronExpression: null,
      nextRunAt: null,
      createdBy: ADMIN,
      payload: { retention_hours: 24 },
    });
  });

  it('tạo job CRON: tính next_run_at theo UTC từ bây giờ', async () => {
    const { create } = setup();

    const job = await create.execute(ADMIN, cron('0 3 * * *'));

    expect(job.nextRunAt?.toISOString()).toBe('2026-10-29T03:00:00.000Z');
  });

  it('từ chối CRON sai cú pháp hoặc không bao giờ khớp bằng VALIDATION_ERROR', async () => {
    const { create, uow } = setup();

    await expect(create.execute(ADMIN, cron('abc'))).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      details: [{ path: 'cron_expression' }],
    });
    await expect(create.execute(ADMIN, cron('0 0 30 2 *'))).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(uow.jobs.rows.size).toBe(0);
  });

  it('tên job trùng → 409 CONFLICT', async () => {
    const { create } = setup();
    await create.execute(ADMIN, manual());

    await expect(create.execute(ADMIN, manual())).rejects.toMatchObject({
      code: 'CONFLICT',
      status: 409,
    });
  });
});

describe('UpdateJobStatusUseCase', () => {
  it('PAUSED xóa next_run_at; ACTIVE lại tính từ bây giờ (không chạy bù thời gian tạm dừng)', async () => {
    const { create, update, clock } = setup();
    const job = await create.execute(ADMIN, cron('0 * * * *'));
    expect(job.nextRunAt?.toISOString()).toBe('2026-10-28T09:00:00.000Z');

    const paused = await update.execute(job.id, 'PAUSED');
    expect(paused).toMatchObject({ status: 'PAUSED', nextRunAt: null });

    clock.advance(5 * 3_600_000);
    const resumed = await update.execute(job.id, 'ACTIVE');
    expect(resumed.nextRunAt?.toISOString()).toBe('2026-10-28T14:00:00.000Z');
  });

  it('đặt lại cùng trạng thái là no-op và giữ next_run_at', async () => {
    const { create, update } = setup();
    const job = await create.execute(ADMIN, cron('0 * * * *'));

    const same = await update.execute(job.id, 'ACTIVE');

    expect(same.nextRunAt).toEqual(job.nextRunAt);
  });

  it('DISABLED đóng các run PENDING bằng JOB_DISABLED, run PAUSED thì giữ nguyên', async () => {
    const { create, update, trigger, uow } = setup();
    const job = await create.execute(ADMIN, manual());
    const { run } = await trigger.execute(ADMIN, job.id, 'k1');

    await update.execute(job.id, 'PAUSED');
    expect(uow.runs.rows.get(run.id)?.status).toBe('PENDING');

    await update.execute(job.id, 'DISABLED');
    expect(uow.runs.rows.get(run.id)).toMatchObject({
      status: 'FAILED',
      errorCode: 'JOB_DISABLED',
    });
  });

  it('job không tồn tại → 404', async () => {
    const { update } = setup();

    await expect(
      update.execute('11111111-1111-4111-8111-111111111111', 'PAUSED'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('TriggerJobRunUseCase', () => {
  it('tạo run MANUAL PENDING với snapshot payload của job', async () => {
    const { create, trigger } = setup();
    const job = await create.execute(ADMIN, manual());

    const { run, created } = await trigger.execute(ADMIN, job.id, 'lan-1');

    expect(created).toBe(true);
    expect(run).toMatchObject({
      jobId: job.id,
      triggerType: 'MANUAL',
      idempotencyKey: 'lan-1',
      status: 'PENDING',
      payloadSnapshot: { retention_hours: 24 },
      createdBy: ADMIN,
    });
  });

  it('cùng idempotency_key trả cùng run, không tạo run thứ hai; khóa khác tạo run mới', async () => {
    const { create, trigger, uow } = setup();
    const job = await create.execute(ADMIN, manual());

    const first = await trigger.execute(ADMIN, job.id, 'lan-1');
    const replay = await trigger.execute(ADMIN, job.id, 'lan-1');
    const other = await trigger.execute(ADMIN, job.id, 'lan-2');

    expect(replay).toEqual({ run: first.run, created: false });
    expect(other.run.id).not.toBe(first.run.id);
    expect(uow.runs.rows.size).toBe(2);
  });

  it('cùng khóa ở hai job khác nhau là hai run khác nhau', async () => {
    const { create, trigger } = setup();
    const a = await create.execute(ADMIN, manual('a'));
    const b = await create.execute(ADMIN, manual('b'));

    const [runA, runB] = [
      await trigger.execute(ADMIN, a.id, 'k'),
      await trigger.execute(ADMIN, b.id, 'k'),
    ];

    expect(runA.run.id).not.toBe(runB.run.id);
  });

  it('job PAUSED/DISABLED không nhận run mới (409), nhưng khóa cũ vẫn trả run cũ', async () => {
    const { create, update, trigger } = setup();
    const job = await create.execute(ADMIN, manual());
    const first = await trigger.execute(ADMIN, job.id, 'k');
    await update.execute(job.id, 'PAUSED');

    await expect(trigger.execute(ADMIN, job.id, 'moi')).rejects.toMatchObject({
      code: 'SCHEDULER_JOB_NOT_ACTIVE',
      status: 409,
      details: { status: 'PAUSED' },
    });
    expect(await trigger.execute(ADMIN, job.id, 'k')).toEqual({ run: first.run, created: false });

    await update.execute(job.id, 'DISABLED');
    await expect(trigger.execute(ADMIN, job.id, 'moi')).rejects.toMatchObject({
      code: 'SCHEDULER_JOB_NOT_ACTIVE',
    });
  });

  it('job không tồn tại → 404', async () => {
    const { trigger } = setup();

    await expect(
      trigger.execute(ADMIN, '11111111-1111-4111-8111-111111111111', 'k'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('truy vấn job và run', () => {
  it('list-jobs lọc theo status/type, get-job và list-job-runs trả 404 khi thiếu job', async () => {
    const { create, update, trigger, uow } = setup();
    const a = await create.execute(ADMIN, manual('a'));
    await create.execute(ADMIN, manual('b'));
    await update.execute(a.id, 'PAUSED');
    await update.execute(a.id, 'ACTIVE');
    const paused = await create.execute(ADMIN, manual('c'));
    await update.execute(paused.id, 'PAUSED');
    await trigger.execute(ADMIN, a.id, 'k1');
    await trigger.execute(ADMIN, a.id, 'k2');

    const list = new ListJobsUseCase(uow);
    expect((await list.execute({}, 1, 20)).total).toBe(3);
    expect((await list.execute({ status: 'PAUSED' }, 1, 20)).items.map((j) => j.name)).toEqual([
      'c',
    ]);
    expect((await list.execute({ type: 'MEDIA_UNUSED_CLEANUP' }, 1, 2)).items).toHaveLength(2);

    expect((await new GetJobUseCase(uow).execute(a.id)).name).toBe('a');
    const runs = await new ListJobRunsUseCase(uow).execute(a.id, undefined, 1, 20);
    expect(runs.total).toBe(2);
    await expect(
      new GetJobUseCase(uow).execute('11111111-1111-4111-8111-111111111111'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      new ListJobRunsUseCase(uow).execute('11111111-1111-4111-8111-111111111111', undefined, 1, 20),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
