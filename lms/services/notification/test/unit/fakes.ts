import type { Clock, IdGenerator } from '@aiops-lms/common/ports';

import type { EmailSender, Email } from '../../src/application/ports/email-sender.js';
import type {
  BatchPatch,
  BatchRepository,
  ItemRepository,
  NewBatch,
  NewBatchItem,
  NewNotification,
  NotificationRepository,
} from '../../src/application/ports/repositories.js';
import type { Recipient, StudentDirectory } from '../../src/application/ports/student-directory.js';
import type {
  NotificationCommands,
  NotificationStores,
  NotificationUnitOfWork,
} from '../../src/application/ports/unit-of-work.js';
import type {
  BatchItem,
  BatchItemCounts,
  BatchStatus,
  Notification,
  NotificationBatch,
  NotificationEmailStatus,
  NotificationSourceType,
  NotificationStatus,
} from '../../src/domain/notification.js';

export class FakeClock implements Clock {
  constructor(public current = new Date('2026-10-28T08:00:00.000Z')) {}
  now(): Date {
    return new Date(this.current);
  }
  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

export class SequenceIds implements IdGenerator {
  private n = 0;
  next(): string {
    this.n += 1;
    return `00000000-0000-4000-8000-${String(this.n).padStart(12, '0')}`;
  }
}

export type RecordedCommand = { name: string; args: unknown[] };

class RecordingCommands implements NotificationCommands {
  constructor(private readonly log: RecordedCommand[]) {}
  private record(name: string, ...args: unknown[]): Promise<void> {
    this.log.push({ name, args });
    return Promise.resolve();
  }
  requestBatchSnapshot(batchId: string): Promise<void> {
    return this.record('snapshot', batchId);
  }
  requestBatchDispatch(batchId: string): Promise<void> {
    return this.record('dispatch', batchId);
  }
  requestSingleDispatch(notificationId: string): Promise<void> {
    return this.record('single', notificationId);
  }
  startMediaUsageJob(jobId: string, batchId: string): Promise<void> {
    return this.record('media-start', jobId, batchId);
  }
  registerMediaUsage(
    notificationId: string,
    mediaIds: readonly string[],
    actorId: string,
  ): Promise<void> {
    return this.record('media-register', notificationId, [...mediaIds], actorId);
  }
  registerMediaUsageBatch(
    jobId: string,
    items: readonly { notificationId: string; mediaIds: readonly string[] }[],
    actorId: string,
  ): Promise<void> {
    return this.record('media-register-batch', jobId, items.length, actorId);
  }
  completeMediaUsageJob(jobId: string, expected: number): Promise<void> {
    return this.record('media-complete', jobId, expected);
  }
}

export class MemoryState {
  notifications = new Map<string, Notification>();
  batches = new Map<string, NotificationBatch>();
  items = new Map<string, BatchItem>();
  commands: RecordedCommand[] = [];
  inbox = new Set<string>();
}

const page = <T>(
  all: T[],
  pageNumber: number,
  pageSize: number,
): { items: T[]; total: number } => ({
  items: all.slice((pageNumber - 1) * pageSize, pageNumber * pageSize),
  total: all.length,
});

class MemoryNotifications implements NotificationRepository {
  constructor(private readonly state: MemoryState) {}

