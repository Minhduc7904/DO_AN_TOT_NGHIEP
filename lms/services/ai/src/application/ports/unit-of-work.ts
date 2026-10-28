import type {
  DocumentToExtract,
  DocumentRepository,
  JobRepository,
} from './lesson-ai-repositories.js';

/** Command phát đi, ghi vào outbox cùng transaction với dữ liệu nghiệp vụ. */
export interface AiCommands {
  requestDocumentExtraction(document: DocumentToExtract): Promise<void>;
  requestJobRun(jobId: string): Promise<void>;
}

export interface AiStores {
  documents: DocumentRepository;
  jobs: JobRepository;
  commands: AiCommands;
}

export const AI_UNIT_OF_WORK = Symbol('AI_UNIT_OF_WORK');

export interface AiUnitOfWork {
  /** Truy cập ngoài transaction (đọc, hoặc ghi đơn lẻ). */
  readonly stores: AiStores;
  /** Chạy `work` trong một transaction; mọi store trong `work` cùng commit hoặc cùng rollback. */
  run<T>(work: (stores: AiStores) => Promise<T>): Promise<T>;
  /** Như `run` nhưng bỏ qua nếu `messageId` đã được `consumer` xử lý (inbox). */
  runOnce(
    messageId: string,
    consumer: string,
    work: (stores: AiStores) => Promise<void>,
  ): Promise<'processed' | 'deduplicated'>;
}
