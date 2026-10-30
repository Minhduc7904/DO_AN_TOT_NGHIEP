import { SERVICE_TOKEN_PROVIDER, type TokenProvider } from '@aiops-lms/common/auth';
import { HttpQueryClient } from '@aiops-lms/common/clients';
import { AppError } from '@aiops-lms/common/errors';
import {
  apiListResponseSchema,
  apiResponseSchema,
  INTERNAL_PREFIX,
  studentDtoSchema,
} from '@aiops-lms/contracts/http';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Recipient, StudentDirectory } from '../../application/ports/student-directory.js';

const DEPENDENCY = 'notification-worker-identity';
const listSchema = apiListResponseSchema(studentDtoSchema);
const oneSchema = apiResponseSchema(studentDtoSchema);

/** Cạnh `notification-worker → student`: recipient và email lấy qua HTTP nội bộ. */
@Injectable()
export class StudentHttpClient implements StudentDirectory {
  private readonly client: HttpQueryClient;

  constructor(config: ConfigService, @Inject(SERVICE_TOKEN_PROVIDER) tokens: TokenProvider) {
    this.client = new HttpQueryClient({
      dependency: DEPENDENCY,
      baseUrl: config.getOrThrow<string>('NOTIFICATION_IDENTITY_BASE_URL'),
      auth: { audience: 'identity', tokens },
      timeoutMs: config.getOrThrow<number>('NOTIFICATION_IDENTITY_TIMEOUT_MS'),
      breaker: {
        failureThreshold: config.getOrThrow<number>('NOTIFICATION_IDENTITY_BREAKER_THRESHOLD'),
        cooldownMs: config.getOrThrow<number>('NOTIFICATION_IDENTITY_BREAKER_COOLDOWN_MS'),
      },
    });
  }

  async listActive(page: number, pageSize: number): Promise<{ items: Recipient[]; total: number }> {
    const response = await this.client.request({
      method: 'GET',
      path: `/${INTERNAL_PREFIX}/students`,
      query: { page: String(page), page_size: String(pageSize) },
    });
    const parsed = listSchema.safeParse(response.body);
    if (response.status !== 200 || !parsed.success || !parsed.data.data) {
      throw AppError.dependencyUnavailable(DEPENDENCY);
    }
    const students = parsed.data.data;
    return {
      items: students.map((student) => ({ id: student.id, email: student.email })),
      total: parsed.data.meta.pagination?.total ?? students.length,
    };
  }

  async find(studentId: string): Promise<(Recipient & { active: boolean }) | null> {
    const response = await this.client.request({
      method: 'GET',
      path: `/${INTERNAL_PREFIX}/students/${encodeURIComponent(studentId)}`,
    });
    if (response.status === 404) return null;
    const parsed = oneSchema.safeParse(response.body);
    if (response.status !== 200 || !parsed.success || !parsed.data.data) {
      throw AppError.dependencyUnavailable(DEPENDENCY);
    }
    const student = parsed.data.data;
    return { id: student.id, email: student.email, active: student.status === 'ACTIVE' };
  }
}
