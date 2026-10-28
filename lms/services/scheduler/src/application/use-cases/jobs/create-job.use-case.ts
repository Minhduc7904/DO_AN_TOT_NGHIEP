import { AppError } from '@aiops-lms/common/errors';
import type { Clock, IdGenerator } from '@aiops-lms/common/ports';

import { InvalidCronExpressionError, nextCronFire, parseCron } from '../../../domain/cron.js';
import type { BackgroundJob, JobType, JsonObject, ScheduleType } from '../../../domain/job.js';
import type { SchedulerUnitOfWork } from '../../ports/unit-of-work.js';

export interface CreateJobInput {
  name: string;
  type: JobType;
  scheduleType: ScheduleType;
  cronExpression: string | null;
  payload: JsonObject;
  allowConcurrent: boolean;
}

const invalidCron = (message: string): AppError =>
  AppError.validation('Biểu thức CRON không hợp lệ', [{ path: 'cron_expression', message }]);

/** Tạo job `MANUAL` hoặc `CRON`; job CRON có `next_run_at` tính ngay theo UTC. */
export class CreateJobUseCase {
  constructor(
    private readonly uow: SchedulerUnitOfWork,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(adminId: string, input: CreateJobInput): Promise<BackgroundJob> {
    const nextRunAt = input.scheduleType === 'CRON' ? this.firstFire(input.cronExpression) : null;
    const job = await this.uow.stores.jobs.create({
      id: this.ids.next(),
      name: input.name,
      type: input.type,
      scheduleType: input.scheduleType,
      cronExpression: input.scheduleType === 'CRON' ? input.cronExpression : null,
      payload: input.payload,
      allowConcurrent: input.allowConcurrent,
      nextRunAt,
      createdBy: adminId,
    });
    if (!job) throw AppError.conflict('Tên job đã tồn tại', { name: input.name });
    return job;
  }

  private firstFire(expression: string | null): Date {
    try {
      const fire = nextCronFire(parseCron(expression ?? ''), this.clock.now());
      if (!fire) throw invalidCron('Biểu thức không có thời điểm chạy nào trong những năm tới');
      return fire;
    } catch (error) {
      if (error instanceof InvalidCronExpressionError) throw invalidCron(error.message);
      throw error;
    }
  }
}
