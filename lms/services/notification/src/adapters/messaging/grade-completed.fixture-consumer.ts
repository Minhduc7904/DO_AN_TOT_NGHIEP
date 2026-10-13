import { gradeCompletedEventSchema, type GradeCompletedEvent } from '@aiops-lms/contracts';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  DEFAULT_NOTIFICATION_DEDUP_MAX_EVENT_IDS,
  DEFAULT_NOTIFICATION_DEDUP_TTL_SECONDS,
} from '../../config/app-config.js';

export interface NotificationPreview {
  event_id: string;
  event_name: 'grade.completed';
  schema_version: 1;
  status: 'accepted' | 'duplicate';
}

@Injectable()
export class GradeCompletedFixtureConsumer {
  private readonly maxEventIds: number;
  private readonly processedEventIds = new Map<string, number>();
  private readonly ttlMs: number;

  constructor(@Optional() @Inject(ConfigService) config?: ConfigService) {
    this.maxEventIds =
      config?.get<number>('NOTIFICATION_DEDUP_MAX_EVENT_IDS') ??
      DEFAULT_NOTIFICATION_DEDUP_MAX_EVENT_IDS;
    this.ttlMs =
      (config?.get<number>('NOTIFICATION_DEDUP_TTL_SECONDS') ??
        DEFAULT_NOTIFICATION_DEDUP_TTL_SECONDS) * 1_000;
  }

  consume(message: unknown): NotificationPreview {
    const event: GradeCompletedEvent = gradeCompletedEventSchema.parse(message);
    return this.process(event);
  }

  hasProcessed(eventId: string): boolean {
    const expiresAt = this.processedEventIds.get(eventId);
    if (expiresAt === undefined) return false;
    if (expiresAt > Date.now()) return true;
    this.processedEventIds.delete(eventId);
    return false;
  }

  process(event: GradeCompletedEvent): NotificationPreview {
    const now = Date.now();
    this.pruneExpired(now);
    if ((this.processedEventIds.get(event.event_id) ?? 0) > now) {
      return {
        event_id: event.event_id,
        event_name: event.event_name,
        schema_version: event.schema_version,
        status: 'duplicate',
      };
    }

    while (this.processedEventIds.size >= this.maxEventIds) {
      const oldestEventId = this.processedEventIds.keys().next().value;
      if (oldestEventId === undefined) break;
      this.processedEventIds.delete(oldestEventId);
    }
    this.processedEventIds.set(event.event_id, now + this.ttlMs);
    return {
      event_id: event.event_id,
      event_name: event.event_name,
      schema_version: event.schema_version,
      status: 'accepted',
    };
  }

  private pruneExpired(now: number): void {
    for (const [eventId, expiresAt] of this.processedEventIds) {
      if (expiresAt <= now) this.processedEventIds.delete(eventId);
    }
  }
}
