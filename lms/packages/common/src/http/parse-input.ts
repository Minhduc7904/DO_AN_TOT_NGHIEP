import type { ZodType } from 'zod';
import { z } from 'zod';

import { AppError } from '../errors/index.js';

/** Validate input HTTP bằng zod schema của contract; lỗi thành `VALIDATION_ERROR` kèm danh sách issue. */
export function parseInput<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw AppError.validation(
    'Dữ liệu yêu cầu không hợp lệ',
    result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  );
}

export { z };
