import { GradeEventPublishError } from './grade-event-publish-error.js';
import { GradeCompletedPublisher } from './ports/grade-completed-publisher.js';
import { GradePublicationRepository } from './ports/grade-publication-repository.js';
import type { GradeCompletedSnapshot } from '../domain/grade-completed-snapshot.js';

/**
 * Điều phối một lần publish cho từng `event_id`. Request path và background worker dùng chung
 * coordinator nên trong một process không bao giờ publish đồng thời cùng một event.
 */
export class GradePublicationCoordinator {
  private readonly inFlight = new Map<string, Promise<void>>();

  constructor(
    private readonly repository: GradePublicationRepository,
    private readonly publisher: GradeCompletedPublisher,
  ) {}

  /** Resolve khi event đã `published`; reject khi attempt này thất bại (event vẫn `pending`). */
  publish(snapshot: GradeCompletedSnapshot): Promise<void> {
    const existing = this.inFlight.get(snapshot.eventId);
    if (existing) return existing;
    const attempt = this.attempt(snapshot).finally(() => this.inFlight.delete(snapshot.eventId));
    this.inFlight.set(snapshot.eventId, attempt);
    return attempt;
  }

  private async attempt(snapshot: GradeCompletedSnapshot): Promise<void> {
    if (!(await this.repository.recordAttempt(snapshot.eventId))) return;
    try {
      await this.publisher.publish(snapshot);
    } catch (error) {
      const failure =
        error instanceof GradeEventPublishError
          ? error
          : new GradeEventPublishError('BROKER_UNAVAILABLE');
      await this.repository.markFailed(snapshot.eventId, failure.code).catch(() => undefined);
      throw failure;
    }
    // Nếu bước này lỗi, event vẫn `pending` và sẽ được publish lại (duplicate cùng event_id, hợp lệ at-least-once).
    await this.repository.markPublished(snapshot.eventId);
  }
}
