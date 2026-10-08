import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';

import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { createHttpTelemetryMiddleware, startTelemetry } from '@aiops-lms/observability';
import {
  InMemoryMetricExporter,
  InMemorySpanExporter,
  PeriodicExportingMetricReader,
  SimpleSpanProcessor,
  SpanKind,
  SpanStatusCode,
} from '@aiops-lms/observability/testing';

const spanExporter = new InMemorySpanExporter();
const metricExporter = new InMemoryMetricExporter();
const telemetry = startTelemetry(
  {
    enabled: true,
    otlpTracesEndpoint: 'http://127.0.0.1:4318/v1/traces',
    serviceInstanceId: 'grading-contract-test-1',
    serviceName: 'grading',
    serviceVersion: '0.1.0-test',
  },
  {
    metricReader: new PeriodicExportingMetricReader({ exporter: metricExporter }),
    spanProcessor: new SimpleSpanProcessor(spanExporter),
  },
);
const [
  { SubmissionHttpClient },
  { GradingController },
  { HttpExceptionFilter },
  { GradingService },
] = await Promise.all([
  import('../dist/adapters/clients/submission-http.client.js'),
  import('../dist/adapters/http/grading/grading.controller.js'),
  import('../dist/adapters/http/http-exception.filter.js'),
  import('../dist/application/grading.service.js'),
]);

