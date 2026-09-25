import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
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
    serviceInstanceId: 'submission-contract-test-1',
    serviceName: 'submission',
    serviceVersion: '0.1.0-test',
  },
  {
    metricReader: new PeriodicExportingMetricReader({ exporter: metricExporter }),
    spanProcessor: new SimpleSpanProcessor(spanExporter),
  },
);
const [
  { CourseHttpClient },
  { EnrollmentHttpClient },
  { StorageHttpClient },
  { SubmissionController },
  { HttpExceptionFilter },
  { SubmissionService },
] = await Promise.all([
  import('../dist/adapters/clients/course-http.client.js'),
  import('../dist/adapters/clients/enrollment-http.client.js'),
  import('../dist/adapters/clients/storage-http.client.js'),
  import('../dist/adapters/http/submission/submission.controller.js'),
  import('../dist/adapters/http/http-exception.filter.js'),
  import('../dist/application/submission.service.js'),
]);

const rows = new Map();
const calls = [];
let courseExists = true;
let enrolled = true;
let dependencyServer;
let storageProcess;
let app;
function baseUrl(server) {
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return `http://127.0.0.1:${address.port}`;
}
async function freePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
async function setFault(url, errorMode, latencyMs) {
  const response = await fetch(`${url}/internal/v1/fault`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ error_mode: errorMode, latency_ms: latencyMs }),
  });
  assert.equal(response.status, 200);
}
async function submit(url, courseId = 'course-001') {
  const response = await fetch(`${url}/api/v1/submissions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-principal-id': 'student-001',
      'x-principal-role': 'student',
    },
    body: JSON.stringify({ content: 'answer-secret', course_id: courseId }),
  });
  return { status: response.status, body: await response.json() };
}
try {
  dependencyServer = createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    calls.push({
      path: url.pathname,
      query: url.searchParams,
      principalId: request.headers['x-principal-id'],
      principalRole: request.headers['x-principal-role'],
      traceparent: request.headers.traceparent,
    });
    response.setHeader('content-type', 'application/json');
    if (url.pathname.startsWith('/api/v1/courses/')) {
      response.statusCode = courseExists ? 200 : 404;
      response.end(JSON.stringify(courseExists ? { id: 'course-001' } : { code: 'NOT_FOUND' }));
    } else if (url.pathname === '/api/v1/enrollments/check') {
      response.end(JSON.stringify({ enrolled }));
    } else {
      response.statusCode = 404;
      response.end(JSON.stringify({ code: 'NOT_FOUND' }));
    }
  });
  dependencyServer.listen(0, '127.0.0.1');
  await once(dependencyServer, 'listening');

  const storageUrl = `http://127.0.0.1:${await freePort()}`;
  storageProcess = spawn(process.execPath, ['services/submission-storage-mock/dist/main.js'], {
    cwd: process.cwd(),
    env: { ...process.env, OTEL_SDK_DISABLED: 'true', PORT: new URL(storageUrl).port },
    stdio: 'ignore',
  });
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (storageProcess.exitCode !== null) break;
    try {
      if ((await fetch(`${storageUrl}/health`)).ok) {
        ready = true;
        break;
      }
    } catch {
      /* Chờ Storage Mock mở cổng. */
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.ok(ready, 'Storage Mock phải sẵn sàng qua HTTP');

  const config = {
    getOrThrow: (key) =>
      ({
        SUBMISSION_COURSE_BASE_URL: baseUrl(dependencyServer),
        SUBMISSION_ENROLLMENT_BASE_URL: baseUrl(dependencyServer),
        SUBMISSION_STORAGE_BASE_URL: storageUrl,
        SUBMISSION_DEPENDENCY_TIMEOUT_MS: 200,
      })[key],
  };
  const repository = {
    async create(input) {
      const row = {
        id: input.id,
        course_id: input.courseId,
        principal_id: input.principalId,
        storage_object_key: input.storageObjectKey,
        submitted_at: new Date().toISOString(),
      };
      rows.set(row.id, row);
      return row;
    },
    async findById(id) {
      return rows.get(id) ?? null;
    },
  };
  const module = await Test.createTestingModule({
    controllers: [SubmissionController],
    providers: [
      { provide: ConfigService, useValue: config },
      {
        provide: SubmissionService,
        useFactory: () =>
          new SubmissionService(
            repository,
            new CourseHttpClient(config),
            new EnrollmentHttpClient(config),
            new StorageHttpClient(config),
          ),
      },
    ],
  }).compile();
  app = module.createNestApplication();
  app.use(createHttpTelemetryMiddleware());
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(0, '127.0.0.1');
  const submissionUrl = baseUrl(app.getHttpServer());

  const success = await submit(submissionUrl);
  assert.equal(success.status, 201);
  assert.equal(rows.size, 1);
  const object = await fetch(
    `${storageUrl}/api/v1/objects/${encodeURIComponent(success.body.storage_object_key)}`,
  );
  assert.equal(object.status, 200);
  assert.equal((await object.json()).content, 'answer-secret');
  assert.deepEqual(
    calls.map((call) => call.path),
    ['/api/v1/courses/course-001', '/api/v1/enrollments/check'],
  );
  assert.equal(calls[0].principalId, 'student-001');
  assert.equal(calls[0].principalRole, 'student');
  assert.equal(calls[1].query.get('principal_id'), 'student-001');
  assert.equal(calls[1].query.get('course_id'), 'course-001');
  assert.ok(calls.every((call) => /^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/.test(call.traceparent)));

  courseExists = false;
  const missing = await submit(submissionUrl, 'missing');
  assert.equal(missing.status, 404);
  assert.equal(missing.body.code, 'NOT_FOUND');
  courseExists = true;
  enrolled = false;
  const denied = await submit(submissionUrl);
  assert.equal(denied.status, 403);
  assert.equal(denied.body.code, 'FORBIDDEN');
  enrolled = true;
  assert.equal(rows.size, 1);

  await setFault(storageUrl, 'none', 10);
  const slowStarted = performance.now();
  assert.equal((await submit(submissionUrl)).status, 201);
  assert.ok(performance.now() - slowStarted >= 8);
  assert.equal(rows.size, 2);
  await setFault(storageUrl, 'unavailable', 0);
  const unavailable = await submit(submissionUrl);
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.body.code, 'DEPENDENCY_UNAVAILABLE');
  assert.equal(rows.size, 2);
  await setFault(storageUrl, 'none', 600);
  const timeout = await submit(submissionUrl);
  assert.equal(timeout.status, 504);
  assert.equal(timeout.body.code, 'DEPENDENCY_TIMEOUT');
  assert.equal(rows.size, 2);
  assert.equal((await fetch(`${storageUrl}/internal/v1/fault`, { method: 'DELETE' })).status, 200);
  assert.equal((await submit(submissionUrl)).status, 201);
  assert.equal(rows.size, 3);

  await telemetry.forceFlush();
  const finished = spanExporter.getFinishedSpans();
  const requests = finished.filter(
    (span) => span.kind === SpanKind.SERVER && span.name.includes('/api/v1/submissions'),
  );
  assert.equal(requests.length, 7);
  const graph = finished.filter(
    (span) => span.parentSpanContext?.spanId === requests[0].spanContext().spanId,
  );
  assert.deepEqual(
    graph.map((span) => span.attributes.dependency_identity),
    ['submission-course', 'submission-enrollment', 'submission-storage'],
  );
  assert.ok(graph.every((span) => span.kind === SpanKind.CLIENT));
  assert.ok(
    graph.every((span) => span.spanContext().traceId === requests[0].spanContext().traceId),
  );
  assert.ok(
    calls.slice(0, 2).every((call) => call.traceparent.includes(requests[0].spanContext().traceId)),
  );
  for (const errorType of ['unavailable', 'timeout']) {
    const failed = finished.find(
      (span) =>
        span.attributes.dependency_identity === 'submission-storage' &&
        span.attributes['error.type'] === errorType,
    );
    assert.ok(failed);
    assert.equal(failed.status.code, SpanStatusCode.ERROR);
  }
  const metrics = JSON.stringify(metricExporter.getMetrics());
  for (const name of [
    'http.server.request.count',
    'http.server.request.error.count',
    'http.server.request.duration',
    'submission.dependency.request.count',
    'submission.dependency.error.count',
    'submission.dependency.duration',
  ])
    assert.ok(metrics.includes(name), `Thiếu metric ${name}`);
  const metricSets = metricExporter
    .getMetrics()
    .flatMap((resource) => resource.scopeMetrics.flatMap((scope) => scope.metrics));
  const points = (name) => metricSets.find((metric) => metric.descriptor.name === name)?.dataPoints;
  for (const identity of ['submission-course', 'submission-enrollment', 'submission-storage']) {
    assert.ok(metrics.includes(identity), `Thiếu dependency identity ${identity}`);
    assert.ok(
      points('submission.dependency.duration').some(
        (point) =>
          point.attributes.dependency_identity === identity &&
          point.value.count > 0 &&
          point.value.sum > 0,
      ),
    );
  }
  for (const status of ['unavailable', 'timeout']) {
    assert.ok(
      points('submission.dependency.error.count').some(
        (point) =>
          point.attributes.dependency_identity === 'submission-storage' &&
          point.attributes.status === status &&
          point.value === 1,
      ),
    );
  }
  assert.ok(
    points('http.server.request.error.count').some(
      (point) => point.attributes.http_status_class === '5xx' && point.value >= 2,
    ),
  );
  assert.doesNotMatch(
    metrics,
    /answer-secret|student-001|course-001|root_cause|fault_id|jwt|trace_id/i,
  );
  assert.doesNotMatch(
    JSON.stringify(finished.map((span) => span.attributes)),
    /answer-secret|student-001|course-001|root_cause|fault_id|jwt/i,
  );
  console.log(
    'Submission HTTP contract, Storage Mock injection và trace topology integration đạt.',
  );
} finally {
  await app?.close();
  if (storageProcess && storageProcess.exitCode === null) {
    storageProcess.kill('SIGTERM');
    await once(storageProcess, 'exit');
  }
  if (dependencyServer) await new Promise((resolve) => dependencyServer.close(resolve));
  await telemetry.shutdown();
}
