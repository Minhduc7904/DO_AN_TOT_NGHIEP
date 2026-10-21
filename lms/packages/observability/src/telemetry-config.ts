export interface TelemetryConfig {
  enabled: boolean;
  otlpTracesEndpoint: string;
  otlpMetricsEndpoint?: string | undefined;
  metricExportIntervalMillis?: number;
  serviceInstanceId: string;
  serviceName: string;
  serviceVersion: string;
}

const RUNTIME_SERVICE_NAMES = new Set([
  'gateway',
  'auth',
  'course',
  'enrollment',
  'submission',
  'grading',
  'notification',
  'submission-storage',
]);

export function resolveMetricsEndpoint(config: TelemetryConfig): string {
  if (config.otlpMetricsEndpoint) return new URL(config.otlpMetricsEndpoint).toString();
  const endpoint = new URL(config.otlpTracesEndpoint);
  endpoint.pathname = /\/v1\/traces\/?$/u.test(endpoint.pathname)
    ? endpoint.pathname.replace(/\/v1\/traces\/?$/u, '/v1/metrics')
    : '/v1/metrics';
  return endpoint.toString();
}

function requireNonEmpty(value: string, field: keyof TelemetryConfig): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`Telemetry configuration ${field} must not be empty`);
  }

  return normalized;
}

export function defineTelemetryConfig(config: TelemetryConfig): Readonly<TelemetryConfig> {
  const serviceName = requireNonEmpty(config.serviceName, 'serviceName');
  if (!RUNTIME_SERVICE_NAMES.has(serviceName)) {
    throw new Error('Telemetry configuration serviceName must match the runtime catalogue');
  }
  const endpoint = new URL(config.otlpTracesEndpoint);

  if (endpoint.protocol !== 'http:' && endpoint.protocol !== 'https:') {
    throw new Error('Telemetry configuration otlpTracesEndpoint must use HTTP or HTTPS');
  }
  if (config.otlpMetricsEndpoint) {
    const metricsEndpoint = new URL(config.otlpMetricsEndpoint);
    if (!['http:', 'https:'].includes(metricsEndpoint.protocol)) {
      throw new Error('Telemetry configuration otlpMetricsEndpoint must use HTTP or HTTPS');
    }
  }
  if (
    config.metricExportIntervalMillis !== undefined &&
    (!Number.isInteger(config.metricExportIntervalMillis) ||
      config.metricExportIntervalMillis < 1_000 ||
      config.metricExportIntervalMillis > 60_000)
  ) {
    throw new Error('Telemetry configuration metricExportIntervalMillis must be 1000–60000');
  }

  return Object.freeze({
    enabled: config.enabled,
    otlpTracesEndpoint: endpoint.toString(),
    ...(config.otlpMetricsEndpoint
      ? { otlpMetricsEndpoint: new URL(config.otlpMetricsEndpoint).toString() }
      : {}),
    ...(config.metricExportIntervalMillis !== undefined
      ? { metricExportIntervalMillis: config.metricExportIntervalMillis }
      : {}),
    serviceInstanceId: requireNonEmpty(config.serviceInstanceId, 'serviceInstanceId'),
    serviceName,
    serviceVersion: requireNonEmpty(config.serviceVersion, 'serviceVersion'),
  });
}
