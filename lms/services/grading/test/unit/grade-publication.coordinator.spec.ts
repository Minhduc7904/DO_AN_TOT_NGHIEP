import { GradeEventPublishError } from '../../src/application/grade-event-publish-error.js';
import { GradePublicationCoordinator } from '../../src/application/grade-publication.coordinator.js';
import type { GradeCompletedPublisher } from '../../src/application/ports/grade-completed-publisher.js';
import type { GradePublicationRepository } from '../../src/application/ports/grade-publication-repository.js';
import type { GradeCompletedSnapshot } from '../../src/domain/grade-completed-snapshot.js';

describe('GradePublicationCoordinator', () => {
  const snapshot: GradeCompletedSnapshot = {
    completedAt: '2026-10-08T00:00:00.000Z',
    courseId: 'course-001',
    eventId: '11111111-1111-4111-8111-111111111111',
    gradeId: '22222222-2222-4222-8222-222222222222',
    principalId: 'student-001',
    score: 90,
    submissionId: 'submission-001',
  };
  let calls: string[];
  let pending: boolean;
  let publishImpl: (input: GradeCompletedSnapshot) => Promise<void>;
  let repositoryFailure: Error | undefined;
  let coordinator: GradePublicationCoordinator;

  beforeEach(() => {
    calls = [];
    pending = true;
    repositoryFailure = undefined;
    publishImpl = async () => undefined;
    const repository: GradePublicationRepository = {
      countPending: async () => 0,
      findPending: async () => [],
      markFailed: async (eventId, code) => {
        if (repositoryFailure) throw repositoryFailure;
        calls.push(`failed:${eventId}:${code}`);
      },
      markPublished: async (eventId) => {
        calls.push(`published:${eventId}`);
      },
      recordAttempt: async (eventId) => {
        calls.push(`attempt:${eventId}`);
        return pending;
      },
    };
    const publisher: GradeCompletedPublisher = {
      publish: async (input) => {
        calls.push(`publish:${input.eventId}`);
        await publishImpl(input);
      },
    };
    coordinator = new GradePublicationCoordinator(repository, publisher);
  });

  it('records the attempt before publishing and marks the event published afterwards', async () => {
    await coordinator.publish(snapshot);

    expect(calls).toEqual([
      `attempt:${snapshot.eventId}`,
      `publish:${snapshot.eventId}`,
      `published:${snapshot.eventId}`,
    ]);
  });

  it('keeps the event pending with a bounded error code when publishing fails', async () => {
    publishImpl = async () => {
      throw new GradeEventPublishError('PUBLISH_TIMEOUT');
    };

    await expect(coordinator.publish(snapshot)).rejects.toMatchObject({ code: 'PUBLISH_TIMEOUT' });

    expect(calls).toEqual([
      `attempt:${snapshot.eventId}`,
      `publish:${snapshot.eventId}`,
      `failed:${snapshot.eventId}:PUBLISH_TIMEOUT`,
    ]);
  });

  it('classifies an unexpected publisher error as BROKER_UNAVAILABLE without leaking its message', async () => {
    publishImpl = async () => {
      throw new Error('amqp://user:secret@broker');
    };

    const failure = await coordinator.publish(snapshot).catch((error) => error);

    expect(failure).toBeInstanceOf(GradeEventPublishError);
    expect(failure.code).toBe('BROKER_UNAVAILABLE');
    expect(failure.message).not.toContain('secret');
  });

  it('still reports the publish failure when recording the error code also fails', async () => {
    publishImpl = async () => {
      throw new GradeEventPublishError('PUBLISH_NACKED');
    };
    repositoryFailure = new Error('database down');

    await expect(coordinator.publish(snapshot)).rejects.toMatchObject({ code: 'PUBLISH_NACKED' });
  });

  it('retries with the very same event_id after a failure', async () => {
    const seen: string[] = [];
    let fail = true;
    publishImpl = async (input) => {
      seen.push(input.eventId);
      if (fail) throw new GradeEventPublishError('BROKER_UNAVAILABLE');
    };

    await expect(coordinator.publish(snapshot)).rejects.toBeInstanceOf(GradeEventPublishError);
    fail = false;
    await coordinator.publish(snapshot);

    expect(seen).toEqual([snapshot.eventId, snapshot.eventId]);
    expect(calls.at(-1)).toBe(`published:${snapshot.eventId}`);
  });

  it('coalesces concurrent publishes of the same event into one attempt', async () => {
    let release: () => void = () => undefined;
    publishImpl = () => new Promise<void>((resolve) => (release = resolve));

    const first = coordinator.publish(snapshot);
    const second = coordinator.publish(snapshot);
    await new Promise((resolve) => setImmediate(resolve));
    release();
    await Promise.all([first, second]);

    expect(calls.filter((call) => call.startsWith('publish:'))).toHaveLength(1);
    expect(calls.filter((call) => call.startsWith('attempt:'))).toHaveLength(1);
  });

  it('publishes different events independently', async () => {
    await Promise.all([
      coordinator.publish(snapshot),
      coordinator.publish({ ...snapshot, eventId: '33333333-3333-4333-8333-333333333333' }),
    ]);

    expect(calls.filter((call) => call.startsWith('publish:'))).toHaveLength(2);
  });

  it('skips an event that is no longer pending', async () => {
    pending = false;

    await coordinator.publish(snapshot);

    expect(calls).toEqual([`attempt:${snapshot.eventId}`]);
  });
});