  private build(input: NewNotification): Notification {
    return {
      ...input,
      status: 'UNREAD',
      createdAt: new Date('2026-10-28T08:00:00.000Z'),
      readAt: null,
    };
  }
  create(input: NewNotification): Promise<Notification> {
    const notification = this.build(input);
    this.state.notifications.set(notification.id, notification);
    return Promise.resolve(notification);
  }
  createForBatch(
    input: NewNotification,
  ): Promise<{ notification: Notification; created: boolean }> {
    const existing = [...this.state.notifications.values()].find(
      (item) => item.batchId === input.batchId && item.studentId === input.studentId,
    );
    if (existing) return Promise.resolve({ notification: existing, created: false });
    return this.create(input).then((notification) => ({ notification, created: true }));
  }
  findById(id: string): Promise<Notification | null> {
    return Promise.resolve(this.state.notifications.get(id) ?? null);
  }
  listForStudent(
    studentId: string,
    status: NotificationStatus | undefined,
    pageNumber: number,
    pageSize: number,
  ): Promise<{ items: Notification[]; total: number }> {
    const all = [...this.state.notifications.values()].filter(
      (item) => item.studentId === studentId && (!status || item.status === status),
    );
    return Promise.resolve(page(all, pageNumber, pageSize));
  }
  markRead(
    id: string,
    studentId: string,
    now: Date,
  ):
    | Promise<null>
    | Promise<{
        status: 'READ';
        readAt: Date;
        id: string;
        studentId: string;
        title: string;
        contentMarkdown: string;
        sourceType: NotificationSourceType;
        batchId: string | null;
        emailStatus: NotificationEmailStatus;
        createdBy: string | null;
        createdAt: Date;
      }> {
    const item = this.state.notifications.get(id);
    if (!item || item.studentId !== studentId) return Promise.resolve(null);
    const next = { ...item, status: 'READ' as const, readAt: item.readAt ?? now };
    this.state.notifications.set(id, next);
    return Promise.resolve(next);
  }
  markAllRead(studentId: string, now: Date): Promise<number> {
    let updated = 0;
    for (const item of this.state.notifications.values()) {
      if (item.studentId === studentId && item.status === 'UNREAD') {
        this.state.notifications.set(item.id, { ...item, status: 'READ', readAt: now });
        updated += 1;
      }
    }
    return Promise.resolve(updated);
  }
  setEmailStatus(id: string, status: Notification['emailStatus']): Promise<void> {
    const item = this.state.notifications.get(id);
    if (item) this.state.notifications.set(id, { ...item, emailStatus: status });
    return Promise.resolve();
  }
}

class MemoryBatches implements BatchRepository {
  constructor(private readonly state: MemoryState) {}

  create(input: NewBatch): Promise<null> | Promise<NotificationBatch> {
    if (
      input.sourceBatchId &&
      [...this.state.batches.values()].some((item) => item.sourceBatchId === input.sourceBatchId)
    ) {
      return Promise.resolve(null);
    }
    const now = new Date('2026-10-28T08:00:00.000Z');
    const batch: NotificationBatch = {
      ...input,
      status: 'PENDING',
      requestedCount: 0,
      successCount: 0,
      failedCount: 0,
      mediaUsageExpected: 0,
      lastError: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };
    this.state.batches.set(batch.id, batch);
    return Promise.resolve(batch);
  }
  findById(id: string): Promise<NotificationBatch | null> {
    return Promise.resolve(this.state.batches.get(id) ?? null);
  }
  findBySource(sourceBatchId: string): Promise<NotificationBatch | null> {
    return Promise.resolve(
      [...this.state.batches.values()].find((item) => item.sourceBatchId === sourceBatchId) ?? null,
    );
  }
  list(
    status: BatchStatus | undefined,
    pageNumber: number,
    pageSize: number,
  ): Promise<{ items: NotificationBatch[]; total: number }> {
    const all = [...this.state.batches.values()].filter(
      (item) => !status || item.status === status,
    );
    return Promise.resolve(page(all, pageNumber, pageSize));
  }
  update(id: string, patch: BatchPatch): Promise<null> | Promise<NotificationBatch> {
    const batch = this.state.batches.get(id);
    if (!batch) return Promise.resolve(null);
    const { mediaUsageExpectedDelta, ...rest } = patch;
    const next = {
      ...batch,
      ...Object.fromEntries(Object.entries(rest).filter(([, value]) => value !== undefined)),
      mediaUsageExpected: batch.mediaUsageExpected + (mediaUsageExpectedDelta ?? 0),
    } as NotificationBatch;
    this.state.batches.set(id, next);
    return Promise.resolve(next);
  }
  async transition(
    id: string,
    from: readonly BatchStatus[],
    patch: BatchPatch & { status: BatchStatus },
  ): Promise<boolean> {
    const batch = this.state.batches.get(id);
    if (!batch || !from.includes(batch.status)) return false;
    await this.update(id, patch);
    return true;
  }
}

class MemoryItems implements ItemRepository {
  constructor(
    private readonly state: MemoryState,
    private readonly ids: IdGenerator,
  ) {}

