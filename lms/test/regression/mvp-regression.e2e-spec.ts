import { SpanKind } from '../../packages/observability/src/testing.js';
import request from 'supertest';

import {
  GATEWAY_UPSTREAM_TIMEOUT_MS,
  SUBMISSION_DEPENDENCY_TIMEOUT_MS,
  startTestbed,
  step,
  waitUntil,
  type Testbed,
} from './testbed.js';

const STUDENT_EMAIL = 'student@example.test';
const INSTRUCTOR_EMAIL = 'instructor@example.test';
const PASSWORD = 'example-password';

/** Tạo traceparent riêng cho từng kịch bản để lọc span đúng request. */
function traceparentFor(traceId: string): string {
  return `00-${traceId}-${traceId.slice(0, 16)}-01`;
}

function expectErrorEnvelope(body: unknown, code: string): void {
  expect(body).toMatchObject({ code, details: null });
  expect(body).toEqual(
    expect.objectContaining({
      message: expect.any(String),
      timestamp: expect.any(String),
      trace_id: expect.any(String),
    }),
  );
}

/** Topology tối thiểu của Testbed MVP: sáu business service + Gateway, PostgreSQL, Redis, RabbitMQ. */
const EXPECTED_DEPENDENCIES = [
  'gateway-auth',
  'gateway-course',
  'gateway-enrollment',
  'gateway-submission',
  'gateway-grading',
  'auth-postgres',
  'course-postgres',
  'course-redis',
  'enrollment-course',
  'enrollment-postgres',
  'submission-course',
  'submission-enrollment',
  'submission-storage',
  'submission-postgres',
  'grading-submission',
  'grading-postgres',
  'grading-rabbitmq',
  'notification-rabbitmq',
] as const;

