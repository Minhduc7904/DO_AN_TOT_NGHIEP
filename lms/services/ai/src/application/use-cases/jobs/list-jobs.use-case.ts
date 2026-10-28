import { AI_LIMITS, type AiJob } from '../../../domain/lesson-ai.js';
import type { JobRepository } from '../../ports/lesson-ai-repositories.js';

/** Các job gần nhất của bài học (mới trước), không kèm nội dung bài học cũ. */
export class ListJobsUseCase {
  constructor(private readonly jobs: JobRepository) {}

  execute(lessonId: string, limit: number = AI_LIMITS.recentJobs): Promise<AiJob[]> {
    return this.jobs.listRecent(lessonId, Math.min(limit, AI_LIMITS.recentJobs));
  }
}
