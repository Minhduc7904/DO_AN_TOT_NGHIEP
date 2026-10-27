import { COMMON_HTTP_PROVIDERS, HealthController, READINESS_CHECKS } from '@aiops-lms/common/http';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { BootstrapAccountsRunner } from './adapters/bootstrap-accounts.runner.js';
import { StudentHttpClient } from './adapters/clients/student-http.client.js';
import { AuthController } from './adapters/http/auth.controller.js';
import { PrismaAccountRepository } from './adapters/persistence/prisma-account.repository.js';
import { PrismaRefreshTokenRepository } from './adapters/persistence/prisma-refresh-token.repository.js';
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
import { TOKEN_SETTINGS, type TokenSettings } from './application/token-settings.js';
import { BootstrapAccountsUseCase } from './application/use-cases/accounts/bootstrap-accounts.use-case.js';
import { CreateAccountUseCase } from './application/use-cases/accounts/create-account.use-case.js';
import { GetCurrentAccountUseCase } from './application/use-cases/accounts/get-current-account.use-case.js';
import { ListAccountsUseCase } from './application/use-cases/accounts/list-accounts.use-case.js';
import { RegisterStudentUseCase } from './application/use-cases/accounts/register-student.use-case.js';
import { LoginUseCase } from './application/use-cases/sessions/login.use-case.js';
import { RefreshTokenUseCase } from './application/use-cases/sessions/refresh-token.use-case.js';
import { validateEnvironment } from './config/env.schema.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment })],
  controllers: [HealthController, AuthController],
  providers: [
    PrismaService,
    PrismaAccountRepository,
    PrismaRefreshTokenRepository,
    StudentHttpClient,
    BootstrapAccountsRunner,
    { provide: ACCOUNT_REPOSITORY, useExisting: PrismaAccountRepository },
    { provide: REFRESH_TOKEN_REPOSITORY, useExisting: PrismaRefreshTokenRepository },
    { provide: STUDENT_PROFILE_CLIENT, useExisting: StudentHttpClient },
    ...COMMON_HTTP_PROVIDERS,
    {
      provide: READINESS_CHECKS,
      useFactory: (accounts: AccountRepository) => ({ postgres: () => accounts.ping() }),
      inject: [ACCOUNT_REPOSITORY],
    },
    {
      provide: TOKEN_SETTINGS,
      useFactory: (config: ConfigService): TokenSettings => ({
        jwtSecret: config.getOrThrow<string>('AUTH_JWT_SECRET'),
        jwtTtlSeconds: config.getOrThrow<number>('AUTH_JWT_TTL_SECONDS'),
        refreshTtlSeconds: config.getOrThrow<number>('AUTH_REFRESH_TTL_SECONDS'),
      }),
      inject: [ConfigService],
    },
    {
      provide: RegisterStudentUseCase,
      useFactory: (accounts: AccountRepository, students: StudentProfileClient) =>
        new RegisterStudentUseCase(accounts, students),
      inject: [ACCOUNT_REPOSITORY, STUDENT_PROFILE_CLIENT],
    },
    {
      provide: LoginUseCase,
      useFactory: (
        accounts: AccountRepository,
        refreshTokens: RefreshTokenRepository,
        settings: TokenSettings,
        students: StudentProfileClient,
      ) => new LoginUseCase(accounts, refreshTokens, settings, students),
      inject: [
        ACCOUNT_REPOSITORY,
        REFRESH_TOKEN_REPOSITORY,
        TOKEN_SETTINGS,
        STUDENT_PROFILE_CLIENT,
      ],
    },
    {
      provide: RefreshTokenUseCase,
      useFactory: (refreshTokens: RefreshTokenRepository, settings: TokenSettings) =>
        new RefreshTokenUseCase(refreshTokens, settings),
      inject: [REFRESH_TOKEN_REPOSITORY, TOKEN_SETTINGS],
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
