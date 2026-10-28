import { z } from 'zod';

import { idSchema } from '../common/index.js';
import { usageOwnerKindSchema } from '../public/media.js';

/** Nội bộ (course → media): lấy usage id theo owner, ví dụ trước khi xóa khóa học. */
export const queryUsageIdsRequestSchema = z.object({
  owner_kind: usageOwnerKindSchema,
  owner_ids: z.array(idSchema).min(1).max(500),
});
export type QueryUsageIdsRequest = z.infer<typeof queryUsageIdsRequestSchema>;

export const usageIdsByOwnerDtoSchema = z.object({
  items: z.array(z.object({ owner_id: idSchema, usage_ids: z.array(idSchema) })),
});
export type UsageIdsByOwnerDto = z.infer<typeof usageIdsByOwnerDtoSchema>;

/**
 * Nội bộ (scheduler-worker → media): dọn media không dùng và phục hồi upload `PENDING` stale.
 * Mọi trường tùy chọn; giá trị mặc định và biên do `media` quyết định qua env.
 */
export const mediaCleanupRequestSchema = z.object({
  /** Media `READY` không còn usage và cũ hơn ngần này giờ mới bị dọn. */
  retention_hours: z.number().int().min(0).max(8_760).optional(),
  /** Upload `PENDING` đã quá hạn presigned cộng thêm ngần này phút mới bị coi là stale. */
  pending_grace_minutes: z.number().int().min(0).max(10_080).optional(),
  /** Số media tối đa mỗi pha trong một lần gọi. */
  limit: z.number().int().min(1).max(1_000).optional(),
});
export type MediaCleanupRequest = z.infer<typeof mediaCleanupRequestSchema>;

/** Tóm tắt an toàn: chỉ số lượng và tham số hiệu lực, không có object key hay credential. */
export const mediaCleanupSummaryDtoSchema = z.object({
  retention_hours: z.number().int().min(0),
  pending_grace_minutes: z.number().int().min(0),
  limit: z.number().int().min(1),
  /** Media gốc không dùng đã được xóa (đã gồm thumbnail của nó trong `thumbnails_deleted`). */
  unused_deleted: z.number().int().min(0),
  thumbnails_deleted: z.number().int().min(0),
  /** Số object đã gửi lệnh xóa khỏi MinIO (đối tượng đã mất sẵn không phải lỗi). */
  objects_removed: z.number().int().min(0),
  pending_recovered: z.number().int().min(0),
  /** Object tạm/cuối còn tồn tại của upload `PENDING` stale đã được xóa. */
  pending_orphan_objects_removed: z.number().int().min(0),
  /** Bỏ qua vì vừa có usage, đang bị khóa bởi lượt khác hoặc đã đổi trạng thái. */
  skipped: z.number().int().min(0),
  /** Lỗi từng media (MinIO/DB); media đó giữ nguyên để lần sau thử lại. */
  failed: z.number().int().min(0),
  /** Còn ứng viên chưa xử lý vì chạm `limit`. */
  has_more: z.boolean(),
});
export type MediaCleanupSummaryDto = z.infer<typeof mediaCleanupSummaryDtoSchema>;