const calls = [];
const rows = new Map();
let submissionMode = 'ok';
let submissionServer;
let app;
function baseUrl(server) {
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return `http://127.0.0.1:${address.port}`;
}
async function grade(url, submissionId, score = 92.5) {
  const response = await fetch(`${url}/api/v1/grades`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-principal-id': 'instructor-001',
      'x-principal-role': 'instructor',
    },
    body: JSON.stringify({ score, submission_id: submissionId }),
  });
  return { status: response.status, body: await response.json() };
}
try {
  submissionServer = createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    calls.push({
      authorization: request.headers.authorization,
      path: url.pathname,
      principalId: request.headers['x-principal-id'],
      principalRole: request.headers['x-principal-role'],
      traceparent: request.headers.traceparent,
    });
    response.setHeader('content-type', 'application/json');
    if (submissionMode === 'unavailable') {
      response.statusCode = 503;
      response.end(JSON.stringify({ code: 'DEPENDENCY_UNAVAILABLE' }));
    } else if (submissionMode === 'slow') {
      setTimeout(() => response.end('{}'), 600).unref();
    } else if (url.pathname === '/api/v1/submissions/submission-001') {
      response.end(
        JSON.stringify({
          course_id: 'course-001',
          id: 'submission-001',
          principal_id: 'student-001',
          storage_object_key: 'submissions/submission-001',
          submitted_at: '2026-08-27T10:10:00Z',
        }),
      );
    } else {
      response.statusCode = 404;
      response.end(JSON.stringify({ code: 'NOT_FOUND' }));
    }
  });
  submissionServer.listen(0, '127.0.0.1');
  await once(submissionServer, 'listening');

  const config = {
    getOrThrow: (key) =>
      ({
        GRADING_DEPENDENCY_TIMEOUT_MS: 200,
        GRADING_SUBMISSION_BASE_URL: baseUrl(submissionServer),
      })[key],
  };
  const { GradeConflictError } = await import('../dist/application/grade-conflict-error.js');
  const repository = {
    async create(input) {
      if ([...rows.values()].some((row) => row.submission_id === input.submissionId)) {
        throw new GradeConflictError(input.submissionId);
      }
      const row = {
        completed_at: new Date().toISOString(),
        course_id: input.courseId,
        id: input.id,
        principal_id: input.principalId,
        score: input.score,
        submission_id: input.submissionId,
      };
      rows.set(row.id, row);
      return row;
    },
    async findById(id) {
      return rows.get(id) ?? null;
    },
  };
  const module = await Test.createTestingModule({
    controllers: [GradingController],
    providers: [
      { provide: ConfigService, useValue: config },
      {
        provide: GradingService,
        useFactory: () => new GradingService(repository, new SubmissionHttpClient(config)),
      },
    ],
  }).compile();
  app = module.createNestApplication();
  app.use(createHttpTelemetryMiddleware());
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(0, '127.0.0.1');
  const gradingUrl = baseUrl(app.getHttpServer());

  const created = await grade(gradingUrl, 'submission-001');
  assert.equal(created.status, 201);
  assert.deepEqual(Object.keys(created.body).sort(), [
    'completed_at',
    'id',
    'score',
    'submission_id',
  ]);
  assert.equal(rows.size, 1);
  assert.deepEqual(
    calls.map((call) => call.path),
    ['/api/v1/submissions/submission-001'],
  );
  assert.equal(calls[0].authorization, undefined);
  assert.equal(calls[0].principalId, undefined);
  assert.equal(calls[0].principalRole, undefined);
  assert.match(calls[0].traceparent, /^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);

  assert.equal((await grade(gradingUrl, 'submission-001')).status, 409);
  const missing = await grade(gradingUrl, 'missing');
  assert.equal(missing.status, 404);
  assert.equal(missing.body.code, 'NOT_FOUND');
  assert.equal(rows.size, 1);

  submissionMode = 'unavailable';
  const unavailable = await grade(gradingUrl, 'submission-001');
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.body.code, 'DEPENDENCY_UNAVAILABLE');
  submissionMode = 'slow';
  const timeout = await grade(gradingUrl, 'submission-001');
  assert.equal(timeout.status, 504);
  assert.equal(timeout.body.code, 'DEPENDENCY_TIMEOUT');
  assert.equal(rows.size, 1);

  await telemetry.forceFlush();
  const finished = spanExporter.getFinishedSpans();
  const requests = finished.filter(
    (span) => span.kind === SpanKind.SERVER && span.name.includes('/api/v1/grades'),
  );
  assert.equal(requests.length, 5);
  const firstClient = finished.find(
    (span) => span.parentSpanContext?.spanId === requests[0].spanContext().spanId,
  );
  assert.equal(firstClient?.attributes.dependency_identity, 'grading-submission');
  assert.equal(firstClient.kind, SpanKind.CLIENT);
  assert.equal(firstClient.spanContext().traceId, requests[0].spanContext().traceId);
  assert.ok(calls[0].traceparent.includes(requests[0].spanContext().traceId));
  assert.ok(calls[0].traceparent.includes(firstClient.spanContext().spanId));
  for (const errorType of ['unavailable', 'timeout']) {
    const failed = finished.find(
      (span) =>
        span.attributes.dependency_identity === 'grading-submission' &&
        span.attributes['error.type'] === errorType,
    );
    assert.ok(failed, `Thiếu span lỗi ${errorType}`);
    assert.equal(failed.status.code, SpanStatusCode.ERROR);
  }

  const metrics = JSON.stringify(metricExporter.getMetrics());
  for (const name of [
    'http.server.request.count',
    'grading.dependency.request.count',
    'grading.dependency.error.count',
    'grading.dependency.duration',
  ])
    assert.ok(metrics.includes(name), `Thiếu metric ${name}`);
  const metricSets = metricExporter
    .getMetrics()
    .flatMap((resource) => resource.scopeMetrics.flatMap((scope) => scope.metrics));
  const points = (name) => metricSets.find((metric) => metric.descriptor.name === name)?.dataPoints;
  assert.ok(
    points('grading.dependency.duration').some(
      (point) =>
        point.attributes.dependency_identity === 'grading-submission' &&
        point.value.count > 0 &&
        point.value.sum > 0,
    ),
  );
  for (const status of ['unavailable', 'timeout']) {
    assert.ok(
      points('grading.dependency.error.count').some(
        (point) =>
          point.attributes.dependency_identity === 'grading-submission' &&
          point.attributes.status === status &&
          point.value === 1,
      ),
    );
  }
  // 404 từ Submission là kết quả nghiệp vụ, không được tính là lỗi dependency.
  assert.equal(
    points('grading.dependency.error.count').reduce((sum, point) => sum + point.value, 0),
    2,
  );
  const sensitive =
    /student-001|instructor-001|course-001|submission-001|root_cause|fault_id|jwt|authorization/i;
  assert.doesNotMatch(metrics, sensitive);
  assert.doesNotMatch(
    JSON.stringify(
      finished.filter((span) => span.kind === SpanKind.CLIENT).map((span) => span.attributes),
    ),
    sensitive,
  );
  console.log(
    'Grading → Submission HTTP contract, trace propagation và telemetry integration đạt.',
  );
} finally {
  await app?.close();
  if (submissionServer) {
    submissionServer.closeAllConnections?.();
    await new Promise((resolve) => submissionServer.close(resolve));
  }
  await telemetry.shutdown();
}
