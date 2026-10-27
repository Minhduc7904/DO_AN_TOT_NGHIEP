import { COMMON_HTTP_PROVIDERS, HealthController, READINESS_CHECKS } from '@aiops-lms/common/http';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaService } from './adapters/persistence/prisma.service.js';
import { validateEnvironment } from './config/env.schema.js';

/**
 * Mỗi use case là một class trong `application/use-cases/<area>/<verb-noun>.use-case.ts`, được
 * đăng ký bằng provider factory (use case không import Nest) và gọi từ controller mỏng. DTO
 * request/response là zod schema trong `lms/contracts/src/http/`; controller trả DTO hoặc
 * `Page<Dto>`, envelope do `ResponseEnvelopeInterceptor` bọc.
 */
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment })],
  controllers: [HealthController],
  providers: [
    PrismaService,
    ...COMMON_HTTP_PROVIDERS,
    {
      provide: READINESS_CHECKS,
      useFactory: (prisma: PrismaService) => ({ postgres: () => prisma.ping() }),
      inject: [PrismaService],
    },
  ],
})
export class AppModule {}
