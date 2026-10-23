import { context, isSpanContextValid, trace, type Span } from '@opentelemetry/api';
import { logs, SeverityNumber, type AnyValueMap } from '@opentelemetry/api-logs';

import type { TelemetryConfig } from './telemetry-config.js';
import { TELEMETRY_RESOURCE_ATTRIBUTES } from './telemetry-resource.js';

export type StructuredLogLevel = 'verbose' | 'debug' | 'log' | 'warn' | 'error' | 'fatal';

const SEVERITY: Readonly<Record<StructuredLogLevel, { number: SeverityNumber; text: string }>> = {
  verbose: { number: SeverityNumber.TRACE, text: 'TRACE' },
  debug: { number: SeverityNumber.DEBUG, text: 'DEBUG' },
  log: { number: SeverityNumber.INFO, text: 'INFO' },
  warn: { number: SeverityNumber.WARN, text: 'WARN' },
  error: { number: SeverityNumber.ERROR, text: 'ERROR' },
  fatal: { number: SeverityNumber.FATAL, text: 'FATAL' },
};

/** Field có ngữ nghĩa ổn định được phép ghi; mọi key khác bị bỏ để không lộ payload/PII. */
export interface StructuredLogFields {
  dependency_identity?: string;
  error_type?: string;
  event?: string;
  event_id?: string;
  http_method?: string;
  http_route?: string;
  http_status_code?: number;
  operation_name?: string;
  outcome?: string;
}

const FIELD_KEYS = [
  'dependency_identity',
  'error_type',
  'event',
  'event_id',
  'http_method',
  'http_route',
  'http_status_code',
  'operation_name',
  'outcome',
] as const satisfies readonly (keyof StructuredLogFields)[];

const DEFAULT_LEVELS: readonly StructuredLogLevel[] = ['log', 'warn', 'error', 'fatal'];
const MAX_MESSAGE_LENGTH = 2_000;
const MAX_FIELD_LENGTH = 200;
const STACK_FORMAT = /^.+\n\s+at .+/su;

