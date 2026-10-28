import { z } from 'zod';

import { idSchema } from '../common/index.js';
import { mediaTypeSchema, usageOwnerKindSchema, usageTypeSchema } from '../public/media.js';

/** Nội bộ (course → media): liệt kê usage của một owner kèm metadata tệp (ví dụ tệp đính kèm của bài học). */
export const listOwnerUsagesQuerySchema = z.object({
  owner_kind: usageOwnerKindSchema,
  owner_id: idSchema,
  usage_type: usageTypeSchema,
});
export type ListOwnerUsagesQuery = z.infer<typeof listOwnerUsagesQuerySchema>;

export const ownerUsageDtoSchema = z.object({
  usage_id: idSchema,
  media_id: idSchema,
  position: z.number().int(),
  original_name: z.string(),
  mime_type: z.string(),
  media_type: mediaTypeSchema,
  size_bytes: z.number().int(),
});
export type OwnerUsageDto = z.infer<typeof ownerUsageDtoSchema>;
