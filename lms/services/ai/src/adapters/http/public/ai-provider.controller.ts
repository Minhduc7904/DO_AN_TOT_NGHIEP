import { type Page, parseInput, Roles, toPage } from '@aiops-lms/common/http';
import {
  type AiProviderDto,
  type AiProviderHealthDto,
  createAiProviderRequestSchema,
  idSchema,
  listAiProvidersQuerySchema,
  PUBLIC_PREFIX,
  updateAiProviderRequestSchema,
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

import { CheckAllProvidersHealthUseCase } from '../../../application/use-cases/providers/check-all-providers-health.use-case.js';
import { CheckProviderHealthUseCase } from '../../../application/use-cases/providers/check-provider-health.use-case.js';
import { CreateProviderUseCase } from '../../../application/use-cases/providers/create-provider.use-case.js';
import { DeleteProviderUseCase } from '../../../application/use-cases/providers/delete-provider.use-case.js';
import { GetProviderUseCase } from '../../../application/use-cases/providers/get-provider.use-case.js';
import { ListProvidersUseCase } from '../../../application/use-cases/providers/list-providers.use-case.js';
import { UpdateProviderUseCase } from '../../../application/use-cases/providers/update-provider.use-case.js';
import { presentProvider, presentProviderHealth } from '../shared/ai.presenter.js';

@Roles('admin')
@Controller(`${PUBLIC_PREFIX}/ai/providers`)
export class AiProviderController {
  constructor(
    @Inject(ListProvidersUseCase) private readonly listProviders: ListProvidersUseCase,
    @Inject(CreateProviderUseCase) private readonly createProvider: CreateProviderUseCase,
    @Inject(GetProviderUseCase) private readonly getProvider: GetProviderUseCase,
    @Inject(UpdateProviderUseCase) private readonly updateProvider: UpdateProviderUseCase,
    @Inject(DeleteProviderUseCase) private readonly deleteProvider: DeleteProviderUseCase,
    @Inject(CheckProviderHealthUseCase) private readonly checkHealth: CheckProviderHealthUseCase,
    @Inject(CheckAllProvidersHealthUseCase)
    private readonly checkAllHealth: CheckAllProvidersHealthUseCase,
  ) {}

  @Get()
  async list(@Query() query: unknown): Promise<Page<AiProviderDto>> {
    const input = parseInput(listAiProvidersQuerySchema, query);
    const result = await this.listProviders.execute(
      { search: input.search, status: input.status, providerType: input.provider_type },
      input.page,
      input.page_size,
    );
    return toPage(result, input, presentProvider);
  }

  @Post()
  async create(@Body() body: unknown): Promise<AiProviderDto> {
    const input = parseInput(createAiProviderRequestSchema, body);
    return presentProvider(
      await this.createProvider.execute({
        name: input.name,
        providerType: input.provider_type,
        baseUrl: input.base_url,
        apiKey: input.api_key,
        status: input.status,
      }),
    );
  }

  // `health-checks` đứng trước `:provider_id` để không bị coi là id.
  @Post('health-checks')
  @HttpCode(200)
  async checkAll(): Promise<AiProviderHealthDto[]> {
    return (await this.checkAllHealth.execute()).map(presentProviderHealth);
  }

  @Get(':provider_id')
  async get(@Param('provider_id') providerId: string): Promise<AiProviderDto> {
    return presentProvider(await this.getProvider.execute(parseInput(idSchema, providerId)));
  }

  @Put(':provider_id')
  async update(
    @Param('provider_id') providerId: string,
    @Body() body: unknown,
  ): Promise<AiProviderDto> {
    const input = parseInput(updateAiProviderRequestSchema, body);
    return presentProvider(
      await this.updateProvider.execute(parseInput(idSchema, providerId), {
        name: input.name,
        providerType: input.provider_type,
        baseUrl: input.base_url,
        apiKey: input.api_key,
        status: input.status,
      }),
    );
  }

  @Delete(':provider_id')
  @HttpCode(204)
  async remove(@Param('provider_id') providerId: string): Promise<void> {
    await this.deleteProvider.execute(parseInput(idSchema, providerId));
  }

  @Post(':provider_id/health-check')
  @HttpCode(200)
  async check(@Param('provider_id') providerId: string): Promise<AiProviderHealthDto> {
    return presentProviderHealth(await this.checkHealth.execute(parseInput(idSchema, providerId)));
  }
}
