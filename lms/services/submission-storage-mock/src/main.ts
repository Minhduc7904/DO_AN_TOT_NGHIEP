import { startTelemetry } from '@aiops-lms/observability';

import { STORAGE_MOCK_SERVICE_NAME } from './config/app-config.js';
import { validateEnvironment } from './config/env.schema.js';

const environment = validateEnvironment(process.env);
const telemetry = startTelemetry(
  {
    enabled: !environment.OTEL_SDK_DISABLED,
    otlpTracesEndpoint: environment.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
    otlpMetricsEndpoint: environment.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT,
    otlpLogsEndpoint: environment.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT,
    metricExportIntervalMillis: environment.OTEL_METRIC_EXPORT_INTERVAL,
    serviceInstanceId: environment.OTEL_SERVICE_INSTANCE_ID,
    serviceName: STORAGE_MOCK_SERVICE_NAME,
    serviceVersion: environment.OTEL_SERVICE_VERSION,
  },
  { logsEnabled: true, metricsEnabled: true },
);

try {
  const { bootstrapApplication } = await import('./bootstrap.js');
  const app = await bootstrapApplication();
  let shutdownPromise: Promise<void> | undefined;
  const shutdown = (): Promise<void> => {
    // Đóng app trước để span/log phát ra lúc shutdown còn được flush.
    shutdownPromise ??= app.close().finally(() => telemetry.shutdown());
    return shutdownPromise;
  };
  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
} catch (error) {
  await telemetry.shutdown();
  throw error;
}
