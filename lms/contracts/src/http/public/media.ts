import { z } from 'zod';

import { apiResponseSchema, idSchema, paginationQuerySchema } from '../common/index.js';

export const mediaTypeSchema = z.enum(['IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO', 'OTHER']);
export const mediaStatusSchema = z.enum(['PENDING', 'READY', 'FAILED']);
export const thumbnailStatusSchema = z.enum([
  'NOT_APPLICABLE',
  'PENDING',
  'PROCESSING',
  'READY',
  'FAILED',
]);
export const usageOwnerKindSchema = z.enum(['COURSE', 'NOTIFICATION', 'STUDENT', 'MEDIA']);
export const usageTypeSchema = z.enum([
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
export const mediaJobTypeSchema = z.enum([
  'THUMBNAIL_DERIVATION',
  'MARKDOWN_USAGE_SYNC',
  'MEDIA_USAGE_DELETE',
  'NOTIFICATION_USAGE',
]);
export const mediaJobStatusSchema = z.enum([
  'QUEUED',
  'PROCESSING',
  'COMPLETED',
  'PARTIAL_FAILED',
  'FAILED',
]);

const sha256Hex = z.string().regex(/^[a-f0-9]{64}$/u, 'checksum_sha256 phải là SHA-256 dạng hex');
const dateTime = z.iso.datetime();

// ---- Request ---------------------------------------------------------------------------------

export const createUploadIntentRequestSchema = z.object({
  file_name: z.string().trim().min(1).max(255),
  mime_type: z
    .string()
    .trim()
    .min(3)
    .max(127)
    .regex(/^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/iu),
  size_bytes: z.number().int().min(1),
  checksum_sha256: sha256Hex,
});
export type CreateUploadIntentRequest = z.infer<typeof createUploadIntentRequestSchema>;

export const listMediaLibraryQuerySchema = paginationQuerySchema.extend({
  type: mediaTypeSchema.optional(),
  status: mediaStatusSchema.optional(),
  search: z.string().trim().min(1).max(200).optional(),
});
export type ListMediaLibraryQuery = z.infer<typeof listMediaLibraryQuerySchema>;

export const createMediaUsageRequestSchema = z.object({
  media_id: idSchema,
  owner_kind: usageOwnerKindSchema,
  owner_id: idSchema,
  usage_type: usageTypeSchema,
  /** Bỏ trống để thêm vào cuối nhóm (cùng owner và usage_type). */
  position: z.number().int().min(0).max(10_000).optional(),
});
export type CreateMediaUsageRequest = z.infer<typeof createMediaUsageRequestSchema>;

export const createMediaUsagesRequestSchema = z.object({
  usages: z.array(createMediaUsageRequestSchema).min(1).max(100),
});
export type CreateMediaUsagesRequest = z.infer<typeof createMediaUsagesRequestSchema>;

/** Danh sách đầy đủ usage id của một nhóm theo thứ tự mới. */
export const reorderMediaUsagesRequestSchema = z.object({
  owner_kind: usageOwnerKindSchema,
  owner_id: idSchema,
  usage_type: usageTypeSchema,
  usage_ids: z.array(idSchema).min(1).max(500),
});
export type ReorderMediaUsagesRequest = z.infer<typeof reorderMediaUsagesRequestSchema>;

/** `?usage_ids=<id>,<id>` — tối đa 100 id. */
export const usageUrlsQuerySchema = z.object({
  usage_ids: z
    .string()
    .transform((value) => value.split(',').map((id) => id.trim()))
    .pipe(z.array(idSchema).min(1).max(100)),
});
export type UsageUrlsQuery = z.infer<typeof usageUrlsQuerySchema>;

export const listMediaJobsQuerySchema = paginationQuerySchema.extend({
  type: mediaJobTypeSchema.optional(),
  status: mediaJobStatusSchema.optional(),
});
export type ListMediaJobsQuery = z.infer<typeof listMediaJobsQuerySchema>;

// ---- Response --------------------------------------------------------------------------------

export const mediaDtoSchema = z.object({
  id: idSchema,
  type: mediaTypeSchema,
  status: mediaStatusSchema,
  original_name: z.string(),
  mime_type: z.string(),
  size_bytes: z.number().int(),
  checksum_sha256: sha256Hex,
  thumbnail_status: thumbnailStatusSchema,
  /** Đường dẫn công khai qua Gateway; client không bao giờ nhận bucket hay object key cuối cùng. */
  content_url: z.string().nullable(),
  thumbnail_url: z.string().nullable(),
  uploaded_by: idSchema,
  created_at: dateTime,
  updated_at: dateTime,
});
export type MediaDto = z.infer<typeof mediaDtoSchema>;

export const uploadIntentDtoSchema = z.object({
  media_id: idSchema,
  upload: z.object({
    method: z.literal('POST'),
    url: z.string(),
    /** Các field form cần gửi nguyên trạng (multipart, field `file` đặt cuối cùng). */
    fields: z.record(z.string(), z.string()),
  }),
  expires_at: dateTime,
});
export type UploadIntentDto = z.infer<typeof uploadIntentDtoSchema>;

export const mediaUsageDtoSchema = z.object({
  id: idSchema,
  media_id: idSchema,
  owner_kind: usageOwnerKindSchema,
  owner_id: idSchema,
  usage_type: usageTypeSchema,
  position: z.number().int(),
  created_at: dateTime,
});
export type MediaUsageDto = z.infer<typeof mediaUsageDtoSchema>;

export const mediaUsageUrlDtoSchema = z.object({
  usage_id: idSchema,
  media_id: idSchema,
  url: z.string(),
  thumbnail_url: z.string().nullable(),
});
export type MediaUsageUrlDto = z.infer<typeof mediaUsageUrlDtoSchema>;

export const mediaJobDtoSchema = z.object({
  id: idSchema,
  type: mediaJobTypeSchema,
  status: mediaJobStatusSchema,
  reference_id: z.string().nullable(),
  expected_count: z.number().int().nullable(),
  processed_count: z.number().int(),
  failed_count: z.number().int(),
  last_error: z.string().nullable(),
  created_at: dateTime,
  updated_at: dateTime,
});
export type MediaJobDto = z.infer<typeof mediaJobDtoSchema>;

export const mediaSummaryDtoSchema = z.object({
  total: z.number().int(),
  by_status: z.record(z.string(), z.number().int()),
  by_type: z.record(z.string(), z.number().int()),
  total_size_bytes: z.number().int(),
  active_usages: z.number().int(),
  unused_ready: z.number().int(),
});
export type MediaSummaryDto = z.infer<typeof mediaSummaryDtoSchema>;

export const mediaResponseSchema = apiResponseSchema(mediaDtoSchema);