  private forBatch(batchId: string): BatchItem[] {
    return [...this.state.items.values()].filter((item) => item.batchId === batchId);
  }
  insertMany(items: readonly NewBatchItem[]): Promise<number> {
    let added = 0;
    for (const input of items) {
      if (this.forBatch(input.batchId).some((item) => item.studentId === input.studentId)) continue;
      const now = new Date('2026-10-28T08:00:00.000Z');
      this.state.items.set(input.id, {
        ...input,
        status: 'PENDING',
        attempts: 0,
        leaseToken: null,
        leaseExpiresAt: null,
        nextAttemptAt: now,
        lastError: null,
        notificationId: null,
        createdAt: now,
        updatedAt: now,
      });
      added += 1;
    }
    return Promise.resolve(added);
  }
  copyFailed(sourceBatchId: string, targetBatchId: string): Promise<number> {
    const failed = this.forBatch(sourceBatchId).filter((item) => item.status === 'FAILED');
    return this.insertMany(
      failed.map((item) => ({
        id: this.ids.next(),
        batchId: targetBatchId,
        studentId: item.studentId,
        email: item.email,
      })),
    );
  }
  count(batchId: string): Promise<number> {
    return Promise.resolve(this.forBatch(batchId).length);
  }
  countByStatus(batchId: string): Promise<BatchItemCounts> {
    const items = this.forBatch(batchId);
    const of = (status: BatchItem['status']): number =>
      items.filter((item) => item.status === status).length;
    return Promise.resolve({
      total: items.length,
      pending: of('PENDING'),
      processing: of('PROCESSING'),
      retry: of('RETRY'),
      success: of('SUCCESS'),
      failed: of('FAILED'),
    });
  }
  claim(
    batchId: string,
    limit: number,
    leaseMs: number,
    now: Date,
    leaseToken: string,
  ): Promise<BatchItem[]> {
    const due = this.forBatch(batchId)
      .filter(
        (item) =>
          ((item.status === 'PENDING' || item.status === 'RETRY') && item.nextAttemptAt <= now) ||
          (item.status === 'PROCESSING' &&
            item.leaseExpiresAt !== null &&
            item.leaseExpiresAt <= now),
      )
      .slice(0, limit)
      .map((item) => {
        const claimed: BatchItem = {
          ...item,
          status: 'PROCESSING',
          attempts: item.attempts + 1,
          leaseToken,
          leaseExpiresAt: new Date(now.getTime() + leaseMs),
        };
        this.state.items.set(item.id, claimed);
        return claimed;
      });
    return Promise.resolve(due);
  }
  markSuccess(itemId: string, leaseToken: string, notificationId: string): Promise<boolean> {
    const item = this.state.items.get(itemId);
    if (!item || item.leaseToken !== leaseToken || item.status !== 'PROCESSING') {
      return Promise.resolve(false);
    }
    this.state.items.set(itemId, { ...item, status: 'SUCCESS', notificationId, leaseToken: null });
    return Promise.resolve(true);
  }
  markFailure(
    itemId: string,
    leaseToken: string,
    error: string,
    maxAttempts: number,
    retryDelayMs: (attempt: number) => number,
    now: Date,
  ): Promise<null> | Promise<'FAILED' | 'RETRY'> {
    const item = this.state.items.get(itemId);
    if (!item || item.leaseToken !== leaseToken || item.status !== 'PROCESSING') {
      return Promise.resolve(null);
    }
    const exhausted = item.attempts >= maxAttempts;
    this.state.items.set(itemId, {
      ...item,
      status: exhausted ? 'FAILED' : 'RETRY',
      lastError: error,
      leaseToken: null,
      nextAttemptAt: new Date(now.getTime() + retryDelayMs(item.attempts)),
    });
    return Promise.resolve(exhausted ? ('FAILED' as const) : ('RETRY' as const));
  }
  async countOpen(batchId: string): Promise<number> {
    const counts = await this.countByStatus(batchId);
    return counts.pending + counts.processing + counts.retry;
  }
  nextClaimableAt(batchId: string): Promise<null> | Promise<Date> {
    const open = this.forBatch(batchId).filter((item) =>
      ['PENDING', 'RETRY', 'PROCESSING'].includes(item.status),
    );
    if (open.length === 0) return Promise.resolve(null);
    return Promise.resolve(
      new Date(
        Math.min(
          ...open.map((item) =>
            (item.status === 'PROCESSING' ? item.leaseExpiresAt : item.nextAttemptAt)!.getTime(),
          ),
        ),
      ),
    );
  }
  listFailed(
    batchId: string,
    pageNumber: number,
    pageSize: number,
  ): Promise<{ items: BatchItem[]; total: number }> {
    return Promise.resolve(
      page(
        this.forBatch(batchId).filter((item) => item.status === 'FAILED'),
        pageNumber,
        pageSize,
      ),
    );
  }
}

export class MemoryUnitOfWork implements NotificationUnitOfWork {
  readonly state = new MemoryState();
  readonly stores: NotificationStores;

