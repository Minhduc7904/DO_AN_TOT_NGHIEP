import type { Principal } from '@aiops-lms/common/ports';

import type { MediaObject, MediaStatus, MediaType } from '../../../domain/media.js';
import type { MediaUnitOfWork } from '../../ports/unit-of-work.js';

export interface MediaLibraryQuery {
  type?: MediaType | undefined;
  status?: MediaStatus | undefined;
  search?: string | undefined;
}

/** Admin xem toàn bộ thư viện; người khác chỉ thấy media của mình. */
export class GetMediaLibraryUseCase {
  constructor(private readonly uow: MediaUnitOfWork) {}

  execute(
    principal: Principal,
    query: MediaLibraryQuery,
    page: number,
    pageSize: number,
  ): Promise<{ items: MediaObject[]; total: number }> {
    return this.uow.stores.media.list(
      { ...query, uploadedBy: principal.role === 'admin' ? undefined : principal.id },
      page,
      pageSize,
    );
  }
}
