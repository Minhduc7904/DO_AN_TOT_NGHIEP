/** Mã lỗi chung của envelope lỗi v2; mã nghiệp vụ riêng của service là chuỗi tự do. */
export const ERROR_CODES = {
  validation: 'VALIDATION_ERROR',
  unauthorized: 'UNAUTHORIZED',
  forbidden: 'FORBIDDEN',
  notFound: 'NOT_FOUND',
  conflict: 'CONFLICT',
  internal: 'INTERNAL_ERROR',
  dependencyUnavailable: 'DEPENDENCY_UNAVAILABLE',
  dependencyTimeout: 'DEPENDENCY_TIMEOUT',
  // Xác thực service-to-service (ADR-004).
  serviceTokenMissing: 'SERVICE_TOKEN_MISSING',
  serviceTokenInvalid: 'SERVICE_TOKEN_INVALID',
  serviceScopeForbidden: 'SERVICE_SCOPE_FORBIDDEN',
  serviceClientInvalid: 'SERVICE_CLIENT_INVALID',
  tokenTypeMismatch: 'TOKEN_TYPE_MISMATCH',
} as const;

export type CommonErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * Lỗi có phân loại mà use case được phép ném. Thuần TypeScript, không phụ thuộc framework:
 * adapter HTTP ánh xạ `status`/`code` sang envelope lỗi.
 */
export class AppError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
    readonly details: unknown = null,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static validation(message: string, details: unknown = null): AppError {
    return new AppError(ERROR_CODES.validation, 400, message, details);
  }

  static unauthorized(message = 'Thiếu hoặc sai thông tin xác thực'): AppError {
    return new AppError(ERROR_CODES.unauthorized, 401, message);
  }

  static forbidden(message = 'Không đủ quyền thực hiện thao tác'): AppError {
    return new AppError(ERROR_CODES.forbidden, 403, message);
  }

  static notFound(message = 'Không tìm thấy tài nguyên'): AppError {
    return new AppError(ERROR_CODES.notFound, 404, message);
  }

  static conflict(message: string, details: unknown = null): AppError {
    return new AppError(ERROR_CODES.conflict, 409, message, details);
  }

  static dependencyUnavailable(dependency: string): AppError {
    return new AppError(
      ERROR_CODES.dependencyUnavailable,
      503,
      'Dịch vụ phụ thuộc không sẵn sàng',
      { dependency },
    );
  }

  static dependencyTimeout(dependency: string): AppError {
    return new AppError(ERROR_CODES.dependencyTimeout, 504, 'Dịch vụ phụ thuộc phản hồi quá hạn', {
      dependency,
    });
  }

  static serviceTokenMissing(): AppError {
    return new AppError(ERROR_CODES.serviceTokenMissing, 401, 'Thiếu service access token');
  }

  static serviceTokenInvalid(): AppError {
    return new AppError(
      ERROR_CODES.serviceTokenInvalid,
      401,
      'Service access token không hợp lệ hoặc đã hết hạn',
    );
  }

  static tokenTypeMismatch(expected: 'user' | 'service'): AppError {
    return new AppError(
      ERROR_CODES.tokenTypeMismatch,
      401,
      `Loại token không đúng, route này cần ${expected} access token`,
    );
  }

  static serviceScopeForbidden(required: readonly string[]): AppError {
    return new AppError(
      ERROR_CODES.serviceScopeForbidden,
      403,
      'Service không đủ scope cho route này',
      { required },
    );
  }

  static serviceClientInvalid(): AppError {
    return new AppError(
      ERROR_CODES.serviceClientInvalid,
      401,
      'Thông tin xác thực dịch vụ không hợp lệ',
    );
  }
}
