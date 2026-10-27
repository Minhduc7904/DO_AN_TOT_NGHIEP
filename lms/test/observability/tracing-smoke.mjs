import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

import {
  composeArguments,
  parseArguments,
  runProcess,
  validateOptions,
  verifyHealth,
} from '../../scripts/reset-and-seed.mjs';

const options = validateOptions(parseArguments(process.argv.slice(2)));
assert.equal(options.environment, 'test', 'Tracing smoke chỉ chạy trên project test đã xác nhận.');
assert.ok(options.project.startsWith('aiops-lms-test-'));
await verifyHealth(options);
const compose = async (args) =>
  (await runProcess('docker', composeArguments(options, args), { capture: true })).stdout;
const configuration = JSON.parse(await compose(['config', '--format', 'json']));
const containers = (await compose(['ps', '--all', '--format', 'json']))
  .trim()
  .split(/\r?\n/u)
  .map((line) => JSON.parse(line));
assert.equal(containers.length, 20);
for (const container of containers) assert.equal(container.Health, 'healthy', container.Service);

function endpoint(service, targetPort) {
  const port = configuration.services[service].ports.find((item) => item.target === targetPort);
  assert.ok(port && /^\d+$/u.test(String(port.published)));
  const container = containers.find((item) => item.Service === service);
  assert.ok(
    container.Publishers.some(
      (item) => item.TargetPort === targetPort && item.PublishedPort === Number(port.published),
    ),
    'Port phải thuộc đúng project test.',
  );
  return `http://127.0.0.1:${port.published}`;
}
const gateway = endpoint('gateway', 3000);
const storage = endpoint('submission-storage-mock', 3005);
const tempo = endpoint('tempo', 3200);
const startedAt = Math.floor(Date.now() / 1_000) - 5;
const callerSpanId = randomBytes(8).toString('hex');
const healthyId = randomBytes(16).toString('hex');
const payloadMarker = `private-answer-${randomBytes(12).toString('hex')}`;
const sensitiveValues = [
  payloadMarker,
  'example-password',
  'student@example.test',
  'instructor@example.test',
];

async function request(
  base,
  path,
  {
    traceId = base === gateway ? healthyId : randomBytes(16).toString('hex'),
    method = 'GET',
    body,
    token,
    expected = 200,
  } = {},
) {
  const headers = { traceparent: `00-${traceId}-${callerSpanId}-00` };
  if (token) headers.authorization = `Bearer ${token}`;
  if (body) headers['content-type'] = 'application/json';
  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15_000),
  });
  assert.equal(response.status, expected, `${method} ${path}: HTTP status không đúng`);
  return response.json();
}

async function poll(label, check) {
  const deadline = Date.now() + 90_000;
  let lastError;
  do {
    try {
      return await check();
    } catch (error) {
      lastError = error;
      await delay(500);
    }
  } while (Date.now() < deadline);
  throw new Error(`${label}: quá 90 giây`, { cause: lastError });
}

function value(attributes, key) {
  const item = attributes?.find((attribute) => attribute.key === key)?.value;
  return item?.stringValue ?? item?.intValue ?? item?.doubleValue ?? item?.boolValue;
}
function id(value, width) {
  if (!value) return '';
  return /^[a-f0-9]+$/iu.test(value) && value.length <= width
    ? value.padStart(width, '0').toLowerCase()
    : Buffer.from(value, 'base64').toString('hex');
}
async function traceSpans(traceId) {
  const response = await fetch(`${tempo}/api/traces/${traceId}`, {
    signal: AbortSignal.timeout(5_000),
  });
  assert.equal(response.status, 200);
  const data = await response.json();
  for (const sensitive of sensitiveValues)
    assert.ok(
      !JSON.stringify(data).includes(sensitive),
      'Trace không được chứa payload/secret/PII.',
    );
  return (data.batches ?? data.resourceSpans ?? []).flatMap((batch) =>
    (batch.scopeSpans ?? []).flatMap((scope) =>
      (scope.spans ?? []).map((span) => ({
        ...span,
        service: value(batch.resource.attributes, 'service.name'),
        resource: batch.resource.attributes,
        traceId: id(span.traceId, 32),
        spanId: id(span.spanId, 16),
        parentSpanId: id(span.parentSpanId, 16),
      })),
    ),
  );
}

const student = await request(gateway, '/api/v1/auth/login', {
  method: 'POST',
  body: { email: 'student@example.test', password: 'example-password' },
});
const instructor = await request(gateway, '/api/v1/auth/login', {
  method: 'POST',
  body: { email: 'instructor@example.test', password: 'example-password' },
});
sensitiveValues.push(student.access_token, instructor.access_token);
const course = await request(gateway, '/api/v1/courses', {
  method: 'POST',
  token: instructor.access_token,
  body: { title: 'Tracing smoke course' },
  expected: 201,
});
await request(gateway, `/api/v1/courses/${course.id}`, { token: student.access_token });
await request(gateway, '/api/v1/enrollments', {
  method: 'POST',
  token: student.access_token,
  body: { course_id: course.id },
  expected: 201,
});
const submission = await request(gateway, '/api/v1/submissions', {
  method: 'POST',
  token: student.access_token,
  body: { course_id: course.id, content: payloadMarker },
  expected: 201,
});
await request(gateway, '/api/v1/grades', {
  method: 'POST',
  token: instructor.access_token,
  body: { submission_id: submission.id, score: 89 },
  expected: 201,
});

