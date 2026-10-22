import {
  context,
  metrics,
  propagation,
  ROOT_CONTEXT,
  SpanKind,
  SpanStatusCode,
  trace,
  type TextMapGetter,
} from '@opentelemetry/api';
import { normalizeHttpMethod } from './http-client-span-attributes.js';

interface HttpRequest {
  baseUrl?: string;
  headers: Record<string, string | string[] | undefined>;
  method?: string;
  originalUrl?: string;
  route?: {
    path?: string | string[];
  };
  url?: string;
  once?(event: 'aborted', listener: () => void): unknown;
  removeListener?(event: 'aborted', listener: () => void): unknown;
}

interface HttpResponse {
  once(event: 'finish' | 'close', listener: () => void): unknown;
  removeListener?(event: 'finish' | 'close', listener: () => void): unknown;
  statusCode: number;
}

export type HttpTelemetryMiddleware = (
  request: HttpRequest,
  response: HttpResponse,
  next: () => void,
) => void;

const headerGetter: TextMapGetter<HttpRequest['headers']> = {
  get(carrier, key) {
    return carrier[key.toLowerCase()];
  },
  keys(carrier) {
    return Object.keys(carrier);
  },
};

function getMatchedRouteTemplate(request: HttpRequest): string | undefined {
  const routePath = request.route?.path;

  if (typeof routePath !== 'string') {
    return undefined;
  }

  const baseUrl = request.baseUrl?.replace(/\/$/, '') ?? '';
  const normalizedRoutePath = routePath.startsWith('/') ? routePath : `/${routePath}`;
  return `${baseUrl}${normalizedRoutePath}` || '/';
}

export function createHttpTelemetryMiddleware(): HttpTelemetryMiddleware {
  const tracer = trace.getTracer('@aiops-lms/observability');
  const meter = metrics.getMeter('@aiops-lms/observability');
  const requestCount = meter.createCounter('http.server.request.count');
  const errorCount = meter.createCounter('http.server.request.error.count');
  const duration = meter.createHistogram('http.server.request.duration', { unit: 's' });

  return (request, response, next) => {
    const start = performance.now();
    const method = normalizeHttpMethod(request.method);
    const parentContext = propagation.extract(ROOT_CONTEXT, request.headers, headerGetter);
    const span = tracer.startSpan(
      `${method} unmatched`,
      {
        attributes: {
          'http.request.method': method,
        },
        kind: SpanKind.SERVER,
      },
      parentContext,
    );

    let ended = false;
    const finish = (): void => finalize();
    const close = (): void => finalize('client_aborted');
    const abort = (): void => finalize('client_aborted');
    const finalize = (failure?: 'client_aborted' | 'exception'): void => {
      if (ended) return;
      ended = true;
      response.removeListener?.('finish', finish);
      response.removeListener?.('close', close);
      request.removeListener?.('aborted', abort);
      const routeTemplate = getMatchedRouteTemplate(request);
      const labels = {
        http_method: method,
        http_route_template: routeTemplate ?? 'unmatched',
        http_status_class: failure ?? `${Math.floor(response.statusCode / 100)}xx`,
      };
      requestCount.add(1, labels);
      if (failure || response.statusCode >= 500) errorCount.add(1, labels);
      duration.record((performance.now() - start) / 1_000, labels);

      if (routeTemplate) {
        span.setAttribute('http.route', routeTemplate);
        span.updateName(`${method} ${routeTemplate}`);
      }

      if (!failure) span.setAttribute('http.response.status_code', response.statusCode);
      if (failure || response.statusCode >= 500) {
        span.setAttribute('error.type', failure ?? String(response.statusCode));
        span.setStatus({ code: SpanStatusCode.ERROR });
      }
      span.end();
    };
    response.once('finish', finish);
    response.once('close', close);
    request.once?.('aborted', abort);

    try {
      context.with(trace.setSpan(parentContext, span), next);
    } catch (error) {
      span.addEvent('exception', {
        'exception.type': 'Error',
        'exception.message': 'Request handler failed',
      });
      finalize('exception');
      throw error;
    }
  };
}
