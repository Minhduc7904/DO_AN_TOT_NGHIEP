import { createServer } from 'node:http';
import { EventEmitter } from 'node:events';
import { context, propagation, trace } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import { InMemoryLogRecordExporter, SimpleLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';

import { createHttpTelemetryMiddleware } from '../../src/http-telemetry-middleware.js';
import {
  configureStructuredLogging,
  emitStructuredLog,
  logDependencyFailure,
  sanitizeLogText,
  StructuredLogger,
} from '../../src/structured-logger.js';
import { startTelemetry } from '../../src/telemetry-bootstrap.js';

const identity = {
  serviceName: 'course',
  serviceVersion: '0.1.0',
  serviceInstanceId: 'logger-test-1',
};
const logExporter = new InMemoryLogRecordExporter();
const telemetry = startTelemetry(
  { ...identity, enabled: true, otlpTracesEndpoint: 'http://127.0.0.1:1/v1/traces' },
  {
    logRecordProcessor: new SimpleLogRecordProcessor({ exporter: logExporter }),
    spanProcessor: new SimpleSpanProcessor(new InMemorySpanExporter()),
  },
);
let lines: Record<string, unknown>[] = [];
configureStructuredLogging(identity, {
  write: (line) => lines.push(JSON.parse(line) as Record<string, unknown>),
});
const tracer = trace.getTracer('structured-logger-test');

afterAll(async () => {
  await telemetry.shutdown();
  context.disable();
  logs.disable();
  propagation.disable();
  trace.disable();
});

beforeEach(() => {
  lines = [];
  logExporter.reset();
});

it('writes JSON with UTC timestamp, severity, message and resource identity but no fake trace IDs', () => {
  emitStructuredLog('log', 'Startup hoàn tất');

  expect(lines).toHaveLength(1);
  const [line] = lines;
  expect(line).toMatchObject({
    level: 'INFO',
    message: 'Startup hoàn tất',
    'service.name': 'course',
    'service.version': '0.1.0',
    'service.instance.id': 'logger-test-1',
  });
  expect(new Date(String(line?.timestamp)).toISOString()).toBe(line?.timestamp);
  expect(line).not.toHaveProperty('trace_id');
  expect(line).not.toHaveProperty('span_id');
  const [record] = logExporter.getFinishedLogRecords();
  expect(record?.spanContext).toBeUndefined();
  expect(record?.severityText).toBe('INFO');
  expect(record?.resource.attributes['service.name']).toBe('course');
});

it('correlates stdout and OTel record with the active span', () => {
  const span = tracer.startSpan('request');
  context.with(trace.setSpan(context.active(), span), () =>
    emitStructuredLog('warn', 'Trong request', { event: 'test.event' }),
  );
  span.end();

  const { traceId, spanId } = span.spanContext();
  expect(lines[0]).toMatchObject({ trace_id: traceId, span_id: spanId, event: 'test.event' });
  expect(logExporter.getFinishedLogRecords()[0]?.spanContext).toMatchObject({ traceId, spanId });
});

it('drops fields outside the allowlist and redacts credentials and PII', () => {
  // Dựng chuỗi dạng JWT lúc chạy để không có token literal trong source.
  const jwtShaped = ['eyJ', 'hbGciOiJub25lIn0', '.eyJ', 'zdWIiOiJ0ZXN0In0', '.fake'].join('');
  emitStructuredLog(
    'error',
    `login student@example.test Authorization: Bearer abc.def password=hunter2 postgresql://lms:lms-local-only@postgres:5432/db ${jwtShaped}`,
    {
      error_type: 'timeout',
      http_status_code: 504,
      user_id: 'student-001',
      payload: { password: 'x' },
    } as never,
  );

  const serialized = JSON.stringify([lines, logExporter.getFinishedLogRecords()]);
  for (const secret of [
    'student@example.test',
    'abc.def',
    'hunter2',
    'lms-local-only',
    jwtShaped,
    'student-001',
    'payload',
  ]) {
    expect(serialized).not.toContain(secret);
  }
  expect(lines[0]).toMatchObject({ error_type: 'timeout', http_status_code: 504 });
  expect(sanitizeLogText('x'.repeat(3_000))).toHaveLength(2_001);
  expect(
    sanitizeLogText('accessToken=opaque-a refreshToken: opaque-r refresh-token=opaque-k'),
  ).toBe('accessToken=[REDACTED] refreshToken: [REDACTED] refresh-token=[REDACTED]');
});

it('implements the NestJS logger contract with context, stack and default level filtering', () => {
  const logger = new StructuredLogger('Fallback');
  logger.debug('bỏ qua mặc định');
  logger.verbose('bỏ qua mặc định');
  logger.log('Mapped route', 'RoutesResolver');
  logger.error('Boom', 'Error: Boom\n    at handler (file.ts:1:1)', 'ExceptionsHandler');
  logger.warn(new Error('kết nối lỗi'));
  logger.log({ message: 'Structured', dependency_identity: 'course-redis', principal: 'x' });

  expect(lines.map((line) => line.level)).toEqual(['INFO', 'ERROR', 'WARN', 'INFO']);
  expect(lines[0]).toMatchObject({ logger: 'RoutesResolver', message: 'Mapped route' });
  expect(lines[1]).toMatchObject({
    logger: 'ExceptionsHandler',
    'exception.stacktrace': 'Error: Boom\n    at handler (file.ts:1:1)',
  });
  expect(lines[2]).toMatchObject({ logger: 'Fallback', message: 'Error: kết nối lỗi' });
  expect(lines[2]).toHaveProperty(['exception.stacktrace']);
  expect(lines[3]).toMatchObject({ dependency_identity: 'course-redis', message: 'Structured' });
  expect(lines[3]).not.toHaveProperty('principal');

  logger.setLogLevels(['debug']);
  logger.debug('đã bật');
  expect(lines.at(-1)).toMatchObject({ level: 'DEBUG', message: 'đã bật' });
});

it('logs dependency failures with the failing client span identity', () => {
  const parent = tracer.startSpan('request');
  const client = context.with(trace.setSpan(context.active(), parent), () =>
    tracer.startSpan('course-postgres get'),
  );
  context.with(trace.setSpan(context.active(), parent), () =>
    logDependencyFailure(client, {
      dependency_identity: 'course-postgres',
      error_type: 'timeout',
      operation_name: 'get',
    }),
  );
  client.end();
  parent.end();

  expect(lines[0]).toMatchObject({
    level: 'ERROR',
    event: 'dependency.failure',
    dependency_identity: 'course-postgres',
    error_type: 'timeout',
    operation_name: 'get',
    trace_id: parent.spanContext().traceId,
    span_id: client.spanContext().spanId,
  });
});

it('logs HTTP 5xx in the server span context with bounded route and status', () => {
  const request = Object.assign(new EventEmitter(), {
    method: 'GET',
    headers: {},
    route: { path: '/api/v1/courses/:course_id' },
  });
  const response = Object.assign(new EventEmitter(), { statusCode: 200 });
  let serverSpan: { traceId: string; spanId: string } | undefined;
  createHttpTelemetryMiddleware()(request, response, () => {
    serverSpan = trace.getActiveSpan()?.spanContext();
  });
  response.statusCode = 504;
  response.emit('finish');

  expect(lines).toHaveLength(1);
  expect(lines[0]).toMatchObject({
    level: 'ERROR',
    event: 'http.server.error',
    error_type: '504',
    http_method: 'GET',
    http_route: '/api/v1/courses/:course_id',
    http_status_code: 504,
    trace_id: serverSpan?.traceId,
    span_id: serverSpan?.spanId,
  });
});

it('does not start an implicit OTLP log exporter when logs were not enabled', async () => {
  let exports = 0;
  const server = createServer((request, response) => {
    exports += 1;
    request.resume();
    response.writeHead(200, { 'content-type': 'application/x-protobuf' });
    response.end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Thiếu endpoint logs test');
  const previousEndpoint = process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT;
  process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT = `http://127.0.0.1:${address.port}/v1/logs`;
  const isolated = startTelemetry(
    { ...identity, enabled: true, otlpTracesEndpoint: 'http://127.0.0.1:1/v1/traces' },
    { spanProcessor: new SimpleSpanProcessor(new InMemorySpanExporter()) },
  );
  try {
    emitStructuredLog('log', 'không được export');
    await isolated.forceFlush();
    await isolated.shutdown();
    expect(exports).toBe(0);
  } finally {
    await isolated.shutdown();
    if (previousEndpoint === undefined) delete process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT;
    else process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT = previousEndpoint;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
