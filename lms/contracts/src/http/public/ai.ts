import { z } from 'zod';

import { idSchema, paginationQuerySchema } from '../common/index.js';

/** Loại provider; mọi loại đều nói chuẩn OpenAI chat-completions (khác nhau ở base URL và vài header). */
export const AI_PROVIDER_KINDS = ['OPENAI', 'GEMINI', 'ANTHROPIC', 'MISTRAL', 'CUSTOM'] as const;
export const aiProviderKindSchema = z.enum(AI_PROVIDER_KINDS);
export type AiProviderKind = z.infer<typeof aiProviderKindSchema>;

/** Khóa tác vụ AI; mỗi khóa được gán đúng một model. */
export const AI_TASK_KEYS = ['document-extraction', 'lesson-synthesis', 'quiz-authoring'] as const;
export const aiTaskKeySchema = z.enum(AI_TASK_KEYS);
export type AiTaskKey = z.infer<typeof aiTaskKeySchema>;

export const aiStatusSchema = z.enum(['ACTIVE', 'INACTIVE']);
export type AiStatus = z.infer<typeof aiStatusSchema>;

export const aiHealthStatusSchema = z.enum([
  'ONLINE',
  'AUTH_FAILED',
  'UNREACHABLE',
  'ERROR',
  'DISABLED',
]);
export type AiHealthStatus = z.infer<typeof aiHealthStatusSchema>;

const dateTime = z.iso.datetime();

const providerName = z.string().trim().min(2).max(100);
/** URL tuyệt đối http(s), không chứa user/password. */
const baseUrl = z
  .string()
  .trim()
  .max(500)
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password
      );
    } catch {
      return false;
    }
  }, 'base_url phải là URL http(s) tuyệt đối, không chứa user/password');
/** Chỉ ghi, không bao giờ xuất hiện trong response. */
const apiKey = z.string().min(8).max(500).regex(/^\S+$/u, 'api_key không được chứa khoảng trắng');

// ---- Request ---------------------------------------------------------------------------------

export const createAiProviderRequestSchema = z
  .object({
    name: providerName,
    provider_type: aiProviderKindSchema,
    /** Bỏ trống thì dùng endpoint mặc định của loại provider; bắt buộc với `CUSTOM`. */
    base_url: baseUrl.nullish(),
    api_key: apiKey,
    status: aiStatusSchema.default('ACTIVE'),
  })
  .refine((value) => value.provider_type !== 'CUSTOM' || Boolean(value.base_url), {
    path: ['base_url'],
    message: 'base_url là bắt buộc với provider_type CUSTOM',
  });
export type CreateAiProviderRequest = z.infer<typeof createAiProviderRequestSchema>;

/** `api_key` bỏ trống = giữ key hiện có. */
export const updateAiProviderRequestSchema = z
  .object({
    name: providerName,
    provider_type: aiProviderKindSchema,
    base_url: baseUrl.nullish(),
    api_key: apiKey.optional(),
    status: aiStatusSchema,
  })
  .refine((value) => value.provider_type !== 'CUSTOM' || Boolean(value.base_url), {
    path: ['base_url'],
    message: 'base_url là bắt buộc với provider_type CUSTOM',
  });
export type UpdateAiProviderRequest = z.infer<typeof updateAiProviderRequestSchema>;

export const listAiProvidersQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).max(100).optional(),
  status: aiStatusSchema.optional(),
  provider_type: aiProviderKindSchema.optional(),
});
export type ListAiProvidersQuery = z.infer<typeof listAiProvidersQuerySchema>;

const modelName = z.string().trim().min(1).max(100);

export const createAiModelRequestSchema = z.object({
  provider_id: idSchema,
  model_name: modelName,
  display_name: modelName,
  status: aiStatusSchema.default('ACTIVE'),
});
export type CreateAiModelRequest = z.infer<typeof createAiModelRequestSchema>;

/** Không đổi được provider của model. */
export const updateAiModelRequestSchema = z.object({
  model_name: modelName,
  display_name: modelName,
  status: aiStatusSchema,
});
export type UpdateAiModelRequest = z.infer<typeof updateAiModelRequestSchema>;

export const listAiModelsQuerySchema = paginationQuerySchema.extend({
  provider_id: idSchema.optional(),
  status: aiStatusSchema.optional(),
  search: z.string().trim().min(1).max(100).optional(),
});
export type ListAiModelsQuery = z.infer<typeof listAiModelsQuerySchema>;

export const upsertAiBindingRequestSchema = z.object({ model_id: idSchema });
export type UpsertAiBindingRequest = z.infer<typeof upsertAiBindingRequestSchema>;

// ---- Response --------------------------------------------------------------------------------

/** Provider không bao giờ trả API key hay ciphertext; chỉ `api_key_hint` (`****` + 4 ký tự cuối). */
export const aiProviderDtoSchema = z.object({
  id: idSchema,
  name: z.string(),
  provider_type: aiProviderKindSchema,
  base_url: z.string(),
  api_key_hint: z.string(),
  status: aiStatusSchema,
  created_at: dateTime,
  updated_at: dateTime,
});
export type AiProviderDto = z.infer<typeof aiProviderDtoSchema>;

export const aiModelDtoSchema = z.object({
  id: idSchema,
  provider_id: idSchema,
  provider_name: z.string(),
  provider_type: aiProviderKindSchema,
  model_name: z.string(),
  display_name: z.string(),
  status: aiStatusSchema,
  created_at: dateTime,
  updated_at: dateTime,
});
export type AiModelDto = z.infer<typeof aiModelDtoSchema>;

export const aiServiceBindingDtoSchema = z.object({
  id: idSchema,
  task_key: aiTaskKeySchema,
  model_id: idSchema,
  model_name: z.string(),
  model_display_name: z.string(),
  model_status: aiStatusSchema,
  provider_id: idSchema,
  provider_name: z.string(),
  provider_type: aiProviderKindSchema,
  provider_status: aiStatusSchema,
  created_at: dateTime,
  updated_at: dateTime,
});
export type AiServiceBindingDto = z.infer<typeof aiServiceBindingDtoSchema>;

export const aiProviderHealthDtoSchema = z.object({
  provider_id: idSchema,
  name: z.string(),
  provider_type: aiProviderKindSchema,
  base_url: z.string(),
  provider_status: aiStatusSchema,
  health_status: aiHealthStatusSchema,
  http_status: z.number().int().nullable(),
  latency_ms: z.number().int().nullable(),
  /** Mô tả ngắn, không chứa API key, host nội bộ hay nội dung response của provider. */
  message: z.string(),
  checked_at: dateTime,
});
export type AiProviderHealthDto = z.infer<typeof aiProviderHealthDtoSchema>;

export const aiOptionsDtoSchema = z.object({
  provider_types: z.array(
    z.object({ provider_type: aiProviderKindSchema, default_base_url: z.string().nullable() }),
  ),
  task_keys: z.array(aiTaskKeySchema),
});
export type AiOptionsDto = z.infer<typeof aiOptionsDtoSchema>;
