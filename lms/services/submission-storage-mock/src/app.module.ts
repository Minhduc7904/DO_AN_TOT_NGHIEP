import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { HealthModule } from './adapters/http/health/health.module.js';
import { StorageModule } from './adapters/http/storage/storage.module.js';
import { validateEnvironment } from './config/env.schema.js';

@Module({
  imports: [
    ConfigModule.forRoot({ cache: true, isGlobal: true, validate: validateEnvironment }),
    HealthModule,
    StorageModule,
  ],
})
export class AppModule {}
