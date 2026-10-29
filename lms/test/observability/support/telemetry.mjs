import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

import {
  composeArguments,
  parseArguments,
  runProcess,
  validateOptions,
  verifyHealth,
} from '../../../scripts/reset-and-seed.mjs';

/**
 * Hạ tầng dùng chung cho smoke observability v2: gắn vào stack `compose.full.yaml` đã chạy (project
 * test đã xác nhận), lấy cổng host từ chính Compose, và truy vấn Tempo/Prometheus/Loki.
 */

/** Chờ `check()` không ném lỗi, tối đa `timeoutMs`; trả kết quả và thời gian chờ (ms). */
export async function poll(label, check, { timeoutMs = 90_000, intervalMs = 1_000, tag } = {}) {
  const startedAt = Date.now();
  let lastError;
  do {
    try {
      const result = await check();
      const elapsedMs = Date.now() - startedAt;
      console.info(`[${tag ?? 'observability'}] ${label}: đạt (${elapsedMs} ms)`);
      return { result, elapsedMs };
    } catch (error) {
      lastError = error;
      await delay(intervalMs);
    }
  } while (Date.now() - startedAt < timeoutMs);
  throw new Error(`${label}: quá ${timeoutMs / 1_000} giây`, { cause: lastError });
}

export async function fetchJson(url, init = {}, timeoutMs = 15_000) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  const text = await response.text();
  assert.ok(response.ok, `${new URL(url).pathname}: HTTP ${response.status}`);
  return text ? JSON.parse(text) : undefined;
}

function spanIdHex(value, width) {
  if (!value) return '';
  return /^[a-f0-9]+$/iu.test(value) && value.length <= width
    ? value.padStart(width, '0').toLowerCase()
    : Buffer.from(value, 'base64').toString('hex');
}

export function attributeValue(attributes, key) {
  const item = attributes?.find((attribute) => attribute.key === key)?.value;
  return item?.stringValue ?? item?.intValue ?? item?.doubleValue ?? item?.boolValue;
}

