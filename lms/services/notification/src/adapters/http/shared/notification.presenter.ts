import type {
  BatchDeliveryStatusDto,
  BatchSnapshotStatusDto,
  FailedBatchItemDto,
  NotificationBatchDto,
  NotificationDto,
} from '@aiops-lms/contracts';

import type {
  BatchItem,
  BatchItemCounts,
  Notification,
  NotificationBatch,
} from '../../../domain/notification.js';
import type { BatchStatus } from '../../../domain/notification.js';

export function presentNotification(notification: Notification): NotificationDto {
  return {
    id: notification.id,
    student_id: notification.studentId,
    title: notification.title,
    content_markdown: notification.contentMarkdown,
    source_type: notification.sourceType,
    batch_id: notification.batchId,
    status: notification.status,
    email_status: notification.emailStatus,
    created_by: notification.createdBy,
    created_at: notification.createdAt.toISOString(),
    read_at: notification.readAt?.toISOString() ?? null,
  };
}

export function presentBatch(batch: NotificationBatch): NotificationBatchDto {
  return {
    id: batch.id,
    title: batch.title,
    content_markdown: batch.contentMarkdown,
    target_scope: batch.targetScope,
    status: batch.status,
    batch_size: batch.batchSize,
    requested_count: batch.requestedCount,
    success_count: batch.successCount,
    failed_count: batch.failedCount,
    source_batch_id: batch.sourceBatchId,
    created_by: batch.createdBy,
    last_error: batch.lastError,
    created_at: batch.createdAt.toISOString(),
    updated_at: batch.updatedAt.toISOString(),
    completed_at: batch.completedAt?.toISOString() ?? null,
  };
}

export function presentSnapshotStatus(status: {
  batchId: string;
  status: BatchStatus;
  snapshottedCount: number;
  finished: boolean;
}): BatchSnapshotStatusDto {
  return {
    batch_id: status.batchId,
    status: status.status,
    snapshotted_count: status.snapshottedCount,
    snapshot_finished: status.finished,
  };
}

export function presentDeliveryStatus(
  batch: NotificationBatch,
  counts: BatchItemCounts,
): BatchDeliveryStatusDto {
  return {
    batch_id: batch.id,
    status: batch.status,
    total: counts.total,
    pending: counts.pending,
    processing: counts.processing,
    retry: counts.retry,
    success: counts.success,
    failed: counts.failed,
  };
}

export function presentFailedItem(item: BatchItem): FailedBatchItemDto {
  return {
    id: item.id,
    student_id: item.studentId,
    email: item.email,
    attempts: item.attempts,
    last_error: item.lastError,
    updated_at: item.updatedAt.toISOString(),
  };
}
