import type { MediaType } from './media.js';

const MB = 1024 * 1024;

/** Giới hạn kích thước theo loại (byte); khớp http-and-event-contracts-v2 §4.4. */
export const MEDIA_SIZE_LIMITS: Record<MediaType, number> = {
  IMAGE: 10 * MB,
  VIDEO: 500 * MB,
  DOCUMENT: 50 * MB,
  AUDIO: 100 * MB,
  OTHER: 25 * MB,
};

/** Mỗi loại một bucket do `minio-init` tạo sẵn. */
export const BUCKET_BY_TYPE: Record<MediaType, string> = {
  IMAGE: 'images',
  VIDEO: 'videos',
  DOCUMENT: 'documents',
  AUDIO: 'audios',
  OTHER: 'other',
};

const DOCUMENT_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'application/rtf',
  'text/plain',
  'text/markdown',
  'text/csv',
]);

export function classifyMedia(mimeType: string): MediaType {
  const mime = mimeType.toLowerCase();
  if (mime.startsWith('image/')) return 'IMAGE';
  if (mime.startsWith('video/')) return 'VIDEO';
  if (mime.startsWith('audio/')) return 'AUDIO';
  if (
    DOCUMENT_MIME.has(mime) ||
    mime.startsWith('application/vnd.openxmlformats-officedocument.') ||
    mime.startsWith('application/vnd.oasis.opendocument.')
  ) {
    return 'DOCUMENT';
  }
  return 'OTHER';
}

/** Chỉ ảnh và video sinh được thumbnail. */
export const supportsThumbnail = (type: MediaType): boolean => type === 'IMAGE' || type === 'VIDEO';
