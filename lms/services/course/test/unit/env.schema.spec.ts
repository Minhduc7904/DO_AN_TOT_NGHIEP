import {
  DEFAULT_COURSE_DATABASE_URL,
  DEFAULT_COURSE_REDIS_URL,
  DEFAULT_COURSE_CACHE_TTL_SECONDS,
  DEFAULT_COURSE_CACHE_TIMEOUT_MS,
  DEFAULT_OTLP_TRACES_ENDPOINT,
  DEFAULT_PORT,
  DEFAULT_SERVICE_INSTANCE_ID,
  DEFAULT_SERVICE_VERSION,
} from '../../src/config/app-config';
import { validateEnvironment } from '../../src/config/env.schema.js';

describe('validateEnvironment', () => {
  it('uses deterministic defaults', () => {
    expect(validateEnvironment({})).toEqual({
      COURSE_DATABASE_URL: DEFAULT_COURSE_DATABASE_URL,
      COURSE_REDIS_URL: DEFAULT_COURSE_REDIS_URL,
      COURSE_CACHE_TTL_SECONDS: DEFAULT_COURSE_CACHE_TTL_SECONDS,
      COURSE_CACHE_TIMEOUT_MS: DEFAULT_COURSE_CACHE_TIMEOUT_MS,
      HTTP_ACCESS_LOG_ENABLED: true,
      NODE_ENV: 'development',
      OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: DEFAULT_OTLP_TRACES_ENDPOINT,
      OTEL_METRIC_EXPORT_INTERVAL: 5000,
      OTEL_SDK_DISABLED: false,
      OTEL_SERVICE_INSTANCE_ID: DEFAULT_SERVICE_INSTANCE_ID,
      OTEL_SERVICE_VERSION: DEFAULT_SERVICE_VERSION,
      PORT: DEFAULT_PORT,
    });
  });

  it('coerces a valid port from environment text', () => {
    expect(validateEnvironment({ NODE_ENV: 'production', PORT: '4100' })).toEqual({
      COURSE_DATABASE_URL: DEFAULT_COURSE_DATABASE_URL,
      COURSE_REDIS_URL: DEFAULT_COURSE_REDIS_URL,
      COURSE_CACHE_TTL_SECONDS: DEFAULT_COURSE_CACHE_TTL_SECONDS,
      COURSE_CACHE_TIMEOUT_MS: DEFAULT_COURSE_CACHE_TIMEOUT_MS,
      HTTP_ACCESS_LOG_ENABLED: true,
      NODE_ENV: 'production',
      OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: DEFAULT_OTLP_TRACES_ENDPOINT,
      OTEL_METRIC_EXPORT_INTERVAL: 5000,
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
        OTEL_EXPORTER_OTLP_METRICS_ENDPOINT: 'http://metrics:4318/custom',
        OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: 'http://logs:4318/custom',
        OTEL_METRIC_EXPORT_INTERVAL: '1000',
        OTEL_SDK_DISABLED: 'true',
        HTTP_ACCESS_LOG_ENABLED: 'false',
        OTEL_SERVICE_INSTANCE_ID: 'course-test-2',
        OTEL_SERVICE_VERSION: '1.2.3',
      }),
    ).toMatchObject({
      OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: 'http://collector:4318/v1/traces',
      OTEL_EXPORTER_OTLP_METRICS_ENDPOINT: 'http://metrics:4318/custom',
      OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: 'http://logs:4318/custom',
      OTEL_METRIC_EXPORT_INTERVAL: 1000,
      OTEL_SDK_DISABLED: true,
      HTTP_ACCESS_LOG_ENABLED: false,
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
    { OTEL_EXPORTER_OTLP_METRICS_ENDPOINT: 'not-a-url' },
    { OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: 'not-a-url' },
    { OTEL_METRIC_EXPORT_INTERVAL: '0' },
    { OTEL_SDK_DISABLED: 'yes' },
    { HTTP_ACCESS_LOG_ENABLED: 'yes' },
    { OTEL_SERVICE_INSTANCE_ID: '' },
    { OTEL_SERVICE_VERSION: '' },
  ])('rejects invalid telemetry configuration %p', (config) => {
    expect(() => validateEnvironment(config)).toThrow('Invalid environment configuration');
  });
});
