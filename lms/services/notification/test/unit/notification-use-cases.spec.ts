import { CreateNotificationBatchUseCase } from '../../src/application/use-cases/batches/create-notification-batch.use-case.js';
import { RetryFailedBatchUseCase } from '../../src/application/use-cases/batches/retry-failed-batch.use-case.js';
import { CreateNotificationUseCase } from '../../src/application/use-cases/notifications/create-notification.use-case.js';
import {
  ListMyNotificationsUseCase,
  MarkAllNotificationsReadUseCase,
  MarkNotificationReadUseCase,
} from '../../src/application/use-cases/notifications/inbox.use-cases.js';
import type { Notification } from '../../src/domain/notification.js';
import { FakeClock, MemoryUnitOfWork, SequenceIds } from './fakes.js';

const ADMIN = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001';
const S1 = 'bbbbbbbb-bbbb-4bbb-8bbb-000000000001';
const S2 = 'bbbbbbbb-bbbb-4bbb-8bbb-000000000002';
const MEDIA = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function setup(): { ids: SequenceIds; uow: MemoryUnitOfWork; clock: FakeClock } {
  const ids = new SequenceIds();
  const uow = new MemoryUnitOfWork(ids);
  const clock = new FakeClock();
  return { ids, uow, clock };
}

describe('CreateNotificationUseCase', () => {
  it('có email: lưu inbox ở PENDING và phát command gửi', async () => {
    const { ids, uow } = setup();

    const notification = await new CreateNotificationUseCase(uow, ids).execute(ADMIN, {
      studentId: S1,
      title: 'Chào',
      contentMarkdown: 'nội dung',
      sendEmail: true,
    });

    expect(notification).toMatchObject({
      emailStatus: 'PENDING',
      sourceType: 'SINGLE',
      createdBy: ADMIN,
    });
    expect(uow.commands).toEqual([{ name: 'single', args: [notification.id] }]);
  });

  it('không gửi email: NOT_REQUESTED và không phát command', async () => {
    const { ids, uow } = setup();

    const notification = await new CreateNotificationUseCase(uow, ids).execute(ADMIN, {
      studentId: S1,
      title: 'Chào',
      contentMarkdown: 'nội dung',
      sendEmail: false,
    });

    expect(notification.emailStatus).toBe('NOT_REQUESTED');
    expect(uow.commands).toEqual([]);
  });

  it('nội dung có media: phát command đăng ký usage kèm actor', async () => {
    const { ids, uow } = setup();

    const notification = await new CreateNotificationUseCase(uow, ids).execute(ADMIN, {
      studentId: S1,
      title: 'Ảnh',
      contentMarkdown: `![x](/api/v1/media/${MEDIA}/content)`,
      sendEmail: false,
    });

    expect(uow.commands).toEqual([
      { name: 'media-register', args: [notification.id, [MEDIA], ADMIN] },
    ]);
  });
});

describe('inbox', () => {
  async function seed(): Promise<{
    uow: MemoryUnitOfWork;
    clock: FakeClock;
    a: Notification;
    b: Notification;
    other: Notification;
  }> {
    const { ids, uow, clock } = setup();
    const create = new CreateNotificationUseCase(uow, ids);
    const input = { title: 't', contentMarkdown: 'c', sendEmail: false };
    const a = await create.execute(ADMIN, { ...input, studentId: S1 });
    const b = await create.execute(ADMIN, { ...input, studentId: S1 });
    const other = await create.execute(ADMIN, { ...input, studentId: S2 });
    return { uow, clock, a, b, other };
  }

  it('student chỉ đọc được thông báo của mình; đọc rồi giữ nguyên read_at', async () => {
    const { uow, clock, a, other } = await seed();
    const markRead = new MarkNotificationReadUseCase(uow, clock);

    const first = await markRead.execute(S1, a.id);
    clock.advance(60_000);
    const second = await markRead.execute(S1, a.id);

    expect(first.status).toBe('READ');
    expect(second.readAt).toEqual(first.readAt);
    await expect(markRead.execute(S1, other.id)).rejects.toMatchObject({ status: 404 });
  });

  it('read-all đếm đúng và lọc theo status', async () => {
    const { uow, clock, a } = await seed();
    await new MarkNotificationReadUseCase(uow, clock).execute(S1, a.id);

    const updated = await new MarkAllNotificationsReadUseCase(uow, clock).execute(S1);
    const unread = await new ListMyNotificationsUseCase(uow).execute(S1, 'UNREAD', 1, 20);

    expect(updated).toBe(1);
    expect(unread.total).toBe(0);
  });
});

