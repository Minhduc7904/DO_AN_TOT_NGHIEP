import { PUBLIC_PREFIX } from '@aiops-lms/contracts/http';
import { Anonymous, CurrentPrincipal, parseInput } from '@aiops-lms/common/http';
import type { Principal } from '@aiops-lms/common/ports';
import {
  createMediaUsageRequestSchema,
  createMediaUsagesRequestSchema,
  idSchema,
  type MediaJobDto,
  type MediaUsageDto,
  type MediaUsageUrlDto,
  reorderMediaUsagesRequestSchema,
  usageUrlsQuerySchema,
} from '@aiops-lms/contracts';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
} from '@nestjs/common';

import { GetUsageJobStatusUseCase } from '../../../application/use-cases/jobs/media-jobs.use-cases.js';
import {
  CreateMediaUsagesUseCase,
  CreateMediaUsageUseCase,
} from '../../../application/use-cases/usages/create-media-usage.use-case.js';
import { DeleteMediaUsageUseCase } from '../../../application/use-cases/usages/delete-media-usage.use-case.js';
import { GetMediaUsageUrlsUseCase } from '../../../application/use-cases/usages/get-media-usage-urls.use-case.js';
import { ReorderMediaUsagesUseCase } from '../../../application/use-cases/usages/reorder-media-usages.use-case.js';
import { presentJob, presentUsage, presentUsageUrl } from '../shared/media.presenter.js';

@Controller(`${PUBLIC_PREFIX}/media`)
export class MediaUsageController {
  constructor(
    @Inject(CreateMediaUsageUseCase) private readonly createUsage: CreateMediaUsageUseCase,
    @Inject(CreateMediaUsagesUseCase) private readonly createUsages: CreateMediaUsagesUseCase,
    @Inject(ReorderMediaUsagesUseCase) private readonly reorderUsages: ReorderMediaUsagesUseCase,
    @Inject(DeleteMediaUsageUseCase) private readonly deleteUsage: DeleteMediaUsageUseCase,
    @Inject(GetMediaUsageUrlsUseCase) private readonly usageUrls: GetMediaUsageUrlsUseCase,
    @Inject(GetUsageJobStatusUseCase) private readonly jobStatus: GetUsageJobStatusUseCase,
  ) {}

  @Post('usages')
  async create(
    @CurrentPrincipal() principal: Principal,
    @Body() body: unknown,
  ): Promise<MediaUsageDto> {
    const input = parseInput(createMediaUsageRequestSchema, body);
    return presentUsage(
      await this.createUsage.execute(principal, {
        mediaId: input.media_id,
        ownerKind: input.owner_kind,
        ownerId: input.owner_id,
        usageType: input.usage_type,
        position: input.position,
      }),
    );
  }

  @Post('usages/batch')
  async createBatch(
    @CurrentPrincipal() principal: Principal,
    @Body() body: unknown,
  ): Promise<MediaUsageDto[]> {
    const input = parseInput(createMediaUsagesRequestSchema, body);
    const created = await this.createUsages.execute(
      principal,
      input.usages.map((usage) => ({
        mediaId: usage.media_id,
        ownerKind: usage.owner_kind,
        ownerId: usage.owner_id,
        usageType: usage.usage_type,
        position: usage.position,
      })),
    );
    return created.map(presentUsage);
  }

  @Post('usages/reorder')
  @HttpCode(200)
  async reorder(
    @CurrentPrincipal() principal: Principal,
    @Body() body: unknown,
  ): Promise<MediaUsageDto[]> {
    const input = parseInput(reorderMediaUsagesRequestSchema, body);
    const reordered = await this.reorderUsages.execute(principal, {
      ownerKind: input.owner_kind,
      ownerId: input.owner_id,
      usageType: input.usage_type,
      usageIds: input.usage_ids,
    });
    return reordered.map(presentUsage);
  }

  @Delete('usages/:usage_id')
  @HttpCode(204)
  async remove(
    @CurrentPrincipal() principal: Principal,
    @Param('usage_id') usageId: string,
  ): Promise<void> {
    await this.deleteUsage.execute(principal, parseInput(idSchema, usageId));
  }

  /** Công khai: client dựng URL hiển thị từ usage id mà không cần biết media id. */
  @Anonymous()
  @Get('usages/urls')
  async urls(@Query() query: unknown): Promise<MediaUsageUrlDto[]> {
    const input = parseInput(usageUrlsQuerySchema, query);
    return (await this.usageUrls.execute(input.usage_ids)).map(presentUsageUrl);
  }

  @Anonymous()
  @Get('usages/:usage_id/url')
  async url(@Param('usage_id') usageId: string): Promise<MediaUsageUrlDto> {
    return presentUsageUrl(await this.usageUrls.executeOne(parseInput(idSchema, usageId)));
  }

  @Anonymous()
  @Get('usage-jobs/:job_id/status')
  async usageJob(@Param('job_id') jobId: string): Promise<MediaJobDto> {
    return presentJob(await this.jobStatus.execute(parseInput(idSchema, jobId)));
  }
}
