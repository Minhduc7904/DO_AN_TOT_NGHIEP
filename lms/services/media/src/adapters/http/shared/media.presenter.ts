import type {
  MediaCleanupSummaryDto,
  MediaDto,
  MediaJobDto,
  MediaSummaryDto,
  MediaUsageDto,
  MediaUsageUrlDto,
} from '@aiops-lms/contracts';

import type { MediaSummary } from '../../../application/ports/repositories.js';
import type { CleanupMediaSummary } from '../../../application/use-cases/cleanup/cleanup-media.use-case.js';
import type { UsageUrl } from '../../../application/use-cases/usages/get-media-usage-urls.use-case.js';
import type { MediaJob, MediaObject, MediaUsage } from '../../../domain/media.js';
import { mediaContentUrl, mediaThumbnailUrl } from '../../../domain/urls.js';

/** DTO không có `bucket`, `objectKey` hay `tmpObjectKey`: client chỉ thấy URL công khai. */
export function presentMedia(media: MediaObject): MediaDto {
  const ready = media.status === 'READY';
  return {
    id: media.id,
    type: media.type,
    status: media.status,
    original_name: media.originalName,
    mime_type: media.mimeType,
    size_bytes: media.sizeBytes,
    checksum_sha256: media.checksumSha256,
    extract_text: media.extractText,
    thumbnail_status: media.thumbnailStatus,
    content_url: ready ? mediaContentUrl(media.id) : null,
    thumbnail_url: media.thumbnailStatus === 'READY' ? mediaThumbnailUrl(media.id) : null,
    uploaded_by: media.uploadedBy,
    created_at: media.createdAt.toISOString(),
    updated_at: media.updatedAt.toISOString(),
  };
}

export function presentUsage(usage: MediaUsage): MediaUsageDto {
  return {
    id: usage.id,
    media_id: usage.mediaId,
    owner_kind: usage.ownerKind,
    owner_id: usage.ownerId,
    usage_type: usage.usageType,
    position: usage.position,
    created_at: usage.createdAt.toISOString(),
  };
}

export function presentUsageUrl(url: UsageUrl): MediaUsageUrlDto {
  return {
    usage_id: url.usageId,
    media_id: url.mediaId,
    url: url.url,
    thumbnail_url: url.thumbnailUrl,
  };
}

/** Chỉ số lượng và tham số hiệu lực; không bao giờ có object key hay credential. */
export function presentCleanupSummary(summary: CleanupMediaSummary): MediaCleanupSummaryDto {
  return {
    retention_hours: summary.retentionHours,
    pending_grace_minutes: summary.pendingGraceMinutes,
    limit: summary.limit,
    unused_deleted: summary.unusedDeleted,
    thumbnails_deleted: summary.thumbnailsDeleted,
    objects_removed: summary.objectsRemoved,
    pending_recovered: summary.pendingRecovered,
    pending_orphan_objects_removed: summary.pendingOrphanObjectsRemoved,
    skipped: summary.skipped,
    failed: summary.failed,
    has_more: summary.hasMore,
  };
}

export function presentJob(job: MediaJob): MediaJobDto {
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    reference_id: job.referenceId,
    expected_count: job.expectedCount,
    processed_count: job.processedCount,
    failed_count: job.failedCount,
    last_error: job.lastError,
    created_at: job.createdAt.toISOString(),
    updated_at: job.updatedAt.toISOString(),
  };
}

export function presentSummary(summary: MediaSummary): MediaSummaryDto {
  return {
    total: summary.total,
    by_status: summary.byStatus,
    by_type: summary.byType,
    total_size_bytes: summary.totalSizeBytes,
    active_usages: summary.activeUsages,
    unused_ready: summary.unusedReady,
  };
}
