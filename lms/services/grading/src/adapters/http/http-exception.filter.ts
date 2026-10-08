import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { trace } from '@opentelemetry/api';

import { GradeConflictError } from '../../application/grade-conflict-error.js';
import { GradeEventPendingError } from '../../application/grade-event-pending-error.js';
import { GradeForbiddenError } from '../../application/grade-forbidden-error.js';
import { GradeNotFoundError } from '../../application/grade-not-found-error.js';
import { GradingDependencyError } from '../../application/grading-dependency-error.js';
import { SubmissionNotFoundError } from '../../application/submission-not-found-error.js';

type DomainError =
  | GradeConflictError
  | GradeEventPendingError
  | GradeForbiddenError
  | GradeNotFoundError
  | SubmissionNotFoundError;

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    if (exception instanceof GradeEventPendingError) {
      // Chỉ log ID kỹ thuật và mã lỗi hữu hạn, không log payload hay principal.
      this.logger.warn(
        `Grade ${exception.gradeId} đã lưu nhưng event ${exception.eventId} chưa publish (reason=${exception.reason})`,
      );
    }
    const status = this.statusFor(exception);
    const codes: Record<number, string> = {
      400: 'VALIDATION_ERROR',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
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
    if (exception instanceof GradingDependencyError) {
      return exception.kind === 'timeout'
        ? HttpStatus.GATEWAY_TIMEOUT
        : HttpStatus.SERVICE_UNAVAILABLE;
    }
    if (exception instanceof GradeEventPendingError) return HttpStatus.SERVICE_UNAVAILABLE;
    if (exception instanceof GradeConflictError) return HttpStatus.CONFLICT;
    if (exception instanceof GradeNotFoundError || exception instanceof SubmissionNotFoundError) {
      return HttpStatus.NOT_FOUND;
    }
    if (exception instanceof GradeForbiddenError) return HttpStatus.FORBIDDEN;
    return exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private messageFor(exception: unknown): string {
    if (exception instanceof GradingDependencyError) {
      return exception.kind === 'timeout'
        ? 'Dịch vụ phụ thuộc phản hồi quá hạn'
        : 'Dịch vụ phụ thuộc không sẵn sàng';
    }
    if (this.isDomainError(exception)) return exception.message;
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

  private isDomainError(exception: unknown): exception is DomainError {
    return (
      exception instanceof GradeConflictError ||
      exception instanceof GradeEventPendingError ||
      exception instanceof GradeForbiddenError ||
      exception instanceof GradeNotFoundError ||
      exception instanceof SubmissionNotFoundError
    );
  }
}
