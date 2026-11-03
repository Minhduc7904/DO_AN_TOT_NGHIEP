import type { MediaAccessPolicy, UrlAccess } from '../../media-access-policy.js';
import type { GetMediaContentUseCase, MediaContent } from './get-media-content.use-case.js';
import type { GetMediaThumbnailUseCase } from './get-media-thumbnail.use-case.js';

/**
 * Bề mặt đọc của `GET /media/{id}/content|thumbnail` qua Gateway: kiểm tầng truy cập (URL ký hoặc usage công khai)
 * rồi stream. Route nội bộ (`ai-worker`) và avatar dùng thẳng use case nền, không qua cổng này.
 */
export class ServePublicMediaUseCase {
  constructor(
    private readonly policy: MediaAccessPolicy,
    private readonly getContent: GetMediaContentUseCase,
    private readonly getThumbnail: GetMediaThumbnailUseCase,
  ) {}

  async serveContent(
    mediaId: string,
    rangeHeader: string | undefined,
    access: UrlAccess,
  ): Promise<MediaContent> {
    const grant = await this.policy.assertCanView(mediaId, 'content', access);
    return {
      ...(await this.getContent.execute(mediaId, rangeHeader)),
      privateCache: grant === 'SIGNED',
    };
  }

  async serveThumbnail(
    mediaId: string,
    rangeHeader: string | undefined,
    access: UrlAccess,
  ): Promise<MediaContent> {
    const grant = await this.policy.assertCanView(mediaId, 'thumbnail', access);
    return {
      ...(await this.getThumbnail.execute(mediaId, rangeHeader)),
      privateCache: grant === 'SIGNED',
    };
  }
}
