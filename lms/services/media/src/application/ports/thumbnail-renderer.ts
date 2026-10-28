import type { MediaType } from '../../domain/media.js';

export const THUMBNAIL_RENDERER = Symbol('THUMBNAIL_RENDERER');

/** Sinh thumbnail WebP từ ảnh hoặc khung hình đầu của video. */
export interface ThumbnailRenderer {
  render(input: { type: MediaType; bucket: string; key: string }): Promise<Buffer>;
}
