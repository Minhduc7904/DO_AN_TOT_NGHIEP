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

interface HttpRequest {
  baseUrl?: string;
  headers: Record<string, string | string[] | undefined>;
  method?: string;
  originalUrl?: string;
  route?: {
    path?: string | string[];
  };
  url?: string;
}

interface HttpResponse {
  once(event: 'finish', listener: () => void): unknown;
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

function getRequestPath(request: HttpRequest): string {
  const rawUrl = request.originalUrl ?? request.url ?? '/';

  try {
    return new URL(rawUrl, 'http://telemetry.local').pathname;
  } catch {
    return '/';
  }
}

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
    const method = request.method?.toUpperCase() ?? 'HTTP';
    const path = getRequestPath(request);
    const parentContext = propagation.extract(ROOT_CONTEXT, request.headers, headerGetter);
    const span = tracer.startSpan(
      `${method} ${path}`,
      {
        attributes: {
          'http.request.method': method,
          'url.path': path,
        },
        kind: SpanKind.SERVER,
      },
      parentContext,
    );

    response.once('finish', () => {
      const routeTemplate = getMatchedRouteTemplate(request);
      const labels = {
        http_method: method,
        http_route_template: routeTemplate ?? 'unmatched',
        http_status_class: `${Math.floor(response.statusCode / 100)}xx`,
      };
      requestCount.add(1, labels);
      if (response.statusCode >= 500) errorCount.add(1, labels);
      duration.record((performance.now() - start) / 1_000, labels);

      if (routeTemplate) {
        span.setAttribute('http.route', routeTemplate);
        span.updateName(`${method} ${routeTemplate}`);
      }

      span.setAttribute('http.response.status_code', response.statusCode);

      if (response.statusCode >= 500) {
        span.setAttribute('error.type', String(response.statusCode));
        span.setStatus({ code: SpanStatusCode.ERROR });
      }

      span.end();
    });

    try {
      context.with(trace.setSpan(parentContext, span), next);
    } catch (error) {
      span.recordException(error instanceof Error ? error : String(error));
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    }
  };
}
