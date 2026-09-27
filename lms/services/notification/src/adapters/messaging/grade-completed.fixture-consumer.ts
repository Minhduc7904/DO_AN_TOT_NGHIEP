import { gradeCompletedEventSchema, type GradeCompletedEvent } from '@aiops-lms/contracts';

export interface NotificationPreview {
  event_id: string;
  event_name: 'grade.completed';
  schema_version: 1;
  status: 'accepted';
}

export class GradeCompletedFixtureConsumer {
  consume(message: unknown): NotificationPreview {
    const event: GradeCompletedEvent = gradeCompletedEventSchema.parse(message);
    return {
      event_id: event.event_id,
      event_name: event.event_name,
      schema_version: event.schema_version,
      status: 'accepted',
    };
  }
}
