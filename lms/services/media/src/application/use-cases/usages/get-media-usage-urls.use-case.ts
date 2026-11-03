import { AppError } from '@aiops-lms/common/errors';

import { MEDIA_ACCESS_TIER_BY_USAGE } from '@aiops-lms/contracts/http/public';

import type { MediaUrlBuilder } from '../../media-url-builder.js';
import type { MediaUnitOfWork } from '../../ports/unit-of-work.js';

export interface UsageUrl {
  usageId: string;
  mediaId: string;
  url: string;
  thumbnailUrl: string | null;
}

/** `public`: route ẩn danh, chỉ usage tầng `PUBLIC`; `internal`: service sở hữu đã kiểm quyền, nhận cả URL ký. */
export type UsageUrlScope = 'public' | 'internal';

/**
 * Trả URL (qua Gateway) của usage theo tầng truy cập của loại usage: `PUBLIC` là URL trần, còn lại là URL ký có hạn
 * và chỉ trả cho `internal` (route ẩn danh mà trả URL ký thì biết usage id là qua mặt được chữ ký).
 * Thumbnail chỉ có khi đã sinh xong.
 */
export class GetMediaUsageUrlsUseCase {
  constructor(
    private readonly uow: MediaUnitOfWork,
    private readonly urls: MediaUrlBuilder,
  ) {}

  async execute(usageIds: readonly string[], scope: UsageUrlScope): Promise<UsageUrl[]> {
    const usages = await this.uow.stores.usages.findManyByIds(usageIds);
    const medias = await this.uow.stores.media.findManyByIds(usages.map((usage) => usage.mediaId));
    const byId = new Map(medias.map((media) => [media.id, media]));
    const result: UsageUrl[] = [];
    for (const usage of usages) {
      const media = byId.get(usage.mediaId);
      if (!media || media.status !== 'READY') continue;
      const signed = MEDIA_ACCESS_TIER_BY_USAGE[usage.usageType] === 'SIGNED';
      if (signed && scope === 'public') continue;
      result.push({
        usageId: usage.id,
        mediaId: media.id,
        url: this.urls.content(media.id, signed),
        thumbnailUrl:
          media.thumbnailStatus === 'READY' ? this.urls.thumbnail(media.id, signed) : null,
      });
    }
    return result;
  }

  async executeOne(usageId: string, scope: UsageUrlScope): Promise<UsageUrl> {
    const [found] = await this.execute([usageId], scope);
    if (!found) throw AppError.notFound('Không tìm thấy usage hoặc media chưa sẵn sàng');
    return found;
  }
}
