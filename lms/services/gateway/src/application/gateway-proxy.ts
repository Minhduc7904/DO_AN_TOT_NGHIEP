import {
  context,
  metrics,
  propagation,
  SpanKind,
  SpanStatusCode,
  trace,
  type Context,
} from '@opentelemetry/api';

import type { Principal } from '../domain/access-token.js';

const tracer = trace.getTracer('@aiops-lms/gateway');
const meter = metrics.getMeter('@aiops-lms/gateway');
const requestCount = meter.createCounter('gateway.dependency.request.count');
const errorCount = meter.createCounter('gateway.dependency.error.count');
const duration = meter.createHistogram('gateway.dependency.duration', { unit: 's' });

export const GATEWAY_FETCH = Symbol('GATEWAY_FETCH');
export type FetchClient = typeof fetch;

export class DependencyTimeoutError extends Error {}
export class DependencyUnavailableError extends Error {}

export type GatewayDependency =
  | 'gateway-auth'
  | 'gateway-course'
  | 'gateway-enrollment'
  | 'gateway-submission'
  | 'gateway-grading';

export interface GatewayRequest {
  body: unknown;
  dependency: GatewayDependency;
  headers: Record<string, string | string[] | undefined>;
  method: string;
  path: string;
  principal?: Principal;
  targetBaseUrl: string;
}

export interface GatewayResponse {
  body: unknown;
  contentType: string;
  status: number;
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export class GatewayProxy {
  constructor(private readonly fetchClient: FetchClient) {}

  async forward(request: GatewayRequest, timeoutMs: number): Promise<GatewayResponse> {
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const targetUrl = new URL(request.path, request.targetBaseUrl);
    const operation = request.method.toUpperCase();
    const metricAttributes = {
      dependency_identity: request.dependency,
      operation_name: operation,
    };
    const clientSpan = tracer.startSpan(
      `${operation} ${targetUrl.pathname}`,
      {
        attributes: {
          ...metricAttributes,
          'http.request.method': operation,
          'server.address': targetUrl.hostname,
          'url.path': targetUrl.pathname,
        },
        kind: SpanKind.CLIENT,
      },
      context.active(),
    );
    const clientContext = trace.setSpan(context.active(), clientSpan);
    const startedAt = performance.now();
    let status = 'ok';

    try {
      const body = request.body === undefined ? undefined : JSON.stringify(request.body);
      const init: RequestInit = {
        headers: this.createHeaders(request, clientContext),
        method: request.method,
        signal: controller.signal,
      };

      if (body !== undefined) {
        init.body = body;
      }

      const upstream = await context.with(clientContext, () => this.fetchClient(targetUrl, init));
      const rawBody = await upstream.text();
      const contentType = upstream.headers.get('content-type') ?? 'application/json; charset=utf-8';

      clientSpan.setAttribute('http.response.status_code', upstream.status);
      if (upstream.status === 504) {
        throw new DependencyTimeoutError();
      }
      if (upstream.status >= 500) {
        throw new DependencyUnavailableError();
      }

      return {
        body:
          contentType.includes('application/json') && rawBody.length > 0
            ? JSON.parse(rawBody)
            : rawBody,
        contentType,
        status: upstream.status,
      };
    } catch (error) {
      status = error instanceof DependencyTimeoutError || timedOut ? 'timeout' : 'unavailable';
      clientSpan.recordException(error instanceof Error ? error : String(error));
      clientSpan.setAttribute('error.type', status);
      clientSpan.setStatus({ code: SpanStatusCode.ERROR });
      if (error instanceof DependencyTimeoutError || timedOut) {
        throw new DependencyTimeoutError();
      }

      throw new DependencyUnavailableError();
    } finally {
      clearTimeout(timeout);
      const labels = { ...metricAttributes, status };
      requestCount.add(1, labels);
      if (status !== 'ok') errorCount.add(1, labels);
      duration.record((performance.now() - startedAt) / 1_000, labels);
      clientSpan.end();
    }
  }

  private createHeaders(request: GatewayRequest, activeContext: Context): Record<string, string> {
    const headers: Record<string, string> = {};
    const accept = firstHeader(request.headers.accept);
    const contentType = firstHeader(request.headers['content-type']);

    if (accept) {
      headers.accept = accept;
    }
    if (contentType) {
      headers['content-type'] = contentType;
    }

    const traceCarrier: Record<string, string> = {};
    propagation.inject(activeContext, traceCarrier);
    const incomingTraceparent = firstHeader(request.headers.traceparent);
    const incomingTracestate = firstHeader(request.headers.tracestate);

    if (traceCarrier.traceparent ?? incomingTraceparent) {
      headers.traceparent = traceCarrier.traceparent ?? incomingTraceparent ?? '';
    }
    if (traceCarrier.tracestate ?? incomingTracestate) {
      headers.tracestate = traceCarrier.tracestate ?? incomingTracestate ?? '';
    }

    if (request.principal) {
      headers['x-principal-id'] = request.principal.id;
      headers['x-principal-role'] = request.principal.role;
    }

    return headers;
  }
}
