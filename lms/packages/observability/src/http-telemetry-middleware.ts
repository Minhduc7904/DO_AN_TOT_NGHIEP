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
import { emitStructuredLog } from './structured-logger.js';

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

export interface HttpTelemetryOptions {
  /**
   * Access log `http.server.request` cho request không lỗi (INFO, 4xx là WARN). Lỗi 5xx/aborted luôn
   * ghi `http.server.error`. Mặc định bật và bỏ qua `/health` để probe không làm nhiễu log.
   */
  accessLog?: {
    enabled?: boolean;
    ignoreRoutes?: readonly string[];
  };
}

const DEFAULT_ACCESS_LOG_IGNORED_ROUTES = ['/health'] as const;

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

export function createHttpTelemetryMiddleware(
  options: HttpTelemetryOptions = {},
): HttpTelemetryMiddleware {
  const accessLogEnabled = options.accessLog?.enabled ?? true;
  const accessLogIgnoredRoutes = new Set<string>(
    options.accessLog?.ignoreRoutes ?? DEFAULT_ACCESS_LOG_IGNORED_ROUTES,
  );
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
      const elapsedMillis = performance.now() - start;
      requestCount.add(1, labels);
      if (failure || response.statusCode >= 500) errorCount.add(1, labels);
      duration.record(elapsedMillis / 1_000, labels);

      if (routeTemplate) {
        span.setAttribute('http.route', routeTemplate);
        span.updateName(`${method} ${routeTemplate}`);
      }

      if (!failure) span.setAttribute('http.response.status_code', response.statusCode);
      const errorType =
        failure ?? (response.statusCode >= 500 ? String(response.statusCode) : undefined);
      if (errorType) {
        span.setAttribute('error.type', errorType);
        span.setStatus({ code: SpanStatusCode.ERROR });
      }
      if (
        errorType ||
        (accessLogEnabled && !accessLogIgnoredRoutes.has(labels.http_route_template))
      ) {
        const route = labels.http_route_template;
        const fields = {
          duration_ms: Math.round(elapsedMillis * 1_000) / 1_000,
          http_method: method,
          http_route: route,
          ...(failure ? {} : { http_status_code: response.statusCode }),
        };
        context.with(trace.setSpan(parentContext, span), () =>
          errorType
            ? emitStructuredLog('error', `HTTP ${method} ${route} lỗi ${errorType}`, {
                ...fields,
                error_type: errorType,
                event: 'http.server.error',
              })
            : emitStructuredLog(
                response.statusCode >= 400 ? 'warn' : 'log',
                `HTTP ${method} ${route} ${response.statusCode}`,
                { ...fields, event: 'http.server.request' },
              ),
        );
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
