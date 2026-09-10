import { startTelemetry } from '../../src/telemetry-bootstrap.js';

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
});
