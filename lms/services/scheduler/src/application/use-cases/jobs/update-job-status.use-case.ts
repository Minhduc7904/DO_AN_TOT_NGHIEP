import { AppError } from '@aiops-lms/common/errors';
import type { Clock } from '@aiops-lms/common/ports';

import { nextCronFire, parseCron } from '../../../domain/cron.js';
import { type BackgroundJob, type JobStatus, RUN_ERROR_CODES } from '../../../domain/job.js';
import type { SchedulerUnitOfWork } from '../../ports/unit-of-work.js';

/**
 * Đổi trạng thái job. `ACTIVE` từ trạng thái khác tính lại `next_run_at` từ bây giờ (không chạy bù
 * lúc tạm dừng); `PAUSED`/`DISABLED` xóa `next_run_at`. `DISABLED` còn đóng các run `PENDING`
 * (`FAILED`/`JOB_DISABLED`) để không treo; run `PAUSED` giữ nguyên chờ chạy tiếp khi `ACTIVE`.
 */
export class UpdateJobStatusUseCase {
  constructor(
    private readonly uow: SchedulerUnitOfWork,
    private readonly clock: Clock,
  ) {}

  execute(jobId: string, status: JobStatus): Promise<BackgroundJob> {
    return this.uow.run(async (stores) => {
      const job = await stores.jobs.findById(jobId);
      if (!job) throw AppError.notFound('Không tìm thấy job');
      if (job.status === status) return job;

      const now = this.clock.now();
      const nextRunAt =
        status === 'ACTIVE' && job.scheduleType === 'CRON' && job.cronExpression
          ? nextCronFire(parseCron(job.cronExpression), now)
          : null;
      const updated = await stores.jobs.updateStatus(jobId, status, nextRunAt);
      if (!updated) throw AppError.notFound('Không tìm thấy job');
      if (status === 'DISABLED') {
        await stores.runs.failPendingOfJob(
          jobId,
          RUN_ERROR_CODES.jobDisabled,
          'Job đã bị vô hiệu hóa trước khi run được thực thi',
          now,
        );
      }
      return updated;
    });
  }
}
