import { AppError } from '@aiops-lms/common/errors';

import type { MediaJob } from '../../../domain/media.js';
import type { JobFilter, MediaSummary } from '../../ports/repositories.js';
import type { MediaUnitOfWork } from '../../ports/unit-of-work.js';

export class GetUsageJobStatusUseCase {
  constructor(private readonly uow: MediaUnitOfWork) {}

  async execute(jobId: string): Promise<MediaJob> {
    const job = await this.uow.stores.jobs.findById(jobId);
    if (!job) throw AppError.notFound('Không tìm thấy job');
    return job;
  }
}

export class GetMediaSummaryUseCase {
  constructor(private readonly uow: MediaUnitOfWork) {}

  execute(): Promise<MediaSummary> {
    return this.uow.stores.media.summary();
  }
}

export class GetMediaBackgroundJobsUseCase {
  constructor(private readonly uow: MediaUnitOfWork) {}

  execute(
    filter: JobFilter,
    page: number,
    pageSize: number,
  ): Promise<{ items: MediaJob[]; total: number }> {
    return this.uow.stores.jobs.list(filter, page, pageSize);
  }
}
