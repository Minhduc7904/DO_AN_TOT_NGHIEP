import { StreamableFile } from '@nestjs/common';
import type { Response } from 'express';

import type { MediaContent } from '../../../application/use-cases/media/get-media-content.use-case.js';

/** Ghi header và trả stream cho content/thumbnail, kể cả `206 Partial Content` cho `Range`. */
export function streamMedia(content: MediaContent, response: Response): StreamableFile {
  response.setHeader('Accept-Ranges', 'bytes');
  response.setHeader('Cache-Control', 'public, max-age=300');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (content.range) {
    response.status(206);
    response.setHeader(
      'Content-Range',
      `bytes ${content.range.start}-${content.range.end}/${content.sizeBytes}`,
    );
    response.setHeader('Content-Length', String(content.range.end - content.range.start + 1));
  } else {
    response.setHeader('Content-Length', String(content.sizeBytes));
  }
  return new StreamableFile(content.stream, {
    type: content.media.mimeType,
    disposition: `inline; filename*=UTF-8''${encodeURIComponent(content.media.originalName)}`,
  });
}
