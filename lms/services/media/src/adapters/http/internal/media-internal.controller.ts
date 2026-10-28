import { InternalApi, parseInput, RawResponse } from '@aiops-lms/common/http';
import {
  idSchema,
  queryUsageIdsRequestSchema,
  type MediaUsageUrlDto,
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

import { GetMediaContentUseCase } from '../../../application/use-cases/media/get-media-content.use-case.js';
import { GetMediaUsageUrlsUseCase } from '../../../application/use-cases/usages/get-media-usage-urls.use-case.js';
import { QueryUsageIdsUseCase } from '../../../application/use-cases/usages/query-usage-ids.use-case.js';
import { presentUsageUrl } from '../shared/media.presenter.js';
import { streamMedia } from '../shared/stream-media.js';

/** Bề mặt nội bộ của `media` cho course (usage, byte tài liệu); không qua Gateway. */
@Controller(`${INTERNAL_PREFIX}/media`)
export class MediaInternalController {
  constructor(
    @Inject(QueryUsageIdsUseCase) private readonly queryUsageIds: QueryUsageIdsUseCase,
    @Inject(GetMediaUsageUrlsUseCase) private readonly usageUrls: GetMediaUsageUrlsUseCase,
    @Inject(GetMediaContentUseCase) private readonly content: GetMediaContentUseCase,
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
