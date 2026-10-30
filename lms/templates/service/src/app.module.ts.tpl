import { createHttpServiceAuth, SERVICE_AUTH } from '@aiops-lms/common/auth';
import { COMMON_HTTP_PROVIDERS, HealthController, READINESS_CHECKS } from '@aiops-lms/common/http';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { PrismaService } from './adapters/persistence/prisma.service.js';
import { __CONST___SERVICE_NAME } from './config/app-config.js';
import { validateEnvironment } from './config/env.schema.js';

/**
 * Mỗi use case là một class trong `application/use-cases/<area>/<verb-noun>.use-case.ts`, được
 * đăng ký bằng provider factory (use case không import Nest) và gọi từ controller mỏng. DTO
 * request/response là zod schema trong `lms/contracts/src/http/`; controller trả DTO hoặc
 * `Page<Dto>`, envelope do `ResponseEnvelopeInterceptor` bọc.
 *
 * Hai bề mặt HTTP tách thư mục (ADR-004): `adapters/http/public/` (`${PUBLIC_PREFIX}`, chỉ Gateway
 * gọi, dùng `@Roles`/`@Anonymous`) và `adapters/http/internal/` (`${INTERNAL_PREFIX}`, service-to-service,
 * dùng `@InternalApi({ scopes })`). Khai báo controller của hai bề mặt trong `controllers` bên dưới.
 */
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment })],
  controllers: [HealthController],
  providers: [
    PrismaService,
    ...COMMON_HTTP_PROVIDERS,
    {
      provide: SERVICE_AUTH,
      useFactory: (config: ConfigService) =>
        createHttpServiceAuth(__CONST___SERVICE_NAME, {
          baseUrl: config.getOrThrow<string>('IDENTITY_BASE_URL'),
          timeoutMs: config.getOrThrow<number>('IDENTITY_JWKS_TIMEOUT_MS'),
          cacheTtlMs: config.getOrThrow<number>('IDENTITY_JWKS_CACHE_TTL_MS'),
          minRefetchIntervalMs: config.getOrThrow<number>('IDENTITY_JWKS_MIN_REFETCH_MS'),
        }),
      inject: [ConfigService],
    },
    {
      provide: READINESS_CHECKS,
      useFactory: (prisma: PrismaService) => ({ postgres: () => prisma.ping() }),
      inject: [PrismaService],
    },
  ],
})
export class AppModule {}
