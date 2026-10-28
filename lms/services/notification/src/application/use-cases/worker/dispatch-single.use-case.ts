import { renderEmail } from '../../../domain/notification.js';
import type { EmailSender } from '../../ports/email-sender.js';
import type { StudentDirectory } from '../../ports/student-directory.js';
import type { NotificationUnitOfWork } from '../../ports/unit-of-work.js';

/**
 * Gửi email cho thông báo đơn đã nằm trong inbox. Student không còn hoạt động thì đánh dấu
 * `FAILED` (không retry); lỗi tạm thời của `student` hoặc SMTP được ném lên để consumer retry.
 */
export class DispatchSingleNotificationUseCase {
  constructor(
    private readonly uow: NotificationUnitOfWork,
    private readonly students: StudentDirectory,
    private readonly emails: EmailSender,
  ) {}

  async execute(notificationId: string): Promise<void> {
    const { notifications } = this.uow.stores;
    const notification = await notifications.findById(notificationId);
    if (!notification || notification.emailStatus !== 'PENDING') return;

    const student = await this.students.find(notification.studentId);
    if (!student?.active) {
      await notifications.setEmailStatus(notification.id, 'FAILED');
      return;
    }
    await this.emails.send({
      to: student.email,
      ...renderEmail(notification.title, notification.contentMarkdown),
    });
    await notifications.setEmailStatus(notification.id, 'SENT');
  }

  /** Hết retry: ghi nhận email không gửi được, thông báo vẫn nằm trong inbox. */
  async markFailed(notificationId: string): Promise<void> {
    const notification = await this.uow.stores.notifications.findById(notificationId);
    if (notification?.emailStatus === 'PENDING') {
      await this.uow.stores.notifications.setEmailStatus(notification.id, 'FAILED');
    }
  }
}
