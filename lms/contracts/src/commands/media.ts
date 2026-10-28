import { z } from 'zod';

const id = z.uuid();
const ownerKind = z.enum(['COURSE', 'NOTIFICATION', 'STUDENT', 'MEDIA']);
const usageType = z.enum([
  'COURSE_THUMBNAIL',
  'COURSE_GALLERY',
  'COURSE_DESCRIPTION',
  'LESSON_CONTENT',
  'LESSON_ATTACHMENT',
  'QUIZ_CONTENT',
  'NOTIFICATION_BODY',
  'STUDENT_AVATAR',
  'MEDIA_THUMBNAIL',
]);

/** Đích của command: service.name của worker và queue canonical `<worker>--<command-kebab>-v<n>`. */
export const MEDIA_WORKER = 'media-worker';

/** Tên command và queue của `media-worker` (nguồn duy nhất cho producer và consumer). */
export const MEDIA_COMMANDS = {
  thumbnailGenerate: {
    name: 'media.thumbnail.generate',
    version: 1,
    queue: 'media-worker--generate-media-thumbnail-v1',
  },
  markdownUsageSynchronize: {
    name: 'media.markdown-usage.synchronize',
    version: 1,
    queue: 'media-worker--synchronize-markdown-media-usage-v1',
  },
  usagesDeleteByIds: {
    name: 'media.usages.delete-by-ids',
    version: 1,
    queue: 'media-worker--delete-media-usages-by-ids-v1',
  },
  notificationUsageRegister: {
    name: 'media.notification-usage.register',
    version: 1,
    queue: 'media-worker--register-notification-media-usage-v1',
  },
  notificationUsageRegisterBatch: {
    name: 'media.notification-usage.register-batch',
    version: 1,
    queue: 'media-worker--register-notification-media-usages-v1',
  },
  notificationUsageStartJob: {
    name: 'media.notification-usage.start-job',
    version: 1,
    queue: 'media-worker--start-notification-media-usage-job-v1',
  },
  notificationUsageCompleteJob: {
    name: 'media.notification-usage.complete-job',
    version: 1,
    queue: 'media-worker--complete-notification-media-usage-job-v1',
  },
} as const;

/** `media` → `media-worker`: tạo thumbnail WebP cho ảnh hoặc khung hình video. */
export const thumbnailGeneratePayloadSchema = z.object({
  media_id: id,
});
export type ThumbnailGeneratePayload = z.infer<typeof thumbnailGeneratePayloadSchema>;

/**
 * `course` → `media-worker`: so khớp media tham chiếu trong markdown với usage hiện có của owner;
 * thêm usage còn thiếu, xóa usage không còn được tham chiếu. Markdown đi nguyên văn để format tham
 * chiếu (`/api/v1/media/{id}/content`) chỉ do `media` hiểu.
 */
export const markdownUsageSynchronizePayloadSchema = z.object({
  owner_kind: ownerKind,
  owner_id: id,
  usage_type: usageType,
  markdown: z.string().max(200_000).nullable(),
  /** Người thao tác, ghi vào `created_by` của usage mới. */
  actor_id: id,
});
export type MarkdownUsageSynchronizePayload = z.infer<typeof markdownUsageSynchronizePayloadSchema>;

/** `course` → `media-worker`: xóa usage khi xóa course/lesson/quiz. */
export const usagesDeleteByIdsPayloadSchema = z.object({
  usage_ids: z.array(id).min(1).max(1000),
});
export type UsagesDeleteByIdsPayload = z.infer<typeof usagesDeleteByIdsPayloadSchema>;

/** `notification` → `media-worker`: đăng ký usage đơn cho thông báo. */
export const notificationUsageRegisterPayloadSchema = z.object({
  notification_id: id,
  media_ids: z.array(id).min(1).max(50),
  actor_id: id,
});
export type NotificationUsageRegisterPayload = z.infer<
  typeof notificationUsageRegisterPayloadSchema
>;

/** `notification` → `media-worker`: đăng ký usage cho nhiều thông báo trong một lô. */
export const notificationUsageRegisterBatchPayloadSchema = z.object({
  job_id: id.optional(),
  items: z
    .array(z.object({ notification_id: id, media_ids: z.array(id).min(1).max(50) }))
    .min(1)
    .max(500),
  actor_id: id,
});
export type NotificationUsageRegisterBatchPayload = z.infer<
  typeof notificationUsageRegisterBatchPayloadSchema
>;

/** `notification` → `media-worker`: mở job theo dõi usage của một batch. */
export const notificationUsageStartJobPayloadSchema = z.object({
  job_id: id,
  batch_id: id,
});
export type NotificationUsageStartJobPayload = z.infer<
  typeof notificationUsageStartJobPayloadSchema
>;

/** `notification-worker` → `media-worker`: hoàn tất job kèm số usage kỳ vọng. */
export const notificationUsageCompleteJobPayloadSchema = z.object({
  job_id: id,
  expected_usage_count: z.number().int().min(0),
});
export type NotificationUsageCompleteJobPayload = z.infer<
  typeof notificationUsageCompleteJobPayloadSchema
>;

/** Fixture ổn định cho contract test của từng command. */
export const mediaCommandFixtures = {
  thumbnailGenerate: { media_id: '3f9c1e52-8a4b-4d7e-9b1a-0c6e2d5f7a10' },
  markdownUsageSynchronize: {
    owner_kind: 'COURSE',
    owner_id: '6d1b2c3e-0a4f-4b8e-8c1d-2f3a4b5c6d7e',
    usage_type: 'COURSE_DESCRIPTION',
    markdown: '![Ảnh](/api/v1/media/3f9c1e52-8a4b-4d7e-9b1a-0c6e2d5f7a10/content)',
    actor_id: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
  },
  usagesDeleteByIds: { usage_ids: ['0b1c2d3e-4f5a-4b6c-8d7e-8f9a0b1c2d3e'] },
  notificationUsageRegister: {
    notification_id: '1c2d3e4f-5a6b-4c7d-8e8f-9a0b1c2d3e4f',
    media_ids: ['3f9c1e52-8a4b-4d7e-9b1a-0c6e2d5f7a10'],
    actor_id: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
  },
  notificationUsageRegisterBatch: {
    job_id: '2d3e4f5a-6b7c-4d8e-8f9a-0b1c2d3e4f5a',
    items: [
      {
        notification_id: '1c2d3e4f-5a6b-4c7d-8e8f-9a0b1c2d3e4f',
        media_ids: ['3f9c1e52-8a4b-4d7e-9b1a-0c6e2d5f7a10'],
      },
    ],
    actor_id: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
  },
  notificationUsageStartJob: {
    job_id: '2d3e4f5a-6b7c-4d8e-8f9a-0b1c2d3e4f5a',
    batch_id: '3e4f5a6b-7c8d-4e9f-8a0b-1c2d3e4f5a6b',
  },
  notificationUsageCompleteJob: {
    job_id: '2d3e4f5a-6b7c-4d8e-8f9a-0b1c2d3e4f5a',
    expected_usage_count: 1,
  },
} as const;
