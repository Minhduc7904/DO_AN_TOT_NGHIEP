import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { GradingModule } from './adapters/http/grading/grading.module.js';
import { HealthModule } from './adapters/http/health/health.module.js';
import { validateEnvironment } from './config/env.schema.js';

@Module({
  imports: [
    ConfigModule.forRoot({ cache: true, isGlobal: true, validate: validateEnvironment }),
    HealthModule,
    GradingModule,
  ],
})
export class AppModule {}
