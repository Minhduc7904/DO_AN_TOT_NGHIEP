import { PUBLIC_PREFIX } from '@aiops-lms/contracts/http';
import { type Page, parseInput, Roles, toPage } from '@aiops-lms/common/http';
import {
  listMediaJobsQuerySchema,
  type MediaJobDto,
  type MediaSummaryDto,
} from '@aiops-lms/contracts';
import { Controller, Get, Inject, Query } from '@nestjs/common';

import {
  GetMediaBackgroundJobsUseCase,
  GetMediaSummaryUseCase,
} from '../../../application/use-cases/jobs/media-jobs.use-cases.js';
import { presentJob, presentSummary } from '../shared/media.presenter.js';

@Roles('admin')
@Controller(`${PUBLIC_PREFIX}/media`)
export class MediaAdminController {
  constructor(
    @Inject(GetMediaSummaryUseCase) private readonly summary: GetMediaSummaryUseCase,
    @Inject(GetMediaBackgroundJobsUseCase) private readonly jobs: GetMediaBackgroundJobsUseCase,
  ) {}

  @Get('summary')
  async getSummary(): Promise<MediaSummaryDto> {
    return presentSummary(await this.summary.execute());
  }

  @Get('jobs')
  async getJobs(@Query() query: unknown): Promise<Page<MediaJobDto>> {
    const input = parseInput(listMediaJobsQuerySchema, query);
    const result = await this.jobs.execute(
      { type: input.type, status: input.status },
      input.page,
      input.page_size,
    );
    return toPage(result, input, presentJob);
  }
}
