import { PUBLIC_PREFIX } from '@aiops-lms/contracts/http';
import {
  createLessonAiJobRequestSchema,
  idSchema,
  type LessonAiDocumentDto,
  type LessonAiJobDetailDto,
  type LessonAiJobDto,
  syncLessonAiDocumentsQuerySchema,
} from '@aiops-lms/contracts';
import { CurrentPrincipal, parseInput, Roles } from '@aiops-lms/common/http';
import type { Principal } from '@aiops-lms/common/ports';
import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query } from '@nestjs/common';

import { CreateLessonAiJobUseCase } from '../../../application/lesson-ai/create-lesson-ai-job.use-case.js';
import { GetLessonAiDocumentsUseCase } from '../../../application/lesson-ai/get-lesson-ai-documents.use-case.js';
import { GetLessonAiJobUseCase } from '../../../application/lesson-ai/get-lesson-ai-job.use-case.js';
import { GetLessonAiJobsUseCase } from '../../../application/lesson-ai/get-lesson-ai-jobs.use-case.js';
import { SyncLessonAiDocumentsUseCase } from '../../../application/lesson-ai/sync-lesson-ai-documents.use-case.js';
import {
  presentLessonAiDocument,
  presentLessonAiJob,
  presentLessonAiJobDetail,
} from '../shared/lesson-ai.presenter.js';

/**
 * Soạn bài học bằng AI: mặt tiền (facade) của `course`. Tài liệu trích xuất và job do `ai` sở hữu và xử lý
 * (`ai-worker`); `course` kiểm tra bài học/quyền, lấy tệp đính kèm từ `media` rồi gọi `ai` qua HTTP nội bộ.
 */
@Roles('admin', 'instructor')
@Controller(`${PUBLIC_PREFIX}/courses/:course_id/lessons/:lesson_id`)
export class LessonAiController {
  constructor(
    @Inject(GetLessonAiDocumentsUseCase) private readonly getDocuments: GetLessonAiDocumentsUseCase,
    @Inject(SyncLessonAiDocumentsUseCase)
    private readonly syncDocuments: SyncLessonAiDocumentsUseCase,
    @Inject(GetLessonAiJobsUseCase) private readonly getJobs: GetLessonAiJobsUseCase,
    @Inject(CreateLessonAiJobUseCase) private readonly createJob: CreateLessonAiJobUseCase,
    @Inject(GetLessonAiJobUseCase) private readonly getJob: GetLessonAiJobUseCase,
  ) {}

  @Get('ai-documents')
  async documents(
    @CurrentPrincipal() principal: Principal,
    @Param('course_id') courseId: string,
    @Param('lesson_id') lessonId: string,
  ): Promise<LessonAiDocumentDto[]> {
    const documents = await this.getDocuments.execute(
      principal,
      parseInput(idSchema, courseId),
      parseInput(idSchema, lessonId),
    );
    return documents.map(presentLessonAiDocument);
  }

  @Post('ai-documents/sync')
  @HttpCode(200)
  async sync(
    @CurrentPrincipal() principal: Principal,
    @Param('course_id') courseId: string,
    @Param('lesson_id') lessonId: string,
    @Query() query: unknown,
  ): Promise<LessonAiDocumentDto[]> {
    const input = parseInput(syncLessonAiDocumentsQuerySchema, query);
    const documents = await this.syncDocuments.execute(
      principal,
      parseInput(idSchema, courseId),
      parseInput(idSchema, lessonId),
      { retryFailed: input.retry_failed },
    );
    return documents.map(presentLessonAiDocument);
  }

  @Get('ai-jobs')
  async jobs(
    @CurrentPrincipal() principal: Principal,
    @Param('course_id') courseId: string,
    @Param('lesson_id') lessonId: string,
  ): Promise<LessonAiJobDto[]> {
    const jobs = await this.getJobs.execute(
      principal,
      parseInput(idSchema, courseId),
      parseInput(idSchema, lessonId),
    );
    return jobs.map(presentLessonAiJob);
  }

  /** `202 Accepted`: job được xếp hàng, `ai-worker` ghi kết quả vào bài học. */
  @Post('ai-jobs')
  @HttpCode(202)
  async create(
    @CurrentPrincipal() principal: Principal,
    @Param('course_id') courseId: string,
    @Param('lesson_id') lessonId: string,
    @Body() body: unknown,
  ): Promise<LessonAiJobDto> {
    const input = parseInput(createLessonAiJobRequestSchema, body);
    return presentLessonAiJob(
      await this.createJob.execute(
        principal,
        parseInput(idSchema, courseId),
        parseInput(idSchema, lessonId),
        {
          jobType: input.job_type,
          mediaIds: input.media_ids,
          questionCount: input.question_count,
          overwriteContent: input.overwrite_content,
        },
      ),
    );
  }

  @Get('ai-jobs/:job_id')
  async job(
    @CurrentPrincipal() principal: Principal,
    @Param('course_id') courseId: string,
    @Param('lesson_id') lessonId: string,
    @Param('job_id') jobId: string,
  ): Promise<LessonAiJobDetailDto> {
    return presentLessonAiJobDetail(
      await this.getJob.execute(
        principal,
        parseInput(idSchema, courseId),
        parseInput(idSchema, lessonId),
        parseInput(idSchema, jobId),
      ),
    );
  }
}
