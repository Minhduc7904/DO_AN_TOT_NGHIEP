import type { IdGenerator } from '@aiops-lms/common/ports';

import { extractMediaIds, type Notification } from '../../../domain/notification.js';
import type { NotificationUnitOfWork } from '../../ports/unit-of-work.js';

export interface CreateNotificationInput {
  studentId: string;
  title: string;
  contentMarkdown: string;
  sendEmail: boolean;
}

/**
 * Thông báo đơn của admin: luôn ghi vào inbox; gửi email và đăng ký usage media được phát bằng
 * command (outbox) trong cùng transaction nên không mất khi broker tạm chết.
 */
export class CreateNotificationUseCase {
  constructor(
    private readonly uow: NotificationUnitOfWork,
    private readonly ids: IdGenerator,
  ) {}

  execute(actorId: string, input: CreateNotificationInput): Promise<Notification> {
    const mediaIds = extractMediaIds(input.contentMarkdown);
    return this.uow.run(async (stores) => {
      const notification = await stores.notifications.create({
        id: this.ids.next(),
        studentId: input.studentId,
        title: input.title,
        contentMarkdown: input.contentMarkdown,
        sourceType: 'SINGLE',
        batchId: null,
        emailStatus: input.sendEmail ? 'PENDING' : 'NOT_REQUESTED',
        createdBy: actorId,
      });
      if (input.sendEmail) await stores.commands.requestSingleDispatch(notification.id);
      if (mediaIds.length > 0) {
        await stores.commands.registerMediaUsage(notification.id, mediaIds, actorId);
      }
      return notification;
    });
  }
}
