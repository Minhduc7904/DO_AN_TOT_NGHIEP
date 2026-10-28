import { DispatchBatchUseCase } from '../../src/application/use-cases/worker/dispatch-batch.use-case.js';
import { DispatchSingleNotificationUseCase } from '../../src/application/use-cases/worker/dispatch-single.use-case.js';
import { FailBatchUseCase } from '../../src/application/use-cases/worker/fail-batch.use-case.js';
import { SnapshotBatchUseCase } from '../../src/application/use-cases/worker/snapshot-batch.use-case.js';
import type { Notification, NotificationBatch } from '../../src/domain/notification.js';
import { FakeClock, FakeEmails, FakeStudents, MemoryUnitOfWork, SequenceIds } from './fakes.js';

const ADMIN = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001';
const MEDIA = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const student = (n: number): string => `bbbbbbbb-bbbb-4bbb-8bbb-${String(n).padStart(12, '0')}`;

const SETTINGS = {
  leaseMs: 60_000,
  maxAttempts: 2,
  retryBaseMs: 1_000,
  concurrency: 2,
  maxIdleWaitMs: 0,
};

function setup(): {
  ids: SequenceIds;
  uow: MemoryUnitOfWork;
  clock: FakeClock;
  students: FakeStudents;
  emails: FakeEmails;
  failBatch: FailBatchUseCase;
  snapshot: SnapshotBatchUseCase;
  dispatch: DispatchBatchUseCase;
  single: DispatchSingleNotificationUseCase;
} {
  const ids = new SequenceIds();
  const uow = new MemoryUnitOfWork(ids);
  const clock = new FakeClock();
  const students = new FakeStudents();
  const emails = new FakeEmails();
  const failBatch = new FailBatchUseCase(uow, clock);
  return {
    ids,
    uow,
    clock,
    students,
    emails,
    failBatch,
    snapshot: new SnapshotBatchUseCase(uow, students, ids, clock, failBatch),
    dispatch: new DispatchBatchUseCase(uow, emails, ids, clock, SETTINGS),
    single: new DispatchSingleNotificationUseCase(uow, students, emails),
  };
}

async function newBatch(
  ctx: ReturnType<typeof setup>,
  options: { content?: string; mediaUsageJobId?: string | null } = {},
): Promise<NotificationBatch> {
  const batch = await ctx.uow.stores.batches.create({
    id: 'dddddddd-dddd-4ddd-8ddd-000000000001',
    title: 'Tiêu đề',
    contentMarkdown: options.content ?? 'nội dung',
    targetScope: 'ALL_STUDENTS',
    batchSize: 10,
    sourceBatchId: null,
    createdBy: ADMIN,
    mediaUsageJobId: options.mediaUsageJobId ?? null,
  });
  return batch!;
}

describe('SnapshotBatchUseCase', () => {
  it('chụp mọi student ACTIVE kèm email, sang SNAPSHOT_READY và phát dispatch', async () => {
    const ctx = setup();
    ctx.students.add(student(1), 'a@lms.local');
    ctx.students.add(student(2), 'b@lms.local');
    ctx.students.add(student(3), 'off@lms.local', false);
    const batch = await newBatch(ctx);

    await ctx.snapshot.execute('m1', 'snapshot', batch.id);

    expect(ctx.uow.state.batches.get(batch.id)).toMatchObject({
      status: 'SNAPSHOT_READY',
      requestedCount: 2,
    });
    expect([...ctx.uow.state.items.values()].map((i) => i.email).sort()).toEqual([
      'a@lms.local',
      'b@lms.local',
    ]);
    expect(ctx.uow.commands).toEqual([{ name: 'dispatch', args: [batch.id] }]);
  });

  it('message lặp (redelivery) không phát dispatch lần hai và không trùng item', async () => {
    const ctx = setup();
    ctx.students.add(student(1), 'a@lms.local');
    const batch = await newBatch(ctx);

    await ctx.snapshot.execute('m1', 'snapshot', batch.id);
    await ctx.snapshot.execute('m1', 'snapshot', batch.id);

    expect(ctx.uow.state.items.size).toBe(1);
    expect(ctx.uow.commands.filter((c) => c.name === 'dispatch')).toHaveLength(1);
  });

  it('không có student: COMPLETED ngay và đóng job usage media', async () => {
    const ctx = setup();
    const jobId = 'eeeeeeee-eeee-4eee-8eee-000000000001';
    const batch = await newBatch(ctx, { mediaUsageJobId: jobId });

    await ctx.snapshot.execute('m1', 'snapshot', batch.id);

    expect(ctx.uow.state.batches.get(batch.id)).toMatchObject({
      status: 'COMPLETED',
      requestedCount: 0,
    });
    expect(ctx.uow.commands).toEqual([{ name: 'media-complete', args: [jobId, 0] }]);
  });

  it('batch FAILED_RECIPIENTS chỉ sao chép item lỗi của batch nguồn, không gọi student', async () => {
    const ctx = setup();
    const source = await newBatch(ctx);
    await ctx.uow.stores.items.insertMany([
      { id: 'i1', batchId: source.id, studentId: student(1), email: 'a@lms.local' },
      { id: 'i2', batchId: source.id, studentId: student(2), email: 'b@lms.local' },
    ]);
    ctx.uow.state.items.set('i1', { ...ctx.uow.state.items.get('i1')!, status: 'FAILED' });
    const retry = await ctx.uow.stores.batches.create({
      id: 'dddddddd-dddd-4ddd-8ddd-000000000002',
      title: 't',
      contentMarkdown: 'c',
      targetScope: 'FAILED_RECIPIENTS',
      batchSize: 10,
      sourceBatchId: source.id,
      createdBy: ADMIN,
      mediaUsageJobId: null,
    });

    await ctx.snapshot.execute('m1', 'snapshot', retry!.id);

    expect(ctx.students.listCalls).toBe(0);
    expect(
      [...ctx.uow.state.items.values()].filter((i) => i.batchId === retry!.id).map((i) => i.email),
    ).toEqual(['a@lms.local']);
  });
});

