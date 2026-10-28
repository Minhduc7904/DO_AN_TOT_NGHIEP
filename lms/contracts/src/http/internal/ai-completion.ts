import { z } from 'zod';

import { aiProviderKindSchema, aiTaskKeySchema } from '../public/ai.js';

/** Giới hạn của một request completion (tổng ký tự văn bản + base64 của mọi phần). */
export const AI_COMPLETION_MAX_MESSAGES = 200;
export const AI_COMPLETION_MAX_PARTS = 64;
export const AI_COMPLETION_MAX_TOOLS = 16;
export const AI_COMPLETION_MAX_CHARS = 24_000_000;

export const aiMessageRoleSchema = z.enum(['system', 'user', 'assistant', 'tool']);

export const aiContentPartSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string() }),
  z.object({
    type: z.literal('image'),
    media_type: z.string().regex(/^image\/[\w.+-]+$/u),
    data_base64: z.string().min(1),
  }),
  z.object({
    type: z.literal('file'),
    media_type: z.string().regex(/^[\w.+-]+\/[\w.+-]+$/u),
    data_base64: z.string().min(1),
    file_name: z.string().min(1).max(255).optional(),
  }),
]);
export type AiContentPartDto = z.infer<typeof aiContentPartSchema>;

export const aiToolCallSchema = z.object({
  id: z.string().min(1).max(200),
  name: z.string().min(1).max(64),
  /** Chuỗi JSON đối số, giữ nguyên như provider trả. */
  arguments_json: z.string(),
});
export type AiToolCallDto = z.infer<typeof aiToolCallSchema>;

export const aiMessageSchema = z
  .object({
    role: aiMessageRoleSchema,
    text: z.string().optional(),
    parts: z.array(aiContentPartSchema).min(1).max(AI_COMPLETION_MAX_PARTS).optional(),
    tool_calls: z.array(aiToolCallSchema).min(1).max(32).optional(),
    tool_call_id: z.string().min(1).max(200).optional(),
  })
  .superRefine((message, context) => {
    const hasText = message.text !== undefined;
    const hasParts = message.parts !== undefined;
    if (hasText && hasParts) {
      context.addIssue({
        code: 'custom',
        path: ['parts'],
        message: 'Chỉ dùng text hoặc parts, không cả hai',
      });
    }
    if (!hasText && !hasParts && !(message.role === 'assistant' && message.tool_calls)) {
      context.addIssue({ code: 'custom', path: ['text'], message: 'Message cần text hoặc parts' });
    }
    if (message.tool_calls && message.role !== 'assistant') {
      context.addIssue({
        code: 'custom',
        path: ['tool_calls'],
        message: 'Chỉ message assistant có tool_calls',
      });
    }
    if (message.role === 'tool' && !message.tool_call_id) {
      context.addIssue({
        code: 'custom',
        path: ['tool_call_id'],
        message: 'Message tool cần tool_call_id',
      });
    }
    if (message.role !== 'tool' && message.tool_call_id) {
      context.addIssue({
        code: 'custom',
        path: ['tool_call_id'],
        message: 'Chỉ message tool có tool_call_id',
      });
    }
  });
export type AiMessageDto = z.infer<typeof aiMessageSchema>;

export const aiToolSchema = z.object({
  name: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/u),
  description: z.string().max(2000),
  /** JSON Schema (object) của đối số tool. */
  parameters_schema: z.record(z.string(), z.unknown()),
});
export type AiToolDto = z.infer<typeof aiToolSchema>;

function countCharacters(messages: readonly AiMessageDto[]): number {
  let total = 0;
  for (const message of messages) {
    total += message.text?.length ?? 0;
    for (const part of message.parts ?? []) {
      total += part.type === 'text' ? part.text.length : part.data_base64.length;
    }
  }
  return total;
}

/** Nội bộ (course → ai): `POST /internal/v1/ai/completions`, scope `ai:completion`. */
export const aiCompletionRequestSchema = z
  .object({
    task: aiTaskKeySchema,
    messages: z.array(aiMessageSchema).min(1).max(AI_COMPLETION_MAX_MESSAGES),
    tools: z.array(aiToolSchema).max(AI_COMPLETION_MAX_TOOLS).default([]),
  })
  .superRefine((request, context) => {
    if (countCharacters(request.messages) > AI_COMPLETION_MAX_CHARS) {
      context.addIssue({
        code: 'custom',
        path: ['messages'],
        message: `Tổng ký tự văn bản và base64 tối đa ${AI_COMPLETION_MAX_CHARS}`,
      });
    }
  });
export type AiCompletionRequest = z.infer<typeof aiCompletionRequestSchema>;

export const aiCompletionDtoSchema = z.object({
  task: aiTaskKeySchema,
  provider_type: aiProviderKindSchema,
  model_name: z.string(),
  text: z.string().nullable(),
  tool_calls: z.array(aiToolCallSchema),
  /** `length` nghĩa là model bị cắt do hết token đầu ra: văn bản chưa đầy đủ. */
  finish_reason: z.string(),
  prompt_tokens: z.number().int(),
  completion_tokens: z.number().int(),
  latency_ms: z.number().int(),
});
export type AiCompletionDto = z.infer<typeof aiCompletionDtoSchema>;
