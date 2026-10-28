import { z } from 'zod';

import { idSchema } from '../common/index.js';

// ---- Request ---------------------------------------------------------------------------------

/** Nội bộ (auth → student): hồ sơ có `id` trùng tài khoản. */
export const createStudentRequestSchema = z.object({
  id: idSchema,
  email: z.email().max(254),
  full_name: z.string().trim().min(1).max(200),
});
export type CreateStudentRequest = z.infer<typeof createStudentRequestSchema>;
