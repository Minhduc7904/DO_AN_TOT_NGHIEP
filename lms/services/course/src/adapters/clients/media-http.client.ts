import { SERVICE_TOKEN_PROVIDER, type TokenProvider } from '@aiops-lms/common/auth';
import { HttpQueryClient } from '@aiops-lms/common/clients';
import { AppError } from '@aiops-lms/common/errors';
import {
  apiResponseSchema,
  INTERNAL_PREFIX,
  ownerUsageDtoSchema,
  usageIdsByOwnerDtoSchema,
} from '@aiops-lms/contracts/http';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

import type { LessonAttachmentSource } from '../../application/ports/lesson-attachment-source.js';
import type { MediaUsageLookup } from '../../application/ports/media-effects.js';
import type { LessonAttachment } from '../../domain/lesson-ai.js';

const responseSchema = apiResponseSchema(usageIdsByOwnerDtoSchema);
const ownerUsagesResponseSchema = apiResponseSchema(z.array(ownerUsageDtoSchema));
const DEPENDENCY = 'course-media';
const MAX_OWNERS_PER_QUERY = 500;

/**
 * Cạnh `course → media`: hỏi usage id theo owner trước khi xóa course/lesson/quiz và liệt kê tệp đính kèm
 * của bài học cho panel AI.
 */
@Injectable()
export class MediaHttpClient implements MediaUsageLookup, LessonAttachmentSource {
  private readonly client: HttpQueryClient;

  constructor(config: ConfigService, @Inject(SERVICE_TOKEN_PROVIDER) tokens: TokenProvider) {
    this.client = new HttpQueryClient({
      dependency: DEPENDENCY,
      baseUrl: config.getOrThrow<string>('COURSE_MEDIA_BASE_URL'),
      auth: { audience: 'media', tokens },
      timeoutMs: config.getOrThrow<number>('COURSE_MEDIA_TIMEOUT_MS'),
      breaker: {
        failureThreshold: config.getOrThrow<number>('COURSE_MEDIA_BREAKER_THRESHOLD'),
        cooldownMs: config.getOrThrow<number>('COURSE_MEDIA_BREAKER_COOLDOWN_MS'),
      },
    });
  }

  async findUsageIds(ownerIds: readonly string[]): Promise<string[]> {
    const usageIds: string[] = [];
    for (let offset = 0; offset < ownerIds.length; offset += MAX_OWNERS_PER_QUERY) {
      const response = await this.client.request({
        method: 'POST',
        path: `/${INTERNAL_PREFIX}/media/usages/ids:query`,
        body: {
          owner_kind: 'COURSE',
          owner_ids: ownerIds.slice(offset, offset + MAX_OWNERS_PER_QUERY),
        },
      });
      if (response.status !== 200) throw AppError.dependencyUnavailable('course-media');
      const parsed = responseSchema.safeParse(response.body);
      if (!parsed.success || !parsed.data.data) {
        throw AppError.dependencyUnavailable('course-media');
      }
      for (const item of parsed.data.data.items) usageIds.push(...item.usage_ids);
    }
    return usageIds;
  }

  async listLessonAttachments(lessonId: string): Promise<LessonAttachment[]> {
    const response = await this.client.request({
      path: `/${INTERNAL_PREFIX}/media/usages/by-owner`,
      query: { owner_kind: 'COURSE', owner_id: lessonId, usage_type: 'LESSON_ATTACHMENT' },
    });
    if (response.status !== 200) throw AppError.dependencyUnavailable(DEPENDENCY);
    const parsed = ownerUsagesResponseSchema.safeParse(response.body);
    if (!parsed.success || !parsed.data.data) throw AppError.dependencyUnavailable(DEPENDENCY);
    return parsed.data.data.map((usage) => ({
      mediaId: usage.media_id,
      position: usage.position,
      fileName: usage.original_name,
      contentType: usage.mime_type,
      mediaType: usage.media_type,
      sizeBytes: usage.size_bytes,
    }));
  }
}
