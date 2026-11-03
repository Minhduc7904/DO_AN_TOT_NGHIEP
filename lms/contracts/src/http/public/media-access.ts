import { z } from 'zod';

import { usageTypeSchema } from './media.js';

/**
 * Tầng truy cập URL của media:
 * - `PUBLIC`: URL trần `/api/v1/media/{id}/content`, ai cũng xem được (media phải có ít nhất một usage thuộc tầng này).
 * - `SIGNED`: URL kèm `?exp=&sig=` do `media` ký, có hạn; id bị lộ cũng không xem được.
 */
export const mediaAccessTierSchema = z.enum(['PUBLIC', 'SIGNED']);
export type MediaAccessTier = z.infer<typeof mediaAccessTierSchema>;

type MediaUsageType = z.infer<typeof usageTypeSchema>;

/** Nguồn duy nhất cho course, notification và media: loại usage nào dùng tầng nào. */
export const MEDIA_ACCESS_TIER_BY_USAGE: Readonly<Record<MediaUsageType, MediaAccessTier>> = {
  USER_AVATAR: 'PUBLIC',
  COURSE_THUMBNAIL: 'PUBLIC',
  COURSE_GALLERY: 'PUBLIC',
  COURSE_DESCRIPTION: 'PUBLIC',
  LESSON_CONTENT: 'SIGNED',
  LESSON_ATTACHMENT: 'SIGNED',
  QUIZ_CONTENT: 'SIGNED',
  NOTIFICATION_BODY: 'SIGNED',
  /** Thumbnail sinh ra từ media gốc; quyền xem theo media gốc nên mặc định ký. */
  MEDIA_THUMBNAIL: 'SIGNED',
};
