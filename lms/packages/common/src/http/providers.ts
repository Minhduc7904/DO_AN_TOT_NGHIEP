import type { Provider } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { ResponseEnvelopeInterceptor } from './response-envelope.interceptor.js';
import { PrincipalGuard } from './principal.js';

/**
 * Provider HTTP dùng chung cho mọi service: guard danh tính/role và interceptor bọc envelope.
 * Bộ lọc lỗi `AppExceptionFilter` đăng ký ở `bootstrap.ts` (`app.useGlobalFilters`).
 */
export const COMMON_HTTP_PROVIDERS: Provider[] = [
  { provide: APP_GUARD, useClass: PrincipalGuard },
  { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
];
