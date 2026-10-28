import { CurrentPrincipal, type Page, parseInput, Roles, toPage } from '@aiops-lms/common/http';
import type { Principal } from '@aiops-lms/common/ports';
import {
  type BackgroundJobDto,
  type BackgroundJobRunDto,
  createJobRequestSchema,
  idSchema,
  listJobRunsQuerySchema,
  listJobsQuerySchema,
  PUBLIC_PREFIX,
  triggerJobRunRequestSchema,
  updateJobStatusRequestSchema,
} from '@aiops-lms/contracts';
import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Res } from '@nestjs/common';

import { CreateJobUseCase } from '../../../application/use-cases/jobs/create-job.use-case.js';
import {
  GetJobUseCase,
  ListJobRunsUseCase,
  ListJobsUseCase,
} from '../../../application/use-cases/jobs/job-queries.use-cases.js';
import { TriggerJobRunUseCase } from '../../../application/use-cases/jobs/trigger-job-run.use-case.js';
import { UpdateJobStatusUseCase } from '../../../application/use-cases/jobs/update-job-status.use-case.js';
import { presentJob, presentRun } from '../shared/scheduler.presenter.js';

/** Phần của `Response` mà controller dùng để đổi status mà vẫn để Nest bọc envelope. */
interface StatusSetter {
  status(code: number): unknown;
}

@Roles('admin')
@Controller(`${PUBLIC_PREFIX}/scheduler/jobs`)
export class SchedulerController {
  constructor(
    @Inject(ListJobsUseCase) private readonly listJobs: ListJobsUseCase,
    @Inject(CreateJobUseCase) private readonly createJob: CreateJobUseCase,
    @Inject(GetJobUseCase) private readonly getJob: GetJobUseCase,
    @Inject(UpdateJobStatusUseCase) private readonly updateStatus: UpdateJobStatusUseCase,
    @Inject(TriggerJobRunUseCase) private readonly triggerRun: TriggerJobRunUseCase,
    @Inject(ListJobRunsUseCase) private readonly listRuns: ListJobRunsUseCase,
  ) {}

  @Get()
  async list(@Query() query: unknown): Promise<Page<BackgroundJobDto>> {
    const input = parseInput(listJobsQuerySchema, query);
    return toPage(
      await this.listJobs.execute(
        { status: input.status, type: input.type },
        input.page,
        input.page_size,
      ),
      input,
      presentJob,
    );
  }

  @Post()
  async create(
    @CurrentPrincipal() principal: Principal,
    @Body() body: unknown,
  ): Promise<BackgroundJobDto> {
    const input = parseInput(createJobRequestSchema, body);
    return presentJob(
      await this.createJob.execute(principal.id, {
        name: input.name,
        type: input.type,
        scheduleType: input.schedule_type,
        cronExpression: input.cron_expression ?? null,
        payload: input.payload,
        allowConcurrent: input.allow_concurrent,
      }),
    );
  }

  @Get(':job_id')
  async get(@Param('job_id') jobId: string): Promise<BackgroundJobDto> {
    return presentJob(await this.getJob.execute(parseInput(idSchema, jobId)));
  }

  @Patch(':job_id')
  async patchStatus(
    @Param('job_id') jobId: string,
    @Body() body: unknown,
  ): Promise<BackgroundJobDto> {
    const input = parseInput(updateJobStatusRequestSchema, body);
    return presentJob(await this.updateStatus.execute(parseInput(idSchema, jobId), input.status));
  }

  /** 201 khi tạo run mới, 200 khi `idempotency_key` đã có run (trả lại run đó). */
  @Post(':job_id/runs')
  async trigger(
    @CurrentPrincipal() principal: Principal,
    @Param('job_id') jobId: string,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: StatusSetter,
  ): Promise<BackgroundJobRunDto> {
    const input = parseInput(triggerJobRunRequestSchema, body);
    const { run, created } = await this.triggerRun.execute(
      principal.id,
      parseInput(idSchema, jobId),
      input.idempotency_key,
    );
    if (!created) response.status(200);
    return presentRun(run);
  }

  @Get(':job_id/runs')
  async runs(
    @Param('job_id') jobId: string,
    @Query() query: unknown,
  ): Promise<Page<BackgroundJobRunDto>> {
    const input = parseInput(listJobRunsQuerySchema, query);
    return toPage(
      await this.listRuns.execute(
        parseInput(idSchema, jobId),
        input.status,
        input.page,
        input.page_size,
      ),
      input,
      presentRun,
    );
  }
}
