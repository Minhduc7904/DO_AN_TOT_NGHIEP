import { COMMON_HTTP_PROVIDERS, HealthController, READINESS_CHECKS } from '@aiops-lms/common/http';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { FetchUpstreamClient } from './adapters/upstream/fetch-upstream.client.js';
import { ProxyController } from './adapters/http/proxy.controller.js';
import { UPSTREAM_CLIENT, type UpstreamClient } from './application/ports/upstream-client.js';
import { ProxyRequestUseCase } from './application/use-cases/proxy-request.use-case.js';
import { validateEnvironment, type Environment } from './config/env.schema.js';
import { UPSTREAMS, type UpstreamName } from './domain/route-table.js';

const BASE_URL_KEYS = {
  auth: 'GATEWAY_AUTH_BASE_URL',
  student: 'GATEWAY_STUDENT_BASE_URL',
  course: 'GATEWAY_COURSE_BASE_URL',
  media: 'GATEWAY_MEDIA_BASE_URL',
  notification: 'GATEWAY_NOTIFICATION_BASE_URL',
  scheduler: 'GATEWAY_SCHEDULER_BASE_URL',
  ai: 'GATEWAY_AI_BASE_URL',
  enrollment: 'GATEWAY_ENROLLMENT_BASE_URL',
  submission: 'GATEWAY_SUBMISSION_BASE_URL',
  grading: 'GATEWAY_GRADING_BASE_URL',
} as const satisfies Record<UpstreamName, keyof Environment>;

function upstreamBaseUrls(
  config: ConfigService<Environment, true>,
): Partial<Record<UpstreamName, string>> {
  const urls: Partial<Record<UpstreamName, string>> = {};
  for (const upstream of UPSTREAMS) {
    const value = config.get(BASE_URL_KEYS[upstream], { infer: true }) as string | undefined;
    if (value) urls[upstream] = value;
  }
  return urls;
}

@Module({
  imports: [ConfigModule.forRoot({ cache: true, isGlobal: true, validate: validateEnvironment })],
  controllers: [HealthController, ProxyController],
  providers: [
    ...COMMON_HTTP_PROVIDERS,
    {
      provide: UPSTREAM_CLIENT,
      useFactory: (config: ConfigService<Environment, true>) =>
        new FetchUpstreamClient(
          upstreamBaseUrls(config),
          config.getOrThrow<number>('GATEWAY_UPSTREAM_TIMEOUT_MS'),
        ),
      inject: [ConfigService],
    },
    {
      provide: ProxyRequestUseCase,
      useFactory: (config: ConfigService<Environment, true>, upstream: UpstreamClient) =>
        new ProxyRequestUseCase(
          upstream,
          new Set(Object.keys(upstreamBaseUrls(config)) as UpstreamName[]),
          config.getOrThrow<string>('GATEWAY_JWT_SECRET'),
        ),
      inject: [ConfigService, UPSTREAM_CLIENT],
    },
    // Gateway không có dependency riêng: ready khi process phục vụ được request.
    { provide: READINESS_CHECKS, useValue: {} },
  ],
})
export class AppModule {}
