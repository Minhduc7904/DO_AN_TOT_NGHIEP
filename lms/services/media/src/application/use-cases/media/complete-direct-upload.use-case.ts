import type { IdGenerator, Clock, Principal } from '@aiops-lms/common/ports';

import { mediaErrors } from '../../../domain/errors.js';
import type { MediaObject } from '../../../domain/media.js';
import { classifyMedia, supportsThumbnail } from '../../../domain/media-type.js';
import { detectMime, MIME_SNIFF_BYTES } from '../../../domain/mime-detection.js';
import { assertCanManage, requireMedia } from '../../media-access.js';
import type { ObjectStorage } from '../../ports/object-storage.js';
import type { MediaUnitOfWork } from '../../ports/unit-of-work.js';

/**
 * Kiểm tra object tạm (tồn tại, đúng dung lượng, đúng SHA-256), suy MIME từ nội dung, chuyển sang key cuối
 * cùng và đánh dấu `READY`. Sai checksum hoặc nội dung thuộc loại khác loại đã khai báo (bucket và dung lượng
 * tối đa đã chọn theo loại đó) thì xóa object tạm và đánh dấu `FAILED`. Gọi lại khi đã `READY` là no-op
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

    const mimeType = detectMime(
      await this.readHead(media.bucket, media.tmpObjectKey),
      media.originalName,
    );
    if (classifyMedia(mimeType) !== media.type) {
      await this.storage.remove(media.bucket, media.tmpObjectKey).catch(() => undefined);
      await this.uow.stores.media.update(media.id, {
        status: 'FAILED',
        tmpObjectKey: null,
        failureReason: 'MIME_MISMATCH',
      });
      throw mediaErrors.mimeMismatch({
        declared_mime_type: media.mimeType,
        declared_type: media.type,
        detected_mime_type: mimeType,
      });
    }

    // Copy trước, commit DB sau: lỗi giữa chừng để lại object cuối cùng mồ côi (cleanup dọn được),
    // không bao giờ để DB trỏ tới object chưa tồn tại.
    await this.storage.copy(media.bucket, media.tmpObjectKey, media.objectKey);
    const thumbnails = supportsThumbnail(media.type);
    const ready = await this.uow.run(async (stores) => {
      const updated = await stores.media.update(media.id, {
        status: 'READY',
        mimeType,
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

  /** Đọc đoạn đầu của object để suy MIME; không tải cả tệp. */
  private async readHead(bucket: string, key: string): Promise<Buffer> {
    const content = await this.storage.get(bucket, key, { start: 0, end: MIME_SNIFF_BYTES - 1 });
    const chunks: Buffer[] = [];
    let length = 0;
    for await (const chunk of content.stream as AsyncIterable<Buffer>) {
      chunks.push(chunk);
      length += chunk.length;
      if (length >= MIME_SNIFF_BYTES) break;
    }
    content.stream.destroy();
    return Buffer.concat(chunks).subarray(0, MIME_SNIFF_BYTES);
  }
}
