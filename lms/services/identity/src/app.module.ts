import {
  SERVICE_AUTH,
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
import { JwksController } from './adapters/http/open/jwks.controller.js';
import { ServiceAuthController } from './adapters/http/internal/service-auth.controller.js';
import { StudentInternalController } from './adapters/http/internal/student-lookup.controller.js';
import { AuthController } from './adapters/http/public/auth.controller.js';
import { StudentController } from './adapters/http/public/student.controller.js';
import { Ed25519TokenSigner } from './adapters/security/ed25519-token-signer.js';
import { PrismaAccountRepository } from './adapters/persistence/prisma-account.repository.js';
import { PrismaRefreshTokenRepository } from './adapters/persistence/prisma-refresh-token.repository.js';
import { PrismaServiceClientRepository } from './adapters/persistence/prisma-service-client.repository.js';
import { PrismaStudentRepository } from './adapters/persistence/prisma-student.repository.js';
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
  SERVICE_CLIENT_REPOSITORY,
  type ServiceClientRepository,
} from './application/ports/service-client-repository.js';
import {
  STUDENT_REPOSITORY,
  type StudentRepository,
} from './application/ports/student-repository.js';
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
import { GetStudentUseCase } from './application/use-cases/students/get-student.use-case.js';
import { ListStudentsUseCase } from './application/use-cases/students/list-students.use-case.js';
import { IDENTITY_SERVICE_NAME } from './config/app-config.js';
import { validateEnvironment } from './config/env.schema.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment })],
  controllers: [
    HealthController,
    AuthController,
    StudentController,
    StudentInternalController,
    ServiceAuthController,
    JwksController,
  ],
  providers: [
    PrismaService,
    PrismaAccountRepository,
    PrismaRefreshTokenRepository,
    PrismaServiceClientRepository,
    PrismaStudentRepository,
    BootstrapRunner,
    { provide: ACCOUNT_REPOSITORY, useExisting: PrismaAccountRepository },
    { provide: REFRESH_TOKEN_REPOSITORY, useExisting: PrismaRefreshTokenRepository },
    { provide: SERVICE_CLIENT_REPOSITORY, useExisting: PrismaServiceClientRepository },
    { provide: STUDENT_REPOSITORY, useExisting: PrismaStudentRepository },
    ...COMMON_HTTP_PROVIDERS,
    {
      provide: READINESS_CHECKS,
      useFactory: (accounts: AccountRepository) => ({ postgres: () => accounts.ping() }),
      inject: [ACCOUNT_REPOSITORY],
    },
    {
      provide: TOKEN_SETTINGS,
      useFactory: (config: ConfigService): TokenSettings => ({
        jwtTtlSeconds: config.getOrThrow<number>('IDENTITY_JWT_TTL_SECONDS'),
        refreshTtlSeconds: config.getOrThrow<number>('IDENTITY_REFRESH_TTL_SECONDS'),
        serviceTokenTtlSeconds: config.getOrThrow<number>('IDENTITY_SERVICE_TOKEN_TTL_SECONDS'),
      }),
      inject: [ConfigService],
    },
    {
      provide: TOKEN_SIGNER,
      useFactory: (config: ConfigService): Ed25519TokenSigner => {
        const pem = config.get<string | undefined>('IDENTITY_SIGNING_KEY_PEM');
        if (!pem) {
          new Logger('TokenSigner').warn(
            'IDENTITY_SIGNING_KEY_PEM chưa đặt: dùng khóa ký tạm, token mất hiệu lực khi khởi động lại',
          );
        }
        const previous = config.get<string | undefined>('IDENTITY_PREVIOUS_PUBLIC_KEY_PEM');
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
        serviceName: IDENTITY_SERVICE_NAME,
        verifier: new TokenVerifier(signer.keyProvider()),
      }),
      inject: [TOKEN_SIGNER],
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
      useFactory: (accounts: AccountRepository) => new RegisterStudentUseCase(accounts),
      inject: [ACCOUNT_REPOSITORY],
    },
    {
      provide: CredentialsAuthenticator,
      useFactory: (accounts: AccountRepository) => new CredentialsAuthenticator(accounts),
      inject: [ACCOUNT_REPOSITORY],
    },
    {
      provide: LoginStudentUseCase,
      useFactory: (authenticator: CredentialsAuthenticator, tokens: TokenIssuer) =>
        new LoginStudentUseCase(authenticator, tokens),
      inject: [CredentialsAuthenticator, TokenIssuer],
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
      useFactory: (accounts: AccountRepository) => new BootstrapAccountsUseCase(accounts),
      inject: [ACCOUNT_REPOSITORY],
    },
    ...[GetStudentUseCase, ListStudentsUseCase].map((useCase) => ({
      provide: useCase,
      useFactory: (students: StudentRepository) => new useCase(students),
      inject: [STUDENT_REPOSITORY],
    })),
  ],
})
export class AppModule {}
