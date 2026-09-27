import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { trace } from '@opentelemetry/api';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const response = exception instanceof HttpException ? exception.getResponse() : null;
    const message =
      typeof response === 'string'
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
        code: status === HttpStatus.NOT_FOUND ? 'NOT_FOUND' : 'INTERNAL_ERROR',
        details: null,
        message,
        timestamp: new Date().toISOString(),
        trace_id: trace.getActiveSpan()?.spanContext().traceId ?? 'unavailable',
      });
  }
}
