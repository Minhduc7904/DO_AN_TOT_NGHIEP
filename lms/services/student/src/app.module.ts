import { createHttpServiceAuth, SERVICE_AUTH } from '@aiops-lms/common/auth';
import { COMMON_HTTP_PROVIDERS, HealthController, READINESS_CHECKS } from '@aiops-lms/common/http';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { StudentInternalController } from './adapters/http/internal/student-lookup.controller.js';
import { StudentController } from './adapters/http/public/student.controller.js';
import { STUDENT_SERVICE_NAME } from './config/app-config.js';
import { validateEnvironment } from './config/env.schema.js';
import { PrismaStudentRepository } from './adapters/persistence/prisma-student.repository.js';
import { PrismaService } from './adapters/persistence/prisma.service.js';
import {
  STUDENT_REPOSITORY,
  type StudentRepository,
} from './application/ports/student-repository.js';
import { CreateStudentUseCase } from './application/use-cases/students/create-student.use-case.js';
import { GetStudentUseCase } from './application/use-cases/students/get-student.use-case.js';
import { ListStudentsUseCase } from './application/use-cases/students/list-students.use-case.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment })],
  controllers: [HealthController, StudentController, StudentInternalController],
  providers: [
    PrismaService,
    PrismaStudentRepository,
    { provide: STUDENT_REPOSITORY, useExisting: PrismaStudentRepository },
    ...COMMON_HTTP_PROVIDERS,
    {
      provide: SERVICE_AUTH,
      useFactory: (config: ConfigService) =>
        createHttpServiceAuth(STUDENT_SERVICE_NAME, {
          baseUrl: config.getOrThrow<string>('AUTH_BASE_URL'),
          timeoutMs: config.getOrThrow<number>('AUTH_JWKS_TIMEOUT_MS'),
          cacheTtlMs: config.getOrThrow<number>('AUTH_JWKS_CACHE_TTL_MS'),
          minRefetchIntervalMs: config.getOrThrow<number>('AUTH_JWKS_MIN_REFETCH_MS'),
        }),
      inject: [ConfigService],
    },
    {
      provide: READINESS_CHECKS,
      useFactory: (students: StudentRepository) => ({ postgres: () => students.ping() }),
      inject: [STUDENT_REPOSITORY],
    },
    ...[CreateStudentUseCase, GetStudentUseCase, ListStudentsUseCase].map((useCase) => ({
      provide: useCase,
      useFactory: (students: StudentRepository) => new useCase(students),
      inject: [STUDENT_REPOSITORY],
    })),
  ],
})
export class AppModule {}
