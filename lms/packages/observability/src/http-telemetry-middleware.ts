import {
  context,
  propagation,
  ROOT_CONTEXT,
  SpanKind,
  SpanStatusCode,
  trace,
  type TextMapGetter,
} from '@opentelemetry/api';

interface HttpRequest {
  headers: Record<string, string | string[] | undefined>;
  method?: string;
  originalUrl?: string;
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

export function createHttpTelemetryMiddleware(): HttpTelemetryMiddleware {
  const tracer = trace.getTracer('@aiops-lms/observability');

  return (request, response, next) => {
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
