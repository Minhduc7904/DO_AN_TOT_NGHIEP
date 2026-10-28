import { aiErrors } from '../../../domain/errors.js';
import type { JobDetail, JobRepository } from '../../ports/lesson-ai-repositories.js';

/** Chi tiết một job của bài học, kèm nội dung bài học cũ nếu job đã ghi đè (để khôi phục). */
export class GetJobUseCase {
  constructor(private readonly jobs: JobRepository) {}

  async execute(lessonId: string, jobId: string): Promise<JobDetail> {
    const detail = await this.jobs.find(lessonId, jobId);
    if (!detail) throw aiErrors.jobNotFound();
    return detail;
  }
}
