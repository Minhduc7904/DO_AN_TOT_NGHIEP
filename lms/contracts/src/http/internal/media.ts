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
