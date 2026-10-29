import { EventEmitter } from 'node:events';
import { context, metrics, propagation, trace } from '@opentelemetry/api';
import { InMemoryMetricExporter, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';

import { createHttpTelemetryMiddleware } from '../../src/http-telemetry-middleware.js';
import { startTelemetry } from '../../src/telemetry-bootstrap.js';
import { DURATION_BUCKETS_SECONDS, METRIC_ATTRIBUTE_KEYS } from '../../src/service-metrics.js';

it('exports bounded attributes, exact second buckets and real CPU/RSS while dynamic IDs collapse', async () => {
  const exporter = new InMemoryMetricExporter();
  const reader = new PeriodicExportingMetricReader({ exporter, exportIntervalMillis: 3_600_000 });
  const telemetry = startTelemetry(
    {
      enabled: true,
      otlpTracesEndpoint: 'http://127.0.0.1:1/v1/traces',
      serviceName: 'gateway',
      serviceVersion: '0.1.0',
      serviceInstanceId: 'metrics-test',
    },
    { metricReader: reader, spanProcessor: new SimpleSpanProcessor(new InMemorySpanExporter()) },
  );
  try {
    const middleware = createHttpTelemetryMiddleware();
    for (const rawId of ['sensitive-user-a', 'sensitive-user-b']) {
      const response = Object.assign(new EventEmitter(), { statusCode: 200 });
      middleware(
        {
          method: 'GET',
          headers: {},
          originalUrl: `/items/${rawId}`,
          route: { path: '/items/:id' },
        },
        response,
        () => undefined,
      );
      response.emit('finish');
    }
    const response = Object.assign(new EventEmitter(), { statusCode: 404 });
    middleware(
      { method: 'USER-DEFINED-UNBOUNDED', headers: {}, originalUrl: '/private/raw-url' },
      response,
      () => undefined,
    );
    response.emit('finish');
    metrics.getMeter('metric-privacy-test').createCounter('test.bounded.count').add(1, {
      dependency_identity: 'media-minio',
      operation_name: 'get',
      trace_id: 'secret-trace',
      span_id: 'secret-span',
      request_id: 'secret-request',
      user_id: 'secret-user',
      event_id: 'secret-event',
      run_id: 'secret-run',
      fault_type: 'secret-fault',
      root_cause_service: 'secret-truth',
      'url.path': '/private/raw-url',
    });
    await telemetry.forceFlush();
    const resources = exporter.getMetrics();
    const exported = resources.flatMap((resource) =>
      resource.scopeMetrics.flatMap((scope) => scope.metrics),
    );
    const request = exported.find(
      (metric) => metric.descriptor.name === 'http.server.request.count',
    );
    expect(request?.dataPoints).toHaveLength(2);
    expect(request?.dataPoints.map((point) => point.attributes.http_method).sort()).toEqual([
      'GET',
      '_OTHER',
    ]);
    const histogram = exported.find(
      (metric) => metric.descriptor.name === 'http.server.request.duration',
    );
    const data = histogram?.dataPoints[0]?.value as { buckets: { boundaries: number[] } };
    expect(data.buckets.boundaries).toEqual(DURATION_BUCKETS_SECONDS);
    for (const metric of exported) {
      for (const point of metric.dataPoints) {
        expect(
          Object.keys(point.attributes).every((key) => METRIC_ATTRIBUTE_KEYS.includes(key)),
        ).toBe(true);
      }
    }
    expect(JSON.stringify(resources)).not.toMatch(
      /secret-|sensitive-user|private\/raw|USER-DEFINED/u,
    );
    expect(
      exported.find((metric) => metric.descriptor.name === 'process.cpu.time')?.dataPoints[0]
        ?.value,
    ).toBeGreaterThan(0);
    expect(
      exported.find((metric) => metric.descriptor.name === 'process.memory.usage')?.dataPoints[0]
        ?.value,
    ).toBeGreaterThan(0);
  } finally {
    await telemetry.shutdown();
    context.disable();
    metrics.disable();
    propagation.disable();
    trace.disable();
  }
});