// Che credential/PII phổ biến trước khi log rời process; không thay thế việc không đưa payload vào log.
const REDACTIONS: readonly [RegExp, string][] = [
  [/\b(bearer|basic)\s+[\w.~+/=-]+/giu, '$1 [REDACTED]'],
  [/\beyJ[\w-]+\.[\w-]+\.[\w-]+/gu, '[REDACTED_JWT]'],
  [/(\b[a-z][a-z0-9+.-]*:\/\/)[^\s/:@]+:[^\s/@]+@/giu, '$1[REDACTED]@'],
  [
    /\b(password|passwd|pwd|secret|token|access[_-]?token|refresh[_-]?token|api[_-]?key|authorization)(["']?\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,;&}]+)/giu,
    '$1$2[REDACTED]',
  ],
  [/[\w.+-]+@[\w-]+(\.[\w-]+)+/gu, '[REDACTED_EMAIL]'],
];

interface LoggingIdentity {
  serviceInstanceId: string;
  serviceName: string;
  serviceVersion: string;
}

let identity: LoggingIdentity | undefined;
let writeLine = (line: string): void => {
  process.stdout.write(`${line}\n`);
};

/** Gắn resource identity cho log stdout; `startTelemetry` gọi hàm này với config đã kiểm tra. */
export function configureStructuredLogging(
  config: Pick<TelemetryConfig, 'serviceInstanceId' | 'serviceName' | 'serviceVersion'>,
  options: { write?: (line: string) => void } = {},
): void {
  identity = {
    serviceInstanceId: config.serviceInstanceId,
    serviceName: config.serviceName,
    serviceVersion: config.serviceVersion,
  };
  if (options.write) writeLine = options.write;
}

export function sanitizeLogText(text: string, maxLength = MAX_MESSAGE_LENGTH): string {
  const redacted = REDACTIONS.reduce(
    (value, [pattern, replacement]) => value.replace(pattern, replacement),
    text,
  );
  return redacted.length > maxLength ? `${redacted.slice(0, maxLength)}…` : redacted;
}

function sanitizeFields(fields: StructuredLogFields): AnyValueMap {
  const attributes: AnyValueMap = {};
  for (const key of FIELD_KEYS) {
    const value = fields[key];
    if (typeof value === 'string' && value.trim()) {
      attributes[key] = sanitizeLogText(value, MAX_FIELD_LENGTH);
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      attributes[key] = value;
    }
  }
  return attributes;
}

/**
 * Ghi một log JSON ra stdout và một OTel log record. `trace_id`/`span_id` lấy từ active span;
 * ngoài span context thì bỏ trống thay vì tạo ID giả.
 */
export function emitStructuredLog(
  level: StructuredLogLevel,
  message: string,
  fields: StructuredLogFields = {},
  extra: { logger?: string | undefined; stack?: string | undefined } = {},
): void {
  const severity = SEVERITY[level];
  const activeSpan = trace.getSpan(context.active())?.spanContext();
  const spanContext = activeSpan && isSpanContextValid(activeSpan) ? activeSpan : undefined;
  const body = sanitizeLogText(message);
  const attributes = sanitizeFields(fields);
  if (extra.logger) attributes.logger = sanitizeLogText(extra.logger, MAX_FIELD_LENGTH);
  if (extra.stack) attributes['exception.stacktrace'] = sanitizeLogText(extra.stack);
  const timestamp = new Date();

  writeLine(
    JSON.stringify({
      timestamp: timestamp.toISOString(),
      level: severity.text,
      message: body,
      ...(identity && {
        [TELEMETRY_RESOURCE_ATTRIBUTES.serviceName]: identity.serviceName,
        [TELEMETRY_RESOURCE_ATTRIBUTES.serviceVersion]: identity.serviceVersion,
        [TELEMETRY_RESOURCE_ATTRIBUTES.serviceInstanceId]: identity.serviceInstanceId,
      }),
      ...(spanContext && { trace_id: spanContext.traceId, span_id: spanContext.spanId }),
      ...attributes,
    }),
  );
  logs.getLogger('@aiops-lms/observability').emit({
    attributes,
    body,
    severityNumber: severity.number,
    severityText: severity.text,
    timestamp,
  });
}

/** Ghi lỗi dependency trong context của span client để log nối đúng trace/span của lời gọi lỗi. */
export function logDependencyFailure(
  span: Span,
  fields: { dependency_identity: string; error_type: string; operation_name: string },
): void {
  context.with(trace.setSpan(context.active(), span), () =>
    emitStructuredLog(
      'error',
      `Dependency ${fields.dependency_identity} ${fields.operation_name} lỗi ${fields.error_type}`,
      { ...fields, event: 'dependency.failure' },
    ),
  );
}

function isStack(value: unknown): value is string {
  return typeof value === 'string' && STACK_FORMAT.test(value);
}

/**
 * Logger tương thích `LoggerService` của NestJS (không phụ thuộc `@nestjs/common`). Message có thể là
 * chuỗi, `Error` hoặc object `{ message, ...StructuredLogFields }`; field ngoài allowlist bị bỏ.
 */
export class StructuredLogger {
  private levels = new Set<StructuredLogLevel>(DEFAULT_LEVELS);

  constructor(private readonly loggerName?: string) {}

  setLogLevels(levels: StructuredLogLevel[]): void {
    this.levels = new Set(levels);
  }

  verbose(message: unknown, ...params: unknown[]): void {
    this.write('verbose', message, params);
  }

  debug(message: unknown, ...params: unknown[]): void {
    this.write('debug', message, params);
  }

  log(message: unknown, ...params: unknown[]): void {
    this.write('log', message, params);
  }

  warn(message: unknown, ...params: unknown[]): void {
    this.write('warn', message, params);
  }

  error(message: unknown, ...params: unknown[]): void {
    this.write('error', message, params);
  }

  fatal(message: unknown, ...params: unknown[]): void {
    this.write('fatal', message, params);
  }

  private write(level: StructuredLogLevel, message: unknown, params: unknown[]): void {
    if (!this.levels.has(level)) return;
    const last = params.at(-1);
    const loggerName = typeof last === 'string' && !isStack(last) ? last : this.loggerName;
    let stack = params.find(isStack);
    let text: string;
    let fields: StructuredLogFields = {};
    if (message instanceof Error) {
      text = `${message.name}: ${message.message}`;
      stack ??= message.stack;
    } else if (typeof message === 'object' && message !== null) {
      const { message: inner, ...rest } = message as { message?: unknown };
      text = typeof inner === 'string' ? inner : 'Structured log';
      fields = rest as StructuredLogFields;
    } else {
      text = String(message);
    }
    emitStructuredLog(level, text, fields, { logger: loggerName, stack });
  }
}
