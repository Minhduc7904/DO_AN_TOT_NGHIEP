import {
  createTelemetryResource,
  TELEMETRY_RESOURCE_ATTRIBUTES,
} from '../../src/telemetry-resource.js';

describe('createTelemetryResource', () => {
  it('uses the canonical configured service identity', () => {
    const resource = createTelemetryResource({
      enabled: true,
      otlpTracesEndpoint: 'http://collector:4318/v1/traces',
      serviceInstanceId: 'course-test-1',
      serviceName: 'course',
      serviceVersion: '1.2.3',
    });

    expect(resource.attributes).toMatchObject({
      [TELEMETRY_RESOURCE_ATTRIBUTES.serviceInstanceId]: 'course-test-1',
      [TELEMETRY_RESOURCE_ATTRIBUTES.serviceName]: 'course',
      [TELEMETRY_RESOURCE_ATTRIBUTES.serviceVersion]: '1.2.3',
    });
  });
});
