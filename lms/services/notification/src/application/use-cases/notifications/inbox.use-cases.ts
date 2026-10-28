import type { Clock } from '@aiops-lms/common/ports';
import { AppError } from '@aiops-lms/common/errors';

import type { Notification, NotificationStatus } from '../../../domain/notification.js';
import type { NotificationUnitOfWork } from '../../ports/unit-of-work.js';

export class GetNotificationUseCase {
  constructor(private readonly uow: NotificationUnitOfWork) {}

  async execute(notificationId: string): Promise<Notification> {
    const notification = await this.uow.stores.notifications.findById(notificationId);
    if (!notification) throw AppError.notFound('Không tìm thấy thông báo');
    return notification;
  }
}

export class ListMyNotificationsUseCase {
  constructor(private readonly uow: NotificationUnitOfWork) {}

  execute(
    studentId: string,
    status: NotificationStatus | undefined,
    page: number,
    pageSize: number,
  ): Promise<{ items: Notification[]; total: number }> {
    return this.uow.stores.notifications.listForStudent(studentId, status, page, pageSize);
  }
}

/** Student chỉ đọc được thông báo của chính mình; của người khác trả 404 như không tồn tại. */
export class MarkNotificationReadUseCase {
  constructor(
    private readonly uow: NotificationUnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(studentId: string, notificationId: string): Promise<Notification> {
    const notification = await this.uow.stores.notifications.markRead(
      notificationId,
      studentId,
      this.clock.now(),
    );
    if (!notification) throw AppError.notFound('Không tìm thấy thông báo');
    return notification;
  }
}

export class MarkAllNotificationsReadUseCase {
  constructor(
    private readonly uow: NotificationUnitOfWork,
    private readonly clock: Clock,
  ) {}

  execute(studentId: string): Promise<number> {
    return this.uow.stores.notifications.markAllRead(studentId, this.clock.now());
  }
}
