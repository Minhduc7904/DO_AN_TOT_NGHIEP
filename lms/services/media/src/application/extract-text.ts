import { mediaErrors } from '../domain/errors.js';
import { EXTRACT_TEXT_MAX_BYTES, isExtractableDocument } from '../domain/media-type.js';

/** Cờ `extract_text` chỉ hợp lệ với tệp mà `ai` đọc được và không vượt giới hạn dung lượng của `ai`. */
export function assertExtractTextAllowed(
  fileName: string,
  mimeType: string,
  sizeBytes: number,
): void {
  if (isExtractableDocument(fileName, mimeType) && sizeBytes <= EXTRACT_TEXT_MAX_BYTES) return;
  throw mediaErrors.extractTextUnsupported({
    field: 'extract_text',
    mime_type: mimeType,
    size_bytes: sizeBytes,
    max_size_bytes: EXTRACT_TEXT_MAX_BYTES,
  });
}
