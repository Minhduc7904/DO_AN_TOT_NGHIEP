import type { Clock, IdGenerator } from '@aiops-lms/common/ports';

import type {
  JobFilter,
  JobRepository,
  NewJob,
  NewRun,
  RunClaimOptions,
  RunFilter,
  RunOutcome,
  RunRepository,
} from '../../src/application/ports/repositories.js';
import type {
  SchedulerStores,
  SchedulerUnitOfWork,
} from '../../src/application/ports/unit-of-work.js';
import type { BackgroundJob, BackgroundJobRun, JobStatus } from '../../src/domain/job.js';

export class FakeClock implements Clock {
  constructor(public current = new Date('2026-10-28T08:00:30.000Z')) {}
  now(): Date {
    return new Date(this.current);
  }
  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

export class SequenceIds implements IdGenerator {
  private n = 0;
  next(): string {
    this.n += 1;
    return `00000000-0000-4000-8000-${String(this.n).padStart(12, '0')}`;
  }
}

export class InMemoryJobs implements JobRepository {
  readonly rows = new Map<string, BackgroundJob>();

  constructor(private readonly clock: Clock) {}

  create(job: NewJob): Promise<BackgroundJob | null> {
    if ([...this.rows.values()].some((row) => row.name === job.name)) return Promise.resolve(null);
    const now = this.clock.now();
    const row: BackgroundJob = { ...job, status: 'ACTIVE', createdAt: now, updatedAt: now };
    this.rows.set(row.id, row);
    return Promise.resolve(row);
  }

  findById(id: string): Promise<BackgroundJob | null> {
    return Promise.resolve(this.rows.get(id) ?? null);
  }

  list(
    filter: JobFilter,
    page: number,
    pageSize: number,
  ): Promise<{ items: BackgroundJob[]; total: number }> {
    const all = [...this.rows.values()].filter(
      (row) =>
        (!filter.status || row.status === filter.status) &&
        (!filter.type || row.type === filter.type),
    );
    return Promise.resolve({
      items: all.slice((page - 1) * pageSize, page * pageSize),
      total: all.length,
    });
  }

  updateStatus(
    id: string,
    status: JobStatus,
    nextRunAt: Date | null,
  ): Promise<BackgroundJob | null> {
    const row = this.rows.get(id);
    if (!row) return Promise.resolve(null);
    const updated = { ...row, status, nextRunAt, updatedAt: this.clock.now() };
    this.rows.set(id, updated);
    return Promise.resolve(updated);
  }

  lockDueCronJobs(now: Date, limit: number): Promise<BackgroundJob[]> {
    return Promise.resolve(
      [...this.rows.values()]
        .filter(
          (row) =>
            row.status === 'ACTIVE' &&
            row.scheduleType === 'CRON' &&
            row.nextRunAt !== null &&
            row.nextRunAt <= now,
        )
        .slice(0, limit),
    );
  }

  setNextRunAt(id: string, nextRunAt: Date | null): Promise<void> {
    const row = this.rows.get(id);
    if (row) this.rows.set(id, { ...row, nextRunAt });
    return Promise.resolve();
  }
}

export class InMemoryRuns implements RunRepository {
  readonly rows = new Map<string, BackgroundJobRun>();

  constructor(
    private readonly clock: Clock,
    private readonly jobs: InMemoryJobs,
  ) {}

  createIdempotent(run: NewRun): Promise<{ run: BackgroundJobRun; created: boolean }> {
    const existing = [...this.rows.values()].find(
      (row) => row.jobId === run.jobId && row.idempotencyKey === run.idempotencyKey,
    );
    if (existing) return Promise.resolve({ run: existing, created: false });
    const now = this.clock.now();
    const row: BackgroundJobRun = {
      ...run,
      status: 'PENDING',
      startedAt: null,
      finishedAt: null,
      attempts: 0,
      leaseToken: null,
      leaseExpiresAt: null,
      workerInstance: null,
      errorCode: null,
      errorMessage: null,
      outputJson: null,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(row.id, row);
    return Promise.resolve({ run: row, created: true });
  }

  findById(jobId: string, runId: string): Promise<BackgroundJobRun | null> {
    const row = this.rows.get(runId);
    return Promise.resolve(row?.jobId === jobId ? row : null);
  }

  findByKey(jobId: string, idempotencyKey: string): Promise<BackgroundJobRun | null> {
    return Promise.resolve(
      [...this.rows.values()].find(
        (row) => row.jobId === jobId && row.idempotencyKey === idempotencyKey,
      ) ?? null,
    );
  }

  list(
    jobId: string,
    filter: RunFilter,
    page: number,
    pageSize: number,
  ): Promise<{ items: BackgroundJobRun[]; total: number }> {
    const all = [...this.rows.values()]
      .filter((row) => row.jobId === jobId && (!filter.status || row.status === filter.status))
      .sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime());
    return Promise.resolve({
      items: all.slice((page - 1) * pageSize, page * pageSize),
      total: all.length,
    });
  }

