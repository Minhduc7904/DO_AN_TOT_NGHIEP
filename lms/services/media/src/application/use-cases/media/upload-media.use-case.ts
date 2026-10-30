import { createHash } from 'node:crypto';

import { AppError } from '@aiops-lms/common/errors';
import type { Clock, IdGenerator, Principal } from '@aiops-lms/common/ports';

import { mediaErrors } from '../../../domain/errors.js';
import type { MediaObject } from '../../../domain/media.js';
import {
  BUCKET_BY_TYPE,
  classifyMedia,
  MEDIA_SIZE_LIMITS,
  supportsThumbnail,
} from '../../../domain/media-type.js';
import { assertExtractTextAllowed } from '../../extract-text.js';
import { detectMime, MIME_SNIFF_BYTES } from '../../../domain/mime-detection.js';
import { buildObjectKey, safeExtension } from '../../../domain/object-key.js';
import type { ObjectStorage } from '../../ports/object-storage.js';
import type { MediaUnitOfWork } from '../../ports/unit-of-work.js';

export interface UploadMediaInput {
  content: Buffer;
  originalName: string;
  /** Mặc định `false`. */
  extractText?: boolean;
}

/**
 * Upload multipart qua `media`: ghi thẳng vào key cuối cùng rồi đánh dấu `READY`; có cờ `extractText` thì
 * ghi lệnh trích văn bản vào outbox cùng transaction. MIME do server suy ra từ nội dung (`detectMime`),
 * `Content-Type` của phần multipart bị bỏ qua.
 */
export class UploadMediaUseCase {
  constructor(
    private readonly uow: MediaUnitOfWork,
    private readonly storage: ObjectStorage,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(principal: Principal, input: UploadMediaInput): Promise<MediaObject> {
    if (input.content.length === 0) throw AppError.validation('File rỗng');
    const mimeType = detectMime(input.content.subarray(0, MIME_SNIFF_BYTES), input.originalName);
    const type = classifyMedia(mimeType);
    const limit = MEDIA_SIZE_LIMITS[type];
    if (input.content.length > limit) throw mediaErrors.tooLarge(limit);
    if (input.extractText) {
      assertExtractTextAllowed(input.originalName, mimeType, input.content.length);
    }

    const id = this.ids.next();
    const bucket = BUCKET_BY_TYPE[type];
    const objectKey = buildObjectKey(this.clock.now(), id, safeExtension(input.originalName));
    await this.storage.put(bucket, objectKey, input.content, mimeType);
    try {
      return await this.uow.run(async (stores) => {
        const thumbnails = supportsThumbnail(type);
        const media = await stores.media.create({
          id,
          type,
          status: 'READY',
          thumbnailStatus: thumbnails ? 'PENDING' : 'NOT_APPLICABLE',
          originalName: input.originalName,
          mimeType,
          sizeBytes: input.content.length,
          checksumSha256: createHash('sha256').update(input.content).digest('hex'),
          extractText: input.extractText === true,
          bucket,
          objectKey,
          uploadedBy: principal.id,
        });
        if (thumbnails) {
          await stores.jobs.ensure({
            id: this.ids.next(),
            type: 'THUMBNAIL_DERIVATION',
            deduplicationKey: `thumbnail:${id}`,
            referenceId: id,
          });
          await stores.commands.requestThumbnail(id);
        }
        if (input.extractText) await stores.commands.requestDocumentExtraction(media);
        return media;
      });
    } catch (error) {
      await this.storage.remove(bucket, objectKey).catch(() => undefined);
      throw error;
    }
  }
}
