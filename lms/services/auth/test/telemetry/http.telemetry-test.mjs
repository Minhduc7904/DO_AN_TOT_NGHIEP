import assert from 'node:assert/strict';

import { createHttpTelemetryMiddleware, startTelemetry } from '@aiops-lms/observability';
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
  SpanKind,
  SpanStatusCode,
} from '@aiops-lms/observability/testing';

const TRACE_ID = '33333333333333333333333333333333';
const PARENT_SPAN_ID = '4444444444444444';
const SENSITIVE_VALUES = ['top-secret-token', 'student@example.test', 'fault-123'];
const exporter = new InMemorySpanExporter();
const telemetry = startTelemetry(
  {
    enabled: true,
    otlpTracesEndpoint: 'http://127.0.0.1:4318/v1/traces',
    serviceInstanceId: 'auth-telemetry-test-1',
    serviceName: 'auth',
    serviceVersion: '0.1.0-test',
  },
  { spanProcessor: new SimpleSpanProcessor(exporter) },
);

const [{ Test }, { AppModule }] = await Promise.all([
  import('@nestjs/testing'),
  import('../../dist/app.module.js'),
]);
const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
const app = moduleRef.createNestApplication({ logger: false });

app.use(createHttpTelemetryMiddleware());
app.use('/telemetry-test/error', (_request, _response, next) => {
  next(new Error('expected telemetry test failure'));
});

try {
  await app.listen(0, '127.0.0.1');
  const baseUrl = await app.getUrl();

  exporter.reset();
  const healthResponse = await fetch(`${baseUrl}/health`, {
    headers: {
      traceparent: `00-${TRACE_ID}-${PARENT_SPAN_ID}-01`,
      tracestate: 'vendor=value',
    },
  });
  assert.equal(healthResponse.status, 200);
  await healthResponse.body?.cancel();
  await telemetry.forceFlush();

  const healthSpan = exporter.getFinishedSpans().find((span) => span.kind === SpanKind.SERVER);
  assert.ok(healthSpan, 'GET /health phải tạo HTTP server span');
  assert.equal(healthSpan.spanContext().traceId, TRACE_ID);
  assert.equal(healthSpan.parentSpanContext?.spanId, PARENT_SPAN_ID);
  assert.equal(healthSpan.resource.attributes['service.name'], 'auth');
  assert.equal(healthSpan.resource.attributes['service.version'], '0.1.0-test');
  assert.equal(healthSpan.resource.attributes['service.instance.id'], 'auth-telemetry-test-1');
  assert.equal(healthSpan.attributes['http.route'], '/health');

  exporter.reset();
  const errorResponse = await fetch(`${baseUrl}/telemetry-test/error`, {
    headers: {
      authorization: `Bearer ${SENSITIVE_VALUES[0]}`,
      'x-fault-id': SENSITIVE_VALUES[2],
      'x-user-email': SENSITIVE_VALUES[1],
    },
  });
  assert.equal(errorResponse.status, 500);
  await errorResponse.body?.cancel();
  await telemetry.forceFlush();

  const errorSpan = exporter.getFinishedSpans().find((span) => span.kind === SpanKind.SERVER);
  assert.ok(errorSpan, 'error path phải tạo HTTP server span');
  assert.equal(errorSpan.status.code, SpanStatusCode.ERROR);
  assert.equal(errorSpan.attributes['http.response.status_code'], 500);

  const serialized = JSON.stringify({
    attributes: errorSpan.attributes,
    events: errorSpan.events,
    resource: errorSpan.resource.attributes,
  });
  for (const value of SENSITIVE_VALUES) {
    assert.equal(serialized.includes(value), false);
  }

  process.stdout.write(
    'Auth telemetry assertion đạt: resource identity, W3C context và không lộ dữ liệu nhạy cảm.\n',
  );
} finally {
  await app.close();
  await telemetry.shutdown();
}
