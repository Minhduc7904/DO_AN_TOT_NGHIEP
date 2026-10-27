import { COMMON_HTTP_PROVIDERS, HealthController, READINESS_CHECKS } from '@aiops-lms/common/http';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { validateEnvironment } from './config/env.schema.js';
import { StudentController } from './adapters/http/student.controller.js';
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
  controllers: [HealthController, StudentController],
  providers: [
    PrismaService,
    PrismaStudentRepository,
    { provide: STUDENT_REPOSITORY, useExisting: PrismaStudentRepository },
    ...COMMON_HTTP_PROVIDERS,
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
