import type {
  LessonAiDocumentDto,
  LessonAiJobDetailDto,
  LessonAiJobDto,
} from '@aiops-lms/contracts';

import type {
  LessonAiDocumentView,
  LessonAiJob,
  LessonAiJobDetail,
} from '../../../domain/lesson-ai.js';

export function presentLessonAiDocument(document: LessonAiDocumentView): LessonAiDocumentDto {
  return {
    media_id: document.mediaId,
    file_name: document.fileName,
    content_type: document.contentType,
    media_type: document.mediaType as LessonAiDocumentDto['media_type'],
    status: document.status,
    error_code: document.errorCode,
    error_message: document.errorMessage,
    text_length: document.textLength,
    updated_at: document.updatedAt?.toISOString() ?? null,
  };
}

export function presentLessonAiJob(job: LessonAiJob): LessonAiJobDto {
  return {
    id: job.id,
    lesson_id: job.lessonId,
    course_id: job.courseId,
    job_type: job.jobType,
    status: job.status,
    media_ids: job.mediaIds,
    question_count: job.questionCount,
    overwrite_content: job.overwriteContent,
    has_previous_content: job.hasPreviousContent,
    result_quiz_id: job.resultQuizId,
    step_count: job.stepCount,
    error_code: job.errorCode,
    error_message: job.errorMessage,
    created_at: job.createdAt.toISOString(),
    updated_at: job.updatedAt.toISOString(),
    started_at: job.startedAt?.toISOString() ?? null,
    finished_at: job.finishedAt?.toISOString() ?? null,
  };
}

export function presentLessonAiJobDetail(detail: LessonAiJobDetail): LessonAiJobDetailDto {
  return {
    job: presentLessonAiJob(detail.job),
    previous_content_markdown: detail.previousContentMarkdown,
  };
}
