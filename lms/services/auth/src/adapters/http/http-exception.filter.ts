import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { trace } from '@opentelemetry/api';

import {
  InvalidAuthPayloadError,
  InvalidCredentialsError,
} from '../../application/auth.service.js';

interface ErrorEnvelope {
  code: string;
  details: null;
  message: string;
  timestamp: string;
  trace_id: string;
}

interface HttpResponse {
  json(body: ErrorEnvelope): void;
  status(code: number): HttpResponse;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<HttpResponse>();
    const status = this.getStatus(exception);
    const message = this.getSafeMessage(exception, status);
    const traceId = trace.getActiveSpan()?.spanContext().traceId ?? 'unavailable';
    const body: ErrorEnvelope = {
      code: this.codeFor(status),
      message,
      trace_id: traceId,
      timestamp: new Date().toISOString(),
      details: null,
    };

    response.status(status).json(body);
  }

  private codeFor(status: number): string {
    const codes: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'VALIDATION_ERROR',
      [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
      [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
      [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
      [HttpStatus.CONFLICT]: 'CONFLICT',
      [HttpStatus.SERVICE_UNAVAILABLE]: 'DEPENDENCY_UNAVAILABLE',
      [HttpStatus.GATEWAY_TIMEOUT]: 'DEPENDENCY_TIMEOUT',
    };
    return codes[status] ?? 'INTERNAL_ERROR';
  }

  private getStatus(exception: unknown): number {
    if (exception instanceof InvalidAuthPayloadError) {
      return HttpStatus.BAD_REQUEST;
    }
    if (exception instanceof InvalidCredentialsError) {
      return HttpStatus.UNAUTHORIZED;
    }
    return exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private getSafeMessage(exception: unknown, status: number): string {
    if (
      exception instanceof InvalidAuthPayloadError ||
      exception instanceof InvalidCredentialsError
    ) {
      return exception.message;
    }
    if (!(exception instanceof HttpException)) {
      return 'Đã xảy ra lỗi nội bộ';
    }

    const response = exception.getResponse();
    if (typeof response === 'string') {
      return response;
    }

    if (typeof response === 'object' && response && 'message' in response) {
      const message = response.message;
      if (typeof message === 'string') {
        return message;
      }
    }

    return status === HttpStatus.INTERNAL_SERVER_ERROR
      ? 'Đã xảy ra lỗi nội bộ'
      : 'Yêu cầu không hợp lệ';
  }
}
