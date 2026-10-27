import { z } from 'zod';

import { idSchema, paginationQuerySchema } from './common.js';

export const studentStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED']);

// ---- Request ---------------------------------------------------------------------------------

/** Nội bộ (auth → student): hồ sơ có `id` trùng tài khoản. */
export const createStudentRequestSchema = z.object({
  id: idSchema,
  email: z.email().max(254),
  full_name: z.string().trim().min(1).max(200),
});
export type CreateStudentRequest = z.infer<typeof createStudentRequestSchema>;

export const listStudentsQuerySchema = paginationQuerySchema;
export type ListStudentsQuery = z.infer<typeof listStudentsQuerySchema>;

// ---- Response `data` -------------------------------------------------------------------------

export const studentDtoSchema = z.object({
  id: idSchema,
  email: z.string(),
  full_name: z.string(),
  status: studentStatusSchema,
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
});
export type StudentDto = z.infer<typeof studentDtoSchema>;