/** Gắn vào stack đang chạy; trả các client truy vấn và URL của từng thành phần. */
export async function attachStack(argv, tag) {
  const options = validateOptions(parseArguments(argv));
  assert.equal(options.environment, 'test', `${tag}: chỉ chạy trên project test đã xác nhận.`);
  assert.ok(options.project.startsWith('aiops-lms-test-'));
  await verifyHealth(options);
  const compose = async (args) =>
    (await runProcess('docker', composeArguments(options, args), { capture: true })).stdout;
  const configuration = JSON.parse(await compose(['config', '--format', 'json']));
  const containers = (await compose(['ps', '--all', '--format', 'json']))
    .trim()
    .split(/\r?\n/u)
    .map((line) => JSON.parse(line));
  for (const container of containers) {
    assert.equal(container.Health, 'healthy', `${container.Service} chưa healthy`);
  }

  function endpoint(service, targetPort) {
    const port = configuration.services[service].ports.find((item) => item.target === targetPort);
    assert.ok(
      port && /^\d+$/u.test(String(port.published)),
      `${service}: thiếu cổng ${targetPort}`,
    );
    const container = containers.find((item) => item.Service === service);
    assert.ok(
      container.Publishers.some(
        (item) => item.TargetPort === targetPort && item.PublishedPort === Number(port.published),
      ),
      'Cổng phải thuộc đúng project test.',
    );
    return `http://127.0.0.1:${port.published}`;
  }

  const urls = {
    gateway: endpoint('gateway', 3000),
    mailpit: endpoint('mailpit', 8025),
    rabbitmq: endpoint('rabbitmq', 15672),
    tempo: endpoint('tempo', 3200),
    prometheus: endpoint('prometheus', 9090),
    loki: endpoint('loki', 3100),
    grafana: endpoint('grafana', 3000),
  };
  const rabbitmqEnv = configuration.services.rabbitmq.environment;
  const grafanaEnv = configuration.services.grafana.environment;

  const prometheus = {
    async query(expression) {
      const data = await fetchJson(
        `${urls.prometheus}/api/v1/query?query=${encodeURIComponent(expression)}`,
      );
      assert.equal(data.status, 'success');
      return data.data.result;
    },
    async scalar(expression) {
      const rows = await this.query(expression);
      return rows.reduce((sum, row) => sum + Number(row.value[1]), 0);
    },
  };

  const loki = {
    /** `categorize-labels` tách index label khỏi structured metadata (`trace_id`, `span_id`...). */
    async query(expression, { startNs, endNs = BigInt(Date.now()) * 1_000_000n, limit = 1000 }) {
      const url = new URL(`${urls.loki}/loki/api/v1/query_range`);
      url.searchParams.set('query', expression);
      url.searchParams.set('start', String(startNs));
      url.searchParams.set('end', String(endNs));
      url.searchParams.set('limit', String(limit));
      const data = await fetchJson(url, {
        headers: { 'X-Loki-Response-Encoding-Flags': 'categorize-labels' },
      });
      assert.equal(data.status, 'success');
      return data.data.result.flatMap((stream) =>
        stream.values.map(([timestampNs, line, metadata]) => ({
          timestampNs,
          labels: stream.stream,
          line,
          metadata: metadata?.structuredMetadata ?? {},
        })),
      );
    },
  };

  const tempo = {
    async trace(traceId) {
      const data = await fetchJson(`${urls.tempo}/api/traces/${traceId}`, {}, 10_000);
      return (data.batches ?? data.resourceSpans ?? []).flatMap((batch) =>
        (batch.scopeSpans ?? []).flatMap((scope) =>
          (scope.spans ?? []).map((span) => ({
            ...span,
            service: attributeValue(batch.resource.attributes, 'service.name'),
            resource: batch.resource.attributes,
            traceId: spanIdHex(span.traceId, 32),
            spanId: spanIdHex(span.spanId, 16),
            parentSpanId: spanIdHex(span.parentSpanId, 16),
          })),
        ),
      );
    },
    /** Tìm trace theo TraceQL trong khoảng thời gian (giây epoch); trả danh sách trace id. */
    async search(
      traceql,
      { startSeconds, endSeconds = Math.floor(Date.now() / 1_000), limit = 50 },
    ) {
      const url = new URL(`${urls.tempo}/api/search`);
      url.searchParams.set('q', traceql);
      url.searchParams.set('start', String(startSeconds));
      url.searchParams.set('end', String(endSeconds));
      url.searchParams.set('limit', String(limit));
      const data = await fetchJson(url);
      return (data.traces ?? []).map((trace) => trace.traceID);
    },
  };

  return {
    options,
    configuration,
    containers,
    compose,
    urls,
    prometheus,
    loki,
    tempo,
    rabbitmq: {
      authorization: `Basic ${Buffer.from(
        `${rabbitmqEnv.RABBITMQ_DEFAULT_USER}:${rabbitmqEnv.RABBITMQ_DEFAULT_PASS}`,
      ).toString('base64')}`,
    },
    grafana: {
      authorization: `Basic ${Buffer.from(
        `${grafanaEnv.GF_SECURITY_ADMIN_USER}:${grafanaEnv.GF_SECURITY_ADMIN_PASSWORD}`,
      ).toString('base64')}`,
    },
  };
}

/** Tập `service.name` có span trong trace, sắp xếp để so sánh và in. */
export function traceServices(spans) {
  return [...new Set(spans.map((span) => span.service))].sort();
}

/** Mọi span (trừ root của trace) phải có parent trong cùng trace; trả số span root. */
export function assertParentChain(spans, label) {
  const ids = new Set(spans.map((span) => span.spanId));
  assert.equal(ids.size, spans.length, `${label}: span trùng`);
  const roots = spans.filter((span) => !span.parentSpanId || !ids.has(span.parentSpanId));
  return roots;
}
