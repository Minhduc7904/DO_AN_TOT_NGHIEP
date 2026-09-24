import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Put,
} from '@nestjs/common';
import { z } from 'zod';

import { StorageMockService } from '../../../application/storage-mock.service.js';
import type { StoredObject, StorageFaultControl } from '../../../domain/stored-object.js';

const objectSchema = z.object({ content: z.string().max(1_000_000) }).strict();
const controlSchema = z
  .object({
    error_mode: z.enum(['none', 'unavailable']),
    latency_ms: z.number().int().min(0).max(60_000),
  })
  .strict();

@Controller()
export class StorageController {
  constructor(private readonly storage: StorageMockService) {}

  @Put('api/v1/objects/:object_key')
  @HttpCode(200)
  async put(
    @Param('object_key') objectKey: string,
    @Body() body: unknown,
  ): Promise<{ object_key: string; stored: true; stored_at: string }> {
    if (!objectKey.trim() || objectKey.length > 500) {
      throw new BadRequestException('object_key không hợp lệ');
    }
    const parsed = objectSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Storage payload không hợp lệ');
    const stored = await this.storage.store(objectKey, parsed.data.content);
    return { object_key: stored.object_key, stored: true, stored_at: stored.stored_at };
  }

  @Get('api/v1/objects/:object_key')
  async get(@Param('object_key') objectKey: string): Promise<StoredObject> {
    const stored = await this.storage.get(objectKey);
    if (!stored) throw new NotFoundException('Không tìm thấy object');
    return stored;
  }

  @Put('internal/v1/fault')
  configure(@Body() body: unknown): StorageFaultControl {
    const parsed = controlSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Fault control không hợp lệ');
    return this.storage.configure(parsed.data);
  }

  @Delete('internal/v1/fault')
  reset(): StorageFaultControl {
    return this.storage.reset();
  }
}
