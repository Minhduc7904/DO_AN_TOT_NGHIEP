import {
  createGradeCompletedRabbitMqHeaders,
  gradeCompletedEventSchema,
  gradeCompletedRabbitMqHeadersSchema,
  gradeCompletedV1Fixture,
} from '@aiops-lms/contracts';

import { buildGradeCompletedMessage } from '../../src/adapters/messaging/grade-completed-event.factory.js';
import { GradeEventPublishError } from '../../src/application/grade-event-publish-error.js';
import type { GradeCompletedSnapshot } from '../../src/domain/grade-completed-snapshot.js';

describe('grade.completed v1 event mapping', () => {
  const snapshot: GradeCompletedSnapshot = {
    completedAt: '2026-10-08T01:02:03.456Z',
    courseId: 'course-001',
    eventId: '018f4e60-4e21-7d38-b1f4-842d4f2e1234',
    gradeId: '7d1f3a52-0c4e-4b8a-9d36-5a2e8f10c001',
    principalId: 'student-001',
    score: 92.5,
    submissionId: 'submission-001',
  };

  it('maps the snapshot to a strict schema v1 envelope', () => {
    const { event } = buildGradeCompletedMessage(snapshot, '0.1.0-test');

    expect(gradeCompletedEventSchema.parse(event)).toEqual(event);
    expect(event).toMatchObject({
      event_id: snapshot.eventId,
      event_name: 'grade.completed',
      occurred_at: snapshot.completedAt,
      payload: {
        completed_at: snapshot.completedAt,
        course_id: 'course-001',
        grade_id: snapshot.gradeId,
        principal_id: 'student-001',
        score: 92.5,
        submission_id: 'submission-001',
      },
      producer: { service_name: 'grading', service_version: '0.1.0-test' },
      schema_version: 1,
    });
    expect(Object.keys(event.payload).sort()).toEqual(
      Object.keys(gradeCompletedV1Fixture.payload).sort(),
    );
  });

  it('keeps event_id, occurred_at and payload stable across attempts', () => {
    const first = buildGradeCompletedMessage(snapshot, '0.1.0').event;
    const second = buildGradeCompletedMessage(snapshot, '0.1.0').event;

    expect(second.event_id).toBe(first.event_id);
    expect(second.occurred_at).toBe(first.occurred_at);
    expect(second.payload).toEqual(first.payload);
  });

  it('generates headers equal to the envelope correlation, with a valid fallback traceparent', () => {
    const { event, headers } = buildGradeCompletedMessage(snapshot, '0.1.0');

    expect(gradeCompletedRabbitMqHeadersSchema.parse(headers)).toEqual(headers);
    expect(headers).toEqual(createGradeCompletedRabbitMqHeaders(event));
    expect(headers.traceparent).toBe(event.correlation.traceparent);
    expect(headers.traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-00$/u);
    expect(event.correlation.tracestate).toBeNull();
    expect(headers).not.toHaveProperty('tracestate');
  });

  it.each([
    ['score above 100', { score: 100.5 }],
    ['negative score', { score: -1 }],
    ['blank course', { courseId: '  ' }],
    ['non-UTC completion time', { completedAt: '2026-10-08T01:02:03+07:00' }],
    ['non-UUID event id', { eventId: 'evt-grade-001' }],
  ])('rejects an invalid snapshot (%s) as EVENT_INVALID', (_name, override) => {
    expect(() => buildGradeCompletedMessage({ ...snapshot, ...override }, '0.1.0')).toThrow(
      GradeEventPublishError,
    );
  });
});

describe('grade.completed v1 schema strictness', () => {
  it('accepts the published fixture', () => {
    expect(gradeCompletedEventSchema.safeParse(gradeCompletedV1Fixture).success).toBe(true);
  });

  it('rejects missing and unknown envelope or payload fields', () => {
    const withoutId: Record<string, unknown> = { ...gradeCompletedV1Fixture };
    delete withoutId['event_id'];
    const payloadWithoutScore: Record<string, unknown> = { ...gradeCompletedV1Fixture.payload };
    delete payloadWithoutScore['score'];

    expect(gradeCompletedEventSchema.safeParse(withoutId).success).toBe(false);
    expect(
      gradeCompletedEventSchema.safeParse({ ...gradeCompletedV1Fixture, extra: true }).success,
    ).toBe(false);
    expect(
      gradeCompletedEventSchema.safeParse({
        ...gradeCompletedV1Fixture,
        payload: payloadWithoutScore,
      }).success,
    ).toBe(false);
    expect(
      gradeCompletedEventSchema.safeParse({
        ...gradeCompletedV1Fixture,
        payload: { ...gradeCompletedV1Fixture.payload, run_id: 'run-1' },
      }).success,
    ).toBe(false);
    expect(
      gradeCompletedEventSchema.safeParse({
        ...gradeCompletedV1Fixture,
        event_name: 'grade-completed',
      }).success,
    ).toBe(false);
  });
});
