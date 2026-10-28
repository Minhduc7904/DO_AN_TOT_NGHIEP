import { AppError } from '@aiops-lms/common/errors';
import type { Clock, IdGenerator } from '@aiops-lms/common/ports';

import { RUN_ERROR_CODES } from '../../../domain/job.js';
import type { JobHandlers } from '../../ports/job-handler.js';
import type { RunOutcome } from '../../ports/repositories.js';
import type { SchedulerUnitOfWork } from '../../ports/unit-of-work.js';

export interface ExecuteNextRunOptions {
  /** Phải dài hơn timeout của handler để lease không hết hạn khi run còn đang chạy. */
  leaseMs: number;
  maxAttempts: number;
  workerInstance: string;
}

const MAX_MESSAGE = 500;

/**
 * Nhận một run bằng lease (`FOR UPDATE SKIP LOCKED`), gọi handler của loại job và ghi kết quả.
 * Worker chết giữa chừng chỉ làm lease hết hạn: run được nhận lại (handler phải idempotent) cho
 * tới `maxAttempts`, sau đó thành `FAILED`/`RUN_LEASE_EXPIRED`.
 */
export class ExecuteNextRunUseCase {
  constructor(
    private readonly uow: SchedulerUnitOfWork,
    private readonly handlers: JobHandlers,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly options: ExecuteNextRunOptions,
  ) {}

  /** `true` nếu đã nhận và xử lý một run (còn việc thì gọi tiếp ngay). */
  async execute(): Promise<boolean> {
    const { runs, jobs } = this.uow.stores;
    await runs.failExhausted(
      this.clock.now(),
      this.options.maxAttempts,
      RUN_ERROR_CODES.leaseExpired,
      'Worker dừng giữa chừng và run đã hết số lần được nhận lại',
    );

    const leaseToken = this.ids.next();
    const run = await runs.claimNext({
      now: this.clock.now(),
      leaseMs: this.options.leaseMs,
      leaseToken,
      workerInstance: this.options.workerInstance,
      maxAttempts: this.options.maxAttempts,
    });
    if (!run) return false;

    const job = await jobs.findById(run.jobId);
    const outcome = job ? await this.run(job.type, run.payloadSnapshot) : missingJob();
    await runs.finish(run.id, leaseToken, outcome, this.clock.now());
    return true;
  }

  private async run(
    type: keyof JobHandlers,
    payload: Record<string, unknown>,
  ): Promise<RunOutcome> {
    try {
      const result = await this.handlers[type].handle(payload);
      return result.failure
        ? {
            status: 'FAILED',
            errorCode: result.failure.code,
            errorMessage: result.failure.message.slice(0, MAX_MESSAGE),
            output: result.output,
          }
        : { status: 'SUCCEEDED', output: result.output };
    } catch (error) {
      // Chỉ mã và thông báo của AppError (đã được soạn an toàn); lỗi khác không lộ chi tiết nội bộ.
      return error instanceof AppError
        ? {
            status: 'FAILED',
            errorCode: error.code,
            errorMessage: error.message.slice(0, MAX_MESSAGE),
          }
        : {
            status: 'FAILED',
            errorCode: RUN_ERROR_CODES.internal,
            errorMessage: 'Lỗi không xác định khi thực thi job',
          };
    }
  }
}

const missingJob = (): RunOutcome => ({
  status: 'FAILED',
  errorCode: RUN_ERROR_CODES.internal,
  errorMessage: 'Không tìm thấy job của run',
});
