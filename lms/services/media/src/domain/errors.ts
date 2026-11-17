import { AppError } from '@aiops-lms/common/errors';

/** Mã lỗi nghiệp vụ của `media` (khai báo trong http-and-event-contracts-v2 §4.4). */
export const MEDIA_ERROR_CODES = {
  checksumMismatch: 'MEDIA_CHECKSUM_MISMATCH',
  mimeMismatch: 'MEDIA_MIME_MISMATCH',
  notReady: 'MEDIA_NOT_READY',
  tooLarge: 'MEDIA_TOO_LARGE',
  uploadNotCompleted: 'MEDIA_UPLOAD_NOT_COMPLETED',
  usageConflict: 'MEDIA_USAGE_CONFLICT',
} as const;

export const mediaErrors = {
  extractTextUnsupported: (details: unknown): AppError =>
    AppError.validation(
      'extract_text chỉ hợp lệ với tệp TXT/MD, DOCX, PDF hoặc ảnh PNG/JPEG/WebP/GIF dung lượng tối đa 15 MB',
      details,
    ),
  checksumMismatch: (): AppError =>
    new AppError(
      MEDIA_ERROR_CODES.checksumMismatch,
      400,
      'Checksum hoặc dung lượng file đã upload không khớp khai báo',
    ),
  mimeMismatch: (details: unknown): AppError =>
    new AppError(
      MEDIA_ERROR_CODES.mimeMismatch,
      415,
      'Nội dung file không thuộc loại đã khai báo khi tạo phiên upload',
      details,
    ),
  notReady: (details: unknown = null): AppError =>
    new AppError(MEDIA_ERROR_CODES.notReady, 409, 'Media chưa sẵn sàng cho thao tác này', details),
  tooLarge: (limit: number): AppError =>
    new AppError(MEDIA_ERROR_CODES.tooLarge, 413, 'File vượt quá dung lượng tối đa của loại này', {
      max_size_bytes: limit,
    }),
  uploadNotCompleted: (): AppError =>
    new AppError(
      MEDIA_ERROR_CODES.uploadNotCompleted,
      409,
      'Chưa tìm thấy file đã upload hoặc phiên upload đã hết hạn',
    ),
  usageConflict: (message: string): AppError =>
    new AppError(MEDIA_ERROR_CODES.usageConflict, 409, message),
};
