import { z } from 'zod';

import { idSchema, paginationQuerySchema } from '../common/index.js';

export const studentStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED']);

// ---- Request ---------------------------------------------------------------------------------

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
