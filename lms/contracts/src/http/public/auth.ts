import { z } from 'zod';

import { idSchema, paginationQuerySchema, roleSchema } from '../common/index.js';

const email = z.email().max(254);
const password = z.string().min(8).max(128);
const fullName = z.string().trim().min(1).max(200);

// ---- Request ---------------------------------------------------------------------------------

export const registerRequestSchema = z.object({ email, password, full_name: fullName });
export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const loginRequestSchema = z.object({ email, password: z.string().min(1).max(128) });
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const refreshRequestSchema = z.object({
  refresh_token: z.string().trim().min(1).max(512),
});
export type RefreshRequest = z.infer<typeof refreshRequestSchema>;

/** Admin tạo tài khoản instructor hoặc admin; student tự đăng ký. */
export const createAccountRequestSchema = z.object({
  email,
  password,
  full_name: fullName,
  role: z.enum(['instructor', 'admin']),
});
export type CreateAccountRequest = z.infer<typeof createAccountRequestSchema>;

export const listAccountsQuerySchema = paginationQuerySchema.extend({
  role: roleSchema.optional(),
});
export type ListAccountsQuery = z.infer<typeof listAccountsQuerySchema>;

// ---- Response `data` -------------------------------------------------------------------------

export const accountStatusSchema = z.enum(['ACTIVE', 'DISABLED']);

export const accountDtoSchema = z.object({
  id: idSchema,
  email: z.string(),
  full_name: z.string(),
  role: roleSchema,
  status: accountStatusSchema,
  /** URL avatar công khai, luôn có; `404` khi chưa đặt avatar (xem `userAvatarUrl`). */
  avatar_url: z.string(),
  created_at: z.iso.datetime(),
});
export type AccountDto = z.infer<typeof accountDtoSchema>;

export const tokenPairDtoSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  token_type: z.literal('Bearer'),
  expires_in_seconds: z.number().int().positive(),
});
export type TokenPairDto = z.infer<typeof tokenPairDtoSchema>;

export const loginResponseDtoSchema = tokenPairDtoSchema.extend({
  principal: z.object({ id: idSchema, role: roleSchema }),
});
export type LoginResponseDto = z.infer<typeof loginResponseDtoSchema>;
