import {
  baseEnvironmentSchema,
  environmentBoolean,
  parseEnvironment,
} from '@aiops-lms/common/config';
import { z } from 'zod';

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === '' ? undefined : value))
  .optional();

const bootstrapServiceClientSchema = z
  .object({
    client_id: z.string().trim().min(1),
    client_secret: z.string().min(16),
    audiences: z.array(z.string().trim().min(1)).min(1),
    scopes: z.array(z.string().trim().min(1)),
  })
  .transform((client) => ({
    clientId: client.client_id,
    clientSecret: client.client_secret,
    audiences: client.audiences,
    scopes: client.scopes,
  }));

// JSON mảng client dịch vụ cần có khi khởi động; bỏ trống thì không đồng bộ client nào.
const serviceClientsBootstrap = z
  .string()
  .trim()
  .default('[]')
  .transform((text, ctx) => {
    try {
      return z.array(bootstrapServiceClientSchema).parse(JSON.parse(text));
    } catch {
      ctx.addIssue({
        code: 'custom',
        message: 'SERVICE_CLIENTS_BOOTSTRAP phải là JSON mảng client hợp lệ',
      });
      return z.NEVER;
    }
  });

// PEM trong biến môi trường thường viết một dòng với `\n` literal.
const pem = optionalText.transform((value) => value?.replaceAll('\\n', '\n'));

const environmentSchema = baseEnvironmentSchema
  .extend({
    PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
    IDENTITY_DATABASE_URL: z.url(),
    // Khóa ký Ed25519 (PKCS8 PEM). Thiếu thì sinh khóa tạm khi khởi động: chỉ cho development/test.
    IDENTITY_SIGNING_KEY_PEM: pem,
    // Public key (SPKI PEM) của khóa cũ, vẫn công bố trong JWKS trong cửa sổ xoay khóa.
    IDENTITY_PREVIOUS_PUBLIC_KEY_PEM: pem,
    // Cho phép khóa ký tạm khi NODE_ENV=production (testbed Compose); mặc định chỉ development/test.
    IDENTITY_ALLOW_EPHEMERAL_SIGNING_KEY: environmentBoolean.default(false),
    IDENTITY_SERVICE_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3_600).default(600),
    SERVICE_CLIENTS_BOOTSTRAP: serviceClientsBootstrap,
    IDENTITY_JWT_TTL_SECONDS: z.coerce.number().int().min(60).max(86_400).default(3_600),
    IDENTITY_REFRESH_TTL_SECONDS: z.coerce.number().int().min(300).max(2_592_000).default(86_400),
    IDENTITY_BOOTSTRAP_STUDENT_ID: z.uuid().default('11111111-1111-4111-8111-111111111111'),
    IDENTITY_BOOTSTRAP_STUDENT_EMAIL: optionalText,
    IDENTITY_BOOTSTRAP_STUDENT_PASSWORD: optionalText,
    // Tài khoản seed khi khởi động; bỏ trống cả email lẫn mật khẩu thì bỏ qua tài khoản đó.
    IDENTITY_BOOTSTRAP_ADMIN_ID: z.uuid().default('00000000-0000-4000-8000-000000000001'),
    IDENTITY_BOOTSTRAP_ADMIN_EMAIL: optionalText,
    IDENTITY_BOOTSTRAP_ADMIN_PASSWORD: optionalText,
    IDENTITY_BOOTSTRAP_INSTRUCTOR_ID: z.uuid().default('22222222-2222-4222-8222-222222222222'),
    IDENTITY_BOOTSTRAP_INSTRUCTOR_EMAIL: optionalText,
    IDENTITY_BOOTSTRAP_INSTRUCTOR_PASSWORD: optionalText,
  })
  .refine(
    (env) =>
      env.NODE_ENV !== 'production' ||
      env.IDENTITY_ALLOW_EPHEMERAL_SIGNING_KEY ||
      env.IDENTITY_SIGNING_KEY_PEM !== undefined,
    {
      message:
        'IDENTITY_SIGNING_KEY_PEM là bắt buộc khi NODE_ENV=production (testbed: IDENTITY_ALLOW_EPHEMERAL_SIGNING_KEY=true)',
      path: ['IDENTITY_SIGNING_KEY_PEM'],
    },
  );

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(config: Record<string, unknown>): Environment {
  return parseEnvironment(environmentSchema, config);
}
