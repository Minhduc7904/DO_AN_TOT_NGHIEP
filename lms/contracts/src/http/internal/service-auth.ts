import { z } from 'zod';

/** Nội bộ (mọi service → auth): xác thực dịch vụ theo kiểu client-credentials. */
export const serviceTokenRequestSchema = z.object({
  client_id: z.string().trim().min(1).max(64),
  client_secret: z.string().min(1).max(256),
  /** Service đích sẽ nhận token (`aud`). */
  audience: z.string().trim().min(1).max(64),
  /** Danh sách scope cách nhau bởi dấu cách; bỏ trống thì cấp toàn bộ scope client được phép. */
  scope: z.string().trim().max(512).optional(),
});
export type ServiceTokenRequest = z.infer<typeof serviceTokenRequestSchema>;

export const serviceTokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.literal('Bearer'),
  expires_in: z.number().int().positive(),
  scope: z.string(),
});
export type ServiceTokenResponse = z.infer<typeof serviceTokenResponseSchema>;
