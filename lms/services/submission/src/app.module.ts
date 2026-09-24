import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { HealthModule } from './adapters/http/health/health.module.js';
import { SubmissionModule } from './adapters/http/submission/submission.module.js';
import { validateEnvironment } from './config/env.schema.js';

@Module({
  imports: [
    ConfigModule.forRoot({ cache: true, isGlobal: true, validate: validateEnvironment }),
    HealthModule,
    SubmissionModule,
  ],
})
export class AppModule {}
