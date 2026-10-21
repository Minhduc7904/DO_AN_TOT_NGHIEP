import { EventEmitter } from 'node:events';
import { createServer, request as httpRequest } from 'node:http';
import { context, propagation, ROOT_CONTEXT, trace } from '@opentelemetry/api';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';

import { createHttpTelemetryMiddleware } from '../../src/http-telemetry-middleware.js';
import { startTelemetry } from '../../src/telemetry-bootstrap.js';

const exporter = new InMemorySpanExporter();
const telemetry = startTelemetry(
  {
    enabled: true,
    otlpTracesEndpoint: 'http://127.0.0.1:1/v1/traces',
    serviceName: 'gateway',
    serviceVersion: '0.1.0',
    serviceInstanceId: 'lifecycle-test',
  },
  { spanProcessor: new SimpleSpanProcessor(exporter) },
);

afterAll(async () => {
  await telemetry.shutdown();
  context.disable();
  propagation.disable();
  trace.disable();
});

beforeEach(() => exporter.reset());

function fixture() {
  const request = Object.assign(new EventEmitter(), {
    method: 'GET',
    originalUrl: '/objects/secret-principal-id?token=secret-token',
    headers: {
      traceparent: '00-0123456789abcdef0123456789abcdef-0123456789abcdef-00',
    },
    route: { path: '/objects/:id' },
  });
  const response = Object.assign(new EventEmitter(), { statusCode: 200 });
  return { request, response, middleware: createHttpTelemetryMiddleware() };
}

it('keeps W3C identity, samples an unsampled parent and finalizes finish/close only once', async () => {
  const { request, response, middleware } = fixture();
  let activeId;
  middleware(request, response, () => {
    activeId = trace.getActiveSpan()?.spanContext().spanId;
    const carrier = {};
    propagation.inject(context.active(), carrier);
    expect(carrier).toHaveProperty('traceparent');
  });
  response.emit('finish');
  response.emit('close');
  request.emit('aborted');
  await telemetry.forceFlush();
  const spans = exporter.getFinishedSpans();
  expect(spans).toHaveLength(1);
  expect(spans[0]?.spanContext()).toMatchObject({
    traceId: '0123456789abcdef0123456789abcdef',
    spanId: activeId,
    traceFlags: 1,
  });
  expect(spans[0]?.parentSpanContext?.spanId).toBe('0123456789abcdef');
  expect(spans[0]?.name).toBe('GET /objects/:id');
  expect(
    JSON.stringify(spans.map((span) => [span.name, span.attributes, span.events])),
  ).not.toContain('secret');
  expect(trace.getSpan(ROOT_CONTEXT)).toBeUndefined();
});

it.each(['close', 'aborted'] as const)(
  'ends an interrupted request on %s without a fake HTTP 200',
  async (event) => {
    const { request, response, middleware } = fixture();
    middleware(request, response, () => undefined);
    (event === 'close' ? response : request).emit(event);
    response.emit('finish');
    await telemetry.forceFlush();
    const spans = exporter.getFinishedSpans();
    expect(spans).toHaveLength(1);
    expect(spans[0]?.status.code).toBe(2);
    expect(spans[0]?.attributes['error.type']).toBe('client_aborted');
    expect(spans[0]?.attributes['http.response.status_code']).toBeUndefined();
    expect(request.listenerCount('aborted')).toBe(0);
    expect(response.listenerCount('close')).toBe(0);
  },
);

it('ends a synchronous exception once while preserving the thrown error and removing its message', async () => {
  const { request, response, middleware } = fixture();
  const failure = new Error('password=secret-password');
  expect(() =>
    middleware(request, response, () => {
      throw failure;
    }),
  ).toThrow(failure);
  response.emit('finish');
  response.emit('close');
  await telemetry.forceFlush();
  const spans = exporter.getFinishedSpans();
  expect(spans).toHaveLength(1);
  expect(spans[0]?.attributes['error.type']).toBe('exception');
  expect(
    JSON.stringify(spans.map((span) => [span.name, span.attributes, span.events])),
  ).not.toContain('secret');
});

it('exports an ERROR span when a real HTTP socket disconnects before a response', async () => {
  const middleware = createHttpTelemetryMiddleware();
  let acceptRequest!: () => void;
  let closeResponse!: () => void;
  const accepted = new Promise<void>((resolve) => {
    acceptRequest = resolve;
  });
  const closed = new Promise<void>((resolve) => {
    closeResponse = resolve;
  });
  const server = createServer((request, response) => {
    middleware(request, response, acceptRequest);
    response.once('close', closeResponse);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Thiếu địa chỉ HTTP test');
  const client = httpRequest(`http://127.0.0.1:${address.port}/secret-unmatched-path`);
  client.on('error', () => undefined);
  try {
    client.end();
    await accepted;
    client.destroy();
    await closed;
    await telemetry.forceFlush();
    const spans = exporter.getFinishedSpans();
    expect(spans).toHaveLength(1);
    expect(spans[0]?.status.code).toBe(2);
    expect(spans[0]?.attributes['error.type']).toBe('client_aborted');
    expect(spans[0]?.name).toBe('GET unmatched');
    expect(spans[0]?.attributes['url.path']).toBeUndefined();
  } finally {
    client.destroy();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