describe('DispatchBatchUseCase', () => {
  async function ready(
    ctx: ReturnType<typeof setup>,
    count: number,
    content?: string,
    jobId?: string,
  ): Promise<NotificationBatch> {
    for (let n = 1; n <= count; n += 1) ctx.students.add(student(n), `s${n}@lms.local`);
    const batch = await newBatch(ctx, {
      ...(content ? { content } : {}),
      mediaUsageJobId: jobId ?? null,
    });
    await ctx.snapshot.execute('m1', 'snapshot', batch.id);
    ctx.uow.commands.length = 0;
    return batch;
  }

  it('gửi hết trong một lượt: inbox cho từng recipient và batch COMPLETED', async () => {
    const ctx = setup();
    const batch = await ready(ctx, 3);

    await ctx.dispatch.execute(batch.id);

    expect(ctx.emails.sent.map((e) => e.to).sort()).toEqual([
      's1@lms.local',
      's2@lms.local',
      's3@lms.local',
    ]);
    expect(ctx.uow.state.notifications.size).toBe(3);
    expect(ctx.uow.state.batches.get(batch.id)).toMatchObject({
      status: 'COMPLETED',
      successCount: 3,
      failedCount: 0,
    });
    expect(ctx.uow.commands).toEqual([]);
  });

  it('lỗi SMTP: item RETRY rồi FAILED sau maxAttempts → PARTIAL_FAILED', async () => {
    const ctx = setup();
    const batch = await ready(ctx, 2);
    ctx.emails.failing.set('s2@lms.local', 99);

    await ctx.dispatch.execute(batch.id);
    expect(ctx.uow.state.batches.get(batch.id)?.status).toBe('PROCESSING');
    expect(ctx.uow.commands).toEqual([{ name: 'dispatch', args: [batch.id] }]);

    ctx.clock.advance(5_000);
    await ctx.dispatch.execute(batch.id);

    expect(ctx.uow.state.batches.get(batch.id)).toMatchObject({
      status: 'PARTIAL_FAILED',
      successCount: 1,
      failedCount: 1,
    });
    expect([...ctx.uow.state.items.values()].find((i) => i.status === 'FAILED')).toMatchObject({
      email: 's2@lms.local',
      attempts: 2,
      lastError: 'smtp down',
    });
  });

  it('toàn bộ lỗi → FAILED', async () => {
    const ctx = setup();
    const batch = await ready(ctx, 1);
    ctx.emails.failing.set('s1@lms.local', 99);

    await ctx.dispatch.execute(batch.id);
    ctx.clock.advance(5_000);
    await ctx.dispatch.execute(batch.id);

    expect(ctx.uow.state.batches.get(batch.id)?.status).toBe('FAILED');
  });

  it('gửi lại sau lỗi tạm thời thì thành công và không tạo inbox trùng', async () => {
    const ctx = setup();
    const batch = await ready(ctx, 1);
    ctx.emails.failing.set('s1@lms.local', 1);

    await ctx.dispatch.execute(batch.id);
    ctx.clock.advance(5_000);
    await ctx.dispatch.execute(batch.id);

    expect(ctx.uow.state.batches.get(batch.id)?.status).toBe('COMPLETED');
    expect(ctx.uow.state.notifications.size).toBe(1);
  });

  it('lease hết hạn (worker crash): item được nhận lại', async () => {
    const ctx = setup();
    const batch = await ready(ctx, 1);
    await ctx.uow.stores.batches.update(batch.id, { status: 'PROCESSING' });
    await ctx.uow.stores.items.claim(batch.id, 10, 60_000, ctx.clock.now(), 'crashed');

    await ctx.dispatch.execute(batch.id);
    expect(ctx.emails.sent).toHaveLength(0);

    ctx.clock.advance(61_000);
    await ctx.dispatch.execute(batch.id);

    expect(ctx.emails.sent).toHaveLength(1);
    expect(ctx.uow.state.batches.get(batch.id)?.status).toBe('COMPLETED');
  });

  it('batch có media: đăng ký usage theo lô rồi complete-job với số usage kỳ vọng', async () => {
    const ctx = setup();
    const jobId = 'eeeeeeee-eeee-4eee-8eee-000000000001';
    const batch = await ready(ctx, 2, `![x](/api/v1/media/${MEDIA}/content)`, jobId);

    await ctx.dispatch.execute(batch.id);

    expect(ctx.uow.commands).toEqual([
      { name: 'media-register-batch', args: [jobId, 2, ADMIN] },
      { name: 'media-complete', args: [jobId, 2] },
    ]);
  });

  it('batch đã kết thúc hoặc không tồn tại thì bỏ qua', async () => {
    const ctx = setup();
    const batch = await ready(ctx, 1);
    await ctx.dispatch.execute(batch.id);
    const sent = ctx.emails.sent.length;

    await ctx.dispatch.execute(batch.id);
    await ctx.dispatch.execute('dddddddd-dddd-4ddd-8ddd-ffffffffffff');

    expect(ctx.emails.sent).toHaveLength(sent);
  });
});

