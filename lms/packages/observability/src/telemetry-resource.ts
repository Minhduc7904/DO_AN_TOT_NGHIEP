import { resourceFromAttributes, type Resource } from '@opentelemetry/resources';

import type { TelemetryConfig } from './telemetry-config.js';

export const TELEMETRY_RESOURCE_ATTRIBUTES = {
  serviceInstanceId: 'service.instance.id',
  serviceName: 'service.name',
  serviceVersion: 'service.version',
} as const;

export function createTelemetryResource(config: TelemetryConfig): Resource {
  return resourceFromAttributes({
    [TELEMETRY_RESOURCE_ATTRIBUTES.serviceInstanceId]: config.serviceInstanceId,
    [TELEMETRY_RESOURCE_ATTRIBUTES.serviceName]: config.serviceName,
    [TELEMETRY_RESOURCE_ATTRIBUTES.serviceVersion]: config.serviceVersion,
  });
}
