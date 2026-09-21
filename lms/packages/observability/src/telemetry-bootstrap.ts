import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { AlwaysOnSampler, type SpanProcessor } from '@opentelemetry/sdk-trace-base';
import { PeriodicExportingMetricReader, type MetricReader } from '@opentelemetry/sdk-metrics';

import { defineTelemetryConfig, type TelemetryConfig } from './telemetry-config.js';
import { createTelemetryResource } from './telemetry-resource.js';

export interface TelemetryHandle {
  readonly config: Readonly<TelemetryConfig>;
  readonly started: boolean;
  forceFlush(): Promise<void>;
  shutdown(): Promise<void>;
}

export interface TelemetryStartOptions {
  spanProcessor?: SpanProcessor;
  metricsEnabled?: boolean;
  metricReader?: MetricReader;
}

export function startTelemetry(
  rawConfig: TelemetryConfig,
  options: TelemetryStartOptions = {},
): TelemetryHandle {
  const config = defineTelemetryConfig(rawConfig);

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
            url: config.otlpTracesEndpoint.replace(/\/v1\/traces$/, '/v1/metrics'),
          }),
        })
      : undefined);
  const sdk = new NodeSDK({
    resource: createTelemetryResource(config),
    sampler: new AlwaysOnSampler(),
    textMapPropagator: new W3CTraceContextPropagator(),
    ...(metricReader ? { metricReader } : {}),
    ...(options.spanProcessor
      ? { spanProcessors: [options.spanProcessor] }
      : {
          traceExporter: new OTLPTraceExporter({
            url: config.otlpTracesEndpoint,
          }),
        }),
  });

  sdk.start();
  let stopped = false;

  return {
    config,
    started: true,
    forceFlush: async () => {
      await options.spanProcessor?.forceFlush();
      await metricReader?.forceFlush();
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
