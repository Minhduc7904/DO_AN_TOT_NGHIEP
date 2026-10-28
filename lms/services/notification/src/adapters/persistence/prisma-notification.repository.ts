import type { Notification, NotificationStatus } from '../../domain/notification.js';
import type {
  NewNotification,
  NotificationRepository,
} from '../../application/ports/repositories.js';
import type { Db } from './db.js';
import type { Notification as NotificationRow } from './generated/client.js';
import { observeDb } from './prisma-support.js';

const toNotification = (row: NotificationRow): Notification => ({ ...row });

export class PrismaNotificationRepository implements NotificationRepository {
  constructor(private readonly db: Db) {}

  create(notification: NewNotification): Promise<Notification> {
    return observeDb('notification.create', async () =>
      toNotification(await this.db.notification.create({ data: notification })),
    );
  }

  createForBatch(
    notification: NewNotification,
  ): Promise<{ notification: Notification; created: boolean }> {
    return observeDb('notification.create-for-batch', async () => {
      // `skipDuplicates` (ON CONFLICT DO NOTHING) thay vì bắt lỗi unique: lỗi unique làm hỏng cả
      // transaction PostgreSQL đang mở.
      const result = await this.db.notification.createMany({
        data: [notification],
        skipDuplicates: true,
      });
      const row = await this.db.notification.findUniqueOrThrow({
        where: {
          batchId_studentId: {
            batchId: notification.batchId as string,
            studentId: notification.studentId,
          },
        },
      });
      return { notification: toNotification(row), created: result.count > 0 };
    });
  }

  findById(id: string): Promise<Notification | null> {
    return observeDb('notification.find-by-id', async () => {
      const row = await this.db.notification.findUnique({ where: { id } });
      return row ? toNotification(row) : null;
    });
  }

  listForStudent(
    studentId: string,
    status: NotificationStatus | undefined,
    page: number,
    pageSize: number,
  ): Promise<{ items: Notification[]; total: number }> {
    return observeDb('notification.list-for-student', async () => {
      const where = { studentId, ...(status ? { status } : {}) };
      const [rows, total] = await Promise.all([
        this.db.notification.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        this.db.notification.count({ where }),
      ]);
      return { items: rows.map(toNotification), total };
    });
  }

  markRead(id: string, studentId: string, now: Date): Promise<Notification | null> {
    return observeDb('notification.mark-read', async () => {
      await this.db.notification.updateMany({
        where: { id, studentId, status: 'UNREAD' },
        data: { status: 'READ', readAt: now },
      });
      const row = await this.db.notification.findFirst({ where: { id, studentId } });
      return row ? toNotification(row) : null;
    });
  }

  markAllRead(studentId: string, now: Date): Promise<number> {
    return observeDb('notification.mark-all-read', async () => {
      const result = await this.db.notification.updateMany({
        where: { studentId, status: 'UNREAD' },
        data: { status: 'READ', readAt: now },
      });
      return result.count;
    });
  }

  setEmailStatus(id: string, status: Notification['emailStatus']): Promise<void> {
    return observeDb('notification.set-email-status', async () => {
      await this.db.notification.updateMany({ where: { id }, data: { emailStatus: status } });
    });
  }
}
