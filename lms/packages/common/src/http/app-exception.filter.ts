import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException } from '@nestjs/common';

import { AppError } from '../errors/index.js';
import { buildErrorEnvelope, codeForStatus } from './response-envelope.js';

interface ResponseLike {
  status(code: number): { json(body: unknown): void };
}

function httpExceptionMessage(exception: HttpException): string {
  const response = exception.getResponse();
  if (typeof response === 'string') return response;
  if (response && typeof response === 'object' && 'message' in response) {
    const message = (response as { message: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return exception.message;
}

/**
 * Chuyển mọi lỗi thành envelope phẳng của contract v2. Lỗi không phân loại trả 500 với thông báo
 * chung để không lộ chi tiết nội bộ (stack, SQL, host).
 */
@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<ResponseLike>();

    if (exception instanceof AppError) {
      response
        .status(exception.status)
        .json(buildErrorEnvelope(exception.code, exception.message, exception.details));
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      response
        .status(status)
        .json(buildErrorEnvelope(codeForStatus(status), httpExceptionMessage(exception)));
      return;
    }

    response.status(500).json(buildErrorEnvelope(codeForStatus(500), 'Đã xảy ra lỗi nội bộ'));
  }
}
