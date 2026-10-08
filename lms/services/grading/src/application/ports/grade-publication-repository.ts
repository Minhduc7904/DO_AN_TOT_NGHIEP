import type { GradeEventPublishErrorCode } from '../grade-event-publish-error.js';
import type { GradeCompletedSnapshot } from '../../domain/grade-completed-snapshot.js';

export abstract class GradePublicationRepository {
  /** Grade `pending`, sắp xếp theo `completed_at` rồi `id`. */
  abstract findPending(limit: number): Promise<GradeCompletedSnapshot[]>;
  abstract countPending(): Promise<number>;
  /** Tăng `publish_attempts` trước mỗi lần publish; trả `false` nếu event không còn `pending`. */
  abstract recordAttempt(eventId: string): Promise<boolean>;
  abstract markPublished(eventId: string): Promise<void>;
  abstract markFailed(eventId: string, code: GradeEventPublishErrorCode): Promise<void>;
}
