import { CurrentPrincipal, parseInput, Public, Roles, z } from '@aiops-lms/common/http';
import { ROLES, type Principal } from '@aiops-lms/common/ports';
import { Body, Controller, Get, HttpCode, Inject, Post, Query } from '@nestjs/common';

import { CreateAccountUseCase } from '../../application/use-cases/accounts/create-account.use-case.js';
import { GetCurrentAccountUseCase } from '../../application/use-cases/accounts/get-current-account.use-case.js';
import { ListAccountsUseCase } from '../../application/use-cases/accounts/list-accounts.use-case.js';
import { RegisterStudentUseCase } from '../../application/use-cases/accounts/register-student.use-case.js';
import { LoginUseCase } from '../../application/use-cases/sessions/login.use-case.js';
import { RefreshTokenUseCase } from '../../application/use-cases/sessions/refresh-token.use-case.js';
import { presentAccount } from './account.presenter.js';

const email = z.email().max(254);
const password = z.string().min(8).max(128);
const fullName = z.string().trim().min(1).max(200);

const registerSchema = z.object({ email, password, full_name: fullName });
const loginSchema = z.object({ email, password: z.string().min(1).max(128) });
const refreshSchema = z.object({ refresh_token: z.string().trim().min(1).max(512) });
const createAccountSchema = z.object({
  email,
  password,
  full_name: fullName,
  role: z.enum(['instructor', 'admin']),
});
const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
  role: z.enum(ROLES).optional(),
});

@Controller('api/v1/auth')
export class AuthController {
  constructor(
    @Inject(RegisterStudentUseCase) private readonly registerStudent: RegisterStudentUseCase,
    @Inject(LoginUseCase) private readonly loginUseCase: LoginUseCase,
    @Inject(RefreshTokenUseCase) private readonly refreshToken: RefreshTokenUseCase,
    @Inject(GetCurrentAccountUseCase) private readonly getCurrentAccount: GetCurrentAccountUseCase,
    @Inject(CreateAccountUseCase) private readonly createAccount: CreateAccountUseCase,
    @Inject(ListAccountsUseCase) private readonly listAccounts: ListAccountsUseCase,
  ) {}

  @Public()
  @Post('register')
  async register(@Body() body: unknown): Promise<Record<string, unknown>> {
    const input = parseInput(registerSchema, body);
    return presentAccount(
      await this.registerStudent.execute({
        email: input.email,
        password: input.password,
        fullName: input.full_name,
      }),
    );
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() body: unknown): ReturnType<LoginUseCase['execute']> {
    return this.loginUseCase.execute(parseInput(loginSchema, body));
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() body: unknown): ReturnType<RefreshTokenUseCase['execute']> {
    return this.refreshToken.execute(parseInput(refreshSchema, body).refresh_token);
  }

  @Get('me')
  async me(@CurrentPrincipal() principal: Principal): Promise<Record<string, unknown>> {
    return presentAccount(await this.getCurrentAccount.execute(principal.id));
  }

  @Roles('admin')
  @Post('accounts')
  async create(@Body() body: unknown): Promise<Record<string, unknown>> {
    const input = parseInput(createAccountSchema, body);
    return presentAccount(
      await this.createAccount.execute({
        email: input.email,
        password: input.password,
        fullName: input.full_name,
        role: input.role,
      }),
    );
  }

  @Roles('admin')
  @Get('accounts')
  async list(@Query() query: unknown): Promise<Record<string, unknown>> {
    const { page, page_size, role } = parseInput(listSchema, query);
    const result = await this.listAccounts.execute(role ? { role } : {}, page, page_size);
    return { items: result.items.map(presentAccount), page, page_size, total: result.total };
  }
}
