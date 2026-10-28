import { InternalApi, parseInput } from '@aiops-lms/common/http';
import {
  aiCompletionRequestSchema,
  type AiCompletionDto,
  INTERNAL_PREFIX,
} from '@aiops-lms/contracts';
import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';

import { CreateCompletionUseCase } from '../../../application/use-cases/completions/create-completion.use-case.js';
import { presentCompletion } from '../shared/ai.presenter.js';

/** Bề mặt nội bộ của `ai` cho course; không qua Gateway. Actor không dùng: cấu hình AI là dữ liệu chung. */
@Controller(`${INTERNAL_PREFIX}/ai`)
export class AiCompletionController {
  constructor(
    @Inject(CreateCompletionUseCase) private readonly createCompletion: CreateCompletionUseCase,
  ) {}

  @InternalApi({ scopes: ['ai:completion'] })
  @Post('completions')
  @HttpCode(200)
  async complete(@Body() body: unknown): Promise<AiCompletionDto> {
    const input = parseInput(aiCompletionRequestSchema, body);
    return presentCompletion(
      await this.createCompletion.execute({
        task: input.task,
        messages: input.messages.map((message) => ({
          role: message.role,
          text: message.text,
          parts: message.parts?.map((part) =>
            part.type === 'text'
              ? { type: 'text' as const, text: part.text }
              : part.type === 'image'
                ? {
                    type: 'image' as const,
                    mediaType: part.media_type,
                    dataBase64: part.data_base64,
                  }
                : {
                    type: 'file' as const,
                    mediaType: part.media_type,
                    dataBase64: part.data_base64,
                    fileName: part.file_name,
                  },
          ),
          toolCalls: message.tool_calls?.map((call) => ({
            id: call.id,
            name: call.name,
            argumentsJson: call.arguments_json,
          })),
          toolCallId: message.tool_call_id,
        })),
        tools: input.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          parametersSchema: tool.parameters_schema,
        })),
      }),
    );
  }
}
