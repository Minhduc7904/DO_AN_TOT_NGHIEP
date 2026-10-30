import { AppError } from '@aiops-lms/common/errors';

import type { MediaUnitOfWork } from '../../ports/unit-of-work.js';
import type { GetMediaContentUseCase, MediaContent } from './get-media-content.use-case.js';

/** Stream avatar hiện tại của một tài khoản (route công khai `avatars/{user_id}`); `404` khi chưa đặt. */
export class GetUserAvatarContentUseCase {
  constructor(
    private readonly uow: MediaUnitOfWork,
    private readonly content: GetMediaContentUseCase,
  ) {}

  async execute(userId: string, rangeHeader: string | undefined): Promise<MediaContent> {
    const usages = await this.uow.stores.usages.listByOwners('USER', [userId]);
    const avatar = usages.find((usage) => usage.usageType === 'USER_AVATAR');
    if (!avatar) throw AppError.notFound('Tài khoản chưa đặt avatar');
    return this.content.execute(avatar.mediaId, rangeHeader);
  }
}