const expectedServices = [
  'gateway',
  'auth',
  'course',
  'enrollment',
  'submission',
  'grading',
  'notification',
  'submission-storage',
];
const healthySpans = await poll('Trace tám runtime/async parent chain', async () => {
  const spans = await traceSpans(healthyId);
  const byId = new Map(spans.map((span) => [span.spanId, span]));
  assert.equal(byId.size, spans.length, 'Không được export span trùng.');
  for (const service of expectedServices) {
    const serviceSpans = spans.filter((span) => span.service === service);
    assert.ok(serviceSpans.length > 0, `Thiếu runtime ${service}`);
    const composeName = service === 'submission-storage' ? 'submission-storage-mock' : service;
    const env = configuration.services[composeName].environment;
    for (const span of serviceSpans) {
      assert.equal(span.traceId, healthyId);
      assert.equal(value(span.resource, 'service.version'), env.OTEL_SERVICE_VERSION);
      assert.equal(value(span.resource, 'service.instance.id'), env.OTEL_SERVICE_INSTANCE_ID);
      assert.notEqual(span.status?.code, 'STATUS_CODE_ERROR');
      const parent = byId.get(span.parentSpanId);
      assert.ok(
        parent || (service === 'gateway' && span.parentSpanId === callerSpanId),
        `Parent bị đứt: ${service}/${span.name}`,
      );
      if (span.kind === 'SPAN_KIND_SERVER' && service !== 'gateway') {
        assert.equal(parent.kind, 'SPAN_KIND_CLIENT');
        assert.equal(value(parent.attributes, 'peer.service'), service);
      }
    }
  }
  for (const dependency of [
    'auth-postgres',
    'course-postgres',
    'course-redis',
    'enrollment-postgres',
    'submission-postgres',
    'submission-storage',
    'grading-postgres',
    'grading-rabbitmq',
    'notification-rabbitmq',
  ]) {
    assert.ok(
      spans.some((span) => value(span.attributes, 'dependency_identity') === dependency),
      `Thiếu dependency ${dependency}`,
    );
  }
  for (const span of spans.filter(
    (item) => item.kind === 'SPAN_KIND_CLIENT' && value(item.attributes, 'peer.service'),
  )) {
    assert.equal(
      spans.filter((item) => item.kind === 'SPAN_KIND_SERVER' && item.parentSpanId === span.spanId)
        .length,
      1,
      'Mỗi HTTP client cần đúng một server child.',
    );
    assert.ok(value(span.attributes, 'http.response.status_code'));
    assert.ok(value(span.attributes, 'http.request.method'));
  }
  const producer = spans.find((span) => span.kind === 'SPAN_KIND_PRODUCER');
  const consumer = spans.find((span) => span.kind === 'SPAN_KIND_CONSUMER');
  const process = spans.find(
    (span) =>
      span.service === 'notification' && value(span.attributes, 'operation_name') === 'process',
  );
  assert.ok(producer && consumer && process);
  assert.equal(consumer.parentSpanId, producer.spanId);
  assert.equal(process.parentSpanId, consumer.spanId);
  return spans;
});

for (const service of expectedServices) {
  await poll(`Tempo search service ${service}`, async () => {
    const url = new URL(`${tempo}/api/search`);
    url.searchParams.set('q', `{ resource.service.name = "${service}" }`);
    url.searchParams.set('start', String(startedAt));
    url.searchParams.set('end', String(Math.floor(Date.now() / 1_000) + 5));
    url.searchParams.set('limit', '100');
    const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.ok(result.traces?.some((trace) => id(trace.traceID, 32) === healthyId));
  });
}

const original = await request(storage, '/internal/v1/state');
assert.deepEqual(
  original.fault,
  { error_mode: 'none', latency_ms: 0 },
  'Test yêu cầu storage không có fault đang hoạt động.',
);
const failures = [];
try {
  for (const scenario of [
    { name: 'timeout', error_mode: 'none', latency_ms: 10_000, http: 504 },
    { name: 'unavailable', error_mode: 'unavailable', latency_ms: 0, http: 503 },
  ]) {
    await request(storage, '/internal/v1/fault', {
      method: 'PUT',
      body: { error_mode: scenario.error_mode, latency_ms: scenario.latency_ms },
    });
    const traceId = randomBytes(16).toString('hex');
    const error = await request(gateway, '/api/v1/submissions', {
      traceId,
      method: 'POST',
      token: student.access_token,
      body: { course_id: course.id, content: payloadMarker },
      expected: scenario.http,
    });
    assert.ok(JSON.stringify(error).includes(`DEPENDENCY_${scenario.name.toUpperCase()}`));
    await poll(`Storage ${scenario.name} span`, async () => {
      const spans = await traceSpans(traceId);
      const dependency = spans.filter(
        (span) => value(span.attributes, 'dependency_identity') === 'submission-storage',
      );
      assert.equal(dependency.length, 1);
      assert.equal(value(dependency[0].attributes, 'error.type'), scenario.name);
      assert.equal(dependency[0].status.code, 'STATUS_CODE_ERROR');
      const server = spans.find(
        (span) => span.service === 'submission' && span.kind === 'SPAN_KIND_SERVER',
      );
      assert.equal(Number(value(server?.attributes, 'http.response.status_code')), scenario.http);
      assert.equal(server.status.code, 'STATUS_CODE_ERROR');
    });
    failures.push({ scenario: scenario.name, traceId });
  }
} finally {
  await request(storage, '/internal/v1/fault', { method: 'PUT', body: original.fault });
}
console.info(
  JSON.stringify({
    result: 'pass',
    healthyTraceId: healthyId,
    spanCount: healthySpans.length,
    services: expectedServices,
    failures,
  }),
);
