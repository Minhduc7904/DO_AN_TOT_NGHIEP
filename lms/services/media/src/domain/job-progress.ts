import type { JobStatus } from './media.js';

/**
 * Trạng thái job theo tiến độ: chưa biết số kỳ vọng hoặc chưa đủ thì `PROCESSING`; đủ thì
 * `COMPLETED`, hoặc `PARTIAL_FAILED` nếu có mục lỗi. Command hoàn tất có thể đến trước command đăng
 * ký (khác queue) nên phải đánh giá lại sau mỗi lần cập nhật.
 */
export function evaluateJobStatus(job: {
  expectedCount: number | null;
  processedCount: number;
  failedCount: number;
}): JobStatus {
  if (job.expectedCount === null) return 'PROCESSING';
  if (job.processedCount + job.failedCount < job.expectedCount) return 'PROCESSING';
  return job.failedCount > 0 ? 'PARTIAL_FAILED' : 'COMPLETED';
}
