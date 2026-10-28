import { parseInput, Roles } from '@aiops-lms/common/http';
import {
  aiTaskKeySchema,
  type AiOptionsDto,
  type AiServiceBindingDto,
  PUBLIC_PREFIX,
  upsertAiBindingRequestSchema,
} from '@aiops-lms/contracts';
import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Put, Res } from '@nestjs/common';

import { DeleteBindingUseCase } from '../../../application/use-cases/bindings/delete-binding.use-case.js';
import { GetBindingUseCase } from '../../../application/use-cases/bindings/get-binding.use-case.js';
import { ListBindingsUseCase } from '../../../application/use-cases/bindings/list-bindings.use-case.js';
import { UpsertBindingUseCase } from '../../../application/use-cases/bindings/upsert-binding.use-case.js';
import { GetAiOptionsUseCase } from '../../../application/use-cases/options/get-ai-options.use-case.js';
import { presentBinding, presentOptions } from '../shared/ai.presenter.js';

/** Phần của `Response` mà controller dùng để đổi status mà vẫn để Nest bọc envelope. */
interface StatusSetter {
  status(code: number): unknown;
}

@Roles('admin')
@Controller(`${PUBLIC_PREFIX}/ai`)
export class AiBindingController {
  constructor(
    @Inject(ListBindingsUseCase) private readonly listBindings: ListBindingsUseCase,
    @Inject(GetBindingUseCase) private readonly getBinding: GetBindingUseCase,
    @Inject(UpsertBindingUseCase) private readonly upsertBinding: UpsertBindingUseCase,
    @Inject(DeleteBindingUseCase) private readonly deleteBinding: DeleteBindingUseCase,
    @Inject(GetAiOptionsUseCase) private readonly getOptions: GetAiOptionsUseCase,
  ) {}

  @Get('service-bindings')
  async list(): Promise<AiServiceBindingDto[]> {
    return (await this.listBindings.execute()).map(presentBinding);
  }

  @Get('service-bindings/:task_key')
  async get(@Param('task_key') taskKey: string): Promise<AiServiceBindingDto> {
    return presentBinding(await this.getBinding.execute(parseInput(aiTaskKeySchema, taskKey)));
  }

  /** 201 khi tác vụ chưa có binding, 200 khi thay model của binding đã có. */
  @Put('service-bindings/:task_key')
  @HttpCode(201)
  async upsert(
    @Param('task_key') taskKey: string,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: StatusSetter,
  ): Promise<AiServiceBindingDto> {
    const input = parseInput(upsertAiBindingRequestSchema, body);
    const { binding, created } = await this.upsertBinding.execute(
      parseInput(aiTaskKeySchema, taskKey),
      input.model_id,
    );
    if (!created) response.status(200);
    return presentBinding(binding);
  }

  @Delete('service-bindings/:task_key')
  @HttpCode(204)
  async remove(@Param('task_key') taskKey: string): Promise<void> {
    await this.deleteBinding.execute(parseInput(aiTaskKeySchema, taskKey));
  }

  @Get('options')
  options(): AiOptionsDto {
    return presentOptions(this.getOptions.execute());
  }
}
