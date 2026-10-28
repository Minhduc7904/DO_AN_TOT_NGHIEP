import type { Clock, IdGenerator } from '@aiops-lms/common/ports';

import { nextCronFire, parseCron } from '../../../domain/cron.js';
import { cronIdempotencyKey } from '../../../domain/job.js';
import type { SchedulerUnitOfWork } from '../../ports/unit-of-work.js';

/**
 * Tạo run `CRON` cho job đến hạn rồi dời `next_run_at` sang mốc kế tiếp (sau bây giờ, theo UTC).
 *
 * An toàn khi chạy lặp và nhiều instance: dòng job bị khóa `SKIP LOCKED` nên mỗi job chỉ một
 * instance xử lý tại một thời điểm, và khóa lũy đẳng `cron:<job_id>:<scheduled_at>` chặn tạo trùng
 * kể cả khi `next_run_at` bị đặt lại. Worker ngừng lâu chỉ chạy bù **một** lần cho mốc đến hạn
 * (không dồn cả loạt mốc đã lỡ).
 */
export class TickCronJobsUseCase {
  constructor(
    private readonly uow: SchedulerUnitOfWork,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly batchSize: number,
  ) {}

  /** Trả số run mới được tạo. */
  execute(): Promise<number> {
    return this.uow.run(async (stores) => {
      const now = this.clock.now();
      const due = await stores.jobs.lockDueCronJobs(now, this.batchSize);
      let created = 0;
      for (const job of due) {
        const scheduledAt = job.nextRunAt ?? now;
        const result = await stores.runs.createIdempotent({
          id: this.ids.next(),
          jobId: job.id,
          triggerType: 'CRON',
          idempotencyKey: cronIdempotencyKey(job.id, scheduledAt),
          payloadSnapshot: job.payload,
          scheduledAt,
          createdBy: null,
        });
        if (result.created) created += 1;
        await stores.jobs.setNextRunAt(job.id, this.nextFire(job.cronExpression, now));
      }
      return created;
    });
  }

  /** Cron hỏng (không nên xảy ra vì đã kiểm lúc tạo) thì dừng lịch của job thay vì lặp lỗi. */
  private nextFire(expression: string | null, after: Date): Date | null {
    try {
      return expression ? nextCronFire(parseCron(expression), after) : null;
    } catch {
      return null;
    }
  }
}
