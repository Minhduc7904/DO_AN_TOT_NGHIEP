import {
  defineTelemetryConfig,
  resolveLogsEndpoint,
  resolveMetricsEndpoint,
} from '../../src/telemetry-config.js';

const validConfig = {
  enabled: true,
  otlpTracesEndpoint: 'http://collector:4318/v1/traces',
  serviceInstanceId: 'course-test-1',
  serviceName: 'course',
  serviceVersion: '1.2.3',
};

describe('defineTelemetryConfig', () => {
  it('derives the metric endpoint without losing an existing proxy path prefix', () => {
    expect(
      resolveMetricsEndpoint({
        ...validConfig,
        otlpTracesEndpoint: 'http://collector:4318/proxy/v1/traces',
      }),
    ).toBe('http://collector:4318/proxy/v1/metrics');
    expect(
      resolveMetricsEndpoint({
        ...validConfig,
        otlpMetricsEndpoint: 'http://other:4318/custom-metrics',
      }),
    ).toBe('http://other:4318/custom-metrics');
  });
  it('derives the logs endpoint like metrics and keeps an explicit override', () => {
    expect(
      resolveLogsEndpoint({
        ...validConfig,
        otlpTracesEndpoint: 'http://collector:4318/proxy/v1/traces',
      }),
    ).toBe('http://collector:4318/proxy/v1/logs');
    expect(
      resolveLogsEndpoint({ ...validConfig, otlpLogsEndpoint: 'http://other:4318/custom-logs' }),
    ).toBe('http://other:4318/custom-logs');
    expect(() =>
      defineTelemetryConfig({ ...validConfig, otlpLogsEndpoint: 'file:///logs' }),
    ).toThrow('otlpLogsEndpoint');
  });
  it('keeps an explicit metric endpoint and export interval', () => {
    expect(
      defineTelemetryConfig({
        ...validConfig,
        otlpMetricsEndpoint: 'http://metrics:4318/custom',
        metricExportIntervalMillis: 5_000,
      }),
    ).toMatchObject({
      otlpMetricsEndpoint: 'http://metrics:4318/custom',
      metricExportIntervalMillis: 5_000,
    });
  });
  it('rejects a metric endpoint outside HTTP or an invalid interval', () => {
    expect(() =>
      defineTelemetryConfig({ ...validConfig, otlpMetricsEndpoint: 'file:///metrics' }),
    ).toThrow('otlpMetricsEndpoint');
    expect(() => defineTelemetryConfig({ ...validConfig, metricExportIntervalMillis: 0 })).toThrow(
      'metricExportIntervalMillis',
    );
  });
  it.each(['submission-storage-mock', 'gateway-container', 'not-a-service'])(
    'rejects a container name or unknown resource identity: %s',
    (serviceName) => {
      expect(() => defineTelemetryConfig({ ...validConfig, serviceName })).toThrow(
        'runtime catalogue',
      );
    },
  );
  it.each(['ai', 'ai-worker', 'scheduler', 'scheduler-worker', 'media-worker'])(
    'accepts the v2 runtime service name: %s',
    (serviceName) => {
      expect(defineTelemetryConfig({ ...validConfig, serviceName }).serviceName).toBe(serviceName);
    },
  );
  it('normalizes and freezes valid configuration', () => {
    const config = defineTelemetryConfig(validConfig);

    expect(config).toEqual(validConfig);
    expect(Object.isFrozen(config)).toBe(true);
  });

  it.each(['serviceInstanceId', 'serviceName', 'serviceVersion'] as const)(
    'rejects an empty %s',
    (field) => {
      expect(() => defineTelemetryConfig({ ...validConfig, [field]: ' ' })).toThrow(field);
    },
  );

  it('rejects a non-HTTP exporter endpoint', () => {
    expect(() =>
      defineTelemetryConfig({ ...validConfig, otlpTracesEndpoint: 'file:///tmp/traces' }),
    ).toThrow('must use HTTP or HTTPS');
  });
});
