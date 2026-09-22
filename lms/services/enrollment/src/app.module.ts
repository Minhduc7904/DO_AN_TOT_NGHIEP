import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { EnrollmentModule } from './adapters/http/enrollment/enrollment.module.js';
import { HealthModule } from './adapters/http/health/health.module.js';
import { validateEnvironment } from './config/env.schema.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      isGlobal: true,
      validate: validateEnvironment,
    }),
    HealthModule,
    EnrollmentModule,
  ],
})
export class AppModule {}
