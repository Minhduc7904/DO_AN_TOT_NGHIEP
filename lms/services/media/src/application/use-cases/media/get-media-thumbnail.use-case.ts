import { mediaErrors } from '../../../domain/errors.js';
import { requireMedia } from '../../media-access.js';
import type { MediaUnitOfWork } from '../../ports/unit-of-work.js';
import type { GetMediaContentUseCase, MediaContent } from './get-media-content.use-case.js';

/** Stream thumbnail đã sinh; chưa sẵn sàng thì `MEDIA_NOT_READY` kèm `thumbnail_status`. */
export class GetMediaThumbnailUseCase {
  constructor(
    private readonly uow: MediaUnitOfWork,
    private readonly content: GetMediaContentUseCase,
  ) {}

  async execute(mediaId: string, rangeHeader: string | undefined): Promise<MediaContent> {
    const source = await requireMedia(this.uow.stores.media, mediaId);
    const thumbnail =
      source.thumbnailStatus === 'READY'
        ? await this.uow.stores.media.findThumbnailOf(source.id)
        : null;
    if (!thumbnail || thumbnail.status !== 'READY') {
      throw mediaErrors.notReady({ thumbnail_status: source.thumbnailStatus });
    }
    return this.content.open(thumbnail, rangeHeader);
  }
}
