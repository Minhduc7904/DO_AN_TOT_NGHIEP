import { AppError } from '@aiops-lms/common/errors';

import type {
  BackgroundJob,
  BackgroundJobRun,
  JobStatus,
  JobType,
  RunStatus,
} from '../../../domain/job.js';
import type { SchedulerUnitOfWork } from '../../ports/unit-of-work.js';

async function requireJob(uow: SchedulerUnitOfWork, jobId: string): Promise<BackgroundJob> {
  const job = await uow.stores.jobs.findById(jobId);
  if (!job) throw AppError.notFound('Không tìm thấy job');
  return job;
}

export class ListJobsUseCase {
  constructor(private readonly uow: SchedulerUnitOfWork) {}

  execute(
    filter: { status?: JobStatus | undefined; type?: JobType | undefined },
    page: number,
    pageSize: number,
  ): Promise<{ items: BackgroundJob[]; total: number }> {
    return this.uow.stores.jobs.list(filter, page, pageSize);
  }
}

export class GetJobUseCase {
  constructor(private readonly uow: SchedulerUnitOfWork) {}

  execute(jobId: string): Promise<BackgroundJob> {
    return requireJob(this.uow, jobId);
  }
}

export class ListJobRunsUseCase {
  constructor(private readonly uow: SchedulerUnitOfWork) {}

  async execute(
    jobId: string,
    status: RunStatus | undefined,
    page: number,
    pageSize: number,
  ): Promise<{ items: BackgroundJobRun[]; total: number }> {
    const job = await requireJob(this.uow, jobId);
    return this.uow.stores.runs.list(job.id, { status }, page, pageSize);
  }
}
