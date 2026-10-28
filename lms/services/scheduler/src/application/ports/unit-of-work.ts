import type { JobRepository, RunRepository } from './repositories.js';

export interface SchedulerStores {
  jobs: JobRepository;
  runs: RunRepository;
}

export const SCHEDULER_UNIT_OF_WORK = Symbol('SCHEDULER_UNIT_OF_WORK');

export interface SchedulerUnitOfWork {
  /** Truy cập ngoài transaction (đọc, hoặc ghi đơn lẻ). */
  readonly stores: SchedulerStores;
  /** Chạy `work` trong một transaction; mọi store trong `work` cùng commit hoặc cùng rollback. */
  run<T>(work: (stores: SchedulerStores) => Promise<T>): Promise<T>;
}
