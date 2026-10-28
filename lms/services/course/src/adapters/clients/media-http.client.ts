import { SERVICE_TOKEN_PROVIDER, type TokenProvider } from '@aiops-lms/common/auth';
import { HttpQueryClient } from '@aiops-lms/common/clients';
import { AppError } from '@aiops-lms/common/errors';
import {
  apiResponseSchema,
  INTERNAL_PREFIX,
  usageIdsByOwnerDtoSchema,
} from '@aiops-lms/contracts/http';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { MediaUsageLookup } from '../../application/ports/media-effects.js';

const responseSchema = apiResponseSchema(usageIdsByOwnerDtoSchema);
const MAX_OWNERS_PER_QUERY = 500;

/** Cạnh `course → media`: hỏi usage id theo owner trước khi xóa course/lesson/quiz. */
@Injectable()
export class MediaHttpClient implements MediaUsageLookup {
  private readonly client: HttpQueryClient;

  constructor(config: ConfigService, @Inject(SERVICE_TOKEN_PROVIDER) tokens: TokenProvider) {
    this.client = new HttpQueryClient({
      dependency: 'course-media',
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
}
