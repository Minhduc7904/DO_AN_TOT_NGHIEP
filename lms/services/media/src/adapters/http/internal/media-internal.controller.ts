import { InternalApi, parseInput, RawResponse } from '@aiops-lms/common/http';
import {
  idSchema,
  listOwnerUsagesQuerySchema,
  type MediaCleanupSummaryDto,
  mediaCleanupRequestSchema,
  queryUsageIdsRequestSchema,
  type MediaUsageUrlDto,
  type OwnerUsageDto,
  type UsageIdsByOwnerDto,
  usageUrlsQuerySchema,
} from '@aiops-lms/contracts';
import { INTERNAL_PREFIX } from '@aiops-lms/contracts/http';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';

import { CleanupMediaUseCase } from '../../../application/use-cases/cleanup/cleanup-media.use-case.js';
import { GetMediaContentUseCase } from '../../../application/use-cases/media/get-media-content.use-case.js';
import { GetMediaUsageUrlsUseCase } from '../../../application/use-cases/usages/get-media-usage-urls.use-case.js';
import { ListOwnerUsagesUseCase } from '../../../application/use-cases/usages/list-owner-usages.use-case.js';
import { QueryUsageIdsUseCase } from '../../../application/use-cases/usages/query-usage-ids.use-case.js';
import { presentCleanupSummary, presentUsageUrl } from '../shared/media.presenter.js';
import { streamMedia } from '../shared/stream-media.js';

/** Bề mặt nội bộ của `media` cho course (usage, byte tài liệu) và scheduler-worker (cleanup); không qua Gateway. */
@Controller(`${INTERNAL_PREFIX}/media`)
export class MediaInternalController {
  constructor(
    @Inject(QueryUsageIdsUseCase) private readonly queryUsageIds: QueryUsageIdsUseCase,
    @Inject(GetMediaUsageUrlsUseCase) private readonly usageUrls: GetMediaUsageUrlsUseCase,
    @Inject(GetMediaContentUseCase) private readonly content: GetMediaContentUseCase,
    @Inject(ListOwnerUsagesUseCase) private readonly ownerUsages: ListOwnerUsagesUseCase,
    @Inject(CleanupMediaUseCase) private readonly cleanup: CleanupMediaUseCase,
  ) {}

  /** Usage id theo owner, ví dụ trước khi course gửi command xóa usage của khóa học. */
  @InternalApi({ scopes: ['media:usage:read'] })
  @Post('usages/ids\\:query')
  @HttpCode(200)
  async usageIds(@Body() body: unknown): Promise<UsageIdsByOwnerDto> {
    const input = parseInput(queryUsageIdsRequestSchema, body);
    const items = await this.queryUsageIds.execute(input.owner_kind, input.owner_ids);
    return { items: items.map((item) => ({ owner_id: item.ownerId, usage_ids: item.usageIds })) };
  }

  @InternalApi({ scopes: ['media:usage:read'] })
  @Get('usages/urls')
  async urls(@Query() query: unknown): Promise<MediaUsageUrlDto[]> {
    const input = parseInput(usageUrlsQuerySchema, query);
    return (await this.usageUrls.execute(input.usage_ids)).map(presentUsageUrl);
  }

  /** Usage của một owner kèm metadata tệp (course liệt kê tệp đính kèm của bài học để trích văn bản). */
  @InternalApi({ scopes: ['media:usage:read'] })
  @Get('usages/by-owner')
  async byOwner(@Query() query: unknown): Promise<OwnerUsageDto[]> {
    const input = parseInput(listOwnerUsagesQuerySchema, query);
    const items = await this.ownerUsages.execute(
      input.owner_kind,
      input.owner_id,
      input.usage_type,
    );
    return items.map(({ usage, media }) => ({
      usage_id: usage.id,
      media_id: media.id,
      position: usage.position,
      original_name: media.originalName,
      mime_type: media.mimeType,
      media_type: media.type,
      size_bytes: media.sizeBytes,
    }));
  }

  /** Dọn media không dùng và phục hồi upload `PENDING` stale (job `MEDIA_UNUSED_CLEANUP`). */
  @InternalApi({ scopes: ['media:cleanup'] })
  @Post('cleanup')
  @HttpCode(200)
  async runCleanup(@Body() body: unknown): Promise<MediaCleanupSummaryDto> {
    const input = parseInput(mediaCleanupRequestSchema, body ?? {});
    const summary = await this.cleanup.execute({
      retentionHours: input.retention_hours,
      pendingGraceMinutes: input.pending_grace_minutes,
      limit: input.limit,
    });
    return presentCleanupSummary(summary);
  }

  /** Byte gốc của media (course dùng để trích văn bản tài liệu cho AI). */
  @InternalApi({ scopes: ['media:content:read'] })
  @RawResponse()
  @Get(':media_id/content')
  async getContent(
    @Param('media_id') mediaId: string,
    @Headers('range') range: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    return streamMedia(await this.content.execute(parseInput(idSchema, mediaId), range), response);
  }
}
