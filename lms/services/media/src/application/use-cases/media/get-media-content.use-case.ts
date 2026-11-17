import { AppError } from '@aiops-lms/common/errors';

import { mediaErrors } from '../../../domain/errors.js';
import type { MediaObject } from '../../../domain/media.js';
import { parseRange } from '../../../domain/http-range.js';
import { requireMedia } from '../../media-access.js';
import type { ObjectContent, ObjectStorage } from '../../ports/object-storage.js';
import type { MediaUnitOfWork } from '../../ports/unit-of-work.js';

export interface MediaContent extends ObjectContent {
  media: MediaObject;
  /** `null` khi trả toàn bộ file. */
  range: { start: number; end: number } | null;
}

/** Stream nội dung media (hỗ trợ một khoảng `Range`). Dùng cho route công khai và nội bộ. */
export class GetMediaContentUseCase {
  constructor(
    private readonly uow: MediaUnitOfWork,
    private readonly storage: ObjectStorage,
  ) {}

  async execute(mediaId: string, rangeHeader: string | undefined): Promise<MediaContent> {
    const media = await requireMedia(this.uow.stores.media, mediaId);
    if (media.status !== 'READY') throw mediaErrors.notReady({ status: media.status });
    return this.open(media, rangeHeader);
  }

  async open(media: MediaObject, rangeHeader: string | undefined): Promise<MediaContent> {
    const range = parseRange(rangeHeader, media.sizeBytes);
    if (range === 'invalid') {
      throw new AppError('RANGE_NOT_SATISFIABLE', 416, 'Khoảng byte yêu cầu không hợp lệ', {
        size_bytes: media.sizeBytes,
      });
    }
    const content = await this.storage.get(media.bucket, media.objectKey, range ?? undefined);
    return { ...content, sizeBytes: media.sizeBytes, media, range };
  }
}
