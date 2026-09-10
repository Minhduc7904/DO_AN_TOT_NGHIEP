import { startTelemetry } from '@aiops-lms/observability';

import { COURSE_SERVICE_NAME } from './config/app-config.js';
import { validateEnvironment } from './config/env.schema.js';

const environment = validateEnvironment(process.env);
const telemetry = startTelemetry({
  enabled: !environment.OTEL_SDK_DISABLED,
  otlpTracesEndpoint: environment.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
  serviceInstanceId: environment.OTEL_SERVICE_INSTANCE_ID,
  serviceName: COURSE_SERVICE_NAME,
  serviceVersion: environment.OTEL_SERVICE_VERSION,
});

try {
  const { bootstrapApplication } = await import('./bootstrap.js');
  const app = await bootstrapApplication();
  let shutdownPromise: Promise<void> | undefined;

  const shutdown = (): Promise<void> => {
    shutdownPromise ??= Promise.all([app.close(), telemetry.shutdown()]).then(() => undefined);
    return shutdownPromise;
  };

  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
} catch (error) {
  await telemetry.shutdown();
  throw error;
}
