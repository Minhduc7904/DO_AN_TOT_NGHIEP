import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';

import { AppModule } from './app.module.js';
import { DEFAULT_HOST } from './config/app-config.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.getOrThrow<number>('PORT');

  app.enableShutdownHooks();
  await app.listen(port, DEFAULT_HOST);
}

void bootstrap();
