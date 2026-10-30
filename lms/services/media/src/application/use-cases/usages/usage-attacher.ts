import { AppError } from '@aiops-lms/common/errors';
import type { IdGenerator, Principal } from '@aiops-lms/common/ports';

import { mediaErrors } from '../../../domain/errors.js';
import {
  IMAGE_ONLY_USAGE_TYPES,
  type MediaUsage,
  SINGLETON_USAGE_TYPES,
  type UsageOwnerKind,
  type UsageType,
  USAGE_TYPES_BY_OWNER,
} from '../../../domain/media.js';
import { assertCanManage } from '../../media-access.js';
import type { StudentClient } from '../../ports/student-client.js';
import type { MediaStores } from '../../ports/unit-of-work.js';

export interface AttachUsageInput {
  mediaId: string;
  ownerKind: UsageOwnerKind;
  ownerId: string;
  usageType: UsageType;
  position?: number | undefined;
}

/** Quy tắc gắn/gỡ usage dùng chung cho tạo đơn, tạo lô, sắp xếp và xóa. */
export class UsageRules {
  constructor(
    private readonly students: StudentClient,
    private readonly ids: IdGenerator,
  ) {}

  /**
   * Role nào được thao tác trên owner nào; `MEDIA` chỉ do hệ thống (worker) tạo. Avatar (`USER`): mọi role
   * tự quản avatar của chính mình; admin chỉ được gỡ hoặc sắp xếp usage của người khác (xem `attach`).
   */
  assertCanManageOwner(principal: Principal, kind: UsageOwnerKind, ownerId: string): void {
    if (kind === 'MEDIA') throw AppError.forbidden('Usage MEDIA_THUMBNAIL do hệ thống quản lý');
    if (principal.role === 'admin') return;
    if (kind === 'COURSE' && principal.role === 'instructor') return;
    if (kind === 'USER' && principal.id === ownerId) return;
    throw AppError.forbidden();
  }

  async attach(
    stores: MediaStores,
    principal: Principal,
    input: AttachUsageInput,
  ): Promise<MediaUsage> {
    if (!USAGE_TYPES_BY_OWNER[input.ownerKind].includes(input.usageType)) {
      throw AppError.validation('usage_type không khớp owner_kind', {
        owner_kind: input.ownerKind,
        usage_type: input.usageType,
      });
    }
    this.assertCanManageOwner(principal, input.ownerKind, input.ownerId);
    // Không tra được tài khoản của người khác (media không đọc `identity_db`), nên chỉ chủ tài khoản đặt avatar.
    if (input.ownerKind === 'USER' && principal.id !== input.ownerId) {
      throw AppError.forbidden('Chỉ chủ tài khoản được đặt avatar');
    }

    const media = await stores.media.findById(input.mediaId);
    if (!media) throw AppError.notFound('Không tìm thấy media');
    assertCanManage(principal, media);
    if (media.status !== 'READY') throw mediaErrors.notReady({ status: media.status });
    if (
      IMAGE_ONLY_USAGE_TYPES.includes(input.usageType) &&
      (media.type !== 'IMAGE' || media.sourceMediaId !== null)
    ) {
      throw mediaErrors.usageConflict('Loại usage này chỉ nhận ảnh gốc');
    }
    // Token chứng minh tài khoản tồn tại; riêng student còn phải có hồ sơ `ACTIVE` (như điều kiện đăng nhập).
    if (input.ownerKind === 'USER' && principal.role === 'student') {
      const status = await this.students.findStatus(input.ownerId);
      if (status === null) throw AppError.notFound('Không tìm thấy hồ sơ student');
      if (status !== 'ACTIVE') throw AppError.forbidden('Hồ sơ student không còn hoạt động');
    }

    const group = {
      ownerKind: input.ownerKind,
      ownerId: input.ownerId,
      usageType: input.usageType,
    };
    // Thumbnail/avatar chỉ có một: đặt lại thì thay bản cũ (partial unique index chặn trùng).
    if (SINGLETON_USAGE_TYPES.includes(input.usageType)) await stores.usages.deleteGroup(group);
    return stores.usages.create({
      id: this.ids.next(),
      mediaId: media.id,
      ...group,
      position: input.position ?? (await stores.usages.nextPosition(group)),
      createdBy: principal.id,
    });
  }
}
