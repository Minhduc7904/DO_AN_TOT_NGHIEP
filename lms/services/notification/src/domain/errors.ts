import { AppError } from '@aiops-lms/common/errors';

/** Mã lỗi nghiệp vụ của `notification` (khai báo trong http-and-event-contracts-v2 §4.5). */
export const NOTIFICATION_ERROR_CODES = {
  batchNotRetryable: 'NOTIFICATION_BATCH_NOT_RETRYABLE',
  batchRetryExists: 'NOTIFICATION_BATCH_RETRY_EXISTS',
} as const;

export const notificationErrors = {
  batchNotRetryable: (reason: string): AppError =>
    new AppError(NOTIFICATION_ERROR_CODES.batchNotRetryable, 409, reason),
  batchRetryExists: (retryBatchId: string): AppError =>
    new AppError(NOTIFICATION_ERROR_CODES.batchRetryExists, 409, 'Batch này đã có batch gửi lại', {
      retry_batch_id: retryBatchId,
    }),
};
