import type { JobType, JsonObject } from '../../domain/job.js';

export interface JobHandlerResult {
  /** Tóm tắt an toàn ghi vào `output_json`. */
  output: JsonObject;
  /** Có giá trị khi handler chạy xong nhưng kết quả là thất bại (không phải ngoại lệ). */
  failure?: { code: string; message: string } | undefined;
}

/** Thực thi một loại job; đích đến là service sở hữu nghiệp vụ, scheduler không biết chi tiết. */
export interface JobHandler {
  handle(payload: JsonObject): Promise<JobHandlerResult>;
}

export type JobHandlers = Record<JobType, JobHandler>;

export const JOB_HANDLERS = Symbol('JOB_HANDLERS');
