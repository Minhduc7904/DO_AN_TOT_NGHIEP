import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { trace } from '@opentelemetry/api';

import { CourseNotFoundError } from '../../application/course-not-found-error.js';
import { NotEnrolledError } from '../../application/not-enrolled-error.js';
import { SubmissionDependencyError } from '../../application/submission-dependency-error.js';
import { SubmissionForbiddenError } from '../../application/submission-forbidden-error.js';
import { SubmissionNotFoundError } from '../../application/submission-not-found-error.js';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const status = this.statusFor(exception);
    const codes: Record<number, string> = {
      400: 'VALIDATION_ERROR',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      503: 'DEPENDENCY_UNAVAILABLE',
      504: 'DEPENDENCY_TIMEOUT',
    };
    host
      .switchToHttp()
      .getResponse<{ status(code: number): { json(body: unknown): void } }>()
      .status(status)
      .json({
        code: codes[status] ?? 'INTERNAL_ERROR',
        details: null,
        message: this.messageFor(exception),
        timestamp: new Date().toISOString(),
        trace_id: trace.getActiveSpan()?.spanContext().traceId ?? 'unavailable',
      });
  }

  private statusFor(exception: unknown): number {
    if (exception instanceof SubmissionDependencyError) {
      return exception.kind === 'timeout'
        ? HttpStatus.GATEWAY_TIMEOUT
        : HttpStatus.SERVICE_UNAVAILABLE;
    }
    if (exception instanceof CourseNotFoundError || exception instanceof SubmissionNotFoundError) {
      return HttpStatus.NOT_FOUND;
    }
    if (exception instanceof NotEnrolledError || exception instanceof SubmissionForbiddenError) {
      return HttpStatus.FORBIDDEN;
    }
    return exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private messageFor(exception: unknown): string {
    if (exception instanceof SubmissionDependencyError) {
      return exception.kind === 'timeout'
        ? 'Dịch vụ phụ thuộc phản hồi quá hạn'
        : 'Dịch vụ phụ thuộc không sẵn sàng';
    }
    if (
      exception instanceof CourseNotFoundError ||
      exception instanceof NotEnrolledError ||
      exception instanceof SubmissionForbiddenError ||
      exception instanceof SubmissionNotFoundError
    ) {
      return exception.message;
    }
    const response = exception instanceof HttpException ? exception.getResponse() : null;
    if (typeof response === 'string') return response;
    if (
      response &&
      typeof response === 'object' &&
      'message' in response &&
      typeof response.message === 'string'
    ) {
      return response.message;
    }
    return 'Đã xảy ra lỗi nội bộ';
  }
}
