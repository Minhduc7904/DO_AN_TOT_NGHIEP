import {
  DEFAULT_OTLP_TRACES_ENDPOINT,
  DEFAULT_PORT,
  DEFAULT_SERVICE_INSTANCE_ID,
  DEFAULT_SERVICE_VERSION,
} from '../../src/config/app-config';
import { validateEnvironment } from '../../src/config/env.schema.js';

describe('validateEnvironment', () => {
  it('uses deterministic defaults', () => {
    expect(validateEnvironment({})).toEqual({
      NODE_ENV: 'development',
      OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: DEFAULT_OTLP_TRACES_ENDPOINT,
      OTEL_SDK_DISABLED: false,
      OTEL_SERVICE_INSTANCE_ID: DEFAULT_SERVICE_INSTANCE_ID,
      OTEL_SERVICE_VERSION: DEFAULT_SERVICE_VERSION,
      PORT: DEFAULT_PORT,
    });
  });

  it('coerces a valid port from environment text', () => {
    expect(validateEnvironment({ NODE_ENV: 'production', PORT: '4100' })).toEqual({
      NODE_ENV: 'production',
      OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: DEFAULT_OTLP_TRACES_ENDPOINT,
      OTEL_SDK_DISABLED: false,
      OTEL_SERVICE_INSTANCE_ID: DEFAULT_SERVICE_INSTANCE_ID,
      OTEL_SERVICE_VERSION: DEFAULT_SERVICE_VERSION,
      PORT: 4100,
    });
  });

  it('parses telemetry configuration from environment text', () => {
    expect(
      validateEnvironment({
        OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: 'http://collector:4318/v1/traces',
        OTEL_SDK_DISABLED: 'true',
        OTEL_SERVICE_INSTANCE_ID: 'course-test-2',
        OTEL_SERVICE_VERSION: '1.2.3',
      }),
    ).toMatchObject({
      OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: 'http://collector:4318/v1/traces',
      OTEL_SDK_DISABLED: true,
      OTEL_SERVICE_INSTANCE_ID: 'course-test-2',
      OTEL_SERVICE_VERSION: '1.2.3',
    });
  });

  it.each([0, 65_536, 'not-a-port'])('rejects invalid port %p', (port) => {
    expect(() => validateEnvironment({ PORT: port })).toThrow('Invalid environment configuration');
  });

  it('rejects an unsupported node environment', () => {
    expect(() => validateEnvironment({ NODE_ENV: 'staging' })).toThrow(
      'Invalid environment configuration',
    );
  });

  it.each([
    { OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: 'not-a-url' },
    { OTEL_SDK_DISABLED: 'yes' },
    { OTEL_SERVICE_INSTANCE_ID: '' },
    { OTEL_SERVICE_VERSION: '' },
  ])('rejects invalid telemetry configuration %p', (config) => {
    expect(() => validateEnvironment(config)).toThrow('Invalid environment configuration');
  });
});
