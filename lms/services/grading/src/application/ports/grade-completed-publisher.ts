import type { GradeCompletedSnapshot } from '../../domain/grade-completed-snapshot.js';

export abstract class GradeCompletedPublisher {
  /** Resolve chỉ khi broker đã xác nhận (publisher confirm); lỗi được ném dưới dạng `GradeEventPublishError`. */
  abstract publish(snapshot: GradeCompletedSnapshot): Promise<void>;
}
