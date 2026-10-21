import { metrics } from '@opentelemetry/api';
import {
  AggregationType,
  createAllowListAttributesProcessor,
  InstrumentType,
  type ViewOptions,
} from '@opentelemetry/sdk-metrics';

export const DURATION_BUCKETS_SECONDS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
export const METRIC_ATTRIBUTE_KEYS = [
  'http_method',
  'http_route_template',
  'http_status_class',
  'dependency_identity',
  'operation_name',
  'status',
  'exchange',
  'routing_key',
];

/** Một view cho histogram và một view cho mỗi loại khác, tránh stream chồng nhau. */
export function createServiceMetricViews(): ViewOptions[] {
  return Object.values(InstrumentType).map((instrumentType) => ({
    instrumentType,
    attributesProcessors: [createAllowListAttributesProcessor(METRIC_ATTRIBUTE_KEYS)],
    aggregationCardinalityLimit: 512,
    ...(instrumentType === InstrumentType.HISTOGRAM
      ? {
          aggregation: {
            type: AggregationType.EXPLICIT_BUCKET_HISTOGRAM,
            options: { boundaries: DURATION_BUCKETS_SECONDS },
          },
        }
      : {}),
  }));
}

/** CPU cumulative seconds của process; không cộng thêm exporter CPU khác. */
export function registerProcessMetrics(): void {
  const meter = metrics.getMeter('@aiops-lms/observability');
  meter.createObservableCounter('process.cpu.time', { unit: 's' }).addCallback((result) => {
    const usage = process.cpuUsage();
    result.observe((usage.user + usage.system) / 1_000_000);
  });
  meter.createObservableGauge('process.memory.usage', { unit: 'By' }).addCallback((result) => {
    result.observe(process.memoryUsage().rss);
  });
}
