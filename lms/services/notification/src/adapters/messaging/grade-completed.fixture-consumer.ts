import { gradeCompletedEventSchema, type GradeCompletedEvent } from '@aiops-lms/contracts';

export interface NotificationPreview {
  event_id: string;
  event_name: 'grade.completed';
  schema_version: 1;
  status: 'accepted' | 'duplicate';
}

export class GradeCompletedFixtureConsumer {
  private readonly processedEventIds = new Set<string>();

  consume(message: unknown): NotificationPreview {
    const event: GradeCompletedEvent = gradeCompletedEventSchema.parse(message);
    return this.process(event);
  }

  hasProcessed(eventId: string): boolean {
    return this.processedEventIds.has(eventId);
  }

  process(event: GradeCompletedEvent): NotificationPreview {
    if (this.processedEventIds.has(event.event_id)) {
      return {
        event_id: event.event_id,
        event_name: event.event_name,
        schema_version: event.schema_version,
        status: 'duplicate',
      };
    }

    this.processedEventIds.add(event.event_id);
    return {
      event_id: event.event_id,
      event_name: event.event_name,
      schema_version: event.schema_version,
      status: 'accepted',
    };
  }
}