describe('CreateNotificationBatchUseCase', () => {
  it('batch thường: một command snapshot, không có job media', async () => {
    const { ids, uow } = setup();

    const batch = await new CreateNotificationBatchUseCase(uow, ids).execute(ADMIN, {
      title: 'Thông báo',
      contentMarkdown: 'nội dung',
    });

    expect(batch).toMatchObject({
      status: 'PENDING',
      targetScope: 'ALL_STUDENTS',
      mediaUsageJobId: null,
    });
    expect(uow.commands).toEqual([{ name: 'snapshot', args: [batch.id] }]);
  });

  it('có media: tạo job usage và start job trước khi snapshot', async () => {
    const { ids, uow } = setup();

    const batch = await new CreateNotificationBatchUseCase(uow, ids).execute(ADMIN, {
      title: 'Ảnh',
      contentMarkdown: `![x](/api/v1/media/${MEDIA}/thumbnail)`,
      batchSize: 50,
    });

    expect(batch.batchSize).toBe(50);
    expect(batch.mediaUsageJobId).not.toBeNull();
    expect(uow.commands.map((c) => c.name)).toEqual(['media-start', 'snapshot']);
  });
});

describe('RetryFailedBatchUseCase', () => {
  async function terminalBatch(
    uow: MemoryUnitOfWork,
    patch: { status: 'COMPLETED' | 'PARTIAL_FAILED' | 'PROCESSING'; failedCount: number },
  ): Promise<string> {
    const batch = await uow.stores.batches.create({
      id: 'dddddddd-dddd-4ddd-8ddd-000000000001',
      title: 't',
      contentMarkdown: 'c',
      targetScope: 'ALL_STUDENTS',
      batchSize: 10,
      sourceBatchId: null,
      createdBy: ADMIN,
      mediaUsageJobId: null,
    });
    await uow.stores.batches.update(batch!.id, patch);
    return batch!.id;
  }

  it('chỉ retry batch đã kết thúc và có recipient lỗi', async () => {
    const { ids, uow } = setup();
    const retry = new RetryFailedBatchUseCase(uow, ids);

    const running = await terminalBatch(uow, { status: 'PROCESSING', failedCount: 2 });
    await expect(retry.execute(ADMIN, running)).rejects.toMatchObject({
      code: 'NOTIFICATION_BATCH_NOT_RETRYABLE',
      status: 409,
    });

    await uow.stores.batches.update(running, { status: 'COMPLETED', failedCount: 0 });
    await expect(retry.execute(ADMIN, running)).rejects.toMatchObject({
      code: 'NOTIFICATION_BATCH_NOT_RETRYABLE',
    });
  });

  it('tạo batch FAILED_RECIPIENTS; lần thứ hai báo batch retry đã tồn tại', async () => {
    const { ids, uow } = setup();
    const retry = new RetryFailedBatchUseCase(uow, ids);
    const source = await terminalBatch(uow, { status: 'PARTIAL_FAILED', failedCount: 1 });

    const created = await retry.execute(ADMIN, source);

    expect(created).toMatchObject({ targetScope: 'FAILED_RECIPIENTS', sourceBatchId: source });
    expect(uow.commands.map((c) => c.name)).toEqual(['snapshot']);
    await expect(retry.execute(ADMIN, source)).rejects.toMatchObject({
      code: 'NOTIFICATION_BATCH_RETRY_EXISTS',
      status: 409,
    });
  });

  it('batch nguồn không tồn tại → 404', async () => {
    const { ids, uow } = setup();
    await expect(
      new RetryFailedBatchUseCase(uow, ids).execute(ADMIN, 'dddddddd-dddd-4ddd-8ddd-ffffffffffff'),
    ).rejects.toMatchObject({ status: 404 });
  });
});
