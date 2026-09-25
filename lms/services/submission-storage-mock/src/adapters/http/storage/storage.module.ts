import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { StorageMockService } from '../../../application/storage-mock.service.js';
import { StorageController } from './storage.controller.js';

@Module({
  controllers: [StorageController],
  providers: [
    {
      provide: StorageMockService,
      inject: [ConfigService],
      useFactory: (config: ConfigService): StorageMockService =>
        new StorageMockService({
          error_mode: config.getOrThrow<'none' | 'unavailable'>('STORAGE_MOCK_DEFAULT_ERROR_MODE'),
          latency_ms: config.getOrThrow<number>('STORAGE_MOCK_DEFAULT_LATENCY_MS'),
        }),
    },
  ],
})
export class StorageModule {}
