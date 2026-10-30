import {
  HttpJwksKeyProvider,
  HttpServiceTokenSource,
  ServiceTokenProvider,
  TokenVerifier,
  SERVICE_TOKEN_PROVIDER,
  type TokenProvider,
} from '@aiops-lms/common/auth';
import { ENVELOPE_PROVIDERS, HealthController, READINESS_CHECKS } from '@aiops-lms/common/http';
import { JWKS_PATH } from '@aiops-lms/contracts/http/common';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { JwksUserTokenVerifier } from './adapters/security/jwks-user-token.verifier.js';
import { FetchUpstreamClient } from './adapters/upstream/fetch-upstream.client.js';
import { ProxyController } from './adapters/http/public/proxy.controller.js';
import { UPSTREAM_CLIENT, type UpstreamClient } from './application/ports/upstream-client.js';
import {
  USER_TOKEN_VERIFIER,
  type UserTokenVerifier,
} from './application/ports/user-token-verifier.js';
import { ProxyRequestUseCase } from './application/use-cases/proxy-request.use-case.js';
import { validateEnvironment, type Environment } from './config/env.schema.js';
import { UPSTREAMS, type UpstreamName } from './domain/route-table.js';

const BASE_URL_KEYS = {
  identity: 'GATEWAY_IDENTITY_BASE_URL',
  course: 'GATEWAY_COURSE_BASE_URL',
  media: 'GATEWAY_MEDIA_BASE_URL',
  notification: 'GATEWAY_NOTIFICATION_BASE_URL',
  scheduler: 'GATEWAY_SCHEDULER_BASE_URL',
  ai: 'GATEWAY_AI_BASE_URL',
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
    // Gateway tự xác thực user token trong use case nên chỉ cần interceptor envelope, không có guard.
    ...ENVELOPE_PROVIDERS,
    {
      provide: SERVICE_TOKEN_PROVIDER,
      useFactory: (config: ConfigService<Environment, true>): TokenProvider =>
        new ServiceTokenProvider(
          new HttpServiceTokenSource({
            dependency: 'gateway-identity-token',
            baseUrl: config.getOrThrow<string>('GATEWAY_IDENTITY_BASE_URL'),
            clientId: config.getOrThrow<string>('SERVICE_CLIENT_ID'),
            clientSecret: config.getOrThrow<string>('SERVICE_CLIENT_SECRET'),
            timeoutMs: config.getOrThrow<number>('IDENTITY_TOKEN_TIMEOUT_MS'),
            breaker: {
              failureThreshold: config.getOrThrow<number>('IDENTITY_TOKEN_BREAKER_THRESHOLD'),
              cooldownMs: config.getOrThrow<number>('IDENTITY_TOKEN_BREAKER_COOLDOWN_MS'),
            },
          }),
        ),
      inject: [ConfigService],
    },
    {
      provide: USER_TOKEN_VERIFIER,
      useFactory: (config: ConfigService<Environment, true>): UserTokenVerifier =>
        new JwksUserTokenVerifier(
          new TokenVerifier(
            new HttpJwksKeyProvider({
              dependency: 'gateway-identity-jwks',
              url: new URL(
                `/${JWKS_PATH}`,
                config.getOrThrow<string>('GATEWAY_IDENTITY_BASE_URL'),
              ).toString(),
              timeoutMs: config.getOrThrow<number>('IDENTITY_JWKS_TIMEOUT_MS'),
              cacheTtlMs: config.getOrThrow<number>('IDENTITY_JWKS_CACHE_TTL_MS'),
              minRefetchIntervalMs: config.getOrThrow<number>('IDENTITY_JWKS_MIN_REFETCH_MS'),
            }),
          ),
        ),
      inject: [ConfigService],
    },
    {
      provide: UPSTREAM_CLIENT,
      useFactory: (config: ConfigService<Environment, true>, tokens: TokenProvider) =>
        new FetchUpstreamClient(
          upstreamBaseUrls(config),
          config.getOrThrow<number>('GATEWAY_UPSTREAM_TIMEOUT_MS'),
          tokens,
        ),
      inject: [ConfigService, SERVICE_TOKEN_PROVIDER],
    },
    {
      provide: ProxyRequestUseCase,
      useFactory: (
        config: ConfigService<Environment, true>,
        upstream: UpstreamClient,
        users: UserTokenVerifier,
      ) =>
        new ProxyRequestUseCase(
          upstream,
          new Set(Object.keys(upstreamBaseUrls(config)) as UpstreamName[]),
          users,
        ),
      inject: [ConfigService, UPSTREAM_CLIENT, USER_TOKEN_VERIFIER],
    },
    // Gateway không có dependency riêng: ready khi process phục vụ được request.
    { provide: READINESS_CHECKS, useValue: {} },
  ],
})
export class AppModule {}
