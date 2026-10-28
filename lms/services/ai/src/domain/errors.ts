import { AppError } from '@aiops-lms/common/errors';

/** Mã lỗi nghiệp vụ của `ai` (khai báo trong http-and-event-contracts-v2 §2 và §4.7). */
export const AI_ERROR_CODES = {
  taskNotConfigured: 'AI_TASK_NOT_CONFIGURED',
  providerError: 'AI_PROVIDER_ERROR',
  providerRejectedRequest: 'AI_PROVIDER_REJECTED_REQUEST',
  providerKeyUnreadable: 'AI_PROVIDER_KEY_UNREADABLE',
  referenceInactive: 'AI_REFERENCE_INACTIVE',
  providerNameConflict: 'AI_PROVIDER_NAME_CONFLICT',
  providerInUse: 'AI_PROVIDER_IN_USE',
  modelConflict: 'AI_MODEL_CONFLICT',
  modelInUse: 'AI_MODEL_IN_USE',
  jobAlreadyActive: 'AI_JOB_ALREADY_ACTIVE',
  documentsNotExtracted: 'AI_DOCUMENTS_NOT_EXTRACTED',
} as const;

/** Lý do `AI_PROVIDER_ERROR` (chỉ cho người vận hành phân biệt; không chứa dữ liệu của provider). */
export type ProviderErrorReason =
  'AUTH_FAILED' | 'RATE_LIMITED' | 'INVALID_RESPONSE' | 'UPSTREAM_ERROR';

export const aiErrors = {
  taskNotConfigured: (task: string): AppError =>
    new AppError(AI_ERROR_CODES.taskNotConfigured, 409, `Chưa gán model AI cho tác vụ '${task}'`),
  providerError: (reason: ProviderErrorReason, upstreamStatus: number | null): AppError =>
    new AppError(
      AI_ERROR_CODES.providerError,
      502,
      'Provider AI lỗi hoặc trả phản hồi không hợp lệ',
      {
        reason,
        upstream_status: upstreamStatus,
      },
    ),
  providerRejectedRequest: (upstreamStatus: number, detail: string | null): AppError =>
    new AppError(
      AI_ERROR_CODES.providerRejectedRequest,
      422,
      detail
        ? `Provider từ chối request (HTTP ${upstreamStatus}): ${detail}`
        : `Provider từ chối request (HTTP ${upstreamStatus})`,
      { upstream_status: upstreamStatus },
    ),
  providerKeyUnreadable: (): AppError =>
    new AppError(
      AI_ERROR_CODES.providerKeyUnreadable,
      409,
      'Không giải mã được API key đã lưu của provider; hãy nhập lại API key',
    ),
  referenceInactive: (what: string): AppError =>
    new AppError(AI_ERROR_CODES.referenceInactive, 409, `${what} đang INACTIVE`),
  providerNameConflict: (): AppError =>
    new AppError(AI_ERROR_CODES.providerNameConflict, 409, 'Tên provider đã tồn tại'),
  providerInUse: (): AppError =>
    new AppError(AI_ERROR_CODES.providerInUse, 409, 'Provider còn model nên không xóa được'),
  modelConflict: (): AppError =>
    new AppError(AI_ERROR_CODES.modelConflict, 409, 'Provider đã có model cùng tên'),
  modelInUse: (): AppError =>
    new AppError(
      AI_ERROR_CODES.modelInUse,
      409,
      'Model còn được gán cho tác vụ nên không xóa được',
    ),
  jobAlreadyActive: (): AppError =>
    new AppError(
      AI_ERROR_CODES.jobAlreadyActive,
      409,
      'Bài học đã có job AI cùng loại đang chờ hoặc đang chạy',
    ),
  documentsNotExtracted: (mediaIds: readonly string[]): AppError =>
    new AppError(
      AI_ERROR_CODES.documentsNotExtracted,
      422,
      'Có tài liệu chưa được trích xuất văn bản',
      { media_ids: mediaIds },
    ),
  providerNotFound: (): AppError => AppError.notFound('Không tìm thấy provider'),
  modelNotFound: (): AppError => AppError.notFound('Không tìm thấy model'),
  bindingNotFound: (): AppError => AppError.notFound('Tác vụ chưa được gán model'),
  jobNotFound: (): AppError => AppError.notFound('Không tìm thấy job AI'),
};