describe('FailBatchUseCase', () => {
  it('đưa batch đang mở về FAILED và đóng job media; batch đã xong thì giữ nguyên', async () => {
    const ctx = setup();
    const jobId = 'eeeeeeee-eeee-4eee-8eee-000000000001';
    const batch = await newBatch(ctx, { mediaUsageJobId: jobId });

    await ctx.failBatch.execute(batch.id, 'hết retry');
    await ctx.failBatch.execute(batch.id, 'lần hai');

    expect(ctx.uow.state.batches.get(batch.id)).toMatchObject({
      status: 'FAILED',
      lastError: 'hết retry',
    });
    expect(ctx.uow.commands).toEqual([{ name: 'media-complete', args: [jobId, 0] }]);
  });
});

describe('DispatchSingleNotificationUseCase', () => {
  async function pending(ctx: ReturnType<typeof setup>, studentId: string): Promise<Notification> {
    return ctx.uow.stores.notifications.create({
      id: 'ffffffff-ffff-4fff-8fff-000000000001',
      studentId,
      title: 'Chào',
      contentMarkdown: 'nội dung',
      sourceType: 'SINGLE',
      batchId: null,
      emailStatus: 'PENDING',
      createdBy: ADMIN,
    });
  }

  it('gửi email tới địa chỉ hiện tại của student và đánh dấu SENT', async () => {
    const ctx = setup();
    ctx.students.add(student(1), 'a@lms.local');
    const notification = await pending(ctx, student(1));

    await ctx.single.execute(notification.id);

    expect(ctx.emails.sent).toEqual([
      { to: 'a@lms.local', subject: 'Chào', text: 'Chào\n\nnội dung\n' },
    ]);
    expect(ctx.uow.state.notifications.get(notification.id)?.emailStatus).toBe('SENT');
  });

  it('student không còn hoạt động → FAILED, không gửi', async () => {
    const ctx = setup();
    ctx.students.add(student(1), 'a@lms.local', false);
    const notification = await pending(ctx, student(1));

    await ctx.single.execute(notification.id);

    expect(ctx.emails.sent).toHaveLength(0);
    expect(ctx.uow.state.notifications.get(notification.id)?.emailStatus).toBe('FAILED');
  });

  it('lỗi SMTP được ném lên để consumer retry; hết retry thì markFailed', async () => {
    const ctx = setup();
    ctx.students.add(student(1), 'a@lms.local');
    ctx.emails.failing.set('a@lms.local', 99);
    const notification = await pending(ctx, student(1));

    await expect(ctx.single.execute(notification.id)).rejects.toThrow('smtp down');
    expect(ctx.uow.state.notifications.get(notification.id)?.emailStatus).toBe('PENDING');

    await ctx.single.markFailed(notification.id);
    expect(ctx.uow.state.notifications.get(notification.id)?.emailStatus).toBe('FAILED');
  });

  it('đã SENT thì xử lý lặp không gửi thêm', async () => {
    const ctx = setup();
    ctx.students.add(student(1), 'a@lms.local');
    const notification = await pending(ctx, student(1));

    await ctx.single.execute(notification.id);
    await ctx.single.execute(notification.id);

    expect(ctx.emails.sent).toHaveLength(1);
  });
});
