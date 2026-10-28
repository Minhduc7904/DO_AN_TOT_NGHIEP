import type { Clock, IdGenerator } from '@aiops-lms/common/ports';

import type { MediaObject } from '../../../domain/media.js';
import { BUCKET_BY_TYPE, supportsThumbnail } from '../../../domain/media-type.js';
import { buildObjectKey } from '../../../domain/object-key.js';
import type { ObjectStorage } from '../../ports/object-storage.js';
import type { ThumbnailRenderer } from '../../ports/thumbnail-renderer.js';
import type { MediaUnitOfWork } from '../../ports/unit-of-work.js';
import { createHash } from 'node:crypto';

/**
 * Sinh thumbnail WebP. Phần render chạy ngoài transaction (có thể lâu); chỉ bước ghi DB cuối cùng
 * đi qua inbox để giao lại cùng `message_id` không tạo trùng. Lỗi được ném lên cho consumer retry.
 */
export class GenerateThumbnailUseCase {
  constructor(
    private readonly uow: MediaUnitOfWork,
    private readonly storage: ObjectStorage,
    private readonly renderer: ThumbnailRenderer,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(messageId: string, consumer: string, mediaId: string): Promise<void> {
    const source = await this.uow.stores.media.findById(mediaId);
    if (!source || source.status !== 'READY' || !supportsThumbnail(source.type)) return;
    if (source.thumbnailStatus === 'READY') return;

    await this.uow.stores.media.update(source.id, { thumbnailStatus: 'PROCESSING' });
    const image = await this.renderer.render({
      type: source.type,
      bucket: source.bucket,
      key: source.objectKey,
    });

    const existing = await this.uow.stores.media.findThumbnailOf(source.id);
    const thumbId = existing?.id ?? this.ids.next();
    const bucket = BUCKET_BY_TYPE.IMAGE;
    const key = existing?.objectKey ?? buildObjectKey(this.clock.now(), thumbId, 'webp');
    await this.storage.put(bucket, key, image, 'image/webp');

    await this.uow.runOnce(messageId, consumer, async (stores) => {
      if (!existing) {
        await stores.media.create({
          id: thumbId,
          type: 'IMAGE',
          status: 'READY',
          thumbnailStatus: 'NOT_APPLICABLE',
          originalName: `${source.id}.webp`,
          mimeType: 'image/webp',
          sizeBytes: image.length,
          checksumSha256: createHash('sha256').update(image).digest('hex'),
          bucket,
          objectKey: key,
          uploadedBy: source.uploadedBy,
          sourceMediaId: source.id,
        });
        await stores.usages.create({
          id: this.ids.next(),
          mediaId: thumbId,
          ownerKind: 'MEDIA',
          ownerId: source.id,
          usageType: 'MEDIA_THUMBNAIL',
          position: 0,
          createdBy: source.uploadedBy,
        });
      }
      await stores.media.update(source.id, { thumbnailStatus: 'READY' });
      await this.completeJob(stores, source, 'COMPLETED', null);
    });
  }

  /** Hết retry: đánh dấu thumbnail và job `FAILED` để client thấy và có thể retry thủ công. */
  async markFailed(mediaId: string, reason: string): Promise<void> {
    await this.uow.run(async (stores) => {
      const media = await stores.media.findById(mediaId);
      if (!media) return;
      await stores.media.update(media.id, { thumbnailStatus: 'FAILED' });
      await this.completeJob(stores, media, 'FAILED', reason.slice(0, 500));
    });
  }

  private async completeJob(
    stores: Parameters<Parameters<MediaUnitOfWork['run']>[0]>[0],
    media: MediaObject,
    status: 'COMPLETED' | 'FAILED',
    error: string | null,
  ): Promise<void> {
    const job = await stores.jobs.ensure({
      id: this.ids.next(),
      type: 'THUMBNAIL_DERIVATION',
      deduplicationKey: `thumbnail:${media.id}`,
      referenceId: media.id,
    });
    await stores.jobs.update(job.id, {
      status,
      lastError: error,
      processedDelta: status === 'COMPLETED' ? 1 : 0,
      failedDelta: status === 'FAILED' ? 1 : 0,
    });
  }
}
