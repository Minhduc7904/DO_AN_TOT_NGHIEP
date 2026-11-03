import type { Clock } from '@aiops-lms/common/ports';

import type { MediaUrlSigner } from '../domain/url-signer.js';
import { mediaContentUrl, mediaThumbnailUrl } from '../domain/urls.js';

/** Dựng URL content/thumbnail: URL ký (có hạn) cho tầng `SIGNED`, URL trần chỉ cho media có usage công khai. */
export class MediaUrlBuilder {
  constructor(
    private readonly signer: MediaUrlSigner,
    private readonly clock: Clock,
  ) {}

  content(mediaId: string, signed: boolean): string {
    const url = mediaContentUrl(mediaId);
    return signed ? `${url}?${this.signer.query(mediaId, 'content', this.clock.now())}` : url;
  }

  thumbnail(mediaId: string, signed: boolean): string {
    const url = mediaThumbnailUrl(mediaId);
    return signed ? `${url}?${this.signer.query(mediaId, 'thumbnail', this.clock.now())}` : url;
  }
}
