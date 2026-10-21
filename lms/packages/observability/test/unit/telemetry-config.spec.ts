import { defineTelemetryConfig } from '../../src/telemetry-config.js';

const validConfig = {
  enabled: true,
  otlpTracesEndpoint: 'http://collector:4318/v1/traces',
  serviceInstanceId: 'course-test-1',
  serviceName: 'course',
  serviceVersion: '1.2.3',
};

describe('defineTelemetryConfig', () => {
  it.each(['submission-storage-mock', 'gateway-container', 'not-a-service'])(
    'rejects a container name or unknown resource identity: %s',
    (serviceName) => {
      expect(() => defineTelemetryConfig({ ...validConfig, serviceName })).toThrow(
        'runtime catalogue',
      );
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
