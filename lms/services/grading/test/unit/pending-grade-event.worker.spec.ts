import { jest } from '@jest/globals';

import { PendingGradeEventWorker } from '../../src/adapters/messaging/pending-grade-event.worker.js';
import { GradeEventPublishError } from '../../src/application/grade-event-publish-error.js';
import type { GradePublicationCoordinator } from '../../src/application/grade-publication.coordinator.js';
import type { GradePublicationRepository } from '../../src/application/ports/grade-publication-repository.js';
import type { GradeCompletedSnapshot } from '../../src/domain/grade-completed-snapshot.js';

function snapshotOf(index: number): GradeCompletedSnapshot {
  return {
    completedAt: `2026-10-08T00:00:0${index}.000Z`,
    courseId: 'course-001',
    eventId: `00000000-0000-4000-8000-00000000000${index}`,
    gradeId: `10000000-0000-4000-8000-00000000000${index}`,
    principalId: 'student-001',
    score: 90,
    submissionId: `submission-${index}`,
  };
}

describe('PendingGradeEventWorker', () => {
  let pending: GradeCompletedSnapshot[];
  let requestedLimits: number[];
  let publishOutcomes: Map<string, GradeEventPublishError | undefined>;
  let published: string[];
  let listFailure: Error | undefined;
  let worker: PendingGradeEventWorker;

  beforeEach(() => {
    pending = [snapshotOf(1), snapshotOf(2), snapshotOf(3)];
    requestedLimits = [];
    publishOutcomes = new Map();
    published = [];
    listFailure = undefined;
    const repository = {
      countPending: async () => pending.length,
      findPending: async (limit: number) => {
        requestedLimits.push(limit);
        if (listFailure) throw listFailure;
        return pending.slice(0, limit);
      },
    } as unknown as GradePublicationRepository;
    const coordinator = {
      publish: async (snapshot: GradeCompletedSnapshot) => {
        published.push(snapshot.eventId);
        const failure = publishOutcomes.get(snapshot.eventId);
        if (failure) throw failure;
        pending = pending.filter((item) => item.eventId !== snapshot.eventId);
      },
    } as unknown as GradePublicationCoordinator;
    worker = new PendingGradeEventWorker(repository, coordinator, {
      getOrThrow: (key: string) => (key === 'GRADING_EVENT_RETRY_BATCH_SIZE' ? 2 : 1_000),
    } as never);
  });

  afterEach(async () => {
    await worker.stop();
    jest.useRealTimers();
  });

  it('publishes up to one batch of pending events sequentially, oldest first', async () => {
    await worker.runCycle();

    expect(requestedLimits).toEqual([2]);
    expect(published).toEqual([snapshotOf(1).eventId, snapshotOf(2).eventId]);
    expect(pending.map((item) => item.eventId)).toEqual([snapshotOf(3).eventId]);
  });

  it('stops the cycle on a broker failure so the rest is retried by the next cycle', async () => {
    publishOutcomes.set(snapshotOf(1).eventId, new GradeEventPublishError('BROKER_UNAVAILABLE'));

    await worker.runCycle();
    expect(published).toEqual([snapshotOf(1).eventId]);

    publishOutcomes.clear();
    await worker.runCycle();
    expect(published).toEqual([
      snapshotOf(1).eventId,
      snapshotOf(1).eventId,
      snapshotOf(2).eventId,
    ]);
  });

  it('does not let an invalid event block the events behind it', async () => {
    publishOutcomes.set(snapshotOf(1).eventId, new GradeEventPublishError('EVENT_INVALID'));

    await worker.runCycle();

    expect(published).toEqual([snapshotOf(1).eventId, snapshotOf(2).eventId]);
  });

  it('survives a repository failure without throwing', async () => {
    listFailure = Object.assign(new Error('secret-connection-string'), { code: '57P01' });

    await expect(worker.runCycle()).resolves.toBeUndefined();
  });

  it('runs a new cycle only after the previous one finished and stops cleanly', async () => {
    jest.useFakeTimers();
    let release: () => void = () => undefined;
    let cycles = 0;
    const slowRepository = {
      countPending: async () => 0,
      findPending: () => {
        cycles += 1;
        return new Promise<GradeCompletedSnapshot[]>((resolve) => {
          release = () => resolve([]);
        });
      },
    } as unknown as GradePublicationRepository;
    const slow = new PendingGradeEventWorker(
      slowRepository,
      {} as GradePublicationCoordinator,
      {
        getOrThrow: () => 1_000,
      } as never,
    );

    slow.start();
    await jest.advanceTimersByTimeAsync(1_000);
    expect(cycles).toBe(1);
    await jest.advanceTimersByTimeAsync(5_000);
    expect(cycles).toBe(1);

    const stopping = slow.stop();
    release();
    await stopping;
    await jest.advanceTimersByTimeAsync(5_000);
    expect(cycles).toBe(1);
  });
});
