import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { trace } from '@opentelemetry/api';

import { StorageInjectedError } from '../../application/storage-injected-error.js';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const status =
      exception instanceof StorageInjectedError
        ? HttpStatus.SERVICE_UNAVAILABLE
        : exception instanceof HttpException
          ? exception.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR;
    const codes: Record<number, string> = {
      400: 'VALIDATION_ERROR',
      404: 'NOT_FOUND',
      503: 'DEPENDENCY_UNAVAILABLE',
    };
    const response = exception instanceof HttpException ? exception.getResponse() : null;
    const message =
      exception instanceof StorageInjectedError
        ? 'Storage Mock đang inject lỗi'
        : typeof response === 'string'
          ? response
          : response &&
              typeof response === 'object' &&
              'message' in response &&
              typeof response.message === 'string'
            ? response.message
            : 'Đã xảy ra lỗi nội bộ';
    host
      .switchToHttp()
      .getResponse<{ status(code: number): { json(body: unknown): void } }>()
      .status(status)
      .json({
        code: codes[status] ?? 'INTERNAL_ERROR',
        details: null,
        message,
        timestamp: new Date().toISOString(),
        trace_id: trace.getActiveSpan()?.spanContext().traceId ?? 'unavailable',
      });
  }
}
