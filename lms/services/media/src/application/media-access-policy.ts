import { AppError } from '@aiops-lms/common/errors';
import type { Clock } from '@aiops-lms/common/ports';
import { MEDIA_ACCESS_TIER_BY_USAGE } from '@aiops-lms/contracts/http/public';

import { mediaErrors } from '../domain/errors.js';
import type { UsageType } from '../domain/media.js';
import type { MediaUrlSigner, SignedUrlVariant } from '../domain/url-signer.js';
import type { MediaUnitOfWork } from './ports/unit-of-work.js';

/** `exp`/`sig` lấy từ query của URL ký; cả hai vắng nghĩa là URL trần. */
export interface UrlAccess {
  exp?: unknown;
  sig?: unknown;
}

/** Cách được phép xem: `SIGNED` dùng chữ ký (không cho cache chung), `PUBLIC` là usage công khai. */
export type AccessGrant = 'SIGNED' | 'PUBLIC';

const PUBLIC_USAGE_TYPES = (
  Object.entries(MEDIA_ACCESS_TIER_BY_USAGE) as [UsageType, 'PUBLIC' | 'SIGNED'][]
)
  .filter(([, tier]) => tier === 'PUBLIC')
  .map(([usageType]) => usageType);

/**
 * Quyết định ai được xem URL công khai của media: chữ ký hợp lệ, hoặc media có ít nhất một usage ở tầng `PUBLIC`.
 * Không đủ điều kiện thì `404` (không lộ media có tồn tại hay không); riêng URL có chữ ký sai/hết hạn trả `403`
 * `MEDIA_URL_INVALID` để client biết xin URL mới.
 */
export class MediaAccessPolicy {
  constructor(
    private readonly uow: MediaUnitOfWork,
    private readonly signer: MediaUrlSigner,
    private readonly clock: Clock,
  ) {}

  async assertCanView(
    mediaId: string,
    variant: SignedUrlVariant,
    access: UrlAccess,
  ): Promise<AccessGrant> {
    if (this.signer.verify(mediaId, variant, access.exp, access.sig, this.clock.now())) {
      return 'SIGNED';
    }
    const isPublic = await this.uow.stores.usages.existsByMediaAndTypes(
      mediaId,
      PUBLIC_USAGE_TYPES,
    );
    if (isPublic) return 'PUBLIC';
    if (access.exp !== undefined || access.sig !== undefined) throw mediaErrors.urlInvalid();
    throw AppError.notFound('Không tìm thấy media');
  }
}
