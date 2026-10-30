import {
  PUBLIC_PREFIX,
  createAccountRequestSchema,
  listAccountsQuerySchema,
  loginRequestSchema,
  refreshRequestSchema,
  registerRequestSchema,
  type AccountDto,
  type LoginResponseDto,
  type TokenPairDto,
} from '@aiops-lms/contracts';
import {
  CurrentPrincipal,
  type Page,
  parseInput,
  Anonymous,
  Roles,
  toPage,
} from '@aiops-lms/common/http';
import type { Principal } from '@aiops-lms/common/ports';
import { Body, Controller, Get, HttpCode, Inject, Post, Query } from '@nestjs/common';

import { CreateAccountUseCase } from '../../../application/use-cases/accounts/create-account.use-case.js';
import { GetCurrentAccountUseCase } from '../../../application/use-cases/accounts/get-current-account.use-case.js';
import { ListAccountsUseCase } from '../../../application/use-cases/accounts/list-accounts.use-case.js';
import { RegisterStudentUseCase } from '../../../application/use-cases/accounts/register-student.use-case.js';
import { LoginAdminUseCase } from '../../../application/use-cases/sessions/login-admin.use-case.js';
import { LoginInstructorUseCase } from '../../../application/use-cases/sessions/login-instructor.use-case.js';
import { LoginStudentUseCase } from '../../../application/use-cases/sessions/login-student.use-case.js';
import { RefreshTokenUseCase } from '../../../application/use-cases/sessions/refresh-token.use-case.js';
import { presentAccount } from '../shared/account.presenter.js';

@Controller(`${PUBLIC_PREFIX}/auth`)
export class AuthController {
  constructor(
    @Inject(RegisterStudentUseCase) private readonly registerStudent: RegisterStudentUseCase,
    @Inject(LoginStudentUseCase) private readonly loginStudent: LoginStudentUseCase,
    @Inject(LoginInstructorUseCase) private readonly loginInstructor: LoginInstructorUseCase,
    @Inject(LoginAdminUseCase) private readonly loginAdmin: LoginAdminUseCase,
    @Inject(RefreshTokenUseCase) private readonly refreshToken: RefreshTokenUseCase,
    @Inject(GetCurrentAccountUseCase) private readonly getCurrentAccount: GetCurrentAccountUseCase,
    @Inject(CreateAccountUseCase) private readonly createAccount: CreateAccountUseCase,
    @Inject(ListAccountsUseCase) private readonly listAccounts: ListAccountsUseCase,
  ) {}

  @Anonymous()
  @Post('register')
  async register(@Body() body: unknown): Promise<AccountDto> {
    const input = parseInput(registerRequestSchema, body);
    return presentAccount(
      await this.registerStudent.execute({
        email: input.email,
        password: input.password,
        fullName: input.full_name,
      }),
    );
  }

  /** Ba cửa đăng nhập riêng theo role; refresh dùng chung vì refresh token đã gắn với tài khoản. */
  @Anonymous()
  @Post('student/login')
  @HttpCode(200)
  studentLogin(@Body() body: unknown): Promise<LoginResponseDto> {
    return this.loginStudent.execute(parseInput(loginRequestSchema, body));
  }

  @Anonymous()
  @Post('instructor/login')
  @HttpCode(200)
  instructorLogin(@Body() body: unknown): Promise<LoginResponseDto> {
    return this.loginInstructor.execute(parseInput(loginRequestSchema, body));
  }

  @Anonymous()
  @Post('admin/login')
  @HttpCode(200)
  adminLogin(@Body() body: unknown): Promise<LoginResponseDto> {
    return this.loginAdmin.execute(parseInput(loginRequestSchema, body));
  }

  @Anonymous()
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() body: unknown): Promise<TokenPairDto> {
    return this.refreshToken.execute(parseInput(refreshRequestSchema, body).refresh_token);
  }

  @Get('me')
  async me(@CurrentPrincipal() principal: Principal): Promise<AccountDto> {
    return presentAccount(await this.getCurrentAccount.execute(principal.id));
  }

  @Roles('admin')
  @Post('accounts')
  async create(@Body() body: unknown): Promise<AccountDto> {
    const input = parseInput(createAccountRequestSchema, body);
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
  async list(@Query() query: unknown): Promise<Page<AccountDto>> {
    const { role, ...pagination } = parseInput(listAccountsQuerySchema, query);
    const result = await this.listAccounts.execute(
      role ? { role } : {},
      pagination.page,
      pagination.page_size,
    );
    return toPage(result, pagination, presentAccount);
  }
}
