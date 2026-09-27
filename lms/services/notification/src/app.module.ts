import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { HealthModule } from './adapters/http/health/health.module.js';
import { NotificationModule } from './adapters/messaging/notification.module.js';
import { validateEnvironment } from './config/env.schema.js';

@Module({
  imports: [
    ConfigModule.forRoot({ cache: true, isGlobal: true, validate: validateEnvironment }),
    HealthModule,
    NotificationModule,
  ],
})
export class AppModule {}
