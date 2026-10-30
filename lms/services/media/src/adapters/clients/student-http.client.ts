import { SERVICE_TOKEN_PROVIDER, type TokenProvider } from '@aiops-lms/common/auth';
import { HttpQueryClient } from '@aiops-lms/common/clients';
import { AppError } from '@aiops-lms/common/errors';
import { apiResponseSchema, INTERNAL_PREFIX, studentDtoSchema } from '@aiops-lms/contracts/http';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { StudentClient } from '../../application/ports/student-client.js';

const responseSchema = apiResponseSchema(studentDtoSchema);

/** Cạnh `media → student`: kiểm tra hồ sơ student trước khi gắn avatar. */
@Injectable()
export class StudentHttpClient implements StudentClient {
  private readonly client: HttpQueryClient;

  constructor(config: ConfigService, @Inject(SERVICE_TOKEN_PROVIDER) tokens: TokenProvider) {
    this.client = new HttpQueryClient({
      dependency: 'media-identity',
      baseUrl: config.getOrThrow<string>('MEDIA_IDENTITY_BASE_URL'),
      auth: { audience: 'identity', tokens },
      timeoutMs: config.getOrThrow<number>('MEDIA_IDENTITY_TIMEOUT_MS'),
      breaker: {
        failureThreshold: config.getOrThrow<number>('MEDIA_IDENTITY_BREAKER_THRESHOLD'),
        cooldownMs: config.getOrThrow<number>('MEDIA_IDENTITY_BREAKER_COOLDOWN_MS'),
      },
    });
  }

  async findStatus(studentId: string): Promise<string | null> {
    const response = await this.client.request({
      method: 'GET',
      path: `/${INTERNAL_PREFIX}/students/${encodeURIComponent(studentId)}`,
    });
    if (response.status === 404) return null;
    if (response.status !== 200) throw AppError.dependencyUnavailable('media-identity');
    const parsed = responseSchema.safeParse(response.body);
    if (!parsed.success || !parsed.data.data)
      throw AppError.dependencyUnavailable('media-identity');
    return parsed.data.data.status;
  }
}
