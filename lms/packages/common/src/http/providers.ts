import type { Provider } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { ResponseEnvelopeInterceptor } from './response-envelope.interceptor.js';
import { ServiceAuthGuard } from './service-auth.guard.js';

/** Interceptor bọc envelope; Gateway chỉ dùng phần này vì tự xác thực user trong use case. */
export const ENVELOPE_PROVIDERS: Provider[] = [
  { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
];

/**
 * Provider HTTP dùng chung cho mọi service ngoài Gateway: guard service token/role và
 * interceptor envelope. Service phải cung cấp thêm `SERVICE_AUTH` (`@aiops-lms/common/auth`).
 * Bộ lọc lỗi `AppExceptionFilter` đăng ký ở `bootstrap.ts` (`app.useGlobalFilters`).
 */
export const COMMON_HTTP_PROVIDERS: Provider[] = [
  { provide: APP_GUARD, useClass: ServiceAuthGuard },
  ...ENVELOPE_PROVIDERS,
];
