export type NotificationSourceType = 'SINGLE' | 'BULK';
export type NotificationStatus = 'UNREAD' | 'READ';
export type NotificationEmailStatus = 'NOT_REQUESTED' | 'PENDING' | 'SENT' | 'FAILED';
export type BatchTargetScope = 'ALL_STUDENTS' | 'FAILED_RECIPIENTS';
export type BatchStatus =
  | 'PENDING'
  | 'SNAPSHOTTING'
  | 'SNAPSHOT_READY'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'PARTIAL_FAILED'
  | 'FAILED';
export type BatchItemStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'RETRY' | 'FAILED';

export interface Notification {
  id: string;
  studentId: string;
  title: string;
  contentMarkdown: string;
  sourceType: NotificationSourceType;
  batchId: string | null;
  status: NotificationStatus;
  emailStatus: NotificationEmailStatus;
  createdBy: string | null;
  createdAt: Date;
  readAt: Date | null;
}

export interface NotificationBatch {
  id: string;
  title: string;
  contentMarkdown: string;
  targetScope: BatchTargetScope;
  status: BatchStatus;
  batchSize: number;
  requestedCount: number;
  successCount: number;
  failedCount: number;
  sourceBatchId: string | null;
  createdBy: string;
  mediaUsageJobId: string | null;
  mediaUsageExpected: number;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

export interface BatchItem {
  id: string;
  batchId: string;
  studentId: string;
  email: string;
  status: BatchItemStatus;
  attempts: number;
  leaseToken: string | null;
  leaseExpiresAt: Date | null;
  nextAttemptAt: Date;
  lastError: string | null;
  notificationId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BatchItemCounts {
  total: number;
  pending: number;
  processing: number;
  retry: number;
  success: number;
  failed: number;
}

export const DEFAULT_BATCH_SIZE = 500;
/** Trần số recipient của một batch (xem data-ownership §2.5). */
export const MAX_BATCH_RECIPIENTS = 100_000;
/** Mỗi thông báo đăng ký tối đa chừng này media (khớp contract command usage của media). */
export const MAX_MEDIA_PER_NOTIFICATION = 50;
/** Số recipient chụp mỗi trang khi gọi `student` (trần `page_size` của internal API). */
export const SNAPSHOT_PAGE_SIZE = 100;
/** Số item gom vào một command `register-batch` (khớp contract: tối đa 500). */
export const MEDIA_REGISTER_CHUNK = 500;

const TERMINAL_BATCH_STATUSES: readonly BatchStatus[] = ['COMPLETED', 'PARTIAL_FAILED', 'FAILED'];

export const isTerminalBatchStatus = (status: BatchStatus): boolean =>
  TERMINAL_BATCH_STATUSES.includes(status);

/** Trạng thái cuối của batch khi mọi item đã ở `SUCCESS` hoặc `FAILED`. */
export function finalBatchStatus(counts: Pick<BatchItemCounts, 'success' | 'failed'>): BatchStatus {
  if (counts.failed === 0) return 'COMPLETED';
  return counts.success === 0 ? 'FAILED' : 'PARTIAL_FAILED';
}

/** Chờ trước lần gửi lại thứ n của một item (n bắt đầu từ 1), nhân đôi mỗi lần. */
export function retryDelayMs(baseMs: number, attempt: number): number {
  return baseMs * 2 ** Math.max(0, attempt - 1);
}

const MEDIA_REFERENCE =
  /\/media\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/(?:content|thumbnail)\b/giu;

/** Media id được markdown tham chiếu (không trùng lặp, tối đa `MAX_MEDIA_PER_NOTIFICATION`). */
export function extractMediaIds(markdown: string): string[] {
  const ids = new Set<string>();
  for (const match of markdown.matchAll(MEDIA_REFERENCE)) {
    const id = match[1];
    if (id) ids.add(id.toLowerCase());
  }
  return [...ids].slice(0, MAX_MEDIA_PER_NOTIFICATION);
}

/** Email văn bản thuần: tiêu đề và nội dung markdown giữ nguyên (đủ dùng cho testbed). */
export function renderEmail(
  title: string,
  contentMarkdown: string,
): { subject: string; text: string } {
  return { subject: title, text: `${title}\n\n${contentMarkdown}\n` };
}