  constructor(ids: IdGenerator) {
    this.stores = {
      notifications: new MemoryNotifications(this.state),
      batches: new MemoryBatches(this.state),
      items: new MemoryItems(this.state, ids),
      commands: new RecordingCommands(this.state.commands),
    };
  }

  get commands(): RecordedCommand[] {
    return this.state.commands;
  }

  run<T>(work: (stores: NotificationStores) => Promise<T>): Promise<T> {
    return work(this.stores);
  }

  async runOnce(
    messageId: string,
    consumer: string,
    work: (stores: NotificationStores) => Promise<void>,
  ): Promise<'deduplicated' | 'processed'> {
    const key = `${consumer}:${messageId}`;
    if (this.state.inbox.has(key)) return 'deduplicated' as const;
    await work(this.stores);
    this.state.inbox.add(key);
    return 'processed' as const;
  }
}

export class FakeStudents implements StudentDirectory {
  readonly active: (Recipient & { active: boolean })[] = [];
  listCalls = 0;

  add(id: string, email: string, active = true): void {
    this.active.push({ id, email, active });
  }
  listActive(
    pageNumber: number,
    pageSize: number,
  ): Promise<{ items: { id: string; email: string }[]; total: number }> {
    this.listCalls += 1;
    const all = this.active.filter((student) => student.active);
    return Promise.resolve({
      items: all
        .slice((pageNumber - 1) * pageSize, pageNumber * pageSize)
        .map(({ id, email }) => ({ id, email })),
      total: all.length,
    });
  }
  find(id: string): Promise<(Recipient & { active: boolean }) | null> {
    return Promise.resolve(this.active.find((student) => student.id === id) ?? null);
  }
}

export class FakeEmails implements EmailSender {
  readonly sent: Email[] = [];
  /** Địa chỉ luôn lỗi, hoặc số lần lỗi còn lại theo địa chỉ. */
  failing = new Map<string, number>();

  send(email: Email): Promise<void> {
    const remaining = this.failing.get(email.to);
    if (remaining !== undefined && remaining > 0) {
      this.failing.set(email.to, remaining - 1);
      return Promise.reject(new Error('smtp down'));
    }
    this.sent.push(email);
    return Promise.resolve();
  }
}
