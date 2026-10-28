import type { IdGenerator, Clock, Principal } from '@aiops-lms/common/ports';

import { mediaErrors } from '../../../domain/errors.js';
import type { MediaObject } from '../../../domain/media.js';
import { supportsThumbnail } from '../../../domain/media-type.js';
import { assertCanManage, requireMedia } from '../../media-access.js';
import type { ObjectStorage } from '../../ports/object-storage.js';
import type { MediaUnitOfWork } from '../../ports/unit-of-work.js';

/**
 * Kiểm tra object tạm (tồn tại, đúng dung lượng, đúng SHA-256), chuyển sang key cuối cùng và đánh
 * dấu `READY`. Sai checksum thì xóa object tạm và đánh dấu `FAILED`. Gọi lại khi đã `READY` là no-op
 * (nên lệnh trích văn bản chỉ phát đúng một lần, lúc chuyển sang `READY`).
 */
export class CompleteDirectUploadUseCase {
  constructor(
    private readonly uow: MediaUnitOfWork,
    private readonly storage: ObjectStorage,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(principal: Principal, mediaId: string): Promise<MediaObject> {
    const media = await requireMedia(this.uow.stores.media, mediaId);
    assertCanManage(principal, media);
    if (media.status === 'READY') return media;
    if (media.status === 'FAILED' || !media.tmpObjectKey) throw mediaErrors.uploadNotCompleted();
    if (media.uploadExpiresAt && media.uploadExpiresAt < this.clock.now()) {
      throw mediaErrors.uploadNotCompleted();
    }

    const stat = await this.storage.stat(media.bucket, media.tmpObjectKey);
    if (!stat) throw mediaErrors.uploadNotCompleted();
    const valid =
      stat.sizeBytes === media.sizeBytes &&
      (await this.storage.sha256(media.bucket, media.tmpObjectKey)) === media.checksumSha256;
    if (!valid) {
      await this.storage.remove(media.bucket, media.tmpObjectKey).catch(() => undefined);
      await this.uow.stores.media.update(media.id, {
        status: 'FAILED',
        tmpObjectKey: null,
        failureReason: 'CHECKSUM_MISMATCH',
      });
      throw mediaErrors.checksumMismatch();
    }

    // Copy trước, commit DB sau: lỗi giữa chừng để lại object cuối cùng mồ côi (cleanup dọn được),
    // không bao giờ để DB trỏ tới object chưa tồn tại.
    await this.storage.copy(media.bucket, media.tmpObjectKey, media.objectKey);
    const thumbnails = supportsThumbnail(media.type);
    const ready = await this.uow.run(async (stores) => {
      const updated = await stores.media.update(media.id, {
        status: 'READY',
        thumbnailStatus: thumbnails ? 'PENDING' : 'NOT_APPLICABLE',
        tmpObjectKey: null,
        failureReason: null,
      });
      if (thumbnails) {
        await stores.jobs.ensure({
          id: this.ids.next(),
          type: 'THUMBNAIL_DERIVATION',
          deduplicationKey: `thumbnail:${media.id}`,
          referenceId: media.id,
        });
        await stores.commands.requestThumbnail(media.id);
      }
      // Cùng transaction với việc đánh dấu READY: tệp READY có cờ thì chắc chắn có lệnh trích văn bản.
      if (media.extractText) await stores.commands.requestDocumentExtraction(media);
      return updated ?? media;
    });
    await this.storage.remove(media.bucket, media.tmpObjectKey).catch(() => undefined);
    return ready;
  }
}
