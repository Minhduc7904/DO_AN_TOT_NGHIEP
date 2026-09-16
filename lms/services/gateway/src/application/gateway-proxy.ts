import { context, propagation } from '@opentelemetry/api';

import type { Principal } from '../domain/access-token.js';

export const GATEWAY_FETCH = Symbol('GATEWAY_FETCH');
export type FetchClient = typeof fetch;

export class DependencyTimeoutError extends Error {}
export class DependencyUnavailableError extends Error {}

export interface GatewayRequest {
  body: unknown;
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

    try {
      const body = request.body === undefined ? undefined : JSON.stringify(request.body);
      const init: RequestInit = {
        headers: this.createHeaders(request),
        method: request.method,
        signal: controller.signal,
      };

      if (body !== undefined) {
        init.body = body;
      }

      const upstream = await this.fetchClient(new URL(request.path, request.targetBaseUrl), init);
      const rawBody = await upstream.text();
      const contentType = upstream.headers.get('content-type') ?? 'application/json; charset=utf-8';

      return {
        body:
          contentType.includes('application/json') && rawBody.length > 0
            ? JSON.parse(rawBody)
            : rawBody,
        contentType,
        status: upstream.status,
      };
    } catch {
      if (timedOut) {
        throw new DependencyTimeoutError();
      }

      throw new DependencyUnavailableError();
    } finally {
      clearTimeout(timeout);
    }
  }

  private createHeaders(request: GatewayRequest): Record<string, string> {
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
    propagation.inject(context.active(), traceCarrier);
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
