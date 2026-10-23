export interface TelemetryConfig {
  enabled: boolean;
  otlpTracesEndpoint: string;
  otlpMetricsEndpoint?: string | undefined;
  otlpLogsEndpoint?: string | undefined;
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

function resolveSignalEndpoint(
  config: TelemetryConfig,
  override: string | undefined,
  signal: 'metrics' | 'logs',
): string {
  if (override) return new URL(override).toString();
  const endpoint = new URL(config.otlpTracesEndpoint);
  endpoint.pathname = /\/v1\/traces\/?$/u.test(endpoint.pathname)
    ? endpoint.pathname.replace(/\/v1\/traces\/?$/u, `/v1/${signal}`)
    : `/v1/${signal}`;
  return endpoint.toString();
}

export function resolveMetricsEndpoint(config: TelemetryConfig): string {
  return resolveSignalEndpoint(config, config.otlpMetricsEndpoint, 'metrics');
}

export function resolveLogsEndpoint(config: TelemetryConfig): string {
  return resolveSignalEndpoint(config, config.otlpLogsEndpoint, 'logs');
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
  for (const field of ['otlpMetricsEndpoint', 'otlpLogsEndpoint'] as const) {
    const value = config[field];
    if (value && !['http:', 'https:'].includes(new URL(value).protocol)) {
      throw new Error(`Telemetry configuration ${field} must use HTTP or HTTPS`);
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
    ...(config.otlpLogsEndpoint
      ? { otlpLogsEndpoint: new URL(config.otlpLogsEndpoint).toString() }
      : {}),
    ...(config.metricExportIntervalMillis !== undefined
      ? { metricExportIntervalMillis: config.metricExportIntervalMillis }
      : {}),
    serviceInstanceId: requireNonEmpty(config.serviceInstanceId, 'serviceInstanceId'),
    serviceName,
    serviceVersion: requireNonEmpty(config.serviceVersion, 'serviceVersion'),
  });
}
