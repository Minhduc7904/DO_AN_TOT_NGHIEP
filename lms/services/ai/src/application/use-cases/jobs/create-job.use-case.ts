import type { IdGenerator } from '@aiops-lms/common/ports';

import { aiErrors } from '../../../domain/errors.js';
import type { AiJob, AiJobType } from '../../../domain/lesson-ai.js';
import type { AiUnitOfWork } from '../../ports/unit-of-work.js';

export const DEFAULT_QUESTION_COUNT = 10;

export interface CreateJobInput {
  jobType: AiJobType;
  courseId: string;
  lessonId: string;
  mediaIds: readonly string[];
  questionCount: number | undefined;
  overwriteContent: boolean;
  requestedBy: { id: string; role: string };
}

/**
 * Tạo job `PENDING` và gửi `ai.job.run` trong cùng transaction (trả ngay, `ai-worker` chạy nền). Mọi tài
 * liệu phải `EXTRACTED`; mỗi (bài học, loại job) chỉ có một job `PENDING|RUNNING`. Việc bài học thuộc khóa học,
 * quyền của người yêu cầu và kiểm tra `LESSON_CONTENT_EXISTS` đã do `course` làm trước khi gọi.
 */
export class CreateJobUseCase {
  constructor(
    private readonly uow: AiUnitOfWork,
    private readonly ids: IdGenerator,
  ) {}

  execute(input: CreateJobInput): Promise<AiJob> {
    const mediaIds = [...new Set(input.mediaIds)];
    return this.uow.run(async (stores) => {
      const texts = await stores.documents.getTexts(mediaIds);
      const extracted = new Set(
        texts.filter((entry) => entry.status === 'EXTRACTED').map((entry) => entry.mediaId),
      );
      const missing = mediaIds.filter((mediaId) => !extracted.has(mediaId));
      if (missing.length > 0) throw aiErrors.documentsNotExtracted(missing);

      const job = await stores.jobs.create({
        id: this.ids.next(),
        lessonId: input.lessonId,
        courseId: input.courseId,
        jobType: input.jobType,
        mediaIds,
        questionCount:
          input.jobType === 'GENERATE_QUIZ'
            ? (input.questionCount ?? DEFAULT_QUESTION_COUNT)
            : null,
        overwriteContent: input.overwriteContent,
        requestedById: input.requestedBy.id,
        requestedByRole: input.requestedBy.role,
      });
      if (!job) throw aiErrors.jobAlreadyActive();
      await stores.commands.requestJobRun(job.id);
      return job;
    });
  }
}
