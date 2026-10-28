import { z } from 'zod';

const id = z.uuid();

/** Đích của command: service.name của worker và queue canonical `<worker>--<command-kebab>-v<n>`. */
export const AI_WORKER = 'ai-worker';

/** Tên command và queue của `ai-worker` (nguồn duy nhất cho producer và consumer). */
export const AI_COMMANDS = {
  documentExtract: {
    name: 'ai.document.extract',
    version: 1,
    queue: 'ai-worker--extract-ai-document-v1',
  },
  jobRun: {
    name: 'ai.job.run',
    version: 1,
    queue: 'ai-worker--run-ai-job-v1',
  },
} as const;

/**
 * `ai` (đồng bộ tài liệu của bài học) và `media` (tệp READY có cờ `extract_text`) → `ai-worker`:
 * trích văn bản một tệp. Kèm metadata tệp để `ai` tự tạo bản ghi tài liệu mà không cần hỏi lại `media`;
 * bản ghi đã có thì consumer giữ nguyên (idempotent theo `media_id`).
 */
export const documentExtractPayloadSchema = z.object({
  media_id: id,
  file_name: z.string().min(1).max(255),
  content_type: z.string().min(1).max(255),
  media_type: z.enum(['IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO', 'OTHER']),
});
export type DocumentExtractPayload = z.infer<typeof documentExtractPayloadSchema>;

/**
 * `ai` → `ai-worker`: chạy một job AI đã ghi trong `ai_jobs`. Mỗi job đúng một command, ghi cùng
 * transaction với bản ghi job; worker nhận job bằng lease nên command giao lại không chạy job hai lần.
 */
export const jobRunPayloadSchema = z.object({ job_id: id });
export type JobRunPayload = z.infer<typeof jobRunPayloadSchema>;

/** Fixture ổn định cho contract test của từng command. */
export const aiCommandFixtures = {
  documentExtract: {
    media_id: '3f9c1e52-8a4b-4d7e-9b1a-0c6e2d5f7a10',
    file_name: 'giao-trinh.docx',
    content_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    media_type: 'DOCUMENT',
  },
  jobRun: { job_id: '7e2a4c6d-9b1f-4d38-a5c7-0f1e2d3c4b5a' },
} as const;
