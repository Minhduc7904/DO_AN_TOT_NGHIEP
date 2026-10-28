import { z } from 'zod';

import { roleSchema } from './envelope.js';

/** Loại token do auth cấp: `user` từ đăng nhập, `service` từ xác thực dịch vụ. */
export const TOKEN_TYPES = ['user', 'service'] as const;
export const tokenTypeSchema = z.enum(TOKEN_TYPES);
export type TokenType = z.infer<typeof tokenTypeSchema>;

export const TOKEN_ISSUER = 'aiops-lms-auth';
export const USER_TOKEN_AUDIENCE = 'aiops-lms';

/** Scope của Gateway: được gọi mọi route public của service đích và chuyển danh tính user. */
export const GATEWAY_PROXY_SCOPE = 'gateway:proxy';
export const GATEWAY_SERVICE_NAME = 'gateway';

const baseClaims = {
  iss: z.literal(TOKEN_ISSUER),
  aud: z.union([z.string(), z.array(z.string())]),
  sub: z.string().min(1),
  jti: z.string().min(1),
  iat: z.number().int(),
  exp: z.number().int(),
};

export const userTokenClaimsSchema = z.object({
  ...baseClaims,
  typ: z.literal('user'),
  role: roleSchema,
});
export type UserTokenClaims = z.infer<typeof userTokenClaimsSchema>;

export const serviceTokenClaimsSchema = z.object({
  ...baseClaims,
  typ: z.literal('service'),
  scope: z.string(),
});
export type ServiceTokenClaims = z.infer<typeof serviceTokenClaimsSchema>;

export const tokenClaimsSchema = z.discriminatedUnion('typ', [
  userTokenClaimsSchema,
  serviceTokenClaimsSchema,
]);
export type TokenClaims = z.infer<typeof tokenClaimsSchema>;

// ---- JWKS ------------------------------------------------------------------------------------

export const jwkSchema = z.object({
  kty: z.literal('OKP'),
  crv: z.literal('Ed25519'),
  x: z.string(),
  kid: z.string(),
  alg: z.literal('EdDSA'),
  use: z.literal('sig'),
});
export type Jwk = z.infer<typeof jwkSchema>;

export const jwksSchema = z.object({ keys: z.array(jwkSchema) });
export type Jwks = z.infer<typeof jwksSchema>;
