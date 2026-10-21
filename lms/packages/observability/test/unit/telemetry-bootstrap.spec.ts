import { startTelemetry } from '../../src/telemetry-bootstrap.js';
import { context, metrics, propagation, trace } from '@opentelemetry/api';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { createServer } from 'node:http';

describe('startTelemetry', () => {
  it('returns a no-op handle when the SDK is disabled', async () => {
    const telemetry = startTelemetry({
      enabled: false,
      otlpTracesEndpoint: 'http://collector:4318/v1/traces',
      serviceInstanceId: 'course-test-1',
      serviceName: 'course',
      serviceVersion: '1.2.3',
    });

    expect(telemetry.started).toBe(false);
    expect(telemetry.config.otlpTracesEndpoint).toBe('http://collector:4318/v1/traces');
    await expect(telemetry.forceFlush()).resolves.toBeUndefined();
    await expect(telemetry.shutdown()).resolves.toBeUndefined();
  });

  it('flushes the default batch processor into the exporter before shutdown', async () => {
    const exporter = new InMemorySpanExporter();
    const telemetry = startTelemetry(
      {
        enabled: true,
        otlpTracesEndpoint: 'http://127.0.0.1:1/v1/traces',
        serviceName: 'course',
        serviceVersion: '0.1.0',
        serviceInstanceId: 'flush-test',
      },
      { traceExporter: exporter },
    );
    try {
      trace.getTracer('flush-test').startSpan('buffered span').end();
      expect(exporter.getFinishedSpans()).toHaveLength(0);
      await telemetry.forceFlush();
      expect(exporter.getFinishedSpans()).toHaveLength(1);
    } finally {
      await telemetry.shutdown();
      context.disable();
      propagation.disable();
      trace.disable();
    }
  });

  it('does not start an implicit OTLP metric reader when metrics were not enabled', async () => {
    let exports = 0;
    const server = createServer((request, response) => {
      exports += 1;
      request.resume();
      response.writeHead(200, { 'content-type': 'application/x-protobuf' });
      response.end();
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Thiếu endpoint metrics test');
    const previousEndpoint = process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT;
    process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT = `http://127.0.0.1:${address.port}/v1/metrics`;
    const telemetry = startTelemetry(
      {
        enabled: true,
        otlpTracesEndpoint: 'http://127.0.0.1:1/v1/traces',
        serviceName: 'gateway',
        serviceVersion: '0.1.0',
        serviceInstanceId: 'metrics-disabled-test',
      },
      { spanProcessor: new SimpleSpanProcessor(new InMemorySpanExporter()) },
    );
    try {
      metrics.getMeter('disabled-metrics-test').createCounter('test.request.count').add(1);
      await telemetry.shutdown();
      expect(exports).toBe(0);
    } finally {
      await telemetry.shutdown();
      if (previousEndpoint === undefined) delete process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT;
      else process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT = previousEndpoint;
      context.disable();
      metrics.disable();
      propagation.disable();
      trace.disable();
      const closed = new Promise<void>((resolve) => server.close(() => resolve()));
      server.closeAllConnections();
      await closed;
    }
  });
});
