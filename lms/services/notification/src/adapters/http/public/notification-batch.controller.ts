import { CurrentPrincipal, type Page, parseInput, Roles, toPage } from '@aiops-lms/common/http';
import type { Principal } from '@aiops-lms/common/ports';
import {
  type BatchDeliveryStatusDto,
  type BatchSnapshotStatusDto,
  createNotificationBatchRequestSchema,
  type FailedBatchItemDto,
  idSchema,
  listFailedItemsQuerySchema,
  listNotificationBatchesQuerySchema,
  type NotificationBatchDto,
  PUBLIC_PREFIX,
} from '@aiops-lms/contracts';
import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';

import {
  GetBatchDeliveryStatusUseCase,
  GetBatchSnapshotStatusUseCase,
  GetNotificationBatchUseCase,
  ListFailedBatchItemsUseCase,
  ListNotificationBatchesUseCase,
} from '../../../application/use-cases/batches/batch-queries.use-cases.js';
import { CreateNotificationBatchUseCase } from '../../../application/use-cases/batches/create-notification-batch.use-case.js';
import { RetryFailedBatchUseCase } from '../../../application/use-cases/batches/retry-failed-batch.use-case.js';
import {
  presentBatch,
  presentDeliveryStatus,
  presentFailedItem,
  presentSnapshotStatus,
} from '../shared/notification.presenter.js';

@Roles('admin')
@Controller(`${PUBLIC_PREFIX}/notification-batches`)
export class NotificationBatchController {
  constructor(
    @Inject(CreateNotificationBatchUseCase) private readonly create: CreateNotificationBatchUseCase,
    @Inject(ListNotificationBatchesUseCase) private readonly list: ListNotificationBatchesUseCase,
    @Inject(GetNotificationBatchUseCase) private readonly get: GetNotificationBatchUseCase,
    @Inject(GetBatchSnapshotStatusUseCase) private readonly snapshot: GetBatchSnapshotStatusUseCase,
    @Inject(GetBatchDeliveryStatusUseCase) private readonly delivery: GetBatchDeliveryStatusUseCase,
    @Inject(ListFailedBatchItemsUseCase) private readonly failed: ListFailedBatchItemsUseCase,
    @Inject(RetryFailedBatchUseCase) private readonly retry: RetryFailedBatchUseCase,
  ) {}

  @Post()
  async createBatch(
    @CurrentPrincipal() principal: Principal,
    @Body() body: unknown,
  ): Promise<NotificationBatchDto> {
    const input = parseInput(createNotificationBatchRequestSchema, body);
    return presentBatch(
      await this.create.execute(principal.id, {
        title: input.title,
        contentMarkdown: input.content_markdown,
        batchSize: input.batch_size,
      }),
    );
  }

  @Get()
  async listBatches(@Query() query: unknown): Promise<Page<NotificationBatchDto>> {
    const input = parseInput(listNotificationBatchesQuerySchema, query);
    return toPage(
      await this.list.execute(input.status, input.page, input.page_size),
      input,
      presentBatch,
    );
  }

  @Get(':batch_id')
  async getBatch(@Param('batch_id') batchId: string): Promise<NotificationBatchDto> {
    return presentBatch(await this.get.execute(parseInput(idSchema, batchId)));
  }

  @Get(':batch_id/snapshot-status')
  async snapshotStatus(@Param('batch_id') batchId: string): Promise<BatchSnapshotStatusDto> {
    return presentSnapshotStatus(await this.snapshot.execute(parseInput(idSchema, batchId)));
  }

  @Get(':batch_id/delivery-status')
  async deliveryStatus(@Param('batch_id') batchId: string): Promise<BatchDeliveryStatusDto> {
    const result = await this.delivery.execute(parseInput(idSchema, batchId));
    return presentDeliveryStatus(result.batch, result.counts);
  }

  @Get(':batch_id/failed-items')
  async failedItems(
    @Param('batch_id') batchId: string,
    @Query() query: unknown,
  ): Promise<Page<FailedBatchItemDto>> {
    const input = parseInput(listFailedItemsQuerySchema, query);
    const result = await this.failed.execute(
      parseInput(idSchema, batchId),
      input.page,
      input.page_size,
    );
    return toPage(result, input, presentFailedItem);
  }

  @Post(':batch_id/retry-failed')
  async retryFailed(
    @CurrentPrincipal() principal: Principal,
    @Param('batch_id') batchId: string,
  ): Promise<NotificationBatchDto> {
    return presentBatch(await this.retry.execute(principal.id, parseInput(idSchema, batchId)));
  }
}