describe('Testbed MVP regression: hai workflow xuyên service, lỗi dependency và telemetry', () => {
  let testbed: Testbed;
  const observedDependencies = new Set<string>();

  beforeAll(async () => {
    testbed = await startTestbed();
  }, 30_000);

  afterAll(async () => {
    await testbed?.stop();
  }, 20_000);

  function gateway(): ReturnType<typeof request> {
    return request(testbed.apps.gateway.getHttpServer());
  }

  async function spansOf(traceId: string) {
    await testbed.telemetry.forceFlush();
    const spans = testbed.spanExporter
      .getFinishedSpans()
      .filter((span) => span.spanContext().traceId === traceId);
    for (const span of spans) {
      const identity = span.attributes.dependency_identity;
      if (typeof identity === 'string') observedDependencies.add(identity);
    }
    return spans;
  }

  async function login(
    workflow: string,
    email: string,
    traceparent?: string,
  ): Promise<{ id: string; token: string }> {
    return step(workflow, `đăng nhập ${email}`, 'gateway → auth', async () => {
      const call = gateway().post('/api/v1/auth/login');
      if (traceparent) call.set('traceparent', traceparent);
      const response = await call.send({ email, password: PASSWORD }).expect(200);
      return {
        id: response.body.data.principal.id as string,
        token: response.body.data.access_token as string,
      };
    });
  }

  /** Bảo đảm student đã ghi danh mà không phụ thuộc thứ tự chạy của các test khác. */
  async function createCourse(
    workflow: string,
    token: string,
    traceparent?: string,
  ): Promise<string> {
    return step(workflow, 'tạo khóa học riêng cho kịch bản', 'gateway → course', async () => {
      const call = gateway()
        .post('/api/v1/courses')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: `Regression ${workflow} ${Date.now()}` });
      if (traceparent) call.set('traceparent', traceparent);
      const response = await call.expect(201);
      return response.body.id as string;
    });
  }

  async function ensureEnrolled(workflow: string, token: string, courseId: string): Promise<void> {
    await step(workflow, 'bảo đảm đã ghi danh', 'gateway → enrollment', async () => {
      const response = await gateway()
        .post('/api/v1/enrollments')
        .set('Authorization', `Bearer ${token}`)
        .send({ course_id: courseId });
      expect([201, 409]).toContain(response.status);
    });
  }

  async function submit(
    workflow: string,
    token: string,
    courseId: string,
    content: string,
  ): Promise<string> {
    return step(workflow, 'nộp bài', 'gateway → submission', async () => {
      const response = await gateway()
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${token}`)
        .send({ content, course_id: courseId })
        .expect(201);
      return response.body.id as string;
    });
  }

  async function setStorageFault(errorMode: 'none' | 'unavailable', latencyMs: number) {
    await request(testbed.apps.storage.getHttpServer())
      .put('/internal/v1/fault')
      .send({ error_mode: errorMode, latency_ms: latencyMs })
      .expect(200);
  }

  async function clearStorageFault(): Promise<void> {
    await request(testbed.apps.storage.getHttpServer()).delete('/internal/v1/fault').expect(200);
  }

  it('W1–W4: login → course → enroll → submit qua Gateway giữ một trace xuyên năm service', async () => {
    const workflow = 'login → course → enroll → submit';
    const traceId = '9a000000000000000000000000000001';
    const traceparent = traceparentFor(traceId);

    const instructor = await login(workflow, INSTRUCTOR_EMAIL);
    const courseId = await createCourse(workflow, instructor.token, traceparent);
    const student = await login(workflow, STUDENT_EMAIL, traceparent);

    await step(workflow, 'xem khóa học', 'gateway → course', async () => {
      await gateway()
        .get(`/api/v1/courses/${courseId}`)
        .set('Authorization', `Bearer ${student.token}`)
        .set('traceparent', traceparent)
        .expect(200)
        .expect(({ body }) => expect(body.id).toBe(courseId));
    });

    const enrollment = await step(workflow, 'ghi danh', 'gateway → enrollment → course', () =>
      gateway()
        .post('/api/v1/enrollments')
        .set('Authorization', `Bearer ${student.token}`)
        .set('traceparent', traceparent)
        .send({ course_id: courseId })
        .expect(201),
    );
    expect(enrollment.body).toMatchObject({ course_id: courseId, principal_id: student.id });

    const submission = await step(
      workflow,
      'nộp bài',
      'gateway → submission → course/enrollment/storage',
      () =>
        gateway()
          .post('/api/v1/submissions')
          .set('Authorization', `Bearer ${student.token}`)
          .set('traceparent', traceparent)
          .send({ content: 'regression-secret-answer', course_id: courseId })
          .expect(201),
    );
    expect(submission.body).toMatchObject({ course_id: courseId, principal_id: student.id });

    await step(workflow, 'đọc lại bài nộp', 'gateway → submission', async () => {
      await gateway()
        .get(`/api/v1/submissions/${submission.body.id as string}`)
        .set('Authorization', `Bearer ${student.token}`)
        .set('traceparent', traceparent)
        .expect(200)
        .expect(({ body }) => expect(body.id).toBe(submission.body.id));
    });

    const spans = await spansOf(traceId);
    const dependencies = new Set(
      spans
        .filter((span) => span.kind === SpanKind.CLIENT)
        .map((span) => span.attributes.dependency_identity),
    );
    for (const identity of [
      'gateway-auth',
      'auth-postgres',
      'gateway-course',
      'course-redis',
      'course-postgres',
      'gateway-enrollment',
      'enrollment-course',
      'enrollment-postgres',
      'gateway-submission',
      'submission-course',
      'submission-enrollment',
      'submission-storage',
      'submission-postgres',
    ]) {
      expect({ identity, observed: dependencies.has(identity) }).toEqual({
        identity,
        observed: true,
      });
    }
    // Server span của Enrollment là con của client span Gateway, tức context được propagate qua HTTP.
    const gatewayEnrollment = spans.find(
      (span) => span.attributes.dependency_identity === 'gateway-enrollment',
    );
    const enrollmentServer = spans.find(
      (span) => span.kind === SpanKind.SERVER && span.name.includes('/api/v1/enrollments'),
    );
    expect(enrollmentServer?.parentSpanContext?.spanId).toBe(
      gatewayEnrollment?.spanContext().spanId,
    );
    expect(JSON.stringify(spans.map((span) => span.attributes))).not.toMatch(
      /example-password|regression-secret-answer|Bearer|root_cause|fault_id/iu,
    );
  });

  it('W5: submit → grade → grade.completed → notification giữ trace qua HTTP và RabbitMQ', async () => {
    const workflow = 'submit → grade → notification';
    const traceId = '9a000000000000000000000000000002';
    const traceparent = traceparentFor(traceId);

    const student = await login(workflow, STUDENT_EMAIL);
    const instructor = await login(workflow, INSTRUCTOR_EMAIL);
    const courseId = await createCourse(workflow, instructor.token);
    await ensureEnrolled(workflow, student.token, courseId);
    const submissionId = await submit(workflow, student.token, courseId, 'regression-grade-answer');

    const grade = await step(workflow, 'chấm điểm', 'gateway → grading → submission', () =>
      gateway()
        .post('/api/v1/grades')
        .set('Authorization', `Bearer ${instructor.token}`)
        .set('traceparent', traceparent)
        .send({ score: 88, submission_id: submissionId })
        .expect(201),
    );
    expect(grade.body).toMatchObject({ score: 88, submission_id: submissionId });

    const event = await step(
      workflow,
      'publish grade.completed',
      'grading → rabbitmq',
      async () => {
        let message: { content: Buffer; properties: { headers: Record<string, unknown> } } | false =
          false;
        await waitUntil(async () => {
          message = await testbed.brokerChannel.get(testbed.eventQueue, { noAck: true });
          return message !== false;
        }, 'event grade.completed trên RabbitMQ');
        const received = message as unknown as {
          content: Buffer;
          properties: { headers: Record<string, unknown> };
        };
        const parsed = JSON.parse(String(received.content));
        expect(parsed).toMatchObject({
          event_name: 'grade.completed',
          payload: { grade_id: grade.body.id, submission_id: submissionId },
          schema_version: 1,
        });
        expect(received.properties.headers.traceparent).toBe(parsed.correlation.traceparent);
        return parsed as { event_id: string };
      },
    );

    await step(workflow, 'Notification consume', 'rabbitmq → notification', () =>
      waitUntil(
        () =>
          testbed.notificationLogs.some(
            (entry) => entry.event_id === event.event_id && entry.outcome === 'accepted',
          ),
        `Notification nhận event ${event.event_id}`,
      ),
    );
    expect(testbed.notificationHasProcessed(event.event_id)).toBe(true);
    expect(
      testbed.notificationLogs.find((entry) => entry.event_id === event.event_id)?.trace_id,
    ).toBe(traceId);

    const spans = await spansOf(traceId);
    const byIdentity = (identity: string) =>
      spans.find((span) => span.attributes.dependency_identity === identity);
    const gradingServer = spans.find(
      (span) => span.kind === SpanKind.SERVER && span.name.includes('/api/v1/grades'),
    );
    const publishSpan = spans.find((span) => span.kind === SpanKind.PRODUCER);
    const consumeSpan = spans.find((span) => span.name === 'rabbitmq consume grade.completed');
    const processSpan = spans.find((span) => span.name === 'notification process grade.completed');

    // Chuỗi cha-con: Gateway → Grading → (Submission, RabbitMQ publish) → consume → process.
    expect(gradingServer?.parentSpanContext?.spanId).toBe(
      byIdentity('gateway-grading')?.spanContext().spanId,
    );
    expect(byIdentity('grading-submission')?.parentSpanContext?.spanId).toBe(
      gradingServer?.spanContext().spanId,
    );
    expect(byIdentity('grading-postgres')).toBeDefined();
    expect(publishSpan?.attributes.dependency_identity).toBe('grading-rabbitmq');
    expect(publishSpan?.parentSpanContext?.spanId).toBe(gradingServer?.spanContext().spanId);
    expect(consumeSpan?.attributes.dependency_identity).toBe('notification-rabbitmq');
    expect(consumeSpan?.parentSpanContext?.spanId).toBe(publishSpan?.spanContext().spanId);
    expect(processSpan?.parentSpanContext?.spanId).toBe(consumeSpan?.spanContext().spanId);

    const metrics = JSON.stringify(testbed.metricExporter.getMetrics());
    for (const metricName of [
      'grading.messaging.publish.count',
      'notification.rabbitmq.consume.count',
      'notification.process.count',
    ]) {
      expect(metrics).toContain(metricName);
    }
    expect(metrics).not.toContain(submissionId);
    expect(metrics).not.toContain(student.id);
  });

  it('topology: sáu business service + Gateway, PostgreSQL, Redis và RabbitMQ đều xuất hiện', () => {
    if (observedDependencies.size === 0) {
      throw new Error(
        'Chưa có span nào được ghi nhận; hai test workflow phía trên phải chạy trước',
      );
    }
    const missing = EXPECTED_DEPENDENCIES.filter((identity) => !observedDependencies.has(identity));
    expect(missing).toEqual([]);
    const services = new Set([...observedDependencies].map((identity) => identity.split('-')[0]));
    for (const service of ['gateway', 'auth', 'course', 'enrollment', 'submission', 'grading']) {
      expect(services.has(service)).toBe(true);
    }
    // Notification chỉ có dependency RabbitMQ (consumer), nên xác nhận riêng.
    expect(observedDependencies.has('notification-rabbitmq')).toBe(true);
  });

  it('timeout HTTP: Storage chậm làm Submission trả DEPENDENCY_TIMEOUT qua Gateway, không retry, rồi phục hồi', async () => {
    const workflow = 'timeout Submission → Storage';
    const traceId = '9a000000000000000000000000000003';
    const student = await login(workflow, STUDENT_EMAIL);
    const instructor = await login(workflow, INSTRUCTOR_EMAIL);
    const courseId = await createCourse(workflow, instructor.token);
    await ensureEnrolled(workflow, student.token, courseId);

    await setStorageFault('none', SUBMISSION_DEPENDENCY_TIMEOUT_MS * 3);
    try {
      const startedAt = Date.now();
      await step(workflow, 'nộp bài khi Storage chậm', 'gateway → submission → storage', () =>
        gateway()
          .post('/api/v1/submissions')
          .set('Authorization', `Bearer ${student.token}`)
          .set('traceparent', traceparentFor(traceId))
          .send({ content: 'timeout-answer', course_id: courseId })
          .expect(504)
          .expect(({ body }) => expectErrorEnvelope(body, 'DEPENDENCY_TIMEOUT')),
      );
      // Lỗi phải đến từ timeout của Submission, không phải chờ hết timeout của Gateway.
      expect(Date.now() - startedAt).toBeLessThan(GATEWAY_UPSTREAM_TIMEOUT_MS);
    } finally {
      await clearStorageFault();
    }

    const spans = await spansOf(traceId);
    // Policy resilience: mỗi request chỉ gọi dependency một lần, không nhân retry.
    expect(
      spans.filter((span) => span.attributes.dependency_identity === 'submission-storage'),
    ).toHaveLength(1);
    expect(
      spans.filter((span) => span.attributes.dependency_identity === 'gateway-submission'),
    ).toHaveLength(1);

    await submit(`${workflow} (phục hồi)`, student.token, courseId, 'timeout-recovered-answer');
  });

  it('dependency unavailable: Storage lỗi làm Submission trả DEPENDENCY_UNAVAILABLE qua Gateway, rồi phục hồi', async () => {
    const workflow = 'unavailable Submission → Storage';
    const student = await login(workflow, STUDENT_EMAIL);
    const instructor = await login(workflow, INSTRUCTOR_EMAIL);
    const courseId = await createCourse(workflow, instructor.token);
    await ensureEnrolled(workflow, student.token, courseId);

    await setStorageFault('unavailable', 0);
    try {
      await step(workflow, 'nộp bài khi Storage lỗi', 'gateway → submission → storage', () =>
        gateway()
          .post('/api/v1/submissions')
          .set('Authorization', `Bearer ${student.token}`)
          .send({ content: 'unavailable-answer', course_id: courseId })
          .expect(503)
          .expect(({ body }) => expectErrorEnvelope(body, 'DEPENDENCY_UNAVAILABLE')),
      );
    } finally {
      await clearStorageFault();
    }

    await submit(`${workflow} (phục hồi)`, student.token, courseId, 'unavailable-recovered-answer');
  });
});
