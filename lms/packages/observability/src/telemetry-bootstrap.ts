import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  AlwaysOnSampler,
  BatchSpanProcessor,
  type SpanExporter,
  type SpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { PeriodicExportingMetricReader, type MetricReader } from '@opentelemetry/sdk-metrics';
import { BatchLogRecordProcessor, type LogRecordProcessor } from '@opentelemetry/sdk-logs';

import {
  defineTelemetryConfig,
  resolveLogsEndpoint,
  resolveMetricsEndpoint,
  type TelemetryConfig,
} from './telemetry-config.js';
import { createTelemetryResource } from './telemetry-resource.js';
import { createServiceMetricViews, registerProcessMetrics } from './service-metrics.js';
import { telemetryHttpTransportOptions } from './telemetry-http-transport.js';
import { configureStructuredLogging } from './structured-logger.js';

export interface TelemetryHandle {
  readonly config: Readonly<TelemetryConfig>;
  readonly started: boolean;
  forceFlush(): Promise<void>;
  shutdown(): Promise<void>;
}

export interface TelemetryStartOptions {
  spanProcessor?: SpanProcessor;
  traceExporter?: SpanExporter;
  metricsEnabled?: boolean;
  metricReader?: MetricReader;
  logsEnabled?: boolean;
  logRecordProcessor?: LogRecordProcessor;
}

export function startTelemetry(
  rawConfig: TelemetryConfig,
  options: TelemetryStartOptions = {},
): TelemetryHandle {
  const config = defineTelemetryConfig(rawConfig);
  configureStructuredLogging(config);

  if (!config.enabled) {
    return {
      config,
      started: false,
      forceFlush: () => Promise.resolve(),
      shutdown: () => Promise.resolve(),
    };
  }

  const metricReader =
    options.metricReader ??
    (options.metricsEnabled
      ? new PeriodicExportingMetricReader({
          exporter: new OTLPMetricExporter({
            ...telemetryHttpTransportOptions(),
            url: resolveMetricsEndpoint(config),
          }),
          exportIntervalMillis: config.metricExportIntervalMillis ?? 5_000,
          exportTimeoutMillis: Math.min(config.metricExportIntervalMillis ?? 5_000, 3_000),
        })
      : undefined);
  const spanProcessor =
    options.spanProcessor ??
    new BatchSpanProcessor(
      options.traceExporter ??
        new OTLPTraceExporter({
          ...telemetryHttpTransportOptions(),
          url: config.otlpTracesEndpoint,
        }),
      { exportTimeoutMillis: 2_000 },
    );
  // Truyền danh sách rỗng khi tắt logs để NodeSDK không tự dựng OTLP log exporter từ môi trường.
  const logRecordProcessor =
    options.logRecordProcessor ??
    (options.logsEnabled
      ? new BatchLogRecordProcessor({
          exporter: new OTLPLogExporter({
            ...telemetryHttpTransportOptions(),
            url: resolveLogsEndpoint(config),
          }),
          exportTimeoutMillis: 2_000,
        })
      : undefined);
  const sdk = new NodeSDK({
    autoDetectResources: false,
    resource: createTelemetryResource(config),
    sampler: new AlwaysOnSampler(),
    textMapPropagator: new W3CTraceContextPropagator(),
    metricReaders: metricReader ? [metricReader] : [],
    views: createServiceMetricViews(),
    spanProcessors: [spanProcessor],
    logRecordProcessors: logRecordProcessor ? [logRecordProcessor] : [],
  });

  sdk.start();
  if (metricReader) registerProcessMetrics();
  let stopped = false;

  return {
    config,
    started: true,
    forceFlush: async () => {
      await spanProcessor.forceFlush();
      await metricReader?.forceFlush();
      await logRecordProcessor?.forceFlush();
    },
    shutdown: async () => {
      if (stopped) {
        return;
      }

      stopped = true;
      await sdk.shutdown();
    },
  };
}
