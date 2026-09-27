import { z } from 'zod';

const traceparentSchema = z.string().regex(/^[0-9a-f]{2}-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/iu);
const utcIsoTimestampSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u);

export const gradeCompletedEventSchema = z
  .object({
    event_id: z.string().uuid(),
    event_name: z.literal('grade.completed'),
    occurred_at: utcIsoTimestampSchema,
    payload: z
      .object({
        grade_id: z.string().trim().min(1).max(128),
        graded_at: utcIsoTimestampSchema,
        score: z.number().finite().min(0).max(100),
        submission_id: z.string().trim().min(1).max(128),
      })
      .strict(),
    producer: z
      .object({
        service_name: z.literal('grading'),
        service_version: z.string().trim().min(1).max(128),
      })
      .strict(),
    schema_version: z.literal('1'),
    trace_context: z
      .object({
        traceparent: traceparentSchema,
        tracestate: z.string().trim().min(1).max(512).optional(),
      })
      .strict(),
  })
  .strict();

export type GradeCompletedEvent = z.infer<typeof gradeCompletedEventSchema>;

export const gradeCompletedV1Fixture: GradeCompletedEvent = {
  event_id: '018f4e60-4e21-7d38-b1f4-842d4f2e1234',
  event_name: 'grade.completed',
  occurred_at: '2026-09-20T09:00:00.000Z',
  payload: {
    grade_id: 'grade-001',
    graded_at: '2026-09-20T09:00:00.000Z',
    score: 92,
    submission_id: 'submission-001',
  },
  producer: {
    service_name: 'grading',
    service_version: '0.1.0',
  },
  schema_version: '1',
  trace_context: {
    traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
    tracestate: 'aiops=grade-completed',
  },
};
