import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AuthService } from '../../../application/auth.service.js';
import { AuthRepository } from '../../../application/ports/auth-repository.js';
import { PostgresAuthRepository } from '../../persistence/postgres-auth.repository.js';
import { AuthController } from './auth.controller.js';

@Module({
  controllers: [AuthController],
  providers: [
    PostgresAuthRepository,
    { provide: AuthRepository, useExisting: PostgresAuthRepository },
    {
      provide: AuthService,
      inject: [AuthRepository, ConfigService],
      useFactory: (repository: AuthRepository, config: ConfigService): AuthService =>
        new AuthService(repository, {
          jwtSecret: config.getOrThrow<string>('AUTH_JWT_SECRET'),
          jwtTtlSeconds: config.getOrThrow<number>('AUTH_JWT_TTL_SECONDS'),
          refreshTtlSeconds: config.getOrThrow<number>('AUTH_REFRESH_TTL_SECONDS'),
        }),
    },
  ],
})
export class AuthModule {}
