import { AppError } from '@aiops-lms/common/errors';
import type { Clock, IdGenerator } from '@aiops-lms/common/ports';

import type { BackgroundJobRun } from '../../../domain/job.js';
import { schedulerErrors } from '../../../domain/errors.js';
import type { SchedulerUnitOfWork } from '../../ports/unit-of-work.js';

export interface TriggerJobRunResult {
  run: BackgroundJobRun;
  /** `false` khi `idempotency_key` đã có run: trả lại run đó, không tạo run thứ hai. */
  created: boolean;
}

/**
 * Tạo run `MANUAL` cho job `ACTIVE`. Cùng `(job, idempotency_key)` luôn trả về cùng một run (kể cả
 * khi job đã bị tạm dừng sau đó); `scheduler-worker` nhận run bằng lease và thực thi.
 */
export class TriggerJobRunUseCase {
  constructor(
    private readonly uow: SchedulerUnitOfWork,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(
    adminId: string,
    jobId: string,
    idempotencyKey: string,
  ): Promise<TriggerJobRunResult> {
    const { jobs, runs } = this.uow.stores;
    const job = await jobs.findById(jobId);
    if (!job) throw AppError.notFound('Không tìm thấy job');
    if (job.status !== 'ACTIVE') {
      const existing = await runs.findByKey(job.id, idempotencyKey);
      if (existing) return { run: existing, created: false };
      throw schedulerErrors.jobNotActive(job.status);
    }
    return runs.createIdempotent({
      id: this.ids.next(),
      jobId: job.id,
      triggerType: 'MANUAL',
      idempotencyKey,
      payloadSnapshot: job.payload,
      scheduledAt: this.clock.now(),
      createdBy: adminId,
    });
  }
}
