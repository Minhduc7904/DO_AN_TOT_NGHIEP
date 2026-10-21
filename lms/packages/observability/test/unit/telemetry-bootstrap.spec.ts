import { startTelemetry } from '../../src/telemetry-bootstrap.js';
import { context, propagation, trace } from '@opentelemetry/api';
import { InMemorySpanExporter } from '@opentelemetry/sdk-trace-base';

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
});
