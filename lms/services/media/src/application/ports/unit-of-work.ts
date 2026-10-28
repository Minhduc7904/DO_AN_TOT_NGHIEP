import type { JobRepository, MediaRepository, UsageRepository } from './repositories.js';

/** Command phát sang `media-worker`, ghi vào outbox cùng transaction với dữ liệu nghiệp vụ. */
export interface MediaCommands {
  requestThumbnail(mediaId: string): Promise<void>;
}

export interface MediaStores {
  media: MediaRepository;
  usages: UsageRepository;
  jobs: JobRepository;
  commands: MediaCommands;
}

export const MEDIA_UNIT_OF_WORK = Symbol('MEDIA_UNIT_OF_WORK');

export interface MediaUnitOfWork {
  /** Truy cập ngoài transaction (đọc, hoặc ghi đơn lẻ). */
  readonly stores: MediaStores;
  /** Chạy `work` trong một transaction; mọi store trong `work` cùng commit hoặc cùng rollback. */
  run<T>(work: (stores: MediaStores) => Promise<T>): Promise<T>;
  /** Như `run` nhưng bỏ qua nếu `messageId` đã được `consumer` xử lý (inbox). */
  runOnce(
    messageId: string,
    consumer: string,
    work: (stores: MediaStores) => Promise<void>,
  ): Promise<'processed' | 'deduplicated'>;
}
