import type {
  JobStatus,
  JobType,
  MediaJob,
  MediaObject,
  MediaStatus,
  MediaType,
  MediaUsage,
  ThumbnailStatus,
  UsageOwnerKind,
  UsageType,
} from '../../domain/media.js';

export interface NewMedia {
  id: string;
  type: MediaType;
  status: MediaStatus;
  thumbnailStatus: ThumbnailStatus;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  bucket: string;
  objectKey: string;
  tmpObjectKey?: string | null;
  uploadExpiresAt?: Date | null;
  uploadedBy: string;
  sourceMediaId?: string | null;
}

export interface MediaPatch {
  status?: MediaStatus;
  thumbnailStatus?: ThumbnailStatus;
  tmpObjectKey?: string | null;
  uploadExpiresAt?: Date | null;
  failureReason?: string | null;
  deletedAt?: Date | null;
}

export interface MediaFilter {
  uploadedBy?: string | undefined;
  type?: MediaType | undefined;
  status?: MediaStatus | undefined;
  search?: string | undefined;
}

export interface MediaSummary {
  total: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  totalSizeBytes: number;
  activeUsages: number;
  unusedReady: number;
}

export interface MediaRepository {
  create(media: NewMedia): Promise<MediaObject>;
  /** Chỉ trả media chưa xóa mềm. */
  findById(id: string): Promise<MediaObject | null>;
  findManyByIds(ids: readonly string[]): Promise<MediaObject[]>;
  /** Thumbnail đã sinh của một media gốc. */
  findThumbnailOf(sourceMediaId: string): Promise<MediaObject | null>;
  update(id: string, patch: MediaPatch): Promise<MediaObject | null>;
  /** Thư viện chỉ gồm ảnh gốc do người dùng tải lên (không có thumbnail sinh tự động). */
  list(
    filter: MediaFilter,
    page: number,
    pageSize: number,
  ): Promise<{ items: MediaObject[]; total: number }>;
  summary(): Promise<MediaSummary>;
  /** Cleanup: media gốc `READY` chưa xóa, không còn usage, tạo và cập nhật trước `olderThan`. */
  listUnusedReadyIds(olderThan: Date, limit: number): Promise<string[]>;
  /** Cleanup: upload `PENDING` có hạn presigned (hoặc ngày tạo nếu không có hạn) trước `expiredBefore`. */
  listStalePendingIds(expiredBefore: Date, limit: number): Promise<string[]>;
  /** Cleanup: thumbnail chưa xóa mà media gốc đã bị xóa mềm. */
  listOrphanThumbnailIds(limit: number): Promise<string[]>;
  /**
   * Khóa dòng media chưa xóa trong transaction hiện tại (`FOR UPDATE SKIP LOCKED`) rồi đọc lại.
   * `null` nếu đã xóa, không tồn tại hoặc đang bị lượt khác khóa.
   */
  lockForCleanup(id: string): Promise<MediaObject | null>;
  /** Như `findById` nhưng cả media đã xóa mềm (cleanup kiểm tra media gốc của thumbnail). */
  findIncludingDeleted(id: string): Promise<MediaObject | null>;
}

export interface NewUsage {
  id: string;
  mediaId: string;
  ownerKind: UsageOwnerKind;
  ownerId: string;
  usageType: UsageType;
  position: number;
  createdBy: string;
}

export interface UsageGroup {
  ownerKind: UsageOwnerKind;
  ownerId: string;
  usageType: UsageType;
}

export interface UsageRepository {
  /** Trùng (media, owner, type) trả usage đã có thay vì lỗi, để thao tác idempotent. */
  create(usage: NewUsage): Promise<MediaUsage>;
  findById(id: string): Promise<MediaUsage | null>;
  findManyByIds(ids: readonly string[]): Promise<MediaUsage[]>;
  listByGroup(group: UsageGroup): Promise<MediaUsage[]>;
  listByOwners(kind: UsageOwnerKind, ownerIds: readonly string[]): Promise<MediaUsage[]>;
  nextPosition(group: UsageGroup): Promise<number>;
  /** Đặt `position` theo thứ tự của `orderedIds`; trả usage sau khi sắp xếp. */
  reorder(group: UsageGroup, orderedIds: readonly string[]): Promise<MediaUsage[]>;
  deleteByIds(ids: readonly string[]): Promise<number>;
  countByMedia(mediaId: string): Promise<number>;
  /** Xóa usage thuộc tất cả group của owner mà `isSingleton` thay thế (thumbnail/avatar cũ). */
  deleteGroup(group: UsageGroup): Promise<number>;
}

export interface NewJob {
  id: string;
  type: JobType;
  deduplicationKey: string;
  status?: JobStatus;
  referenceId?: string | null;
  expectedCount?: number | null;
}

export interface JobPatch {
  status?: JobStatus;
  expectedCount?: number | null;
  lastError?: string | null;
  processedDelta?: number;
  failedDelta?: number;
}

export interface JobFilter {
  type?: JobType | undefined;
  status?: JobStatus | undefined;
}

export interface JobRepository {
  /** Tạo job, hoặc trả job đã có cùng `deduplicationKey`. */
  ensure(job: NewJob): Promise<MediaJob>;
  findById(id: string): Promise<MediaJob | null>;
  findByKey(deduplicationKey: string): Promise<MediaJob | null>;
  update(id: string, patch: JobPatch): Promise<MediaJob | null>;
  list(
    filter: JobFilter,
    page: number,
    pageSize: number,
  ): Promise<{ items: MediaJob[]; total: number }>;
}
