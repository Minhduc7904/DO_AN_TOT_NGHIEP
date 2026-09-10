import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { AlwaysOnSampler, type SpanProcessor } from '@opentelemetry/sdk-trace-base';

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

  const sdk = new NodeSDK({
    resource: createTelemetryResource(config),
    sampler: new AlwaysOnSampler(),
    textMapPropagator: new W3CTraceContextPropagator(),
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
    forceFlush: () => options.spanProcessor?.forceFlush() ?? Promise.resolve(),
    shutdown: async () => {
      if (stopped) {
        return;
      }

      stopped = true;
      await sdk.shutdown();
    },
  };
}
