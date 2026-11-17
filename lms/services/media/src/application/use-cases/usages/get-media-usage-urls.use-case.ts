import { AppError } from '@aiops-lms/common/errors';

import { mediaContentUrl, mediaThumbnailUrl } from '../../../domain/urls.js';
import type { MediaUnitOfWork } from '../../ports/unit-of-work.js';

export interface UsageUrl {
  usageId: string;
  mediaId: string;
  url: string;
  thumbnailUrl: string | null;
}

/** Trả URL công khai (qua Gateway) của usage; thumbnail chỉ có khi đã sinh xong. */
export class GetMediaUsageUrlsUseCase {
  constructor(private readonly uow: MediaUnitOfWork) {}

  async execute(usageIds: readonly string[]): Promise<UsageUrl[]> {
    const usages = await this.uow.stores.usages.findManyByIds(usageIds);
    const medias = await this.uow.stores.media.findManyByIds(usages.map((usage) => usage.mediaId));
    const byId = new Map(medias.map((media) => [media.id, media]));
    const result: UsageUrl[] = [];
    for (const usage of usages) {
      const media = byId.get(usage.mediaId);
      if (!media || media.status !== 'READY') continue;
      result.push({
        usageId: usage.id,
        mediaId: media.id,
        url: mediaContentUrl(media.id),
        thumbnailUrl: media.thumbnailStatus === 'READY' ? mediaThumbnailUrl(media.id) : null,
      });
    }
    return result;
  }

  async executeOne(usageId: string): Promise<UsageUrl> {
    const [found] = await this.execute([usageId]);
    if (!found) throw AppError.notFound('Không tìm thấy usage hoặc media chưa sẵn sàng');
    return found;
  }
}
