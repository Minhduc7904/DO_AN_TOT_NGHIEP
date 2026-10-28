import { AppError } from '@aiops-lms/common/errors';
import type { Principal } from '@aiops-lms/common/ports';

import type { MediaObject } from '../domain/media.js';
import type { MediaRepository } from './ports/repositories.js';

/** Chủ sở hữu hoặc admin mới được thao tác trên media. */
export function assertCanManage(principal: Principal, media: MediaObject): void {
  if (principal.role !== 'admin' && media.uploadedBy !== principal.id) throw AppError.forbidden();
}

export async function requireMedia(media: MediaRepository, id: string): Promise<MediaObject> {
  const found = await media.findById(id);
  if (!found) throw AppError.notFound('Không tìm thấy media');
  return found;
}
