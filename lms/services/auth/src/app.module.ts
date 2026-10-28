import {
  SERVICE_AUTH,
  SERVICE_TOKEN_PROVIDER,
  ServiceTokenProvider,
  TokenVerifier,
  generateSigningKey,
  signingKeyFromPem,
  type ServiceAuthSettings,
} from '@aiops-lms/common/auth';
import { COMMON_HTTP_PROVIDERS, HealthController, READINESS_CHECKS } from '@aiops-lms/common/http';
import { Logger, Module } from '@nestjs/common';
import { createPublicKey } from 'node:crypto';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { BootstrapRunner } from './adapters/bootstrap/bootstrap.runner.js';
import { LocalServiceTokenSource } from './adapters/clients/local-service-token.source.js';
import { StudentHttpClient } from './adapters/clients/student-http.client.js';
import { JwksController } from './adapters/http/open/jwks.controller.js';
import { AuthController } from './adapters/http/public/auth.controller.js';
import { ServiceAuthController } from './adapters/http/internal/service-auth.controller.js';
import { Ed25519TokenSigner } from './adapters/security/ed25519-token-signer.js';
import { PrismaAccountRepository } from './adapters/persistence/prisma-account.repository.js';
import { PrismaRefreshTokenRepository } from './adapters/persistence/prisma-refresh-token.repository.js';
import { PrismaServiceClientRepository } from './adapters/persistence/prisma-service-client.repository.js';
import { PrismaService } from './adapters/persistence/prisma.service.js';
import {
  ACCOUNT_REPOSITORY,
  type AccountRepository,
} from './application/ports/account-repository.js';
import {
  REFRESH_TOKEN_REPOSITORY,
  type RefreshTokenRepository,
} from './application/ports/refresh-token-repository.js';
import {
  STUDENT_PROFILE_CLIENT,
  type StudentProfileClient,
} from './application/ports/student-profile-client.js';
import {
  SERVICE_CLIENT_REPOSITORY,
  type ServiceClientRepository,
} from './application/ports/service-client-repository.js';
import { TOKEN_SIGNER, type TokenSigner } from './application/ports/token-signer.js';
import { TokenIssuer } from './application/token-issuer.js';
import { TOKEN_SETTINGS, type TokenSettings } from './application/token-settings.js';
import { BootstrapAccountsUseCase } from './application/use-cases/accounts/bootstrap-accounts.use-case.js';
import { CreateAccountUseCase } from './application/use-cases/accounts/create-account.use-case.js';
import { GetCurrentAccountUseCase } from './application/use-cases/accounts/get-current-account.use-case.js';
import { ListAccountsUseCase } from './application/use-cases/accounts/list-accounts.use-case.js';
import { RegisterStudentUseCase } from './application/use-cases/accounts/register-student.use-case.js';
import { BootstrapServiceClientsUseCase } from './application/use-cases/service-auth/bootstrap-service-clients.use-case.js';
import { GetJwksUseCase } from './application/use-cases/service-auth/get-jwks.use-case.js';
import { IssueServiceTokenUseCase } from './application/use-cases/service-auth/issue-service-token.use-case.js';
import { CredentialsAuthenticator } from './application/use-cases/sessions/credentials-authenticator.js';
import { LoginAdminUseCase } from './application/use-cases/sessions/login-admin.use-case.js';
import { LoginInstructorUseCase } from './application/use-cases/sessions/login-instructor.use-case.js';
import { LoginStudentUseCase } from './application/use-cases/sessions/login-student.use-case.js';
import { RefreshTokenUseCase } from './application/use-cases/sessions/refresh-token.use-case.js';
import { AUTH_SERVICE_NAME } from './config/app-config.js';
import { validateEnvironment } from './config/env.schema.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment })],
  controllers: [HealthController, AuthController, ServiceAuthController, JwksController],
  providers: [
    PrismaService,
    PrismaAccountRepository,
    PrismaRefreshTokenRepository,
    PrismaServiceClientRepository,
    StudentHttpClient,
    BootstrapRunner,
    { provide: ACCOUNT_REPOSITORY, useExisting: PrismaAccountRepository },
    { provide: REFRESH_TOKEN_REPOSITORY, useExisting: PrismaRefreshTokenRepository },
    { provide: SERVICE_CLIENT_REPOSITORY, useExisting: PrismaServiceClientRepository },
    { provide: STUDENT_PROFILE_CLIENT, useExisting: StudentHttpClient },
    ...COMMON_HTTP_PROVIDERS,
    {
      provide: READINESS_CHECKS,
      useFactory: (accounts: AccountRepository, bootstrap: BootstrapRunner) => ({
        postgres: () => accounts.ping(),
        bootstrap: () => bootstrap.ensureAccountsSeeded(),
      }),
      inject: [ACCOUNT_REPOSITORY, BootstrapRunner],
    },
    {
      provide: TOKEN_SETTINGS,
      useFactory: (config: ConfigService): TokenSettings => ({
        jwtTtlSeconds: config.getOrThrow<number>('AUTH_JWT_TTL_SECONDS'),
        refreshTtlSeconds: config.getOrThrow<number>('AUTH_REFRESH_TTL_SECONDS'),
        serviceTokenTtlSeconds: config.getOrThrow<number>('AUTH_SERVICE_TOKEN_TTL_SECONDS'),
      }),
      inject: [ConfigService],
    },
    {
      provide: TOKEN_SIGNER,
      useFactory: (config: ConfigService): Ed25519TokenSigner => {
        const pem = config.get<string | undefined>('AUTH_SIGNING_KEY_PEM');
        if (!pem) {
          new Logger('TokenSigner').warn(
            'AUTH_SIGNING_KEY_PEM chưa đặt: dùng khóa ký tạm, token mất hiệu lực khi khởi động lại',
          );
        }
        const previous = config.get<string | undefined>('AUTH_PREVIOUS_PUBLIC_KEY_PEM');
        return new Ed25519TokenSigner(
          pem ? signingKeyFromPem(pem) : generateSigningKey(),
          previous ? [createPublicKey(previous)] : [],
        );
      },
      inject: [ConfigService],
    },
    {
      provide: SERVICE_AUTH,
      useFactory: (signer: Ed25519TokenSigner): ServiceAuthSettings => ({
        serviceName: AUTH_SERVICE_NAME,
        verifier: new TokenVerifier(signer.keyProvider()),
      }),
      inject: [TOKEN_SIGNER],
    },
    {
      provide: SERVICE_TOKEN_PROVIDER,
      useFactory: (issue: IssueServiceTokenUseCase, config: ConfigService) =>
        new ServiceTokenProvider(
          new LocalServiceTokenSource(
            issue,
            config.getOrThrow<string>('SERVICE_CLIENT_ID'),
            config.getOrThrow<string>('SERVICE_CLIENT_SECRET'),
          ),
        ),
      inject: [IssueServiceTokenUseCase, ConfigService],
    },
    {
      provide: IssueServiceTokenUseCase,
      useFactory: (
        clients: ServiceClientRepository,
        signer: TokenSigner,
        settings: TokenSettings,
      ) => new IssueServiceTokenUseCase(clients, signer, settings.serviceTokenTtlSeconds),
      inject: [SERVICE_CLIENT_REPOSITORY, TOKEN_SIGNER, TOKEN_SETTINGS],
    },
    {
      provide: GetJwksUseCase,
      useFactory: (signer: TokenSigner) => new GetJwksUseCase(signer),
      inject: [TOKEN_SIGNER],
    },
    {
      provide: BootstrapServiceClientsUseCase,
      useFactory: (clients: ServiceClientRepository) => new BootstrapServiceClientsUseCase(clients),
      inject: [SERVICE_CLIENT_REPOSITORY],
    },
    {
      provide: TokenIssuer,
      useFactory: (
        refreshTokens: RefreshTokenRepository,
        signer: TokenSigner,
        settings: TokenSettings,
      ) => new TokenIssuer(refreshTokens, signer, settings),
      inject: [REFRESH_TOKEN_REPOSITORY, TOKEN_SIGNER, TOKEN_SETTINGS],
    },
    {
      provide: RegisterStudentUseCase,
      useFactory: (accounts: AccountRepository, students: StudentProfileClient) =>
        new RegisterStudentUseCase(accounts, students),
      inject: [ACCOUNT_REPOSITORY, STUDENT_PROFILE_CLIENT],
    },
    {
      provide: CredentialsAuthenticator,
      useFactory: (accounts: AccountRepository) => new CredentialsAuthenticator(accounts),
      inject: [ACCOUNT_REPOSITORY],
    },
    {
      provide: LoginStudentUseCase,
      useFactory: (
        authenticator: CredentialsAuthenticator,
        tokens: TokenIssuer,
        students: StudentProfileClient,
      ) => new LoginStudentUseCase(authenticator, tokens, students),
      inject: [CredentialsAuthenticator, TokenIssuer, STUDENT_PROFILE_CLIENT],
    },
    ...[LoginInstructorUseCase, LoginAdminUseCase].map((useCase) => ({
      provide: useCase,
      useFactory: (authenticator: CredentialsAuthenticator, tokens: TokenIssuer) =>
        new useCase(authenticator, tokens),
      inject: [CredentialsAuthenticator, TokenIssuer],
    })),
    {
      provide: RefreshTokenUseCase,
      useFactory: (refreshTokens: RefreshTokenRepository, tokens: TokenIssuer) =>
        new RefreshTokenUseCase(refreshTokens, tokens),
      inject: [REFRESH_TOKEN_REPOSITORY, TokenIssuer],
    },
    ...[CreateAccountUseCase, GetCurrentAccountUseCase, ListAccountsUseCase].map((useCase) => ({
      provide: useCase,
      useFactory: (accounts: AccountRepository) => new useCase(accounts),
      inject: [ACCOUNT_REPOSITORY],
    })),
    {
      provide: BootstrapAccountsUseCase,
      useFactory: (accounts: AccountRepository, students: StudentProfileClient) =>
        new BootstrapAccountsUseCase(accounts, students),
      inject: [ACCOUNT_REPOSITORY, STUDENT_PROFILE_CLIENT],
    },
  ],
})
export class AppModule {}
