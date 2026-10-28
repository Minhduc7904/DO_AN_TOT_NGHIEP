import { type Page, parseInput, Roles, toPage } from '@aiops-lms/common/http';
import {
  type AiModelDto,
  createAiModelRequestSchema,
  idSchema,
  listAiModelsQuerySchema,
  PUBLIC_PREFIX,
  updateAiModelRequestSchema,
} from '@aiops-lms/contracts';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';

import { CreateModelUseCase } from '../../../application/use-cases/models/create-model.use-case.js';
import { DeleteModelUseCase } from '../../../application/use-cases/models/delete-model.use-case.js';
import { GetModelUseCase } from '../../../application/use-cases/models/get-model.use-case.js';
import { ListModelsUseCase } from '../../../application/use-cases/models/list-models.use-case.js';
import { UpdateModelUseCase } from '../../../application/use-cases/models/update-model.use-case.js';
import { presentModel } from '../shared/ai.presenter.js';

@Roles('admin')
@Controller(`${PUBLIC_PREFIX}/ai/models`)
export class AiModelController {
  constructor(
    @Inject(ListModelsUseCase) private readonly listModels: ListModelsUseCase,
    @Inject(CreateModelUseCase) private readonly createModel: CreateModelUseCase,
    @Inject(GetModelUseCase) private readonly getModel: GetModelUseCase,
    @Inject(UpdateModelUseCase) private readonly updateModel: UpdateModelUseCase,
    @Inject(DeleteModelUseCase) private readonly deleteModel: DeleteModelUseCase,
  ) {}

  @Get()
  async list(@Query() query: unknown): Promise<Page<AiModelDto>> {
    const input = parseInput(listAiModelsQuerySchema, query);
    const result = await this.listModels.execute(
      { providerId: input.provider_id, status: input.status, search: input.search },
      input.page,
      input.page_size,
    );
    return toPage(result, input, presentModel);
  }

  @Post()
  async create(@Body() body: unknown): Promise<AiModelDto> {
    const input = parseInput(createAiModelRequestSchema, body);
    return presentModel(
      await this.createModel.execute({
        providerId: input.provider_id,
        modelName: input.model_name,
        displayName: input.display_name,
        status: input.status,
      }),
    );
  }

  @Get(':model_id')
  async get(@Param('model_id') modelId: string): Promise<AiModelDto> {
    return presentModel(await this.getModel.execute(parseInput(idSchema, modelId)));
  }

  @Put(':model_id')
  async update(@Param('model_id') modelId: string, @Body() body: unknown): Promise<AiModelDto> {
    const input = parseInput(updateAiModelRequestSchema, body);
    return presentModel(
      await this.updateModel.execute(parseInput(idSchema, modelId), {
        modelName: input.model_name,
        displayName: input.display_name,
        status: input.status,
      }),
    );
  }

  @Delete(':model_id')
  @HttpCode(204)
  async remove(@Param('model_id') modelId: string): Promise<void> {
    await this.deleteModel.execute(parseInput(idSchema, modelId));
  }
}
