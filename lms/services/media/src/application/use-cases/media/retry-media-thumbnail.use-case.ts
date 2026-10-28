import { AppError } from '@aiops-lms/common/errors';
import type { IdGenerator, Principal } from '@aiops-lms/common/ports';

import { mediaErrors } from '../../../domain/errors.js';
import type { MediaObject } from '../../../domain/media.js';
import { supportsThumbnail } from '../../../domain/media-type.js';
import { assertCanManage, requireMedia } from '../../media-access.js';
import type { MediaUnitOfWork } from '../../ports/unit-of-work.js';

/** Sinh lại thumbnail đã `FAILED` (hoặc kẹt `PENDING`): đặt lại job và phát command mới. */
export class RetryMediaThumbnailUseCase {
  constructor(
    private readonly uow: MediaUnitOfWork,
    private readonly ids: IdGenerator,
  ) {}

  async execute(principal: Principal, mediaId: string): Promise<MediaObject> {
    const media = await requireMedia(this.uow.stores.media, mediaId);
    assertCanManage(principal, media);
    if (media.status !== 'READY') throw mediaErrors.notReady({ status: media.status });
    if (!supportsThumbnail(media.type) || media.sourceMediaId) {
      throw AppError.validation('Loại media này không có thumbnail');
    }
    if (media.thumbnailStatus === 'READY' || media.thumbnailStatus === 'PROCESSING') return media;

    return this.uow.run(async (stores) => {
      const updated = await stores.media.update(media.id, { thumbnailStatus: 'PENDING' });
      const key = `thumbnail:${media.id}`;
      const job = await stores.jobs.ensure({
        id: this.ids.next(),
        type: 'THUMBNAIL_DERIVATION',
        deduplicationKey: key,
        referenceId: media.id,
      });
      await stores.jobs.update(job.id, { status: 'QUEUED', lastError: null });
      await stores.commands.requestThumbnail(media.id);
      return updated ?? media;
    });
  }
}
