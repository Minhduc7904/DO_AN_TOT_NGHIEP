import { AppError } from '@aiops-lms/common/errors';
import { apiErrorSchema } from '@aiops-lms/contracts/http';

/**
 * Lỗi nghiệp vụ của service đích (4xx): giữ nguyên mã và mã HTTP gốc để job lưu `error_code` của course/media.
 * Phản hồi không đọc được thì coi là dependency lỗi.
 */
export function upstreamError(dependency: string, status: number, body: unknown): AppError {
  const parsed = apiErrorSchema.safeParse(body);
  if (parsed.success) {
    return new AppError(parsed.data.error.code, status, parsed.data.error.message);
  }
  return AppError.dependencyUnavailable(dependency);
}
