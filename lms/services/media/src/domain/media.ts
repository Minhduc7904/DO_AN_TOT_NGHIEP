export type MediaType = 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'AUDIO' | 'OTHER';
export type MediaStatus = 'PENDING' | 'READY' | 'FAILED';
export type ThumbnailStatus = 'NOT_APPLICABLE' | 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
export type UsageOwnerKind = 'COURSE' | 'NOTIFICATION' | 'STUDENT' | 'MEDIA';
export type UsageType =
  | 'COURSE_THUMBNAIL'
  | 'COURSE_GALLERY'
  | 'COURSE_DESCRIPTION'
  | 'LESSON_CONTENT'
  | 'LESSON_ATTACHMENT'
  | 'QUIZ_CONTENT'
  | 'NOTIFICATION_BODY'
  | 'STUDENT_AVATAR'
  | 'MEDIA_THUMBNAIL';
export type JobType =
  'THUMBNAIL_DERIVATION' | 'MARKDOWN_USAGE_SYNC' | 'MEDIA_USAGE_DELETE' | 'NOTIFICATION_USAGE';
export type JobStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'PARTIAL_FAILED' | 'FAILED';

/** Metadata một object MinIO. `bucket`/`objectKey` không bao giờ ra khỏi service. */
export interface MediaObject {
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
  tmpObjectKey: string | null;
  uploadExpiresAt: Date | null;
  uploadedBy: string;
  sourceMediaId: string | null;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface MediaUsage {
  id: string;
  mediaId: string;
  ownerKind: UsageOwnerKind;
  ownerId: string;
  usageType: UsageType;
  position: number;
  createdBy: string;
  createdAt: Date;
}

export interface MediaJob {
  id: string;
  type: JobType;
  status: JobStatus;
  deduplicationKey: string;
  referenceId: string | null;
  expectedCount: number | null;
  processedCount: number;
  failedCount: number;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Kind nào được phép đi với usage type nào. `MEDIA_THUMBNAIL` chỉ do hệ thống tạo. */
export const USAGE_TYPES_BY_OWNER: Record<UsageOwnerKind, readonly UsageType[]> = {
  COURSE: [
    'COURSE_THUMBNAIL',
    'COURSE_GALLERY',
    'COURSE_DESCRIPTION',
    'LESSON_CONTENT',
    'LESSON_ATTACHMENT',
    'QUIZ_CONTENT',
  ],
  NOTIFICATION: ['NOTIFICATION_BODY'],
  STUDENT: ['STUDENT_AVATAR'],
  MEDIA: ['MEDIA_THUMBNAIL'],
};

/** Usage type chỉ nhận ảnh gốc `READY` (không phải thumbnail sinh tự động). */
export const IMAGE_ONLY_USAGE_TYPES: readonly UsageType[] = [
  'COURSE_THUMBNAIL',
  'COURSE_GALLERY',
  'STUDENT_AVATAR',
];

/** Usage type có đúng một bản ghi cho mỗi owner (thay thế bản cũ khi đặt lại). */
export const SINGLETON_USAGE_TYPES: readonly UsageType[] = ['COURSE_THUMBNAIL', 'STUDENT_AVATAR'];
