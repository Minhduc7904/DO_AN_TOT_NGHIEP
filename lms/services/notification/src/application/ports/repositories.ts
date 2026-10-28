import type {
  BatchItem,
  BatchItemCounts,
  BatchStatus,
  Notification,
  NotificationBatch,
  NotificationEmailStatus,
  NotificationSourceType,
  NotificationStatus,
} from '../../domain/notification.js';

export interface NewNotification {
  id: string;
  studentId: string;
  title: string;
  contentMarkdown: string;
  sourceType: NotificationSourceType;
  batchId: string | null;
  emailStatus: NotificationEmailStatus;
  createdBy: string | null;
}

export interface NotificationRepository {
  create(notification: NewNotification): Promise<Notification>;
  /**
   * Thông báo của một recipient trong batch; trả bản đã có nếu `(batch_id, student_id)` đã tồn tại
   * (dispatch lặp không tạo trùng).
   */
  createForBatch(
    notification: NewNotification,
  ): Promise<{ notification: Notification; created: boolean }>;
  findById(id: string): Promise<Notification | null>;
  listForStudent(
    studentId: string,
    status: NotificationStatus | undefined,
    page: number,
    pageSize: number,
  ): Promise<{ items: Notification[]; total: number }>;
  /** Đánh dấu đã đọc; `null` khi không có hoặc không thuộc `studentId`. Đã đọc rồi thì giữ `read_at`. */
  markRead(id: string, studentId: string, now: Date): Promise<Notification | null>;
  markAllRead(studentId: string, now: Date): Promise<number>;
  setEmailStatus(id: string, status: NotificationEmailStatus): Promise<void>;
}

export interface NewBatch {
  id: string;
  title: string;
  contentMarkdown: string;
  targetScope: NotificationBatch['targetScope'];
  batchSize: number;
  sourceBatchId: string | null;
  createdBy: string;
  mediaUsageJobId: string | null;
}

export interface BatchPatch {
  status?: BatchStatus;
  requestedCount?: number;
  successCount?: number;
  failedCount?: number;
  lastError?: string | null;
  completedAt?: Date | null;
  mediaUsageExpectedDelta?: number;
}

export interface BatchRepository {
  /** Trả `null` khi `source_batch_id` đã có batch retry (ràng buộc unique). */
  create(batch: NewBatch): Promise<NotificationBatch | null>;
  findById(id: string): Promise<NotificationBatch | null>;
  findBySource(sourceBatchId: string): Promise<NotificationBatch | null>;
  list(
    status: BatchStatus | undefined,
    page: number,
    pageSize: number,
  ): Promise<{ items: NotificationBatch[]; total: number }>;
  update(id: string, patch: BatchPatch): Promise<NotificationBatch | null>;
  /**
   * Chuyển trạng thái chỉ khi batch đang ở một trong `from`; trả `true` nếu chuyển được. Dùng để
   * đúng một tiến trình thắng khi hoàn tất hoặc bắt đầu snapshot.
   */
  transition(
    id: string,
    from: readonly BatchStatus[],
    patch: BatchPatch & { status: BatchStatus },
  ): Promise<boolean>;
}

export interface NewBatchItem {
  id: string;
  batchId: string;
  studentId: string;
  email: string;
}

export interface ItemRepository {
  /** Chèn idempotent theo `(batch_id, student_id)`. Trả số dòng thực sự được thêm. */
  insertMany(items: readonly NewBatchItem[]): Promise<number>;
  /** Sao chép các item `FAILED` của batch nguồn sang batch đích (item mới ở `PENDING`). */
  copyFailed(sourceBatchId: string, targetBatchId: string): Promise<number>;
  count(batchId: string): Promise<number>;
  countByStatus(batchId: string): Promise<BatchItemCounts>;
  /**
   * Nhận tối đa `limit` item đến hạn (PENDING/RETRY tới `next_attempt_at`, hoặc PROCESSING hết
   * lease) bằng `FOR UPDATE SKIP LOCKED`; đặt `PROCESSING`, lease mới và tăng `attempts`.
   */
  claim(
    batchId: string,
    limit: number,
    leaseMs: number,
    now: Date,
    leaseToken: string,
  ): Promise<BatchItem[]>;
  markSuccess(itemId: string, leaseToken: string, notificationId: string): Promise<boolean>;
  /** Ghi lỗi; `FAILED` khi hết `maxAttempts`, ngược lại `RETRY` sau `retryDelayMs`. */
  markFailure(
    itemId: string,
    leaseToken: string,
    error: string,
    maxAttempts: number,
    retryDelayMs: (attempt: number) => number,
    now: Date,
  ): Promise<'RETRY' | 'FAILED' | null>;
  /** Số item chưa kết thúc (PENDING, RETRY, PROCESSING). */
  countOpen(batchId: string): Promise<number>;
  /** Thời điểm sớm nhất một item chưa kết thúc có thể được nhận lại; `null` khi không còn item. */
  nextClaimableAt(batchId: string): Promise<Date | null>;
  listFailed(
    batchId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: BatchItem[]; total: number }>;
}
