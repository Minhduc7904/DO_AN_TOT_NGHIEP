import { InternalApi, parseInput } from '@aiops-lms/common/http';
import {
  createAiJobRequestSchema,
  getAiJobQuerySchema,
  idSchema,
  INTERNAL_PREFIX,
  type LessonAiJobDetailDto,
  type LessonAiJobDto,
  listAiJobsQuerySchema,
} from '@aiops-lms/contracts';
import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query } from '@nestjs/common';

import { CreateJobUseCase } from '../../../application/use-cases/jobs/create-job.use-case.js';
import { GetJobUseCase } from '../../../application/use-cases/jobs/get-job.use-case.js';
import { ListJobsUseCase } from '../../../application/use-cases/jobs/list-jobs.use-case.js';
import { presentJob, presentJobDetail } from '../shared/lesson-ai.presenter.js';

/** Job AI cho course; không qua Gateway. `course` đã kiểm tra quyền, `ai` nhận người yêu cầu tường minh. */
@Controller(`${INTERNAL_PREFIX}/ai/jobs`)
export class AiJobsController {
  constructor(
    @Inject(CreateJobUseCase) private readonly createJob: CreateJobUseCase,
    @Inject(ListJobsUseCase) private readonly listJobs: ListJobsUseCase,
    @Inject(GetJobUseCase) private readonly getJob: GetJobUseCase,
  ) {}

  /** `202 Accepted`: job được xếp hàng, kết quả do `ai-worker` ghi vào course. */
  @InternalApi({ scopes: ['ai:job:write'] })
  @Post()
  @HttpCode(202)
  async create(@Body() body: unknown): Promise<LessonAiJobDto> {
    const input = parseInput(createAiJobRequestSchema, body);
    return presentJob(
      await this.createJob.execute({
        jobType: input.job_type,
        courseId: input.course_id,
        lessonId: input.lesson_id,
        mediaIds: input.media_ids,
        questionCount: input.question_count,
        overwriteContent: input.overwrite_content,
        requestedBy: input.requested_by,
      }),
    );
  }

  @InternalApi({ scopes: ['ai:job:read'] })
  @Get()
  async list(@Query() query: unknown): Promise<LessonAiJobDto[]> {
    const input = parseInput(listAiJobsQuerySchema, query);
    return (await this.listJobs.execute(input.lesson_id, input.limit)).map(presentJob);
  }

  @InternalApi({ scopes: ['ai:job:read'] })
  @Get(':job_id')
  async get(
    @Param('job_id') jobId: string,
    @Query() query: unknown,
  ): Promise<LessonAiJobDetailDto> {
    const input = parseInput(getAiJobQuerySchema, query);
    return presentJobDetail(
      await this.getJob.execute(input.lesson_id, parseInput(idSchema, jobId)),
    );
  }
}