  claimNext(options: RunClaimOptions): Promise<BackgroundJobRun | null> {
    const live = (run: BackgroundJobRun): boolean =>
      run.status === 'RUNNING' && (run.leaseExpiresAt ?? new Date(0)) >= options.now;
    const claimable = [...this.rows.values()]
      .filter((run) => {
        const job = this.jobs.rows.get(run.jobId);
        if (job?.status !== 'ACTIVE') return false;
        const ready =
          (run.status === 'PENDING' && run.scheduledAt <= options.now) ||
          (run.status === 'RUNNING' &&
            (run.leaseExpiresAt ?? new Date(0)) < options.now &&
            run.attempts < options.maxAttempts);
        if (!ready) return false;
        return (
          job.allowConcurrent ||
          ![...this.rows.values()].some(
            (other) => other.jobId === run.jobId && other.id !== run.id && live(other),
          )
        );
      })
      .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
    const run = claimable[0];
    if (!run) return Promise.resolve(null);
    const claimed: BackgroundJobRun = {
      ...run,
      status: 'RUNNING',
      attempts: run.attempts + 1,
      startedAt: options.now,
      finishedAt: null,
      errorCode: null,
      errorMessage: null,
      leaseToken: options.leaseToken,
      leaseExpiresAt: new Date(options.now.getTime() + options.leaseMs),
      workerInstance: options.workerInstance,
    };
    this.rows.set(run.id, claimed);
    return Promise.resolve(claimed);
  }

  finish(runId: string, leaseToken: string, outcome: RunOutcome, now: Date): Promise<boolean> {
    const run = this.rows.get(runId);
    if (run?.leaseToken !== leaseToken || run.status !== 'RUNNING') return Promise.resolve(false);
    this.rows.set(runId, {
      ...run,
      status: outcome.status,
      finishedAt: now,
      leaseToken: null,
      leaseExpiresAt: null,
      errorCode: outcome.status === 'FAILED' ? outcome.errorCode : null,
      errorMessage: outcome.status === 'FAILED' ? outcome.errorMessage : null,
      outputJson: outcome.output ?? run.outputJson,
    });
    return Promise.resolve(true);
  }

  failExhausted(
    now: Date,
    maxAttempts: number,
    errorCode: string,
    message: string,
  ): Promise<number> {
    let count = 0;
    for (const run of this.rows.values()) {
      if (
        run.status === 'RUNNING' &&
        (run.leaseExpiresAt ?? new Date(0)) < now &&
        run.attempts >= maxAttempts
      ) {
        this.rows.set(run.id, {
          ...run,
          status: 'FAILED',
          finishedAt: now,
          leaseToken: null,
          leaseExpiresAt: null,
          errorCode,
          errorMessage: message,
        });
        count += 1;
      }
    }
    return Promise.resolve(count);
  }

  failPendingOfJob(jobId: string, errorCode: string, message: string, now: Date): Promise<number> {
    let count = 0;
    for (const run of this.rows.values()) {
      if (run.jobId === jobId && run.status === 'PENDING') {
        this.rows.set(run.id, {
          ...run,
          status: 'FAILED',
          finishedAt: now,
          errorCode,
          errorMessage: message,
        });
        count += 1;
      }
    }
    return Promise.resolve(count);
  }
}

export class InMemoryUnitOfWork implements SchedulerUnitOfWork {
  readonly jobs: InMemoryJobs;
  readonly runs: InMemoryRuns;
  readonly stores: SchedulerStores;

  constructor(clock: Clock) {
    this.jobs = new InMemoryJobs(clock);
    this.runs = new InMemoryRuns(clock, this.jobs);
    this.stores = { jobs: this.jobs, runs: this.runs };
  }

  run<T>(work: (stores: SchedulerStores) => Promise<T>): Promise<T> {
    return work(this.stores);
  }
}
