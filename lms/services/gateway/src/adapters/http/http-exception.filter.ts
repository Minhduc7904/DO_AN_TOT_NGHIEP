import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { trace } from '@opentelemetry/api';

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
    const response = host.switchToHttp().getResponse<HttpResponse>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body: ErrorEnvelope = {
      code: this.codeFor(status),
      details: null,
      message: this.safeMessage(exception, status),
      timestamp: new Date().toISOString(),
      trace_id: trace.getActiveSpan()?.spanContext().traceId ?? 'unavailable',
    };

    response.status(status).json(body);
  }

  private codeFor(status: number): string {
    const codes: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'VALIDATION_ERROR',
      [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
      [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
      [HttpStatus.SERVICE_UNAVAILABLE]: 'DEPENDENCY_UNAVAILABLE',
      [HttpStatus.GATEWAY_TIMEOUT]: 'DEPENDENCY_TIMEOUT',
    };
    return codes[status] ?? 'INTERNAL_ERROR';
  }

  private safeMessage(exception: unknown, status: number): string {
    if (!(exception instanceof HttpException)) {
      return 'Đã xảy ra lỗi nội bộ';
    }

    const response = exception.getResponse();
    if (typeof response === 'string') {
      return response;
    }
    if (
      typeof response === 'object' &&
      response &&
      'message' in response &&
      typeof response.message === 'string'
    ) {
      return response.message;
    }

    return status === HttpStatus.INTERNAL_SERVER_ERROR
      ? 'Đã xảy ra lỗi nội bộ'
      : 'Yêu cầu không hợp lệ';
  }
}
