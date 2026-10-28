import { SERVICE_TOKEN_PROVIDER, type TokenProvider } from '@aiops-lms/common/auth';
import { HttpQueryClient } from '@aiops-lms/common/clients';
import { AppError } from '@aiops-lms/common/errors';
import {
  apiResponseSchema,
  INTERNAL_PREFIX,
  mediaCleanupRequestSchema,
  mediaCleanupSummaryDtoSchema,
} from '@aiops-lms/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { JobHandler, JobHandlerResult } from '../../application/ports/job-handler.js';
import { type JsonObject, RUN_ERROR_CODES } from '../../domain/job.js';

const DEPENDENCY = 'scheduler-worker-media';
const responseSchema = apiResponseSchema(mediaCleanupSummaryDtoSchema);

/**
 * Handler của job `MEDIA_UNUSED_CLEANUP`: chỉ gọi `POST /internal/v1/media/cleanup` bằng service token
 * của `scheduler-worker` (audience `media`, scope `media:cleanup`). `scheduler` không biết MinIO và
 * không đọc `media_db`; output của run là bản tóm tắt an toàn mà `media` trả về.
 */
@Injectable()
export class MediaCleanupHandler implements JobHandler {
  private readonly client: HttpQueryClient;

  constructor(config: ConfigService, @Inject(SERVICE_TOKEN_PROVIDER) tokens: TokenProvider) {
    this.client = new HttpQueryClient({
      dependency: DEPENDENCY,
      baseUrl: config.getOrThrow<string>('SCHEDULER_MEDIA_BASE_URL'),
      auth: { audience: 'media', tokens },
      timeoutMs: config.getOrThrow<number>('SCHEDULER_MEDIA_TIMEOUT_MS'),
      breaker: {
        failureThreshold: config.getOrThrow<number>('SCHEDULER_MEDIA_BREAKER_THRESHOLD'),
        cooldownMs: config.getOrThrow<number>('SCHEDULER_MEDIA_BREAKER_COOLDOWN_MS'),
      },
    });
  }

  async handle(payload: JsonObject): Promise<JobHandlerResult> {
    // Payload đã được kiểm lúc tạo job; parse lại để chỉ gửi đúng các tham số hợp lệ.
    const body = mediaCleanupRequestSchema.parse(payload);
    // `AppError` 503/504 (media chết/quá hạn) được use case ghi thành mã lỗi của run.
    const response = await this.client.request({
      method: 'POST',
      path: `/${INTERNAL_PREFIX}/media/cleanup`,
      body,
    });

    const parsed = responseSchema.safeParse(response.body);
    if (response.status !== 200 || !parsed.success || !parsed.data.success) {
      if (response.status >= 400 && response.status < 500) {
        const code =
          parsed.success && !parsed.data.success ? parsed.data.error.code : String(response.status);
        return {
          output: {},
          failure: {
            code: RUN_ERROR_CODES.mediaCleanupRejected,
            message: `Media từ chối yêu cầu dọn dẹp (HTTP ${response.status}, ${code})`,
          },
        };
      }
      throw new AppError(
        RUN_ERROR_CODES.mediaCleanupInvalidResponse,
        502,
        'Media trả phản hồi dọn dẹp không đúng contract',
      );
    }

    const summary = parsed.data.data;
    return summary.failed > 0
      ? {
          output: summary,
          failure: {
            code: RUN_ERROR_CODES.mediaCleanupIncomplete,
            message: `Media dọn chưa xong: ${summary.failed} media lỗi, sẽ thử lại ở lần chạy sau`,
          },
        }
      : { output: summary };
  }
}
