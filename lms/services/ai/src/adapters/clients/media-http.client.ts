import { SERVICE_TOKEN_PROVIDER, type TokenProvider } from '@aiops-lms/common/auth';
import { HttpQueryClient } from '@aiops-lms/common/clients';
import { INTERNAL_PREFIX } from '@aiops-lms/contracts/http';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { MediaContentSource } from '../../application/ports/lesson-course-client.js';
import { upstreamError } from './upstream-error.js';

const DEPENDENCY = 'ai-worker-media';

/** Cạnh `ai-worker → media`: tải byte nội dung tệp (scope `media:content:read`), timeout dài hơn truy vấn thường. */
@Injectable()
export class MediaHttpClient implements MediaContentSource {
  private readonly client: HttpQueryClient;

  constructor(config: ConfigService, @Inject(SERVICE_TOKEN_PROVIDER) tokens: TokenProvider) {
    this.client = new HttpQueryClient({
      dependency: DEPENDENCY,
      baseUrl: config.getOrThrow<string>('AI_MEDIA_BASE_URL'),
      auth: { audience: 'media', tokens },
      timeoutMs: config.getOrThrow<number>('AI_MEDIA_CONTENT_TIMEOUT_MS'),
      breaker: {
        failureThreshold: config.getOrThrow<number>('AI_MEDIA_BREAKER_THRESHOLD'),
        cooldownMs: config.getOrThrow<number>('AI_MEDIA_BREAKER_COOLDOWN_MS'),
      },
    });
  }

  async downloadContent(mediaId: string): Promise<Uint8Array> {
    const response = await this.client.request<Uint8Array>({
      path: `/${INTERNAL_PREFIX}/media/${mediaId}/content`,
      responseType: 'bytes',
    });
    if (response.status === 200) return response.body;
    // Media không đọc được (không tồn tại, chưa READY, ...): giữ mã lỗi của `media` để hiển thị.
    throw upstreamError(DEPENDENCY, response.status, response.body);
  }
}
