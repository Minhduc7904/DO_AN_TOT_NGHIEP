export interface TelemetryConfig {
  enabled: boolean;
  otlpTracesEndpoint: string;
  serviceInstanceId: string;
  serviceName: string;
  serviceVersion: string;
}

function requireNonEmpty(value: string, field: keyof TelemetryConfig): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`Telemetry configuration ${field} must not be empty`);
  }

  return normalized;
}

export function defineTelemetryConfig(config: TelemetryConfig): Readonly<TelemetryConfig> {
  const endpoint = new URL(config.otlpTracesEndpoint);

  if (endpoint.protocol !== 'http:' && endpoint.protocol !== 'https:') {
    throw new Error('Telemetry configuration otlpTracesEndpoint must use HTTP or HTTPS');
  }

  return Object.freeze({
    enabled: config.enabled,
    otlpTracesEndpoint: endpoint.toString(),
    serviceInstanceId: requireNonEmpty(config.serviceInstanceId, 'serviceInstanceId'),
    serviceName: requireNonEmpty(config.serviceName, 'serviceName'),
    serviceVersion: requireNonEmpty(config.serviceVersion, 'serviceVersion'),
  });
}
