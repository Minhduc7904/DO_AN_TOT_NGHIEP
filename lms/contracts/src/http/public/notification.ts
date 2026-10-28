import { z } from 'zod';

import { idSchema, paginationQuerySchema } from '../common/index.js';

export const notificationSourceTypeSchema = z.enum(['SINGLE', 'BULK']);
export const notificationStatusSchema = z.enum(['UNREAD', 'READ']);
/** Trạng thái email của một thông báo: `NOT_REQUESTED` khi không yêu cầu gửi email. */
export const notificationEmailStatusSchema = z.enum(['NOT_REQUESTED', 'PENDING', 'SENT', 'FAILED']);
export const batchTargetScopeSchema = z.enum(['ALL_STUDENTS', 'FAILED_RECIPIENTS']);
export const batchStatusSchema = z.enum([
  'PENDING',
  'SNAPSHOTTING',
  'SNAPSHOT_READY',
  'PROCESSING',
  'COMPLETED',
  'PARTIAL_FAILED',
  'FAILED',
]);
export const batchItemStatusSchema = z.enum([
  'PENDING',
  'PROCESSING',
  'SUCCESS',
  'RETRY',
  'FAILED',
]);

const dateTime = z.iso.datetime();
const title = z.string().trim().min(1).max(200);
const contentMarkdown = z.string().trim().min(1).max(20_000);

// ---- Request ---------------------------------------------------------------------------------

export const createNotificationRequestSchema = z.object({
  student_id: idSchema,
  title,
  content_markdown: contentMarkdown,
  /** Gửi thêm email tới student; thông báo luôn được ghi vào inbox. */
  send_email: z.boolean().default(true),
});
export type CreateNotificationRequest = z.infer<typeof createNotificationRequestSchema>;

export const listMyNotificationsQuerySchema = paginationQuerySchema.extend({
  status: notificationStatusSchema.optional(),
});
export type ListMyNotificationsQuery = z.infer<typeof listMyNotificationsQuerySchema>;

export const createNotificationBatchRequestSchema = z.object({
  title,
  content_markdown: contentMarkdown,
  /** Số item mỗi lượt dispatch; mặc định 500, tối đa 1000. */
  batch_size: z.number().int().min(1).max(1_000).optional(),
});
export type CreateNotificationBatchRequest = z.infer<typeof createNotificationBatchRequestSchema>;

export const listNotificationBatchesQuerySchema = paginationQuerySchema.extend({
  status: batchStatusSchema.optional(),
});
export type ListNotificationBatchesQuery = z.infer<typeof listNotificationBatchesQuerySchema>;

export const listFailedItemsQuerySchema = paginationQuerySchema;
export type ListFailedItemsQuery = z.infer<typeof listFailedItemsQuerySchema>;

// ---- Response --------------------------------------------------------------------------------

export const notificationDtoSchema = z.object({
  id: idSchema,
  student_id: idSchema,
  title: z.string(),
  content_markdown: z.string(),
  source_type: notificationSourceTypeSchema,
  batch_id: idSchema.nullable(),
  status: notificationStatusSchema,
  email_status: notificationEmailStatusSchema,
  created_by: idSchema.nullable(),
  created_at: dateTime,
  read_at: dateTime.nullable(),
});
export type NotificationDto = z.infer<typeof notificationDtoSchema>;

export const markAllReadDtoSchema = z.object({ updated_count: z.number().int().min(0) });
export type MarkAllReadDto = z.infer<typeof markAllReadDtoSchema>;

export const notificationBatchDtoSchema = z.object({
  id: idSchema,
  title: z.string(),
  content_markdown: z.string(),
  target_scope: batchTargetScopeSchema,
  status: batchStatusSchema,
  batch_size: z.number().int(),
  requested_count: z.number().int(),
  success_count: z.number().int(),
  failed_count: z.number().int(),
  source_batch_id: idSchema.nullable(),
  created_by: idSchema,
  last_error: z.string().nullable(),
  created_at: dateTime,
  updated_at: dateTime,
  completed_at: dateTime.nullable(),
});
export type NotificationBatchDto = z.infer<typeof notificationBatchDtoSchema>;

export const batchSnapshotStatusDtoSchema = z.object({
  batch_id: idSchema,
  status: batchStatusSchema,
  snapshotted_count: z.number().int(),
  /** `true` khi đã chụp xong toàn bộ recipient (batch qua `SNAPSHOT_READY`). */
  snapshot_finished: z.boolean(),
});
export type BatchSnapshotStatusDto = z.infer<typeof batchSnapshotStatusDtoSchema>;

export const batchDeliveryStatusDtoSchema = z.object({
  batch_id: idSchema,
  status: batchStatusSchema,
  total: z.number().int(),
  pending: z.number().int(),
  processing: z.number().int(),
  retry: z.number().int(),
  success: z.number().int(),
  failed: z.number().int(),
});
export type BatchDeliveryStatusDto = z.infer<typeof batchDeliveryStatusDtoSchema>;

export const failedBatchItemDtoSchema = z.object({
  id: idSchema,
  student_id: idSchema,
  email: z.string(),
  attempts: z.number().int(),
  last_error: z.string().nullable(),
  updated_at: dateTime,
});
export type FailedBatchItemDto = z.infer<typeof failedBatchItemDtoSchema>;
